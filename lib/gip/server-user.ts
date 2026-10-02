import {isInstalledApp,rememberDevice,restoreDevice,forgetDevice} from './device-login';
import {LEAGUES,LEGACY_LEAGUE_NAMES,type Profile,type Review,type UserRepository} from './types';
type LegacyAccount={profile:Profile;salt:string;digest:string;reviews:Review[]};
const legacyKey='gip.mock.v1',movedKey='gip.migrated.v1';
function legacy(){try{const store=JSON.parse(localStorage.getItem(legacyKey)??'null');return store?.version===1&&Array.isArray(store.accounts)?store as {accounts:LegacyAccount[];currentId:string|null}:null;}catch{return null;}}
function normalized(code:string){return code.toUpperCase().replace(/[-\s]/g,'');}
function migrated(id:string){try{return JSON.parse(localStorage.getItem(movedKey)??'[]').includes(id);}catch{return false;}}
export function legacyLoginNickname(){const s=legacy(),a=s?.accounts.find(a=>a.profile.id===s.currentId)??s?.accounts[0];return a&&!migrated(a.profile.id)?a.profile.nickname:null;}
class ApiError extends Error{constructor(message:string,public status:number){super(message);}}
async function api<T>(action:string,body?:unknown):Promise<T>{const response=await fetch(`/api/account/${action}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await response.json() as T & {error?:string};if(!response.ok)throw new ApiError(data.error??'요청을 완료하지 못했어요. 다시 시도해 주세요.',response.status);return data;}
let deviceWarning='';
export function deviceLoginWarning(){return deviceWarning;}
async function keepDevice(profile:Profile){
 try{await rememberDevice(profile,api);deviceWarning='';}
 catch{deviceWarning='홈 화면 앱의 자동 로그인 정보를 저장하지 못했어요. 앱을 닫기 전에 새로고침해 다시 연결해 주세요.';}
}
async function verify(password:string,a:LegacyAccount){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(a.salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')===a.digest;}
export const serverUserRepository:UserRepository={
 async current(){
  let profile=await api<Profile|null>('session');
  if(!profile&&isInstalledApp())profile=await restoreDevice(api)??await api<Profile|null>('session');
  if(profile)await keepDevice(profile);
  return profile;
 },
 async signUp(nickname,password){const profile=await api<Profile>('signup',{nickname,password});await keepDevice(profile);return profile;},
 async signIn(nickname,password){
  const matches:LegacyAccount[]=[];
  for(const a of legacy()?.accounts??[])if(a.profile.nickname===nickname.trim()&&!migrated(a.profile.id)&&await verify(password,a))matches.push(a);
  if(matches.length>1)throw Error('같은 로그인 정보의 기존 계정이 여러 개 있어요. 고객센터에 문의해 주세요.');
  const importAccount=matches[0]??null,codeValue=importAccount?normalized(importAccount.profile.gipCode):'';
  let profile:Profile;
  try{profile=await api<Profile>('login',importAccount?{code:codeValue,password}:{nickname,password});}
  catch(error){if(!(error instanceof ApiError)||error.status!==401||!importAccount)throw error;
   profile=await api<Profile>('migrate',{code:codeValue,password,salt:importAccount.salt,digest:importAccount.digest,profile:{...importAccount.profile,leagues:importAccount.profile.leagues.map(l=>LEGACY_LEAGUE_NAMES[l]??l).filter(l=>LEAGUES.includes(l))}});
  }
  if(importAccount){
   // Stable review IDs make interrupted transfers safe to resume. Never erase the backup.
   const existing=await api<Review[]>('reviews');
   for(const review of importAccount.reviews)if(!existing.some(r=>r.id===review.id))await api('review',{id:review.id,review});
   try{const moved=JSON.parse(localStorage.getItem(movedKey)??'[]');localStorage.setItem(movedKey,JSON.stringify([...new Set([...moved,importAccount.profile.id])]));}catch{/* A blocked local marker only triggers an idempotent re-check next login. */}
  }
  await keepDevice(profile);
  return profile;
 },
 signOut:async()=>{await api('logout',{});await forgetDevice();deviceWarning='';},
 update:(profile,password)=>api<Profile>('profile',{...profile,...(password?{password}:{})}),
 reviews:()=>api<Review[]>('reviews'),
 saveReview:(review,id)=>api<Review>('review',{review,id}),
 deleteReview:async id=>{await api('review',{id,remove:true});}
};
