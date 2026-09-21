const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function fn(name){let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);assert.ok(found,name);return found;}
function run(name,chosen,archived=[]){
 const calls=[];
 const context={styleKey:'neapolitan',commercialPrefermentPlanReady:true,tab:'custom',flourChosen:chosen,archivedFlourNames:archived,CUSTOM_STEPS:[],advancedHighestStep:6,suppressNextScrollRef:{current:false},nextUnanswered:()=>7,scrollToStepTop:()=>calls.push(['scroll'])};
 for(const setter of ['setFlourChosen','setQtyChosen','setPrefermentChosen','setAdvancedStep','setAdvancedHighestStep','setActiveTab','setSetupOverview'])context[setter]=v=>calls.push([setter,v]);
 const code=ts.transpileModule(fn('markStepSettled')+'\n'+fn(name)+`\n${name}(6)`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,context);return calls;
}
test('Continue never silently adopts the initial generic flour',()=>{
 assert.deepEqual(run('advanceAdv',false),[]);
 const accepted=run('advanceAdv',true);
 assert.ok(accepted.some(([name,value])=>name==='setAdvancedStep'&&value===7));
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
