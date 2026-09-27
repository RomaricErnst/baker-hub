const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('app/components/pizzaParty/BakeTab.tsx','utf8');
const ast=ts.createSourceFile('BakeTab.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=[];function visit(n){if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['totalDone','extraDone','allSelectedDone'].includes(d.name.getText(ast))))declarations.push(n.getText(ast));ts.forEachChild(n,visit);}visit(ast);
function count(selected,doneCounts){const context={selectedEntries:Object.entries(selected).map(([id,qty])=>({pizza:{id},qty})),doneCounts};vm.runInNewContext(ts.transpileModule(declarations.join('\n')+'\nglobalThis.result={totalDone,extraDone,allSelectedDone}',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);return JSON.parse(JSON.stringify(context.result));}
test('extra pizzas cannot complete a different unbaked recipe',()=>{a.deepEqual(count({margherita:2,marinara:2},{margherita:4}),{totalDone:2,extraDone:2,allSelectedDone:false});});
test('removed selections do not inflate progress; each selected recipe must finish',()=>{a.deepEqual(count({margherita:2,marinara:2},{margherita:3,marinara:2,removed:8}),{totalDone:4,extraDone:1,allSelectedDone:true});a.equal(count({}, {removed:8}).allSelectedDone,false);a.equal(count({margherita:2},{margherita:1}).allSelectedDone,false);});

test('actual pizza service exposes repeat and result notes only after all selected recipes finish',()=>{
 const Module=require('node:module'),path=require('node:path'),resolve=Module._resolveFilename;
 Module._resolveFilename=function(request,...args){let name=request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request;if(name.endsWith('/auditedPizzaRecipes'))name+='.ts';return resolve.call(this,name,...args)};
 require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
 require.extensions['.ts']=require.extensions['.tsx'];
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
 const BakeTab=require('../app/components/pizzaParty/BakeTab.tsx').default;
 const [one,two]=require('../app/lib/toppingDatabase.ts').PIZZAS;
 try {for(const locale of ['fr','en']){
  const render=done=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(BakeTab,{selectedPizzas:{[one.id]:2,[two.id]:2},initialDoneCounts:done,locale,onSave(){},onRepeat(){},resultNotes:'Less salt',onResultNotesChange(){},saveKind:'download'})));
  const partial=render({[one.id]:4});a.ok(!partial.includes(locale==='fr'?'Refaire cette recette':'Make this again'));a.ok(!partial.includes('<textarea'));a.match(partial,/2 \/ 4/);
  const complete=render({[one.id]:4,[two.id]:2});a.ok(complete.includes(locale==='fr'?'Refaire cette recette':'Make this again'));a.ok(complete.includes('Less salt'));a.ok(complete.includes(locale==='fr'?'Télécharger la recette':'Download recipe'));
 }}finally{Module._resolveFilename=resolve;}
});
