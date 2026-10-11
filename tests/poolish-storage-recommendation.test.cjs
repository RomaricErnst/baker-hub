const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {utils}=require('./load-production.cjs');
const {recommendPreferment,validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
function functions(path,names){const source=fs.readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),parts=[];function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))parts.push(n.getText(tree).replace(/^export /,''));ts.forEachChild(n,visit);}visit(tree);return vm.runInNewContext(ts.transpileModule(parts.join('\n')+';({'+names.join(',')+'})',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText);}
const {getPrefOptH}=functions('app/components/FermentChart.tsx',['getPrefOptH','getPrefPeakH_RT']);
const {prefZoneConstants,commercialPrefermentPlanValid}=functions('app/components/SchedulePicker.tsx',['prefZoneConstants','commercialPrefermentPlanValid']);
const H=3600000,now=Date.parse('2026-10-03T15:25Z'),start=new Date('2026-10-04T07:00Z'),bake=new Date('2026-10-04T20:31Z');
const blocks=[{from:new Date('2026-10-03T23:00Z'),to:start,label:'Night'}];
function options(temp,fridge=5){return [true,false].map(inFridge=>{
 const opt=getPrefOptH('poolish',temp,inFridge,'neapolitan',fridge),zone=prefZoneConstants('poolish',inFridge,temp);
 return {inFridge,input:{id:'mix',at:start,start,bake,now,hasPreferment:true,prefHours:opt,
  prefWindow:{min:Math.max(inFridge?3:1,opt-(inFridge?zone.plateauLowH:zone.rtTol)),max:Math.min(inFridge?24:16,opt+(inFridge?zone.plateauH:zone.rtTolUpper))},
  prefWarmupHours:utils.requiredPrefWarmupH({prefermentType:'poolish',prefInFridge:inFridge,styleKey:'neapolitan',kitchenTemp:temp,fridgeTemp:fridge}),
  supported:true,blocks,kitchenTemp:temp,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,
  window:()=>({from:start,to:new Date(+start+2*H)}),
  methodValid:times=>commercialPrefermentPlanValid({type:'poolish',inFridge,mixTime:times.start,bakeTime:bake,offsetHours:times.prefHours,blocks,now:new Date(now)})}};
 });}
test('cool and hot kitchens compare refrigerated afternoon poolish against late room-temperature preparation',()=>{
 for(const temp of [22,28,32])for(const fridge of [5,6]){
  const choices=options(temp,fridge),chosen=recommendPreferment(choices,{mix:start});
  assert.equal(chosen.result.found,true);assert.equal(chosen.inFridge,true);
  const times=chosen.result.candidate.times;
  assert.equal(+times.start,+start);assert.equal(+times.bake,+bake);
  assert.equal(times.prefHours,getPrefOptH('poolish',temp,true,'neapolitan',fridge));
  assert.ok(+times.start-times.prefHours*H<Date.parse('2026-10-03T22:45Z'));
  assert.equal(validateScheduleCandidate(chosen.input,times).valid,true);
 }
});
test('required cold-out inside a night remains invalid even when poolish and mixing are clear',()=>{
 const cold=options(22)[0];cold.input.prefWarmupHours=1;cold.input.window=()=>({from:start,to:start});
 const result=recommendPreferment([cold],{mix:start});assert.equal(result.result.found,false);
});
test('explicit preparation and mixing pins cannot be moved to achieve the preferred duration',()=>{
 const cold=options(22)[0],pref=new Date('2026-10-03T15:40Z');
 const chosen=recommendPreferment([cold],{mix:start,preferment:pref});
 assert.equal(chosen.result.found,true);assert.equal(+chosen.result.candidate.times.start,+start);
 assert.equal(+chosen.result.candidate.times.start-chosen.result.candidate.times.prefHours*H,+pref);
});
