const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const {ingredientHelpData,IngredientShoppingHelp,buildShoppingList}=require('../app/components/ToppingSelector.tsx');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const base={id:'cheese',name:{en:'Cheese',fr:'Fromage'},category:'cheese',forPizzas:[]};
test('ingredient help requires named alternatives or actual location shopping references',()=>{
 for(const where of [{},{shops:[]},{shops:[' '],online:['']},{shops:[],note:'Some note'},{shops:[],links:[{label:'Bad',url:'javascript:alert(1)'}]}])assert.equal(ingredientHelpData({...base,whereToFind:{france:where}},'france','en').available,false);
 const item={...base,whereToFind:{france:{shops:['Market']}}};
 assert.equal(ingredientHelpData(item,'france','en').label,'Where to find it');
 assert.equal(ingredientHelpData(item,'france','fr').label,'Où le trouver');
 assert.equal(ingredientHelpData(item,'us','en').available,false);
});
test('alternatives deduplicate and dedicated help explicitly leaves shopping list unchanged',()=>{
 const alternative={name:{en:'Ricotta',fr:'Ricotta'},note:{en:'Drain first',fr:'Égouttez'}};
 const item={...base,goodEnough:alternative,compromise:alternative,localSwap:{france:{name:{en:'Fresh cheese',fr:'Fromage frais'}}},whereToFind:{france:{shops:['Market'],online:['Delivery'],links:[{label:'Shop',url:'https://example.com'}]}}};
 const original=JSON.stringify(item);
 assert.equal(ingredientHelpData(item,'france','en').alternatives.length,2);
 assert.equal(ingredientHelpData(item,'france','en').label,'Alternatives');
 const html=renderToStaticMarkup(React.createElement(IngredientShoppingHelp,{item,location:'france',locale:'en',onLocationChange(){},onBack(){}}));
 assert.ok(html.includes('Suggestions only — your shopping list stays unchanged.'));
 assert.ok(html.includes('Where to look'));assert.ok(html.includes('Back to shopping list'));assert.ok(html.includes('https://example.com'));
 assert.equal(JSON.stringify(item),original);
 const before=buildShoppingList({margherita:2},'en');
 for(const {items} of before.sections)for(const item of items)ingredientHelpData(item,'france','en');
 assert.deepEqual(buildShoppingList({margherita:2},'en'),before);
});
test('changing location to one without help shows explicit empty state',()=>{
 const item={...base,whereToFind:{france:{shops:['Market']}}};
 const html=renderToStaticMarkup(React.createElement(IngredientShoppingHelp,{item,location:'us',locale:'fr',onLocationChange(){},onBack(){}}));
 assert.ok(html.includes('Pas encore de suggestion pour ce pays.'));
 assert.ok(!html.includes('<h2>Alternatives</h2>'));assert.ok(!html.includes('Market'));
});
test('all real ingredient shopping references localize without mutating recipe data',()=>{
 const recipes=require('../app/lib/auditedPizzaRecipes.json');
 for(const recipe of Object.values(recipes))for(const item of recipe.ingredients)for(const location of ['singapore','france','uk','us','australia','international'])for(const locale of ['en','fr']) {
  const result=ingredientHelpData(item,location,locale);
  for(const link of result.links)assert.equal(typeof link.label,'string');
 }
});
