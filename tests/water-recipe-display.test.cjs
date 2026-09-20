const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,require:p=>p==='../utils/units'?load('app/utils/units.ts'):require(p)});return m.exports;}
test('recipe premelt details distinguish source from prepared water and expose no settings controls',()=>{
 const Water=load('app/components/WaterPreparation.tsx').default;
 for(const locale of ['en','fr']){
 const html=renderToStaticMarkup(React.createElement(Water,{waterGrams:300,targetTemp:8,kitchenTemp:30,fridgeTemp:4,locale,readOnly:true}));
 a.match(html,/30/);a.match(html,/8/);a.match(html,/300/);a.match(html,locale==='fr'?/Après fonte complète/:/After melting completely/);a.doesNotMatch(html,/<input|<select|<button/);
 }
});
test('recipe direct ice is labelled and unmet target remains visible',()=>{
 const Water=load('app/components/WaterPreparation.tsx').default;
 const base={waterGrams:300,targetTemp:8,kitchenTemp:30,fridgeTemp:4,locale:'en',readOnly:true};
 a.match(renderToStaticMarkup(React.createElement(Water,{...base,waterMethod:'direct',directIceSupported:true,spiralIceConfirmed:true,idealWaterTemp:-5})),/Ice added in the mixer/);
 a.match(renderToStaticMarkup(React.createElement(Water,{...base,idealWaterTemp:-5})),/cannot reach the dough target/);
});
