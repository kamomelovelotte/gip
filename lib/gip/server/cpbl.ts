import {koreaStamp} from '../live-baseball';
import type {Game,GameDetail,LineupPlayer,StartingLineup} from '../types';

// These are the field names used by the official homepage's game list and
// starting-member tables. Never use the farm-team GameDDetailJson list.
type CpblStarter = {Acnt:string;CHName:string;Lineup:number;CodeName:string;VisitingHomeType:number};
type CpblScoreboard = {InningSeq:number;ScoreCnt:number};
type CpblGame = {GameSno:number;Year:number;KindCode:string;GameStatus:number;PreExeDate:string;FieldAbbe:string;VisitingTeamCode:string;HomeTeamCode:string;VisitingTeamName:string;HomeTeamName:string;VisitingTotalScore?:number|null;HomeTotalScore?:number|null;CurtSeq?:number;CurtVisitingHomeType?:number;VisitingFirstAcnt?:string;HomeFirstAcnt?:string;VisitingFirstMover?:string;HomeFirstMover?:string;FirstSnos?:CpblStarter[];VisitingScoreboards?:CpblScoreboard[];HomeScoreboards?:CpblScoreboard[]};
type CpblResponse = {Success:boolean;GameADetailJson?:string;CurtGameDetailJson?:string};
type CpblSession = {token:string;cookie:string};
const clubs=[{code:'ACN',name:'中信',id:'cpbl-0'},{code:'ADD',name:'統一',id:'cpbl-1'},{code:'AJL',name:'樂天',id:'cpbl-2'},{code:'AAA',name:'味全',id:'cpbl-3'},{code:'AEO',name:'富邦',id:'cpbl-4'},{code:'AKP',name:'台鋼',id:'cpbl-5'}];
function clubId(code:string,name:string) {
  const club=clubs.find(c=>code?.startsWith(c.code)||name?.includes(c.name));
  if(!club)throw Error('CPBL 공식 사이트의 구단 정보를 확인하지 못했어요.');
  return club.id;
}
async function officialSession():Promise<CpblSession> {
  const response=await fetch('https://www.cpbl.com.tw/',{headers:{Accept:'text/html'},signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(response.status===403)throw Error('CPBL 공식 사이트에서 경기 데이터 조회를 차단했어요.');
  if(!response.ok)throw Error(`CPBL 공식 사이트 응답 ${response.status}`);
  const html=await response.text();
  const token=/<input\b[^>]*name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(html)?.[1];
  if(!token)throw Error('CPBL 공식 경기 조회 양식을 확인하지 못했어요.');
  // Submit the same anonymous form token and cookies as the official homepage.
  return {token,cookie:response.headers.getSetCookie().map(cookie=>cookie.split(';')[0]).join('; ')};
}
async function officialPost(session:CpblSession,path:'/home/getdetaillist'|'/home/gamedetail',data:Record<string,string>):Promise<CpblResponse> {
  const response=await fetch(`https://www.cpbl.com.tw${path}`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Referer:'https://www.cpbl.com.tw/',...(session.cookie?{Cookie:session.cookie}:{})},body:new URLSearchParams({...data,__RequestVerificationToken:session.token}),signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(response.status===403)throw Error('CPBL 공식 사이트에서 경기 데이터 조회를 차단했어요.');
  if(!response.ok)throw Error(`CPBL 공식 사이트 응답 ${response.status}`);
  const result=await response.json() as CpblResponse;
  if(!result.Success)throw Error('CPBL 공식 경기 데이터를 불러오지 못했어요.');
  return result;
}
async function dailyGames(date:string,session:CpblSession):Promise<CpblGame[]> {
  const data=await officialPost(session,'/home/getdetaillist',{GameDate:date.replaceAll('-','/'),KindCode:'A',GameSno:''});
  if(typeof data.GameADetailJson!=='string')throw Error('CPBL 공식 일정 응답 형식이 바뀌었어요.');
  const games:unknown=JSON.parse(data.GameADetailJson || '[]');
  if(games===null)return [];
  if(!Array.isArray(games))throw Error('CPBL 공식 일정 응답 형식이 바뀌었어요.');
  return games as CpblGame[];
}
export function normalizeCpblGame(raw:CpblGame):Game {
  if(!raw.PreExeDate || !raw.Year || !raw.GameSno || !/^[ABC]$/.test(raw.KindCode))throw Error('CPBL 공식 경기 정보를 확인하지 못했어요.');
  const timestamp=raw.PreExeDate.replace(' ','T');
  const ms=/^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/.exec(timestamp);
  const startsAt=koreaStamp(ms?new Date(Number(ms[1])).toISOString():/Z|[+-]\d{2}:?\d{2}$/.test(timestamp)?timestamp:`${timestamp}+08:00`);
  const code=Number(raw.GameStatus),status:Game['status']=code===3?'final':code===2||code===8?'in_progress':[5,6,7].includes(code)?'postponed':'scheduled';
  const score=status==='final'||status==='in_progress';
  return {id:`cpbl-${raw.Year}-${raw.KindCode}-${raw.GameSno}`,league:'CPBL',date:startsAt.slice(0,10),startsAt,awayId:clubId(raw.VisitingTeamCode,raw.VisitingTeamName),homeId:clubId(raw.HomeTeamCode,raw.HomeTeamName),venue:raw.FieldAbbe?.trim()||'구장 정보 확인 중',status,awayScore:score&&raw.VisitingTotalScore!=null?Number(raw.VisitingTotalScore):null,homeScore:score&&raw.HomeTotalScore!=null?Number(raw.HomeTotalScore):null,statusLabel:code===5?'경기 취소':code===6?'경기 연기':code===7?'경기 중단':code===8?'경기 일시 중단':undefined,inning:raw.CurtSeq?`${raw.CurtSeq}회 ${Number(raw.CurtVisitingHomeType)===1?'초':'말'}`:undefined};
}
export async function cpblSchedule(date:string):Promise<Game[]> {
  return (await dailyGames(date,await officialSession())).filter(game=>/^[ABC]$/.test(game.KindCode)).map(normalizeCpblGame).filter(game=>game.date===date);
}
function startingLineup(raw:CpblGame,side:'away'|'home'):StartingLineup {
  const players=(raw.FirstSnos ?? []).filter(p=>Number(p.VisitingHomeType)===(side==='away'?1:2));
  const toPlayer=(p:CpblStarter):LineupPlayer=>({id:p.Acnt,name:p.CHName,order:Number(p.Lineup),position:p.CodeName});
  const batters=players.filter(p=>Number(p.Lineup)>0).map(toPlayer).sort((a,b)=>a.order-b.order);
  const first=players.find(p=>Number(p.Lineup)===0),name=side==='away'?raw.VisitingFirstMover:raw.HomeFirstMover;
  const pitcher=first?{...toPlayer(first),position:'선발투수'}:name?{id:(side==='away'?raw.VisitingFirstAcnt:raw.HomeFirstAcnt)??`${side}-starter`,name,position:'선발투수',order:0}:null;
  return {batters,pitcher,announced:batters.length>0};
}
export async function getCpblDetail(id:string,date:string):Promise<GameDetail> {
  const [,year,kindCode,gameSno]=id.split('-');
  const session=await officialSession(),games=await dailyGames(date,session),raw=games.find(g=>String(g.Year)===year && g.KindCode===kindCode && String(g.GameSno)===gameSno);
  if(!raw)throw Error('선택한 날짜의 CPBL 경기를 찾지 못했어요.');
  const warnings:string[]=[];
  try {
    const result=await officialPost(session,'/home/gamedetail',{Year:year,KindCode:kindCode,GameSno:gameSno,GameStatus:String(raw.GameStatus)});
    if(result.CurtGameDetailJson)Object.assign(raw,JSON.parse(result.CurtGameDetailJson));
  } catch {warnings.push('CPBL 공식 사이트의 경기 상세를 확인하지 못했어요.');}
  const awayScores=raw.VisitingScoreboards ?? [],homeScores=raw.HomeScoreboards ?? [];
  return {game:normalizeCpblGame(raw),awayName:raw.VisitingTeamName,homeName:raw.HomeTeamName,lineups:{away:startingLineup(raw,'away'),home:startingLineup(raw,'home')},innings:Array.from({length:Math.max(awayScores.length,homeScores.length)},(_,i)=>({inning:i+1,away:String(awayScores.find(s=>s.InningSeq===i+1)?.ScoreCnt ?? '-'),home:String(homeScores.find(s=>s.InningSeq===i+1)?.ScoreCnt ?? '-')})),relay:[],relayInning:null,relayAvailable:false,source:'CPBL 공식 사이트',sourceUrl:`https://www.cpbl.com.tw/box/index?year=${year}&kindCode=${kindCode}&gameSno=${gameSno}`,updatedAt:new Date().toISOString(),warnings:[...warnings,'CPBL 문자중계는 공식 경기 페이지에서 확인해 주세요.']};
}
