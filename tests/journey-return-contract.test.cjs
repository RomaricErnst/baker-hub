const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function all(predicate){const found=[];function visit(node){if(predicate(node))found.push(node);ts.forEachChild(node,visit);}visit(tree);return found;}
function evaluate(code,context={}){return vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);}
function fn(name){const node=all(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name)[0];assert.ok(node,`Missing handler ${name}`);return node.getText(tree);}

test('quantity backward action returns generated edits to choices, but first creation to style',()=>{
 const button=all(n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(tree)==='button'&&n.getText(tree).includes('Back to my choices')&&n.getText(tree).includes('backToSetupChoices'))[0];
 assert.ok(button);
 const handler=button.openingElement.attributes.properties.find(p=>p.name?.getText(tree)==='onClick').initializer.expression;
 for(const recipeGenerated of [false,true]){
  const calls=[];
  const context={recipeGenerated,backToSetupChoices(){calls.push('choices');},setBatchView(value){calls.push(value);},scrollToStepTop(){calls.push('top');}};
  evaluate(`(${handler.getText(tree)})();`,context);
  assert.deepEqual(calls,recipeGenerated?['choices']:['style','top']);
 }
 const calls=[];
 evaluate(fn('backToSetupChoices')+';backToSetupChoices();',{setSetupOverview(value){calls.push(['overview',value]);},setActiveTab(value){calls.push(['route',value]);},setNavHidden(value){calls.push(['navHidden',value]);},scrollToStepTop(){calls.push(['top']);}});
 assert.deepEqual(calls,[['overview',true],['route','setup'],['navHidden',false],['top']]);
});

test('finishing changed setup delegates validation without returning early; unchanged setup restores its origin',()=>{
 for(const recipeGenerated of [false,true])for(const protocolStale of [false,true])for(const destination of [null,'recipe','shopping','protocol','service']){
  const calls=[];
  evaluate(fn('finishSetupEdit')+';finishSetupEdit();',{recipeGenerated,protocolStale,canGenerate:true,fillingsReturn:destination?{destination}:null,handleGenerate(){calls.push('validate');},setSetupOverview(value){calls.push(['overview',value]);},finishFillings(){calls.push(destination);},openDestination(value){calls.push(value);}});
  assert.deepEqual(calls,!recipeGenerated||protocolStale?['validate']:[['overview',false],destination||'recipe']);
 }
});

test('an explicitly returned clean but invalid generated edit remains pending and cannot bypass validation',()=>{
 for(const destination of [null,'recipe','shopping','protocol','service']){
  const calls=[];
  evaluate(fn('finishSetupEdit')+';finishSetupEdit();',{recipeGenerated:true,protocolStale:false,canGenerate:false,fillingsReturn:destination?{destination}:null,setProtocolStale(value){calls.push(['stale',value]);},handleGenerate(){calls.push('validate');},setSetupOverview(){throw Error('Invalid return cannot dismiss editing');},finishFillings(){throw Error('Invalid return cannot restore output');},openDestination(){throw Error('Invalid return cannot restore output');}});
  assert.deepEqual(calls,[['stale',true],'validate']);
 }
});

test('starter user choices change the recipe key, while planner outputs and readiness do not',()=>{
 const node=all(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='recipeInputKey')[0];
 const expression=node.initializer.getText(tree);
 const names=new Set();
 function visit(n){if(ts.isIdentifier(n))names.add(n.text);ts.forEachChild(n,visit);}visit(node.initializer);
 const context=Object.fromEntries([...names].filter(n=>!['JSON','stringify','getTime'].includes(n)).map(n=>[n,null]));
 const baseline=evaluate(expression,context);
 for(const name of ['starterState','starterLocation','planningMode','lastFedTime','knownPeakTime','hasNotFedYet','lastFedAge','lastFeedRatio','nextFeedRatioOverride','ratioMode','tang']){
  const changed={...context,[name]:name.endsWith('Time')?new Date('2026-10-01T08:00:00Z'):'user change'};
  assert.notEqual(evaluate(expression,changed),baseline,`${name} must invalidate the recipe`);
 }
 for(const name of ['nextFeedRatio','starterEvents','starterPeakTime','starterTimingValid','scheduleCandidateValid']){
  assert.equal(names.has(name),false,`${name} is a planner output, not a user input`);
  assert.equal(evaluate(expression,{...context,[name]:'planner initialization'}),baseline);
 }
});

test('the complete local resume handler never overwrites restored pending validation with false',()=>{
 const restore=all(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='applySession')[0];
 const assignments=[];
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='setProtocolStale')assignments.push(n.arguments[0].getText(tree));ts.forEachChild(n,visit);}visit(restore);
 assert.deepEqual(assignments,['session.protocolStale === true'],'Later generated-session or cleanup branches must not clear a saved pending edit');
 for(const protocolStale of [true,false,undefined])assert.equal(evaluate(assignments[0],{session:{protocolStale}}),protocolStale===true);
});

test('the first input edit after generation marks the recipe stale; mounting and restoration do not',()=>{
 const effect=all(n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='useEffect'&&n.arguments[0]?.getText(tree).includes('previousRecipeInputKey.current !== recipeInputKey'))[0];
 assert.ok(effect,'Input comparison effect must exist');
 const callback=effect.arguments[0].getText(tree);
 const calls=[];
 const context={previousRecipeInputKey:{current:'generated'},recipeInputKey:'generated',recipeGenerated:true,isRestoringRef:{current:false},setProtocolStale(value){calls.push(value);}};
 evaluate(`(${callback})();`,context);assert.deepEqual(calls,[]);
 context.recipeInputKey='first quantity edit';
 evaluate(`(${callback})();`,context);assert.deepEqual(calls,[true]);
 context.isRestoringRef.current=true;context.recipeInputKey='restored inputs';
 evaluate(`(${callback})();`,context);assert.deepEqual(calls,[true]);
 assert.equal(context.previousRecipeInputKey.current,'restored inputs');
 context.isRestoringRef.current=false;
 evaluate(`(${callback})();`,context);assert.deepEqual(calls,[true]);
 context.recipeGenerated=false;context.recipeInputKey='new draft';
 evaluate(`(${callback})();`,context);assert.deepEqual(calls,[true]);
 assert.doesNotMatch(source,/justGeneratedRef/,'No skip flag may swallow the first actual edit');
});

