const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {buildPlanCalendar,planActionLabel,keyPlanEvents,mergeCloseEvents}=require('../app/utils/planCalendar.ts');
const at=(h,m=0)=>new Date(Date.UTC(2026,10,10,h,m));

test('the calendar keeps only key steps: mixing absorbs autolyse and resumed kneading, folds are one event',()=>{
 const actions=[
  {id:'autolyse',at:at(9),end:at(9,5)},{id:'mix',at:at(9,30),end:at(9,32)},{id:'mix-finish',at:at(10,2),end:at(10,6)},
  {id:'fold-1',at:at(10,30)},{id:'fold-2',at:at(11)},{id:'fold-3',at:at(11,30)},
  {id:'cold-in',at:at(13)},{id:'cold-out',at:at(20)},{id:'divide',at:at(20,0)},{id:'preheat',at:at(22)},
 ];
 const events=keyPlanEvents(actions,false);
 assert.deepEqual(events.map(e=>e.key),['mix','folds','cold-in','cold-out','divide','preheat']);
 assert.equal(events[0].label,'Autolyse, then Start Dough');
 assert.equal(+events[0].at,+at(9));assert.equal(+events[0].end,+at(10,6));
 assert.equal(events[1].label,'Stretch and folds (3), every 30 min');
 assert.equal(events.find(e=>e.key==='cold-out').alertBeforeMin,10,'fridge exit alerts early');
 assert.equal(events.find(e=>e.key==='preheat').alertBeforeMin,10,'preheat alerts early');
 assert.equal(events.find(e=>e.key==='cold-in').alertBeforeMin,0);
 assert.equal(keyPlanEvents(actions,true)[1].label,'Rabats (3), toutes les 30 min');
});

test('batches collapse into one mixing event and one fold event; past steps are dropped',()=>{
 const actions=[
  {id:'mix',at:at(9),end:at(9,11)},{id:'mix-batch-2',at:at(9,11),end:at(9,22)},{id:'mix-batch-3',at:at(9,22),end:at(9,33)},
  {id:'fold-1',at:at(9,33)},{id:'fold-1-batch-2',at:at(9,44)},{id:'fold-1-batch-3',at:at(9,55)},
  {id:'cold-in',at:at(12)},
 ];
 const events=keyPlanEvents(actions,false,{from:+at(9,40)});
 assert.deepEqual(events.map(e=>e.key),['folds','cold-in'],'mixing is over, so it is not exported');
 assert.equal(events[0].label,'Stretch and folds (1)');
});

test('steps a few minutes apart share one event with one alert',()=>{
 const merged=mergeCloseEvents([
  {key:'cold-out',at:at(20),label:'Take the dough out of the fridge',alertBeforeMin:10},
  {key:'divide',at:at(20,5),label:'Divide and shape'},
  {key:'preheat',at:at(22),label:'Preheat the oven',alertBeforeMin:10},
 ]);
 assert.equal(merged.length,2);
 assert.equal(merged[0].label,'Take the dough out of the fridge · Divide and shape');
 assert.equal(merged[0].alertBeforeMin,10);
});

test('the file has one alerted event per key step, stable ids for the bake, and early alerts where needed',()=>{
 const bake=at(23);
 const make=now=>buildPlanCalendar({title:'Classic Neapolitan; party, 4',bakeAt:bake,bakeLabel:'Bake',bakeId:'bake-abc',now,events:[
  {key:'mix',at:at(9),end:at(9,25),label:'Start Dough'},
  {key:'cold-out',at:at(20),label:'Take the dough out of the fridge',alertBeforeMin:10},
 ]});
 const ics=make(new Date('2026-11-10T00:00:00Z'));
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,3);
 assert.equal((ics.match(/BEGIN:VALARM/g)||[]).length,3,'one alert per event');
 assert.deepEqual([...ics.matchAll(/TRIGGER:(\S+)/g)].map(m=>m[1]),['PT0M','-PT10M','PT0M']);
 assert.deepEqual([...ics.matchAll(/UID:(\S+)/g)].map(m=>m[1]),['bake-abc-mix@bakerhub.app','bake-abc-cold-out@bakerhub.app','bake-abc-bake@bakerhub.app']);
 assert.ok(ics.includes('DTEND:20261110T092500Z'));
 assert.ok(ics.includes('SUMMARY:Start Dough · Classic Neapolitan\\; party\\, 4'));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const later=make(new Date('2026-11-10T03:00:00Z'));
 const seq=s=>Number(/SEQUENCE:(\d+)/.exec(s)[1]);
 assert.ok(seq(later)>seq(ics),'a later export of the same bake carries a higher sequence');
 assert.deepEqual([...later.matchAll(/UID:(\S+)/g)].map(m=>m[1]),[...ics.matchAll(/UID:(\S+)/g)].map(m=>m[1]),'same ids, so calendars update instead of duplicating');
});

test('scheduler action ids are named in the guide’s words, in both languages',()=>{
 assert.equal(planActionLabel('mix',false),'Start Dough');
 assert.equal(planActionLabel('mix',true),'Pétrir la pâte');
 assert.equal(planActionLabel('fold-3',true),'Rabat 3');
 assert.equal(planActionLabel('divide',false,{singleLoaf:true}),'Shape the loaf');
 assert.equal(planActionLabel('divide',false,{panStyle:true}),'Divide and press into the pans');
 assert.equal(planActionLabel('cold-out-2',true),'Sortir les pâtons du réfrigérateur');
 assert.equal(planActionLabel('starter-feed',false),null);
});
