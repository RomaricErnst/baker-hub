import { enteredYeastTiming, fermentationWindowForYeast, roomPlanAllowed, ROOM_PLAN, ROOM_PLAN_MAX_H, type AvailabilityBlock, type EnteredYeastTiming, type PlanLadder, type PlanShape } from '../utils';
import type { MixerType } from '../data';
import { findFixedBakeSchedule, withNightRule, type EditInput, type EditTimes } from './scheduleEdit';

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
  /** Round 9 (bugs G, H): the night steps (newNightHandsOn ids) the calculated plan already has; an entered
   * amount's plan may add no other hands-on step between 22:00 and 07:00. Undefined: no night rule (a bake
   * saved before it). */
  nightAllowed?: string[];
}

/** Why an amount gives no plan: 'time' it needs longer than the time left; 'busy' every plan runs into the busy
 * times; 'night' every plan puts a new step between 22:00 and 07:00; 'fast' it rises faster than the dough's
 * steps take; 'plan' no plan fits before the bake (a preferment would have to start before now). */
export type YeastEntryReason = 'time' | 'busy' | 'night' | 'fast' | 'plan';
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

const timingInput = (o: YeastEntryInput) => ({ bake: o.bake, blocks: o.blocks, kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin, mixerType: o.mixerType,
  styleKey: o.styleKey, numItems: o.numItems, itemWeight: o.itemWeight, mixingBatches: o.mixingBatches,
  fridgeTemp: o.fridgeTemp, hydration: o.hydration, exitLeadMin: o.exitLeadMin, planLadder: o.planLadder, doughTempC: o.doughTempC });

const earliestOf = (now: number) => (Math.floor(now / QUARTER) + 1) * QUARTER;

/** The timing the plan uses for an entered dough yeast (IDY %): `enteredYeastTiming` near the calculated
 * plan's window, within `maxH` when given. Its shape is what every schedule of that plan is built with. */
export function entryTiming(idyPct: number, o: YeastEntryInput, maxH?: number): EnteredYeastTiming | null {
  return enteredYeastTiming(idyPct, { ...timingInput(o), anchorH: o.anchorH, roomPlans: o.roomPlans, ...(maxH !== undefined ? { maxH } : {}) });
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
 * against them), `allowNight` lifts the night rule. Both serve only to say why an amount has no plan. */
export interface EntrySearchMode { ignoreBlocks?: boolean; allowNight?: boolean }

/** The plan the search finds (its times and shape), or null. */
export function entryPlanSearch(idyPct: number | undefined, o: YeastEntryInput, prefOptions = o.preferment?.options, mode: EntrySearchMode = {}): { times: EditTimes; shape?: PlanShape; inFridge?: boolean } | null {
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
      isSourdough: false, id: 'mix', at: start, start, bake: o.bake, now, blocks: mode.ignoreBlocks ? [] : o.blocks, kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin,
      exitLeadMin: shape, planLadder: o.planLadder, mixerType: o.mixerType, styleKey: o.styleKey, numItems: o.numItems, mixingBatches: o.mixingBatches,
      prefHours: option?.prefHours ?? 0, hasPreferment: !!option, prefWindow: option?.prefWindow,
      prefWarmupHours: option?.warmupH ?? 0, prefCooldownHours: option?.cooldownH ?? 0, preferDaytime: true, supported: true, window,
      methodValid: times => !option || (o.preferment?.valid(times, option.inFridge) ?? true),
    };
    const input = o.nightAllowed && !mode.allowNight ? withNightRule(plain, o.nightAllowed, o.blocks) : plain;
    try {
      const found = findFixedBakeSchedule(input, {});
      if (found.found) return { times: found.candidate.times, shape, inFridge: option?.inFridge };
    } catch { /* no plan for this storage */ }
  }
  return null;
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
  const noWorse = (idy: number) => o.blocks.length > 0 && !(calcClear ??= entryPlanFound(undefined, o))
    && entryPlanSearch(idy, o, undefined, { ignoreBlocks: true }) !== null;
  const memo = new Map<number, boolean>();
  const plans = (idy: number) => { if (!memo.has(idy)) memo.set(idy, fitsTime(idy) && (entryPlanFound(idy, o) || noWorse(idy))); return memo.get(idy)!; };
  const enteredShown = Math.round(idyPct * o.conversion * 1000) / 1000;
  const calcShown = o.calculatedIdyPct !== undefined ? Math.round(o.calculatedIdyPct * o.conversion * 1000) / 1000 : undefined;
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
    let suggested = calcShown !== undefined && calcShown > enteredShown ? nearestFittingShownPct(enteredShown, calcShown, s => plans(toIdy(s))) : null;
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
  if (plans(idyPct)) return result(true, null, centerH, null);
  // Why, said honestly (round 9, bug D): busy times only when there are some and they are the reason.
  // A night the baker declared (their own ' night' block) is their busy time: steps in it are 'busy', not 'night'.
  const ownNight = o.blocks.some(block => block.label?.endsWith(' night'));
  const reason: YeastEntryReason = o.blocks.length > 0 && (entryPlanSearch(idyPct, o, undefined, { ignoreBlocks: true })
    || (ownNight && entryPlanSearch(idyPct, o, undefined, { ignoreBlocks: true, allowNight: true })))
    ? 'busy'
    : o.nightAllowed && entryPlanSearch(idyPct, o, undefined, { ignoreBlocks: true, allowNight: true }) ? 'night'
    : centerH !== null && centerH <= 2 + o.preheatMin / 60 + 0.25 ? 'fast' : 'plan';
  const suggested = calcShown === undefined || Math.abs(calcShown - enteredShown) < 0.0005 ? null : nearestFittingShownPct(enteredShown, calcShown, s => plans(toIdy(s)));
  return result(false, reason, null, suggested);
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
export const ENTRY_RULES = 2;

/** True when a restored bake keeps the entered-amount timing it was made with (room plans and the night rule
 * off): it was kept so already, or it was saved before them with an entered amount and is under way (its Start
 * Dough time has come, or a mix or preferment is recorded). A saved bake is never re-timed under the baker
 * (owner's principle, as legacyHotPlanFor). */
export function legacyEntryTimingFor(session: { entryRules?: number; legacyEntryTiming?: boolean; recipeGenerated?: boolean; startTime?: number | null;
  execution?: unknown; mixExecution?: unknown; yeastPctOverride?: number; prefYeastOverride?: unknown } | null | undefined, now: number): boolean {
  if (!session) return false;
  if (session.legacyEntryTiming === true) return true;
  if ((session.entryRules ?? 0) >= ENTRY_RULES || !session.recipeGenerated) return false;
  if (session.yeastPctOverride === undefined && !session.prefYeastOverride) return false;
  const start = typeof session.startTime === 'number' && Number.isFinite(session.startTime) ? session.startTime : Infinity;
  return start <= now || !!session.execution || !!session.mixExecution;
}

/** A saved list of night step ids (entryNightIds), else none. */
export function normalizeEntryNightIds(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? [...value] : undefined;
}
