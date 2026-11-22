import { buildSchedule, enteredYeastTiming, fermentationWindowForYeast, roomPlanAllowed, ROOM_PLAN, ROOM_PLAN_MAX_H, type AvailabilityBlock, type EnteredYeastTiming, type PlanLadder, type PlanShape } from '../utils';
import type { MixerType } from '../data';
import { findFixedBakeSchedule, withNightRule, prefermentConditioningAction, type EditInput, type EditTimes } from './scheduleEdit';
import { findAvailabilityConflicts, newNightHandsOn, nightScore, type AvailabilityAction } from './scheduleAvailability';

const HOUR = 3600000, QUARTER = 15 * 60000;
/** Largest IDY % the Fine-tune field accepts. */
export const MAX_ENTERED_IDY_PCT = 2;

/** One storage a preferment may take in the plan search (the picker's commercialCandidateInput). */
export interface PrefermentPlanOption {
  inFridge: boolean;
  /** Hours the planner may give the preferment (an entered amount's readiness band, else the planner's window). */
  prefWindow: { min: number; max: number };
  /** The window it aims for (the planner's target, or the entered amount's hours). */
  prefHours: number;
  warmupH: number;
  cooldownH: number;
}

export interface YeastEntryInput {
  bake: Date; now: number; blocks: AvailabilityBlock[]; kitchenTemp: number; preheatMin: number;
  mixerType: MixerType; styleKey: string; numItems: number; itemWeight: number;
  mixingBatches: number; fridgeTemp: number; hydration: number;
  /** Bake again's fridge-exit lead (minutes); an entered amount's fit replaces it. */
  exitLeadMin?: number;
  /** One-trip ladder scope the plan is built with (buildSchedule planLadder), as the picker passes it. */
  planLadder?: PlanLadder;
  /** Dough temperature at the mix (°C), as the picker passes it. */
  doughTempC?: number;
  /** IDY → the baker's yeast (1 instant, 1.33 active dry, 3 fresh). */
  conversion: number;
  /** The calculated plan's mix-to-bake hours (round 8, D2): the knead stays near it. */
  anchorH?: number;
  /** The calculated dough yeast (IDY %): what a suggestion moves towards. */
  calculatedIdyPct?: number;
  /** The planner's mix window without an entered amount (hours before the bake), as the picker reads it. */
  defaultWindow?: (bake: Date) => { from: number | null; to: number | null };
  /** A poolish or biga: its storages and the planner's own validity rule (commercialPrefermentPlanValid). */
  preferment?: { options: PrefermentPlanOption[]; valid: (times: EditTimes, inFridge: boolean) => boolean };
  /** Round 9 (bug I): the timing also reads room-temperature plans (enteredYeastTiming roomPlans); off for a
   * bake saved under way before it (legacyEntryTiming), which keeps its plan. */
  roomPlans?: boolean;
  /** Round 9 (bugs G, H; owner 22 Nov 2026): the night steps (newNightHandsOn ids) the calculated plan already has.
   * An entered amount's plan avoids any other hands-on step between 22:00 and 07:00 when it can; when it cannot,
   * the amount is still planned and `checkYeastEntry` says so (`nightSteps`). Undefined: no night rule (a bake
   * saved before it). */
  nightAllowed?: string[];
  /** The entered-amount rules a bake under way was saved with when older than ENTRY_RULES (`keptEntryRulesFor`): 2 keeps
   * the round-9 fit (no proof fit, no night ranking in the timing). Undefined: the current rules. */
  rules?: number;
  /** A poolish or biga's hours before the mix (the plan's), so the timing's night ranking counts its start; the page's
   * shape and `entryPlan` read the same value. */
  prefStartH?: number;
}

/** Why an amount gives no plan: 'time' it needs longer than the time left; 'busy' every plan runs into the busy
 * times; 'fast' it rises faster than the dough's steps take; 'plan' no plan fits before the bake (a preferment
 * would have to start before now). Night steps are never a reason (owner, 22 Nov 2026): see `nightSteps`. */
