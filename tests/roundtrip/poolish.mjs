// node run.mjs <bundle.js> [label]
// Round-trip (A -> B -> A) sweep of the real SchedulePicker in jsdom.
// Clock is FROZEN, so any difference between A and A' is a state difference,
// never elapsed time. Criteria unchanged from the 29 Aug harness: card text
// must be identical after returning to the original input; this version also
// compares the solver outputs the parent receives (start, feeds, starter
// events, blocks, validity) and checks the Nights chip agrees with the blocks.
import fs from 'fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../.ci-tools/package.json', import.meta.url));
const { JSDOM } = require('jsdom');

const bundle = fs.readFileSync(process.argv[2], 'utf8');
import assert from 'node:assert/strict';
const SETTLE = +(process.env.SETTLE || 400);
const FROZEN = process.env.FREEZE === '0' ? Math.ceil(Date.now()/3600000)*3600000 : Date.parse(process.env.NOW || '2026-09-27T15:50:00Z'); // Sun 09:00 Singapore

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { pretendToBeVisual: true, runScripts: 'outside-only', url: 'https://www.bakerhub.app/' });
const { window } = dom;

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
for(const temp of [22,28,30]) {
 const root=mount(doc.getElementById('root'),{start:new Date('2026-09-28T07:00:00Z'),eat:new Date('2026-09-28T19:30:00Z'),style:'neapolitan',temp,full:true,page:true});
 await wait(1200);
 clickBy(/^nights/i); await wait(800);
 clickBy(/^weekdays/i); await wait(1200);
 assert.equal(window.__h.rec.scheduleValid,false);
 const notice=doc.querySelector('.bh-plan-notice')?.textContent || '';
 assert.match(notice,/fridge.*Mon 28 Sep/);
 assert.match(notice,/9am–6pm/);
 assert.match(notice,/baking time/);

 clickBy(/^weekdays/i); await wait(1200);
 assert.equal(window.__h.rec.scheduleValid,true);
 assert.equal(doc.querySelector('.bh-plan-notice'),null);
 clickBy(/^weekdays/i); await wait(1200);
 assert.equal(window.__h.rec.scheduleValid,false);
 assert.match(doc.querySelector('.bh-plan-notice')?.textContent || '',/9am–6pm/);
 origErr(`PASS poolish Monday 19:30, nights + work, ${temp}°C, blocker round trip`);

 root.unmount();await wait(50);
}
assert.deepEqual(errors,[]);window.close();
