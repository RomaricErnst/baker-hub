const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('./load-production.cjs');
process.env.BH_COACH_TIMEOUT_MS='300';
let sent=[], fail=false, reply='Check the measured dough temperature.', stopReason='end_turn', chunkDelay=0, chunks=null;
const wait=(ms,signal)=>new Promise((res,rej)=>{const t=setTimeout(res,ms);signal?.addEventListener('abort',()=>{clearTimeout(t);const e=new Error('Request was aborted.');e.name='AbortError';rej(e);});});
// A streaming mock of the SDK: text deltas, then the stop reason; honours the abort signal like the SDK.
const original=Module._load;
Module._load=function(id,...args){
 if(id==='@anthropic-ai/sdk')return {default: class {messages={create:async (payload,opts)=>{sent.push(payload);if(fail)throw new Error('private provider detail');
  const parts=chunks??[reply];const signal=opts?.signal;
  return (async function*(){yield {type:'message_start'};for(const text of parts){if(chunkDelay)await wait(chunkDelay,signal);yield {type:'content_block_delta',delta:{type:'text_delta',text}};}
   yield {type:'message_delta',delta:{stop_reason:stopReason}};})();}};}};
 return original.call(this,id,...args);
};
const {POST,GET,plainCoachText,lastFullSentence,thinkingParams}=require('../app/api/bake-coach/route.ts');
const guard=require('../app/lib/apiGuard.ts');
Module._load=original;
let ip=0;
const ORIGIN='https://www.bakerhub.app';
const tokenFor=from=>guard.issueAskToken('bake-coach',from);
// Each call from its own address unless one is given, so the rate limit stays out of the other tests.
const call=(body,from,extra={})=>{const raw=JSON.stringify(body);const addr=from??`10.0.0.${++ip}`;const headers=new Map([['x-forwarded-for',addr],['content-length',String(raw.length)],['origin',ORIGIN],['x-bh-ask',tokenFor(addr)],...Object.entries(extra)]);for(const [k,v] of Object.entries(extra))if(v===null)headers.delete(k);return POST({headers:{get:k=>headers.get(k)??null},text:async()=>raw});};

