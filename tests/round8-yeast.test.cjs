// Round 8 (21 Nov 2026): the baker-entered yeast (owner D2, bugs 1–3, 6, 7, M1, M2, S2).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { utils } = require('./load-production.cjs');
const Y = require('../app/utils/yeastEntry.ts');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
// Thomas: 4 baguettes, 20 °C, bake Sat 28 Nov 11:30, work 9:00–18:00 on weekdays, nights 23:00–7:00.
const bake = SG('2026-11-28T11:30:00');
const blocks = [];
for (const day of ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
  blocks.push({ label: 'Work · ' + day, from: SG(day + 'T09:00:00'), to: SG(day + 'T18:00:00') });
for (const day of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
  blocks.push({ label: day + ' night', from: SG(day + 'T23:00:00'), to: new Date(+SG(day + 'T23:00:00') + 8 * H) });
const timing = { bake, blocks, kitchenTemp: 20, preheatMin: 45, mixerType: 'hand', styleKey: 'baguette', numItems: 4, itemWeight: 320,
  mixingBatches: 1, fridgeTemp: 6, hydration: 71 };
const ANCHOR = 17.25; // calculated knead Fri 18:15
const budgetOf = (dose, hours, shape) => {
  const s = utils.buildSchedule(new Date(+bake - hours * H), bake, blocks, 20, 45, 'hand', 'baguette', 4, 1, false, 1, shape);
  const p = utils.doughThermalPath(s, 4, 320, 71, 20, 6, 24);
  return { s, b: utils.fermentationBudget(dose, p.warmHours, 20, p.coldHours, 6, p) };
};
// The dose the calculated plan holds at its own knead (budget 1 on this path).
const CALC = 0.21;
const entry = (extra = {}) => ({ ...timing, now: +SG('2026-11-26T20:00:00'), conversion: 1, anchorH: ANCHOR, calculatedIdyPct: CALC,
  defaultWindow: b => { const w = utils.fermentationWindowForYeast(CALC, { ...timing, bake: b, nearH: ANCHOR }); return w ? { from: w.from, to: w.to } : { from: null, to: null }; },
  ...extra });

test('a fit scales the commercial room phases; the fridge takes what is left (PlanShape)', () => {
  const plain = utils.buildSchedule(new Date(+bake - ANCHOR * H), bake, blocks, 20, 45, 'hand', 'baguette', 4, 1, false, 1);
  const shorter = utils.buildSchedule(new Date(+bake - ANCHOR * H), bake, blocks, 20, 45, 'hand', 'baguette', 4, 1, false, 1, { rtScale: 0.5 });
  assert.equal(+plain.bulkFermStart, +shorter.bulkFermStart, 'same knead');
  assert.ok(shorter.totalColdHours > plain.totalColdHours, `${shorter.totalColdHours} > ${plain.totalColdHours}`);
  assert.ok(shorter.totalRTHours < plain.totalRTHours);
  // A scale of 1 is the engine's own plan; sourdough ignores a fit.
  const one = utils.buildSchedule(new Date(+bake - ANCHOR * H), bake, blocks, 20, 45, 'hand', 'baguette', 4, 1, false, 1, { rtScale: 1 });
  assert.deepEqual(JSON.stringify(one), JSON.stringify(plain));
  const levain = (shape) => JSON.stringify(utils.buildSchedule(new Date(+bake - 30 * H), bake, [], 22, 45, 'hand', 'pain_levain', 2, 1, true, 1, shape));
  assert.equal(levain({ rtScale: 0.5 }), levain(undefined));
});

test('D2: an entered amount near the calculated one keeps the knead; the fridge absorbs the difference', () => {
  for (const dose of [0.2, 0.22, 0.23]) {
    const t = utils.enteredYeastTiming(dose, { ...timing, anchorH: ANCHOR });
    assert.equal(t.center, ANCHOR, `${dose}: knead kept`);
    assert.ok(t.shape, `${dose}: a fit`);
    const { s, b } = budgetOf(dose, ANCHOR, t.shape);
    assert.ok(Math.abs(b - 1) <= 0.05, `${dose}: budget ${b}`);
    assert.ok(s.totalColdHours > 0);
    assert.equal(s.availabilityConflicts?.length ?? 0, 0, `${dose}: no new clash`);
    assert.ok(t.to <= ANCHOR && ANCHOR <= t.from, 'the knead is inside the readiness band');
  }
  // More yeast: a longer fridge spell; less: a shorter one.
  const more = budgetOf(0.23, ANCHOR, utils.enteredYeastTiming(0.23, { ...timing, anchorH: ANCHOR }).shape).s;
  const calc = budgetOf(CALC, ANCHOR).s;
  assert.ok(more.totalColdHours > calc.totalColdHours);
});

test('M1: without an anchor, or beyond what the fridge can absorb, it is the established inversion', () => {
  for (const dose of [0.1, 0.3, 0.21]) {
    assert.deepEqual(utils.enteredYeastTiming(dose, timing), utils.fermentationWindowForYeast(dose, timing), `${dose}: no anchor`);
  }
  // 0.1 % is far from the calculated amount: no fit, the window nearest the anchor.
  const slow = utils.enteredYeastTiming(0.1, { ...timing, anchorH: ANCHOR });
  assert.equal(slow.shape, undefined);
  assert.deepEqual(slow, utils.fermentationWindowForYeast(0.1, { ...timing, nearH: ANCHOR }));
  // A fit the page already solved is kept: only the band is read with it.
  const solved = utils.enteredYeastTiming(0.22, { ...timing, anchorH: ANCHOR });
  assert.deepEqual(utils.enteredYeastTiming(0.22, { ...timing, anchorH: ANCHOR, exitLeadMin: solved.shape }), solved);
});

test('bug 7: a statement suggests only an amount that gives a plan clear of the busy times', () => {
  // Round 17 (O3): every check reads the baker's nights as night steps (O1): 0.3 % plans, its night step named, and the
  // offer is the nearest amount whose plan is clear of the busy times and of night steps.
  const o = entry();
  const fast = Y.checkYeastEntry(0.3, o);
  assert.equal(fast.fits, true);
  assert.equal(fast.nightSteps, true);
  fast.suggestedShownPct = fast.nightFreeShownPct;
  assert.ok(fast.suggestedShownPct < 0.3 && fast.suggestedShownPct > CALC, `${fast.suggestedShownPct}`);
  assert.equal(Y.checkYeastEntry(fast.suggestedShownPct, o).fits, true, 'the suggestion passes the same check');
  const found = Y.entryPlanSearch(fast.suggestedShownPct, o);
  assert.ok(found, 'and the planner search finds its plan');
  assert.ok(Math.abs(+found.times.start - (+bake - ANCHOR * H)) <= H, 'kneaded Friday evening');
  // One step more than the suggestion has no plan clear of the busy times.
  assert.equal(Y.entryPlanFound(Math.round((fast.suggestedShownPct + 0.01) * 100) / 100, o), false);
});

test('M2 / bug 3: the statement and the re-timing read the same timing and the same search', () => {
  const o = entry();
  for (const dose of [0.1, 0.15, 0.19, 0.21, 0.23, 0.3]) {
    const check = Y.checkYeastEntry(dose, o);
    const availableH = check.availableH;
    const timed = Y.entryTiming(dose, o, availableH);
    if (check.fits) assert.ok(timed && (check.nightSteps ? Y.entryPlan(dose, o) : Y.entryPlanFound(dose, o)), `${dose}: fits ⇒ timed and found`);
    else if (check.reason === 'time') {
      assert.equal(timed, null, `${dose}: no window in the time left`);
      assert.ok(check.neededH === null || check.neededH > availableH);
    } else assert.ok(timed && !Y.entryPlanFound(dose, o), `${dose}: busy ⇒ timed, no plan`);
  }
  // B3: Neapolitan, 22 °C, no busy times, bake in 24 h: 0.1 % plans (round 9, a room plan within the day).
  const now = +SG('2026-11-26T19:30:00'), b3 = SG('2026-11-27T19:30:00');
  const b3o = { bake: b3, now, blocks: [], kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan', numItems: 4, itemWeight: 260,
    mixingBatches: 1, fridgeTemp: 6, hydration: 66, conversion: 1, anchorH: 12.5, calculatedIdyPct: 0.21 };
  const c = Y.checkYeastEntry(0.1, b3o);
  assert.equal(c.fits, true);
  const plan = Y.entryPlan(0.1, b3o);
  assert.ok(plan && +plan.times.start > now, 'a plan before the bake');
});

test('bug 6: a fresh-yeast amount is checked in IDY and suggested in fresh yeast', () => {
  const o = entry({ conversion: 3 });
  const check = Y.checkYeastEntry(0.5 / 3, o);
  assert.equal(check.nightSteps, true);
  assert.ok(check.nightFreeShownPct > 0.5 && check.nightFreeShownPct < 0.7, `${check.nightFreeShownPct}`);
  const offer = Y.checkYeastEntry(Math.round(check.nightFreeShownPct / 3 * 10000) / 10000, o);
  assert.equal(offer.fits, true); assert.equal(offer.nightSteps, undefined);
});

test('bug 2 / S2: either decimal separator, baker time, the locale separator', () => {
  assert.equal(Y.parseDecimal('0,1'), 0.1);
  assert.equal(Y.parseDecimal('0.1'), 0.1);
  assert.equal(Y.parseDecimal(' 0,35 '), 0.35);
  assert.equal(Y.parseDecimal(',5'), 0.5);
  assert.ok(Number.isNaN(Y.parseDecimal('')));
  assert.ok(Number.isNaN(Y.parseDecimal('abc')));
  assert.ok(Number.isNaN(Y.parseDecimal('0,1,2')));
  assert.equal(Y.formatDecimal(0.15, true), '0,15');
  assert.equal(Y.formatDecimal(0.15, false), '0.15');
  assert.equal(Y.bakerHours(11.75), '12 h');
  assert.equal(Y.bakerHours(9.75), '9 h 45');
  assert.equal(Y.bakerHours(36.25), '36 h');
  assert.equal(Y.bakerHours(0.5), '30 min');
  assert.equal(Y.bakerPct(0.1, true), '0,1 %');
  assert.equal(Y.bakerPct(0.1, false), '0.1%');
});

test('the nearest fitting amount rounds towards the reference on the typing steps', () => {
  assert.equal(Y.nearestFittingShownPct(0.3, 0.2, s => s <= 0.254), 0.25);
  assert.equal(Y.nearestFittingShownPct(0.1, 0.2, s => s >= 0.143), 0.15);
  assert.equal(Y.nearestFittingShownPct(0.1, 0.2, () => false), null);
});
