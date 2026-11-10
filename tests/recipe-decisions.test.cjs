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

// ── Rye: pain de seigle (levain) and pain au seigle (commercial yeast) ──
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) { return resolveFilename.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, ...args); };
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename }).outputText, filename);
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { NextIntlClientProvider } = require('next-intl');
const Guide = require('../app/components/BakeGuide.tsx').default;
function guide(style, lang, { sourdough = false, weight = 800, numItems = 1, hydration = 72, recipeResult } = {}) {
  const plan = utils.buildSchedule(new Date('2030-06-01T08:00Z'), new Date('2030-06-01T20:00Z'), [], 22, 45, 'hand', style, numItems, 1, sourdough);
  const props = { schedule: plan, mixerType: 'hand', styleKey: style, kitchenTemp: 22, numItems, oil: 0, hydration, locale: lang, ovenType: 'standard_bread',
    recipe: recipeResult ?? { totalDough: weight * numItems, flour: weight * 0.55, water: weight * 0.4, salt: 8, oil: 0, sugar: 0, hydration, yeast: null, sourdough: null, waterTemp: null } };
  const original = React.useState; let html = '';
  for (let step = 1; step <= 14; step++) {
    React.useState = initial => original(initial === 1 ? step : initial);
    try { html += renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: lang, messages: require('../messages/' + lang + '.json'), timeZone: 'UTC' }, React.createElement(Guide, props))); }
    finally { React.useState = original; }
  }
  return html;
}

test('pain de seigle is a levain loaf of at least 65 % rye', () => {
  assert.equal(data.isLevainStyle('pain_seigle'), true);
  assert.equal(data.BREAD_STYLES.pain_seigle.pref, 'levain');
  assert.equal(data.BREAD_STYLES.pain_seigle.yeast, 0);
  for (const temp of [18, 24, 30]) {
    const r = recipe('pain_seigle', { temp, yeast: 'sourdough' });
    assert.ok(r.sourdough, 'raised with starter');
    assert.equal(r.yeast, null);
    assert.ok(ryeShare(r) >= 65, `${temp}: ${ryeShare(r)}`);
    // Even when the starter itself is wheat, the loaf stays near two-thirds rye.
    const starterFlour = Math.round(r.sourdough.starterGramsMid / 2);
    assert.ok((r.flourParts[0].grams - starterFlour) / r.flour * 100 >= 60, `${temp}`);
  }
  // Same sourdough schedule as pain au levain: levain bulk, room temperature only.
  const plan = schedule('pain_seigle', 22, true);
  assert.equal(plan.totalColdHours, 0);
  assert.ok(plan.bulkFermHours >= 4.75);
  assert.equal(utils.buildSchedule(START, BAKE, [], 22, 45, 'hand', 'pain_seigle').bulkFermHours, plan.bulkFermHours, 'levain by default');
});

test('the rye guide has no folds, no cold wording without a fridge and no poke test', () => {
  const r = recipe('pain_seigle', { yeast: 'sourdough' });
  for (const lang of ['fr', 'en']) {
    const html = guide('pain_seigle', lang, { sourdough: true, weight: 700, hydration: r.hydration, recipeResult: r });
    assert.doesNotMatch(html, /série de rabats|Série \d|stretch &amp; fold|stretch & fold/i, lang);
    assert.doesNotMatch(html, /directement au froid|straight to the fridge|placez au frigo/i, lang);
    assert.doesNotMatch(html, /50[-–]75/, lang);
    assert.doesNotMatch(html, /test du doigt toutes|Poke-test every|poke test after warmup/i, lang);
    assert.match(html, lang === 'fr' ? /fissures/ : /cracks/, lang);
  }
});

