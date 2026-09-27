const test = require('node:test');
const assert = require('node:assert/strict');
const { data } = require('./load-production.cjs');
const { formatPrefermentDose, prefermentDilution } = require('../app/utils/prefermentDose.ts');

test('small preferment doses remain nonzero and convert from unrounded IDY', () => {
  for (const type of ['poolish', 'biga']) {
    const args = [type, 100, 70, 32, 6, false, 10];
    const idy = data.computePrefermentRecipe(...args, 'instant', 14);
    assert.ok(idy.prefYeastGramsIDY > 0 && idy.prefYeastGramsIDY < 0.05);
    for (const [yeast, factor] of [['instant', 1], ['active_dry', 1.33], ['fresh', 3]]) {
      const result = data.computePrefermentRecipe(...args, yeast, 14);
      assert.ok(Math.abs(result.prefYeastGrams - idy.prefYeastGramsIDY * factor) < 1e-12);
      assert.notEqual(formatPrefermentDose(result.prefYeastGrams), '0 g');
    }
  }
});

test('dilution conserves selected yeast dose and preferment water', () => {
  for (const dose of [0.004, 0.04, 0.04 * 1.33, 0.04 * 3, 0.49]) {
    const plan = prefermentDilution(dose, 100);
    assert.ok(plan);
    assert.ok(Math.abs(plan.solutionGrams / 100 - dose) < 1e-12);
    assert.ok(Math.abs(plan.waterInSolutionGrams + plan.remainingWaterGrams - 100) < 1e-12);
  }
  assert.equal(prefermentDilution(0.4, 10), null);
  assert.equal(prefermentDilution(0, 100), null);
  assert.equal(prefermentDilution(0.5, 100), null);
  assert.equal(prefermentDilution(NaN, 100), null);
});
