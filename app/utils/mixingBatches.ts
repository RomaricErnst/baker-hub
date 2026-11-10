import type { RecipeResult } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
export function mixingWaterCaption(mixer: string, locale: string): string {
  const fr=locale==='fr';
  switch (mixer) {
    case 'hand': return fr?'Eau · pétrissage à la main':'Water · hand kneading';
    case 'stand': return fr?'Eau · robot':'Water · stand mixer';
    case 'spiral': return fr?'Eau · pétrin à spirale':'Water · spiral mixer';
    case 'no_knead': return fr?'Eau · sans pétrissage':'Water · no-knead';
    default: return fr?'Température de l’eau':'Water temperature';
  }
}
/** Even split at the given precision: the batches differ by at most one unit
 * (1 g, or 0.1 g with one decimal), and the last absorbs the rounding — never
 * 17 / 17 / 19 g for 53 g. The portions always add up to the total. */
export function splitAmount(total: number, count: number, index: number, decimals = 0) {
  const scale = 10 ** decimals, ticks = Math.round(total * scale), base = Math.floor(ticks / count);
  const extra = ticks - base * count;
  return (base + (index < extra ? 1 : 0)) / scale;
}
/** Precision for one batch's share: yeast and preferment to 0.01 g; amounts
 * under 10 g per batch to 0.1 g (shown with a decimal); the rest to the gram. */
export function batchDecimals(key: string, total: number, count: number) {
  if (key === 'yeast' || key === 'preferment') return 2;
  return count > 1 && total / count < 10 || key === 'sugar' ? 1 : 0;
}
/** Optional equipment setting is a useful dough mass, not bowl volume. */
export function mixerDoughCapacity(mixer: string, requestedCapacityG?: number) {
  return Number.isFinite(requestedCapacityG) && requestedCapacityG! >= 100 && requestedCapacityG! <= 1000000
    ? Math.round(requestedCapacityG!)
    : MIXER_TYPES[mixer as MixerType]?.maxDoughG ?? 9999;
}
export const isManualMixer = (mixer: string) => mixer === 'hand' || mixer === 'no_knead';
const statedCapacity = (g?: number) => Number.isFinite(g) && g! >= 100 && g! <= 1000000;
/** Hands and bowls have no fixed load: 1,500 g is a comfort note, never a reason to split the plan. */
export function suggestedMixingBatchCount(totalDoughG: number, mixer: string, requestedCapacityG?: number) {
  if (isManualMixer(mixer) && !statedCapacity(requestedCapacityG)) return 1;
  return Math.max(1, Math.ceil(totalDoughG / mixerDoughCapacity(mixer, requestedCapacityG)));
}
/** One hand-mixed dough above the comfortable load: the guide suggests two halves, the plan stays one dough. */
export function largeManualDough(totalDoughG: number, mixer: string, batches: number, requestedCapacityG?: number) {
  return isManualMixer(mixer) && !statedCapacity(requestedCapacityG) && batches <= 1
    && totalDoughG > (MIXER_TYPES[mixer as MixerType]?.maxDoughG ?? 9999);
}
export function mixingBatchPlan(recipe: RecipeResult, mixer: string, requested?: number, index = 0, requestedCapacityG?: number) {
  const capacity = mixerDoughCapacity(mixer, requestedCapacityG);
  const suggested = suggestedMixingBatchCount(recipe.totalDough, mixer, requestedCapacityG);
  const count = Number.isFinite(requested) && requested! >= 1 ? Math.min(100, Math.floor(requested!)) : suggested;
  const active = Math.max(0, Math.min(count - 1, index));
  const pref = recipe.preferment;
  const starter = !pref ? recipe.sourdough?.starterGramsMid ?? 0 : 0;
  const totals = {
    flour: pref?.finalFlour ?? recipe.flour - Math.round(starter / 2),
    water: pref?.finalWater ?? recipe.water - Math.round(starter / 2),
    salt: recipe.salt, oil: recipe.oil, sugar: recipe.sugar,
    milk: recipe.enrichment?.milk ?? 0, eggs: recipe.enrichment?.eggs ?? 0, butter: recipe.enrichment?.butter ?? 0,
    preferment: pref ? pref.prefFlour + pref.prefWater + pref.prefYeastGrams : 0,
    starter, yeast: pref || starter ? 0 : recipe.yeast?.convertedGrams ?? 0,
  };
  const portion = Object.fromEntries(Object.entries(totals).map(([key,value]) =>
    // Sugar is calculated to 0.1 g; keep that in the step so it reads as on the recipe card.
    [key, splitAmount(value, count, active, batchDecimals(key, value, count))])) as typeof totals;
  const total = Object.values(portion).reduce((a,b)=>a+b,0);
  return {count, active, suggested, capacity, portion, total, overCapacity: total > capacity && !(isManualMixer(mixer) && !statedCapacity(requestedCapacityG))};
}
