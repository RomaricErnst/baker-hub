const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const tree=ts.createSourceFile('page.tsx',fs.readFileSync('app/[locale]/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let declaration;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='saveCurrentSession')declaration=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);
const code=ts.transpileModule(declaration.replace("await import('../lib/supabase/saveBakeEvent')",'cloud'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function setup({fail=false,anonymous=false}={}){
 let release;const pending=new Promise(r=>release=r);const payload={styleKey:'neapolitan',resultNotes:'Good crust'};
 const state={sessionSaved:true,cloudSaveState:'idle'};
 const context={cloudSaveInFlight:{current:false},savedCloudIdRef:{current:null},latestSessionPayloadRef:{current:JSON.stringify(payload)},buildSessionPayload:()=>payload,pizzaPartyGetQtysRef:{current:()=>({})},pizzaPartyQtys:{},saveSession:()=>true,user:anonymous?null:{id:'u'},bakeEventId:'existing',styleKey:'neapolitan',cloud:{updateBakeEvent:async()=>{await pending;return !fail;}},sessionLabel:()=> '4 pizzas',setTimeout(){},stashAuthIntent:v=>state.intent=v,window:{dispatchEvent:()=>state.authOpened=true},Event:class{},console:{error(){}}};
 for(const name of ['SessionSaved','CloudSaveState','BakeEventId','SavedToCloudName'])context['set'+name]=v=>{state[name[0].toLowerCase()+name.slice(1)]=v;};
 vm.createContext(context);vm.runInContext(code,context);return {state,context,release};
}
test('account save is pending until cloud confirms and fails honestly',async()=>{
 for(const fail of [false,true]){const c=setup({fail});const request=c.context.saveCurrentSession();assert.equal(c.state.sessionSaved,false);assert.equal(c.state.cloudSaveState,'saving');assert.equal(await c.context.saveCurrentSession(),false,'concurrent save does not create another request');c.release();assert.equal(await request,!fail);assert.equal(c.state.sessionSaved,!fail);assert.equal(c.state.cloudSaveState,fail?'failed':'idle');assert.equal(c.context.cloudSaveInFlight.current,false);}
});
test('edits during saving are not marked saved by the older response',async()=>{
 const c=setup();const request=c.context.saveCurrentSession();c.context.latestSessionPayloadRef.current='changed recipe';c.release();assert.equal(await request,false);assert.equal(c.state.sessionSaved,false);
});
test('anonymous save preserves local draft and opens account flow without claiming cloud success',async()=>{
 const c=setup({anonymous:true});assert.equal(await c.context.saveCurrentSession(),false);assert.equal(c.state.sessionSaved,true);assert.equal(c.state.cloudSaveState,'idle');assert.equal(c.state.intent,'save');assert.equal(c.state.authOpened,true);assert.equal(c.context.savedCloudIdRef.current,null);
});

test('sign-in replay saves once and preserves a failed cloud save',async()=>{
 let replay;
 function find(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='useEffect'&&n.arguments[0]?.getText(tree).includes('const intent = readAuthIntent()'))replay=n.arguments[0].getText(tree);ts.forEachChild(n,find);}find(tree);
 assert.ok(replay);
 for(const intent of ['save','share']){
  const state={status:'idle',saves:0,shares:0};
  const save=async()=>{state.saves++;state.status='failed';return false;};
  const c={user:{id:'u'},replayedRef:{current:false},restoreSettledRef:{current:true},readAuthIntent:()=>intent,clearAuthIntent(){},setShowWelcomeBack(){},setCloudResume(){},setShowSignInForSave(){},setCloudSaveState:s=>state.status=s,saveCurrentSessionRef:{current:save},shareCurrentSessionRef:{current:async()=>{state.shares++;await save();}},console};
  vm.createContext(c);vm.runInContext(ts.transpileModule(`(${replay})();`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,c);
  await new Promise(r=>setImmediate(r));
  assert.equal(state.saves,1);assert.equal(state.shares,intent==='share'?1:0);assert.equal(state.status,'failed');
 }
});
