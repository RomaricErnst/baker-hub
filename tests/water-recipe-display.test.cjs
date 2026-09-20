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
test('clipped water exposes the achieved dough temperature and a feasible intervention in both locales',()=>{
 const Water=load('app/components/WaterPreparation.tsx').default;
 const base={waterGrams:600,targetTemp:2,kitchenTemp:38,fridgeTemp:4,source:'room',readOnly:true,idealWaterTemp:-.4,targetDoughTemp:23,achievedDoughTempC:24.4,waterWasClamped:true};
 const en=renderToStaticMarkup(React.createElement(Water,{...base,locale:'en'}));
 a.match(en,/Predicted after mixing: 24°C vs 23°C target \(\+1\.4 °C\)/);
 a.match(en,/Chill the flour before mixing or use direct ice with a compatible mixer/);
 const fr=renderToStaticMarkup(React.createElement(Water,{...base,locale:'fr'}));
 a.match(fr,/Après pétrissage prévu : 24°C au lieu de 23°C \(\+1\.4 °C\)/);
 a.match(fr,/Refroidissez la farine avant le mélange ou utilisez la glace directe/);
});
test('direct ice clears the clipped-water warning when it can reach the ideal target',()=>{
 const Water=load('app/components/WaterPreparation.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Water,{waterGrams:600,targetTemp:2,kitchenTemp:30,fridgeTemp:4,locale:'en',readOnly:true,waterMethod:'direct',directIceSupported:true,spiralIceConfirmed:true,idealWaterTemp:-5,targetDoughTemp:23,achievedDoughTempC:24,waterWasClamped:true}));
 a.match(html,/Ice added in the mixer/);
 a.doesNotMatch(html,/Predicted after mixing/);
});
