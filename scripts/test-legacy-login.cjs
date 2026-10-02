const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..');process.env.NODE_ENV='test';process.env.TURSO_DATABASE_URL=':memory:';
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?root+'/'+name.slice(2):name,...args);};
Module._extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {accountRequest,passwordHash}=require('../lib/gip/server/accounts.ts');
const {serverUserRepository:users}=require('../lib/gip/server-user.ts');
const storage=new Map();global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
let cookie='',calls=[],offline=false;
global.fetch=async(url,options={})=>{
 const action=url.split('/').pop();calls.push({action,body:options.body?JSON.parse(options.body):null});
 if(offline)return Response.json({error:'Temporary outage'},{status:503});
 const response=await accountRequest(new Request('https://gip.test'+url,{...options,headers:{...options.headers,origin:'https://gip.test',cookie}}),action);
 if(response.headers.has('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 return response;
};
async function localAccount(profile,password,code=profile.gipCode){const salt=crypto.randomUUID();return {profile:{...profile,id:crypto.randomUUID(),gipCode:code},salt,digest:await passwordHash(password,salt),reviews:[]};}
function saveLocal(accounts){storage.clear();storage.set('gip.mock.v1',JSON.stringify({version:1,accounts,currentId:accounts[0]?.profile.id??null}));cookie='';calls=[];}
(async()=>{
 const password='regression-password',profile=await users.signUp('Saved account',password);
 const stale=await localAccount(profile,password,'OLDCODE');
 stale.reviews=[{id:crypto.randomUUID(),kind:'line',date:'2026-10-02',gameId:null,matchup:'test',venue:'',content:'local backup',seat:''}];
 saveLocal([stale]);const backup=storage.get('gip.mock.v1');
 const restored=await users.signIn(profile.nickname,password);
 assert.equal(restored.id,profile.id);assert.equal(restored.gipCode,profile.gipCode);
 assert.equal(calls.some(c=>c.action==='migrate'),false,'stale local code must not trigger account creation');
 assert.equal(calls.some(c=>c.action==='review'),false,'different codes must not silently merge records');
 assert.equal(storage.get('gip.mock.v1'),backup);assert.equal(storage.has('gip.migrated.v1'),false);
 assert.equal((await users.current()).id,profile.id);
 const duplicate=await localAccount(profile,password,'OTHEROLD');saveLocal([stale,duplicate]);assert.equal((await users.signIn(profile.nickname,password)).id,profile.id);
 saveLocal([stale]);await assert.rejects(users.signIn(profile.nickname,'wrong-password'),error=>error.status===401);assert.equal(calls.some(c=>c.action==='migrate'),false);
 saveLocal([stale]);offline=true;await assert.rejects(users.signIn(profile.nickname,password),error=>error.status===503);offline=false;assert.equal(calls.length,1);
 const same=await localAccount(profile,password);same.reviews=stale.reviews;saveLocal([same]);
 assert.equal((await users.signIn(profile.nickname,password)).id,profile.id);assert.equal((await users.reviews()).length,1);
 assert.deepEqual(JSON.parse(storage.get('gip.migrated.v1')),[same.profile.id]);
 await users.signIn(profile.nickname,password);assert.equal((await users.reviews()).length,1);
 const legacy=await localAccount({...profile,nickname:'Only legacy'},password,'LEGACY1');saveLocal([legacy]);
 const migrated=await users.signIn('Only legacy',password);assert.equal(migrated.gipCode,'LEGACY1');assert.equal(calls.some(c=>c.action==='migrate'),true);
 assert.equal((await users.current()).id,migrated.id);assert(storage.get('gip.mock.v1'));
 console.log('PASS: server-first nickname login with stale local code, duplicate local names, no cross-code record merge, wrong password/outage rejection, same-code idempotent import, legacy-only migration and session restoration');
})().catch(error=>{console.error(error);process.exitCode=1;});
