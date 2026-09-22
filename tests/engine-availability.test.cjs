const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {isTimeBlocked, actionConflicts, findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const date=s=>new Date(`2026-09-${s}Z`);
const block=(from,to)=>({from:date(from),to:date(to),label:'Busy'});
const input=(blocks=[],mixerType='hand')=>({startTime:date('27T16:00'),eatTime:date('28T18:00'),availabilityBlocks:blocks,kitchenTemp:22,preheatMin:60,mixerType,styleKey:'neapolitan',now:date('26T12:00')});
const build=i=>utils.buildSchedule(i.startTime,i.eatTime,i.availabilityBlocks,i.kitchenTemp,i.preheatMin,i.mixerType,i.styleKey);

test('availability has half-open points/spans and ignores completed history',()=>{
 const blocks=[block('27T16:00','27T17:00')];
 assert.equal(isTimeBlocked(date('27T16:00'),blocks),true);
 assert.equal(isTimeBlocked(date('27T17:00'),blocks),false);
 assert.equal(actionConflicts({id:'work',at:date('27T15:50'),end:date('27T16:00')},blocks),false);
 assert.equal(actionConflicts({id:'work',at:date('27T15:50'),end:date('27T16:01')},blocks),true);
 assert.equal(findAvailabilityConflicts([{id:'work',at:date('27T15:50'),end:date('27T16:01')}],blocks,+date('27T16:01')).length,0);
});

test('known mixing spans catch interruptions but passive autolyse stays free',()=>{
 const passive=build(input([block('27T16:05','27T16:30')]));
 assert.equal(passive.availabilityConflicts.length,0);
 const final=build(input([block('27T16:35','27T16:38')]));
 assert.ok(final.availabilityConflicts.some(c=>c.action.id==='mix-finish'));
 const machine=build(input([block('27T16:05','27T16:10')],'stand'));
 assert.ok(machine.availabilityConflicts.some(c=>c.action.id==='mix'));
 const plain=build(input());
 assert.equal(plain.mixingDurationH,40/60);
 assert.deepEqual(plain.availabilityActions.filter(a=>a.id.startsWith('mix')).map(a=>[a.at.toISOString(),a.end.toISOString()]),[
 ['2026-09-27T16:00:00.000Z','2026-09-27T16:02:00.000Z'],
 ['2026-09-27T16:32:00.000Z','2026-09-27T16:40:00.000Z'],
 ]);
 const noKnead=build(input([block('27T16:00','27T16:05')],'no_knead'));
 assert.ok(noKnead.availabilityConflicts.some(c=>c.action.id==='mix'&&!c.action.end));
});

test('split cold keeps both phases, scans shaping span, and only repairs affected exit',()=>{
 const plain=build(input());
 const passive=build(input([block('27T23:00','28T07:00')]));
 assert.equal(+plain.coldRetard2End,+passive.coldRetard2End);
 assert.equal(passive.availabilityConflicts.length,0);
 const shapeStart=plain.divideBallTime;
 const interrupted=build(input([{label:'Brief',from:new Date(+shapeStart+5*60000),to:new Date(+shapeStart+10*60000)}]));
 assert.ok(+interrupted.divideBallTime>+shapeStart);
 assert.equal(interrupted.availabilityConflicts.length,0);
 const exit=plain.coldRetard2End;
 const repaired=build(input([{label:'Brief',from:new Date(+exit-5*60000),to:new Date(+exit+30*60000)}]));
 assert.equal(+repaired.bakeStart,+plain.bakeStart);
 assert.ok(repaired.coldRetard1Start&&repaired.coldRetard2Start);
 assert.ok(+repaired.coldRetard2End>+exit);
 assert.equal(repaired.availabilityConflicts.length,0);
 assert.ok(+repaired.preheatStart-+repaired.finalProofStart>=3600000);
});

test('impossible same-bake cold exit stays a conflict; explicit repair is rebuilt and verified',()=>{
 const i=input([block('28T09:00','28T18:00')]);
 const unresolved=build(i);
 assert.ok(unresolved.availabilityConflicts.some(c=>c.action.id==='cold-out-2'));
 assert.equal(+unresolved.bakeStart,+i.eatTime);
 const repair=utils.findScheduleRepair(i);
 assert.ok(repair);
 assert.equal(repair.kind,'bake');
 assert.ok(+repair.eatTime>+i.eatTime);
 assert.equal(repair.schedule.availabilityConflicts.length,0);
 assert.ok(repair.schedule.coldRetard1Start&&repair.schedule.coldRetard2Start);
 assert.equal(+repair.schedule.bakeStart,+repair.eatTime);
});

test('repair checks every candidate against method constraints and declines all-busy plans',()=>{
 const i=input([block('27T16:05','27T16:10')],'stand');
 let inspected=0;
 const repair=utils.findScheduleRepair({...i,acceptCandidate:c=>{inspected++;return +c.startTime>=+i.startTime+30*60000;}});
 assert.ok(inspected>1);
 assert.ok(repair&&+repair.startTime>=+i.startTime+30*60000);
 assert.equal(repair.schedule.availabilityConflicts.length,0);
 assert.equal(+repair.eatTime,+i.eatTime);
 assert.equal(utils.findScheduleRepair({...i,acceptCandidate:()=>false}),null);
 assert.equal(utils.findScheduleRepair(input([block('26T00:00','31T23:59')])),null);
 assert.equal(utils.findScheduleRepair({...i,now:date('28T00:00')}),null);
});

test('overlapping periods and rounded timestamps never make a repair falsely clear',()=>{
 const i=input([block('28T13:40','28T14:07'),block('28T14:00','28T14:31')]);
 const s=build(i);
 assert.equal(s.availabilityConflicts.length,0);
 assert.equal(s.coldRetard2End.toISOString(),'2026-09-28T14:45:00.000Z');
 assert.equal(findAvailabilityConflicts(s.availabilityActions,i.availabilityBlocks).length,0);
});

test('late shaping and exit are solved jointly without sacrificing the second cold',()=>{
 const i=input([block('27T22:00','28T12:30')]);
 const s=build(i);
 assert.equal(s.availabilityConflicts.length,0);
 assert.equal(s.divideBallTime.toISOString(),'2026-09-28T12:30:00.000Z');
 assert.ok(+s.coldRetard2End-+s.coldRetard2Start>=2*3600000);
 assert.ok(+s.preheatStart-+s.finalProofStart>=3600000);
 assert.equal(+s.bakeStart,+i.eatTime);
 const impossible=build(input([block('27T22:00','28T15:00')]));
 assert.ok(impossible.coldRetard1Start&&impossible.coldRetard2Start);
 assert.ok(impossible.availabilityConflicts.some(c=>c.action.id==='divide'));
});

test('fridge return at a blocked boundary prevents accepting the preceding shaping slot',()=>{
 const i=input([block('27T22:30','27T22:45')]);
 const s=build(i);
 assert.equal(s.availabilityConflicts.length,0);
 assert.equal(s.divideBallTime.toISOString(),'2026-09-27T22:45:00.000Z');
 assert.equal(s.coldRetard2Start.toISOString(),'2026-09-27T23:00:00.000Z');
});

test('an ongoing active span checks only its remaining work and clear plans need no repair',()=>{
 const action={id:'mix',at:date('27T16:00'),end:date('27T16:10')};
 assert.equal(findAvailabilityConflicts([action],[block('27T16:01','27T16:04')],+date('27T16:05')).length,0);
 assert.equal(findAvailabilityConflicts([action],[block('27T16:06','27T16:08')],+date('27T16:05')).length,1);
 assert.equal(utils.findScheduleRepair(input()),null);
 assert.equal(utils.findScheduleRepair(input([block('27T16:02','27T16:32')])),null);
 const i=input([block('28T09:00','28T18:00')]);
 const repair=utils.findScheduleRepair({...i,allowStartShift:false,acceptCandidate:c=>+c.eatTime>=+date('28T21:00')});
 assert.ok(repair&&repair.kind==='bake');
 assert.equal(+repair.startTime,+i.startTime);
 assert.ok(+repair.eatTime>=+date('28T21:00'));
});
