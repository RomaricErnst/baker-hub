// A baker-entered poolish/biga yeast (20 Nov 2026 round 7): the preferment's yeast as IDY % of ITS flour
// re-times the preferment window through the yeast model read backwards (medium M); the final dough's
// entered yeast re-times the mix-to-bake like a direct dough. Entered amount -> timing -> same amount.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const {utils,data}=require('./load-production.cjs');
const py=require('../app/utils/prefermentYeast.ts');
const H=3600000,bake=new Date('2026-12-05T19:00:00Z');

// The forward dose the engine gives a window, and its inputs, for one case.
function forward(type,inFridge,T,hours,cond={}){
 const flour=1000,water=650,pct=type==='biga'?40:25;
 const r=data.computePrefermentRecipe(type,flour,water,T,6,inFridge,pct,'instant',hours,undefined,inFridge?{warmupH:cond.warmupH??0}:{cooldownH:cond.cooldownH??0});
 return {r,dose:r.prefYeastGramsIDY/r.prefFlour*100,ctx:{kitchenTemp:T,fridgeTemp:6,massG:r.prefFlour+r.prefWater,...(inFridge?{warmupH:cond.warmupH??0}:{cooldownH:cond.cooldownH??0})}};
}

test('the window read back from a dose is the window that dosed it (poolish room/fridge, biga)',()=>{
 const cases=[['poolish',false,[18,20,22,24],[6,8,10,12,14]],['poolish',true,[20,24,28],[12,16,20,24]],['biga',true,[18,22,26,30],[12,18,24,48,72]]];
 let checked=0;
 for(const [type,inFridge,temps,windows] of cases)for(const T of temps)for(const h of windows){
  const {dose,ctx}=forward(type,inFridge,T,h,inFridge&&type==='poolish'?{warmupH:1.5}:{});
  if(dose<=0.0500001||dose>=1.4999999)continue; // held at the product floor or ceiling: no inverse
  const back=py.prefermentHoursForYeast(type,dose,inFridge,ctx);
  assert.ok(Math.abs(back-h)<0.01,`${type} ${inFridge?'fridge':'room'} ${T} °C ${h} h -> ${dose.toFixed(4)} % -> ${back.toFixed(3)} h`);
  checked++;
 }
 assert.ok(checked>=25,`${checked} cases`);
});

test('entered amount -> timing -> the recipe shows the same amount on that window',()=>{
 for(const [type,inFridge,T,pct] of [['poolish',false,20,0.1],['poolish',true,22,0.3],['biga',true,20,0.5],['biga',true,24,0.5]]){
  const ctx={kitchenTemp:T,fridgeTemp:6,massG:type==='biga'?560:500,...(inFridge?{warmupH:type==='poolish'?1.5:0}:{cooldownH:0})};
  const timing=py.prefermentYeastTiming(type,pct,inFridge,ctx);
  assert.ok(timing,`${type} ${pct} % at ${T} °C has a window`);
  const b=py.prefermentYeastBounds(type,inFridge);
  assert.ok(timing.hours>=b.min&&timing.hours<=b.max&&timing.min<=timing.hours&&timing.hours<=timing.max);
  // The engine's own dose for that window is the entered one (within the quarter-hour rounding).
  const r=data.computePrefermentRecipe(type,1000,650,T,6,inFridge,type==='biga'?40:25,'instant',timing.hours,undefined,inFridge?{warmupH:ctx.warmupH}:{cooldownH:0});
  const dose=r.prefYeastGramsIDY/r.prefFlour*100;
  assert.ok(Math.abs(dose/pct-1)<0.05,`${type} ${pct} %: window ${timing.hours} h doses ${dose.toFixed(4)} %`);
  // And the entered amount is what the recipe shows, unchanged.
  const shown=data.computePrefermentRecipe(type,1000,650,T,6,inFridge,type==='biga'?40:25,'instant',timing.hours,undefined,inFridge?{warmupH:ctx.warmupH}:{cooldownH:0},pct);
  assert.ok(Math.abs(shown.prefYeastGramsIDY-shown.prefFlour*pct/100)<1e-9);
  assert.ok(!shown.pastPeak,'timed to peak at the mix');
 }
});

test('the owner examples: poolish 0.1 % at 20 °C fits a room-temperature night; biga 1 % ripens too fast for a fridge biga',()=>{
 const poolish=py.choosePrefermentYeastTiming('poolish',0.1,[false,true],{kitchenTemp:20,fridgeTemp:6,massG:500});
 assert.ok(poolish.fits&&!poolish.timing.inFridge&&poolish.timing.hours>10&&poolish.timing.hours<11.5,JSON.stringify(poolish));
 // The model (M 1.55) peaks 1 % IDY in a 6 °C fridge in about 8 h, under the biga's 12 h: not applied, said why.
 const biga=py.choosePrefermentYeastTiming('biga',1,[true],{kitchenTemp:20,fridgeTemp:6,massG:560});
 assert.ok(!biga.fits&&biga.reason==='window'&&biga.hours>6&&biga.hours<10,JSON.stringify(biga));
 // 0.5 % (about what the engine itself gives a 24 h biga) takes about 23 h.
 const half=py.choosePrefermentYeastTiming('biga',0.5,[true],{kitchenTemp:20,fridgeTemp:6,massG:560});
 assert.ok(half.fits&&half.timing.hours>20&&half.timing.hours<26,JSON.stringify(half));
});

