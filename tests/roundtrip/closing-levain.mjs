// Exercise the real picker and its parent feedback at the time of the reported dead ends.
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
const starters=[
 {loc:'rt',age:'today',fedHours:-3},
 {loc:'rt',age:'yesterday',fedHours:-14},
 {loc:'fridge',age:'week',fedHours:-168},
];
let cases=0,covered=0,selected=0;
const coveredKinds=new Set();
for(const horizon of [24,32,48])for(const work of [false,true])for(const starter of starters){
 const label=[horizon+'h',work?'Weekdays+Nights':'Nights',starter.loc,starter.age].join(' ');
 if(process.env.CLOSING_SCENARIO && label!==process.env.CLOSING_SCENARIO)continue;
 console.log('START',label);
 let mounted;
 try{
  w.localStorage.clear();
  w.localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,blockers:{
   sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:work,from:'09:00',to:'18:00'},
  }}));
  mounted=await w.__mount(query('#root'),{
   temp:22,style:'pain_levain',loc:starter.loc,age:starter.age,eat:new w.Date(clock+horizon*hour),
   start:new w.Date(clock),lastFed:new w.Date(clock+starter.fedHours*hour),page:true,full:true,ratioMode:'recommend',
  });
  await settle();
  const chip=prefix=>[...doc.querySelectorAll('button[aria-pressed]')].find(button=>button.textContent.trim().toLowerCase().startsWith(prefix));
  assert.equal(chip('nights')?.getAttribute('aria-pressed'),'true','Nights must remain selected');
  assert.equal(chip('weekdays')?.getAttribute('aria-pressed'),String(work),'Weekdays must match the test case');
  // Check source starter events against the user's actual periods. A card
  // that omits a feed from both its headline and its rows must still fail.
  const periods=(w.__h.rec.blocks||[]).map(value=>value.split('|').slice(-2).map(Number));
  const listed=new Set(conflictRows().map(row=>row.dataset.conflictAction+'@'+row.dataset.conflictAt));
  for(const event of (w.__h.rec.events||'').split(',')){
   const [kind,stamp]=event.split('@'), at=Number(stamp);
   if(!['refresh','intermediate_refresh','pre_mix','fridge_out','fridge_in'].includes(kind)||at<clock)continue;
   if(periods.some(([from,to])=>from<=at&&at<to)){
    const id=kind.startsWith('fridge')?'starter-cold':'starter-feed';
    assert.ok(listed.has(id+'@'+at),'Missing blocked starter action: '+event);
   }
  }
  async function coverListedActions(){
   let rows=conflictRows();
   const seen=new Set();
   while(rows.length){
    const row=rows[0];
    const key=row.dataset.conflictAction+'@'+row.dataset.conflictAt;
    assert.ok(!seen.has(key),'Cover did not remove the named conflict: '+key);
    seen.add(key);
    assert.ok(seen.size<80,'Conflict list cycles');
    coveredKinds.add(row.dataset.conflictAction);
    row.querySelector('button').click();
    await settle();
    covered++;
    rows=conflictRows();
   }
  }
  await coverListedActions();
  if(!eligible()){
   const deadline=Date.now()+120000;
   while(query('[data-searching-bakes]')&&!query('.bh-target-choices button:not(:disabled)')&&Date.now()<deadline)await settle();
   const repair=query('.bh-target-choices button:not(:disabled)');
   assert.ok(repair,'No usable later bake offered: '+(query('.bh-plan-state')?.textContent||doc.body.textContent.slice(-300)));
   repair.click();await settle();selected++;
   assert.ok(w.__h.rec.bake>clock+horizon*hour && w.__h.rec.bake<=clock+(horizon+72)*hour,'Offered bake must fit the stated 72 hour search');
   await coverListedActions();
  }
  assert.ok(eligible(),'Starter or schedule still prevents recipe generation after the displayed action: '+JSON.stringify(w.__h.rec));
  assert.equal(conflictRows().length,0,'Valid schedule retained uncovered actions');
  cases++;console.log('PASS',label);
 } catch(error){failures.push(label+': '+error.message);console.error('FAIL',failures.at(-1));}
 finally{mounted?.unmount();await settle();}
}
console.log({passed:cases,covered,coveredKinds:[...coveredKinds].sort(),selected,runtimeErrors:errors.length});
assert.deepEqual(errors,[],'Runtime errors');
assert.equal(failures.length,0,failures.join('\n'));
if(!process.env.CLOSING_SCENARIO){
 assert.equal(cases,18);
 assert.ok(coveredKinds.has('starter-feed'),'Matrix did not exercise a blocked feed');
 assert.ok([...coveredKinds].some(id=>id.startsWith('fold-')),'Matrix did not exercise a blocked fold');
}
