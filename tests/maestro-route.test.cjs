const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('./load-production.cjs');
let sent=[], fail=false, reply='Check the measured dough temperature.';
const original=Module._load;
Module._load=function(id,...args){
 if(id==='@anthropic-ai/sdk')return {default: class {messages={create:async payload=>{sent.push(payload);if(fail)throw new Error('private provider detail');return {content:[{type:'text',text:reply}]};}}}};
 return original.call(this,id,...args);
};
const {POST,plainCoachText}=require('../app/api/bake-coach/route.ts');
const guard=require('../app/lib/apiGuard.ts');
Module._load=original;
let ip=0;
// Each call from its own address unless one is given, so the rate limit stays out of the other tests.
const call=(body,from)=>{const raw=JSON.stringify(body);const headers=new Map([['x-forwarded-for',from??`10.0.0.${++ip}`],['content-length',String(raw.length)]]);return POST({headers:{get:k=>headers.get(k)??null},text:async()=>raw});};

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
  const h=new Map([['x-forwarded-for','198.51.100.1']]);
  const r=await scan({headers:{get:k=>h.get(k)??null},text:async()=>big});assert.equal(r.status,413);assert.equal(fetched.length,0);
 }finally{global.fetch=realFetch;}
});
