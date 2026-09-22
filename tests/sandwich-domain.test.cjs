const {test}=require('node:test');
const a=require('node:assert/strict');
require('./load-production.cjs');
const c=require('../app/lib/sandwichCatalog.ts');
const d=require('../app/lib/sandwich.ts');
const recipe=id=>c.SANDWICH_RECIPES.find(r=>r.id===id);

test('sandwich catalogue covers all approved families with credible classic/inspired distinctions',()=>{
  a.equal(c.SANDWICH_FAMILIES.length,13);
  a.equal(c.SANDWICH_RECIPES.length,88);
  a.equal(new Set(c.SANDWICH_RECIPES.map(r=>r.id)).size,88);
  for(const f of c.SANDWICH_FAMILIES){
    const recipes=c.SANDWICH_RECIPES.filter(r=>r.familyId===f.id);
    a.ok(recipes.length>=6,f.id);
    a.ok(recipes.filter(r=>r.lighter).length>=2,f.id);
    for(const r of recipes){
      a.ok(r.name.fr&&r.name.en);
      a.equal(r.breadGrams,f.breadGrams);
      a.ok(r.steps.some(s=>s.phase==='prep'));
      a.ok(r.steps.some(s=>s.phase==='assemble'));
      a.ok(r.steps.every(s=>s.instruction.fr&&s.instruction.en));
      a.ok(r.ingredients.every(i=>c.SANDWICH_INGREDIENTS[i.ingredientId]&&(i.grams>0||(i.grams===0&&i.optionalGrams>0))));
    }
  }
  const pan=c.SANDWICH_RECIPES.filter(r=>r.familyId==='pan_bagnat');
  a.equal(pan.filter(r=>r.kind==='classic').length,1);
  a.ok(pan.filter(r=>r.kind==='inspired').every(r=>r.name.fr.startsWith('Inspiré')));
});

test('shopping merges shared ingredients and counts sandwich servings independently of loaf counts',()=>{
  const first=recipe('baguette-jambon-beurre'),second=recipe('baguette-parisien');
  const list=d.aggregateSandwichShopping({[first.id]:2,[second.id]:3},{},'baguette');
  a.equal(list.find(i=>i.ingredientId==='ham').grams,70*2+65*3);
  a.equal(list.find(i=>i.ingredientId==='butter').grams,18*2+12*3);
  a.equal(list.find(i=>i.ingredientId==='ham').key,'ham:335');
  a.ok(!list.some(i=>i.category==='bread'));
});

test('family switch isolates recipes and clears preparation, shopping and serving state',()=>{
  const source={...d.createSandwichSnapshot('baguette'),qtys:{'baguette-jambon-beurre':3},completed:{'baguette-jambon-beurre':1},shopTicks:{'ham:210':true},prepTicks:{x:true},tab:'serve'};
  const switched=d.switchSandwichFamily(source,'bagel');
  a.deepEqual(switched,d.createSandwichSnapshot('bagel'));
  a.deepEqual(d.reconcileSandwichSelection('bagel',source.qtys),{});
});

test('gram changes invalidate affected shopping/preparation checks and fulfilled portions',()=>{
  const r=recipe('baguette-jambon-beurre');
  let state=d.updateSandwichRecipe(d.createSandwichSnapshot('baguette'),r.id,2);
  const old=d.sandwichPrepKey(r,r.steps[0].id,2);
  state={...state,shopTicks:{'ham:140':true,'butter:36':true},prepTicks:{[old]:true},completed:{[r.id]:2}};
  const next=d.updateSandwichRecipe(state,r.id,2,{ham:50});
  a.equal(next.shopTicks['ham:140'],undefined);
  a.equal(next.shopTicks['butter:36'],true);
  a.deepEqual(next.prepTicks,{});
  a.equal(next.completed[r.id],0);
  a.equal(d.aggregateSandwichShopping(next.qtys,next.ingredientOverrides,'baguette').find(i=>i.ingredientId==='ham').grams,100);
});

test('snapshot restore rejects unknown recipes, invalid quantities and foreign-family overrides',()=>{
  const restored=d.normalizeSandwichSnapshot({familyId:'baguette',qtys:{'baguette-jambon-beurre':3.9,'bagel-thon-mayo':4,bogus:3,'baguette-parisien':NaN},completed:{'baguette-jambon-beurre':99},ingredientOverrides:{'baguette-jambon-beurre':{ham:NaN,butter:-2,pickle:0,unknown:200}},shopTicks:{'ham:210':true,'dough:flour:400':true,bogus:true},tab:'bad'});
  a.deepEqual(restored.qtys,{'baguette-jambon-beurre':3});
  a.equal(restored.completed['baguette-jambon-beurre'],3);
  a.deepEqual(restored.ingredientOverrides['baguette-jambon-beurre'],{pickle:0});
  a.equal(restored.shopTicks['dough:flour:400'],true);
  a.equal(restored.shopTicks.bogus,undefined);
  a.equal(restored.tab,'pick');
});

test('customizing before selection persists and rebaking resets progress without losing recipe choices',()=>{
  const r=recipe('baguette-jambon-beurre');
  let state=d.updateSandwichRecipe(d.createSandwichSnapshot('baguette'),r.id,0,{butter:10});
  a.equal(state.ingredientOverrides[r.id].butter,10);
  state=d.updateSandwichRecipe(state,r.id,3);
  state={...state,completed:{[r.id]:2},shopTicks:{'ham:210':true},tab:'serve'};
  const rebake=d.normalizeSandwichSnapshot(state,true);
  a.equal(rebake.qtys[r.id],3);
  a.equal(rebake.ingredientOverrides[r.id].butter,10);
  a.deepEqual(rebake.completed,{});
  a.deepEqual(rebake.shopTicks,{});
  a.equal(rebake.tab,'pick');
});

test('recipe queues clamp fulfilled portions and ignore stale family IDs',()=>{
  const q=d.sandwichQueue({'baguette-jambon-beurre':4,'baguette-parisien':2,'bagel-thon-mayo':5},{'baguette-jambon-beurre':1,'baguette-parisien':99},'baguette');
  a.equal(q.length,2);
  a.equal(q.find(i=>i.recipeId==='baguette-jambon-beurre').remaining,3);
  a.equal(q.find(i=>i.recipeId==='baguette-parisien').completed,2);
});

test('removing ingredients updates preparation instructions rather than cooking nonexistent eggs',()=>{
  const r=recipe('bagel-oeuf-cheddar');
  a.ok(d.effectiveSandwichSteps(r).some(s=>s.id.endsWith('-egg')));
  a.ok(!d.effectiveSandwichSteps(r,{egg:0}).some(s=>s.id.endsWith('-egg')));
  a.ok(d.effectiveSandwichSteps(r,{egg:0}).some(s=>s.phase==='assemble'));
});
