const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const en=require('../messages/en.json'),fr=require('../messages/fr.json');

/** Renders every guide step open, one at a time, and returns the joined markup. */
function render(style,lang,extra={}){
 const {horizonH=10,kitchen=22,weight=270,...props}=extra;
 const start=new Date('2030-06-01T08:00Z'),bake=new Date(+start+horizonH*3600000);
 const schedule=props.schedule??utils.buildSchedule(start,bake,[],kitchen,45,props.mixerType??'hand',style);
 const count=props.numItems??4;
 const base={schedule,mixerType:'hand',styleKey:style,kitchenTemp:kitchen,numItems:count,oil:0,hydration:65,locale:lang,
  recipe:{totalDough:weight*count,flour:weight*count*0.6,water:weight*count*0.39,salt:7,oil:0,sugar:0,hydration:65,yeast:null,waterTemp:null}};
 const original=React.useState;let html='';
 for(let step=1;step<=12;step++){
  React.useState=initial=>original(initial===1?step:initial);
  try{html+=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:lang,messages:lang==='fr'?fr:en,timeZone:'UTC'},React.createElement(Guide,{...base,...props,schedule})));}
  finally{React.useState=original;}
 }
 return html;
}
module.exports={render};

test('pizza oven preheat and launch agree on a 400–450 °C floor',()=>{
 const text=m=>JSON.stringify([m.bakeGuide.preheat.pizzaOven,m.bakeGuide.bake.pizzaOven]);
 assert.match(text(en),/target 400–450°C floor temperature/);
 assert.match(text(en),/launch when the floor reads 400–450°C/);
 assert.match(text(fr),/sole de 400–450 °C/);
 assert.match(text(fr),/quand la sole affiche 400–450 °C/);
 for(const m of [en,fr])assert.doesNotMatch(text(m),/450–500|above 400|au-dessus de 400/);
 const imperial=render('neapolitan','en',{ovenType:'pizza_oven',units:'imperial'});
 assert.match(imperial,/target 750–840°F floor temperature/);
 assert.match(imperial,/launch when the floor reads 750–840°F/);
});

test('proof tips carry no minute ranges of their own and no warmup the dough never had',()=>{
 for(const kitchen of [22,34])for(const lang of ['en','fr']){
  const html=render('neapolitan',lang,{kitchen,horizonH:8});
  assert.doesNotMatch(html,/15–25 min|20–35 min|30–60 min|après la remise à température/,kitchen+lang);
  // "After warmup" belongs only to a proof that follows a fridge exit.
  const s=utils.buildSchedule(new Date('2030-06-01T08:00Z'),new Date('2030-06-01T16:00Z'),[],kitchen,45,'hand','neapolitan');
  if(!s.coldRetard2Start)assert.doesNotMatch(html,/after warmup|après réchauffage/,kitchen+lang);
 }
 assert.doesNotMatch(render('neapolitan','en',{kitchen:22,horizonH:8}),/Warm kitchen|the proof moves quickly/);
 assert.match(render('neapolitan','en',{kitchen:34,horizonH:8}),/In a kitchen at 34°C, the proof moves quickly: check the dough before the planned time is up/);
 assert.match(render('neapolitan','fr',{kitchen:34,horizonH:8}),/l’apprêt avance vite/);
});

test('warm-spot and hot-kitchen tips follow the real kitchen temperature',()=>{
 assert.match(render('neapolitan','en',{kitchen:22,horizonH:8}),/A spot warmer than 26°C speeds the rise/);
 assert.doesNotMatch(render('neapolitan','en',{kitchen:30,horizonH:8}),/warmer than 26°C|above 26°C/);
 assert.doesNotMatch(render('neapolitan','fr',{kitchen:30,horizonH:8}),/Au-dessus de 26/);
 assert.doesNotMatch(render('neapolitan','en',{kitchen:22,horizonH:8}),/Hot kitchen|work within|shape without pausing/);
 assert.match(render('neapolitan','en',{kitchen:31,horizonH:8}),/In a kitchen at 31°C, get the balls into their boxes quickly/);
});

test('the cold-phase pitfall appears only when the plan has a long cold rest',()=>{
 const start=new Date('2030-06-01T08:00Z');
 const plan=(kitchen,hours)=>utils.buildSchedule(start,new Date(+start+hours*3600000),[],kitchen,45,'hand','neapolitan');
 const short=plan(30,6),long=plan(20,30);
 assert.ok(short.coldRetard1Start&&short.totalColdHours<8,'short cold plan');
 assert.ok(long.coldRetard1Start&&long.totalColdHours>=8,'long cold plan');
 assert.doesNotMatch(render('neapolitan','en',{kitchen:30,schedule:short}),/Rushing the cold phase/);
 assert.doesNotMatch(render('neapolitan','fr',{kitchen:30,schedule:short}),/Précipiter la phase froide/);
 assert.match(render('neapolitan','en',{kitchen:20,schedule:long}),/Rushing the cold phase/);
});

