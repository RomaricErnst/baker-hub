const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const {buildItems,buildPhases}=require('../app/components/Timeline.tsx');
const {BREAD_PROTOCOLS}=require('../app/utils/breadProfiles.ts');
function props(style,lang='en'){
 const profile=BREAD_PROTOCOLS[style],start=new Date('2030-06-01T08:00Z'),bake=new Date('2030-06-02T18:00Z');
 const schedule=utils.buildSchedule(start,bake,[],22,profile.cooking==='griddle'?10:45,'hand',style);
 return {schedule,mixerType:'hand',styleKey:style,kitchenTemp:22,numItems:3,oil:0,hydration:65,locale:lang,onNavigateToFillings(){},recipe:{totalDough:600,flour:350,water:220,salt:7,oil:23,sugar:0,hydration:65,yeast:null,waterTemp:null}};
}
function render(style,lang,step,extra={}){
 const original=React.useState;
 // Render each selected step independently, without altering production props.
 React.useState=initial=>original(initial===1?step:initial);
 try{return renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:lang,messages:require('../messages/'+lang+'.json'),timeZone:'UTC'},React.createElement(Guide,{...props(style,lang),...extra})));}
 finally{React.useState=original;}
}
test('all new bread guides render bilingual protocol stages and fillings handoff',()=>{
 for(const style of Object.keys(BREAD_PROTOCOLS))for(const lang of ['en','fr']){
  let html='';for(let step=1;step<=10;step++)html+=render(style,lang,step);
  assert.doesNotMatch(html,/\{count\}|\{weight\}|undefined g/,style);
  assert.match(html,lang==='fr'?/Sandwiches et garnitures/:/Sandwiches &amp; fillings/,style);
  if(style!=='focaccia')assert.match(html,/200/,style+' uses actual scaled piece weight');
  if(style==='piadina'){
   assert.doesNotMatch(html,lang==='fr'?/Pointage|Apprêt|Préchauffer le four/:/Bulk Fermentation|Final Proof|Preheat Oven/);
   assert.match(html,lang==='fr'?/sans levure/:/unleavened/);
  }
 }
});

test('phase views preserve stage identities while cooking displays local numbering',()=>{
 for(const style of Object.keys(BREAD_PROTOCOLS)) {
  const sections=html=>[...html.matchAll(/<section\b([^>]*data-guide-phase[^>]*)>/g)].map(match=>({
   label:match[1].match(/aria-label="([^"]*)"/)[1],hidden:/\bhidden=""/.test(match[1]),phase:match[1].match(/data-guide-phase="([^"]*)"/)[1]
  }));
  const all=sections(render(style,'en',0)),prep=sections(render(style,'en',0,{phase:'preparation'})),cook=sections(render(style,'en',0,{phase:'cooking'}));
  assert.deepEqual(prep.map(s=>s.label),all.map(s=>s.label),style+' preparation retains identifiers');
  assert.deepEqual(cook.map(s=>s.label.replace(/ · Step \d+$/,'')),all.map(s=>s.label.replace(/ · Step \d+$/,'')),style+' cooking retains stage titles');
  const identities=html=>[...html.matchAll(/aria-controls="(bake-step-\d+)"/g)].map(match=>match[1]);
  assert.deepEqual(identities(render(style,'en',0,{phase:'cooking'})),identities(render(style,'en',0)),style+' cooking retains global element identifiers');
  cook.filter(s=>!s.hidden).forEach((s,index)=>assert.ok(s.label.endsWith(' · Step '+(index+1)),style+' local cooking number'));
  assert.ok(prep.some(s=>!s.hidden));assert.ok(cook.some(s=>!s.hidden));
  for(let i=0;i<all.length;i++) assert.notEqual(prep[i].hidden,cook[i].hidden,style+' exactly one destination owns '+all[i].label);
  const cooking=cook.filter(s=>!s.hidden).map(s=>s.label).join('|');
  assert.match(cooking,style==='piadina'||BREAD_PROTOCOLS[style].cooking==='griddle'?/Heat the griddle/:/Preheat/);
  assert.doesNotMatch(cooking,/Mix the dough|Mix Dough|Bulk Fermentation|Final Proof/);
  if(style==='bagel')assert.match(cooking,/Poach the bagels.*Bake the bagels.*Cool the bread/);
 }
});
test('bagel poaching, pocket pita and ciabatta instructions replace generic loaf advice',()=>{
 const full=style=>Array.from({length:10},(_,i)=>render(style,'en',i+1)).join('');
 assert.match(full('bagel'),/Poach a few bagels/);
 assert.match(full('pita'),/3–4 mm/);
 assert.match(full('ciabatta'),/do not roll into tight balls/);
 assert.doesNotMatch(full('ciabatta'),/Full poke test guide|Scoring technique/);
 assert.match(full('focaccia'),/Oil the tray/);
 assert.match(full('greek_pita'),/Heat the griddle/);
});
test('unleavened timeline has rest and griddle actions, without starter, proof or cold stages',()=>{
 const p=props('piadina');
 const items=buildItems(p.schedule,[],new Date('2030-06-01T08:00Z'),p.schedule.bakeStart,10,'hand',3,null,22,false,null,'none',false,null,50,10,k=>k,'bread','piadina','fr',200);
 assert.deepEqual(items.map(i=>i.stepKind),['mixing','rest_rt','divide_ball','preheat','eat']);
 assert.equal(items[1].label,'Repos couvert');
 assert.equal(items[4].label,'Cuire à la poêle');
});

