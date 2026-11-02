const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Recipe=require('../app/components/RecipeOutput.tsx').default;
function make(yeast='instant',pref='none',blend){
 const schedule=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-22T18:00Z'),[],24,60,'hand','neapolitan');
 return utils.calculateRecipe('neapolitan','home_oven_standard',1,1000,24,'normal',schedule,4,yeast,'custom','hand',undefined,undefined,undefined,blend,pref,null,20,undefined,undefined,false,1.5,false,undefined,12);
}
function render(result,pref='none',flourBlend,locale='en',raw=false,extra={}){
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(Recipe,{result,numItems:1,itemWeight:1000,styleName:'Neapolitan',styleKey:'neapolitan',mixerType:'hand',kitchenTemp:24,fermEquivHours:30,mode:'custom',prefermentType:pref,flourBlend,wastePct:1.5,...extra})));
 return raw?html:html.replace(/<[^>]+>/g,'').replace(/[\u00a0\u202f]/g,' ');
}
test('direct, starter and preferment total rows include the mixing allowance',()=>{
 for(const [yeast,pref] of [['instant','none'],['sourdough','levain'],['instant','poolish'],['instant','biga']]){
  const r=make(yeast,pref);a.equal(r.totalDough,1015);
  const text=render(r,pref);a.match(text,/Total dough1,015 g/i);a.doesNotMatch(text,/Total dough1,000 g/i);
 }
});
test('starter flour blend breakdown sums to flour added after starter subtraction',()=>{
 for(const blend of [{flour1:'bread',flour2:'rye',ratio1:60},{flour1:'bread',flour2:'rye',flour3:'wholemeal',ratio1:60,ratio2:25}]){
  const r=make('sourdough','levain',blend),text=render(r,'levain',blend);
  const added=r.flourParts.map((part,i)=>part.grams-(i===0?Math.round(r.sourdough.starterGramsMid/2):0));
  a.equal(added.length,blend.flour3?3:2);
  a.equal(added.reduce((sum,n)=>sum+n,0),r.flour-Math.round(r.sourdough.starterGramsMid/2));
  for(const grams of added)a.ok(text.includes(grams+' g'));

 }
});
test('preferment baker percentages describe the selected seed yeast actually weighed',()=>{
 for(const pref of ['poolish','biga']){
  const r=make('fresh',pref);
  // Distinct doses make an accidental reference to unused final-dough yeast observable.
  r.preferment.prefYeastGrams=r.flour*.0025;r.yeast.convertedPct=1.2;
  const section=render(r,pref,undefined,'en',true).match(/<section aria-label="Total ingredients">([\s\S]*?)<\/section>/)?.[1].replace(/<[^>]+>/g,'');
  a.ok(section);a.match(section,/Fresh yeast0\.25%[\d. ]+g/i);a.doesNotMatch(section,/Fresh yeast1\.2%[\d. ]+g/i);
 }
});

test('small yeast precision and dilution instructions stay in one initially closed disclosure',()=>{
 for(const locale of ['en','fr'])for(const pref of ['none','poolish','biga']){
  const r=make('instant',pref);
  if(r.preferment)r.preferment.prefYeastGrams=.04;
  else {r.yeast.convertedGrams=.04;r.yeast.hitMinFloor=true;r.yeast.dilutionTip=utils.commercialDilution(.04,r.water);}
  const html=render(r,pref,undefined,locale,true);
  const label=locale==='fr'?'Petite dose de levure':'Small yeast dose';
  const match=html.match(new RegExp('<details([^>]*)><summary[^>]*>'+label+'</summary>([\\s\\S]*?)</details>'));
  a.ok(match,`${locale}/${pref}`);a.doesNotMatch(match[1],/\bopen\b/);
  const messages=require(`../messages/${locale}.json`);
  a.ok(match[2].includes(messages.recipeOutput.precisionScaleTitle));
  a.ok(match[2].includes(pref==='none'?messages.recipeOutput.dilutionTitle:locale==='fr'?'Jetez le reste':'Discard the leftover'));
  a.doesNotMatch(match[2],/<details/);
  const outside=html.replace(match[0],'');a.ok(!outside.includes(messages.recipeOutput.precisionScaleTitle));
 }
});

test('total formula percentages accompany total weights, never remaining stage water',()=>{
 for(const pref of ['biga','poolish']){
  const r=make('instant',pref),html=render(r,pref,undefined,'en',true);
  const totals=html.match(/<section aria-label="Total ingredients">([\s\S]*?)<\/section>/)[1].replace(/<[^>]+>/g,'');
  a.match(totals,new RegExp('Flour100%'+Math.round(r.flour)+' g'));
  a.match(totals,new RegExp('Water[0-9.]+%'+Math.round(r.water)+' g'));
  a.match(totals,/Of which prefermented flour[\s\S]*20%/);
  a.doesNotMatch(html,/Baker’s percentages/);
 }
});

