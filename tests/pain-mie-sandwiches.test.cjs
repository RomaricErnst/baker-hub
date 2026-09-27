const {test}=require('node:test');
const a=require('node:assert/strict');
require('./load-production.cjs');
const c=require('../app/lib/sandwichCatalog.ts');
const d=require('../app/lib/sandwich.ts');
const club=d.getSandwichRecipe('pain_mie-club-sandwich');
const croque=d.getSandwichRecipe('pain_mie-croque-monsieur');
const instructions=(recipe,overrides={})=>d.effectiveSandwichSteps(recipe,overrides).map(s=>s.instruction.en).join(' ');

test('pain de mie has two proper sandwich recipes and recipe-specific bread portions',()=>{
 a.equal(d.sandwichFamilyForStyle('pain_mie'),'pain_mie');
 a.equal(d.sandwichFamilyForStyle('pain_campagne'),'tartine');
 a.equal(c.SANDWICH_RECIPES.filter(r=>r.familyId==='pain_mie').length,2);
 a.equal(club.breadGrams,90);a.equal(croque.breadGrams,60);
 a.equal(club.breadSlices,3);a.equal(croque.breadSlices,2);
 a.match(instructions(club),/3 slices of about 30 g/);
 a.match(instructions(croque),/2 slices of about 30 g/);
 a.match(instructions(club),/not a whole loaf/);
 for(const recipe of [club,croque]){
  const removed=Object.fromEntries(recipe.ingredients.map(i=>[i.ingredientId,0]));
  a.equal(d.estimatedSandwichKcal(recipe,removed),Math.round(recipe.breadGrams*2.65));
  a.equal(d.isLighterSandwich(recipe,removed),false);
 }
});
test('shopping scales fillings by sandwiches without buying another loaf',()=>{
 const list=d.aggregateSandwichShopping({[club.id]:2,[croque.id]:3},{},'pain_mie');
 a.equal(list.find(i=>i.ingredientId==='chicken').grams,140);
 a.equal(list.find(i=>i.ingredientId==='bacon_cooked').grams,50);
 a.equal(list.find(i=>i.ingredientId==='milk').grams,180);
 a.equal(list.find(i=>i.ingredientId==='wheat_flour').grams,15);
 a.equal(list.find(i=>i.ingredientId==='ham').grams,150);
 a.ok(list.every(i=>i.category!=='bread'));
 const snapshot=d.normalizeSandwichSnapshot({familyId:'pain_mie',qtys:{[club.id]:2,[croque.id]:3}});
 a.equal(d.sandwichQueue(snapshot.qtys,{},'pain_mie').reduce((n,row)=>n+row.quantity*row.recipe.breadGrams,0),360);
});
test('bread-dependent toasting, assembly, baking and serving stay in the serving phase',()=>{
 for(const recipe of [club,croque]) {
  const steps=d.effectiveSandwichSteps(recipe);
  const prep=steps.filter(s=>s.phase!=='assemble');
  const serve=steps.filter(s=>s.phase==='assemble');
  a.ok(prep.length>0);a.ok(serve.length>=3);
  a.ok(serve[0].instruction.en.includes('fully cooled'));
  a.ok(!prep.some(s=>/-toast$|-stack$|-bread$|-bake$|-serve$/.test(s.id)));
 }
 const serve=d.effectiveSandwichSteps(croque).filter(s=>s.phase==='assemble');
 a.ok(serve.findIndex(s=>s.id.endsWith('-stack'))<serve.findIndex(s=>s.id.endsWith('-bake')));
 a.match(serve.find(s=>s.id.endsWith('-bake')).instruction.en,/180°C.*10–15 minutes/);
 a.match(serve.find(s=>s.id.endsWith('-bake')).instruction.en,/74°C/);
 a.match(instructions(croque),/shallow container.*refrigerate promptly/);
});
test('club removals update both prep and double-layer assembly',()=>{
 const text=instructions(club,{chicken:0,bacon_cooked:0,mayonnaise:0,tomato:0});
 a.doesNotMatch(text,/chicken|bacon|mayonnaise|tomato/);
 a.match(text,/lettuce/);
 a.match(text,/middle slice/);a.match(text,/third slice/);
});
test('croque béchamel has a cooked roux, and missing sauce ingredients require correction',()=>{
 a.match(instructions(croque),/Stir in the flour for 2 minutes/);
 a.match(instructions(croque),/Whisk in the milk gradually/);
 a.match(instructions(croque),/about 5 minutes/);
 for(const id of ['milk','butter','wheat_flour']){
  const steps=d.effectiveSandwichSteps(croque,{[id]:0});
  a.ok(steps.some(s=>s.id.endsWith('-correct-sauce')));
  a.match(steps.map(s=>s.instruction.en).join(' '),/Do not assemble with raw flour/);
  a.ok(!steps.some(s=>s.id.endsWith('-bake')||s.id.endsWith('-bechamel')));
 }
 const without={milk:0,butter:0,wheat_flour:0,ham:0,emmental:0,mustard:0,nutmeg:0};
 const text=instructions(croque,without);
 a.match(text,/without béchamel/);
 a.doesNotMatch(text,/\b(?:milk|butter|flour|ham|Emmental|mustard|nutmeg)\b|cheese has melted/);
 a.ok(d.effectiveSandwichSteps(croque,without).some(s=>s.id.endsWith('-bake')));
});


test('croque finishing mustard and nutmeg are opt-in and appear only when selected',()=>{
 for(const id of ['mustard','nutmeg'])a.equal(croque.ingredients.find(i=>i.ingredientId===id).grams,0);
 a.doesNotMatch(instructions(croque),/mustard|nutmeg/);
 const selected=instructions(croque,{mustard:4,nutmeg:0.1});
 a.match(selected,/mustard/);a.match(selected,/nutmeg/);
 const list=d.aggregateSandwichShopping({[croque.id]:3},{[croque.id]:{mustard:4,nutmeg:0.1}},'pain_mie');
 a.equal(list.find(i=>i.ingredientId==='mustard').grams,12);
 a.equal(list.find(i=>i.ingredientId==='nutmeg').grams,0.3);
});
