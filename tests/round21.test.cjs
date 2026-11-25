// Round 21 (25 Nov 2026): owner rule E1 (one busy-time edge rule), Bake again from today's inputs, polish (P).
// Singapore bakes; the night (22:00–07:00) is read in local time: pin the zone before any Date.
process.env.TZ = 'Asia/Singapore';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...x) { return resolve.call(this, r.startsWith('@/') ? path.join(__dirname, '..', r.slice(2)) : r, ...x); };
const compile = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: f }).outputText, f);
require.extensions['.ts'] = compile; require.extensions['.tsx'] = compile;
const utils = require('../app/utils.ts');
const av = require('../app/utils/scheduleAvailability.ts');
const units = require('../app/utils/units.ts');
const sp = require('../app/components/SchedulePicker.tsx');

const H = 3600000, M = 60000;
const SG = s => new Date(s + '+08:00');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const hhmm = d => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const night = { label: 'Thursday night', from: SG('2026-11-26T23:00:00'), to: SG('2026-11-27T07:00:00') };
const at = s => SG('2026-11-26T' + s + ':00');

test('E1: quick steps may sit on either edge; long steps end by the start, may start at the end; inside is busy', () => {
  const f = +night.from, t = +night.to;
  // Quick: fold, into/out of the fridge, take-out, preheat, starter fridge moves.
  for (const id of ['fold-1', 'fold-2-batch-2', 'cold-in', 'cold-out', 'cold-in-2', 'cold-out-2', 'preheat', 'preferment-cold-in', 'preferment-cold-out', 'starter-cold', 'starter-fridge_in', 'starter-fridge_out']) {
    assert.equal(av.isQuickAction(id), true, id);
    assert.equal(av.busyHit({ id, at: new Date(f) }, f, t), false, id + ' at the start ("before bed")');
    assert.equal(av.busyHit({ id, at: new Date(t) }, f, t), false, id + ' at the end ("on waking")');
    assert.equal(av.busyHit({ id, at: new Date(f + 15 * M) }, f, t), true, id + ' inside');
  }
  // Long: Start Dough, make the preferment, a feed, divide & shape, the bake.
  for (const id of ['mix', 'mix-finish', 'autolyse', 'preferment', 'starter-feed', 'divide', 'bake']) {
    assert.equal(av.isQuickAction(id), false, id);
    assert.equal(av.busyHit({ id, at: new Date(f) }, f, t), true, id + ' starting at the start is inside');
    assert.equal(av.busyHit({ id, at: new Date(t) }, f, t), false, id + ' may start at the end');
    assert.equal(av.busyHit({ id, at: new Date(f - 15 * M), end: new Date(f) }, f, t), false, id + ' ending at the start');
    assert.equal(av.busyHit({ id, at: new Date(f - 10 * M), end: new Date(f + 5 * M) }, f, t), true, id + ' crossing the start');
  }
  // The same rule in the conflict checker (clash sheets, assessScheduleDraft) and isTimeBlocked.
  assert.equal(av.findAvailabilityConflicts([{ id: 'cold-in', at: night.from }], [night]).length, 0);
  assert.equal(av.findAvailabilityConflicts([{ id: 'divide', at: at('22:45'), end: night.from }], [night]).length, 0);
  assert.equal(av.findAvailabilityConflicts([{ id: 'divide', at: at('22:50'), end: at('23:05') }], [night]).length, 1);
  assert.equal(av.findAvailabilityConflicts([{ id: 'mix', at: night.from }], [night]).length, 1);
  assert.equal(av.isTimeBlocked(night.from, [night], true), false);
  assert.equal(av.isTimeBlocked(night.from, [night]), true);
});

