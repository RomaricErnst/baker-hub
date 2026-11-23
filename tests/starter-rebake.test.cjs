const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
require('./load-production.cjs');
const {restoreStarterEvents,normalizeMixingBatches,normalizeFlourTarget}=require('../app/lib/session.ts');
const {normalizeTimingOverrides}=require('../app/utils/timingOverrides.ts');
const {normalizeSandwichSnapshot,sandwichFamilyForStyle}=require('../app/lib/sandwich.ts');
const {restoredBakeRoute}=require('../app/lib/bakeNavigation.ts');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/[locale]/page.tsx'),'utf8');
// Execute the actual page restoration handler with state setters captured.
const handler=source.slice(source.indexOf('  async function restoreFromBakeEvent('),source.indexOf('  // ── Computed: Generate button'));
async function restore(yeastType,rebake,starterTimingValid,overrides={},acceptReplacement=true) {
 const state={};
 const storage={};
 const navigationHandler=source.slice(source.indexOf('  function restoreNavigation('),source.indexOf('  // Both advance functions'));
 const context={normalizeExitLead:require('../app/utils/exitLead.ts').normalizeExitLead,normalizeEntryNightIds:require('../app/utils/yeastEntry.ts').normalizeEntryNightIds,normalizeEntryNightKept:require('../app/utils/yeastEntry.ts').normalizeEntryNightKept,normalizeAcceptedPlan:require('../app/utils/bakeExecution.ts').normalizeAcceptedPlan,normalizeMixExecution:require('../app/utils/bakeExecution.ts').normalizeMixExecution,normalizeStarterFeedRecords:require('../app/utils/bakeExecution.ts').normalizeStarterFeedRecords,normalizeBakeExecution:require('../app/utils/bakeExecution.ts').normalizeBakeExecution,confirmLocalReplacement:()=>acceptReplacement,restoredWastePct:require('../app/utils/doughAllowance.ts').restoredWastePct,normalizePrefYeastOverride:require('../app/utils/prefermentYeast.ts').normalizePrefYeastOverride,Date,Math,Boolean,Object,JSON,isRestoringRef:{current:false},restoreStarterEvents,normalizeMixingBatches,normalizeFlourTarget,normalizeTimingOverrides,normalizeSandwichSnapshot,sandwichFamilyForStyle,restoredBakeRoute,endRestore(){},setTimeout(){},localStorage:{setItem(key,value){storage[key]=value;}}};
 for(const name of new Set((handler+navigationHandler).match(/\bset[A-Z]\w*/g))) context[name]=value=>{state[name]=typeof value==='function'?value(0):value;};
 const time=Date.now()-14*86400000;
 context.event={id:'saved-bake',dough_snapshot:{yeastType,tab:'custom',recipeGenerated:true,modeChosen:true,eatTime:time,startTime:time-86400000,timingOverrides:{mix:time-86400000,feed:time-90000000},starterEvents:[{kind:'pre_mix',time:time-90000000,isPast:false}],lastFedTime:time-100000000,knownPeakTime:time-86400000,feed2Time:time-90000000,fridgeOutTime:time-87000000,starterFridgeInTime:time-95000000,lastFedAge:'today',planningMode:'know_peak',ovenType:'dutch_oven',mixerType:'hand',itemWeight:800,containerCapacityLitres:5,pizzaParty:{qtys:{}},activeTab:'guide'}};
 Object.assign(context.event.dough_snapshot,{starterTimingValid,bakeType:'bread',styleKey:yeastType==='sourdough'?'pain_levain':'baguette'});
 Object.assign(context.event.dough_snapshot,overrides);
 context.openDestination=value=>{state.openDestination=value;};context.scrollToStepTop=()=>{};
 // The restore resets the recipe-input baseline and sets the journal id of the opened bake (17 Nov 2026).
 context.generatedRecipeInputKey={current:'previous bake'};context.restoredInputsPending={current:false};
 context.getBreadProtocol=require('../app/utils/breadProfiles.ts').getBreadProtocol;
 context.opts={rebake};
 const js=ts.transpileModule(navigationHandler+handler+'\nrestoreFromBakeEvent(event,opts)',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 await vm.runInNewContext(js,context);
 return {state,storage,snap:context.event.dough_snapshot,context};
}
test('sourdough rebake retains recipe and future bake date but requires fresh starter planning',async()=>{
 const {state,snap}=await restore('sourdough',true);
 assert.equal(state.setOvenType,snap.ovenType);assert.equal(state.setMixerType,snap.mixerType);assert.equal(state.setItemWeight,800);assert.equal(state.setContainerCapacityLitres,5);
 assert.ok(state.setEatTime.getTime()>Date.now());
 for(const name of ['LastFedTime','KnownPeakTime','HasNotFedYet','LastFedAge','FeedTime','Feed2Time','FridgeOutTime','StarterFridgeInTime','StarterPeakTime']) assert.equal(state['set'+name],null,name);
 assert.deepEqual(JSON.parse(JSON.stringify(state.setTimingOverrides)),{});
 assert.equal(state.setStarterEvents.length,0);assert.equal(state.setRecipeGenerated,false);assert.equal(state.setSessionRestored,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);
 // 20 Nov 2026 round 6 (Priya): a Customized bake opens on its bake time, then the recipe, not on Quantity.
 assert.equal(state.setActiveTab,'setup');assert.equal(state.setCustomBakeQuestion,true);assert.equal(state.setQuickRebake,true);assert.equal(state.openDestination,undefined);
});
test('normal sourdough resume preserves saved actions and generated guide',async()=>{
 const {state,snap}=await restore('sourdough',false);
 assert.deepEqual(state.setTimingOverrides,snap.timingOverrides);
 assert.equal(state.setStarterEvents[0].time.getTime(),snap.starterEvents[0].time);
 assert.equal(state.setLastFedTime.getTime(),snap.lastFedTime);assert.equal(state.setKnownPeakTime.getTime(),snap.knownPeakTime);
 assert.equal(state.setContainerCapacityLitres,5);assert.equal(state.setRecipeGenerated,true);assert.equal(state.setSessionRestored,true);assert.equal(state.setActiveTab,'guide');
});
test('commercial yeast rebake retains settings and requires validation of its new planning',async()=>{
 const {state}=await restore('instant',true);
 assert.deepEqual(JSON.parse(JSON.stringify(state.setTimingOverrides)),{});
 assert.equal(state.setRecipeGenerated,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);assert.equal(state.setScheduleCandidateValid,false);
 // A Customized bake (round 6): its bake time first. A Simple bake still opens on how much.
 assert.equal(state.setCustomBakeQuestion,true);assert.equal(state.openDestination,undefined);
 const simple=(await restore('instant',true,undefined,{tab:'simple'})).state;
 assert.equal(simple.openDestination,'batch');assert.equal(simple.setBatchView,'quantity');assert.equal(simple.setQuickRebake,undefined);
});

test('cloud snapshot preserves a known starter timing blocker; legacy snapshot defaults valid',async()=>{
 for(const value of [false,true,undefined]) {
  const {state}=await restore('sourdough',false,value);
  assert.equal(state.setStarterTimingValid,value!==false);
 }
});



test('restoring another cloud bake clears absent blockers, completion and starter observations',async()=>{
 const absent={blocks:[],bakedDone:false,lastFedTime:null,knownPeakTime:null,feed2Time:null,fridgeOutTime:null,starterFridgeInTime:null,lastFedAge:null,planningMode:undefined,starterState:undefined,starterLocation:undefined,pizzaParty:{qtys:{}},addSeeds:false,prefGoesInFridge:false};
 const {state,storage}=await restore('instant',false,true,absent);
 assert.equal(state.setBlocks.length,0);
 assert.equal(state.setBakedDone,false);
 for(const field of ['LastFedTime','KnownPeakTime','Feed2Time','FridgeOutTime','StarterFridgeInTime','LastFedAge','FeedTime','StarterPeakTime'])assert.equal(state['set'+field],null,field);
 assert.equal(state.setPlanningMode,'last_fed');assert.equal(state.setStarterState,'rt_fed');assert.equal(state.setStarterLocation,'rt');
 assert.equal(state.setAddSeeds,false);assert.equal(state.setPrefGoesInFridgeState,false);
 assert.equal(storage.bh_shop_ticks_v1,'{}');assert.equal(storage.bh_prep_ticks_v1,'[]');
});

test('declining a saved bake replacement preserves all current state and storage',async()=>{
 const {state,storage}=await restore('instant',false,true,{},false);
 assert.deepEqual(state,{});assert.deepEqual(storage,{});
});

test('opening a bake gives it its own recipe baseline and journal id; a confirmed mix stays recorded (17 Nov 2026)',async()=>{
 const {state,context}=await restore('instant',false,true,{mixExecution:{actualAt:Date.now()-86400000*15,recordedAt:Date.now()-86400000*15+60000,recipe:{flour:500,water:350,salt:10,totalDough:860}},executionClash:true});
 // The previous bake's inputs are never the baseline of this one: no "You changed your choices" after a switch.
 assert.equal(context.generatedRecipeInputKey.current,null);
 assert.equal(context.restoredInputsPending.current,true);
 assert.equal(state.setJournalId,null,'without a journal entry the restored bake owns none');
 assert.ok(state.setMixExecution,'the recorded mix travels with its bake');
 assert.equal(state.setExecutionClash,true);
 const rebake=await restore('instant',true,true,{executionClash:true});
 assert.equal(rebake.state.setExecutionClash,false,'a new bake starts without the old clash');
});

// Extra for bowl loss (20 Nov 2026 round 7): a saved value is kept; a missing value is the 1.5 % default
// (state undefined), a recorded dough included (O3, round 17: no old-bake exception).
test('bowl-loss allowance on restore: saved values kept, missing ones default',async()=>{
 assert.equal((await restore('instant',true,undefined,{wastePct:0})).state.setWastePct,0);
 assert.equal((await restore('instant',true,undefined,{wastePct:2})).state.setWastePct,2);
 const missing=await restore('instant',true,undefined,{wastePct:undefined});
 assert.ok('setWastePct' in missing.state);assert.equal(missing.state.setWastePct,undefined);
 const made=await restore('instant',false,undefined,{wastePct:undefined,mixExecution:{actualAt:Date.now()-15*86400000,recordedAt:Date.now()-15*86400000,recipe:{flour:600,water:390,salt:17,oil:0,sugar:0}}});
 assert.equal(made.state.setWastePct,undefined);
});
