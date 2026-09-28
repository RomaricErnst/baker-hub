const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');

test('setup correction reaches quantity outside the compact Organisation step list',()=>{
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
 const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let handler;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='SetupBlockerAction')handler=node.getText(ast);ts.forEachChild(node,visit);}visit(ast);
 const context={React:{createElement:(type,props,...children)=>({type,props,children})},NEXT_CTA:{},stepAnswered:()=>true};
 vm.createContext(context);vm.runInContext(ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText,context);
 for(const target of [1,2,3,7]){
   let reached;const flow={locale:'fr',steps:[{id:3,group:'equipment'},{id:7,group:'plan'}],highestStep:99,generationBlocker:{stepId:target,reason:'Choix manquant',action:'Compléter'},onJump:id=>{reached=id;}};
   const rendered=context.SetupBlockerAction({flow});
   const button=rendered.children.find(child=>child?.type==='button');assert.ok(button);button.props.onClick();assert.equal(reached,target);
 }
});
