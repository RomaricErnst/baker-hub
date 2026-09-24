const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {proposeScheduleEdit,laterBakeAlternative}=require('../app/utils/scheduleEdit.ts');
const H=3600000,now=Date.parse('2030-04-01T08:00Z'),start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
const input={id:'pref',at:new Date(+start-12*H),start,bake,prefHours:12,hasPreferment:true,prefWarmupHours:1,supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:2,window:b=>({from:new Date(+b-60*H),to:new Date(+b-8*H)}),methodValid:()=>true,now};
test('moving preferment moves mixing, retains its maturation and keeps fixed bake',()=>{
 const moved=new Date(+input.at+H),result=proposeScheduleEdit({...input,at:moved});
 assert.equal(result.valid,true);assert.equal(+result.times.start,+start+H);assert.equal(result.times.prefHours,12);assert.equal(+result.times.bake,+bake);
 assert.equal(+result.schedule.availabilityActions.find(a=>a.id==='mix').at,+start+H);
 assert.equal(+input.start,+start);
});
test('short target window stays invalid; later bake is an explicit separate proposal',()=>{
 const request={...input,at:new Date(+bake-13*H)};
 const failed=proposeScheduleEdit(request);assert.equal(failed.valid,false);assert.equal(failed.issue,'range');
 assert.equal(+failed.times.start,+bake-H);assert.equal(failed.times.prefHours,12);assert.equal(+failed.times.bake,+bake);
 const later=laterBakeAlternative(request);assert.ok(later?.valid);assert.ok(+later.times.bake>+bake);assert.equal(+later.times.start,+failed.times.start);assert.equal(+request.bake,+bake);
});
test('past date, unsupported protocol and busy preferment are distinct failures',()=>{
 assert.equal(proposeScheduleEdit({...input,at:new Date(now-1)}).issue,'past');
 assert.equal(proposeScheduleEdit({...input,supported:false}).issue,'unsupported');
 assert.equal(proposeScheduleEdit({...input,at:new Date(NaN)}).issue,'date');
 const result=proposeScheduleEdit({...input,blocks:[{from:input.at,to:new Date(+input.at+H),label:'Work'}]});
 assert.equal(result.issue,'busy');assert.equal(result.conflict,'preferment');
});
test('mixing moves the dependent preferment too, never squeezing its maturation',()=>{
 const result=proposeScheduleEdit({...input,id:'mix',at:new Date(+start+H)});
 assert.equal(result.valid,true);assert.equal(result.times.prefHours,12);assert.equal(+result.times.bake,+bake);
 assert.equal(proposeScheduleEdit({...input,id:'mix',at:new Date(now+H)}).issue,'past');
});
test('midnight moves retain exact dates and warmup availability is checked',()=>{
 const result=proposeScheduleEdit({...input,at:new Date('2030-04-02T23:45Z')});
 assert.equal(result.times.start.toISOString(),'2030-04-03T11:45:00.000Z');
 const at=new Date(+start-H);
 assert.equal(proposeScheduleEdit({...input,blocks:[{from:at,to:new Date(+at+60000),label:'Call'}]}).conflict,'preferment-cold-out');
});