test('unleavened summary names rest without implying proof and unsupported guides stop',()=>{
 const p=props('piadina');
 const phases=buildPhases({...p.schedule,doughMethod:'unleavened',restRtHours:.5},10,k=>k,3,'fr');
 assert.deepEqual(phases.map(p=>p.stepKind),['mixing','rest_rt']);
 assert.equal(phases[1].label,'Repos couvert');
 for(const protocolIssue of ['method','equipment','timing']) {
  const html=renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},React.createElement(Guide,{...p,recipe:{...p.recipe,protocolIssue}})));
  assert.match(html,/Adjust this bread before starting/);
  assert.doesNotMatch(html,/Next step|Cook and fill/);
 }
});

test('batbout semolina quantities reach both ingredient card and mixing guide',()=>{
 const schedule=utils.buildSchedule(new Date('2030-06-01T08:00Z'),new Date('2030-06-01T12:00Z'),[],22,10,'hand','batbout');
 const recipe=utils.calculateRecipe('batbout','griddle',6,100,22,'normal',schedule,6,'instant','simple','hand');
 const Output=require('../app/components/RecipeOutput.tsx').default;
 const wrap=child=>React.createElement(NextIntlClientProvider,{locale:'en',messages:require('../messages/en.json'),timeZone:'UTC'},child);
 const output=renderToStaticMarkup(wrap(React.createElement(Output,{result:recipe,numItems:6,itemWeight:100,styleName:'Batbout',styleKey:'batbout',mixerType:'hand',kitchenTemp:22,fermEquivHours:4,mode:'simple',bakeType:'bread'})));
 const guide=renderToStaticMarkup(wrap(React.createElement(Guide,{...props('batbout'),schedule,recipe,numItems:6})));
 for(const part of recipe.flourParts){
  assert.ok(output.includes(part.name));assert.ok(output.includes(`${part.grams} g`));
  assert.ok(guide.includes(part.name));assert.ok(guide.includes(`${part.grams} g`));
 }
});

test('bagel poaching is a timed step before oven loading, with no repeated poaching instruction',()=>{
 const p=props('bagel');
 assert.ok(p.schedule.poachStart);
 const items=buildItems(p.schedule,[],new Date('2030-06-01T08:00Z'),p.schedule.bakeStart,45,'hand',3,null,22,false,null,'none',false,null,60,0,k=>k,'bread','bagel','en',200);
 const poach=items.find(item=>item.stepKind==='poach'),oven=items.find(item=>item.stepKind==='eat');
 assert.equal(+poach.time,+p.schedule.poachStart);
 assert.equal(poach.durationH,p.schedule.poachMinutes/60);
 assert.equal(+oven.time,+p.schedule.bakeStart);
 assert.ok(+poach.time<+oven.time);
 assert.match(poach.tip,/Poach a few bagels/);
 assert.doesNotMatch(oven.tip,/Poach/);
 const proof=items.find(item=>item.stepKind==='final_proof');
 assert.ok(Math.abs(+proof.time+proof.durationH*3600000-(+p.schedule.poachStart))<1);
 const all=Array.from({length:10},(_,i)=>render('bagel','en',i+1)).join('');
 assert.equal((all.match(/Poach a few bagels/g)||[]).length,1);
 assert.match(all,/Poach the bagels/);assert.match(all,/Bake the bagels/);
});
