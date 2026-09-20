const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
require('./load-production.cjs');
const {restoreStarterEvents,normalizeMixingBatches}=require('../app/lib/session.ts');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/[locale]/page.tsx'),'utf8');
// Execute the actual page restoration handler with state setters captured.
const handler=source.slice(source.indexOf('  async function restoreFromBakeEvent('),source.indexOf('  // ── Computed: Generate button'));
async function restore(yeastType,rebake) {
 const state={};
 const context={Date,Math,Boolean,Object,JSON,isRestoringRef:{current:false},restoreStarterEvents,normalizeMixingBatches,endRestore(){},setTimeout(){},localStorage:{setItem(){}}};
 for(const name of new Set(handler.match(/\bset[A-Z]\w*/g))) context[name]=value=>{state[name]=typeof value==='function'?value(0):value;};
 const time=Date.now()-14*86400000;
 context.event={id:'saved-bake',dough_snapshot:{yeastType,tab:'custom',recipeGenerated:true,modeChosen:true,eatTime:time,startTime:time-86400000,starterEvents:[{kind:'pre_mix',time:time-90000000,isPast:false}],lastFedTime:time-100000000,knownPeakTime:time-86400000,feed2Time:time-90000000,fridgeOutTime:time-87000000,starterFridgeInTime:time-95000000,lastFedAge:'today',planningMode:'know_peak',ovenType:'dutch_oven',mixerType:'hand',itemWeight:800,pizzaParty:{qtys:{}},activeTab:'guide'}};
 context.opts={rebake};
 const js=ts.transpileModule(handler+'\nrestoreFromBakeEvent(event,opts)',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 await vm.runInNewContext(js,context);
 return {state,snap:context.event.dough_snapshot};
}
test('sourdough rebake retains recipe and future bake date but requires fresh starter planning',async()=>{
 const {state,snap}=await restore('sourdough',true);
 assert.equal(state.setOvenType,snap.ovenType);assert.equal(state.setMixerType,snap.mixerType);assert.equal(state.setItemWeight,800);
 assert.ok(state.setEatTime.getTime()>Date.now());
 for(const name of ['LastFedTime','KnownPeakTime','HasNotFedYet','LastFedAge','FeedTime','Feed2Time','FridgeOutTime','StarterFridgeInTime','StarterPeakTime']) assert.equal(state['set'+name],null,name);
 assert.equal(state.setStarterEvents.length,0);assert.equal(state.setRecipeGenerated,false);assert.equal(state.setSessionRestored,false);assert.equal(state.setShowResults,false);assert.equal(state.setAdvancedStep,9);assert.equal(state.setActiveTab,'setup');
});
test('normal sourdough resume preserves saved actions and generated guide',async()=>{
 const {state,snap}=await restore('sourdough',false);
 assert.equal(state.setStarterEvents[0].time.getTime(),snap.starterEvents[0].time);
 assert.equal(state.setLastFedTime.getTime(),snap.lastFedTime);assert.equal(state.setKnownPeakTime.getTime(),snap.knownPeakTime);
 assert.equal(state.setRecipeGenerated,true);assert.equal(state.setSessionRestored,true);assert.equal(state.setActiveTab,'guide');
});
test('commercial yeast rebake retains existing generated recipe behaviour',async()=>{
 const {state}=await restore('instant',true);
 assert.equal(state.setRecipeGenerated,true);assert.equal(state.setShowResults,true);assert.equal(state.setActiveTab,'setup');
});
