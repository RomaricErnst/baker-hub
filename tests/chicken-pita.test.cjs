const {test}=require('node:test');
const a=require('node:assert/strict');
require('./load-production.cjs');
const c=require('../app/lib/sandwichCatalog.ts');
const d=require('../app/lib/sandwich.ts');
const raw=d.getSandwichRecipe('pita-poulet-cru-citron');
const allText=(steps,lang='en')=>steps.map(s=>s.instruction[lang]).join(' ');

test('raw chicken pita scales raw shopping weight separately from cooked chicken',()=>{
  const shopping=d.aggregateSandwichShopping({[raw.id]:4,'pita-poulet-shawarma':2},{},'pita');
  a.equal(shopping.find(i=>i.ingredientId==='chicken_raw').grams,400);
  a.match(shopping.find(i=>i.ingredientId==='chicken_raw').name.en,/Raw/);
  a.equal(shopping.find(i=>i.ingredientId==='chicken').grams,200);
  a.equal(d.aggregateSandwichShopping({[raw.id]:4},{[raw.id]:{chicken_raw:125}},'pita').find(i=>i.ingredientId==='chicken_raw').grams,500);
  a.equal(c.SANDWICH_INGREDIENTS.chicken_raw.kcalPer100g,120);
  a.equal(c.SANDWICH_INGREDIENTS.chicken_raw.provenance,'generic-food-estimate');
});

test('raw chicken instructions specify measurable endpoint before assembly and clean handling',()=>{
  const steps=d.effectiveSandwichSteps(raw);
  const cook=steps.find(s=>s.id.endsWith('-cook'));
  a.match(cook.instruction.en,/thermometer.*74°C/);
  a.match(cook.instruction.fr,/thermomètre.*74 °C/);
  a.match(cook.instruction.en,/per batch/);
  a.match(allText(steps),/Do not rinse/);
  a.match(allText(steps),/hot, soapy water/);
  a.ok(steps.indexOf(cook)<steps.findIndex(s=>s.phase==='assemble'));
  a.match(steps.find(s=>s.phase==='assemble').instruction.en,/pitas are baked/);
  a.doesNotMatch(allText(steps),/carrot|tahini|mustard|cheese/);
});

test('ingredient removal updates salad, sauce, chicken cooking and assembly together',()=>{
  const edited=d.effectiveSandwichSteps(raw,{chicken_raw:0,yogurt:0,cucumber:0,lemon:0,olive_oil:0});
  a.doesNotMatch(allText(edited),/chicken|yogurt|cucumber|lemon|oil/);
  a.ok(!edited.some(s=>s.id.endsWith('-cook')||s.id.endsWith('-raw')||s.id.endsWith('-sauce')));
  a.match(allText(edited),/lettuce/);
  const noOil=d.effectiveSandwichSteps(raw,{olive_oil:0});
  a.doesNotMatch(allText(noOil),/oil/);
  a.ok(noOil.some(s=>s.id.endsWith('-cook')));
  const noYogurt=d.effectiveSandwichSteps(raw,{yogurt:0});
  a.doesNotMatch(allText(noYogurt),/yogurt/);
  a.match(allText(noYogurt),/lemon juice/);
});

test('existing cooked chicken IDs and saved quantities remain cooked with tailored steps',()=>{
  for(const id of ['pita-poulet-shawarma','pita-poulet-citron']){
    const recipe=d.getSandwichRecipe(id);
    a.match(recipe.name.en,/already cooked/);
    a.ok(recipe.ingredients.some(i=>i.ingredientId==='chicken'));
    a.ok(!recipe.ingredients.some(i=>i.ingredientId==='chicken_raw'));
    a.match(allText(recipe.steps),/cooked weight/);
    a.doesNotMatch(allText(recipe.steps),/carrot|tahini|mustard|cheese/);
    a.equal(d.normalizeSandwichSnapshot({familyId:'pita',qtys:{[id]:4}}).qtys[id],4);
  }
});
