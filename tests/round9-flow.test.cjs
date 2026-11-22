// 22 Nov 2026 round 9 (flow and display track): A one hydration sum for Fine-tune and the recipe, E Update recipe
// after Customize in place, S1 no poolish card on a direct dough, S3 French decimal commas, S5 "Back to the bake
// time" opens it, S6 oven windows on the quarter hour.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {utils,data}=require('./load-production.cjs');
const O=require('../app/utils/ovenWindow.ts');
const {ENRICHED_FORMULAS}=require('../app/utils/enrichedFormulas.ts');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
const page=read('app/[locale]/page.tsx'),recipeOut=read('app/components/RecipeOutput.tsx'),picker=read('app/components/SchedulePicker.tsx');
const H=3600000,M=60000;
const bake=+new Date(2026,10,28,11,30);
const plan=()=>utils.buildSchedule(new Date(2026,10,26,20,30),new Date(bake),[],20,45,'hand','baguette',4,1);
const recipe=(blend,mode='custom')=>utils.calculateRecipe('baguette','standard_bread',4,320,20,'normal',plan(),6,'instant',mode,'hand',undefined,undefined,undefined,blend);

test('A: Thomas\'s baguette (standard home oven, 20 °C, flour not chosen) is 71 %: style 68 + oven 3, no flour line',()=>{
 const sum=utils.recommendedHydration('baguette','standard_bread',20,'normal',data.recipeFlourBlend('baguette','custom',undefined));
 assert.deepEqual({style:sum.style,oven:sum.oven,kitchen:sum.kitchen,flour:sum.flour,total:sum.total},{style:68,oven:3,kitchen:0,flour:0,total:71});
 // The recipe made with no chosen flour (Simple, and Custom after Customize in place) is the same number.
 assert.equal(recipe(undefined,'simple').hydration,71);
 assert.equal(recipe(undefined).hydration,71);
 // "four +3" is the oven (four = oven), not a W effect: the standard home oven's own delta.
 assert.equal(data.BREAD_OVEN_TYPES.standard_bread.hydrationDelta,3);
});

test('A: a chosen bread flour adds its type (+1, never its W) in the sum and the recipe alike',()=>{
 for(const w1 of [undefined,150,200,320]){
  const blend={flour1:'bread',flour2:null,ratio1:100,...(w1?{w1,w1Source:'stated'}:{})};
  const sum=utils.recommendedHydration('baguette','standard_bread',20,'normal',blend);
  assert.equal(sum.flour,1,`W ${w1}`);assert.equal(sum.total,72);
  assert.equal(recipe(blend).hydration,sum.total,`recipe = sum at W ${w1}`);
 }
});

test('A: the sum is the recipe\'s hydration across styles, ovens, kitchens and flours',()=>{
 const ovens=[...Object.keys(data.OVEN_TYPES),...Object.keys(data.BREAD_OVEN_TYPES)];
 const blends=[undefined,{flour1:'bread',flour2:null,ratio1:100},{flour1:'pizza00',flour2:'strong00',ratio1:60}];
 let n=0;
 for(const st of Object.keys(data.ALL_STYLES)){
  if(ENRICHED_FORMULAS[st])continue; // a published formula's own water
  const p=utils.buildSchedule(new Date(2026,10,26,12),new Date(2026,10,27,12),[],22,30,'hand',st,4,1);
  for(const ov of ovens)for(const T of [16,22,30])for(const b of blends){
   let r;try{r=utils.calculateRecipe(st,ov,4,250,T,'normal',p,6,'instant','custom','hand',undefined,undefined,undefined,b);}catch{continue;}
   if(r.hydration===data.ALL_STYLES[st].hydration&&data.ALL_STYLES[st].hydration!==utils.recommendedHydration(st,ov,T,'normal',data.recipeFlourBlend(st,'custom',b)).total)continue; // unleavened: the style's own
   assert.equal(r.hydration,utils.recommendedHydration(st,ov,T,'normal',data.recipeFlourBlend(st,'custom',b)).total,`${st} ${ov} ${T} ${JSON.stringify(b)}`);n++;
  }
 }
 assert.ok(n>1000,`${n} cases`);
});

