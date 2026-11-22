// Round 9 (22 Nov 2026): baker-set yeast and preferments (FINDINGS B, C, D, F, G, H, I, S2).
// The scenarios are Singapore bakes and the night (22:00–07:00) is read in local time: pin the zone before any Date.
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
const av = require('../app/utils/scheduleAvailability.ts');
const sp = require('../app/components/SchedulePicker.tsx');
const N = require('../app/utils/nightSteps.ts');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
const page = fs.readFileSync(path.join(__dirname, '../app/[locale]/page.tsx'), 'utf8');

// B3: 4 Neapolitan pizzas, 22 °C, no busy times, Thu 19:30, bake Fri 19:30; the calculated plan kneads Thu 20:30 (23 h).
const now = +SG('2026-11-26T19:30:00'), b3Bake = SG('2026-11-27T19:30:00');
const b3 = { bake: b3Bake, blocks: [], kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan', numItems: 4, itemWeight: 260,
  mixingBatches: 1, fridgeTemp: 6, hydration: 60 };
const nightIdsOf = (bake, hours, shape, blocks = []) => {
  const s = utils.buildSchedule(new Date(+bake - hours * H), bake, blocks, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, shape);
  return [...new Set(av.newNightHandsOn(s.availabilityActions, blocks).map(a => a.id))];
};
const b3Entry = (extra = {}) => ({ ...b3, now, conversion: 1, anchorH: 23, calculatedIdyPct: 0.16, roomPlans: true, nightAllowed: nightIdsOf(b3Bake, 23), ...extra });

test('bug I: a room-temperature plan is one of the timing\'s plans; without the option nothing moves', () => {
  // The room plan: no fridge, the bulk takes the window.
  const room = utils.buildSchedule(new Date(+b3Bake - 13 * H), b3Bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, utils.ROOM_PLAN);
  assert.equal(room.totalColdHours, 0);
  assert.ok(room.bulkFermHours > 6, String(room.bulkFermHours));
  // Levain and enriched doughs never take it.
  assert.equal(utils.roomPlanAllowed('pain_levain'), false);
  assert.equal(utils.roomPlanAllowed('brioche'), false);
  assert.equal(utils.roomPlanAllowed('neapolitan'), true);
  // Without roomPlans, the established timing, byte for byte.
  for (const dose of [0.08, 0.1, 0.14, 0.2, 0.3]) for (const anchorH of [23, undefined])
    assert.equal(JSON.stringify(utils.enteredYeastTiming(dose, { ...b3, anchorH, roomPlans: false })), JSON.stringify(utils.enteredYeastTiming(dose, { ...b3, anchorH })));
  // Round 11 (D2): 0.1 % keeps the 23 h knead, the fridge absorbing it within the readiness band (±10 %).
  const kept = utils.enteredYeastTiming(0.1, { ...b3, anchorH: 23, roomPlans: true, maxH: 23.75 });
  assert.equal(kept.center, 23); assert.equal(kept.shape.room, undefined);
  // 0.08 %: the fridge cannot absorb it at 23 h; the room plan is the window nearest the knead within the day.
  const t = utils.enteredYeastTiming(0.08, { ...b3, anchorH: 23, roomPlans: true, maxH: 23.75 });
  assert.deepEqual(t.shape, { rtScale: 1, room: true });
  assert.ok(t.center > 10 && t.center < 16, String(t.center));
  // A dose the fridge absorbs keeps the calculated knead (D2): the room plan is not used.
  const fit = utils.enteredYeastTiming(0.2, { ...b3, anchorH: 23, roomPlans: true, maxH: 23.75 });
  assert.equal(fit.center, 23);assert.equal(fit.shape.room, undefined);
  // A room timing the page already chose is kept (the picker reads it back).
  assert.deepEqual(utils.enteredYeastTiming(0.08, { ...b3, anchorH: 23, roomPlans: true, exitLeadMin: utils.ROOM_PLAN, maxH: 23.75 }), t);
});

