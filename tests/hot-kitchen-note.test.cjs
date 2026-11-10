const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const H=3600000,bake=new Date(2026,10,11,19,0);
const plan=(temp,hours,style='neapolitan')=>utils.buildSchedule(new Date(+bake-hours*H),bake,[],temp,45,'hand',style,4,1);
const warns=(temp,schedule,style='neapolitan')=>utils.calculateRecipe(style,'home_oven_standard',4,260,temp,'normal',schedule,6,'instant','custom','hand').yeast.warnings.map(w=>w.key);

test('the hot-kitchen note counts the room-temperature time the steps show',()=>{
 // 31 and 32 °C with a fridge phase: the steps add up to about 3 h, so no "over 4 hours".
 for(const temp of [31,32])for(const hours of [10,20,26]){
  const s=plan(temp,hours);
  assert.ok(s.totalRTHours<=4,`${temp} ${hours}`);
  assert.equal(warns(temp,s).includes('hotClimateRT'),false,`${temp}°C ${hours}h`);
 }
});
test('a plan with more than 4 h at room temperature in a hot kitchen still says so',()=>{
 // The note fires on the steps' room-temperature hours, not on the cooling-adjusted exposure.
 const r=utils.recommendYeast(3.5,31,10,6,'instant',600,null,'neapolitan',undefined,3.5);
 assert.equal(r.warnings.some(w=>w.key==='hotClimateRT'),false);
 assert.equal(utils.recommendYeast(3.5,31,10,6,'instant',600,null,'neapolitan',undefined,4.25).warnings.some(w=>w.key==='hotClimateRT'),true);
});
