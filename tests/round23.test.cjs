// Round 23 (26 Nov 2026): the round-22 live pass. The ask token survives a change of network; the plan's first row
// carries its busy tag; the scan's reading reaches the flour form; Maestro's schedule in the order it happens; the
// question box's example per step; Preparation's steps in Adjust timing; the cooking screen's bottom bar.
process.env.TZ = 'Asia/Singapore';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript'), Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...x) { return resolve.call(this, r.startsWith('@/') ? path.join(__dirname, '..', r.slice(2)) : r, ...x); };
const compile = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: f }).outputText, f);
require.extensions['.ts'] = compile; require.extensions['.tsx'] = compile;
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const SG = s => new Date(s + '+08:00');

test('1: the ask token is bound to the page, not the address; the client retries a refused token once', () => {
  const guard = require('../app/lib/apiGuard.ts');
  const page = 'pageZZZZZZZZZZZZZZZZ9';
  const token = guard.issueAskToken('bake-coach', page);
  assert.ok(guard.validAskToken('bake-coach', page, token));
  assert.ok(!guard.validAskToken('bake-coach', 'pageYYYYYYYYYYYYYYYY8', token));
  assert.equal(guard.pageIdOf({ get: () => 'short' }), null);
  const client = read('app/lib/askToken.ts');
  assert.match(client, /'x-bh-page': askPageId\(\)/);
  assert.match(client, /if \(res\.status !== 403\) return res;\s*dropAskToken\(route\);\s*return send\(\);/);
  // Both callers go through it; the 429 is the calm "busy" line.
  assert.match(read('app/components/BakeGuide.tsx'), /askPost\('bake-coach', body\)/);
  assert.match(read('app/components/FlourScan.tsx'), /askPost\('flour-scan', body, signal\)/);
  assert.match(read('app/components/BakeGuide.tsx'), /setError\(res\.status === 429 \? 'busy' : 'failed'\)/);
});

