const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {findFixedBakeSchedule,validateScheduleCandidate,proposeScheduleEdit}=require('../app/utils/scheduleEdit.ts');
const H=3600000,now=Date.parse('2030-04-01T08:00Z'),start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
const base={id:'mix',at:start,start,bake,prefHours:12,hasPreferment:true,prefWarmupHours:0,prefWindow:{min:8,max:18},supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:2,window:b=>({from:new Date(+b-60*H),to:new Date(+b-8*H)}),methodValid:()=>true,now};
test('fixed bake search repairs blockers and validates dependent actions together',()=>{
 const input={...base,blocks:[{from:new Date(+start-H),to:new Date(+start+2*H),label:'Work'}]};
 assert.equal(validateScheduleCandidate(input).valid,false);
 const result=findFixedBakeSchedule(input);assert.equal(result.found,true);assert.equal(+result.candidate.times.bake,+bake);
 assert.equal(validateScheduleCandidate(input,result.candidate.times).valid,true);
 assert.notEqual(+result.candidate.times.start,+start);
 assert.equal(+result.candidate.schedule.availabilityActions.find(a=>a.id==='mix').at,+result.candidate.times.start);
});
test('search jointly changes maturation while preserving an explicit mixing choice',()=>{
 const pref=new Date(+start-12*H),input={...base,blocks:[{from:new Date(+pref-H),to:new Date(+pref+H),label:'Away'}]};
 const result=findFixedBakeSchedule(input,{mix:start});assert.equal(result.found,true);
 assert.equal(+result.candidate.times.start,+start);assert.notEqual(result.candidate.times.prefHours,12);
 assert.equal(+result.candidate.times.bake,+bake);
});
test('search never silently releases blocked explicit pins',()=>{
 const input={...base,blocks:[{from:start,to:new Date(+start+H),label:'Away'}]};
 const result=findFixedBakeSchedule(input,{mix:start,preferment:new Date(+start-12*H)});
 assert.equal(result.found,false);assert.equal(result.exhausted,true);
 assert.equal(+result.candidate.times.start,+start);assert.equal(+result.candidate.times.bake,+bake);
});
test('exact availability end is searched outside the quarter-hour grid',()=>{
 const end=new Date(+start+7*60000),input={...base,hasPreferment:false,prefHours:0,prefWindow:undefined,
  window:()=>({from:start,to:new Date(+end+60000)}),blocks:[{from:start,to:end,label:'Away'}]};
 const result=findFixedBakeSchedule(input);assert.equal(result.found,true);assert.equal(+result.candidate.times.start,+end);
});
test('method rejection remains rejection; no storage or biology fallback',()=>{
 let calls=0;const input={...base,window:()=>({from:start,to:new Date(+start+H)}),methodValid:()=>{calls++;return false;}};
 const result=findFixedBakeSchedule(input);assert.equal(result.found,false);assert.equal(result.exhausted,true);assert.ok(calls>1);
});
test('moving mix preserves an explicitly pinned preferment time',()=>{
 const pref=new Date(+start-12*H),result=proposeScheduleEdit({...base,at:new Date(+start+H),pins:{mix:start,preferment:pref}});
 assert.equal(result.valid,true);assert.equal(+result.times.start-result.times.prefHours*H,+pref);assert.equal(result.times.prefHours,13);
});
test('exact validator returns full candidate but refuses a past extra action',()=>{
 const result=validateScheduleCandidate({...base,extraActions:[{id:'required-feed',at:new Date(now-60000)}]});
 assert.equal(result.valid,false);assert.equal(result.issue,'timing');assert.ok(result.schedule);
});
test('a rounded off-grid baking agenda is not a valid fixed-time candidate',()=>{
 const input={...base,bake:new Date(+bake+7*60000)};
 const result=validateScheduleCandidate(input);assert.equal(result.valid,false);assert.equal(result.issue,'timing');
 assert.equal(+result.times.bake,+input.bake);assert.notEqual(+result.schedule.bakeStart,+input.bake);
});
test('a complete blocked supported window reports bounded search exhaustion',()=>{
 const input={...base,window:()=>({from:start,to:new Date(+start+H)}),blocks:[{from:new Date(+start-24*H),to:bake,label:'Unavailable'}]};
 const result=findFixedBakeSchedule(input);assert.equal(result.found,false);assert.equal(result.exhausted,true);
 assert.equal(+result.candidate.times.bake,+bake);
});
test('duration overlap rejects an otherwise clear action start and search repairs it',()=>{
 const original=validateScheduleCandidate(base),span=original.schedule.availabilityActions.find(a=>a.end&&+a.end>+a.at);assert.ok(span);
 const input={...base,blocks:[{from:new Date(+span.at+60000),to:new Date(+span.end+60000),label:'Call'}]};
 assert.equal(validateScheduleCandidate(input).valid,false);
 const result=findFixedBakeSchedule(input);assert.equal(result.found,true);assert.equal(+result.candidate.times.bake,+bake);
 assert.equal(validateScheduleCandidate(input,result.candidate.times).valid,true);
});
test('explicit baking edit never silently replaces an existing mixing pin',()=>{
 const requested=new Date('2030-04-02T15:00Z');
 const result=proposeScheduleEdit({...base,id:'bake',at:requested,pins:{mix:start}});
 assert.equal(result.valid,false);assert.equal(+result.times.start,+start);assert.equal(+result.times.bake,+requested);
});
test('automatic preferment search provides future planning lead instead of exact-now expiry',()=>{
 const fixedNow=Date.parse('2026-09-25T00:49Z'),mix=new Date('2026-09-25T12:00Z'),target=new Date('2026-09-26T11:30Z');
 const input={...base,now:fixedNow,start:mix,at:mix,bake:target,prefHours:11,prefWindow:{min:10,max:18},blocks:[{from:new Date('2026-09-25T01:00Z'),to:new Date('2026-09-25T10:00Z'),label:'Work'}]};
 const result=findFixedBakeSchedule(input);assert.equal(result.found,true);
 assert.ok(+result.candidate.times.start-result.candidate.times.prefHours*H>=Date.parse('2026-09-25T01:00Z'));
 assert.equal(validateScheduleCandidate({...input,now:fixedNow+1000},result.candidate.times).valid,true);
});
