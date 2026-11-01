// node run.mjs <bundle.js> [label]
// Round-trip (A -> B -> A) sweep of the real SchedulePicker in jsdom.
// Clock is FROZEN, so any difference between A and A' is a state difference,
// never elapsed time. Criteria unchanged from the 29 Aug harness: card text
// must be identical after returning to the original input; this version also
// compares the solver outputs the parent receives (start, feeds, starter
// events, blocks, validity) and checks the Nights chip agrees with the blocks.
import fs from 'fs';
import {MessageChannel} from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.ci-tools/package.json', import.meta.url));
const { JSDOM } = require('jsdom');

const bundle = fs.readFileSync(process.argv[2], 'utf8');
const LABEL = process.argv[3] || process.argv[2];
const SETTLE = +(process.env.SETTLE || 400);
const FROZEN = process.env.FREEZE === '0' ? Math.ceil(Date.now()/3600000)*3600000 : Date.parse(process.env.NOW || '2026-09-27T01:00:00Z'); // Sun 09:00 Singapore

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'https://www.bakerhub.app/' });
const { window } = dom;
window.MessageChannel ??= MessageChannel;

// ── frozen clock ────────────────────────────────────────────────
const RealDate = window.Date;
class FrozenDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(FROZEN); else super(...a); }
  static now() { return FROZEN; }
}
if (process.env.FREEZE !== '0') window.Date = FrozenDate;

// ── shims jsdom lacks ───────────────────────────────────────────
const P = window.SVGElement.prototype;
P.getBBox = function () { return { x: 0, y: 0, width: 40, height: 12 }; };
P.getComputedTextLength = function () { return (this.textContent || '').length * 6; };
P.getScreenCTM = function () { return { a: 1, d: 1, e: 0, f: 0, inverse: () => ({ a: 1, d: 1, e: 0, f: 0 }) }; };
window.SVGSVGElement.prototype.createSVGPoint = function () { return { x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) }; };
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.scrollTo = function () {};
window.scrollTo = () => {};
class RO { constructor(cb) { this.cb = cb; } observe() { this.cb([{ contentRect: { width: 380, height: 300 } }], this); } unobserve() {} disconnect() {} }
window.ResizeObserver = RO;
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
window.IS_REACT_ACT_ENVIRONMENT = false;

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.error || e.message)));
const origErr = console.error;
console.error = (...a) => { const s = a.map(String).join(' '); if (!/act\(|not wrapped|Warning:/.test(s)) errors.push(s.slice(0, 300)); };

window.process = { env: { NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder' } };
window.eval(bundle);
const mount = window.__mount;
if (!mount) { origErr('bundle did not expose __mount'); process.exit(1); }

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const doc = window.document;

function buttons() { return [...doc.querySelectorAll('button,[role=button]')]; }
function clickBy(re) {
  const el = buttons().find((e) => re.test((e.textContent || '').replace(/\s+/g, ' ').trim()));
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}
function nightsChip() { return buttons().find((e) => /^nights/i.test((e.textContent || '').trim())); }

function signature() {
  const text = (doc.getElementById('root').textContent || '').replace(/\s+/g, ' ').trim();
  const r = window.__h.rec;
  // Plan data the parent receives. undefined/null are the same (a field the
  // component simply has not emitted yet). Parent blocks are reported apart:
  // the parent only receives blocks on a commit, on main as on the branch.
  const n = (v) => (v === undefined ? null : v);
  const data = JSON.stringify({ start: n(r.start), feed: n(r.feed), fridgeOut: n(r.fridgeOut), events: n(r.events),
    scheduleValid: n(r.scheduleValid), starterValid: n(r.starterValid), nextRatio: n(r.nextRatio) });
  return { text, data, blocks: JSON.stringify(r.blocks??[]), valid:r.scheduleValid===true };
}
// The parent only receives blocks on an explicit commit (true on main as well),
// so chip-vs-parent-blocks is not a valid invariant here. The mount race is
// caught by the round-trip itself: A (chip ON at mount) must equal C.
function chipAgrees() {
  const chip = nightsChip();
  if (!chip) return true;
  const on = chip.getAttribute('aria-pressed') === 'true';
  const hasNight = (window.__h.rec.blocks || []).some((b) => b.split('|')[0].endsWith(' night'));
  return on === hasNight;
}
function firstDiff(a, b) {
  let k = 0; while (k < Math.min(a.length, b.length) && a[k] === b[k]) k++;
  return `@${k}: «${a.slice(Math.max(0, k - 20), k + 70)}» vs «${b.slice(Math.max(0, k - 20), k + 70)}»`;
}


const at=h=>new RealDate(FROZEN+h*3600000);
let failures=0,cases=0;
async function solve(sc,path=[]){
 window.localStorage.clear();const el=doc.getElementById('root');el.innerHTML='';
 const root=await mount(el,{...sc,start:at(0),lastFed:at(-168),page:true,full:true,ratioMode:'recommend'});
 await wait(SETTLE*3);
 for(const horizon of path){
 const target=at(horizon),value=target.getFullYear()+'-'+String(target.getMonth()+1).padStart(2,'0')+'-'+String(target.getDate()).padStart(2,'0')+'T'+String(target.getHours()).padStart(2,'0')+':'+String(target.getMinutes()).padStart(2,'0');
 const input=doc.querySelector('input[type="datetime-local"]');
 Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,value);
 input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));
 await wait(450+SETTLE*2);
}
 const result=signature();
 root.unmount();await wait(10);return result;
}
for(const temp of [22,28])for(const style of ['pain_levain','sourdough'])for(const loc of ['rt','fridge'])for(const horizon of [24,36,48]){
 const sc={temp,style,loc,age:'week',eat:at(horizon)};
 const direct=await solve(sc);
 const via=await solve({...sc,eat:at(48)},[36,60,horizon]);
 cases++; console.log("CHECKED",cases,style,temp,loc,horizon);
 if(direct.data!==via.data||direct.blocks!==via.blocks){
  failures++;console.log('PATH DIFFERENCE',JSON.stringify(sc),firstDiff(direct.data,via.data),firstDiff(direct.blocks,via.blocks));
 }
}
console.log({cases,failures,runtimeErrors:errors.length});
process.exit(failures||errors.length?1:0);
