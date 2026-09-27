const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function component(file,name){const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const source=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(tree).replace(/^export /,'');return vm.runInNewContext(ts.transpileModule(source+'\n'+name,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText,{React});}
const Starter=component('app/components/RecipeOutput.tsx','StarterPrepCard');
const Repair=component('app/components/SchedulePicker.tsx','BatchRepairNotice');
test('recipe pairs canonical feed with dated peak after reload, ignoring historical scalar peak',()=>{
 for(const locale of ['fr','en']){
  const feed=new Date('2035-09-28T10:24:00Z'),peak=new Date('2035-09-28T19:14:00Z');
  const props={sourdough:{starterGramsMin:100,starterGramsMax:120},locale,feedRatio:2,feedTime:feed,starterPeakTime:new Date('2035-09-27T11:35:00Z'),mixingTime:peak,starterEvents:[{kind:'pre_mix',time:feed,bellPeakTime:peak}]};
  const html=renderToStaticMarkup(React.createElement(Starter,props));
  assert.doesNotMatch(html,/equal parts|parts égales|11:35/);assert.match(html,/1:2:2/);assert.match(html,locale==='fr'?/2 parts de farine/:/2 parts flour/);assert.match(html,/28/);assert.match(html,locale==='fr'?/Pic estimé de ce rafraîchi/:/Estimated peak of this feed/);assert.match(html,locale==='fr'?/Incorporer au pétrissage/:/Use when mixing/);
 }
});
test('small mixer repair gives capacity-safe quantity and invokes real quantity navigation',()=>{
 let clicked=0;
 for(const isFr of [true,false]){
  const props={isFr,numItems:24,itemWeight:260,mixerCapacityG:1000,onEditQuantity:()=>clicked++};
  const html=renderToStaticMarkup(React.createElement(Repair,props));assert.match(html,/3 (pièces|pieces)/);assert.match(html,/1000/);assert.match(html,isFr?/ne gère pas/:/does not support/);
  const element=Repair(props);const button=React.Children.toArray(element.props.children).find(c=>c.type==='button');button.props.onClick();
 }
 assert.equal(clicked,2);
});

test('capacity repair includes the mixing-loss allowance',()=>{
 const html=renderToStaticMarkup(React.createElement(Repair,{isFr:false,numItems:24,itemWeight:250,mixerCapacityG:1000,wastePct:5}));assert.match(html,/3 pieces/);assert.doesNotMatch(html,/4 pieces/);
});
