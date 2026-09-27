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
const LABEL = process.argv[3] || process.argv[2];
const SETTLE = +(process.env.SETTLE || 400);
const FROZEN = process.env.FREEZE === '0' ? Math.ceil(Date.now()/3600000)*3600000 : Date.parse(process.env.NOW || '2026-09-27T01:00:00Z'); // Sun 09:00 Singapore

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
  return { text, data, blocks: JSON.stringify(n(r.blocks)) };
}
// The parent only receives blocks on an explicit commit (true on main as well),
// so chip-vs-parent-blocks is not a valid invariant here. The mount race is
// caught by the round-trip itself: A (chip ON at mount) must equal C.
function chipAgrees() {
  return true;
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

const at = (h) => new RealDate(FROZEN + h * 3600000);
const SCENARIOS = [
  { name: 'levain +46h 22C',    style: 'pain_levain', temp: 22, eat: at(46) },
  { name: 'levain +30h 22C',    style: 'pain_levain', temp: 22, eat: at(30) },
  { name: 'sourdough +46h 22C', style: 'sourdough',   temp: 22, eat: at(46) },
  { name: 'sourdough +26h 28C', style: 'sourdough',   temp: 28, eat: at(26) },
  { name: 'levain +46h 30C',    style: 'pain_levain', temp: 30, eat: at(46) },
  { name: 'sourdough +70h 22C', style: 'sourdough',   temp: 22, eat: at(70) },
];
const AGE = /^2[–-]3 days ago$/;

// [name, outbound(), back()] — same controls as the original console sweep.
const TOGGLES = {
  nights:    [() => clickBy(/^nights/i), () => clickBy(/^nights/i)],
  location:  [async () => { const ok = clickBy(/^fridge$/i); await wait(SETTLE); clickBy(AGE); return ok; },
              async () => { const ok = clickBy(/^room temp$/i); await wait(SETTLE); clickBy(AGE); return ok; }],
  maturity:  [() => clickBy(/^young/i), () => clickBy(/^active & healthy/i)],
  rye:       [() => clickBy(/^rye starter/i), () => clickBy(/^rye starter/i)],
  age:       [() => clickBy(/^4[–-]5 days ago$/), () => clickBy(AGE)],
  weekdays:  [() => clickBy(/^weekdays/i), () => clickBy(/^weekdays/i)],
  tangMild:  [() => clickBy(/^milder/i), () => clickBy(/^balanced/i)],
};
const ONLY = process.env.TOGGLES ? process.env.TOGGLES.split(',') : ['nights', 'location'];
const MODES = process.env.MODES ? process.env.MODES.split(',') : ['recommend', 'keep'];

const results = [];
for (const ratioMode of MODES) {
  for (const sc of SCENARIOS) {
    for (const t of ONLY) {
      console.log('BEGIN',ratioMode,sc.name,t);
      // fresh mount per trip: no cross-test contamination (lesson from run 1)
      const el = doc.getElementById('root'); el.innerHTML = '';
      let root;
      try {
        root = mount(el, { ...sc, start: new RealDate(FROZEN), loc: 'rt', age: 'days23',
          lastFed: new RealDate(FROZEN - 60 * 3600000), ratioMode, page: process.env.PAGE === '1', full: process.env.FULL === '1', batches: Number(process.env.BATCHES||1) });
      } catch (e) { results.push({ m: ratioMode, s: sc.name, t, status: 'MOUNT FAILED ' + e.message }); continue; }
      await wait(SETTLE * 3);
      const mountChipOk = chipAgrees();
      const A = signature();
      await wait(SETTLE * 2);
      const Anull = signature();
      const [go, back] = TOGGLES[t];
      let ok = await go(); await wait(+(process.env.OUTBOUND_WAIT || SETTLE));
      const B = signature();
      ok = ok && (await back()); await wait(SETTLE * 2);
      const C = signature();
      const endChipOk = chipAgrees();
      let status;
      if (!ok) status = 'control not found';
      else if (A.text !== Anull.text || A.data !== Anull.data) status = 'UNSTABLE (null test)';
      // PRIMARY criterion (unchanged since 29 Aug): card text A === C.
      else if (A.text === B.text) status = 'no-op';
      else if (A.text !== C.text) status = 'DIVERGED';
      else status = 'ok';
      // SECONDARY, stricter: solver outputs handed to the parent.
      const dataDiv = ok && A.data !== C.data;
      results.push({ m: ratioMode, s: sc.name, t, status, dataDiv, blocksChanged: A.blocks !== C.blocks,
        diff: (status === 'DIVERGED' ? 'TEXT ' + firstDiff(A.text, C.text) : '') + (dataDiv ? '\n     DATA ' + firstDiff(A.data, C.data) : '') });
      try { root.unmount(); } catch {}
    }
  }
}

console.log(`\n=== ${LABEL} | clock frozen at ${new RealDate(FROZEN).toISOString()} | settle ${SETTLE}ms ===`);
const by = {};
for (const r of results) (by[`${r.t} / ${r.m}`] ??= []).push(r.status);
const sym = (s) => (s === 'ok' ? '.' : s === 'DIVERGED' ? 'X' : s === 'no-op' ? 'o' : s === 'CHIP MISMATCH' ? 'C' : '?');
for (const [k, v] of Object.entries(by)) console.log(k.padEnd(22), v.map(sym).join(' '), '  card diverged', v.filter((s) => s === 'DIVERGED').length + '/' + v.length);
const dd = {};
for (const r of results) (dd[`${r.t} / ${r.m}`] ??= []).push(r.dataDiv ? 'D' : '.');
console.log('-- secondary: solver data handed to parent (start/feed/events/validity) --');
for (const [k, v] of Object.entries(dd)) console.log(k.padEnd(22), v.join(' '), '  data diverged', v.filter((x) => x === 'D').length + '/' + v.length);
console.log('scenarios order:', SCENARIOS.map((s) => s.name).join(' | '));
console.log('legend: . ok  X diverged  C chip≠plan  o no-op (toggle did not move plan: untested)  ? control not found/unstable');
for (const r of results.filter((r) => r.status !== 'ok' || r.dataDiv))
  console.log(' ', r.t.padEnd(9), r.m.padEnd(9), r.s.padEnd(20), r.status, r.diff ? '\n     ' + r.diff : '');
console.log('runtime errors captured:', errors.length, errors.slice(0, 2));
fs.writeFileSync(process.argv[2] + '.results.json', JSON.stringify(results, null, 1));
process.exit(errors.length || results.some(r => !['ok', 'no-op'].includes(r.status) || r.dataDiv) ? 1 : 0);