test('kneading and oil pitfalls match the mixer and the formula',()=>{
 const hand=render('neapolitan','en',{mixerType:'hand'});
 assert.match(hand,/Over-kneading by hand is nearly impossible/);
 assert.doesNotMatch(hand,/A mixer can over-mix|stand mixer|Adding oil before gluten/);
 const stand=render('neapolitan','en',{mixerType:'stand'});
 assert.match(stand,/A mixer can over-mix/);
 assert.doesNotMatch(stand,/Over-kneading by hand/);
 assert.match(render('newyork','en',{oil:3}),/Adding oil before gluten develops/);
 assert.match(render('neapolitan','fr',{mixerType:'stand'}),/Un pétrin peut sur-pétrir/);
});

test('questions appear only for the bake type and oven they apply to',()=>{
 const tray=render('neapolitan','en',{ovenType:'home_oven_standard'});
 assert.doesNotMatch(tray,/Should bread really cool|stuck to the peel|stone is truly hot|first pizza always the worst|base chars before|broiler during preheat|shorter preheat really/);
 const steel=render('neapolitan','en',{ovenType:'home_oven_steel'});
 assert.match(steel,/How do I know the stone is truly hot\?/);
 assert.match(steel,/The pizza stuck to the peel/);
 assert.doesNotMatch(steel,/Should bread really cool/);
 assert.match(render('pain_campagne','en',{ovenType:'standard_bread',weight:800,numItems:1}),/Should bread really cool before cutting\?/);
 const pan=render('pan','en',{ovenType:'home_oven_steel',weight:600,numItems:1});
 assert.doesNotMatch(pan,/stuck to the peel|My balls|shape the balls/);
});

test('one bulk-rise question, consistent with the 50–75% cue beside it',()=>{
 const html=render('neapolitan','en');
 assert.equal((html.match(/How much should it (actually )?rise/g)||[]).length,1);
 assert.doesNotMatch(html,/no single rise percentage|How much should it actually rise/);
 assert.match(html,/Dough has grown 50–75%/);
 assert.doesNotMatch(render('neapolitan','fr'),/aucun pourcentage de levée|vraiment monter/);
 assert.equal((html.match(/windowpane test (—|fails)/g)||[]).length<=1,true);
});

test('a rest named inside the shaping step carries no number that fights the step duration',()=>{
 const en=render('baguette','en',{weight:320,numItems:3}),fr=render('baguette','fr',{weight:320,numItems:3});
 assert.doesNotMatch(en,/bench rest 20 min/);assert.match(en,/let the pieces relax until they no longer spring back/);
 assert.doesNotMatch(fr,/repos de 20 min/);assert.match(fr,/laissez les pâtons se détendre/);
 assert.doesNotMatch(render('pain_campagne','en',{weight:800,numItems:2}),/rest 15 min/);
});

test('egg weighing note needs eggs; final dough temperature is spelled out with its target',()=>{
 const enriched=(eggs)=>({weight:80,numItems:6,recipe:{totalDough:480,flour:280,water:0,salt:4,oil:0,sugar:11,hydration:58,yeast:null,waterTemp:null,enrichment:{milk:160,eggs,butter:25}}});
 assert.doesNotMatch(render('pain_viennois','en',enriched(0)),/without shells/);
 assert.doesNotMatch(render('pain_viennois','fr',enriched(0)),/sans coquille/);
 assert.match(render('pain_viennois','en',enriched(50)),/Weigh eggs without shells/);
 const thermal={recipe:{totalDough:1080,flour:650,water:420,salt:16,oil:0,sugar:0,hydration:65,yeast:null,waterTemp:null,thermal:{targetDoughTemp:24}}};
 const en=render('neapolitan','en',thermal),fr=render('neapolitan','fr',thermal);
 assert.match(en,/Check the final dough temperature with a thermometer right after mixing: this recipe aims for 24°C/);
 assert.match(fr,/Vérifiez la température de pâte en fin de pétrissage avec un thermomètre : cette recette vise 24°C/);
 assert.doesNotMatch(en+fr,/\bFDT\b|\bTFP\b|\bDDT\b/);
 assert.match(render('neapolitan','en',{...thermal,units:'imperial'}),/aims for 75°F/);
});
