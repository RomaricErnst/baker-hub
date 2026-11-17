// Raised levain % through the real picker (17 Nov 2026 cool-kitchen review). A 9-to-5
// baker (busy weekdays 9:00–17:30, nights 23:00–7:00), 19 °C kitchen, fridge 5 °C, a
// fridge-kept starter fed five days ago, one pain au levain, bake Saturday 10:00. The
// default bulk runs into the night after an evening mix; the planner raises the levain %
// (never above 30 %, never over a baker-entered %, only with enough starter) and times
// the levain build before work. Runs in any TZ: every time is local.
//   node tests/roundtrip/build-path.mjs && node tests/roundtrip/levain-raise.mjs .ci-tools/starter-path.js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {MessageChannel} from 'node:worker_threads';
const require = createRequire(new URL('../../.ci-tools/package.json', import.meta.url));
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', {url:'https://www.bakerhub.app/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window, doc=w.document;
const clock=+new Date(2026,10,17,19,30), hour=3600000;
w.Date=class extends w.Date{constructor(...a){super(...(a.length?a:[clock]));} static now(){return clock;}};
w.MessageChannel??=MessageChannel;
w.HTMLElement.prototype.scrollIntoView=()=>{};w.Element.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
w.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn([{contentRect:{width:390,height:844}}],this);}unobserve(){}disconnect(){}};
w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.SVGElement.prototype.getBBox=()=>({x:0,y:0,width:40,height:12});
w.SVGElement.prototype.getComputedTextLength=function(){return (this.textContent||'').length*6;};
w.process={env:{NODE_ENV:'development'}};
const errors=[];w.addEventListener('error',e=>errors.push(String(e.error||e.message)));
console.error=()=>{};
w.eval(fs.readFileSync(process.argv[2],'utf8'));
const settle=(ms=200)=>new Promise(r=>setTimeout(r,ms));
const fmt=ms=>new Date(ms).toLocaleString('en-GB',{weekday:'short',hour:'2-digit',minute:'2-digit'});
const FEEDS=['refresh','intermediate_refresh','pre_mix'];

async function run(o){
 w.localStorage.clear();
 w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{sleep:{enabled:o.busy!=='none',from:'23:00',to:'07:00'},work:{enabled:o.busy==='weekdays+nights',from:'09:00',to:'17:30'}}}));
 w.__bhTrace=[];
 const eat=new w.Date(o.bake??+new Date(2026,10,21,10,0));
 const m=await w.__mount(doc.querySelector('#root'),{temp:o.temp??19,style:'pain_levain',loc:o.loc??'fridge',age:o.age??'days45',eat,start:new w.Date(clock),
  lastFed:new w.Date(clock+(o.fedH??-120)*hour),page:true,full:true,ratioMode:'recommend',starterBulkFactor:1,levainAuto:o.auto??true,bakerPct:o.bakerPct,raiseFits:o.raiseFits,
  flour:508,fridgeTemp:5,numItems:1,mixer:o.mixer??'no_knead'});
 await settle();await settle();
 const deadline=Date.now()+90000;
 while(doc.querySelector('[data-searching-bakes]')&&Date.now()<deadline)await settle(400);
 await settle();
 const rec={...w.__h.rec},s=w.__h.schedule,tr=w.__bhTrace.at(-1);
 const blocks=(rec.blocks||[]).map(b=>b.split('|').slice(-2).map(Number));
 const busyAt=t=>blocks.some(([a,b])=>a<=t&&t<b);
 const events=(rec.events||'').split(',').filter(Boolean).map(e=>{const[k,t]=e.split('@');return{k,t:Number(t)};});
 const conflicts=[...doc.querySelectorAll('[data-availability-conflicts] > li')].length;
 const choices=doc.querySelectorAll('.bh-target-choices button').length;
 const out={rec,s,tr,events,conflicts,choices,feeds:events.filter(e=>FEEDS.includes(e.k)&&e.t>clock),busyFeeds:events.filter(e=>e.k!=='last_fed'&&e.t>clock&&busyAt(e.t)),
  kept:rec.bake===+eat,valid:rec.scheduleValid===true&&rec.starterValid!==false};
 m.unmount();await settle();
 return out;
}

// Her bake: raised, kept, nothing hands-on in busy time, green, levain build before work.
const her=await run({busy:'weekdays+nights'});
assert.ok(her.kept&&her.valid,'Saturday 10:00 kept with a valid plan');
assert.equal(her.conflicts,0,'no listed clash');
assert.deepEqual(her.busyFeeds,[],'no starter step in busy time');
assert.ok(her.rec.autoPct>22.5&&her.rec.autoPct<=30,`raised levain ${her.rec.autoPct}`);
assert.equal(her.tr?.pill,'green');
const mix=+new Date(her.rec.start);
assert.ok(new Date(mix).getDay()===5&&new Date(mix).getHours()>=17,`evening mix ${fmt(mix)}`);
const build=her.feeds.filter(e=>e.k==='pre_mix').at(-1);
assert.ok(build&&new Date(build.t).getDay()===5&&new Date(build.t).getHours()>=7&&+build.t<+new Date(2026,10,20,9,0),`levain build before work: ${build&&fmt(build.t)}`);
const bulkEnd=+her.s.bulkFermStart+her.s.bulkFermHours*hour;
assert.ok(bulkEnd<=+new Date(2026,10,20,23,0)&&+her.s.divideBallTime<+new Date(2026,10,20,23,0),'bulk and shaping before the night');
console.log('her bake',her.rec.autoPct+'%',fmt(mix),'build',fmt(build.t),'shape',fmt(+her.s.divideBallTime));

// A baker-entered 20 % is never raised: the requested bake does not fit, another day is offered.
const typed=await run({busy:'weekdays+nights',bakerPct:20});
assert.equal(typed.rec.autoPct,undefined,'a baker-entered % is not raised');
assert.ok(!typed.valid,'no valid plan for Saturday 10:00 at 20 %');
assert.ok(typed.choices>0,'another bake time is offered');

// Not enough starter for the raise: the default % stays and the bake is not kept.
const short=await run({busy:'weekdays+nights',raiseFits:false});
assert.equal(short.rec.autoPct,undefined,'no raise without enough starter');
assert.ok(!short.valid);

// Free or warm bakes are unchanged: same plan with and without the raise wiring.
for(const o of [{busy:'none'},{busy:'none',temp:25},{busy:'nights',temp:25},{busy:'none',loc:'rt',age:'today',fedH:-11.5}]){
 const a=await run({...o,auto:false}),b=await run(o);
 assert.equal(b.rec.autoPct,undefined,`${JSON.stringify(o)}: no raise`);
 assert.equal(b.rec.start,a.rec.start,`${JSON.stringify(o)}: same mix`);
 assert.deepEqual(b.events,a.events,`${JSON.stringify(o)}: same starter plan`);
}
assert.deepEqual(errors,[],'no runtime errors');
console.log('levain-raise: ok');
process.exit(0);
