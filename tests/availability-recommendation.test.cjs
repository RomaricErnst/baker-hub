const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('./load-production.cjs');
const {findFixedBakeSchedule,recommendPreferment}=require('../app/utils/scheduleEdit.ts');
const H=3600000,now=Date.parse('2026-10-03T15:25:00Z');
const original=new Date('2026-10-03T23:40:00Z'),bake=new Date('2026-10-04T20:31:00Z');
const night={from:new Date('2026-10-03T23:00:00Z'),to:new Date('2026-10-04T07:00:00Z'),label:'Saturday night'};
const source=fs.readFileSync('app/components/SchedulePicker.tsx','utf8');
const tree=ts.createSourceFile('SchedulePicker.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['applyAndUpdate','replanCurrentSchedule','commercialRecommendation'],declarations=[];
function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))declarations.push(n.getText(tree));ts.forEachChild(n,visit);}visit(tree);
function harness(overrides={}){
 const writes=[];
 class Clock extends Date{static now(){return now;}}
 const c={Date:Clock,isSourdough:false,eatTimeSet:true,startTimeInPast:false,hasPrefActive:true,
  pendingStart:original,pendingEatTime:bake,prefOffsetH:8,_optimalMix:(+bake-original)/H,
  prefermentType:'poolish',kitchenTemp:22,prefGoesInFridge:false,styleKey:'neapolitan',fridgeTemp:5,
  manualTimesRef:{current:overrides},solverNotifyBudgetRef:{current:{}},ratioApplyHistoryRef:{current:[]},
  draftOverridesRef:{current:{}},solverBlocksRef:{current:[]},resumeFrozenRef:{current:false},acceptedBakeRef:{current:0},
  findFixedBakeSchedule,recommendPreferment,getPrefOptH:()=>8,onChange:(start,bake,blocks,options)=>writes.push({start,bake,blocks,options})};
 c.setAlgoChoseFridge=()=>{};
 for(const name of ['MovedNote','BlockerNote','StarterPins','EditingRow','EditingEnabled','EditBaseTimes','LocalBlocks','SearchFailed','StartComputed','PrefAlgoRed','WindowTooShort'])c['set'+name]=()=>{};
 c.setPendingStart=v=>{c.pendingStart=v;};c.setPrefOffsetH=v=>{c.prefOffsetH=v;};
 c.commercialCandidateInput=(blocks,inFridge,start=c.pendingStart)=>({id:'mix',at:start,start,bake,now,prefHours:c.prefOffsetH,
  hasPreferment:true,prefWarmupHours:0,prefWindow:{min:7,max:10},supported:true,blocks,kitchenTemp:22,
  preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,
  window:()=>({from:original,to:new Date('2026-10-04T10:00:00Z')}),methodValid:()=>true});
 vm.createContext(c);vm.runInContext(ts.transpileModule(declarations.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,c);
 return {c,writes};
}
test('actual availability handler returns automatic poolish/mixing to recommendation after Nights off',()=>{
 const {c,writes}=harness();c.applyAndUpdate([night]);
 assert.notEqual(+c.pendingStart,+original);assert.equal(+writes.at(-1).bake,+bake);
 c.applyAndUpdate([]);assert.equal(+c.pendingStart,+original);assert.equal(c.prefOffsetH,8);
 assert.equal(+c.pendingStart-c.prefOffsetH*H,Date.parse('2026-10-03T15:40:00Z'));
 assert.equal(Object.keys(writes.at(-1).options.timingOverrides).length,0);
 c.applyAndUpdate([night]);c.applyAndUpdate([]);assert.equal(+c.pendingStart,+original);
});
test('availability recalculation preserves explicit mixing and locked poolish choices',()=>{
 const mix=Date.parse('2026-10-04T07:00:00Z'),pref=mix-8*H-15*60000;
 const overrides={mix,pref,prefLocked:true},{c,writes}=harness(overrides);
 c.pendingStart=new Date(mix);c.prefOffsetH=8.25;
 c.applyAndUpdate([night]);c.applyAndUpdate([]);
 assert.equal(+c.pendingStart,mix);assert.equal(+c.pendingStart-c.prefOffsetH*H,pref);
 assert.deepEqual(writes.at(-1).options.timingOverrides,overrides);
});
test('availability edits preserve already-started preparation',()=>{
 const {c,writes}=harness();c.pendingStart=new Date(now+H);c.prefOffsetH=8;
 c.applyAndUpdate([]);assert.equal(+c.pendingStart,now+H);assert.equal(writes.at(-1).options.preservePlan,true);
});
