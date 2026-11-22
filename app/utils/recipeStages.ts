import { starterBuild } from './starterBuild';

/*
 * The recipe by stage (round 7, owner's order): the whole dough first, then what to weigh at each
 * stage — the preferment (poolish, biga) or the levain build, then the final dough. The numbers
 * here are the ones the Recipe shows, so a test can check that the stages add up to the whole dough.
 */

export type StageRowKind = 'flour' | 'water' | 'salt' | 'yeast' | 'preferment' | 'starter' | 'oil' | 'sugar';
export type StageRow = { kind: StageRowKind; grams: number; /** For flour rows: which flour of the blend (index into flourParts), absent for a single flour. */ part?: number };
export type RecipeStage = { key: 'preferment' | 'levain' | 'final'; rows: StageRow[] };

type StageInput = {
  flour: number; water: number; salt: number; oil: number; sugar: number; totalDough: number;
  flourParts?: { grams: number }[];
  preferment?: { prefFlour: number; prefWater: number; prefYeastGrams: number; finalFlour: number; finalWater: number; finalYeastGrams?: number } | null;
  sourdough?: { starterGramsMid: number; starterGramsMax: number } | null;
};

/** A levain's flour and water in the dough: half each, the flour rounded, the water the rest, so they sum to the starter. */
export function levainSplit(starterGrams: number): { flour: number; water: number } {
  const flour = Math.round(starterGrams / 2);
  return { flour, water: starterGrams - flour };
}

/** The stages of a dough made with a preferment or a levain; none for a direct dough (whole dough only). */
export function recipeStages(result: StageInput, feedRatio = 1): RecipeStage[] {
  const pf = result.preferment;
  const parts = result.flourParts && result.flourParts.length > 1 ? result.flourParts : null;
  // The first flour carries the preferment's or the starter's flour; the stage after takes the rest of each flour.
  const finalFlourRows = (primary: number, total: number): StageRow[] => parts
    ? parts.map((part, index) => ({ kind: 'flour' as const, part: index, grams: part.grams - (index === 0 ? primary : 0) }))
    : [{ kind: 'flour', grams: total - primary }];
  const tail: StageRow[] = [
    { kind: 'salt', grams: result.salt },
    ...(result.oil > 0 ? [{ kind: 'oil' as const, grams: result.oil }] : []),
    ...(result.sugar > 0 ? [{ kind: 'sugar' as const, grams: result.sugar }] : []),
  ];
  if (pf) {
    const prefTotal = pf.prefFlour + pf.prefWater + pf.prefYeastGrams;
    return [
      { key: 'preferment', rows: [
        { kind: 'flour', grams: pf.prefFlour, ...(parts ? { part: 0 } : {}) },
        { kind: 'water', grams: pf.prefWater },
        ...(pf.prefYeastGrams > 0 ? [{ kind: 'yeast' as const, grams: pf.prefYeastGrams }] : []),
      ] },
      { key: 'final', rows: [
        { kind: 'preferment', grams: prefTotal },
        ...finalFlourRows(pf.prefFlour, result.flour),
        { kind: 'water', grams: pf.finalWater },
        ...tail.slice(0, 1),
        ...(pf.finalYeastGrams && pf.finalYeastGrams > 0 ? [{ kind: 'yeast' as const, grams: pf.finalYeastGrams }] : []),
        ...tail.slice(1),
      ] },
    ];
  }
  if (result.sourdough) {
    const starter = result.sourdough.starterGramsMid;
    const split = levainSplit(starter);
    const build = starterBuild(starter, result.sourdough.starterGramsMax, feedRatio);
    return [
      // What is weighed into the jar for the build: the seed from the jar, then flour and water (1:R:R).
      { key: 'levain', rows: [
        { kind: 'starter', grams: build.seed },
        { kind: 'flour', grams: build.flour },
        { kind: 'water', grams: build.water },
      ] },
      { key: 'final', rows: [
        { kind: 'starter', grams: starter },
        ...finalFlourRows(split.flour, result.flour),
        { kind: 'water', grams: result.water - split.water },
        ...tail,
      ] },
    ];
  }
  return [];
}

