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
let controls;
const timing=require('../app/components/ScheduleKeyTimings.tsx');
timing.default=props=>{controls=props;return null};
function setup(extra={}){
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);const start=new Date(+bake-26*3600000);const effects=[];
 const props={mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:22,fridgeTemp:5,isSourdough:true,sessionRestored:true,recipeGenerated:true,planningMode:'know_peak',knownPeakTime:start,lastFeedRatio:1,ratioMode:'keep',onChange:(...a)=>effects.push(a),onStarterEventsChange:(...a)=>effects.push(a),...extra};
 renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Picker,props)));
 return {controls,start,bake,effects};
}
test('known-peak levain probe accepts a nearby mix, rejects a late mix and has no write effects',()=>{
 const {controls:c,start,bake,effects}=setup();assert.ok(c.check('mix',+start+900000));assert.equal(c.check('mix',+bake-3600000),false);assert.deepEqual(effects,[]);
});
test('room-temperature levain computes future feeds through the joint solver',()=>{
 const {controls:c,start,effects}=setup({planningMode:'last_fed',knownPeakTime:null,lastFedAge:'today',lastFedTime:new Date(Date.now()-3*3600000),starterLocation:'rt',nextFeedRatio:1});
 assert.ok(c.anchors.some(a=>a.id.startsWith('starter:')));assert.ok(c.check('mix',+start+900000));assert.deepEqual(effects,[]);
});
test('week-old refrigerated levain retains revival actions and validates the complete plan',()=>{
 const {controls:c,effects}=setup({planningMode:'last_fed',knownPeakTime:null,lastFedAge:'week',lastFedTime:new Date(Date.now()-8*86400000),starterLocation:'fridge',nextFeedRatio:1});
 assert.ok(c.anchors.some(a=>a.id.startsWith('starter:')));const mix=c.anchors.find(a=>a.id==='mix');assert.ok(c.check('mix',mix.at));assert.deepEqual(effects,[]);
});
