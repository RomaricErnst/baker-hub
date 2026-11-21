// Biga storage (21 Nov 2026 round 8, owner decision D1): a biga ripens in the fridge (24–58 h, aimed at 48)
// or in a cool spot at about 18 °C (Giorilli's classic biga, 12–20 h, aimed at 16), dosed by the same yeast
// model with the biga medium on that temperature path. 'auto' keeps the fridge and uses the cool spot only
// when no fridge plan fits, in a kitchen at 20 °C or cooler. Bugs 4 and 5 (round 7 findings).
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(r,...x){return resolve.call(this,r.startsWith('@/')?path.join(__dirname,'..',r.slice(2)):r,...x);};
const compile=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:f}).outputText,f);
require.extensions['.ts']=compile;require.extensions['.tsx']=compile;
const data=require('../app/data.ts'),ym=require('../app/utils/yeastModel.ts'),py=require('../app/utils/prefermentYeast.ts');
const sp=require('../app/components/SchedulePicker.tsx');
const H=3600000;
const dose=(r)=>r.prefYeastGramsIDY/r.prefFlour*100;

test('cool-spot biga: the yeast model with the biga medium at 18 °C (the kitchen when cooler), 12–20 h aimed at 16',()=>{
  const at=(T,h,inFridge=false)=>data.computePrefermentRecipe('biga',1000,650,T,6,inFridge,40,'instant',h);
  // 16 h at 18 °C: 0.17 % of the biga flour (docs/YEAST-MODEL.md: the model's Giorilli check, sources 0.10–0.33 %).
  const r=at(18,16);a.equal(r.cold,false);
  const expected=ym.doseForHeq(data.prefermentPath(16,false,18,6,r.prefFlour+r.prefWater,45).heq,'biga');
  a.ok(Math.abs(dose(r)-expected)<1e-9);a.ok(dose(r)>0.15&&dose(r)<0.19,String(dose(r)));
  // A warmer kitchen keeps its cool spot at 18 °C; a cooler one is the cool spot.
  a.equal(dose(at(24,16)),dose(r));a.ok(dose(at(16,16))>dose(r));
  // Window: default 16 h, held to 12–20 h.
  a.equal(data.computePrefermentRecipe('biga',1000,650,18,6,false,40).fermentHoursMin,16);
  a.equal(at(18,30).fermentHoursMin,20);a.equal(at(18,6).fermentHoursMin,12);
  a.match(r.schedule,/cool spot at about 18°C/);a.match(r.scheduleFr,/endroit frais, vers 18°C/);
  // More time, less yeast.
  a.ok(dose(at(18,12))>dose(at(18,16))&&dose(at(18,16))>dose(at(18,20)));
});

test('fridge biga: unchanged doses inside its window, which is now one window everywhere (24–58 h)',()=>{
  for(const T of [16,20,24,28])for(const h of [24,30,48,58]){
    const r=data.computePrefermentRecipe('biga',1000,650,T,6,true,40,'instant',h);
    const want=Math.min(1.5,Math.max(0.05,ym.doseForHeq(data.prefermentPath(h,true,T,6,r.prefFlour+r.prefWater,45).heq,'biga')));
    a.ok(Math.abs(dose(r)-want)<1e-12,`${T} °C ${h} h`);a.equal(r.cold,true);
  }
  // No storage given: a biga is in the fridge, as before.
  a.equal(data.computePrefermentRecipe('biga',1000,650,20,6,undefined,40).cold,true);
  a.equal(data.computePrefermentRecipe('biga',1000,650,20,6,undefined,40).fermentHoursMin,48);
  a.deepEqual(sp.commercialPrefermentWindow('biga',true,22,'neapolitan',6),{min:24,max:58});
  a.deepEqual(sp.commercialPrefermentWindow('biga',false,18,'neapolitan',6),{min:12,max:20});
});

test('storage choice: offered in a kitchen ≤ 20 °C or when chosen; the entered yeast reads the chosen path',()=>{
  a.equal(data.bigaCoolOffered('auto',20),true);a.equal(data.bigaCoolOffered('auto',21),false);
  a.equal(data.bigaCoolOffered('cool',28),true);a.equal(data.bigaCoolOffered('fridge',16),false);
  a.deepEqual(py.prefermentYeastStorages('biga','auto',true,true),[true,false]);
  a.deepEqual(py.prefermentYeastStorages('biga','auto',true,false),[true]);
  a.deepEqual(py.prefermentYeastStorages('biga','fridge',true,true),[true]);
  a.deepEqual(py.prefermentYeastStorages('biga','room',true,true),[false]);
  // The cool path's inverse is the forward dose read back.
  const ctx={kitchenTemp:18,fridgeTemp:6,massG:560};
  for(const h of [12,14,16,18,20]){
    const r=data.computePrefermentRecipe('biga',1000,650,18,6,false,40,'instant',h);
    const back=py.prefermentHoursForYeast('biga',dose(r),false,{...ctx,massG:r.prefFlour+r.prefWater});
    a.ok(Math.abs(back-h)<0.01,`${h} h -> ${back}`);
  }
});

