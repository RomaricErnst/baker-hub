// A baker-entered starter % re-times the levain bulk (starterBulkFactor). After
// the edit the starter plan must still be a plan a baker can follow: no feed
// before the previous feed has peaked, feeds on 15-minute marks, and the card
// peak equal to the bell. Sweeps starter % × temperature × location × last fed
// × horizon through the real picker, as a fresh mount and as an edit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {MessageChannel} from 'node:worker_threads';
const require = createRequire(new URL('../../.ci-tools/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const {utils} = createRequire(import.meta.url)('../load-production.cjs');
const dom = new JSDOM('<div id="root"></div>', {url:'https://www.bakerhub.app/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window, doc=w.document;
const clock=Date.parse('2026-11-10T09:00:00+08:00'), hour=3600000, quarter=15*60000;
assert.equal(new Date(clock).getHours(),9,'Run with TZ=Asia/Singapore');
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
const fmt=ms=>new Date(ms).toISOString().slice(5,16);
const FEEDS=['refresh','intermediate_refresh','pre_mix'];
function check(label,tr,bad){
 const feeds=tr.events.filter(e=>FEEDS.includes(e.kind)&&e.t>=clock).sort((a,b)=>a.t-b.t);
 for(const f of feeds)if(f.t%quarter)bad.push(`${label} [${tr.family}] ${f.kind} ${fmt(f.t)} is not on a 15-minute mark`);
 // Each planned feed waits for the previous feed's peak (15 min of display rounding).
 for(let i=1;i<feeds.length;i++){
  const prev=feeds[i-1];
  if(prev.bellPeak!=null&&feeds[i].t<prev.bellPeak-quarter)bad.push(`${label} [${tr.family}] ${feeds[i].kind} ${fmt(feeds[i].t)} before the ${prev.kind} peak ${fmt(prev.bellPeak)}`);
 }
 // Mixing waits for the last feed's peak too (the green tolerance lives in peak-consistency).
 const last=feeds.filter(f=>f.active&&f.bellPeak!=null&&f.t<=tr.mixMs).at(-1);
 if(last?.bellPeak!=null&&tr.peakMs!=null&&Math.abs(last.bellPeak-tr.peakMs)>60000)bad.push(`${label} [${tr.family}] card peak ${fmt(tr.peakMs)} ≠ bell ${fmt(last.bellPeak)}`);
}
const bad=[];let n=0;const fam={};
// pain_levain, and Neapolitan with a levain preferment (the audit's repro).
const PCT=[5,10,20,30],T=[16,24,32],L=['fridge','rt'],A=[['yesterday',-13],['days23',-60]],HZ=[24,58],RUNS=[['pain_levain','mount'],['pain_levain','edit'],['neapolitan','edit']];
for(const pct of PCT)for(const temp of T)for(const loc of L)for(const age of A)for(const horizon of HZ)for(const [style,mode] of RUNS){
 const factor=utils.starterBulkFactor(pct,temp);
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}}));
 w.__bhTrace=[];
 let m;const label=`${style} ${pct}% ${temp}C ${loc} ${age[0]} +${horizon}h ${mode}`;
 try{
  m=await w.__mount(doc.querySelector('#root'),{temp,style,loc,age:age[0],eat:new w.Date(clock+horizon*hour),start:new w.Date(clock),lastFed:new w.Date(clock+age[1]*hour),page:true,full:true,ratioMode:'recommend',starterBulkFactor:mode==='mount'?factor:1});
  await settle();await settle();
  if(mode==='edit'){w.__bhTrace=[];w.__changeStarterFactor(factor);await settle();await settle();await settle();}
  const tr=w.__bhTrace.at(-1);
  if(!tr||tr.planningMode!=='last_fed')continue;
  n++;fam[tr.family]=(fam[tr.family]||0)+1;
  check(label,tr,bad);
 }catch(err){bad.push('ERR '+label+': '+err.message);}
 finally{m?.unmount();await settle();}
}
console.log('cases',n,'families',JSON.stringify(fam),'violations',bad.length);console.log(bad.slice(0,Number(process.env.SHOW||30)).join('\n'));
assert.deepEqual(errors,[],'Runtime errors');
assert.ok(n>=150,'Too few traced cases: '+n);
assert.equal(bad.length,0,bad.join('\n'));
process.exit(0);
