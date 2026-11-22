// Round 11 (22 Nov 2026): one plan for an entered amount (night line, picker, Recipe, Preparation), decision O1 (the
// baker's own nights read like the night rule), D2 (the knead stays near the calculated one), the biga doesn't-fit check,
// the time editor's ways on, Update recipe after a yeast-type change, preferment amounts within their readiness band.
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
const av = require('../app/utils/scheduleAvailability.ts');
const N = require('../app/utils/nightSteps.ts');
const P = require('../app/utils/prefermentYeast.ts');

const H = 3600000;
const SG = s => new Date(s + '+08:00');
const page = fs.readFileSync(path.join(__dirname, '../app/[locale]/page.tsx'), 'utf8');
const picker = fs.readFileSync(path.join(__dirname, '../app/components/SchedulePicker.tsx'), 'utf8');

// B3: 4 Neapolitan pizzas, 22 °C, Thu 19:30, bake Fri 11:30; the calculated plan kneads Thu 20:00 (15.5 h).
const now = +SG('2026-11-26T19:30:00'), lunch = SG('2026-11-27T11:30:00');
const thuNight = [{ label: 'Thursday night', from: SG('2026-11-26T23:00:00'), to: SG('2026-11-27T07:00:00') }];
const b3 = (blocks = [], extra = {}) => {
  const base = { bake: lunch, blocks, kitchenTemp: 22, preheatMin: 45, mixerType: 'hand', styleKey: 'neapolitan', numItems: 4, itemWeight: 260, mixingBatches: 1, fridgeTemp: 6, hydration: 65 };
  const calc = utils.buildSchedule(new Date(+lunch - 15.5 * H), lunch, blocks, 22, 45, 'hand', 'neapolitan', 4, 1, false, 1);
  const nightAllowed = [...new Set(av.newNightHandsOn(calc.availabilityActions, blocks).map(a => a.id))];
  return { ...base, now, conversion: 1, anchorH: 15.5, calculatedIdyPct: 0.19, roomPlans: true, nightAllowed, ...extra };
};
const actionsOf = (plan, o) => utils.buildSchedule(plan.times.start, o.bake, plan.blocks, o.kitchenTemp, o.preheatMin, o.mixerType, o.styleKey, o.numItems, o.mixingBatches, false, 1, plan.shape).availabilityActions;

test('item 1: the night line names the plan the picker applies, on the quarter-hour grid, one knead', () => {
  const o = b3();
  const plan = Y.entryPlan(0.1, o);
  assert.ok(plan && plan.nightSteps.length > 0);
  // The steps named are the plan's own (same builder): every one is an action of the saved plan.
  const acts = actionsOf(plan, o);
  for (const s of plan.nightSteps) assert.ok(acts.some(a => a.id === s.id && +a.at === +s.at), s.id);
  const line = N.nightStepsLine(plan.nightSteps, false);
  assert.doesNotMatch(line, /\d:(?!00|15|30|45)\d\d/, line);
  assert.ok((line.match(/Start Dough/g) ?? []).length <= 1, line);
  // Quarter hours as every planned time is shown; the kneading's later parts are the same Start Dough.
  const at = (h, m) => new Date(2026, 10, h < 12 ? 28 : 27, h, m);
  assert.equal(N.nightStepsLine([{ id: 'mix', at: at(22, 0) }, { id: 'mix-finish', at: at(22, 32) }, { id: 'fold-1', at: at(0, 10) }, { id: 'fold-2', at: at(0, 40) }], false),
    'This plan has Start Dough at 10:00pm, folds at 12:15am and 12:45am.');
  assert.equal(N.nightStepsLine([{ id: 'mix', at: at(22, 2) }, { id: 'mix-finish', at: at(22, 43) }], true), 'Ce planning a le pétrissage à 22h00.');
  // Start Dough before 22:00: its finish reads as what it is, not as Start Dough at another time.
  assert.equal(N.nightStepsLine([{ id: 'mix-finish', at: at(22, 17) }, { id: 'fold-1', at: at(23, 0) }], false), 'This plan has resume kneading at 10:15pm, a fold at 11:00pm.');
  // The picker applies the page's plan (one builder) and the page reads its night steps for the line.
  assert.match(picker, /const shared=planEntry\(candidateBlocks,pendingEatTime\);/);
  assert.match(page, /const steps = entryPlan\(effectiveYeastOverride, o\)\?\.nightSteps \?\? \[\];/);
  // The picker's own second (night) pass is gone.
  assert.doesNotMatch(picker, /entryNightOnRef/);
});

