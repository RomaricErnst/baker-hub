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
  assert.match(html,/aria-label="Adjust Mix the dough"/);
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
