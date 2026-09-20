const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
function make(method, flourTemp, prefermentTemp, coldFlour=false) {
 const style=method==='levain'?'pain_levain':'neapolitan';
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],24,45,'hand',style);
 return utils.calculateRecipe(style,method==='levain'?'standard_bread':'home_oven_standard',1,800,24,'normal',schedule,6,method==='levain'?'sourdough':'instant','custom','hand',undefined,undefined,undefined,undefined,method,undefined,20,undefined,24,coldFlour,0,true,undefined,24,flourTemp,prefermentTemp);
}
function close(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`);}
test('absent or nonfinite measurements preserve existing direct, preferment and levain defaults',()=>{
 for(const method of ['none','poolish','biga','levain']) {
  const baseline=make(method);
  for(const missing of [undefined,NaN,Infinity,-Infinity,null]) assert.deepEqual(make(method,missing,missing),baseline);
 }
});
test('measured flour temperature overrides storage assumption with the expected heat balance',()=>{
 for(const method of ['none','poolish','biga','levain']) {
  const warm=make(method,24,20),cool=make(method,14,20);
  const prefFlour=warm.preferment?.prefFlour??(warm.sourdough?Math.round(warm.sourdough.starterGramsMid/2):0);
  const dryCapacity=(warm.flour-prefFlour+warm.salt)*1800;
  const waterCapacity=warm.thermal.freeWaterG*4180;
  close(cool.thermal.idealWaterTemp-warm.thermal.idealWaterTemp,10*dryCapacity/waterCapacity);
  assert.deepEqual(make(method,14,20,true),cool);
  assert.equal(cool.flour,warm.flour);assert.equal(cool.water,warm.water);
 }
});
test('measured preferment temperatures steer only water temperature for poolish, biga and levain',()=>{
 for(const method of ['poolish','biga','levain']) {
  const warm=make(method,24,24),cool=make(method,24,14);
  const prefFlour=warm.preferment?.prefFlour??Math.round(warm.sourdough.starterGramsMid/2);
  const prefWater=warm.preferment?.prefWater??prefFlour;
  const prefCapacity=prefFlour*1800+prefWater*4180;
  close(cool.thermal.idealWaterTemp-warm.thermal.idealWaterTemp,10*prefCapacity/(warm.thermal.freeWaterG*4180));
  assert.equal(cool.flour,warm.flour);assert.equal(cool.water,warm.water);assert.deepEqual(cool.preferment,warm.preferment);
 }
 assert.deepEqual(make('none',24,5),make('none',24,35));
});
