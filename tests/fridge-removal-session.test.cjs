const {test}=require('node:test');
const assert=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const {retainCurrentFridgeRemoval}=require('../app/utils/fridgeRemovalSession.ts');
const {saveSession,loadSession,clearSession}=require('../app/lib/session.ts');
const {getFinalFridgeRemoval}=require('../app/utils/scheduleAvailability.ts');

test('arrangement survives saved draft and is retired permanently after a committed timing change',()=>{
 const start=new Date('2026-10-29T18:00Z'),bake=new Date('2026-10-30T19:00Z');
 const plain=[{label:'Work',from:new Date('2026-10-30T09:00Z'),to:new Date('2026-10-30T18:00Z')}];
 const build=(blocks,target=bake)=>utils.buildSchedule(start,target,blocks,24,45,'hand','neapolitan',4);
 const removal=getFinalFridgeRemoval(build(plain).availabilityActions);
 assert.ok(removal);
 const blocks=plain.map(b=>({...b,fridgeRemoval:{at:+removal.at,bake:+bake}}));
 assert.equal(retainCurrentFridgeRemoval(blocks,build(blocks).availabilityActions),blocks);
 const store=new Map();global.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)??null,removeItem:k=>store.delete(k)};
 saveSession({bakeType:'pizza',startTime:+start,eatTime:+bake,blocks:blocks.map(b=>({...b,from:+b.from,to:+b.to}))});
 const restored=loadSession().blocks.map(b=>({...b,from:new Date(b.from),to:new Date(b.to)}));
 assert.equal(build(restored).fridgeRemovalArranged,true);
 const changed=retainCurrentFridgeRemoval(restored,build(restored,new Date(+bake+3600000)).availabilityActions);
 assert.equal(changed[0].fridgeRemoval,undefined);
 assert.equal(build(changed).fridgeRemovalArranged,false,'returning to original time does not resurrect consent');
 assert.equal(retainCurrentFridgeRemoval(blocks,[])[0].fridgeRemoval,undefined);
 clearSession();assert.equal(loadSession(),null);
});
