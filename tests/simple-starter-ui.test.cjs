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
const Picker=require('../app/components/SchedulePicker.tsx').default;
const messages=require('../messages/en.json');

test('Simple starter setup exposes readiness and kitchen facts without requiring feed controls; Custom retains them',()=>{
 const start=new Date(Date.now()+3600000), eat=new Date(Date.now()+36*3600000);
 for(const locale of ['en','fr']) for(const mode of ['simple','custom']) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'Asia/Singapore'},React.createElement(Picker,{startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:30,bakeType:'bread',isSourdough:true,mode,onChange:()=>{}})));
  const feedQuestion=locale==='en'?'Where has it been since last fed?':'Où était-il depuis son dernier repas ?';
  assert.equal(html.includes(feedQuestion),mode==='custom');
  if(mode==='simple') {
   assert.ok(html.includes(locale==='en'?'Yes, ready now':'Oui, il est prêt maintenant'));
   assert.ok(html.includes(locale==='en'?'Not yet / Not sure':'Pas encore / Je ne sais pas'));
   assert.ok(html.includes(locale==='en'?'equal weights of flour and water':'autant de farine que d’eau'));
   assert.ok(html.includes(locale==='en'?'Kitchen: 30':'Cuisine : 30'));
  }
 }
});

test('observed starter peak cannot be reused eleven hours later, including warm kitchens',()=>{
 const {knownPeakMixUsable}=require('../app/components/SchedulePicker.tsx');
 const peak=new Date('2026-09-23T08:07:00+08:00');
 for(const riseH of [4,8,14,20]) {
  assert.equal(knownPeakMixUsable(new Date(+peak+11*3600000),peak,riseH),false);
  assert.equal(knownPeakMixUsable(new Date(+peak+15*60000),peak,riseH),true);
 }
 assert.equal(knownPeakMixUsable(new Date(NaN),peak,14),false);
 assert.equal(knownPeakMixUsable(new Date(+peak+3600000),peak,0),false);
});

test('restored Simple known peak outside mix window renders a blocker instead of readiness',()=>{
 const peak=new Date(Date.now()+15*60000), start=new Date(+peak+11*3600000), eat=new Date(+start+24*3600000);
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'Asia/Singapore'},React.createElement(Picker,{startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:22,bakeType:'bread',isSourdough:true,mode:'simple',planningMode:'know_peak',knownPeakTime:peak,sessionRestored:true,onChange:()=>{}})));
 assert.ok(html.includes('Outside the estimated starter maturity window.'));
 assert.equal((html.match(/class="bh-key-note"/g)||[]).length,1,'one canonical warning instead of stale repeated messages');
});

test('Not sure keeps timing validity false until a replacement starter plan exists',()=>{
 const source=fs.readFileSync('app/components/SchedulePicker.tsx','utf8');
 const declaration=source.match(/const starterTimingValid =[\s\S]*?;/)[0];
 const vm=require('node:vm');
 const valid=patch=>vm.runInNewContext(declaration+'\nstarterTimingValid',{mode:'simple',simpleKnownPeakConflict:false,simpleStarterUncertain:true,solverResult:null,...patch});
 assert.equal(valid({}),false);
 assert.equal(valid({solverResult:{starterEvents:[]}}),false);
 assert.equal(valid({solverResult:{starterEvents:[{kind:'pre_mix'}]}}),true);
 assert.equal(valid({simpleKnownPeakConflict:true,solverResult:{starterEvents:[{kind:'known_peak'}]}}),false);
 assert.equal(valid({mode:'custom'}),true);
});

