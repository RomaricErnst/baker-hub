const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
require('./load-production.cjs');
const {getSetupBlocker}=require('../app/lib/setupBlocker.ts');
const valid={custom:true,fr:true,unsupportedMixer:false,unsupportedMethod:false,sourdough:false,hasPreferment:false,prefermentPlanReady:true,starterPlanReady:true,archivedFlour:false,requirementsComplete:true};

test('each protocol-only blocker directs completed setup to the relevant correction',()=>{
  assert.equal(getSetupBlocker(valid),undefined);
  for(const custom of [false,true]){
    const cases=[
      [{protocolIssue:'equipment'},3],
      [{protocolIssue:'method',unsupportedMixer:true},3],
      [{protocolIssue:'timing'},custom?9:7],
      [{protocolIssue:'method',sourdough:true},custom?7:6],
      [{unsupportedMethod:true,hasPreferment:true},custom?8:6],
      [{prefermentPlanReady:false},custom?9:7],
      [{starterPlanReady:false,sourdough:true},custom?9:7],
      [{requirementsComplete:false,missingRequiredStep:2},2],
    ];
    for(const [patch,stepId] of cases) for(const fr of [false,true]) {
      const result=getSetupBlocker({...valid,custom,fr,...patch});
      assert.equal(result.stepId,stepId,JSON.stringify(patch));
      assert.ok(result.reason&&result.action);
    }
  }
  assert.equal(getSetupBlocker({...valid,archivedFlour:true}).stepId,6);
});

// Exercise the actual page components, isolating only unrelated page state.
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['SetupBlockerAction','StepPage','SetupReview','stepAnswered'];
const declarations=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(tree));
const compiled=ts.transpileModule(declarations.join('\n')+'\n({SetupBlockerAction,StepPage,SetupReview});',{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const components=vm.runInNewContext(compiled,{React,NEXT_CTA:{},useBottomNavHeight:()=>64});
const steps=[{id:1,value:'Pain au levain',chip:'Style',gap:'Style requis'},{id:9,value:'Demain',chip:'Plan',group:'plan',gap:'Plan requis'},{id:10,value:'75%',chip:'Peaufiner',prefilled:true,gap:'Pâte requise'}];
function flow(patch={}){return {steps,activeId:10,highestStep:99,locale:'fr',showGenerate:false,recipeGenerated:false,gapReturn:false,generationBlocker:getSetupBlocker({...valid,sourdough:true,starterPlanReady:false}),onJump(){},onGenerate(){throw Error('Must not generate');},...patch};}

test('fine-tune and review retain a visible correction when every displayed value is filled',()=>{
  const current=flow();
  const final=renderToStaticMarkup(React.createElement(components.StepPage,{flow:current,id:10},'Réglages'));
  const review=renderToStaticMarkup(React.createElement(components.SetupReview,{flow:current,onJump(){},onBackToRecipe(){throw Error('Must not generate');}}));
  for(const html of [final,review]) {
    assert.match(html,/Le planning du levain reste à compléter/);
    assert.match(html,/Compléter le plan/);
    assert.doesNotMatch(html,/Créer la recette/);
  }
  let target;
  const action=components.SetupBlockerAction({flow:current,onJump:id=>{target=id;}});
  const button=React.Children.toArray(action.props.children).find(child=>child.type==='button');
  button.props.onClick();
  assert.equal(target,9);
});

test('unclassified final-step failure still opens a concrete step instead of an empty or looping review',()=>{
  const current=flow({generationBlocker:undefined});
  const html=renderToStaticMarkup(React.createElement(components.StepPage,{flow:current,id:10}));
  assert.match(html,/Revoir le plan/);
  let target;
  const action=components.SetupBlockerAction({flow:current,onJump:id=>{target=id;}});
  React.Children.toArray(action.props.children).find(child=>child.type==='button').props.onClick();
  assert.equal(target,9);
});

test('valid setup keeps its existing review action',()=>{
  const html=renderToStaticMarkup(React.createElement(components.StepPage,{flow:flow({showGenerate:true,generationBlocker:undefined,generateLabel:'Vérifier mes choix'}),id:10}));
  assert.match(html,/Vérifier mes choix/);
  assert.doesNotMatch(html,/Compléter le plan|Revoir le plan/);
});
