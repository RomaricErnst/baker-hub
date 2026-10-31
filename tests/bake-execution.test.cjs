const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {normalizeBakeExecution,preparationStatus}=require('../app/utils/bakeExecution.ts');
const {validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
const H=3600000,now=Date.parse('2030-04-01T08:00Z');
const fact={method:'poolish',actualAt:now-H,recordedAt:now,inFridge:true,prefHours:12,recipe:{flour:1000,water:620,salt:25,totalDough:1645,preferment:{prefYeastGrams:.3}}};
test('elapsed planned time remains unknown until an explicit fact is recorded',()=>{
 assert.equal(preparationStatus(now-1,undefined,now),'unconfirmed');
 assert.equal(preparationStatus(now+1,undefined,now),'planned');
 assert.equal(preparationStatus(now-1,fact,now),'made');
});
test('actual preparation survives JSON roundtrip with the exact weighed yeast',()=>{
 assert.deepEqual(normalizeBakeExecution(JSON.parse(JSON.stringify(fact))),fact);
 for(const value of [undefined,{}, {...fact,actualAt:now+1},{...fact,recipe:{}}])assert.equal(normalizeBakeExecution(value),undefined);
});
test('only recorded preferment may be in the past; it cannot move during edits',()=>{
 const start=new Date(now+11*H),bake=new Date(+start+24*H);
 const input={id:'mix',at:start,start,bake,prefHours:12,hasPreferment:true,prefWarmupHours:0,supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,prefWindow:{min:12,max:12},window:()=>({from:new Date(+bake-40*H),to:new Date(+bake-8*H)}),methodValid:()=>true,now};
 assert.equal(validateScheduleCandidate(input).issue,'past');
 assert.equal(validateScheduleCandidate({...input,completedPrefermentAt:fact.actualAt}).valid,true);
 assert.equal(validateScheduleCandidate({...input,completedPrefermentAt:fact.actualAt},{start:new Date(+start+H),bake,prefHours:12}).valid,false);
 assert.equal(validateScheduleCandidate({...input,completedPrefermentAt:fact.actualAt},{start:new Date(+start+H),bake,prefHours:13}).valid,false,'cannot silently re-dose an already made preferment');
});

test('late starter feed confirmation survives restoration and does not re-ask the same planned action',()=>{
 const {normalizeStarterFeedRecords,overdueStarterFeed}=require('../app/utils/bakeExecution.ts');
 const feed={kind:'refresh',plannedAt:now-2*H,actualAt:now-H,recordedAt:now,ratio:2};
 const events=[{kind:'refresh',time:new Date(feed.plannedAt)},{kind:'pre_mix',time:new Date(now+H)}];
 assert.equal(overdueStarterFeed(events,[],now).kind,'refresh','a passed planned time is not evidence of feeding');
 const restored=normalizeStarterFeedRecords(JSON.parse(JSON.stringify([feed])));
 assert.equal(restored.length,1);
 assert.equal(restored[0].actualAt,now-H);
 assert.equal(overdueStarterFeed(events,restored,now),undefined,'same feed must not be asked again after a late confirmation');
 assert.equal(overdueStarterFeed(events,restored,now+2*H).kind,'pre_mix','a distinct later feed still requires actual confirmation');
 assert.deepEqual(normalizeStarterFeedRecords([{...feed,actualAt:now+H}]),[],'future feed cannot be recorded as completed');
});


test('one mixing completion survives session storage with its already-used recipe',()=>{
 const {normalizeMixExecution}=require('../app/utils/bakeExecution.ts');
 const {saveSession,loadSession}=require('../app/lib/session.ts');
 const mixed={actualAt:now-H,recordedAt:now,recipe:{flour:1000,water:620,salt:25,totalDough:1645,yeast:0.42}};
 const store=new Map();
 global.localStorage={setItem:(key,value)=>store.set(key,value),getItem:key=>store.get(key)??null,removeItem:key=>store.delete(key)};
 assert.equal(saveSession({bakeType:'pizza',startTime:mixed.actualAt,eatTime:now+12*H,mixExecution:mixed}),true);
 assert.deepEqual(loadSession().mixExecution,mixed,'reopening must retain the completed fact and weighed ingredients');
 assert.equal(normalizeMixExecution({...mixed,actualAt:now+1}),undefined);
 assert.equal(normalizeMixExecution({...mixed,recipe:{}}),undefined);
});

test('Guide Done uses the planned mixing time, or now if completed early, without another question',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8'),tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let handler;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='recordGuideMix')handler=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
 const code=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 for(const delta of [-H,H])for(const yeastType of ['instant','sourdough']){
  const calls=[],context={Date:class extends Date{static now(){return now;}},startTime:new Date(now+delta),mixExecution:undefined,execution:undefined,commercialMethod:'none',yeastType,markMixMade:at=>calls.push(['mix',at]),markPreparationMade:at=>calls.push(['direct',at])};
  vm.createContext(context);vm.runInContext(code,context);context.recordGuideMix(true);
  assert.deepEqual(calls,[[yeastType==='sourdough'?'mix':'direct',Math.min(now+delta,now)]]);
 }
 for(const method of ['poolish','biga']){
  const calls=[],plannedPreparationAt=now-13*H,mix=now-H;
  const context={Date:class extends Date{static now(){return now;}},startTime:new Date(mix),mixExecution:undefined,execution:undefined,commercialMethod:method,yeastType:'instant',recipe:fact.recipe,plannedPreparationAt,prefGoesInFridge:true,prefOffsetH:12,kitchenTemp:22,fridgeTemp:5,styleKey:'neapolitan',commercialPrefermentWindow:()=>({min:10,max:16}),markMixMade:(at,prepared)=>calls.push({at,prepared})};
  vm.createContext(context);vm.runInContext(code,context);context.recordGuideMix(true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].at,mix);
  assert.equal(calls[0].prepared.actualAt,plannedPreparationAt);
  assert.equal(calls[0].prepared.method,method);
  assert.equal(calls[0].prepared.recipe,fact.recipe);
 }

});
