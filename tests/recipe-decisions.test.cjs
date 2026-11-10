// Owner's recipe decisions (Nov 2026): rye blends, rye styles, enriched yeast,
// pain de mie with milk and butter, pain viennois portions.
const test = require('node:test');
const assert = require('node:assert/strict');
const { utils, data } = require('./load-production.cjs');
const { flourShoppingName } = require('../app/lib/flourGuidance.ts');

const START = new Date('2030-06-01T08:00Z');
const BAKE = new Date('2030-06-02T18:00Z');
const schedule = (style, temp = 22, sourdough = false) =>
  utils.buildSchedule(START, BAKE, [], temp, 45, 'hand', style, 1, 1, sourdough);
const recipe = (style, { temp = 22, mode = 'simple', yeast = 'instant', blend, weight, count = 1, sourdough = false } = {}) =>
  utils.calculateRecipe(style, 'standard_bread', count, weight ?? data.ALL_STYLES[style].ballW, temp, 'normal',
    schedule(style, temp, sourdough || yeast === 'sourdough'), 6, yeast, mode, 'hand', undefined, undefined, undefined, blend);
const ryeShare = r => {
  const rye = r.flourParts.find(part => part.key === 'rye');
  return rye ? rye.grams / r.flour * 100 : 0;
};

test('pain de campagne starts on 85 % T65 and 15 % rye in Simple and in Custom', () => {
  for (const mode of ['simple', 'custom']) for (const temp of [18, 24, 30]) {
    const r = recipe('pain_campagne', { mode, temp });
    assert.equal(r.flourParts.length, 2, `${mode} ${temp}`);
    assert.deepEqual(r.flourParts.map(part => part.key), ['bread', 'rye']);
    assert.equal(r.flourParts.reduce((sum, part) => sum + part.grams, 0), r.flour);
    assert.ok(Math.abs(ryeShare(r) - 15) < 0.6, `${mode} ${temp}: ${ryeShare(r)}`);
  }
});

test('the rye in pain de campagne applies the engine’s existing flour effects', () => {
  const blended = recipe('pain_campagne');
  const wheatOnly = recipe('pain_campagne', { mode: 'custom', blend: { flour1: 'bread', flour2: null, ratio1: 100 } });
  assert.ok(blended.hydration > wheatOnly.hydration, 'rye absorbs more water');
  assert.ok(blended.yeast.pct > wheatOnly.yeast.pct, 'rye tolerates a shorter ferment: more yeast for the same plan');
  assert.equal(blended.blendProfile.fermToleranceMultiplier, data.recipeFlourStrength('pain_campagne', 'simple'));
});

test('a flour the baker chose in Custom replaces the campagne blend', () => {
  const r = recipe('pain_campagne', { mode: 'custom', blend: { flour1: 'bread', flour2: null, ratio1: 100 } });
  assert.deepEqual(r.flourParts.map(part => part.key), ['bread']);
  assert.equal(data.recipeFlourBlend('pain_campagne', 'custom', { flour1: 'allpurpose', flour2: null, ratio1: 100 }).flour1, 'allpurpose');
  assert.equal(data.recipeFlourBlend('pain_campagne', 'custom').flour2, 'rye');
});

test('the campagne shopping list buys both flours', () => {
  const { doughShoppingItems: buildDoughShoppingItems } = require('../app/lib/doughShopping.ts');
  const r = recipe('pain_campagne');
  for (const locale of ['en', 'fr']) {
    const items = buildDoughShoppingItems({ recipe: r, yeastType: 'instant', locale, units: 'metric', flourName: flourShoppingName('pain_campagne', locale, 'simple') });
    const flours = items.filter(item => item.tickKey.startsWith('dough_flour'));
    assert.equal(flours.length, 2, locale);
    assert.ok(flours.some(item => /rye|seigle/i.test(item.name)), locale);
  }
  assert.match(flourShoppingName('pain_campagne', 'fr', 'simple'), /seigle/);
  assert.match(data.BREAD_STYLES.pain_campagne.descFr, /Blé et seigle/);
});

test('leaving a blend style drops its untouched blend', () => {
  assert.equal(data.isStyleDefaultBlend({ flour1: 'bread', flour2: 'rye', ratio1: 85 }), true);
  assert.equal(data.isStyleDefaultBlend({ flour1: 'bread', flour2: 'rye', ratio1: 80 }), false);
  assert.equal(data.isStyleDefaultBlend({ flour1: 'bread', flour2: 'rye', ratio1: 85, brandProduct: 'Francine T65' }), false);
});
