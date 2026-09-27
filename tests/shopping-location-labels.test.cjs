const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const {IngredientShoppingHelp}=require('../app/components/ToppingSelector.tsx');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
test('shopping location options localize labels while retaining saved country identifiers',()=>{
 const item={id:'tomato',name:{en:'Tomato',fr:'Tomate'},category:'veg',forPizzas:[]};
 for(const [locale,labels] of [['en',['Singapore','France','UK','US','Australia','International']],['fr',['Singapour','France','Royaume-Uni','États-Unis','Australie','International']]]) {
  const html=renderToStaticMarkup(React.createElement(IngredientShoppingHelp,{item,location:'uk',locale,onLocationChange(){},onBack(){}}));
  const options=[...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)];
  assert.deepEqual(options.map(option=>option[1]),['singapore','france','uk','us','australia','international']);
  assert.deepEqual(options.map(option=>option[2]),labels);
  assert.match(html,/<option value="uk" selected=""/);
 }
});
