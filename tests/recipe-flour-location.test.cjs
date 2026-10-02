const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Recipe=require('../app/components/RecipeOutput.tsx').default;
const {recommendedFlourName,flourShoppingName}=require('../app/lib/flourGuidance.ts');

function render(locale,mode,pref='none',yeast='instant',flourBlend){
 const schedule=utils.buildSchedule(new Date('2026-09-21T08:00Z'),new Date('2026-09-22T18:00Z'),[],24,60,'hand','neapolitan');
 const result=utils.calculateRecipe('neapolitan','home_oven_standard',1,1000,24,'normal',schedule,4,yeast,mode,'hand',undefined,undefined,undefined,flourBlend,pref,null,20);
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(Recipe,{result,numItems:1,itemWeight:1000,styleName:'Neapolitan',styleKey:'neapolitan',mixerType:'hand',kitchenTemp:24,fermEquivHours:30,mode,prefermentType:pref,flourBlend})));
 return {html,result};
}

test('guided flour identity precedes water and stays outside optional explanation in both languages',()=>{
 for(const locale of ['fr','en'])for(const pref of ['none','poolish','biga']){
  const {html}=render(locale,'simple',pref);
  const name=recommendedFlourName('neapolitan',locale);
  const water=require(`../messages/${locale}.json`).recipeOutput.ingredientWater;
  assert.ok(html.indexOf(name)<html.indexOf(`>${water}</div>`),`${locale}/${pref}: flour identity beside first flour ingredient`);
  const detail=html.match(/<details([^>]*)><summary[^>]*>(Bien choisir sa farine|Choosing flour)<\/summary>([\s\S]*?)<\/details>/);
  assert.ok(detail);assert.doesNotMatch(detail[1],/\bopen\b/);
  assert.ok(!detail[3].includes(name),'Buying identity must not be hidden inside explanation');
  assert.equal((html.match(/Bien choisir sa farine|Choosing flour/g)||[]).length,1);
  assert.doesNotMatch(html,/Recommended flour:|Farine conseillée :/);
 }
});

test('guided starter accounting remains visible alongside the flour recommendation',()=>{
 for(const locale of ['fr','en']){
  const {html,result}=render(locale,'simple','levain','sourdough');
  assert.ok(html.includes(recommendedFlourName('neapolitan',locale)));
  const half=Math.round(result.sourdough.starterGramsMid/2);
  assert.ok(html.includes(locale==='fr'?`+ ${half}g via le levain = ${result.flour}g au total`:`+ ${half}g via the starter = ${result.flour}g total`));
 }
});

test('custom products and three-flour blends are not replaced with generic buying guidance',()=>{
 const flourBlend={flour1:'bread',flour2:'rye',flour3:'wholemeal',ratio1:60,ratio2:25,brandProduct:'Selected wheat',customFlour2Name:'Selected rye',customFlour3Name:'Selected wholemeal'};
 for(const locale of ['fr','en'])for(const pref of ['none','poolish']){
  const {html}=render(locale,'custom',pref,'instant',flourBlend);
  for(const name of ['Selected wheat','Selected rye','Selected wholemeal'])assert.ok(html.includes(name));
  assert.ok(!html.includes(recommendedFlourName('neapolitan',locale)));
  assert.doesNotMatch(html,/Bien choisir sa farine|Choosing flour/);
 }
});

test('preferment and starter total flour identities do not misstate final-dough blend ratios',()=>{
 const blend={flour1:'bread',flour2:'rye',flour3:'wholemeal',ratio1:60,ratio2:25,brandProduct:'Selected wheat',customFlour2Name:'Selected rye',customFlour3Name:'Selected wholemeal'};
 for(const locale of ['fr','en'])for(const [pref,yeast] of [['poolish','instant'],['biga','instant'],['levain','sourdough']]){
  const {html,result}=render(locale,'custom',pref,yeast,blend);
  const totalSection=html.match(/<section aria-label="(?:Quantités totales|Total ingredients)">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(totalSection,`${locale}/${pref}: total ingredients are retained`);
  assert.ok(totalSection.includes('Selected wheat + Selected rye + Selected wholemeal'));
  assert.doesNotMatch(totalSection,/(?:60|25|15)\s*%\s*Selected/);
  assert.equal(flourShoppingName('neapolitan',locale,'custom',blend,false),'Selected wheat + Selected rye + Selected wholemeal');
  if(result.preferment){
   const pf=result.preferment;
   const primaryFinal=Math.round(pf.finalFlour*blend.ratio1/100);
   assert.ok(pf.prefFlour+primaryFinal>result.flour*blend.ratio1/100,'Primary-flour preferment makes whole-recipe proportions differ');
   assert.ok(html.includes(locale==='fr'?'Utilisez votre farine principale (Selected wheat)':'Use your primary flour (Selected wheat)'));
   assert.ok(html.includes(locale==='fr'?'Ingrédients par étape':'Ingredients by stage'));
  }
 }
 for(const locale of ['fr','en']){
  assert.equal(flourShoppingName('neapolitan',locale,'custom',blend),'60 % Selected wheat + 25 % Selected rye + 15 % Selected wholemeal');
  assert.equal(flourShoppingName('neapolitan',locale,'custom',{...blend,ratio1:100},false),'Selected wheat');
 }
});
