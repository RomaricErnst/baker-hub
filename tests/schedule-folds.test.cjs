const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {scheduledFoldMinutes}=require('../app/utils/scheduleFolds.ts');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const {validateScheduleCandidate,findFixedBakeSchedule}=require('../app/utils/scheduleEdit.ts');
const H=3600000,start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
test('fold offsets follow existing guide thresholds without inventing conditional bread folds',()=>{
 for(const [h,expected] of [[.49,[]],[.5,[15]],[1.49,[15]],[1.5,[30,60]],[1.99,[30,60]],[2,[30,60,90,120]]])assert.deepEqual(scheduledFoldMinutes(h,'neapolitan'),expected);
 for(const style of ['focaccia','ciabatta','piadina'])assert.deepEqual(scheduledFoldMinutes(3,style),[]);
});
test('canonical actions contain only the guide fold points inside bulk across schedule branches',()=>{
 for(const temp of [20,28,32])for(const horizon of [3,8,26])for(const mixer of ['hand','stand','spiral','no_knead']){
  const s=utils.buildSchedule(start,new Date(+start+horizon*H),[],temp,45,mixer,'neapolitan');
  const folds=s.availabilityActions.filter(a=>a.id.startsWith('fold-'));
  assert.deepEqual(folds.map(a=>(+a.at-+s.bulkFermStart)/60000),scheduledFoldMinutes(s.bulkFermHours,'neapolitan'));
  assert.ok(folds.every(a=>!a.end&&+a.at<=+s.bulkFermStart+s.bulkFermHours*H));
 }
});
test('an unavailable interval between folds does not truncate passive bulk or invalidate it',()=>{
 for(const horizon of [8,26]) {
  const target=new Date(+start+horizon*H);
  const initial=utils.buildSchedule(start,target,[],22,45,'hand','neapolitan');
  const blocks=[{from:new Date(+initial.bulkFermStart+5*60000),to:new Date(+initial.bulkFermStart+10*60000),label:'Brief call'}];
  const changed=utils.buildSchedule(start,target,blocks,22,45,'hand','neapolitan');
  assert.equal(changed.bulkConflict,null);assert.equal(changed.bulkFermHours,initial.bulkFermHours);
  assert.equal(+changed.coldRetard1Start,+initial.coldRetard1Start);
  assert.deepEqual(changed.availabilityConflicts,[]);assert.equal(+changed.bakeStart,+target);
 }
});
test('fold-only blocker invalidates complete candidate and joint search repairs it at fixed bake',()=>{
 const bake=new Date(+start+4*H);
 const input={id:'mix',at:start,start,bake,prefHours:0,hasPreferment:false,prefWarmupHours:0,supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',window:b=>({from:new Date(+b-60*H),to:new Date(+b-H)}),methodValid:()=>true,now:+start-H};
 const initial=validateScheduleCandidate(input);assert.equal(initial.valid,true);
 const fold=initial.schedule.availabilityActions.find(a=>a.id.startsWith('fold-'));assert.ok(fold);
 const blocks=[{from:new Date(initial.schedule.bulkFermStart),to:new Date(+fold.at+60000),label:'Call'}];
 assert.deepEqual(findAvailabilityConflicts(initial.schedule.availabilityActions,blocks).map(x=>x.action.id),[fold.id]);
 const blocked={...input,blocks},invalid=validateScheduleCandidate(blocked);
 assert.equal(invalid.valid,false);assert.equal(invalid.conflict,fold.id);
 const repaired=findFixedBakeSchedule(blocked);assert.equal(repaired.found,true);
 assert.equal(+repaired.candidate.times.bake,+bake);assert.equal(validateScheduleCandidate(blocked,repaired.candidate.times).valid,true);
 assert.equal(findFixedBakeSchedule(blocked,{mix:start}).found,false);
});
