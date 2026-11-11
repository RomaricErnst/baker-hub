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

test('sourdough mixing reads as one sequence with each rest at its clock time and water in grams',()=>{
 const {text,schedule}=guide('pain_levain','fr',{mixer:'stand',oven:'dutch_oven',numItems:1,weight:800,yeast:'sourdough',hours:30});
 const finish=schedule.availabilityActions.find(a=>a.id==='mix-finish');
 assert.ok(finish,'the schedule reserves a rest after the first mix');
 const mix=text.slice(text.indexOf('Que faire'),text.indexOf('Prêt quand'));
 assert.match(mix,/Mélangez la farine avec \d+ g de l’eau préparée ; réservez les \d+ g restants\. Couvrez et laissez reposer jusqu’à \d+h\d{2}\./);
 assert.match(mix,/À \d+h\d{2}, ajoutez le levain mûr et le sel/);
 assert.match(mix,new RegExp(`Couvrez et laissez reposer 30 min ; reprenez le pétrissage à ${utils.formatTime(finish.at,'fr').split(' ').pop()}`));
 assert.equal((mix.match(/levain mûr et le sel/g)||[]).length,1,'starter and salt are added once');
 assert.doesNotMatch(mix,/90 ?%|Puis ajoutez/);
 const en=guide('pain_levain','en',{mixer:'stand',oven:'dutch_oven',numItems:1,weight:800,yeast:'sourdough',hours:30}).text;
 assert.match(en,/Mix the flour with \d+ g of the prepared water; keep the other \d+ g back\. Cover and rest until/);
 assert.match(en,/Cover and rest 30 min; resume kneading at \d/);
 // A yeasted autolyse states its end time too.
 const yeasted=guide('pain_campagne','en',{mixer:'hand',oven:'dutch_oven',numItems:1,weight:800,hours:20}).text;
 assert.match(yeasted,/Cover and rest 30 min, until \d{1,2}:\d{2}(am|pm)\./);
 assert.ok(yeasted.indexOf('Cover and rest 30 min')<yeasted.indexOf('Add the yeast and salt'));
});

test('round pizza bake: target diameter for the style, one pizza at a time in a home oven',()=>{
 const en=guide('neapolitan','en',{numItems:4,weight:260,extra:{pizzaDiameterCm:30}}).text;
 assert.match(en,/about 30 cm across for a classic Neapolitan; keep the shape/);
 assert.match(en,/Bake one pizza at a time, about 8–12 min each/);
 const fr=guide('newyork','fr',{numItems:3,weight:320,oven:'home_oven_steel',extra:{pizzaDiameterCm:40}}).text;
 assert.match(fr,/environ 40 cm de diamètre pour une pizza new-yorkaise/);
 assert.match(fr,/Cuisez une pizza à la fois, environ 5 à 7 min chacune/);
 const imperial=guide('neapolitan','en',{numItems:4,weight:260,oven:'pizza_oven',units:'imperial',extra:{pizzaDiameterCm:30}}).text;
 assert.match(imperial,/about 12 in across/);
 assert.doesNotMatch(imperial,/one pizza at a time/,'a wood-fired oven already bakes one at a time in 60–90 s');
 assert.doesNotMatch(guide('neapolitan','en',{numItems:1,weight:260,extra:{pizzaDiameterCm:30}}).text,/one pizza at a time/);
 // Pan styles keep their own bake steps.
 assert.doesNotMatch(guide('pan','en',{numItems:2,weight:600,extra:{pizzaDiameterCm:30}}).text,/cm across|one pizza at a time/);
});

test('pan pizza: no fridge question without a fridge, pan answers, sugar with the flour, oil last',()=>{
 const roomOnly=guide('neapolitan','en',{numItems:4,weight:260,hours:6});
 assert.equal(roomOnly.schedule.coldRetardHours>0,false);
 assert.doesNotMatch(roomOnly.text,/still cold from the fridge/);
 assert.match(guide('neapolitan','en',{numItems:4,weight:260,hours:26}).text,/still cold from the fridge/);
 const pan=guide('pan','en',{numItems:2,weight:600,hours:8}).text;
 assert.doesNotMatch(pan,/stretch a little thinner|move the rack \(and steel\/stone\) higher|Position the rack closer to the top|Stretch &amp; bake tips|Stretch & bake tips/);
 assert.match(pan,/A pan pizza bakes on the lowest rack for its base/);
 const mix=pan.slice(pan.indexOf('What to do'),pan.indexOf('Ready when'));
 assert.match(mix,/Mix the flour and sugar with \d+ g of the prepared water/);
 assert.ok(mix.indexOf('Knead by hand')<mix.indexOf('Add the measured oil last'));
 assert.doesNotMatch(mix,/Incorporate the measured sugar/);
 const fr=guide('pan','fr',{numItems:2,weight:600,hours:8}).text;
 assert.match(fr,/Mélangez la farine et le sucre avec/);
 assert.doesNotMatch(fr,/Incorporez le sucre mesuré/);
});

