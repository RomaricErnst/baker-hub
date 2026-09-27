import type { RecipeResult } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
export function splitAmount(total: number, count: number, index: number, decimals = 0) {
  const scale = 10 ** decimals, ticks = Math.round(total * scale), base = Math.floor(ticks / count);
  return (index === count - 1 ? ticks - base * (count - 1) : base) / scale;
}
export function mixingBatchPlan(recipe: RecipeResult, mixer: string, requested?: number, index = 0) {
  const capacity = MIXER_TYPES[mixer as MixerType]?.maxDoughG ?? 9999;
  const suggested = Math.max(1, Math.ceil(recipe.totalDough / capacity));
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
    [key, splitAmount(value, count, active, key === 'yeast' || key === 'preferment' ? 2 : 0)])) as typeof totals;
  const total = Object.values(portion).reduce((a,b)=>a+b,0);
  return {count, active, suggested, capacity, portion, total, overCapacity: total > capacity};
}
