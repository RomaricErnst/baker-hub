const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {utils}=require('./load-production.cjs');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let formula,keyExpression;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='recipe'&&ts.isCallExpression(n.initializer))formula=n.initializer.arguments[0].getText(tree);if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='recipeInputKey')keyExpression=n.initializer.getText(tree);ts.forEachChild(n,visit);}visit(tree);
const calculate=ts.transpileModule('('+formula+')()', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(overrides={}){return {calculateRecipe:utils.calculateRecipe,styleKey:'neapolitan',ovenType:'home_oven_standard',numItems:4,itemWeight:260,kitchenTemp:24,humidity:'normal',fridgeTemp:5,yeastType:'instant',mixerType:'hand',schedule:utils.buildSchedule(new Date('2026-10-05T07:00Z'),new Date('2026-10-05T20:00Z'),[],24,30,'hand','neapolitan',4,1),manualHydration:undefined,manualOil:undefined,manualSugar:undefined,manualSalt:undefined,targetDoughTemp:undefined,flourChosen:false,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:undefined,prefOffsetH:0,priorityOverride:null,flourInFridge:false,wastePct:undefined,prefGoesInFridge:false,feedToMixH:undefined,measuredFlourTemp:undefined,measuredPrefermentTemp:undefined,totalFlourTarget:undefined,...overrides};}
function run(c){return JSON.parse(JSON.stringify(vm.runInNewContext(calculate,c)));}
test('fresh simple defaults remain identical to historical baseline, including batbout flour fallback',()=>{
 for(const styleKey of ['neapolitan','batbout']){const c=fixture({styleKey});const expected=utils.calculateRecipe(c.styleKey,c.ovenType,c.numItems,c.itemWeight,c.kitchenTemp,c.humidity,c.schedule,c.fridgeTemp,c.yeastType,'simple',c.mixerType);assert.deepEqual(run(c),JSON.parse(JSON.stringify(expected)));}
});
test('explicit flour and formula, poolish/biga storage and duration survive both views and serialized reload',()=>{
 for(const prefermentType of ['poolish','biga']){
  const c=fixture({tab:'custom',flourChosen:true,flourBlend:{flour1:'bread',flour2:null,ratio1:100},manualHydration:72,manualSalt:2.7,manualOil:1,manualSugar:1,targetDoughTemp:24,wastePct:3,prefermentType,prefermentFlourPct:25,prefOffsetH:16,prefGoesInFridge:true});
  const before=run(c);assert.ok(before.preferment);assert.equal(before.hydration,72);
  const persisted=JSON.parse(JSON.stringify({...c,tab:'simple'}));const resumed=fixture({...persisted,schedule:c.schedule});assert.deepEqual(run(resumed),before);assert.deepEqual(run({...resumed,tab:'custom'}),before);
 }
});
test('mode-only changes are not recipe invalidation inputs and both outputs share the canonical result',()=>{
 assert.doesNotMatch(keyExpression,/\btab\b/);assert.match(source,/const advancedRecipe = recipe;/);assert.doesNotMatch(source,/customOnlyStateRef/);
});
