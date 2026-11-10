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
 require('./load-production.cjs');
 const {formatBakeDateTime,cToDisplay,tempUnit}=require('../app/utils/units.ts');
 for(const [locale,expected] of [['fr','lun. 4 mars · 18h30'],['en','Mon 4 Mar · 6:30pm']]){
  const context={eatTime:new Date(2030,2,4,18,30),fr:locale==='fr',locale,formatBakeDateTime,cToDisplay,tempUnit,units:'metric',kitchenAnswered:false,isUnleavened:false,kitchenLabel:'',kitchenTemp:23,fridgeTemp:5};
  vm.runInNewContext(ts.transpileModule('const '+declaration('reviewTiming')+'; const '+declaration('reviewKitchen')+'; result=[reviewTiming,reviewKitchen];', {}).outputText,context);
  assert.equal(context.result[0],expected);
  assert.match(context.result[1],locale==='fr'?/réfrigérateur 5°C/i:/fridge 5°C/i);
 }
});
test('both review actions regenerate stale recipes and expose explicit edits; guide footer removed',()=>{
 assert.equal((source.match(/onBackToRecipe=\{finishSetupEdit\}/g)||[]).length,2);
 let handler;
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='finishSetupEdit')handler=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
 assert.ok(handler);
 for(const [recipeGenerated,protocolStale,fillingsReturn,expected] of [[false,false,null,'generate'],[true,true,null,'generate'],[true,false,{destination:'protocol'},'return'],[true,false,null,'recipe']]){
  const calls=[];
  const context={planReplanPending:false,replanReturn:null,tab:'simple',recipeGenerated,protocolStale,canGenerate:true,previousRecipeInputKey:{current:'current'},recipeInputKey:'current',fillingsReturn,handleGenerate(accepted){assert.equal(accepted,true);calls.push('generate');},setSetupOverview(value){assert.equal(value,false);},finishFillings(){calls.push('return');},openDestination(value){calls.push(value);}};
  vm.runInNewContext(ts.transpileModule(handler+';finishSetupEdit();',{}).outputText,context);
  assert.deepEqual(calls,[expected]);
 }
 assert.match(source,/Mettre à jour la recette/);assert.match(source,/aria-label=\{`\$\{fr \? 'Modifier' : 'Edit'\}/);
 assert.match(source,/prefermentFlourPct \?\? 20/);
 assert.doesNotMatch(source,/Share \+ party — end of the journey|← Recette|Voir ma recette/);
});

test('first recipe action uses the current locale when a restored starter event has an old label',()=>{
 require('./load-production.cjs');
 const {starterActionLabel}=require('../app/utils/starterBuild.ts');
 for(const [fr,expected] of [[true,'Rafraîchi avant pétrissage'],[false,'Pre-mix feed']]){
  const context={firstStarterAction:{kind:'pre_mix',label:'Pre-mix Feed'},fr,starterActionLabel};
  vm.runInNewContext(ts.transpileModule('const '+declaration('firstRecipeActionLabel')+';result=firstRecipeActionLabel;',{}).outputText,context);
  assert.equal(context.result,expected);
 }
});