// ── Yeast precision across stages ──────────────────────────────────────────────
// A stage dose is shown as a kitchen scale reads it (one decimal; one significant figure under 0.1 g).
// When the stages so shown would not add up to the whole dough's figure (0.4 + 0.7 = 1.1 against 1.2),
// the fewest doses that need it get one more figure — 2 significant figures under 1 g (0.45 g), two
// decimals from 1 to 10 g — until they do (0.45 + 0.7 = 1.15 → 1.2). When no such choice adds up
// (0.27 + 3.38 = 3.65 → 3.7 against 3.644 → 3.6), the whole dough is shown as their sum with the same extra figure (3.65 g).

const EPS = 1e-9;
function roundAt(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f + EPS * f) / f;
}
/** Decimals a dose is shown with at a precision level (0 = the kitchen-scale default, 1 = one more figure). */
function decimalsFor(grams: number, level: 0 | 1): number {
  if (grams >= 10) return 1;
  if (grams >= 0.1) return level ? 2 : 1;
  // Under 0.1 g: significant figures, from the first non-zero digit.
  return Math.ceil(-Math.log10(grams)) + level;
}
function shown(grams: number, level: 0 | 1): number {
  return grams > 0 ? roundAt(grams, decimalsFor(grams, level)) : 0;
}
function format(value: number, decimals: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: decimals }).format(value)} g`;
}

/** The stage doses and the whole dough's dose as shown, so that the stages add up to the whole. */
export function stageYeastDoses(parts: number[], locale = 'en'): { parts: string[]; total: string; shownParts: number[]; shownTotal: number } {
  const valid = parts.map(g => (Number.isFinite(g) && g > 0 ? g : 0));
  const total = valid.reduce((sum, g) => sum + g, 0);
  const result = (levels: (0 | 1)[], totalLevel: 0 | 1) => {
    const shownTotal = shown(total, totalLevel);
    return {
      parts: valid.map((g, i) => (g > 0 ? format(shown(g, levels[i]), decimalsFor(g, levels[i]), locale) : '0 g')),
      total: total > 0 ? format(shownTotal, decimalsFor(total, totalLevel), locale) : '0 g',
      shownParts: valid.map((g, i) => shown(g, levels[i])),
      shownTotal,
    };
  };
  if (!(total > 0)) return result(valid.map(() => 0), 0);
  const adds = (levels: (0 | 1)[], totalLevel: 0 | 1) =>
    roundAt(valid.reduce((sum, g, i) => sum + shown(g, levels[i]), 0), decimalsFor(total, totalLevel)) === shown(total, totalLevel);
  // Every choice of doses to refine (doses from 10 g are already whole-gram readable), fewest first.
  const open = valid.map((g, i) => (g > 0 && g < 10 ? i : -1)).filter(i => i >= 0);
  const choices: (0 | 1)[][] = [];
  for (let mask = 0; mask < 1 << open.length; mask++) {
    const levels = valid.map(() => 0 as 0 | 1);
    open.forEach((i, bit) => { if (mask & (1 << bit)) levels[i] = 1; });
    choices.push(levels);
  }
  const ones = (levels: (0 | 1)[]) => levels.reduce<number>((n, l) => n + l, 0);
  choices.sort((x, y) => ones(x) - ones(y));
  const fit = choices.find(levels => adds(levels, 0));
  if (fit) return result(fit, 0);
  // No choice adds up: every dose with one more figure, and the whole dough as their sum (it differs from the
  // exact total by under 0.01 g, far below what a scale or the dough notices).
  const all = valid.map(g => (g > 0 && g < 10 ? 1 : 0) as 0 | 1);
  const out = result(all, total < 10 ? 1 : 0);
  const decimals = decimalsFor(total, total < 10 ? 1 : 0);
  const sum = roundAt(out.shownParts.reduce((n, g) => n + g, 0), decimals);
  return { ...out, shownTotal: sum, total: format(sum, decimals, locale) };
}

/** The levain's % of the whole dough's flour as the recipe shows it (22 Nov 2026 round 9, S4): the % the amount was
 *  sized from (the middle of the engine's band, or the baker's or the planner's single %), not grams ÷ flour. The
 *  amount is rounded to 5 g, so grams ÷ flour moved with the flour's weight (80 g / 504 g Manitoba 15.9 %, 85 g /
 *  516 g all-purpose 16.5 %, both sized at 16 %) and read as the flour changing the starter, which no flour does. */
export function levainPlannedPct(sourdough: { starterPctMin: number; starterPctMax: number }): number {
  return Math.round((sourdough.starterPctMin + sourdough.starterPctMax) / 2 * 10) / 10;
}
