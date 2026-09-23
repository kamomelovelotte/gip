import { TEAMS, addDays } from './catalog';
import type { BaseballRepository, Game, League, Standing } from './types';
export const SOURCES: Partial<Record<League, { sport: number; leagues: string; ids: number[] }>> = {
 MLB:{sport:1,leagues:'103,104',ids:[137,119,135,109,115,121,143,144,146,120,158,112,113,138,134,147,111,141,110,139,116,114,118,142,145,136,117,140,108,133]},
 LMB:{sport:23,leagues:'125',ids:[532,5010,442,523,4444,520,434,562,579,6304,560,447,528,5567,569,502,536,575,6303,496]},
 LIDOM:{sport:17,leagues:'131',ids:[672,669,671,667,668,670]},
 LBPRC:{sport:17,leagues:'133',ids:[686,685,4087,687,688,689]},
 LVBP:{sport:17,leagues:'135',ids:[692,697,694,693,695,696,698,699]},
 ABL:{sport:17,leagues:'595',ids:[4064,4065,4068,4069]},
};
export const connected = (league: League) => league === 'KBO' || league === 'NPB' || league === 'CPBL' || Boolean(SOURCES[league]);
export const sourceName = (league: League) => league === 'KBO' ? '네이버 스포츠' : league === 'NPB' ? 'Yahoo! JAPAN 스포나비' : league === 'CPBL' ? 'CPBL 공식 팀별 기록(상·하반기 합산)' : 'MLB Stats API';
export const winter = (league: League) => ['LIDOM','LBPRC','LVBP','ABL'].includes(league);
export const koreaStamp = (date: string) => new Date(new Date(date).getTime()+9*3600000).toISOString().slice(0,19)+'+09:00';
type ApiTeam = { id:number; name:string };
function teamId(league:League, t:ApiTeam, group?:string) {
 const index=SOURCES[league]!.ids.indexOf(t.id);
 const id=index<0?`stats-${league}-${t.id}`:`${league.toLowerCase()}-${index}`;
 let known=TEAMS.find(t=>t.id===id);
 // Historical teams remain visible without replacing saved favourite-team IDs.
 if(!known){known={id,league,name:t.name,short:t.name,group:group??'통합'};TEAMS.push(known);}
 return id;
}
type ApiGame = {gamePk:number;gameDate:string;officialDate:string;venue?:{name:string};status:{abstractGameState:string;detailedState:string;startTimeTBD?:boolean};teams:{away:{team:ApiTeam;score?:number};home:{team:ApiTeam;score?:number}};linescore?:{currentInning?:number;isTopInning?:boolean}};
export function normalizeGame(raw:ApiGame,league:League):Game {
 const detail=raw.status.detailedState, stamp=koreaStamp(raw.gameDate);
 const status:Game['status']=/postpon|cancel|suspend/i.test(detail)?'postponed':raw.status.abstractGameState==='Final'?'final':raw.status.abstractGameState==='Live'?'in_progress':'scheduled';
 return {id:`stats-${raw.gamePk}`,league,date:stamp.slice(0,10),startsAt:stamp,awayId:teamId(league,raw.teams.away.team),homeId:teamId(league,raw.teams.home.team),venue:raw.venue?.name??'구장 미정',status,awayScore:raw.teams.away.score??null,homeScore:raw.teams.home.score??null,timeTBD:raw.status.startTimeTBD,statusLabel:/cancel/i.test(detail)?'경기 취소':/suspend/i.test(detail)?'경기 중단':/postpon/i.test(detail)?'경기 연기':/delay/i.test(detail)?'경기 지연':undefined,inning:raw.linescore?.currentInning?`${raw.linescore.currentInning}회 ${raw.linescore.isTopInning?'초':'말'}`:undefined};
}
async function request<T>(path:string):Promise<T>{
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),15000);
 try {const res=await fetch(`https://statsapi.mlb.com/api/v1/${path}`,{signal:controller.signal});if(!res.ok)throw Error(`HTTP ${res.status}`);return await res.json();}
 finally{clearTimeout(timer);}
}
async function regional<T>(league:'KBO'|'NPB'|'CPBL',kind:'schedule'|'standings',parameter:string):Promise<T>{
 const url=`/api/baseball?league=${league}&kind=${kind}&${kind==='schedule'?'date':'season'}=${encodeURIComponent(parameter)}`;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try {const response=await fetch(url,{signal:controller.signal});const data:unknown=await response.json();if(!response.ok)throw Error((data as {error?:string})?.error??`${league} 데이터를 불러오지 못했어요.`);if(!Array.isArray(data))throw Error('응답 형식을 확인하지 못했어요.');return data as T;}
 finally{clearTimeout(timer);}
}
export type ScheduleResult={games:Game[];failed:League[];updatedAt:string};
export async function getSchedule(date:string):Promise<ScheduleResult>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('날짜를 선택해 주세요.');
 const leagues=['KBO','NPB',...Object.keys(SOURCES)] as League[];
 const results=await Promise.allSettled(leagues.map(async league=>{
  if(league==='KBO'||league==='NPB')return regional<Game[]>(league,'schedule',date);
  const source=SOURCES[league]!;
  const data=await request<{dates:{games:ApiGame[]}[]}>(`schedule?sportId=${source.sport}&leagueId=${source.leagues}&startDate=${addDays(date,-1)}&endDate=${addDays(date,1)}&hydrate=linescore`);
  if(!Array.isArray(data.dates))throw Error('Invalid schedule response');
  return data.dates.flatMap(d=>d.games).map(g=>normalizeGame(g,league)).filter(g=>g.date===date);
 }));
 const failed=leagues.filter((_,i)=>results[i].status==='rejected');
 if(failed.length===leagues.length)throw Error('경기 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
 const games=[...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(g=>[g.id,g])).values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
 return {games,failed,updatedAt:koreaStamp(new Date().toISOString()).slice(11,19)};
}
type ApiRecord={team:ApiTeam;gamesPlayed:number;wins:number;losses:number;leagueRecord?:{ties?:number;pct?:string};winningPercentage?:string;divisionRank?:string;leagueRank?:string;divisionGamesBack?:string;leagueGamesBack?:string};
export const liveBaseballRepository:BaseballRepository={
 async getTeams(){return TEAMS;},
 async getGames(date){const result=await getSchedule(date);return result.games;},
 async getStandings(league,season=new Date().getFullYear()){
  if(league==='KBO'||league==='NPB'||league==='CPBL')return regional<Standing[]>(league,'standings',String(season));
  const source=SOURCES[league];if(!source)throw Error(`${league} 순위는 아직 데이터 연결 전이에요.`);
  const data=await request<{records:{division?:{id:number};teamRecords:ApiRecord[]}[]}>(`standings?leagueId=${source.leagues}&season=${season}&standingsTypes=regularSeason`);
  if(!Array.isArray(data.records))throw Error('순위 응답을 확인하지 못했어요. 다시 시도해 주세요.');
  return data.records.flatMap(block=>{
   const rows=[...block.teamRecords].sort((a,b)=>Number(block.division?a.divisionRank:a.leagueRank)-Number(block.division?b.divisionRank:b.leagueRank));
   return rows.map((r):Standing=>({teamId:teamId(league,r.team),group:league==='MLB'?undefined:block.division?(block.division.id===222?'북부':block.division.id===223?'남부':`지구 ${block.division.id}`):'통합',played:r.gamesPlayed,wins:r.wins,losses:r.losses,draws:r.leagueRecord?.ties??0,percentage:Number(r.winningPercentage??r.leagueRecord?.pct??0),gamesBehind:Number((block.division?r.divisionGamesBack:r.leagueGamesBack)==='-'?0:(block.division?r.divisionGamesBack:r.leagueGamesBack)??0)}));
  });
 }
};