test("Giorilli's classic biga fits: 1 % fresh yeast (0.33 % instant) in a cool spot, ready around 16 h",()=>{
  const giorilli=1/3; // fresh ×3 (MB6 KM p. xi)
  for(const T of [16,18,19,20]){
    const fit=py.choosePrefermentYeastTiming('biga',giorilli,[false],{kitchenTemp:T,fridgeTemp:6,massG:560});
    a.ok(fit.fits,`${T} °C ${JSON.stringify(fit)}`);a.equal(fit.timing.inFridge,false);
    a.ok(fit.timing.min<=16&&fit.timing.max>=16&&fit.timing.hours===16,JSON.stringify(fit.timing));
  }
  // In 'auto' the fridge comes first: in a 6 °C fridge the same amount ripens in about a day and a half.
  const auto2=py.choosePrefermentYeastTiming('biga',giorilli,[true,false],{kitchenTemp:20,fridgeTemp:6,massG:560});
  a.ok(auto2.fits&&auto2.timing.inFridge&&auto2.timing.hours>=24&&auto2.timing.hours<=58,JSON.stringify(auto2));
  // The automatic 16 h dose reads back as 16 h; a dose too small for 20 h does not fit.
  const auto=dose(data.computePrefermentRecipe('biga',1000,650,18,6,false,40,'instant',16));
  a.equal(py.prefermentYeastTiming('biga',auto,false,{kitchenTemp:18,fridgeTemp:6,massG:560}).hours,16);
  a.equal(py.prefermentYeastTiming('biga',0.05,false,{kitchenTemp:18,fridgeTemp:6,massG:560}),null);
  // Too much yeast: it ripens long before 12 h and is past even the professional level by 12 h.
  a.equal(py.prefermentYeastTiming('biga',1.5,false,{kitchenTemp:18,fridgeTemp:6,massG:560}),null);
});

// Weekday 9:00–18:00 and nightly 23:00–7:00 busy times, local.
function busy(now,bake){const b=[];const d=new Date(now);d.setHours(0,0,0,0);
  for(let t=+d-86400000;t<=bake;t+=86400000){const day=new Date(t);
    b.push({label:`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day.getDay()]} night`,from:new Date(t+23*H),to:new Date(t+31*H)});
    if(day.getDay()>=1&&day.getDay()<=5)b.push({label:'Work · Mon',from:new Date(t+9*H),to:new Date(t+18*H)});}
  return b;}
const common={fridgeTemp:6,flourStrength:1,preheatMin:45,mixerType:'hand',numItems:2,mixingBatches:1,doughMassG:700,hydrationPct:70,prefermentFlourPct:20};

test('bug 4: the later bake offered with "Keep the biga" is one the planner finds a complete plan for',()=>{
  // B3: Neapolitan, 22 °C, Thu 7:30pm, bake Fri 7:30pm. The old offer (now + 24 h + 2 h 15 + preheat) had no plan.
  const now=new Date(2026,10,26,19,30).getTime();
  const naive=now+(24+2.5+0.75)*H;
  const r=sp.earliestPrefermentBake({...common,type:'biga',storages:[true],from:new Date(naive),now,blocks:[],kitchenTemp:22,styleKey:'neapolitan',numItems:4,doughMassG:1056,hydrationPct:65});
  a.ok(r&&+r.bake>naive,'a later, workable bake');
  a.ok(r.bake.getHours()>=7&&r.bake.getHours()<23,'never in the night');
  a.ok(r.prefHours>=24&&r.prefHours<=58&&r.inFridge);
  a.ok(+r.start-r.prefHours*H>=now,'the biga starts after now');
  // Exactly that bake: the planner's own search finds it (no dead end).
  const again=sp.earliestPrefermentBake({...common,type:'biga',storages:[true],from:r.bake,now,maxDays:0,blocks:[],kitchenTemp:22,styleKey:'neapolitan',numItems:4,doughMassG:1056,hydrationPct:65});
  a.equal(+again.bake,+r.bake);
});

