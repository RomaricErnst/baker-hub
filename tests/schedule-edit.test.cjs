const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {proposeScheduleEdit,laterBakeAlternative,scheduleEditSlots}=require('../app/utils/scheduleEdit.ts');
const H=3600000,now=Date.parse('2030-04-01T08:00Z'),start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
const input={id:'pref',at:new Date(+start-12*H),start,bake,prefHours:12,hasPreferment:true,prefWarmupHours:1,supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:2,window:b=>({from:new Date(+b-60*H),to:new Date(+b-8*H)}),methodValid:()=>true,now};
test('poolish this afternoon keeps morning mixing with a blocked night',()=>{
 const start=new Date('2030-04-02T07:00Z'),bake=new Date('2030-04-02T18:00Z');
 const result=proposeScheduleEdit({...input,start,bake,at:new Date('2030-04-01T15:00Z'),prefHours:11,prefWarmupHours:0,prefWindow:{min:8,max:16},blocks:[{from:new Date('2030-04-01T23:00Z'),to:start,label:'Night'}]});
 assert.equal(result.valid,true);assert.equal(+result.times.start,+start);assert.equal(result.times.prefHours,16);assert.equal(+result.times.bake,+bake);
});
test('preferment-only editing preserves mixing and reports an insufficient maturity window',()=>{
 const result=proposeScheduleEdit({...input,at:new Date(+start-9*H),prefWindow:{min:10,max:18}});
 assert.equal(result.valid,false);assert.equal(result.issue,'preferment');assert.equal(+result.times.start,+start);assert.equal(result.times.prefHours,9);assert.equal(+result.times.bake,+bake);
});
test('moving mixing shifts preferment by the same delta',()=>{
 const result=proposeScheduleEdit({...input,id:'mix',at:new Date(+start+H),prefWindow:{min:10,max:18}});
 assert.equal(result.valid,true);assert.equal(result.times.prefHours,12);assert.equal(+result.times.start-result.times.prefHours*H,+input.at+H);
});
test('blocked requested preferment and impossible maturity remain invalid',()=>{
 const request={...input,prefWindow:{min:10,max:18}};
 assert.equal(proposeScheduleEdit({...request,blocks:[{from:input.at,to:new Date(+input.at+H),label:'Busy'}]}).issue,'busy');
 assert.equal(proposeScheduleEdit({...request,at:new Date(+bake-9*H)}).valid,false);
});
test('an explicitly earlier bake finds a compatible earlier mixing time',()=>{
 const requested=new Date(+start+7*H);
 const result=proposeScheduleEdit({...input,id:'bake',at:requested,prefWindow:{min:10,max:18}});
 assert.equal(result.valid,true);assert.equal(+result.times.bake,+requested);assert.ok(+result.times.start<+start);
});
test('preferment-only edit cannot silently move mixing to avoid a cold-out conflict',()=>{
 const start=new Date('2030-04-02T07:00Z'),bake=new Date('2030-04-02T18:00Z');
 const result=proposeScheduleEdit({...input,start,bake,at:new Date('2030-04-01T15:00Z'),prefWindow:{min:10,max:18},blocks:[{from:new Date('2030-04-01T23:00Z'),to:start,label:'Night'}]});
 assert.equal(result.valid,false);assert.equal(result.conflict,'preferment-cold-out');assert.equal(+result.times.start,+start);assert.equal(result.times.prefHours,16);
});
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

test('a rejected preferment still previews all downstream dough actions',()=>{
 const result=proposeScheduleEdit({...input,id:'mix',at:new Date(+start+2*H),prefWindow:{min:10,max:18},blocks:[{from:new Date(+input.at-10*H),to:new Date(+start),label:'Away'}]});
 assert.equal(result.valid,false);assert.ok(result.schedule);
 assert.equal(+result.schedule.availabilityActions.find(a=>a.id==='mix').at,+start+2*H);
});
test('green slots and Apply use the identical full-plan validation including downstream blocks',()=>{
 const request={...input,id:'mix',prefWindow:{min:10,max:18},blocks:[{from:new Date(+start+H),to:new Date(+start+3*H),label:'Busy'}]};
 const slots=scheduleEditSlots(request,'mix',+start,+start+5*H);
 assert.ok(slots.some(slot=>!slot.valid));
 for(const slot of slots)assert.equal(slot.valid,proposeScheduleEdit({...request,at:new Date(slot.at)}).valid);
});
