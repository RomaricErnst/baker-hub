import { fermentationHoursForYeast, type AvailabilityBlock } from '../utils';
import type { MixerType } from '../data';

const HOUR = 3600000, QUARTER = 15 * 60000;
/** Largest IDY % the Fine-tune field accepts. */
export const MAX_ENTERED_IDY_PCT = 2;

export interface YeastEntryInput {
  bake: Date; now: number; blocks: AvailabilityBlock[]; kitchenTemp: number; preheatMin: number;
  mixerType: MixerType; styleKey: string; numItems: number; itemWeight: number;
  mixingBatches: number; fridgeTemp: number; hydration: number;
  /** Same multiplier the scheduler applies to the entered amount. */
  flourStrength: number;
  /** IDY → the baker's yeast (1 instant, 1.33 active dry, 3 fresh). */
  conversion: number;
}
export interface YeastEntryCheck {
  fits: boolean;
  /** Mix-to-bake hours the entered amount needs; null when longer than the engine plans (96 h). */
  neededH: number | null;
  /** Hours from the first plannable quarter hour to the bake. */
  availableH: number;
  /** Smallest amount in the baker's yeast that fits, rounded up; null when none does. */
  minimumShownPct: number | null;
}

/** Round a yeast % up to a step a baker can weigh and type: 0.01 below 1 %, 0.1 above. */
export function roundYeastPctUp(pct: number): number {
  const step = pct < 1 ? 0.01 : 0.1;
  return Math.round(Math.ceil(pct / step - 1e-9) * step * 100) / 100;
}

/** Whether a baker-entered yeast amount can ferment between now and the bake.
 * Timing comes from fermentationHoursForYeast, the inversion the scheduler
 * uses, so the check and the re-planned schedule agree. Preparation can start
 * at the next quarter hour, as the plan search allows. */
export function checkYeastEntry(idyPct: number, o: YeastEntryInput): YeastEntryCheck {
  const earliest = (Math.floor(o.now / QUARTER) + 1) * QUARTER;
  const availableH = (+o.bake - earliest) / HOUR;
  const timing = { bake: o.bake, blocks: o.blocks, kitchenTemp: o.kitchenTemp, preheatMin: o.preheatMin, mixerType: o.mixerType,
    styleKey: o.styleKey, numItems: o.numItems, itemWeight: o.itemWeight, mixingBatches: o.mixingBatches,
    fridgeTemp: o.fridgeTemp, hydration: o.hydration };
  const hoursFor = (idy: number) => fermentationHoursForYeast(idy * o.flourStrength, timing);
  const fitsFor = (idy: number) => { const h = hoursFor(idy); return h !== null && h <= availableH; };
  const neededH = hoursFor(idyPct);
  if (neededH !== null && neededH <= availableH) return { fits: true, neededH, availableH, minimumShownPct: null };
  if (!fitsFor(MAX_ENTERED_IDY_PCT)) return { fits: false, neededH, availableH, minimumShownPct: null };
  // More yeast is never slower: bisect on a log scale, then round up.
  let lo = Math.max(idyPct, 0.001), hi = MAX_ENTERED_IDY_PCT;
  for (let i = 0; i < 18; i++) {
    const mid = Math.sqrt(lo * hi);
    if (fitsFor(mid)) hi = mid; else lo = mid;
  }
  const maxShown = Math.round(MAX_ENTERED_IDY_PCT * o.conversion * 100) / 100;
  let shown = Math.min(maxShown, roundYeastPctUp(hi * o.conversion));
  // The field stores IDY to four decimals; keep the offer fitting after that rounding.
  while (shown < maxShown && !fitsFor(Math.round(shown / o.conversion * 10000) / 10000)) shown = roundYeastPctUp(shown + (shown < 1 ? 0.01 : 0.1));
  return { fits: false, neededH, availableH, minimumShownPct: shown };
}

/** Hours in the entry message: whole hours from 10 h, quarter hours below. */
export function entryHoursLabel(hours: number): number {
  return hours >= 10 ? Math.round(hours) : Math.max(0.25, Math.round(hours * 4) / 4);
}
