const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleUnderTest={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/toppingTypes.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:moduleUnderTest,exports:moduleUnderTest.exports,require});
const {filterPizzas,pizzaHasQuickToppings,filterPizzasByCourse,DEFAULT_FILTER}=moduleUnderTest.exports;
const pizza=(changes={})=>({id:'a',category:'classic',name:{en:'Cheese',fr:'Fromage'},occasion:['quick'],prepMinutes:5,ingredients:[],season:['all'],dietary:[],wine:[],...changes});
test('Quick excludes advance work and long prep while retaining short assembly',()=>{
 assert.equal(pizzaHasQuickToppings(pizza()),true);
 for(const change of [{prepMinutes:11},{prepMinutes:undefined},{ingredients:[{id:'grilled_chicken'}]},{ingredients:[{id:'x',prepNote:{en:'Cook 8–15 min'}}]},{ingredients:[{id:'x',prepNoteByStyle:{pan:{en:'Rest',timing:20}}}]}])assert.equal(pizzaHasQuickToppings(pizza(change),'pan'),false);
 assert.equal(filterPizzas([pizza({prepMinutes:20})],{...DEFAULT_FILTER,occasion:['quick']}).length,0);
 assert.equal(filterPizzas([pizza({prepMinutes:20,occasion:['quick','party']})],{...DEFAULT_FILTER,occasion:['quick','party']}).length,1,'other occasions retain OR');
});
test('custom desserts are isolated from savoury facets without mutating saved choices',()=>{
 const choices={...DEFAULT_FILTER,base:'tomato',ingredientChips:['mozzarella']};
 const sweet=pizza({id:'sweet',category:'dessert',base:'cream',compatibleStyles:['pan']});
 const savoury=pizza({id:'salt',base:'tomato',ingredients:[{name:{en:'mozzarella',fr:'mozzarella'}}]});
 assert.equal(filterPizzasByCourse([sweet,savoury],'sweet',choices,'pan')[0].id,'sweet');
 assert.equal(filterPizzasByCourse([sweet,savoury],'sweet',choices,'newyork').length,0,'style compatibility remains');
 assert.equal(filterPizzasByCourse([sweet,savoury],'savoury',choices)[0].id,'salt');
 assert.equal(choices.base,'tomato');assert.deepEqual(choices.ingredientChips,['mozzarella']);
});
test('actual preparation and baking screens expose audited order; dessert has one discovery entry',()=>{
 for(const name of ['PrepTab','BakeTab'])assert.match(fs.readFileSync(`app/components/pizzaParty/${name}.tsx`,'utf8'),/preparationSequence/);
 const selector=fs.readFileSync('app/components/ToppingSelector.tsx','utf8');
 assert.doesNotMatch(selector,/[sS]etDessertSheetOpen|dessertSheetOpen|Sweet finish\?|partyComplete/);
 assert.match(selector,/filterPizzasByCourse\(customPizzas/);
 assert.match(selector,/onPillChange\('shopping'\)/);
 assert.match(selector,/Review selection/);
 const action=selector.slice(selector.indexOf('<div data-companion-action style={{'));
 assert.match(action,/position:\s*'fixed',\s*bottom:\s*0/);
 assert.match(action,/padding:.*env\(safe-area-inset-bottom/);
});

test('catalogue, preview and bake use approved base photos without legacy variants',()=>{
 for(const file of ['app/components/ToppingSelector.tsx','app/components/pizzaParty/BakeTab.tsx']){
 const source=fs.readFileSync(file,'utf8');assert.match(source,/approvedPizzaImage/);assert.doesNotMatch(source,/variantMap|\$\{pizzaId\}_pan\.webp|\$\{pizza.id\}\$\{suffix\}/);
 }
});
