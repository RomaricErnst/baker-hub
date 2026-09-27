const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.endsWith('/auditedPizzaRecipes') ? path.join(__dirname,'../app/lib/auditedPizzaRecipes.ts') : request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require('./load-production.cjs');
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.ts']=require.extensions['.tsx'];
const {buildShoppingList}=require('../app/components/ToppingSelector.tsx');
test('shopping categories describe shop aisles, not topping order',()=>{
 const {sections}=buildShoppingList({margherita:2},'en','neapolitan');
 const produce=sections.find(s=>s.label==='Produce');
 assert.ok(produce.items.some(i=>i.id==='fresh_basil'));
 const pantry=sections.find(s=>s.label==='Sauce & Pantry');
 assert.ok(pantry.items.every(i=>i.id!=='fresh_basil'));
 const tomato=pantry.items.find(i=>i.id==='san_marzano');
 assert.equal(tomato.totalAmount,160);
});

test('all multilingual store notes become renderable strings',()=>{
 const {shoppingNoteText}=require('../app/components/ToppingSelector.tsx');
 const recipes=require('../app/lib/auditedPizzaRecipes.json');
 for(const recipe of Object.values(recipes)) for(const item of recipe.ingredients) for(const shop of Object.values(item.whereToFind||{})) for(const locale of ['en','fr']) assert.equal(typeof shoppingNoteText(shop.note,locale),'string');
 assert.equal(shoppingNoteText({en:'Dairy aisle',fr:'Rayon frais'},'fr'),'Rayon frais');
});

test('fresh mozzarella shopping uses drained cheese mass while low-moisture cheese stays distinct',()=>{
 const {PIZZAS}=require('../app/lib/toppingDatabase.ts');
 for(const locale of ['en','fr']){
  const items=buildShoppingList({margherita:4,ny_margherita_bufala:2},locale,'neapolitan').sections.flatMap(s=>s.items);
  const fresh=items.find(i=>i.id==='fior_di_latte');
  const buffalo=items.find(i=>i.id==='buffalo_mozzarella');
  assert.equal(fresh.totalAmount,400);assert.equal(fresh.unit,'g');
  assert.equal(buffalo.totalAmount,200);assert.equal(buffalo.unit,'g');
  for(const item of [fresh,buffalo])assert.match(item.name[locale],locale==='fr'?/poids égoutté/:/drained weight/);
 }
 for(const pizza of PIZZAS)for(const ingredient of pizza.ingredients){
  if(['fior_di_latte','buffalo_mozzarella'].includes(ingredient.id)){
   assert.match(ingredient.name.en,/drained weight/);
   assert.match(ingredient.name.fr,/poids égoutté/);
  }
  if(['mozzarella_lm','mozzarella_low_moisture'].includes(ingredient.id))assert.doesNotMatch(ingredient.name.en,/drained weight/);
 }
});

test('drained-weight metadata preserves user-defined quantities and never assumes a package yield',()=>{
 const {withDrainedCheeseWeight}=require('../app/lib/ingredientWeights.ts');
 const custom={id:'fior_di_latte',name:{en:'My mozzarella',fr:'Ma mozzarella'},category:'cheese',bakeOrder:'before',qtyPerPizza:{amount:145,unit:'g'}};
 const result=withDrainedCheeseWeight(custom);
 assert.equal(result.qtyPerPizza.amount,145);
 assert.equal(result.qtyPerPizza.unit,'g');
 assert.deepEqual(withDrainedCheeseWeight(result),result);
 assert.equal(custom.name.en,'My mozzarella');
 const pieces=withDrainedCheeseWeight({...custom,qtyPerPizza:{amount:2,unit:'pcs'}});
 assert.equal(pieces.qtyPerPizza.amount,2);assert.equal(pieces.qtyPerPizza.unit,'pcs');
 assert.match(pieces.qtyPerPizza.noteEN,/size varies/);
 assert.doesNotMatch(pieces.name.en,/drained weight/);
 const low={...custom,id:'mozzarella_lm'};
 assert.equal(withDrainedCheeseWeight(low),low);
});

test('pizza poultry shopping keeps cooked targets and gives cut-specific purchasing guidance',()=>{
 const {PIZZAS}=require('../app/lib/toppingDatabase.ts');
 for(const locale of ['en','fr']){
  const chicken=buildShoppingList({bbq_chicken:2,teriyaki_chicken:1},locale,'neapolitan').sections.flatMap(s=>s.items).find(i=>i.id==='grilled_chicken');
  assert.equal(chicken.totalAmount,360); // recipe remains cooked meat, not purchase weight
  assert.match(chicken.qtyNote,/500 g/);assert.match(chicken.qtyNote,/360 g/);assert.match(chicken.qtyNote,/73/);
  assert.match(chicken.name[locale],locale==='fr'?/poids cuit/:/cooked weight/);
  const thigh=buildShoppingList({satay_chicken:2},locale,'neapolitan').sections.flatMap(s=>s.items).find(i=>i.id==='chicken_thigh_grilled');
  assert.equal(thigh.totalAmount,240);assert.match(thigh.qtyNote,/240 g/);assert.doesNotMatch(thigh.qtyNote,/73|330 g/);
 }
 for(const pizza of PIZZAS) for(const ingredient of pizza.ingredients) if(['grilled_chicken','chicken_thigh_grilled'].includes(ingredient.id)){
  assert.match(ingredient.prepNote.en,/74°C/);assert.match(ingredient.prepNote.fr,/74 °C/);
  assert.doesNotMatch(ingredient.qtyPerPizza.noteEN,/1 breast/);
 }
});
