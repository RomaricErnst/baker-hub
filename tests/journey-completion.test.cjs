const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.css']=module=>{module.exports={};};
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const Party=require('../app/components/SandwichParty.tsx').default;
const {SANDWICH_RECIPES}=require('../app/lib/sandwichCatalog.ts');
const {createSandwichSnapshot}=require('../app/lib/sandwich.ts');

test('every sandwich and toast recipe offers save/share after service, never for an empty or unserved selection',()=>{
 for(const isFr of [true,false])for(const recipe of SANDWICH_RECIPES){
  const snapshot={...createSandwichSnapshot(recipe.familyId),qtys:{[recipe.id]:1},tab:'serve'};
  const props={isFr,styleKey:recipe.familyId==='tartine'?'pain_campagne':recipe.familyId,snapshot,onChange(){},onSave(){},onShare(){},hideNavigation:true};
  const render=()=>renderToStaticMarkup(React.createElement(Party,props));
  const label=isFr?'Fin de la fournée':'Finish your bake';
  assert.ok(!render().includes(`aria-label="${label}"`),recipe.id+' unserved');
  snapshot.completed={[recipe.id]:1};
  const done=render();
  assert.ok(done.includes(`aria-label="${label}"`),recipe.id+' completed');
  assert.ok(done.includes(isFr?'Sauvegarder':'Save'),recipe.id+' save');
  assert.ok(done.includes(isFr?'Partager':'Share'),recipe.id+' share');
  assert.ok(done.includes(isFr?'Tout est prêt. Bon appétit !':'Everything is ready. Enjoy!'),recipe.id+' finish');
  snapshot.completed={};
  assert.ok(!render().includes(`aria-label="${label}"`),recipe.id+' undo');
  snapshot.qtys={};
  assert.ok(!render().includes(`aria-label="${label}"`),recipe.id+' empty');
 }
});
