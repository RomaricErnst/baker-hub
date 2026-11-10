const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {earliestQuarterStart,quarterStartNoEarlier,soonStartLabel}=require('../app/utils/startNotice.ts');
const {findFixedBakeSchedule}=require('../app/utils/scheduleEdit.ts');
const H=3600000,Q=15*60000;

test('proposed starts use the quarter-hour grid, at least 15 minutes from now',()=>{
 const now=new Date(2026,10,10,11,14,20).getTime();
 assert.equal(earliestQuarterStart(now),new Date(2026,10,10,11,30).getTime());
 assert.equal(earliestQuarterStart(new Date(2026,10,10,11,15).getTime()),new Date(2026,10,10,11,30).getTime());
 // "now + 30 min" rounds to the grid; never earlier than now + 15 min.
 assert.equal(quarterStartNoEarlier(now+30*60000,now),new Date(2026,10,10,11,45).getTime());
 assert.equal(quarterStartNoEarlier(now-H,now),new Date(2026,10,10,11,30).getTime());
});

test('a start within two hours says how soon, in both languages',()=>{
 const now=new Date(2026,10,10,11,14).getTime(),at=new Date(2026,10,10,11,45);
 assert.equal(soonStartLabel(at,now,'en'),'today 11:45am · in 30 min');
 assert.equal(soonStartLabel(at,now,'fr'),'aujourd’hui 11h45 · dans 30 min');
 assert.equal(soonStartLabel(new Date(2026,10,10,12,45),now,'en'),'today 12:45pm · in 1h 30m');
 assert.equal(soonStartLabel(new Date(2026,10,10,12,45),now,'fr'),'aujourd’hui 12h45 · dans 1 h 30');
 // Later than two hours, or already past: the usual date and time instead.
 assert.equal(soonStartLabel(new Date(2026,10,10,13,30),now,'en'),null);
 assert.equal(soonStartLabel(new Date(2026,10,10,11,0),now,'en'),null);
 // Across midnight it is tomorrow.
 assert.equal(soonStartLabel(new Date(2026,10,11,0,15),new Date(2026,10,10,23,20).getTime(),'en'),'tomorrow 12:15am · in 55 min');
});

test('an automatic start off the grid ("now + 30 min") is searched onto a quarter hour',()=>{
 const now=new Date(2026,10,10,11,14,20).getTime(),start=new Date(now+30*60000),bake=new Date(now+9.75*H);
 const input={id:'mix',at:start,start,bake,prefHours:0,hasPreferment:false,prefWarmupHours:0,supported:true,blocks:[],
  kitchenTemp:24,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,
  window:b=>({from:new Date(+b-60*H),to:new Date(+b-8*H)}),methodValid:()=>true,now};
 const result=findFixedBakeSchedule(input);
 assert.equal(result.found,true);
 assert.equal(+result.candidate.times.start%Q,0);
 assert.ok(+result.candidate.times.start>=now+15*60000);
 assert.equal(+result.candidate.times.start,new Date(2026,10,10,11,45).getTime());
 // An explicit mixing time is the baker's, on or off the grid.
 const pinned=findFixedBakeSchedule(input,{mix:start});
 assert.equal(+pinned.candidate.times.start,+start);
});

test('short notice: a start two hours out is preferred when it still fits the bake',()=>{
 const now=new Date(2026,10,10,11,14,20).getTime(),start=new Date(now+30*60000),bake=new Date(2026,10,11,10,0);
 const input={id:'mix',at:start,start,bake,prefHours:0,hasPreferment:false,prefWarmupHours:0,supported:true,blocks:[],
  kitchenTemp:24,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,
  window:b=>({from:new Date(+b-34*H),to:new Date(+b-8*H)}),methodValid:()=>true,now};
 const result=findFixedBakeSchedule(input);
 assert.equal(result.found,true);
 assert.equal(+result.candidate.times.start,new Date(2026,10,10,13,15).getTime());
 // The baker's own early start stays.
 assert.equal(+findFixedBakeSchedule(input,{mix:new Date(2026,10,10,11,30)}).candidate.times.start,new Date(2026,10,10,11,30).getTime());
 // When two hours out no longer fits (latest start 1 pm), the first quarter hour is used.
 const tight=findFixedBakeSchedule({...input,start:new Date(2026,10,10,11,30),at:new Date(2026,10,10,11,30),bake:new Date(2026,10,10,21,0)});
 assert.equal(+tight.candidate.times.start,new Date(2026,10,10,11,30).getTime());
});
