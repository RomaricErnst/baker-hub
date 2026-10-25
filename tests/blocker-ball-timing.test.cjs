const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const {validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
const H=3600000,M=60000;
const date=s=>new Date(s);
function weeklyBlocks(){
 const blocks=[];
 for(let day=25;day<=30;day++){
  if(day>=26)blocks.push({from:date(`2026-10-${day}T09:00Z`),to:date(`2026-10-${day}T18:00Z`),label:'Work'});
  blocks.push({from:date(`2026-10-${day}T23:00Z`),to:date(`2026-10-${day+1}T07:00Z`),label:'Night'});
 }
 return blocks;
}
function input(start,bake,blocks,kitchenTemp=24,styleKey='neapolitan',numItems=4){
 return {id:'mix',at:start,start,bake,blocks,kitchenTemp,styleKey,numItems,preheatMin:45,mixerType:'hand',now:Date.parse('2026-10-20T00:00Z'),prefHours:0,hasPreferment:false,prefWarmupHours:0,supported:true,window:b=>({from:new Date(+b-120*H),to:new Date(+b-H)}),methodValid:()=>true};
}
function build(i){return utils.buildSchedule(i.start,i.bake,i.blocks,i.kitchenTemp,i.preheatMin,i.mixerType,i.styleKey,i.numItems);}
function near(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-8,`${message}: ${actual} vs ${expected}`);}

test('Thursday balling is repaired independently of genuinely blocked Friday finishing actions',()=>{
 const i=input(date('2026-10-29T18:00Z'),date('2026-10-30T18:00Z'),weeklyBlocks());
 const s=build(i), baseline=build({...i,blocks:[]});
 assert.ok(+s.divideBallTime<+date('2026-10-29T23:00Z'));
 assert.ok(+s.coldRetard2Start<+date('2026-10-29T23:00Z'),'finish balling and refrigerate before night starts');
 const conflicts=s.availabilityConflicts.map(c=>c.action.id);
 assert.ok(!conflicts.includes('divide')&&!conflicts.includes('cold-out')&&!conflicts.includes('cold-in-2'));
 assert.ok(conflicts.includes('cold-out-2'),'final warming must not silently move into an invalid long room proof');
 assert.ok(conflicts.includes('preheat'));
 assert.equal(validateScheduleCandidate(i).valid,false,'partial repair must not turn the whole schedule green');
 assert.equal(+s.bakeStart,+i.bake);
 assert.equal(+s.coldRetard2End,+baseline.coldRetard2End);
 near(s.totalColdHours,baseline.totalColdHours,'reallocate rather than delete cold maturation');
 near(s.totalRTHours,baseline.totalRTHours,'no added warm fermentation');
 assert.deepEqual(s.availabilityActions.filter(a=>a.id.startsWith('fold-')),baseline.availabilityActions.filter(a=>a.id.startsWith('fold-')));
});

test('a fully blocked handling window remains a conflict instead of being declared repaired',()=>{
 const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T18:00Z');
 const i=input(start,bake,[{from:date('2026-10-29T19:00Z'),to:bake,label:'Away'}]);
 const result=validateScheduleCandidate(i);
 assert.equal(result.valid,false);
 assert.ok(result.schedule.availabilityConflicts.length);
});