test('brioche has an optional egg wash before baking and its egg on the shopping list; pain de mie has neither',()=>{
 const {breadFinishShopping}=require('../app/lib/doughShopping.ts');
 const brioche=guide('brioche','fr',{numItems:2,weight:500,oven:'standard_bread'}).text;
 assert.match(brioche,/Dorure facultative : juste avant d’enfourner, badigeonnez délicatement le dessus d’un œuf battu/);
 assert.ok(brioche.indexOf('Dorure facultative')<brioche.indexOf('Cuisez à mi-hauteur basse'));
 assert.match(guide('brioche','en',{numItems:2,weight:500,oven:'standard_bread'}).text,/Optional egg wash: just before baking/);
 assert.doesNotMatch(guide('pain_mie','fr',{numItems:1,weight:600,oven:'standard_bread'}).text,/[Dd]orure|egg wash/);
 assert.deepEqual(breadFinishShopping('brioche',2,'fr').map(r=>r.name),['Œuf pour la dorure (facultatif)']);
 assert.deepEqual(breadFinishShopping('pain_mie',1,'fr'),[]);
});

test('shopping: a sachet hint for a tiny dry yeast dose, and the finish and dusting the steps ask for',()=>{
 const {yeastBuyingHint,breadFinishShopping,doughShoppingItems}=require('../app/lib/doughShopping.ts');
 assert.equal(yeastBuyingHint(0.75,'instant','en'),'one 7 g sachet is plenty');
 assert.equal(yeastBuyingHint(0.75,'instant','fr'),'un sachet suffit');
 assert.equal(yeastBuyingHint(0.75,'instant','en','imperial'),'one ¼ oz packet is plenty');
 assert.equal(yeastBuyingHint(12,'instant','en'),undefined);
 assert.equal(yeastBuyingHint(6,'active_dry','fr'),undefined,'more than a French 5.5 g sachet');
 assert.equal(yeastBuyingHint(3,'fresh','fr'),undefined,'fresh yeast is sold by the cube');
 const items=doughShoppingItems({recipe:{flour:600,salt:17,yeast:{convertedGrams:0.75,yeastType:'instant'}},yeastType:'instant',locale:'en',flourName:'Flour'});
 assert.equal(items.find(i=>i.tickKey==='dough_2').amount,'1 sachet (7 g)');assert.equal(items.find(i=>i.tickKey==='dough_2').hint,'you’ll use 0.75 g');
 assert.deepEqual(breadFinishShopping('fougasse',2,'fr').map(r=>r.name),['Huile d’olive, pour badigeonner à la sortie du four','Fleur de sel (facultatif)']);
 assert.deepEqual(breadFinishShopping('pain_campagne',1,'en'),[{id:'finish_rice_flour',name:'Rice flour, for dusting the banneton',grams:20}]);
 assert.deepEqual(breadFinishShopping('baguette',3,'en'),[]);
 assert.deepEqual(breadFinishShopping('pain_seigle',1,'en'),[],'rye is shaped with water, not rice flour');
});

test('one name per style, the picker’s, and guide wording details',()=>{
 const {data}=require('./load-production.cjs');
 const en=require('../messages/en.json').style, fr=require('../messages/fr.json').style;
 for(const key of ['neapolitan','newyork','pizza_romana','roman','pan','sourdough']){
  assert.equal(data.ALL_STYLES[key].name,en[key].title,key);
  assert.equal(data.ALL_STYLES[key].nameFr,fr[key].title,key);
 }
 const pizza=guide('neapolitan','en',{numItems:4,weight:260,extra:{phase:'preparation'}}).html;
 assert.doesNotMatch(pizza,/Cooking &amp; serving/);
 const bake=guide('neapolitan','en',{numItems:4,weight:260}).text;
 assert.doesNotMatch(bake,/What does Maestro think/);
 assert.match(bake,/Ask about this step .{0,40}Photo optional\./);
 assert.doesNotMatch(bake,/Ask about this step Ask Ask about this step/);
 const poolish=guide('neapolitan','en',{numItems:4,weight:260,extra:{prefermentType:'poolish'}}).text;
 assert.doesNotMatch(poolish,/\bpoolish \d/);
});

test('French details: one oven-setting wording, spaced units, fougasse eaten warm',()=>{
 const brioche=guide('brioche','fr',{numItems:2,weight:500,oven:'standard_bread'}).text;
 assert.match(brioche,/190 °C en chaleur statique \/ 170 °C en chaleur tournante/);
 assert.doesNotMatch(brioche,/°C statique|ventilé|\d°C/);
 const fougasse=guide('fougasse','fr',{numItems:2,weight:400,oven:'standard_bread'}).text;
 assert.doesNotMatch(fougasse,/Encore chaud \? Vérifiez dans 30 min|Le pain doit-il vraiment refroidir|Puis-je déjà trancher/);
 assert.match(fougasse,/servez-la le jour même/);
 const en=guide('fougasse','en',{numItems:2,weight:400,oven:'standard_bread'}).text;
 assert.doesNotMatch(en,/Still warm\? Check again|Should bread really cool before cutting|Can I slice it now/);
 assert.match(guide('pain_campagne','fr',{numItems:1,weight:800,oven:'standard_bread'}).text,/Encore chaud \? Vérifiez dans 30 min/);
});

test('Preparation renders no empty or collapsed-only headings',()=>{
 for(const [style,opts] of [['neapolitan',{numItems:4,weight:260}],['pain_levain',{mixer:'stand',oven:'dutch_oven',numItems:1,weight:800,yeast:'sourdough',hours:30}]]){
  const {html}=guide(style,'fr',opts);
  assert.doesNotMatch(html,/<h3[^>]*>\s*<\/h3>/,style);
  assert.doesNotMatch(html,/<details[^>]*>(?:(?!<\/details>)[\s\S])*<h3/,style);
  assert.match(html,/role="group" aria-label="Questions fréquentes"/);
 }
});

module.exports={guide};
