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
function render(result,pref='none',flourBlend,locale='en'){
 return renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(Recipe,{result,numItems:1,itemWeight:1000,styleName:'Neapolitan',styleKey:'neapolitan',mixerType:'hand',kitchenTemp:24,fermEquivHours:30,mode:'custom',prefermentType:pref,flourBlend,wastePct:1.5}))).replace(/<[^>]+>/g,'');
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
  const breakdown=[...text.matchAll(/\(([\d,]+)g\)/g)].map(m=>Number(m[1].replaceAll(',','')));
  a.equal(breakdown.length,blend.flour3?3:2);
  a.equal(breakdown.reduce((s,n)=>s+n,0),r.flour-Math.round(r.sourdough.starterGramsMid/2));
 }
});
test('preferment baker percentages describe the selected seed yeast actually weighed',()=>{
 for(const pref of ['poolish','biga']){
  const r=make('fresh',pref);
  // Distinct doses make an accidental reference to unused final-dough yeast observable.
  r.preferment.prefYeastGrams=r.flour*.0025;r.yeast.convertedPct=1.2;
  const section=render(r,pref).split('Baker’s percentages')[1];
  a.ok(section);a.match(section,/Fresh yeast : 0\.25%/i);a.doesNotMatch(section,/Fresh yeast : 1\.2%/i);
 }
});