// This is a software invariant sweep, not experimental proof of fermentation
// quality. Recipe-specific biological acceptance remains the caller's job.
for(const style of ['neapolitan','newyork','pizza_romana','baguette','focaccia','brioche','piadina']){
 test(`${style}: every bake hour, 2–120h lead, four climates preserves schedule invariants`,()=>{
  let scenarios=0;
  for(let hour=0;hour<24;hour++)for(const lead of [2,4,6,12,24,48,72,120])for(const temp of [18,24,28,32]){
   const bake=date(`2026-10-30T${String(hour).padStart(2,'0')}:00Z`),start=new Date(+bake-lead*H);
   const i=input(start,bake,weeklyBlocks(),temp,style),s=build(i);
   const context=`${style} bake${hour} lead${lead} temp${temp}`;
   assert.equal(+s.bakeStart,+bake,context);
   assert.ok(Number.isFinite(s.totalColdHours)&&s.totalColdHours>=0,context);
   assert.ok(Number.isFinite(s.totalRTHours)&&s.totalRTHours>=0,context);
   assert.deepEqual(s.availabilityConflicts,findAvailabilityConflicts(s.availabilityActions,i.blocks),context);
   for(const action of s.availabilityActions){
    assert.ok(Number.isFinite(+action.at),`${context} ${action.id}`);
    if(action.end)assert.ok(+action.end>=+action.at,`${context} negative ${action.id}`);
   }
   if(!s.preparationInvalid){
    assert.ok(+s.bulkFermStart<=+s.bakeStart,context);
    assert.ok(+s.divideBallTime+s.divisionMinutes*M<=+s.bakeStart,context);
    if(s.coldRetard2Start){
     assert.ok(+s.coldRetard1End>=+s.coldRetard1Start,context);
     assert.ok(+s.coldRetard2End>=+s.coldRetard2Start,context);
     assert.equal(+s.coldRetard2Start-+s.divideBallTime,s.divisionMinutes*M,context);
     near(s.totalColdHours,(+s.coldRetard1End-+s.coldRetard1Start+ +s.coldRetard2End-+s.coldRetard2Start)/H,context);
    }
   }
   const result=validateScheduleCandidate(i);
   if(s.availabilityConflicts.length)assert.equal(result.valid,false,context);
   const unblocked=build({...i,blocks:[]});
   const irrelevant=build({...i,blocks:[{from:new Date(+start-2*H),to:new Date(+start-H),label:'Before preparation'}]});
   assert.deepEqual(irrelevant,unblocked,`${context}: irrelevant blockers must not change protocol`);
   scenarios++;
  }
  assert.equal(scenarios,768);
 });
}


test('earlier division checks the whole handling span and refrigeration against a blocker boundary',()=>{
 const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T18:00Z');
 for(const style of ['neapolitan','newyork','pizza_romana'])for(const mixer of ['hand','stand','spiral','no_knead'])for(const items of [2,4,12,30]){
  const i={...input(start,bake,[],24,style,items),mixerType:mixer};
  const baseline=build(i);
  if(!baseline.coldRetard2Start)continue;
  const blocks=[{from:new Date(+baseline.divideBallTime-10*M),to:new Date(+baseline.coldRetard2Start+8*H),label:'Unavailable'}];
  const changed=build({...i,blocks});
  const context=`${style} ${mixer} ${items} pizzas`;
  assert.ok(+changed.divideBallTime<+baseline.divideBallTime,context);
  assert.ok(+changed.coldRetard2Start<+blocks[0].from,`${context}: must finish and put balls away before blocker`);
  assert.ok(!changed.availabilityConflicts.some(c=>['divide','cold-out','cold-in-2'].includes(c.action.id)),context);
  assert.equal(+changed.bakeStart,+baseline.bakeStart,context);
  assert.equal(+changed.coldRetard2End,+baseline.coldRetard2End,context);
  near(changed.totalColdHours,baseline.totalColdHours,context);
  near(changed.totalRTHours,baseline.totalRTHours,context);
 }
});

test('a late free shaping slot is not a repair when it leaves less than the required shaped cold rest',()=>{
 const i=input(date('2026-10-29T08:00Z'),date('2026-10-30T12:00Z'),[],24);
 const baseline=build(i);
 const blocks=[
  {from:i.start,to:new Date(+baseline.coldRetard2End-H),label:'Away until late'},
  {from:new Date(baseline.coldRetard2End),to:i.bake,label:'Unavailable for final warming'},
 ];
 const s=build({...i,blocks});
 assert.equal(+s.divideBallTime,+baseline.divideBallTime,'retain an explicit conflict instead of offering too-short shaped cold rest');
 assert.ok(s.availabilityConflicts.some(c=>c.action.id==='divide'));
 assert.equal(validateScheduleCandidate({...i,blocks}).valid,false);
});
