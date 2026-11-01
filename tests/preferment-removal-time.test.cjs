const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='prefRemoveFromFridgeTime')declaration=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
function removal(prefGoesInFridge,warmup){
 const context={prefGoesInFridge,eatTime:new Date('2030-01-03T18:00Z'),startTime:new Date('2030-01-02T16:00Z'),schedule:{bulkFermStart:new Date('2030-01-02T16:45Z')},prefermentType:'poolish',styleKey:'neapolitan',kitchenTemp:24,fridgeTemp:4,mixerType:'hand',targetDoughTemp:24,prefermentFlourPct:50,numItems:4,itemWeight:260,manualHydration:62,flourInFridge:false,measuredFlourTemp:undefined,requiredPrefWarmupH:input=>{assert.equal(input.prefermentFlourPct,50);assert.equal(input.doughMassG,1040);assert.equal(input.hydrationPct,62);assert.equal(input.flourTempC,24);return warmup;},useMemo:fn=>fn()};
 vm.runInNewContext(ts.transpileModule('const '+declaration+'; result=prefRemoveFromFridgeTime;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return context.result;
}
test('preferment warmup finishes at mixing start, before mixing and autolyse duration',()=>{
 assert.equal(removal(true,2).toISOString(),'2030-01-02T14:00:00.000Z');
 assert.equal(removal(true,0).toISOString(),'2030-01-02T16:00:00.000Z');
 assert.equal(removal(false,2),null);
});
