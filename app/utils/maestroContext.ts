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

type ScheduleTimes = Pick<ScheduleResult, 'totalColdHours' | 'totalRTHours'> & Partial<Pick<ScheduleResult,
  'bulkFermStart' | 'bakeStart' | 'coldRetardStart' | 'coldRetardEnd' | 'coldRetard1Start' | 'coldRetard1End' | 'coldRetard2Start' | 'coldRetard2End'>>;

/** "2 h 45 min", "16 h 30 min", "4 h": a span to the quarter hour. */
function span(ms: number): string {
  const q = Math.max(0, Math.round(ms / 900000)), h = Math.floor(q / 4), m = (q % 4) * 15;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

/** The dough's phases from the mix to the bake, in the order they happen, with their real lengths (round 23,
 *  item 6: "17h cold; 6h room-temp" was read back as "17 hours cold first, then 6 hours at room temperature",
 *  for a plan of 2 h 45 at room temperature, 16 h 30 in the fridge, then 4 h out before the bake). */
export function maestroPhases(schedule: ScheduleTimes | null | undefined): string | null {
  const start = schedule?.bulkFermStart ? +schedule.bulkFermStart : NaN, end = schedule?.bakeStart ? +schedule.bakeStart : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) return null;
  const pairs: [Date | null | undefined, Date | null | undefined][] = [[schedule!.coldRetard1Start, schedule!.coldRetard1End], [schedule!.coldRetard2Start, schedule!.coldRetard2End]];
  if (!pairs.some(([a, b]) => a && b)) pairs.push([schedule!.coldRetardStart, schedule!.coldRetardEnd]);
  const spells = pairs.filter((p): p is [Date, Date] => !!p[0] && !!p[1] && +p[1] > +p[0]).map(([a, b]) => [Math.max(start, +a), Math.min(end, +b)] as const)
    .filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const parts: string[] = [];
  let at = start;
  for (const [a, b] of spells) {
    if (a > at) parts.push(`room temperature ${span(a - at)}`);
    parts.push(`fridge ${span(b - Math.max(a, at))}`);
    at = Math.max(at, b);
  }
  if (end > at) parts.push(spells.length ? `room temperature ${span(end - at)} before the bake` : `room temperature ${span(end - at)}`);
  return `from mixing to baking, in this order: ${parts.join(', then ')}`;
}

export interface MaestroContextInput {
  recipe: RecipeResult | null | undefined;
  schedule?: ScheduleTimes | null;
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
  const phases = maestroPhases(schedule);
  if (phases) sched.push(phases);
  else {
    if (rtH > 0) sched.push(`${rtH}h at room temperature in all`);
    if (coldH > 0) sched.push(`${coldH}h in the fridge in all`);
  }
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
