// A baker-entered preferment yeast (20 Nov 2026 round 7, owner): the poolish's or biga's yeast as
// IDY % of the PREFERMENT's flour (e.g. poolish 0.1 %, biga 1 %). It re-times the preferment phase by
// reading the yeast model backwards with the preferment's medium factor M (the same law and the same
// temperature path computePrefermentRecipe uses to dose a window, data.ts `prefermentPath`), so the
// amount shown and the hours planned agree by construction (CLAUDE.md "Baker overrides (Custom)").
import { PREFERMENT_TYPES, prefermentPath } from '../data';
import { heqForDose } from './yeastModel';

export type FlourPreferment = 'poolish' | 'biga';

export interface PrefermentYeastContext {
  kitchenTemp: number;
  fridgeTemp: number;
  /** Preferment mass (flour + water), g: sets its thermal time constant. */
  massG?: number;
  /** Warm-up after the fridge before the mix (fridge preferment), h. */
  warmupH?: number;
  /** Chill before the mix (room-temperature poolish in a warm kitchen), h. */
  cooldownH?: number;
}

/** The windows a preferment may take (CLAUDE.md Preferments): poolish 6–14 h at room temperature,
 * 12–24 h in the fridge (the planner's own fridge minimum); biga 12–72 h, always in the fridge. */
export function prefermentYeastBounds(type: FlourPreferment, inFridge: boolean): { min: number; max: number } {
  if (type === 'biga') return { min: 12, max: 72 };
  return inFridge ? { min: 12, max: 24 } : { min: 6, max: 14 };
}

/** Entry limits, IDY % of the preferment flour (same product range as the direct override, 0.02–2 %). */
export const PREF_YEAST_MIN_PCT = 0.02;
export const PREF_YEAST_MAX_PCT = 2;

/** Hours from making the preferment to its peak for a dose (IDY % of its flour): the inverse of the
 * peak dose computePrefermentRecipe gives a window, on the same temperature path and medium. Infinity
 * when no window up to 2,000 h reaches it. (poolishPeakHours in data.ts is the poolish case with its
 * own floors; this one also reads biga.) */
export function prefermentHoursForYeast(type: FlourPreferment, idyPct: number, inFridge: boolean, ctx: PrefermentYeastContext): number {
  if (!(idyPct > 0)) return Infinity;
  const medium = type === 'biga' ? 'biga' : 'poolish';
  const target = heqForDose(idyPct, medium);
  const hyd = PREFERMENT_TYPES[type].hydration;
  const massG = ctx.massG ?? 600;
  const cond = inFridge ? { warmupH: ctx.warmupH } : { cooldownH: ctx.cooldownH };
  const reached = (hours: number) => prefermentPath(hours, inFridge, ctx.kitchenTemp, ctx.fridgeTemp, massG, hyd, cond).heq;
  const floor = 0.25;
  if (reached(floor) >= target) return floor;
  let hi = 2 * floor;
  while (reached(hi) < target && hi < 2000) hi *= 2;
  if (reached(hi) < target) return Infinity;
  let lo = hi / 2;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (reached(mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

export interface PrefermentYeastTiming {
  inFridge: boolean;
  /** The planned preferment window, h (quarter hours). */
  hours: number;
  /** The readiness band, as for a direct override: where the entered dose meets 0.9–1.1 of the need. */
  min: number;
  max: number;
}

/** The timing of an entered dose in one storage, or null when its window falls outside the bounds. */
export function prefermentYeastTiming(type: FlourPreferment, idyPct: number, inFridge: boolean, ctx: PrefermentYeastContext): PrefermentYeastTiming | null {
  const bounds = prefermentYeastBounds(type, inFridge);
  const exact = prefermentHoursForYeast(type, idyPct, inFridge, ctx);
  if (!Number.isFinite(exact)) return null;
  const hours = Math.round(exact * 4) / 4;
  if (hours < bounds.min - 1e-9 || hours > bounds.max + 1e-9) return null;
  // need(h) falls with h: budget ≥ 0.9 from H(dose / 0.9), budget ≤ 1.1 up to H(dose / 1.1).
  const from = prefermentHoursForYeast(type, idyPct / 0.9, inFridge, ctx);
  const to = prefermentHoursForYeast(type, idyPct / 1.1, inFridge, ctx);
  const min = Math.max(bounds.min, Math.min(hours, Math.ceil(from * 4) / 4));
  const max = Math.min(bounds.max, Math.max(hours, Math.floor((Number.isFinite(to) ? to : bounds.max) * 4) / 4));
  return { inFridge, hours, min, max };
}

/** The storages an entered dose may use, best first: a fixed storage only itself; 'auto' the one the
 * planner would choose first, then the other. A biga is always in the fridge. */
export function prefermentYeastStorages(type: FlourPreferment, storage: 'auto' | 'fridge' | 'room', preferFridge: boolean): boolean[] {
  if (type === 'biga') return [true];
  if (storage === 'fridge') return [true];
  if (storage === 'room') return [false];
  return preferFridge ? [true, false] : [false, true];
}

/** The first storage whose window holds the entered dose (and, with `availableH`, fits the time left
 * before the mix), else why not. */
export function choosePrefermentYeastTiming(type: FlourPreferment, idyPct: number, storages: boolean[], ctx: PrefermentYeastContext, availableH = Infinity):
  { fits: true; timing: PrefermentYeastTiming } | { fits: false; reason: 'window' | 'time'; hours: number; inFridge: boolean } {
  let late: PrefermentYeastTiming | null = null;
  for (const inFridge of storages) {
    const timing = prefermentYeastTiming(type, idyPct, inFridge, ctx);
    if (!timing) continue;
    if (timing.min <= availableH + 1e-9) return { fits: true, timing };
    late ??= timing;
  }
  if (late) return { fits: false, reason: 'time', hours: late.min, inFridge: late.inFridge };
  const inFridge = storages[0];
  return { fits: false, reason: 'window', hours: prefermentHoursForYeast(type, idyPct, inFridge, ctx), inFridge };
}

/** The preferment's mass (flour + water) from the dough's, for the thermal time constant. */
export function prefermentMassG(type: FlourPreferment, doughMassG: number | undefined, hydrationPct: number | undefined, flourPct: number | undefined): number {
  const hyd = (hydrationPct ?? 65) / 100;
  const flour = (doughMassG ?? 1000) / (1 + hyd + 0.03);
  const prefFlour = flour * (flourPct ?? PREFERMENT_TYPES[type].flourPct) / 100;
  return prefFlour * (1 + PREFERMENT_TYPES[type].hydration / 100);
}

/** A saved preferment yeast (round 7): {type, pct} for a poolish or biga, else none. */
export function normalizePrefYeastOverride(value: unknown): {type:FlourPreferment;pct:number} | undefined {
  const v = value as {type?: unknown; pct?: unknown} | null | undefined;
  return v && (v.type === 'poolish' || v.type === 'biga') && typeof v.pct === 'number' && Number.isFinite(v.pct) && v.pct > 0 ? { type: v.type, pct: v.pct } : undefined;
}