test('bug I: the statement and the re-timing read one path (0.1 % at 22 °C fits a room plan in the day)', () => {
  // Round 11 (D2): 0.08 % (0.1 % now keeps the knead, see above) is the amount the fridge cannot absorb.
  const o = b3Entry();
  const c = Y.checkYeastEntry(0.08, o);
  assert.equal(c.fits, true, JSON.stringify(c));
  // The shape every schedule is built with is the timing's own room plan.
  assert.deepEqual(Y.entryPlanShape(0.08, o), { rtScale: 1, room: true });
  const plan = Y.entryPlan(0.08, o);
  assert.ok(plan && +plan.times.start > now);
  const s = utils.buildSchedule(plan.times.start, b3Bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, plan.shape);
  assert.equal(s.totalColdHours, 0, 'a room plan');
  // 0.1 %: the plan the page applies keeps the 20:30 knead (its night steps named), the fridge absorbing it.
  const kept = Y.entryPlan(0.1, o);
  assert.ok(Math.abs(+kept.times.start - (+b3Bake - 23 * H)) <= H, new Date(kept.times.start).toISOString());
  // Without the room plans (a bake saved before), the established statement: it needs longer than the day.
  assert.equal(Y.checkYeastEntry(0.1, b3Entry({ roomPlans: false, nightAllowed: undefined })).reason, 'time');
});

test('owner 22 Nov: night steps never refuse an entered amount; they are named, with the nearest amount that avoids them', () => {
  const o = b3Entry();
  // Round 13 (item 3): 0.14 % keeps the 20:30 knead without a night step now (fewest night steps first: a fit with the
  // calculated bulk); 0.08 % is the amount whose plan has night steps (a room plan kneaded at 5:30am).
  assert.equal(Y.checkYeastEntry(0.14, o).nightSteps, undefined);
  const c = Y.checkYeastEntry(0.08, o);
  assert.equal(c.fits, true, JSON.stringify(c));
  assert.equal(c.reason, null);
  assert.equal(c.nightSteps, true);
  assert.ok(c.nightFreeShownPct > 0.08 && c.nightFreeShownPct <= 0.12, String(c.nightFreeShownPct));
  assert.equal(Y.nightFreeShownPct(0.08, o), c.nightFreeShownPct);
  // The amount is planned with its night steps; the offer is planned without any.
  // Round 11: the night rule is lifted by softNights (which also reads the baker's own nights as free, O1).
  const night = Y.entryPlanSearch(0.08, o, undefined, { softNights: true });
  assert.ok(night, 'a plan with the night steps');
  assert.equal(Y.entryPlanSearch(0.08, o), null, 'none without');
  const steps = av.newNightHandsOn(utils.buildSchedule(night.times.start, b3Bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, night.shape).availabilityActions, [])
    .filter(a => !o.nightAllowed.includes(a.id));
  assert.ok(steps.some(a => a.id === 'mix'), JSON.stringify(steps));
  assert.match(N.nightStepsLine(steps, false), /^This plan has Start Dough at \d{1,2}:\d\dam/);
  assert.match(N.nightStepsLine(steps, true), /^Ce planning a le pétrissage à \dh\d\d/);
  const plan = Y.entryPlanSearch(c.nightFreeShownPct, o);
  const s = utils.buildSchedule(plan.times.start, b3Bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, plan.shape);
  assert.deepEqual(av.newNightHandsOn(s.availabilityActions, []).map(a => a.id).filter(id => !o.nightAllowed.includes(id)), []);
  // An amount with a night-free plan says nothing; without the rule (a bake saved before it) nothing either.
  assert.equal(Y.checkYeastEntry(c.nightFreeShownPct, o).nightSteps, undefined);
  assert.equal(Y.checkYeastEntry(0.08, b3Entry({ nightAllowed: undefined })).nightSteps, undefined);
  // Kept choices are remembered with the amounts.
  assert.deepEqual(Y.normalizeEntryNightKept({ yeast: 0.14 }), { yeast: 0.14 });
  assert.deepEqual(Y.normalizeEntryNightKept({ pref: { type: 'biga', pct: 0.5 } }), { pref: { type: 'biga', pct: 0.5 } });
  assert.equal(Y.normalizeEntryNightKept({ yeast: 'x' }), undefined);
});

test('the night line names each kind of step once', () => {
  const at = (h, m = 0) => new Date(2026, 10, 28, h, m);
  assert.equal(N.nightStepsLine([], false), null);
  assert.equal(N.nightStepsLine([{ id: 'preheat', at: at(6, 15) }, { id: 'cold-out-2', at: at(4, 30) }], false), 'This plan has the take-out at 4:30am, the preheat at 6:15am.');
  assert.equal(N.nightStepsLine([{ id: 'preferment', at: at(23, 0) }], true, 'biga'), 'Ce planning a la biga à 23h00.');
  assert.equal(N.nightStepsLine([{ id: 'fold-1', at: at(22, 30) }], false), 'This plan has a fold at 10:30pm.');
});