test('stale status is serialized and restored locally and from saved snapshots, while rebaking resets it',()=>{
 const payload=all(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='buildSessionPayload')[0];
 const returnObject=payload.body.statements.find(ts.isReturnStatement).expression;
 const property=returnObject.properties.find(p=>p.name?.getText(tree)==='protocolStale');
 assert.ok(property,'Session payload must persist stale status');
 const restorers=all(n=>ts.isCallExpression(n)&&n.expression.getText(tree)==='setProtocolStale'&&/session\.protocolStale|snap\.protocolStale/.test(n.arguments[0]?.getText(tree)||''));
 assert.equal(restorers.length,2);
 for(const stale of [true,false,undefined]){
  const saved=evaluate(`({${property.getText(tree)}})`,{protocolStale:stale===true});
  assert.equal(saved.protocolStale,stale===true);
  for(const restorer of restorers){
   const usesSnapshot=restorer.arguments[0].getText(tree).includes('snap.');
   for(const rb of usesSnapshot?[false,true]:[false]){
    let restored;
    evaluate(restorer.getText(tree),{session:{protocolStale:stale},snap:{protocolStale:stale},rb,setProtocolStale(value){restored=value;}});
    assert.equal(restored,!rb&&stale===true);
   }
  }
 }
});

test('stale generated output is hidden consistently across recipe, shopping, preparation and service',()=>{
 const gates=all(n=>ts.isJsxAttribute(n)&&n.name.getText(tree)==='hidden'&&n.initializer?.getText(tree).includes('protocolStale'));
 const gate=gates.find(n=>n.initializer.getText(tree).includes("'service'"));
 assert.ok(gate,'A common downstream-output gate is required');
 const expression=gate.initializer.expression.getText(tree);
 for(const recipeGenerated of [false,true])for(const protocolStale of [false,true])for(const destination of ['batch','organisation','recipe','shopping','protocol','service']){
  const hidden=evaluate(expression,{recipeGenerated,protocolStale,destination});
  assert.equal(hidden,recipeGenerated&&protocolStale&&['recipe','shopping','protocol','service'].includes(destination),`${destination}/${recipeGenerated}/${protocolStale}`);
 }
 assert.match(source,/Choices changed · recipe needs review/);
 assert.match(source,/Vos choix sont conservés/);
});

test('failed schedule validation cannot clear stale state or return to executable preparation',()=>{
 const calls=[];
 evaluate(fn('handleGenerate')+';handleGenerate();',{canGenerate:true,styleKey:'neapolitan',scheduleCandidateValid:false,tab:'simple',setActiveTab(value){calls.push(['route',value]);},setSetupOverview(value){calls.push(['overview',value]);},setActiveStep(value){calls.push(['step',value]);},scrollToStepTop(){calls.push(['top']);},setProtocolStale(){throw Error('Invalid schedule must remain stale');},finishFillings(){throw Error('Invalid schedule must not return');}});
 assert.deepEqual(calls,[['route','setup'],['overview',false],['step',7],['top']]);
});

test('successful validation clears stale status and restores the captured edit origin',()=>{
 for(const destination of [null,'recipe','shopping','protocol','service']){
  const calls=[];
  const context={flourChosen:false,canGenerate:true,styleKey:'neapolitan',scheduleCandidateValid:true,scheduleEditing:false,schedule:{},commercialPrefermentPlanReady:true,tab:'simple',recipe:{},yeastType:'instant',unsupportedEnrichedMethod:false,recipeGenerated:true,user:null,prefermentType:'none',previousRecipeInputKey:{current:'old'},recipeInputKey:'updated',fillingsReturn:destination?{destination,view:'dough'}:null,
   setSessionSaved(){},setSetupOverview(){},setReviewMode(){},setShowResults(){},setRecipeGenerated(value){calls.push(['generated',value]);},setProtocolStale(value){calls.push(['stale',value]);},finishFillings(){calls.push(['return',destination]);},setActiveTab(value){calls.push(['route',value]);},scrollToStepTop(){}};
  evaluate(fn('handleGenerate')+';handleGenerate();',context);
  assert.deepEqual(calls,[['generated',true],['stale',false],destination?['return',destination]:['route','plan']]);
  assert.equal(context.previousRecipeInputKey.current,'updated');
 }
});

test('the shared generation gate sends blocked edits to the exact correction without publishing results',()=>{
 for(const tab of ['simple','custom'])for(const stepId of [undefined,2,3,6,7,9]){
  const calls=[];
  evaluate(fn('handleGenerate')+';handleGenerate();',{styleKey:'neapolitan',canGenerate:false,tab,generationBlocker:stepId===undefined?undefined:{stepId},openSetupStep(value){calls.push(value);},setProtocolStale(){throw Error('Blocked edits must remain stale');},setRecipeGenerated(){throw Error('Blocked edits must not publish');},finishFillings(){throw Error('Blocked edits must not return');}});
  assert.deepEqual(calls,[stepId??(tab==='custom'?9:7)]);
 }
});
