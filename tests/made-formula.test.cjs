const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {utils}=require('./load-production.cjs');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let helper;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='madeFormulaMatches')helper=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
const code=ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const H=3600000,start=new Date('2030-04-02T08:00Z'),bake=new Date('2030-04-03T10:00Z');
for(const styleKey of ['neapolitan','baguette','pan'])for(const method of ['none','poolish','biga'])test(`${styleKey} ${method}: remaining-time validation respects the weighed formula`,()=>{
 const context={mixExecution:undefined,calculateRecipe:utils.calculateRecipe,styleKey,ovenType:'home_oven_standard',numItems:4,itemWeight:260,kitchenTemp:22,humidity:'normal',fridgeTemp:5,yeastType:'instant',mixerType:'hand',manualHydration:undefined,manualOil:undefined,manualSugar:undefined,flourChosen:false,flourBlend:undefined,priorityOverride:undefined,prefermentFlourPct:20,manualSalt:undefined,targetDoughTemp:undefined,flourInFridge:false,wastePct:undefined,feedToMixH:undefined,measuredFlourTemp:undefined,measuredPrefermentTemp:undefined,totalFlourTarget:undefined};
 vm.createContext(context);vm.runInContext(code,context);
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand',styleKey,4);
 const hours=method==='biga'?48:method==='poolish'?18:0;
 const recipe=utils.calculateRecipe(styleKey,'home_oven_standard',4,260,22,'normal',schedule,5,'instant','custom','hand',undefined,undefined,undefined,undefined,method,undefined,20,undefined,undefined,false,undefined,method!=='none',undefined,hours||undefined);
 const fact={method,inFridge:method!=='none',recipe};
 assert.equal(context.madeFormulaMatches(fact,schedule,{prefHours:hours}),!recipe.protocolIssue);
 const shifted=utils.buildSchedule(start,new Date(+bake+12*H),[],22,45,'hand',styleKey,4);
 if(!recipe.protocolIssue&&styleKey!=='pan')assert.equal(context.madeFormulaMatches(fact,shifted,{prefHours:hours}),false,'a substantially different exposure cannot be green with old yeast');
 if(recipe.preferment){const wrongDose={...fact,recipe:{...recipe,preferment:{...recipe.preferment,prefYeastGrams:recipe.preferment.prefYeastGrams+1}}};assert.equal(context.madeFormulaMatches(wrongDose,schedule,{prefHours:hours}),false,'dose comparison applies even when the existing model clamps its recommendation');}
 assert.deepEqual(fact.recipe,recipe,'checking never changes the used ingredients');
});
