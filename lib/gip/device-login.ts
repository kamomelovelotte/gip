import type {Profile} from './types';

type Device={id:string;userId:string;privateKey:CryptoKey;publicKey:JsonWebKey};
type AccountApi=<T>(action:string,body?:unknown)=>Promise<T>;
const algorithm={name:'ECDSA',namedCurve:'P-256'};

export function isInstalledApp(){
 return typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
}

// Structured cloning keeps the private CryptoKey non-extractable in IndexedDB.
// No password, session token, or private-key bytes are put in localStorage.
function storedDevice(mode:'read'|'write'|'delete',value?:Device):Promise<Device|undefined>{
 return new Promise((resolve,reject)=>{
  const open=indexedDB.open('gip-device-login-v1',1);
  open.onupgradeneeded=()=>{open.result.createObjectStore('device');};
  open.onerror=()=>reject(open.error);
  open.onblocked=()=>reject(Error('기기 저장소를 열지 못했어요.'));
  open.onsuccess=()=>{
   const db=open.result,transaction=db.transaction('device',mode==='read'?'readonly':'readwrite'),store=transaction.objectStore('device');
   const request=mode==='read'?store.get('current'):mode==='write'?store.put(value,'current'):store.delete('current');
   transaction.oncomplete=()=>{db.close();resolve(mode==='read'?request.result:undefined);};
   transaction.onabort=()=>{db.close();reject(transaction.error);};
   transaction.onerror=()=>{db.close();reject(transaction.error);};
  };
 });
}

export async function rememberDevice(profile:Profile,api:AccountApi){
 if(!isInstalledApp())return;
 let device=await storedDevice('read');
 if(!device||device.userId!==profile.id){
  const keys=await crypto.subtle.generateKey(algorithm,false,['sign','verify']);
  device={id:crypto.randomUUID(),userId:profile.id,privateKey:keys.privateKey,publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)};
 }
 await api('device-register',{deviceId:device.id,publicKey:device.publicKey});
 await storedDevice('write',device);
}

export async function forgetDevice(){
 try{await storedDevice('delete');}catch{/* Server revocation still prevents reuse. */}
}

export async function restoreDevice(api:AccountApi):Promise<Profile|null>{
 if(!isInstalledApp())return null;
 let device:Device|undefined;
 try{device=await storedDevice('read');}catch{return null;}
 if(!device)return null;
 try{
  const {challenge}=await api<{challenge:string}>('device-challenge',{deviceId:device.id});
  const signed=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},device.privateKey,new TextEncoder().encode(`GIP device login:${device.id}:${challenge}`));
  const signature=[...new Uint8Array(signed)].map(n=>n.toString(16).padStart(2,'0')).join('');
  return await api<Profile>('device-resume',{deviceId:device.id,challenge,signature});
 }catch(error){
  if(error&&typeof error==='object'&&'status' in error&&error.status===401){await forgetDevice();return null;}
  // Network trouble must not erase the registered device or masquerade as logout.
  throw error;
 }
}