test('2: the plan\'s first row is judged by the same busy rule as every other row', () => {
  const page = read('app/[locale]/page.tsx');
  assert.match(page, /function planRowBusy\(key:string,at:Date\):boolean/);
  assert.match(page, /startBusy=\{recipeStartBusy\}/);
  assert.match(page, /const all=\[\{key:startKey\?\?'start',at:round5\(startAt\),label:startLabel \?\? \(fr\?'Commencer':'Start'\),bake:false,own:true,busy:startBusy\}/);
  // The starter's take-out at 11:15pm inside a 23:00–07:00 night is busy (a quick step, not on the edge).
  const av = require('../app/utils/scheduleAvailability.ts');
  const night = [+SG('2026-11-27T23:00:00'), +SG('2026-11-28T07:00:00')];
  assert.ok(av.busyHit({ id: 'starter-fridge_out-1', at: SG('2026-11-27T23:15:00') }, ...night));
  assert.ok(!av.busyHit({ id: 'starter-fridge_out-1', at: SG('2026-11-27T23:00:00') }, ...night), 'a quick step on the edge stays free (E1)');
});

test('5: a scan with no catalogue match keeps its protein and its W estimate (never a stated W)', () => {
  const { data } = require('./load-production.cjs');
  const m = { exports: {} };
  const code = ts.transpileModule(read('app/components/FlourPicker.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module: m, exports: m.exports, require: p => p === '../data' ? data : p === '@/lib/flourDatabase' ? { FLOUR_DB: [] } : p.startsWith('.') ? {} : require(p) });
  const { manualFlourSelection } = m.exports;
  const base = { flour1: 'pizza00', ratio1: 100 };
  const scanned = manualFlourSelection(base, 'bread', 'Moulin du Val T65', '', '11,5', 'fr', 220);
  assert.equal(scanned.w1, 220); assert.equal(scanned.w1Source, 'typical', 'an estimate does not set the tolerance');
  assert.equal(scanned.manualFlour1.protein, 11.5);
  // A typed W wins; no estimate, the type's typical W as before.
  assert.equal(manualFlourSelection(base, 'bread', '', '300', '', 'en', 220).w1Source, 'manual');
  assert.equal(manualFlourSelection(base, 'bread', '', '', '', 'en').w1, data.FLOUR_DATA.bread.w);
  const picker = read('app/components/FlourPicker.tsx');
  assert.equal((picker.match(/fromScan\(result\)/g) ?? []).length, 2, 'both scan paths hand the reading to the form');
});

test('6: Maestro reads the dough\'s phases in the order they happen, with their real lengths', () => {
  const { maestroPhases, buildMaestroContext } = require('../app/utils/maestroContext.ts');
  const mix = SG('2026-11-25T20:15:00');
  const sched = { bulkFermStart: mix, coldRetardStart: SG('2026-11-25T23:00:00'), coldRetardEnd: SG('2026-11-26T15:30:00'), bakeStart: SG('2026-11-26T19:30:00'),
    coldRetard1Start: null, coldRetard1End: null, coldRetard2Start: null, coldRetard2End: null, totalColdHours: 16.5, totalRTHours: 6.75 };
  assert.equal(maestroPhases(sched), 'from mixing to baking, in this order: room temperature 2 h 45 min, then fridge 16 h 30 min, then room temperature 4 h before the bake');
  // Two spells (bulk, then the balls).
  const two = { ...sched, coldRetardStart: null, coldRetardEnd: null, coldRetard1Start: SG('2026-11-25T22:00:00'), coldRetard1End: SG('2026-11-26T08:00:00'), coldRetard2Start: SG('2026-11-26T08:30:00'), coldRetard2End: SG('2026-11-26T16:00:00') };
  assert.match(maestroPhases(two), /room temperature 1 h 45 min, then fridge 10 h, then room temperature 30 min, then fridge 7 h 30 min, then room temperature 3 h 30 min before the bake$/);
  const recipe = { flour: 600, totalDough: 1000, salt: 17, hydration: 65, yeast: { convertedGrams: 0.7, yeastType: 'instant' } };
  const ctx = buildMaestroContext({ recipe, schedule: sched, styleKey: 'neapolitan', numItems: 4, hydration: 65, kitchenTemp: 22 });
  assert.doesNotMatch(ctx, /h cold \(fridge\) ferment|room-temp ferment/);
  const route = read('app/api/bake-coach/route.ts');
  assert.match(route, /never tell the baker to enter or type a value anywhere/);
  assert.doesNotMatch(route, /use the recipe calculator/);
});

test('7: Adjust timing lists Preparation\'s steps (no "Resume kneading", quarter hours, no span on Start Dough)', () => {
  const picker = read('app/components/SchedulePicker.tsx');
  assert.doesNotMatch(picker, /Resume kneading'/);
  assert.match(picker, /const handsOnRows=interventionRows\.filter\(row=>!\/\(\?:\^\|:\)mix-finish\/\.test\(row\.id\)\)/);
  assert.match(picker, /at:Math\.round\(row\.at\/900000\)\*900000,endAt:row\.id==='bake'\|\|row\.id==='dough:bake'\?row\.endAt:undefined/);
});

test('12: the question box\'s example fits its step', () => {
  require('./load-production.cjs');
  const { askPlaceholder } = require('../app/components/BakeGuide.tsx');
  assert.equal(askPlaceholder('preheat', false), 'Is my oven hot enough?');
  assert.equal(askPlaceholder('pizza_maestro', true), 'Mon four est-il assez chaud ?');
  assert.equal(askPlaceholder('mix', false), 'My dough is sticky…');
  assert.equal(askPlaceholder('bulk', true), 'A-t-elle assez levé ?');
});

test('12: the .ics preheat lasts until the bake; garlic and chilli are "Slice & chop"; "5 mm", "W 300"', () => {
  const page = read('app/[locale]/page.tsx');
  assert.match(page, /event\.key==='preheat'&&eatTime&&\+eatTime>\+event\.at\?\{\.\.\.event,end:new Date\(\+eatTime\)\}/);
  const prep = read('app/components/pizzaParty/PrepTab.tsx');
  assert.match(prep, /\{ id: 'chop',\s+en: 'Slice & chop',\s+fr: 'Émincer' \}/);
  assert.doesNotMatch(read('app/lib/toppingDatabase.ts'), /\dmm\b/);
  assert.match(read('app/components/FlourPicker.tsx'), /W\{'\\u00a0'\}\{blend\.w1Source === 'typical' \? '~' : ''\}/);
});
