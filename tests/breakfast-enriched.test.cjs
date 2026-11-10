const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const H=3600000,D=(d,h,m=0)=>new Date(2026,10,d,h,m);
// Breakfast enriched loaves, 22 °C, nights busy 23:00–7:00, the evening before free.
const nights=[{label:'Nights',from:D(10,23),to:D(11,7)},{label:'Nights',from:D(11,23),to:D(12,7)}];

for(const style of ['pain_viennois','brioche','pain_mie'])test(`${style}: an evening mix is shaped before bed and bakes the next morning`,()=>{
 const start=D(11,18,30),bake=D(12,9,15);
 const s=utils.buildSchedule(start,bake,nights,22,30,'hand',style,4);
 assert.ok(+s.divideBallTime<+nights[1].from,'shaped before the night');
 assert.ok(s.coldRetard2Start&&+s.coldRetard2End>=+nights[1].to,'the shaped loaves spend the night in the fridge');
 assert.deepEqual(findAvailabilityConflicts(s.availabilityActions,nights),[]);
 assert.ok(s.totalColdHours>=utils.REQUIRED_COLD_MIN_HOURS[style]);
 assert.equal(utils.hasCoherentScheduleShape(s,start),true);
});

test('the repair for an 8:00 breakfast brioche is the next morning, not the afternoon',()=>{
 const bake=D(12,8),now=D(10,15);
 // The page's mix window for enriched doughs reaches 16 h (ENRICHED_OVERNIGHT_MAX_H).
 const r=utils.findScheduleRepair({startTime:D(11,22,45),eatTime:bake,availabilityBlocks:nights,kitchenTemp:22,preheatMin:30,
  mixerType:'hand',styleKey:'brioche',numItems:4,now,allowStartShift:true,mixWindow:b=>({from:new Date(+b-16*H),to:new Date(+b-4*H)})});
 assert.ok(r);
 assert.ok(+r.eatTime<=+D(12,10),`bake ${r.eatTime}`);
 assert.ok(+r.startTime<+D(11,23)&&+r.startTime>=+D(11,17),`mix ${r.startTime}`);
});
