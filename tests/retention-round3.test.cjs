const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
// 18 Nov 2026 retention round 3 (flow): the bake proceeds without ticks; multi-bake costs nothing with one bake.
const {clockMark,stepsClosedByTick}=require('../app/utils/guideProgress.ts');
const O=require('../app/utils/ovenWindow.ts');
const J=require('../app/lib/localJournal.ts');
const m=60000,h=3600000,T=Date.UTC(2026,10,20,10);// Maya: Start Dough Fri 6:00pm SGT
// Maya's Preparation and oven, as the guide times them.
const maya=(done=[])=>[
 {step:1,at:T,action:true},                 // Start Dough
 {step:2,at:T+45*m,action:false},           // Let the dough rise (a wait)
 {step:3,at:T+75*m,action:true},            // Refrigerate the dough (into the fridge)
 {step:4,at:T+195*m,action:true},           // Divide and shape
 {step:5,at:T+210*m,action:true},           // Refrigerate the dough balls
 {step:6,at:T+(23.5*60)*m,action:true},     // Let the shaped dough rise (out of the fridge)
 {step:7,at:T+25*h,action:true,phase:'cooking'},   // Preheat
 {step:8,at:T+25.5*h,action:true,phase:'cooking'}, // Bake
].map(s=>({phase:'preparation',...s,done:done.includes(s.step)}));

test('no ticks at all: Now follows the clock, nothing is held',()=>{
 assert.deepEqual(clockMark(maya(),T-2*h),{step:1,kind:'next',held:false});
 assert.equal(clockMark(maya(),T+10*m).step,1);
 assert.deepEqual(clockMark(maya(),T+50*m),{step:2,kind:'now',held:false},'the unticked mix does not hold the bar');
 assert.equal(clockMark(maya(),T+4*h).step,5);
 assert.equal(clockMark(maya(),T+24*h).step,6);
 assert.equal(clockMark(maya(),T+25.1*h).step,7);
 assert.equal(clockMark(maya(),T+25.6*h).step,8);
});

test('after a tick, an unticked action step holds Now until the next action step’s time; waits never hold',()=>{
 // Mixed (ticked); at 7:20pm "Refrigerate the dough" is due and unticked: it holds while Divide is still ahead.
 assert.deepEqual(clockMark(maya([1]),T+80*m),{step:3,kind:'now',held:false});
 // 9:20pm: Divide is now due; the fridge step's grace is over, Divide is Now (not held: it is the clock's step).
 assert.deepEqual(clockMark(maya([1]),T+200*m),{step:4,kind:'now',held:false});
 // 9:35pm, Divide not ticked: the balls step is the clock's; Divide's grace ended at 9:30.
 assert.equal(clockMark(maya([1]),T+215*m).step,5);
 // A wait does not hold: mixed, then at 7:05pm the rise is the clock's step anyway, and nothing holds it after 7:15.
 assert.equal(clockMark(maya([1]),T+80*m).step,3);
 // Held case proper: ticked Start Dough, the shaping (action) due at 9:15 is unticked; at 9:25 (before the next action at 9:30) …
 const steps=maya([1]).map(s=>s.step===5?{...s,at:T+260*m}:s);// the balls go in at 10:20pm
 assert.deepEqual(clockMark(steps,T+230*m),{step:4,kind:'now',held:false});
 // … and with a wait after it that is already due, Divide still holds (held: true) until the balls' time.
 const withWait=[...steps,{step:9,phase:'preparation',at:T+225*m,action:false,done:false}];
 assert.deepEqual(clockMark(withWait,T+230*m),{step:4,kind:'now',held:true});
 assert.equal(clockMark(withWait,T+261*m).step,5);
});

test('ticking a later step ticks the earlier unticked ones; the clock never does',()=>{
 assert.deepEqual(stepsClosedByTick(maya(),4),[1,2,3]);
 assert.deepEqual(stepsClosedByTick(maya([1,2]),5),[3,4]);
 assert.deepEqual(stepsClosedByTick(maya(),1),[]);
 // A tick closes what was planned before it: the bar moves to the next step.
 assert.equal(clockMark(maya([1,2,3,4]),T+200*m).kind,'next');
});

