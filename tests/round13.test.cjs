// Round 13 (22 Nov 2026): the time editor tries the requested bake first, kept plans with the fewest night steps, D2
// continuity (the proof fit), no "Use X%" weighing what the calculated amount weighs, a biga → poolish switch replans,
// one window check for a cool-spot biga, and the small items. Singapore bakes; the night (22:00–07:00) is read in local
// time: pin the zone before any Date.
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
const { formatYeastDose } = require('../app/utils/prefermentDose.ts');
const sp = require('../app/components/SchedulePicker.tsx');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const page = read('app/[locale]/page.tsx'), picker = read('app/components/SchedulePicker.tsx'), guide = read('app/components/BakeGuide.tsx');

// B3 (round 12): Custom Neapolitan, 4 × 260 g, 22 °C, dough 24 °C, hand kneaded, Nights 23:00–07:00, clock Thu 19:30.
const now = +SG('2026-11-26T19:30:00');
const nights = [
  { label: 'Thursday night', from: SG('2026-11-26T23:00:00'), to: SG('2026-11-27T07:00:00') },
  { label: 'Friday night', from: SG('2026-11-27T23:00:00'), to: SG('2026-11-28T07:00:00') },
];
const b3 = (bake, anchorH, calc, extra = {}) => ({ bake: SG(bake), blocks: nights, kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan',
  numItems: 4, itemWeight: 260, mixingBatches: 1, fridgeTemp: 6, hydration: 65, planLadder: 'hot', doughTempC: 24, now, conversion: 1,
  anchorH, calculatedIdyPct: calc, nightAllowed: [],
  // The planner's window for the calculated amount, as the page passes it (yeastEntryInput).
  defaultWindow: b => sp.commercialReadinessWindow({ ...sp.STYLE_FERM_DEFAULTS.neapolitan, flourStrength: 1.2, kitchenTemp: 22, preheatMin: 45, totalWindowH: (+b - now) / H }), ...extra });
const hhmm = d => new Date(d).toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', hour: '2-digit', minute: '2-digit' });

test('item 3 (D2): 0.11–0.15 % at 22 °C: the proof fit keeps the calculated knead (Thu 20:30); the plan has no night step', () => {
  // The calculated plan: 0.15 % kneaded Thu 20:30 for Fri 19:30 (23 h).
  const o = b3('2026-11-27T19:30:00', 23, 0.146);
  for (const pct of [0.11, 0.12, 0.13, 0.14, 0.15]) {
    // Round 17 (findings 2, 5): the fridge plan at Thu 20:30 puts the dough in the fridge after 22:00 (a night step, the
    // same with or without the Nights chip); the room plan on Friday has none and ranks first (O2).
    const plan = Y.entryPlan(pct, o);
    assert.ok(plan, `${pct}: a plan`);
    assert.equal(plan.nightSteps.length, 0, `${pct}: no night step`);
    const t = Y.entryTiming(pct, o, 23.75);
    assert.equal(t.center, 23, `${pct}: the timing keeps the knead`);
    const s = utils.buildSchedule(new Date(+o.bake - 23 * H), o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, t.shape, 'hot');
    assert.ok(s.totalColdHours > 0, `${pct}: a fridge plan`);
    // The balls' room time after the fridge stays within the published 4–6 h second rising (EU TSG 97/2010).
    const exit = s.coldRetard2End ?? s.coldRetardEnd;
    assert.ok((+o.bake - +exit) / H <= utils.BALL_PROOF_MAX_H + 1e-9, `${pct}: ${(+o.bake - +exit) / H} h out of the fridge`);
  }
  // Less yeast lengthens the final proof only (proof fit): the bulk and its folds stay the calculated plan's.
  const t1 = Y.entryTiming(0.11, o, 23.75);
  const p1 = { times: { start: new Date(+o.bake - 23 * H) }, shape: t1.shape };
  assert.equal(p1.shape.proof, true);
  const calc = utils.buildSchedule(p1.times.start, o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  const kept = utils.buildSchedule(p1.times.start, o.bake, nights, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, p1.shape, 'hot');
  assert.equal(+kept.coldRetard1Start || +kept.coldRetardStart, +calc.coldRetard1Start || +calc.coldRetardStart, 'same fridge entry');
  assert.ok(+kept.finalProofStart < +calc.finalProofStart, 'out of the fridge earlier');
  const path_ = utils.doughThermalPath(kept, 4, 260, 65, 22, 6, 24);
  const budget = utils.fermentationBudget(0.11, path_.warmHours, 22, path_.coldHours, 6, path_);
  assert.ok(Math.abs(budget - 1) <= 0.1, String(budget));
  // 0.1 % would need about 8 h out of the fridge: beyond the cap, it is the established timing (a room plan, no night step).
  const p0 = Y.entryPlan(0.1, o);
  assert.ok(p0 && !p0.shape?.proof && p0.nightSteps.length === 0, JSON.stringify(p0 && p0.shape));
  // Only Neapolitan has a published ball rise: no proof fit for a baguette.
  assert.ok(utils.BALL_PROOF_STYLES.has('neapolitan') && !utils.BALL_PROOF_STYLES.has('baguette'));
});


test('items 3–4: the ranking counts the preferment\'s start, and a wake-up (23:00–06:00) outweighs shoulder steps', () => {
  const av = require('../app/utils/scheduleAvailability.ts');
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);
  // Three steps in the 22:00–23:00 / 06:00–07:00 shoulders weigh less than one at 3am.
  assert.ok(av.nightScore([{ id: 'fold-1', at: at(26, 22, 10) }, { id: 'fold-2', at: at(26, 22, 40) }, { id: 'cold-out', at: at(27, 6, 30) }], [])
    < av.nightScore([{ id: 'cold-out', at: at(27, 3, 0) }], []));
  assert.ok(av.nightScore([{ id: 'preferment', at: at(26, 23, 30) }], []) > 0);
  const utilsSrc = read('app/utils.ts');
  assert.match(utilsSrc, /\.\.\.\(prefStartH \? \[\{ id: 'preferment', at: new Date\(\+input\.bake - \(h \+ prefStartH\) \* 3600000\) \}\] : \[\]\)/);
});

