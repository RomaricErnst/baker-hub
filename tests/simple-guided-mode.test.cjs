const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {data}=require('./load-production.cjs');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const tree=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let modeFunction;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='chooseMode')modeFunction=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
const compiled=ts.transpileModule(modeFunction,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
function choose(overrides={},key='simple'){
 const writes={};const context={tab:'custom',styleKey:'pain_levain',yeastType:'sourdough',bakeType:'bread',ovenType:null,mixerType:null,flourBlend:{flour1:'bread'},manualHydration:70,manualOil:0,manualSugar:0,prefermentType:'none',prefermentFlourPct:20,customOnlyStateRef:{current:null},suppressNextScrollRef:{current:false},ALL_STYLES:data.ALL_STYLES,getBreadProtocol:()=>undefined,firstIncompleteStep:()=>7,...overrides};
 for(const name of [...modeFunction.matchAll(/\b(set\w+)\(/g)].map(m=>m[1]))context[name]=v=>{writes[name]=typeof v==='function'?v(3):v;};
 vm.runInNewContext(compiled+'\nchooseMode("'+key+'");',context);return {writes,context};
}
test('Simple keeps sourdough/style, confirms supported household defaults and preserves temperature',()=>{
 const {writes}=choose();assert.equal(writes.setTab,'simple');assert.equal(writes.setActiveStep,3);assert.equal(writes.setOvenType,'standard_bread');assert.equal(writes.setMixerType,'hand');assert.ok(!('setStyleKey' in writes));assert.ok(!('setYeastType' in writes));assert.ok(!('setKitchenTemp' in writes));
});
test('Simple preserves saved equipment and declines unsupported defaults',()=>{
 let result=choose({ovenType:'dutch_oven',mixerType:'spiral'}).writes;assert.ok(!('setOvenType' in result));assert.ok(!('setMixerType' in result));
 result=choose({getBreadProtocol:()=>({equipment:['wood_fired'],supportedMixers:['stand'],cooking:'oven'})}).writes;assert.ok(!('setOvenType' in result));assert.ok(!('setMixerType' in result));
 result=choose({getBreadProtocol:()=>({equipment:['griddle'],supportedMixers:['hand'],cooking:'griddle'})}).writes;assert.equal(result.setOvenType,'griddle');
});
test('Custom gets no new equipment defaults and restores custom controls',()=>{
 const {writes}=choose({tab:'simple'},'custom');assert.equal(writes.setAdvancedStep,7);assert.ok(!('setOvenType' in writes));assert.ok(!('setMixerType' in writes));assert.equal(writes.setManualHydration,data.ALL_STYLES.pain_levain.hydration);
});
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function loadComponent(file,stubs={}){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:id=>stubs[id]??require(id)});return exports.default;
}
test('Simple climate puts fridge and technical settings behind a closed disclosure while retaining saved temperatures',()=>{
 const Climate=loadComponent('app/components/ClimatePicker.tsx',{'next-intl':{useLocale:()=> 'en'},'../utils/units':require('../app/utils/units.ts')});
 const props={kitchenTemp:31,fridgeTemp:5,humidity:'humid',onChange(){},onFlourInFridgeChange(){}};
 const simple=renderToStaticMarkup(React.createElement(Climate,{...props,mode:'simple'}));
 const custom=renderToStaticMarkup(React.createElement(Climate,{...props,mode:'custom'}));
 assert.match(simple,/value="31"/);assert.match(simple,/<details><summary[^>]*>Advanced settings · fridge and flour<\/summary><section>/);assert.doesNotMatch(simple,/<details open/);
 assert.match(simple,/Why this temperature/);assert.doesNotMatch(custom,/Advanced settings · fridge and flour|Why this temperature/);assert.match(custom,/Fridge temperature/);assert.match(custom,/Usual flour-storage humidity/);
});
