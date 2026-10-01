import {LEAGUES,LEGACY_LEAGUE_NAMES,type Profile,type Review,type UserRepository} from './types';
type LegacyAccount={profile:Profile;salt:string;digest:string;reviews:Review[]};
const legacyKey='gip.mock.v1',movedKey='gip.migrated.v1';
function legacy(){try{const store=JSON.parse(localStorage.getItem(legacyKey)??'null');return store?.version===1&&Array.isArray(store.accounts)?store as {accounts:LegacyAccount[];currentId:string|null}:null;}catch{return null;}}
function normalized(code:string){return code.toUpperCase().replace(/[-\s]/g,'');}
function migrated(id:string){try{return JSON.parse(localStorage.getItem(movedKey)??'[]').includes(id);}catch{return false;}}
export function legacyLoginCode(){const s=legacy(),a=s?.accounts.find(a=>a.profile.id===s.currentId)??s?.accounts[0];return a&&!migrated(a.profile.id)?a.profile.gipCode:null;}
class ApiError extends Error{constructor(message:string,public status:number){super(message);}}
async function api<T>(action:string,body?:unknown):Promise<T>{const response=await fetch(`/api/account/${action}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const data=await response.json() as T & {error?:string};if(!response.ok)throw new ApiError(data.error??'요청을 완료하지 못했어요. 다시 시도해 주세요.',response.status);return data;}
async function verify(password:string,a:LegacyAccount){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(a.salt),iterations:100000,hash:'SHA-256'},key,256);return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('')===a.digest;}
export const serverUserRepository:UserRepository={
 current:()=>api<Profile|null>('session'),
 signUp:(nickname,password)=>api<Profile>('signup',{nickname,password}),
 async signIn(code,password){
  const codeValue=normalized(code),a=legacy()?.accounts.find(a=>normalized(a.profile.gipCode)===codeValue);
  const importAccount=a&&!migrated(a.profile.id)&&await verify(password,a)?a:null;
  let profile:Profile;
  try{profile=await api<Profile>('login',{code:codeValue,password});}
  catch(error){if(!(error instanceof ApiError)||error.status!==401||!importAccount)throw error;
   profile=await api<Profile>('migrate',{code:codeValue,password,salt:importAccount.salt,digest:importAccount.digest,profile:{...importAccount.profile,leagues:importAccount.profile.leagues.map(l=>LEGACY_LEAGUE_NAMES[l]??l).filter(l=>LEAGUES.includes(l))}});
  }
  if(importAccount){
   // Stable review IDs make interrupted transfers safe to resume. Never erase the backup.
   const existing=await api<Review[]>('reviews');
   for(const review of importAccount.reviews)if(!existing.some(r=>r.id===review.id))await api('review',{id:review.id,review});
   try{const moved=JSON.parse(localStorage.getItem(movedKey)??'[]');localStorage.setItem(movedKey,JSON.stringify([...new Set([...moved,importAccount.profile.id])]));}catch{/* A blocked local marker only triggers an idempotent re-check next login. */}
  }
  return profile;
 },
 signOut:async()=>{await api('logout',{});},
 update:profile=>api<Profile>('profile',profile),
 reviews:()=>api<Review[]>('reviews'),
 saveReview:(review,id)=>api<Review>('review',{review,id}),
 deleteReview:async id=>{await api('review',{id,remove:true});}
};
