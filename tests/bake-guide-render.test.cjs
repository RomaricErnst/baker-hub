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
 assert.equal((html.match(/Feed your starter<\/strong>/g)||[]).length,3);
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
 assert.equal(breadCoolingRange('baguette',250),'30–60 min');
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
 assert.ok(html.indexOf('More questions',help)>helpEnd,'troubleshooting has a separate sibling entry');
 assert.ok(html.indexOf('Common questions',help)>helpEnd,'opening practical tips does not expose the entire FAQ');
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
 assert.ok(prefHtml.includes('0.175 g'));assert.match(prefHtml,/fresh yeast/i);
 assert.ok(prefHtml.includes(cold?'Refrigerate according to this plan.':'Leave at room temperature according to this plan.'));
 assert.doesNotMatch(prefHtml,/Water temperature|50-60|0\.1-0\.2|always ferments cold|air exchange|pinch of IDY/);
 }
});

test('short mixing duration retains exact minutes and hand instructions exclude machine speeds',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,45,'hand','pain_campagne');
 schedule.mixingDurationH=.6;
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,{schedule,mixerType:'hand',styleKey:'pain_campagne',kitchenTemp:22,numItems:1,oil:0,hydration:65,locale:'en'})));
 assert.match(html,/ · 36 min/);
 assert.match(html,/Cover and rest 30 min, as scheduled/);
 assert.match(html,/Knead by hand until cohesive and elastic/);
 assert.doesNotMatch(html,/using only your mixer’s permitted dough speeds/);
});


test('cooking phase shows local step numbers while pizza advice leads into one queue action',()=>{
 const schedule=utils.buildSchedule(new Date('2026-09-24T08:00Z'),new Date('2026-09-24T18:00Z'),[],22,60,'hand','neapolitan');
 const props={schedule,mixerType:'hand',styleKey:'neapolitan',ovenType:'home_oven_steel',kitchenTemp:22,numItems:4,oil:0,hydration:65,locale:'en',phase:'cooking',onNavigateToPizzaParty:()=>{}};
 const render=()=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Guide,props)));
 const initial=render();
 assert.match(initial,/aria-label="Preheat Oven · Step 1"/);
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
   props.pizzaActionLabel='Choose my pizzas';
   assert.ok(render().includes('Choose my pizzas'),'empty-selection handoff label is preserved');
   props.phase='preparation';
   let zeroState=0;
   React.useState=(value)=>{ if(value===0){zeroState++;if(zeroState===1)return useState(1);if(zeroState===2)return useState(globalStep);} return useState(value); };
   const preparation=render().split('data-guide-title="Mix your dough"')[1].split('</section>')[0];
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
