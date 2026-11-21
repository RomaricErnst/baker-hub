// Poolish near its peak at the mix (owner's decision, 18 Nov 2026; round-4 retest, Thomas, Lyon 20 °C).
// Yeast model (19 Nov 2026): the poolish holds the peak dose of its own window and the final dough its own
// yeast, so a poolish dosed for its window is at its peak by construction; the levers below stay as the
// safety net for a dose held at the product floor (1 the plan as found, 2 the fridge with storage 'auto',
// 3 a later poolish start when its time is not set, 4 the plan stands). The poolish % is never changed.
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
  if(Math.abs(r.prefYeastGramsIDY/r.prefFlour*100-1.5)<1e-9)continue; // the 1.5 % ceiling holds the dose
  const peak=data.poolishPeakHours(r.prefYeastGramsIDY/r.prefFlour*100,inFridge,temp,6,{massG:r.prefFlour+r.prefWater});
  assert.ok(Math.abs(peak-hours)<1e-6,`${inFridge?'fridge':'room'} ${temp}°C ${hours} h → ${peak}`);
  assert.equal(r.finalYeastGrams,undefined,'no final-dough yeast without the dough\'s own need');
  assert.equal(r.pastPeak,undefined);
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

test('Thomas: an 11 h room-temperature poolish holds its own peak dose, the final dough its own yeast',()=>{
 const r=thomas(11),pf=r.preferment;
 // Before (main, #137): 0.161 g fresh in the poolish and 0.539 g in the final dough (0.70 g, the leavening
 // top-up's total). Yeast model: the poolish dose of an 11 h poolish at 20 °C, the final dough the direct need
 // of the dough's own path (Modernist's poolish doughs add about that much).
 assert.equal(pf.prefFlour,57);assert.equal(r.flour,287);
 assert.ok(Math.abs(pf.prefYeastGrams-0.1647)<0.001,`poolish ${pf.prefYeastGrams}`);   // Phase 2 0.2116 (M_p 0.83 → 0.70, 20 Nov 2026)
 assert.ok(Math.abs(pf.finalYeastGrams-r.yeast.convertedGrams)<0.002,'final dough = the direct need of its path');   // convertedGrams is rounded to 0.001 g on its own
 assert.ok(Math.abs(pf.finalYeastGrams-2.043)<0.01,`final ${pf.finalYeastGrams}`);   // round 8 (flour, 21 Nov 2026): no second ÷ 0.9 for the bread flour at a fixed plan, 2.271 → 2.043;   // Phase 2 2.589; Phase 3 2.211; round 7 (D4): out at 6:15Z, not 6:00Z (baguette apprêt ≤ 2 h at 20 °C), a shorter warm tail
 assert.ok(Math.abs(pf.finalYeastGrams-3*pf.finalYeastGramsIDY)<1e-12);
 assert.ok(Math.abs(data.poolishPeakHours(pf.prefYeastGramsIDY/pf.prefFlour*100,false,20,6,{massG:pf.prefFlour+pf.prefWater})-11)<1e-6,'it peaks at the mix');
 assert.equal(pf.pastPeak,undefined);
 assert.equal(pf.cold,false);assert.equal(pf.fermentHoursMin,11);
 assert.ok(Math.abs(recipeYeastTotal(r)-(pf.prefYeastGrams+pf.finalYeastGrams))<1e-9);
 // The final dough's mixing batch carries the yeast line; the poolish weight is the poolish's own.
 const batch=mixingBatchPlan(r,'hand',1);
 assert.ok(Math.abs(batch.portion.yeast-pf.finalYeastGrams)<0.001);
 assert.ok(Math.abs(batch.portion.preferment-(pf.prefFlour+pf.prefWater+pf.prefYeastGrams))<0.001);
});

test('a poolish near its peak carries no past-peak flag, with the fields it had plus the final dough\'s yeast',()=>{
 const r=thomas(5),pf=r.preferment;
 assert.equal('pastPeak' in pf,false);
 assert.deepEqual(Object.keys(pf),['prefFlour','prefWater','prefYeastGrams','prefYeastGramsIDY','prefYeastType','finalFlour','finalWater','fermentHoursMin','fermentHoursMax','cold','schedule','scheduleFr','finalYeastGrams','finalYeastGramsIDY']);
 assert.ok(mixingBatchPlan(r,'hand',1).portion.yeast>0);
 // A fridge poolish of 10 h for the same dough peaks at the mix too.
 assert.equal(thomas(10,true).preferment.pastPeak,undefined);
 // A poolish held at the 0.05 % floor and kept well past its window is past its peak (the levers act).
 const held=data.computePrefermentRecipe('poolish',1000,650,30,6,false,20,'instant',40);
 assert.equal(held.prefYeastGramsIDY/held.prefFlour*100,0.05);assert.equal(held.pastPeak,true);
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
// The recipe's own test (page.tsx poolishPeakAtMix): a poolish dosed for its window peaks at the mix.
const recipePeakAtMix=(schedule,hours,inFridge)=>!thomas(hours,inFridge,schedule).preferment.pastPeak;
// The ladder's mechanics, exercised with a stand-in judgement (the real recipe no longer trips it on these
// plans): a room-temperature poolish longer than 8 h counts as past its peak.
const peakAtMix=(schedule,hours,inFridge)=>inFridge||hours<=8;
const thomasOptions=()=>options({temp:20,start:d('2026-11-21T17:15'),bake:d('2026-11-22T09:00'),blocks:nights,now:+d('2026-11-20T18:00')});
const timesOf=c=>[+c.result.candidate.times.start,c.result.candidate.times.prefHours,c.inFridge];

test('Thomas\'s own plan: the recipe\'s poolish peaks at the mix, so the plan is returned as found',()=>{
 const room=thomasOptions().filter(o=>!o.inFridge);
 const base=recommendPreferment(room,{});
 assert.equal(recipePeakAtMix(base.result.candidate.schedule,base.result.candidate.times.prefHours,false),true);
 const chosen=recommendRipePoolish(room,{},{},{peakAtMix:recipePeakAtMix,storage:'auto',timeSet:false});
 assert.equal(chosen.lever,'none');assert.deepEqual(timesOf(chosen),timesOf(base));
});

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
