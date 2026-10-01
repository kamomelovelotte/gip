import type { GameDetail, InningScore, League, LineupPlayer, RelayEvent, StartingLineup } from '../types';
import { koreaStamp, normalizeGame, SOURCES } from '../live-baseball';
import { capture, fetchSource, naverGame, normalizeNaverGame, npbId, npbStartAndVenue, plain } from './regional';

const blankLineup = ():StartingLineup => ({batters:[],pitcher:null,announced:false});
const positionNames:Record<string,string> = {'0':'지명타자','1':'투수','2':'포수','3':'1루수','4':'2루수','5':'3루수','6':'유격수','7':'좌익수','8':'중견수','9':'우익수','投':'투수','捕':'포수','一':'1루수','二':'2루수','三':'3루수','遊':'유격수','左':'좌익수','中':'중견수','右':'우익수','指':'지명타자','P':'투수','C':'포수','1B':'1루수','2B':'2루수','3B':'3루수','SS':'유격수','LF':'좌익수','CF':'중견수','RF':'우익수','DH':'지명타자'};
const position = (value:string) => positionNames[value] ?? value;
const updatedAt = () => new Date().toISOString();

type NaverPlayer = {playerCode?:string;pCode?:string;pcode?:string;playerName?:string;name?:string;batorder?:number;batOrder?:number;positionName?:string;posName?:string;position?:string;pos?:number;backnum?:string;hitType?:string;seqno?:number};
type NaverPreview = {homeTeamLineUp?:{fullLineUp?:NaverPlayer[]};awayTeamLineUp?:{fullLineUp?:NaverPlayer[]};homeStarter?:{playerInfo?:NaverPlayer};awayStarter?:{playerInfo?:NaverPlayer}};
type NaverOption = {seqno:number;text:string;type?:number;pitchNum?:number;speed?:string;stuff?:string;currentGameState?:{pitcher?:string;out?:string;ball?:string;strike?:string};batterRecord?:NaverPlayer & {seasonHra?:number;pa?:number;ab?:number;hit?:number;run?:number;rbi?:number;hr?:number;bb?:number;so?:number}};
type NaverRelay = {inn?:number;homeOrAway?:string;inningScore?:{away:Record<string,string>;home:Record<string,string>};homeLineup?:{batter?:NaverPlayer[];pitcher?:NaverPlayer[]};awayLineup?:{batter?:NaverPlayer[];pitcher?:NaverPlayer[]};textRelays?:{no:number;inn:number;homeOrAway:string;textOptions?:NaverOption[]}[]};
function naverPlayer(p:NaverPlayer,order=0):LineupPlayer {
  return {id:String(p.playerCode ?? p.pCode ?? p.pcode ?? p.name),name:p.playerName ?? p.name ?? '',order,position:position(p.positionName ?? p.posName ?? String(p.position ?? p.pos ?? '')),number:p.backnum,hand:p.hitType};
}
function naverLineup(preview:NaverPreview|null,relay:NaverRelay|null,side:'away'|'home',starterName?:string):StartingLineup {
  const full=preview?.[side==='away'?'awayTeamLineUp':'homeTeamLineUp']?.fullLineUp ?? [];
  const batting=full.filter(p=>Number(p.batorder)>0).map(p=>naverPlayer(p,Number(p.batorder)));
  // Relay lineups contain substitutes. Only seqno=1 identifies the original
  // starter; use the preview to keep original defensive positions as well.
  if(!batting.length)batting.push(...(relay?.[side==='away'?'awayLineup':'homeLineup']?.batter ?? []).filter(p=>p.seqno===1 && Number(p.batOrder)>0).map(p=>naverPlayer(p,Number(p.batOrder))));
  const firstPitcher=full.find(p=>p.positionName==='선발투수') ?? preview?.[side==='away'?'awayStarter':'homeStarter']?.playerInfo ?? relay?.[side==='away'?'awayLineup':'homeLineup']?.pitcher?.find(p=>p.seqno===1);
  const pitcher=firstPitcher?{...naverPlayer(firstPitcher),position:'선발투수'}:starterName?{id:`${side}-starter`,name:starterName,order:0,position:'선발투수'}:null;
  const batters=[...new Map(batting.map(p=>[p.order,p])).values()].sort((a,b)=>a.order-b.order);
  return {batters,pitcher,announced:batters.length>0};
}
function validNumber(value:unknown):number|undefined {if(value===undefined||value===null||value==='')return undefined;const n=Number(value);return Number.isFinite(n)?n:undefined;}
export function naverRelayEvents(relay:NaverRelay|null,sourceId:string):RelayEvent[] {
  const pitchers=[...(relay?.awayLineup?.pitcher??[]),...(relay?.homeLineup?.pitcher??[])];
  return (relay?.textRelays??[]).flatMap(block=>{
    const options=(block.textOptions??[]).filter(o=>o.text?.trim()&&!/^[=\s-]+$/.test(o.text));
    const start=options.find(o=>o.type===8),record=start?.batterRecord;
    const heading=start?plain(start.text):undefined;
    const labels=[['pa','타석'],['ab','타수'],['hit','안타'],['run','득점'],['rbi','타점'],['hr','홈런'],['bb','볼넷'],['so','삼진']] as const;
    const batter=record?.name?{name:record.name,order:record.batOrder,average:record.seasonHra===undefined?undefined:Number(record.seasonHra).toFixed(3),stats:labels.flatMap(([key,label])=>record[key]===undefined?[]:[{label,value:record[key]!}])}:undefined;
    return options.filter(o=>o.type!==0).map((o):RelayEvent=>{
      const text=plain(o.text),state=o.currentGameState;
      const pitchNumber=o.pitchNum||Number(/^(\d+)구/.exec(text)?.[1])||undefined;
      const pitcher=pitchers.find(p=>String(p.pcode??p.playerCode??p.pCode)===state?.pitcher)?.name;
      return {id:`${sourceId}-${block.no}-${o.seqno}`,order:block.no*1000+o.seqno,atBatId:`${sourceId}-${block.no}`,heading,batter,pitcher,outs:validNumber(state?.out),pitchNumber,
        kind:pitchNumber?'pitch':o.type===8?'heading':/교체/.test(text)?'substitution':'result',
        pitch:pitchNumber?{result:text.replace(/^\d+구\s*/,''),type:o.stuff||undefined,speedKph:validNumber(o.speed)||undefined,balls:validNumber(state?.ball),strikes:validNumber(state?.strike)}:undefined,
        inning:block.inn,half:block.homeOrAway==='0'?'top':'bottom',text};
    });
  }).sort((a,b)=>b.order-a.order);
}
export async function getKboDetail(id:string,inning:number):Promise<GameDetail> {
  const sourceId=id.slice(6),base=`https://api-gw.sports.naver.com/schedule/games/${sourceId}`;
  const [gameResult,previewResult,relayResult]=await Promise.allSettled([
    naverGame(sourceId),
    fetchSource(`${base}/preview`,'application/json').then(r=>r.json() as Promise<{result?:{previewData?:NaverPreview|null}}>),
    fetchSource(`${base}/relay${inning?`?inning=${inning}`:''}`,'application/json').then(r=>r.json() as Promise<{result?:{textRelayData?:NaverRelay|null}}>),
  ]);
  if(gameResult.status==='rejected')throw gameResult.reason;
  const raw=gameResult.value,game=normalizeNaverGame(raw,sourceId.slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'));
  const preview=previewResult.status==='fulfilled'?previewResult.value.result?.previewData ?? null:null;
  const relay=relayResult.status==='fulfilled'?relayResult.value.result?.textRelayData ?? null:null;
  const innings:InningScore[]=[];
  const scoreCount=Math.max(raw.awayTeamScoreByInning?.length ?? 0,raw.homeTeamScoreByInning?.length ?? 0,...Object.keys(relay?.inningScore?.away ?? {}).map(Number));
  for(let i=1;i<=scoreCount;i++)innings.push({inning:i,away:relay?.inningScore?.away?.[i] ?? raw.awayTeamScoreByInning?.[i-1] ?? '-',home:relay?.inningScore?.home?.[i] ?? raw.homeTeamScoreByInning?.[i-1] ?? '-'});
  const events=naverRelayEvents(relay,sourceId);
  const warnings:string[]=[];
  if(previewResult.status==='rejected')warnings.push('선발 라인업을 확인하지 못했어요. 다시 새로고침해 주세요.');
  if(relayResult.status==='rejected')warnings.push('문자중계를 불러오지 못했어요. 다시 새로고침해 주세요.');
  return {game,awayName:raw.awayTeamName,homeName:raw.homeTeamName,lineups:{away:naverLineup(preview,relay,'away',raw.awayStarterName),home:naverLineup(preview,relay,'home',raw.homeStarterName)},innings,relay:events,relayInning:inning || relay?.inn || null,relayAvailable:relay!==null,source:'네이버 스포츠',sourceUrl:`https://m.sports.naver.com/game/${sourceId}/relay`,updatedAt:updatedAt(),warnings};
}

function htmlTables(html:string) {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(([,body])=>[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([,row])=>({html:row,cells:[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([,cell])=>plain(cell).replace(/\s+/g,' ').trim())})));
}
function npbLineups(html:string) {
  const index=html.indexOf('id="async-starting"');
  const block=index<0?'':html.slice(index).split('id="async-bench"')[0];
  const sides:Record<'away'|'home',StartingLineup>={away:blankLineup(),home:blankLineup()};
  // SportsNavi publishes home then away inside the starting-member section.
  const sections=[...block.matchAll(/<section\b[^>]*class="bb-splits__item"[^>]*>([\s\S]*?)<\/section>/g)].slice(0,2);
  sections.forEach(([,section],index)=>{
    const lineup=sides[index===0?'home':'away'];
    for(const rows of htmlTables(section))for(const row of rows) {
      const [order,pos,name,hand]=row.cells;
      if(!name||(!/^\d+$/.test(order ?? '')&&order!=='先発'))continue;
      const player:LineupPlayer={id:/\/npb\/player\/(\d+)/.exec(row.html)?.[1] ?? name,name,order:Number(order)||0,position:position(pos),hand};
      if(order==='先発')lineup.pitcher={...player,position:'선발투수'};else lineup.batters.push(player);
    }
    lineup.announced=lineup.batters.length>0;
  });
  // Before batting lineups are announced only the probable pitchers appear.
  if(!sections.length) {
    const starterIndex=html.indexOf('id="async-starter"');
    const starterBlock=starterIndex<0?'':html.slice(starterIndex).split('id="async-preview"')[0];
    const tables=[...starterBlock.matchAll(/<table\b[^>]*class="bb-splitsPitcherTable"[^>]*>([\s\S]*?)<\/table>/g)];
    tables.slice(0,2).forEach(([,table],i)=>{
      const row=htmlTables(`<table>${table}</table>`)[0]?.find(row=>/\/npb\/player\//.test(row.html));
      if(!row)return;
      const [number,hand,name]=row.cells;
      sides[i===0?'home':'away'].pitcher={id:/\/npb\/player\/(\d+)/.exec(row.html)?.[1] ?? name,name,order:0,position:'선발투수',number,hand};
    });
  }
  return sides;
}
export function npbRelay(html:string,sourceId:string):RelayEvent[] {
  const sections=[...html.matchAll(/<section\b[^>]*class="bb-liveText"[^>]*>([\s\S]*?)<\/section>/g)];
  const events:RelayEvent[]=[];
  for(const [,section] of sections) {
    const label=capture(section,/class="bb-liveText__inning"[^>]*>([\s\S]*?)<\/h1>/);
    const match=/(\d+)回(表|裏)/.exec(label),inning=Number(match?.[1]??0),half=match?.[2]==='表'?'top':match?.[2]==='裏'?'bottom':null;
    for(const [,item] of section.matchAll(/<li\b[^>]*class="bb-liveText__item"[^>]*>([\s\S]*?)<\/li>/g)) {
      const headerHtml=/<p\b[^>]*class="bb-liveText__batter"[^>]*>([\s\S]*?)<\/p>/.exec(item)?.[1]??'';
      const name=capture(headerHtml,/class="bb-liveText__player"[^>]*>([\s\S]*?)<\/a>/);
      const order=Number(capture(headerHtml,/class="bb-liveText__order"[^>]*>([\s\S]*?)<\/span>/).match(/\d+/)?.[0])||undefined;
      const number=Number(capture(item,/class="bb-liveText__number"[^>]*>([\s\S]*?)<\/p>/).match(/\d+/)?.[0])||0;
      const sourceIndex=inning&&number?`${String(inning).padStart(2,'0')}${half==='top'?'1':'2'}${String(number).padStart(2,'0')}00`:undefined;
      const atBatId=`${sourceId}-${sourceIndex??`info-${events.length}`}`;
      const base=inning*100000+(half==='bottom'?50000:0)+number*100;
      let seq=0;
      for(const [,classes,paragraph] of item.matchAll(/<p\b[^>]*class="(bb-liveText__summary[^"]*)"[^>]*>([\s\S]*?)<\/p>/g)) {
        const text=plain(paragraph).replace(/\s+/g,' ').trim();if(!text)continue;
        events.push({id:`${atBatId}-${seq}`,order:base+80+seq++,inning,half,text,atBatId,sourceIndex,batter:name?{name,order}:undefined,heading:plain(headerHtml),kind:classes.includes('--change')?'substitution':'result'});
      }
    }
  }
  return events.sort((a,b)=>b.order-a.order);
}
export function npbPitchDetail(html:string,appearance:RelayEvent):RelayEvent[] {
  const batterBlock=html.split('id="batter"')[1]?.split('id="liveFooter"')[0]??'';
  const name=capture(batterBlock,/class="nm"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/);
  // Never attach another appearance's data when SportsNavi redirects an index.
  if(!name||name.replace(/\s/g,'')!==appearance.batter?.name.replace(/\s/g,''))return [];
  const pitcherBlock=html.split('id="pit"')[1]?.split('id="batter"')[0]??'';
  const pitcher=capture(pitcherBlock,/class="nm"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)||undefined;
  const rate=capture(batterBlock,/class="rate"[^>]*>([\s\S]*?)<\/td>/).match(/\.\d{3}/)?.[0];
  const outsHtml=/<p class="o">[\s\S]*?<b>([\s\S]*?)<\/b>/.exec(html)?.[1];
  const outs=outsHtml===undefined?undefined:(outsHtml.match(/●/g)??[]).length;
  const table=htmlTables(html).find(rows=>rows.some(row=>row.cells.includes('球種')&&row.cells.includes('球速')));
  let balls=0,strikes=0,known=true;
  const pitches:RelayEvent[]=[];
  for(const row of table??[]) {
    if(!row.html.includes('bb-icon__ballCircle'))continue;
    const [number,,type,speed,result]=row.cells,pitchNumber=Number(number);if(!pitchNumber)continue;
    if(pitchNumber!==pitches.length+1)known=false;
    if(/四球|ボール/.test(result))balls++;
    else if(/ファウル|ファール/.test(result))strikes=Math.min(2,strikes+1);
    else if(/見逃|空振|空三振|見三振|バント空振/.test(result))strikes++;
    else if(!/安|ゴロ|飛|ライナー|本|失|犠|死球|併殺|野選/.test(result))known=false;
    pitches.push({...appearance,id:`${appearance.atBatId}-pitch-${pitchNumber}`,order:Math.floor(appearance.order/100)*100+pitchNumber,kind:'pitch',text:result,pitchNumber,pitcher,outs,batter:{...appearance.batter!,average:rate?`0${rate}`:undefined},pitch:{result,type,speedKph:Number(speed.match(/\d+(?:\.\d+)?/)?.[0])||undefined,balls:known?balls:undefined,strikes:known?strikes:undefined}});
  }
  return pitches;
}
export async function getNpbDetail(id:string,requestedDate:string,requestedInning=0):Promise<GameDetail> {
  const sourceId=id.slice(6),base=`https://baseball.yahoo.co.jp/npb/game/${sourceId}`;
  const html=await (await fetchSource(`${base}/top`,'text/html')).text();
  const titleDate=/<title>\s*(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(html);
  if(!titleDate)throw Error('스포나비의 경기 정보를 확인하지 못했어요.');
  const date=`${titleDate[1]}-${titleDate[2].padStart(2,'0')}-${titleDate[3].padStart(2,'0')}`;
  if(requestedDate && date!==requestedDate)throw Error('선택한 날짜와 경기 날짜가 달라요.');
  const names=[...html.matchAll(/class=["'][^"']*\bbb-gameTeam__name\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/g)].map(([,name])=>plain(name));
  // The document title is an independent source of the matchup if markup changes.
  if(names.length<2){const matchup=/<title>\s*\d{4}年\d{1,2}月\d{1,2}日\s+(.+?)vs[.．]\s*(.+?)\s+(?:一球速報|テキスト速報|試合|出場成績|トップ)/.exec(html);if(matchup)names.splice(0,names.length,plain(matchup[1]),plain(matchup[2]));}
  if(names.length<2)throw Error('스포나비의 경기 응답 형식이 바뀌었어요.');
  const state=capture(html,/class="bb-gameCard__state"[^>]*>([\s\S]*?)<\/p>/);
  const status=/中止|延期/.test(state)?'postponed':/終了|コールド/.test(state)?'final':/\d+回|試合中/.test(state)?'in_progress':'scheduled';
  const {time:start,venue:sourceVenue}=npbStartAndVenue(html);
  const venue=sourceVenue || '구장 정보 확인 중';
  const inningMatch=/(\d+)回(表|裏)/.exec(state);
  const game:GameDetail['game']={id,league:'NPB',date,startsAt:`${date}T${start ?? '00:00'}:00+09:00`,timeTBD:!start,homeId:npbId(names[0]),awayId:npbId(names[1]),venue,status,homeScore:status==='final'||status==='in_progress'?Number(capture(html,/class="bb-gameTeam__homeScore"[^>]*>([\s\S]*?)<\/span>/)):null,awayScore:status==='final'||status==='in_progress'?Number(capture(html,/class="bb-gameTeam__awayScore"[^>]*>([\s\S]*?)<\/span>/)):null,statusLabel:status==='postponed'?'경기 취소':undefined,inning:inningMatch?`${inningMatch[1]}회 ${inningMatch[2]==='表'?'초':'말'}`:undefined};
  const scoreboard=/<table\b[^>]*id="ing_brd"[^>]*>([\s\S]*?)<\/table>/.exec(html)?.[1] ?? '';
  const scoreRows=htmlTables(`<table>${scoreboard}</table>`)[0]?.filter(row=>/bb-gameScoreTable__data--team/.test(row.html)) ?? [];
  const innings:InningScore[]=scoreRows.length===2?scoreRows[0].cells.slice(1,-3).map((away,i)=>({inning:i+1,away,home:scoreRows[1].cells[i+1] ?? '-'})):[];
  let relay:RelayEvent[]=[],warnings:string[]=[];
  const hasText=html.includes(`href="/npb/game/${sourceId}/text"`);
  if(hasText) {
    try {relay=npbRelay(await (await fetchSource(`${base}/text`,'text/html')).text(),sourceId);}
    catch {warnings=['문자중계를 불러오지 못했어요. 다시 새로고침해 주세요.'];}
  }
  const relayInning=requestedInning||Math.max(0,...relay.map(e=>e.inning));
  const selected=relay.filter(e=>e.inning===relayInning);
  const appearances=[...new Map(selected.filter(e=>e.sourceIndex&&e.batter).map(e=>[e.atBatId,e])).values()];
  const details=await Promise.allSettled(appearances.map(async event=>npbPitchDetail(await(await fetchSource(`${base}/score?index=${event.sourceIndex}`,'text/html')).text(),event)));
  let unavailable=false;
  details.forEach((result,i)=>{
    if(result.status==='fulfilled'&&result.value.length){
      const pitches=result.value,meta=pitches[0];
      relay=relay.map(e=>e.atBatId===appearances[i].atBatId?{...e,batter:meta.batter,pitcher:meta.pitcher,outs:meta.outs}:e);
      relay.push(...pitches);
    }else unavailable=true;
  });
  if(unavailable)warnings.push('일부 타석의 투구 상세를 확인하지 못해 타석 결과만 표시합니다.');
  relay.sort((a,b)=>b.order-a.order);
  return {game,awayName:names[1],homeName:names[0],lineups:npbLineups(html),innings,relay:relay.filter(e=>e.inning===relayInning),relayInning:relayInning||null,relayAvailable:relay.length>0,source:'Yahoo! JAPAN 스포나비',sourceUrl:`${base}/${hasText?'text':'top'}`,updatedAt:updatedAt(),warnings};
}

type StatsPlayer = {person:{id:number;fullName:string};battingOrder?:string;position?:{abbreviation:string};allPositions?:{abbreviation:string}[];jerseyNumber?:string};
type StatsBox = {players:Record<string,StatsPlayer>;pitchers?:number[]};
type StatsPlay = {matchup?:{batter?:{fullName:string};pitcher?:{fullName:string}};count?:{outs?:number};about:{atBatIndex:number;inning:number;isTopInning:boolean;isComplete:boolean;endTime?:string};result:{description?:string};playEvents?:{index:number;pitchNumber?:number;isPitch?:boolean;count?:{balls?:number;strikes?:number;outs?:number};pitchData?:{startSpeed?:number};details:{description?:string;type?:{description?:string}};endTime?:string}[]};
type StatsFeed = {gamePk:number;gameData:{datetime:{dateTime:string};status:{abstractGameState:string;detailedState:string;startTimeTBD?:boolean};teams:{away:{id:number;name:string;league:{id:number}};home:{id:number;name:string;league:{id:number}}};venue?:{name:string};probablePitchers?:{away?:{id:number;fullName:string};home?:{id:number;fullName:string}}};liveData:{boxscore:{teams:{away:StatsBox;home:StatsBox}};linescore:{currentInning?:number;isTopInning?:boolean;teams:{away:{runs?:number};home:{runs?:number}};innings?:{num:number;away:{runs?:number};home:{runs?:number}}[]};plays:{allPlays?:StatsPlay[]}}};
function statsLineup(box:StatsBox,probable?:{id:number;fullName:string}):StartingLineup {
  const batters=Object.values(box.players ?? {}).filter(p=>p.battingOrder && Number(p.battingOrder)%100===0).map((p):LineupPlayer=>({id:String(p.person.id),name:p.person.fullName,order:Number(p.battingOrder)/100,position:position(p.allPositions?.[0]?.abbreviation ?? p.position?.abbreviation ?? ''),number:p.jerseyNumber})).sort((a,b)=>a.order-b.order);
  const first=box.pitchers?.[0],pitcherPlayer=first?box.players?.[`ID${first}`]:null;
  const pitcher=pitcherPlayer?{id:String(first),name:pitcherPlayer.person.fullName,order:0,position:'선발투수',number:pitcherPlayer.jerseyNumber}:probable?{id:String(probable.id),name:probable.fullName,order:0,position:'선발투수'}:null;
  return {batters,pitcher,announced:batters.length>0};
}
export async function getStatsDetail(id:string,league:League):Promise<GameDetail> {
  const sourceId=Number(id.slice(6));
  const data=await (await fetchSource(`https://statsapi.mlb.com/api/v1.1/game/${sourceId}/feed/live`,'application/json')).json() as StatsFeed;
  if(data.gamePk!==sourceId || !data.gameData?.teams || !data.liveData)throw Error('해당 경기를 확인하지 못했어요.');
  if(!SOURCES[league]?.leagues.split(',').includes(String(data.gameData.teams.home.league.id)))throw Error('선택한 리그의 경기가 아니에요.');
  const {gameData,liveData}=data,lines=liveData.linescore;
  const game=normalizeGame({gamePk:data.gamePk,gameDate:gameData.datetime.dateTime,officialDate:koreaStamp(gameData.datetime.dateTime).slice(0,10),venue:gameData.venue,status:gameData.status,teams:{away:{team:gameData.teams.away,score:lines?.teams?.away?.runs},home:{team:gameData.teams.home,score:lines?.teams?.home?.runs}},linescore:lines},league);
  const relay:RelayEvent[]=[];
  for(const play of liveData.plays?.allPlays ?? []) {
    const {about}=play;
    for(const event of play.playEvents ?? [])if(event.details.description)relay.push({id:`${sourceId}-${about.atBatIndex}-${event.index}`,order:about.atBatIndex*1000+event.index,atBatId:`${sourceId}-${about.atBatIndex}`,heading:play.matchup?.batter?.fullName,batter:play.matchup?.batter?{name:play.matchup.batter.fullName}:undefined,pitcher:play.matchup?.pitcher?.fullName,outs:event.count?.outs,pitchNumber:event.isPitch?event.pitchNumber:undefined,kind:event.isPitch?'pitch':/substitution|switch/i.test(event.details.description)?'substitution':'info',pitch:event.isPitch?{result:event.details.description,type:event.details.type?.description,speedKph:event.pitchData?.startSpeed?Math.round(event.pitchData.startSpeed*1.609344):undefined,balls:event.count?.balls,strikes:event.count?.strikes}:undefined,inning:about.inning,half:about.isTopInning?'top':'bottom',text:event.details.description,time:event.endTime});
    if(about.isComplete && play.result.description)relay.push({id:`${sourceId}-${about.atBatIndex}-result`,order:about.atBatIndex*1000+999,atBatId:`${sourceId}-${about.atBatIndex}`,heading:play.matchup?.batter?.fullName,batter:play.matchup?.batter?{name:play.matchup.batter.fullName}:undefined,pitcher:play.matchup?.pitcher?.fullName,outs:play.count?.outs,kind:'result',inning:about.inning,half:about.isTopInning?'top':'bottom',text:play.result.description,time:about.endTime});
  }
  return {game,awayName:gameData.teams.away.name,homeName:gameData.teams.home.name,lineups:{away:statsLineup(liveData.boxscore.teams.away,gameData.probablePitchers?.away),home:statsLineup(liveData.boxscore.teams.home,gameData.probablePitchers?.home)},innings:(lines?.innings ?? []).map(i=>({inning:i.num,away:String(i.away.runs ?? '-'),home:String(i.home.runs ?? '-')})),relay:relay.sort((a,b)=>b.order-a.order),relayInning:null,relayAvailable:relay.length>0,source:'MLB Stats API',sourceUrl:`https://www.mlb.com/gameday/${sourceId}`,updatedAt:updatedAt(),warnings:[]};
}