test('text question keeps the recipe context, French instruction and the newer model',async()=>{
 sent=[];const response=await call({stepId:'mix',stepTitle:'Main mix',question:'Why is it sticky?',recipeContext:'main water 320g; poolish water 100g',locale:'fr'});
 assert.equal(response.status,200);const p=sent[0];
 assert.equal(p.messages[0].content,'Why is it sticky?');assert.match(p.system,/main water 320g; poolish water 100g/);assert.match(p.system,/Reply entirely in French/);
 assert.equal(p.model,process.env.ANTHROPIC_COACH_MODEL??'claude-sonnet-5-5');
 assert.match(p.system,/plain text only/);assert.match(p.system,/45–60 minutes/);assert.match(p.system,/65 % is normal/);assert.match(p.system,/no emoji/);
});
test('text only: a photo is never sent to the model',async()=>{
 sent=[];await call({stepId:'bake',question:'Is it done?',imageBase64:'YQ==',mimeType:'image/jpeg'});
 assert.equal(sent.length,1);assert.equal(typeof sent[0].messages[0].content,'string');assert.doesNotMatch(JSON.stringify(sent[0]),/YQ==|"image"/);
 sent=[];assert.equal((await call({stepId:'bake',imageBase64:'YQ==',mimeType:'image/jpeg'})).status,400);assert.equal(sent.length,0);
});
test('text coach allows questioning app calculations and keeps long recipe context',async()=>{
 sent=[];await call({stepId:'poolish',question:'Is this yeast right?',recipeContext:'x'.repeat(900)+' preferment yeast 0.1g'});
 assert.match(sent[0].system,/preferment yeast 0.1g/);assert.match(sent[0].system,/Never defend a number/);
});
test('answers are plain text: stray markdown is stripped',async()=>{
 assert.equal(plainCoachText('**Three signs together**: it has risen.\n\n1. **Rise** – 50%\n- Poke *gently*\n### Note\n\n\n\nDone.'),'Three signs together: it has risen.\n\nRise – 50%\nPoke gently\nNote\n\nDone.');
 assert.equal(plainCoachText('Use 0.4 g, 2 * 3 folds.'),'Use 0.4 g, 2 * 3 folds.');
 reply='**Ready** to shape.\n- Check the rise';const r=await call({stepId:'bulk',question:'Ready?'});reply='Check the measured dough temperature.';
 assert.equal((await r.json()).feedback,'Ready to shape.\nCheck the rise');
});
test('invalid input is rejected without provider request',async()=>{
 sent=[];for(const body of [{stepId:'mix',question:' '},{stepId:'mix'},{question:'hello'}])assert.equal((await call(body)).status,400);assert.equal(sent.length,0);
 assert.equal((await call({stepId:'mix',question:'hi',recipeContext:'x'.repeat(20000)})).status,413);assert.equal(sent.length,0);
});
test('rate limit: 20 questions per address in 10 minutes, then 429 without a provider request',async()=>{
 sent=[];for(let i=0;i<20;i++)assert.equal((await call({stepId:'mix',question:'q'+i},'192.0.2.9')).status,200);
 const r=await call({stepId:'mix',question:'one more'},'192.0.2.9');assert.equal(r.status,429);assert.equal(sent.length,20);
 assert.equal((await call({stepId:'mix',question:'other'},'192.0.2.10')).status,200);
 const now=Date.now();guard.resetRateLimit();for(let i=0;i<20;i++)assert.ok(guard.allowRequest('t','a',now));
 assert.ok(!guard.allowRequest('t','a',now+1000));assert.ok(guard.allowRequest('t','a',now+10*60000+1));
});
test('provider errors are not exposed to the browser',async()=>{
 fail=true;const old=console.error;console.error=()=>{};try{const r=await call({stepId:'mix',question:'Ready?'});assert.equal(r.status,500);assert.doesNotMatch(JSON.stringify(await r.json()),/private provider detail/);}finally{fail=false;console.error=old;}
});
test('flour scan: images over 5 MB are refused before the provider',async()=>{
 const load=Module._load;Module._load=function(id,...a){return id==='@/lib/flourDatabase'?{FLOUR_DB:[]}:load.call(this,id,...a);};
 let scan;try{({POST:scan}=require('../app/api/flour-scan/route.ts'));}finally{Module._load=load;}
 const fetched=[];const realFetch=global.fetch;global.fetch=async(...a)=>{fetched.push(a);return {ok:false,json:async()=>({error:{message:'x'}}),status:500};};
 try{
  const big=JSON.stringify({base64:'A'.repeat(Math.ceil(5.2*1024*1024*4/3)),mediaType:'image/jpeg'});
  const h=new Map([['x-forwarded-for','198.51.100.1'],['origin',ORIGIN],['x-bh-ask',guard.issueAskToken('flour-scan','198.51.100.1')]]);
  const r=await scan({headers:{get:k=>h.get(k)??null},text:async()=>big});assert.equal(r.status,413);assert.equal(fetched.length,0);
 }finally{global.fetch=realFetch;}
});
test('round 20: the flour scan returns the reading only, never the provider message',async()=>{
 const load=Module._load;Module._load=function(id,...a){return id==='@/lib/flourDatabase'?{FLOUR_DB:[{brand:'Grands Moulins',name:'T65',w:220,protein:11}]}:load.call(this,id,...a);};
 let scan;try{delete require.cache[require.resolve('../app/api/flour-scan/route.ts')];({POST:scan}=require('../app/api/flour-scan/route.ts'));}finally{Module._load=load;}
 process.env.ANTHROPIC_API_KEY=process.env.ANTHROPIC_API_KEY||'test-key';
 const realFetch=global.fetch;let provider={ok:true,status:200,json:async()=>({id:'msg_01SECRET',model:'claude-haiku-4-5',usage:{input_tokens:900},content:[{type:'text',text:'{"name":"Moulin du Val T65 Tradition","w":220,"protein":11.5,"wOnBag":false,"proteinOnBag":true,"confidence":"medium","readability":"clear","source":"database","note":"W borrowed from Grands Moulins T65"}'}]})};
 global.fetch=async()=>provider;
 const req=()=>{const raw=JSON.stringify({base64:'YQ==',mediaType:'image/jpeg'});const h=new Map([['x-forwarded-for','198.51.100.2'],['origin',ORIGIN],['x-bh-ask',guard.issueAskToken('flour-scan','198.51.100.2')]]);return {headers:{get:k=>h.get(k)??null},text:async()=>raw};};
 const old=console.error;console.error=()=>{};
 try{
  const r=await scan(req());assert.equal(r.status,200);const j=await r.json();
  assert.doesNotMatch(JSON.stringify(j),/msg_01SECRET|claude-haiku|input_tokens/);
  assert.equal(j.result.protein,11.5);assert.equal(j.result.wOnBag,false);assert.equal(j.result.proteinOnBag,true);assert.equal(j.result.source,'estimated');
  provider={ok:false,status:400,json:async()=>({type:'error',error:{type:'invalid_request_error',message:'private provider detail'}})};
  const e=await scan(req());assert.doesNotMatch(JSON.stringify(await e.json()),/private provider detail|invalid_request/);
 }finally{global.fetch=realFetch;console.error=old;}
});

