'use client';
import {Fragment,useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {ChevronLeft,RefreshCw} from 'lucide-react';
import {dateLabel,team} from '@/lib/gip/catalog';
import {leagueLabel} from '@/lib/gip/league-labels';
import type {GameDetail,GameBoxscore,League,StartingLineup} from '@/lib/gip/types';

function Lineups({names,lineups,pregame}:{names:string[];lineups:StartingLineup[];pregame:boolean}) {
  const orders=[...new Set([1,2,3,4,5,6,7,8,9,...lineups.flatMap(l=>l.batters.map(p=>p.order))])].sort((a,b)=>a-b);
  return <div className="lineup-comparison"><table className="lineup-table"><caption className="sr-only">양 팀 선발 라인업</caption><colgroup>{lineups.map((_,i)=><Fragment key={i}><col className="lineup-order"/><col className="lineup-position"/><col/></Fragment>)}</colgroup><thead><tr>{names.map((name,i)=><th key={i} colSpan={3} scope="colgroup">{name}</th>)}</tr><tr>{names.map((_,i)=><Fragment key={i}><th scope="col">타순</th><th scope="col">포지션</th><th scope="col">선수</th></Fragment>)}</tr></thead><tbody>
    {orders.map(order=><tr key={order}>{lineups.map((lineup,i)=>{const player=lineup.batters.find(p=>p.order===order);return <Fragment key={i}><td>{order}</td><td className="position-cell">{player?.position ?? '—'}</td><td className="player-cell">{player?player.name:'—'}</td></Fragment>;})}</tr>)}
    <tr className="pitcher-row">{lineups.map((l,i)=><Fragment key={i}><td></td><th scope="row" className="position-cell">선발투수</th><td className="player-cell">{l.pitcher?l.pitcher.name:(pregame?'발표 전':'정보 없음')}</td></Fragment>)}</tr>
    </tbody></table>{lineups.some(l=>!l.announced)&&<p className="lineup-pending">{lineups.map((l,i)=>!l.announced?`${names[i]} · ${pregame?'라인업 발표 전':'라인업 정보 없음'}`:null).filter(Boolean).join(' / ')}</p>}</div>;
}
import {RelayFeed} from './relay-feed';
import {BoxscorePanel} from './boxscore-panel';

export function GameDetailPage({gameId,league,date}:{gameId:string;league:League;date:string}) {
  const [detail,setDetail]=useState<GameDetail|null>(null),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [tab,setTab]=useState<'lineup'|'relay'|'stats'>('lineup'),[inning,setInning]=useState(0),[order,setOrder]=useState<'latest'|'first'>('latest');
  const [boxscore,setBoxscore]=useState<GameBoxscore|null>(null),[statsLoading,setStatsLoading]=useState(false),[statsError,setStatsError]=useState(''),[statsRetry,setStatsRetry]=useState(0);
  const latestStatus=useRef<GameDetail['game']['status']>('scheduled'),autoTab=useRef(false);
  function switchTab(event:KeyboardEvent<HTMLDivElement>) {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const tabs=['lineup','relay','stats'] as const;
    const next=event.key==='Home'?'lineup':event.key==='End'?'stats':tabs[(tabs.indexOf(tab)+(event.key==='ArrowRight'?1:2))%3];
    setTab(next);event.currentTarget.querySelector<HTMLButtonElement>(`#${next}-tab`)?.focus();
  }
  useEffect(()=>{
    let active=true,running=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined;
    setLoading(true);setError('');
    async function refresh() {
      if(running)return;running=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),league==='NPB'?45000:20000);setRefreshing(true);
      try {
        const params=new URLSearchParams({id:gameId,league,date,inning:String(inning)});
        const response=await fetch(`/api/baseball/game?${params}`,{signal:controller.signal});
        const data=await response.json() as GameDetail & {error?:string};
        if(!response.ok||!data.game)throw Error(data.error ?? '경기 정보를 불러오지 못했어요.');
        if(active){setDetail(data);setError('');latestStatus.current=data.game.status;if(!autoTab.current){setTab(data.game.status==='in_progress'?'relay':'lineup');autoTab.current=true;}}
      } catch(e) {if(active)setError(e instanceof Error && e.name==='AbortError'?'연결이 지연되고 있어요. 다시 새로고침해 주세요.':e instanceof Error?e.message:'경기 정보를 불러오지 못했어요.');}
      finally {
        clearTimeout(timeout);running=false;
        if(active){setLoading(false);setRefreshing(false);if(latestStatus.current!=='final'&&latestStatus.current!=='postponed')timer=setTimeout(()=>{if(document.visibilityState==='visible')void refresh();else schedule();},latestStatus.current==='in_progress'?15000:60000);}
      }
    }
    function schedule(){if(active)timer=setTimeout(()=>{if(document.visibilityState==='visible')void refresh();else schedule();},15000);}
    function wake(){if(document.visibilityState==='visible'&&!running){clearTimeout(timer);void refresh();}}
    void refresh();document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);
    return()=>{active=false;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);};
  },[gameId,league,date,inning,retry]);
  useEffect(()=>{
    if(tab!=='stats')return;let active=true;let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
    setStatsLoading(true);setStatsError('');
    async function refresh(){try{const params=new URLSearchParams({id:gameId,league});const response=await fetch(`/api/baseball/boxscore?${params}`,{signal:controller.signal});const data=await response.json() as GameBoxscore & {error?:string};if(!response.ok)throw Error(data.error??'경기기록을 불러오지 못했어요.');if(active){setBoxscore(data);setStatsError('');}}catch(error){if(active)setStatsError(error instanceof Error?error.message:'경기기록을 불러오지 못했어요.');}finally{if(active){setStatsLoading(false);if(detail?.game.status!=='final'&&detail?.game.status!=='postponed')timer=setTimeout(()=>void refresh(),15000);}}}
    void refresh();return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[tab,gameId,league,statsRetry,detail?.game.status]);
  const game=detail?.game,away=game?(team(game.awayId)?.short ?? detail?.awayName):'',home=game?(team(game.homeId)?.short ?? detail?.homeName):'';
  const returnUrl=`/?date=${encodeURIComponent(game?.date ?? date)}#home`;
  const played=game?.status==='final'||game?.status==='in_progress';
  const status=game?.statusLabel ?? (game?.status==='final'?'FINAL':game?.status==='postponed'?'경기 연기':game?.status==='in_progress'?game.inning ?? '진행 중':'경기 전');
  const availableInnings=detail?[...new Set([...detail.relay.map(e=>e.inning),...detail.innings.filter(i=>i.away!=='-'||i.home!=='-').map(i=>i.inning),Number(game?.inning?.match(/\d+/)?.[0] ?? 0)])].filter(i=>i>0).sort((a,b)=>a-b):[];
  const relay=detail?.relay.filter(e=>league==='KBO'||inning===0||e.inning===inning) ?? [];
  const visibleRelay=order==='latest'?relay:[...relay].reverse();
  return <div className="app-shell game-detail-shell"><header className="header"><a className="wordmark" href={returnUrl} aria-label="GIP 홈">GIP</a><a className="detail-back" href={returnUrl}><ChevronLeft size={18}/>경기 목록</a></header><main className="main game-detail-main">
    {!detail?<div className="detail-empty" role={loading?'status':'alert'}><p>{loading?'경기 정보를 불러오고 있어요.':error}</p>{!loading&&<button className="primary" onClick={()=>setRetry(r=>r+1)}>다시 시도</button>}</div>:<>
      <section className="detail-scoreboard"><div className="detail-meta"><span>{leagueLabel(game!.league)}</span><span className={game!.status==='in_progress'?'live-status':''}>{status}</span></div><h1 className="sr-only">{away} 대 {home} 경기 상세</h1><div className="detail-scoreline"><div><strong>{away}</strong><small>원정</small></div><strong className="detail-score">{played?<>{game!.awayScore ?? '—'}<span>:</span>{game!.homeScore ?? '—'}</>:<span className="detail-time">{game!.timeTBD?'시간 미정':game!.startsAt.slice(11,16)}</span>}</strong><div><strong>{home}</strong><small>홈</small></div></div><p className="detail-venue">{dateLabel(game!.date)} · {game!.timeTBD?'시간 미정':game!.startsAt.slice(11,16)} · {game!.venue}</p>
      </section>
      {played&&detail.innings.length>0&&<div className="inning-scroll"><table className="inning-table"><caption className="sr-only">이닝별 점수</caption><thead><tr><th scope="col">팀</th>{detail.innings.map(i=><th scope="col" key={i.inning}>{i.inning}</th>)}<th scope="col">R</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th scope="row">{side==='away'?away:home}</th>{detail.innings.map(i=><td key={i.inning}>{i[side]}</td>)}<td className="inning-total">{side==='away'?game!.awayScore:game!.homeScore}</td></tr>)}</tbody></table></div>}
      <div className="detail-update"><span>{game!.status==='in_progress'?'15초마다 확인':game!.status==='scheduled'?'60초마다 확인':game!.status==='final'?'경기 종료 기록':'경기 상태 확인'} · {new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(detail.updatedAt))} 갱신</span><button aria-label="경기 새로고침" disabled={refreshing} onClick={()=>setRetry(r=>r+1)}><RefreshCw size={16} className={refreshing?'refresh-spin':''}/>새로고침</button></div>
      {error&&<p className="detail-warning" role="alert">{error} 마지막으로 확인한 정보를 표시하고 있어요.</p>}
      {detail.warnings.map(w=><p key={w} className="detail-warning" role="status">{w}</p>)}
      <div className="detail-tabs" role="tablist" aria-label="경기 상세 선택" onKeyDown={switchTab}><button role="tab" tabIndex={tab==='lineup'?0:-1} aria-selected={tab==='lineup'} aria-controls="lineup-panel" id="lineup-tab" onClick={()=>setTab('lineup')}>선발 라인업</button><button role="tab" tabIndex={tab==='relay'?0:-1} aria-selected={tab==='relay'} aria-controls="relay-panel" id="relay-tab" onClick={()=>setTab('relay')}>속보</button><button role="tab" tabIndex={tab==='stats'?0:-1} aria-selected={tab==='stats'} aria-controls="stats-panel" id="stats-tab" onClick={()=>setTab('stats')}>경기기록</button></div>
      <div id="lineup-panel" role="tabpanel" tabIndex={0} aria-labelledby="lineup-tab" hidden={tab!=='lineup'}><Lineups names={[away!,home!]} lineups={[detail.lineups.away,detail.lineups.home]} pregame={game!.status==='scheduled'}/></div>
      <div id="relay-panel" role="tabpanel" tabIndex={0} aria-labelledby="relay-tab" hidden={tab!=='relay'}>
        {availableInnings.length>0&&<div className="relay-controls"><label>이닝<select value={inning} onChange={e=>setInning(Number(e.target.value))}><option value={0}>{(league==='KBO'||league==='NPB')?'최근 이닝':'전체 이닝'}</option>{availableInnings.map(i=><option key={i} value={i}>{i}회</option>)}</select></label><button aria-pressed={order==='latest'} onClick={()=>setOrder(o=>o==='latest'?'first':'latest')}>{order==='latest'?'최신순':'시간순'}</button></div>}
        {loading?<p className="relay-empty" role="status">문자중계를 불러오고 있어요.</p>:visibleRelay.length?<RelayFeed events={visibleRelay} away={away!} home={home!}/>:<p className="relay-empty">{game!.status==='scheduled'?'경기가 시작되면 문자중계가 표시돼요.':game!.status==='postponed'?'진행된 문자중계가 없어요.':inning?`${inning}회 문자중계가 아직 제공되지 않았어요.`:'제공처에서 문자중계를 아직 제공하지 않았어요.'}</p>}
      </div>
      <div id="stats-panel" role="tabpanel" tabIndex={0} aria-labelledby="stats-tab" hidden={tab!=='stats'}><BoxscorePanel data={boxscore} loading={statsLoading} error={statsError} away={away!} home={home!} pregame={game!.status==='scheduled'} retry={()=>setStatsRetry(r=>r+1)}/></div>
      <p className="detail-source">{detail.source}<br/><a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer">제공처에서 경기 보기</a></p>
    </>}
  </main></div>;
}
