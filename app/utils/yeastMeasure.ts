/** One rule for measuring small commercial yeast doses, shared by the recipe
 * card and the guide so the same dose is never flagged in one place and not
 * in another.
 *
 *  - Below SCALE_HELP_BELOW_G a 1 g kitchen scale cannot resolve the dose:
 *    every such dose gets the weighing help (0.1 g scale or dilution), with a
 *    spoon measure beside it when one exists.
 *  - Every dry-yeast dose from 0.35 g to 6 g gets a spoon measure: the nearest
 *    spoon when it is within 15 %, otherwise the two spoons it falls between.
 */
import { dryYeastSpoonHint } from './prefermentDose';

export const SCALE_HELP_BELOW_G = 1;
/** The dilution is mixed from a weighable base: 5 g of yeast in 500 g of water
 * has the same strength as 1 g in 100 g, so every portion is unchanged. */
export const DILUTION_BASE_YEAST_G = 5;

export function needsScaleHelp(grams: number): boolean {
  return Number.isFinite(grams) && grams > 0 && grams < SCALE_HELP_BELOW_G;
}

// The usual measuring spoons, with ⅓ and ⅔ (marked on most sets, and the halfway reading a baker can level).
const SPOONS = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '1'], [1.5, '1½'], [2, '2']] as const;
const GRAMS_PER_TSP = 7 / 2.25; // packet convention: 7 g = 2¼ tsp

/** One spoon to measure with (20 Nov 2026 round 6, Maya and Wei Ling: "between ¼ and ½ tsp" left them guessing):
 *  the nearest spoon within 12 % ("≈ ⅓ tsp"); else "a scant ½ tsp" just under a spoon (at least 80 % of it), or
 *  "a heaped ¼ tsp" just over one. */
export function yeastSpoonMeasure(grams: number, type: string, locale: string): string {
  const single = dryYeastSpoonHint(grams, type, locale);
  if (single) return single;
  if (!Number.isFinite(grams) || grams < 0.35 || grams > 6 || (type !== 'instant' && type !== 'active_dry')) return '';
  const tsp = grams / GRAMS_PER_TSP;
  const fr = locale === 'fr';
  const unit = fr ? 'c. à café' : 'tsp';
  const nearest = SPOONS.reduce((best, spoon) => Math.abs(tsp - spoon[0]) < Math.abs(tsp - best[0]) ? spoon : best);
  if (Math.abs(tsp - nearest[0]) <= nearest[0] * 0.12) return `≈ ${nearest[1]} ${unit}`;
  const above = SPOONS.findIndex(spoon => spoon[0] > tsp);
  if (above <= 0) return '';
  const upper = SPOONS[above], lower = SPOONS[above - 1];
  if (tsp >= upper[0] * 0.8) return fr ? `un peu moins de ${upper[1]} ${unit}` : `a scant ${upper[1]} ${unit}`;
  return fr ? `${lower[1]} ${unit} bombée` : `a heaped ${lower[1]} ${unit}`;
}

/** The "roundest" baker's percentage that produces exactly this gram amount.
 * Grams are rounded for the scale, so 20 g of oil on 650 g of flour computes
 * back to 3.1 % when the setting was 3 %. Tries whole, half, then tenth percents.
 */
export function setPercent(grams: number, flour: number, gramDecimals = 0): number {
  if (!(grams > 0) || !(flour > 0)) return 0;
  const raw = grams / flour * 100;
  const scale = 10 ** gramDecimals;
  for (const step of [1, 0.5, 0.1]) {
    const candidate = Math.round(raw / step) * step;
    if (candidate > 0 && Math.round(flour * candidate / 100 * scale) / scale === Math.round(grams * scale) / scale) {
      return Math.round(candidate * 10) / 10;
    }
  }
  return Math.round(raw * 10) / 10;
}