test('bug D: busy times are never the reason when there are none', () => {
  // Thomas: baguette, 20 °C, cool-spot biga (12–20 h), no busy times, bake Sat 11:30; 3 % fresh in the final dough (1 % IDY).
  const bake = SG('2026-11-28T11:30:00');
  const o = { bake, now: +SG('2026-11-26T20:00:00'), blocks: [], kitchenTemp: 20, preheatMin: 30, mixerType: 'hand', styleKey: 'baguette', numItems: 4, itemWeight: 320,
    mixingBatches: 1, fridgeTemp: 6, hydration: 72, conversion: 3, anchorH: 4, calculatedIdyPct: 0.446, roomPlans: true, nightAllowed: [],
    preferment: { options: [{ inFridge: false, prefWindow: { min: 12, max: 20 }, prefHours: 16, warmupH: 0, cooldownH: 0 }], valid: () => true } };
  const c = Y.checkYeastEntry(1, o);
  assert.equal(c.fits, false);
  assert.notEqual(c.reason, 'busy');
  assert.equal(c.reason, 'fast');
  assert.ok(c.suggestedShownPct > 1.34 && c.suggestedShownPct < 3, String(c.suggestedShownPct));
  // Every refused amount without busy times gives another reason.
  for (const dose of [0.02, 0.05, 0.6, 0.8, 1.2]) {
    const r = Y.checkYeastEntry(dose, o);
    if (!r.fits) assert.notEqual(r.reason, 'busy', `${dose}: ${r.reason}`);
  }
  // The page names busy times only for 'busy' (and the preferment row only with blocks).
  assert.match(page, /const reason=entry\.blocks\.length&&entryPlanSearch\(effectiveYeastOverride,entry,undefined,\{ignoreBlocks:true,softNights:true\}\)\?'busy':'plan';/);
});