test('the established fit is unchanged: a {rtScale} shape scales bulk and proof as before; a proof fit keeps the bulk', () => {
  const bake = SG('2026-11-27T19:30:00'), start = new Date(+bake - 23 * H);
  const plain = utils.buildSchedule(start, bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, undefined, 'hot');
  const scaled = utils.buildSchedule(start, bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, { rtScale: 1.5 }, 'hot');
  const proof = utils.buildSchedule(start, bake, [], 22, 45, 'hand', 'neapolitan', 4, 1, false, 1, { rtScale: 1.5, proof: true }, 'hot');
  assert.ok(scaled.bulkFermHours > plain.bulkFermHours);
  assert.equal(proof.bulkFermHours, plain.bulkFermHours);
  assert.ok(proof.finalProofHours > plain.finalProofHours);
  assert.equal(utils.RT_SCALE_MAX, 2);
});

test('item 2: a kept amount with busy nights takes the plan with the fewest night steps, then the knead nearest the calculated one', () => {
  // Lunch: the calculated 0.19 % kneads Thu 20:00 for Fri 11:30 (15.5 h).
  const o = b3('2026-11-27T11:30:00', 15.5, 0.19);
  const plan = Y.entryPlan(0.14, o);
  assert.ok(plan);
  // Not the 1:45am room plan with four folds, nor round 15's take-out and shaping at 3:00am: Thursday evening, shaped at
  // the end of the warm bulk (round 17, one trip), no step after 3am.
  // Round 21 (E1): the fits anchored up to an hour before the calculated knead are candidates; 0.14 % now kneads at the
  // calculated 20:00 with a proof fit, shaping 10:30pm (main: 7:45pm one trip, shaping 11:30pm and the balls in 11:45pm).
  assert.equal(hhmm(plan.times.start), 'Thu 20:00');
  assert.ok(plan.nightSteps.every(a => !require('../app/utils/scheduleAvailability.ts').isDeepNight(a)), JSON.stringify(plan.nightSteps));
  assert.ok(plan.nightSteps.every(a => new Date(a.at).getHours() >= 22), JSON.stringify(plan.nightSteps));
  // The amount next to the calculated one, within the band at the calculated knead, has a plan there (it had none:
  // its window was the anchor alone); its shaping at 10:30pm is named.
  const near = Y.entryPlan(0.17, o);
  assert.ok(near && hhmm(near.times.start) === 'Thu 20:00' && near.nightSteps.every(a => new Date(a.at).getHours() === 22));
});

