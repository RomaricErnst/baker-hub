const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
// Execute the production helper against a deterministic Supabase response queue.
function load(responses){
 const calls=[]; const client={from(table){const call={table,methods:[]};calls.push(call);const chain={then(resolve,reject){return Promise.resolve(responses.shift()).then(resolve,reject)}};for(const method of ['select','eq','single','maybeSingle','insert','update','delete'])chain[method]=(...args)=>{call.methods.push([method,...args]);return chain};return chain}};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('app/lib/supabase/saveBakeEvent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:p=>p.endsWith('/client')?{createClient:()=>client}:{ALL_STYLES:{}},console,Date});return{save:module.exports.savePizzaPartySelections,calls};
}
const ok={data:null,error:null},found={data:{id:'party'},error:null},fail={data:null,error:{message:'failed'}};
for(const stage of [0,1,2,3,4])test(`pizza save propagates failure at operation ${stage}`,async()=>{const responses=[found,ok,ok,ok,ok];responses[stage]=fail;const h=load(responses);assert.equal(await h.save('bake',{margherita:2},'neapolitan'),null);assert.equal(h.calls.length,stage+1)});
test('existing party succeeds only after all writes',async()=>{const h=load([found,ok,ok,ok,ok]);assert.equal(await h.save('bake',{margherita:2},'neapolitan'),'party');assert.equal(h.calls.length,5)});
test('missing party creates; insert failure stops slots',async()=>{const h=load([ok,fail]);assert.equal(await h.save('bake',{margherita:2},'neapolitan'),null);assert.equal(h.calls.length,2)});
test('empty selection is no-op, not a successful database clear',async()=>{const h=load([]);assert.equal(await h.save('bake',{},'neapolitan'),null);assert.equal(h.calls.length,0)});