test('custom percentage basis and liquid starter assumption are explicit at ingredients',()=>{
 for(const locale of ['fr','en']){
  const text=render(make('sourdough','levain'),'levain',undefined,locale);
  a.ok(text.includes(locale==='fr'?'% de farine':'% of flour'));
  a.ok(text.includes(locale==='fr'?'Levain liquide · 100 % d’hydratation':'Liquid starter · 100% hydration'));
 }
});

test('blend recipe totals show separate named flour weights and conserve stage allocation',()=>{
 const blend={flour1:'bread',flour2:'rye',flour3:'wholemeal',ratio1:60,ratio2:25,brandProduct:'Wheat bag',customFlour2Name:'Rye bag',customFlour3Name:'Wholemeal bag'};
 for(const pref of ['none','poolish','biga'])for(const locale of ['en','fr']){
  const r=make('instant',pref,blend),html=render(r,pref,blend,locale,true);
  a.equal(r.flourParts.reduce((sum,p)=>sum+p.grams,0),r.flour);
  const content=(pref==='none'?html:html.match(/<section aria-label="(?:Total ingredients|Quantités totales)">([\s\S]*?)<\/section>/)[1]).replace(/<[^>]+>/g,'').replace(/[\u00a0\u202f]/g,' ');
  for(const part of r.flourParts){a.ok(content.includes(part.name));a.ok(content.includes(part.grams+' g'));}
  if(r.preferment)a.equal(r.flourParts[0].grams,Math.round(r.preferment.finalFlour*.6)+r.preferment.prefFlour);
 }
});


test('recipe shows only the recipe (timing lives in Preparation) with the selected salt percentage and weighed yeast',()=>{
 for(const locale of ['en','fr']){
  const result=make();result.saltPct=2.8;result.salt=Math.round(result.flour*.028);result.yeast.convertedGrams=.54;
  const html=render(result,'none',undefined,locale,true);
  const text=html.replace(/<[^>]+>/g,'').replace(/[\u00a0\u202f]/g,' ');
  a.doesNotMatch(text,locale==='fr'?/Ajuster les horaires|Cuire /:/Adjust timing|· Bake /);
  a.match(text,locale==='fr'?/Sel2,8 %/:/Salt2.8%/);
  a.ok(text.includes(locale==='fr'?'0,54 g':'0.54 g'));
 }
});

test('yeast rows offer a practical measure when a spoon would miss the dose',()=>{
 for(const locale of ['en','fr'])for(const pref of ['none','poolish'])for(const dose of [.227,.54,.8]){
  const r=make('instant',pref);
  if(r.preferment)r.preferment.prefYeastGrams=dose;
  else {r.yeast.convertedGrams=dose;r.yeast.grams=dose;r.yeast.dilutionTip=null;}
  const html=render(r,pref,undefined,locale,false,{mode:'simple'});
  if(dose===.8)a.match(html,locale==='fr'?/¼ c. à café/:/¼ tsp/);
  else {
   a.match(html,locale==='fr'?/méthode de dilution ci-dessous/:/dilution method below/);
   a.match(html,locale==='fr'?/Petite dose de levure/:/Small yeast dose/);
  }
 }
});

test('poolish stage names the same chill time as the generated thermal schedule',()=>{
 const r=make('instant','poolish');
 const mixingTime=new Date(2026,10,3,17,15);
 for(const locale of ['en','fr']){
  r.thermal.prefermentCooldownHours=1.25;
  const text=render(r,'poolish',undefined,locale,false,{mixingTime});
  a.match(text,locale==='fr'?/Placez la poolish au réfrigérateur.*16\s*h\s*00/:/Refrigerate the poolish.*4:00pm/i);
  r.thermal.prefermentCooldownHours=0;
  a.doesNotMatch(render(r,'poolish',undefined,locale,false,{mixingTime}),/Placez la poolish au réfrigérateur|Refrigerate the poolish/i);
 }
});

test('Simple recipe omits the fermentation container; Custom keeps it',()=>{
 for(const locale of ['en','fr']){
  const label=locale==='fr'?'Récipient de fermentation':'Fermentation container';
  const simple=render(make(),'none',undefined,locale,false,{mode:'simple',onContainerCapacityChange(){}});
  const custom=render(make(),'none',undefined,locale,false,{mode:'custom',onContainerCapacityChange(){}});
  a.ok(!simple.includes(label),`${locale} simple`);
  a.ok(custom.includes(label),`${locale} custom`);
 }
});