test('round 20: no up-front thinking, room for the answer, a one-shot box that invites no follow-up',async()=>{
 sent=[];const r=await call({stepId:'mix',question:'Is 1.2 g right? Use the 7 g sachet?'});assert.equal(r.status,200);
 const p=sent[0];assert.ok(p.max_tokens>=1024,'max_tokens covers four sentences many times');assert.equal(p.stream,true);
 assert.deepEqual(p.thinking,{type:'between_tools'});assert.equal(p.output_config.effort,'low');
 assert.match(p.system,/At most four short sentences, the last one the action/);assert.match(p.system,/cannot reply, so never ask them a question or invite a follow-up/);
 assert.deepEqual(thinkingParams('claude-sonnet-5'),{thinking:{type:'disabled'}});assert.deepEqual(thinkingParams('claude-haiku-4-5'),{});
});
test('round 20: a long answer arrives whole',async()=>{
 const long=Array.from({length:12},(_,i)=>`Sentence ${i+1} explains the dough at 0.15% of the 781 g flour.`).join(' ');
 chunks=long.match(/.{1,17}/g);try{const r=await call({stepId:'mix',question:'Long?'});assert.equal((await r.json()).feedback,long);}finally{chunks=null;}
});
test('round 20: an answer stopped at the token limit is trimmed to its last full sentence',async()=>{
 stopReason='max_tokens';chunks=['Yes, 1.2 g is right for 18 h. Do not use the whole 7 g sachet. Weigh 1.2 g and keep the rest','s'];
 try{const r=await call({stepId:'mix',question:'q'});assert.equal((await r.json()).feedback,'Yes, 1.2 g is right for 18 h. Do not use the whole 7 g sachet.');}finally{stopReason='end_turn';chunks=null;}
 assert.equal(lastFullSentence('It is at 0.5 g. Then fold at 2.30'),'It is at 0.5 g.');assert.equal(lastFullSentence('so yes, probably over-proofed,'),'');
 assert.equal(lastFullSentence('Bake it now.'),'Bake it now.');
});
test('round 20: a slow stream past the deadline keeps the full sentences that arrived, never a half one',async()=>{
 chunkDelay=120;chunks=['It has risen enough. ','Shape it now and ','bake at 7pm because the'];
 try{const r=await call({stepId:'bulk',question:'Ready?'});assert.equal(r.status,200);assert.equal((await r.json()).feedback,'It has risen enough.');}finally{chunkDelay=0;chunks=null;}
});
test('round 20: a timeout before any full sentence is the calm error, not a half sentence',async()=>{
 chunkDelay=400;chunks=['so yes, probably over-proofed,'];const old=console.error;console.error=()=>{};
 try{const r=await call({stepId:'bulk',question:'Over?'});assert.equal(r.status,500);const j=await r.json();assert.equal(j.error,'Help is unavailable right now. Try again in a minute.');assert.equal(j.feedback,undefined);}finally{chunkDelay=0;chunks=null;console.error=old;}
});
test('round 20: other sites and calls without a valid ask token are refused before the provider',async()=>{
 sent=[];
 assert.equal((await call({stepId:'mix',question:'q'},undefined,{origin:'https://evil.example'})).status,403);
 assert.equal((await call({stepId:'mix',question:'q'},undefined,{origin:null})).status,403);
 assert.equal((await call({stepId:'mix',question:'q'},undefined,{'x-bh-ask':'1.2.3'})).status,403);
 // A token issued to another address does not work here.
 assert.equal((await call({stepId:'mix',question:'q'},'203.0.113.1',{'x-bh-ask':guard.issueAskToken('bake-coach','203.0.113.2')})).status,403);
 assert.equal(sent.length,0);
 const h=new Map([['origin',ORIGIN],['x-forwarded-for','198.51.100.7']]);const g=await GET({headers:{get:k=>h.get(k)??null}});const {token}=await g.json();
 assert.ok(guard.validAskToken('bake-coach','198.51.100.7',token));assert.ok(!guard.validAskToken('flour-scan','198.51.100.7',token));
 assert.ok(!guard.validAskToken('bake-coach','198.51.100.7',token,Date.now()+31*60000));
 const bad=new Map([['origin','https://evil.example']]);assert.equal((await GET({headers:{get:k=>bad.get(k)??null}})).status,403);
});
test('round 20: the durable count decides when the store answers; memory when it cannot be reached',async()=>{
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='anon';
 const calls=[];let answer=true;const store=async(url,init)=>{calls.push([url,JSON.parse(init.body)]);return {ok:true,json:async()=>answer};};
 const h=addr=>{const m=new Map([['origin',ORIGIN],['x-forwarded-for',addr],['x-bh-ask',guard.issueAskToken('bake-coach',addr)]]);return {get:k=>m.get(k)??null};};
 try{
  assert.deepEqual(await guard.guardModelCall('bake-coach',h('192.0.2.50'),store),{ok:true});
  assert.match(calls[0][0],/\/rest\/v1\/rpc\/bh_rate_hit$/);assert.equal(calls[0][1].p_limit,20);assert.equal(calls[0][1].p_window_seconds,600);
  assert.doesNotMatch(JSON.stringify(calls),/192\.0\.2\.50/,'the address itself is never sent');
  assert.match(calls[1][1].p_bucket,/^bake-coach:all:\d{4}-\d\d-\d\d$/);assert.equal(calls[1][1].p_limit,guard.DAILY_LIMIT);
  answer=false;assert.equal((await guard.guardModelCall('bake-coach',h('192.0.2.50'),store)).status,429);
  // Store down: the instance's memory count still stops the 21st call.
  guard.resetRateLimit();const down=async()=>{throw new Error('offline');};
  for(let i=0;i<20;i++)assert.ok((await guard.guardModelCall('bake-coach',h('192.0.2.60'),down)).ok);
  assert.equal((await guard.guardModelCall('bake-coach',h('192.0.2.60'),down)).status,429);
 }finally{delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;guard.resetRateLimit();}
});
