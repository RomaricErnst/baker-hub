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
  a.ok(en.includes('1½ hours at 24 °C')&&en.includes('about 2 hours to the bake at 20 °C, 2½ at 18 °C, 3 at 16 °C'));
  a.ok(fr.includes('1 h 30 à 24 °C')&&fr.includes('environ 2 heures jusqu’à la cuisson à 20 °C, 2 h 30 à 18 °C, 3 heures à 16 °C'));
  // Shared feed: the later mix inside the earlier feed's ready window (mixNearPeak).
  const sh=read('app/utils/sharedStarter.ts');a.match(sh,/mixNearPeak/);
  a.ok(en.includes('One jar, two bakes')&&fr.includes('Un pot, deux fournées'));
});
