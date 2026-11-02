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
let simple={};
for(const name of ['jsx','jsxs']){const original=jsx[name];jsx[name]=function(type,props,...args){if(props?.className==='bh-target-choices')choices=props.children;for(const key of ['data-simple-keep','data-simple-undo','data-simple-decision'])if(props&&key in props)simple[key]=props;return original(type,props,...args);};}
require('../app/components/ScheduleKeyTimings.tsx').default=props=>{controls=props;return null};
const Picker=require('../app/components/SchedulePicker.tsx').default;
const H=3600000,date=s=>new Date(s);
function render(extra={}){
 choices=[];controls=null;simple={};const effects=[];
 const start=date('2026-10-29T18:00Z'),bake=date('2026-10-30T19:00Z');
 const props={mode:'custom',startTime:start,eatTime:bake,blocks:[],preheatMin:45,styleKey:'neapolitan',kitchenTemp:24,fridgeTemp:5,numItems:4,bakeType:'pizza',sessionRestored:true,onChange:(...args)=>effects.push(args),...extra};
 renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:extra.locale??'en',messages:require(`../messages/${extra.locale??'en'}.json`),timeZone:'UTC'},React.createElement(Picker,props)));
 return {props,choices,controls,effects,simple};
}

function elements(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(elements);return [node,...elements(node.props?.children)];}
function control(view,label){return elements(view.controls?.notice).find(node=>node.type==='button'&&node.props.children===label);}
function work(end='18:00'){return [{from:date('2026-10-30T09:00Z'),to:date(`2026-10-30T${end}Z`),label:'Work'}];}
function fixed(fn){const old=Date.now;Date.now=()=>Date.parse('2026-10-25T08:00Z');try{fn();}finally{Date.now=old;}}
test('Simple shows one decision card: keep the bake with someone at home, then undo, never the step list',()=>fixed(()=>{
 for(const locale of ['fr','en']){
  const view=render({mode:'simple',locale,blocks:work()});
  assert.equal(renderToStaticMarkup(view.controls.notice??null),'','Simple never renders the detailed conflict notice');
  assert.deepEqual(view.controls.conflictRows,[],'Simple never lists steps to cover');
  assert.ok(view.simple['data-simple-decision'],'the decision card is shown');
  const keep=view.simple['data-simple-keep'];assert.ok(keep);keep.onClick();
  const [start,bake,blocks,options]=view.effects.at(-1);
  assert.equal(+start,+view.props.startTime);assert.equal(+bake,+view.props.eatTime);assert.equal(options.preservePlan,true);
  assert.ok(blocks[0].fridgeRemoval);
  const resumed=render({mode:'simple',locale,startTime:start,eatTime:bake,blocks});
  assert.equal(resumed.simple['data-simple-decision'],undefined,'a covered plan needs no decision');
  const undo=resumed.simple['data-simple-undo'];assert.ok(undo);undo.onClick();
  assert.ok(resumed.effects.at(-1)[2].every(b=>!b.fridgeRemoval));
 }
}));
test('fridge arrangement confirms and undoes one action while retaining the exact bake and blocker',()=>fixed(()=>{
 for(const mode of ['custom'])for(const locale of ['fr','en']){
  const view=render({mode,locale,blocks:work()});
  assert.equal(view.controls.header,undefined,'an automatic conflict does not offer reset');
  const html=renderToStaticMarkup(view.controls.notice);
  assert.match(html,/take dough out|sortie du réfrigérateur/i);
  assert.doesNotMatch(html,/bh-target-choices/,'The immediate cover action is available before the search resolves');
  const confirm=control(view,locale==='fr'?'Oui, cette étape est prévue':'Yes, this step is covered');assert.ok(confirm,`${mode} ${locale}`);
  confirm.props.onClick();const [start,bake,blocks,options]=view.effects.at(-1);
  assert.equal(+start,+view.props.startTime);assert.equal(+bake,+view.props.eatTime);assert.equal(options.preservePlan,true);
  assert.equal(+blocks[0].from,+view.props.blocks[0].from);assert.equal(+blocks[0].to,+view.props.blocks[0].to);
  assert.ok(blocks[0].fridgeRemoval);
  const resumed=render({mode,locale,startTime:start,eatTime:bake,blocks});
  assert.equal(resumed.controls.anchors.find(a=>a.id==='mix').valid,true);
  assert.equal(control(resumed,locale==='fr'?'Oui, cette étape est prévue':'Yes, this step is covered'),undefined);
  assert.doesNotMatch(renderToStaticMarkup(resumed.controls.notice),/bh-resolution-or|bh-target-choices/);
  const undo=control(resumed,locale==='fr'?'Annuler':'Undo');assert.ok(undo);undo.props.onClick();
  const [undoStart,undoBake,undoBlocks]=resumed.effects.at(-1);assert.equal(+undoStart,+start);assert.equal(+undoBake,+bake);
  assert.ok(undoBlocks.every(b=>!b.fridgeRemoval));
  assert.equal(render({mode,locale,blocks:undoBlocks}).controls.anchors.find(a=>a.id==='fridge-removal').valid,false);
 }
}));
test('preheating conflict is visible before confirmation and remains blocking afterward',()=>fixed(()=>{
 const view=render({blocks:work('18:30')});
 const html=renderToStaticMarkup(view.controls.notice);assert.match(html,/Other steps during your unavailable hours/);assert.match(html,/Preheat/);assert.doesNotMatch(html,/bh-resolution-or/);
 control(view,'Yes, this step is covered').props.onClick();
 const blocks=view.effects.at(-1)[2],resumed=render({blocks});
 assert.equal(resumed.controls.anchors.find(a=>a.id==='mix').valid,false);
 assert.match(renderToStaticMarkup(resumed.controls.notice),/Preheat/);
 assert.ok(control(resumed,'Undo'));
}));
test('no confirmation for a bulk fridge exit or a schedule without blocked final removal',()=>fixed(()=>{
 const blocks=[{from:date('2026-10-30T00:00Z'),to:date('2026-10-30T02:00Z'),label:'Away'}];
 for(const extra of [{blocks:[]},{blocks},{blocks:work(),styleKey:'piadina'}]){
  const view=render(extra);assert.equal(control(view,'Yes, this step is covered'),undefined);
 }
}));
test('levain uses the same confirmation and retains its known-peak plan',()=>fixed(()=>{
 for(const mode of ['simple','custom']){
  const args={mode,isSourdough:true,planningMode:'know_peak',knownPeakTime:date('2026-10-29T18:00Z'),lastFeedRatio:1,ratioMode:'keep',savedStarterEvents:[{kind:'known_peak',time:date('2026-10-29T18:00Z'),label:'Known peak',isDraggable:false}],blocks:work()};
  const view=render(args);const confirm=mode==='simple'?{props:view.simple['data-simple-keep']}:control(view,'Yes, this step is covered');assert.ok(confirm?.props);confirm.props.onClick();
  const [start,bake,blocks]=view.effects.at(-1);assert.equal(+start,+view.props.startTime);assert.equal(+bake,+view.props.eatTime);
  const resumed=render({...args,blocks});assert.ok(mode==='simple'?resumed.simple['data-simple-undo']:control(resumed,'Undo'));assert.equal(resumed.controls.anchors.find(a=>a.id==='mix').valid,true,renderToStaticMarkup(resumed.controls.notice));
 }
}));

// Selecting a later bake requires the mounted asynchronous search. The
// scheduling-feedback WebKit spec covers this interaction in both locales
// and modes and checks the stored bake, blocks and cleared arrangement.
