const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
require('./load-production.cjs');
const {restoreStarterEvents,normalizeMixingBatches}=require('../app/lib/session.ts');
const {normalizeTimingOverrides}=require('../app/utils/timingOverrides.ts');
const {normalizeSandwichSnapshot,sandwichFamilyForStyle}=require('../app/lib/sandwich.ts');
const {restoredBakeRoute}=require('../app/lib/bakeNavigation.ts');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/[locale]/page.tsx'),'utf8');
// Execute the actual page restoration handler with state setters captured.
const handler=source.slice(source.indexOf('  async function restoreFromBakeEvent('),source.indexOf('  // ── Computed: Generate button'));
async function restore(yeastType,rebake,starterTimingValid,overrides={}) {
 const state={};
 const storage={};
 const navigationHandler=source.slice(source.indexOf('  function restoreNavigation('),source.indexOf('  // Both advance functions'));
 const context={Date,Math,Boolean,Object,JSON,isRestoringRef:{current:false},restoreStarterEvents,normalizeMixingBatches,normalizeTimingOverrides,normalizeSandwichSnapshot,sandwichFamilyForStyle,restoredBakeRoute,endRestore(){},setTimeout(){},localStorage:{setItem(key,value){storage[key]=value;}}};
 for(const name of new Set((handler+navigationHandler).match(/\bset[A-Z]\w*/g))) context[name]=value=>{state[name]=typeof value==='function'?value(0):value;};
 const time=Date.now()-14*86400000;
 context.event={id:'saved-bake',dough_snapshot:{yeastType,tab:'custom',recipeGenerated:true,modeChosen:true,eatTime:time,startTime:time-86400000,timingOverrides:{mix:time-86400000,feed:time-90000000},starterEvents:[{kind:'pre_mix',time:time-90000000,isPast:false}],lastFedTime:time-100000000,knownPeakTime:time-86400000,feed2Time:time-90000000,fridgeOutTime:time-87000000,starterFridgeInTime:time-95000000,lastFedAge:'today',planningMode:'know_peak',ovenType:'dutch_oven',mixerType:'hand',itemWeight:800,containerCapacityLitres:5,pizzaParty:{qtys:{}},activeTab:'guide'}};
 Object.assign(context.event.dough_snapshot,{starterTimingValid,bakeType:'bread',styleKey:yeastType==='sourdough'?'pain_levain':'baguette'});
 Object.assign(context.event.dough_snapshot,overrides);
 context.opts={rebake};
 const js=ts.transpileModule(navigationHandler+handler+'\nrestoreFromBakeEvent(event,opts)',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 await vm.runInNewContext(js,context);
 return {state,storage,snap:context.event.dough_snapshot};
}
test('sourdough rebake retains recipe and future bake date but requires fresh starter planning',async()=>{
 const {state,snap}=await restore('sourdough',true);
 assert.equal(state.setOvenType,snap.ovenType);assert.equal(state.setMixerType,snap.mixerType);assert.equal(state.setItemWeight,800);assert.equal(state.setContainerCapacityLitres,5);
 assert.ok(state.setEatTime.getTime()>Date.now());
 for(const name of ['LastFedTime','KnownPeakTime','HasNotFedYet','LastFedAge','FeedTime','Feed2Time','FridgeOutTime','StarterFridgeInTime','StarterPeakTime']) assert.equal(state['set'+name],null,name);
 assert.deepEqual(JSON.parse(JSON.stringify(state.setTimingOverrides)),{});
 assert.equal(state.setStarterEvents.length,0);assert.equal(state.setRecipeGenerated,false);assert.equal(state.setSessionRestored,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);assert.equal(state.setActiveTab,'setup');
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
 assert.equal(state.setRecipeGenerated,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);assert.equal(state.setScheduleCandidateValid,false);assert.equal(state.setActiveTab,'setup');
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
