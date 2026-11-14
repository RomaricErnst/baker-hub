const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const messages=require('../messages/en.json');
test('real schedule guide preserves room, single-cold and two-cold stages with navigation',()=>{
 const seen=new Set();
 for(const style of ['neapolitan','pan','brioche'])for(const temp of [20,32])for(const horizon of [3,8,26]){
  const schedule=utils.buildSchedule(new Date('2026-09-12T16:00Z'),new Date(+new Date('2026-09-12T16:00Z')+horizon*3600000),[],temp,60,'hand',style);
  const branch=schedule.coldRetard2Start?'two':schedule.coldRetardStart?'single':'rt'; seen.add(branch);
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'Asia/Singapore'},React.createElement(Guide,{schedule,mixerType:'hand',styleKey:style,kitchenTemp:32,numItems:4,oil:0,hydration:65,locale:'en'})));
  assert.ok(html.includes('All steps'));assert.ok(html.includes('Current step'));assert.ok(html.includes('Mark as completed'));assert.ok(html.includes('Next step'));assert.ok(!html.includes('Previous step'),'first step has no dead previous action');assert.ok(html.includes('role="heading"'),'current instruction is a heading');assert.ok(html.includes('class="bh-guide-actions" style="position:relative'),'actions follow the instructions');
  if(branch==='two')assert.ok(html.includes(messages.bakeGuide.stepTitles[style==='brioche'?'coldProof':'coldRetardBalls']));
  if(branch==='rt')assert.ok(!html.includes(messages.bakeGuide.stepTitles.coldRetardBalls));
 }
 assert.ok(seen.has('two'));assert.ok(seen.has('rt'));
});
test('sourdough choice uses planned starter events for any bread style',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],22,45,'stand','pain_campagne');
 const recipe=utils.calculateRecipe('pain_campagne','dutch_oven',1,800,22,'normal',schedule,6,'sourdough','custom','stand');
 const starterEvents=['refresh','intermediate_refresh','pre_mix'].map((kind,i)=>({kind,time:new Date(`2026-09-23T${['08','12','18'][i]}:00Z`),isPast:false,isActive:true,label:'Feed',isDraggable:false,cardTimeFormat:'absolute',bellStyle:'solid',bellSigmaScale:1}));
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,starterEvents,mixerType:'stand',styleKey:'pain_campagne',kitchenTemp:22,numItems:1,oil:0,hydration:75,locale:'en'})));
 for(const label of ['Refresh feed','Intermediate feed','Pre-mix feed'])assert.ok(html.includes(label+'</strong>'),label);
 assert.ok(html.includes('starter.webp'));
});
test('sourdough pizza hands off to pizza journey, bread cooling uses loaf size',()=>{
 for(const style of ['sourdough','pain_campagne']) {
  const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],22,45,'hand',style);
  const recipe=utils.calculateRecipe(style,style==='sourdough'?'pizza_oven':'dutch_oven',1,800,22,'normal',schedule,6,'sourdough','custom','hand');
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,mixerType:'hand',styleKey:style,kitchenTemp:22,numItems:1,oil:0,hydration:75,locale:'en',onNavigateToPizzaParty:()=>{}})));
  if(style==='sourdough') {assert.ok(html.includes('Bake the pizzas'));assert.ok(!html.includes('Cool the bread'));}
  else {assert.ok(html.includes('Cool the bread'));}
 }
});

test('cooling ranges distinguish small breads, loaves and rye',()=>{
 const {breadCoolingRange}=require('../app/components/BakeGuide.tsx');
 assert.equal(breadCoolingRange('baguette',250),'20–30 min');
 assert.equal(breadCoolingRange('fougasse',400),'10–15 min');
 assert.equal(breadCoolingRange('pain_campagne',800),'2–3 h');
 assert.equal(breadCoolingRange('pain_campagne',1400),'3–4 h');
 assert.equal(breadCoolingRange('pain_seigle',800),'12–24 h');
});

