const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const H=3600000,bake=new Date('2026-12-05T19:00:00Z'),start=new Date(+bake-36*H);
const bulkH=s=>(+s.coldRetardStart-+s.bulkFermStart)/H;
const plan=(T,factor)=>utils.buildSchedule(start,bake,[],T,45,'hand','pain_levain',1,1,true,factor);
test('no chosen starter leaves the bulk unchanged',()=>{
 assert.equal(utils.starterBulkFactor(undefined,22),1);
 for(const T of [18,22,26,30])assert.deepEqual(JSON.stringify(plan(T,utils.starterBulkFactor(undefined,T))),JSON.stringify(plan(T,1)));
});
test("Craig's curve: less starter lengthens the bulk, more shortens it",()=>{
 const f10=utils.starterBulkFactor(10,22),f30=utils.starterBulkFactor(30,22);
 assert.ok(Math.abs(f10-11.76/7.41)<0.01,`10% at 22C: ${f10}`);
 assert.ok(f30<1);
 assert.ok(Math.abs(utils.starterBulkFactor(22.5,22)-1)<0.001,'the recommended mid is neutral');
});
test('temperature sensitive: reference % follows the kitchen, hours follow Q10',()=>{
 // 10% is near the hot-kitchen recommendation, far below the cool one.
 assert.ok(utils.starterBulkFactor(10,30)<utils.starterBulkFactor(10,22));
 const extra=T=>utils.sourdoughBulkH('pain_levain',T)*(utils.starterBulkFactor(10,T)-1);
 assert.ok(extra(18)>extra(22)&&extra(22)>extra(26),`${extra(18)} ${extra(22)} ${extra(26)}`);
});
test('the room-temperature bulk absorbs the change; mix and bake stay put; the fridge retard gives way',()=>{
 for(const T of [20,22,25]){
  const base=plan(T,1),less=plan(T,utils.starterBulkFactor(10,T));
  assert.ok(bulkH(less)>bulkH(base)+1,`${T}C bulk ${bulkH(base)} -> ${bulkH(less)}`);
  assert.equal(+less.bakeStart,+base.bakeStart);
  const cold=s=>s.totalColdHours;
  assert.ok(cold(less)<cold(base),`${T}C cold ${cold(base)} -> ${cold(less)}`);
 }
});
test('the recipe uses the chosen starter amount',()=>{
 const s=plan(22,utils.starterBulkFactor(12,22));
 const r=utils.calculateRecipe('pain_levain','standard_bread',1,800,22,'normal',s,6,'sourdough','custom','hand',
  undefined,undefined,undefined,undefined,'levain',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,12);
 assert.equal(r.sourdough.starterPctMin,12);assert.equal(r.sourdough.starterPctMax,12);
 // The amount shown is the amount used: no rounding to 5 g for a single chosen amount.
 assert.equal(r.sourdough.starterGramsMin,r.sourdough.starterGramsMax);
 assert.equal(r.sourdough.starterGramsMid,r.sourdough.starterGramsMin);
 assert.equal(r.sourdough.starterGramsMid,Math.round(r.flour*0.12));
});
test('any chosen starter % shows and uses the same grams',()=>{
 for(const pct of [5,10,20,26.9,30]){
  const s=plan(24,utils.starterBulkFactor(pct,24));
  const r=utils.calculateRecipe('pain_levain','standard_bread',1,800,24,'normal',s,6,'sourdough','custom','hand',
   undefined,undefined,undefined,undefined,'levain',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,pct);
  assert.equal(r.sourdough.starterGramsMid,r.sourdough.starterGramsMin,`${pct}%`);
 }
});
