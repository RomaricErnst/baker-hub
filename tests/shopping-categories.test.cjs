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
