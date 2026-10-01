import type { Game, Standing } from '@/lib/gip/types';

// Fetch the requested providers on the server so the browser does not depend
// on either provider allowing cross-origin requests.
const kboNames: Record<string, number> = { 롯데:0, 한화:1, LG:2, 두산:3, KT:4, 삼성:5, NC:6, SSG:7, 키움:8, KIA:9 };
const npbNames: Record<string, number> = { ロッテ:0, オリックス:1, ソフトバンク:2, 日本ハム:3, 楽天:4, 西武:5, 阪神:6, 巨人:7, DeNA:8, 広島:9, ヤクルト:10, 中日:11 };
// Club numbers and per-season records are published on the official CPBL site.
const cpblClubs = [
  {id:'cpbl-0',club:'ACN'}, {id:'cpbl-1',club:'ADD'},
  {id:'cpbl-2',club:'AJL'}, {id:'cpbl-3',club:'AAA'},
  {id:'cpbl-4',club:'AEO'}, {id:'cpbl-5',club:'AKP'},
];

export function kboId(name: string) {
  const match = Object.keys(kboNames).find(key => name.trim().toUpperCase().includes(key.toUpperCase()));
  if (match === undefined) throw Error(`알 수 없는 KBO 팀: ${name}`);
  return `kbo-${kboNames[match]}`;
}
export function npbId(name: string) {
  const match = Object.keys(npbNames).find(key => name.trim().includes(key));
  if (match === undefined) throw Error(`알 수 없는 NPB 팀: ${name}`);
  return `npb-${npbNames[match]}`;
}
export function plain(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').trim();
}
export function capture(html: string, pattern: RegExp) { return plain(pattern.exec(html)?.[1] ?? ''); }
function number(value: unknown) { return Number(value ?? 0) || 0; }
export async function fetchSource(url: string, accept: string) {
  const response = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; GIPBaseball/1.0)' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Error(`제공처 응답 ${response.status}`);
  return response;
}

