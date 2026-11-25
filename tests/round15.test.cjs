// Round 15 (23 Nov 2026, owner decision O2): an entered yeast amount gets its plan built from scratch from the current
// inputs (bake time, busy times, storage, the calculated plan's knead as anchor), ranked: no hands-on step between 23:00
// and 06:00, then the fewest night steps, then the knead nearest the calculated one. No memory of kept plans or routes.
// Singapore bakes; the night (22:00–07:00) is read in local time: pin the zone before any Date.
process.env.TZ = 'Asia/Singapore';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (r, ...x) { return resolve.call(this, r.startsWith('@/') ? path.join(__dirname, '..', r.slice(2)) : r, ...x); };
const compile = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: f }).outputText, f);
require.extensions['.ts'] = compile; require.extensions['.tsx'] = compile;
const Y = require('../app/utils/yeastEntry.ts');
const PY = require('../app/utils/prefermentYeast.ts');
const sp = require('../app/components/SchedulePicker.tsx');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const page = read('app/[locale]/page.tsx'), picker = read('app/components/SchedulePicker.tsx'), output = read('app/components/RecipeOutput.tsx');
const hhmm = d => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', hour: '2-digit', minute: '2-digit' });

// B3 (round 14): Custom Neapolitan, 4 × 260 g, 22 °C, dough 24 °C, hand kneaded, Nights 23:00–07:00, clock Thu 19:30.
const now = +SG('2026-11-26T19:30:00');
const nights = [
  { label: 'Thursday night', from: SG('2026-11-26T23:00:00'), to: SG('2026-11-27T07:00:00') },
  { label: 'Friday night', from: SG('2026-11-27T23:00:00'), to: SG('2026-11-28T07:00:00') },
];
const b3 = (bake, blocks = nights) => ({ bake: SG(bake), blocks, kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan',
  numItems: 4, itemWeight: 260, mixingBatches: 1, fridgeTemp: 6, hydration: 65, planLadder: 'hot', doughTempC: 24, now, conversion: 1,
  calculatedIdyPct: 0.146, nightAllowed: [],
  defaultWindow: b => sp.commercialReadinessWindow({ ...sp.STYLE_FERM_DEFAULTS.neapolitan, flourStrength: 1.2, kitchenTemp: 22, preheatMin: 45, totalWindowH: (+b - now) / H }) });
// The page's input: the anchor is the calculated plan for these inputs (autoPlan), never remembered: the picker's own
// automatic plan, one pure function (SchedulePicker automaticCommercialPlan) both apply.
const sa = require('../app/utils/scheduleAvailability.ts');
const planCtx = (flourStrength = 1.2) => ({ now, styleKey: 'neapolitan', kitchenTemp: 22, fridgeTemp: 6, flourStrength, tang: 'balanced', preheatMin: 45, preheatExtraMin: 0,
  planLadder: 'hot', mixerType: 'hand', numItems: 4, mixingBatches: 1, prefermentType: 'none', poolishStorage: 'auto', bigaStorage: 'auto', prefOffsetH: 0, prefInFridge: false, targetDoughTemp: 24 });
const calc = (o, flourStrength) => {
  const blocks = Y.uncovered(o.blocks);
  const p = sp.automaticCommercialPlan(planCtx(flourStrength), blocks, o.bake, {});
  if (!p.times) return null;
  const times = { start: p.times.start, bake: o.bake, prefHours: p.times.prefHours };
  const nightIds = [...new Set(sa.newNightHandsOn(Y.entryPlanActions({ times }, { ...o, blocks }), blocks).filter(a => +a.at > now).map(a => a.id))];
  return { times, anchorH: (+o.bake - +times.start) / H, nightIds };
};
const current = o => { const c = calc(o); return { ...o, anchorH: c?.anchorH, nightAllowed: c?.nightIds ?? [] }; };
const same = (a, b) => JSON.stringify(a && [a.times, a.shape, a.nightSteps.map(s => s.id + +s.at)]) === JSON.stringify(b && [b.times, b.shape, b.nightSteps.map(s => s.id + +s.at)]);

