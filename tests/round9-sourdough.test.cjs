// Round 9 (22 Nov 2026), sourdough and the shared jar: K (Simple levain, one fridge trip; saved bakes keep theirs),
// N/S7 (two bakes of one jar: names, home rows after a tick, no invented fridge date, one "keep the rest"),
// S4 (the levain % does not follow the flour), the guide's shaping step after a fridge spell.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {utils}=require('./load-production.cjs');
const {legacyHotPlanFor,HOT_PLAN_RULES}=require('../app/utils/hotPlanRules.ts');
const {twinBakeWhen,jarRowName}=require('../app/utils/twinBakes.ts');
const {sharedStarterFeedFor,sharedFeedLine,savedStarterUse,starterEventsWithSharedFeed,inventedStarterHistory}=require('../app/utils/sharedStarter.ts');
const {mergeSharedJarRows}=require('../app/lib/localJournal.ts');
const {levainPlannedPct}=require('../app/utils/recipeStages.ts');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
const H=3600000;
const at=(y,m,d,h,mi=0)=>+new Date(y,m-1,d,h,mi);
const nt=d=>({from:new Date(2026,10,d,23),to:new Date(2026,10,d+1,7),label:'Sleep night'});
const wk=(d,a,b)=>({from:new Date(2026,10,d,a),to:new Date(2026,10,d,b),label:'Work · Weekdays'});
const levainPlan=(start,bake,blocks,temp,style,ladder)=>utils.buildSchedule(start,bake,blocks,temp,45,'hand',style,4,1,true,1,undefined,ladder);
const ids=s=>s.availabilityActions.map(a=>a.id);
const clock=d=>`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;

test('K: Priya\'s Simple sourdough pizza (20 °C, Fri 7:00 → Sat 8:30pm, nights) goes into the fridge once, shaped first',()=>{
  const start=new Date(2026,10,27,7,0),bake=new Date(2026,10,28,20,30),blocks=[nt(26),nt(27),nt(28)];
  const simple=levainPlan(start,bake,blocks,20,'neapolitan','all'),custom=levainPlan(start,bake,blocks,20,'neapolitan','hot');
  assert.equal(utils.fridgeSpellCount(custom),2,'Custom keeps the engine\'s plan for levain');
  assert.equal(utils.fridgeSpellCount(simple),1);
  const t=Object.fromEntries(simple.availabilityActions.map(a=>[a.id,clock(a.at)]));
  assert.equal(t.divide,'13:30');           // was: into the fridge 1:30pm, out 5:30pm to shape, balls back in 5:45pm
  assert.equal(t['cold-in-2'],'13:45');
  assert.equal(t['cold-out-2'],'15:30');    // the take-out is unchanged
  assert.equal(ids(simple).includes('cold-out'),false);
  assert.equal(simple.bulkFermHours,custom.bulkFermHours,'the levain bulk is its own');
  assert.equal((simple.availabilityConflicts??[]).length,0);
  // A pain au levain: shaped at the end of the bulk, the loaf cold overnight, out at the preheat (Tartine practice).
  const loaf=levainPlan(new Date(2026,10,28,8,0),new Date(2026,10,29,10,0),blocks,20,'pain_levain','all');
  assert.equal(utils.fridgeSpellCount(loaf),1);
  assert.equal(clock(loaf.availabilityActions.find(a=>a.id==='cold-out-2').at),'9:15');
  // 'off' (a kept bake) is the engine's plan.
  assert.equal(utils.fridgeSpellCount(levainPlan(start,bake,blocks,20,'neapolitan','off')),2);
});

test('K: Simple levain never gains a clash, a newly invalid plan, a fridge spell or a night step it did not have',()=>{
  const sets={none:[],work:[24,25,26,27,28,29].map(d=>wk(d,9,18)),nights:[24,25,26,27,28,29].map(nt),both:[24,25,26,27,28,29].flatMap(d=>[wk(d,9,18),nt(d)])};
  const night=(s,blocks)=>{const own=blocks.some(b=>b.label?.endsWith(' night'));const free=t=>own&&!blocks.some(b=>t>+b.from&&t<+b.to);
    return new Set(s.availabilityActions.filter(a=>a.id!=='bake'&&(a.at.getHours()>=22||a.at.getHours()<7)&&!free(+a.at)).map(a=>a.id));};
  let changed=0;
  for(const style of ['neapolitan','newyork','sourdough','pain_levain','pain_campagne'])for(const temp of [16,20,24,28,32])
    for(const bake of [new Date(2026,10,28,19,30),new Date(2026,10,29,10,0)])for(let hours=10;hours<=40;hours+=3)for(const [name,blocks] of Object.entries(sets)){
      const start=new Date(+bake-hours*H),old=levainPlan(start,bake,blocks,temp,style,'hot'),now=levainPlan(start,bake,blocks,temp,style,'all');
      const where=`${style} ${temp}°C ${hours}h ${name}`;
      if(JSON.stringify(ids(old).map((id,i)=>[id,+old.availabilityActions[i].at]))!==JSON.stringify(ids(now).map((id,i)=>[id,+now.availabilityActions[i].at])))changed++;
      assert.ok((now.availabilityConflicts?.length??0)<=(old.availabilityConflicts?.length??0),where);
      assert.ok(!now.preparationInvalid||old.preparationInvalid,where);
      assert.ok(utils.fridgeSpellCount(now)<=utils.fridgeSpellCount(old),where);
      const before=night(old,blocks);assert.ok([...night(now,blocks)].every(id=>before.has(id)),where+' night');
    }
  assert.ok(changed>100,`changed ${changed}`);
});

test('K: a levain bake saved before round 9 and under way keeps its plan; commercial bakes of round 8 are current',()=>{
  const now=at(2026,11,27,12);
  assert.equal(HOT_PLAN_RULES,3);
  const ahead={recipeGenerated:true,yeastType:'sourdough',planRules:2,startTime:at(2026,11,28,7),starterEvents:[{kind:'fridge_in',time:at(2026,11,18,8),historicalStorage:true},{kind:'fridge_out',time:at(2026,11,27,17)},{kind:'pre_mix',time:at(2026,11,27,18,30)}]};
  assert.equal(legacyHotPlanFor(ahead,now),false,'not under way: the new rules');
  assert.equal(legacyHotPlanFor(ahead,at(2026,11,27,17,30)),true,'its starter is out of the fridge: under way');
  assert.equal(legacyHotPlanFor({...ahead,starterFeedRecords:[{kind:'pre_mix'}]},now),true,'a recorded feed');
  assert.equal(legacyHotPlanFor({...ahead,startTime:now-H},now),true,'its Start Dough has come');
  assert.equal(legacyHotPlanFor({...ahead,planRules:3},at(2026,11,27,17,30)),false,'made with the levain ladder');
  assert.equal(legacyHotPlanFor({...ahead,yeastType:'instant',planRules:2,startTime:now-H},now),false,'a commercial bake of round 8 already has its ladder');
  assert.equal(legacyHotPlanFor({...ahead,yeastType:'instant',planRules:undefined,startTime:now-H},now),true,'one saved before round 8, under way');
  assert.equal(legacyHotPlanFor({...ahead,planRules:2,legacyHotPlan:true},now),true,'kept so once');
  // The page saves the rules and passes 'off' for a kept bake; SessionViewer reads the same guard.
  const page=read('app/[locale]/page.tsx');
  assert.match(page,/planRules: HOT_PLAN_RULES/);
  assert.match(page,/const planLadder: PlanLadder = legacyHotPlan \? 'off' : tab === 'simple' \? 'all' : 'hot';/);
});

test('S7: two bakes of the same name are told apart by day, and by time on the same day',()=>{
  const sat730=at(2026,11,28,19,30),sat830=at(2026,11,28,20,30),sun=at(2026,11,29,12);
  assert.equal(twinBakeWhen(sat730,[],'en'),'','a name no other bake has: nothing');
  assert.equal(twinBakeWhen(sat730,[sun],'en'),'Sat');
  assert.equal(twinBakeWhen(sat730,[sat830],'en'),'Sat 7:30pm');
  assert.equal(twinBakeWhen(sat830,[sat730],'fr'),'Sam. 20h30');
  assert.equal(jarRowName(['Pizza night','Pizza night'],'en'),'Pizza night · both bakes');
  assert.equal(jarRowName(['Soirée pizza','Soirée pizza'],'fr'),'Soirée pizza · les deux fournées');
  assert.equal(jarRowName(['Pain au levain','Pizza night'],'en'),'Pain au levain & Pizza night');
  assert.equal(jarRowName(['Pain au levain','Soirée pizza'],'fr'),'Pain au levain et Soirée pizza');
});

// Priya, round 8: two "Pizza night" bakes on Saturday share the Thursday 6:30pm feed.
const ev=(feedAt,peakAt)=>[{kind:'fridge_in',time:at(2026,11,18,8),isPast:true,historicalStorage:true,timeIsEstimate:true},{kind:'fridge_out',time:at(2026,11,26,17)},{kind:'pre_mix',time:feedAt,bellPeakTime:peakAt,feedingRatio:1}];
const bake1={id:'a-1',createdAt:at(2026,11,25,9),eatTime:at(2026,11,28,19,30),bakeName:'',session:{yeastType:'sourdough',levainNeed:{mid:95,max:100},startTime:at(2026,11,27,7),nextFeedRatio:1,starterEvents:ev(at(2026,11,26,18,30),at(2026,11,27,7)),starterFeedRecords:[]}};
const bake2={id:'b-2',createdAt:at(2026,11,25,10),eatTime:at(2026,11,28,20,30),bakeName:'',session:{yeastType:'sourdough',levainNeed:{mid:95,max:100},startTime:at(2026,11,27,7),nextFeedRatio:1,starterEvents:ev(at(2026,11,26,18,30),at(2026,11,27,7)),starterFeedRecords:[]}};
const now=at(2026,11,26,12);

test('N/S7: the shared feed line names two bakes of one name by their bake time',()=>{
  const A=savedStarterUse(bake1,'the pizzas'),B=savedStarterUse(bake2,'the pizzas');
  assert.equal(A.bakeAt,bake1.eatTime);
  const shared=sharedStarterFeedFor(B,[A],now);
  const g=n=>`${n} g`;
  const when=(own,other)=>twinBakeWhen(own,[other],'en');
  const line=sharedFeedLine(shared,false,g,when);
  assert.match(line,/for the pizzas \(Sat 7:30pm\), .* for the pizzas \(Sat 8:30pm\)$/);
  assert.doesNotMatch(line,/for the pizzas, /);
  assert.match(sharedFeedLine(shared,true,g,(o,x)=>twinBakeWhen(o,[x],'fr')),/pour the pizzas \(Sam\. 19h30\)/);
  // Different names: unchanged.
  const named=sharedFeedLine({...shared,second:{...shared.second,name:'the campagne'}},false,g,when);
  assert.doesNotMatch(named,/\(/);
});

test('N: no fridge date the baker never gave (estimated or assumed last feed), in the jar steps or anywhere it shows',()=>{
  assert.equal(inventedStarterHistory({kind:'fridge_in',historicalStorage:true,timeIsEstimate:true}),true);
  assert.equal(inventedStarterHistory({kind:'fridge_in',historicalStorage:true,assumed:true}),true);
  assert.equal(inventedStarterHistory({kind:'fridge_in',historicalStorage:true}),false,'a feed time the baker gave');
  assert.equal(inventedStarterHistory({kind:'fridge_in',timeIsEstimate:true}),false,'a planned fridge step');
  const A=savedStarterUse(bake1,'the pizzas'),B=savedStarterUse(bake2,'the pizzas');
  const shared=sharedStarterFeedFor(B,[A],now);
  const shown=starterEventsWithSharedFeed(B.events,shared,now,A.events);
  assert.deepEqual(shown.map(e=>e.kind),['fridge_out','pre_mix'],'no "Refrigerate · Wed 18 Nov"');
  assert.match(read('app/components/RecipeOutput.tsx'),/!inventedStarterHistory\(event\)\)\.slice\(\)\.sort/);
  assert.match(read('app/components/SchedulePicker.tsx'),/if\(inventedStarterHistory\(event\)\)continue;/);
});

test('N: one "keep the rest" amount with a shared feed (the jar\'s rest after both doughs)',()=>{
  const src=read('app/components/RecipeOutput.tsx');
  assert.equal((src.match(/const starterLeft = sharedStarterFeed \? sharedStarterFeed\.keep : /g)||[]).length,2,'starter card and the final dough\'s Levain row');
});

const row=(entry,t,label)=>({entry,at:t,label,current:false});
test('N: a feed ticked in one bake moves the other bake\'s home row on, before that bake is opened',()=>{
  const rec={kind:'pre_mix',plannedAt:at(2026,11,26,18,30),actualAt:at(2026,11,26,18,30),recordedAt:at(2026,11,26,18,31),ratio:1,stated:false};
  const ticked={...bake1,session:{...bake1.session,starterFeedRecords:[rec]}};
  const evening=at(2026,11,26,19);
  // Bake 1 moved to its Start Dough; bake 2's guide snapshot still names the pre-mix feed.
  const rows=[row(bake2,at(2026,11,26,18,30),'Pre-mix feed'),row(ticked,at(2026,11,27,7),'Start Dough')];
  const out=mergeSharedJarRows(rows,evening);
  const second=out.find(r=>r.entry.id==='b-2');
  assert.notEqual(second.label,'Pre-mix feed');
  assert.equal(second.at,bake2.session.startTime,'its next step: the mix');
  // Nothing recorded: the rows stay as they were.
  assert.equal(mergeSharedJarRows([row(bake2,at(2026,11,26,18,30),'Pre-mix feed'),row(bake1,at(2026,11,27,7),'Start Dough')],evening).find(r=>r.entry.id==='b-2').label,'Pre-mix feed');
  // The other way round too: the follower's tick moves the leader's row.
  const ticked2={...bake2,session:{...bake2.session,starterFeedRecords:[rec]}};
  assert.equal(mergeSharedJarRows([row(bake1,at(2026,11,26,18,30),'Pre-mix feed'),row(ticked2,at(2026,11,27,7),'Start Dough')],evening).find(r=>r.entry.id==='a-1').label,null);
});

test('S4: the levain % reads the % it was sized from, the same for every flour',()=>{
  const sched=levainPlan(new Date(2026,10,28,8,0),new Date(2026,10,29,10,0),[],20,'pain_levain','all');
  const recipe=flour=>utils.calculateRecipe('pain_levain','home_oven_standard',1,900,20,'normal',sched,6,'sourdough','custom','hand',undefined,undefined,undefined,
    {flour1:flour,flour2:null,ratio1:100},undefined,undefined,undefined,undefined,undefined,undefined,1.5,undefined,9);
  const strong=recipe('manitoba'),weak=recipe('allpurpose');
  assert.notEqual(strong.flour,weak.flour,'the flours take different water, so different flour weights');
  const raw=r=>Math.round(r.sourdough.starterGramsMid/r.flour*1000)/10;
  assert.equal(levainPlannedPct(strong.sourdough),levainPlannedPct(weak.sourdough));
  assert.ok(Math.abs(raw(strong)-levainPlannedPct(strong.sourdough))<=2.5/strong.flour*100+0.05,'within the 5 g rounding');
  // A single % (the baker's, or the planner's raised one) reads as itself.
  assert.equal(levainPlannedPct({starterPctMin:17.5,starterPctMax:17.5}),17.5);
  assert.match(read('app/components/RecipeOutput.tsx'),/advancedPct=\{custom && sourdough \? pctStr\(levainPlannedPct\(sourdough\)\) : pctOf\(row\.grams\)\}/);
});

test('nit: the shaping step after a fridge spell starts with the take-out',()=>{
  const guide=read('app/components/BakeGuide.tsx');
  assert.match(guide,/<StepsLeadCtx\.Provider value=\{shapeAfterFridgeLead\}>/);
  assert.match(guide,/'Take the dough out of the fridge\.'/);
  assert.match(guide,/'Sortez la pâte du réfrigérateur\.'/);
  assert.match(guide,/items = \(lead \? \[lead, \.\.\.items\] : items\)/);
});
