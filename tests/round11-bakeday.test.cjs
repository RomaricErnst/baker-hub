// Round 11 (22 Nov 2026, bake day): a mix or feed recorded within the plan's 15 minutes is the plan's step (Maya);
// two bakes feeding one jar at the same time share that feed (Priya); a fridge starter always shows its take-out.
const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(r,...x){return resolve.call(this,r.startsWith('@/')?path.join(__dirname,'..',r.slice(2)):r,...x);};
const compile=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:f}).outputText,f);
require.extensions['.ts']=compile;require.extensions['.tsx']=compile;
const utils=require('../app/utils.ts');
const {recordedOnPlan,shiftStarterPlanAfterFeed}=require('../app/utils/bakeExecution.ts');
const {sharedStarterFeedFor,withStarterTakeOut,starterEventsWithSharedFeed}=require('../app/utils/sharedStarter.ts');
const {starterBuild}=require('../app/utils/starterBuild.ts');
const sp=require('../app/components/SchedulePicker.tsx');
const H=3600000,M=60000;
const D=(d,h,m=0)=>+new Date(2026,10,d,h,m);

test('recordedOnPlan: 15 minutes either side is the plan',()=>{
  const at=D(26,21,15);
  for(const dm of [-15,-1,0,1,14,15])a.equal(recordedOnPlan(at+dm*M,at),true,`${dm} min`);
  for(const dm of [-16,16,40])a.equal(recordedOnPlan(at+dm*M,at),false,`${dm} min`);
});

test('Maya (30 °C, nights): mixed 1 min early, the remaining plan fits; the dose of that minute is not a clash',()=>{
  const realNow=Date.now;Date.now=()=>D(26,21,14)+30000;
  try{
    const nt=d=>({from:new Date(2026,10,d,23),to:new Date(2026,10,d+1,7),label:'Sleep night'});
    const blocks=[nt(25),nt(26),nt(27)],bake=new Date(D(27,19,30));
    const plan=start=>utils.buildSchedule(new Date(start),bake,blocks,30,45,'hand','neapolitan',4,1,undefined,1,undefined,'all');
    const rec=s=>utils.calculateRecipe('neapolitan','home_oven_standard',4,260,30,'normal',s,6,'instant','simple','hand');
    const planned=rec(plan(D(26,21,15)));
    const check=(at,withFormula)=>sp.validateConfirmedBake({prefermentFlourPct:20,doughMassG:1056,hydrationPct:65,flourTempC:30,
      execution:{method:'none',actualAt:at,recordedAt:Date.now(),inFridge:false,prefHours:0,recipe:planned},start:new Date(at),bake,blocks,kitchenTemp:30,fridgeTemp:6,
      styleKey:'neapolitan',flourStrength:1,preheatMin:45,planLadder:'all',mixerType:'hand',numItems:4,mixingBatches:1,
      formulaValid:withFormula?(c=>Math.abs(rec(c).yeast.convertedGrams-planned.yeast.convertedGrams)<0.0005):undefined}).valid;
    // The cause: the minute changes the yeast the remaining plan would call for (1.321 → 1.316 g).
    a.equal(check(D(26,21,14),true),false);
    // Within the tolerance the page judges the remaining plan on its times only: it fits.
    a.equal(check(D(26,21,14),false),true);
  }finally{Date.now=realNow;}
  const page=fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8');
  a.match(page,/const onPlan=recordedOnPlan\(at,plannedPreparationAt\);/);
  a.match(page,/formulaValid:onPlan\?undefined:\(candidate,times\)=>madeFormulaMatches\(actual,candidate,times\)/);
});

test('a feed recorded within 15 minutes keeps the rest of the starter plan',()=>{
  const q=ms=>Math.round(ms/900000)*900000,now=q(Date.now());
  const events=[{kind:'last_fed',time:new Date(now-30*H)},{kind:'refresh',time:new Date(now-2*H),feedingRatio:1},{kind:'fridge_in',time:new Date(now+4*H)},{kind:'fridge_out',time:new Date(now+20*H)},{kind:'pre_mix',time:new Date(now+22*H),feedingRatio:1}];
  const late=shiftStarterPlanAfterFeed(events,events[1],now-2*H+12*M,now+30*H,undefined,{busy:()=>true,now});
  a.equal(late.mixShiftMs,0);a.equal(late.busy,false);
  a.deepEqual(late.events.map(e=>+e.time),[+events[0].time,now-2*H+12*M,...events.slice(2).map(e=>+e.time)]);
  // Beyond it the chain follows as before.
  const later=shiftStarterPlanAfterFeed(events,events[1],now-2*H+40*M,now+30*H,undefined,{now});
  a.equal(+later.events[2].time,+events[2].time+45*M);
});

// Priya, Wed 25 Nov 8:00pm: the pizza (Sat 7:30pm) refreshes the jar Wed 9:45pm and feeds it again Thu 8:45am for its
// 3:30pm mix; the loaf (Fri 11:30am) has its pre-mix feed Wed 9:45pm for a Thu 7:45am mix. One feed, two bakes.
const pizza={id:'pizza',name:'the pizzas',feedAt:D(26,8,45),peakAt:D(26,15,30),mixAt:D(26,15,30),ratio:1,need:{mid:150,max:160},bakeAt:D(28,19,30),
  feeds:[{at:D(25,21,45),ratio:1},{at:D(26,8,45),ratio:1}]};