test('O2: the calculated plan is derived from the current inputs (Thu 20:00 for Fri 11:30, Thu 20:30 for Fri 19:30)', () => {
  assert.equal(hhmm(calc(b3('2026-11-27T11:30:00')).times.start), 'Thu 20:00');
  assert.equal(calc(b3('2026-11-27T19:30:00')).anchorH, 23);
  // Round 15b: the page's anchor is the picker's plan (one function, as the phone probe shows it): B3 with no amount,
  // default flour, the Thursday night the picker carries to the bake, bake Fri 7:30pm → Thu 8:30pm (the page's
  // reconstruction read Fri 7:00am).
  assert.equal(hhmm(calc(b3('2026-11-27T19:30:00', nights.slice(0, 1)), 1).times.start), 'Thu 20:30');
  // Covers an earlier plan put on the nights never move it.
  // Round 21 (E1): 0.15 % at lunch now puts the balls in on the night's 23:00 edge and needs no cover; 0.12 % still covers.
  const kept = Y.entryPlan(0.12, current(b3('2026-11-27T11:30:00')));
  assert.ok(kept.blocks.some(b => b.coveredActions?.length), 'the lunch plan covers its night steps');
  assert.deepEqual(calc(b3('2026-11-27T19:30:00', kept.blocks)), calc(b3('2026-11-27T19:30:00')));
});

test('O2 path independence: Keep 0.15 % at 11:30 then bake back to 7:30pm ≡ typing 0.15 % at 7:30pm', () => {
  for (const pct of [0.12, 0.14, 0.15, 0.151, 0.16, 0.2]) {
    const lunch = Y.entryPlan(pct, current(b3('2026-11-27T11:30:00')));
    const viaLunch = Y.entryPlan(pct, current(b3('2026-11-27T19:30:00', lunch ? lunch.blocks : nights)));
    const fresh = Y.entryPlan(pct, current(b3('2026-11-27T19:30:00')));
    assert.ok(same(viaLunch, fresh), `${pct}: ${viaLunch && hhmm(viaLunch.times.start)} vs ${fresh && hhmm(fresh.times.start)}`);
  }
  // Round 14 read Start Dough Fri 4:00am on the kept route. Round 17 (one night, 22:00–07:00 with the chip too): the
  // Thu 8:30pm fridge plan puts the dough in the fridge after 22:00; the plan without a night step ranks first (O2).
  const plan = Y.entryPlan(0.15, current(b3('2026-11-27T19:30:00')));
  assert.equal(plan.nightSteps.length, 0);
  // Same inputs, same plan: built twice, identical.
  assert.ok(same(plan, Y.entryPlan(0.15, current(b3('2026-11-27T19:30:00')))));
});

test('O2 ranking: no hands-on step 23:00–06:00 first, then the fewest night steps, then the knead nearest the calculated one', () => {
  for (const pct of [0.12, 0.14, 0.15, 0.2, 0.3]) for (const bake of ['2026-11-27T11:30:00', '2026-11-27T19:30:00']) {
    const o = current(b3(bake));
    const chosen = Y.entryPlan(pct, o);
    if (!chosen) continue;
    // Every candidate the builder considers scores no better.
    const score = p => sa.nightScore(sa.newNightHandsOn(Y.entryPlanActions(p, o), nights).filter(a => +a.at > now), nights);
    const others = [Y.entryPlanSearch(pct, o), Y.entryPlanSearch(pct, o, undefined, { softNights: true })].filter(Boolean);
    for (const other of others) assert.ok(score(chosen) <= score(other), `${pct} ${bake}: ${score(chosen)} > ${score(other)}`);
  }
});


test('O2: no state remembers a kept plan or a route (only the kept amount)', () => {
  assert.doesNotMatch(page, /entryNightIds|calculatedAnchorRef|calculatedYeastRef|calculatedPrefYeastRef|recordEntryNight|planNightIds/);
  // O3 (round 17): no remembered knead either.
  assert.doesNotMatch(page, /yeastAnchorH|rememberedAnchor/);
  assert.doesNotMatch(picker, /entryNightIds/);
  assert.doesNotMatch(read('app/utils/yeastEntry.ts'), /normalizeEntryNightIds/);
});

