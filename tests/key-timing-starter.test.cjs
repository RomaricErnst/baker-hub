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
 const props={mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:22,fridgeTemp:5,isSourdough:true,sessionRestored:true,recipeGenerated:true,planningMode:'know_peak',knownPeakTime:start,lastFeedRatio:1,ratioMode:'keep',onChange:(...a)=>effects.push(a),onStarterEventsChange:(...a)=>effects.push(a),onStarterPeakTimeChange:(...a)=>effects.push(a),onFeedTimeChange:(...a)=>effects.push(a),onFeed2TimeChange:(...a)=>effects.push(a),onFridgeOutTimeChange:(...a)=>effects.push(a),...extra};
 renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'UTC'},React.createElement(Picker,props)));
 return {controls,start,bake,effects};
}
test('known-peak levain probe accepts a nearby mix, rejects a late mix and has no write effects',()=>{
 const {controls:c,start,bake,effects}=setup();assert.ok(c.check('mix',+start+900000));assert.equal(c.check('mix',+bake-3600000),false);assert.deepEqual(effects,[]);
});
test('room-temperature levain computes future feeds through the joint solver',()=>{
 const {controls:c,start,effects}=setup({planningMode:'last_fed',knownPeakTime:null,lastFedAge:'today',lastFedTime:new Date(Date.now()-3*3600000),starterLocation:'rt',nextFeedRatio:1});
 assert.ok(c.anchors.some(a=>a.id.startsWith('starter:')));assert.ok(c.check('mix',+start+900000));const feed=c.anchors.find(a=>a.id==='starter:pre_mix');assert.ok(feed);assert.ok(c.check(feed.id,feed.at+900000),'nearby feed retains mixing');assert.deepEqual(effects,[]);
});
test('feed windows may move automatic mixing but retain an explicit mixing pin',()=>{
 const params={planningMode:'last_fed',knownPeakTime:null,lastFedAge:'today',lastFedTime:new Date(Date.now()-3*3600000),starterLocation:'rt',nextFeedRatio:1};
 const automatic=setup(params),mix=automatic.controls.anchors.find(a=>a.id==='mix'),feed=automatic.controls.anchors.find(a=>a.id==='starter:pre_mix');
 assert.ok(feed&&mix);
 const pinned=setup({...params,startTime:automatic.start,eatTime:automatic.bake,timingOverrides:{mix:mix.at}});
 let expanded=false;
 for(let delta=900000;delta<=6*3600000&&!expanded;delta+=900000){
  for(const sign of [-1,1]){
   const at=feed.at+sign*delta;
   if(!pinned.controls.check(feed.id,at)&&automatic.controls.check(feed.id,at)){expanded=true;break;}
  }
 }
 assert.equal(expanded,true,'unpinning automatic mixing exposes at least one additional valid feed time');
 assert.deepEqual([...automatic.effects,...pinned.effects],[],'search remains read-only');
});
test('week-old refrigerated levain retains revival actions and validates the complete plan',()=>{
 const {controls:c,effects}=setup({planningMode:'last_fed',knownPeakTime:null,lastFedAge:'week',lastFedTime:new Date(Date.now()-8*86400000),starterLocation:'fridge',nextFeedRatio:1});
 assert.ok(c.anchors.some(a=>a.id.startsWith('starter:')));const mix=c.anchors.find(a=>a.id==='mix');assert.ok(c.check('mix',mix.at));assert.deepEqual(effects,[]);
});
test('optimized next-day levain slot probes complete without applying ratio changes',()=>{
 const bake=new Date(Math.ceil((Date.now()+29*3600000)/900000)*900000),start=new Date(+bake-26*3600000);const {controls:c,effects}=setup({eatTime:bake,startTime:start,planningMode:'last_fed',knownPeakTime:null,lastFedAge:'today',lastFedTime:new Date(Date.now()-2*3600000),starterLocation:'rt',nextFeedRatio:1,ratioMode:'recommend',blocks:[{from:new Date(+bake-20*3600000),to:new Date(+bake-12*3600000),label:'night'}]});
 let valid=0;for(const a of c.anchors.filter(a=>a.editable))for(let t=Math.ceil(a.from/900000)*900000;t<=a.to;t+=900000)if(c.check(a.id,t))valid++;
 assert.ok(valid>0,'optimized fixture includes a valid candidate');assert.deepEqual(effects,[]);
});


