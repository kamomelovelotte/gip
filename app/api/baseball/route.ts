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

function kboId(name: string) {
  const match = Object.keys(kboNames).find(key => name.trim().toUpperCase().includes(key.toUpperCase()));
  if (match === undefined) throw Error(`알 수 없는 KBO 팀: ${name}`);
  return `kbo-${kboNames[match]}`;
}
function npbId(name: string) {
  const match = Object.keys(npbNames).find(key => name.trim().includes(key));
  if (match === undefined) throw Error(`알 수 없는 NPB 팀: ${name}`);
  return `npb-${npbNames[match]}`;
}
function plain(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').trim();
}
function capture(html: string, pattern: RegExp) { return plain(pattern.exec(html)?.[1] ?? ''); }
function number(value: unknown) { return Number(value ?? 0) || 0; }
async function fetchSource(url: string, accept: string) {
  const response = await fetch(url, { headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; GIPBaseball/1.0)' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Error(`제공처 응답 ${response.status}`);
  return response;
}

type NaverGame = { gameId:string; categoryId:string; gameDateTime:string; homeTeamName:string; awayTeamName:string; homeTeamScore?:number|null; awayTeamScore?:number|null; statusCode?:string; statusInfo?:string; cancel?:boolean; suspended?:boolean; stadium?:string; currentInning?:string };
async function kboSchedule(date: string): Promise<Game[]> {
  const url = `https://api-gw.sports.naver.com/schedule/games?upperCategoryId=kbaseball&fromDate=${date}&toDate=${date}`;
  const data = await (await fetchSource(url, 'application/json')).json() as { result?: { games?: NaverGame[] } };
  if (!Array.isArray(data.result?.games)) throw Error('네이버 경기 응답 형식이 바뀌었어요.');
  return data.result.games.filter(g => g.categoryId === 'kbo').map(g => {
    const status: Game['status'] = g.cancel || g.suspended || /CANCEL|SUSPENDED/i.test(g.statusCode ?? '') ? 'postponed' : g.statusCode === 'RESULT' ? 'final' : g.statusCode === 'STARTED' ? 'in_progress' : 'scheduled';
    const start = g.gameDateTime?.replace(' ', 'T').slice(0,16) ?? `${date}T00:00`;
    return { id:`naver-${g.gameId}`, league:'KBO', date, startsAt:`${start}:00+09:00`, homeId:kboId(g.homeTeamName), awayId:kboId(g.awayTeamName), homeScore:g.homeTeamScore == null ? null : number(g.homeTeamScore), awayScore:g.awayTeamScore == null ? null : number(g.awayTeamScore), venue:g.stadium || '구장 미정', status, statusLabel:status === 'postponed' ? (g.statusInfo || '경기 취소') : undefined, inning:g.currentInning || undefined };
  });
}

type NaverTeam = { teamName:string; teamShortName?:string; gameCount:number; winGameCount:number; loseGameCount:number; drawnGameCount:number; wra:number|string; gameBehind:number|string };
async function kboStandings(season: number): Promise<Standing[]> {
  const data = await (await fetchSource(`https://api-gw.sports.naver.com/statistics/categories/kbo/seasons/${season}/teams`, 'application/json')).json() as { result?: { seasonTeamStats?: NaverTeam[] } };
  if (!Array.isArray(data.result?.seasonTeamStats)) throw Error('네이버 순위 응답 형식이 바뀌었어요.');
  return data.result.seasonTeamStats.map(t => ({ teamId:kboId(t.teamShortName || t.teamName), group:'통합', played:number(t.gameCount), wins:number(t.winGameCount), losses:number(t.loseGameCount), draws:number(t.drawnGameCount), percentage:number(t.wra), gamesBehind:number(t.gameBehind) }));
}

async function npbSchedule(date: string): Promise<Game[]> {
  const html = await (await fetchSource(`https://baseball.yahoo.co.jp/npb/schedule/first/all?date=${date}`, 'text/html')).text();
  if (!html.includes('bb-score__content') && !html.includes('試合はありません')) throw Error('스포나비 경기 응답 형식이 바뀌었어요.');
  const anchors = [...html.matchAll(/<a\b[^>]*class="[^"]*bb-score__content[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  return anchors.map(([,href,body]): Game => {
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
}
async function npbStandings(season: number): Promise<Standing[]> {
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

async function cpblStandings(season:number):Promise<Standing[]> {
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

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const league = query.get('league'), kind = query.get('kind'), date = query.get('date'), season = Number(query.get('season'));
  if (!['KBO','NPB','CPBL'].includes(league ?? '') || !['schedule','standings'].includes(kind ?? '') || (league === 'CPBL' && kind !== 'standings') || (kind === 'schedule' && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) || (kind === 'standings' && !(season >= 2000 && season <= 2100))) return Response.json({error:'요청을 확인해 주세요.'}, {status:400});
  try {
    const result = kind === 'schedule' ? league === 'KBO' ? await kboSchedule(date!) : await npbSchedule(date!) : league === 'KBO' ? await kboStandings(season) : league === 'NPB' ? await npbStandings(season) : await cpblStandings(season);
    return Response.json(result, {headers:{'Cache-Control':`public, s-maxage=${kind === 'schedule' ? 45 : 600}, stale-while-revalidate=120`}});
  } catch (error) {
    console.error(`${league} ${kind} source error`, error);
    return Response.json({error:error instanceof Error ? error.message : '데이터를 불러오지 못했어요.'}, {status:502});
  }
}
