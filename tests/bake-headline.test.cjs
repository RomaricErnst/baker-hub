const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const {bakeHeadline,recipeSummaryLine}=require('../app/utils/bakeHeadline.ts');
const bake=new Date(2026,10,22,19,0);
const nb=s=>s.replace(/[  ]/g,' ');

// Round 7 (owner, option A): My bake in the "Your bake" sheet is one headline line.
test('the headline says what and when, in bread words for bread',()=>{
 a.equal(bakeHeadline('pizza','neapolitan',4,bake,'en'),'4 Neapolitan pizzas · Sun 22 Nov, 7:00pm');
 a.equal(nb(bakeHeadline('pizza','neapolitan',4,bake,'fr')),'4 pizzas napolitaines · dim. 22 nov. à 19h00');
 a.equal(bakeHeadline('pizza','newyork',1,bake,'en'),'1 New York pizza · Sun 22 Nov, 7:00pm');
 a.equal(bakeHeadline('bread','baguette',3,bake,'en'),'3 baguettes · Sun 22 Nov, 7:00pm');
 a.equal(bakeHeadline('bread','pain_campagne',1,bake,'en'),'1 pain de campagne · Sun 22 Nov, 7:00pm');
 a.equal(nb(bakeHeadline('bread','pain_complet',2,bake,'fr')),'2 pains complets · dim. 22 nov. à 19h00');
});
test('before a bake time is set, the what alone',()=>{
 a.equal(bakeHeadline('pizza','neapolitan',4,null,'en'),'4 Neapolitan pizzas');
 a.equal(bakeHeadline('bread','brioche',1,undefined,'fr'),'1 brioche');
});
test('the Recipe summary line is led by the day',()=>{
 a.equal(recipeSummaryLine('pizza','neapolitan',4,bake,'en','260 g'),'Sun 22 Nov · 7:00pm · 4 × 260 g Neapolitan');
 a.equal(nb(recipeSummaryLine('pizza','neapolitan',4,bake,'fr','260 g')),'dim. 22 nov. · 19h00 · 4 pizzas napolitaines de 260 g');
 a.equal(recipeSummaryLine('bread','baguette',2,bake,'en'),'Sun 22 Nov · 7:00pm · 2 baguettes');
});
test('the Your bake sheet shows the headline and names the Recipe’s wait by what is missing',()=>{
 const src=fs.readFileSync(require.resolve('../app/components/BakeNavigator.tsx'),'utf8');
 a.match(src,/data-journey-headline/);
 a.match(src,/bakeTimeSet\?\(fr\?'Prête quand vous créez votre recette':'Ready when you create your recipe'\)/);
 const page=fs.readFileSync(require.resolve('../app/[locale]/page.tsx'),'utf8');
 a.match(page,/bakeTimeSet=\{!!eatTime\}/);
});
