// Poolish near its peak at the mix (owner's decision, 18 Nov 2026; round-4 retest, Thomas, Lyon 20 °C).
// The planner only uses levers the baker left to it: 1 the plan as found when its poolish peaks near the
// mix, 2 the fridge (storage 'auto'), 3 a later poolish start (time not set), 4 the rest of the same total
// yeast in the final dough. The poolish % is never changed.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {utils,data}=require('./load-production.cjs');
const {recommendPreferment}=require('../app/utils/scheduleEdit.ts');
const {recommendRipePoolish,ripenFixedPoolish}=require('../app/utils/poolishRipeness.ts');
const {mixingBatchPlan}=require('../app/utils/mixingBatches.ts');
const {recipeYeastTotal}=require('../app/utils/prefermentDose.ts');
function functions(path,names){const source=fs.readFileSync(path,'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),parts=[];function visit(n){if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))parts.push(n.getText(tree).replace(/^export /,''));ts.forEachChild(n,visit);}visit(tree);return vm.runInNewContext(ts.transpileModule(parts.join('\n')+';({'+names.join(',')+'})',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText);}
const {getPrefOptH}=functions('app/components/FermentChart.tsx',['getPrefOptH','getPrefPeakH_RT']);
const {prefZoneConstants,commercialPrefermentPlanValid}=functions('app/components/SchedulePicker.tsx',['prefZoneConstants','commercialPrefermentPlanValid']);
const H=3600000,d=s=>new Date(s+'Z');

test('the peak hours read back the peak dose the engine gives a window',()=>{
 for(const inFridge of [false,true])for(const temp of [18,20,24,28,30,33])for(const hours of inFridge?[6,10,16,24]:[2,4,8,12,16]){
  const r=data.computePrefermentRecipe('poolish',1000,650,temp,6,inFridge,25,'instant',hours);
  if(Math.abs(r.prefYeastGramsIDY/r.prefFlour*100-0.05)<1e-9)continue; // the 0.05 % floor holds the dose
  const peak=data.poolishPeakHours(r.prefYeastGramsIDY/r.prefFlour*100,inFridge,temp,6);
  assert.ok(Math.abs(peak-hours)<1e-6,`${inFridge?'fridge':'room'} ${temp}°C ${hours} h → ${peak}`);
  assert.equal(r.finalYeastGrams,undefined);
 }
});

test('usable after the peak: a third of the time to peak at room temperature (never below the planner\'s rtTolUpper), 12 h in the fridge',()=>{
 for(const temp of [16,18,22,24,26,28,29,30,32,35]){
  const floor=prefZoneConstants('poolish',false,temp).rtTolUpper;
  assert.equal(data.poolishPastPeakToleranceH(false,temp,0),floor);
  assert.equal(data.poolishPastPeakToleranceH(false,temp,12),Math.max(floor,4),'a 12 h poolish: usable to 16 h');
  assert.equal(data.poolishPastPeakToleranceH(true,temp,8),12);
 }
});

const nights=[19,20,21,22].map(day=>({label:'night',from:d(`2026-11-${day}T22:00`),to:d(`2026-11-${day+1}T06:00`)}));
const thomasPlan=()=>utils.buildSchedule(d('2026-11-21T17:15'),d('2026-11-22T09:00'),nights,20,45,'hand','baguette',2,1,false);
const thomas=(hours,inFridge=false,plan=thomasPlan())=>utils.calculateRecipe('baguette','home_oven_stone_bread',2,250,20,'normal',plan,6,'fresh','custom','hand',undefined,undefined,undefined,{flour1:'bread',flour2:null,ratio1:100},'poolish',null,20,undefined,undefined,false,undefined,inFridge,undefined,hours);

test('Thomas: an 11 h room-temperature poolish keeps its peak dose, the rest goes in the final dough',()=>{
 const r=thomas(11),pf=r.preferment;
 // Before (main): all 0.70 g fresh yeast in 58 g poolish flour, peaking about 4.5 h after it was made.
 assert.ok(Math.abs(data.poolishPeakHours(0.7000597757616932/3/58*100,false,20,6)-4.5)<0.1);
 assert.equal(pf.prefFlour,58);assert.equal(r.flour,288);assert.equal(r.totalDough,500);
 assert.ok(Math.abs(pf.prefYeastGrams-0.161)<0.001,`poolish ${pf.prefYeastGrams}`);
 assert.ok(Math.abs(pf.prefYeastGrams+pf.finalYeastGrams-0.7000597757616932)<1e-9,'the total stays the same');
 assert.ok(Math.abs(pf.finalYeastGrams-3*pf.finalYeastGramsIDY)<1e-12);
 assert.ok(Math.abs(data.poolishPeakHours(pf.prefYeastGramsIDY/pf.prefFlour*100,false,20,6)-11)<1e-6,'it now peaks at the mix');
 assert.equal(pf.cold,false);assert.equal(pf.fermentHoursMin,11);
 assert.ok(Math.abs(recipeYeastTotal(r)-0.7000597757616932)<1e-9);
 // The final dough's mixing batch carries the yeast line; the poolish weight is the poolish's own.
 const batch=mixingBatchPlan(r,'hand',1);
 assert.ok(Math.abs(batch.portion.yeast-pf.finalYeastGrams)<0.001);
 assert.ok(Math.abs(batch.portion.preferment-(pf.prefFlour+pf.prefWater+pf.prefYeastGrams))<0.001);
});

test('a poolish near its peak keeps all the yeast, with exactly the fields it had',()=>{
 const r=thomas(5),pf=r.preferment;
 assert.equal('finalYeastGrams' in pf,false);assert.equal('finalYeastGramsIDY' in pf,false);
 assert.deepEqual(Object.keys(pf),['prefFlour','prefWater','prefYeastGrams','prefYeastGramsIDY','prefYeastType','finalFlour','finalWater','fermentHoursMin','fermentHoursMax','cold','schedule','scheduleFr']);
 assert.equal(mixingBatchPlan(r,'hand',1).portion.yeast,0);
 // A fridge poolish of 10 h for the same dough still peaks within the fridge plateau.
 assert.equal(thomas(10,true).preferment.finalYeastGrams,undefined);
});

test('the poolish % is never changed by the split',()=>{
 for(const pct of [20,30,50])for(const hours of [6,11,14]){
  const plan=thomasPlan();
  const r=utils.calculateRecipe('baguette','home_oven_stone_bread',2,250,20,'normal',plan,6,'instant','custom','hand',undefined,undefined,undefined,undefined,'poolish',null,pct,undefined,undefined,false,undefined,false,undefined,hours);
  assert.equal(r.preferment.prefFlour,Math.round(r.flour*pct/100));
 }
});

// ── Planner levers on the real search (scheduleEdit), with the recipe's own test ──
function options(o){const {temp,start,bake,blocks=[],now}=o;return [true,false].map(inFridge=>{
 const opt=getPrefOptH('poolish',temp,inFridge,'baguette',6),zone=prefZoneConstants('poolish',inFridge,temp);
 return {inFridge,input:{id:'mix',at:start,start,bake,now,hasPreferment:true,prefHours:opt,
  prefWindow:{min:Math.max(inFridge?6:1,opt-(inFridge?zone.plateauLowH:zone.rtTol)),max:inFridge?24:Math.min(16,opt+zone.rtTolUpper)},
  prefWarmupHours:utils.requiredPrefWarmupH({prefermentType:'poolish',prefInFridge:inFridge,styleKey:'baguette',kitchenTemp:temp,fridgeTemp:6}),
  prefCooldownHours:utils.requiredPrefCooldownH({prefermentType:'poolish',prefInFridge:inFridge,styleKey:'baguette',kitchenTemp:temp,fridgeTemp:6}),
  supported:true,blocks,kitchenTemp:temp,preheatMin:45,mixerType:'hand',styleKey:'baguette',numItems:2,
  window:()=>({from:new Date(+start-H),to:new Date(+start+H)}),
  methodValid:times=>commercialPrefermentPlanValid({type:'poolish',inFridge,mixTime:times.start,bakeTime:bake,offsetHours:times.prefHours,blocks,now:new Date(now)})}};
});}
const peakAtMix=(schedule,hours,inFridge)=>thomas(hours,inFridge,schedule).preferment.finalYeastGrams===undefined;
const thomasOptions=()=>options({temp:20,start:d('2026-11-21T17:15'),bake:d('2026-11-22T09:00'),blocks:nights,now:+d('2026-11-20T18:00')});
const timesOf=c=>[+c.result.candidate.times.start,c.result.candidate.times.prefHours,c.inFridge];

test('storage auto: the fridge before anything else, inside its window, the bake unchanged',()=>{
 const room=thomasOptions().filter(o=>!o.inFridge),both=thomasOptions();
 const base=recommendPreferment(room,{});
 assert.equal(base.result.found,true);assert.equal(peakAtMix(base.result.candidate.schedule,base.result.candidate.times.prefHours,false),false,'room-temperature plan is past its peak');
 const chosen=recommendRipePoolish([...room,...both.filter(o=>o.inFridge)].sort((a,b)=>Number(b.inFridge)-Number(a.inFridge)),{},{},{peakAtMix,storage:'auto',timeSet:false});
 // Thomas (Sat 18:15 knead, Sun 10:00 bake, Paris): room temperature 11.25 h from 7:00 → fridge, same 7:00 and same knead.
 assert.equal(base.result.candidate.times.prefHours,11.25);
 assert.equal(chosen.lever,'fridge');assert.equal(chosen.inFridge,true);
 assert.equal(chosen.result.candidate.times.prefHours,11.25);
 assert.equal(+chosen.result.candidate.times.start,+base.result.candidate.times.start);
 assert.equal(peakAtMix(chosen.result.candidate.schedule,chosen.result.candidate.times.prefHours,chosen.inFridge),true);
 assert.ok(chosen.result.candidate.times.prefHours<=24);
 assert.equal(+chosen.result.candidate.times.bake,+d('2026-11-22T09:00'));
});

test('storage fixed to room: a later start within the window, else the plan stands (the recipe splits)',()=>{
 const room=thomasOptions().filter(o=>!o.inFridge);
 const base=recommendPreferment(room,{});
 const chosen=recommendRipePoolish(room,{},{},{peakAtMix,storage:'room',timeSet:false});
 assert.equal(chosen.inFridge,false,'never the fridge when the baker chose room');
 if(chosen.lever==='later'){
  assert.equal(+chosen.result.candidate.times.start,+base.result.candidate.times.start,'same mix');
  assert.ok(chosen.result.candidate.times.prefHours<base.result.candidate.times.prefHours);
  assert.ok(chosen.result.candidate.times.prefHours>=room[0].input.prefWindow.min);
 }else{
  assert.equal(chosen.lever,'split');assert.deepEqual(timesOf(chosen),timesOf(base));
 }
});

test('a set poolish time and a fixed storage are never moved',()=>{
 const room=thomasOptions().filter(o=>!o.inFridge);
 const pref=d('2026-11-21T06:15');
 const base=recommendPreferment(room,{preferment:pref});
 const chosen=recommendRipePoolish(room,{preferment:pref},{},{peakAtMix,storage:'room',timeSet:true});
 assert.equal(chosen.lever,'split');assert.deepEqual(timesOf(chosen),timesOf(base));
 assert.equal(+chosen.result.candidate.times.start-chosen.result.candidate.times.prefHours*H,+pref);
 const fridge=thomasOptions().filter(o=>o.inFridge);
 const cold=recommendRipePoolish(fridge,{},{},{peakAtMix,storage:'fridge',timeSet:false});
 // A fridge poolish of the engine's own window holds well past its peak: nothing to change.
 assert.equal(cold.inFridge,true);assert.equal(cold.lever,'none');
 // With the time set, a fridge poolish keeps it: the recipe splits instead.
 const fixed=recommendRipePoolish(fridge,{preferment:pref},{},{peakAtMix,storage:'fridge',timeSet:true});
 assert.ok(fixed.lever==='split'||fixed.lever==='none');
 assert.equal(+fixed.result.candidate.times.start-fixed.result.candidate.times.prefHours*H,+pref);
});

test('a plan whose poolish peaks near the mix is returned exactly as found',()=>{
 for(const temp of [24,28,32]){
  const opts=options({temp,start:d('2026-11-21T17:15'),bake:d('2026-11-22T09:00'),now:+d('2026-11-20T18:00')});
  const base=recommendPreferment(opts,{});
  const always=recommendRipePoolish(opts,{},{},{peakAtMix:()=>true,storage:'auto',timeSet:false});
  assert.equal(always.lever,'none');assert.deepEqual(timesOf(always),timesOf(base));
  assert.deepEqual(always.result.candidate.times,base.result.candidate.times);
 }
 const room=thomasOptions().filter(o=>!o.inFridge)[0];
 const kept=ripenFixedPoolish(room.input,false,{},{peakAtMix:()=>true,storage:'room',timeSet:false,optionFor:()=>room.input});
 assert.equal(kept.lever,'none');
});
