// One starter peak: the Recipe's starter strip ≡ the card ≡ scoring for every
// candidate family (20 Nov 2026: the strip replaced the chart's bell). The strip
// draws the pre-mix peak the card writes, in the same words (peakTime.ts), and a
// green pill means Start Dough sits inside the strip's ready window (the solver's
// green band). Sweeps temperature × location × last fed × horizon × Nights
// through the real picker, with the strip rendered from the events the parent holds.
// Flour strength (21 Nov 2026, round 8) is a dimension too: it scales the dough's cold windows
// but neither the levain % nor the starter's ready band, so the same strict invariant must hold
// for a weak, a reference and a strong flour alike (FLOURS=1 runs the reference only).
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

const bad=[];let stripCases=0;const realigned=[];const skipped={};let n=0;const fam={};
const fmt=ms=>new Date(ms).toISOString().slice(5,16);
const T=[16,24,32],L=['fridge','rt'],A=[['today',-4],['yesterday',-20],['days23',-60],['week',-170]],HZ=[12,24,36,48],NI=[true,false];
const FS=(process.env.FLOURS||'0.75,1,1.35').split(',').map(Number);const perFlour={};
for(const fs of FS)for(const temp of T)for(const loc of L)for(const age of A)for(const horizon of HZ)for(const nights of NI){
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:nights,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}}));
 w.__bhTrace=[];
 let m;const label=`ftm${fs} ${temp}C ${loc} ${age[0]} +${horizon}h nights=${nights}`;
 try{
  m=await w.__mount(query('#root'),{temp,style:'pain_levain',loc,age:age[0],eat:new w.Date(clock+horizon*hour),start:new w.Date(clock),lastFed:new w.Date(clock+age[1]*hour),page:true,full:true,ratioMode:'recommend',flourStrength:fs});
  await settle();await settle();
  const tr=w.__bhTrace.at(-1);
  if(!tr){skipped[loc+' +'+horizon+'h']=(skipped[loc+' +'+horizon+'h']||0)+1;continue;}
  n++;fam[tr.family]=(fam[tr.family]||0)+1;perFlour[fs]=(perFlour[fs]||0)+1;
  if(tr.planningMode==='know_peak'||tr.peakMs==null)continue;
  const feeds=tr.events.filter(e=>e.active&&e.bellPeak!=null&&['pre_mix','refresh','intermediate_refresh'].includes(e.kind)&&e.t<=tr.mixMs);
  const last=feeds.at(-1);
  const strip=query('[data-starter-strip]');
  if(process.env.DUMP&&!strip)console.log('NOSTRIP',label,tr.family,tr.events.map(e=>`${e.kind}${e.active?'*':''}@${fmt(e.t)}${e.bellPeak?'→'+fmt(e.bellPeak):''}`).join(' '),'mix',fmt(tr.mixMs),'peak',fmt(tr.peakMs));
  const preMix=tr.events.filter(e=>e.kind==='pre_mix'&&e.bellPeak!=null&&e.t<=tr.mixMs).at(-1);
  if(preMix){
   // Strip ≡ card ≡ scoring: the strip's peak is the card's (tr.peakMs, the scored peak shown), and
   // the strip's text alternative and the card's note write it the same way.
   if(!strip){bad.push(`${label} [${tr.family}] no starter strip for a plan with a pre-mix feed`);}
   else{
    stripCases++;
    const stripPeak=Number(strip.dataset.peakMs);
    if(last?.kind==='pre_mix'&&Math.abs(stripPeak-tr.peakMs)>60000)bad.push(`${label} [${tr.family}] card peak ${fmt(tr.peakMs)} ≠ strip ${fmt(stripPeak)}`);
    if(Math.abs(stripPeak-preMix.bellPeak)>60000)bad.push(`${label} [${tr.family}] strip ${fmt(stripPeak)} ≠ pre-mix peak ${fmt(preMix.bellPeak)}`);
    const words=strip.querySelector('svg').getAttribute('aria-label').match(/peak (around \d+:\d\d[ap]m)/)?.[1];
    if(preMix.note&&words&&!preMix.note.includes(words))bad.push(`${label} [${tr.family}] card "${preMix.note}" ≠ strip "${words}"`);
    // Green ⇒ Start Dough inside the strip's ready window (the band the picker validates with).
    if(tr.pill==='green'&&last?.kind==='pre_mix'){
     const from=Number(strip.dataset.bandFrom),to=Number(strip.dataset.bandTo),slack=0.26*hour;
     if(tr.mixMs<from-slack||tr.mixMs>to+slack)bad.push(`${label} [${tr.family}] green but Start Dough ${fmt(tr.mixMs)} outside the ready window ${fmt(from)}–${fmt(to)}`);
    }
   }
  }
  // The render may re-align a feed so its peak meets the mix; the pill is then
  // checked against the peak the baker sees (below), not the scan's estimate.
  if(tr.scoredPeakMs!=null && Math.abs(tr.scoredPeakMs-tr.peakMs)>15*60000)realigned.push(`${label} [${tr.family}] scan ${fmt(tr.scoredPeakMs)} → shown ${fmt(tr.peakMs)}`);
  // Green ⇒ starter near peak at mix.
  if(tr.pill==='green'){
   // The starter's own band, the same for every dough flour (no flour widening since 21 Nov 2026).
   const tol=(loc==='fridge'&&tr.family==='pathB_fridge_hold')?2.0:Math.max(1.0,Math.min(3.0,(tr.adjPeakH||8)*0.15));
   const gapH=(tr.mixMs-tr.peakMs)/hour; // >0 mix after peak
   const lim=gapH<0?tol+0.5:tol;
   if(Math.abs(gapH)>lim+0.26)bad.push(`${label} [${tr.family}] green but mix ${fmt(tr.mixMs)} is ${gapH.toFixed(2)} h from peak ${fmt(tr.peakMs)} (tol ${lim.toFixed(2)})`);
  }
 }catch(err){bad.push('ERR '+label+': '+err.message);}
 finally{m?.unmount();await settle();}
}
console.log('untraced',JSON.stringify(skipped));console.log('realigned',realigned.length,realigned.slice(0,5).join(' | '));console.log('cases',n,'per flour',JSON.stringify(perFlour),'strip cases',stripCases,'families',JSON.stringify(fam),'violations',bad.length);console.log(bad.slice(0,25).join('\n'));
assert.deepEqual(errors,[],'Runtime errors');
assert.ok(n>=150*FS.length,'Too few traced cases: '+n);
assert.equal(bad.length,0,bad.join('\n'));
process.exit(0);
