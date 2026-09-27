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

test('chicken shopping distinguishes estimated raw purchase from cooked recipe weight in both languages',()=>{
 const recipe=SANDWICH_RECIPES.find(r=>r.id==='laffa-shawarma-poulet');
 const snapshot={...createSandwichSnapshot('laffa'),qtys:{[recipe.id]:2},tab:'shop'};
 for(const isFr of [false,true]) {
   const html=render(snapshot,{styleKey:'laffa',isFr});
   assert.match(html,/≈ 330 g/); // 240 g cooked / 0.73, rounded up for shopping.
   assert.ok(html.includes(isFr?'240 g cuits':'240 g cooked'));
   assert.ok(html.includes(isFr?'Le rendement varie':'Yield varies'));
   assert.ok(html.includes(isFr?'déjà cuits':'already cooked'));
 }
 const raw=SANDWICH_RECIPES.find(r=>r.id==='pita-poulet-cru-citron');
 const html=render({...createSandwichSnapshot('pita'),qtys:{[raw.id]:2},tab:'shop'},{styleKey:'pita'});
 assert.match(html,/200 g/);
 assert.doesNotMatch(html,/Estimated purchase|Yield varies/);
});

test('preparation has no redundant count and family-specific portions survive service',()=>{
 for(const [family,label] of [['laffa','One wrap ready'],['pita','One pita ready'],['piadina','One piadina ready'],['bagel','One bagel ready']]) {
   const recipe=SANDWICH_RECIPES.find(r=>r.familyId===family);
   const snapshot={...createSandwichSnapshot(family),qtys:{[recipe.id]:2},tab:'prep'};
   assert.doesNotMatch(render(snapshot,{styleKey:family}),/steps checked|étapes cochées/);
   assert.ok(render({...snapshot,tab:'serve'},{styleKey:family}).includes(label));
 }
});

test('multiple filling recipes show a shared order with cooking first but retain independent step checklists',()=>{
 const cold=SANDWICH_RECIPES.find(r=>r.id==='baguette-jambon-beurre');
 const chicken=SANDWICH_RECIPES.find(r=>r.id==='baguette-poulet-mayo');
 const snapshot={...createSandwichSnapshot('baguette'),qtys:{[cold.id]:2,[chicken.id]:2},tab:'prep'};
 const html=render(snapshot);
 assert.match(html,/aria-label="Preparation order"/);
 const overview=html.split('aria-label="Preparation order"')[1].split('</nav>')[0];
 assert.ok(overview.indexOf('Chicken &amp; mayonnaise')<overview.indexOf('Ham &amp; butter'));
 assert.match(html,/type="checkbox"/);
 assert.doesNotMatch(render({...snapshot,qtys:{[chicken.id]:2}}),/aria-label="Preparation order"/);
});

test('sandwich completion forwards download, repeat and notes controls',()=>{
 const recipe=SANDWICH_RECIPES.find(r=>r.familyId==='laffa');
 const snapshot={...createSandwichSnapshot('laffa'),qtys:{[recipe.id]:1},completed:{[recipe.id]:1},tab:'serve'};
 const html=render(snapshot,{styleKey:'laffa',onSave(){},saveKind:'download',onRepeat(){},resultNotes:'Less sauce next time',onResultNotesChange(){}});
 assert.match(html,/Download recipe/);
 assert.match(html,/Make this again/);
 assert.match(html,/Less sauce next time/);
});

test('sandwich mozzarella courses explicitly use the declared drained weight without package conversion',()=>{
 const recipe=SANDWICH_RECIPES.find(r=>r.familyId==='baguette'&&r.ingredients.some(i=>i.ingredientId==='mozzarella'));
 const grams=recipe.ingredients.find(i=>i.ingredientId==='mozzarella').grams*3;
 for(const isFr of [false,true]){
  const snapshot={...createSandwichSnapshot('baguette'),qtys:{[recipe.id]:3},tab:'shop'};
  const html=render(snapshot,{isFr});
  assert.ok(html.includes(isFr?'poids égoutté':'drained weight'));
  assert.ok(html.includes(isFr?'sans la saumure':'excluding brine'));
  assert.ok(html.includes(`${grams} g`));
 }
});
