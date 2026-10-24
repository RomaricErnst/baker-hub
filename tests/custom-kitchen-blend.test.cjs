const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require('./load-production.cjs');
const {blendSuggestions}=require('../app/lib/blendSuggestions.ts');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function fn(name){let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);return ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;}
test('new Custom bake confirms kitchen even when profile supplies all equipment',()=>{
 const context={styleKey:'neapolitan',ovenType:'home_oven_standard',mixerType:'hand',customKitchenConfirmed:false,flourChosen:false,archivedFlourNames:[],isUnleavened:false,yeastType:'instant'};
 assert.equal(vm.runInNewContext(fn('firstIncompleteStep')+'firstIncompleteStep(true)',context),3);
 context.customKitchenConfirmed=true;
 assert.equal(vm.runInNewContext(fn('firstIncompleteStep')+'firstIncompleteStep(true)',context),6);
});
test('equipment leads to climate even with old high-water progress; climate confirmation is explicit',()=>{
 let next,confirmed=false;
 const context={styleKey:'neapolitan',customKitchenConfirmed:false,advancedHighestStep:10,CUSTOM_STEPS:[],flourChosen:false,archivedFlourNames:[],markStepSettled:()=>{},nextUnanswered:()=>6,setAdvancedStep:v=>next=v,setAdvancedHighestStep:()=>{},setCustomKitchenConfirmed:v=>confirmed=v,suppressNextScrollRef:{current:false},scrollToStepTop:()=>{}};
 vm.runInNewContext(fn('advanceAdv')+'advanceAdv(3)',context);assert.equal(next,4);assert.equal(confirmed,false);
 vm.runInNewContext(fn('advanceAdv')+'advanceAdv(4)',context);assert.equal(next,6);assert.equal(confirmed,true);
});
test('blend suggestions have a purpose, vary by style and do not strengthen already strong flour',()=>{
 const base={flour1:'pizza00',flour2:null,ratio1:100,w1:260};
 assert.ok(blendSuggestions('neapolitan',base).some(s=>s.id==='caputo_manitoba'));
 assert.ok(!blendSuggestions('neapolitan',{...base,w1:380}).some(s=>s.id==='caputo_manitoba'));
 assert.equal(blendSuggestions('batbout',base)[0].percent,33);
 assert.equal(blendSuggestions('baguette',base)[0].percent,5);
 assert.ok(blendSuggestions('pain_levain',base).some(s=>s.id==='celnat_seigle_t130'));
 assert.deepEqual(blendSuggestions('unknown',base),[]);
 assert.ok(!blendSuggestions('pain_levain',{...base,flour1:'rye'}).some(s=>s.id==='celnat_seigle_t130'));
});
test('flour editing identifies the target and cancellation does not commit a blend',()=>{
 const picker=fs.readFileSync('app/components/FlourPicker.tsx','utf8');
 for(const label of ['Change flour 1','Change flour 2','Choose flour 1','Choose flour ${blendSlot}','Flour 1 retained','Flour 2 retained'])assert.ok(picker.includes(label),label);
 assert.ok(picker.includes('const additionRatio = (id: string) => blend.flour2 ? blend.ratio1'));
 assert.ok(picker.includes('setPickerOpen(false);setRoad(null);'));
 assert.ok(picker.includes('name !== blend.brandProduct && name !== blend.customFlour2Name'));
});
