const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {planExitLead,exitLeadFor,normalizeExitLead}=require('../app/utils/exitLead.ts');
const {bakeSubject}=require('../app/utils/breadNames.ts');
const {ovenBusyClause}=require('../app/utils/ovenWindow.ts');
// 18 Nov 2026 retention round 4 (owner's decisions). Times in UTC hours, any TZ.
const H=3600000,d=s=>new Date(s+'Z');
const nights=offsetDays=>[19,20,21].map(day=>({label:'Sat night',from:new Date(+d(`2026-11-${day}T22:00`)+offsetDays*24*H),to:new Date(+d(`2026-11-${day+1}T06:00`)+offsetDays*24*H)}));
const baguettes=(mix,bake,blocks,n,lead)=>utils.buildSchedule(d(mix),d(bake),blocks,20,45,'hand','baguette',n,1,false,1,lead);

test('Bake again one hour later keeps the time out of the fridge when the later exit is free (item 7)',()=>{
 const first=baguettes('2026-11-21T17:15','2026-11-22T09:00',nights(0),2);
 assert.equal(+first.coldRetard2End,+d('2026-11-22T06:00'),'the night pins last week\'s exit');
 const lead=planExitLead(first,20,'baguette');
 assert.deepEqual(lead,{min:180,kitchenTemp:20,styleKey:'baguette'});
 const again=baguettes('2026-11-28T17:15','2026-11-29T10:00',nights(7),3,exitLeadFor(lead,20,'baguette'));
 assert.equal(+again.coldRetard2End,+d('2026-11-29T07:00'),'out one hour later, when free');
 assert.equal(+again.bakeStart-+again.coldRetard2End,3*H,'the same 3 h out of the fridge');
 assert.equal(again.finalProofHours,first.finalProofHours);
 assert.ok(again.totalColdHours>first.totalColdHours,'the cold spell absorbs the later bake');
 assert.equal(again.availabilityConflicts.length,0);
 // Without the previous plan (a new bake) the engine's own exit stands: the end of the night.
 assert.equal(+baguettes('2026-11-28T17:15','2026-11-29T10:00',nights(7),3).coldRetard2End,+d('2026-11-29T06:00'));
 // A different kitchen or dough does not carry it.
 assert.equal(exitLeadFor(lead,24,'baguette'),undefined);
 assert.equal(exitLeadFor(lead,20,'pain_campagne'),undefined);
 for(const bad of [null,{},{min:0,kitchenTemp:20,styleKey:'x'},{min:90,kitchenTemp:'20',styleKey:'x'}])assert.equal(normalizeExitLead(bad),undefined);
});

test('a kept lead never lands in busy time nor outside the proof bounds',()=>{
 // 4:00Z would be inside the night (it ends 6:00Z): the kept lead is not used. No exit before
 // the oven is free either, so the plan offers the latest workable one (5:30Z) as a clash.
 const s=baguettes('2026-11-28T17:15','2026-11-29T08:00',nights(7),3,240);
 assert.equal(+s.coldRetard2End,+d('2026-11-29T05:30'));
 assert.ok(s.availabilityConflicts.some(c=>c.action.id==='cold-out-2'));
 const t=baguettes('2026-11-28T17:15','2026-11-29T10:00',nights(7),3,300);
 assert.equal(+t.coldRetard2End,+d('2026-11-29T06:00'),'5:00Z is busy: the end of the night stands');
 // A lead longer than the longest final proof is never used (the engine's natural exit is the bound).
 const free=baguettes('2026-11-28T17:15','2026-11-29T10:00',[],3,600);
 assert.equal(+free.coldRetard2End,+baguettes('2026-11-28T17:15','2026-11-29T10:00',[],3).coldRetard2End);
});

test('an exit that must fall at night is the latest workable one, nearest the end of the night (item 8)',()=>{
 // Campagne for 9:15 local after nights 23:00–7:00 (here 8:15Z, nights 22:00–06:00Z): out at 5:45Z
 // (6:45 local, a 45 min warm-up and the shortest final proof before the preheat), not 3:15Z (4:15).
 const camp=utils.buildSchedule(d('2026-11-21T15:00'),d('2026-11-22T08:15'),nights(0),20,45,'hand','pain_campagne',1,1,false);
 assert.equal(+camp.coldRetard2End,+d('2026-11-22T05:45'));
 assert.deepEqual(camp.availabilityConflicts.map(c=>c.action.id),['cold-out-2']);
 const later=utils.buildSchedule(d('2026-11-21T15:00'),d('2026-11-22T08:30'),nights(0),20,45,'hand','pain_campagne',1,1,false);
 assert.equal(+later.coldRetard2End,+d('2026-11-22T06:00'),'a quarter later the exit is free at the end of the night');
 assert.equal(later.availabilityConflicts.length,0);
});

