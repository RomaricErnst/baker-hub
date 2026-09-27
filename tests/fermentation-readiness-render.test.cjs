const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), Module=require('node:module');
const ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {NextIntlClientProvider}=require('next-intl');
const {default:Readiness}=require('../app/components/FermentationReadiness.tsx');
const {default:Picker}=require('../app/components/SchedulePicker.tsx');
const bake=new Date('2030-06-04T18:00:00Z');
const date=h=>new Date(+bake-h*3600000);
const base={isFr:false,mixTime:date(20),bakeTime:bake,windowFrom:date(34),windowTo:date(8),isSourdough:false,prefermentType:'none',starterPeak:null,starterState:null,blocked:false,overdue:false,busy:false,kitchenTemp:30,fridgeTemp:5,onEditMix(){},onEditBake(){},canEdit:true};
const render=overrides=>renderToStaticMarkup(React.createElement(Readiness,{...base,...overrides}));
test('window statuses identify mixing direction and correct it without a maturity guarantee',()=>{
 assert.match(render({mixTime:date(40)}),/Before the recommended window/);
 assert.match(render({mixTime:date(40)}),/Mix later while keeping your bake time/);
 assert.match(render({mixTime:date(2)}),/After the recommended window/);
 assert.match(render({mixTime:date(2)}),/Mix earlier while keeping your bake time/);
 assert.match(render({}),/Within the window/);
 assert.doesNotMatch(render({}),/Adjust mixing time/);
 assert.match(render({isFr:true,mixTime:date(2)}),/Après le créneau conseillé/);
});
test('blocked, overdue, missing, started and unsupported plans never show a green window',()=>{
 for(const props of [{blocked:true},{overdue:true},{windowFrom:null},{unavailableReason:'started'},{unavailableReason:'unsupported'}]){
  const html=render(props);
  assert.doesNotMatch(html,/Within the window|background:#abb49a/);
 }
 assert.match(render({blocked:true}),/Adjust bake time/);
 assert.doesNotMatch(render({unavailableReason:'started'}),/Adjust mixing time/);
 assert.doesNotMatch(render({unavailableReason:'unsupported'}),/Adjust bake time/);
});
test('preferments retain distinct guidance and starter uncertainty is not interpreted as immaturity',()=>{
 assert.match(render({prefermentType:'biga'}),/aerated interior/);
 assert.match(render({prefermentType:'poolish'}),/Check maturity at mixing/);
 const html=render({isSourdough:true,prefermentType:'levain',starterPeak:date(21),starterState:'yellow'});
 assert.match(html,/Estimated peak/);
 assert.doesNotMatch(html,/Starter too early|Starter too late|Starter ready/);
 assert.doesNotMatch(render({busy:true}),/Adjust mixing time/);
});
test('real picker restores commercial timing in both modes and suppresses unsupported enriched combinations',()=>{
 const start=date(20), schedule=utils.buildSchedule(start,bake,[],22,45,'hand','neapolitan');
 for(const mode of ['simple','custom']){
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Picker,{mode,startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:22,schedule,onChange(){},sessionRestored:true,savedPrefOffsetHours:0})));
  assert.match(html,/Your key times/);assert.doesNotMatch(html,/Your mixing window|Within the window/);
 }
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Picker,{mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'brioche',kitchenTemp:22,schedule,onChange(){},sessionRestored:true,prefermentType:'poolish',savedPrefOffsetHours:12})));
 assert.match(html,/Window not calculated/);assert.doesNotMatch(html,/Within the window/);
});

test('availability conflict stays neutral without inventing a maturity failure',()=>{
 const html=render({busy:true,onReviewAvailability(){}});
 assert.match(html,/Timing needs adjusting/);
 assert.match(html,/Review my availability/);
 assert.doesNotMatch(html,/✓|background:#e6eadf|Before the recommended window|After the recommended window/);
});

test('picker catches preheat and shaping conflicts but permits passive cold time',()=>{
 const start=date(26), schedule=utils.buildSchedule(start,bake,[],22,60,'hand','neapolitan');
 const picker=blocks=>renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Picker,{mode:'custom',startTime:start,eatTime:bake,blocks,preheatMin:60,styleKey:'neapolitan',kitchenTemp:22,schedule,onChange(){},sessionRestored:true,savedPrefOffsetHours:0})));
 for(const at of [schedule.preheatStart,schedule.divideBallTime]){
  assert.match(picker([{from:at,to:new Date(+at+60000),label:'Busy'}]),/overlaps|unavailable/);
 }
 const coldStart=schedule.coldRetard1Start??schedule.coldRetardStart;
 const coldEnd=schedule.coldRetard1End??schedule.coldRetardEnd;
 assert.ok(coldStart&&coldEnd&&+coldEnd-+coldStart>7200000);
 const middle=new Date((+coldStart + +coldEnd)/2);
 assert.doesNotMatch(picker([{from:new Date(+middle-60000),to:new Date(+middle+60000),label:'Passive cold'}]),/Timing needs adjusting/);
});

test('compact schedule stays quiet until an edit or an actual problem',()=>{
 assert.equal(render({compact:true}), '');
 assert.doesNotMatch(render({compact:true,showRange:true}),/Within the window|Time kept/);
 assert.match(render({compact:true,showConfirmation:true}),/Time kept within/);
 assert.match(render({compact:true,busy:true,conflictDescription:'Preheat overlaps work'}),/Preheat overlaps work/);
 assert.match(render({compact:true,blocked:true}),/Review this plan/);
});

test('compact early mixing keeps its own explanation when another conflict exists',()=>{
 const html=render({compact:true,busy:true,mixTime:date(50),conflictDescription:'Preheat overlaps work'});
 assert.match(html,/Fermentation is longer than advised/);
 assert.doesNotMatch(html,/Preheat overlaps work/);
});