test('bug G: a later bake keeps the baker\'s recurring nights and adds no night step; F: the cool spot at this bake', () => {
  const nights = ['2026-11-26', '2026-11-27'].map(d => ({ label: d + ' night', from: SG(d + 'T23:00:00'), to: new Date(+SG(d + 'T23:00:00') + 8 * H) }));
  const presets = { sleep: { enabled: true, from: '23:00', to: '07:00' }, work: { enabled: false, from: '09:00', to: '18:00' } };
  const carried = av.blocksForLaterBake(nights, new Date(now), SG('2026-11-29T12:00:00'), presets);
  assert.ok(carried.some(b => +b.from === +SG('2026-11-28T23:00:00')), 'Saturday night carried');
  assert.equal(carried.filter(b => b.label.startsWith('Work')).length, 0, 'work days only when the baker uses them');
  assert.deepEqual(av.blocksForLaterBake([], new Date(now), SG('2026-11-29T12:00:00'), presets), []);
  const common = { prefermentFlourPct: 40, doughMassG: 1040, hydrationPct: 60, flourTempC: 22, now, blocks: nights,
    blocksFor: bake => av.blocksForLaterBake(nights, new Date(now), bake, presets), kitchenTemp: 22, fridgeTemp: 6, styleKey: 'neapolitan', flourStrength: 1,
    preheatMin: 45, mixerType: 'hand', numItems: 4, mixingBatches: 1, budgetMs: 30000 };
  const later = sp.earliestPrefermentBake({ ...common, type: 'biga', storages: [true], from: new Date(now + 27 * H) });
  assert.ok(later, 'a later bake');
  // Sat 7:00 put the take-out at 4:30 and the preheat at 6:15: never offered.
  assert.ok(+later.bake > +SG('2026-11-28T07:00:00'), later.bake.toString());
  const blocks = common.blocksFor(later.bake);
  const s = utils.buildSchedule(later.start, later.bake, blocks, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1);
  assert.deepEqual(av.newNightHandsOn([...s.availabilityActions, { id: 'preferment', at: new Date(+later.start - later.prefHours * H) }], blocks).map(a => a.id), []);
  assert.ok(+later.start - later.prefHours * H > now, 'the biga starts in the future');
  // The baker's own choice may keep night steps (owner, 22 Nov 2026): never later than the night-free bake, and named.
  const loose = sp.earliestPrefermentBake({ ...common, allowNight: true, type: 'biga', storages: [true], from: new Date(now + 27 * H) });
  assert.ok(loose && +loose.bake <= +later.bake && Array.isArray(loose.nightSteps));
  assert.deepEqual(later.nightSteps, []);
  // Owner decision 1: at 22 °C the cool spot is not automatic, but a cool-spot plan exists at this bake: offered.
  const cool = sp.earliestPrefermentBake({ ...common, type: 'biga', storages: [false], from: b3Bake, maxDays: 0 });
  assert.equal(+cool.bake, +b3Bake);assert.equal(cool.inFridge, false);
  assert.match(page, /data-preferment-fallback="cool"/);
  assert.match(page, /\{coolFits&&<button/);
});

test('bug H: a plan shown without a fit never starts its preferment in the past', () => {
  const picker = fs.readFileSync(path.join(__dirname, '../app/components/SchedulePicker.tsx'), 'utf8');
  // Round 11: the clamp moved into shownPrefHours (the storage's window too).
  assert.match(picker, /const times=!usable&&hasPrefActive&&!execution\?\{\.\.\.shown,prefHours:shownPrefHours\(shown\.prefHours,shown\.start,storage\)\}:shown;/);
  assert.match(picker, /return Math\.max\(0,Math\.min\(hours,window\?\.max\?\?hours,Math\.floor\(\(\+start-earliestQuarterStart\(Date\.now\(\)\)\)\/900000\)\/4\)\);/);
  // The entry search itself never proposes a past preferment (findFixedBakeSchedule), with the night rule too.
  const bake = SG('2026-11-28T07:00:00');
  const nights = ['2026-11-26', '2026-11-27'].map(d => ({ label: d + ' night', from: SG(d + 'T23:00:00'), to: new Date(+SG(d + 'T23:00:00') + 8 * H) }));
  const o = { ...b3, bake, blocks: nights, now, conversion: 3, anchorH: 35, calculatedIdyPct: 0.16, roomPlans: true, nightAllowed: ['cold-out-2', 'preheat'],
    preferment: { options: [{ inFridge: true, prefWindow: { min: 24, max: 58 }, prefHours: 48, warmupH: 0, cooldownH: 0 }], valid: () => true } };
  // 3 % fresh in the final dough: kneaded about 2 h 45 before a 7:00 bake, in the night: refused, and not for busy times alone.
  const c = Y.checkYeastEntry(1, o);
  assert.equal(c.fits, false, JSON.stringify(c));
  assert.ok(['fast', 'plan'].includes(c.reason), c.reason);
});

test('bug B: a preferment amount is cleared, visibly, when the storage changes or it loses its window', () => {
  assert.match(page, /function clearPrefYeastForStorage\(type: FlourPreferment\)/);
  assert.match(page, /onClick=\{\(\)=>\{if\(value!==poolishStorage\)\{clearPrefYeastForStorage\('poolish'\);/);
  assert.match(page, /onClick=\{\(\)=>\{if\(value!==bigaStorage\)\{clearPrefYeastForStorage\('biga'\);/);
  assert.match(page, /const prefYeastStale = !!enteredPrefYeast && effectivePrefYeastOverride === undefined && !execution && !mixExecution;/);
  // The storages are recipe inputs: Update recipe, never Back to Recipe, after a change.
  assert.match(page, /prefermentType==='poolish'\?poolishStorage:null,prefermentType==='biga'\?bigaStorage:null\]\);/);
});

test('bug C: with a poolish or biga the change line names the total yeast', () => {
  assert.match(page, /\$\{inPref\?'Total yeast':'Yeast'\} now/);
  assert.match(page, /Levure\$\{inPref\?' au total':''\}/);
  assert.doesNotMatch(page, /in the preferment' *:/);
});

test('saved bakes keep their entered timing (legacyEntryTimingFor)', () => {
  const saved = { recipeGenerated: true, yeastPctOverride: 0.1, startTime: now - H };
  assert.equal(Y.legacyEntryTimingFor(saved, now), true, 'under way');
  assert.equal(Y.legacyEntryTimingFor({ ...saved, startTime: now + H }, now), false, 'not under way yet');
  assert.equal(Y.legacyEntryTimingFor({ ...saved, entryRules: Y.ENTRY_RULES }, now), false, 'made with the rules');
  assert.equal(Y.legacyEntryTimingFor({ ...saved, yeastPctOverride: undefined }, now), false, 'no entered amount');
  assert.equal(Y.legacyEntryTimingFor({ ...saved, entryRules: Y.ENTRY_RULES, legacyEntryTiming: true }, now), true, 'kept so once');
  assert.equal(Y.legacyEntryTimingFor({ recipeGenerated: true, prefYeastOverride: { type: 'biga', pct: 0.5 }, startTime: now + H, mixExecution: { at: now } }, now), true, 'a recorded mix');
  // Round 15 (O2): no night ids are remembered with an amount any more (normalizeEntryNightIds removed).
  assert.equal(Y.normalizeEntryNightIds, undefined);
});