test('pain au seigle: about 30 % rye, commercial yeast, a lean loaf in both locales', () => {
  const style = data.BREAD_STYLES.pain_au_seigle;
  assert.equal(style.nameFr, 'Pain au seigle');
  assert.equal(style.ballW, 800);
  assert.equal(style.salt, 2);
  assert.match(style.descFr, /Seigle et blé/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', style.image)));
  assert.equal(data.isLevainStyle('pain_au_seigle'), false);
  const { BREAD_GROUPS } = require('../app/lib/breadNavigation.ts');
  const loaves = BREAD_GROUPS.find(group => group.id === 'loaves').keys;
  assert.equal(loaves.indexOf('pain_au_seigle'), loaves.indexOf('pain_seigle') + 1);
  for (const temp of [18, 24, 30]) {
    const r = recipe('pain_au_seigle', { temp });
    assert.ok(r.yeast && r.yeast.grams > 0);
    assert.ok(Math.abs(ryeShare(r) - 30) < 0.6, `${temp}: ${ryeShare(r)}`);
    assert.ok(r.hydration >= 68 && r.hydration <= 74, `${temp}: ${r.hydration}`);
  }
  assert.equal(recipe('pain_au_seigle').hydration, 71.5);
  const { leanBreadBake, LEAN_BREAD_STYLES } = require('../app/utils/leanBreadBake.ts');
  assert.ok(LEAN_BREAD_STYLES.includes('pain_au_seigle'));
  assert.equal(leanBreadBake('pain_au_seigle', 800, 'standard_bread').tempStaticC, leanBreadBake('pain_campagne', 800, 'standard_bread').tempStaticC);
  for (const lang of ['fr', 'en']) {
    const html = guide('pain_au_seigle', lang);
    assert.match(html, lang === 'fr' ? /Grignez le pain/ : /Score the loaf/, lang);
    assert.match(html, /250\s?°C/, lang);
  }
  const { breadCoolingUpperMinutes } = require('../app/utils/servingTime.ts');
  assert.equal(breadCoolingUpperMinutes('pain_au_seigle', 800), breadCoolingUpperMinutes('pain_campagne', 800));
});

test('pain au seigle follows the multi-engine fermentation defaults', () => {
  const { BREAD_FERMENTATION_DEFAULTS } = require('../app/utils/breadProfiles.ts');
  assert.deepEqual({ ...BREAD_FERMENTATION_DEFAULTS.pain_au_seigle }, { coldH: 12, rtH: 3, preferredColdH: 18, minColdH: 6, minTotalFermH: 8 });
  const chart = fs.readFileSync(path.join(__dirname, '..', 'app/components/FermentChart.tsx'), 'utf8');
  assert.match(chart, /'pain_au_seigle'/);
  // Same schedule shape as pain complet, whose window it shares (pain complet
  // adds a 30-minute autolyse by hand; rye gets none).
  for (const temp of [18, 24, 30]) assert.ok(Math.abs(schedule('pain_au_seigle', temp).totalColdHours - schedule('pain_complet', temp).totalColdHours) <= 0.5, `${temp}`);
  assert.equal(data.autolyseMinFor('hand', 'pain_au_seigle'), 0);
});

// ── Enriched doughs: fixed yeast ──
test('brioche takes about 1 % instant yeast of flour at every temperature', () => {
  for (const temp of [16, 22, 28, 32]) for (const [yeast, factor] of [['instant', 1], ['active_dry', 1.33], ['fresh', 3]]) {
    const r = recipe('brioche', { temp, yeast, mode: 'custom' });
    assert.equal(r.yeast.pct, 1, `${temp} ${yeast}`);
    assert.ok(Math.abs(r.yeast.convertedGrams - r.flour * factor / 100) < 0.01, `${temp} ${yeast}: ${r.yeast.convertedGrams}`);
    assert.equal(r.yeast.fixedEnrichedDose, true);
    assert.ok(!r.yeast.warnings.some(w => w.key === 'fermentationBudget' || w.key === 'osmoticStress'), `${temp} ${yeast}`);
  }
  // Same schedule as before: only the amount changes.
  assert.equal(+schedule('brioche').bakeStart, +BAKE);
});

test('any dough with sugar at 10 % of flour takes the fixed dose; a baker’s amount still wins', () => {
  const plan = schedule('pain_campagne');
  const sweet = utils.calculateRecipe('pain_campagne', 'standard_bread', 1, 800, 22, 'normal', plan, 6, 'instant', 'custom', 'hand', undefined, undefined, 10);
  assert.equal(sweet.yeast.pct, 1);
  const lightlySweet = utils.calculateRecipe('pain_campagne', 'standard_bread', 1, 800, 22, 'normal', plan, 6, 'instant', 'custom', 'hand', undefined, undefined, 6);
  assert.ok(lightlySweet.yeast.pct < 1);
  const args = ['brioche', 'standard_bread', 1, 500, 22, 'normal', schedule('brioche'), 6, 'instant', 'custom', 'hand'];
  const chosen = utils.calculateRecipe(...args, ...Array(17).fill(undefined), 0.6);
  assert.equal(chosen.yeast.pct, 0.6);
  assert.ok(!chosen.yeast.fixedEnrichedDose);
});

test('no "not calibrated for enriched doughs" note remains', () => {
  for (const locale of ['en', 'fr']) {
    const text = fs.readFileSync(path.join(__dirname, '..', 'messages', locale + '.json'), 'utf8');
    assert.doesNotMatch(text, /not calibrated for enriched|pas calibrée pour les pâtes enrichies/);
  }
});

test('enriched doughs knead longer by hand', () => {
  assert.equal(data.kneadMinFor('hand', 'brioche'), 25);
  assert.equal(data.kneadMinFor('hand', 'pain_mie'), 15);
  assert.equal(data.kneadMinFor('stand', 'brioche'), data.kneadMinFor('stand', 'pain_complet'));
  assert.equal(data.kneadMinFor('hand', 'pain_complet'), data.MIXER_TYPES.hand.kneadMin);
});

// ── Pain de mie: milk and butter ──
test('pain de mie: half water, half milk, about 8 % butter and 5 % sugar', () => {
  for (const mode of ['simple', 'custom']) for (const temp of [18, 24, 30]) {
    const r = recipe('pain_mie', { mode, temp });
    const e = r.enrichment;
    assert.ok(e, `${mode} ${temp}`);
    assert.equal(r.oil, 0);
    assert.ok(Math.abs(e.milk - r.water) <= 1, 'equal parts water and milk');
    assert.ok(Math.abs(e.butter / r.flour * 100 - 8) < 0.6);
    assert.ok(Math.abs(r.sugar / r.flour * 100 - 5) < 0.3);
    assert.ok(!r.yeast.fixedEnrichedDose, 'below the 10 % sugar threshold: model dose');
    assert.ok(r.yeast.pct < 1);
    assert.ok(r.hydration > 61 && r.hydration < 65, `effective hydration ${r.hydration}`);
  }
  const { doughShoppingItems } = require('../app/lib/doughShopping.ts');
  const items = doughShoppingItems({ recipe: recipe('pain_mie'), yeastType: 'instant', locale: 'fr', units: 'metric', flourName: 'Farine' });
  assert.ok(items.some(item => item.name === 'Lait'));
  assert.ok(items.some(item => item.name === 'Beurre'));
  assert.ok(!items.some(item => /Huile/.test(item.name)));
});

test('the pain de mie guide adds the butter once the dough is smooth', () => {
  const r = recipe('pain_mie');
  for (const lang of ['fr', 'en']) {
    const html = guide('pain_mie', lang, { weight: 600, hydration: r.hydration, recipeResult: r });
    assert.match(html, lang === 'fr' ? /sans le beurre/ : /without the butter/, lang);
    assert.match(html, lang === 'fr' ? /beurre souple progressivement/ : /softened butter gradually/, lang);
    assert.doesNotMatch(html, lang === 'fr' ? /Pesez les œufs/ : /Weigh eggs/, lang);
  }
});
