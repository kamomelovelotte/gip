import {sameOrigin} from './same-origin';
import {z} from 'zod';
import {database,photos,StorageConfigurationError} from './account-store';
import {LEAGUES,type Profile,type Review} from '../types';
import {TEAMS} from '../catalog';
const cookieName='gip_session',encoder=new TextEncoder();
const codeSchema=z.string().transform(s=>s.toUpperCase().replace(/[-\s]/g,'')).pipe(z.string().regex(/^[A-Z0-9]{5,9}$/));
const passwordSchema=z.string().min(8).max(128);
const prefs=z.object({nickname:z.string().trim().min(1).max(20),teamIds:z.array(z.string()).max(300).transform(ids=>[...new Set(ids.filter(id=>TEAMS.some(t=>t.id===id)))]),leagues:z.array(z.enum(LEAGUES)).max(40)});
const reviewSchema=z.object({kind:z.enum(['line','visit']),gameId:z.string().max(80).nullable(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),matchup:z.string().trim().min(1).max(100),venue:z.string().max(100),content:z.string().trim().min(1).max(3000),seat:z.string().max(100),photoData:z.string().max(2100000).optional(),photoName:z.string().max(200).optional()}).refine(r=>r.kind!=='line'||r.content.length<=100,{message:'한줄평은 100자까지 입력할 수 있어요.'});
type Account={id:string;code:string;salt:string;password_hash:string;profile:string};
// Read current fields only, while keeping older accounts and their records intact.
function publicProfile(account:Account):Profile{const {id,gipCode,nickname,teamIds,leagues,createdAt}=JSON.parse(account.profile);return {id,gipCode,nickname,teamIds,leagues,createdAt};}
type Row={id:string;user_id:string;body:string;photo_key:string|null};
export class AccountError extends Error{constructor(message:string,public status=400){super(message);}}
export async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return [...new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations:100000},key,256))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
function token(request:Request){return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';}
function json(value:unknown,status=200,cookie?:string){return Response.json(value,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});}
function sessionCookie(value:string,maxAge:number){return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export async function authenticate(request:Request){const raw=token(request);if(!/^[a-f0-9]{64}$/.test(raw))return null;return database().prepare('SELECT a.* FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.token_hash=? AND s.expires>?').bind(await hash(raw),Date.now()).first<Account>();}
async function signInResponse(account:Account,request:Request){const db=database(),raw=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');const old=token(request);await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(old)),db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await hash(raw),account.id,Date.now()+30*86400000)]);return json(publicProfile(account),200,sessionCookie(raw,30*86400));}
async function limit(request:Request,scope:string,max:number){const db=database(),now=Date.now(),bucket=Math.floor(now/900000),ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()??'unknown';const keys=[`${scope.split(':')[0]}:ip:${await hash(ip)}:${bucket}`,...(scope.includes(':')?[`${scope}:${bucket}`]:[])];for(const key of keys){const result=await db.prepare('INSERT INTO auth_limits(key,hits,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now+1800000).first<{hits:number}>();if((result?.hits??0)>max)throw new AccountError('로그인 시도가 많아요. 15분 후 다시 시도해 주세요.',429);}await db.prepare('DELETE FROM auth_limits WHERE expires<?').bind(now).run();}
async function body(request:Request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AccountError('요청 형식을 확인해 주세요.',415);if(Number(request.headers.get('content-length')??0)>2200000)throw new AccountError('첨부 파일이 너무 커요.',413);const text=await request.text();if(text.length>2200000)throw new AccountError('첨부 파일이 너무 커요.',413);return JSON.parse(text);}
function publicReview(row:Row):Review {return {...JSON.parse(row.body),...(row.photo_key?{photoData:`/api/account/photo?id=${encodeURIComponent(row.id)}`}:{})};}
export async function accountRequest(request:Request,action:string):Promise<Response>{
 try {
  if(request.method==='POST'){const origin=request.headers.get('origin');if(origin&&!sameOrigin(request))throw new AccountError('허용되지 않은 요청이에요.',403);if(request.headers.get('sec-fetch-site')==='cross-site')throw new AccountError('허용되지 않은 요청이에요.',403);}
  const db=database();
  if(action==='session'&&request.method==='GET'){const account=await authenticate(request);return json(account?publicProfile(account):null);}
  if(['signup','login','migrate'].includes(action)&&request.method==='POST'){
   const input=await body(request),password=passwordSchema.parse(input.password);
   if(action==='login'){
    const code=codeSchema.parse(input.code);await limit(request,`login:${code}`,20);
    const account=await db.prepare('SELECT * FROM accounts WHERE code=?').bind(code).first<Account>();
    const computed=await passwordHash(password,account?.salt??'gip-invalid-account');
    if(!account||!equal(computed,account.password_hash))throw new AccountError('GIP CODE 또는 비밀번호를 확인해 주세요. 기존 계정은 가입한 브라우저에서 먼저 로그인해 주세요.',401);
    return await signInResponse(account,request);
   }
   await limit(request,'signup',10);
   const settings=action==='migrate'?prefs.parse(input.profile):prefs.parse({nickname:input.nickname,teamIds:[],leagues:[...LEAGUES]});
   let code=action==='migrate'?codeSchema.parse(input.code):'';
   if(action==='migrate'){
    const salt=z.string().max(100).parse(input.salt),digest=z.string().regex(/^[a-f0-9]{64}$/).parse(input.digest);
    if(!equal(await passwordHash(password,salt),digest))throw new AccountError('기존 비밀번호를 확인해 주세요.',401);
    if(await db.prepare('SELECT id FROM accounts WHERE code=?').bind(code).first())throw new AccountError('이 집코드는 이미 등록되어 있어요. 기존 브라우저 기록은 그대로 보관돼요.',409);
   }
   const id=crypto.randomUUID(),salt=crypto.randomUUID(),digest=await passwordHash(password,salt);
   for(let attempt=0;attempt<12;attempt++){
    if(action==='signup')code=String(10000+crypto.getRandomValues(new Uint32Array(1))[0]%90000);
    const profile:Profile={...settings,id,gipCode:code,createdAt:new Date().toISOString()};
    const result=await db.prepare('INSERT INTO accounts(id,code,salt,password_hash,profile) VALUES(?,?,?,?,?) ON CONFLICT(code) DO NOTHING').bind(id,code,salt,digest,JSON.stringify(profile)).run();
    if(result.meta.changes)return await signInResponse({id,code,salt,password_hash:digest,profile:JSON.stringify(profile)},request);
    if(action==='migrate')throw new AccountError('이 집코드는 이미 등록되어 있어요.',409);
   }
   throw new AccountError('집코드를 만들지 못했어요. 다시 시도해 주세요.',503);
  }
  const account=await authenticate(request);if(!account)throw new AccountError('다시 로그인해 주세요.',401);
  if(action==='logout'&&request.method==='POST'){await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token(request))).run();return json({ok:true},200,sessionCookie('',0));}
  if(action==='profile'&&request.method==='POST'){const settings=prefs.parse(await body(request)),profile={...publicProfile(account),...settings};await db.prepare('UPDATE accounts SET profile=? WHERE id=?').bind(JSON.stringify(profile),account.id).run();return json(profile);}
  if(action==='reviews'&&request.method==='GET'){const rows=await db.prepare('SELECT * FROM reviews WHERE user_id=?').bind(account.id).all<Row>();return json(rows.results.map(publicReview));}
  if(action==='photo'&&request.method==='GET'){const id=new URL(request.url).searchParams.get('id');const row=await db.prepare('SELECT photo_key FROM reviews WHERE user_id=? AND id=?').bind(account.id,id).first<{photo_key:string|null}>();if(!row?.photo_key)throw new AccountError('사진을 찾을 수 없어요.',404);const object=await photos().get(row.photo_key);if(!object)throw new AccountError('사진을 찾을 수 없어요.',404);return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  if(action==='review'&&request.method==='POST'){
   const input=await body(request),id=input.id?z.string().uuid().parse(input.id):crypto.randomUUID();
   const old=await db.prepare('SELECT * FROM reviews WHERE user_id=? AND id=?').bind(account.id,id).first<Row>();
   if(input.remove){if(old){await db.prepare('DELETE FROM reviews WHERE user_id=? AND id=?').bind(account.id,id).run();if(old.photo_key)await photos().delete(old.photo_key);}return json({ok:true});}
   const parsed=reviewSchema.parse(input.review),{photoData,...fields}=parsed;let photoKey:string|null=null;
   if(photoData?.startsWith('/api/account/photo?')){if(!old?.photo_key||photoData!==`/api/account/photo?id=${encodeURIComponent(id)}`)throw new AccountError('사진을 다시 첨부해 주세요.');photoKey=old.photo_key;}
   else if(photoData){const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(photoData);if(!match)throw new AccountError('PNG, JPG, WebP, GIF 사진을 첨부해 주세요.');const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));if(bytes.length>1500000)throw new AccountError('사진은 1.5MB 이하로 첨부해 주세요.');photoKey=`${account.id}/${id}/${crypto.randomUUID()}`;await photos().put(photoKey,bytes,{httpMetadata:{contentType:match[1]}});}
   const now=new Date().toISOString();const review:Review={...fields,id,userId:account.id,createdAt:old?JSON.parse(old.body).createdAt:now,updatedAt:now};
   try{await db.prepare('INSERT INTO reviews(user_id,id,body,photo_key) VALUES(?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET body=excluded.body,photo_key=excluded.photo_key').bind(account.id,id,JSON.stringify(review),photoKey).run();}catch(e){if(photoKey&&photoKey!==old?.photo_key)await photos().delete(photoKey);throw e;}
   if(old?.photo_key&&old.photo_key!==photoKey)await photos().delete(old.photo_key);
   return json(publicReview({id,user_id:account.id,body:JSON.stringify(review),photo_key:photoKey}));
  }
  throw new AccountError('요청을 찾을 수 없어요.',404);
 }catch(error){if(error instanceof StorageConfigurationError)return json({error:error.message},503);if(error instanceof AccountError)return json({error:error.message},error.status);if(error instanceof z.ZodError)return json({error:'입력한 내용과 글자 수를 확인해 주세요.'},400);console.error('Account request failed',error instanceof Error?error.name:'unknown');return json({error:'저장소에 연결하지 못했어요. 입력 내용은 그대로 두고 잠시 후 다시 시도해 주세요.'},503);}
}
