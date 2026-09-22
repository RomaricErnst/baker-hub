const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./load-production.cjs');
const {SANDWICH_FAMILIES,SANDWICH_RECIPES}=require('../app/lib/sandwichCatalog.ts');
const d=require('../app/lib/sandwich.ts');
const tartines=SANDWICH_RECIPES.filter(r=>r.familyId==='tartine');

test('only supported sliced loaves resolve to tartines, preserving selected bread identity',()=>{
  for(const style of ['pain_campagne','pain_levain','pain_complet','pain_seigle','pain_mie']) assert.equal(d.sandwichFamilyForStyle(style),'tartine');
  for(const style of ['brioche','pain_viennois','fougasse','unknown','tartine','neapolitan']) assert.equal(d.sandwichFamilyForStyle(style),null);
  assert.equal(d.sandwichFamilyForStyle('baguette'),'baguette');
});

test('tartines assemble open-faced portions and use an existing bread illustration',()=>{
  const family=SANDWICH_FAMILIES.find(f=>f.id==='tartine');
  assert.ok(fs.existsSync(path.join(__dirname,'../public',family.image)));
  for(const recipe of tartines){
    assert.equal(recipe.breadGrams,60);
    const bread=recipe.steps.find(s=>s.id.endsWith('-bread'));
    assert.match(bread.instruction.fr,/60 g.*une grande tranche ou plusieurs petites/);
    assert.match(bread.instruction.en,/one large slice or several small/);
    const assembly=recipe.steps.find(s=>s.phase==='assemble');
    assert.match(assembly.instruction.fr,/sans seconde tranche/);
    assert.match(assembly.instruction.en,/open-faced/);
    assert.doesNotMatch(assembly.instruction.en,/close\.|fold or roll/);
    assert.doesNotMatch(recipe.steps[0].instruction.en,/per sandwich/);
  }
});

test('avocado and egg uses poached egg, feta and opt-in pomegranate and adapts to ingredient removal',()=>{
  const recipe=tartines.find(r=>r.id==='tartine-avocat-oeuf');
  assert.match(recipe.name.en,/poached egg/);
  assert.ok(recipe.ingredients.some(i=>i.ingredientId==='avocado'&&i.grams===60));
  assert.ok(recipe.ingredients.some(i=>i.ingredientId==='egg_to_poach'&&i.grams===55));
  assert.match(d.effectiveSandwichSteps(recipe).find(s=>s.id.endsWith('-egg')).instruction.en,/gently simmering water/);
  assert.ok(recipe.ingredients.some(i=>i.ingredientId==='feta'&&i.grams===25));
  assert.ok(recipe.ingredients.some(i=>i.ingredientId==='salt'&&i.grams>0));
  assert.ok(recipe.ingredients.some(i=>i.ingredientId==='black_pepper'&&i.grams>0));
  const defaultList=d.aggregateSandwichShopping({[recipe.id]:2},{},'tartine');
  assert.ok(!defaultList.some(i=>i.ingredientId==='pomegranate'));
  const selected=d.updateSandwichRecipe(d.createSandwichSnapshot('tartine'),recipe.id,2,{pomegranate:15});
  const restored=d.normalizeSandwichSnapshot(selected);
  const optionalList=d.aggregateSandwichShopping(restored.qtys,restored.ingredientOverrides,'tartine');
  assert.equal(optionalList.find(i=>i.ingredientId==='pomegranate').grams,30);
  assert.match(d.effectiveSandwichSteps(recipe,{pomegranate:15}).find(s=>s.phase==='assemble').instruction.en,/pomegranate/);
  assert.doesNotMatch(d.effectiveSandwichSteps(recipe).find(s=>s.phase==='assemble').instruction.en,/pomegranate/);
  assert.doesNotMatch(d.effectiveSandwichSteps(recipe,{feta:0}).find(s=>s.phase==='assemble').instruction.en,/feta/);
  const adjusted=d.effectiveSandwichSteps(recipe,{egg_to_poach:0,avocado:0});
  assert.ok(!adjusted.some(s=>/-egg$|-avocado$/.test(s.id)));
});

test('tartine quantities scale portions without adding loaves and survive same-family loaf changes',()=>{
  const recipe=tartines.find(r=>r.id==='tartine-avocat-oeuf');
  const snapshot=d.updateSandwichRecipe(d.createSandwichSnapshot('tartine'),recipe.id,3);
  const shopping=d.aggregateSandwichShopping(snapshot.qtys,{},'tartine');
  assert.equal(shopping.find(i=>i.ingredientId==='egg_to_poach').grams,165);
  assert.equal(shopping.find(i=>i.ingredientId==='avocado').grams,180);
  assert.ok(shopping.every(i=>i.category!=='bread'));
  assert.equal(recipe.breadGrams*snapshot.qtys[recipe.id],180);
  const same=d.switchSandwichFamily(snapshot,d.sandwichFamilyForStyle('pain_seigle'));
  assert.equal(same.qtys[recipe.id],3);
  assert.deepEqual(d.switchSandwichFamily(same,'baguette').qtys,{});
});
