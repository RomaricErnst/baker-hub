const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
require('./load-production.cjs');
const {restoreStarterEvents,normalizeMixingBatches}=require('../app/lib/session.ts');
const {normalizeSandwichSnapshot,sandwichFamilyForStyle}=require('../app/lib/sandwich.ts');
const {restoredBakeRoute}=require('../app/lib/bakeNavigation.ts');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/[locale]/page.tsx'),'utf8');
// Execute the actual page restoration handler with state setters captured.
const handler=source.slice(source.indexOf('  async function restoreFromBakeEvent('),source.indexOf('  // ── Computed: Generate button'));
async function restore(yeastType,rebake,starterTimingValid) {
 const state={};
 const navigationHandler=source.slice(source.indexOf('  function restoreNavigation('),source.indexOf('  // Both advance functions'));
 const context={Date,Math,Boolean,Object,JSON,isRestoringRef:{current:false},restoreStarterEvents,normalizeMixingBatches,normalizeSandwichSnapshot,sandwichFamilyForStyle,restoredBakeRoute,endRestore(){},setTimeout(){},localStorage:{setItem(){}}};
 for(const name of new Set((handler+navigationHandler).match(/\bset[A-Z]\w*/g))) context[name]=value=>{state[name]=typeof value==='function'?value(0):value;};
 const time=Date.now()-14*86400000;
 context.event={id:'saved-bake',dough_snapshot:{yeastType,tab:'custom',recipeGenerated:true,modeChosen:true,eatTime:time,startTime:time-86400000,starterEvents:[{kind:'pre_mix',time:time-90000000,isPast:false}],lastFedTime:time-100000000,knownPeakTime:time-86400000,feed2Time:time-90000000,fridgeOutTime:time-87000000,starterFridgeInTime:time-95000000,lastFedAge:'today',planningMode:'know_peak',ovenType:'dutch_oven',mixerType:'hand',itemWeight:800,containerCapacityLitres:5,pizzaParty:{qtys:{}},activeTab:'guide'}};
 Object.assign(context.event.dough_snapshot,{starterTimingValid,bakeType:'bread',styleKey:yeastType==='sourdough'?'pain_levain':'baguette'});
 context.opts={rebake};
 const js=ts.transpileModule(navigationHandler+handler+'\nrestoreFromBakeEvent(event,opts)',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 await vm.runInNewContext(js,context);
 return {state,snap:context.event.dough_snapshot};
}
test('sourdough rebake retains recipe and future bake date but requires fresh starter planning',async()=>{
 const {state,snap}=await restore('sourdough',true);
 assert.equal(state.setOvenType,snap.ovenType);assert.equal(state.setMixerType,snap.mixerType);assert.equal(state.setItemWeight,800);assert.equal(state.setContainerCapacityLitres,5);
 assert.ok(state.setEatTime.getTime()>Date.now());
 for(const name of ['LastFedTime','KnownPeakTime','HasNotFedYet','LastFedAge','FeedTime','Feed2Time','FridgeOutTime','StarterFridgeInTime','StarterPeakTime']) assert.equal(state['set'+name],null,name);
 assert.equal(state.setStarterEvents.length,0);assert.equal(state.setRecipeGenerated,false);assert.equal(state.setSessionRestored,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);assert.equal(state.setActiveTab,'setup');
});
test('normal sourdough resume preserves saved actions and generated guide',async()=>{
 const {state,snap}=await restore('sourdough',false);
 assert.equal(state.setStarterEvents[0].time.getTime(),snap.starterEvents[0].time);
 assert.equal(state.setLastFedTime.getTime(),snap.lastFedTime);assert.equal(state.setKnownPeakTime.getTime(),snap.knownPeakTime);
 assert.equal(state.setContainerCapacityLitres,5);assert.equal(state.setRecipeGenerated,true);assert.equal(state.setSessionRestored,true);assert.equal(state.setActiveTab,'guide');
});
test('commercial yeast rebake retains existing generated recipe behaviour',async()=>{
 const {state}=await restore('instant',true);
 assert.equal(state.setRecipeGenerated,true);assert.equal(state.setShowResults,true);assert.equal(state.setActiveTab,'setup');
});

test('cloud snapshot preserves a known starter timing blocker; legacy snapshot defaults valid',async()=>{
 for(const value of [false,true,undefined]) {
  const {state}=await restore('sourdough',false,value);
  assert.equal(state.setStarterTimingValid,value!==false);
 }
});
