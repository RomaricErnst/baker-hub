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
