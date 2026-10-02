const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');process.env.NODE_ENV='test';process.env.TURSO_DATABASE_URL=':memory:';
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?root+'/'+name.slice(2):name,...args);};
Module._extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {accountRequest,hash}=require('../lib/gip/server/accounts.ts');
const {database}=require('../lib/gip/server/account-store.ts');
async function call(action,body,cookie='',origin='https://gip.test'){
 const response=await accountRequest(new Request('https://gip.test/api/account/'+action,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),action);
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
}
async function device(cookie){
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const id=crypto.randomUUID(),publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);
 assert.equal((await call('device-register',{deviceId:id,publicKey})).status,401);
 assert.equal((await call('device-register',{deviceId:id,publicKey},cookie,'https://evil.test')).status,403);
 assert.equal((await call('device-register',{deviceId:id,publicKey},cookie)).status,200);
 // IndexedDB uses the structured-clone algorithm; the key survives a new context
 // without becoming exportable, and no browser cookie is needed for the proof.
 const privateKey=structuredClone(keys.privateKey);
 await assert.rejects(crypto.subtle.exportKey('jwk',privateKey));
 return {id,privateKey};
}
async function proof(device){
 const result=await call('device-challenge',{deviceId:device.id});assert.equal(result.status,200);
 const challenge=result.data.challenge;
 const bytes=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},device.privateKey,new TextEncoder().encode(`GIP device login:${device.id}:${challenge}`));
 return {deviceId:device.id,challenge,signature:Buffer.from(bytes).toString('hex')};
}
(async()=>{
 const a=await call('signup',{nickname:'같은 닉네임',password:'first-password'}),b=await call('signup',{nickname:'같은 닉네임',password:'second-password'});
 assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.data.gipCode,b.data.gipCode);
 assert.equal((await call('signup',{nickname:'같은 닉네임',password:'first-password'})).status,409);
 assert.equal((await call('login',{nickname:'같은 닉네임',password:'first-password'})).data.id,a.data.id);
 assert.equal((await call('login',{nickname:'같은 닉네임',password:'second-password'})).data.id,b.data.id);
 assert.equal((await call('login',{nickname:'같은 닉네임',password:'wrong-password'})).status,401);
 assert.equal((await call('profile',{...a.data,nickname:'새 이름'},a.cookie)).status,400);
 assert.equal((await call('profile',{...a.data,nickname:'새 이름',password:'wrong-password'},a.cookie)).status,401);
 const renamed=await call('profile',{...a.data,nickname:'새 이름',password:'first-password'},a.cookie);assert.equal(renamed.status,200);assert.equal(renamed.data.gipCode,a.data.gipCode);
 assert.equal((await call('login',{nickname:'새 이름',password:'first-password'})).data.id,a.data.id);
 const collision=await call('signup',{nickname:'이름 변경 충돌',password:'first-password'});assert.equal(collision.status,200);
 assert.equal((await call('profile',{...renamed.data,nickname:'이름 변경 충돌',password:'first-password'},a.cookie)).status,409);

 assert.match(a.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Expires=/);
 const firstDevice=await device(a.cookie),secondDevice=await device(b.cookie),request=await proof(firstDevice);
 assert.equal((await call('device-resume',{...request,signature:'0'.repeat(128)})).status,401);
 const reopened=await call('device-resume',request);assert.equal(reopened.status,200);assert.equal(reopened.data.id,a.data.id);
 assert.equal((await call('device-resume',request)).status,401,'a signed challenge can only be consumed once');
 assert.equal((await call('session',undefined,a.cookie)).data,null,'replaced cookie is revoked');
 assert.equal((await call('session',undefined,reopened.cookie)).data.id,a.data.id);
 const logout=await call('logout',{},reopened.cookie);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await call('device-challenge',{deviceId:firstDevice.id})).status,401,'logout revokes device restoration');
 assert.equal((await call('logout',{},reopened.cookie)).status,200,'logout remains safe to retry');
 assert.equal((await call('session',undefined,reopened.cookie)).data,null);
 assert.equal((await call('session',undefined,b.cookie)).data.id,b.data.id,'other device is independent');

 const originalNow=Date.now,base=originalNow(),day=86400000;
 try{
  Date.now=()=>base+29*day;
  const refreshed=await call('session',undefined,b.cookie);assert.equal(refreshed.data.id,b.data.id);assert.match(refreshed.headers.get('set-cookie'),/Max-Age=2592000/);
  const expires=await database().prepare('SELECT expires FROM sessions WHERE token_hash=?').bind(await hash(b.cookie.split('=')[1])).first();assert.equal(expires.expires,base+59*day);
  Date.now=()=>base+31*day;
  assert.equal((await call('device-challenge',{deviceId:secondDevice.id})).status,401,'inactive device proof expires independently');
  assert.equal((await call('session',undefined,b.cookie)).data.id,b.data.id,'renewed cookie remains valid after its original expiry');
  Date.now=()=>base+62*day;
  assert.equal((await call('session',undefined,b.cookie)).data,null,'expired sessions are never revived');
 }finally{Date.now=originalNow;}
 const duplicateId=crypto.randomUUID(),existing=await database().prepare('SELECT * FROM accounts WHERE id=?').bind(a.data.id).first();
 await database().prepare('INSERT INTO accounts(id,code,salt,password_hash,profile) VALUES(?,?,?,?,?)').bind(duplicateId,'DUPTEST',existing.salt,existing.password_hash,JSON.stringify({...JSON.parse(existing.profile),id:duplicateId,gipCode:'DUPTEST'})).run();
 assert.equal((await call('login',{nickname:'새 이름',password:'first-password'})).status,409,'old ambiguous credentials must never choose an arbitrary account');
 console.log('PASS: nickname login, duplicate names and distinct passwords, duplicate combination rejection, rename verification, persistent cookies, signed device restoration without cookies, replay/tamper rejection, logout revocation, independent devices, rolling renewal and expiry');
})().catch(error=>{console.error(error);process.exitCode=1;});
