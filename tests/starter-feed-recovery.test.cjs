const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('./load-production.cjs');
const {saveSession,loadSession,serializeStarterEvents}=require('../app/lib/session.ts');
const {overdueStarterFeed,shiftStarterPlanAfterFeed}=require('../app/utils/bakeExecution.ts');
const {formatClock}=require('../app/utils/units.ts');
const {computeStarterPeakMs}=require('../app/utils/starterPeak.ts');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const handlers=source.slice(source.indexOf('  function recordedFeedAnchor('),source.indexOf('  const commercialMethod=',source.indexOf('  function requestSourdoughMixReplan()')));
function recover(actual,guide=false,extra={}){
 const now=Date.now(),last=new Date(now-24*3600000),peak=new Date(now-12*3600000),planned=new Date(now-3600000);
 const events=[{kind:'last_fed',time:last},{kind:'known_peak',time:peak},{kind:'refresh',time:planned,feedingRatio:4},{kind:'pre_mix',time:new Date(now+3600000)}];
 const state={},context={Date,Number,starterEvents:events,starterFeedRecords:[],missedStarterFeed:events[2],nextFeedRatio:1,recipeGenerated:false,starterRecoveryPending:false,shiftStarterPlanAfterFeed,formatClock,locale:'en',lastFedTime:last,knownPeakTime:peak,serializeStarterEvents,saveSession:snapshot=>state.snapshot=snapshot,buildSessionPayload:overrides=>overrides,openDestination:value=>state.destination=value};
 for(const name of new Set(handlers.match(/\bset[A-Z]\w*/g)))context[name]=value=>state[name]=typeof value==='function'?value(0):value;
 Object.assign(context,extra);
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

// Priya's retention review (17 Nov 2026): once the recipe exists, confirming a feed keeps the plan,
// keeps her where she is, and a late feed moves only the steps that depend on it.
const H=3600000;
// recover() records the feed 30 minutes before now; the first overdue feed is the one confirmed.
function runKeep(events,{fits=true,start}={}){
 const now=Date.now(),eat=new Date(now+30*H),mix=start??new Date(now+12*H);
 const planned=events.find(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.kind)&&+e.time<=now);
 return recover(true,false,{missedStarterFeed:planned,starterEvents:events,recipeGenerated:true,eatTime:eat,startTime:mix,timingOverrides:{},feedTime:null,feed2Time:null,fridgeOutTime:null,starterFridgeInTime:null,
  starterPlanResetKey:3,confirmedSchedulePlan:false,acceptedPlan:{startTime:+mix,preparationAt:+mix,bakeAt:+eat},styleKey:fits?'pain_au_levain':undefined,mixerType:'hand',repairKey:()=>'k',blocks:[],prefOffsetH:0,prefGoesInFridge:false,
  Date:class extends Date{static now(){return now;}}});
}
test('a feed confirmed on time keeps every planned time and never opens setup',()=>{
 const now=Date.now(),t=h=>new Date(Math.round((now+h*H)/900000)*900000);
 const events=[{kind:'last_fed',time:t(-120)},{kind:'refresh',time:new Date(now-1800000),feedingRatio:1},{kind:'fridge_in',time:t(14)},{kind:'fridge_out',time:t(40)},{kind:'pre_mix',time:t(42),feedingRatio:4}];
 const {state}=runKeep(events);
 assert.equal(state.destination,undefined);
 assert.equal(state.setStarterRecoveryPending,undefined);
 assert.equal(state.snapshot.starterRecoveryPending,undefined);
 assert.equal(state.snapshot.starterFeedRecords.length,1);
 // To the minute: the confirmed feed takes its recorded time, read from a separate clock call.
 assert.deepEqual(state.snapshot.starterEvents.map(e=>Math.round(e.time/60000)),events.map(e=>Math.round(+e.time/60000)));
 assert.equal(state.setStartTime,undefined);
 // The feed is answered: it is not asked again.
 const restored=state.snapshot.starterEvents.map(e=>({...e,time:new Date(e.time)}));
 assert.equal(overdueStarterFeed(restored,state.snapshot.starterFeedRecords,now),undefined);
});
test('a late pre-mix feed moves the later feeds and the mix by the same time; the bake stays',()=>{
 const now=Date.now(),q=ms=>Math.round(ms/900000)*900000;
 const planned=q(now-2.5*H),actual=planned+2*H;
 const events=[{kind:'last_fed',time:new Date(planned-30*H)},{kind:'pre_mix',time:new Date(planned),feedingRatio:4},{kind:'pre_mix',time:new Date(q(now+5*H)),feedingRatio:4}];
 const shifted=shiftStarterPlanAfterFeed(events,events[1],actual,q(now+12*H));
 assert.equal(shifted.mixShiftMs,2*H);
 assert.deepEqual(shifted.events.map(e=>+e.time),[+events[0].time,actual,+events[2].time+2*H]);
 // A fridge spell after the feed absorbs the delay: the mix stays.
 const cold=[...events.slice(0,2),{kind:'fridge_in',time:new Date(q(now+3*H))},{kind:'fridge_out',time:new Date(q(now+20*H))}];
 const kept=shiftStarterPlanAfterFeed(cold,cold[1],actual,q(now+24*H));
 assert.equal(kept.mixShiftMs,0);
 assert.deepEqual(kept.events.map(e=>+e.time),[+cold[0].time,actual,+cold[2].time+2*H,+cold[3].time]);
 // A feed recorded at its actual time is answered.
 assert.equal(overdueStarterFeed(kept.events,[{kind:'pre_mix',plannedAt:planned,actualAt:actual,recordedAt:actual,ratio:4}],now),undefined);
});
test('a recorded late feed moves its peak: card note and bell agree with the shared peak model',()=>{
 // Priya, 17 Nov 2026: the pre-mix feed planned 10:00pm was done at midnight; the card still said
 // "Peak around 7:12am" while the moved mix read 9:12am.
 const now=Date.now(),q=ms=>Math.round(ms/900000)*900000,adj=9;
 const refresh=q(now-10*H),planned=q(now-3*H),actual=planned+2*H;
 const peakAt=feed=>computeStarterPeakMs(feed,refresh+adj*H,adj);
 const note=at=>`Peak around ${formatClock(new Date(at),'en')}`;
 const events=[{kind:'last_fed',time:new Date(refresh-60*H)},{kind:'refresh',time:new Date(refresh),bellPeakTime:new Date(refresh+adj*H)},
  {kind:'pre_mix',time:new Date(planned),bellPeakTime:new Date(peakAt(planned)),bellStartTime:new Date(planned),cardNote:note(peakAt(planned))}];
 // The plan fed 3 h early against the refresh peak: a stretched rise.
 assert.ok(+events[2].bellPeakTime-planned>adj*H);
 const shifted=shiftStarterPlanAfterFeed(events,events[2],actual,q(now+10*H),d=>formatClock(d,'en'));
 const fed=shifted.events[2];
 assert.equal(+fed.time,actual);
 assert.equal(+fed.bellPeakTime,peakAt(actual),'peak from the recorded feed, same model');
 assert.equal(fed.cardNote,note(peakAt(actual)),'card names the bell peak');
 assert.equal(+fed.bellStartTime,actual);
 // Earlier steps keep theirs.
 assert.equal(+shifted.events[1].bellPeakTime,refresh+adj*H);
});
test('when the moved mix no longer fits before the bake, the plan is replanned from the recorded feed',()=>{
 const now=Date.now(),q=ms=>Math.round(ms/900000)*900000;
 const events=[{kind:'last_fed',time:new Date(now-48*H)},{kind:'pre_mix',time:new Date(q(now-2.5*H)),feedingRatio:4}];
 const late=runKeep(events,{fits:false});
 assert.equal(late.state.destination,'organisation');
 assert.equal(late.state.snapshot.starterRecoveryPending,true);
 assert.equal(late.state.snapshot.lastFedTime,late.state.snapshot.starterFeedRecords[0].actualAt);
});
