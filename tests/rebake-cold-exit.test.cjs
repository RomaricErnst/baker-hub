const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
// Thomas, 17 Nov 2026 retention review: baguettes at 20 °C, poolish, nights 23:00–7:00 (here in UTC
// hours, any TZ: 22:00–06:00Z). A week later, baking one hour later (10:00Z instead of 9:00Z), the
// fridge exit stayed at 06:00Z and the counter time grew from 3 h to 4 h. That is the cold-exit rule:
// the night block ends at 06:00Z and the engine's natural exit (warm-up + longest final proof before
// the bake) falls inside it. Without the block the exit moves with the bake. Either way the final proof
// stays within the engine's bound for a cold-retarded dough at 20 °C (3.5 h before preheat), and the
// yeast is dosed for the longer room-temperature time.
// Round 4 (18 Nov 2026, owner): Bake again now passes the previous plan's exit lead (exitLeadMin), and the
// exit moves to 7:00Z with the same 3 h when free: tests/retention-round4-engine.test.cjs. Without it (a new
// plan, as here) the engine's own exit, the end of the night, stands.
const H=3600000,d=s=>new Date(s+'Z');
const nights=offsetDays=>[19,20,21].map(day=>({label:'night',from:new Date(+d(`2026-11-${day}T22:00`)+offsetDays*24*H),to:new Date(+d(`2026-11-${day+1}T06:00`)+offsetDays*24*H)}));
const plan=(mix,bake,blocks,n)=>utils.buildSchedule(d(mix),d(bake),blocks,20,45,'hand','baguette',n,1,false);
test('a later bake keeps the fridge exit at the end of the night, within the final-proof bound',()=>{
 const first=plan('2026-11-21T17:15','2026-11-22T09:00',nights(0),2);
 const again=plan('2026-11-28T17:15','2026-11-29T10:00',nights(7),3);
 assert.equal(+first.coldRetardEnd,+d('2026-11-22T06:00'));
 assert.equal(+again.coldRetardEnd,+d('2026-11-29T06:00'),'the exit cannot be earlier: the night ends at 06:00Z');
 for(const s of [first,again]){
  const beforePreheat=(+s.preheatStart-+s.finalProofStart)/H;
  assert.ok(beforePreheat<=3.5+1e-9,`final proof ${beforePreheat} h before preheat`);
 }
 assert.ok(again.totalRTHours>first.totalRTHours);
});
test('with nothing blocking, the fridge exit moves with the bake',()=>{
 const a=plan('2026-11-28T17:15','2026-11-29T09:00',[],3),b=plan('2026-11-28T17:15','2026-11-29T10:00',[],3);
 assert.equal(+b.coldRetardEnd-+a.coldRetardEnd,H);
 assert.equal(b.finalProofHours,a.finalProofHours);
});