test('spiral mixing groups both visual cues and keeps secondary guidance behind help',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,60,'spiral','neapolitan');
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,mixerType:'spiral',styleKey:'neapolitan',kitchenTemp:22,numItems:4,oil:0,hydration:65,locale:'en'})));
 assert.ok(html.includes('Kneading tips'));
 assert.doesNotMatch(html,/Mixing technique · help|See what to look for|Tips &amp; tricks/);
 assert.equal((html.match(/What to look for/g)||[]).length,1);
 assert.ok(html.includes('windowpane-v1.webp'));assert.ok(html.includes('spiral-pumpkin-wide-v1.webp'));
 let depth=0;
 for(const tag of html.match(/<\/?details\b[^>]*>/g)||[]){depth+=tag.startsWith('</')?-1:1;assert.ok(depth<=1,'help must never require opening a nested disclosure');}
 const help=html.indexOf('Kneading tips');
 assert.ok(html.indexOf('windowpane-v1.webp',help)>help,'visual cue is inside the shared help');
 const helpEnd=html.indexOf('</details>',help);
 assert.doesNotMatch(html,/More guidance · /,'the disclosure names its content once');
 assert.ok(html.indexOf('Common questions',help)>help && html.indexOf('Common questions',help)<helpEnd,'troubleshooting is inside optional guidance');
 const membrane=[...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].find(([,attributes,content])=>content.includes('Windowpane test'));
 assert.ok(membrane,'technique link is retained');
 assert.match(membrane[1],/min-height:44px/);
 assert.doesNotMatch(html,/streaks that kneading will not remove|do not add more before 20 minutes/);
});

test('preferment instructions use actual dose and planned location without final-mix water',()=>{
 for(const pref of ['poolish','biga'])for(const cold of [false,true]){
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],28,60,'spiral','neapolitan');
 const recipe=utils.calculateRecipe('neapolitan','pizza_oven',4,260,28,'normal',schedule,4,'fresh','custom','spiral',undefined,undefined,undefined,undefined,pref,null,20);
 recipe.preferment.cold=cold;recipe.preferment.prefYeastGrams=.175;recipe.preferment.prefYeastType='fresh';
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,prefermentType:pref,prefStartTime:new Date('2026-09-23T20:00Z'),mixerType:'spiral',styleKey:'neapolitan',kitchenTemp:28,numItems:4,oil:0,hydration:62,locale:'en'})));
 const section=html.split('aria-label="'+messages.bakeGuide.stepTitles[pref==='biga'?'makeBiga':'makePoolish'])[1];
 assert.ok(section,'preferment section is rendered');
 const prefHtml=section.split('</section>')[0];
 assert.ok(prefHtml.includes('0.2 g'));assert.match(prefHtml,/fresh yeast/i);
 assert.ok(cold?/Refrigerate until /.test(prefHtml):prefHtml.includes('Leave at room temperature according to this plan.'));
 assert.doesNotMatch(prefHtml,/Water temperature|50-60|0\.1-0\.2|always ferments cold|air exchange|pinch of IDY/);
 }
});

test('short mixing duration reads to 5 minutes and hand instructions exclude machine speeds',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,45,'hand','pain_campagne');
 schedule.mixingDurationH=.6;
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,mixerType:'hand',styleKey:'pain_campagne',kitchenTemp:22,numItems:1,oil:0,hydration:65,locale:'en'})));
 assert.match(html,/ · 35 min/);
 assert.match(html,/Cover and rest 30 min, until \d{1,2}:\d{2}(am|pm)\./,"the rest is stated with its clock time");
 assert.match(html,/Knead by hand until smooth and stretchy/);
 assert.doesNotMatch(html,/using only your mixer’s permitted dough speeds/);
});


