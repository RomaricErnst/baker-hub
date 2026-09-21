const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/[locale]/page.tsx','utf8');
const handler=source.slice(source.indexOf('  async function shareCurrentSession() {'),source.indexOf('  function firstIncompleteStep'));
async function share({id=null,success=true,user={id:'baker'}}={}) {
 const calls=[],state={};
 const snapshot={recipeGenerated:true,startTime:123,starterEvents:[{kind:'pre_mix',time:100}],lastFedTime:80,planningMode:'last_fed',measuredFlourTemp:18,measuredPrefermentTemp:21,mixingBatches:2,pizzaParty:{qtys:{margherita:3}},activeTab:'guide'};
 const context={bakeEventId:id,user,buildSessionPayload:()=>snapshot,require:()=>({saveNamedSession:async data=>{calls.push(['insert',data]);return success?'new-id':null;},updateBakeEvent:async(key,data)=>{calls.push(['update',key,data]);return success;}}),stashAuthIntent:value=>calls.push(['auth',value]),window:{dispatchEvent:event=>calls.push(['event',event.type])},Event:class{constructor(type){this.type=type;}}};
 for(const name of new Set(handler.match(/\bset[A-Z]\w*/g)))context[name]=value=>state[name]=value;
 const code=ts.transpileModule(handler+'\nshareCurrentSession()', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 await vm.runInNewContext(code,context);
 return {calls,state,snapshot};
}
test('first share saves the complete canonical plan before opening sharing',async()=>{
 const {calls,state,snapshot}=await share();
 assert.deepEqual(calls,[['insert',snapshot]]);assert.equal(state.setShareSessionId,'new-id');assert.equal(state.setSessionSaved,true);
});
test('sharing an existing bake refreshes its snapshot with current edits',async()=>{
 const {calls,state,snapshot}=await share({id:'old-id'});
 assert.deepEqual(calls,[['update','old-id',snapshot]]);assert.equal(state.setShareSessionId,'old-id');
});
test('failed cloud writes never open a stale share and signed-out users authenticate first',async()=>{
 for(const id of [null,'old-id']){
  const {state}=await share({id,success:false});
  assert.equal(state.setShareSessionId,undefined);assert.equal(state.setSessionSaved,false);assert.equal(state.setCloudSaveState,'failed');
 }
 const {calls,state}=await share({id:'old-id',user:null});assert.deepEqual(calls,[['auth','share'],['event','bh-open-auth']]);assert.equal(state.setShareSessionId,undefined);
});
test('photo and pizza save fallbacks use the same canonical snapshot builder',()=>{
 // Check every embedded fallback, not a second hand-maintained field list.
 const payloadCalls=[...source.matchAll(/const payload = ([^;]+);\s+(?:evId =|const id =) await upsertBakeEvent\(\{ session: payload as SessionData \}\)/g)];
 assert.equal(payloadCalls.length,4);
 for(const call of payloadCalls)assert.equal(call[1],'buildSessionPayload()');
});
