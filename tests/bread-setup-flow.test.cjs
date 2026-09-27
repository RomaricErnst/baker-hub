const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {data}=require('./load-production.cjs');
const {getBreadProtocol}=require('../app/utils/breadProfiles.ts');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const wanted=new Set(['compactPiadina','enrichedDirectOnly','directMethodOnly','showPrefermentChoice','SIMPLE_STEPS','CUSTOM_STEPS']),pieces=[];
function visit(node){
 if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&wanted.has(node.name.text))pieces.push('const '+node.getText(tree)+';');
 if(ts.isFunctionDeclaration(node)&&['nextUnanswered','stepAnswered'].includes(node.name?.text))pieces.push(node.getText(tree));
 ts.forEachChild(node,visit);
}visit(tree);
const compiled=ts.transpileModule(pieces.join('\n')+'\n({simple:SIMPLE_STEPS,custom:CUSTOM_STEPS,nextUnanswered})',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function model(isUnleavened,styleKey=isUnleavened?'piadina':'baguette'){ 
 return vm.runInNewContext(compiled,{isUnleavened,fr:false,styleKey,tab:'simple',breadProtocol:getBreadProtocol(styleKey),styleDisplayName:key=>key,qtyChosen:true,numItems:4,itemWeight:140,ovenType:isUnleavened?'griddle':'standard_bread',mixerType:'hand',ovenDisplayName:'Equipment',localName:o=>o?.name??null,MIXER_TYPES:data.MIXER_TYPES,profileFields:new Set(),kitchenTemp:22,HUMIDITY_LABEL:{normal:'normal'},humidity:'normal',yeastType:'instant',enrichedDirectOnly:false,YEAST_TYPES:data.YEAST_TYPES,t:key=>key,bakeType:'bread',eatTime:null,startTime:new Date(),formatTime:()=>'',locale:'en',blocks:[],flourChosen:false,archivedFlourNames:[],flourSummary:()=>'',prefermentChosen:true,prefermentType:'none',PREFERMENT_TYPES:data.PREFERMENT_TYPES,manualHydration:undefined,advancedRecipe:null,ALL_STYLES:data.ALL_STYLES});
}
test('unleavened Simple and Custom setup skip yeast/preferment without breaking forward navigation',()=>{
 const {simple,custom,nextUnanswered}=model(true);
 assert.deepEqual(Array.from(simple,s=>s.id),[1,2,3,7]);
 assert.deepEqual(Array.from(custom,s=>s.id),[1,2,3,4,6,9,10]);
 assert.equal(nextUnanswered(simple,3,4),7);
 assert.equal(nextUnanswered(custom,4,5),6); // flour remains an explicit Custom choice
 const flourConfirmed=custom.map(s=>s.id===6?{...s,value:'chosen wheat flour'}:s);
 assert.equal(nextUnanswered(flourConfirmed,6,7),9); // straight to rest/cook, no hidden method gap
});
test('yeasted bread retains yeast and preferment setup pages',()=>{
 const {simple,custom}=model(false);
 assert.ok(simple.some(s=>s.id===6));assert.ok(custom.some(s=>s.id===7));assert.ok(custom.some(s=>s.id===8));
});

test('fixed direct formulas remove the method from progress, review and both navigation directions',()=>{
 for(const style of ['brioche','pain_viennois','bagel','pita','greek_pita','kebab_bread','batbout','laffa','pan_bagnat']){
  const {custom,nextUnanswered}=model(false,style);
  assert.deepEqual(Array.from(custom,s=>s.id),[1,2,3,4,6,7,9,10],style);
  assert.equal(nextUnanswered(custom,7,7),9,style+' forward');
  assert.equal(custom[custom.findIndex(s=>s.id===9)-1].id,7,style+' back');
 }
 for(const style of ['baguette','focaccia','ciabatta','panuozzo','neapolitan'])assert.ok(model(false,style).custom.some(s=>s.id===8),style+' keeps real choice');
});

test('early baking preference invalidates acceptance without pretending a plan is ready',()=>{
 let handler;
 function find(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='chooseEarlyBakeTime')handler=node.getText(tree);ts.forEachChild(node,find);}find(tree);
 assert.ok(handler);const state={};
 const context=vm.createContext(Object.fromEntries(['EatTime','SessionRestored','ScheduleReady','ScheduleCandidateValid','AcceptedScheduleRepair'].map(name=>['set'+name,value=>{state[name]=value;}])));
 vm.runInContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 context.chooseEarlyBakeTime('2026-10-01T19:30');
 assert.equal(state.EatTime.getHours(),19);assert.equal(state.EatTime.getMinutes(),30);
 assert.equal(state.ScheduleReady,false);assert.equal(state.ScheduleCandidateValid,false);assert.equal(state.AcceptedScheduleRepair,null);
 const prior=state.EatTime;context.chooseEarlyBakeTime('not-a-date');assert.equal(state.EatTime,prior);
 context.chooseEarlyBakeTime('');assert.equal(state.EatTime,null);
});
