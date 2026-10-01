import type {RelayEvent} from '@/lib/gip/types';

export function RelayFeed({events,away,home}:{events:RelayEvent[];away:string;home:string}) {
  const appearances:{id:string;events:RelayEvent[]}[]=[];
  for(const event of events){
    const id=event.atBatId??event.id;
    let appearance=appearances.at(-1);
    if(!appearance||appearance.id!==id){appearance={id,events:[]};appearances.push(appearance);}
    appearance.events.push(event);
  }
  return <div className="relay-feed">{appearances.map(appearance=>{
    const rows=[...appearance.events].sort((a,b)=>b.order-a.order),latest=rows[0];
    const batter=rows.find(e=>e.batter)?.batter,pitcher=rows.find(e=>e.pitcher)?.pitcher;
    const heading=rows.find(e=>e.heading)?.heading;
    const outs=rows.find(e=>e.outs!==undefined)?.outs;
    const pitches=rows.filter(e=>e.kind==='pitch'||e.pitchNumber);
    const changes=rows.filter(e=>e.kind==='substitution').reverse();
    const results=rows.filter(e=>e.kind!=='heading'&&e.kind!=='substitution'&&!e.pitchNumber&&e.kind!=='pitch').reverse();
    const attack=latest.half==='top'?away:latest.half==='bottom'?home:'';
    return <section className="relay-appearance" key={appearance.id} aria-label={`${latest.inning}회 ${batter?.name??heading??'경기 진행'}`}>
      <div className="relay-context"><h2>{attack&&`${attack} · `}{latest.inning?`${latest.inning}회 ${latest.half==='top'?'초':latest.half==='bottom'?'말':''} 공격`:'경기 진행'}</h2>{outs!==undefined&&outs>=0&&outs<=3&&<div className="relay-outs" aria-label={`${outs}아웃`}>{[1,2,3].map(n=><span aria-hidden="true" className={n<=outs?'is-out':''} key={n}>{n}</span>)}<small aria-hidden="true">OUT</small></div>}</div>
      <article className="relay-card">
        <header className="relay-card-header"><div className="relay-batter"><h3>{batter?<>{batter.order?`${batter.order}번 `:''}{batter.name}</>:heading?heading:'경기 진행'}</h3>{batter?.average&&<span>타율 {batter.average}</span>}</div>{pitcher&&<p className="relay-pitcher"><span>투수</span> {pitcher}</p>}</header>
        {!!batter?.stats?.length&&<div className="relay-batter-stats"><p className="relay-stats-label">타석 시작 기준</p><ul>{batter.stats.map(stat=><li key={stat.label}>{stat.label} <b>{stat.value}</b></li>)}</ul></div>}
        {results.length>0&&<div className="relay-results">{results.map(e=><p key={e.id}>{e.text}</p>)}</div>}
        {pitches.length>0&&<ol className="relay-pitches" aria-label="투구 내역 · 최신 투구부터">{pitches.map(e=><li key={e.id}><span className="relay-pitch-number" aria-label={`${e.pitchNumber}구`}>{e.pitchNumber}</span><span className="relay-pitch-result">{e.pitch?.result??e.text}</span><span className="relay-pitch-detail">{e.pitch?.speedKph?`${e.pitch.speedKph} km/h`:''}{e.pitch?.speedKph&&e.pitch?.type?' · ':''}{e.pitch?.type?e.pitch.type:''}</span><span className="relay-count" aria-label={e.pitch?.balls!==undefined&&e.pitch.strikes!==undefined?`${e.pitch.balls}볼 ${e.pitch.strikes}스트라이크`:undefined}>{e.pitch?.balls!==undefined&&e.pitch.strikes!==undefined?`${e.pitch.balls}-${e.pitch.strikes}`:'—'}</span></li>)}</ol>}
        {changes.length>0&&<div className="relay-changes">{changes.map(e=><p key={e.id}><span aria-hidden="true">⇄</span><span>{e.text}</span></p>)}</div>}
        {!pitches.length&&!results.length&&!changes.length&&<p className="relay-atbat-wait">투구를 기다리고 있어요.</p>}
      </article>
    </section>;
  })}</div>;
}
