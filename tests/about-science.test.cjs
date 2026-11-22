// About (round 7): present tense only, no files the baker cannot open, and the science numbers the engines'.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ts=require('typescript'),Module=require('node:module');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
// Comments (// line, /* block */, {/* JSX */}) are for developers; everything else can reach the page.
const stripComments=s=>s.replace(/\{\/\*[\s\S]*?\*\/\}/g,'').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/[^\n]*/g,'$1');
const aboutDir='app/[locale]/about';
const sources=()=>{
  const out=fs.readdirSync(path.join(__dirname,'..',aboutDir)).filter(f=>f.endsWith('.tsx')).map(f=>[`${aboutDir}/${f}`,stripComments(read(`${aboutDir}/${f}`))]);
  // About strings in the message files, when there are any.
  for(const loc of ['en','fr']){const m=JSON.parse(read(`messages/${loc}.json`));if(m.about)out.push([`messages/${loc}.json about`,JSON.stringify(m.about)]);}
  return out;
};

test('About names no repository file, no history and no date, in either language',()=>{
  const banned=[/docs\//i,/\.md\b/i,/github/i,/replaced/i,/\bearlier\b/i,/previous/i,/2026/,/remplac[ée]/i,/auparavant/i,/\bancienne?s?\b/i];
  for(const [file,src] of sources())for(const re of banned)a.doesNotMatch(src,re,`${file} matches ${re}`);
});

test('the comment stripper keeps the text it must check',()=>{
  a.equal(stripComments("<P>a</P> // note docs/X.md\n{/* github */}<B>b</B>"),"<P>a</P> \n<B>b</B>");
  a.equal(stripComments("href='https://example.com'"),"href='https://example.com'");
});

const about=read(`${aboutDir}/AboutClient.tsx`);
const fr=about.slice(about.indexOf('  fr: {')),en=about.slice(0,about.indexOf('  fr: {'));
const {utils,data}=require('./load-production.cjs');

test('About: style blueprints, oven and flour corrections are the engine\'s',()=>{
  // Blueprints (utils.ts STYLE_FERM_DEFAULTS) through the planner's own window for the style.
  const rows=[['Neapolitan, New York','neapolitan',24,2],['Pain de campagne','pain_campagne',18,3],['Pain au levain','pain_levain',16,4],['Baguette','baguette',12,2],['Roman','roman',0,6],['Pan pizza','pan',0,5]];
  for(const [label,,cold,rt] of rows)a.ok(en.includes(`['${label}', '${cold?cold+' h':'—'}', '${rt} h']`),label);
  // Oven hydration deltas.
  const O={...data.OVEN_TYPES,...data.BREAD_OVEN_TYPES};
  a.equal(O.pizza_oven.hydrationDelta,-2);a.equal(O.electric_pizza.hydrationDelta,-1);a.equal(O.home_oven_steel.hydrationDelta,3);a.equal(O.home_oven_standard.hydrationDelta,4);
  a.equal(O.dutch_oven.hydrationDelta,2);a.equal(O.home_oven_stone_bread.hydrationDelta,2);a.equal(O.steam_oven.hydrationDelta,3);a.equal(O.standard_bread.hydrationDelta,3);
  a.equal(O.wood_fired.hydrationDelta,0);a.equal(O.griddle.hydrationDelta,0);
  a.equal(O.pizza_oven.forceOil,0);a.equal(O.electric_pizza.forceSugar,0);
  a.equal(Math.min(...Object.values(O).map(o=>o.preheatMin)),5);a.equal(Math.max(...Object.values(O).map(o=>o.preheatMin)),60);
  a.doesNotMatch(about,/cast iron|fonte/i,'no cast-iron oven exists');
  // Flour tolerance and hydration per flour.
  const F=data.FLOUR_DATA;
  for(const [k,t,h] of [['manitoba',1.35,3],['strong00',1.2,2],['pizza00',1,0],['bread',0.9,1],['semolina',0.85,-1],['wholemeal',0.8,4],['allpurpose',0.75,-2],['rye',0.7,6]]){a.equal(F[k].fermTolerance,t,k);a.equal(F[k].hydrationDelta,h,k);}
  a.ok(en.includes('Manitoba 1.35')&&fr.includes('Manitoba 1,35'));
  // A stated W sets tolerance through ftmFromW's anchors; hydration never follows W; the yeast follows the hours (21 Nov 2026).
  for(const [w,t] of [[130,0.75],[200,0.9],[250,1],[300,1.2],[360,1.35]])a.ok(Math.abs(data.ftmFromW(w)-t)<1e-9,`W${w}`);
  for(const s of ['0.75 at W 130','0.9 at W 200','1.0 at W 250','1.2 at W 300','1.35 at W 360','Hydration follows the flour type, never its W'])a.ok(en.includes(s),s);
  for(const s of ['0,75 à W 130','0,9 à W 200','1,0 à W 250','1,2 à W 300','1,35 à W 360','L’hydratation suit le type de farine, jamais son W'])a.ok(fr.includes(s),s);
  a.doesNotMatch(about,/divides the commercial yeast|divise la levure/,'the yeast is not divided by the tolerance');
  // The levain amount does not follow flour strength (21 Nov 2026, round 8).
  a.doesNotMatch(about,/and the levain amount\.|et la quantité de levain\./,'the tolerance does not scale the levain amount');
  a.ok(en.includes('it does not change the levain amount')&&fr.includes('elle ne change pas la quantité de levain'));
  for(const ftm of [0.7,1.35])a.equal(utils.referenceStarterPct(22,ftm),utils.referenceStarterPct(22));
  // Style hydration and floors.
  const S={...data.PIZZA_STYLES,...data.BREAD_STYLES};
  for(const [k,v] of [['neapolitan',62],['newyork',62],['baguette',68],['pan',70],['pain_levain',75],['roman',78]])a.equal(S[k].hydration,v,k);
  // Target dough temperatures and kneading heat.
  for(const [k,v] of [['neapolitan',23],['brioche',22],['roman',25],['pan',25],['baguette',24],['pain_campagne',24]])a.equal(utils.TARGET_FDT[k],v,k);
  const M=data.MIXER_TYPES;
  for(const [k,r,min] of [['hand',0.16,10],['stand',0.6,8],['spiral',0.55,14],['no_knead',0,0]]){a.equal(M[k].frictionRiseCPerMin,r,k);a.equal(M[k].kneadMin,min,k);}
  a.equal(utils.WATER_TEMP_MIN,2);a.equal(utils.WATER_TEMP_MAX,40);
  a.doesNotMatch(about,/Gradual cooling|enriched doughs 22/,'the thermal path models cooling; only brioche targets 22 °C');
});

test('About: sourdough numbers are the solver\'s',()=>{
  const {getPrefPeakH_RT,getStarterTroughH,getStarterFridgeWarmupH}=require('../app/components/FermentChart.tsx');
  const sp=require('../app/utils/starterPeak.ts');
  const q=h=>Math.round(h*4)/4;
  a.equal(q(getPrefPeakH_RT('sourdough',18)),10.25);a.equal(q(getPrefPeakH_RT('sourdough',22)),6.75);a.equal(q(getPrefPeakH_RT('sourdough',26)),4.5);a.equal(q(getPrefPeakH_RT('sourdough',30)),3);
  a.equal(getPrefPeakH_RT('sourdough',34),getPrefPeakH_RT('sourdough',30));
  a.ok(Math.abs(getStarterTroughH(22,true)/getPrefPeakH_RT('sourdough',22)-1.8)<1e-9);
  for(const [r,x] of [[2,'1.35'],[5,'1.8'],[10,'2.15']])a.equal((1+0.5*Math.log(r)).toFixed(r===5?1:2),x);
  for(const [T,h] of [[22,1.5],[27,1],[29,0.75],[31,0.5]])a.equal(getStarterFridgeWarmupH(T),h);
  // Rest stretch ladder, pre-mix stretch and the ready window.
  const P=6,TR=10.8;
  a.deepEqual([P,P*1.4,TR,TR*1.4,TR*2,TR*3].map(h=>sp.restStretchFactor(h,P,TR)),[1,1.05,1.15,1.25,1.35,1.5]);
  a.equal(sp.computePreMixStretchFactor(0,3*3600000),1.2);
  a.ok(sp.mixNearPeak(-(1.5)*3600000,0,6)&&!sp.mixNearPeak(-(1.6)*3600000,0,6)&&sp.mixNearPeak(3600000,0,6)&&!sp.mixNearPeak(1.1*3600000,0,6));
  // Levain bulk and the starter-amount example.
  a.equal(utils.sourdoughBulkH('pain_levain',22),5);
  a.equal(Math.round(5*utils.starterBulkFactor(utils.referenceStarterPct(22)/2,22)*2)/2,7.5);
  a.equal(utils.AUTO_STARTER_MAX_PCT,30);
  for(const s of ['10¼ h','6¾ h','4½ h','7½ hours','1.35 times','2.15 times','30 %'])a.ok(en.includes(s),s);
  for(const s of ['10 h 15','6 h 45','4 h 30','7 h 30','1,35 fois','2,15 fois','30 %'])a.ok(fr.includes(s),s);
  a.doesNotMatch(about,/few percent|quelques pour cent/,'cold phases are not re-timed; no unsupported fridge rate');
});

test('About: schedule and preferment limits are the planner\'s',()=>{
  const {commercialPrefermentWindow}=require('../app/components/SchedulePicker.tsx');
  const w=(t,f,T)=>commercialPrefermentWindow(t,f,T,'neapolitan',6);
  a.deepEqual(w('poolish',true,22),{min:8,max:24});a.deepEqual(w('biga',true,22),{min:24,max:58});
  // One biga window per storage everywhere (S5, round 8): the planner's, the entered yeast's and About's.
  a.deepEqual(w('biga',false,18),{min:12,max:20});
  const py=require('../app/utils/prefermentYeast.ts');
  a.deepEqual(py.prefermentYeastBounds('biga',true),{min:24,max:58});a.deepEqual(py.prefermentYeastBounds('biga',false),{min:12,max:20});
  a.equal(data.BIGA_COOL_C,18);a.equal(data.BIGA_COOL_OFFER_MAX_KITCHEN_C,20);
  for(const s of ['aimed at 48 hours, from 24 to 58','about 18 °C','aimed at 16 hours, from 12 to 20','at 20 °C or cooler'])a.ok(en.includes(s),s);
  const ym=read(`${aboutDir}/yeastModelSection.tsx`);a.ok(ym.includes('24–58 h in the fridge or 12–20 h in a cool spot for a biga')&&ym.includes('entre 24 et 58 h au frigo ou 12 et 20 h dans un endroit frais pour une biga'));a.doesNotMatch(ym,/12–72|12 et 72 h/);
  for(const s of ['visée à 48 heures, de 24 à 58','vers 18 °C','visée à 16 heures, de 12 à 20','à 20 °C ou moins'])a.ok(fr.includes(s),s);
  a.doesNotMatch(about,/12–72|12 et 72|never beyond 72|jamais au-delà de 72|always in the fridge|toujours au frigo/);
  a.equal(w('poolish',false,22).max,13);
  const {getPrefPeakH_RT}=require('../app/components/FermentChart.tsx');
  for(const [T,h] of [[22,11],[24,9],[26,7],[28,5],[30,4],[32,3]])a.equal(getPrefPeakH_RT('poolish',T,'neapolitan'),h);
  a.equal(getPrefPeakH_RT('poolish',22,'baguette'),12);
  a.equal(data.PREFERMENT_TYPES.biga.hydration,45);a.equal(data.PREFERMENT_TYPES.poolish.hydration,100);
  a.ok(en.includes('a biga (45 %)')&&fr.includes('une biga (45 %)'));
  a.doesNotMatch(about,/50% hydration|50 ?% d'hydratation|38–58/);
  // Nights preset.
  a.match(read('app/lib/profile.ts'),/sleep: \{ enabled: true, from: '23:00', to: '07:00' \}/);
});

test('About: Reading your plan matches the readiness strip and the peak format',()=>{
  const pt=require('../app/utils/peakTime.ts');
  // The strip's window is the planner's band (mixNearPeak), named in whole hours inside it.
  const peak=new Date(2026,10,21,17,45).getTime(),band=pt.readyBand(peak,6.75);
  a.equal(peak-band.from,(Math.max(1,Math.min(3,6.75*0.15))+0.5)*3600000);
  a.equal(band.to-peak,Math.max(1,Math.min(3,6.75*0.15))*3600000);
  a.equal(pt.readyLabel(pt.readyHours(band),false),'ready 5–6pm');a.equal(pt.readyLabel(pt.readyHours(band),true),'prêt 17h–18h');
  a.equal(pt.peakAround(new Date(2026,10,21,17,42),false),'around 5:45pm');a.equal(pt.peakAround(new Date(2026,10,21,17,42),true),'vers 17h45');
  a.ok(en.includes('&ldquo;ready 4–7pm&rdquo;')&&en.includes('&ldquo;around 5:45pm&rdquo;'));
  a.ok(fr.includes('« prêt 16h–19h »')&&fr.includes('« vers 17h45 »'));
  a.doesNotMatch(about,/Fermentation curve|Courbe de fermentation|gold curve|courbe dorée|diamond|losange/i);
});

test('About: the baguette apprêt bound and one jar for two bakes are the engine\'s',()=>{
  // A shaped baguette: 1.5 h at 24 °C through the yeast model's activity (preheat 0: hours to the bake).
  for(const [T,h] of [[20,2],[18,2.5],[16,3]])a.equal(utils.styleMaxFinalProofHours('baguette',T,true,false,0),h,`${T} °C`);
  a.ok(en.includes('1½ hours at 24 °C')&&en.includes('about 2 hours at 20 °C, 2½ at 18 °C, 3 at 16 °C'));
  a.ok(fr.includes('1 h 30 à 24 °C')&&fr.includes('environ 2 heures à 20 °C, 2 h 30 à 18 °C, 3 heures à 16 °C'));
  // Round 8 (M3): the 2 h is the apprêt. The plan takes shaped pieces out 45 min before it (2 h 45 to the bake at
  // 20 °C), and dough chilled before shaping rests 1 h out of the fridge before it: the sentence says both.
  const H=3600000,bake=new Date(2026,10,28,12,0);
  const split=utils.buildSchedule(new Date(2026,10,27,12,0),bake,[],20,45,'hand','baguette',4,1);
  a.ok(split.coldRetard2Start&&split.rtWarmupStart,'a long plan shapes in the fridge');
  a.equal((+split.bakeStart-+split.finalProofStart)/H,2);a.equal((+split.bakeStart-+split.coldRetardEnd)/H,2.75);
  const bulk=utils.buildSchedule(new Date(2026,10,27,22,0),bake,[],20,45,'hand','baguette',4,1);
  a.ok(!bulk.coldRetard2Start);a.equal(bulk.restRtHours,1);a.equal((+bulk.bakeStart-+bulk.finalProofStart)/H,2);
  // Round 9 (M): dough chilled before shaping is divided and shaped at the take-out (the plan's divide step),
  // with an hour before the apprêt: out 3 h before the bake. A short window keeps the cold and shortens the apprêt (≥ 1 h).
  a.equal(+bulk.divideBallTime,+bulk.coldRetardEnd,'shaped at the take-out');
  a.equal((+bulk.finalProofStart-+bulk.coldRetardEnd)/H,1);a.equal((+bulk.bakeStart-+bulk.coldRetardEnd)/H,3);
  const short=utils.buildSchedule(new Date(+bake-12*H),bake,[],20,45,'hand','baguette',2,1,false,1,undefined,'all');
  a.ok(!short.coldRetard2Start&&short.finalProofHours>=1&&short.finalProofHours<2,`short apprêt ${short.finalProofHours}`);
  a.equal((+short.bakeStart-+short.coldRetardEnd)/H,2.25,'Thomas, Simple: out 9:15 for 11:30');
  a.ok(en.includes('shaped pieces kept in the fridge take 45 minutes, so they come out about 2¾ hours before the bake at 20 °C; dough chilled before shaping is divided and shaped as it comes out and has an hour before its apprêt, so it comes out about 3 hours before.'));
  a.ok(en.includes('when the window is short it keeps its share and the apprêt shortens, never below an hour'));
  a.ok(fr.includes('des pâtons façonnés gardés au frigo y mettent 45 minutes, ils sortent donc environ 2 h 45 avant la cuisson à 20 °C ; une pâte mise au froid avant le façonnage est divisée et façonnée dès la sortie et a une heure avant son apprêt, elle sort donc environ 3 heures avant.'));
  a.ok(fr.includes('quand la fenêtre est courte, il garde sa part et l’apprêt raccourcit, jamais sous une heure'));
  a.doesNotMatch(about,/rests an hour out of the fridge, then is shaped|repose une heure à la sortie, puis/);
  // Shared feed: the later mix inside the earlier feed's ready window (mixNearPeak).
  const sh=read('app/utils/sharedStarter.ts');a.match(sh,/mixNearPeak/);
  a.ok(en.includes('One jar, two bakes')&&fr.includes('Un pot, deux fournées'));
});

test('About: one fridge trip for hot kitchens and when the bake is not customized (round 8 kitchen plans)',()=>{
  const H=3600000,bake=new Date(2026,10,28,19,0),spells=p=>utils.fridgeSpellCount(p);
  const plan=(T,h,ladder,style='neapolitan')=>utils.buildSchedule(new Date(+bake-h*H),bake,[],T,45,'hand',style,4,1,false,1,undefined,ladder);
  // Not customized ('all'): one trip at every temperature, shaped before the cold.
  for(const T of [18,22,26,30])for(const h of [14,20,30]){const p=plan(T,h,'all');a.ok(spells(p)<=1,`Simple ${T} °C ${h} h`);}
  const simple=plan(22,20,'all');a.equal(spells(simple),1);a.ok(+simple.divideBallTime<+(simple.coldRetard2Start??simple.coldRetardStart),'shaped before the cold');
  // Customized: one trip from 28 °C, the two-stage cold below it when the window holds it.
  for(const T of [28,30,32])for(const h of [16,20,30])a.ok(spells(plan(T,h,'hot'))<=1,`Custom ${T} °C ${h} h`);
  a.equal(spells(plan(24,30,'hot')),2,'Custom 24 °C keeps two stages');
  // A short hot plan that still calls for 0.1 % instant yeast stays out of the fridge.
  a.equal(utils.HOT_ROOM_MIN_IDY_PCT,0.1);
  const room=plan(31,6,'hot');a.equal(room.totalColdHours,0);
  // Shaped pieces out of the fridge: 45 min, 30 min from 30 °C.
  for(const [T,m] of [[24,45],[28,45],[30,30]]){const two=plan(T,30,'off');a.ok(two.rtWarmupStart,`${T}`);a.equal((+two.rtWarmupEnd-+two.rtWarmupStart)/60000,m,`${T} °C warm-up`);}
  a.ok(en.includes('One trip to the fridge for a yeast dough in a kitchen at 28 °C or more, and in every kitchen when you do not customize your bake'));
  a.ok(en.includes('at least 0.1 % instant yeast')&&en.includes('Shaped pieces take 45 minutes out of the fridge before the final proof (30 minutes from 30 °C)'));
  a.ok(fr.includes('Un seul passage au frigo pour une pâte à la levure dans une cuisine à 28 °C ou plus, et dans toutes les cuisines quand vous ne personnalisez pas votre fournée'));
  a.ok(fr.includes('au moins 0,1 % de levure instantanée')&&fr.includes('Les pâtons sortent du frigo 45 minutes avant l’apprêt (30 minutes dès 30 °C)'));
  a.doesNotMatch(about,/two cold spells|deux passages au froid/);
  // Sourdough (round 9, K): not customized ('all') one trip, shaped before the cold; customized ('hot') keeps the engine's plan.
  // Priya, 20 °C, Fri 7:00 → Sat 8:30pm: shape 1:30pm, in 1:45pm (Custom: two spells).
  const s0=new Date(2026,10,27,7,0),s1=new Date(2026,10,28,20,30);
  const lev=(style,ladder,from=s0,T=20)=>utils.buildSchedule(from,s1,[],T,45,'hand',style,4,1,true,1,undefined,ladder);
  for(const style of ['sourdough','pain_levain']){
    const one=lev(style,'all');a.equal(spells(one),1,style);a.ok(+one.divideBallTime<+(one.coldRetard2Start??one.coldRetardStart),`${style} shaped first`);
    a.equal(spells(lev(style,'hot')),2,`${style} customized keeps its plan`);
    // Same fallbacks: where one trip would add a clash or a night step it keeps the engine's plan; never the room plan.
    for(const T of [18,22,26,30])for(const h of [14,24,36]){const from=new Date(+s1-h*H),p=lev(style,'all',from,T),eng=lev(style,'off',from,T);
      a.ok(spells(eng)===0||p.totalColdHours>0,`${style} ${T} °C ${h} h never skips the fridge`);
      a.ok(spells(p)<=1||(spells(p)===spells(eng)&&+p.divideBallTime===+eng.divideBallTime),`${style} ${T} °C ${h} h: one trip or the engine's plan`);}
  }
  a.ok(en.includes('A sourdough bake you do not customize takes the same one trip, with the same fallbacks, and never skips the fridge; a customized sourdough bake keeps its own plan.'));
  a.ok(fr.includes('Une fournée au levain que vous ne personnalisez pas fait le même passage unique, avec les mêmes solutions de repli, et ne se passe jamais du frigo ; une fournée au levain personnalisée garde son propre planning.'));
});

test('About: the cold retard follows the flour tolerance, and a stated W moves the plan (round 9, J)',()=>{
  // The planner aims the cold at the style's coldH × tolerance (SchedulePicker scaledDefaults); 24 h × 1.2 ≈ 29.
  const sp=read('app/components/SchedulePicker.tsx');
  a.match(sp,/coldH:\s+Math\.round\(defaults\.coldH \* ftm\)/);a.match(sp,/preferredColdH: Math\.round\(\(defaults\.preferredColdH \?\? defaults\.coldH\) \* ftm\)/);
  a.equal(Math.round(24*1.2),29);a.ok(en.includes('24 hours become about 29 with a 1.2 flour')&&fr.includes('24 heures deviennent environ 29 avec une farine à 1,2'));
  // A flour change re-times a yeast plan (the planner is unmounted on the Flour step: the page's replan flag).
  const page=read('app/[locale]/page.tsx');
  a.match(page,/onBlendChange=\{b => \{[\s\S]{0,400}recipeFlourStrength\(styleKey \?\? '', 'custom', b\) !== flourStrength\) setPlanReplanPending\(true\)/);
});