test('A: Fine-tune reads the recipe\'s flour and the shared sum; the W note only with a chosen flour',()=>{
 assert.match(page,/'custom', mixerType as MixerType, undefined, manualOil, manualSugar, flourChosen \? flourBlend : undefined, prefermentType,/);
 assert.match(page,/const hydSum = recommendedHydration\(styleKey\?\?'',ovenType as OvenType,kitchenTemp,humidity,recipeFlourBlend\(styleKey\?\?'','custom',flourChosen\?flourBlend:undefined\)\)/);
 assert.match(page,/\{flourChosen&&<p data-hydration-w-note/);
 assert.doesNotMatch(page,/votre four, votre cuisine et votre farine/);
});

test('E: Customize in place adopts the recipe\'s preferment and yeast; Update recipe replans where the baker is',()=>{
 assert.match(page,/confirmSetting\('flour','recipe'\);adoptRecipeMethod\(\);/);
 assert.match(page,/function adoptRecipeMethod\(\) \{\n    if \(!recipeGenerated\) return;\n    if \(!prefermentChosen\) setPrefermentChosen\(true\);\n    if \(yeastType && yeastType !== 'sourdough'\) confirmSetting\('yeast', yeastType\);/);
 // The replan branch no longer opens the bake time.
 const finish=page.slice(page.indexOf('  function finishSetupEdit() {'),page.indexOf('  function openLateFillings()'));
 assert.match(finish,/setReplanReturn\(\{from:\+startTime,settled:false\}\);\n      return;/);
 assert.doesNotMatch(finish,/setAdvancedStep\(9\)/);
 // A hidden planner hosts the replan only when no step planner is mounted (one instance).
 assert.match(page,/const customReplanHost = tab==='custom' && !!replanReturn && !replanReturn\.settled && !planEdit && !customStepPlannerMounted;/);
 assert.match(page,/\{customReplanHost && <div className="bh-plan-sheet-only" data-replan-host>/);
});

test('S1: no "Poolish preferment recommended" card on a direct dough',()=>{
 assert.doesNotMatch(recipeOut,/recipeOutput\.poolishTitle|recipeOutput\.poolishBody|Alternative method for this schedule/);
 for(const f of ['messages/en.json','messages/fr.json'])assert.doesNotMatch(read(f),/"poolishTitle"|"poolishBody"/);
});

test('S3: Fine-tune boxes and the recipe\'s flour row use the locale\'s decimal',()=>{
 assert.match(page,/<UnitInput decimal suffix=\{field\.unit\} label=\{field\.aria\} key=\{`\$\{field\.aria\}:\$\{field\.value\}:\$\{units\}`\} defaultValue=\{formatDecimal\(shown\(field\.value\),fr\)\}/);
 assert.match(page,/data-fridge-temp suffix=\{tempUnit\(units\)\}[^\n]*decimal defaultValue=\{formatDecimal\(/);
 assert.doesNotMatch(recipeOut,/advancedPct=\{[^}]*'100%'/);
 const {formatPercent}=require('../app/utils/units.ts');
 assert.equal(formatPercent(2.2,'fr'),'2,2 %');assert.equal(formatPercent(100,'fr'),'100 %');
});

test('S5: "Back to the bake time" opens it from another screen; on it, it only closes',()=>{
 assert.match(picker,/onClick=\{\(\)=>\(onDecisionSheetBack\?\?onDecisionSheetClose\)\?\.\(\)\}>\{isFr\?'Revenir à l’heure de cuisson':'Back to the bake time'\}/);
 assert.equal((page.match(/onDecisionSheetBack=\{backToBakeTime\}/g)||[]).length,2);
 assert.match(page,/onClick=\{backToBakeTime\}>\{fr\?'Revenir à l’heure de cuisson':'Back to the bake time'\}/);
 assert.match(page,/if\(onIt\)return;\n    if\(recipeGenerated\)captureEditReturn\(\);\n    setBakeTimeQuestion\(true\);openSetupStep\(planStep\);/);
});

test('S6: four pizzas in a home oven from 7:30pm leave it at 8:30pm, not 8:27pm',()=>{
 const at=(h,mi)=>+new Date(2026,10,28,h,mi);
 const busy=O.ovenBusyMinutes('pizza','neapolitan',4,'home_oven_standard');
 assert.equal(busy,57);
 assert.equal(O.ovenUseEnd(at(19,30),busy),at(20,30));
 assert.equal(O.ovenUseEnd(at(19,30),45),at(20,15),'already on the grid stays');
 assert.equal(O.ovenFreeAt(at(20,27)),at(20,30),'a saved end before the fix');
 assert.equal(O.ovenTakenAt(at(18,47)),at(18,45));
 const other={id:'b',from:at(18,45),to:O.ovenUseEnd(at(19,30),busy),ovenType:'home_oven_standard',subject:'Les pizzas',plural:true};
 const fmt=ms=>{const d=new Date(ms);return `${d.getHours()}h${String(d.getMinutes()).padStart(2,'0')}`;};
 assert.equal(O.ovenBusyClause(other,true,fmt),'Les pizzas occupent le four de 18h45 à 20h30');
 // The next free slot follows the same end.
 const mine={from:at(19,15),to:at(20,15),ovenType:'home_oven_standard'};
 assert.equal(mine.from+O.nextFreeOvenShift(mine,[other]),at(20,30));
 for(const src of [page,picker])assert.match(src,/ovenUseEnd\(/);
 assert.match(page,/to=ses\.ovenTo!=null\?ovenFreeAt\(ses\.ovenTo\):ovenUseEnd\(/);
});
