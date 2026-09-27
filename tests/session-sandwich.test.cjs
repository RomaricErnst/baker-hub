const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {saveSession,loadSession}=require('../app/lib/session.ts');
const {createSandwichSnapshot,normalizeSandwichSnapshot,getSandwichRecipe,sandwichPrepKey,aggregateSandwichShopping}=require('../app/lib/sandwich.ts');
const {SANDWICH_RECIPES}=require('../app/lib/sandwichCatalog.ts');
function fixture(){
 const recipe=SANDWICH_RECIPES.find(r=>r.familyId==='baguette');
 const plan=createSandwichSnapshot('baguette');plan.qtys[recipe.id]=2;plan.completed[recipe.id]=1;plan.tab='serve';
 plan.prepTicks[sandwichPrepKey(recipe,recipe.steps[0].id,2)]=true;
 plan.shopTicks[aggregateSandwichShopping(plan.qtys)[0].key]=true;
 plan.shopTicks['dough:flour:500']=true;
 return plan;
}
test('sandwich selection and progress survive local save separately from pizza IDs',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 const plan=fixture(),pizza={qtys:{margherita:4}};
 assert.equal(saveSession({bakeType:'bread',activeTab:'sandwiches',sandwichParty:plan,pizzaParty:pizza}),true);
 const restored=loadSession();assert.equal(restored.activeTab,'sandwiches');assert.deepEqual(restored.sandwichParty,plan);assert.deepEqual(restored.pizzaParty,pizza);
});
test('sandwich rebake retains selected quantities but clears preparation, shopping and served counts',()=>{
 const original=fixture(),rebake=normalizeSandwichSnapshot(original,true);
 assert.deepEqual(rebake.qtys,original.qtys);assert.equal(rebake.familyId,'baguette');assert.equal(rebake.tab,'pick');
 assert.deepEqual(rebake.completed,{});assert.deepEqual(rebake.shopTicks,{});assert.deepEqual(rebake.prepTicks,{});
 assert.equal(original.tab,'serve');assert.ok(Object.keys(original.completed).length);
});
