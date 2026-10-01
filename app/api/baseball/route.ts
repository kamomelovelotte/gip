export const runtime='nodejs';
export const maxDuration=60;
import { kboSchedule, npbSchedule, kboStandings, npbStandings, cpblStandings } from '@/lib/gip/server/regional';
import { cpblSchedule } from '@/lib/gip/server/cpbl';
import {officialSchedule,officialStandings} from '@/lib/gip/server/official-baseball';
import {OFFICIAL_DATA_LEAGUES} from '@/lib/gip/official-sources';
import type {League} from '@/lib/gip/types';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const league = query.get('league'), kind = query.get('kind'), date = query.get('date'), season = Number(query.get('season'));
  if (!['KBO','NPB','CPBL',...OFFICIAL_DATA_LEAGUES].includes(league ?? '') || !['schedule','standings'].includes(kind ?? '') || (kind === 'schedule' && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) || (kind === 'standings' && !(season >= 2000 && season <= 2100))) return Response.json({error:'요청을 확인해 주세요.'}, {status:400});
  try {
    const result = OFFICIAL_DATA_LEAGUES.includes(league as League)?kind==='schedule'?await officialSchedule(league as League,date!):await officialStandings(league as League,season):kind === 'schedule' ? league === 'KBO' ? await kboSchedule(date!) : league === 'NPB' ? await npbSchedule(date!) : await cpblSchedule(date!) : league === 'KBO' ? await kboStandings(season) : league === 'NPB' ? await npbStandings(season) : await cpblStandings(season);
    return Response.json(result, {headers:{'Cache-Control':`public, s-maxage=${kind === 'schedule' ? 45 : 600}, stale-while-revalidate=120`}});
  } catch (error) {
    console.error(`${league} ${kind} source error`, error);
    return Response.json({error:error instanceof Error ? error.message : '데이터를 불러오지 못했어요.'}, {status:502});
  }
}
