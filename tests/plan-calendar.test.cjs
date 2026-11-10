const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {buildPlanCalendar,planActionLabel}=require('../app/utils/planCalendar.ts');

test('the plan exports as a calendar file with one alerted event per step, in order, plus the bake',()=>{
 const bake=new Date('2026-11-11T11:00:00Z');
 const ics=buildPlanCalendar({title:'Classic Neapolitan; party, 4',bakeAt:bake,bakeLabel:'Bake',now:new Date('2026-11-10T00:00:00Z'),events:[
  {at:new Date('2026-11-10T11:30:00Z'),label:'Fold 1'},
  {at:new Date('2026-11-10T09:00:00Z'),end:new Date('2026-11-10T09:25:00Z'),label:'Start Dough'},
 ]});
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
 assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,3);
 assert.equal((ics.match(/TRIGGER:PT0M/g)||[]).length,3);
 const starts=[...ics.matchAll(/DTSTART:(\S+)/g)].map(m=>m[1]);
 assert.deepEqual(starts,['20261110T090000Z','20261110T113000Z','20261111T110000Z']);
 assert.ok(ics.includes('DTEND:20261110T092500Z'),'a step with a duration keeps its end');
 assert.ok(ics.includes('DTEND:20261110T114000Z'),'a point step gets ten minutes');
 assert.ok(ics.includes('SUMMARY:Start Dough · Classic Neapolitan\\; party\\, 4'),'commas and semicolons are escaped');
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,'lines are folded at 75 octets');
 assert.equal(new Set([...ics.matchAll(/UID:(\S+)/g)].map(m=>m[1])).size,3);
});

test('scheduler action ids are named in the guide’s words, in both languages',()=>{
 assert.equal(planActionLabel('mix',false),'Start Dough');
 assert.equal(planActionLabel('mix',true),'Pétrir la pâte');
 assert.equal(planActionLabel('fold-3',true),'Rabat 3');
 assert.equal(planActionLabel('fold-2-batch-2',false),'Fold 2 (batch 2)');
 assert.equal(planActionLabel('divide',false,{singleLoaf:true}),'Shape the loaf');
 assert.equal(planActionLabel('cold-out-2',true),'Sortir les pâtons du réfrigérateur');
 assert.equal(planActionLabel('starter-feed',false),null,'starter and preferment steps are labelled from their own events');
});
