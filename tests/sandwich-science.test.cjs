const {test} = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {SANDWICH_RECIPES:recipes,SANDWICH_FAMILIES:families,SANDWICH_INGREDIENTS:ingredients} = require('../app/lib/sandwichCatalog.ts');
const {estimatedSandwichKcal,aggregateSandwichShopping,isLighterSandwich} = require('../app/lib/sandwich.ts');

test('full sandwich estimates retain bread energy when all fillings are removed', () => {
  for (const recipe of recipes) {
    const family = families.find(f=>f.id===recipe.familyId);
    const removed = Object.fromEntries(recipe.ingredients.map(i=>[i.ingredientId,0]));
    const breadOnly = estimatedSandwichKcal(recipe,removed);
    assert.equal(breadOnly,Math.round(recipe.breadGrams*family.breadKcalPer100g/100));
    assert.ok(estimatedSandwichKcal(recipe)>breadOnly,recipe.id);
    const first = recipe.ingredients[0];
    assert.ok(estimatedSandwichKcal(recipe,{[first.ingredientId]:first.grams+100})>estimatedSandwichKcal(recipe),recipe.id);
  }
});

test('unknown nutrient data fails explicitly instead of producing a low calorie claim', () => {
  assert.throws(()=>estimatedSandwichKcal({...recipes[0],ingredients:[{ingredientId:'unknown-food',grams:100}]}),/Missing sandwich nutrition/);
  for (const ingredient of Object.values(ingredients)) {
    assert.ok(Number.isFinite(ingredient.kcalPer100g)&&(ingredient.kcalPer100g>0||(ingredient.id==='salt'&&ingredient.kcalPer100g===0))&&ingredient.kcalPer100g<=900,ingredient.id);
    assert.equal(ingredient.provenance,'generic-food-estimate');
    assert.ok(ingredient.referenceFood.length>0);
  }
});

test('shopping scales edible fillings without counting a second bread portion', () => {
  for (const recipe of recipes) {
    const items = aggregateSandwichShopping({[recipe.id]:3},{},recipe.familyId);
    assert.ok(items.every(i=>i.category!=='bread'),recipe.id);
    assert.ok(Math.abs(items.reduce((sum,i)=>sum+i.grams,0)-3*recipe.ingredients.reduce((sum,i)=>sum+i.grams,0))<.01,recipe.id);
  }
});

test('lighter catalogue choices use an equal bread portion and actual classic comparison', () => {
  for (const family of families) {
    const members = recipes.filter(r=>r.familyId===family.id);
    const classics = members.filter(r=>r.kind==='classic');
    assert.ok(classics.length>0,family.id);
    if(family.id==='pain_mie'){
      assert.deepEqual(members.map(r=>r.breadGrams).sort((a,b)=>a-b),[60,90]);
      assert.ok(members.every(r=>!r.lighter&&!isLighterSandwich(r)),family.id);
      continue; // Distinct slice counts are deliberately not given an equal-bread lighter comparison.
    }
    assert.ok(members.every(r=>r.breadGrams===family.breadGrams),family.id);
    const unrounded = r=>r.breadGrams*family.breadKcalPer100g/100+r.ingredients.reduce((sum,i)=>sum+i.grams*ingredients[i.ingredientId].kcalPer100g/100,0);
    const reference = classics.reduce((sum,r)=>sum+unrounded(r),0)/classics.length;
    for(const recipe of members.filter(r=>r.lighter)) assert.ok(unrounded(recipe)<=reference*.8,recipe.id);
  }
});

test('a richer customized filling cannot retain the original lighter classification', () => {
  const recipe = recipes.find(r=>r.lighter&&r.ingredients.some(i=>i.ingredientId==='olive_oil'));
  assert.ok(recipe);
  assert.equal(isLighterSandwich(recipe),true);
  assert.equal(isLighterSandwich(recipe,{olive_oil:100}),false);
});

test('raw chicken purchasing estimate is separate from cooked portion nutrition and removed chicken needs no purchase',()=>{
 const {estimateRawChickenPurchase}=require('../app/lib/sandwichCatalog.ts');
 assert.equal(estimateRawChickenPurchase(73),100);
 assert.equal(estimateRawChickenPurchase(240),330);
 assert.equal(estimateRawChickenPurchase(0),0);
 assert.equal(estimateRawChickenPurchase(NaN),0);
 const recipe=recipes.find(r=>r.id==='laffa-shawarma-poulet');
 assert.equal(aggregateSandwichShopping({[recipe.id]:2},{},'laffa').find(i=>i.ingredientId==='chicken').grams,240);
 assert.ok(!aggregateSandwichShopping({[recipe.id]:2},{[recipe.id]:{chicken:0}},'laffa').some(i=>i.ingredientId==='chicken'));
});

test('removed tahini disappears from preparation and assembly even when spices remain',()=>{
  const {effectiveSandwichSteps}=require('../app/lib/sandwich.ts');
  const recipe=recipes.find(r=>r.familyId==='laffa'&&r.ingredients.some(i=>i.ingredientId==='chicken'));
  assert.ok(recipe);
  const base=effectiveSandwichSteps(recipe);
  assert.ok(base.some(s=>s.id.endsWith('-sauce')));
  const edited=effectiveSandwichSteps(recipe,{tahini:0});
  for(const lang of ['fr','en']) {
    const instructions=edited.map(s=>s.instruction[lang]).join(' ');
    assert.doesNotMatch(instructions,/tahini/i);
    const assembly=edited.find(s=>s.phase==='assemble').instruction[lang];
    assert.doesNotMatch(assembly,/sauce/i);
  }
  assert.ok(edited.some(s=>s.id.endsWith('-season')));
  assert.ok(!edited.some(s=>s.id.endsWith('-sauce')));
  assert.match(edited.find(s=>s.id.endsWith('-chicken-option')).instruction.en,/74°C/);
});

test('retained sauce instructions name only effective sauce ingredients',()=>{
 const {effectiveSandwichSteps}=require('../app/lib/sandwich.ts');
 const recipe=recipes.find(r=>r.familyId==='laffa'&&r.ingredients.some(i=>i.ingredientId==='chicken'));
 const sauce=effectiveSandwichSteps(recipe,{cumin:0,paprika:0}).find(s=>s.id.endsWith('-sauce'));
 assert.ok(sauce);
 assert.match(sauce.instruction.en,/tahini/);
 assert.doesNotMatch(sauce.instruction.en,/yogurt|mustard|honey|paprika|cumin/);
});