const loaf={id:'loaf',name:'the loaf',feedAt:D(25,21,45),peakAt:D(26,8,0),mixAt:D(26,7,45),ratio:1,need:{mid:100,max:110},bakeAt:D(27,11,30),
  feeds:[{at:D(25,21,45),ratio:1}]};
const now=D(25,20,5);

test('two bakes feeding the jar at the same time: one feed for both, either bake computes the same pair',()=>{
  const fromLoaf=sharedStarterFeedFor(loaf,[pizza],now),fromPizza=sharedStarterFeedFor(pizza,[loaf],now);
  a.ok(fromLoaf&&fromPizza);
  a.equal(fromLoaf.at,D(25,21,45));a.equal(fromPizza.at,D(25,21,45));
  a.equal(fromLoaf.leads,false,'the loaf builds its levain from the pizza\'s refresh');a.equal(fromPizza.leads,true);
  const p=starterBuild(150,160,1),l=starterBuild(100,110,1),later=starterBuild(150,160,1);
  for(const s of [fromLoaf,fromPizza]){
    a.equal(s.first.name,'the pizzas');a.equal(s.first.grams,p.total);a.equal(s.second.grams,l.total);
    a.equal(s.build.total,p.total+l.total);
    // One "keep the rest": what the jar holds once both doughs have their levain, the pizza's Thu feed included.
    a.equal(s.keep,p.total+l.total+later.flour+later.water-150-100);
  }
  a.equal(fromLoaf.keep,fromPizza.keep);
  // The loaf keeps its own peak (its feed did not move).
  a.equal(fromLoaf.peakAt,loaf.peakAt);
  // The loaf shows the pizza's jar steps up to the shared feed, then the shared feed as its pre-mix feed.
  const jar=[{kind:'last_fed',time:new Date(D(17,16))},{kind:'fridge_out',time:new Date(D(25,20,15))},{kind:'refresh',time:new Date(D(25,21,45))},{kind:'pre_mix',time:new Date(D(26,8,45))}];
  const own=[{kind:'last_fed',time:new Date(D(17,16))},{kind:'fridge_out',time:new Date(D(25,20,15))},{kind:'pre_mix',time:new Date(D(25,21,45)),bellPeakTime:new Date(loaf.peakAt)}];
  const shown=starterEventsWithSharedFeed(own,fromLoaf,now,jar);
  a.deepEqual(shown.map(e=>e.kind),['last_fed','fridge_out','pre_mix']);
  a.equal(shown.filter(e=>e.jar).length,2);
});

test('the same-time pairing needs the same ratio and the same quarter; pre-mix pairs are unchanged',()=>{
  a.equal(sharedStarterFeedFor({...loaf,ratio:2},[pizza],now),null,'another ratio: two feeds');
  a.equal(sharedStarterFeedFor({...loaf,feedAt:D(25,22,15),peakAt:D(26,8,30),feeds:[{at:D(25,22,15),ratio:1}]},[pizza],now),null,'30 min apart');
  // Two pre-mix feeds whose ready window holds the other mix: the round 7 pair, as before.
  const a1={id:'a',name:'the campagne',feedAt:D(26,8),peakAt:D(26,17),mixAt:D(26,17),ratio:2,need:{mid:120,max:130},feeds:[{at:D(26,8),ratio:2}]};
  const b1={id:'b',name:'the baguettes',feedAt:D(26,8,30),peakAt:D(26,17,30),mixAt:D(26,17,30),ratio:2,need:{mid:90,max:100},feeds:[{at:D(26,8,30),ratio:2}]};
  const s=sharedStarterFeedFor(b1,[a1],D(26,6));
  a.equal(s.at,D(26,8));a.equal(s.keep,starterBuild(120,130,2).total+starterBuild(90,100,2).total-210);
});

test('a starter in the fridge always has its take-out before its first feed',()=>{
  const events=[{kind:'last_fed',time:new Date(D(17,16))},{kind:'refresh',time:new Date(D(25,21,45))},{kind:'pre_mix',time:new Date(D(26,8,45))}];
  const shown=withStarterTakeOut(events,true,1.5,D(25,20,0),false);
  a.deepEqual(shown.map(e=>e.kind),['last_fed','fridge_out','refresh','pre_mix']);
  a.equal(+shown[1].time,D(25,20,15));a.equal(shown[1].cardNote,'~90 min to reach room temp');
  a.equal(withStarterTakeOut(events,true,1.5,D(25,20,0),true)[1].cardNote,'~90 min pour atteindre la temp. ambiante');
  // Never before now; nothing for a starter on the counter or one whose removal is planned.
  a.equal(+withStarterTakeOut(events,true,1.5,D(25,20,40),false)[1].time,D(25,20,40));
  a.equal(withStarterTakeOut(events,false,1.5,D(25,20,0),false),events);
  const planned=[events[0],{kind:'fridge_out',time:new Date(D(25,20,15))},events[1],events[2]];
  a.equal(withStarterTakeOut(planned,true,1.5,D(25,20,0),false),planned);
  // A loaf whose starter went straight into the fridge after its last feed and comes out before the pre-mix: unchanged.
  const loafPlan=[events[0],{kind:'fridge_in',time:new Date(D(17,16)),historicalStorage:true},{kind:'fridge_out',time:new Date(D(25,20,15))},{kind:'pre_mix',time:new Date(D(25,21,45))}];
  a.equal(withStarterTakeOut(loafPlan,true,1.5,D(25,20,0),false),loafPlan);
});