test('E1 in the night rules: the baker\'s own nights read E1, the clock night keeps main\'s tests', () => {
  const steps = [{ id: 'fold-1', at: at('22:00') }, { id: 'divide', at: at('21:50'), end: at('22:05') }, { id: 'mix', at: at('21:30'), end: at('22:00') },
    { id: 'cold-in', at: at('23:00') }, { id: 'cold-out', at: SG('2026-11-27T07:00:00') }, { id: 'divide', at: SG('2026-11-27T07:00:00'), end: SG('2026-11-27T07:15:00') }];
  // Clock night (no busy times): main's test on a step's start, edges exclusive (22:00 and 07:00 are not night).
  assert.deepEqual(av.nightHandsOn(steps, []).map(a => a.id + '@' + hhmm(a.at)), ['cold-in@Thu 23:00']);
  // With the baker's Nights, a long step starting at 23:00 is inside it (E1); the quick fridge step on the edge is not.
  assert.deepEqual(av.nightHandsOn([{ id: 'mix', at: at('23:00') }], [night]).map(a => a.id), ['mix']);
  // D4 (newNightHandsOn, automatic plans): with their own 23:00 night, 22:00–23:00 is free and the quick 23:00 edge too.
  assert.deepEqual(av.newNightHandsOn(steps, [night]).map(a => a.id), []);
  assert.deepEqual(av.newNightHandsOn(steps, []).map(a => a.id), ['fold-1', 'cold-in']);
  assert.deepEqual(av.newNightHandsOn([{ id: 'mix', at: at('23:00') }], [night]).map(a => a.id), ['mix']);
});

