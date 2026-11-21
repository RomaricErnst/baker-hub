// Raised levain % (17 Nov 2026 cool-kitchen review: London, 19 °C, 900 g pain au levain,
// busy weekdays 9:00–17:30 and nights 23:00–7:00, bake Saturday 10:00). When the default
// warm bulk does not fit the evening after work, the planner may raise the inoculation
// (starterBulkFactor shortens the bulk) up to AUTO_STARTER_MAX_PCT, provided there is
// enough starter for the levain build. These are the engine pieces; the planner's search
// is covered by tests/roundtrip/levain-raise.mjs.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {findAvailabilityConflicts}=require('../app/utils/scheduleAvailability.ts');
const {starterBuild}=require('../app/utils/starterBuild.ts');
const H=3600000;
const OVEN='dutch_oven';
const bake=new Date(2026,10,21,10,0);
const blocks=[];
for(let d=17;d<=21;d++){
 blocks.push({from:new Date(2026,10,d,23,0),to:new Date(2026,10,d+1,7,0),label:'night'});
 if(d>=18&&d<=20)blocks.push({from:new Date(2026,10,d,9,0),to:new Date(2026,10,d,17,30),label:'work'});
}
const friday=(h,m=0)=>new Date(2026,10,20,h,m);
const plan=(mix,factor,mixer='no_knead',T=19)=>utils.buildSchedule(mix,bake,blocks,T,45,mixer,'pain_levain',1,1,true,factor);
const clashes=s=>findAvailabilityConflicts(s.availabilityActions,blocks).map(c=>c.action.id);

test('the raise levels: 2.5-point steps above the kitchen reference, never above 30 %',()=>{
 assert.equal(utils.AUTO_STARTER_MAX_PCT,30);
 assert.deepEqual(utils.raisedStarterPcts(19),[25,27.5,30]);
 assert.deepEqual(utils.raisedStarterPcts(25),[20,22.5,25,27.5,30]);
 for(const T of [12,17,19,22,25,28,32])for(const p of utils.raisedStarterPcts(T)){
  assert.ok(p>utils.referenceStarterPct(T)&&p<=30);
  assert.ok(utils.starterBulkFactor(p,T)<1,'a raise always shortens the bulk');
 }
});

test('her Friday: the default bulk runs into the night; 30 % levain fits bulk and shaping before 23:00',()=>{
 const usual=plan(friday(17,30),1);
 assert.ok(usual.bulkFermHours>6,'6.2 h at 19 °C');
 assert.ok(clashes(usual).length>0);
 const raised=plan(friday(17,30),utils.starterBulkFactor(30,19));
 assert.ok(raised.bulkFermHours<5.1,`bulk ${raised.bulkFermHours}`);
 assert.deepEqual(clashes(raised),[]);
 assert.ok(+raised.divideBallTime<=+friday(22,45),'shaped before the night');
 assert.equal(+raised.coldRetard2End,+raised.preheatStart,'baked straight from the fridge');
 assert.equal(utils.hasCoherentScheduleShape(raised,friday(17,30)),true);
});

test('kneaded by hand (Simple), even 30 % does not fit her evening: the autolyse and kneading come first',()=>{
 const f=utils.starterBulkFactor(30,19);
 for(let m=17*60+30;m<=19*60;m+=15)assert.ok(clashes(plan(friday(0,m),f,'hand')).length>0,`hand mix ${m/60}`);
});

test('a raised % reaches the recipe as one amount (and its levain build)',()=>{
 const sched=plan(friday(17,30),utils.starterBulkFactor(30,19));
 // calculateRecipe's positional arguments: hydration 75 % (12th), the starter % last (30th).
 const recipe=pct=>{const a=Array(30).fill(undefined);
  Object.assign(a,{0:'pain_levain',1:OVEN,2:1,3:900,4:19,5:'normal',6:sched,7:5,8:'sourdough',9:'custom',10:'no_knead',11:75,29:pct});
  return utils.calculateRecipe(...a);};
 const r=recipe(30),usual=recipe(undefined);
 assert.equal(r.sourdough.starterPctMin,30);
 assert.equal(r.sourdough.starterPctMax,30);
 assert.equal(r.sourdough.starterGramsMid,Math.round(r.flour*0.3));
 assert.equal(r.flour,usual.flour,'the flour total does not move with the starter %');
 assert.ok(starterBuild(r.sourdough.starterGramsMid,r.sourdough.starterGramsMax,1).total>starterBuild(usual.sourdough.starterGramsMid,usual.sourdough.starterGramsMax,1).total);
});

test('enough starter: a single 1:1:1 build cannot reach 30 % from the kept jar; a feed before it, or a lighter build, can',()=>{
 const flour=508;
 assert.equal(utils.raisedLevainFits(flour,19,undefined,30,[1]),false);
 assert.equal(utils.raisedLevainFits(flour,19,undefined,25,[1]),false);
 assert.equal(utils.raisedLevainFits(flour,19,undefined,30,[1,1]),true);
 assert.equal(utils.raisedLevainFits(flour,19,undefined,30,[2]),true);
 // the jar is the default bake's "keep the rest"
 const usual={mid:Math.round(flour*0.225/5)*5};
 assert.ok(usual.mid>0);
 assert.equal(utils.raisedLevainFits(0,19,undefined,30,[1,1]),false);
});
