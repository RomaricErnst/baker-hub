const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
const now=Date.parse('2030-04-01T08:00Z'),start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
const base={start,bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:2,from:new Date(+bake-60*3600000),to:new Date(+bake-8*3600000),methodValid:true,now};
test('draft preview is read only and validates actual full action durations',()=>{
 const before=JSON.stringify(base),result=assessScheduleDraft(base);assert.equal(result.valid,true);assert.equal(JSON.stringify(base),before);
 const active=result.schedule.availabilityActions.find(a=>a.end&&+a.end>+a.at);assert.ok(active);
 const blocked=assessScheduleDraft({...base,blocks:[{from:new Date(+active.at+1000),to:new Date(+active.end),label:'Middle of action'}]});assert.equal(blocked.valid,false);assert.equal(blocked.reason,'busy');
});
test('out of range, missing method validation, and preferment action conflicts cannot be kept',()=>{
 assert.equal(assessScheduleDraft({...base,start:new Date(+bake-2*3600000)}).valid,false);
 assert.equal(assessScheduleDraft({...base,methodValid:false}).reason,'method');
 const at=new Date(+start-4*3600000);
 assert.equal(assessScheduleDraft({...base,extraActions:[{id:'preferment',at}],blocks:[{from:at,to:new Date(+at+60000),label:'Busy'}]}).reason,'busy');
});
