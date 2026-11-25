// Round 17 (23 Nov 2026): owner decision O3 (no saved-bake rule versions) and FINDINGS 1–7 of the round-16 pass.
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
const Y = require('../app/utils/yeastEntry.ts');
const N = require('../app/utils/nightSteps.ts');
const av = require('../app/utils/scheduleAvailability.ts');
const sp = require('../app/components/SchedulePicker.tsx');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const page = read('app/[locale]/page.tsx'), picker = read('app/components/SchedulePicker.tsx');
const hhmm = d => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', hour: '2-digit', minute: '2-digit' });

// B3: Custom Neapolitan, 4 × 260 g, 22 °C, dough 24 °C, hand kneaded, Nights 23:00–07:00, clock Thu 19:30.
const now = +SG('2026-11-26T19:30:00');
const nights = [
  { label: 'Thursday night', from: SG('2026-11-26T23:00:00'), to: SG('2026-11-27T07:00:00') },
  { label: 'Friday night', from: SG('2026-11-27T23:00:00'), to: SG('2026-11-28T07:00:00') },
];
const ctx = { now, styleKey: 'neapolitan', kitchenTemp: 22, fridgeTemp: 6, flourStrength: 1.2, tang: 'balanced', preheatMin: 45, preheatExtraMin: 0,
  planLadder: 'hot', mixerType: 'hand', numItems: 4, mixingBatches: 1, prefermentType: 'none', poolishStorage: 'auto', bigaStorage: 'auto', prefOffsetH: 0, prefInFridge: false, targetDoughTemp: 24 };
// The page's input: anchored on the automatic plan for these inputs (SchedulePicker automaticCommercialPlan).
const input = (bake, blocks = nights) => {
  const base = { bake: SG(bake), blocks, kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan', numItems: 4, itemWeight: 260,
    mixingBatches: 1, fridgeTemp: 6, hydration: 65, planLadder: 'hot', doughTempC: 24, now, conversion: 1, calculatedIdyPct: 0.146 };
  const p = sp.automaticCommercialPlan(ctx, Y.uncovered(blocks), base.bake, {});
  return { ...base, anchorH: p.times ? (+base.bake - +p.times.start) / H : undefined };
};
const weight = plan => { const steps = av.nightHandsOn(Y.entryPlanActions(plan, plan.o), plan.o.blocks).filter(a => +a.at > now); return [steps.filter(a => av.isDeepNight(a.at)).length, steps.length]; };

test('O3: no saved-bake rule versions; old saved fields are ignored on restore', () => {
  for (const f of ['app/utils/hotPlanRules.ts', 'app/utils/levainLegacy.ts']) assert.equal(fs.existsSync(path.join(__dirname, '..', f)), false, f);
  assert.doesNotMatch(page, /legacyHotPlan|legacyEntryTiming|keptEntryRules|entryRules|planRules|levainLegacy|yeastAnchorH|rememberedAnchor/);
  assert.doesNotMatch(picker, /entryRoomPlans|entryNightRule\b|yeastAnchorH/);
  assert.equal(utils.legacyStarterBulkFactor, undefined);
  assert.equal(Y.keptEntryRulesFor, undefined);
  // The baker's own choices and recorded facts stay (Keep, entered amounts, bowl loss they set).
  assert.match(page, /setEntryNightKept\(normalizeEntryNightKept\(session\.entryNightKept\)\)/);
  assert.match(page, /setWastePct\(restoredWastePct\(session\.wastePct\)\)/);
  // Every plan of a restored bake uses today's ladder.
  assert.match(page, /const planLadder: PlanLadder = tab === 'simple' \? 'all' : 'hot';/);
});

test('finding 5: one night, the same with and without the Nights chip; edges exclusive', () => {
  const at = (h, m = 0) => new Date(2026, 10, 26, h, m);
  const acts = [{ id: 'fold-1', at: at(22, 0) }, { id: 'fold-2', at: at(22, 15) }, { id: 'cold-in', at: at(23, 0) }, { id: 'bake', at: at(23, 30) }];
  const off = av.nightHandsOn(acts, []).map(a => a.id), on = av.nightHandsOn(acts, [nights[0]]).map(a => a.id);
  assert.deepEqual(off, ['fold-2', 'cold-in']);
  assert.deepEqual(on, off);
  // 23:00 is a shoulder step, 23:15 a wake-up (finding 6: the Nights edge is exclusive).
  assert.equal(av.isDeepNight(at(23, 0)), false);
  assert.equal(av.isDeepNight(at(23, 15)), true);
  // The automatic plan's own rule (D4, newNightHandsOn) is unchanged: plans without an entered amount stay byte-identical.
  assert.deepEqual(av.newNightHandsOn(acts, [nights[0]]).map(a => a.id), []);
});

test('finding 6: steps at the same time are one mention; Keep uses the recipe\'s rounding; no busy tag at the night\'s edge', () => {
  const at = (h, m = 0) => new Date(2026, 10, 27, h, m);
  assert.equal(N.nightStepsLine([{ id: 'cold-out', at: at(3) }, { id: 'divide', at: at(3) }, { id: 'cold-in-2', at: at(3, 15) }], false),
    'This plan has the take-out and shaping at 3:00am, the dough into the fridge at 3:15am.');
  assert.equal(N.nightStepsLine([{ id: 'cold-out', at: at(3) }, { id: 'divide', at: at(3) }], true), 'Ce planning a la sortie du frigo et le façonnage à 3h00.');
  assert.match(page, /const keptShown = yeastPctOverride !== undefined \? recipeRound\(yeastPctOverride \* conversion\)/);
  // Round 21 (rule E1): the busy tag reads the one edge rule (busyHit): a quick step at a busy time's start is not in it.
  assert.match(page, /busy:blocks\.some\(block=>busyHit\(\{id:e\.key\?\?'',at:e\.at\},\+block\.from,\+block\.to\)\)/);
  // Round 21 (P): nor beside a night line whose Use weighs the calculated amount.
  assert.match(page, /!doughIsCalc&&!nightUseIsCalc&&<button type="button" data-ft-use-calculated-yeast/);
  assert.match(page, /prefOffsetH>autoPlan\.times\.prefHours\+0\.01/);
});

