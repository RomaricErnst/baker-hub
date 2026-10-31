require('node:test').mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-25T08:00Z')});
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
let choices=[],controls,replans=[];
const jsx=require('react/jsx-runtime');
for(const name of ['jsx','jsxs']){const original=jsx[name];jsx[name]=function(type,props,...args){if(props?.className==='bh-target-choices')choices=props.children;if(props?.['data-replan-method'])replans.push(props);return original(type,props,...args);};}
require('../app/components/ScheduleKeyTimings.tsx').default=props=>{controls=props;return null};
const Picker=require('../app/components/SchedulePicker.tsx').default;
const H=3600000,date=s=>new Date(s);
function render(extra={}){
 choices=[];controls=null;replans=[];const effects=[];
 const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T18:00Z');
 const props={mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:24,fridgeTemp:5,numItems:4,bakeType:'pizza',sessionRestored:true,onChange:(...args)=>effects.push(args),...extra};
 renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Picker,props)));
 return {props,choices,controls,effects,replans};
}

test('Not yet offers fully checked methods without writing until one is accepted',()=>{
 for(const mode of ['simple','custom'])for(const lead of [12,36,72,120]){
  const now=Date.now(),bake=new Date(now+lead*H),start=new Date(now-H),accepted=[];
  const view=render({mode,startTime:start,eatTime:bake,prefermentType:'biga',savedPrefOffsetHours:48,savedPrefGoesInFridge:true,replanRequested:true,onAcceptReplan:(...args)=>accepted.push(args)});
  assert.deepEqual(view.effects,[],'rendering options never changes the plan');assert.deepEqual(accepted,[]);
  assert.ok(view.replans.length>0,`${mode} ${lead}h has an option`);
  for(const choice of view.replans){
   choice.onClick();const [method,mix,target,hours,cold,blocks]=accepted.at(-1);
   assert.equal(+target,+bake);assert.ok(+mix-hours*H>now);assert.equal(choice['data-replan-method'],method);
   const agenda=utils.buildSchedule(mix,target,blocks,24,45,'hand','neapolitan',4);
   assert.equal(agenda.availabilityConflicts.length,0);assert.ok(!agenda.preparationInvalid);
   if(method==='none')assert.equal(hours,0);
   if(lead===12)assert.equal(method,'none','short lead does not promise unsupported preferment');
  }
 }
});
test('unanswered overdue plan does not offer or accept a replacement automatically',()=>{
 const view=render({startTime:new Date(Date.now()+H),prefermentType:'biga',savedPrefOffsetHours:48,savedPrefGoesInFridge:true});
 assert.deepEqual(view.replans,[]);assert.deepEqual(view.effects,[]);
});
test('confirmed preparation cannot offer a different method',()=>{
 const view=render({prefermentType:'biga',savedPrefOffsetHours:48,savedPrefGoesInFridge:true,replanRequested:true,execution:{method:'biga',actualAt:Date.now()-H,prefHours:48,inFridge:true}});
 assert.deepEqual(view.replans,[]);
});
test('unavailable whole-day schedules never appear as viable replacements',()=>{
 const view=render({startTime:new Date(Date.now()-H),eatTime:new Date(Date.now()+36*H),prefermentType:'biga',replanRequested:true,blocks:[{from:new Date(Date.now()),to:new Date(Date.now()+48*H),label:'Away'}]});
 assert.deepEqual(view.replans,[]);
});

test('bread and pizza style matrix respects method support, bake target and complete availability',()=>{
 const {getBreadProtocol}=require('../app/utils/breadProfiles.ts');
 const styles=['neapolitan','newyork','pizza_romana','roman','pan','baguette','pain_campagne','pain_complet','pain_seigle','pain_graines','brioche','pain_mie','pain_viennois','fougasse','bagel','pita','batbout'];
 for(const styleKey of styles)for(const kitchenTemp of [18,27,32])for(const lead of [10,36,120]){
  const now=Date.now(),bake=new Date(now+lead*H),accepted=[],profile=getBreadProtocol(styleKey);
  const view=render({styleKey,kitchenTemp,startTime:new Date(now-H),eatTime:bake,bakeType:['neapolitan','newyork','pizza_romana','roman','pan'].includes(styleKey)?'pizza':'bread',prefermentType:'biga',savedPrefOffsetHours:48,savedPrefGoesInFridge:true,replanRequested:true,onAcceptReplan:(...args)=>accepted.push(args)});
  for(const option of view.replans){
   option.onClick();const args=accepted.at(-1);assert.ok(args,`${styleKey} ${kitchenTemp}C ${lead}h`);
   const [method,mix,target,hours,cold,blocks]=args;
   if(profile)assert.ok(profile.supportedPreferments.includes(method),`${styleKey} cannot use ${method}`);
   assert.equal(+target,+bake);assert.ok(+mix-hours*H>now);
   const agenda=utils.buildSchedule(mix,target,blocks,kitchenTemp,45,'hand',styleKey,4);
   assert.equal(agenda.availabilityConflicts.length,0);assert.ok(!agenda.preparationInvalid);
  }
 }
});
test('sourdough feeding history never enters commercial-method replacement',()=>{
 const view=render({styleKey:'pain_levain',bakeType:'bread',isSourdough:true,prefermentType:'levain',replanRequested:true,planningMode:'know_peak',knownPeakTime:new Date('2026-10-29T18:00Z')});
 assert.deepEqual(view.replans,[]);assert.deepEqual(view.effects,[]);
});

