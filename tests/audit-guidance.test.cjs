const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {recommendedFlourName,flourShoppingName}=require('../app/lib/flourGuidance.ts');
const Coverage=require('../app/components/pizzaParty/SelectionCoverage.tsx').default;

test('guided purchases identify usable flour while custom blends retain selected products',()=>{
 assert.match(recommendedFlourName('greek_pita','en'),/bread flour/i);
 assert.match(recommendedFlourName('neapolitan','fr'),/pizza 00/i);
 assert.match(recommendedFlourName('roman','en'),/W300/);
 assert.match(recommendedFlourName('pizza_romana','en'),/W250–280/);
 assert.match(recommendedFlourName('pain_complet','fr'),/complète/);
 assert.match(recommendedFlourName('pain_seigle','en'),/rye/i);
 const blend={flour1:'bread',flour2:'rye',ratio1:70,flour3:'wholemeal',ratio2:20,brandProduct:'My wheat',customFlour2Name:'My rye',customFlour3Name:'My wholemeal'};
 assert.equal(flourShoppingName('pain_levain','fr','custom',blend),'70 % My wheat + 20 % My rye + 10 % My wholemeal');
 assert.equal(flourShoppingName('greek_pita','en','simple',blend),recommendedFlourName('greek_pita','en'));
});

test('selection scope is explicit even before a pizza is baked, without declaring the full batch finished',()=>{
 for(const locale of ['fr','en'])for(const selected of [0,1,2,24,25]){
  const html=renderToStaticMarkup(React.createElement(Coverage,{locale,selected,planned:24}));
  assert.ok(html.includes(`${selected} / 24`));
  if(selected<24){assert.ok(html.includes(String(24-selected)));assert.match(html,locale==='fr'?/garnitures séparément/:/toppings separately/);}
  if(selected>24)assert.match(html,locale==='fr'?/dépasse/:/exceeds/);
  assert.doesNotMatch(html,/Tout est prêt|Everything is ready|Service terminé/);
 }
});
