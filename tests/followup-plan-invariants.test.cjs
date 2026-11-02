const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const hour=3600000,now=Date.parse('2030-04-01T00:00Z');
function input(overrides={}){
 const start=new Date(now+8*hour),bake=new Date(now+36*hour);
 return {start,bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,from:new Date(now+hour),to:new Date(+bake-hour),methodValid:true,now,...overrides};
}
test('every accepted draft has ordered preparation, useful cold stages and available actions across 900 scenarios',()=>{
 let accepted=0,rejected=0;
 for(const styleKey of ['neapolitan','newyork','baguette','pain_levain','sourdough'])for(const kitchenTemp of [18,22,26,30,33])for(const horizon of [4,8,12,24,36,48])for(const hourOfDay of [0,7,12,18,20,23]){
  const start=new Date(now+(24+hourOfDay)*hour),bake=new Date(+start+horizon*hour);
  const blocks=[{from:new Date(now+33*hour),to:new Date(now+42*hour),label:'Work'}];
  const request=input({start,bake,from:new Date(+start-hour),to:new Date(+bake-hour),styleKey,kitchenTemp,blocks,isSourdough:['pain_levain','sourdough'].includes(styleKey)});
  const result=assessScheduleDraft(request);
  if(!result.valid){
   rejected++;
   const schedule=result.schedule;
   assert.ok(schedule && (schedule.availabilityConflicts.length || schedule.preparationInvalid || schedule.bulkConflict || schedule.coldExitConflict),
    'A clash-free schedule the builder supports must pass draft validation: '+JSON.stringify({styleKey,kitchenTemp,horizon,hourOfDay,reason:result.reason}));
   continue;
  }
  accepted++;const s=result.schedule;
  const ordered=[start,s.bulkFermStart,s.divideBallTime,s.finalProofStart,bake];
  for(let i=1;i<ordered.length;i++)assert.ok(+ordered[i]>=+ordered[i-1],JSON.stringify({styleKey,kitchenTemp,horizon,hourOfDay,ordered}));
  for(const [a,b] of [[s.coldRetard1Start,s.coldRetard1End],[s.coldRetard2Start,s.coldRetard2End]])if(a&&b){assert.ok(+b-+a>=hour);assert.ok(+a>=+start&&+b<=+bake);}
  for(const a of s.availabilityActions??[]){assert.ok(+a.at>=now&&+a.at<=+bake);}
  assert.equal(findAvailabilityConflicts(s.availabilityActions??[],blocks,now).length,0);
 }
 assert.ok(accepted>0,'The gate must accept feasible schedules');assert.ok(rejected>0,'The sweep must exercise rejected schedules');
 console.log({accepted,rejected,total:accepted+rejected});
});
test('intermediate feed inside work hours invalidates an otherwise feasible draft',()=>{
 const request=input();const at=new Date(+request.start-2*hour);
 const result=assessScheduleDraft({...request,extraActions:[{id:'starter-feed-1',at}],blocks:[{from:new Date(+at-hour),to:new Date(+at+hour),label:'Work'}]});
 assert.equal(result.valid,false);assert.equal(result.reason,'busy');
});
test('a future starter action after baking cannot be approved',()=>{
 const request=input();const result=assessScheduleDraft({...request,extraActions:[{id:'starter-feed-1',at:new Date(+request.bake+hour)}]});
 assert.equal(result.valid,false);
});
