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

const SPOONS = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 2, '½'], [3 / 4, '¾'], [1, '1'], [1.5, '1½'], [2, '2']] as const;
const GRAMS_PER_TSP = 7 / 2.25; // packet convention: 7 g = 2¼ tsp

export function yeastSpoonMeasure(grams: number, type: string, locale: string): string {
  const single = dryYeastSpoonHint(grams, type, locale);
  if (single) return single;
  if (!Number.isFinite(grams) || grams < 0.35 || grams > 6 || (type !== 'instant' && type !== 'active_dry')) return '';
  const tsp = grams / GRAMS_PER_TSP;
  const above = SPOONS.findIndex(spoon => spoon[0] > tsp);
  if (above <= 0) return '';
  const fr = locale === 'fr';
  return fr
    ? `≈ entre ${SPOONS[above - 1][1]} et ${SPOONS[above][1]} c. à café`
    : `≈ between ${SPOONS[above - 1][1]} and ${SPOONS[above][1]} tsp`;
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