test('starter slot validation checks complete mixing duration and half-open boundaries',()=>{
 const {start,bake}=setup();
 const params={startTime:start,eatTime:bake,knownPeakTime:start,mixerType:'stand'};
 const plan=utils.buildSchedule(start,bake,[],22,45,'stand','neapolitan',2);
 const active=plan.availabilityActions.find(a=>a.id==='mix'&&a.end);
 assert.ok(active,'fixture has a modeled active mixing span');
 const before=setup({...params,blocks:[{from:new Date(+start-60000),to:start,label:'Ends at mix'}]});
 assert.equal(before.controls.check('mix',+start),true,'block end is free');
 const exact=setup({...params,blocks:[{from:start,to:new Date(+start+60000),label:'Starts at mix'}]});
 assert.equal(exact.controls.check('mix',+start),false,'block start is busy');
 const crossing=setup({...params,blocks:[{from:new Date(+active.at+60000),to:new Date(+active.end),label:'Crosses active mixing'}]});
 assert.equal(crossing.controls.check('mix',+start),false,'a clear start does not excuse an active-duration conflict');
 assert.deepEqual([...before.effects,...exact.effects,...crossing.effects],[]);
});

test('starter previews cannot discard or reschedule a historical preparation',()=>{
 const past=new Date(Date.now()-3600000);
 const {controls:c,start,effects}=setup({savedStarterEvents:[{kind:'refresh',time:past,isPast:true,isActive:false,isDraggable:false,label:'Completed refresh',cardTimeFormat:'absolute',bellStyle:'none',bellSigmaScale:1}]});
 const historical=c.anchors.find(a=>a.id.startsWith('starter:refresh')&&a.at===+past);assert.ok(historical,'past work remains visible');assert.equal(historical.editable,false);
 assert.equal(c.check('mix',+start+900000),false,'a recomputed plan without the historical action must not be approved');
 assert.deepEqual(effects,[]);
});

test('only explicitly kept final feeds constrain a subsequent mixing edit',()=>{
 const params={planningMode:'last_fed',knownPeakTime:null,lastFedAge:'today',lastFedTime:new Date(Date.now()-3*3600000),starterLocation:'rt',nextFeedRatio:1};
 const initial=setup(params),feed=initial.controls.anchors.find(a=>a.id==='starter:pre_mix');assert.ok(feed);
 const same={...params,startTime:initial.start,eatTime:initial.bake};
 const automatic=setup({...same,timingOverrides:{feed:feed.at}});
 const kept=setup({...same,timingOverrides:{feed:feed.at,feedLocked:true}});
 assert.equal(automatic.controls.anchors.find(a=>a.id==='starter:pre_mix').locked,false);
 assert.equal(kept.controls.anchors.find(a=>a.id==='starter:pre_mix').locked,true);
 assert.ok(kept.controls.anchors.find(a=>a.id==='mix').control,'keep control belongs to mixing');
 assert.equal(kept.controls.anchors.find(a=>a.id==='starter:pre_mix').control,undefined);
 let freed=false;
 for(let delta=900000;delta<=6*3600000&&!freed;delta+=900000){
  const at=+initial.start+delta;
  if(automatic.controls.check('mix',at)&&!kept.controls.check('mix',at))freed=true;
 }
 assert.equal(freed,true,'unkept feed recalculates to support a mixing time beyond the retained feed window');
 assert.deepEqual([...automatic.effects,...kept.effects],[],'checking remains read-only');
});


test('poolish keeping lives beside mixing and remains visible on the preparation row',()=>{
 const bake=new Date(Date.now()+3*86400000),start=new Date(+bake-12*3600000),pref=+start-14*3600000;
 const args={isSourdough:false,prefermentType:'poolish',savedPrefOffsetHours:14,startTime:start,eatTime:bake};
 const automatic=setup({...args,timingOverrides:{pref}}).controls;
 const kept=setup({...args,timingOverrides:{pref,prefLocked:true}}).controls;
 for(const c of [automatic,kept]){
  assert.equal(c.anchors.find(a=>a.id==='pref').control,undefined);
  const control=c.anchors.find(a=>a.id==='mix').control;assert.ok(control);
  assert.match(renderToStaticMarkup(control),/Keep the time of the poolish/);
 }
 assert.equal(automatic.anchors.find(a=>a.id==='pref').locked,false);
 assert.equal(kept.anchors.find(a=>a.id==='pref').locked,true);
 assert.match(renderToStaticMarkup(automatic.anchors.find(a=>a.id==='mix').control),/If you move mixing/);
 assert.match(renderToStaticMarkup(kept.anchors.find(a=>a.id==='mix').control),/Time kept/);
});
