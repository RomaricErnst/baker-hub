const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const H=3600000;
// Baguette, 5 pieces, 19 °C, bake tomorrow 8:00; the night (23:00–7:00) holds the 3:15 fridge exit.
const bake=new Date(2026,10,11,8,0),start=new Date(+bake-16*H);
const night=[{from:new Date(2026,10,10,23,0),to:new Date(2026,10,11,7,0),label:'Tuesday night'}];
const base={start,bake,blocks:night,kitchenTemp:19,preheatMin:30,mixerType:'hand',styleKey:'baguette',numItems:5,itemWeight:350,mixingBatches:1,fridgeTemp:6,hydration:70};
const build=(blocks,style='baguette',s=start)=>utils.buildSchedule(s,bake,blocks,19,30,'hand',style,5,1);

test('baguette: the only clash is the night-time fridge exit, so baking straight from the fridge is offered',()=>{
 const usual=build(night);
 assert.deepEqual(usual.availabilityConflicts.map(c=>c.action.id),['cold-out-2']);
 assert.ok(usual.rtWarmupStart&&usual.finalProofHours>3);
 const option=utils.bakeFromFridgeOption(base);
 assert.ok(option);
 // Out of the fridge while the oven heats: 7:30 for an 8:00 bake with a 30 min preheat.
 assert.equal(+option.exitAt,+new Date(2026,10,11,7,30));
 assert.ok(option.budget>=0.9);
 const variant=build(option.blocks);
 assert.equal(+variant.coldRetard2End,+variant.preheatStart);
 assert.equal(+variant.finalProofStart,+variant.preheatStart);
 assert.equal(variant.rtWarmupStart,null);
 assert.equal(variant.finalProofHours,0.5);
 assert.ok(variant.totalColdHours>usual.totalColdHours);
 // Mixing, shaping and the bake stay where they were; nothing falls in the night.
 assert.equal(+variant.bulkFermStart,+usual.bulkFermStart);assert.equal(+variant.divideBallTime,+usual.divideBallTime);
 assert.equal(+variant.bakeStart,+bake);
 assert.deepEqual(findAvailabilityConflicts(variant.availabilityActions,night),[]);
 assert.equal(utils.hasCoherentScheduleShape(variant,start),true);
});

test('the variant follows its bake: another bake time builds the usual plan',()=>{
 const option=utils.bakeFromFridgeOption(base);
 const other=utils.buildSchedule(start,new Date(+bake+15*60000),option.blocks,19,30,'hand','baguette',5,1);
 assert.ok(other.rtWarmupStart);
 assert.notEqual(+other.coldRetard2End,+other.preheatStart);
});

test('the same budget, on the engine thermal trajectory, decides; recipe doses follow the variant',()=>{
 const option=utils.bakeFromFridgeOption(base);
 const variant=build(option.blocks);
 const recipe=utils.calculateRecipe('baguette','home_oven_standard',5,350,19,'normal',variant,6,'instant','custom','hand');
 assert.ok(recipe.yeast.pct>0);
 assert.equal(recipe.yeast.warnings.some(w=>w.key==='fermentationBudget'),false);
});

test('not offered for pizza, enriched or tin rye, without a clash, or when other steps clash too',()=>{
 for(const styleKey of ['neapolitan','pain_mie','brioche','pain_seigle'])assert.equal(utils.bakeFromFridgeOption({...base,styleKey}),null,styleKey);
 assert.equal(utils.bakeFromFridgeOption({...base,blocks:[]}),null);
 // 14 h: shaping falls in the night as well; this card is only for the fridge exit.
 assert.equal(utils.bakeFromFridgeOption({...base,start:new Date(+bake-14*H)}),null);
 // A flag on a pizza plan is ignored by the builder.
 const pizza=utils.buildSchedule(new Date(+bake-26*H),bake,night.map(b=>({...b,bakeFromFridge:+bake})),19,45,'hand','neapolitan',4,1);
 assert.ok(pizza.rtWarmupStart);
});

test('the guide bake step tells the baker to bake straight from the fridge when that plan was chosen',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app/components/BakeGuide.tsx'),'utf8');
 assert.match(src,/const bakesFromFridge = !!leanBake && !!schedule\.coldRetard2Start && !schedule\.rtWarmupStart/);
 assert.match(src,/Bake the loaves straight from the fridge/);
 assert.match(src,/Enfournez les pâtons à la sortie du frigo/);
});
