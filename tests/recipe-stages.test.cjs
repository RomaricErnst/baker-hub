const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const {recipeStages,stageYeastDoses,levainSplit}=require('../app/utils/recipeStages.ts');
const Recipe=require('../app/components/RecipeOutput.tsx').default;

// Round 7 (owner): the whole dough first, then what to weigh per stage; the stages add up to the whole.
// No hard-coded weights: the round7-finetune track changes the extra-dough allowance.
const STYLES=['neapolitan','newyork','pan','pain_campagne','baguette'];
function make(style,yeast,pref,blend,temp=22){
 const schedule=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-22T18:00Z'),[],temp,60,'hand',style);
 return utils.calculateRecipe(style,style.startsWith('pain')||style==='baguette'?'home_oven_stone_bread':'home_oven_standard',4,260,temp,'normal',schedule,4,yeast,'custom','hand',undefined,undefined,undefined,blend,pref,null,20,undefined,undefined,false,1.5,false,undefined,12);
}
const BLENDS=[undefined,{flour1:'pizza00',flour2:'manitoba',ratio1:85},{flour1:'bread',flour2:'rye',flour3:'wholemeal',ratio1:60,ratio2:25}];
const cases=[];
for(const style of STYLES)for(const blend of BLENDS){
 for(const yeast of ['instant','active_dry','fresh'])for(const pref of ['poolish','biga'])cases.push({style,blend,yeast,pref});
 cases.push({style,blend,yeast:'sourdough',pref:'levain'});
}
const near=(x,y,msg)=>a.ok(Math.abs(x-y)<1e-6,`${msg}: ${x} vs ${y}`);

test('every stage breakdown adds up to the whole dough, ingredient by ingredient',()=>{
 let checked=0;
 for(const c of cases){
  const r=make(c.style,c.yeast,c.pref,c.blend);
  if(r.protocolIssue||r.enrichment)continue;
  const stages=recipeStages(r,2);
  const label=JSON.stringify(c);
  if(c.pref==='levain'){
   if(!r.sourdough)continue;
   a.deepEqual(stages.map(s=>s.key),['levain','final'],label);
   const final=stages[1].rows,split=levainSplit(r.sourdough.starterGramsMid);
   a.equal(split.flour+split.water,r.sourdough.starterGramsMid);
   const flour=final.filter(x=>x.kind==='flour').reduce((n,x)=>n+x.grams,0)+split.flour;
   const water=final.filter(x=>x.kind==='water').reduce((n,x)=>n+x.grams,0)+split.water;
   near(flour,r.flour,label+' flour');near(water,r.water,label+' water');
   near(final.reduce((n,x)=>n+x.grams,0),r.flour+r.water+r.salt+r.oil+r.sugar,label+' total');
   // The final dough takes each flour of the blend less the starter's flour from the first.
   if(r.flourParts?.length>1)r.flourParts.forEach((part,i)=>near(final.find(x=>x.kind==='flour'&&x.part===i).grams+(i===0?split.flour:0),part.grams,label+' part '+i));
  }else{
   if(!r.preferment)continue;
   a.deepEqual(stages.map(s=>s.key),['preferment','final'],label);
   const [pre,final]=stages.map(s=>s.rows);
   const sum=(rows,kind)=>rows.filter(x=>x.kind===kind).reduce((n,x)=>n+x.grams,0);
   near(sum(pre,'flour')+sum(final,'flour'),r.flour,label+' flour');
   near(sum(pre,'water')+sum(final,'water'),r.water,label+' water');
   near(sum(final,'salt'),r.salt,label+' salt');
   near(sum(pre,'yeast')+sum(final,'yeast'),r.preferment.prefYeastGrams+(r.preferment.finalYeastGrams??0),label+' yeast');
   // All the preferment goes into the final dough.
   near(sum(final,'preferment'),sum(pre,'flour')+sum(pre,'water')+sum(pre,'yeast'),label+' preferment');
   if(r.flourParts?.length>1)r.flourParts.forEach((part,i)=>near(pre.concat(final).filter(x=>x.kind==='flour'&&x.part===i).reduce((n,x)=>n+x.grams,0),part.grams,label+' part '+i));
   // The final dough's rows (with all the preferment) weigh every ingredient of the whole dough.
   near(final.reduce((n,x)=>n+x.grams,0),r.flour+r.water+r.salt+r.oil+r.sugar+r.preferment.prefYeastGrams+(r.preferment.finalYeastGrams??0),label+' total');
  }
  checked++;
 }
 a.ok(checked>=60,`checked ${checked}`);
});

test('a direct dough has no stages: the whole dough only',()=>{
 a.deepEqual(recipeStages(make('neapolitan','instant','none')),[]);
});

