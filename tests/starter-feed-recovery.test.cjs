const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('./load-production.cjs');
const {saveSession,loadSession,serializeStarterEvents}=require('../app/lib/session.ts');
const {overdueStarterFeed}=require('../app/utils/bakeExecution.ts');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const handlers=source.slice(source.indexOf('  function requestSourdoughMixReplan()'),source.indexOf('  const commercialMethod=',source.indexOf('  function requestSourdoughMixReplan()')));
function recover(actual,guide=false){
 const now=Date.now(),last=new Date(now-24*3600000),peak=new Date(now-12*3600000),planned=new Date(now-3600000);
 const events=[{kind:'last_fed',time:last},{kind:'known_peak',time:peak},{kind:'refresh',time:planned,feedingRatio:4},{kind:'pre_mix',time:new Date(now+3600000)}];
 const state={},context={Date,Number,starterEvents:events,starterFeedRecords:[],missedStarterFeed:events[2],nextFeedRatio:1,lastFedTime:last,knownPeakTime:peak,serializeStarterEvents,saveSession:snapshot=>state.snapshot=snapshot,buildSessionPayload:overrides=>overrides,openDestination:value=>state.destination=value};
 for(const name of new Set(handlers.match(/\bset[A-Z]\w*/g)))context[name]=value=>state[name]=typeof value==='function'?value(0):value;
 if(guide){context.feedEvent=events[3];context.feedEvent.feedingRatio=5;context.missedStarterFeed=undefined;}
 const code=ts.transpileModule(handlers+'\nupdateStarterAfterMissedFeed('+ (actual?'Date.now()-1800000':'') +(guide?',feedEvent':'')+');',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,context);return {state,events,last,peak};
}
test('missed feed Not yet preserves observations and persists pending recovery without inventing a feed',()=>{
 const {state,last,peak}=recover(false);
 assert.equal(state.snapshot.starterRecoveryPending,true);
 assert.equal(state.snapshot.starterTimingValid,false);
 assert.deepEqual(state.snapshot.starterFeedRecords,[]);
 assert.deepEqual(state.snapshot.starterEvents.map(e=>e.time),[+last,+peak]);
 assert.equal(state.setLastFedTime,undefined);
 assert.equal(state.destination,'organisation');
});
test('confirmed late feed uses saved feed ratio and archives previous observations',()=>{
 const {state,last,peak}=recover(true),record=state.snapshot.starterFeedRecords[0];
 assert.equal(record.ratio,4);assert.equal(record.previousFedAt,+last);assert.equal(record.previousPeakAt,+peak);
 assert.equal(state.snapshot.lastFeedRatio,4);assert.equal(state.snapshot.lastFedTime,record.actualAt);
 assert.equal(state.snapshot.starterEvents.length,0);assert.equal(state.snapshot.knownPeakTime,null);
 assert.equal(state.snapshot.starterRecoveryPending,true);assert.equal(state.snapshot.starterLocation,'rt');
});
test('recovery flag and factual feed survive reload while unresolved planned feeds remain questions',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 const {state}=recover(true);assert.equal(saveSession(state.snapshot),true);
 const restored=loadSession();assert.equal(restored.starterRecoveryPending,true);
 assert.deepEqual(restored.starterFeedRecords,JSON.parse(JSON.stringify(state.snapshot.starterFeedRecords)));
 const now=Date.now(),event={kind:'pre_mix',time:new Date(now-1000),feedingRatio:4};
 assert.equal(overdueStarterFeed([event],restored.starterFeedRecords,now),event);
 assert.equal(overdueStarterFeed([{kind:'last_fed',time:new Date(now-1000)}],[],now),undefined);
});

test('guide feed completion records the same fact even before its planned time',()=>{
 const {state}=recover(true,true),record=state.snapshot.starterFeedRecords[0];
 assert.equal(record.kind,'pre_mix');assert.equal(record.ratio,5);
 assert.ok(record.actualAt<record.plannedAt);
 assert.equal(state.snapshot.lastFedTime,record.actualAt);
 assert.equal(overdueStarterFeed([{kind:record.kind,time:new Date(record.plannedAt)}],state.snapshot.starterFeedRecords,record.plannedAt+1),undefined);
});
