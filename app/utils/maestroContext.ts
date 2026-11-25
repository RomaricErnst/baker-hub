// The bake's own numbers for Maestro (round 20): one builder for the guide's steps and Pizza Party's
// question box, so both ask with the same facts. Only computed values, rounded the way the recipe shows
// them: a raw float ("0.7451489999999998g") would be repeated back to the baker as fact.
import type { RecipeResult, ScheduleResult } from '../utils';
import { pieceWeightG } from './doughAllowance';

/** Grams the way the recipe card writes them: two significant figures under 10 g, whole grams above. */
export function maestroGrams(g: number): string {
  if (!Number.isFinite(g)) return '0';
  if (g >= 10) return String(Math.round(g));
  if (g <= 0) return '0';
  const digits = Math.max(1, 1 - Math.floor(Math.log10(g)));
  return String(parseFloat(g.toFixed(Math.min(3, digits))));
}

/** Hours to a quarter, without a float tail: 16.25 → "16.25", 16 → "16". */
function maestroHours(h: number): string {
  return String(Math.round(h * 4) / 4);
}

export interface MaestroContextInput {
  recipe: RecipeResult | null | undefined;
  schedule?: Pick<ScheduleResult, 'totalColdHours' | 'totalRTHours'> | null;
  styleKey?: string | null;
  numItems: number;
  hydration: number;
  kitchenTemp: number;
  prefermentType?: string | null;
  ovenType?: string | null;
}

export function buildMaestroContext({ recipe, schedule, styleKey, numItems, hydration, kitchenTemp, prefermentType, ovenType }: MaestroContextInput): string | undefined {
  if (!recipe) return undefined;
  const totalFlour = Math.round(recipe.flour);
  const coldH = Math.round(schedule?.totalColdHours ?? 0);
  const rtH = Math.round(schedule?.totalRTHours ?? 0);

  const dough: string[] = [];
  dough.push(`style ${styleKey ?? 'unknown'}`);
  dough.push(`${numItems} × ${Math.round(pieceWeightG(recipe.totalDough ?? 0, numItems, recipe.wastePct))}g pieces`);
  dough.push(`total flour ${totalFlour}g`);
  dough.push(`hydration ${Math.round(hydration)}%`);
  if (recipe.salt != null && totalFlour > 0) dough.push(`salt ${Math.round(recipe.salt)}g (${(recipe.salt / totalFlour * 100).toFixed(1)}%)`);
  if (recipe.oil && recipe.oil > 0) dough.push(`oil ${Math.round(recipe.oil)}g`);
  if (recipe.sugar && recipe.sugar > 0) dough.push(`sugar ${Math.round(recipe.sugar)}g`);
  if (recipe.enrichment) for (const key of ['milk', 'eggs', 'butter'] as const) if (recipe.enrichment[key] > 0) dough.push(`${key} ${Math.round(recipe.enrichment[key])}g`);
  if (recipe.blendProfile?.displayName) dough.push(`flour: ${recipe.blendProfile.displayName}`);

  const sched: string[] = [];
  if (coldH > 0) sched.push(`${coldH}h cold (fridge) ferment`);
  if (rtH > 0) sched.push(`${rtH}h room-temp ferment`);
  sched.push(`kitchen ${Math.round(kitchenTemp)}°C`);
  if (recipe.waterTemp != null) sched.push(`target water temp ${Math.round(recipe.waterTemp)}°C`);

  const leaven: string[] = [];
  if (recipe.sourdough) {
    leaven.push('leavened with a sourdough starter (levain), no commercial yeast');
  } else if (recipe.yeast && totalFlour > 0) {
    const g = recipe.yeast.convertedGrams;
    const pct = g / totalFlour * 100;
    const yp = pct >= 1 ? pct.toFixed(1) : pct > 0 ? pct.toFixed(Math.max(2, 1 - Math.floor(Math.log10(pct)))) : '0';
    leaven.push(`final-dough yeast ${maestroGrams(g)}g ${recipe.yeast.yeastType ?? 'IDY'} (${yp}% of total flour)`);
  }
  if (recipe.preferment && prefermentType && prefermentType !== 'none' && totalFlour > 0) {
    const p = recipe.preferment;
    const pf = Math.round((p.prefFlour / totalFlour) * 100);
    // Where the preferment ferments, as the plan says it: fridge, a cool spot (a biga kept out of the
    // fridge, 16–18 °C) or the room. Same hours as the recipe's own line.
    const where = p.cold ? 'in the fridge' : prefermentType === 'biga' ? 'in a cool spot (about 16–18°C)' : 'at room temp';
    const hours = p.fermentHoursMin === p.fermentHoursMax ? maestroHours(p.fermentHoursMin) : `${maestroHours(p.fermentHoursMin)}–${maestroHours(p.fermentHoursMax)}`;
    leaven.push(`${prefermentType}: ${pf}% of the flour (${Math.round(p.prefFlour)}g flour + ${Math.round(p.prefWater)}g water), ${maestroGrams(p.prefYeastGrams)}g yeast${p.finalYeastGrams ? ` (+ ${maestroGrams(p.finalYeastGrams)}g yeast in the final dough)` : ''}, ferments about ${hours}h ${where}`);
  }

  // How the plan puts the pizza in the oven: a tray in a home oven is the baking-paper way, no peel.
  const method = ovenType === 'home_oven_standard'
    ? '\nOVEN METHOD: the plan tops each pizza on baking paper and slides it onto the hot tray, paper and all; there is no peel or stone. Advise with that method.'
    : '';

  return `Computed recipe estimates and settings, not measurements or proof of correctness.
DOUGH: ${dough.join('; ')}.
SCHEDULE: ${sched.join('; ')}.
LEAVENING: ${leaven.join('; ')}.${method}
Actual dough condition and equipment may differ from these estimates.`;
}
