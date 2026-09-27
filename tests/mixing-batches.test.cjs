const{test}=require('node:test'),a=require('node:assert/strict');require('./load-production.cjs');const{mixingBatchPlan}=require('../app/utils/mixingBatches.ts');
const base={flour:1001,water:651,salt:21,oil:15,sugar:9,totalDough:1697.17,yeast:{convertedGrams:.17}};
test('batch quantities conserve ingredients including small yeast and final remainder',()=>{const plans=[0,1,2].map(i=>mixingBatchPlan(base,'stand',3,i));for(const key of ['flour','water','salt','oil','sugar','yeast'])a.ok(Math.abs(plans.reduce((s,p)=>s+p.portion[key],0)-(key==='yeast'?.17:base[key]))<1e-9);a.equal(plans[0].portion.flour,333);a.equal(plans[2].portion.flour,335)});
test('starter and preferment are counted once in final mix',()=>{const sd={...base,sourdough:{starterGramsMid:200}};let p=mixingBatchPlan(sd,'stand',2);a.equal(p.portion.flour,450);a.equal(p.portion.water,275);a.equal(p.portion.starter,100);a.equal(p.portion.yeast,0);p=mixingBatchPlan({...base,preferment:{finalFlour:801,finalWater:451,prefFlour:200,prefWater:200,prefYeastGrams:.2}},'stand',2);a.equal(p.portion.preferment,200.1);a.equal(p.portion.yeast,0)});
test('small dough stays one batch; capacity warning survives override',()=>{a.equal(mixingBatchPlan({...base,totalDough:500},'stand').count,1);const p=mixingBatchPlan({...base,flour:10000,totalDough:11000},'stand',1);a.ok(p.suggested>1);a.ok(p.overCapacity)});


test('optional real mixer capacity controls the same batch recommendation and warnings',()=>{
 const {mixerDoughCapacity}=require('../app/utils/mixingBatches.ts');
 a.equal(mixerDoughCapacity('spiral',12000),12000);
 a.equal(mixerDoughCapacity('stand',NaN),1500);
 a.equal(mixerDoughCapacity('stand',0),1500);
 a.equal(mixingBatchPlan({...base,totalDough:6000},'spiral',undefined,0,12000).count,1);
 a.equal(mixingBatchPlan({...base,totalDough:6000},'spiral',undefined,0,2000).count,3);
});
test('one, three and five sequential batches reserve their full mixing window and retain earliest fermentation exposure',()=>{
 const {utils}=require('./load-production.cjs');
 const start=new Date('2026-09-28T07:00:00Z'),bake=new Date('2026-09-28T19:30:00Z');
 for(const count of [1,3,5]){
  const s=utils.buildSchedule(start,bake,[],22,45,'stand','neapolitan',24,count);
  a.equal(s.mixingDurationH*60,11*count);
  a.equal(+s.bulkFermStart,+start+11*count*60000);
  a.equal(s.batchMixWindows.length,count);
  a.equal(+s.firstBatchReadyAt,+start+11*60000);
  a.equal(+s.batchMixWindows.at(-1).end,+s.bulkFermStart);
  a.ok(Math.abs(s.totalRTHours+s.totalColdHours-(+s.bakeStart-+s.firstBatchReadyAt)/3600000)<1e-9);
  const offsets=require('../app/utils/scheduleFolds.ts').scheduledFoldMinutes(s.bulkFermHours,'neapolitan');
  for (const fold of s.availabilityActions.filter(x=>x.id.startsWith('fold'))) {
   const [,number,lot='1']=/^fold-(\d+)(?:-batch-(\d+))?$/.exec(fold.id);
   a.equal(+fold.at,+s.batchMixWindows[Number(lot)-1].end+offsets[Number(number)-1]*60000);
  }
  if(s.batchTimingConflict) a.equal(+s.availabilityActions.find(x=>x.id==='fold-1').at,+s.batchTimingConflict.firstFoldAt);
 }
});
test('later-batch work conflicts cannot be hidden by a clear first batch',()=>{
 const {utils}=require('./load-production.cjs');
 const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
 const start=new Date('2026-09-28T07:00:00Z'),bake=new Date('2026-09-28T19:30:00Z');
 const blocks=[{from:new Date('2026-09-28T07:15:00Z'),to:new Date('2026-09-28T07:20:00Z'),label:'Work'}];
 const one=utils.buildSchedule(start,bake,blocks,22,45,'stand','neapolitan',24,1);
 const five=utils.buildSchedule(start,bake,blocks,22,45,'stand','neapolitan',24,5);
 a.equal(one.availabilityConflicts.length,0);
 a.equal(five.availabilityConflicts[0].action.id,'mix-batch-2');
 a.equal(+five.availabilityConflicts[0].action.at,+start+11*60000);
 const candidate=assessScheduleDraft({start,bake,blocks,kitchenTemp:22,preheatMin:45,mixerType:'stand',styleKey:'neapolitan',numItems:24,mixingBatches:5,from:new Date(+start-3600000),to:new Date(+start+3600000),methodValid:true,now:+start-3600000});
 a.equal(candidate.valid,false);a.equal(candidate.reason,'busy');
});
test('sequential autolyse keeps passive gaps available and repeats actual active spans',()=>{
 const {utils}=require('./load-production.cjs');
 const start=new Date('2026-09-28T07:00:00Z'),bake=new Date('2026-09-28T19:30:00Z');
 const s=utils.buildSchedule(start,bake,[],22,45,'hand','roman',12,3);
 a.equal(s.batchMixWindows.length,3);
 const active=s.availabilityActions.filter(x=>x.id.startsWith('mix'));
 a.equal(active.length,6);
 for(let i=0;i<3;i++){a.equal(+active[i*2].at,+s.batchMixWindows[i].start);a.equal(+active[i*2+1].end,+s.batchMixWindows[i].end);a.ok(+active[i*2].end<+active[i*2+1].at);}
});