test('stage yeast doses add up to the whole dough as shown (0.45 + 0.7 → 1.2)',()=>{
 const d=stageYeastDoses([0.449,0.708],'en');
 a.deepEqual(d.parts,['0.45 g','0.7 g']);a.equal(d.total,'1.2 g');
 a.equal(stageYeastDoses([0.449,0.708],'fr').parts[0],'0,45 g');
 // Already adding up: kitchen-scale figures, nothing more.
 a.deepEqual(stageYeastDoses([0.4,0.7]).parts,['0.4 g','0.7 g']);
 // A single dose is the whole.
 a.deepEqual(stageYeastDoses([0.449,0]).parts,['0.4 g','0 g']);
 // Fresh yeast, three times as much: 1.35 + 2.12 = 3.47 → 3.5.
 const f=stageYeastDoses([1.347,2.124]);a.equal(f.total,'3.5 g');
 const add=(d,dec)=>Math.round(d.shownParts.reduce((n,x)=>n+x,0)*10**dec+1e-9)/10**dec;
 a.equal(add(f,1),f.shownTotal);
 // When no choice of stage figures adds up, the whole dough takes the extra figure too: 0.27 + 3.38 = 3.65 g.
 a.deepEqual(stageYeastDoses([0.269,3.375]).parts.concat(stageYeastDoses([0.269,3.375]).total),["0.27 g","3.38 g","3.65 g"]);
 // Under 0.1 g: one more significant figure where needed.
 const tiny=stageYeastDoses([0.046,0.074]);a.equal(add(tiny,1),tiny.shownTotal,JSON.stringify(tiny));
});

test('stage yeast doses add up for every style, yeast and preferment',()=>{
 let n=0;
 for(const c of cases.filter(c=>c.pref!=='levain'))for(const temp of [16,22,30]){
  const r=make(c.style,c.yeast,c.pref,c.blend,temp);
  if(!r.preferment||r.protocolIssue)continue;
  const d=stageYeastDoses([r.preferment.prefYeastGrams,r.preferment.finalYeastGrams??0],'en');
  // The whole dough's figure has the decimals it is shown with (one more only when no choice of stage figures adds up).
  const dec=(d.total.match(/[.,](\d+)/)?.[1].length)??0;
  a.equal(Math.round(d.shownParts.reduce((s,x)=>s+x,0)*10**dec+1e-9)/10**dec,d.shownTotal,JSON.stringify({c,temp,d}));
  n++;
 }
 a.ok(n>=60,`checked ${n}`);
});

function render(result,pref,mode,locale='en',units='metric',flourBlend){
 return renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(Recipe,{result,numItems:4,itemWeight:260,styleName:'Neapolitan',styleKey:'neapolitan',mixerType:'hand',kitchenTemp:22,fermEquivHours:30,mode,prefermentType:pref,flourBlend,explicitFlour:!!flourBlend,units,feedRatio:2})));
}
const text=html=>html.replace(/<[^>]+>/g,' ').replace(/[  ]/g,' ').replace(/\s+/g,' ');

test('the Recipe shows the whole dough first, then the stages; % only in Custom',()=>{
 for(const locale of ['en','fr'])for(const units of ['metric','imperial'])for(const pref of ['poolish','biga','levain']){
  const blend={flour1:'pizza00',flour2:'manitoba',ratio1:85};
  const r=make('neapolitan',pref==='levain'?'sourdough':'instant',pref,blend);
  for(const mode of ['simple','custom']){
   const html=render(r,pref,mode,locale,units,blend),label=`${locale}/${units}/${pref}/${mode}`;
   a.ok(html.indexOf('data-whole-dough')>-1&&html.indexOf('data-whole-dough')<html.indexOf('data-recipe-stages'),label);
   a.doesNotMatch(html,/Of which|Dont farine|Dont levain|selected blend|mélange choisi|Poolish total|Total poolish|Remaining|restante|all of it/i,label);
   if(mode==='custom'){a.ok((html.match(/data-pct="/g)||[]).length>8,label);a.match(html,/data-pct-header/);}
   else{a.doesNotMatch(html,/data-pct/,label);}
   // Several flours with a preferment: one Flour line, each flour beneath it in weight only.
   a.match(html,/data-flour-parts/,label);
   const stages=text(html.slice(html.indexOf('data-recipe-stages')));
   a.match(stages,pref==='levain'?(locale==='fr'?/Rafraîchi du levain/:/Levain build/):pref==='biga'?/Biga/:/Poolish/,label);
   a.match(stages,locale==='fr'?/Pâte finale/:/Final dough/,label);
  }
 }
});

test('a direct dough keeps the whole dough only',()=>{
 const r=make('neapolitan','instant','none');
 for(const mode of ['simple','custom']){const html=render(r,'none',mode);a.doesNotMatch(html,/data-recipe-stages/);a.equal(/data-pct=/.test(html),mode==='custom');}
});
