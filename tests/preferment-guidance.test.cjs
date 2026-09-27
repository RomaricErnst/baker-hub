const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {NextIntlClientProvider}=require('next-intl');
const Picker=require('../app/components/PrefermentPicker.tsx').default;
// Evidence: https://www.kingarthurbaking.com/pro/reference/preferment
// 10/20/30 are app trial points, not a source-validated universal optimum.
test('both preferments give actionable bilingual trial proportions without old hydration or cold tags',()=>{
 for(const locale of ['en','fr'])for(const selected of ['poolish','biga']){
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(Picker,{selected,onSelect:()=>{},onFlourPctChange:()=>{},totalFlourGrams:1000,yeastType:'instant'})));
  for(const n of ['10','20','30'])assert.match(html,new RegExp(n+' ?%'));
  assert.ok(html.includes(locale==='fr'?'commencez ici':'start here'));
  assert.ok(html.includes(locale==='fr'?'plus n’est pas forcément mieux':'more is not always better'));
  assert.doesNotMatch(html,/45 ?%|coldFerment|Fermentation froide/);
  assert.doesNotMatch(html,/\b\d+ g\b|estimation|\(estimate\)/);
  if(selected==='biga')assert.ok(html.includes(locale==='fr'?'incorporation homogène':'incorporate it evenly'));
 }
});
