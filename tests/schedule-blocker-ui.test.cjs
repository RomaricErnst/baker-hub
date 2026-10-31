require('node:test').mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-25T08:00Z')});
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
let choices=[],controls;
const jsx=require('react/jsx-runtime');
for(const name of ['jsx','jsxs']){const original=jsx[name];jsx[name]=function(type,props,...args){if(props?.className==='bh-target-choices')choices=props.children;return original(type,props,...args);};}
require('../app/components/ScheduleKeyTimings.tsx').default=props=>{controls=props;return null};
const Picker=require('../app/components/SchedulePicker.tsx').default;
const H=3600000,date=s=>new Date(s);
function render(extra={}){
 choices=[];controls=null;const effects=[];
 const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T18:00Z');
 const props={mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:24,fridgeTemp:5,numItems:4,bakeType:'pizza',sessionRestored:true,onChange:(...args)=>effects.push(args),...extra};
 renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Picker,props)));
 return {props,choices,controls,effects};
}
test('a blocked Friday target offers validated later Friday times, not obsolete today presets',()=>{
 const originalNow=Date.now;Date.now=()=>Date.parse('2026-10-25T08:00Z');
 try{
  for(const mode of ['simple','custom']){
   const blocks=[];for(let day=26;day<=30;day++){
    blocks.push({from:date(`2026-10-${day}T09:00Z`),to:date(`2026-10-${day}T18:00Z`),label:'Work'});
    blocks.push({from:date(`2026-10-${day}T23:00Z`),to:date(`2026-10-${day+1}T07:00Z`),label:'Night'});
   }
   const view=render({mode,blocks});
   assert.ok(view.choices.length>0,mode);
   for(const choice of view.choices){
    assert.ok(Number(choice.key)>+view.props.eatTime,mode);
    assert.ok(Number(choice.key)<=+view.props.eatTime+6*H,mode);
    choice.props.onClick();
    const [start,bake,acceptedBlocks]=view.effects.at(-1);
    assert.equal(+bake,Number(choice.key));
    const s=utils.buildSchedule(start,bake,acceptedBlocks,24,45,'hand','neapolitan',4);
    assert.equal(s.availabilityConflicts.length,0,mode);
    assert.ok(!s.preparationInvalid,mode);
   }
  }
 }finally{Date.now=originalNow;}
});
test('levain pizza in both modes accepts repaired balling but rejects unavailable final warming',()=>{
 const originalNow=Date.now;Date.now=()=>Date.parse('2026-10-25T08:00Z');
 try{
  for(const mode of ['simple','custom'])for(const styleKey of ['neapolitan','newyork','pizza_romana'])for(const kitchenTemp of [22,30]){
   const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T18:00Z');
   const baseline=utils.buildSchedule(start,bake,[],kitchenTemp,45,'hand',styleKey,4);
   const blocks=[{from:new Date(+baseline.divideBallTime-5*60000),to:new Date(+baseline.divideBallTime+6*H),label:'Night'}];
   const args={mode,styleKey,kitchenTemp,isSourdough:true,planningMode:'know_peak',knownPeakTime:start,lastFeedRatio:1,ratioMode:'keep',blocks};
   const view=render(args);
   assert.equal(view.controls.check('mix',+start),true,`${mode} ${styleKey} ${kitchenTemp}`);
   const unavailable=render({...args,blocks:[...blocks,{from:new Date(+baseline.coldRetard2End-60000),to:bake,label:'Work'}]});
   assert.equal(unavailable.controls.check('mix',+start),false);
   assert.deepEqual([...view.effects,...unavailable.effects],[],'validation does not commit changes');
  }
 }finally{Date.now=originalNow;}
});
