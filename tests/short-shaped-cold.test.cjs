const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const D=(d,h,m=0)=>new Date(2026,10,d,h,m);
const nights=[{label:'Nights',from:D(13,23),to:D(14,7)}];
const fridgeTrips=s=>(s.availabilityActions||[]).filter(a=>/^cold-(in|out)/.test(a.id)).length;

for(const [style,temp,start,bake,blocks] of [
 ['pain_campagne',24,D(13,18),D(14,12,30),nights],
 ['baguette',22,D(13,19),D(14,12),nights],
 ['pain_au_seigle',22,D(14,7),D(14,18),[]],
])test(`${style}: no short shaped fridge spell when the baker is free; the bulk stays cold until shaping`,()=>{
 const s=utils.buildSchedule(start,bake,blocks,temp,30,'hand',style,1);
 assert.equal(s.coldRetard2Start,null);
 assert.equal(fridgeTrips(s),2,'one fridge in, one fridge out');
 assert.equal(+s.divideBallTime,+s.coldRetardEnd,'shaped as it comes out of the fridge');
 assert.deepEqual(findAvailabilityConflicts(s.availabilityActions,blocks),[]);
 assert.ok(s.finalProofHours>=1);
 assert.equal(utils.hasCoherentScheduleShape(s,start),true);
});

test('a shaped cold spell of four hours or more stays',()=>{
 const s=utils.buildSchedule(D(13,20),D(14,18),nights,22,30,'hand','pain_au_seigle',1);
 assert.ok(s.coldRetard2Start);
});
