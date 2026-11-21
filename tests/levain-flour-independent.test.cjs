// The levain % does not depend on the flour (21 Nov 2026, round 8). No study, professional
// text or practitioner data ties the inoculation to flour strength: strength sets how long a
// dough holds (tolerance → time), not how fast it ferments. The starter %, its reference, the
// bulk factor for a baker-entered % and the raise ladder are the same for every flour; the
// flour still changes the bulk cues (and the cold/preferment windows elsewhere).
const {test}=require('node:test'),a=require('node:assert/strict');
const {utils,data}=require('./load-production.cjs');
const H=3600000,bake=new Date('2026-12-05T19:00:00Z'),start=new Date(+bake-40*H);
const TEMPS=[16,20,24,28,32];
const single=k=>({flour1:k,flour2:null,ratio1:100});
// Every flour key, two stated-W wheat flours (ftmFromW 0.75 and 1.35), and the style presets.
const blends=[
  ...Object.keys(data.FLOUR_DATA).filter(k=>!['none','poolish'].includes(k)).map(k=>[k,'pain_levain',single(k)]),
  ['pizza00 W130 stated','pain_levain',{...single('pizza00'),w1:130,w1Source:'manual'}],
  ['manitoba W360 stated','pain_levain',{...single('manitoba'),w1:360,w1Source:'photo'}],
  ['no flour chosen','pain_levain',undefined],
  ...Object.keys(data.STYLE_DEFAULT_BLENDS).map(k=>[`${k} preset`,k,undefined]),
];
const sched=(style,factor=1)=>utils.buildSchedule(start,bake,[],20,45,'hand',style,1,1,true,factor);
const recipe=(style,T,blend,feedToMixH,pct)=>utils.calculateRecipe(style,'dutch_oven',1,900,T,'normal',sched(style),6,'sourdough','custom','hand',
  undefined,undefined,undefined,blend,'none',null,undefined,undefined,undefined,false,1.5,undefined,feedToMixH,undefined,undefined,undefined,undefined,undefined,pct);
const pctOf=r=>[r.sourdough.starterPctMin,r.sourdough.starterPctMax];

test('the strengths in the sweep really differ',()=>{
  const s=new Set(blends.map(([,style,b])=>data.recipeFlourStrength(style,'custom',b)));
  a.ok(s.has(0.7)&&s.has(1.35)&&s.has(0.75)&&s.has(1),[...s].join());
});

test('reference %, bulk factor and raise ladder take no flour',()=>{
  a.equal(utils.referenceStarterPct.length,1);
  a.equal(utils.starterBulkFactor.length,2);
  a.equal(utils.raisedStarterPcts.length,1);
  a.equal(utils.raisedLevainFits.length,5);
  for(const T of TEMPS){
    a.ok(utils.referenceStarterPct(T)>0);
    // Extra arguments (an old caller passing a strength) change nothing.
    for(const ftm of [0.7,1,1.35]){
      a.equal(utils.referenceStarterPct(T,ftm),utils.referenceStarterPct(T));
      a.deepEqual(utils.raisedStarterPcts(T,ftm),utils.raisedStarterPcts(T));
      for(const p of [10,15,25])a.equal(utils.starterBulkFactor(p,T,ftm),utils.starterBulkFactor(p,T));
    }
  }
});

test('the recipe\'s starter % and grams are the same for every flour',()=>{
  for(const T of TEMPS)for(const fm of [undefined,4,8,12])for(const pct of [undefined,15,25]){
    const ref=recipe('pain_levain',T,undefined,fm,pct);
    for(const [name,style,b] of blends){
      const r=recipe(style,T,b,fm,pct);
      a.deepEqual(pctOf(r),pctOf(ref),`${name} ${T} °C feed→mix ${fm} pct ${pct}`);
      // Same % of the same formula flour: identical grams where the flour total is the same.
      if(r.flour===ref.flour)a.equal(r.sourdough.starterGramsMid,ref.sourdough.starterGramsMid,name);
    }
  }
});

test('a baker-entered % gets the same bulk on every flour',()=>{
  for(const T of TEMPS)for(const pct of [10,15,25,30]){
    const f=utils.starterBulkFactor(pct,T);
    a.equal(Math.abs(f-1)<1e-9,Math.abs(pct-utils.referenceStarterPct(T))<1e-9,'neutral only at the reference');
    const s=utils.buildSchedule(start,bake,[],T,45,'hand','pain_levain',1,1,true,f);
    a.ok(s.bulkFermStart instanceof Date);
  }
});

test('the raise check depends on flour grams, not flour strength',()=>{
  const flour=500;
  a.equal(utils.raisedLevainFits(flour,19,undefined,30,[1]),false);
  a.equal(utils.raisedLevainFits(flour,19,undefined,30,[1,1]),true);
});