export type NaverGame = { gameId:string; categoryId:string; gameDate?:string; gameDateTime:string; homeTeamName:string; awayTeamName:string; homeTeamScore?:number|null; awayTeamScore?:number|null; statusCode?:string; statusInfo?:string; cancel?:boolean; suspended?:boolean; stadium?:string; currentInning?:string; timeTbd?:boolean; homeStarterName?:string; awayStarterName?:string; homeTeamScoreByInning?:string[]; awayTeamScoreByInning?:string[] };
export async function naverGame(gameId:string):Promise<NaverGame> {
  const data = await (await fetchSource(`https://api-gw.sports.naver.com/schedule/games/${encodeURIComponent(gameId)}`, 'application/json')).json() as {result?:{game?:NaverGame}};
  if (!data.result?.game || data.result.game.gameId !== gameId || data.result.game.categoryId !== 'kbo') throw Error('해당 KBO 경기를 찾지 못했어요.');
  return data.result.game;
}
// Expand provider stadium abbreviations, not the home team's usual venue.
export function kboVenue(value:string|undefined,date:string) {
  const venue=value?.trim();if(!venue)return '구장 정보 확인 중';
  const names:Record<string,string>={
    '부산':'사직야구장','사직':'사직야구장','광주':'광주-기아 챔피언스 필드',
    '잠실':'잠실야구장','고척':'고척스카이돔','인천':'인천 SSG 랜더스필드','문학':'인천 SSG 랜더스필드',
    '수원':'수원 KT 위즈파크','대구':Number(date.slice(0,4))>=2016?'대구 삼성 라이온즈 파크':'대구시민운동장 야구장',
    '창원':Number(date.slice(0,4))>=2019?'창원 NC파크':'마산야구장','마산':'마산야구장',
    '대전':Number(date.slice(0,4))>=2025?'대전 한화생명 볼파크':'한화생명 이글스파크',
    '울산':'울산 문수야구장','포항':'포항야구장','청주':'청주야구장','군산':'군산 월명야구장','목동':'목동야구장',
  };
  return names[venue] ?? venue;
}
export function npbStartAndVenue(html:string) {
  const description=/<p\b[^>]*id=["']async-gameCard["'][^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? '';
  const round=/<li\b[^>]*class=["'][^"']*bb-gameRound--time[^"']*["'][^>]*>([\s\S]*?)<\/li>/i.exec(html)?.[1] ?? '';
  const raw=capture(description || round,/<time\b[^>]*>([\s\S]*?)<\/time>/i);
  const time=/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(raw)?raw.padStart(5,'0'):null;
  const venue=description.includes('</time>')?plain(description.replace(/[\s\S]*?<\/time>/,'')):capture(html,/<li\b[^>]*class=["'][^"']*bb-gameRound--stadium[^"']*["'][^>]*>([\s\S]*?)<\/li>/i);
  return {time,venue};
}
export function normalizeNaverGame(g:NaverGame, date:string):Game {
  const status:Game['status'] = g.cancel || g.suspended || /CANCEL|SUSPENDED/i.test(g.statusCode ?? '') ? 'postponed' : g.statusCode === 'RESULT' ? 'final' : g.statusCode === 'STARTED' ? 'in_progress' : 'scheduled';
  const start = g.gameDateTime?.replace(' ', 'T').slice(0,16) ?? `${date}T00:00`;
  const hasScore = status === 'final' || status === 'in_progress';
  return {id:`naver-${g.gameId}`,league:'KBO',date:g.gameDate ?? date,startsAt:`${start}:00+09:00`,homeId:kboId(g.homeTeamName),awayId:kboId(g.awayTeamName),homeScore:hasScore && g.homeTeamScore != null ? number(g.homeTeamScore) : null,awayScore:hasScore && g.awayTeamScore != null ? number(g.awayTeamScore) : null,venue:kboVenue(g.stadium,g.gameDate ?? date),status,timeTBD:g.timeTbd,statusLabel:status === 'postponed' ? (g.statusInfo || (g.suspended ? '경기 중단' : '경기 취소')) : undefined,inning:g.currentInning || undefined};
}
export async function kboSchedule(date: string): Promise<Game[]> {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&fromDate=${date}&toDate=${date}`;
  const data = await (await fetchSource(url, 'application/json')).json() as { result?: { games?: NaverGame[] } };
  if (!Array.isArray(data.result?.games)) throw Error('네이버 경기 응답 형식이 바뀌었어요.');
  // The list endpoint omits stadium. Read each game's actual venue; a club's
  // usual home ground would be wrong for alternate and neutral-ground games.
  return Promise.all(data.result.games.filter(g => g.categoryId === 'kbo').map(async g => {
    if (g.stadium?.trim()) return normalizeNaverGame(g,date);
    try {const detail=await naverGame(g.gameId);return normalizeNaverGame({...g,stadium:detail.stadium,timeTbd:detail.timeTbd,currentInning:detail.currentInning},date);}
    catch {return normalizeNaverGame(g,date);}
  }));
}

type NaverTeam = { teamName:string; teamShortName?:string; gameCount:number; winGameCount:number; loseGameCount:number; drawnGameCount:number; wra:number|string; gameBehind:number|string };
export async function kboStandings(season: number): Promise<Standing[]> {
  const data = await (await fetchSource(`https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/teams`, 'application/json')).json() as { result?: { seasonTeamStats?: NaverTeam[] } };
  if (!Array.isArray(data.result?.seasonTeamStats)) throw Error('네이버 순위 응답 형식이 바뀌었어요.');
  return data.result.seasonTeamStats.map(t => ({ teamId:kboId(t.teamShortName || t.teamName), group:'통합', played:number(t.gameCount), wins:number(t.winGameCount), losses:number(t.loseGameCount), draws:number(t.drawnGameCount), percentage:number(t.wra), gamesBehind:number(t.gameBehind) }));
}

export async function npbSchedule(date: string): Promise<Game[]> {
  const html = await (await fetchSource(`https://baseball.yahoo.co.jp/npb/schedule/first/all?date=${date}`, 'text/html')).text();
  if (!html.includes('bb-score__content') && !html.includes('試合はありません')) throw Error('스포나비 경기 응답 형식이 바뀌었어요.');
  const anchors = [...html.matchAll(/<a\b[^>]*class="[^"]*bb-score__content[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  const games=anchors.map(([,href,body]): Game => {
    const home = capture(body, /class="[^"]*bb-score__homeLogo[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const away = capture(body, /class="[^"]*bb-score__awayLogo[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const venue = capture(body, /class="[^"]*bb-score__venue[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const statusText = capture(body, /class="[^"]*bb-score__link[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const time = capture(body, /<time\b[^>]*class="[^"]*bb-score__status[^"]*"[^>]*>([\s\S]*?)<\/time>/);
    const homeScore = capture(body, /class="[^"]*bb-score__score--left[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const awayScore = capture(body, /class="[^"]*bb-score__score--right[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const status:Game['status'] = /中止|延期/.test(statusText) ? 'postponed' : /終了|コールド/.test(statusText) ? 'final' : /[0-9]+回|試合中/.test(statusText) || (homeScore !== '' && awayScore !== '') ? 'in_progress' : 'scheduled';
    const matchId = /\/npb\/game\/([^/]+)/.exec(href)?.[1] ?? href;
    return { id:`yahoo-${matchId}`, league:'NPB', date, startsAt:`${date}T${/^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5,'0') : '00:00'}:00+09:00`, homeId:npbId(home), awayId:npbId(away), venue:venue || '구장 미정', status, homeScore:homeScore === '' ? null : number(homeScore), awayScore:awayScore === '' ? null : number(awayScore), timeTBD:!/^\d{1,2}:\d{2}$/.test(time), statusLabel:status === 'postponed' ? '경기 취소' : undefined };
  });
  // Live/final schedule cards replace the start time with the score. The
  // game's top page retains its actual scheduled start in every state.
  return Promise.all(games.map(async game=>{
    if(!game.timeTBD)return game;
    try {
      const detail=await (await fetchSource(`https://baseball.yahoo.co.jp/npb/game/${game.id.slice(6)}/top`,'text/html')).text();
      const {time,venue}=npbStartAndVenue(detail);
      return {...game,...(time?{startsAt:`${date}T${time}:00+09:00`,timeTBD:false}:{}),...(venue?{venue}:{})};
    } catch {return game;}
  }));
}
export async function npbStandings(season: number): Promise<Standing[]> {
  // SportsNavi's standings URL serves only the current season.
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Tokyo', year:'numeric' }).format(new Date()));
  if (season !== currentYear) throw Error('스포나비는 현재 시즌 순위만 제공해요.');
  const html = await (await fetchSource('https://baseball.yahoo.co.jp/npb/standings/', 'text/html')).text();
  const tables = [...html.matchAll(/<table\b[^>]*class="[^"]*bb-rankTable[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].slice(0,2);
  if (tables.length !== 2) throw Error('스포나비 순위 응답 형식이 바뀌었어요.');
  return tables.flatMap(([_,body],index) => {
   const standings=[...body.matchAll(/<tr\b[^>]*class="[^"]*bb-rankTable__row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)].map(([,row]):Standing => {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(([,value]) => plain(value));
    if (cells.length < 8) throw Error('스포나비 순위 표 형식이 바뀌었어요.');
    return { teamId:npbId(cells[1]), group:index === 0 ? '센트럴' : '퍼시픽', played:number(cells[2]), wins:number(cells[3]), losses:number(cells[4]), draws:number(cells[5]), percentage:number(cells[6]), gamesBehind:0 };
   });
   // SportsNavi's 勝差 is relative to the previous rank; GIP shows distance from first place.
   const leader=standings[0];
   return standings.map(row=>({...row,gamesBehind:leader?Math.max(0,(leader.wins-row.wins+row.losses-leader.losses)/2):0}));
  });
}

export async function cpblStandings(season:number):Promise<Standing[]> {
  const records=await Promise.all(cpblClubs.map(async ({id,club})=>{
    const html=await (await fetchSource(`https://cpbl.com.tw/team/teamrecord?ClubNo=${club}`, 'text/html')).text();
    const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([,row])=>[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([,cell])=>plain(cell)));
    const halves=rows.filter(cells=>new RegExp(`^${season}\\s*[（(]\\s*[上下]\\s*[)）]$`).test(cells[0]??'') && cells.length>=6);
    if(!rows.length)throw Error('CPBL 공식 기록 표를 읽지 못했어요.');
    if(!halves.length)return null; // An expansion club may not have existed in an older season.
    const totals=halves.reduce((r,cells)=>({played:r.played+number(cells[1]),wins:r.wins+number(cells[2]),losses:r.losses+number(cells[3]),draws:r.draws+number(cells[4])}),{played:0,wins:0,losses:0,draws:0});
    return {teamId:id,...totals};
  }));
  const ranked=records.filter((r):r is NonNullable<typeof r>=>r!==null).sort((a,b)=>(b.wins/(b.wins+b.losses)||0)-(a.wins/(a.wins+a.losses)||0)||b.wins-a.wins);
  if(!ranked.length)throw Error('CPBL 공식 사이트에서 해당 시즌 기록을 찾지 못했어요.');
  const leader=ranked[0];
  return ranked.map((r):Standing=>({...r,group:'통합',percentage:r.wins/(r.wins+r.losses)||0,gamesBehind:leader?Math.max(0,(leader.wins-r.wins+r.losses-leader.losses)/2):0}));
}