test('items 1 and 5: one Use/Keep line in Fine-tune, the time editor, the Recipe and Preparation; kept, it still names the steps', () => {
  for (const where of ['finetune', 'editor', 'recipe', 'preparation']) assert.match(page, new RegExp(`entryNightView\\('${where}'\\)`));
  assert.match(picker, /\{!isSourdough&&entryNightNode\}/);
  // Keep removes the buttons, never the line.
  assert.match(page, /if \(entryNightKeptNow\) return \{steps, pref, offer: null, kept: true\};/);
  assert.match(page, /\{!entryNight\.kept && <div style=\{\{display:'flex'/);
});

test('item 5: no filled button in a yeast statement ("Use X%" is secondary); the jar keep line says where the rest stays', () => {
  for (const attr of ['data-use-suggested-pref-yeast', 'data-use-minimum-yeast', 'data-use-calculated-pref-yeast', 'data-ft-use-calculated-yeast'])
    for (const m of page.matchAll(new RegExp(`<button[^>]*${attr}[^>]*>`, 'g'))) assert.doesNotMatch(m[0], /bh-apply-plan/, attr);
  // Round 23 (item 3): one helper for the card and the Levain row; a shared jar says "after both bakes".
  assert.match(output, /Keep the rest in the jar \(\$\{grams\}\) for next time/);
  assert.match(output, /Gardez le reste dans le bocal \(\$\{grams\}\) pour la prochaine fois/);
  assert.match(output, /After both bakes, \$\{grams\} stays in the jar/);
  assert.match(output, /jarRestLine\(isFr, `\$\{starterLeft\} g`, !!sharedStarterFeed\)/);
  assert.match(output, /jarRestLine\(locale === 'fr', wStr\(starterLeft\), !!sharedStarterFeed\)/);
});

test('item 3: one window check per storage; a statement quotes the band edge that storage missed', () => {
  const ctx = { kitchenTemp: 20, fridgeTemp: 6, massG: 300, warmupH: 1, cooldownH: 0 };
  for (const [type, inFridge] of [['biga', false], ['biga', true], ['poolish', false], ['poolish', true]]) {
    const bounds = PY.prefermentYeastBounds(type, inFridge);
    for (let pct = 0.02; pct <= 2; pct *= 1.15) {
      const timing = PY.prefermentYeastTiming(type, pct, inFridge, ctx);
      const miss = PY.prefermentWindowMiss(type, pct, inFridge, ctx);
      assert.equal(!timing, !!miss, `${type} ${inFridge} ${pct}`);
      if (timing) assert.ok(timing.hours >= bounds.min && timing.hours <= bounds.max, 'planned within the stated window');
      if (miss && miss.fast) assert.ok(miss.hours < bounds.min, `${type} ${pct}: past its best after ${miss.hours} h`);
      if (miss && !miss.fast && Number.isFinite(miss.hours)) assert.ok(miss.hours > bounds.max - 0.25, `${type} ${pct}: needs ${miss.hours} h`);
    }
  }
  // Round 14 (B3b): a cool-spot biga with 1.5 % fresh (0.5 % instant) is past its best before 12 h; 1.4 % fresh fits and is
  // planned in 12–20 h. The statement no longer says it "ripens in 6 h 15" beside a 1.4 % planned at 12 h 15.
  const miss = PY.prefermentWindowMiss('biga', 0.5, false, ctx);
  assert.ok(miss && miss.fast && miss.hours < 12, JSON.stringify(miss));
  const fits = PY.prefermentYeastTiming('biga', 1.4 / 3, false, ctx);
  assert.ok(fits && fits.hours >= 12 && fits.hours <= 20, JSON.stringify(fits));
  // The page states that storage only (the plan's), and a clamp out loud.
  assert.match(page, /const stated=storageNow\.includes\(prefGoesInFridge\)\?prefGoesInFridge:storageNow\[0\];/);
  assert.doesNotMatch(page, /const ranges=storages\.map\(range\)/);
  assert.match(page, /is more than this field takes \(/);
  assert.match(page, /dépasse ce que ce champ accepte \(/);
});

test('item 4 (round 15b): Nights turned on after Keep: a fresh anchor from the new inputs, the plan complete as saved (no clash sheet)', () => {
  const later = now + 2.25 * H; // Thu 9:45pm, as the phone spec (round11-yeast "Nights turned on after Keep")
  const at = (blocks) => ({ ...b3('2026-11-27T11:30:00', blocks), now: later });
  const currentAt = o => { const c = calc({ ...o, now: later }); return { ...o, anchorH: c?.anchorH, nightAllowed: c?.nightIds ?? [] }; };
  const kept = Y.entryPlan(0.14, currentAt(at([])));
  assert.ok(kept, 'planned without busy times');
  const o = currentAt(at(nights));
  // The anchor is the automatic plan for the new busy times, not the one before them.
  assert.notEqual(o.anchorH, currentAt(at([])).anchorH);
  const plan = Y.entryPlan(0.14, o);
  assert.ok(plan, 'still planned with Nights on');
  // Its night steps (Start Dough 2:00am and the folds) are named by the one Use/Keep line, and every step in the baker's
  // nights is covered: nothing is left for the "… fall during the night" sheet.
  assert.ok(plan.nightSteps.length > 0);
  assert.ok(plan.blocks.some(b => b.coveredActions?.length));
  assert.equal(sa.findAvailabilityConflicts(Y.entryPlanActions(plan, { ...o, blocks: plan.blocks }), plan.blocks).length, 0);
  // The page reads the anchor afresh for the picker's busy times (planEntryFor / entryTimingFor pass them).
  assert.match(page, /const fresh = at && \(\+at\.bake !== \+\(eatTime \?\? 0\) \|\| busyKey\(at\.blocks\) !== busyKey\(blocks\)\) \? automaticAnchor\(at\.blocks, at\.bake\) : autoPlan;/);
});
