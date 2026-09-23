import { LEAGUES, LEGACY_LEAGUE_NAMES, League, Profile, Review, UserRepository } from './types';
// Deliberately device-local mock adapter. Replace through repositories.ts for production.
// This is NOT an authentication or authorization boundary.
type Account = { profile: Profile; salt: string; digest: string; reviews: Review[] };
type Store = { version: 1; accounts: Account[]; currentId: string | null };
const KEY='gip.mock.v1';
function read(): Store { const raw=localStorage.getItem(KEY);if(!raw)return {version:1,accounts:[],currentId:null};try{const data:Store=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.accounts))throw Error();for(const a of data.accounts){a.profile.leagues=Array.from(new Set(a.profile.leagues.map(l=>LEGACY_LEAGUE_NAMES[l]??l).filter((l):l is League=>LEAGUES.includes(l as League))));}return data;}catch{throw Error('이 브라우저에 저장된 데이터를 읽을 수 없어요. 고객센터의 초기화 안내를 확인해 주세요.');} }
function write(store:Store){try{localStorage.setItem(KEY,JSON.stringify(store));}catch{throw Error('이 브라우저에 저장할 수 없어요. 저장 공간과 브라우저 설정을 확인해 주세요.');}}
function account(s:Store){const a=s.accounts.find(a=>a.profile.id===s.currentId);if(!a)throw Error('먼저 로그인해 주세요.');return a;}
async function digest(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');}
function newCode(){const bytes=crypto.getRandomValues(new Uint32Array(1));return String(10000+(bytes[0]%90000));}
export const mockUserRepository: UserRepository = {
 async current(){const s=read();return s.accounts.find(a=>a.profile.id===s.currentId)?.profile??null;},
 async signUp(nickname,password){if(!nickname.trim()||nickname.trim().length>20)throw Error('닉네임은 1~20자로 입력해 주세요.');if(password.length<8)throw Error('비밀번호는 8자 이상 입력해 주세요.');const s=read();let code=newCode();while(s.accounts.some(a=>a.profile.gipCode===code))code=newCode();const profile:Profile={id:crypto.randomUUID(),gipCode:code,nickname:nickname.trim(),teamIds:[],leagues:[...LEAGUES],notifications:{start:false,final:false},createdAt:new Date().toISOString()};const salt=crypto.randomUUID();const hash=await digest(password,salt);s.accounts.push({profile,salt,digest:hash,reviews:[]});s.currentId=profile.id;write(s);return profile;},
 async signIn(code,password){const s=read();const normalized=code.toUpperCase().replace(/[^A-Z0-9]/g,'');const a=s.accounts.find(a=>a.profile.gipCode.replace('-','')===normalized);if(!a||await digest(password,a.salt)!==a.digest)throw Error('GIP CODE 또는 비밀번호를 확인해 주세요.');s.currentId=a.profile.id;write(s);return a.profile;},
 async signOut(){const s=read();s.currentId=null;write(s);},
 async update(profile){const s=read();const a=account(s);if(a.profile.id!==profile.id)throw Error('로그인이 필요해요.');a.profile={...profile,id:a.profile.id,gipCode:a.profile.gipCode};write(s);return a.profile;},
 async reviews(){return account(read()).reviews;},
 async saveReview(input,id){const s=read();const a=account(s);const old=id?a.reviews.find(r=>r.id===id):undefined;if(id&&!old)throw Error('기록을 찾을 수 없어요.');if(!input.content.trim()||input.content.length>(input.kind==='line'?100:3000))throw Error('후기 내용을 확인해 주세요.');const now=new Date().toISOString();const review:Review={...input,content:input.content.trim(),id:old?.id??crypto.randomUUID(),userId:a.profile.id,createdAt:old?.createdAt??now,updatedAt:now};a.reviews=old?a.reviews.map(r=>r.id===id?review:r):[review,...a.reviews];write(s);return review;},
 async deleteReview(id){const s=read();const a=account(s);a.reviews=a.reviews.filter(r=>r.id!==id);write(s);}
};
