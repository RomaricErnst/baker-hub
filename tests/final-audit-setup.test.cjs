const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
require('./load-production.cjs');
const {findFixedBakeSchedule}=require('../app/utils/scheduleEdit.ts');
function functions(file,names){
 const source=fs.readFileSync(file,'utf8');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const declarations=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(tree).replace(/^export /,''));
 const code=ts.transpileModule(declarations.join('\n')+'\n({'+names.join(',')+'});',{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
 return vm.runInNewContext(code,{React,useRef:React.useRef,useLayoutEffect:React.useLayoutEffect,NEXT_CTA:{},useBottomNavHeight:()=>0,findFixedBakeSchedule});
}
const page=functions('app/[locale]/page.tsx',['SessionReplacementNotice','bakeQuantityLabel','eggShoppingLabel','StepActions','StepPage','stepAnswered']);
const schedule=functions('app/components/SchedulePicker.tsx',['StarterHydrationNotice','coldTimingMessage','findRequiredColdStart']);
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
test('anonymous local save is described distinctly from account history before replacement',()=>{
 for(const fr of [true,false]){
  const local=render(page.SessionReplacementNotice,{fr,localOnly:true});
  assert.match(local,fr?/conservée sur cet appareil/:/saved on this device/);
  assert.match(local,fr?/remplacera la reprise/:/replace the resume/);
  assert.match(local,fr?/dans votre compte/:/to your account/);
  assert.doesNotMatch(local,fr?/n.est pas enregistré/:/is not saved/);
  const unsaved=render(page.SessionReplacementNotice,{fr,localOnly:false});
  assert.match(unsaved,fr?/Conserver cette version/:/Keep this version/);
  assert.doesNotMatch(unsaved,fr?/n’est pas dans votre historique/:/not in your history/);
 }
});
test('incomplete current planning has no button looping back to itself; other gaps remain reachable',()=>{
 for(const locale of ['fr','en']){
  const steps=[{id:3,value:'Four',chip:'Equipment',group:'kitchen'},{id:7,value:null,chip:'Plan',group:'plan',gap:'Missing time'}];
  const flow={steps,activeId:7,highestStep:99,locale,showGenerate:false,recipeGenerated:false,gapReturn:false,onGapJump(){throw Error('Self navigation forbidden');}};
  const html=render(page.StepPage,{flow,id:7,children:'Clock fields'});
  assert.match(html,/disabled/);assert.doesNotMatch(html,/Plan →/);
  assert.match(html,locale==='fr'?/Choisissez un horaire de cuisson/:/Choose a cooking time/);
  let target;
  flow.steps=[{...steps[0],value:null},steps[1]];flow.onGapJump=id=>{target=id;};
  const element=page.StepPage({flow,id:7,children:'Clock fields'});
  const find=(node)=>{if(!node||typeof node!=='object')return; if(node.type==='button'&&node.props.children?.[0]==='Equipment')return node;for(const c of React.Children.toArray(node.props?.children)){const found=find(c);if(found)return found;}};
  const button=find(element);assert.ok(button);button.props.onClick();assert.equal(target,3);
 }
});
test('starter assumption is plain visible content before planning, in both languages',()=>{
 for(const isFr of [true,false]){
  const html=render(schedule.StarterHydrationNotice,{isFr});
  assert.match(html,isFr?/100 % d’hydratation/:/100% hydration/);
  assert.match(html,/1:1:1, 1:2:2/);
  assert.match(html,isFr?/ne sont pas prises en charge/:/are not supported/);
  assert.doesNotMatch(html,/<details|<summary|hidden/);
 }
});
test('cold timing reason quantifies missing fridge time and offers useful changes',()=>{
 for(const isFr of [true,false]){
  const text=schedule.coldTimingMessage({actualHours:2.5,requiredHours:8},isFr);
  assert.match(text,/150 min/);assert.match(text,/480 min/);
  assert.match(text,isFr?/Avancez le pétrissage ou repoussez la cuisson/:/Start mixing earlier or bake later/);
 }
});
test('piadina quantity stays contextual and egg purchases round up without altering weighed formula',()=>{
 assert.equal(page.bakeQuantityLabel(6,'bread','piadina',true),'6 piadinas');
 assert.equal(page.bakeQuantityLabel(1,'bread','piadina',false),'1 piadina');
 assert.equal(page.bakeQuantityLabel(1,'bread','baguette',false),'1 loaf');
 assert.match(page.eggShoppingLabel(151,true),/4 œufs/);
 assert.match(page.eggShoppingLabel(50,false),/1 egg at/);
 assert.match(page.eggShoppingLabel(151,false),/weigh, sizes vary/);
});

test('initial viennois recommendation reserves actual required cold time without moving bake or violating availability',()=>{
 const bake=new Date('2035-05-05T19:00:00Z'), now=+new Date('2035-05-04T12:00:00Z');
 const input={start:new Date(+bake-8*3600000),bake,from:new Date(+bake-12*3600000),to:new Date(+bake-4*3600000),now,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'stand',styleKey:'pain_viennois',numItems:1,mixingBatches:1};
 const result=schedule.findRequiredColdStart(input);
 assert.equal(result.found,true);assert.equal(+result.candidate.times.bake,+bake);
 assert.ok(+result.candidate.times.start < +input.start);
 assert.ok(result.candidate.schedule.totalColdHours>=3);
 assert.ok(!result.candidate.schedule.preparationInvalid);
 const blocked=schedule.findRequiredColdStart({...input,blocks:[{from:input.from,to:bake,label:'Away'}]});
 assert.equal(blocked.found,false);
});
