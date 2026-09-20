const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
require('./load-production.cjs');
let sent=[], fail=false;
const original=Module._load;
Module._load=function(id,...args){
 if(id==='@anthropic-ai/sdk')return {default: class {messages={create:async payload=>{sent.push(payload);if(fail)throw new Error('private provider detail');return {content:[{type:'text',text:'Check the measured dough temperature.'}]};}}}};
 return original.call(this,id,...args);
};
const {POST}=require('../app/api/bake-coach/route.ts');
Module._load=original;
const call=body=>POST({json:async()=>body});
test('photo question retains user intent, recipe context and French instruction',async()=>{
 sent=[];const response=await call({stepId:'mix',stepTitle:'Main mix',imageBase64:'YQ==',mimeType:'image/jpeg',question:'Why is it sticky?',recipeContext:'main water 320g; poolish water 100g',locale:'fr'});
 assert.equal(response.status,200);const p=sent[0];const text=p.messages[0].content.find(x=>x.type==='text').text;
 assert.match(text,/Why is it sticky/);assert.match(text,/main water 320g; poolish water 100g/);assert.match(text,/Reply in French/);assert.match(p.system,/override conflicting visual heuristics/);
});
test('text coach allows questioning app calculations and keeps long recipe context',async()=>{
 sent=[];await call({stepId:'poolish',question:'Is this yeast right?',recipeContext:'x'.repeat(900)+' preferment yeast 0.1g'});
 assert.match(sent[0].system,/preferment yeast 0.1g/);assert.match(sent[0].system,/Never defend a number/);assert.doesNotMatch(sent[0].system,/do NOT contradict it/);
});
test('invalid input is rejected without provider request',async()=>{
 sent=[];for(const body of [{stepId:'mix',question:' '},{stepId:'mix',imageBase64:'YQ==',mimeType:'image/svg+xml'},{stepId:'mix',question:'hello',beforeBake:{}}])assert.equal((await call(body)).status,400);assert.equal(sent.length,0);
});
test('provider errors are not exposed to the browser',async()=>{
 fail=true;const old=console.error;console.error=()=>{};try{const r=await call({stepId:'mix',question:'Ready?'});assert.equal(r.status,500);assert.doesNotMatch(JSON.stringify(await r.json()),/private provider detail/);}finally{fail=false;console.error=old;}
});
