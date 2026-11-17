// After-work levain loaf (17 Nov 2026 sourdough review: London, 900 g pain au levain,
// 20 % levain, busy weekdays 9:00–17:30 and nights 23:00–7:00, bake Saturday 10:00).
// When every shaping slot after a bulk cold falls in the night, a loaf that proofs
// shaped in the fridge and bakes from it is shaped at the end of bulk instead.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const H=3600000;
const bake=new Date(2026,10,21,10,0);
const blocks=[];
for(let d=17;d<=21;d++){
 blocks.push({from:new Date(2026,10,d,23,0),to:new Date(2026,10,d+1,7,0),label:'night'});
 if(d>=18&&d<=20)blocks.push({from:new Date(2026,10,d,9,0),to:new Date(2026,10,d,17,30),label:'work'});
}
const build=(temp,mix,style='pain_levain',levain=true)=>utils.buildSchedule(mix,bake,blocks,temp,45,'no_knead',style,1,1,levain,levain?utils.starterBulkFactor(20,temp):1);

test('evening mix, bulk ends before the night: shape at the end of bulk and cold-proof the loaf overnight',()=>{
 for(const [h,m] of [[17,30],[17,45],[18,0]]){
  const mix=new Date(2026,10,20,h,m);
  const s=build(25,mix);
  const bulkEnd=+s.bulkFermStart+s.bulkFermHours*H;
  assert.ok(bulkEnd<=+new Date(2026,10,20,23,0),'bulk ends before the night');
  assert.equal(s.coldRetard1Start,null,'no bulk cold');
  assert.ok(+s.divideBallTime>=bulkEnd-1 && +s.divideBallTime-bulkEnd<15*60000,'shaped at the end of bulk');
  assert.ok(+s.divideBallTime<+new Date(2026,10,20,23,0),'shaped before the night');
  assert.equal(+s.coldRetard2End,+s.preheatStart,'baked straight from the fridge');
  assert.ok(s.totalColdHours>=10,'overnight cold proof');
  assert.equal(+s.bakeStart,+bake);
  assert.deepEqual(findAvailabilityConflicts(s.availabilityActions,blocks).map(c=>c.action.id),[]);
  assert.equal(utils.hasCoherentScheduleShape(s,mix),true);
 }
});

test('her 19 °C kitchen: the modelled bulk (20 % levain) runs past 23:00 from an after-work mix, and the clash stays visible',()=>{
 const mix=new Date(2026,10,20,18,0);
 const s=build(19,mix);
 assert.ok(s.bulkFermHours>6.5,'pain au levain bulk at 19 °C with 20 % levain');
 const bulkEnd=+s.bulkFermStart+s.bulkFermHours*H;
 assert.ok(bulkEnd>+new Date(2026,10,20,23,0));
 // No slot is invented: the night-time step is reported, not hidden.
 assert.ok(findAvailabilityConflicts(s.availabilityActions,blocks).length>0);
});

test('a free shaping slot after the bulk cold keeps the two fridge spells',()=>{
 const nightsOnly=blocks.filter(b=>b.label==='night');
 const mix=new Date(2026,10,20,12,0);
 const s=utils.buildSchedule(mix,bake,nightsOnly,25,45,'no_knead','pain_levain',1,1,true,utils.starterBulkFactor(20,25));
 assert.ok(s.coldRetard1Start&&s.coldRetard1End,'bulk cold kept');
 assert.ok(+s.divideBallTime<+new Date(2026,10,20,23,0));
 assert.deepEqual(findAvailabilityConflicts(s.availabilityActions,nightsOnly).map(c=>c.action.id),[]);
});

test('pizza dough is not reshaped at the end of bulk',()=>{
 const mix=new Date(2026,10,20,17,30);
 const s=build(25,mix,'neapolitan',false);
 assert.ok(s.coldRetard1Start===null||+s.divideBallTime>+s.coldRetard1Start,'balls are not made at the end of bulk by this rule');
});
