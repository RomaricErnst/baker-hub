// Final text pass: units, step wording, naming and shopping hints in the guide and recipe.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const {guideWeightText,leanBreadPreheatMin}=require('../app/utils/leanBreadBake.ts');
const {planActionLabel}=require('../app/utils/planCalendar.ts');

// Renders every step of the guide (each step is opened in turn).
function guide(style,lang,{mixer='hand',oven='home_oven_standard',numItems=2,weight=600,yeast='instant',units='metric',hours=26,temp=22,extra={}}={}){
 const start=new Date('2030-06-01T08:00Z'),bake=new Date(+start+hours*3600000);
 const schedule=utils.buildSchedule(start,bake,[],temp,45,mixer,style,numItems,1,yeast==='sourdough');
 const recipe=utils.calculateRecipe(style,oven,numItems,weight,temp,'normal',schedule,6,yeast,'custom',mixer);
 const props={schedule,recipe,mixerType:mixer,styleKey:style,kitchenTemp:temp,numItems,oil:recipe.oil>0?1:0,hydration:recipe.hydration??65,ovenType:oven,locale:lang,units,...extra};
 const original=React.useState;let html='';
 for(let step=1;step<=14;step++){
  React.useState=initial=>original(initial===1?step:initial);
  try{html+=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:lang,messages:require('../messages/'+lang+'.json'),timeZone:'UTC'},React.createElement(Guide,props)));}
  finally{React.useState=original;}
 }
 return {html,text:html.replace(/<[^>]+>/g,' ').replace(/&#x27;/g,'\'').replace(/&amp;/g,'&').replace(/\s+/g,' '),schedule,recipe};
}

test('guide weights follow the unit system; small weights and metric text keep grams',()=>{
 assert.equal(guideWeightText('divide it into 2 equal pieces (about 600 g each)','imperial'),'divide it into 2 equal pieces (about 21.2 oz each)');
 assert.equal(guideWeightText('Within ±10g nobody will notice','imperial'),'Within ±0.4 oz nobody will notice');
 assert.equal(guideWeightText('±5 g is invisible','imperial','fr'),'±0,2 oz is invisible');
 assert.equal(guideWeightText('20–30 min for 60–100 g buns','imperial'),'20–30 min for 2.1–3.5 oz buns');
 assert.equal(guideWeightText('0.52 g of yeast','imperial'),'0.52 g of yeast');
 assert.equal(guideWeightText('2160g in total, ±10g','metric'),'2,160 g in total, ±10 g');
 assert.equal(guideWeightText('1.5 kg, 5 mm deep','imperial'),'1.5 kg, 5 mm deep');
 const pizza=guide('neapolitan','en',{numItems:4,weight:260,units:'imperial'}).text;
 assert.match(pizza,/about 9\.2 oz each/);
 assert.match(pizza,/Within ±0\.4 oz nobody will notice/);
 assert.match(pizza,/±0\.2 oz is invisible/);
 assert.doesNotMatch(pizza,/\b260 g\b|±10 ?g|±5 g/);
 const brioche=guide('brioche','en',{numItems:2,weight:500,units:'imperial',oven:'standard_bread'}).text;
 assert.match(brioche,/2 pieces of 17\.6 oz/);
 assert.doesNotMatch(brioche,/\b500 g\b/);
});

test('one piece is never "divided into 1 pieces"',()=>{
 for(const style of ['brioche','bagel','focaccia']){
  const en=guide(style,'en',{numItems:1,weight:600,oven:'standard_bread'}).text, fr=guide(style,'fr',{numItems:1,weight:600,oven:'standard_bread'}).text;
  assert.doesNotMatch(en,/Adjust this bread/,style);
  assert.doesNotMatch(en,/\b1 pieces|\b1 rectangles/,style);
  assert.doesNotMatch(fr,/en 1 pâtons|1 rectangles/,style);
 }
});

test('lean breads preheat 30 min with a tray and 45 min with a stone, steel or pot',()=>{
 assert.equal(leanBreadPreheatMin('pain_campagne','standard_bread',20),30);
 assert.equal(leanBreadPreheatMin('baguette','home_oven_stone_bread',45),45);
 assert.equal(leanBreadPreheatMin('pain_levain','dutch_oven',45),45);
 assert.equal(leanBreadPreheatMin('fougasse','dutch_oven',45),30,'fougasse bakes on its tray even with a pot chosen');
 assert.equal(leanBreadPreheatMin('brioche','standard_bread',20),20,'enriched breads keep their own preheat');
 const text=guide('pain_campagne','en',{numItems:1,weight:800,oven:'standard_bread',extra:{}}).text;
 assert.match(text,/allow 30 min; the hot tray colours the base/);
 assert.doesNotMatch(text,/20–30 min; the hot tray/);
});

test('pan pizza calendar shaping event uses the guide step name',()=>{
 assert.equal(planActionLabel('divide',false,{styleKey:'pan',count:2}),'Divide and press into the pans');
 assert.equal(planActionLabel('divide',true,{styleKey:'roman',count:1}),'Étaler la pâte sur la plaque');
 assert.equal(planActionLabel('divide',false,{styleKey:'neapolitan',count:4}),'Divide and shape');
});

module.exports={guide};