test('cooking phase shows local step numbers while pizza advice leads into one queue action',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,60,'hand','neapolitan');
 const props={schedule,mixerType:'hand',styleKey:'neapolitan',ovenType:'home_oven_steel',kitchenTemp:22,numItems:4,oil:0,hydration:65,locale:'en',phase:'cooking',onNavigateToPizzaParty:()=>{},pizzasChosen:true};
 const render=()=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,props)));
 const initial=render();
 assert.match(initial,/aria-label="Preheat the oven · Step 1"/);
 assert.match(initial,/aria-label="Bake the pizzas · Step 2"/);
 const finalSection=initial.split('data-guide-title="Bake the pizzas"')[1];
 const globalStep=Number(initial.match(/data-guide-step="(\d+)" data-guide-phase="cooking" data-guide-title="Bake the pizzas"/)[1]);
 assert.ok(globalStep>2,'persisted global step identity is retained');
 const useState=React.useState;
 try {
   React.useState=(value)=>useState(value===1?globalStep:value);
   const html=render();
   const pizza=html.split('data-guide-title="Bake the pizzas"')[1].split('</section>')[0];
   assert.match(pizza,/Step 2 \/ 2/);
   assert.ok(pizza.indexOf('Bake 5–7 min')<pizza.indexOf('Start baking the pizzas'));
   assert.ok(pizza.includes('Stretch on a peel'));
   assert.doesNotMatch(pizza,/Your dough is ready|bh-guide-next/);
   assert.equal((pizza.match(/Start baking the pizzas/g)||[]).length,1);
   props.pizzaActionLabel='Choose my pizzas';props.pizzasChosen=true;
   assert.ok(render().includes('Choose my pizzas'),'the handoff label is preserved');
   // Nothing chosen yet: a quiet link instead of the full-width action.
   props.pizzasChosen=false;
   assert.ok(render().includes('No toppings planned? Pick pizzas'));
   props.phase='preparation';
   let zeroState=0;
   React.useState=(value)=>{ if(value===0){zeroState++;if(zeroState===1)return useState(1);if(zeroState===2)return useState(globalStep);} return useState(value); };
   const preparation=render().split('data-guide-title="Start Dough"')[1].split('</section>')[0];
   assert.ok(preparation.includes(`Step 1 / ${globalStep-2}`),'preparation count excludes cooking stages');
 } finally { React.useState=useState; }
});


test('pizza service help is one inline disclosure in both languages',()=>{
 // Match TypeScript module resolution when a catalogue has both .ts and .json.
 const previousResolve=Module._resolveFilename;
 Module._resolveFilename=function(request,...args){return previousResolve.call(this,request.endsWith('/auditedPizzaRecipes')?`${request}.ts`:request,...args);};
 // Catalogue JSON imports need the application's esModuleInterop setting.
 require.extensions['.ts']=require.extensions['.tsx'];
 const BakeTab=require('../app/components/pizzaParty/BakeTab.tsx').default;
 const pizza=require('../app/lib/toppingDatabase.ts').PIZZAS[0];
 const original=React.useState;
 try {
  for(const locale of ['en','fr']){
   let first=true;
   React.useState=(value)=>{if(first){first=false;return original(pizza.id);}return original(value);};
   const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require(`../messages/${locale}.json`),timeZone:'UTC'},React.createElement(BakeTab,{selectedPizzas:{[pizza.id]:2},locale,styleKey:'neapolitan',ovenType:'home_oven_steel'})));
   assert.match(html,locale==='fr'?/Conseils pour garnir et cuire/:/Topping and baking tips/);
   assert.equal((html.match(/<details\b/g)||[]).length,1);
   assert.match(html,locale==='fr'?/Questions fréquentes/:/Common questions/);
   assert.match(html,/name=|Your question|Votre question/);
   assert.doesNotMatch(html,/Tips &amp; tricks/);
   assert.equal((html.match(/animation:slideUpSheet/g)||[]).length,1,'only the pizza card opens as a sheet');
  }
 } finally {React.useState=original;Module._resolveFilename=previousResolve;}
});


test('preparation overview exposes readable timing in the native button name',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,60,'hand','neapolitan');
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,mixerType:'hand',styleKey:'neapolitan',kitchenTemp:22,numItems:4,oil:0,hydration:65,locale:'en',phase:'preparation'})));
 const rows=[...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].filter(row=>row[2].includes('<strong')&&row[2].includes('font-size:14px'));
 assert.ok(rows.length>0,'overview presents timed step buttons');
 for(const [,attributes,content] of rows){
  assert.doesNotMatch(attributes,/aria-label=/,'native title, time and completion content must remain the accessible name');
  assert.match(content,/font-size:14px;color:#6D625C/);
 }
});

function renderGuideDetails(props,locale='en') {
 const original=React.useState;let result='';
 try {for(let step=1;step<=12;step++){
 let picked=false;
 React.useState=(value)=>{if(!picked&&value===1){picked=true;return original(step);}return original(value);};
 result+=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'UTC'},React.createElement(Guide,props)));
 }}finally{React.useState=original;}return result;
}

