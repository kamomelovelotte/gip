export const runtime='nodejs';
export const maxDuration=60;
import {OFFICIAL_DATA_LEAGUES} from '@/lib/gip/official-sources';
import {getBoxscore} from '@/lib/gip/server/boxscore';
import {SOURCES} from '@/lib/gip/live-baseball';
import {LEAGUES,type League} from '@/lib/gip/types';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,id=q.get('id')??'',league=q.get('league') as League;
 const valid=league==='KBO'?/^naver-\d{8}[A-Z0-9]{4,16}$/.test(id):league==='NPB'?/^yahoo-\d{10,14}$/.test(id):league==='CPBL'?/^cpbl-\d{4}-[ABC]-\d{1,4}$/.test(id):OFFICIAL_DATA_LEAGUES.includes(league)?(league==='DBL'?/^official-dbl-\d+$/:league==='Extraliga'?/^official-cz-\d+$/:/^official-snb-\d{8}-\d+$/).test(id):Boolean(SOURCES[league])&&/^stats-\d{1,9}$/.test(id);
 if(!LEAGUES.includes(league)||!valid)return Response.json({error:'경기 정보를 확인해 주세요.'},{status:400});
 try{return Response.json(await getBoxscore(id,league),{headers:{'Cache-Control':'public, s-maxage=15, stale-while-revalidate=15'}});}catch(error){return Response.json({error:error instanceof Error?error.message:'경기기록을 불러오지 못했어요.'},{status:502});}
}
