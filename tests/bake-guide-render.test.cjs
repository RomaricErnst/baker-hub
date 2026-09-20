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
  assert.ok(html.includes('All steps'));assert.ok(html.includes('Current step'));assert.ok(html.includes('Mark as completed'));assert.ok(html.includes('Next step'));assert.ok(html.includes('Previous step'));assert.ok(html.includes('aria-expanded="true"'));
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
  if(style==='sourdough') {assert.ok(html.includes('Your dough is ready'));assert.ok(!html.includes('Cool the bread'));}
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