// 14 Nov 2026: every screen shows planned times on the plan's 15-minute grid, rounded the same
// way (the Recipe said 7:45 while the guide said 7:44), so the guide matches formatPlanTime.
test('guide shows planned times on the quarter grid and a quantity-aware shaping duration',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:07Z'),new Date('2026-09-25T18:00Z'),[],22,45,'stand','neapolitan');
 schedule.bulkFermStart=new Date('2026-09-24T08:27Z');schedule.mixingDurationH=20/60;
 schedule.divisionMinutes=47;
 const recipe=utils.calculateRecipe('neapolitan','home_oven_standard',20,260,22,'normal',schedule,6,'instant','custom','stand');
 recipe.sourdough={starterGramsMid:100};
 const starterEvents=[{kind:'pre_mix',time:new Date('2026-09-24T06:07Z'),isPast:false,isActive:true,label:'Feed',isDraggable:false,cardTimeFormat:'absolute',bellStyle:'solid',bellSigmaScale:1}];
 const html=renderGuideDetails({schedule,recipe,starterEvents,mixerType:'stand',styleKey:'neapolitan',kitchenTemp:22,numItems:20,oil:0,hydration:65,locale:'en'});
 assert.ok(html.includes(utils.formatPlanTime(new Date('2026-09-24T08:07Z'),'en')),'mix time on the quarter grid');
 assert.ok(!html.includes(utils.formatTime(new Date('2026-09-24T08:07Z'),'en')),'no off-grid minute');
 assert.ok(html.includes(utils.formatPlanTime(starterEvents[0].time,'en')),'feed time on the quarter grid');
 assert.match(html,/45 min/);assert.match(html,/260 g each/);
});

test('standard oven guide follows selected topping quantities and one rack position in both languages',()=>{
 for(const locale of ['en','fr']){
 const translated=require('../messages/'+locale+'.json');
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,30,'hand','neapolitan');
 const html=renderGuideDetails({schedule,mixerType:'hand',styleKey:'neapolitan',ovenType:'home_oven_standard',kitchenTemp:22,numItems:4,oil:0,hydration:65,locale},locale);
 assert.doesNotMatch(html,/Top generously|Garnissez généreusement|thicker styles work best|les styles épais fonctionnent mieux/);
 assert.ok(html.includes(translated.bakeGuide.bake.homeStandard.steps[1].bold));
 assert.ok(html.includes(locale==='fr'?'grille médiane-haute':'upper-middle rack'));
 }
});

test('enriched help retains butter technique and excludes lean-dough autolyse FAQ',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],22,45,'hand','brioche');
 const recipe=utils.calculateRecipe('brioche','standard_bread',1,750,22,'normal',schedule,6,'instant','custom','hand');
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,mixerType:'hand',styleKey:'brioche',kitchenTemp:22,numItems:1,oil:0,hydration:65,locale:'en'})));
 assert.match(html,/Why add butter after the dough gains strength/);
 assert.match(html,/Add softened butter gradually/);
 const main=html.split('Kneading tips')[0];
 assert.match(main,/Combine flour, liquids, yeast, salt and sugar, without the butter/);
 assert.match(main,/If the dough becomes greasy or too warm, pause and cool it/);
 assert.doesNotMatch(html,/autolyse|autolysis/i);
});

test('mixing flour rows exclude prefermented flour and conserve each batch',()=>{
 for(const [yeast,pref] of [['instant','none'],['instant','poolish'],['instant','biga'],['sourdough','levain']])for(const count of [1,2]){
  const schedule=utils.buildSchedule(new Date('2026-10-28T14:00Z'),new Date('2026-10-30T11:30Z'),[],27,60,'spiral','neapolitan');
  const blend={flour1:'bread',flour2:'rye',ratio1:85,brandProduct:'Primary flour',customFlour2Name:'Second flour'};
  const recipe=utils.calculateRecipe('neapolitan','home_oven_standard',12,270,27,'normal',schedule,6,yeast,'custom','spiral',undefined,undefined,undefined,blend,pref,null,20,undefined,undefined,true,0,false,undefined,20);
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,mixerType:'spiral',mixingBatches:count,styleKey:'neapolitan',prefermentType:pref,kitchenTemp:27,numItems:12,oil:0,hydration:62,locale:'en'})));
  const used=recipe.preferment?.prefFlour??(recipe.sourdough?Math.round(recipe.sourdough.starterGramsMid/2):0);
  const added=recipe.flour-used;
  const {mixingBatchPlan}=require('../app/utils/mixingBatches.ts');
  const portion=mixingBatchPlan(recipe,'spiral',count,0).portion.flour;
  const first=Math.round(portion*(recipe.flourParts[0].grams-used)/added);
  const {displayWeight}=require('../app/utils/units.ts');
  const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Batch 1's amount, as a single value (even batches) or the first column of the table.
  assert.match(html,new RegExp(`<span>Primary flour</span>(<span[^>]*>)?<strong[^>]*>${esc(displayWeight(first,'metric','en'))}</strong>`),`${pref}, ${count}: primary added flour`);
  assert.match(html,new RegExp(`<span>Second flour</span>(<span[^>]*>)?<strong[^>]*>${esc(displayWeight(portion-first,'metric','en'))}</strong>`),`${pref}, ${count}: second added flour`);
 }
});

