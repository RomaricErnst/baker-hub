const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { utils } = require('./load-production.cjs');
const allowance = require('../app/utils/doughAllowance.ts');

// Extra for bowl loss (20 Nov 2026 round 7): 1.5 % for every bake, Simple included.
const page = fs.readFileSync(path.join(__dirname, '../app/[locale]/page.tsx'), 'utf8');

function recipe(mode, wastePct, count = 4, weight = 260) {
  const schedule = utils.buildSchedule(new Date('2026-09-12T10:00:00Z'), new Date('2026-09-13T18:00:00Z'), [], 22, 60, 'hand', 'neapolitan');
  return utils.calculateRecipe('neapolitan', 'pizza_oven', count, weight, 22, 'normal', schedule, 6, 'instant', mode, 'hand',
    undefined, undefined, undefined, undefined, 'none', undefined, 20, undefined, undefined, false, wastePct);
}

test('a bake with no allowance set uses 1.5 %; a set value, 0 included, wins', () => {
  assert.equal(allowance.DEFAULT_WASTE_PCT, 1.5);
  assert.equal(allowance.effectiveWastePct(undefined), 1.5);
  assert.equal(allowance.effectiveWastePct(0), 0);
  assert.equal(allowance.effectiveWastePct(3), 3);
  assert.equal(allowance.effectiveWastePct(Number.NaN), 1.5);
});

test('restore: a saved value is kept; a missing one defaults (O3: no old-bake exception)', () => {
  assert.equal(allowance.restoredWastePct(0), 0);
  assert.equal(allowance.restoredWastePct(2.5), 2.5);
  assert.equal(allowance.restoredWastePct(undefined), undefined); // → 1.5 through effectiveWastePct
  assert.equal(allowance.effectiveWastePct(allowance.restoredWastePct(undefined)), 1.5);
  assert.equal(allowance.restoredWastePct(null), undefined);
});

test('the balls stay what the baker asked; the total grows 1.5 %, in Simple too', () => {
  for (const mode of ['simple', 'custom']) {
    const r = recipe(mode, 1.5);
    assert.equal(r.totalDough, Math.round(4 * 260 * 1.015), mode); // 1056 g for 4 × 260 g
    assert.equal(r.wastePct, 1.5);
    const sum = r.flour + r.water + r.salt + r.oil + r.sugar + r.yeast.convertedGrams;
    assert.ok(Math.abs(sum - r.totalDough) <= 2.6, `${mode}: ${sum} vs ${r.totalDough}`);
  }
  const none = recipe('simple', 0);
  assert.equal(none.totalDough, 1040);
  assert.equal(none.wastePct, undefined);
  // Yeast follows the flour it leavens: the same percentage of a larger batch.
  const r = recipe('simple', 1.5);
  assert.ok(Math.abs(r.yeast.pct - none.yeast.pct) < 1e-9);
  assert.ok(r.flour > none.flour);
});

test('the page feeds the effective allowance everywhere and restores through restoredWastePct', () => {
  assert.match(page, /const wasteAllowance = effectiveWastePct\(wastePct\);/);
  assert.match(page, /setWastePct\(restoredWastePct\(session\.wastePct\)\);/);
  assert.match(page, /setWastePct\(restoredWastePct\(snap\.wastePct\)\);/);
  assert.match(page, /wastePct: wasteAllowance, addSeeds/); // the session records what the recipe used
  assert.doesNotMatch(page, /flourInFridge,\s*wastePct,/);
  assert.doesNotMatch(page, /wastePct=\{totalFlourTarget===undefined\?wastePct:0\}/);
  // Fine-tune: one-line labels, the default as the recommendation, no helper lines.
  assert.match(page, /label:fr\?'Marge pour les pertes':'Extra for bowl loss'[^\n]*value:wasteAllowance,rec:DEFAULT_WASTE_PCT/);
  assert.doesNotMatch(page, /Covers dough left in the bowl|Compense la pâte restée|Measured inside the fridge, near the dough\.|Mesurée dans le frigo, près de la pâte\./);
});
