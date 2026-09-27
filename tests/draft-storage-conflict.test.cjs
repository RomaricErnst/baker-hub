const test = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {createDraftStorage} = require('../app/lib/draftStorage.ts');
function storage() {
 const data = new Map();
 return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
test('late debounce and pagehide from an older tab cannot replace a newer draft',()=>{
 const disk=storage(); disk.setItem('draft','original'); let conflicts=0;
 const older=createDraftStorage(disk,'draft',()=>conflicts++);
 const newer=createDraftStorage(disk,'draft');
 assert.equal(newer.write('new bake'),true);
 assert.equal(older.write('stale debounce'),false);
 assert.equal(older.write('stale pagehide'),false);
 assert.equal(older.clear(),false);
 assert.equal(disk.getItem('draft'),'new bake'); assert.equal(conflicts,1);
});
test('reading a conflict does not silently claim it; explicit resume permits saving',()=>{
 const disk=storage();const a=createDraftStorage(disk,'draft'),b=createDraftStorage(disk,'draft');
 b.write('new choice');assert.equal(a.read(),'new choice');
 assert.equal(a.write('stale choice'),false);
 a.acceptCurrent();assert.equal(a.write('explicitly resumed choice'),true);
 assert.equal(b.write('other stale choice'),false);
});
test('explicit new bake clears only its owned draft and invalidates older tabs',()=>{
 const disk=storage();disk.setItem('draft','old bake');
 const a=createDraftStorage(disk,'draft'),b=createDraftStorage(disk,'draft');
 assert.equal(a.clear(),true);assert.equal(b.write('resurrect old bake'),false);
 assert.equal(a.write('new bake'),true);assert.equal(disk.getItem('draft'),'new bake');
});
test('browsing and cancelled replacement leave local draft intact',()=>{
 const disk=storage();disk.setItem('draft','saved work');
 const browsing=createDraftStorage(disk,'draft');
 assert.equal(browsing.read(),'saved work');assert.equal(disk.getItem('draft'),'saved work');
});

test('actual dismissed resume handler still requires consent before a new family',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
 const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=new Set(['answerWelcomeBack','confirmLocalReplacement','selectBakeType']);const functions=[];
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name&&names.has(node.name.text))functions.push(node.getText(ast));ts.forEachChild(node,visit);}visit(ast);
 const saved={bakeType:'bread',styleKey:'pain_levain'};let prompts=0,claims=0;
 const state={pendingSession:saved,bakeType:null,fr:true,window:{confirm(){prompts++;return false;}},sessionStorage:{setItem(){}},
  loadSession:()=>saved,acceptCurrentSessionStorage(){claims++;},setPendingSession(value){state.pendingSession=value;},setShowWelcomeBack(){},setLocalSaveConflict(){}};
 const code=ts.transpileModule(functions.join('\n')+'\nanswerWelcomeBack();selectBakeType("pizza");',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,state);
 assert.equal(state.pendingSession,null,'dismiss has cleared the UI offer');
 assert.equal(prompts,1,'persisted work still needs one replacement confirmation');
 assert.equal(claims,0,'declining must not claim or replace storage');
 assert.equal(saved.styleKey,'pain_levain');
});
