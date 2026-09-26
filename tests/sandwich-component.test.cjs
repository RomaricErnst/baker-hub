const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
require.extensions['.css']=(module)=>{module.exports=new Proxy({},{get:(_target,key)=>key==='__esModule'?false:String(key)});};
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {default:SandwichParty}=require('../app/components/SandwichParty.tsx');
const {SANDWICH_FAMILIES,SANDWICH_RECIPES}=require('../app/lib/sandwichCatalog.ts');
const {createSandwichSnapshot}=require('../app/lib/sandwich.ts');
const render=(snapshot,props={})=>renderToStaticMarkup(React.createElement(SandwichParty,{isFr:false,styleKey:'baguette',snapshot,onChange(){},...props}));
test('sandwich browsing stays in the selected family and unsupported bread is explicit',()=>{
 for(const family of SANDWICH_FAMILIES){
   const html=render(createSandwichSnapshot(family.id),{styleKey:family.id==='tartine'?'pain_campagne':family.id});
   const own=SANDWICH_RECIPES.find(r=>r.familyId===family.id);
   assert.ok(own);assert.ok(html.includes(own.name.en.replace(/&/g,'&amp;').replace(/'/g,'&#x27;')));
   const buttons=(html.match(/Recipe and fillings/g)||[]).length;
   assert.equal(buttons,SANDWICH_RECIPES.filter(r=>r.familyId===family.id).length);
 }
 const html=render(createSandwichSnapshot(),{styleKey:'fougasse'});
 assert.doesNotMatch(html,/Which bread will you fill/);assert.doesNotMatch(html,/Recipe and fillings/);
});
test('controlled sandwich state supplies shopping, cooking and reversible service counters in both languages',()=>{
 const recipe=SANDWICH_RECIPES.find(r=>r.familyId==='baguette');
 const state={...createSandwichSnapshot('baguette'),qtys:{[recipe.id]:3},completed:{[recipe.id]:1}};
 for(const isFr of [false,true]){
   const shop=render({...state,tab:'shop'},{isFr,breadIngredients:[{id:'flour',name:'Test flour',grams:500}],availableDoughWeight:850,numItems:2});
   assert.match(shop,/Test flour/);assert.match(shop,/500 g/);assert.match(shop,/850 g/);
   assert.ok(shop.includes(isFr?'Garnitures regroupées':'Combined fillings'));
   const prep=render({...state,tab:'prep'},{isFr});
   assert.ok(prep.includes(isFr?'Préparez les garnitures':'Prepare the fillings'));
   assert.match(prep,/type="checkbox"/);
   const serve=render({...state,tab:'serve'},{isFr});
   assert.match(serve,/1\/3/);
   assert.ok(serve.includes(isFr?'Un sandwich prêt':'One sandwich ready'));
   assert.ok(serve.includes(isFr?'Annuler le dernier':'Undo last'));
 }
});
test('empty shopping never invents bread or filling purchases',()=>{
 const html=render({...createSandwichSnapshot('baguette'),tab:'shop'});
 assert.match(html,/>Shopping<\/h2>/);
 assert.doesNotMatch(html,/Combined fillings|type="checkbox"/);
});
test('plain bread shopping exposes real dough purchases without a sandwich selection',()=>{
 const html=render({...createSandwichSnapshot('baguette'),tab:'shop'},{breadIngredients:[{id:'flour',name:'Actual bread flour',grams:520}]});
 assert.match(html,/<details open="">/);
 assert.match(html,/Actual bread flour/);assert.match(html,/520 g/);
 assert.equal((html.match(/type="checkbox"/g)||[]).length,1);
 assert.doesNotMatch(html,/Combined fillings|Choose your sandwiches and quantities/);
});

test('cards state baked bread portions and warn only on a definite bread shortfall',()=>{
 const recipe=SANDWICH_RECIPES.find(r=>r.familyId==='baguette');
 const snapshot={...createSandwichSnapshot('baguette'),qtys:{[recipe.id]:3}};
 const tooSmall=render(snapshot,{availableDoughWeight:recipe.breadGrams*2,numItems:1,onAdjustBread(){}});
 assert.match(tooSmall,new RegExp(`${recipe.breadGrams} g baked bread \\+ fillings`));
 assert.match(tooSmall,/You will need more bread/);
 assert.match(tooSmall,/Adjust my bread batch/);
 const notProvablyShort=render(snapshot,{availableDoughWeight:recipe.breadGrams*4});
 assert.doesNotMatch(notProvablyShort,/You will need more bread|Enough bread|will make/);
 const unknown=render(snapshot);
 assert.doesNotMatch(unknown,/You will need more bread/);
 const french=render(snapshot,{isFr:true,availableDoughWeight:1,onAdjustBread(){}});
 assert.match(french,/Prévoyez davantage de pain/);assert.match(french,/Ajuster ma fournée/);
});

test('each recipe card loads its own catalogue image with localized alt and stable aspect dimensions',()=>{
 for(const isFr of [false,true]) for(const family of SANDWICH_FAMILIES){
  const html=render(createSandwichSnapshot(family.id),{styleKey:family.id==='tartine'?'pain_campagne':family.id,isFr});
  const recipes=SANDWICH_RECIPES.filter(r=>r.familyId===family.id);
  for(const recipe of recipes){
   const escapedName=recipe.name[isFr?'fr':'en'].replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
   assert.ok(html.includes(`src="${recipe.image}" alt="${escapedName}" width="640" height="480" loading="lazy" decoding="async"`),recipe.id);
  }
 }
});


test('all filling recipes have distinct dish-image paths rather than shared bread photographs',()=>{
 assert.equal(new Set(SANDWICH_RECIPES.map(recipe=>recipe.image)).size,SANDWICH_RECIPES.length);
 for(const recipe of SANDWICH_RECIPES) assert.equal(recipe.image,`/images/approved/sandwich/${recipe.id}.webp`);
 const recipe=SANDWICH_RECIPES.find(recipe=>recipe.id==='tartine-avocat-oeuf');
 const html=render(createSandwichSnapshot('tartine'),{styleKey:'pain_seigle',isFr:true});
 assert.ok(html.includes('src="/images/approved/bread/seigle-rustic.webp" alt="Pain de seigle"'));
 assert.ok(html.includes(`src="${recipe.image}" alt="Avocat, œuf poché et feta"`));
});
