const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');

// Round 8 (21 Nov 2026, owner: "simplify for hot kitchen on short plan, especially for the Simple protocol").
// A kitchen at 28 °C or more: no fridge when the room-temperature plan still calls for at least 0.1 % instant
// yeast, else ONE fridge spell (shape after the warm bulk, the balls take the whole cold), never in-out-in.
const H=3600000;
const wk=(d,a,b)=>({from:new Date(2026,10,d,a),to:new Date(2026,10,d,b),label:'Work · Weekdays'});
const nt=d=>({from:new Date(2026,10,d,23),to:new Date(2026,10,d+1,7),label:'Sleep night'});
const plan=(start,bake,blocks,temp,style='neapolitan',mixer='hand',extra={})=>
  utils.buildSchedule(start,bake,blocks,temp,45,mixer,style,4,1,undefined,1,extra.exitLeadMin);
const ids=s=>s.availabilityActions.map(a=>a.id);
const clock=d=>`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
const yeast=(s,temp,style='neapolitan')=>utils.calculateRecipe(style,'home_oven_standard',4,260,temp,'normal',s,6,'instant','simple','hand').yeast.pct;

test('Wei Ling (31 °C, same-day, 10:30 → 7pm): one fridge spell, shaped after the bulk',()=>{
  const s=plan(new Date(2026,10,28,10,30),new Date(2026,10,28,19,0),[],31);
  assert.equal(utils.fridgeSpellCount(s),1);
  assert.deepEqual(ids(s).filter(id=>id.startsWith('cold')),['cold-in-2','cold-out-2']);
  const at=Object.fromEntries(s.availabilityActions.map(a=>[a.id,clock(a.at)]));
  assert.equal(at.divide,'11:45');        // was: into the fridge 11:45, out to shape 1:45pm, back in 2:00pm
  assert.equal(at['cold-in-2'],'12:00');
  assert.equal(at['cold-out-2'],'16:45');  // the take-out is unchanged
  assert.equal(s.totalColdHours,4.75);     // same cold time
  const y=yeast(s,31);
  assert.ok(y>=0.2&&y<=0.4,`IDY ${y}`);
});

test('Maya (30 °C, Fri 6pm → Sat 7:30pm, work and nights): balls into the fridge once, no 9:15pm handling',()=>{
  const blocks=[wk(26,9,18),wk(27,9,18),nt(26),nt(27),nt(28)];
  const s=plan(new Date(2026,10,27,18,0),new Date(2026,10,28,19,30),blocks,30);
  assert.equal(utils.fridgeSpellCount(s),1);
  const at=Object.fromEntries(s.availabilityActions.map(a=>[a.id,clock(a.at)]));
  assert.equal(at.divide,'19:15');
  assert.equal(at['cold-in-2'],'19:30');
  assert.equal(at['cold-out-2'],'17:15');
  assert.equal(ids(s).includes('cold-out'),false);
  assert.equal((s.availabilityConflicts??[]).length,0);
  const y=yeast(s,30);
  assert.ok(y>=0.12&&y<=0.3,`IDY ${y}`);
});

test('a short hot plan that a room-temperature dose can carry has no fridge (0.1 % IDY or more)',()=>{
  const start=new Date(2026,10,28,14,0);
  const s=plan(start,new Date(+start+5*H),[],31);
  assert.equal(s.totalColdHours,0);
  assert.equal(utils.fridgeSpellCount(s),0);
  assert.ok(yeast(s,31)>=utils.HOT_ROOM_MIN_IDY_PCT);
  // Too long for that dose at 31 °C: one fridge spell instead of 0.07 %.
  const longer=plan(new Date(2026,10,28,10,30),new Date(2026,10,28,19,0),[],31);
  assert.equal(utils.fridgeSpellCount(longer),1);
});

test('hot kitchens: at most one fridge spell for pizza and lean commercial doughs, no new night step',()=>{
  const bakes={none:[new Date(2026,10,28,19,0),[]],nights:[new Date(2026,10,28,13,0),[nt(26),nt(27),nt(28)]]};
  for(const style of ['neapolitan','newyork','pizza_romana','pain_campagne','baguette','focaccia'])
    for(const temp of [28,30,32,35])for(let hours=4;hours<=30;hours+=1)for(const [name,[bake,blocks]] of Object.entries(bakes))for(const mixer of ['hand','stand']){
      const s=plan(new Date(+bake-hours*H),bake,blocks,temp,style,mixer);
      assert.ok(utils.fridgeSpellCount(s)<=1,`${style} ${temp}°C ${hours}h ${name} ${mixer}`);
    }
});

test('below 28 °C plans are unchanged (two spells stay where the engine planned them)',()=>{
  const bake=new Date(2026,10,28,19,0);
  const s=plan(new Date(+bake-20*H),bake,[],24);
  assert.deepEqual(s.availabilityActions.map(a=>[a.id,clock(a.at)]),
    [['mix','23:00'],['mix-finish','23:32'],['fold-1','0:10'],['fold-2','0:40'],['cold-in','1:15'],['cold-out','5:15'],['divide','5:15'],['cold-in-2','5:30'],['cold-out-2','15:00'],['preheat','18:15'],['bake','19:00']]);
  assert.equal(utils.fridgeSpellCount(plan(new Date(+bake-16*H),bake,[],26)),2);
});

test('a shaped spell the baker chose is kept: Bake again\'s exit lead keeps the shaped cold and its exit',()=>{
  const bake=new Date(2026,10,28,19,0);
  const s=plan(new Date(+bake-12*H),bake,[],31,'neapolitan','hand',{exitLeadMin:135});
  assert.ok(s.coldRetard2Start);
  assert.equal(+bake-+s.coldRetard2End,135*60000);
  assert.equal(utils.fridgeSpellCount(s),1);
  // A window a room plan would take: with last time's take-out the plan keeps its fridge spell.
  assert.equal(plan(new Date(+bake-5*H),bake,[],31).totalColdHours,0);
  assert.ok(plan(new Date(+bake-5*H),bake,[],31,'neapolitan','hand',{exitLeadMin:135}).totalColdHours>0);
  // Bake from the fridge (a lean loaf): shaped after the bulk, straight from the fridge into the oven.
  const fromFridge=utils.buildSchedule(new Date(+bake-14*H),bake,[{label:'x',from:new Date(+bake-H),to:new Date(+bake-H),bakeFromFridge:+bake}],31,45,'hand','pain_campagne',2,1);
  assert.ok(fromFridge.coldRetard2Start);
  assert.equal(+fromFridge.coldRetard2End,+fromFridge.preheatStart);
});

test('an enriched dough keeps its required fridge and is never shaped warm',()=>{
  const bake=new Date(2026,10,28,19,0);
  for(const hours of [10,14,18]){
    const s=plan(new Date(+bake-hours*H),bake,[],31,'brioche');
    assert.ok(s.totalColdHours>=4,`${hours}h`);
    if(utils.fridgeSpellCount(s)===1) assert.ok(s.coldRetard1Start,'the bulk is chilled before shaping');
  }
});


test('Simple, every kitchen (owner): a mild long plan shapes after the warm rise and goes into the fridge once; Custom keeps two stages',()=>{
  const bake=new Date(2026,10,28,19,0);
  const at=(s)=>Object.fromEntries(s.availabilityActions.map(a=>[a.id,clock(a.at)]));
  const simple=utils.buildSchedule(new Date(+bake-20*H),bake,[],24,45,'hand','neapolitan',4,1,undefined,1,undefined,'all');
  const custom=utils.buildSchedule(new Date(+bake-20*H),bake,[],24,45,'hand','neapolitan',4,1,undefined,1,undefined,'hot');
  assert.equal(utils.fridgeSpellCount(simple),1);
  assert.equal(at(simple).divide,'1:15');          // was: into the fridge 1:15, out to shape 5:15, back in 5:30
  assert.equal(at(simple)['cold-in-2'],'1:30');
  assert.equal(at(simple)['cold-out-2'],'15:00'); // the take-out is unchanged
  assert.equal(utils.fridgeSpellCount(custom),2);
  const y=s=>utils.calculateRecipe('neapolitan','home_oven_standard',4,260,24,'normal',s,6,'instant','simple','hand').yeast.pct;
  assert.ok(y(simple)/y(custom)>0.95&&y(simple)/y(custom)<1.2,`${y(simple)} vs ${y(custom)}`);
  // Simple at 20–27 °C, no busy time, a daytime start: at most one spell for pizza and lean loaves. (A night
  // start keeps the engine's plan where shaping after the rise would be a new step between 22:00 and 07:00.)
  for(const style of ['neapolitan','pain_campagne','focaccia'])for(const temp of [20,22,24,26,27])for(let hours=10;hours<=30;hours+=2){
    const start=new Date(+bake-hours*H);if(start.getHours()<7||start.getHours()>=19)continue;
    const s=utils.buildSchedule(start,bake,[],temp,45,'hand',style,4,1,undefined,1,undefined,'all');
    assert.ok(utils.fridgeSpellCount(s)<=1,`${style} ${temp}°C ${hours}h`);
  }
});

test('an enriched dough is never left on the yeast floor by a one-trip plan (bulk cold keeps the fridge share)',()=>{
  const bake=new Date(2026,10,28,19,0);
  for(const ladder of ['hot','all'])for(const temp of [24,27,31])for(const hours of [14,20,26]){
    const base=utils.buildSchedule(new Date(+bake-hours*H),bake,[],temp,45,'hand','pain_viennois',4,1,undefined,1,undefined,'off');
    const s=utils.buildSchedule(new Date(+bake-hours*H),bake,[],temp,45,'hand','pain_viennois',4,1,undefined,1,undefined,ladder);
    assert.ok(s.totalRTHours<=base.totalRTHours+0.25,`${ladder} ${temp}°C ${hours}h: ${s.totalRTHours} vs ${base.totalRTHours}`);
  }
});
