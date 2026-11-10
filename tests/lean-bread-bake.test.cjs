const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const {leanBreadBake,leanBreadMinutes,ovenTempText,ovenTempF,LEAN_BREAD_STYLES}=require('../app/utils/leanBreadBake.ts');
const OVENS=['standard_bread','home_oven_stone_bread','steam_oven','dutch_oven','wood_fired'];

function render(style,lang,extra={}){
 const start=new Date('2030-06-01T08:00Z'),bake=new Date('2030-06-01T18:00Z');
 const schedule=utils.buildSchedule(start,bake,[],22,45,'hand',style);
 const weight=extra.weight??320,count=extra.numItems??3;
 const base={schedule,mixerType:'hand',styleKey:style,kitchenTemp:22,numItems:count,oil:0,hydration:68,locale:lang,ovenType:'standard_bread',
  recipe:{totalDough:weight*count,flour:weight*count*0.6,water:weight*count*0.4,salt:7,oil:0,sugar:0,hydration:68,yeast:null,waterTemp:null}};
 const original=React.useState;let html='';
 for(let step=1;step<=12;step++){
  React.useState=initial=>original(initial===1?step:initial);
  try{html+=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:lang,messages:require('../messages/'+lang+'.json'),timeZone:'UTC'},React.createElement(Guide,{...base,...extra})));}
  finally{React.useState=original;}
 }
 return html;
}

test('oven settings convert to the nearest 5 °F; core temperatures keep the degree',()=>{
 assert.equal(ovenTempF(190),375);assert.equal(ovenTempF(240),465);assert.equal(ovenTempF(250),480);
 assert.equal(ovenTempText('Preheat to 190°C conventional / 170°C fan','imperial'),'Preheat to 375°F conventional / 340°F fan');
 assert.equal(ovenTempText('centre reaches about 88°C','imperial'),'centre reaches about 190°F');
 assert.equal(ovenTempText('96–98 °C à cœur','imperial'),'205–208 °F à cœur');
 assert.equal(ovenTempText('every opening loses 20–30°C','imperial',120),'every opening loses 20–30°C');
 assert.equal(ovenTempText('Bake covered at 240°C','metric'),'Bake covered at 240°C');
});

test('every lean bread has a real temperature and a weight-aware time on every oven',()=>{
 for(const style of LEAN_BREAD_STYLES)for(const oven of OVENS)for(const weight of [150,320,800,1300]){
  const card=leanBreadBake(style,weight,oven,2);
  if(oven==='wood_fired'&&['pain_campagne','pain_levain','pain_complet','pain_au_seigle'].includes(style)){assert.equal(card,null);continue;}
  assert.ok(card,style+' '+oven);
  for(const lang of ['en','fr']){
   const text=[...card.preheat[lang],...card.bake[lang]].map(step=>step.bold+' '+step.note).join(' | ');
   assert.match(text,/\d{3}(–\d{3})?[ ]?°C/,style+' '+oven+' states °C');
   assert.doesNotMatch(text,/\bmax with fan\b|maximum avec/,style+' never only max');
   assert.ok(text.includes(lang==='fr'?`${card.minutes[0]} à ${card.minutes[1]} min`:`${card.minutes[0]}–${card.minutes[1]} min`),style+' '+oven+' prints its range');
   assert.doesNotMatch(text,/undefined|NaN|-\d+ min|\b0–|\b0 à/,style+' '+oven);
   if(lang==='fr')assert.doesNotMatch(text,/\d°C|'/,'French spacing and apostrophes');
  }
 }
 assert.deepEqual(leanBreadMinutes('baguette',320),[20,25]);
 assert.deepEqual(leanBreadMinutes('fougasse',400),[15,20]);
 assert.ok(leanBreadMinutes('pain_campagne',1300)[1]>leanBreadMinutes('pain_campagne',450)[1]);
 assert.equal(leanBreadBake('brioche',500,'standard_bread'),null);
 assert.equal(leanBreadBake('neapolitan',270,'pizza_oven'),null);
});

test('baguette guide: 250 °C, steam 10 min, 20–25 min, no loaf or tin wording',()=>{
 const en=render('baguette','en');
 assert.match(en,/Heat the oven to 250°C static \/ 230°C fan/);
 assert.match(en,/Bake 10 min with steam/);
 assert.match(en,/20–25 min in total for pieces of about 320 g/);
 assert.match(en,/Allow about 20–30 min before slicing/);
 assert.doesNotMatch(en,/max with fan|tin or pot|Dutch oven|Remove steam tray — bake 20–25 min more|Bake 20 min — do not open door/);
 const fr=render('baguette','fr');
 assert.match(fr,/Préchauffez le four à 250 °C en chaleur statique \/ 230 °C en chaleur tournante/);
 assert.match(fr,/20 à 25 min au total/);
 assert.match(fr,/Grignez chaque baguette/);
 assert.doesNotMatch(fr,/moule ou de la cocotte|maximum avec/);
 const imperial=render('baguette','en',{units:'imperial'});
 assert.match(imperial,/480°F static \/ 445°F fan/);
 assert.doesNotMatch(imperial,/482|446|°C static/);
 // A Dutch oven cannot hold a baguette: the card says so and bakes on a tray.
 assert.match(render('baguette','en',{ovenType:'dutch_oven'}),/too long for a Dutch oven/);
});

test('fougasse guide: 230 °C, 15–20 min, no scoring, olive oil out of the oven, no stated proof minutes',()=>{
 const en=render('fougasse','en',{weight:400,numItems:2});
 assert.match(en,/Heat the oven to 230°C static \/ 210°C fan/);
 assert.match(en,/15–20 min/);
 assert.match(en,/Brush with olive oil as soon as it comes out of the oven/);
 assert.match(en,/no scoring/);
 assert.doesNotMatch(en,/Score the dough|Scoring too shallow|Scoring technique|20–40 min|max with fan|tin or pot|Forgetting steam/);
 const fr=render('fougasse','fr',{weight:400,numItems:2});
 assert.match(fr,/Badigeonnez d’huile d’olive dès la sortie du four/);
 assert.doesNotMatch(fr,/20–40 min|Grignez/);
});

test('country, wholemeal and rye loaves state °C and a time for the loaf weight',()=>{
 for(const style of ['pain_campagne','pain_complet','pain_levain']){
  const en=render(style,'en',{weight:800,numItems:1});
  assert.match(en,/Heat the oven to 250°C static \/ 230°C fan/,style);
  assert.match(en,/Bake 20 min with steam/,style);
  assert.match(en,/40–45 min in total for a loaf of about 800 g/,style);
  assert.doesNotMatch(en,/max with fan|always use max|tin or pot/,style);
  const dutch=render(style,'en',{weight:800,numItems:1,ovenType:'dutch_oven'});
  assert.match(dutch,/Heat to 250°C static \/ 230°C fan for 45 min/,style);
  assert.match(dutch,/Bake 20 min with the lid on/,style);
  assert.match(dutch,/Lift the loaf out of the Dutch oven/,style);
 }
 const rye=render('pain_seigle','en',{weight:700,numItems:1});
 assert.match(rye,/Heat the oven to 240°C static \/ 220°C fan/);
 assert.match(rye,/45–55 min in total for a loaf of about 700 g/);
 assert.match(rye,/Unmould straight away onto a rack/);
 assert.doesNotMatch(rye,/Score the dough|max with fan/);
 assert.match(render('pain_campagne','en',{weight:800,numItems:1,ovenType:'wood_fired',units:'imperial'}),/535–610°F floor/);
});
