const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {utils}=require('./load-production.cjs');
const {restStretchFactor,computeStarterPeakMs}=require('../app/utils/starterPeak.ts');
// 20 Nov 2026 retention round 6 (engine track). Times in UTC, any TZ.
const H=3600000,d=s=>new Date(s+'Z');
const picker=fs.readFileSync(require.resolve('../app/components/SchedulePicker.tsx'),'utf8');
const page=fs.readFileSync(require.resolve('../app/[locale]/page.tsx'),'utf8');

test('B3: one rest-stretch ladder for every first feed after a rest',()=>{
 // 19 °C, 1:1:1: adjPeakH 9.2 h, trough 16.6 h (getPrefPeakH_RT × 1.8).
 const adj=9.2,trough=16.6;
 assert.equal(restStretchFactor(4,adj,trough),1);
 assert.equal(restStretchFactor(12,adj,trough),1.05);
 assert.equal(restStretchFactor(16,adj,trough),1.15);
 assert.equal(restStretchFactor(20,adj,trough),1.25);
 assert.equal(restStretchFactor(40,adj,trough),1.35);
 assert.equal(restStretchFactor(108,adj,trough),1.5,'a starter fed 4–5 days ago, kept in the fridge');
 // A 5-day fridge starter fed 1:1:1 peaks 13.8 h later whichever kind of feed draws it.
 const feed=+d('2026-11-26T19:00');
 assert.ok(Math.abs((computeStarterPeakMs(feed,null,adj,restStretchFactor(108,adj,trough))-feed)/H-13.8)<1e-9);
 // The default keeps the established pre-mix model.
 assert.equal(computeStarterPeakMs(feed,null,adj),feed+adj*H);
 assert.equal(computeStarterPeakMs(feed,feed+H,adj),feed+adj*1.1*H,'fed an hour before the previous peak');
 assert.equal(computeStarterPeakMs(feed,feed+H,adj,1.05),feed+adj*1.1*H,'the larger stretch wins');
 // The solver has no private copy of the ladder left.
 assert.equal((picker.match(/troughH\w*\s*\*\s*2\.5\)\s*return 1\.35/g)||[]).length,0);
 assert.ok(/function withFirstFeedRest\(/.test(picker)&&/function firstIntermediateStretch\(/.test(picker));
});

test('B2: a clash and a recipe wait for the starter to be described',()=>{
 assert.ok(/const simpleConflicts=eatTimeSet&&starterDescribed&&/.test(picker),'no clash list before the starter is described');
 assert.ok(/const simpleDecision=eatTimeSet&&starterDescribed&&/.test(picker),'no decision card before the starter is described');
 // starterDescribed is declared before its first use (no temporal dead zone).
 assert.ok(picker.indexOf('const starterDescribed=')<picker.indexOf('const simpleConflicts='));
 assert.ok(/const starterPlanReady = yeastType !== 'sourdough' \|\| \(\(planningMode === 'know_peak' \? !!knownPeakTime : lastFedAge !== null && !!lastFedTime\)/.test(page));
 assert.ok(page.indexOf('const starterPlanReady')<page.indexOf('const starterStateDescribed'),'starterPlanReady reads state, not the later const');
});

// Thomas, Lyon (UTC+1): kneaded Thursday 21:00 local, 20 °C, 4 × 260 g Neapolitan, oven with a 60 min
// preheat, busy Thursday night 23:00–7:00 and Friday 9:00–19:00 local.
const blocks=[{label:'Thursday night',from:d('2026-12-03T22:00'),to:d('2026-12-04T06:00')},{label:'Work · Fri, Dec 4',from:d('2026-12-04T08:00'),to:d('2026-12-04T18:00')}];
const start=d('2026-12-03T19:30'),bake=d('2026-12-04T19:30');
const opts=extra=>({start,bake,blocks,kitchenTemp:20,preheatMin:60,mixerType:'hand',styleKey:'neapolitan',numItems:4,mixingBatches:1,isSourdough:false,...extra});

test('B4: out of the fridge at 19:00 after work, bake after the shortest warm-up (20:45)',()=>{
 const base=utils.buildSchedule(start,bake,blocks,20,60,'hand','neapolitan',4,1,false,1);
 assert.equal(+base.coldRetard2End,+d('2026-12-04T16:45'),'the 20:30 bake needs the dough out at 17:45, at work');
 const o=utils.shortWarmupOption(opts({before:d('2026-12-04T20:45')}));
 assert.ok(o,'the option exists between 20:30 and the later bake offered (21:45)');
 assert.equal(+o.exitAt,+d('2026-12-04T18:00'),'out at 19:00, when free');
 assert.equal(+o.bake,+d('2026-12-04T19:45'),'bake at 20:45');
 assert.equal(o.warmMin,105,'1 h 45 out of the fridge');
 const plan=utils.buildSchedule(start,o.bake,o.blocks,20,60,'hand','neapolitan',4,1,false,1);
 assert.equal(+plan.coldRetard2End,+o.exitAt);
 assert.equal(plan.finalProofHours,1,'the shortest final proof (minFinalRT)');
 assert.equal(+plan.rtWarmupEnd,+plan.preheatStart,'the warm-up ends as the oven is switched on');
 assert.equal(plan.availabilityConflicts.length,0);
 assert.ok(!plan.preparationInvalid);
 assert.equal(+plan.bulkFermStart,+base.bulkFermStart,'the mix and the rest of the dough stay');
 // Only for the bake it was chosen for: the flag on another bake changes nothing.
 const other=utils.buildSchedule(start,d('2026-12-04T20:30'),o.blocks,20,60,'hand','neapolitan',4,1,false,1);
 assert.deepEqual(other.coldRetard2End,utils.buildSchedule(start,d('2026-12-04T20:30'),blocks,20,60,'hand','neapolitan',4,1,false,1).coldRetard2End);
});

test('B4: no option when it would not bake earlier, or when the exit is free anyway',()=>{
 assert.equal(utils.shortWarmupOption(opts({before:d('2026-12-04T19:45')})),null,'not earlier than the later bake offered');
 assert.equal(utils.shortWarmupOption(opts({blocks:[blocks[0]]})),null,'the exit is not in busy time');
 assert.equal(utils.shortWarmupOption(opts({blocks:[]})),null);
});
