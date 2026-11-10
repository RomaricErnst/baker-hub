const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const {panPizzaGuide,panSizeCm,panSizeLabel,isPanPizzaStyle}=require('../app/utils/panPizza.ts');
const OVENS=['pizza_oven','home_oven_steel','home_oven_standard','electric_pizza',undefined];

function render(style,lang,extra={}){
 const start=new Date('2030-06-01T08:00Z'),bake=new Date('2030-06-01T18:00Z');
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand',style);
 const weight=extra.weight??600,count=extra.numItems??2;
 const base={schedule,mixerType:'hand',styleKey:style,kitchenTemp:22,numItems:count,oil:4,hydration:70,locale:lang,ovenType:'home_oven_standard',
  recipe:{totalDough:weight*count,flour:weight*count*0.57,water:weight*count*0.4,salt:7,oil:10,sugar:0,hydration:70,yeast:null,waterTemp:null}};
 const original=React.useState;let html='';
 for(let step=1;step<=10;step++){
  React.useState=initial=>original(initial===1?step:initial);
  try{html+=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:lang,messages:require('../messages/'+lang+'.json'),timeZone:'UTC'},React.createElement(Guide,{...base,...extra})));}
  finally{React.useState=original;}
 }
 return html;
}
const ROUND=/Tuck and drag|dough boxes|rough round|a good ball|Stretch dough on a floured surface|preheated tray|peel|grill\/broil|Bake 5–7 min|check from 8 min|launch|60–90 sec|serrez|Pelle|pelle|boules?\b/;

test('pan size follows the dough weight at a stated loading',()=>{
 assert.ok(isPanPizzaStyle('pan'));assert.ok(isPanPizzaStyle('roman'));assert.ok(!isPanPizzaStyle('neapolitan'));
 assert.deepEqual(panSizeCm('pan',600),[25,35]);
 assert.deepEqual(panSizeCm('roman',700),[30,40]);
 assert.equal(panSizeLabel('pan',600,'imperial'),'10 × 14 in');
 for(const weight of [300,450,600,900]){const [a,b]=panSizeCm('pan',weight);const loading=weight/(a*b);assert.ok(loading>0.58&&loading<0.76,weight+' g → '+loading);}
 assert.equal(panSizeCm('neapolitan',270),null);assert.equal(panSizeCm('pan',NaN),null);
 assert.equal(panPizzaGuide({styleKey:'neapolitan',pieceWeightG:270,count:4,units:'metric'}),null);
});

test('every oven gets in-pan steps with a temperature, a time and no round-pizza handling',()=>{
 for(const style of ['pan','roman'])for(const oven of OVENS)for(const lang of ['en','fr']){
  const guide=panPizzaGuide({styleKey:style,pieceWeightG:600,count:2,ovenType:oven,units:'metric'});
  const text=[...guide.shaping[lang],...guide.preheat[lang],...guide.bake[lang]].map(step=>step.bold+' '+step.note).join(' | ');
  assert.match(text,/\d{3}[ ]?°C/,style+' '+oven);
  assert.match(text,lang==='fr'?/\d+ à \d+ min/:/\d+–\d+ min/,style+' '+oven);
  assert.doesNotMatch(text,/undefined|NaN|\bpeel\b|\bpelle\b|launch|boule/,style+' '+oven);
  if(lang==='fr')assert.doesNotMatch(text,/\d°C|'/);
 }
 const unknown=panPizzaGuide({styleKey:'pan',pieceWeightG:NaN,count:2,units:'metric'});
 assert.doesNotMatch(JSON.stringify(unknown),/NaN/);
});

test('pan guide renders pan shaping and pan baking instead of round-ball steps',()=>{
 for(const oven of ['home_oven_standard','home_oven_steel','pizza_oven','electric_pizza']){
  const en=render('pan','en',{ovenType:oven});
  assert.match(en,/Divide and press into the pans/,oven);
  assert.match(en,/Oil the pan generously, corners included/,oven);
  assert.match(en,/a pan of about 25 × 35 cm for 600 g of dough/,oven);
  assert.match(en,/rest 10 min, then press again/,oven);
  assert.match(en,/let the dough rise in the pan until puffy/,oven);
  assert.match(en,/cheese right to the edges/,oven);
  assert.match(en,/Lift a corner with a spatula/,oven);
  assert.match(en,/Rest 2 min, then slide the pizza out of the pan/,oven);
  const steps=en.replace(/<details[\s\S]*?<\/details>/g,'');
  assert.doesNotMatch(steps,ROUND,oven);
  assert.doesNotMatch(en,/Pan pizza: press dough directly|no launching needed|Deep Dish/,oven);
 }
 assert.match(render('pan','en'),/lowest rack and bake 12–15 min/);
 assert.match(render('pan','en',{units:'imperial'}),/about 480°F/);
 assert.match(render('pan','en',{units:'imperial'}),/10 × 14 in/);
 // Imperial bakers read every weight in ounces, including the piece weight.
 assert.match(render('pan','en',{units:'imperial'}),/about 21\.2 oz each\)/);
 assert.match(render('pan','en',{units:'imperial'}),/for 21\.2 oz of dough/);
 assert.doesNotMatch(render('pan','en',{units:'imperial'}),/\b600 g\b/);
 assert.match(render('pan','en',{numItems:1}),/Press the dough into the pan/);
});

test('Roman teglia uses the same in-pan flow, with French tray wording',()=>{
 const fr=render('roman','fr',{weight:700,numItems:1});
 assert.match(fr,/Étaler la pâte sur la plaque/);
 assert.match(fr,/une plaque d’environ 30 × 40 cm pour 700\u202fg de pâte/);
 assert.match(fr,/Préchauffez le four à environ 250 °C/);
 assert.match(fr,/12 à 15 min/);
 const steps=fr.replace(/<details[\s\S]*?<\/details>/g,'');
 assert.doesNotMatch(steps,ROUND);
 const en=render('roman','en',{weight:700,numItems:1});
 assert.doesNotMatch(en.replace(/<details[\s\S]*?<\/details>/g,''),ROUND);
 // Round styles keep their own steps.
 assert.match(render('neapolitan','en',{weight:270,numItems:4}),/Tuck and drag/);
});
