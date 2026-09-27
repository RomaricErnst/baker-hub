const {test}=require('node:test');const a=require('node:assert/strict');const {utils}=require('./load-production.cjs');
const date=x=>new Date(`2030-04-${x}:00Z`);
test('required enriched cold cannot disappear behind a compatible-looking agenda',()=>{
 for(const style of ['brioche','pain_mie','pain_viennois']){
 const s=utils.buildSchedule(date('02T07:00'),date('02T11:30'),[],22,45,'stand',style,2);
 a.equal(s.preparationInvalid,true);a.equal(s.totalColdHours,0);a.equal(s.coldTimingConflict.actualHours,0);a.ok(s.coldTimingConflict.requiredHours>0);a.match(s.scheduleNote,/0h/);a.doesNotMatch(s.scheduleNote,/shortened to 2h/);
 const long=utils.buildSchedule(date('01T07:00'),date('02T11:30'),[],22,45,'stand',style,2);a.equal(long.coldTimingConflict,undefined);a.ok(long.totalColdHours>=long.requiredColdHours);
 }
});
test('piadina rests before its canonical rolling action and exposes identical guide time',()=>{
 const s=utils.buildSchedule(date('02T18:00'),date('02T19:00'),[],22,10,'hand','piadina',4);
 a.ok(+s.rollStart>+s.bulkFermStart);a.equal(+s.rollStart,+s.divideBallTime);a.equal(+s.rollStart,+s.bakeStart-10*60000);a.equal((+s.rollStart-+s.bulkFermStart)/3600000,s.restRtHours);
 a.equal(+s.availabilityActions.find(x=>x.id==='roll').at,+s.rollStart);
});
test('24-ball shaping budget is reserved before cold storage and detects its late conflicts',()=>{
 const make=blocks=>utils.buildSchedule(date('01T07:00'),date('02T19:30'),blocks,22,45,'stand','neapolitan',24);
 const s=make([]);a.equal(s.divisionMinutes,55);a.equal(+s.coldRetard2Start-+s.divideBallTime,55*60000);const work=s.availabilityActions.find(x=>x.id==='divide');a.equal(+work.end,+s.coldRetard2Start);
 // Canonical availability must consider the whole span, even beyond the old15min budget.
 const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');const blocks=[{from:new Date(+work.at+30*60000),to:new Date(+work.at+35*60000),label:'Work'}];a.equal(findAvailabilityConflicts([work],blocks)[0].action.id,'divide');
});

test('existing supported cold minima allow feasible recommendations without requiring preferred budgets',()=>{
 for(const [style,horizon] of [['brioche',10],['pain_mie',10],['pain_viennois',9]]){
 const start=date('02T07:00');const s=utils.buildSchedule(start,new Date(+start+horizon*3600000),[],22,45,'stand',style,2);
 a.equal(s.coldTimingConflict,undefined,style);a.notEqual(s.preparationInvalid,true,style);a.ok(s.totalColdHours>=utils.REQUIRED_COLD_MIN_HOURS[style]);
 }
});
