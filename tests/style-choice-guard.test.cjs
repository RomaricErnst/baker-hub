const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function fn(name){let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found);return ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;}
test('both Continue handlers leave an unset style untouched',()=>{
 for(const name of ['advance','advanceAdv'])vm.runInNewContext(fn(name)+`; ${name}(1);`,{styleKey:null});
});
test('generation without a style returns to explicit choice in both modes',()=>{
 for(const tab of ['simple','custom']){
  const calls=[],context={styleKey:null,tab,scrollToStepTop(){}};
  for(const name of ['setActiveTab','setBatchView','setSetupOverview','setActiveStep','setAdvancedStep'])context[name]=v=>calls.push([name,v]);
  vm.runInNewContext(fn('handleGenerate')+';handleGenerate();',context);
  assert.deepEqual(calls,[['setActiveTab','batch'],['setBatchView','style'],['setSetupOverview',false],[tab==='custom'?'setAdvancedStep':'setActiveStep',1]]);
 }
});
test('empty style has disabled Continue; selected card has a visible bilingual cue',()=>{
 assert.match(source,/if \(id === 1 && !step.value\)/);
 assert.match(source,/<button disabled style=/);
 assert.match(source,/if \(advancedStep === 1 && !styleKey\) return;/);
 assert.match(source,/if \(activeStep === 1 && !styleKey\) return;/);
 const picker=fs.readFileSync('app/components/StylePicker.tsx','utf8');
 assert.match(picker,/Sélectionné/);assert.match(picker,/Selected/);assert.match(picker,/✓/);
});
