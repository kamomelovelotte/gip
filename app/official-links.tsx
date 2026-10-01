import {OFFICIAL_SOURCES} from '@/lib/gip/official-sources';
import {connected,sourceName} from '@/lib/gip/live-baseball';
import {leagueLabel} from '@/lib/gip/league-labels';
import type {League} from '@/lib/gip/types';

export function OfficialLinks({leagues,failed=[]}:{leagues:readonly League[];failed?:League[]}){
 return <details className="official-links"><summary>공식 홈페이지 · 데이터 안내</summary><ul>{leagues.map(league=>{
  const source=OFFICIAL_SOURCES[league];
  return <li key={league}><div><strong>{leagueLabel(league)}</strong><a href={source.records??source.url} target="_blank" rel="noopener noreferrer">공식 기록 보기 ↗</a></div><p>{source.name}</p><p>{failed.includes(league)?'현재 조회 실패 · 경기 없음으로 확인된 상태가 아니에요.':connected(league)?`${sourceName(league)} 연결${league==='SNB'?' · 예정 일정만 제공':' · 일정·결과·순위'}`:'자동 조회 미연결'}{source.note&&` · ${source.note}`}</p></li>;
 })}</ul></details>;
}
