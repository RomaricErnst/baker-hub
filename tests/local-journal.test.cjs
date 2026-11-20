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

// 17 Nov 2026 retention review: with two bakes under way, home offers the one whose step is due.
test('the due bake is the one whose preferment, mix or bake is nearest now',()=>{
 const h=3600000,now=Date.UTC(2026,10,21,6);// Sat 07:00 Paris
 const baguette=J.recordGeneratedBake(bake({bakeType:'bread',styleKey:'baguette',eatTime:now+27*h,startTime:now+11.25*h,prefermentType:'poolish',prefOffsetH:11.25}),1000).entry;
 J.forgetCurrentJournalBake();
 const campagne=J.recordGeneratedBake(bake({bakeType:'bread',styleKey:'pain_campagne',eatTime:now+26.25*h,startTime:now+5.25*h,prefermentType:'none'}),2000).entry;
 assert.equal(J.dueJournalEntry(now).id,baguette.id,'7:00 poolish beats a 12:15 mix');
 assert.equal(J.dueJournalEntry(now+5.2*h).id,campagne.id,'at 12:10 the campagne mix is next');
 assert.equal(J.dueJournalEntry(now+11.25*h).id,baguette.id,'at 18:15 the baguette mix is due');
 assert.equal(J.dueJournalEntry(now+40*h),null,'nothing once both are over');
});

test('home lists every bake under way, one row each, by the step that is due (17 Nov 2026 retention round 2)',()=>{
 const h=3600000,t0=Date.UTC(2026,10,21,17,30);
 const steps=list=>({timelineSteps:list.map(([id,at,label])=>({id,time:t0+at*h,label}))});
 // Baguettes: cold proof overnight, out of the fridge at 7:00, bake 10:00. Campagne: shaping now, bake 9:30.
 const baguettes=J.recordGeneratedBake(bake({bakeType:'bread',styleKey:'baguette',eatTime:t0+16.5*h,computedRecipe:steps([['mixing',-2,'Pétrissage'],['bulk_ferm',-1.25,'Pointage'],['cold_2',3,'Apprêt froid'],['final_proof',13.5,'Sortir du frigo'],['eat',16.5,'Cuisson']])}),1000).entry;
 J.forgetCurrentJournalBake();
 const campagne=J.recordGeneratedBake(bake({bakeType:'bread',styleKey:'pain_campagne',eatTime:t0+16*h,computedRecipe:steps([['mixing',-6,'Pétrissage'],['autolyse',-5.9,'Repos'],['divide_ball',-0.25,'Façonnage'],['cold_2',0.25,'Apprêt froid'],['final_proof',13.5,'Apprêt'],['eat',16,'Cuisson']])}),2000).entry;
 J.forgetCurrentJournalBake();
 // A bake already marked baked, and one over two hours past its time, are not under way.
 J.recordGeneratedBake(bake({bakedDone:true,eatTime:t0+2*h}),3000);J.forgetCurrentJournalBake();
 const past=J.recordGeneratedBake(bake({eatTime:t0-3*h}),4000).entry;J.forgetCurrentJournalBake();
 let rows=J.liveJournalBakes(t0);
 // 20 Nov 2026 round 6: the bake over and unrated stays, after the bakes under way, as a row to rate.
 assert.deepEqual(rows.filter(r=>r.rate).map(r=>r.entry.id),[past.id]);
 rows=rows.filter(r=>!r.rate);
 const live=t=>J.liveJournalBakes(t).filter(r=>!r.rate);
 assert.deepEqual(rows.map(r=>[r.entry.id,r.label,r.current]),[[baguettes.id,'Pointage',true],[campagne.id,'Façonnage',true]],'steps under way, the earlier one first');
 // 23:00: both wait in the fridge; each row names its next step and time.
 rows=live(t0+5.5*h);
 assert.deepEqual(rows.map(r=>[r.entry.id,r.label,r.current,r.at]),[[campagne.id,'Apprêt',false,t0+13.5*h],[baguettes.id,'Sortir du frigo',false,t0+13.5*h]]);
 // Sunday 7:00: both out of the fridge at the same time: the bake that comes first leads.
 rows=live(t0+13.6*h);
 assert.deepEqual(rows.map(r=>r.label),['Apprêt','Sortir du frigo']);
 assert.ok(rows.every(r=>r.current));
 // The rest inside the mix belongs to the mix.
 J.forgetCurrentJournalBake();
 const mixing=J.recordGeneratedBake(bake({bakeType:'bread',styleKey:'baguette',eatTime:t0+20*h,computedRecipe:steps([['mixing',-0.5,'Pétrissage'],['autolyse',-0.3,'Repos'],['bulk_ferm',1,'Pointage'],['eat',20,'Cuisson']])}),5000).entry;
 assert.equal(live(t0).find(r=>r.entry.id===mixing.id).label,'Pétrissage');
 // Without saved steps: the next key time, unlabeled.
 J.forgetCurrentJournalBake();
 const bare=J.recordGeneratedBake(bake({eatTime:t0+30*h,startTime:t0+10*h,prefermentType:'none'}),6000).entry;
 const row=live(t0).find(r=>r.entry.id===bare.id);
 assert.equal(row.label,null);assert.equal(row.at,t0+10*h);
 assert.equal(live(t0+40*h).length,0,'nothing under way once all are over');
 assert.ok(J.liveJournalBakes(t0+40*h).every(r=>r.rate),'the unrated ones are to rate');
 assert.equal(J.liveJournalBakes(t0+120*h).length,0,'three days later, nothing');
});
