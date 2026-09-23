const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./load-production.cjs');
const {BREAD_GROUPS,BREAD_MEAL_EXAMPLES}=require('../app/lib/breadNavigation.ts');
const {sandwichFamilyForStyle,getSandwichRecipe}=require('../app/lib/sandwich.ts');

test('bread meal examples cover exactly supported families and use a matching existing dish',()=>{
  for(const style of BREAD_GROUPS.flatMap(group=>group.keys)){
    const family=sandwichFamilyForStyle(style);
    const example=BREAD_MEAL_EXAMPLES[style];
    a.equal(!!example,!!family,style);
    if(!example)continue;
    const recipe=getSandwichRecipe(example.recipeId);
    a.ok(recipe,style);
    a.equal(recipe.familyId,family,style);
    a.ok(fs.existsSync(path.resolve(__dirname,'../public',recipe.image.slice(1))),style);
    if(family==='tartine')a.equal(example.kind,'tartine');
    if(['laffa','piadina'].includes(family))a.equal(example.kind,'wrap');
  }
});
