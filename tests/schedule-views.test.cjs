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
const {default:Picker}=require('../app/components/SchedulePicker.tsx');
const messages=require('../messages/en.json');
test('actions are the default in both modes and retain starter feeds and fridge actions',()=>{
 const start=new Date(Date.now()+48*3600000),eat=new Date(+start+24*3600000);
 const schedule=utils.buildSchedule(start,eat,[],22,45,'hand','pain_levain');
 const events=['refresh','fridge_in','fridge_out','pre_mix'].map((kind,i)=>({kind,time:new Date(+start-(5-i)*3600000),isPast:false,isActive:true,isDraggable:false,label:kind,cardTimeFormat:'absolute'}));
 for(const mode of ['simple','custom']) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Picker,{mode,startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:22,schedule,onChange(){},isSourdough:true,lastFedAge:'today',lastFedTime:new Date(+start-8*3600000),savedStarterEvents:events,sessionRestored:true,recipeGenerated:true})));
  assert.match(html,/aria-label="Your key times"/);
  assert.match(html,/aria-label="Edit Mix the dough, /);
  assert.doesNotMatch(html,/aria-orientation="horizontal"/); // editors open on demand
  assert.doesNotMatch(html,/bh-key-window/); // windows belong to the selected editor
  assert.match(html,/bh-schedule-timeline/);
  assert.match(html,/Tap a time to adjust it/);
  assert.doesNotMatch(html,/Unsaved proposal|compressed interval/);
  assert.doesNotMatch(html,/role="tab"/);
  assert.doesNotMatch(html,/Wait ·|compressed interval/);
  for(const label of ['Refresh feed','Refrigerate starter','Take starter out','Pre-mix feed'])assert.ok(html.includes(label),mode+': '+label);
 }
});
test('commercial preferment action remains available in the action view',()=>{
 const start=new Date(Date.now()+48*3600000),eat=new Date(+start+24*3600000);
 const schedule=utils.buildSchedule(start,eat,[],22,45,'hand','neapolitan');
 for(const mode of ['simple','custom']) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Picker,{mode,startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:22,schedule,onChange(){},prefermentType:'poolish',sessionRestored:true,recipeGenerated:true})));
  assert.match(html,/Poolish/);
 }
});

test('oven target keeps the saved cooking anchor rather than the later ready-to-eat time',()=>{
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(23,45,0,0);
 const start=new Date(+bake-26*3600000);
 for(const locale of ['fr','en'])for(const bakeType of ['pizza','bread'])for(const blocks of [[],[{from:new Date(+start+4*3600000),to:new Date(+start+5*3600000),label:'Busy'}]]){
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'UTC'},React.createElement(Picker,{startTime:start,eatTime:bake,blocks,preheatMin:45,styleKey:'neapolitan',kitchenTemp:22,bakeType,sessionRestored:true,recipeGenerated:true,readyTimeOffsetMinutes:90,readyTimeLabel:'Ready to eat',onChange(){}})));
  const date=`${bake.getFullYear()}-${String(bake.getMonth()+1).padStart(2,'0')}-${String(bake.getDate()).padStart(2,'0')}`;
  assert.match(html,/type="time"[^>]*value="23:45"/,'retains oven time across midnight with serving offset');
  assert.ok(html.includes(`value="${date}"`),'retains oven date');
  assert.ok(html.includes(locale==='fr'?(bakeType==='pizza'?'Quand enfourner la première pizza ?':'Quand enfourner le pain ?'):(bakeType==='pizza'?'When will the first pizza go into the oven?':'When will the bread go into the oven?')));
  assert.ok(html.indexOf('type="time"')<html.indexOf('aria-label="Your key times"')||locale==='fr','oven target precedes preparation controls');
 }
});

test('pan-cooked bread asks for cooking start and preserves its saved target',()=>{
 const bake=new Date(Date.now()+4*86400000);bake.setHours(19,30,0,0);
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Picker,{startTime:new Date(+bake-45*60000),eatTime:bake,blocks:[],preheatMin:10,styleKey:'piadina',kitchenTemp:22,bakeType:'bread',readyTimeOffsetMinutes:20,readyTimeLabel:'Ready to eat',onChange(){}})));
 assert.match(html,/When will you start cooking the piadinas/);
 assert.match(html,/value="[^"]+T19:30"/);
 assert.doesNotMatch(html,/Ready to eat/);
});