test('item 1: the time editor plans the requested bake (entryPlan) even when the recorded knead is far from it', () => {
  // 0.5 % entered over the 7:30pm plan (knead 23 h before), then the bake moved to 11:30: the plan at 8:00 fits.
  const o = b3('2026-11-27T11:30:00', 23, 0.146);
  const plan = Y.entryPlan(0.5, o);
  // Round 17: the room plan Fri 7:45am ranks with 8:00 (no night step either) and is nearer the knead.
  assert.ok(plan && hhmm(plan.times.start) === 'Fri 07:45' && plan.nightSteps.length === 0, plan && hhmm(plan.times.start));
  // The picker no longer holds a moved bake at its seed ("historical preparation" read the seed, now, as started).
  assert.match(picker, /movedBakeRef\.current=\+d;/);
  assert.match(picker, /movedBakeRef\.current!==\+pendingEatTime&&\(\+pendingStart<=Date\.now\(\)/);
  // No plan at the requested bake: the bakes that fit alone (no card, no "past" line, no timeline).
  assert.match(picker, /const chipsAlone=eatTimeSet&&!currentCandidateValid&&mode!=='simple'&&!inputsOnly&&movedBakeRef\.current===\+pendingEatTime/);
  assert.match(picker, /\{startComputed && coherentTimes && !chipsAlone && \(\(\) => \{/);
  assert.match(picker, /yeastTooSlow&&yeastTiming&&!chipsAlone&&<div className="bh-plan-notice" data-yeast-too-slow/);
});

test('item 4: no "Use X%" that weighs what the calculated amount weighs', () => {
  // Thomas's 747 g of flour: 0.21 % and 0.22 % are both 1.6 g.
  assert.equal(formatYeastDose(747 * 0.21 / 100), formatYeastDose(747 * 0.22 / 100));
  assert.match(page, /const sameGrams=\(a:number,b:number\|null,flourG:number\|undefined\)=>/);
  assert.match(page, /sameGrams\(check\.suggestedShownPct,calcShown,recipe\?\.flour\)/);
  assert.match(page, /sameGrams\(prefIssue\.suggestedShownPct,calcShown,recipe\?\.preferment\?\.prefFlour\)/);
  assert.match(page, /weighs\(found, recipe\?\.flour\) === weighs\(calcDough, recipe\?\.flour\)/);
});

test('item 5: a method change after the recipe replans (Update recipe lands on the Recipe)', () => {
  assert.match(page, /if \(recipeGenerated && pt !== 'levain' && prefermentType !== 'levain' && yeastType !== 'sourdough'\) setPlanReplanPending\(true\);/);
});

test('item 6: a cool-spot biga suggestion passes the same window check as an entry', () => {
  assert.doesNotMatch(page, /ripensInWindow/);
  // Round 15 (item 3): one window check per storage: the stated storage's own window (prefermentYeastTiming), within the time left.
  assert.match(page, /const fitsShown=\(v:number\)=>\{const p=Math\.round\(v\/conversion\*10000\)\/10000;const t=prefermentYeastTiming\(pref,p,stated,prefYeastCtx\(pref,stated\)\);if\(!t\|\|t\.min>availableH\+1e-9\)return false;/);
});

test('item 7: a suggested amount has no night step when one exists', () => {
  // 0.03 % needs more than the time left; the suggestion's own plan has no night step.
  const o = b3('2026-11-27T19:30:00', 23, 0.146);
  const c = Y.checkYeastEntry(0.03, o);
  assert.equal(c.fits, false);
  assert.ok(c.suggestedShownPct !== null);
  // Round 17: night-free is read on the plan the amount gets (entryPlan, the plan shown).
  const plan = Y.entryPlan(c.suggestedShownPct, o);
  assert.ok(plan && plan.nightSteps.length === 0, JSON.stringify(plan?.nightSteps));
});

test('item 7: small texts and displays', () => {
  // "less yeast, longer rise" only when less than the calculated amount was entered.
  // Round 15: the calculated amount is derived for the current inputs (calcYeast).
  assert.match(page, /const lessDough = yeastPctOverride!==undefined&&calcYeast\?\.idyPct!==undefined&&yeastPctOverride<calcYeast\?\.idyPct-1e-9;/);
  assert.match(page, /'Your timing follows this amount\.'/);
  // A rise of a few minutes is not its own guide step.
  assert.match(guide, /const briefBulk = !isSourdough && schedule\.bulkFermHours < 0\.25/);
  assert.match(guide, /\{!briefBulk && <StepCard/);
  // A kept night step is named once, in the night line, not again on its row.
  // Round 15: the night line (kept or not) names those steps once.
  // Round 21 (rule E1): the busy tag reads the one edge rule (busyHit).
  assert.match(page, /busy:blocks\.some\(block=>busyHit\(\{id:e\.key\?\?'',at:e\.at\},\+block\.from,\+block\.to\)\)&&!\(entryNight&&coveredAt\.has\(\+e\.at\)/);
  // The plan begins at the starter's take-out (Preparation header and the Recipe's steps); the header is on the quarter hour.
  // Round 20 (item 4): the guide's starter events (a shared jar's feed included), on the shown quarter hour.
  assert.match(page, /guideStarterEvents\.filter\(e=>!e\.isPast && e\.kind!=='last_fed' && e\.kind!=='known_peak'\)\.map\(e=>\+starterStepShownTime\(e\)\)/);
  assert.match(page, /formatBakeDateTime\(roundToQuarter\(firstRecipeAction\),locale\)/);
});
