import type { BaseballRepository, Game, League } from './types';
import { TEAMS, koreaToday } from './catalog';
const fixtures: [League,number,number,string,string,number,number][] = [['KBO',0,1,'사직야구장','14:00',5,3],['KBO',2,3,'잠실야구장','14:00',2,4],['KBO',4,5,'대구 삼성라이온즈파크','17:00',1,3],['KBO',6,7,'인천 SSG랜더스필드','17:00',6,2],['KBO',8,9,'광주 기아챔피언스필드','17:00',4,5],['NPB',0,1,'ZOZO 마린 스타디움','18:00',4,2],['NPB',2,3,'미즈호 PayPay 돔','18:00',3,1],['NPB',4,5,'라쿠텐 모바일 파크','18:00',1,2],['NPB',6,7,'한신 고시엔 구장','18:00',5,2],['NPB',8,9,'요코하마 스타디움','18:00',3,2],['NPB',10,11,'메이지 진구 야구장','18:00',2,1],['MLB',0,1,'Oracle Park','10:10',4,2],['MLB',15,16,'Yankee Stadium','08:05',6,3],['MLB',2,3,'Petco Park','10:40',2,1],['CPBL',0,1,'타이중 인터컨티넨탈 야구장','18:05',3,2],['CPBL',2,3,'타오위안 국제야구장','18:05',4,1],['CPBL',4,5,'신좡 야구장','18:05',1,2]];
export const mockBaseballRepository: BaseballRepository = {
 async getTeams(){ return TEAMS; },
 async getGames(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('날짜를 확인해 주세요.');
  const today=koreaToday();
  if(Math.abs(Date.parse(date)-Date.parse(today))>31*86400000)return [];
  return fixtures.map(([league,a,h,venue,time,awayScore,homeScore],i):Game=>{
   const final=date<today || (date===today && (league==='MLB'||(league==='KBO'&&i<2)));
   return {id:`mock-${date}-${league}-${a}-${h}`,league,date,startsAt:`${date}T${time}:00+09:00`,awayId:`${league.toLowerCase()}-${a}`,homeId:`${league.toLowerCase()}-${h}`,venue,status:final?'final':'scheduled',awayScore:final?awayScore:null,homeScore:final?homeScore:null};
  });
 },
 async getStandings(league){
  // Team membership alone is not a source of game or standings data.
  if(!['KBO','NPB','MLB','CPBL'].includes(league))return [];
  const list=TEAMS.filter(t=>t.league===league);const order=league==='KBO'?[1,2,0,7,4,5,6,9,3,8]:list.map((_,i)=>i);
  return order.map((index,rank)=>{ const t=list[index];const position=league==='KBO'?rank:list.filter(a=>a.group===t.group).indexOf(t);const wins=85-position*3;const draws=league==='MLB'?0:4;const played=138;const losses=played-wins-draws;return {teamId:t.id,played,wins,losses,draws,percentage:wins/(wins+losses),gamesBehind:position*3}; });
 }
};
