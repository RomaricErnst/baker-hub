const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
test('dose limits report fermentation outside target across four to seventy-two hours',()=>{
 for(let h=4;h<=72;h++) for(const temp of [22,31]) {
  const result=utils.recommendYeast(4,temp,h-4,6,'instant',600,null,'neapolitan');
  const progress=utils.fermentationBudget(result.pct,4,temp,h-4,6);
  assert.equal(result.warnings.some(w=>w.key==='fermentationBudget'),progress<.9||progress>1.1);
 }
 const long=utils.recommendYeast(4,22,68,6,'instant',600,null,'neapolitan');
 assert.ok(long.warnings.some(w=>w.key==='fermentationBudget'));
});
test('large cold poolish receives more than the obsolete two-hour warmup',()=>{
 const options={prefermentType:'poolish',prefInFridge:true,styleKey:'neapolitan',kitchenTemp:22,fridgeTemp:6,mixerType:'hand',prefermentFlourPct:50,doughMassG:1080,hydrationPct:62};
 assert.equal(utils.requiredPrefWarmupH(options),3.75);
 assert.equal(utils.requiredPrefWarmupH({...options,prefInFridge:false}),0);
});
test('scheduled cold stages last at least an hour and exposure remains conserved',()=>{
 const start=new Date('2026-11-01T10:00:00Z');
 for(const style of ['neapolitan','baguette','pain_levain']) for(const temp of [22,31]) for(let h=4;h<=48;h+=.25) {
  const bake=new Date(+start+h*3600000);
  const schedule=utils.buildSchedule(start,bake,[],temp,45,'hand',style,4);
  for(const [from,to] of [[schedule.coldRetard1Start,schedule.coldRetard1End],[schedule.coldRetard2Start,schedule.coldRetard2End]]) {
   if(from&&to) assert.ok((+to-+from)>=3600000,style+'/'+temp+'/'+h);
  }
  assert.ok(Math.abs(schedule.totalRTHours+schedule.totalColdHours-(+bake-+schedule.bulkFermStart)/3600000)<1e-8);
 }
});

test('intentional flavour and speed choices suppress the generic budget warning and defaults explain timing direction',()=>{
 for(const temp of [22,31])for(let hours=48;hours<=72;hours++){
  const dose=priority=>utils.recommendYeast(4,temp,hours-4,6,'instant',600,priority,'neapolitan');
  for(const priority of ['speed','flavor'])assert.equal(dose(priority).warnings.some(w=>w.key==='fermentationBudget'),false);
  const plain=dose(null),fraction=utils.fermentationBudget(plain.pct,4,temp,hours-4,6);
  const warning=plain.warnings.find(w=>w.key==='fermentationBudget');
  if(fraction>1.1 || fraction<.9)assert.equal(warning?.params.direction,fraction>1?'earlier':'later');
  else assert.equal(warning,undefined);
 }
});
