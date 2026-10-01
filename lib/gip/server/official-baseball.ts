import {load} from 'cheerio';
import {TEAMS,addDays} from '../catalog';
import {OFFICIAL_SOURCES} from '../official-sources';
import type {Game,GameDetail,League,Standing} from '../types';

const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases:Partial<Record<League,string[]>>={
 DBL:['Bonn Capitals','Cologne Cardinals','Dortmund Wanderers','Hamburg Stealers','Hünstetten Storm','Untouchables Paderborn','Gauting Indians','Guggenberger Legionäre','Heidenheim Heideköpfe','Mainz Athletics','München Haar Disciples','Stuttgart Reds'],
 Extraliga:['Kotlářka Praha','Cardion Hroši Brno','Draci Brno','Eagles Praha','Třebíč Nuclears','Sokol Hluboká','Arrows Ostrava','SaBaT Praha','Technika Brno','Tempo Praha'],
 SNB:['PRI','ART','MAY','IJV','IND','MTZ','CFG','VCL','SSP','CAV','CMG','LTU','HOL','GRA','SCU','GTM']
};
function teamId(league:League,name:string){
 const key=normalize(name),index=aliases[league]?.findIndex(n=>normalize(n)===key);
 if(index===undefined||index<0)throw Error(`${league} 공식 팀 정보가 변경됐어요. 제공처에서 확인해 주세요. (${name})`);
 return `${league.toLowerCase()}-${index}`;
}
// IANA time zones handle both summer and winter time; display dates remain KST.
export function localToKorea(date:string,time:string,zone:string){
 const nominal=Date.parse(`${date}T${time}:00Z`);
 if(!Number.isFinite(nominal))throw Error('공식 경기 시각을 확인하지 못했어요.');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(nominal));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const asUTC=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
 return new Date(nominal-(asUTC-nominal)+9*3600000).toISOString().slice(0,19)+'+09:00';
}
const memory=new Map<string,{until:number;promise:Promise<string>}>();
export async function officialHTML(url:string){
 const hit=memory.get(url);if(hit&&hit.until>Date.now())return hit.promise;
 if(memory.size>100)memory.clear();
 const promise=(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/html'},next:{revalidate:300}});if(!r.ok)throw Error(`공식 데이터 제공처에 연결하지 못했어요. (${r.status})`);const html=await r.text();if(html.length>5000000)throw Error('공식 응답 크기를 확인해 주세요.');return html;})();
 memory.set(url,{until:Date.now()+300000,promise});promise.catch(()=>memory.delete(url));return promise;
}
function number(text:string){const value=Number(text.replace(',','.'));if(!text.trim()||!Number.isFinite(value))throw Error('공식 순위 형식이 변경됐어요.');return value;}
function validateSeason(html:string,season:number){const $=load(html),selected=clean($('select[name="season"] option:selected').text());if(selected!==String(season))throw Error(`${season} 시즌 공식 자료를 확인하지 못했어요.`);}
export function parseDblSchedule(html:string):Game[]{
 const $=load(html),rows=$('tr[data-row-for]').filter((_,row)=>$(row).find('[data-cell-for="date"]').length>0);
 if(!rows.length)throw Error('독일 공식 일정 형식이 변경됐거나 일정이 미공개 상태예요.');
 return rows.toArray().map(row=>{
  const cell=(key:string)=>$(row).find(`[data-cell-for="${key}"]`),value=(key:string)=>clean(cell(key).text());
  const d=value('date').match(/(\d{2})\.(\d{2})\.(\d{4})/);if(!d)throw Error('독일 공식 경기 날짜를 확인하지 못했어요.');
  const time=value('time').match(/\b\d{2}:\d{2}\b/)?.[0],localDate=`${d[3]}-${d[2]}-${d[1]}`,stamp=localToKorea(localDate,time??'12:00','Europe/Berlin');
  const score=value('result'),runs=score.match(/^(\d+)\s*:\s*(\d+)$/),postponed=/ausgefallen|abgesagt|verlegt/i.test(score),sourceId=cell('id').find('a').attr('href')?.match(/bsm_match=(\d+)/)?.[1];
  if(!sourceId)throw Error('독일 공식 경기 번호를 확인하지 못했어요.');
  return {id:`official-dbl-${sourceId}`,league:'DBL',date:stamp.slice(0,10),startsAt:stamp,timeTBD:!time,awayId:teamId('DBL',value('away')),homeId:teamId('DBL',value('home')),awayScore:runs?Number(runs[2]):null,homeScore:runs?Number(runs[1]):null,status:runs?'final':postponed?'postponed':'scheduled',venue:cell('field').find('a').attr('title')?.split(' - ')[0]??'구장 미공개',sourceUrl:`https://www.baseball-softball.de/spielbetrieb/deutsche-baseball-liga/spieldaten/?bsm_match=${sourceId}`};
 });
}
export function parseDblStandings(html:string,season:number,group:string):Standing[]{
 const $=load(html),table=$('table').filter((_,e)=>$(e).find('[data-cell-for="wins"]').length>0).first();
 if(!new RegExp(`\\b${season}\\b`).test(table.find('caption').text())||!table.find('tbody tr').length)throw Error(`${season} 독일 공식 순위를 확인하지 못했어요.`);
 return table.find('tbody tr').toArray().map(row=>{const cell=(key:string)=>clean($(row).find(`[data-cell-for="${key}"]`).text());return {teamId:teamId('DBL',cell('team')),group,played:number(cell('matches')),wins:number(cell('wins')),losses:number(cell('losses')),draws:0,percentage:number(cell('quota')),gamesBehind:/^[-–—]$/.test(cell('gamesbehind'))?0:number(cell('gamesbehind'))};});
}
async function dblLinks(){
 const $=load(await officialHTML(OFFICIAL_SOURCES.DBL.records!));
 const links=$('a[href*="1-baseball-bundesliga/spielplan-ergebnisse/"]').toArray().map(a=>new URL($(a).attr('href')!,'https://www.baseball-softball.de').href);
 const unique=[...new Set(links)];if(!unique.length)throw Error('독일 공식 시즌 목록을 확인하지 못했어요.');return unique;
}
export async function dblSchedule(date:string){
 const links=await dblLinks(),games=(await Promise.all(links.map(async url=>parseDblSchedule(await officialHTML(url))))).flat();
 if(!games.some(g=>g.date.startsWith(date.slice(0,4))))throw Error(`${date.slice(0,4)} 독일 공식 시즌 자료가 아직 연결되지 않았어요.`);
 return [...new Map(games.filter(g=>g.date===date).map(g=>[g.id,g])).values()];
}
export async function dblStandings(season:number){
 const $=load(await officialHTML(OFFICIAL_SOURCES.DBL.records!)),links=$('a').toArray().filter(a=>/^Tabelle (Nord|Süd)$/.test(clean($(a).text()))&&/1-baseball-bundesliga\/tabelle/.test($(a).attr('href')??''));
 const unique=[...new Map(links.map(a=>[$(a).attr('href')!,a])).values()];if(unique.length!==2)throw Error('독일 공식 순위 목록을 확인하지 못했어요.');
 return (await Promise.all(unique.map(async a=>parseDblStandings(await officialHTML(new URL($(a).attr('href')!,'https://www.baseball-softball.de').href),season,/Nord/.test($(a).text())?'북부':'남부')))).flat();
}
async function czechSeason(season:number){
 const $=load(await officialHTML('https://baseball.cz/competition/detail/1'));
 const id=$('select[name="season"] option').toArray().find(e=>clean($(e).text())===String(season));
 if(!id)throw Error(`${season} 체코 공식 시즌이 아직 공개되지 않았어요.`);return $(id).attr('value')!;
}
export function parseCzechSchedule(html:string,season:number):Game[]{
 validateSeason(html,season);const $=load(html);
 if(!$('select[name="month"]').length)throw Error('체코 공식 일정 형식이 변경됐어요.');
 return $('.matchItem').toArray().map(el=>{
  const date=clean($(el).find('.matchItem__date').text()),d=date.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);if(!d)throw Error('체코 공식 경기 날짜를 확인하지 못했어요.');
  const time=date.match(/\b\d{1,2}:\d{2}\b/)?.[0]?.padStart(5,'0'),stamp=localToKorea(`${d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`,time??'12:00','Europe/Prague');
  const link=$(el).find('.matchItem__teams a'),names=clean(link.text()).split('×').map(clean),id=link.attr('href')?.match(/match=(\d+)/)?.[1],score=clean($(el).find('.matchItem__results').text()),runs=score.match(/^(\d+):(\d+)$/);
  if(!id||names.length!==2)throw Error('체코 공식 경기 정보를 확인하지 못했어요.');
  return {id:`official-cz-${id}`,league:'Extraliga',date:stamp.slice(0,10),startsAt:stamp,timeTBD:!time,homeId:teamId('Extraliga',names[0]),awayId:teamId('Extraliga',names[1]),homeScore:runs?Number(runs[1]):null,awayScore:runs?Number(runs[2]):null,status:runs?'final':/odlož|zruš/i.test(score)?'postponed':'scheduled',venue:clean($(el).find('.matchItem__location').text())||'구장 미공개',sourceUrl:new URL(link.attr('href')!,'https://baseball.cz').href};
 });
}
export function parseCzechStandings(html:string,season:number):Standing[]{
 validateSeason(html,season);const $=load(html),table=$('table').filter((_,el)=>/Výhry/.test($(el).find('thead').text())).first();
 if(!table.find('tbody tr').length)throw Error('체코 공식 정규시즌 순위가 아직 제공되지 않았어요.');
 return table.find('tbody tr').toArray().map(row=>{const cells=$(row).find('td').toArray().map(e=>clean($(e).text()));return {teamId:teamId('Extraliga',cells[1]),group:'통합',played:number(cells[2]),wins:number(cells[3]),losses:number(cells[4]),draws:0,percentage:number(cells[6]),gamesBehind:number(cells[7])};});
}
export async function czechSchedule(date:string){const season=Number(date.slice(0,4)),id=await czechSeason(season);return parseCzechSchedule(await officialHTML(`https://baseball.cz/competition/matches/1?season=${id}&month=-1`),season).filter(g=>g.date===date);}
export async function czechStandings(season:number){
 const id=await czechSeason(season),html=await officialHTML(`https://baseball.cz/competition/table/1?season=${id}`),$=load(html);
 const regular=$('select[name="league"] option').toArray().find(e=>clean($(e).text())==='Základní část');
 if(!regular)throw Error('체코 공식 정규시즌 순위가 아직 제공되지 않았어요.');
 return parseCzechStandings(await officialHTML(`https://baseball.cz/competition/table/1?season=${id}&league=${$(regular).attr('value')}`),season);
}
export function parseCubaSchedule(html:string,date:string):Game[]{
 const $=load(html),days=$('[id^="Gameday_"]');
 if(!days.length||!days.toArray().some(e=>($(e).attr('id')??'').includes(date.slice(0,4))))throw Error(`${date.slice(0,4)} 쿠바 공식 일정이 아직 연결되지 않았어요.`);
 const games:Game[]=[];
 for(const localDate of [addDays(date,-1),date]){
  const day=$(`#Gameday_${localDate.replaceAll('-','')}`);
  for(const el of day.find('.partidos-jornada a[href*="idJuego="]').toArray()){
   const result=clean($(el).find('.resultado').text());
   // The current official calendar uses the same "final" class for future games.
   // Never infer a result from that class or treat HH:mm as a score.
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(result))throw Error('쿠바 경기 결과는 공식 사이트에서 확인해 주세요. 예정 일정만 연결되어 있어요.');
   const stamp=localToKorea(localDate,result,'America/Havana');if(stamp.slice(0,10)!==date)continue;
   const id=$(el).attr('href')!.match(/idJuego=(\d+)/)?.[1],away=clean($(el).find('.visible-xs.local').text()),home=clean($(el).find('.visible-xs.visitante').text());
   if(!id)throw Error('쿠바 공식 경기 번호를 확인하지 못했어요.');
   games.push({id:`official-snb-${localDate.replaceAll('-','')}-${id}`,league:'SNB',date,startsAt:stamp,awayId:teamId('SNB',away),homeId:teamId('SNB',home),awayScore:null,homeScore:null,status:'scheduled',statusLabel:'공식 일정 · 결과 미연결',venue:clean($(el).find('.sede').text())||'구장 미공개',sourceUrl:new URL($(el).attr('href')!,'https://www.beisbolcubano.cu').href});
  }
 }
 return games;
}
export async function officialSchedule(league:League,date:string){if(league==='DBL')return dblSchedule(date);if(league==='Extraliga')return czechSchedule(date);if(league==='SNB')return parseCubaSchedule(await officialHTML(OFFICIAL_SOURCES.SNB.records!),date);throw Error('아직 연결하지 않은 공식 데이터예요.');}
export async function officialStandings(league:League,season:number){if(league==='DBL')return dblStandings(season);if(league==='Extraliga')return czechStandings(season);if(league==='SNB')throw Error('쿠바 공식 순위는 아직 연결되지 않았어요. 공식 기록에서 확인해 주세요.');throw Error('아직 연결하지 않은 공식 데이터예요.');}
export async function officialGame(id:string,league:League,date:string):Promise<GameDetail>{
 const game=(await officialSchedule(league,date)).find(g=>g.id===id);if(!game)throw Error('공식 일정에서 해당 경기를 확인하지 못했어요.');
 return {game,homeName:TEAMS.find(t=>t.id===game.homeId)!.name,awayName:TEAMS.find(t=>t.id===game.awayId)!.name,lineups:{home:{batters:[],pitcher:null,announced:false},away:{batters:[],pitcher:null,announced:false}},innings:[],relay:[],relayInning:null,relayAvailable:false,source:OFFICIAL_SOURCES[league].name,sourceUrl:game.sourceUrl!,updatedAt:new Date().toISOString(),warnings:['공식 일정·결과를 제공합니다. 라인업·문자중계·개별 경기기록은 제공처 링크에서 확인해 주세요.']};
}
