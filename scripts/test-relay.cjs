const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'gip-relay-'));
fs.writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}');
for(const name of ['types','catalog','official-sources','live-baseball','server/regional','server/game-detail']){
 const target=path.join(output,name+'.js');fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/gip',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
try {
 const {naverRelayEvents}=require(path.join(output,'server/game-detail.js'));
 const state={pitcher:'p1',ball:'1',strike:'2',out:'2'};
 const fixture={awayLineup:{pitcher:[{pcode:'p1',name:'투수 A'}]},textRelays:[{no:54,inn:5,homeOrAway:'1',textOptions:[
 {seqno:1,text:'6번타자 강민호',type:8,batterRecord:{name:'강민호',batOrder:6,seasonHra:0.272,pa:3,ab:2,hit:0,bb:1},currentGameState:state},
 {seqno:2,text:'1구 볼',type:1,pitchNum:1,speed:'131',stuff:'스위퍼',currentGameState:{...state,ball:'1',strike:'0'}},
 {seqno:3,text:'2구 스트라이크',type:1,pitchNum:2,speed:'148',stuff:'직구',currentGameState:state},
 {seqno:4,text:'강민호 : 삼진 아웃',type:13,currentGameState:{...state,out:'3'}},
 {seqno:5,text:'투수 A : 투수 B (으)로 교체',type:2,currentGameState:{...state,pitcher:'unknown'}},
 ]},{no:53,inn:5,homeOrAway:'1',textOptions:[{seqno:0,type:0,text:'5회말 삼성 공격'}]}]};
 const events=naverRelayEvents(fixture,'game');
 assert.equal(events.length,5);assert.equal(new Set(events.map(e=>e.atBatId)).size,1);
 assert.equal(events[0].kind,'substitution');assert.equal(events[0].pitcher,undefined);
 assert.equal(events[1].outs,3);assert.equal(events[1].kind,'result');
 assert.deepEqual(events.filter(e=>e.kind==='pitch').map(e=>e.pitchNumber),[2,1]);
 assert.deepEqual(events[2].pitch,{result:'스트라이크',type:'직구',speedKph:148,balls:1,strikes:2});
 assert.equal(events[2].pitcher,'투수 A');assert.equal(events[2].batter.average,'0.272');
 assert.equal(events[2].batter.stats.find(s=>s.label==='안타').value,0);
 const missing=naverRelayEvents({textRelays:[{no:1,inn:1,homeOrAway:'0',textOptions:[{seqno:1,text:'1구 볼',type:1}]}]},'empty')[0];
 assert.equal(missing.pitch.speedKph,undefined);assert.equal(missing.pitch.balls,undefined);assert.equal(missing.outs,undefined);
 if(process.argv[2]){
  const live=naverRelayEvents(JSON.parse(fs.readFileSync(process.argv[2])).result.textRelayData,'live');
  assert(live.some(e=>e.pitch?.speedKph>0));assert(live.some(e=>e.batter?.stats?.length===8));assert(live.some(e=>e.pitcher));assert(live.some(e=>e.outs===3));
  console.log(`Live fixture: ${live.length} events, ${new Set(live.map(e=>e.atBatId)).size} cards`);
 }
 console.log('PASS: at-bat grouping, newest pitch order, actual pitcher IDs, historical batting snapshot, zero stats, outs, substitutions, missing data');
} finally {fs.rmSync(output,{recursive:true,force:true});}