test('bug 5: Thomas, 20 °C, Sat 11:30 baguettes, nights + work — no fridge biga fits; a cool-spot biga avoids every busy time',()=>{
  const now=new Date(2026,10,26,20,0).getTime(),bake=new Date(2026,10,28,11,30).getTime(),blocks=busy(now,bake);
  const at=storages=>sp.earliestPrefermentBake({...common,type:'biga',storages,from:new Date(bake),now,maxDays:0,blocks,kitchenTemp:20,styleKey:'baguette'});
  a.equal(at([true]),null,'the fridge biga needs 24 h before an after-work mix');
  const cool=at([true,false]);
  a.ok(cool&&cool.inFridge===false&&cool.prefHours>=12&&cool.prefHours<=20,JSON.stringify(cool));
  const inBusy=t=>blocks.some(b=>t>+b.from&&t<+b.to);
  a.ok(!inBusy(+cool.start)&&!inBusy(+cool.start-cool.prefHours*H),'biga and mix outside busy time');
  a.ok(cool.bake.getHours()>=7&&cool.bake.getHours()<23);
  // A warmer kitchen (22 °C) is not offered the cool spot automatically: that bake keeps no plan there.
  a.equal(data.bigaCoolOffered('auto',22),false);
});

test('picker: a biga uses the fridge first and a cool spot only when no fridge plan fits (byte-identical fridge plans)',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../app/components/SchedulePicker.tsx'),'utf8');
  a.match(src,/function recommendBiga\(/);
  a.match(src,/const kept=recommendPreferment\(fridge,pins,preferences\);\n    if\(kept\.result\.found\)return kept;/);
  a.match(src,/function bigaModes\(\):boolean\[\]\{return bigaStorage==='cool'\?\[false\]:bigaStorage==='fridge'\|\|!bigaCoolAllowed\?\[true\]:\[true,false\];\}/);
  // A biga never inherits a poolish's room storage.
  a.match(fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8'),/if \(pt === 'biga' && pt !== prefermentType\) setPrefGoesInFridgeState\(bigaStorage !== 'cool'\);/);
});

test('a planner-chosen cool spot adds no hands-on step between 22:00 and 07:00 (round 7 rule D4)',()=>{
  const av=require('../app/utils/scheduleAvailability.ts');
  const at=(h,m=0)=>new Date(2026,10,27,h,m);
  // Night steps count unless the baker entered their own night and the step is outside every busy time.
  a.equal(av.newNightHandsOn([{id:'mix',at:at(22,15)},{id:'shape',at:at(6,45)},{id:'bake',at:at(23)},{id:'fold',at:at(21,45)}],[]).length,2);
  const own=[{label:'Fri night',from:at(23,30),to:new Date(2026,10,28,7)}];
  a.equal(av.newNightHandsOn([{id:'mix',at:at(22,15)}],own).length,0,'declared free');
  a.equal(av.newNightHandsOn([{id:'mix',at:at(23,45)}],own).length,1,'inside the night block');
  // The wrapper rejects a candidate whose biga or dough step is at night, keeps the others.
  const input={blocks:[],formulaValid:undefined};
  const wrapped=sp.withoutNightSteps(input);
  const day={availabilityActions:[{id:'mix',at:at(18)}]},night={availabilityActions:[{id:'shape',at:at(22,30)}]};
  a.equal(wrapped.formulaValid(day,{start:at(18),prefHours:10}),true);
  a.equal(wrapped.formulaValid(night,{start:at(18),prefHours:10}),false);
  a.equal(wrapped.formulaValid(day,{start:at(18),prefHours:16}),false,'a biga made at 2:00 is a night step');
  // Bug 5 and every engine sweep case: the cool spot found for Thomas has no new night step.
  const now=new Date(2026,10,26,22,0).getTime(),bake=new Date(2026,10,28,11,30).getTime(),blocks=busy(now,bake);
  const r=sp.earliestPrefermentBake({...common,type:'biga',storages:[true,false],from:new Date(bake),now,maxDays:0,blocks,kitchenTemp:20,styleKey:'baguette'});
  a.ok(r&&r.inFridge===false,JSON.stringify(r));
  a.equal(av.newNightHandsOn([{id:'mix',at:r.start},{id:'preferment',at:new Date(+r.start-r.prefHours*H)}],blocks).length,0,'only times the baker declared free');
});
