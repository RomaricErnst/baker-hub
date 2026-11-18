const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function fn(name){let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);assert.ok(found,name);return found;}
function run(name,chosen,archived=[]){
 const calls=[];
 const context={canGenerate:true,styleKey:'neapolitan',schedule:undefined,scheduleCandidateValid:true,scheduleEditing:false,commercialPrefermentPlanReady:true,advancedRecipe:null,recipe:null,tab:'custom',flourChosen:chosen,flourAnswered:chosen,archivedFlourNames:archived,CUSTOM_STEPS:[{id:6},{id:8}],advancedHighestStep:6,suppressNextScrollRef:{current:false},nextUnanswered:()=>7,scrollToStepTop:()=>calls.push(['scroll'])};
 for(const setter of ['setTab','setFlourChosen','setQtyChosen','setPrefermentChosen','setAdvancedStep','setAdvancedHighestStep','setActiveTab','setSetupOverview'])context[setter]=v=>calls.push([setter,v]);
 const code=ts.transpileModule(fn('nextCustomStep')+'\n'+fn('markStepSettled')+'\n'+fn(name)+`\n${name}(6)`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,context);return calls;
}
test('Continue never silently adopts the initial generic flour',()=>{
 assert.deepEqual(run('advanceAdv',false),[]);
 const accepted=run('advanceAdv',true);
 assert.ok(accepted.some(([name,value])=>name==='setAdvancedStep'&&value===8));
 assert.ok(!accepted.some(([name])=>name==='setFlourChosen'));
 assert.deepEqual(run('advanceAdv',true,['Archived flour']),[]);
});
test('direct generation from review returns to flour until explicitly selected',()=>{
 for(const [chosen,archived] of [[false,[]],[true,['Archived flour']]]){
  const calls=run('handleGenerate',chosen,archived);
  assert.ok(calls.some(([name,value])=>name==='setAdvancedStep'&&value===6));
  assert.ok(calls.some(([name,value])=>name==='setActiveTab'&&value==='setup'));
  assert.ok(!calls.some(([name])=>name==='setFlourChosen'));
 }
});
test('Customize after a Simple recipe keeps that recipe\'s flour as the answer: Update recipe does not ask for a flour (18 Nov 2026 round 4)',()=>{
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
 // The answer is a confirmed setting the Customize switch sets; the recipe still reads flourChosen (same numbers).
 assert.match(source,/const flourAnswered = flourChosen \|\| confirmed\('flour','recipe'\);/);
 assert.match(source,/if\(!flourChosen\)confirmSetting\('flour','recipe'\)/);
 assert.equal(fn('handleGenerate').match(/tab === 'custom' && !(\w+)/)[1],'flourAnswered');
 const calls=run('handleGenerate',false);
 assert.ok(calls.some(([name,value])=>name==='setAdvancedStep'&&value===6),'without the answer, Flour is asked');
});