export type YeastEntryReason = 'time' | 'busy' | 'fast' | 'plan';
export interface YeastEntryCheck {
  fits: boolean;
  /** Why it does not fit: 'time' (it needs longer than the time left), 'busy' (no plan clear of the busy times). */
  reason: YeastEntryReason | null;
  /** Mix-to-bake hours the entered amount needs (the shortest window beyond the time left); null when longer than 96 h. */
  neededH: number | null;
  /** Hours from the first plannable quarter hour to the bake. */
  availableH: number;
  /** The amount nearest the entered one that gives a plan, in the baker's yeast; null when none does. */
  suggestedShownPct: number | null;
  /** The suggestion when it is more yeast (kept for older callers). */
  minimumShownPct: number | null;
  /** It fits, but every plan adds a hands-on step between 22:00 and 07:00 beyond the calculated plan's: it is
   * planned anyway and the page names those steps (owner, 22 Nov 2026). */
  nightSteps?: boolean;
  /** With `nightSteps`, the amount nearest the entered one, towards the calculated one, whose plan has none. */
  nightFreeShownPct?: number | null;
}

/** Round a yeast % up to a step a baker can weigh and type: 0.01 below 1 %, 0.1 above. */
export function roundYeastPctUp(pct: number): number {
  const step = pct < 1 ? 0.01 : 0.1;
  return Math.round(Math.ceil(pct / step - 1e-9) * step * 100) / 100;
}
/** Round a yeast % down to the same steps. */
export function roundYeastPctDown(pct: number): number {
  const step = pct < 1 ? 0.01 : 0.1;
  return Math.round(Math.floor(pct / step + 1e-9) * step * 100) / 100;
}

/** Busy times as the baker set them: steps a plan's covers took on (yeastEntry `entryPlan`, "I'll handle these
 * steps") are that plan's decisions, not the amount's timing, so every reader times the amount alike (round 11). */
export const uncovered = (blocks: AvailabilityBlock[]) => blocks.map(b => {
  if (!b.coveredActions) return b;
  const { coveredActions, ...rest } = b; void coveredActions;
  return rest as AvailabilityBlock;
});
const timingInput = (o: YeastEntryInput) => ({ bake: o.bake, blocks: uncovered(o.blocks), kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin, mixerType: o.mixerType,
  styleKey: o.styleKey, numItems: o.numItems, itemWeight: o.itemWeight, mixingBatches: o.mixingBatches,
  fridgeTemp: o.fridgeTemp, hydration: o.hydration, exitLeadMin: o.exitLeadMin, planLadder: o.planLadder, doughTempC: o.doughTempC });

const earliestOf = (now: number) => (Math.floor(now / QUARTER) + 1) * QUARTER;

/** The timing the plan uses for an entered dough yeast (IDY %): `enteredYeastTiming` near the calculated
 * plan's window, within `maxH` when given. Its shape is what every schedule of that plan is built with. */
export function entryTiming(idyPct: number, o: YeastEntryInput, maxH?: number): EnteredYeastTiming | null {
  return enteredYeastTiming(idyPct, { ...timingInput(o), anchorH: o.anchorH, roomPlans: o.roomPlans, rules: o.rules, prefStartH: o.prefStartH, ...(maxH !== undefined ? { maxH } : {}) });
}

/** The plan shape for an entered amount (buildSchedule's last argument); Bake again's lead without one. Read
 * as the picker reads it: within the time left first (round 9), else the amount's own window. */
export function entryPlanShape(idyPct: number | undefined, o: YeastEntryInput): PlanShape | undefined {
  if (idyPct === undefined || !(idyPct > 0)) return o.exitLeadMin;
  const left = Math.max(0, (+o.bake - o.now) / HOUR);
  const timing = (o.now > 0 ? entryTiming(idyPct, o, left) : null) ?? entryTiming(idyPct, o);
  return timing?.shape ?? o.exitLeadMin;
}

/** Whether the planner's own search (findFixedBakeSchedule, the picker's fixed-bake search) finds a plan clear of
 * the busy times for this dough yeast (undefined: the calculated amount) and these preferment options. */
export function entryPlanFound(idyPct: number | undefined, o: YeastEntryInput, prefOptions = o.preferment?.options): boolean {
  return entryPlanSearch(idyPct, o, prefOptions) !== null;
}