test('a saved arrangement keeps its exit: an existing bake is never re-timed by the new rule (item 8)',()=>{
 const blocks=nights(0);
 const bake=d('2026-11-22T08:15');
 // Saved before round 4: someone takes the dough out at 3:15Z, the old natural exit.
 const saved=blocks.map((b,i)=>i===2?{...b,fridgeRemoval:{at:+d('2026-11-22T03:15'),bake:+bake}}:b);
 const kept=utils.buildSchedule(d('2026-11-21T15:00'),bake,saved,20,45,'hand','pain_campagne',1,1,false);
 assert.equal(+kept.coldRetard2End,+d('2026-11-22T03:15'));
 assert.equal(kept.fridgeRemovalArranged,true,'still covered');
 assert.equal(kept.availabilityConflicts.length,0);
 // An arrangement for another bake time does not apply.
 const other=blocks.map((b,i)=>i===2?{...b,fridgeRemoval:{at:+d('2026-11-22T03:15'),bake:+bake+H}}:b);
 assert.equal(+utils.buildSchedule(d('2026-11-21T15:00'),bake,other,20,45,'hand','pain_campagne',1,1,false).coldRetard2End,+d('2026-11-22T05:45'));
});

test('a longer preheat moves the Preheat step only (item 4)',()=>{
 // Maya: Neapolitan at 30 °C, bake 19:30, oven preheat 30 min; "more preheat" adds 30 min.
 const mix=d('2026-11-20T18:00'),eat=d('2026-11-21T19:30');
 const base=utils.buildSchedule(mix,eat,[],30,30,'hand','neapolitan',6);
 const longer=utils.withLongerPreheat(base,eat,30,[]);
 assert.equal(+longer.preheatStart,+d('2026-11-21T18:30'));
 assert.equal(+base.preheatStart,+d('2026-11-21T19:00'));
 for(const key of ['coldRetard2End','rtWarmupStart','finalProofStart','divideBallTime'])assert.equal(+longer[key],+base[key],key);
 assert.equal(longer.finalProofHours,base.finalProofHours);
 assert.equal(+longer.availabilityActions.find(a=>a.id==='preheat').at,+d('2026-11-21T18:30'));
 // The old way (total preheat into the planner) moved the take-out: the bug.
 const old=utils.buildSchedule(mix,eat,[],30,60,'hand','neapolitan',6);
 assert.ok(+old.coldRetard2End<+base.coldRetard2End);
 // A preheat clash is still reported.
 const busy=[{label:'x',from:d('2026-11-21T18:15'),to:d('2026-11-21T18:45')}];
 assert.ok(utils.withLongerPreheat(base,eat,30,busy).availabilityConflicts.some(c=>c.action.id==='preheat'));
 assert.equal(utils.withLongerPreheat(base,eat,0,[]),base);
});

test('the oven sentence names a plural bake in the plural',()=>{
 const at=ms=>new Date(ms).toISOString().slice(11,16);
 const use=(subject)=>({id:'a',from:+d('2026-11-22T08:15'),to:+d('2026-11-22T09:45'),ovenType:null,name:'Baguette',...(subject?{subject:subject.text,plural:subject.plural}:{})});
 assert.equal(ovenBusyClause(use(bakeSubject('baguette',3,true,'bread')),true,at),'Les baguettes occupent le four de 08:15 à 09:45');
 assert.equal(ovenBusyClause(use(bakeSubject('baguette',1,true,'bread')),true,at),'La baguette occupe le four de 08:15 à 09:45');
 assert.equal(ovenBusyClause(use(bakeSubject('baguette',3,false,'bread')),false,at),'The baguettes are in the oven 08:15–09:45');
 assert.equal(ovenBusyClause(use(bakeSubject('neapolitan',6,true,'pizza')),true,at),'Les pizzas occupent le four de 08:15 à 09:45');
 assert.equal(ovenBusyClause(use(null),true,at),'Baguette occupe le four de 08:15 à 09:45');
});
