import type {GameBoxscore,BoxscoreTeam,StatPlayer,League} from '../types';
import {fetchSource,plain} from './regional';
import {SOURCES} from '../live-baseball';
const empty=():BoxscoreTeam=>({batters:[],pitchers:[]});
const cell=(value:unknown):string=>typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.trim()!==''?String(value):'—';
const positionNames:Record<string,string>={'投':'투수','捕':'포수','一':'1루수','二':'2루수','三':'3루수','遊':'유격수','左':'좌익수','中':'중견수','右':'우익수','指':'지명타자','打':'대타','走':'대주자','지':'지명타자','포':'포수','좌':'좌익수','중':'중견수','우':'우익수','유':'유격수','P':'투수','C':'포수','1B':'1루수','2B':'2루수','3B':'3루수','SS':'유격수','LF':'좌익수','CF':'중견수','RF':'우익수','DH':'지명타자','PH':'대타','PR':'대주자'};
export function koreanPosition(value:string){return value.replace(/[()（）]/g,'').split(/[\s・/]+/).map(p=>positionNames[p]??p).join(' / ');}
function result(away:BoxscoreTeam,home:BoxscoreTeam,sourceUrl:string):GameBoxscore{return {away,home,sourceUrl,status:[away,home].some(t=>t.batters.length||t.pitchers.length)?'available':'pending',updatedAt:new Date().toISOString()};}
type NaverStat=Record<string,string|number|boolean|undefined>;
export function naverBoxscore(record:{battersBoxscore?:{away?:NaverStat[];home?:NaverStat[]};pitchersBoxscore?:{away?:NaverStat[];home?:NaverStat[]}},url:string){
 const sides=(['away','home'] as const).map(side=>({
  batters:(record.battersBoxscore?.[side]??[]).map((p,i):StatPlayer=>({id:String(p.playerCode??i),name:String(p.name??''),position:koreanPosition(String(p.pos??'')),order:cell(p.batOrder),stats:{ab:cell(p.ab),r:cell(p.run),h:cell(p.hit),rbi:cell(p.rbi),hr:cell(p.hr),bb:cell(p.bb),so:cell(p.kk),sb:cell(p.sb),avg:cell(p.hra)}})),
  pitchers:(record.pitchersBoxscore?.[side]??[]).map((p,i):StatPlayer=>({id:String(p.pcode??i),name:String(p.name??''),position:'투수',stats:{ip:cell(p.inn),pc:cell(p.bf),h:cell(p.hit),hr:cell(p.hr),bb:cell(p.bb),hbp:typeof p.bbhp==='number'&&typeof p.bb==='number'?cell(p.bbhp-p.bb):'—',so:cell(p.kk),r:cell(p.r),er:cell(p.er),era:cell(p.era)}}))
 }));return result(sides[0],sides[1],url);
}
export function npbBoxscore(html:string,url:string):GameBoxscore {
 const teams=[...html.matchAll(/<a\b[^>]*href="\/npb\/teams\/(\d+)\/index"[^>]*class="bb-gameScoreTable__team"[^>]*>/g)].map(m=>m[1]);
 const sides=[empty(),empty()];
 const labels:Record<string,string>={'打数':'ab','得点':'r','安打':'h','打点':'rbi','本塁打':'hr','四球':'bb','三振':'so','盗塁':'sb','打率':'avg','投球回':'ip','投球数':'pc','被安打':'h','被本塁打':'hr','奪三振':'so','与四球':'bb','与死球':'hbp','失点':'r','自責点':'er','防御率':'era'};
 for(const [,classes,body] of html.matchAll(/<table\b[^>]*class="([^"]+)"[^>]*>([\s\S]*?)<\/table>/g)){
  const batting=classes.split(/\s+/).includes('bb-statsTable'),pitching=classes.split(/\s+/).includes('bb-scoreTable');if(!batting&&!pitching)continue;
  const teamId=/--npbTeam(\d+)/.exec(classes)?.[1],side=teams.indexOf(teamId??'');if(side<0||side>1)continue;
  const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(([,row])=>({html:row,cells:[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([,c])=>plain(c).replace(/\s+/g,' ').trim())}));
  const headers=rows[0]?.cells??[],nameIndex=headers.indexOf('選手名');if(nameIndex<0)continue;
  for(const row of rows.slice(1)){const id=/\/npb\/player\/(\d+)/.exec(row.html)?.[1];if(!id)continue;
   const stats:Record<string,string>={};headers.forEach((h,i)=>{if(labels[h])stats[labels[h]]=cell(row.cells[i]);});
   sides[side][batting?'batters':'pitchers'].push({id,name:row.cells[nameIndex],position:batting?koreanPosition(row.cells[0]):'투수',stats});
  }
 }
 if(/bb-statsTable|bb-scoreTable/.test(html)&&!sides.some(s=>s.batters.length||s.pitchers.length))throw Error('경기기록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.');
 return result(sides[0],sides[1],url);
}
type MlbPlayer={person:{id:number;fullName:string};battingOrder?:string;position?:{abbreviation:string};stats?:{batting?:Record<string,unknown>;pitching?:Record<string,unknown>};seasonStats?:{batting?:{avg?:string};pitching?:{era?:string}}};
type MlbTeam={players:Record<string,MlbPlayer>;batters?:number[];pitchers?:number[]};
export function mlbBoxscore(teams:{away:MlbTeam;home:MlbTeam},url:string):GameBoxscore{
 const sides=(['away','home'] as const).map(side=>{const box=teams[side];return {
  batters:(box.batters??[]).map(id=>box.players[`ID${id}`]).filter((p):p is MlbPlayer=>Boolean(p)).map((p):StatPlayer=>{const b=p.stats?.batting??{};return {id:String(p.person.id),name:p.person.fullName,position:koreanPosition(p.position?.abbreviation??''),order:p.battingOrder?String(Math.floor(Number(p.battingOrder)/100)):undefined,stats:{ab:cell(b.atBats),r:cell(b.runs),h:cell(b.hits),rbi:cell(b.rbi),hr:cell(b.homeRuns),bb:cell(b.baseOnBalls),so:cell(b.strikeOuts),sb:cell(b.stolenBases),avg:cell(p.seasonStats?.batting?.avg)}};}),
  pitchers:(box.pitchers??[]).map(id=>box.players[`ID${id}`]).filter((p):p is MlbPlayer=>Boolean(p)).map((p):StatPlayer=>{const b=p.stats?.pitching??{};return {id:String(p.person.id),name:p.person.fullName,position:'투수',stats:{ip:cell(b.inningsPitched),pc:cell(b.numberOfPitches),h:cell(b.hits),hr:cell(b.homeRuns),bb:cell(b.baseOnBalls),hbp:cell(b.hitBatsmen),so:cell(b.strikeOuts),r:cell(b.runs),er:cell(b.earnedRuns),era:cell(p.seasonStats?.pitching?.era)}};})
 };});return result(sides[0],sides[1],url);
}
export async function getBoxscore(id:string,league:League):Promise<GameBoxscore>{
 if(league==='KBO'){const sourceId=id.slice(6),response=await fetchSource(`https://api-gw.sports.naver.com/schedule/games/${sourceId}/record`,'application/json');const data=await response.json() as {result?:{recordData?:Parameters<typeof naverBoxscore>[0]}};if(!data.result?.recordData)throw Error('경기기록을 아직 확인하지 못했어요.');return naverBoxscore(data.result.recordData,`https://m.sports.naver.com/game/${sourceId}/record`);}
 if(league==='NPB'){const url=`https://baseball.yahoo.co.jp/npb/game/${id.slice(6)}/stats`;return npbBoxscore(await(await fetchSource(url,'text/html')).text(),url);}
 if(SOURCES[league]){const sourceId=Number(id.slice(6));const feed=await(await fetchSource(`https://statsapi.mlb.com/api/v1.1/game/${sourceId}/feed/live`,'application/json')).json() as {gamePk:number;gameData:{teams:{home:{league:{id:number}}}};liveData:{boxscore:{teams:{away:MlbTeam;home:MlbTeam}}}};if(feed.gamePk!==sourceId||!SOURCES[league].leagues.split(',').includes(String(feed.gameData.teams.home.league.id)))throw Error('해당 리그의 경기기록이 아니에요.');return mlbBoxscore(feed.liveData.boxscore.teams,`https://www.mlb.com/gameday/${sourceId}`);}
 return {...result(empty(),empty(),''),status:'unsupported'};
}