test('Simple gives the selected kneading method and one loaf needs no division',()=>{
 for (const locale of ['fr','en']){
  const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-25T18:00Z'),[],22,45,'stand','pain_campagne');
  const recipe=utils.calculateRecipe('pain_campagne','dutch_oven',1,800,22,'normal',schedule,6,'instant','simple','stand');
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,mixerType:'stand',styleKey:'pain_campagne',kitchenTemp:22,numItems:1,oil:0,hydration:70,locale,simpleMode:true})));
  assert.ok(html.includes(locale==='fr'?'à une vitesse « pâte » de votre pétrin':'at a dough speed your mixer allows'));
  assert.doesNotMatch(html,/Divide into 1 equal pieces|Divisez en 1 pâtons|Remove balls|Sortez les boules du frigo/);
 }
});

test('a hot poolish gets one timed cooling task in both the timeline and preparation',()=>{
 const {buildItems}=require('../app/components/Timeline.tsx');
 const {poolishCoolingAt}=require('../app/utils/poolishCoolingAt.ts');
 const start=new Date('2030-04-01T12:00Z'),bake=new Date('2030-04-02T12:00Z');
 const prefStartTime=new Date(+start-8*3600000);
 const schedule=utils.buildSchedule(start,bake,[],33,45,'stand','neapolitan',4);
 schedule.prefermentCooldownHours=utils.requiredPrefCooldownH({prefermentType:'poolish', prefInFridge:false,styleKey:'neapolitan', kitchenTemp:33,fridgeTemp:6,mixerType:'stand',prefermentFlourPct:50,doughMassG:1040,hydrationPct:62,targetDoughTemp:22});
 const recipe=utils.calculateRecipe('neapolitan','home_oven_standard',4,260,33,'normal',schedule,6,'instant','custom','stand',62,undefined,undefined,undefined,'poolish',null,50,undefined,22,false,0,false);
 const chillAt=poolishCoolingAt(schedule,recipe);
 assert.ok(chillAt>prefStartTime && chillAt<start);
 const items=buildItems(schedule,[],start,bake,45,'stand',4,null,33,false,prefStartTime,'poolish',false,null,62,0,k=>k,'pizza','neapolitan','en',260,chillAt);
 const tasks=items.filter(item=>item.id==='preferment-cold-in');
 assert.equal(tasks.length,1);
 assert.equal(+tasks[0].time,+start-recipe.thermal.prefermentCooldownHours*3600000);
 for(const locale of ['en','fr']){
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'UTC'},React.createElement(Guide,{schedule,recipe,mixerType:'stand',styleKey:'neapolitan',kitchenTemp:33,numItems:4,oil:0,hydration:62,locale,prefermentType:'poolish',prefStartTime})));
  assert.ok(html.includes(locale==='fr'?'Réfrigérer le poolish':'Chill the poolish'));
  assert.ok(html.includes(utils.formatTime(chillAt,locale)));
 }
});

test('the first planned feed is a feed, not an intermediate one',()=>{
 const {starterFeedLabelFor,starterActionLabelFor}=require('../app/utils/starterBuild.ts');
 const t=h=>new Date(Date.UTC(2026,10,20,h));
 const plan=[{kind:'fridge_out',time:t(7)},{kind:'intermediate_refresh',time:t(9)},{kind:'intermediate_refresh',time:t(15)},{kind:'pre_mix',time:t(21)}];
 assert.equal(starterFeedLabelFor(plan[1],plan,false),'Refresh feed');
 assert.equal(starterFeedLabelFor(plan[1],plan,true),'Rafraîchir le levain');
 assert.equal(starterFeedLabelFor(plan[2],plan,false),'Intermediate feed');
 assert.equal(starterActionLabelFor(plan[1],plan,true),'Rafraîchir le levain');
});
