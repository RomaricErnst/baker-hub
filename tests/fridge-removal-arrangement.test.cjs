const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
const {getFinalFridgeRemoval,findAvailabilityConflicts,normalizeFridgeRemoval}=require('../app/utils/scheduleAvailability.ts');
const H=3600000;
const start=new Date('2030-04-02T18:00Z'),bake=new Date('2030-04-03T19:00Z');
const work={from:new Date('2030-04-03T09:00Z'),to:new Date('2030-04-03T18:00Z'),label:'Work'};
function input(blocks,extra={}){return {start,bake,blocks,kitchenTemp:24,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,from:new Date(+bake-120*H),to:new Date(+bake-H),methodValid:true,now:Date.parse('2030-04-01T08:00Z'),...extra};}
function arrange(blocks,schedule){const action=getFinalFridgeRemoval(schedule.availabilityActions);assert.ok(action);return blocks.map(b=>({...b,fridgeRemoval:{at:+action.at,bake:action.fridgeRemovalBake}}));}
function withoutArrangement(schedule){const {fridgeRemovalArranged,availabilityConflicts,...rest}=schedule;return rest;}

test('evening party: arranged final removal resolves work conflict without moving any phase',()=>{
 const before=assessScheduleDraft(input([work]));
 assert.equal(before.valid,false);assert.equal(before.conflict.id,'cold-out-2');
 const blocks=arrange([work],before.schedule),after=assessScheduleDraft(input(blocks));
 assert.equal(after.valid,true);assert.equal(after.schedule.fridgeRemovalArranged,true);
 assert.deepEqual(withoutArrangement(after.schedule),withoutArrangement(before.schedule));
 assert.deepEqual(blocks.map(({fridgeRemoval,...b})=>b),[work]);
 assert.equal(assessScheduleDraft(input([work])).valid,false,'Undo restores the conflict');
});

test('removal commitment cannot waive preheat, mixing, shaping or preferment',()=>{
 const before=assessScheduleDraft(input([work]));
 const arranged=arrange([work],before.schedule)[0];
 const tooLate={...arranged,to:new Date('2030-04-03T18:45Z')};
 const result=assessScheduleDraft(input([tooLate]));
 assert.equal(result.valid,false);assert.equal(result.conflict.id,'preheat');
 assert.equal(result.schedule.fridgeRemovalArranged,true,'covered action and invalid overall plan are distinct');
 const at=new Date(arranged.fridgeRemoval.at);
 for(const id of ['mix','divide','preheat','cold-out','preferment','preferment-cold-out']){
  assert.equal(findAvailabilityConflicts([{id,at,fridgeRemovalBake:+bake}],[arranged]).length,1,id);
 }
 assert.equal(assessScheduleDraft(input([arranged],{methodValid:false})).valid,false);
 assert.equal(assessScheduleDraft(input([arranged],{from:new Date(+start+H)})).valid,false);
});

test('exact action and bake identity survive serialization but changed times require confirmation',()=>{
 const before=assessScheduleDraft(input([work]));
 const [arranged]=arrange([work],before.schedule);
 const saved=JSON.parse(JSON.stringify(arranged));saved.from=new Date(saved.from);saved.to=new Date(saved.to);
 assert.equal(assessScheduleDraft(input([saved])).valid,true);
 const action=getFinalFridgeRemoval(before.schedule.availabilityActions);
 assert.equal(findAvailabilityConflicts([{...action,at:new Date(+action.at+60000)}],[saved]).length,1);
 assert.equal(findAvailabilityConflicts([{...action,fridgeRemovalBake:+bake+60000}],[saved]).length,1);
 assert.equal(findAvailabilityConflicts([{...action,end:new Date(+action.at+60000)}],[saved]).length,1,'not an active preparation span');
 for(const invalid of [null,{}, {at:'1',bake:2},{at:NaN,bake:+bake},{at:+bake,bake:+bake},{at:1,bake:Infinity}])assert.equal(normalizeFridgeRemoval(invalid),undefined);
});

test('every overlapping unavailable period must explicitly cover the same removal',()=>{
 const before=assessScheduleDraft(input([work]));
 const [arranged]=arrange([work],before.schedule);
 const second={...work,label:'Appointment'};
 const partial=assessScheduleDraft(input([arranged,second]));
 assert.equal(partial.valid,false);assert.equal(partial.schedule.fridgeRemovalArranged,false);
 assert.equal(partial.conflict.id,'cold-out-2');
 assert.equal(assessScheduleDraft(input(arrange([work,second],before.schedule))).valid,true);
});

test('all supported split-cold styles and climates keep exact protocol on acceptance',()=>{
 for(const styleKey of ['neapolitan','newyork','pizza_romana'])for(const kitchenTemp of [18,24,28,32]){
  const args=input([work],{styleKey,kitchenTemp});
  const before=assessScheduleDraft(args);
  const action=getFinalFridgeRemoval(before.schedule.availabilityActions);
  if(!action)continue;
  const after=assessScheduleDraft({...args,blocks:arrange([work],before.schedule)});
  assert.deepEqual(withoutArrangement(after.schedule),withoutArrangement(before.schedule),`${styleKey} ${kitchenTemp}`);
  assert.ok(!after.schedule.availabilityConflicts.some(c=>c.action.id==='cold-out-2'));
 }
});

test('single-phase bulk removal and room-temperature plans never offer this acknowledgement',()=>{
 for(const styleKey of ['baguette','brioche','piadina']){
  const schedule=utils.buildSchedule(start,bake,[work],24,45,'hand',styleKey,4);
  for(const action of schedule.availabilityActions.filter(a=>a.id==='cold-out'))assert.equal(action.fridgeRemovalBake,undefined);
 }
 const short=utils.buildSchedule(new Date(+bake-4*H),bake,[],24,45,'hand','neapolitan',4);
 assert.equal(getFinalFridgeRemoval(short.availabilityActions),undefined);
});
