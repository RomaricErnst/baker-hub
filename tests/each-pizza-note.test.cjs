const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
const compile=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
require.extensions['.tsx']=compile;require.extensions['.ts']=compile;
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const picker=require('../app/components/PrototypeQuantityPicker.tsx');
const {eachPizzaNote,eachPizzaShort}=picker,Picker=picker.default;
const page=fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8');

test('a tray pizza says its dough weight and pan size, in both languages and units',()=>{
 assert.equal(eachPizzaNote({styleKey:'pan',itemWeight:600,units:'metric',locale:'en'}),'Each pizza: 600 g in a pan of about 25 × 35 cm');
 assert.equal(eachPizzaNote({styleKey:'pan',itemWeight:600,units:'metric',locale:'fr'}),'Chaque pizza : 600 g dans un moule d’environ 25 × 35 cm');
 assert.equal(eachPizzaNote({styleKey:'roman',itemWeight:700,units:'metric',locale:'fr'}),'Chaque pizza : 700 g sur une plaque d’environ 30 × 40 cm');
 const imperial=eachPizzaNote({styleKey:'pan',itemWeight:600,units:'imperial',locale:'en'});
 assert.match(imperial,/^Each pizza: 21\.2 oz in a pan of about 10 × 14 in$/);
});

test('a round pizza names the diameter its ball weight assumes, and nothing without one',()=>{
 assert.equal(eachPizzaNote({styleKey:'neapolitan',itemWeight:260,diameter:30,units:'metric',locale:'en'}),'Each pizza: 260 g for about 30 cm across');
 assert.equal(eachPizzaNote({styleKey:'neapolitan',itemWeight:260,diameter:30,units:'metric',locale:'fr'}),'Chaque pizza : 260 g pour environ 30 cm de diamètre');
 assert.match(eachPizzaNote({styleKey:'newyork',itemWeight:320,diameter:35,units:'imperial',locale:'en'}),/about 14 in across/);
 assert.equal(eachPizzaNote({styleKey:'neapolitan',itemWeight:260,units:'metric',locale:'en'}),null);
 assert.equal(eachPizzaNote({styleKey:'pan',itemWeight:0,units:'metric',locale:'en'}),null);
});

const render=props=>renderToStaticMarkup(React.createElement(Picker,{count:2,itemWeight:600,onCountChange(){},onItemWeightChange(){},...props}));

test('the quantity screen shows the note under the count, and Custom shows it under the tray weight',()=>{
 assert.match(render({bakeType:'pizza',styleKey:'pan',roundView:'count'}),/data-each-pizza[^>]*>Each pizza: 600 g in a pan of about 25 × 35 cm/);
 assert.match(render({bakeType:'pizza',styleKey:'roman',roundView:'size',itemWeight:700,locale:'fr'}),/data-each-pizza[^>]*>Chaque pizza : 700/);
 assert.match(render({bakeType:'pizza',styleKey:'neapolitan',roundPizza:true,roundView:'count',itemWeight:260,diameter:30,calculatedWeight:260}),/260 g for about 30 cm across/);
 // A weight the baker typed no longer matches a diameter, so none is claimed.
 assert.doesNotMatch(render({bakeType:'pizza',styleKey:'neapolitan',roundPizza:true,roundView:'count',itemWeight:300,diameter:30,calculatedWeight:260}),/data-each-pizza/);
 assert.doesNotMatch(render({bakeType:'bread',styleKey:'pain_campagne',roundView:'count'}),/data-each-pizza/);
});

test('the recipe card repeats what one pizza is, in the line under its title',()=>{
 assert.equal(eachPizzaShort({styleKey:'neapolitan',itemWeight:260,diameter:30,units:'metric',locale:'en'}),'260 g each, about 30 cm');
 assert.equal(eachPizzaShort({styleKey:'neapolitan',itemWeight:260,diameter:30,units:'metric',locale:'fr'}),'260\u202Fg chacune, environ 30 cm');
 assert.equal(eachPizzaShort({styleKey:'pan',itemWeight:600,units:'metric',locale:'en'}),'600 g each, in a pan of about 25 × 35 cm');
 assert.equal(eachPizzaShort({styleKey:'neapolitan',itemWeight:260,units:'metric',locale:'en'}),'260 g each');
 assert.equal(eachPizzaShort({styleKey:null,itemWeight:260,units:'metric',locale:'en'}),null);
 assert.match(page,/destination==='recipe'&&bakeType==='pizza'\?eachPizzaShort\(/);
 assert.match(page,/<PrototypeQuantityPicker [^>]*styleKey=\{styleKey \?\? undefined\}/);
});
