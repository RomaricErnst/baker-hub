const test = require('node:test');
const assert = require('node:assert/strict');
const { utils } = require('./load-production.cjs');
const { checkYeastEntry, roundYeastPctUp, entryHoursLabel } = require('../app/utils/yeastEntry.ts');
const { promptedPreparationAt, normalizeAcceptedPlan, acceptedPlanMove } = require('../app/utils/bakeExecution.ts');

const H = 3600000;
const NOW = Date.parse('2026-11-10T09:00:00+08:00');
const base = (hoursToBake, extra = {}) => ({
  bake: new Date(NOW + hoursToBake * H), now: NOW, blocks: [], kitchenTemp: 24, preheatMin: 45, mixerType: 'hand',
  styleKey: 'neapolitan', numItems: 8, itemWeight: 270, mixingBatches: 1, fridgeTemp: 6, hydration: 62,
  flourStrength: 1, conversion: 1, ...extra,
});
// Within the time left: the yeast model's budget is not monotone in the window, so the
// check (and these assertions) ask the inversion for a window that fits before the bake.
const hoursFor = (idy, o, maxH) => utils.fermentationHoursForYeast(idy * o.flourStrength, maxH === undefined ? o : { ...o, maxH });

test('a slow entered amount is refused with the smallest fitting amount, rounded up', () => {
  const o = base(34);
  const check = checkYeastEntry(0.02, o);
  assert.equal(check.fits, false);
  // 0.02 % has no window up to 96 h in a cold-retard Neapolitan (yeast model: the fridge mostly holds).
  assert.ok(check.neededH === null || check.neededH > check.availableH);
  // Yeast model (19 Nov 2026): 0.13 % (was 0.06 % with the old cold law, which credited fridge hours
  // at 60–75 % of room-temperature hours).
  assert.equal(check.minimumShownPct, 0.13);
  // The offer fits, and one step less does not.
  assert.ok(hoursFor(check.minimumShownPct, o, check.availableH) <= check.availableH);
  assert.equal(hoursFor(check.minimumShownPct - 0.01, o, check.availableH), null);
  // Applying the offer passes the same check.
  assert.equal(checkYeastEntry(check.minimumShownPct, o).fits, true);
});

test('the check uses the scheduler inversion and the next plannable quarter hour', () => {
  const o = base(34, { now: NOW + 5 * 60000 });
  const check = checkYeastEntry(0.052, o);
  assert.equal(check.availableH, 34 - 0.25);
  assert.equal(check.neededH, hoursFor(0.052, o, check.availableH) ?? hoursFor(0.052, o));
  assert.equal(check.fits, check.neededH !== null && check.neededH <= check.availableH);
  const fitting = checkYeastEntry(0.3, o);
  assert.equal(fitting.neededH, hoursFor(0.3, o, fitting.availableH));
});

test('the minimum is offered in the baker’s own yeast', () => {
  const instant = checkYeastEntry(0.02, base(34));
  const fresh = checkYeastEntry(0.02, base(34, { conversion: 3 }));
  assert.ok(fresh.minimumShownPct >= instant.minimumShownPct * 2.5);
  assert.ok(hoursFor(Math.round(fresh.minimumShownPct / 3 * 10000) / 10000, base(34), fresh.availableH) <= fresh.availableH);
});

test('an amount that fits is accepted without an offer', () => {
  const check = checkYeastEntry(0.3, base(34));
  assert.equal(check.fits, true);
  assert.equal(check.minimumShownPct, null);
});

test('when no amount fits before the bake there is no offer', () => {
  const check = checkYeastEntry(0.02, base(2));
  assert.equal(check.fits, false);
  assert.equal(check.minimumShownPct, null);
});

test('rounding and hour labels', () => {
  assert.equal(roundYeastPctUp(0.0512), 0.06);
  assert.equal(roundYeastPctUp(0.06), 0.06);
  assert.equal(roundYeastPctUp(1.21), 1.3);
  assert.equal(entryHoursLabel(65.6), 66);
  assert.equal(entryHoursLabel(3.4), 3.5);
});

test('the made? prompt asks about the accepted plan while an edit is pending', () => {
  const accepted = NOW + 10 * H, pending = NOW - 8 * H;
  // An edit moved the pending start into the past: ask about the accepted, future start.
  assert.equal(promptedPreparationAt(pending, accepted, true), accepted);
  // A legitimately missed accepted start is still asked about.
  assert.equal(promptedPreparationAt(NOW + 2 * H, NOW - H, true), NOW - H);
  // The recipe matches the plan: the current plan is the accepted one.
  assert.equal(promptedPreparationAt(pending, accepted, false), pending);
  // Sessions saved before acceptance was recorded keep today's behaviour.
  assert.equal(promptedPreparationAt(pending, undefined, true), pending);
});

test('accepted plans restore only from finite times', () => {
  assert.deepEqual(normalizeAcceptedPlan(NOW, NOW - 18 * H), { startTime: NOW, preparationAt: NOW - 18 * H });
  assert.deepEqual(normalizeAcceptedPlan(NOW, undefined), { startTime: NOW, preparationAt: NOW });
  assert.deepEqual(normalizeAcceptedPlan(NOW, NOW + H), { startTime: NOW, preparationAt: NOW });
  assert.equal(normalizeAcceptedPlan(undefined, NOW), undefined);
  assert.equal(normalizeAcceptedPlan('x', NOW), undefined);
});

test('a regenerated recipe reports what moved since the accepted plan', () => {
  const accepted = { startTime: NOW, preparationAt: NOW, bakeAt: NOW + 24 * H };
  assert.equal(acceptedPlanMove(accepted, NOW, NOW + 24 * H), null);
  assert.equal(acceptedPlanMove(undefined, NOW + H, NOW + 24 * H), null);
  assert.deepEqual(acceptedPlanMove(accepted, NOW + 2 * H, NOW + 24 * H), { from: NOW, to: NOW + 2 * H });
  assert.deepEqual(acceptedPlanMove(accepted, NOW + 2 * H, NOW + 26 * H), { from: NOW, to: NOW + 2 * H, bakeFrom: NOW + 24 * H });
  assert.deepEqual(normalizeAcceptedPlan(NOW, NOW, NOW + H), { startTime: NOW, preparationAt: NOW, bakeAt: NOW + H });
});
