const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {data}=require('./load-production.cjs');
const source=fs.readFileSync('app/components/FlourPicker.tsx','utf8');
const tree=ts.createSourceFile('picker.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='assignBlendFlour')handler=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
function choose(blend,slot,key,w,sourceKind='exact'){
 let result;const context={blend,blendSlot:slot,blendRatio:blend.ratio1,blendRatio2:blend.ratio2??10,flourEngineW:entry=>entry.w,onBlendChange:value=>result=value,entry:{id:sourceKind==='manual'?'manual-2':'product',w,wPublished:true,protein:12},key,sourceKind};
 for(const name of new Set(handler.match(/\bset[A-Z]\w*/g)))context[name]=()=>{};
 vm.runInNewContext(ts.transpileModule(handler+'\nassignBlendFlour(entry,key,"Chosen flour",blend.flour2 ? blend.ratio1 : 85,sourceKind)',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return result;
}
test('shared catalogue assigns second and third slots without changing flour type or double blending W',()=>{
 const base={flour1:'pizza00',flour2:null,ratio1:100,w1:280,w1Source:'exact'};
 const second=choose(base,2,'rye',160);assert.equal(second.flour2,'rye');assert.equal(second.ratio1,85);assert.equal(second.w1,280);assert.equal(second.w2,160);
 const third=choose(second,3,'wholemeal',190);assert.equal(third.flour2,'rye');assert.equal(third.flour3,'wholemeal');assert.equal(third.ratio1+third.ratio2+(100-third.ratio1-third.ratio2),100);
 const replaced=choose({...third,ratio1:70,ratio2:20},3,'semolina',200);assert.equal(replaced.ratio1,70);assert.equal(replaced.ratio2,20);assert.equal(replaced.w3,200);
 assert.equal(data.computeBlendProfile(replaced).blendedW,248);
});
test('manual addition retains explicit type, W provenance and protein through saved blend',()=>{
 const second=choose({flour1:'pizza00',flour2:null,ratio1:100,w1:280},2,'rye',310,'manual');
 const saved=JSON.parse(JSON.stringify(second));assert.equal(saved.flour2,'rye');assert.equal(saved.w2Source,'manual');assert.equal(saved.manualFlour2.protein,12);assert.equal(saved.manualFlour2.type,'rye');
});
test('first and additional flour routes use identical catalogue and selected product cards',()=>{
 assert.equal((source.match(/<FlourCatalogueBrowser\b/g)||[]).length,2);
 assert.match(source,/<FlourProductButton entry=\{blendSelectedF2\} selected/);
 assert.match(source,/<FlourProductButton entry=\{blendSelectedF3\} selected/);
 assert.ok(!source.includes('Popular with {styleKey'));
});
