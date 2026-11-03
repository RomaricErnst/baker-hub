const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const H=3600000,bake=new Date('2026-12-05T19:00:00Z');
const ctx=(o={})=>({bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,itemWeight:260,mixingBatches:1,fridgeTemp:6,hydration:65,...o});
const recipeAt=(hours,override,T=22)=>utils.calculateRecipe('neapolitan','home_oven_standard',4,260,T,'normal',
 utils.buildSchedule(new Date(+bake-hours*H),bake,[],T,45,'hand','neapolitan',4,1,false),6,'instant','custom','hand',
 undefined,undefined,undefined,undefined,'none',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,override);
test('a chosen yeast amount is timed back to the window that would recommend it',()=>{
 for(const [hours,T] of [[24,22],[10,28],[18,20]]){
  const auto=recipeAt(hours,undefined,T).yeast.pct;
  const timed=utils.fermentationHoursForYeast(auto,ctx({kitchenTemp:T}));
  assert.ok(Math.abs(timed-hours)<=0.5,`${hours}h at ${T}C timed to ${timed}h`);
 }
});
test('less yeast plans a longer fermentation, more yeast a shorter one',()=>{
 const auto=recipeAt(24).yeast.pct;
 const half=utils.fermentationHoursForYeast(auto/2,ctx()),twice=utils.fermentationHoursForYeast(auto*2,ctx());
 assert.ok(half>24&&twice<24,`${half} / ${twice}`);
});
test('the recipe shows the entered amount and stays within budget on the re-timed plan',()=>{
 const chosen=0.06,hours=utils.fermentationHoursForYeast(chosen,ctx());
 const recipe=recipeAt(hours,chosen);
 assert.equal(recipe.yeast.pct,chosen);
 assert.ok(!recipe.yeast.warnings.some(w=>w.key==='fermentationBudget'));
 const mismatched=recipeAt(8,chosen);
 assert.equal(mismatched.yeast.pct,chosen);
 assert.ok(mismatched.yeast.warnings.some(w=>w.key==='fermentationBudget'),'an unmatched window is reported, not hidden');
});
test('an amount too small for any supported window is not timed',()=>{
 assert.equal(utils.fermentationHoursForYeast(0.001,ctx()),null);
});