test('more preferment yeast, a shorter preferment; outside the bounds it does not fit, and says why',()=>{
 const ctx={kitchenTemp:22,fridgeTemp:6,massG:500};
 assert.ok(py.prefermentHoursForYeast('poolish',0.2,false,ctx)<py.prefermentHoursForYeast('poolish',0.1,false,ctx));
 const tooFast=py.choosePrefermentYeastTiming('poolish',1.5,[false],ctx);
 assert.equal(tooFast.fits,false);assert.equal(tooFast.reason,'window');assert.ok(tooFast.hours<6);
 const tooSlow=py.choosePrefermentYeastTiming('biga',0.02,[true],{...ctx,massG:560});
 assert.equal(tooSlow.fits,false);assert.equal(tooSlow.reason,'window');
 // A window that holds the amount but not before the mix: the time is the reason.
 const late=py.choosePrefermentYeastTiming('poolish',0.1,[false],ctx,2);
 assert.equal(late.fits,false);assert.equal(late.reason,'time');
 // Storage: a fixed storage is the only one; auto tries the planner's first, a biga is always cold.
 assert.deepEqual(py.prefermentYeastStorages('poolish','room',true),[false]);
 assert.deepEqual(py.prefermentYeastStorages('poolish','auto',true),[true,false]);
 assert.deepEqual(py.prefermentYeastStorages('poolish','auto',false),[false,true]);
 assert.deepEqual(py.prefermentYeastStorages('biga','room',false),[true]);
 assert.deepEqual(py.prefermentYeastBounds('poolish',false),{min:6,max:14});
 assert.deepEqual(py.prefermentYeastBounds('poolish',true),{min:12,max:24});
 assert.deepEqual(py.prefermentYeastBounds('biga',true),{min:12,max:72});
});

const recipe=(hours,prefHours,o={})=>utils.calculateRecipe('neapolitan','home_oven_standard',4,260,o.T??22,'normal',
 utils.buildSchedule(new Date(+bake-hours*H),bake,[],o.T??22,45,'hand','neapolitan',4,1,false),6,'instant','custom','hand',
 undefined,undefined,undefined,undefined,o.type??'poolish',undefined,25,undefined,undefined,undefined,undefined,o.inFridge??false,undefined,prefHours,undefined,undefined,undefined,o.final,undefined,o.pref);

test('calculateRecipe shows both entered amounts; blanks stay calculated',()=>{
 const auto=recipe(24,10);
 const pref=recipe(24,10,{pref:0.08});
 assert.ok(Math.abs(pref.preferment.prefYeastGramsIDY-pref.preferment.prefFlour*0.08/100)<1e-9);
 assert.ok(Math.abs(pref.yeast.pct-auto.yeast.pct)<1e-9,'the final dough stays calculated');
 const final=recipe(24,10,{final:0.12});
 assert.equal(final.yeast.pct,0.12);
 assert.ok(Math.abs(final.preferment.finalYeastGramsIDY-final.yeast.grams)<1e-9,'the final dough carries the entered amount');
 assert.ok(Math.abs(final.preferment.prefYeastGramsIDY-auto.preferment.prefYeastGramsIDY)<1e-9,'the preferment stays calculated');
});

test('the final dough of a poolish: entered amount -> mix-to-bake -> the same amount (as a direct dough)',()=>{
 const ctx={bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,itemWeight:260,mixingBatches:1,fridgeTemp:6,hydration:65};
 // The budget is not monotone across the room/cold switch: the picker reads the window nearest the plan (nearH / maxH).
 for(const [hours,near] of [[24,undefined],[36,36]]){
  const auto=recipe(hours,10).yeast.pct;
  const timed=utils.fermentationHoursForYeast(auto,near===undefined?ctx:{...ctx,nearH:near});
  assert.ok(Math.abs(timed-hours)<=0.5,`${hours} h -> ${auto} % -> ${timed} h`);
  const shown=recipe(timed,10,{final:auto});
  assert.equal(shown.yeast.pct,auto);
  assert.ok(!shown.yeast.warnings.some(w=>w.key==='fermentationBudget'),'within budget on the re-timed plan');
 }
});

test('the page and the planner use one helper; the picker times the preferment by the entered amount',()=>{
 const page=fs.readFileSync('app/[locale]/page.tsx','utf8'),picker=fs.readFileSync('app/components/SchedulePicker.tsx','utf8');
 assert.match(page,/prefYeastPctOverride=\{effectivePrefYeastOverride\}/);
 assert.match(page,/const effectivePrefYeastOverride = enteredPrefYeast && prefYeastFit\(/);
 assert.match(picker,/function prefTargetH\(method:string,inFridge:boolean\)\{\n\s*return prefYeastTimingFor\(method,inFridge\)\?\.hours\?\?getPrefOptH/);
 // Every planner seed of the preferment window goes through prefTargetH (no direct optimum left in the component).
 const component=picker.slice(picker.indexOf('function FermentedSchedulePicker('));
 assert.doesNotMatch(component.replace(/return prefYeastTimingFor\(method,inFridge\)\?\.hours\?\?getPrefOptH\(method,kitchenTemp,inFridge,styleKey,fridgeTemp\)/,''),/prefHours:getPrefOptH|prefHours=[^;]*getPrefOptH/);
});
