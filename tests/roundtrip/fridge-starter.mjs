// A starter kept in the fridge is never told to go INTO the fridge before it
// has come out and been fed in the plan. 160 temperature × age × horizon ×
// Nights cases through the real picker (3 Nov 2026 live review finding).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {MessageChannel} from 'node:worker_threads';
const require = createRequire(new URL('../../.ci-tools/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', {url:'https://www.bakerhub.app/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window, doc=w.document;
const clock=Date.parse('2026-11-02T10:00:00+08:00'), hour=3600000;
assert.equal(new Date(clock).getHours(),10,'Run with TZ=Asia/Singapore');
w.Date=class extends w.Date {
  constructor(...args){super(...(args.length?args:[clock]));}
  static now(){return clock;}
};
w.MessageChannel??=MessageChannel;
w.HTMLElement.prototype.scrollIntoView=()=>{};
w.Element.prototype.scrollTo=()=>{};
w.scrollTo=()=>{};
w.ResizeObserver=class {constructor(fn){this.fn=fn;}observe(){this.fn([{contentRect:{width:390,height:844}}],this);}unobserve(){}disconnect(){}};
w.IntersectionObserver=class {observe(){}unobserve(){}disconnect(){}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.SVGElement.prototype.getBBox=()=>({x:0,y:0,width:40,height:12});
w.SVGElement.prototype.getComputedTextLength=function(){return (this.textContent||'').length*6;};
w.process={env:{NODE_ENV:'development'}};
const errors=[];
w.addEventListener('error',event=>errors.push(String(event.error||event.message)));
w.eval(fs.readFileSync(process.argv[2],'utf8'));
const settle=()=>new Promise(resolve=>setTimeout(resolve,Number(process.env.CLOSING_SETTLE_MS||180)));
const failures=[];
const eligible=()=>w.__h.rec.scheduleValid===true && w.__h.rec.starterValid!==false && !!w.__h.rec.events;
const query=(selector)=>doc.querySelector(selector);
function conflictRows(){
 const rows=[...doc.querySelectorAll('[data-availability-conflicts] > li')];
 const state=query('.bh-plan-state');
 assert.ok(state,'Scheduler status is missing');
 const headline=state.textContent.trim();
 const count=Number(headline.match(/^(\d+)\s+(?:steps?\b|étapes?\b)/)?.[1]||0);
 assert.equal(rows.length,count,'Conflict headline and named rows differ: '+headline);
 for(const row of rows){
  assert.ok(row.dataset.conflictAction && /\d/.test(row.textContent),'The conflict has no action or time');
  assert.ok(row.querySelector('button:not(:disabled)'),'The conflict has no cover action');
 }
 return rows;
}
const bad=[];let n=0;
const fmt=ms=>new Date(ms).toISOString().slice(5,16);
const T=[18,22,26,30],A=[['yesterday',-20],['days23',-60],['days45',-108],['week',-170]],HZ=[24,36,48,72,96],NI=[true,false];
for(const temp of T)for(const age of A)for(const horizon of HZ)for(const nights of NI){
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:nights,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}}));
 let m;
 try{
  m=await w.__mount(query('#root'),{temp,style:'pain_levain',loc:'fridge',age:age[0],eat:new w.Date(clock+horizon*hour),start:new w.Date(clock),lastFed:new w.Date(clock+age[1]*hour),page:true,full:true,ratioMode:'recommend'});
  await settle();await settle();
  const ev=(w.__h.rec.events||'').split(',').filter(Boolean).map(e=>{const [k,t]=e.split('@');return {k,t:Number(t)};}).sort((a,b)=>a.t-b.t);
  const lastFed=clock+age[1]*hour;n++;
  // Invariant: a starter kept in the fridge is never sent INTO the fridge
  // before it has come out and been fed in this plan.
  let inFridge=true;
  for(const e of ev){
   if(e.k==='fridge_in'){ if(e.t>lastFed+3600000 && inFridge){bad.push(`${temp}C ${age[0]} +${horizon}h nights=${nights}: fridge_in ${fmt(e.t)} while still in fridge · ${ev.map(x=>x.k+'@'+fmt(x.t)).join(' ')}`);break;} inFridge=true; }
   if(e.k==='fridge_out')inFridge=false;
   if(['refresh','intermediate_refresh','pre_mix'].includes(e.k))inFridge=false;
  }
 }catch(err){bad.push('ERR '+temp+' '+age[0]+' '+horizon+': '+err.message);}
 finally{m?.unmount();await settle();}
}
// A bake nine or ten days away keeps the fridge starter in the fridge until the
// run-up: the first feed comes at least two days after now, not "feed now" (ux-25).
const early=[];let longCases=0;
for(const temp of [18,22,26])for(const age of [['days23',-60],['week',-170]])for(const horizon of [216,240]){
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}}));
 let m;
 try{
  m=await w.__mount(query('#root'),{temp,style:'pain_levain',loc:'fridge',age:age[0],eat:new w.Date(clock+horizon*hour),start:new w.Date(clock),lastFed:new w.Date(clock+age[1]*hour),page:true,full:true,ratioMode:'recommend'});
  await settle();await settle();
  const ev=(w.__h.rec.events||'').split(',').filter(Boolean).map(e=>{const [k,t]=e.split('@');return {k,t:Number(t)};});
  const firstFeed=Math.min(...ev.filter(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.k)&&e.t>clock).map(e=>e.t));
  longCases++;
  if(Number.isFinite(firstFeed)&&firstFeed<clock+48*hour)early.push(`${temp}C ${age[0]} +${horizon}h: first feed ${fmt(firstFeed)} · ${ev.map(x=>x.k+'@'+fmt(x.t)).join(' ')}`);
 }catch(err){early.push('ERR '+temp+' '+age[0]+' '+horizon+': '+err.message);}
 finally{m?.unmount();await settle();}
}
console.log('long-horizon cases',longCases,'early feeds',early.length);
assert.equal(early.length,0,early.join('\n'));
console.log('cases',n,'violations',bad.length);console.log(bad.slice(0,15).join('\n'));
assert.deepEqual(errors,[],'Runtime errors');
assert.equal(n,160);
assert.equal(bad.length,0,bad.join('\n'));
process.exit(0);
