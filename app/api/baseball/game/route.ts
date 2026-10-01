export const runtime='nodejs';
export const maxDuration=60;
import {OFFICIAL_DATA_LEAGUES} from '@/lib/gip/official-sources';
import { getKboDetail, getNpbDetail, getStatsDetail } from '@/lib/gip/server/game-detail';
import {officialGame} from '@/lib/gip/server/official-baseball';
import { getCpblDetail } from '@/lib/gip/server/cpbl';
import { SOURCES } from '@/lib/gip/live-baseball';
import { LEAGUES, type League } from '@/lib/gip/types';

export async function GET(request:Request) {
  const query=new URL(request.url).searchParams;
  const id=query.get('id') ?? '',league=query.get('league') as League,date=query.get('date') ?? '',inning=Number(query.get('inning') ?? 0);
  const validId=league==='KBO'?/^naver-\d{8}[A-Z0-9]{4,16}$/.test(id):league==='NPB'?/^yahoo-\d{10,14}$/.test(id):league==='CPBL'?/^cpbl-\d{4}-[ABC]-\d{1,4}$/.test(id)&&/^\d{4}-\d{2}-\d{2}$/.test(date):OFFICIAL_DATA_LEAGUES.includes(league)?(league==='DBL'?/^official-dbl-\d+$/:league==='Extraliga'?/^official-cz-\d+$/:/^official-snb-\d{8}-\d+$/).test(id):Boolean(SOURCES[league])&&/^stats-\d{1,9}$/.test(id);
  if(!LEAGUES.includes(league)||!validId||(OFFICIAL_DATA_LEAGUES.includes(league)&&!/^\d{4}-\d{2}-\d{2}$/.test(date))||!Number.isInteger(inning)||inning<0||inning>50||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))return Response.json({error:'경기 정보를 확인해 주세요.'},{status:400});
  try {
    const detail=OFFICIAL_DATA_LEAGUES.includes(league)?await officialGame(id,league,date):league==='KBO'?await getKboDetail(id,inning):league==='NPB'?await getNpbDetail(id,date,inning):league==='CPBL'?await getCpblDetail(id,date):await getStatsDetail(id,league);
    return Response.json(detail,{headers:{'Cache-Control':`public, s-maxage=${detail.game.status==='final'?300:10}, stale-while-revalidate=15`}});
  } catch(error) {
    console.error('Game detail source error',error);
    return Response.json({error:error instanceof Error?error.message:'경기 정보를 불러오지 못했어요.'},{status:502});
  }
}