/** How the search is read: `ignoreBlocks` plans as if the baker had no busy time (the night is still read
 * against them); `softNights` lifts the night rule and reads the baker's own nights as free (decision O1: an
 * entered amount's night steps are named, never refused). */
export interface EntrySearchMode { ignoreBlocks?: boolean; softNights?: boolean; /** Only plans kneaded at this time. */ mix?: Date }

/** The baker's own nights (the Nights preset: blocks labelled "… night"). */
export const isNightBlock = (block: { label?: string }) => !!block.label?.endsWith(' night');

/** The plan the search finds (its times and shape), or null. */
export function entryPlanSearch(idyPct: number | undefined, o: YeastEntryInput, prefOptions = o.preferment?.options, mode: EntrySearchMode = {}): { times: EditTimes; shape?: PlanShape; inFridge?: boolean; window: { from: Date | null; to: Date | null } } | null {
  const now = o.now;
  const timingAt = (bake: Date): EnteredYeastTiming | null => idyPct === undefined ? null
    : entryTiming(idyPct, { ...o, bake }, Math.max(0, (+bake - now) / HOUR));
  const own = timingAt(o.bake);
  if (idyPct !== undefined && !own) return null;
  const shape = own?.shape ?? o.exitLeadMin;
  const window = (bake: Date) => {
    const t = idyPct === undefined ? null : +bake === +o.bake ? own : timingAt(bake);
    const hours = t ? { from: t.from, to: t.to } : idyPct === undefined ? o.defaultWindow?.(bake) ?? null : null;
    return { from: hours?.from != null ? new Date(+bake - hours.from * HOUR) : null, to: hours?.to != null ? new Date(+bake - hours.to * HOUR) : null };
  };
  const seedH = own?.center ?? o.anchorH ?? o.defaultWindow?.(o.bake)?.from ?? 12;
  const start = new Date(Math.round((+o.bake - seedH * HOUR) / QUARTER) * QUARTER);
  const options: (PrefermentPlanOption | null)[] = prefOptions?.length ? prefOptions : [null];
  for (const option of options) {
    const plain: EditInput = {
      isSourdough: false, id: 'mix', at: start, start, bake: o.bake, now, blocks: mode.ignoreBlocks ? [] : mode.softNights ? o.blocks.filter(b => !isNightBlock(b)) : o.blocks, kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin,
      exitLeadMin: shape, planLadder: o.planLadder, mixerType: o.mixerType, styleKey: o.styleKey, numItems: o.numItems, mixingBatches: o.mixingBatches,
      prefHours: option?.prefHours ?? 0, hasPreferment: !!option, prefWindow: option?.prefWindow,
      prefWarmupHours: option?.warmupH ?? 0, prefCooldownHours: option?.cooldownH ?? 0, preferDaytime: true, supported: true, window,
      methodValid: times => !option || (o.preferment?.valid(times, option.inFridge) ?? true),
    };
    const input = o.nightAllowed && !mode.softNights ? withNightRule(plain, o.nightAllowed, o.blocks) : plain;
    try {
      const found = findFixedBakeSchedule(input, mode.mix ? { mix: mode.mix } : {});
      if (found.found) return { times: found.candidate.times, shape, inFridge: option?.inFridge, window: window(o.bake) };
    } catch { /* no plan for this storage */ }
  }
  return null;
}

/** The plan an entered amount gets (round 11: one builder for the night line, the picker, the Recipe and Preparation).
 * The plan clear of every busy time and without a new night step when there is one; else (owner, 22 Nov 2026, and
 * decision O1) the plan with night steps, the baker's own nights included: the steps it puts in those nights are
 * covered in the blocks it returns (as "I'll handle these steps" covers them), so the plan is complete as saved.
 * Other busy times stay hard. `nightSteps`: the hands-on steps between 22:00 and 07:00 beyond the calculated plan's. */
export interface EntryPlan { times: EditTimes; shape?: PlanShape; inFridge?: boolean; blocks: AvailabilityBlock[]; nightSteps: AvailabilityAction[];
  /** The mix window the plan was found in (the amount's readiness band at this bake). */
  window: { from: Date | null; to: Date | null } }
