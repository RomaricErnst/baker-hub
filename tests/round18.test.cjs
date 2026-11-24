// Round 18 (24 Nov 2026): home rows (H1), delete with Undo (H3), the stale-tab reload (H5).
const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
require('./load-production.cjs');
const Module=require('node:module');
const J=require('../app/lib/localJournal.ts');
const deletedPhotos=[];
const load=Module._load;Module._load=function(id,...a){return id==='./journalPhotos'?{deleteJournalPhotos:async ids=>{deletedPhotos.push(...ids);}}:load.call(this,id,...a);};
const R=require('../app/lib/journalRemoval.ts');
Module._load=load;
const D=require('../app/hooks/useReloadOnNewDeployment.ts');
function storage(){const values=new Map();return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;},values};}
beforeEach(()=>{global.localStorage=storage();R.finalizeJournalRemoval();});
const H=3600000,NOW=Date.UTC(2026,10,24,10);
const session=(over={})=>({version:1,savedAt:NOW,tab:'simple',bakeType:'pizza',styleKey:'neapolitan',bakeName:'',numItems:4,itemWeight:260,kitchenTemp:24,prefermentType:'none',startTime:NOW+20*H,eatTime:NOW+30*H,recipeGenerated:true,...over});
const entry=(id,updatedAt,over={})=>({v:1,id,createdAt:updatedAt,updatedAt,bakeType:'pizza',styleKey:'neapolitan',bakeName:'',numItems:4,itemWeight:260,kitchenTemp:24,eatTime:NOW+30*H,session:session(over),rating:null,note:'',photoIds:[],accountEventId:null});
const seed=rows=>localStorage.setItem(J.JOURNAL_KEY,JSON.stringify(rows));

test('H1: three restarted plans → the newest and "2 more planned"; a started bake stays',()=>{
 seed([entry('a',NOW-3*H),entry('b',NOW-2*H),entry('c',NOW-H)]);
 let home=J.homeJournalRows(J.liveJournalBakes(NOW),NOW);
 assert.deepEqual(home.rows.map(r=>r.entry.id),['c']);assert.equal(home.hidden,2);
 // 'a' started: its first step's time has come.
 seed([entry('a',NOW-3*H,{startTime:NOW-H,eatTime:NOW+5*H}),entry('b',NOW-2*H),entry('c',NOW-H)]);
 home=J.homeJournalRows(J.liveJournalBakes(NOW),NOW);
 assert.deepEqual(home.rows.map(r=>r.entry.id).sort(),['a','c']);assert.equal(home.hidden,1);
 // Something recorded, a guide tick, or a starter feed due counts as started.
 assert.ok(J.journalBakeStarted(entry('x',0,{mixExecution:{actualAt:NOW,plannedAt:NOW}}),NOW));
 assert.ok(J.journalBakeStarted(entry('y',0,{yeastType:'sourdough',starterEvents:[{kind:'last_fed',time:NOW-90*H},{kind:'refresh',time:NOW-H}]}),NOW));
 assert.ok(!J.journalBakeStarted(entry('z',0,{yeastType:'sourdough',starterEvents:[{kind:'last_fed',time:NOW-90*H},{kind:'refresh',time:NOW+5*H}]}),NOW));
 // A fridge starter comes out before its first feed.
 assert.ok(J.journalBakeStarted(entry('w',0,{yeastType:'sourdough',starterLocation:'fridge',starterEvents:[{kind:'refresh',time:NOW+0.5*H}]}),NOW));
 localStorage.setItem('bh_guide_done_v2:'+JSON.stringify({bake:'v'})+':plan',JSON.stringify({locale:'en',steps:[{step:1,at:NOW+H,done:true,title:'Start Dough'}]}));
 assert.ok(J.journalBakeStarted(entry('v',0),NOW));
 // Rule B: one bake → the rows as they are.
 seed([entry('a',NOW-3*H)]);home=J.homeJournalRows(J.liveJournalBakes(NOW),NOW);
 assert.equal(home.rows.length,1);assert.equal(home.hidden,0);
 assert.match(fs.readFileSync('app/[locale]/page.tsx','utf8'),/rows\.length === 1 && rows\[0\]\.entry\.id === currentJournalId\(\) && draftShown \? \[\]/);
});