test('the bulk cues still follow the flour',()=>{
  const cue=b=>recipe('pain_levain',22,b,undefined,undefined).sourdough.bulkCues;
  const weak=cue(single('allpurpose')),std=cue(single('pizza00')),strong=cue(single('manitoba'));
  a.notDeepEqual(weak,std);a.notDeepEqual(strong,std);
  a.match(weak[0],/50–75%/);a.match(strong[4],/strong flour can go longer/);
  a.equal(weak[4],'Weaker flour holds less — end the bulk at a smaller rise');
  a.ok(!weak.some(s=>/ferments faster/.test(s)),'weak flour is not said to ferment faster');
  const en=require('../messages/en.json'),fr=require('../messages/fr.json');
  a.deepEqual(en.recipeOutput.bulkCues.weak,weak);
  a.ok(!en.recipeOutput.bulkCues.weak.some(s=>/ferments faster/.test(s)));
  a.ok(fr.recipeOutput.bulkCues.weak.some(s=>/tient moins/.test(s)));
});

// Bakes saved before the change keep the bulk they were timed with (never re-timed on opening).
test('a saved bake keeps its old bulk: legacyStarterBulkFactor is the old flour-scaled factor',()=>{
  const before=require('./fixtures/levain-flour-before.json');
  let n=0;
  for(const [k,v] of Object.entries(before)){
    const [f,T,,pct]=k.split('|');if(pct==='-')continue;
    a.equal(utils.legacyStarterBulkFactor(Number(pct),Number(T),v.ftm),v.factor,k);n++;
  }
  a.ok(n>=400,String(n));
  a.equal(utils.legacyStarterBulkFactor(undefined,19,0.9),1);
  for(const T of TEMPS)for(const p of [15,25])a.equal(utils.legacyStarterBulkFactor(p,T,1),utils.starterBulkFactor(p,T),'reference flour: same factor');
});

test('restoredLevainLegacy: only an old session with a % on a flour other than the reference',()=>{
  const {restoredLevainLegacy}=require('../app/utils/levainLegacy.ts');
  const bread={flour1:'bread',flour2:null,ratio1:100};
  const old={yeastType:'sourdough',styleKey:'pain_levain',flourChosen:true,flourBlend:bread,autoStarterPct:27.5};
  a.deepEqual(restoredLevainLegacy(old),{pct:27.5,strength:0.9});
  a.deepEqual(restoredLevainLegacy({...old,autoStarterPct:undefined,starterPctOverride:15}),{pct:15,strength:0.9});
  a.equal(restoredLevainLegacy({...old,autoStarterPct:undefined}),null,'default %: factor 1 either way');
  a.equal(restoredLevainLegacy({...old,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100}}),null,'reference flour');
  a.equal(restoredLevainLegacy({...old,levainLegacy:null}),null,'saved since the change');
  a.deepEqual(restoredLevainLegacy({...old,levainLegacy:{pct:20,strength:1.35}}),{pct:20,strength:1.35});
  a.deepEqual(restoredLevainLegacy({yeastType:'sourdough',styleKey:'pain_seigle',flourChosen:false,flourBlend:null,starterPctOverride:20}).strength,data.recipeFlourStrength('pain_seigle','custom'));
  a.equal(restoredLevainLegacy({...old,yeastType:'instant'}),null);
});

// The starter's ready band is the starter's (21 Nov 2026, round 8 follow-up): the dough's flour
// no longer widens the solver's green band (TOL × ftm), so solver ≡ strip ≡ mixNearPeak for every flour.
test('the starter peak band takes no flour and equals mixNearPeak and the strip band',()=>{
  const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
  const resolve=Module._resolveFilename;
  Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
  require.extensions['.tsx']??=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
  const {knownPeakMixUsable}=require('../app/components/SchedulePicker.tsx');
  const {mixNearPeak}=require('../app/utils/starterPeak.ts');
  const {readyBand}=require('../app/utils/peakTime.ts');
  a.equal(knownPeakMixUsable.length,3);
  const H=3600000,peak=Date.parse('2026-11-20T17:00:00Z');
  for(const adj of [3,5,7,9,12,20,30])for(let m=-6*60;m<=5*60;m+=15){
    const mix=peak+m*60000;
    a.equal(knownPeakMixUsable(new Date(mix),new Date(peak),adj),mixNearPeak(mix,peak,adj),`adj ${adj} gap ${m} min`);
    // Extra arguments (an old caller passing a strength) change nothing.
    a.equal(knownPeakMixUsable(new Date(mix),new Date(peak),adj,1.35),knownPeakMixUsable(new Date(mix),new Date(peak),adj));
  }
  // The strip's ready window lies inside the same band.
  for(const adj of [5,9,20]){const b=readyBand(peak,adj);a.ok(mixNearPeak(b.from+1,peak,adj)&&mixNearPeak(b.to-1,peak,adj)&&!mixNearPeak(b.from-60000,peak,adj)&&!mixNearPeak(b.to+60000,peak,adj),String(adj));}
  // A mix 4.3 h before the peak is never "ready", whatever the dough's flour.
  a.equal(knownPeakMixUsable(new Date(peak-4.3*H),new Date(peak),30),false);
  const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app/components/SchedulePicker.tsx'),'utf8');
  a.doesNotMatch(src,/TOL(_r)?\s*=\s*baseTOL(_r)?\s*\*\s*ftm/,'no flour widening of the solver band');
});