test('unleavened multi-batch plan preserves the covered rest rather than squeezing it',()=>{
 const {utils}=require('./load-production.cjs');
 const bake=new Date('2026-09-28T19:30:00Z');
 const short=utils.buildSchedule(new Date(+bake-45*60000),bake,[],22,10,'hand','piadina',24,5);
 a.equal(short.preparationInvalid,true);
 const s=utils.buildSchedule(new Date(+bake-65*60000),bake,[],22,10,'hand','piadina',24,5);
 a.equal(s.preparationInvalid,false);a.equal(s.restRtHours*60,30);a.equal(s.totalRTHours,0);
 a.equal(s.batchMixWindows.length,5);
});

test('shared batch plan never approves a first-lot fold missed while later lots mix',()=>{
 const {utils}=require('./load-production.cjs');
 const start=new Date('2026-09-28T07:00:00Z'),bake=new Date('2026-09-28T19:30:00Z');
 const two=utils.buildSchedule(start,bake,[],22,45,'stand','neapolitan',8,2);
 a.equal(two.batchTimingConflict,undefined);
 const five=utils.buildSchedule(start,bake,[],22,45,'stand','neapolitan',24,5);
 a.equal(five.preparationInvalid,true);
 a.equal(+five.batchTimingConflict.firstFoldAt,+start+41*60000);
 a.equal(+five.batchTimingConflict.mixingEnd,+start+55*60000);
});

test('last batch must still start inside the supported method window',()=>{
 const {assessScheduleDraft}=require('../app/utils/scheduleDraft.ts');
 const start=new Date('2026-09-28T07:00:00Z'),bake=new Date('2026-09-28T19:30:00Z');
 const candidate=assessScheduleDraft({start,bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'stand',styleKey:'neapolitan',numItems:8,mixingBatches:2,from:new Date(+start-3600000),to:new Date(+start+5*60000),methodValid:true,now:+start-3600000});
 a.equal(candidate.valid,false);a.equal(candidate.reason,'range');
});
test('shared preferment must remain within its existing window for the final mixer load',()=>{
 const {validateScheduleCandidate}=require('../app/utils/scheduleEdit.ts');
 const H=3600000,start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T18:00Z');
 const input={id:'mix',at:start,start,bake,prefHours:12,hasPreferment:true,prefWarmupHours:0,prefWindow:{min:8,max:12.1},supported:true,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'stand',styleKey:'neapolitan',numItems:8,mixingBatches:2,window:b=>({from:new Date(+b-60*H),to:new Date(+b-8*H)}),methodValid:()=>true,now:+start-20*H};
 const result=validateScheduleCandidate(input);
 a.equal(result.valid,false);a.equal(result.issue,'preferment');
});
