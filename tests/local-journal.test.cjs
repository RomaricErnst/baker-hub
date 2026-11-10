const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
const J=require('../app/lib/localJournal.ts');
function storage(){const values=new Map();return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};}
const bake=(over={})=>({bakeType:'pizza',styleKey:'neapolitan',bakeName:'',numItems:4,itemWeight:260,kitchenTemp:24,eatTime:Date.UTC(2026,10,14,18),recipeGenerated:true,tab:'simple',...over});
beforeEach(()=>{global.localStorage=storage();});

test('a generated bake is added once and updated on regeneration with the same id',()=>{
 const first=J.recordGeneratedBake(bake(),1000).entry;
 assert.ok(first.id);assert.equal(first.numItems,4);assert.equal(first.kitchenTemp,24);assert.equal(first.session.version,1);
 J.updateJournalEntry(first.id,{rating:4,note:'Good oven spring'});
 const again=J.recordGeneratedBake(bake({numItems:6}),2000).entry;
 assert.equal(again.id,first.id);assert.equal(again.numItems,6);assert.equal(again.createdAt,1000);assert.equal(again.updatedAt,2000);
 assert.equal(again.rating,4);assert.equal(again.note,'Good oven spring','notes survive regeneration');
 assert.equal(J.listJournal().length,1);
});

test('starting a new bake keeps the earlier entry and creates a new one on the next generation',()=>{
 const a=J.recordGeneratedBake(bake(),1000).entry;
 assert.equal(J.forgetCurrentJournalBake(),a.id);
 const b=J.recordGeneratedBake(bake({styleKey:'pain_levain',bakeType:'bread'}),2000).entry;
 assert.notEqual(b.id,a.id);
 assert.deepEqual(J.listJournal().map(e=>e.id),[b.id,a.id]);
 assert.equal(J.currentJournalId(),b.id);
});

test('a bake without a bake type is not journalled',()=>{
 assert.equal(J.recordGeneratedBake(bake({bakeType:null})).entry,null);
 assert.equal(J.listJournal().length,0);
});

test('the journal keeps the newest 50 and reports the dropped ones for photo cleanup',()=>{
 let dropped=[];
 for(let i=0;i<52;i++){J.forgetCurrentJournalBake();const r=J.recordGeneratedBake(bake({numItems:i+1}),1000+i);dropped=dropped.concat(r.dropped);}
 const list=J.listJournal();
 assert.equal(list.length,J.JOURNAL_LIMIT);
 assert.equal(dropped.length,2);
 assert.deepEqual(dropped.map(e=>e.numItems).sort((x,y)=>x-y),[1,2],'oldest are dropped');
 assert.equal(list[0].numItems,52);
});

test('rating, note and photos are validated; delete removes the entry and clears the current id',()=>{
 const e=J.recordGeneratedBake(bake(),1000).entry;
 assert.equal(J.updateJournalEntry(e.id,{rating:7}).rating,null);
 assert.equal(J.updateJournalEntry(e.id,{rating:5}).rating,5);
 assert.equal(J.updateJournalEntry(e.id,{note:'x'.repeat(3000)}).note.length,J.JOURNAL_NOTE_LIMIT);
 assert.deepEqual(J.updateJournalEntry(e.id,{photoIds:['a','b','c','d']}).photoIds,['a','b','c']);
 assert.equal(J.updateJournalEntry('missing',{rating:3}),null);
 const removed=J.deleteJournalEntry(e.id);
 assert.deepEqual(removed.photoIds,['a','b','c']);
 assert.equal(J.listJournal().length,0);assert.equal(J.currentJournalId(),null);
 assert.equal(J.deleteJournalEntry(e.id),null);
});

test('progress refresh updates only an existing current entry',()=>{
 assert.equal(J.refreshCurrentJournalSnapshot(bake()),false,'no entry is created by a refresh');
 const e=J.recordGeneratedBake(bake(),1000).entry;
 assert.equal(J.refreshCurrentJournalSnapshot(bake({bakedDone:true}),3000),true);
 const stored=J.getJournalEntry(e.id);
 assert.equal(stored.session.bakedDone,true);assert.equal(stored.updatedAt,3000);
 assert.equal(J.refreshCurrentJournalSnapshot(bake({recipeGenerated:false})),false);
});

test('older and partial shapes are migrated; unreadable rows are dropped',()=>{
 const session={version:1,savedAt:500,...bake({bakeName:'Sunday'})};
 localStorage.setItem(J.JOURNAL_KEY,JSON.stringify([
  {id:'legacy',session},                                  // {id, session} rows from the earlier device list
  {id:'stringRating',session,rating:'3',photoIds:'nope'},
  {id:'broken',session:{version:2}},
  {session},
  'junk',
 ]));
 const list=J.listJournal();
 assert.deepEqual(list.map(e=>e.id).sort(),['legacy','stringRating']);
 const legacy=list.find(e=>e.id==='legacy');
 assert.equal(legacy.bakeName,'Sunday');assert.equal(legacy.createdAt,500);assert.equal(legacy.rating,null);assert.deepEqual(legacy.photoIds,[]);assert.equal(legacy.note,'');assert.equal(legacy.accountEventId,null);
 assert.equal(list.find(e=>e.id==='stringRating').rating,3);
 localStorage.setItem(J.JOURNAL_KEY,'{not json');
 assert.deepEqual(J.listJournal(),[]);
});

test('storage failures never throw (private mode, quota)',()=>{
 global.localStorage={getItem(){throw Error('SecurityError');},setItem(){throw Error('Quota');},removeItem(){throw Error('SecurityError');}};
 assert.deepEqual(J.listJournal(),[]);
 assert.equal(J.recordGeneratedBake(bake()).entry,null);
 assert.equal(J.updateJournalEntry('x',{rating:2}),null);
 assert.equal(J.deleteJournalEntry('x'),null);
 assert.equal(J.currentJournalId(),null);
 assert.doesNotThrow(()=>J.forgetCurrentJournalBake());
 const quota=storage();quota.setItem=()=>{throw Error('Quota');};global.localStorage=quota;
 assert.equal(J.recordGeneratedBake(bake()).entry,null);
 delete global.localStorage;
 assert.deepEqual(J.listJournal(),[]);
});

test('resume is offered for future and same-day bakes only',()=>{
 const now=Date.UTC(2026,10,10,12);
 assert.equal(J.journalBakeInProgress({eatTime:now+3600000},now),true);
 assert.equal(J.journalBakeInProgress({eatTime:now-3600000},now),true);
 assert.equal(J.journalBakeInProgress({eatTime:now-3*86400000},now),false);
 assert.equal(J.journalBakeInProgress({eatTime:null},now),true);
});