export function entryPlan(idyPct: number | undefined, o: YeastEntryInput): EntryPlan | null {
  // Covers this builder put on the nights earlier belong to an earlier plan: read the nights as the baker set them.
  const blocks = o.blocks.map(b => isNightBlock(b) && b.coveredActions ? uncovered([b])[0] : b);
  const input = { ...o, blocks };
  const strict = entryPlanSearch(idyPct, input);
  const anchorMs = idyPct !== undefined && o.anchorH !== undefined ? +o.bake - o.anchorH * HOUR : null;
  const distance = (p: { times: EditTimes }) => anchorMs === null ? 0 : Math.abs(+p.times.start - anchorMs);
  if (strict && (!o.nightAllowed || distance(strict) <= HOUR)) return { ...strict, blocks, nightSteps: [] };
  if (!o.nightAllowed) return null;
  // Round 13 (owner): among the plans for the amount — the night-free one, the one at the calculated knead and the
  // search's own with night steps — the fewest new night hands-on steps, then the knead nearest the calculated one
  // (B3's 0.14 % at lunch: Thu 8:00pm with the fridge, not 1:45am with four folds).
  const nightStepsOf = (p: { times: EditTimes; shape?: PlanShape; inFridge?: boolean }) =>
    newNightHandsOn(entryPlanActions(p, input), blocks).filter(a => !o.nightAllowed!.includes(a.id) && +a.at > o.now);
  const candidates = [strict,
    anchorMs !== null ? entryPlanSearch(idyPct, input, undefined, { softNights: true, mix: new Date(Math.round(anchorMs / QUARTER) * QUARTER) }) : null,
    entryPlanSearch(idyPct, input, undefined, { softNights: true })]
    .filter((p): p is NonNullable<typeof p> => !!p).map(p => ({ p, night: p === strict ? [] : nightStepsOf(p) }));
  if (!candidates.length) return null;
  // A step between 23:00 and 06:00 (a wake-up) outweighs any number of shoulder steps (nightScore).
  const score = (c: { night: AvailabilityAction[] }) => nightScore(c.night, blocks);
  candidates.sort((a, b) => score(a) - score(b) || distance(a.p) - distance(b.p));
  const { p: soft, night: nightSteps } = candidates[0];
  if (soft === strict) return { ...strict, blocks, nightSteps: [] };
  const actions = entryPlanActions(soft, input);
  const covered = blocks.map(b => {
    if (!isNightBlock(b)) return b;
    const hits = findAvailabilityConflicts(actions, [b]).map(c => c.action);
    return hits.length ? { ...b, coveredActions: hits.map(a => ({ id: a.id, at: +a.at, ...(a.end ? { end: +a.end } : {}) })) } : b;
  });
  return { ...soft, blocks: covered, nightSteps };
}

/** The hands-on steps of a found plan, its preferment start included (as the night rule reads them). */
export function entryPlanActions(plan: { times: EditTimes; shape?: PlanShape; inFridge?: boolean }, o: YeastEntryInput): AvailabilityAction[] {
  const s = buildSchedule(plan.times.start, plan.times.bake, o.blocks, o.kitchenTemp, o.preheatMin, o.mixerType, o.styleKey, o.numItems, o.mixingBatches, false, 1, plan.shape, o.planLadder);
  const option = o.preferment?.options.find(p => p.inFridge === plan.inFridge);
  const pref: AvailabilityAction[] = o.preferment && plan.times.prefHours > 0 ? [{ id: 'preferment', at: new Date(+plan.times.start - plan.times.prefHours * HOUR) }] : [];
  const conditioning = option ? prefermentConditioningAction({ prefWarmupHours: option.warmupH, prefCooldownHours: option.cooldownH }, plan.times.start) : null;
  return [...(s.availabilityActions ?? []), ...pref, ...(conditioning ? [conditioning] : [])];
}

/** The amount nearest `entered` (shown in the baker's yeast) towards `reference` for which `fits` holds, on the
 * 0.01 / 0.1 steps a baker types; null when not even the reference fits. More yeast rounds up, less rounds down. */
