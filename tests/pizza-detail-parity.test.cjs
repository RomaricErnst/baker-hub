const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {PizzaIngredientDetails}=require('../app/components/ToppingSelector.tsx');
test('pizza detail gives one-pizza quantities and style-specific before/after instructions',()=>{
 const pizza={ingredients:[{id:'sauce',name:{en:'Sauce',fr:'Sauce'},bakeOrder:'before',bakeOrderByStyle:{pan:'after'},qtyPerPizza:{amount:40,unit:'g'},qtyMultiplierByStyle:{pan:1.5},prepNote:{en:'Base instruction',fr:'Instruction de base'},prepNoteByStyle:{pan:{en:'Add sauce stripes',fr:'Ajoutez des bandes de sauce'}}},{id:'cheese',name:{en:'Cheese',fr:'Fromage'},bakeOrder:'before',qtyPerPizza:{amount:100,unit:'g'}}]};
 for(const locale of ['en','fr']){
  const html=renderToStaticMarkup(React.createElement(PizzaIngredientDetails,{pizza,locale,styleKey:'pan'}));
  assert.ok(html.indexOf(locale==='fr'?'Fromage':'Cheese')<html.indexOf('Sauce'));
  assert.match(html,/60 g/);assert.match(html,/100 g/);
  assert.ok(html.includes(locale==='fr'?'Ajoutez des bandes de sauce':'Add sauce stripes'));
  assert.doesNotMatch(html,/Base instruction|Instruction de base|Alternatives/);
 }
});
test('preferment range retains exact one-point adjustment',()=>{
 const source=fs.readFileSync('app/components/PrefermentPicker.tsx','utf8');
 assert.match(source,/<input type="range"[^>]*min=\{10\} max=\{60\} step=\{1\}/);
});
