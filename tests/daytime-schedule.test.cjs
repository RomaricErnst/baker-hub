const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {findFixedBakeSchedule}=require('../app/utils/scheduleEdit.ts');
const {selectedAvailabilityCount,profileBlocksForBake,recurringBlockEntries,chronologicalBlocks}=require('../app/utils/scheduleAvailability.ts');

test('preferment schedules across a week keep hands-on steps in available waking hours',()=>{
  for(const styleKey of ['neapolitan','baguette'])for(let d=1;d<=7;d++){
    const hour=3600000,bake=new Date(2026,10,d,19,30),now=+bake-48*hour;
    const start=new Date(+bake-18*hour);
    const input={id:'mix',at:start,start,bake,prefHours:11,hasPreferment:true,prefWarmupHours:0,
      prefWindow:{min:8,max:16},supported:true,window:()=>({from:new Date(+bake-30*hour),to:new Date(+bake-12*hour)}),
      methodValid:()=>true,now,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'stand',styleKey,numItems:4,preferDaytime:true};
    const result=findFixedBakeSchedule(input);
    assert.ok(result.found,styleKey);assert.equal(+result.candidate.times.bake,+bake);
    const actions=[...result.candidate.schedule.availabilityActions,{id:'preferment',at:new Date(+result.candidate.times.start-result.candidate.times.prefHours*hour)}];
    for(const action of actions)assert.ok(action.at.getHours()>=7&&action.at.getHours()<23,styleKey+' '+action.id+' '+action.at);
  }
});
test('unavailable times count actual chosen rules, including a covered override only once',()=>{
  assert.equal(selectedAvailabilityCount([{label:'Monday night'},{label:'Tuesday night'},{label:'Work · Monday'},
    {label:'Work · Tuesday',fridgeRemoval:{at:1,bake:2}},{label:'School pickup'}]),3);
});

test('profile and picker materialize the same work and sleep periods at local boundaries',()=>{
  const presets={work:{enabled:true,from:'10:00',to:'17:30'},sleep:{enabled:true,from:'23:30',to:'07:30'}};
  const target=new Date(2026,10,3,23,30);
  for(const hour of [1,7,14]){
    const now=new Date(2026,10,2,hour,30);
    const initial=profileBlocksForBake(now,target,presets);
    const work=initial.filter(b=>b.label.startsWith('Work · '));
    const readded=recurringBlockEntries('sleep',presets.sleep,now,target)
      .map(e=>({from:e.blockStart,to:e.blockEnd,label:e.label}));
    assert.deepEqual(chronologicalBlocks([...work,...readded]),initial);
    assert.ok(initial.every(b=>b.to>now));
    assert.equal(initial.some(b=>b.from<now&&b.to>now),hour===1||hour===14);
    assert.ok(initial.some(b=>+b.from===+target),'start boundary at cooking is blocked');
    assert.equal(selectedAvailabilityCount(initial),2);
  }
});
