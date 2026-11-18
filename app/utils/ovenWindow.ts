// How long a bake keeps the oven busy, and two bakes on one device that need the same oven at once
// (18 Nov 2026 retention round 3). Planning allowances, not measurements.
import { breadActiveCookMinutes } from './breadProfiles';

const QUARTER = 15 * 60000;
const roundUpToQuarter = (ms: number) => Math.ceil(ms / QUARTER) * QUARTER;

/** Minutes from the first piece in to the last one out. Pizzas in a home oven bake one at a time
 *  (the guide's "about 8–12 min each", with a few minutes for the surface to reheat between two);
 *  a pizza oven takes a couple of minutes each; a loaf bake is about 45 min. */
export function ovenBusyMinutes(bakeType: string | null | undefined, styleKey: string | null | undefined, numItems: number, ovenType: string | null | undefined): number {
  const count = Math.max(1, Math.ceil(Number.isFinite(numItems) ? numItems : 1));
  const griddle = breadActiveCookMinutes(styleKey ?? '', count);
  if (griddle) return griddle;
  if (bakeType === 'pizza') {
    if (ovenType === 'pizza_oven' || ovenType === 'electric_pizza') return count * 2;
    const each = ovenType === 'home_oven_steel' ? 7 : 12;
    return count * each + (count - 1) * 3;
  }
  return 45;
}

/** When the last piece comes out, on the plan's 15-minute grid; null when it is one short bake. */
export function bakeEndAt(bakeAt: number, busyMinutes: number): number | null {
  if (busyMinutes < 30) return null;
  return roundUpToQuarter(bakeAt + busyMinutes * 60000);
}

export interface OvenUse { id: string; from: number; to: number; ovenType: string | null; name?: string }

/** One oven at home: every home-oven setup (tray, stone, steel, Dutch oven) shares it; a pizza oven is its own. */
export function sameOven(a: string | null | undefined, b: string | null | undefined): boolean {
  const home = (oven: string | null | undefined) => !oven || oven.startsWith('home_oven') || oven === 'dutch_oven' || oven === 'steam_oven';
  return home(a) && home(b) ? true : a === b;
}

/** The other bake already using this oven during [from, to); edges exclusive, as busy blocks are. */
export function ovenClash(current: Omit<OvenUse, 'id'>, others: readonly OvenUse[]): OvenUse | null {
  return others.find(other => sameOven(current.ovenType, other.ovenType) && current.from < other.to && other.from < current.to) ?? null;
}

/** The shift (ms, later, on the 15-minute grid) after which this bake's oven time overlaps none of the others. */
export function nextFreeOvenShift(current: Omit<OvenUse, 'id'>, others: readonly OvenUse[]): number {
  let shift = 0;
  for (let guard = 0; guard < 48; guard++) {
    const clash = ovenClash({ ...current, from: current.from + shift, to: current.to + shift }, others);
    if (!clash) return shift;
    shift = roundUpToQuarter(clash.to - current.from);
  }
  return shift;
}