test('E1 in the engine: shaping may end at 23:00 and the balls go in at 23:00 under a 23:00 night (shaping that would cross it moves)', () => {
  const nights = [night, { label: 'Friday night', from: SG('2026-11-27T23:00:00'), to: SG('2026-11-28T07:00:00') }];
  const s = utils.buildSchedule(at('20:15'), SG('2026-11-27T11:30:00'), nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  const byId = Object.fromEntries(s.availabilityActions.map(a => [a.id, a]));
  assert.equal(hhmm(byId.divide.at), 'Thu 22:45'); assert.equal(+byId.divide.end, +night.from);
  assert.equal(+byId['cold-in-2'].at, +night.from);
  assert.deepEqual(s.availabilityConflicts, []);
  // Fifteen minutes later the shaping would cross 23:00: it is not planned there (no long step overlaps the night).
  const later = utils.buildSchedule(at('20:30'), SG('2026-11-27T11:30:00'), nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  for (const a of later.availabilityActions) if (!av.isQuickAction(a.id) && a.id !== 'bake') assert.equal(nights.some(b => av.busyHit(a, +b.from, +b.to)) && !later.availabilityConflicts.some(c => c.action === a), false, a.id);
  // A fridge return exactly at a busy start: shaping ends then (engine-availability.test.cjs has the 22:30 block).
  const blocked = utils.buildSchedule(new Date('2026-09-27T16:00Z'), new Date('2026-09-28T18:00Z'), [{ from: new Date('2026-09-27T22:30Z'), to: new Date('2026-09-27T22:45Z'), label: 'Busy' }], 22, 60, 'hand', 'neapolitan');
  assert.equal(+blocked.coldRetard2Start, +new Date('2026-09-27T22:30Z'));
  // The automatic plan for B3's lunch keeps main's 20:00: the clock's 23:00–07:00 daytime preference still reads the 23:00
  // fridge step as overnight (E1 changes only what the baker's busy times allow).
  const ctx = { now: +SG('2026-11-26T19:30:00'), styleKey: 'neapolitan', kitchenTemp: 22, fridgeTemp: 6, flourStrength: 1.2, tang: 'balanced', preheatMin: 45, preheatExtraMin: 0,
    planLadder: 'hot', mixerType: 'hand', numItems: 4, mixingBatches: 1, prefermentType: 'none', poolishStorage: 'auto', bigaStorage: 'auto', prefOffsetH: 0, prefInFridge: false, targetDoughTemp: 24 };
  assert.equal(hhmm(sp.automaticCommercialPlan(ctx, nights, SG('2026-11-27T11:30:00'), {}).times.start), 'Thu 20:00');
});

test('round-19 finding 5: Bake again plans from today\'s inputs; the 11:00pm fridge step is no clash', () => {
  // The tester's carried plan: last week's recorded mix (Wed 8:45pm) a week on, nights 23:00–07:00, 5 pizzas, 22 °C, Simple.
  const nights = [{ label: 'Wednesday night', from: SG('2026-12-02T23:00:00'), to: SG('2026-12-03T07:00:00') }];
  const carried = utils.buildSchedule(SG('2026-12-02T20:45:00'), SG('2026-12-03T19:30:00'), nights, 22, 45, 'hand', 'neapolitan', 5, 1, false, 1, 240, 'all');
  assert.equal(hhmm(carried.availabilityActions.find(a => a.id === 'cold-in').at), 'Wed 23:00');
  assert.deepEqual(carried.availabilityConflicts, [], 'the fridge at 11:00pm sits on the night\'s edge (main: a clash)');
  // The restore no longer trusts the carried start: the picker plans the bake time afresh (Wed 5:30pm for 7:30pm; the
  // tester's "Bake at 7:45pm" was that fresh plan, 5:45pm, beside last week's 8:45pm).
  const page = read('app/[locale]/page.tsx');
  assert.match(page, /setSessionSaved\(!rb\);\n      \/\/ Bake again plans from today's inputs[^\n]*\n[^\n]*\n[^\n]*\n      setSessionRestored\(!rb\);/);
  assert.match(page, /setSessionSaved\(!rb\); setSessionRestored\(!rb\);/);
});

test('P: French spacing before °C and % comes from the formatters and the French texts', () => {
  assert.equal(units.tempC(22, 'metric', 'fr'), '22 °C');
  assert.equal(units.tempC(22, 'metric', 'en'), '22°C');
  assert.equal(units.tempC(6.5, 'metric', 'fr'), '6,5 °C');
  assert.equal(units.tempRange(18, 20, 'metric', 'fr'), '18–20 °C');
  assert.equal(units.displayTemp(22, 'metric', 'fr'), '22 °C');
  assert.equal(units.formatPercent(65, 'fr'), '65 %');
  assert.equal(units.percentRange(60, 65, 'fr'), '60–65 %');
  assert.equal(units.percentRange(60, 65, 'en'), '60–65%');
  // No French message or French literal glues a number to °C or %.
  const fr = JSON.parse(read('messages/fr.json'));
  const flat = (o, out = []) => { for (const v of Object.values(o)) typeof v === 'string' ? out.push(v) : flat(v, out); return out; };
  for (const v of flat(fr)) assert.doesNotMatch(v, /[0-9}]°C|[0-9}]%/, v);
  const literal = /\b(?:fr|descFr|nameFr)\s*:\s*'([^'\n]*)'/g;
  for (const file of ['app/data.ts', 'app/lib/toppingDatabase.ts', 'app/lib/flourGuidance.ts', 'app/components/ClimatePicker.tsx']) {
    for (const m of read(file).matchAll(literal)) assert.doesNotMatch(m[1], /\d°C|\d%/, file + ': ' + m[1]);
  }
});

test('P: the clash sentence names the step and its time; Preparation has no separate mix card', () => {
  const picker = read('app/components/SchedulePicker.tsx');
  assert.doesNotMatch(picker, /Cet horaire ne laisse pas le bon temps à la pâte/);
  assert.match(picker, /tomberait \$\{fmtCardDT\(at,true\)\}, une heure déjà passée/);
  assert.match(picker, /ne laisse pas à la pâte le temps qu’il lui faut avant la cuisson de/);
  require('./load-production.cjs');
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const Status = require('../app/components/BakeStartStatus.tsx').default;
  const NOW = Date.parse('2030-04-01T12:00Z');
  for (const plannedAt of [NOW + 20 * M, NOW - 10 * M, NOW - 60 * M]) for (const fr of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(Status, { fr, method: 'none', plannedAt, now: NOW, preparing: true, onMade() {}, onNotYet() {}, onRecipe() {}, onNext() {}, onUndo() {} }));
    assert.equal(html, '');
  }
});

