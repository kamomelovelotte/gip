import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'gip-production-'));
const base='http://127.0.0.1:3097';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3097'],{env:{...process.env,TURSO_DATABASE_URL:'file:'+dir+'/test.db',TURSO_AUTH_TOKEN:'local-test-only'},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),15000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve();}});server.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code));});server.stderr.on('data',d=>process.stderr.write(d));});
 const home=await fetch(base);assert.equal(home.status,200);assert((await home.text()).includes('GIP'));
 const call=(action,body,cookie='')=>fetch(base+'/api/account/'+action,{method:body===undefined?'GET':'POST',headers:{origin:base,'Content-Type':'application/json',cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const signup=await call('signup',{nickname:'배포검증',password:'smoke-test-password'});assert.equal(signup.status,200);const user=await signup.json(),c=signup.headers.get('set-cookie').split(';')[0];
 const review={kind:'visit',gameId:null,date:'2026-10-01',matchup:'테스트',venue:'사직야구장',content:'서버 저장 확인',seat:'1루',photoData:'data:image/png;base64,iVBORw0KGgo='};
 let saved=await call('review',{review},c);assert.equal(saved.status,200);saved=await saved.json();
 const login=await call('login',{code:user.gipCode,password:'smoke-test-password'});assert.equal(login.status,200);const other=login.headers.get('set-cookie').split(';')[0];
 const list=await(await call('reviews',undefined,other)).json();assert.equal(list.length,1);assert.equal((await call('photo?id='+saved.id,undefined,other)).status,200);
 const removedTranslation=await fetch(base+'/api/baseball/translate',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({language:'ja',texts:['投手']})});assert.equal(removedTranslation.status,404);
 console.log('PASS production HTTP: home; signup/login; two sessions; SQL review/photo; removed translation endpoint returns 404');
}finally{server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
