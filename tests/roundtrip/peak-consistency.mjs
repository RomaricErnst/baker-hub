// One starter peak: the card PEAK equals the active bell peak for every
// candidate family, and a green pill means the starter is within the solver's
// tolerance of peak at mix. Sweeps temperature × location × last fed ×
// horizon × Nights through the real picker.
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

const bad=[];const realigned=[];const skipped={};let n=0;const fam={};
const fmt=ms=>new Date(ms).toISOString().slice(5,16);
const T=[16,24,32],L=['fridge','rt'],A=[['today',-4],['yesterday',-20],['days23',-60],['week',-170]],HZ=[12,24,36,48],NI=[true,false];
for(const temp of T)for(const loc of L)for(const age of A)for(const horizon of HZ)for(const nights of NI){
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:nights,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}}));
 w.__bhTrace=[];
 let m;const label=`${temp}C ${loc} ${age[0]} +${horizon}h nights=${nights}`;
 try{
  m=await w.__mount(query('#root'),{temp,style:'pain_levain',loc,age:age[0],eat:new w.Date(clock+horizon*hour),start:new w.Date(clock),lastFed:new w.Date(clock+age[1]*hour),page:true,full:true,ratioMode:'recommend'});
  await settle();await settle();
  const tr=w.__bhTrace.at(-1);
  if(!tr){skipped[loc+' +'+horizon+'h']=(skipped[loc+' +'+horizon+'h']||0)+1;continue;}
  n++;fam[tr.family]=(fam[tr.family]||0)+1;
  if(tr.planningMode==='know_peak'||tr.peakMs==null)continue;
  const bells=tr.events.filter(e=>e.active&&e.bellPeak!=null&&['pre_mix','refresh','intermediate_refresh'].includes(e.kind));
  // Card PEAK row ≡ the bell of the last active feed before mix.
  const feeds=bells.filter(e=>e.t<=tr.mixMs);
  const last=feeds.at(-1);
  if(last && Math.abs(last.bellPeak-tr.peakMs)>60000)
   bad.push(`${label} [${tr.family}] card peak ${fmt(tr.peakMs)} ≠ bell ${fmt(last.bellPeak)} (${last.kind})`);
  // The render may re-align a feed so its peak meets the mix; the pill is then
  // checked against the peak the baker sees (below), not the scan's estimate.
  if(tr.scoredPeakMs!=null && Math.abs(tr.scoredPeakMs-tr.peakMs)>15*60000)realigned.push(`${label} [${tr.family}] scan ${fmt(tr.scoredPeakMs)} → shown ${fmt(tr.peakMs)}`);
  // Green ⇒ starter near peak at mix.
  if(tr.pill==='green'){
   const tol=(loc==='fridge'&&tr.family==='pathB_fridge_hold')?2.0:Math.max(1.0,Math.min(3.0,(tr.adjPeakH||8)*0.15));
   const gapH=(tr.mixMs-tr.peakMs)/hour; // >0 mix after peak
   const lim=gapH<0?tol+0.5:tol;
   if(Math.abs(gapH)>lim+0.26)bad.push(`${label} [${tr.family}] green but mix ${fmt(tr.mixMs)} is ${gapH.toFixed(2)} h from peak ${fmt(tr.peakMs)} (tol ${lim.toFixed(2)})`);
  }
 }catch(err){bad.push('ERR '+label+': '+err.message);}
 finally{m?.unmount();await settle();}
}
console.log('untraced',JSON.stringify(skipped));console.log('realigned',realigned.length,realigned.slice(0,5).join(' | '));console.log('cases',n,'families',JSON.stringify(fam),'violations',bad.length);console.log(bad.slice(0,25).join('\n'));
assert.deepEqual(errors,[],'Runtime errors');
assert.ok(n>=150,'Too few traced cases: '+n);
assert.equal(bad.length,0,bad.join('\n'));
process.exit(0);
