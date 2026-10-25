const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {findFixedBakeSchedule,validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const H=3600000,now=Date.parse('2026-10-25T08:00Z');
function fixture(styleKey,kitchenTemp,prefHours){
 const bake=new Date('2026-10-30T18:00Z'),start=new Date('2026-10-29T16:00Z'),blocks=[];
 for(let d=26;d<=30;d++){
  blocks.push({from:new Date(`2026-10-${d}T09:00Z`),to:new Date(`2026-10-${d}T18:00Z`),label:'Work'});
  blocks.push({from:new Date(`2026-10-${d}T23:00Z`),to:new Date(`2026-10-${d+1}T07:00Z`),label:'Night'});
 }
 return {id:'mix',at:start,start,bake,now,blocks,kitchenTemp,preheatMin:45,mixerType:'hand',styleKey,numItems:4,hasPreferment:true,prefWarmupHours:0,prefHours,prefWindow:prefHours===48?{min:24,max:58}:{min:8,max:24},supported:true,window:b=>({from:new Date(+b-60*H),to:new Date(+b-6*H)}),methodValid:()=>true};
}
for(const style of ['neapolitan','newyork','baguette'])for(const temp of [18,24,32])for(const hours of [18,48]){
 test(`${style} ${temp}C ${hours}h: repair preparation despite blocked baking-day work`,()=>{
  const input=fixture(style,temp,hours),result=findFixedBakeSchedule(input);
  assert.equal(result.found,false); // Preheat remains blocked at 17:15.
  assert.equal(result.preparationRepaired,true);
  const {start,bake,prefHours}=result.candidate.times;
  assert.equal(+bake,+input.bake);
  assert.ok(prefHours>=input.prefWindow.min&&prefHours<=input.prefWindow.max);
  assert.equal(findAvailabilityConflicts([{id:'preferment',at:new Date(+start-prefHours*H)},{id:'mix',at:start}],input.blocks).length,0);
  assert.equal(validateScheduleCandidate(input,result.candidate.times).valid,false);
  assert.ok(findAvailabilityConflicts(result.candidate.schedule.availabilityActions,input.blocks).some(c=>c.action.id==='preheat'));
 });
}
test('a manually pinned blocked preferment is never silently moved',()=>{
 const input=fixture('neapolitan',24,48),preferment=new Date(+input.start-48*H);
 const result=findFixedBakeSchedule(input,{preferment});
 assert.equal(result.found,false);assert.equal(result.preparationRepaired,false);
 assert.equal(+result.candidate.times.start-result.candidate.times.prefHours*H,+preferment);
});
test('invalid maturation cannot become a partial repair',()=>{
 const result=findFixedBakeSchedule({...fixture('neapolitan',24,48),methodValid:()=>false});
 assert.equal(result.found,false);assert.equal(result.preparationRepaired,false);
});
