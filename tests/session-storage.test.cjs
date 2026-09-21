const test = require('node:test');
const assert = require('node:assert/strict');
require('./load-production.cjs');
const {saveSession,loadSession,clearSession}=require('../app/lib/session.ts');
test('local save reports failure instead of false saved state',()=>{
 global.localStorage={setItem(){throw new Error('Storage unavailable')},getItem(){return null},removeItem(){}};
 assert.equal(saveSession({bakeType:'pizza',waterSource:'fridge'}),false);
});
test('local draft round trip retains water choice; clear removes draft',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 assert.equal(saveSession({bakeType:'bread',waterSource:'fridge'}),true);
 assert.equal(loadSession().waterSource,'fridge');assert.equal(loadSession().bakeType,'bread');
 clearSession();assert.equal(loadSession(),null);
});

test('mixing batch choice round trips while legacy and automatic sessions keep the recommendation',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 for(const count of [1,3,100]) {saveSession({bakeType:'pizza',mixingBatches:count});assert.equal(loadSession().mixingBatches,count);}
 for(const count of [undefined,0,-1,2.5,101,'3',null]) {saveSession({bakeType:'pizza',mixingBatches:count});assert.equal(loadSession().mixingBatches,undefined);}
 store.set('bh_session_v1',JSON.stringify({version:1,savedAt:Date.now(),bakeType:'bread'}));assert.equal(loadSession().mixingBatches,undefined);
});
test('cloud autosave and named save retain the batch override in the persisted snapshot',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
 const snapshots=[];const client={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:()=>{const chain={upsert(row){snapshots.push(row.dough_snapshot);return chain},insert(row){snapshots.push(row.dough_snapshot);return chain},select(){return chain},single:async()=>({data:{id:'saved'},error:null})};return chain;}};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('app/lib/supabase/saveBakeEvent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:p=>p.endsWith('/client')?{createClient:()=>client}:{ALL_STYLES:{}},console,Date});
 const session={mixingBatches:4,bakeType:'pizza',numItems:8,eatTime:Date.now()};
 assert.equal(await module.exports.upsertBakeEvent({session}),'saved');assert.equal(await module.exports.saveNamedSession(session),'saved');
 for(const snapshot of snapshots)assert.equal(JSON.parse(JSON.stringify(snapshot)).mixingBatches,4);
 const {normalizeMixingBatches}=require('../app/lib/session.ts');const rebake={...snapshots[0],eatTime:session.eatTime+604800000};assert.equal(normalizeMixingBatches(rebake.mixingBatches),4);
});

test('optional container capacity survives local storage without changing recipe fields',()=>{
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 for(const capacity of [undefined,3,5.5]) {saveSession({bakeType:'pizza',containerCapacityLitres:capacity,itemWeight:250});assert.equal(loadSession().containerCapacityLitres,capacity);assert.equal(loadSession().itemWeight,250);}
});
