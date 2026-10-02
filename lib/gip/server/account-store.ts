import {createClient,type Client,type InValue,type ResultSet} from '@libsql/client';
import {schema} from './database-schema';

let client:Client|undefined,ready:Promise<void>|undefined;
export function storageConfigured(){return Boolean(process.env.TURSO_DATABASE_URL && (process.env.TURSO_AUTH_TOKEN || process.env.NODE_ENV!=='production'));}
export class StorageConfigurationError extends Error {}
function connection(){
  if(client)return client;
  const url=process.env.TURSO_DATABASE_URL;
  if(!url||(!process.env.TURSO_AUTH_TOKEN&&process.env.NODE_ENV==='production'))throw new StorageConfigurationError('운영자가 데이터베이스 연결을 완료해야 로그인과 기록 저장을 사용할 수 있어요.');
  if(process.env.VERCEL && !/^(libsql|https):\/\//.test(url))throw new StorageConfigurationError('운영 환경에는 영구 저장용 데이터베이스가 필요해요.');
  client=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN});return client;
}
async function initialized(){
  const db=connection();
  if(!ready)ready=db.batch(schema,'write').then(()=>{}).catch(error=>{ready=undefined;throw error;});
  await ready;return db;
}
function result<T>(data:ResultSet){return {results:data.rows.map(row=>Object.fromEntries(data.columns.map(key=>[key,row[key]])) as T),meta:{changes:data.rowsAffected}};}
class Statement {
  constructor(public sql:string,public args:InValue[]=[],private executor?:Pick<Client,'execute'>){ }
  bind(...args:InValue[]){return new Statement(this.sql,args,this.executor);}
  async all<T=Record<string,unknown>>(){return result<T>(await(this.executor??await initialized()).execute({sql:this.sql,args:this.args}));}
  async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]??null;}
  async run(){return this.all();}
}
const store={prepare(sql:string){return new Statement(sql);},async batch(statements:Statement[]){const db=await initialized();return (await db.batch(statements.map(s=>({sql:s.sql,args:s.args})),'write')).map(r=>result<Record<string,unknown>>(r));}};
export function database(){connection();return store;}
export async function accountTransaction<T>(write:(db:{prepare(sql:string):Statement})=>Promise<T>){
 const transaction=await(await initialized()).transaction('write');
 try{const value=await write({prepare:sql=>new Statement(sql,[],transaction)});await transaction.commit();return value;}
 catch(error){await transaction.rollback();throw error;}
 finally{transaction.close();}
}
// Photos are kept in the same persistent database, so a second storage account
// is not needed. Ownership is checked by the account route before every read.
export function photos(){return {
  async put(key:string,bytes:Uint8Array,options:{httpMetadata:{contentType:string}}){await database().prepare('INSERT INTO photos(key,data,content_type) VALUES(?,?,?)').bind(key,bytes,options.httpMetadata.contentType).run();},
  async get(key:string){const row=await database().prepare('SELECT data,content_type FROM photos WHERE key=?').bind(key).first<{data:ArrayBuffer;content_type:string}>();return row?{body:new Uint8Array(row.data),httpMetadata:{contentType:row.content_type}}:null;},
  async delete(key:string){await database().prepare('DELETE FROM photos WHERE key=?').bind(key).run();}
};}