test('H3: delete is immediate; Undo restores the entry, its guide keys and the draft; photos go only once Undo is gone',async()=>{
 seed([entry('a',NOW-2*H,{}),{...entry('b',NOW-H),photoIds:['p1']}]);
 const key='bh_guide_done_v2:'+JSON.stringify({bake:'b'});
 localStorage.setItem(key,'[1]');localStorage.setItem(key+':plan','{}');localStorage.setItem('bh_guide_done_v2:'+JSON.stringify({bake:'a'}),'[2]');
 J.setCurrentJournalId('b');localStorage.setItem('bh_session_v1',JSON.stringify(session({bakeName:'Draft'})));
 const removal=R.removeJournalBake('b');
 assert.equal(removal.entry.id,'b');assert.equal(removal.session.bakeName,'Draft');
 assert.deepEqual(J.listJournal().map(e=>e.id),['a']);
 assert.equal(localStorage.getItem(key),null);assert.equal(localStorage.getItem(key+':plan'),null);
 assert.equal(localStorage.getItem('bh_guide_done_v2:'+JSON.stringify({bake:'a'})),'[2]','another bake keeps its ticks');
 assert.equal(J.currentJournalId(),null);
 assert.deepEqual(deletedPhotos,[],'photos wait while Undo is offered');
 R.undoJournalRemoval();
 assert.deepEqual(J.listJournal().map(e=>e.id).sort(),['a','b']);assert.equal(localStorage.getItem(key),'[1]');assert.equal(J.currentJournalId(),'b');
 assert.equal(R.pendingJournalRemoval(),null);
 // The next navigation ends Undo.
 R.noteJournalNavigation('page','home');R.removeJournalBake('a');R.noteJournalNavigation('page','home');
 assert.ok(R.pendingJournalRemoval());R.noteJournalNavigation('page','bake');assert.equal(R.pendingJournalRemoval(),null);
 R.noteJournalNavigation('page','home');R.removeJournalBake('b');R.finalizeJournalRemoval();assert.deepEqual(deletedPhotos,['p1']);
 // The sheet: no question before deleting, no photo deleted by the sheet itself.
 const sheet=fs.readFileSync('app/components/BakeJournal.tsx','utf8');
 assert.doesNotMatch(sheet,/confirmDelete|deleteQuestion|deleteJournalEntry\(/);assert.match(sheet,/removeJournalBake\(current\.id, removeAt\)/);
});

test('H2/H4: no "Start a new bake" on home; the Fine-tune row is "Fine-tune the dough"',()=>{
 const page=fs.readFileSync('app/[locale]/page.tsx','utf8');
 assert.doesNotMatch(page,/'Start a new bake'/);
 assert.match(page,/step\.id===10 \? \(fr \? 'Peaufiner la pâte' : 'Fine-tune the dough'\)/);
 assert.match(fs.readFileSync('app/components/Header.tsx','utf8'),/'Start a new bake'/,'Menu keeps it');
});

test('H5: a page from another build is a new deployment',()=>{
 const html='<script src="/_next/static/chunks/a1.js" async></script><script src="/_next/static/chunks/b2.js?dpl=x"></script>';
 assert.deepEqual(D.scriptPaths(html),['/_next/static/chunks/a1.js','/_next/static/chunks/b2.js']);
 assert.equal(D.isNewDeployment(html,new Set(['/_next/static/chunks/a1.js','/_next/static/chunks/b2.js','/_next/static/chunks/lazy.js'])),false);
 assert.equal(D.isNewDeployment(html,new Set(['/_next/static/chunks/a1.js','/_next/static/chunks/old.js'])),true);
 assert.equal(D.isNewDeployment('<html></html>',new Set(['/x.js'])),false,'no scripts read: nothing to compare');
});
