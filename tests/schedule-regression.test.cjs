const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const hours=(a,b)=>(b-a)/3600000;
test('proof and fermentation account for actual event intervals across schedule branches',()=>{
 const branches=new Set();
 for(const temp of [20,28,32,35])for(const style of ['neapolitan','pan','brioche','pain_levain'])for(const horizon of [3,8,26])for(const preheat of [15,60,90]){
  const start=new Date('2026-09-12T16:07:00Z'),eat=new Date(+start+horizon*3600000);
  const s=utils.buildSchedule(start,eat,[],temp,preheat,'hand',style);
  branches.add(s.coldRetard2Start?'two':s.coldRetardStart?'single':'rt');
  assert.equal(s.finalProofHours,Math.max(0,hours(s.finalProofStart,s.bakeStart)),`${style}/${temp}/${horizon}/${preheat}`);
  const cold=s.coldRetard2Start?Math.max(0,hours(s.coldRetard1Start,s.coldRetard1End))+Math.max(0,hours(s.coldRetard2Start,s.coldRetard2End)):s.coldRetardStart?Math.max(0,hours(s.coldRetardStart,s.coldRetardEnd)):0;
  assert.equal(s.totalColdHours,cold);
  assert.equal(s.totalRTHours,Math.max(0,hours(s.bulkFermStart,s.bakeStart)-cold));
 }
 assert.deepEqual([...branches].sort(),['rt','single','two']);
});
test('32C live regression includes warmup, proof during preheat and handling between cold phases',()=>{
 const s=utils.buildSchedule(new Date('2026-09-12T16:00Z'),new Date('2026-09-13T18:00Z'),[],32,60,'hand','neapolitan');
 assert.equal(s.finalProofHours,2);
 assert.equal(hours(s.rtWarmupStart,s.bakeStart),2.5);
 // Exact ten-minute hand mixing ends at16:10, not the rounded16:15.
 assert.ok(Math.abs(s.totalRTHours - (3 + 20/60)) < 1e-9);
 assert.equal(s.preheatStart.toISOString(),'2026-09-13T17:00:00.000Z');
 assert.equal(s.rtWarmupStart.toISOString(),'2026-09-13T15:30:00.000Z');
});
test('blockers and rounding do not erase elapsed RT exposure',()=>{
 const s=utils.buildSchedule(new Date('2026-09-12T16:07Z'),new Date('2026-09-13T18:07Z'),[
 {label:'Night',from:new Date('2026-09-12T23:00Z'),to:new Date('2026-09-13T07:00Z')},
 {label:'Busy',from:new Date('2026-09-13T14:00Z'),to:new Date('2026-09-13T16:00Z')},
 ],32,60,'spiral','pain_levain');
 assert.equal(s.finalProofHours,hours(s.finalProofStart,s.bakeStart));
 assert.ok(Math.abs(s.totalRTHours+s.totalColdHours-hours(s.bulkFermStart,s.bakeStart))<1e-9);
});
test('short cold windows never place proof or cold exit after bake',()=>{
 for(const [style,mixer] of [['pizza_romana','hand'],['baguette','spiral'],['brioche','hand']]){
  const start=new Date('2026-09-25T08:07:00Z');
  const horizon=style==='brioche'?1:2;
  const bake=new Date(+start+horizon*3600000);
  const s=utils.buildSchedule(start,bake,[],28,style==='brioche'?0:90,mixer,style);
  assert.ok(s.finalProofStart<=s.bakeStart,`${style}: proof after bake`);
  assert.ok(!s.coldRetardEnd||s.coldRetardEnd<=s.bakeStart,`${style}: cold exit after bake`);
  assert.match(s.scheduleNote||'',/Not enough time|Room-temperature/);
 }
});

test('bulk starts after every minute of mixing and autolyse, preserving canonical mix start',()=>{
 const branches=new Set();
 for(const style of ['pain_campagne','pain_levain','neapolitan','pan'])for(const mixer of ['hand','stand','spiral'])for(const horizon of [8,26]){
  const start=new Date('2026-09-21T23:00:00Z'),bake=new Date(+start+horizon*3600000);
  const s=utils.buildSchedule(start,bake,[],22,45,mixer,style);
  branches.add(s.coldRetard2Start?'two':s.coldRetardStart?'single':'rt');
  assert.equal(+s.bulkFermStart-s.mixingDurationH*3600000,+start,`${style}/${mixer}/${horizon}`);
  assert.ok(Math.abs(s.mixingDurationH+s.totalRTHours+s.totalColdHours-hours(start,s.bakeStart))<1e-9);
 }
 assert.deepEqual([...branches].sort(),['rt','single','two']);
 const country=utils.buildSchedule(new Date('2026-09-21T23:00Z'),new Date('2026-09-22T18:00Z'),[],22,45,'hand','pain_campagne');
 assert.equal(country.mixingDurationH,0.6);
 assert.equal(country.bulkFermStart.toISOString(),'2026-09-21T23:36:00.000Z');
});

test('short country-bread fallback never rounds proof before its full preparation window',()=>{
 const s=utils.buildSchedule(new Date('2026-09-21T23:00Z'),new Date('2026-09-22T00:00Z'),[],22,0,'hand','pain_campagne');
 assert.equal(s.bulkFermStart.toISOString(),'2026-09-21T23:36:00.000Z');
 assert.ok(s.finalProofStart>=s.bulkFermStart);
 assert.ok(s.divideBallTime>=s.bulkFermStart);
 assert.ok(Math.abs(s.mixingDurationH+s.totalRTHours-1)<1e-9);
});
