const test = require('node:test');
const assert = require('node:assert/strict');
const { utils, data } = require('./load-production.cjs');

function recipe(style, count, weight, yeastType, preferment, wastePct = 0) {
  const oven = data.PIZZA_STYLES[style] ? 'home_oven_standard' : 'standard_bread';
  const schedule = utils.buildSchedule(new Date('2026-09-12T10:00:00Z'),
    new Date('2026-09-13T18:00:00Z'), [], 32, 60, 'hand', style);
  return utils.calculateRecipe(style, oven, count, weight, 32, 'humid', schedule,
    6, yeastType, 'custom', 'hand', undefined, undefined, undefined, undefined,
    preferment, undefined, 20, undefined, undefined, false, wastePct, true, undefined, 24);
}

test('all displayed commercial ingredients conserve requested mass within weighing precision', () => {
  for (const style of ['neapolitan', 'pan', 'brioche', 'pain_viennois']) {
    for (const yeastType of ['instant', 'active_dry', 'fresh']) {
      for (const pref of ['none', 'poolish', 'biga']) {
        for (const weight of [250, 1000, 4000]) {
          const r = recipe(style, 1, weight, yeastType, pref);
          const dose = r.preferment?.prefYeastGrams ?? r.yeast.convertedGrams;
          const sum = r.flour + r.water + r.salt + r.oil + r.sugar + (r.enrichment?.milk ?? 0) + (r.enrichment?.eggs ?? 0) + (r.enrichment?.butter ?? 0) + dose;
          // Flour/water/salt/oil are weighed to 1g, sugar to 0.1g.
          assert.ok(Math.abs(sum - r.totalDough) <= (r.enrichment ? 4 : 2.6),
            `${style}/${yeastType}/${pref}/${weight}: ${sum} vs ${r.totalDough}`);
          assert.equal(r.totalDough, weight);
          if (r.preferment) {
            assert.equal(r.preferment.prefFlour + r.preferment.finalFlour, r.flour);
            assert.equal(r.preferment.prefWater + r.preferment.finalWater, r.water);
          }
        }
      }
    }
  }
});

test('mixing-loss allowance is added once before calculating ingredients', () => {
  const r = recipe('pan', 4, 250, 'fresh', 'none', 1.5);
  assert.equal(r.totalDough, 1015);
  assert.ok(Math.abs(r.flour + r.water + r.salt + r.oil + r.sugar + r.yeast.convertedGrams - 1015) <= (r.enrichment ? 4 : 2.6));
});

test('exact 2% sugar stays below osmotic correction while mass converges', () => {
  for (const weight of [100, 250, 1000, 4000, 10000]) {
    for (const temp of [20, 32, 35]) {
      for (const horizon of [1, 4, 8, 26]) {
        for (const yeastType of ['instant', 'active_dry', 'fresh']) {
          const start = new Date('2026-09-12T10:00:00Z');
          const schedule = utils.buildSchedule(start, new Date(+start + horizon * 3600000), [], temp, 60, 'hand', 'pan');
          const r = utils.calculateRecipe('pan', 'home_oven_standard', 1, weight, temp, 'humid', schedule,
            6, yeastType, 'custom', 'hand', 70, 15, 2);
          assert.equal(r.yeast.osmoticStress, false);
          const actual = r.flour + r.water + r.salt + r.oil + r.sugar + r.yeast.convertedGrams;
          assert.ok(Math.abs(actual - weight) <= (r.enrichment ? 4 : 2.6),
            `${weight}/${temp}/${horizon}/${yeastType}: ${actual}`);
        }
      }
    }
  }
});

test('thermal result exposes clipped water and the achieved dough-temperature residual', () => {
  const start = new Date('2026-09-12T10:00:00Z');
  const schedule = utils.buildSchedule(start, new Date('2026-09-12T22:00:00Z'), [], 38, 60, 'spiral', 'neapolitan');
  const r = utils.calculateRecipe('neapolitan', 'home_oven_standard', 1, 250, 38, 'humid', schedule,
    6, 'instant', 'custom', 'spiral', undefined, undefined, undefined, undefined, undefined,
    undefined, 20, undefined, 23);
  assert.ok(r.thermal);
  assert.equal(r.thermal.waterWasClamped, true);
  assert.ok(r.thermal.doughTempC > r.thermal.targetDoughTemp);
  assert.equal(r.thermal.doughTempResidualC, r.thermal.doughTempC - r.thermal.targetDoughTemp);
});


test('refrigerated flour affects the thermal solve in both planning modes', () => {
  const schedule = utils.buildSchedule(new Date('2026-09-21T08:00Z'), new Date('2026-09-22T18:00Z'), [], 24, 60, 'hand', 'neapolitan');
  for (const mode of ['simple', 'custom']) {
    const make = cold => utils.calculateRecipe('neapolitan', 'home_oven_standard', 4, 250, 24, 'normal', schedule, 4, 'instant', mode, 'hand', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, cold);
    const ambient = make(false), chilled = make(true);
    assert.ok(chilled.thermal.idealWaterTemp > ambient.thermal.idealWaterTemp, mode);
    assert.equal(chilled.flour, ambient.flour);
    assert.equal(chilled.water, ambient.water);
  }
});