test('P: one pair on the night line; one line under the manual flour; Ask, never Maestro, in the copy', () => {
  const page = read('app/[locale]/page.tsx');
  assert.match(page, /!doughIsCalc&&!nightUseIsCalc&&<button type="button" data-ft-use-calculated-yeast/);
  const flour = read('app/components/FlourPicker.tsx');
  assert.equal((flour.match(/<p data-flour-w-note style=\{\{fontSize:14\}\}>\{isFr\?'Le W règle la durée de fermentation, jamais l’hydratation\.':'W sets the fermentation time, never the hydration\.'\}<\/p>/g) || []).length, 2);
  const about = read('app/[locale]/about/AboutClient.tsx');
  assert.doesNotMatch(about, /Ask Maestro|Demander au Maestro|Maestro —|Maestro is there|Maestro est là/);
  const guide = read('app/components/BakeGuide.tsx');
  assert.match(guide, /'Help is unavailable right now\. Try again in a minute\.'/);
});

test('F1: the editor\'s sticky Apply bar never covers a control scrolled into view', () => {
  const css = read('app/globals.css');
  assert.match(css, /#schedule-anchor-panel\[data-open\] :is\(input,select,button,label,summary\):not\(\.bh-apply-plan\) \{ scroll-margin-bottom:112px; \}/);
  // A baker's input ends the restore window: an edit typed early is an edit (the round8/round9-yeast flakes).
  assert.match(read('app/[locale]/page.tsx'), /const types = \['pointerdown', 'keydown', 'focusin', 'input'\];/);
});

test('round 21 follow-up: the clock nights keep main\'s tests; E1 touches only the baker\'s busy times', () => {
  const at = (h, m = 0) => new Date(2026, 10, 26, h, m);
  // A plan without busy times is judged as on main: the 23:00 fridge step is an overnight step, 22:00 is night.
  assert.equal(av.isOvernightPreparation({ id: 'cold-in-2', at: at(23) }), true);
  assert.deepEqual(av.newNightHandsOn([{ id: 'fold-1', at: at(22) }], []).map(a => a.id), ['fold-1']);
  assert.equal(av.isDeepNight(at(23)), false);
  assert.equal(av.isDeepNight({ id: 'mix', at: at(23, 15) }), true);
  // Main's edges on request (the night guard): a quick step at a busy start is inside again.
  assert.equal(av.withMainEdges(() => av.busyHit({ id: 'cold-in', at: night.from }, +night.from, +night.to)), true);
  assert.equal(av.busyHit({ id: 'cold-in', at: night.from }, +night.from, +night.to), false);
  assert.equal(av.usesBusyEdge([{ id: 'cold-out-2', at: night.from }], [night]), true);
  assert.equal(av.usesBusyEdge([{ id: 'divide', at: night.from }], [night]), false);
  // The guards: the levain search and the automatic commercial plan never take an E1-only plan with new undeclared night steps.
  const picker = read('app/components/SchedulePicker.tsx');
  assert.match(picker, /const onEdgeWithNight=/);
  assert.match(picker, /const before = withMainEdges\(\(\) => automaticCommercialPlanE1\(c, currentBlocks, et, overrides\)\);/);
});

test('round 21 follow-up: a unit box keeps what the baker types; the page never re-keys it by value', () => {
  const box = read('app/components/UnitInput.tsx');
  assert.match(box, /if \(!el \|\| 'value' in input \|\| dirty\.current \|\| document\.activeElement === el\) return;/);
  const page = read('app/[locale]/page.tsx');
  assert.match(page, /key=\{`yeast:\$\{locale\}`\}/);
  assert.doesNotMatch(page, /key=\{`yeast:\$\{yeastPctOverride/);
  assert.match(page, /key="starter"/);
});