test('item 1: after Keep, the Recipe and Preparation name the kept night steps in one quiet line', () => {
  assert.match(page, /\{keptNightLine && <p data-kept-night/);
  assert.match(page, /nightLine=\{keptNightLine\}/);
  assert.match(page, /\{nightLine && <p data-kept-night/);
});

test('O1: steps in the nights the baker marked busy are named, never refused; the plan covers them; other busy times stay hard', () => {
  const o = b3(thuNight);
  const c = Y.checkYeastEntry(0.14, o);
  assert.equal(c.fits, true, JSON.stringify(c));
  const plan = Y.entryPlan(0.14, o);
  assert.ok(plan.nightSteps.length > 0);
  // Covered in the baker's night: the saved plan has no open clash.
  assert.ok(plan.blocks[0].coveredActions.length > 0);
  assert.equal(av.findAvailabilityConflicts(actionsOf(plan, o), plan.blocks, now).length, 0);
  // A bake saved before the night rule keeps its busy times hard.
  assert.equal(Y.entryPlan(0.14, { ...o, nightAllowed: undefined }), null);
  // Another busy time (not a night) stays hard: the amount is refused for it.
  const dinner = [{ label: 'Dinner', from: SG('2026-11-26T19:45:00'), to: SG('2026-11-27T10:00:00') }];
  const hard = b3(dinner, { bake: SG('2026-11-27T13:00:00') });
  const r = Y.checkYeastEntry(0.05, hard);
  assert.equal(r.fits, false);
  // Covers an earlier plan put on the nights are that plan's: the timing and search read the nights as set.
  assert.deepEqual(Y.entryPlan(0.14, { ...o, blocks: plan.blocks }).times, plan.times);
  assert.deepEqual(Y.uncovered(plan.blocks), thuNight);
});

test('I/D2: an entered amount keeps the knead near the calculated one when a plan exists there', () => {
  // B3 dinner: bake Fri 19:30, calculated knead Thu 20:30 (23 h); 0.1 % keeps it, the fridge absorbing it (±10 % band).
  const dinner = SG('2026-11-27T19:30:00');
  const o = { ...b3([], { bake: dinner, anchorH: 23, calculatedIdyPct: 0.16 }), nightAllowed: [] };
  const t = Y.entryTiming(0.1, o, (+dinner - now) / H);
  assert.equal(t.center, 23); assert.equal(t.shape.room, undefined);
  const plan = Y.entryPlan(0.1, o);
  assert.ok(Math.abs(+plan.times.start - (+dinner - 23 * H)) <= H, new Date(plan.times.start).toISOString());
  // A bake saved under way before the rules (no room plans) keeps the 5 % tolerance.
  const legacy = utils.enteredYeastTiming(0.1, { ...o, roomPlans: false, maxH: 24 });
  assert.notEqual(legacy?.center, 23);
});

test('item 2: a biga is judged on whether a complete plan exists at this bake, in setup and from My choices alike', () => {
  assert.match(page, /if\(leftH>=needH\(prefermentType\)&&prefPlanAtBake\)return null;/);
  assert.match(page, /blocks:\[\],kitchenTemp,fridgeTemp,styleKey,flourStrength,preheatMin:planPreheatMin,exitLeadMin,/);
  assert.match(page, /allowNight:true,type:prefermentType,storages:prefStoragesFor\(prefermentType\),from:eatTime,maxDays:0\}\);/);
  // A plan shown without a fit: the preferment within its storage's window and never before the next quarter hour.
  assert.match(picker, /function shownPrefHours\(hours:number,start:Date,inFridge:boolean\)/);
  assert.match(picker, /const held=shownPrefHours\(optimalPrefOffset,pendingStart,localPrefGoesInFridge\);/);
});

test('item 4: the time editor offers bakes that fit after a recipe too; "Change my busy times" only for busy times', () => {
  assert.match(picker, /if\(readinessUnsupported\|\|!!execution\|\|completedMixAt!==undefined\|\|\(eatTimeSet&&currentCandidateValid\)\)return \[\];/);
  assert.match(picker, /const busyCause=repairBlocks\.length>0&&/);
  assert.match(picker, /simpleDecisionPending \|\| !noticeAction \|\| !busyCause \? null : editAvailability/);
});

test('item 7: a yeast-type change re-derives the plan on the way back (Update recipe lands on the Recipe)', () => {
  assert.match(page, /if \(recipeGenerated\) setPlanReplanPending\(true\);\n    \}\n    setYeastType\(yt\);/);
});

test('item 8: a preferment amount fits when its readiness band meets the window (0.5 % poolish, 5 h 45 → 6 h)', () => {
  const ctx = { kitchenTemp: 22, fridgeTemp: 6, massG: 300 };
  const exact = P.prefermentHoursForYeast('poolish', 0.5 / 3, false, ctx);
  const t = P.prefermentYeastTiming('poolish', 0.5 / 3, false, ctx);
  if (exact < 6) { assert.ok(t, String(exact)); assert.equal(t.hours, 6); }
  // Far outside the band: still refused.
  assert.equal(P.prefermentYeastTiming('poolish', 2, false, ctx), null);
  // Round 13 (item 6): a cool-spot biga's suggestion passes the entry's own window check (round13.test.cjs); ripensInWindow is gone.
  assert.doesNotMatch(page, /const ripensInWindow=/);
  // The calculated amount is never offered twice (round 13, item 4: nor an amount weighing the same); the placeholder waits
  // for the replan; the cleared line ends with a new plan.
  assert.match(page, /const suggested=check\.reason!=='time'&&check\.suggestedShownPct!==null&&sameGrams\(check\.suggestedShownPct,calcShown,recipe\?\.flour\)\?null:check\.suggestedShownPct;/);
  assert.match(page, /planReplanPending && calculatedYeastRef\.current!==undefined \? calculatedYeastRef\.current\*conversion : shownPct/);
  assert.match(page, /useEffect\(\(\) => \{ setPrefYeastCleared\(null\); \}, \[acceptedPlan\]\);/);
});
