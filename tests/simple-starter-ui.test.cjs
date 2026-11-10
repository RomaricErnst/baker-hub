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

test('Simple asks about the starter on its own screen, so the bake-time picker asks nothing; Custom retains its questions',()=>{
 const start=new Date(Date.now()+3600000), eat=new Date(Date.now()+36*3600000);
 for(const locale of ['en','fr']) for(const mode of ['simple','custom']) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'Asia/Singapore'},React.createElement(Picker,{startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:30,bakeType:'bread',isSourdough:true,mode,onChange:()=>{}})));
  const feedQuestion=locale==='en'?'Where has it been since last fed?':'Où était-il depuis son dernier rafraîchi ?';
  assert.equal(html.includes(feedQuestion),mode==='custom');
  for(const old of locale==='en'?['Yes, ready now','Not yet','Other timing / starter details']:['Oui, il est prêt maintenant','Pas encore','Autre horaire / détails du levain'])
   assert.ok(!html.includes(old),old);
 }
});

test('the Simple screen and its answer: one question, nothing pre-selected, safe assumptions for the solver',()=>{
 const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
 for(const text of ['Where is your starter now?','Où est votre levain en ce moment ?','On the counter','Sur le plan de travail','In the fridge','Au réfrigérateur','It’s bubbly and risen right now','Il est bien monté et bullé en ce moment','Your starter →','Votre levain →'])
  assert.ok(source.includes(text),text);
 assert.match(source,/useState<'counter'\|'fridge'\|'ready'\|null>\(null\)/,'no answer is pre-selected');
 const apply=source.match(/function applySimpleStarterAnswer[\s\S]*?\n  \}/)[0];
 assert.match(apply,/answer==='counter'\?24:196/,'counter is a day old, fridge about a week');
 assert.match(apply,/setLastFedAge\(answer==='counter'\?'yesterday':'week'\)/);
 assert.match(apply,/setPlanningMode\('know_peak'\)/,'bubbly now is the ready-now path');
});

test('an assumed last feed is never shown as something the baker said',()=>{
 const start=new Date(Date.now()+8*3600000), eat=new Date(+start+20*3600000);
 const fed=new Date(Date.now()-196*3600000);
 for(const answer of [null,'fridge']){
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'Asia/Singapore'},React.createElement(Picker,{startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:22,bakeType:'bread',isSourdough:true,mode:'simple',simpleStarterAnswer:answer,starterLocation:'fridge',planningMode:'last_fed',lastFedAge:'week',lastFedTime:fed,
   savedStarterEvents:[{kind:'last_fed',time:fed,isPast:true,isActive:false,isDraggable:false,label:'Last fed',cardTimeFormat:'absolute',bellStyle:'none',bellSigmaScale:1,assumed:answer?true:undefined}],onChange:()=>{}})));
  if(answer)assert.ok(!html.includes('Last fed'),'assumed feed hidden');
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

test('restored Simple known peak outside mix window plans one more refresh instead of a dead end',()=>{
 const peak=new Date(Date.now()+15*60000), start=new Date(+peak+11*3600000), eat=new Date(+start+24*3600000);
 const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages,timeZone:'Asia/Singapore'},React.createElement(Picker,{startTime:start,eatTime:eat,blocks:[],preheatMin:45,styleKey:'pain_levain',kitchenTemp:22,bakeType:'bread',isSourdough:true,mode:'simple',planningMode:'know_peak',knownPeakTime:peak,sessionRestored:true,onChange:()=>{}})));
 // A ready starter cannot wait eleven hours: the plan is rebuilt from the feed behind that peak.
 assert.ok(html.includes('the plan refreshes it once more so it peaks when you mix'));
 assert.ok(!html.includes('peaks naturally around mix time'),'never reports the stale peak as ready');
 assert.ok(!html.includes('cannot keep your chosen times'));
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
