const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function declaration(name){let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found);return found;}
test('summary reports each chosen flour with its actual two or three slot ratio',()=>{
 const context={flourBlend:{flour1:'one',flour2:'two',flour3:'three',ratio1:70,ratio2:20,brandProduct:'First brand',customFlour2Name:'Second brand',customFlour3Name:'Third brand'},FLOUR_DATA:{one:{name:'Generic'},two:{name:'Second'},three:{name:'Third'}},localName:x=>x.name};
 const code=ts.transpileModule('const '+declaration('flourSummary')+'; result=flourSummary();', {}).outputText;
 vm.runInNewContext(code,context);assert.equal(context.result,'70% First brand + 20% Second brand + 10% Third brand');
 context.flourBlend.flour3=null;vm.runInNewContext('{'+code+'}',context);assert.equal(context.result,'70% First brand + 30% Second brand');
});
test('review includes calendar date and fridge temperature without changing stored values',()=>{
 const context={eatTime:new Date(2030,2,4,18,30),fr:true,kitchenTemp:23,fridgeTemp:5};
 vm.runInNewContext(ts.transpileModule('const '+declaration('reviewTiming')+'; const '+declaration('reviewKitchen')+'; result=[reviewTiming,reviewKitchen];', {}).outputText,context);
 assert.match(context.result[0],/4 mars 2030/);assert.match(context.result[0],/18:30/);assert.equal(context.result[1],'23°C · réfrigérateur 5°C');
});
test('both review actions regenerate stale recipes and expose explicit edits; guide footer removed',()=>{
 assert.equal((source.match(/onBackToRecipe=\{finishSetupEdit\}/g)||[]).length,2);
 let handler;
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='finishSetupEdit')handler=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
 assert.ok(handler);
 for(const [recipeGenerated,protocolStale,fillingsReturn,expected] of [[false,false,null,'generate'],[true,true,null,'generate'],[true,false,{destination:'protocol'},'return'],[true,false,null,'recipe']]){
  const calls=[];
  const context={recipeGenerated,protocolStale,fillingsReturn,handleGenerate(){calls.push('generate');},setSetupOverview(value){assert.equal(value,false);},finishFillings(){calls.push('return');},openDestination(value){calls.push(value);}};
  vm.runInNewContext(ts.transpileModule(handler+';finishSetupEdit();',{}).outputText,context);
  assert.deepEqual(calls,[expected]);
 }
 assert.match(source,/Mettre à jour la recette/);assert.match(source,/aria-label=\{`\$\{fr \? 'Modifier' : 'Edit'\}/);
 assert.match(source,/prefermentFlourPct \?\? 20/);
 assert.doesNotMatch(source,/Share \+ party — end of the journey|← Recette|Voir ma recette/);
});