export function nearestFittingShownPct(entered: number, reference: number, fits: (shownPct: number) => boolean): number | null {
  const up = reference > entered;
  const round = up ? roundYeastPctUp : roundYeastPctDown;
  if (!fits(reference)) return null;
  let lo = entered, hi = reference; // lo never fits, hi fits
  for (let i = 0; i < 9; i++) {
    const mid = Math.sqrt(lo * hi);
    if (fits(round(mid))) hi = mid; else lo = mid;
  }
  let shown = round(hi);
  // Keep the offer fitting after rounding; step towards the reference when it does not.
  for (let guard = 0; guard < 40 && !fits(shown) && (up ? shown < reference : shown > reference); guard++)
    shown = up ? roundYeastPctUp(shown + (shown < 1 ? 0.01 : 0.1)) : roundYeastPctDown(shown - (shown <= 1 ? 0.01 : 0.1));
  if (!fits(shown)) shown = reference;
  return Math.round(shown * 1000) / 1000;
}

/** Whether a baker-entered dough yeast (IDY %) gives a plan, judged on the paths the plan uses: the same timing
 * (`entryTiming`: the fridge absorbing the difference near the calculated plan's knead, else the established
 * inversion) and the same search as the picker (`entryPlanFound`), so a statement and the re-timed plan agree.
 * When it does not, the nearest amount that does, towards the calculated one (else, for a slow amount, up to the
 * field's maximum). */
export function checkYeastEntry(idyPct: number, o: YeastEntryInput): YeastEntryCheck {
  const availableH = (+o.bake - earliestOf(o.now)) / HOUR;
  const toIdy = (shown: number) => Math.round(shown / o.conversion * 10000) / 10000;
  const fitsTime = (idy: number) => entryTiming(idy, o, availableH) !== null;
  // When the calculated amount has no clear plan either, an entered one is no worse if it plans once the busy
  // times are set aside (the night rule still holds): it is applied and the planner offers its usual ways on.
  let calcClear: boolean | undefined;
  // Night steps never refuse an amount (owner, 22 Nov 2026): every check below lifts the night rule; only the
  // night-free search says whether the plan has new night steps.
  // Decision O1 (22 Nov 2026): the baker's own nights are read like the night rule for an entered amount (steps in
  // them are named, never a refusal); other busy times stay hard.
  // A bake saved before the night rule (no `nightAllowed`) keeps its busy times hard, as the picker plans it.
  const loose: EntrySearchMode = o.nightAllowed ? { softNights: true } : {};
  const noWorse = (idy: number) => o.blocks.length > 0 && !(calcClear ??= entryPlanSearch(undefined, o, undefined, loose) !== null)
    && entryPlanSearch(idy, o, undefined, { ...loose, ignoreBlocks: true }) !== null;
  const memo = new Map<number, boolean>();
  const plans = (idy: number) => { if (!memo.has(idy)) memo.set(idy, fitsTime(idy) && (entryPlanSearch(idy, o, undefined, loose) !== null || noWorse(idy))); return memo.get(idy)!; };
  const enteredShown = Math.round(idyPct * o.conversion * 1000) / 1000;
  const calcShown = o.calculatedIdyPct !== undefined ? Math.round(o.calculatedIdyPct * o.conversion * 1000) / 1000 : undefined;
  // Round 13 (item 7): a suggestion is an amount whose own plan has no new night step when one exists (0.03 % was told
  // "0.05 % fits" and 0.05 % needed a night fold); else the nearest that plans, whose night steps Fine-tune names.
  const nightFree = (idy: number) => plans(idy) && (!o.nightAllowed || entryPlanFound(idy, o) || noWorse(idy));
  const nearest = (from: number, to: number) => nearestFittingShownPct(from, to, s => nightFree(toIdy(s))) ?? nearestFittingShownPct(from, to, s => plans(toIdy(s)));
  const result = (fits: boolean, reason: YeastEntryReason | null, neededH: number | null, suggested: number | null): YeastEntryCheck =>
    ({ fits, reason, neededH, availableH, suggestedShownPct: suggested, minimumShownPct: suggested !== null && suggested > enteredShown ? suggested : null });
  if (!fitsTime(idyPct)) {
    // The shortest window beyond the time left where the amount works, on the engine's plans and (round 9) on
    // the room-temperature plans the timing also reads.
    const beyondOf = (shape?: PlanShape) => fermentationWindowForYeast(idyPct, { ...timingInput(o), ...(shape ? { exitLeadMin: shape, maxH: ROOM_PLAN_MAX_H } : {}), nearH: availableH });
    const centers = [beyondOf(), ...(o.roomPlans && roomPlanAllowed(o.styleKey) ? [beyondOf(ROOM_PLAN)] : [])]
      .map(w => w?.center).filter((h): h is number => h !== undefined && h > availableH);
    const neededH = centers.length ? Math.min(...centers) : null;
    // A slow amount: towards the calculated one when it plans, else up to the field's maximum.
    const maxShown = Math.round(MAX_ENTERED_IDY_PCT * o.conversion * 100) / 100;
    let suggested = calcShown !== undefined && calcShown > enteredShown ? nearest(enteredShown, calcShown) : null;
    if (suggested === null) {
      // The smallest amount that fits the time, then up the typing steps to the first that gives a plan.
      let shown = nearestFittingShownPct(enteredShown, maxShown, s => fitsTime(toIdy(s)));
      for (let guard = 0; shown !== null && guard < 30 && !plans(toIdy(shown)); guard++)
        shown = shown >= maxShown ? null : Math.min(maxShown, roundYeastPctUp(shown + (shown < 1 ? 0.01 : 0.1)));
      suggested = shown;
    }
    return result(false, 'time', neededH, suggested);
  }
  const centerH = entryTiming(idyPct, o, availableH)?.center ?? null;
  if (plans(idyPct)) {
    if (!o.nightAllowed || entryPlanFound(idyPct, o) || noWorse(idyPct)) return result(true, null, centerH, null);
    return { ...result(true, null, centerH, null), nightSteps: true, nightFreeShownPct: nightFreeShownPct(idyPct, o) };
  }
  // Why, said honestly (round 9, bug D): busy times only when there are some and they are the reason.
  // A night the baker declared (their own ' night' block) is their busy time: steps in it are 'busy'.
  const reason: YeastEntryReason = o.blocks.length > 0 && entryPlanSearch(idyPct, o, undefined, { ...loose, ignoreBlocks: true })
    ? 'busy'
    : centerH !== null && centerH <= 2 + o.preheatMin / 60 + 0.25 ? 'fast' : 'plan';
  const suggested = calcShown === undefined || Math.abs(calcShown - enteredShown) < 0.0005 ? null : nearest(enteredShown, calcShown);
  return result(false, reason, null, suggested);
}