test('confirmed preparation keeps future blockers active and supports multiple batches',()=>{
 const {validateConfirmedBake,commercialPrefermentWindow}=require('../app/components/SchedulePicker.tsx');
 const now=Date.now(),start=new Date(now+11*H),bake=new Date(now+36*H);
 const execution={method:'poolish',actualAt:now-H,recordedAt:now,inFridge:true,prefHours:12,prefWindow:commercialPrefermentWindow('poolish',true,24,'neapolitan',5),recipe:{}};
 const input={execution,start,bake,blocks:[],kitchenTemp:24,fridgeTemp:5,styleKey:'neapolitan',flourStrength:1,preheatMin:45,mixerType:'spiral',numItems:12,mixingBatches:2};
 assert.equal(validateConfirmedBake(input).valid,true);
 assert.equal(validateConfirmedBake({...input,blocks:[{from:new Date(now-2*H),to:new Date(now),label:'Previously away'}]}).valid,true,'actual work is not invalidated by a past blocker');
 assert.equal(validateConfirmedBake({...input,blocks:[{from:start,to:new Date(+start+H),label:'Future work'}]}).valid,false);
 assert.equal(validateConfirmedBake({...input,execution:{...execution,actualAt:+bake-H}}).valid,false,'late actual cannot silently move mixing after bake');
});
test('direct made confirmation never bypasses future action checks',()=>{
 const {validateConfirmedBake}=require('../app/components/SchedulePicker.tsx');
 const now=Date.now(),start=new Date(now-5*60000),bake=new Date(now+24*H);
 const input={execution:{method:'none',actualAt:+start,recordedAt:now,inFridge:false,prefHours:0,recipe:{}},start,bake,blocks:[],kitchenTemp:24,fridgeTemp:5,styleKey:'neapolitan',flourStrength:1,preheatMin:45,mixerType:'hand',numItems:4,mixingBatches:1};
 const baseline=validateConfirmedBake(input);assert.equal(baseline.valid,true);
 assert.equal(validateConfirmedBake({...input,blocks:[{from:new Date(+bake-H),to:bake,label:'Away'}]}).valid,false);
});

test('a stale proposal is rechecked on acceptance and never commits a past start',()=>{
 const now=Date.now(),accepted=[];
 const view=render({replanRequested:true,prefermentType:'biga',onAcceptReplan:(...args)=>accepted.push(args)});
 assert.ok(view.replans.length);
 require('node:test').mock.timers.setTime(Date.parse('2026-11-01T08:00Z'));
 try{view.replans[0].onClick();assert.deepEqual(accepted,[]);}finally{require('node:test').mock.timers.setTime(now);}
});

test('reopening mixed dough later keeps elapsed planned steps as history and still checks future work',()=>{
 const {validateConfirmedBake}=require('../app/components/SchedulePicker.tsx');
 const now=Date.now(),start=new Date(now-23*H),bake=new Date(now+2*H);
 const input={execution:{method:'none',actualAt:+start,recordedAt:now,inFridge:false,prefHours:0,recipe:{}},start,bake,blocks:[],kitchenTemp:24,fridgeTemp:5,styleKey:'neapolitan',flourStrength:1,preheatMin:45,mixerType:'hand',numItems:4,mixingBatches:1};
 assert.equal(validateConfirmedBake(input).valid,true,'elapsed planned actions do not invent another completion question');
 assert.equal(validateConfirmedBake({...input,blocks:[{from:new Date(+bake-H),to:bake,label:'Away'}]}).valid,false,'remaining preheat still matters');
});
