const assert=require('node:assert/strict');
const {normalizeGame,koreaStamp,getSchedule,liveBaseballRepository}=require(require('node:path').resolve(process.argv[2] || '/tmp/gip-live-test/live-baseball.js'));
const raw={gamePk:1,gameDate:'2026-09-21T22:35:00Z',officialDate:'2026-09-21',venue:{name:'Park'},status:{abstractGameState:'Final',detailedState:'Final'},teams:{away:{team:{id:137,name:'Giants'},score:4},home:{team:{id:119,name:'Dodgers'},score:2}}};
assert.equal(koreaStamp(raw.gameDate),'2026-09-22T07:35:00+09:00');
assert.equal(normalizeGame(raw,'MLB').awayId,'mlb-0');
assert.equal(normalizeGame({...raw,status:{abstractGameState:'Preview',detailedState:'Cancelled'}},'MLB').statusLabel,'경기 취소');
assert.equal(normalizeGame({...raw,teams:{...raw.teams,away:{team:{id:99999,name:'Historical'}}}},'MLB').awayId,'stats-MLB-99999');
(async()=>{
 global.fetch=async url=>{if(url.includes('sportId=23'))throw Error('network');return {ok:true,json:async()=>({dates:url.includes('sportId=1&')?[{games:[raw,{...raw,gamePk:2},raw,{...raw,gamePk:3,gameDate:'2026-09-22T20:00:00Z'}]}]:[]})};};
 const result=await getSchedule('2026-09-22');assert.equal(result.games.length,2);assert.deepEqual(result.failed,['LMB']);
 await assert.rejects(liveBaseballRepository.getStandings('KBO',2026),/연결 전/);
 global.fetch=async()=>{throw Error('offline');};await assert.rejects(getSchedule('2026-09-22'),/불러오지/);
 console.log('PASS: KST date boundary, team IDs, cancellation, historical teams, doubleheaders, deduplication, partial failure, offline, unsupported league');
})();
