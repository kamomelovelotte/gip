import {createClient} from '@libsql/client';
if(!process.env.TURSO_DATABASE_URL)throw Error('TURSO_DATABASE_URL 환경 변수를 먼저 설정하세요.');
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try{await db.execute('SELECT 1');console.log('데이터베이스 연결 성공. 첫 계정 요청에서 테이블이 자동 생성됩니다.');}finally{db.close();}