test('findings 1, 2, 4: one plan from the current inputs, ranked by night weight, then the knead nearest the calculated one', () => {
  for (const [bake, blocks] of [['2026-11-27T11:30:00', nights], ['2026-11-27T11:30:00', []], ['2026-11-27T19:30:00', nights]]) {
    for (const pct of [0.12, 0.14, 0.151, 0.17, 0.2]) {
      const o = input(bake, blocks);
      const plan = Y.entryPlan(pct, o);
      assert.ok(plan, `${bake} ${pct}`);
      // Same inputs, same plan (every route builds it with this function).
      assert.deepEqual(JSON.stringify(Y.entryPlan(pct, { ...o, blocks: plan.blocks })), JSON.stringify(plan));
      // The line is the plan's night steps, every one of them.
      const shown = av.nightHandsOn(Y.entryPlanActions(plan, { ...o, blocks: Y.uncovered(plan.blocks) }), blocks).filter(a => +a.at > now);
      assert.deepEqual(plan.nightSteps.map(a => a.id + +a.at), shown.map(a => a.id + +a.at));
      // No candidate on the quarter-hour grid of the amount's own band is lighter.
      const own = Y.entryTiming(pct, o, (+o.bake - now) / H);
      const best = [shown.filter(a => av.isDeepNight(a.at)).length, shown.length];
      for (let h = Math.ceil(own.to * 4) / 4; h <= own.from; h += 0.25) {
        const p = Y.entryPlanSearch(pct, o, undefined, { softNights: true, mix: new Date(+o.bake - h * H), timing: own });
        if (!p) continue;
        const w = weight({ ...p, o });
        assert.ok(w[0] > best[0] || (w[0] === best[0] && w[1] >= best[1]), `${bake} ${pct} ${hhmm(p.times.start)}: ${w} lighter than ${best}`);
      }
    }
  }
  // Finding 2: Nights on, a kept 0.151 % at lunch: nothing between 23:00 and 06:00 (round 16: fridge 11pm, shaping 3am).
  const kept = Y.entryPlan(0.151, input('2026-11-27T11:30:00'));
  assert.deepEqual(kept.nightSteps.filter(a => av.isDeepNight(a.at)), []);
  // Finding 4: the one-trip shape is a candidate (entered amounts only): 0.16 % at dinner shapes at the end of the warm bulk.
  // Round 21 (E1): lunch 0.15 % (the example before) now has a proof fit with shaping ending at 23:00, the balls in at 23:00,
  // kneaded at the calculated 20:15, which ranks first; the one-trip shape still wins elsewhere.
  const trip = Y.entryPlan(0.16, input('2026-11-27T19:30:00'));
  assert.equal(trip.shape.oneTrip, true);
  const s = utils.buildSchedule(trip.times.start, trip.times.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, trip.shape, 'hot');
  assert.equal(utils.fridgeSpellCount(s), 1);
});

test('finding 1: the page builds every schedule with the shape of the plan the picker applies; the line reads the plan on screen', () => {
  assert.match(page, /const plan = cachedEntryPlan\(effectiveYeastOverride, o\);\n    return plan \? plan\.shape : entryPlanShape\(effectiveYeastOverride, o\);/);
  assert.match(page, /return cachedEntryPlan\(effectiveYeastOverride, o\)\?\.timing \?\? entryTiming/);
  assert.match(page, /const screenNightSteps = useMemo\(\(\) => schedule \? nightHandsOn\(/);
  assert.doesNotMatch(page, /entryNightAllowedIds|nightAllowed/);
  assert.match(picker, /const shared=planEntry\(candidateBlocks,pendingEatTime\);/);
});

test('finding 7: Preparation carries no "Plan updated" box (its heading gives the new times)', () => {
  assert.match(page, /destination!=='protocol' && eatTime && \(\(\)=>\{\n  \/\/ Only what moved/);
});

test('finding 3: a preferment statement speaks of the storage the plan uses', () => {
  assert.match(page, /const miss=prefermentWindowMiss\(pref,pct,stated,prefYeastCtx\(pref,stated\)\);/);
  assert.match(page, /inFridge:stated,suggestedShownPct:nearest\(\),clampedFrom\}\);return;\}/);
});

test('automatic plans are untouched: no entered amount, no one-trip candidate', () => {
  const o = input('2026-11-27T19:30:00');
  const plain = utils.buildSchedule(new Date(+o.bake - o.anchorH * H), o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  const same = utils.buildSchedule(new Date(+o.bake - o.anchorH * H), o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  assert.equal(JSON.stringify(plain), JSON.stringify(same));
  // A shape without `oneTrip` builds exactly as before.
  const a = utils.buildSchedule(new Date(+o.bake - 23 * H), o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, { rtScale: 1.2 }, 'hot');
  assert.equal(utils.fridgeSpellCount(a) >= 1, true);
});
