const {test}=require('node:test');
const assert=require('node:assert/strict');
require('./load-production.cjs');
const {saveSession,loadSession}=require('../app/lib/session.ts');
const {normalizeTimingOverrides}=require('../app/utils/timingOverrides.ts');

test('manual timing pins and dependent plan survive storage atomically; reset retains current blockers',()=>{
  const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
  const mix=Date.parse('2026-09-26T05:15:00+08:00');
  const pref=Date.parse('2026-09-25T19:15:00+08:00');
  const blocks=[{label:'Work',from:pref-10*3600000,to:pref-75*60000}];
  const session={bakeType:'pizza',startTime:mix,eatTime:mix+14.25*3600000,prefOffsetH:10,blocks,timingOverrides:{mix,pref}};
  assert.equal(saveSession(session),true);
  const restored=loadSession();
  assert.deepEqual(restored.timingOverrides,{mix,pref});
  assert.equal(restored.startTime-restored.prefOffsetH*3600000,restored.timingOverrides.pref);
  const reset={...restored,timingOverrides:{},startTime:mix+3600000,prefOffsetH:11};
  assert.equal(saveSession(reset),true);
  assert.deepEqual(loadSession().timingOverrides,{});
  assert.deepEqual(loadSession().blocks,blocks);
  assert.equal(loadSession().startTime,reset.startTime);
});

test('legacy plans remain automatic and malformed timing pins are rejected without discarding valid pins',()=>{
  assert.deepEqual(normalizeTimingOverrides(undefined),{});
  assert.deepEqual(normalizeTimingOverrides(null),{});
  const mix=Date.parse('2026-09-26T05:15:00+08:00');
  assert.deepEqual(normalizeTimingOverrides({mix,pref:'2026-09-25',feed:Infinity,refresh:NaN,unexpected:mix}),{mix});
  assert.deepEqual(normalizeTimingOverrides({mix:9e15}),{});
  global.localStorage={getItem:()=>JSON.stringify({version:1,savedAt:Date.now(),bakeType:'pizza',startTime:mix})};
  assert.deepEqual(loadSession().timingOverrides,{});
});

test('cloud named and automatic saves retain explicit timing pins with the same schedule snapshot',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
  const snapshots=[];
  const client={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:()=>{const chain={upsert(row){snapshots.push(row.dough_snapshot);return chain},insert(row){snapshots.push(row.dough_snapshot);return chain},select(){return chain},single:async()=>({data:{id:'saved'},error:null})};return chain;}};
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('app/lib/supabase/saveBakeEvent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:p=>p.endsWith('/client')?{createClient:()=>client}:{ALL_STYLES:{}},console,Date});
  const mix=Date.parse('2026-09-26T05:15:00+08:00');
  const session={bakeType:'pizza',numItems:4,startTime:mix,eatTime:mix+14.25*3600000,prefOffsetH:10,timingOverrides:{mix,feed:mix-6*3600000},blocks:[]};
  assert.equal(await module.exports.upsertBakeEvent({session}),'saved');
  assert.equal(await module.exports.saveNamedSession(session),'saved');
  for(const snapshot of snapshots){
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot.timingOverrides)),session.timingOverrides);
    assert.equal(snapshot.startTime,session.timingOverrides.mix);
    assert.equal(snapshot.prefOffsetH,10);
  }
});

test('actual apply handler persists pins and preferment offset immediately; reset is durable without an accepted plan',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
  const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
  const start=source.indexOf('const handleScheduleChange =');
  const end=source.indexOf('const prefRemoveFromFridgeTime',start);
  const writes=[],state={};
  const context={normalizeTimingOverrides,sessionRestored:false,eatTime:null,
    repairKey:(st,et,bl,offset)=>JSON.stringify([+st,+et,bl,offset]),
    buildSessionPayload:overrides=>({timingOverrides:{mix:123},...overrides}),
    saveSession:value=>writes.push(value)};
  for(const name of ['AcceptedScheduleRepair','SessionRestored','StartTime','EatTime','Blocks','PrefOffsetH','TimingOverrides','StarterEvents','FridgeOutTime','UsingPeak2','Feed2Time','StarterFridgeInTime'])context['set'+name]=value=>{state[name]=value};
  const code=ts.transpileModule(source.slice(start,end)+'\nglobalThis.handler=handleScheduleChange;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,context);
  const mix=new Date('2026-09-26T05:15:00+08:00'),bake=new Date(+mix+14.25*3600000),pref=+mix-10*3600000;
  context.handler(mix,bake,[],{preservePlan:true,prefOffsetHours:10,timingOverrides:{mix:+mix,pref}});
  assert.equal(writes[0].prefOffsetH,10);
  assert.equal(writes[0].timingOverrides.pref,pref);
  assert.equal(state.PrefOffsetH,10);
  assert.equal(JSON.parse(state.AcceptedScheduleRepair).at(-1),10);
  context.handler(mix,bake,[],{preservePlan:false,timingOverrides:{}});
  assert.deepEqual(writes[1].timingOverrides,{});
  assert.equal(state.AcceptedScheduleRepair,null);
  assert.deepEqual(state.TimingOverrides,{});
});

test('preferment locking is explicit and requires a valid preparation time',()=>{
 const pref=Date.parse('2026-09-27T09:00:00Z');
 assert.deepEqual(normalizeTimingOverrides({pref}),{pref});
 assert.deepEqual(normalizeTimingOverrides({pref,prefLocked:true}),{pref,prefLocked:true});
 assert.deepEqual(normalizeTimingOverrides({pref:undefined,prefLocked:true}),{});
 assert.deepEqual(normalizeTimingOverrides({pref,prefLocked:false}),{pref});
});

test('final-feed keeping is explicit, requires a valid feed and survives session storage',()=>{
 const feed=Date.parse('2026-09-27T09:00:00Z');
 assert.deepEqual(normalizeTimingOverrides({feed}),{feed});
 assert.deepEqual(normalizeTimingOverrides({feed,feedLocked:true}),{feed,feedLocked:true});
 assert.deepEqual(normalizeTimingOverrides({feed:undefined,feedLocked:true}),{});
 assert.deepEqual(normalizeTimingOverrides({feed,feedLocked:false}),{feed});
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 assert.equal(saveSession({bakeType:'bread',startTime:feed+5*3600000,timingOverrides:{feed,feedLocked:true}}),true);
 assert.deepEqual(loadSession().timingOverrides,{feed,feedLocked:true});
});