test('oven time: pizzas one at a time, a loaf, and two bakes in one oven',()=>{
 assert.equal(O.ovenBusyMinutes('pizza','neapolitan',6,'home_oven_standard'),87);
 assert.equal(O.bakeEndAt(Date.UTC(2026,10,21,11,30),87),Date.UTC(2026,10,21,13,0),'7:30–9:00pm');
 assert.equal(O.bakeEndAt(T,12),null,'one short bake has no range');
 assert.equal(O.ovenBusyMinutes('bread','pain_campagne',1,'dutch_oven'),45);
 assert.ok(O.sameOven('dutch_oven','home_oven_stone_bread'));
 assert.ok(!O.sameOven('pizza_oven','home_oven_standard'));
 // Campagne 9:30–10:15 (preheat from 8:45), baguettes preheat 9:15 → 10:45: same oven, overlapping.
 const d=hm=>Date.UTC(2026,10,22,hm[0]-1,hm[1]);
 const campagne={id:'c',from:d([8,45]),to:d([10,15]),ovenType:'dutch_oven'};
 const baguettes={from:d([9,15]),to:d([10,45]),ovenType:'home_oven_stone_bread'};
 assert.equal(O.ovenClash(baguettes,[campagne]).id,'c');
 assert.equal(O.nextFreeOvenShift(baguettes,[campagne]),60*m,'preheat from 10:15, bake 11:00');
 assert.equal(O.ovenClash({...baguettes,from:d([10,15]),to:d([11,45])},[campagne]),null,'edges are exclusive');
 assert.equal(O.ovenClash(baguettes,[]),null,'one bake: nothing to compare');
});

function storage(){const values=new Map();return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};}
beforeEach(()=>{global.localStorage=storage();});
test('home rows use the guide’s own step name and time, in its language, ordered by time',()=>{
 const t0=Date.UTC(2026,10,21,16,30);// Sat 17:30 Paris
 const bake=over=>({bakeType:'bread',styleKey:'baguette',bakeName:'',numItems:2,itemWeight:320,kitchenTemp:20,recipeGenerated:true,tab:'simple',...over});
 const a=J.recordGeneratedBake(bake({eatTime:t0+16*h,computedRecipe:{timelineSteps:[{id:'divide_ball',time:t0+h,label:'Shape the loaf'}]}}),1).entry;J.forgetCurrentJournalBake();
 const b=J.recordGeneratedBake(bake({eatTime:t0+17*h,computedRecipe:{timelineSteps:[{id:'mixing',time:t0-15*m,label:'Frasage et pétrissage'}]}}),2).entry;J.forgetCurrentJournalBake();
 const plan=(id,locale,steps)=>localStorage.setItem('bh_guide_done_v2:'+JSON.stringify({bake:id})+':plan',JSON.stringify({locale,steps}));
 plan(a.id,'fr',[{step:1,at:t0-2*h,phase:'preparation',action:true,done:true,title:'Pétrir la pâte'},{step:2,at:t0+h,phase:'preparation',action:true,done:false,title:'Façonner le pain'}]);
 plan(b.id,'fr',[{step:1,at:t0-15*m,phase:'preparation',action:true,done:false,title:'Pétrir la pâte'},{step:2,at:t0+30*m,phase:'preparation',action:false,done:false,title:'Pointage'}]);
 const rows=J.liveJournalBakes(t0,'fr');
 assert.deepEqual(rows.map(r=>[r.entry.id,r.label,r.at]),[[b.id,'Pétrir la pâte',t0-15*m],[a.id,'Façonner le pain',t0+h]]);
 // Another language than the guide's: the saved plan labels, never English steps in a French row from the guide.
 assert.deepEqual(J.liveJournalBakes(t0,'en').map(r=>r.label),['Frasage et pétrissage','Shape the loaf']);
});
