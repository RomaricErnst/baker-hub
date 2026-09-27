const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function fn(name){let found;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found);return ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;}
function setup(){const state={sessionRestored:true,prefermentType:'biga',yeastType:'instant',prefermentValidity:{type:'biga',valid:true}};for(const key of ['sessionRestored','prefermentType','yeastType','prefermentValidity','prefermentChosen'])state['set'+key[0].toUpperCase()+key.slice(1)]=v=>state[key]=v;vm.createContext(state);vm.runInContext(fn('choosePreferment')+fn('chooseYeast'),state);return state;}
test('method round trip cannot reuse a saved plan or previous approval',()=>{
 const state=setup();vm.runInContext("choosePreferment('poolish'); choosePreferment('biga');",state);
 assert.equal(state.sessionRestored,false);assert.equal(state.prefermentValidity.type,'biga');assert.equal(state.prefermentValidity.valid,false);
});
test('same method preserves resume; yeast transitions revoke it',()=>{
 const state=setup();vm.runInContext("choosePreferment('biga'); chooseYeast('instant');",state);assert.equal(state.sessionRestored,true);assert.equal(state.prefermentValidity.valid,true);
 for(const [before,after] of [['instant','sourdough'],['sourdough','instant']]){const s=setup();s.yeastType=before;vm.runInContext(`chooseYeast('${after}');`,s);assert.equal(s.sessionRestored,false);assert.equal(s.prefermentValidity.valid,false);}
});
