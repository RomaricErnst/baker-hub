import { enteredYeastTiming, fermentationWindowForYeast, type AvailabilityBlock, type EnteredYeastTiming, type PlanLadder, type PlanShape } from '../utils';
import type { MixerType } from '../data';
import { findFixedBakeSchedule, type EditInput, type EditTimes } from './scheduleEdit';

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
}

export type YeastEntryReason = 'time' | 'busy';
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
  return enteredYeastTiming(idyPct, { ...timingInput(o), anchorH: o.anchorH, ...(maxH !== undefined ? { maxH } : {}) });
}

/** The plan shape for an entered amount (buildSchedule's last argument); Bake again's lead without one. */
export function entryPlanShape(idyPct: number | undefined, o: YeastEntryInput): PlanShape | undefined {
  if (idyPct === undefined || !(idyPct > 0)) return o.exitLeadMin;
  return entryTiming(idyPct, o)?.shape ?? o.exitLeadMin;
}

/** Whether the planner's own search (findFixedBakeSchedule, the picker's fixed-bake search) finds a plan clear of
 * the busy times for this dough yeast (undefined: the calculated amount) and these preferment options. */
export function entryPlanFound(idyPct: number | undefined, o: YeastEntryInput, prefOptions = o.preferment?.options): boolean {
  return entryPlanSearch(idyPct, o, prefOptions) !== null;
}

/** The plan the search finds (its times and shape), or null. */
export function entryPlanSearch(idyPct: number | undefined, o: YeastEntryInput, prefOptions = o.preferment?.options): { times: EditTimes; shape?: PlanShape; inFridge?: boolean } | null {
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
    const input: EditInput = {
      isSourdough: false, id: 'mix', at: start, start, bake: o.bake, now, blocks: o.blocks, kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin,
      exitLeadMin: shape, planLadder: o.planLadder, mixerType: o.mixerType, styleKey: o.styleKey, numItems: o.numItems, mixingBatches: o.mixingBatches,
      prefHours: option?.prefHours ?? 0, hasPreferment: !!option, prefWindow: option?.prefWindow,
      prefWarmupHours: option?.warmupH ?? 0, prefCooldownHours: option?.cooldownH ?? 0, preferDaytime: true, supported: true, window,
      methodValid: times => !option || (o.preferment?.valid(times, option.inFridge) ?? true),
    };
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
  const memo = new Map<number, boolean>();
  const plans = (idy: number) => { if (!memo.has(idy)) memo.set(idy, fitsTime(idy) && entryPlanFound(idy, o)); return memo.get(idy)!; };
  const enteredShown = Math.round(idyPct * o.conversion * 1000) / 1000;
  const calcShown = o.calculatedIdyPct !== undefined ? Math.round(o.calculatedIdyPct * o.conversion * 1000) / 1000 : undefined;
  const result = (fits: boolean, reason: YeastEntryReason | null, neededH: number | null, suggested: number | null): YeastEntryCheck =>
    ({ fits, reason, neededH, availableH, suggestedShownPct: suggested, minimumShownPct: suggested !== null && suggested > enteredShown ? suggested : null });
  if (!fitsTime(idyPct)) {
    // The shortest window beyond the time left where the amount works (same inversion, unshaped beyond the anchor).
    const beyond = fermentationWindowForYeast(idyPct, { ...timingInput(o), nearH: availableH });
    const neededH = beyond && beyond.center > availableH ? beyond.center : null;
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
  if (entryPlanFound(idyPct, o)) return result(true, null, entryTiming(idyPct, o, availableH)?.center ?? null, null);
  // It fits the time but every plan runs into busy time. If the calculated amount has no clear plan either, the
  // entered one is no worse: it is applied (the planner then offers its usual ways on).
  if (calcShown === undefined || !entryPlanFound(undefined, o)) return result(true, null, entryTiming(idyPct, o, availableH)?.center ?? null, null);
  const suggested = Math.abs(calcShown - enteredShown) < 0.0005 ? null : nearestFittingShownPct(enteredShown, calcShown, s => plans(toIdy(s)));
  return result(false, 'busy', null, suggested);
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
