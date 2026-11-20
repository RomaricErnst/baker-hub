// One oven, two bakes (20 Nov 2026 retention round 6, Thomas: the baguettes went in right after the campagne and
// the guide still asked for a second 45 min preheat). When another live bake on this device is in the same oven
// until after this bake's preheat would start, the oven is already hot: this bake's preheat step becomes "Bring the
// oven back to 250 °C after the campagne", timed when the other bake comes out.
import { sameOven, type OvenUse } from './ovenWindow';
import { ovenTempF } from './leanBreadBake';
import type { UnitSystem } from './units';

export interface SharedOven { at: number; after: string }

/** The other bake still in the oven when this one's preheat would start, and out by this bake's time. */
export function sharedOvenFor(own: { preheatAt: number; bakeAt: number; ovenType: string | null | undefined }, others: readonly OvenUse[], fr: boolean): SharedOven | null {
  const hot = others.filter(other => sameOven(own.ovenType, other.ovenType) && other.from < own.bakeAt && other.to > own.preheatAt && other.to <= own.bakeAt)
    .sort((a, b) => b.to - a.to)[0];
  if (!hot) return null;
  const subject = hot.subject ? hot.subject.charAt(0).toLowerCase() + hot.subject.slice(1) : hot.name ?? (fr ? 'l’autre fournée' : 'the other bake');
  return { at: hot.to, after: subject };
}

/** "Bring the oven back to 250 °C after the campagne"; the oven's maximum for pizzas in a home oven; without a
 *  known setting, "to temperature". */
export function ovenBackTitle(fr: boolean, after: string, setting: { celsius?: number; max?: boolean }, units: UnitSystem = 'metric'): string {
  const temp = setting.celsius ? (units === 'imperial' ? `${ovenTempF(setting.celsius)}°F` : fr ? `${setting.celsius} °C` : `${setting.celsius}°C`)
    : setting.max ? (fr ? 'son maximum' : 'its maximum') : null;
  if (!temp) return fr ? `Remettre le four en température après ${after}` : `Bring the oven back to temperature after ${after}`;
  return fr ? `Remettre le four à ${temp} après ${after}` : `Bring the oven back to ${temp} after ${after}`;
}
