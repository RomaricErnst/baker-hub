const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const dose=(warm,temp,cold,yeast='instant',priority=null)=>utils.recommendYeast(warm,temp,cold,4,yeast,1000,priority,'neapolitan');

test('unsupported warm exposure remains rejected when cold fermentation is added',()=>{
 for(const [warm,temp] of [[30,28],[30,30],[30,38],[36,25],[36,27]])for(const cold of [1,12,24,72])for(const yeast of ['instant','active_dry','fresh'])for(const priority of [null,'flavor','speed']){
  const mixed=dose(warm,temp,cold,yeast,priority),rt=dose(warm,temp,0,yeast,priority);
  assert.equal(mixed.notRecommended,true,`${warm}/${temp}/${cold}/${yeast}/${priority}`);
  assert.deepEqual(mixed.warnings.find(w=>w.key==='overFermentRT'),{key:'overFermentRT',params:{hours:warm,temp}});
  assert.equal(mixed.pct,rt.pct,'same finite placeholder as rejected pure-RT plan');
  assert.equal(mixed.convertedGrams,rt.convertedGrams);
 }
});

test('crossing the unsupported threshold cannot increase the dose or stay recommended',()=>{
 for(const [warm,temp] of [[30,28],[30,30],[36,25],[36,27]]){
  const before=dose(warm-.001,temp,12),after=dose(warm,temp,12);
  assert.equal(before.notRecommended,false);assert.equal(after.notRecommended,true);
  assert.ok(after.pct<=before.pct);
 }
});

test('ordinary direct, mixed and cold-only dose results remain unchanged',()=>{
 for(const [warm,temp,cold,pct] of [[0,30,12,.2871],[4,22,0,1.2697],[2,22,24,.1156],[29.9,30,12,.05]]){
  const r=dose(warm,temp,cold);
  assert.equal(r.pct,pct);assert.equal(r.notRecommended,false);
  assert.ok(!r.warnings.some(w=>w.key==='overFermentRT'));
 }
});

test('recipe construction retains the rejected-exposure flag rather than losing it during mass adjustment',()=>{
 const start=new Date('2030-10-01T08:00Z');
 const schedule={...utils.buildSchedule(start,new Date(+start+42*3600000),[],30,30,'hand','neapolitan'),totalRTHours:30,totalColdHours:12};
 for(const method of ['none','poolish','biga']){
  const recipe=utils.calculateRecipe('neapolitan','home_oven_standard',4,250,30,'normal',schedule,4,'instant','custom','hand',undefined,undefined,undefined,undefined,method);
  assert.equal(recipe.yeast.notRecommended,true);
  assert.ok(recipe.yeast.warnings.some(w=>w.key==='overFermentRT'));
 }
});
