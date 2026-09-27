const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('./load-production.cjs');
const {SANDWICH_RECIPES,SANDWICH_INGREDIENTS,estimateRawChickenPurchase}=require('../app/lib/sandwichCatalog.ts');
const {effectiveIngredients,effectiveSandwichSteps}=require('../app/lib/sandwich.ts');
const source=fs.readFileSync(require.resolve('../app/components/ExistingBaseJourney.tsx'),'utf8');
const body=source.split(' const exportText=()=>{')[1].split('\n };\n const saveFinished')[0];
const exportText=new Function('fr','tr','draft','detail','bases','snapshot','SANDWICH_RECIPES','SANDWICH_INGREDIENTS','effectiveIngredients','effectiveSandwichSteps','estimateRawChickenPurchase',body);

test('existing-base export preserves cooked use quantities and adds the same raw shopping estimate',()=>{
 for(const fr of [false,true]){
  const result=exportText(fr,(a,b)=>fr?a:b,{base:'laffa',resultNotes:'Next time'}, {notes:''},[],{qtys:{'laffa-shawarma-poulet':2},ingredientOverrides:{}},SANDWICH_RECIPES,SANDWICH_INGREDIENTS,effectiveIngredients,effectiveSandwichSteps,estimateRawChickenPurchase);
  assert.match(result,/240 g/);
  assert.match(result,/330 g/);
  assert.ok(result.includes(fr?'rendement variable':'yield varies'));
  assert.ok(result.includes('Next time'));
 }
 const raw=exportText(false,(a,b)=>b,{base:'pita'}, {notes:''},[],{qtys:{'pita-poulet-cru-citron':2},ingredientOverrides:{}},SANDWICH_RECIPES,SANDWICH_INGREDIENTS,effectiveIngredients,effectiveSandwichSteps,estimateRawChickenPurchase);
 assert.match(raw,/Raw boneless skinless chicken breast · 200 g/);
 assert.doesNotMatch(raw,/buy approximately/);
});
