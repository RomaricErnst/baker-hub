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
  assert.ok(done.includes(isFr?'Enregistrer':'Save'),recipe.id+' save');
  assert.ok(done.includes(isFr?'Partager':'Share'),recipe.id+' share');
  assert.ok(done.includes(isFr?'Tout est prêt. Bon appétit !':'Everything is ready. Enjoy!'),recipe.id+' finish');
  snapshot.completed={};
  assert.ok(!render().includes(`aria-label="${label}"`),recipe.id+' undo');
  snapshot.qtys={};
  assert.ok(!render().includes(`aria-label="${label}"`),recipe.id+' empty');
 }
});

const Completion=require('../app/components/JourneyCompletion.tsx').default;
test('completion distinguishes account save from export and repeat is available only after completion',()=>{
 for(const isFr of [true,false]){
  const render=props=>renderToStaticMarkup(React.createElement(Completion,{isFr,onSave(){},onRepeat(){},...props}));
  assert.ok(render({}).includes(isFr?'Enregistrer':'Save'));
  assert.ok(render({saveKind:'download'}).includes(isFr?'Télécharger la recette':'Download recipe'));
  assert.ok(render({saveKind:'download',sessionSaved:true}).includes(isFr?'Téléchargée':'Downloaded'));
  assert.ok(render({}).includes(isFr?'Refaire cette recette':'Make this again'));
  assert.ok(!render({complete:false}).includes(isFr?'Refaire cette recette':'Make this again'));
 }
});
test('existing-base repeat preserves recipes and edits but clears preparation, shopping and service',()=>{
 const vm=require('node:vm');
 const source=ts.createSourceFile('ExistingBaseJourney.tsx',fs.readFileSync('app/components/ExistingBaseJourney.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let declaration;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='repeatRecipe')declaration=node.getText(source);ts.forEachChild(node,visit);}
 visit(source);assert.ok(declaration);
 const recipe=SANDWICH_RECIPES[0];
 const snapshot={...createSandwichSnapshot(recipe.familyId),qtys:{[recipe.id]:2},completed:{[recipe.id]:2},shopTicks:{old:true},prepTicks:{old:true},ingredientOverrides:{[recipe.id]:{[recipe.ingredients[0].ingredientId]:25}}};
 const draft={base:recipe.familyId,portions:2,pizza:{margherita:2},done:{margherita:2},section:'service',selectionReturn:'service',sandwiches:{[recipe.familyId]:snapshot},details:{[recipe.familyId]:{kind:'baked',origin:'purchased',stage:'ready',notes:'Keep this',baked:true,served:true}},resultNotes:'Less salt next time'};
 let next;const removed=[];
 const context=vm.createContext({draft,normalizeSandwichSnapshot:require('../app/lib/sandwich.ts').normalizeSandwichSnapshot,localStorage:{removeItem:key=>removed.push(key)},setExported(){},setSharedText(){},activate:value=>{next=value;}});
 vm.runInContext(ts.transpileModule(`const ${declaration}; repeatRecipe();`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 assert.equal(next.section,'shopping');assert.equal(next.selectionReturn,null);
 assert.equal(Object.keys(next.done).length,0);
 assert.deepEqual(next.pizza,draft.pizza);
 assert.deepEqual(next.sandwiches[recipe.familyId].qtys,snapshot.qtys);
 assert.deepEqual(next.sandwiches[recipe.familyId].ingredientOverrides,snapshot.ingredientOverrides);
 for(const key of ['completed','shopTicks','prepTicks'])assert.equal(Object.keys(next.sandwiches[recipe.familyId][key]).length,0,key);
 assert.equal(next.details[recipe.familyId].baked,false);assert.equal(next.details[recipe.familyId].served,false);
 assert.equal(next.resultNotes,draft.resultNotes);
 assert.deepEqual(removed,['bh_existing_base_shop_ticks_v1','bh_existing_base_prep_ticks_v1']);
});
