const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.join(__dirname,'..',request.slice(2)):request,...args)};
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:filename}).outputText,filename);
const {utils}=require('./load-production.cjs');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{NextIntlClientProvider}=require('next-intl');
const Guide=require('../app/components/BakeGuide.tsx').default;
const {buildItems}=require('../app/components/Timeline.tsx');
const {foldActionLabel}=require('../app/utils/scheduleAvailability.ts');
const date=s=>new Date('2030-04-'+s+':00Z');
function items(s,style,locale='en'){return buildItems(s,[],date('02T16:30'),s.bakeStart,5,'hand',4,null,28,false,null,'none',false,null,62,0,k=>k,'bread',style,locale,140);}
function render(s,style,locale='en',step=1){
 const original=React.useState; React.useState=initial=>original(initial===1?step:initial);
 try { return renderToStaticMarkup(React.createElement(NextIntlClientProvider,{locale,messages:require('../messages/'+locale+'.json'),timeZone:'UTC'},React.createElement(Guide,{schedule:s,mixerType:'hand',styleKey:style,kitchenTemp:28,numItems:4,oil:0,hydration:62,locale}))); } finally { React.useState=original; }
}
test('room-temperature bulk ends at division, with minute-exact labels and preheat',()=>{
 for(const style of ['pita','greek_pita','neapolitan','baguette']) {
  const s=utils.buildSchedule(date('02T16:30'),date('02T19:30'),[],28,5,'hand',style,4);
  assert.equal(+s.bulkFermStart+s.bulkFermHours*3600000,+s.divideBallTime,style);
  assert.equal(+s.preheatStart,+s.bakeStart-5*60000,style);
  assert.ok(+s.finalProofStart>=+s.divideBallTime+s.divisionMinutes*60000,style);
 }
 assert.equal(utils.hoursLabel(95/60),'1h 35m');
 assert.equal(utils.hoursLabel(5/60),'5 min');
});
test('Greek pita has ordered division, 15 minute relaxation, rolling, then cooking in both displays',()=>{
 const s=utils.buildSchedule(date('02T16:30'),date('02T19:30'),[],28,5,'hand','greek_pita',4);
 assert.equal(+s.divideBallTime+s.divisionMinutes*60000,+s.finalProofStart);
 assert.equal(+s.finalProofStart+15*60000,+s.rollStart);
 assert.equal(+s.rollStart+10*60000,+s.bakeStart);
 assert.equal(+s.availabilityActions.find(a=>a.id==='roll').at,+s.rollStart);
 for(const lang of ['en','fr']){
  const list=items(s,'greek_pita',lang),proof=list.find(i=>i.id==='final_proof'),roll=list.find(i=>i.id==='roll');
  assert.equal(+proof.time,+s.finalProofStart);assert.equal(proof.durationH,.25);
  assert.equal(+roll.time,+s.rollStart);assert.equal(roll.durationH,10/60);
  const html=render(s,'greek_pita',lang);
  const titles=Array.from(html.matchAll(/data-guide-title="([^"]*)"/g),m=>m[1]);
  const expected=lang==='en'?['Divide and round','Relax the portions, covered','Roll and dock','Heat the griddle']:['Diviser et bouler','Détendre les pâtons, couverts','Étaler et piquer','Chauffer la poêle'];
  const order=expected.map(t=>titles.indexOf(t));assert.ok(order.every((n,i)=>n>=0&&(!i||n>order[i-1])),titles.join('|'));
  const rollHtml=render(s,'greek_pita',lang,5);assert.match(rollHtml,/5 mm/);assert.match(rollHtml,/18 cm/);
 }
 const conflict=utils.buildSchedule(date('02T16:30'),date('02T19:30'),[{from:date('02T19:22'),to:date('02T19:24'),label:'call'}],28,5,'hand','greek_pita',4);
 assert.ok(conflict.availabilityConflicts.some(c=>c.action.id==='roll'));
});
test('enriched final proof never starts during shaping, and guide agrees with agenda',()=>{
 for(const style of ['pain_viennois','pain_mie','brioche']){
  const s=utils.buildSchedule(date('02T08:00'),date('02T19:30'),[],22,45,'hand',style,4);
  const window=utils.finalProofWindow(s,4),p=items(s,style).find(i=>i.id==='final_proof');
  assert.ok(+window.start>=+s.divideBallTime+s.divisionMinutes*60000,style);
  assert.equal(+p.time,+window.start);assert.equal(p.durationH,window.hours);
  const html=render(s,style, 'en',0),section=html.split('data-guide-title="Let the shaped dough rise"')[1];
  assert.ok(section);assert.ok(section.split('</section>')[0].includes(utils.formatTime(window.start,'en-US')));
 }
});
test('seven-batch rejection and intervention list identify the same first-lot fold',()=>{
 const s=utils.buildSchedule(date('02T14:00'),date('02T18:00'),[],28,45,'stand','neapolitan',24,7);
 assert.ok(s.batchTimingConflict);assert.equal(s.preparationInvalid,true);
 const first=s.availabilityActions.find(a=>a.id==='fold-1');
 assert.equal(+first.at,+s.batchTimingConflict.firstFoldAt);
 assert.ok(s.availabilityActions.some(a=>a.id==='fold-1-batch-7'));
 assert.equal(foldActionLabel(first.id,'fr',7),'Lot 1 · Rabat 1');
 assert.equal(foldActionLabel('fold-1-batch-7','en',7),'Batch 7 · Fold 1');
});
test('piadina displayed covered rest reaches rolling instead of using a fixed 30 minutes',()=>{
 const s=utils.buildSchedule(date('02T18:00'),date('02T19:30'),[],22,5,'hand','piadina',4);
 const list=items(s,'piadina');assert.equal(list.find(i=>i.id==='rest').durationH,(+s.rollStart-+s.bulkFermStart)/3600000);
 assert.equal(list.find(i=>i.id==='divide').durationH,s.divisionMinutes/60);
});
