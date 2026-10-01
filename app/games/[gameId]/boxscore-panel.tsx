'use client';
import {useState} from 'react';
import type {GameBoxscore,StatPlayer} from '@/lib/gip/types';
const batting=[['ab','타수'],['r','득점'],['h','안타'],['rbi','타점'],['hr','홈런'],['bb','볼넷'],['so','삼진'],['sb','도루'],['avg','시즌 타율']];
const pitching=[['ip','이닝'],['pc','투구수'],['h','피안타'],['hr','피홈런'],['bb','볼넷'],['hbp','사구'],['so','탈삼진'],['r','실점'],['er','자책'],['era','시즌 ERA']];
function StatsTable({players,kind,name}:{players:StatPlayer[];kind:'batting'|'pitching';name:string}){
 const cols=kind==='batting'?batting:pitching;
 return <section className="boxscore-section"><h2>{kind==='batting'?'타자 기록':'투수 기록'}</h2>{players.length?<div className="boxscore-scroll" role="region" aria-label={`${name} ${kind==='batting'?'타자':'투수'} 기록, 가로로 스크롤`} tabIndex={0}><table className="boxscore-table"><caption className="sr-only">{name} {kind==='batting'?'타자':'투수'} 경기 기록</caption><thead><tr><th scope="col">선수</th>{kind==='batting'&&<th scope="col">포지션</th>}{cols.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{players.map((p,i)=><tr key={`${p.id}-${i}`}><th scope="row">{p.order&&p.order!=='—'&&<small>{p.order}</small>}{p.name}</th>{kind==='batting'&&<td>{p.position||'—'}</td>}{cols.map(([key])=><td key={key}>{p.stats[key]??'—'}</td>)}</tr>)}</tbody></table></div>:<p className="boxscore-empty">아직 {kind==='batting'?'타자':'투수'} 기록이 제공되지 않았어요.</p>}</section>;
}
export function BoxscorePanel({data,loading,error,away,home,pregame,retry}:{data:GameBoxscore|null;loading:boolean;error:string;away:string;home:string;pregame:boolean;retry:()=>void}){
 const [side,setSide]=useState<'away'|'home'>('away');
 if(!data)return <div className="relay-empty" role={error?'alert':'status'}>{loading?'경기기록을 불러오고 있어요.':error||'경기기록을 확인하고 있어요.'}{error&&<button className="picker-retry" onClick={retry}>다시 불러오기</button>}</div>;
 return <>{error&&<p className="detail-warning" role="alert">{error} 마지막으로 확인한 기록을 표시해요. <button className="picker-retry" onClick={retry}>다시 불러오기</button></p>}{data.status==='unsupported'?<p className="relay-empty">이 리그의 타자·투수 기록은 아직 연결되지 않았어요.</p>:data.status==='pending'?<p className="relay-empty">{pregame?'경기가 시작되면 타자·투수 기록이 표시돼요.':'제공처에서 경기기록을 준비하고 있어요.'}</p>:<><div className="boxscore-teams" role="group" aria-label="기록을 볼 팀"><button aria-pressed={side==='away'} onClick={()=>setSide('away')}>{away}<small>원정</small></button><button aria-pressed={side==='home'} onClick={()=>setSide('home')}>{home}<small>홈</small></button></div><StatsTable players={data[side].batters} kind="batting" name={side==='away'?away:home}/><StatsTable players={data[side].pitchers} kind="pitching" name={side==='away'?away:home}/><p className="boxscore-note">이 경기의 기록입니다. 타율·ERA는 제공처의 시즌 기록이며, ‘—’는 미제공 항목입니다.</p></>}</>;
}
