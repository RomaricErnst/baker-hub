const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const declaration=source.match(/const commercialPrefermentPlanReady =[\s\S]*?;/)[0];
function ready(tab,yeastType,prefermentType,prefermentValidity){return vm.runInNewContext(declaration+'\ncommercialPrefermentPlanReady',{tab,yeastType,prefermentType,prefermentValidity});}
test('only current validated commercial preferment permits generation, direct and levain remain available',()=>{
 for(const method of ['poolish','biga']){
  assert.equal(ready('custom','instant',method,{type:method,valid:false}),false);
  assert.equal(ready('custom','instant',method,{type:method,valid:true}),true);
  assert.equal(ready('custom','instant',method,{type:'none',valid:true}),false);
 }
 for(const [tab,yeast,method] of [['custom','instant','none'],['custom','sourdough','levain'],['simple','instant','poolish']])assert.equal(ready(tab,yeast,method,{type:'none',valid:false}),true);
});
test('direct generate call returns to planner when commercial preferment is invalid',()=>{
 const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='handleGenerate')handler=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
 const calls=[],context={styleKey:'neapolitan',commercialPrefermentPlanReady:false,scrollToStepTop(){}};
 for(const name of ['setActiveTab','setSetupOverview','setAdvancedStep'])context[name]=value=>calls.push([name,value]);
 vm.runInNewContext(ts.transpileModule(handler+'\nhandleGenerate()',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 assert.deepEqual(calls,[['setActiveTab','setup'],['setSetupOverview',false],['setAdvancedStep',9]]);
 // Evaluate the real button gate, independently of operand ordering. A
 // valid recipe must not bypass the current commercial-preferment check.
 const generateGate=source.match(/const canGenerate =[\s\S]*?;/)[0];
 for(const tab of ['simple','custom'])for(const commercialPrefermentPlanReady of [false,true])for(const protocolIssue of [undefined,'method','equipment','timing']){
  const allowed=vm.runInNewContext(generateGate+'\ncanGenerate',{tab,commercialPrefermentPlanReady,starterPlanReady:true,unsupportedEnrichedMethod:false,archivedFlourNames:[],simpleRequiredDone:true,customRequiredDone:true,recipe:{protocolIssue},advancedRecipe:{protocolIssue}});
  assert.equal(allowed,commercialPrefermentPlanReady && !protocolIssue,`${tab}: commercial=${commercialPrefermentPlanReady}, protocol=${protocolIssue}`);
 }
});

test('accepted schedule edits persist immediately; changed dates revoke restore exemption',()=>{
 assert.equal((source.match(/onChange=\{handleScheduleChange\}/g)||[]).length,2);
 const declaration=source.match(/const handleScheduleChange =[\s\S]*?\n  };/)[0];
 const compiled=ts.transpileModule(declaration+'\nhandleScheduleChange(st,et,bl,options)',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const restoredDate=new Date('2030-04-03T18:00Z');
 for(const changed of [false,true])for(const preservePlan of [false,true]){
  const clears=[],markers=[],saved=[];
  const context={sessionRestored:true,eatTime:restoredDate,et:new Date(+restoredDate+(changed?3600000:0)),st:new Date(),bl:[],options:{preservePlan},repairKey:()=> 'accepted-key',setAcceptedScheduleRepair:v=>markers.push(v),setSessionRestored:v=>clears.push(v),setStartTime:()=>{},setEatTime:()=>{},setBlocks:()=>{}};
  context.buildSessionPayload=overrides=>overrides;
  context.saveSession=value=>saved.push(value);
  vm.runInNewContext(compiled,context);
  assert.equal(saved.length,preservePlan?1:0);
  if(preservePlan){assert.equal(saved[0].startTime,+context.st);assert.equal(saved[0].eatTime,+context.et);}
  assert.equal(clears.length,changed?1:0);
  assert.deepEqual(markers,[preservePlan?'accepted-key':null]);
 }
 assert.equal((source.match(/savedPrefOffsetHours=\{prefOffsetH\}/g)||[]).length,2);
 assert.equal((source.match(/savedPrefGoesInFridge=\{prefGoesInFridge\}/g)||[]).length,2);
});


test('direct generate call sends unsupported bread protocols back to the relevant choice',()=>{
 const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='handleGenerate')handler=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
 const code=ts.transpileModule(handler+'\nhandleGenerate()',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 for(const tab of ['simple','custom'])for(const protocolIssue of ['equipment','method','timing']){
  const calls=[],context={tab,styleKey:'bagel',commercialPrefermentPlanReady:true,recipe:{protocolIssue},advancedRecipe:{protocolIssue},scrollToStepTop(){}};
  for(const name of ['setActiveTab','setSetupOverview','setActiveStep','setAdvancedStep'])context[name]=value=>calls.push([name,value]);
  vm.runInNewContext(code,context);
  const next=protocolIssue==='equipment'?3:protocolIssue==='timing'?(tab==='custom'?9:7):(tab==='custom'?7:6);
  assert.deepEqual(calls,[['setActiveTab','setup'],['setSetupOverview',false],[tab==='custom'?'setAdvancedStep':'setActiveStep',next]]);
 }
});

test('known peak timing conflict blocks both new and previously generated sourdough plans',()=>{
 const declaration=source.match(/const starterPlanReady =[\s\S]*?;/)[0];
 for(const recipeGenerated of [false,true]) for(const starterTimingValid of [false,true]) {
  assert.equal(vm.runInNewContext(declaration+'\nstarterPlanReady',{yeastType:'sourdough',recipeGenerated,starterTimingValid,starterEvents:[{kind:'known_peak'}]}),starterTimingValid);
 }
 const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='handleGenerate')handler=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
 const code=ts.transpileModule(handler+'\nhandleGenerate()',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 for(const recipeGenerated of [false,true]) {
  const calls=[],context={tab:'simple',styleKey:'pain_levain',commercialPrefermentPlanReady:true,recipe:{},yeastType:'sourdough',starterEqualWeightsConfirmed:true,starterTimingValid:false,recipeGenerated,starterEvents:[{kind:'known_peak'}],scrollToStepTop(){}};
  for(const name of ['setActiveTab','setSetupOverview','setActiveStep'])context[name]=value=>calls.push([name,value]);
  vm.runInNewContext(code,context);
  assert.deepEqual(calls,[['setActiveTab','setup'],['setSetupOverview',false],['setActiveStep',7]]);
 }
});