/** The amount nearest an entered dough yeast (IDY %), shown in the baker's yeast, towards the calculated one, whose
 * plan has no new night step (the night-free search within the time left); null when not even the calculated one. */
export function nightFreeShownPct(idyPct: number, o: YeastEntryInput): number | null {
  const availableH = (+o.bake - earliestOf(o.now)) / HOUR;
  const enteredShown = Math.round(idyPct * o.conversion * 1000) / 1000;
  const calcShown = o.calculatedIdyPct !== undefined ? Math.round(o.calculatedIdyPct * o.conversion * 1000) / 1000 : undefined;
  if (calcShown === undefined || Math.abs(calcShown - enteredShown) < 0.0005) return null;
  const toIdy = (shown: number) => Math.round(shown / o.conversion * 10000) / 10000;
  return nearestFittingShownPct(enteredShown, calcShown, v => entryTiming(toIdy(v), o, availableH) !== null && entryPlanFound(toIdy(v), o));
}

/** Hours in the entry message: whole hours from 10 h, quarter hours below. */
export function entryHoursLabel(hours: number): number {
  return hours >= 10 ? Math.round(hours) : Math.max(0.25, Math.round(hours * 4) / 4);
}

/** A duration in baker time (S2): "11 h 45", "36 h", "45 min" (FR « 11 h 45 », « 36 h »); whole hours from 10 h. */
export function bakerHours(hours: number): string {
  const total = Math.max(15, Math.round(entryHoursLabel(hours) * 60 / 15) * 15);
  const h = Math.floor(total / 60), m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** A percentage with the locale's separator: "0.1%" / « 0,1 % ». */
export function bakerPct(value: number, fr: boolean): string {
  const n = Math.round(value * 1000) / 1000;
  return fr ? `${String(n).replace('.', ',')} %` : `${n}%`;
}

/** A typed decimal in either separator ("0,1" or "0.1" → 0.1); NaN when it is not a number. Empty → NaN. */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

/** A value for a decimal box in the locale's separator ("0.15" / « 0,15 »). */
export function formatDecimal(value: number, fr: boolean): string {
  const s = String(Math.round(value * 1000) / 1000);
  return fr ? s.replace('.', ',') : s;
}

/** Round 9 rules for a baker-entered amount: the timing also reads room-temperature plans, and its plan adds
 * no night step. Sessions saved since carry `entryRules` = ENTRY_RULES. */
export const ENTRY_RULES = 3;
/** The round-9 rules (room plans, the night rule): bakes saved with them are not legacy (`legacyEntryTimingFor`). */
const ROOM_PLAN_RULES = 2;

/** True when a restored bake keeps the entered-amount timing it was made with (room plans and the night rule
 * off): it was kept so already, or it was saved before them with an entered amount and is under way (its Start
 * Dough time has come, or a mix or preferment is recorded). A saved bake is never re-timed under the baker
 * (owner's principle, as legacyHotPlanFor). */
export function legacyEntryTimingFor(session: { entryRules?: number; legacyEntryTiming?: boolean; recipeGenerated?: boolean; startTime?: number | null;
  execution?: unknown; mixExecution?: unknown; yeastPctOverride?: number; prefYeastOverride?: unknown } | null | undefined, now: number): boolean {
  if (!session) return false;
  if (session.legacyEntryTiming === true) return true;
  if ((session.entryRules ?? 0) >= ROOM_PLAN_RULES || !session.recipeGenerated) return false;
  if (session.yeastPctOverride === undefined && !session.prefYeastOverride) return false;
  const start = typeof session.startTime === 'number' && Number.isFinite(session.startTime) ? session.startTime : Infinity;
  return start <= now || !!session.execution || !!session.mixExecution;
}

/** The rules a restored bake keeps (round 13, owner: a saved bake is never re-timed): a bake saved with the round-9
 * rules (entryRules 2) and an entered amount, under way (its Start Dough time has come, or a mix or preferment is
 * recorded), keeps them (`entryRulesKept` once saved so); else undefined (the current rules, or legacyEntryTimingFor). */
export function keptEntryRulesFor(session: { entryRules?: number; entryRulesKept?: number; recipeGenerated?: boolean; startTime?: number | null;
  execution?: unknown; mixExecution?: unknown; yeastPctOverride?: number; prefYeastOverride?: unknown } | null | undefined, now: number): number | undefined {
  if (!session) return undefined;
  if (session.entryRulesKept === ROOM_PLAN_RULES) return ROOM_PLAN_RULES;
  if (session.entryRules !== ROOM_PLAN_RULES || !session.recipeGenerated) return undefined;
  if (session.yeastPctOverride === undefined && !session.prefYeastOverride) return undefined;
  const start = typeof session.startTime === 'number' && Number.isFinite(session.startTime) ? session.startTime : Infinity;
  return start <= now || !!session.execution || !!session.mixExecution ? ROOM_PLAN_RULES : undefined;
}

/** A saved list of night step ids (entryNightIds), else none. */
export function normalizeEntryNightIds(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? [...value] : undefined;
}

/** The amounts whose night steps the baker kept (entryNightKept), else none. */
export function normalizeEntryNightKept(value: unknown): { yeast?: number; pref?: { type: 'poolish' | 'biga'; pct: number } } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as { yeast?: unknown; pref?: { type?: unknown; pct?: unknown } };
  const yeast = typeof v.yeast === 'number' && Number.isFinite(v.yeast) ? v.yeast : undefined;
  const pref = v.pref && (v.pref.type === 'poolish' || v.pref.type === 'biga') && typeof v.pref.pct === 'number' && Number.isFinite(v.pref.pct) ? { type: v.pref.type as 'poolish' | 'biga', pct: v.pref.pct as number } : undefined;
  return yeast === undefined && !pref ? undefined : { ...(yeast !== undefined ? { yeast } : {}), ...(pref ? { pref } : {}) };
}
