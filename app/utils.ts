// ══════════════════════════════════════════
// BAKER HUB — Utils & Engine
// ══════════════════════════════════════════
// Contains:
//   1. Yeast Engine (Craig's formula)
//   2. Schedule Engine
//   3. Recipe Calculator
//   4. DDT Calculator
//   5. Oven/Mixer warnings
//   6. Time utilities
// ══════════════════════════════════════════

import {
  ALL_STYLES,
  OVEN_TYPES,
  BREAD_OVEN_TYPES,
  MIXER_TYPES,
  YEAST_TYPES,
  computeBlendProfile,
  computePrefermentRecipe,
  PREFERMENT_TYPES,
  type OvenType,
  type BreadOvenType,
  type AnyOvenType,
  type MixerType,
  type YeastType,
  type StyleKey,
  type FlourBlend,
  type BlendProfile,
  type PrefermentType,
} from './data';

// ══════════════════════════════════════════
// 1. YEAST ENGINE
// ══════════════════════════════════════════
// Craig's validated formula constants
// All values = Instant Dry Yeast (IDY) % of flour
//   RT:   IDY% = 9.5  / (hours^1.65 × 2.5^((temp−25)/10))
//   Cold: IDY% = 7.5  / hours^1.313
//   Tropical (RT only): ÷1.15 @30-32°C, ÷1.25 @33-35°C
//   Fridge correction: Q10 — 2^((fridgeTemp−4)/10)
// ══════════════════════════════════════════

// Practical limits
const YEAST_MIN_PCT   = 0.05;   // hard floor
const YEAST_MIN_GRAMS = 0.1;    // minimum weighable on 0.1g scale
const YEAST_RT_MAX_H  = 8;      // max RT hours before poolish recommended

// Tropical correction divisor (RT phases only)
function tropicalFactor(temp: number): number {
  // The bands are closed at the top, so anything above 35 C fell through to
  // 1.0 — a 36 C kitchen got LESS correction than a 33 C one and was dosed
  // more yeast while fermenting faster. The climate slider goes to 38, so
  // this was reachable, not theoretical.
  //
  // Above 35 C we HOLD the last validated value rather than extrapolate.
  // 1.25 is certainly too little up there, but it is the highest figure the
  // sources support and inventing a slope would be guessing into the science.
  // Open-ended lower bounds also fix fractional temperatures: 32.5 C used to
  // fall through to 1.0 between the two bands.
  if (temp >= 33) return 1.25;
  if (temp >= 30) return 1.15;
  return 1.0;
}

// Q10 factor: yeast activity doubles every 10°C above reference 4°C
function coldActivityFactor(fridgeTemp: number): number {
  return Math.pow(2.0, (fridgeTemp - 4) / 10);
}

// RT formula: IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10)) ÷ tropicalFactor
// Returns null for extreme combos that will over-ferment at room temp
function rtIDY(hours: number, temp: number): number | null {
  if (hours >= 30 && temp >= 28) return null;
  if (hours >= 36 && temp >= 25) return null;
  const raw = 9.5 / (Math.pow(hours, 1.65) * Math.pow(2.5, (temp - 25) / 10));
  return raw / tropicalFactor(temp);
}

// Cold formula: IDY% = 7.5 / hours^1.313, corrected for fridge temperature
function coldIDY(hours: number, fridgeTemp: number): number {
  const raw = 7.5 / Math.pow(Math.max(1, hours), 1.313);
  return raw / coldActivityFactor(fridgeTemp);
}

// Warnings travel as keys, not sentences. They used to be English literals
// built in this file, which meant a French baker read them in English — and
// the parity check on fr.json could not catch it, because the strings never
// went through next-intl. The renderer also had to decide WHICH warnings to
// show by substring-matching that English ("poolish", "not recommended"), so
// rewording a warning silently changed whether it appeared at all.
export type YeastWarningKey =
  | 'poolishSuggestion'   // long RT window — a preferment would give more control
  | 'overFermentRT'       // RT window longer than the dough will hold
  | 'hotClimateRT'        // >4h at room temperature in a hot kitchen
  | 'fridgeWarm'          // fridge warmer than the 4C reference
  | 'osmoticStress'       // sugar above 2% of flour — dose raised 20%
  | 'doseFloorRT';        // RT window longer than the dose can control at this batch size

export interface YeastWarning {
  key: YeastWarningKey;
  params?: Record<string, string | number>;
}

export interface YeastResult {
  pct: number;           // IDY % of flour
  grams: number;         // absolute grams for recipe flour weight
  convertedPct: number;  // % for selected yeast type
  convertedGrams: number;// grams for selected yeast type
  yeastType: YeastType;
  scaleNeeded: string;
  dilutionTip: { solutionG: number; waterG: number } | null;
  hitMinFloor: boolean;  // dose under 0.5 g — needs a 0.1 g precision scale
  // Longest room-temperature window this batch can still be DOSED for, i.e.
  // where the required IDY stays above what a 0.1 g scale can weigh. Null when
  // the schedule has a cold phase (dose is set by the cold leg) or when the
  // window is already inside it. Below this, the floor clamps the dose upward
  // and the dough over-ferments no matter what the timings say — the one case
  // where climate has to adjust TIMING and not just yeast.
  maxDosableRTH: number | null;
  recommendPoolish: boolean;
  notRecommended: boolean;
  explanation: string;
  warnings: YeastWarning[];
  osmoticStress: boolean; // true when sugar > 2% — yeast amount increased 20%
}

function recommendYeast(
  totalRTHours: number,
  kitchenTemp: number,
  totalColdHours: number,
  fridgeTemp: number,       // guided = 4, advanced = user input
  yeastType: YeastType,
  flour: number,            // grams — for absolute calculation
  priority: string | null,
  styleKey?: string,        // used to suppress false warnings for RT-only styles
): YeastResult {
  const warnings: YeastWarning[] = [];
  let notRecommended = false;
  let recommendPoolish = false;
  let rec: number;

  const RT_ONLY_STYLES = new Set(['pan', 'roman', 'pain_seigle']);
  const isRTOnlyStyle = RT_ONLY_STYLES.has(styleKey ?? '');

  if (totalColdHours > 0 && totalRTHours <= 4) {
    // Primarily cold fermentation
    rec = coldIDY(totalColdHours, fridgeTemp);
    rec = Math.max(YEAST_MIN_PCT, rec);

  } else if (totalColdHours > 0) {
    // Mixed: room temp + cold
    const rtRec = rtIDY(totalRTHours, kitchenTemp);
    const coldRec = coldIDY(totalColdHours, fridgeTemp);
    if (rtRec === null) {
      rec = Math.max(YEAST_MIN_PCT, coldRec);
    } else {
      const rtWeight    = totalRTHours  / Math.max(rtRec ?? YEAST_MIN_PCT, YEAST_MIN_PCT);
      const coldWeight  = totalColdHours / coldRec;
      const totalWeight = rtWeight + coldWeight;
      rec = Math.max(YEAST_MIN_PCT,
        (coldRec * (coldWeight / totalWeight)) + ((rtRec ?? 0) * (rtWeight / totalWeight))
      );
    }

  } else {
    // Pure room temperature
    if (totalRTHours > YEAST_RT_MAX_H && !isRTOnlyStyle) {
      recommendPoolish = true;
      warnings.push({ key: 'poolishSuggestion', params: { hours: YEAST_RT_MAX_H } });
    }
    const rtRec = rtIDY(totalRTHours, kitchenTemp);
    if (rtRec === null) {
      notRecommended = true;
      warnings.push({ key: 'overFermentRT', params: { hours: totalRTHours, temp: kitchenTemp } });
      rec = YEAST_MIN_PCT;
    } else {
      rec = Math.max(YEAST_MIN_PCT, rtRec);
    }
  }

  // Priority adjustments
  if (priority === 'flavor') rec *= 0.7;
  if (priority === 'speed')  rec *= 1.8;
  rec = Math.min(1.5, rec);
  rec = Math.round(rec * 10000) / 10000;

  // Hot climate warnings — suppressed for styles that are intentionally RT-only
  if (kitchenTemp >= 28 && totalColdHours === 0 && totalRTHours > 4 && !isRTOnlyStyle) {
    warnings.push({ key: 'hotClimateRT', params: { temp: kitchenTemp } });
  }

  // No grams clamp. There used to be a hard 0.5 g floor here, and it was the
  // wrong instrument for the job in three ways.
  //
  // It over-dosed. A 300 g batch on a 48h retard wants 0.15 g and was given
  // 0.5 g — 3.3x — so the dough ran ahead of its own schedule. It bound on 9
  // of 12 common cold-retard cases.
  //
  // It made two shipped features unreachable. scaleNeeded's "precision scale"
  // branch fires below 0.5 g and dilutionTip fires below 0.1 g; with the dose
  // clamped at 0.5 g neither could ever run. (RecipeOutput's old warning
  // allowlist even matched on the words 'precision scale' and 'dilution',
  // which is why those terms never matched anything.)
  //
  // And it was fixed grams where the real limit scales with the batch.
  // YEAST_MIN_PCT (0.05% of flour) is the floor that belongs here: it already
  // prevents absurd readouts — 0.15 g on 300 g of flour, never 0.001 g — and
  // it scales, where 0.1 or 0.2 g would over-dose a small batch and be
  // meaningless for a large one.
  //
  // Small amounts are now MEASURED rather than inflated: below 0.1 g the
  // dilution tip carries them, and 1 g into 100 g of the dough's own water
  // turns 0.15 g of yeast into 15 g of liquid — weighable to +-0.3% on the
  // same 0.1 g scale.
  const rawGrams = flour * rec / 100;
  // Kept for the recipe card's precision-scale callout: true when the dose is
  // small enough to need a 0.1 g scale, which is what that card actually says.
  const hitMinFloor = rawGrams < 0.5;

  // The floor is a hardware limit, not a recipe decision: below 0.5 g nothing
  // is weighable on a 0.1 g scale, so the dose is rounded UP and the dough
  // ferments faster than the plan. On a pure room-temperature schedule that is
  // the point where "climate adjusts yeast, not timing" stops being true.
  //
  // It binds at small batches in hot kitchens — 300 g of flour at 35-38 C — and
  // not at 500 g and above, which is why it has stayed invisible. We report the
  // longest window this batch can still be dosed for rather than silently
  // handing back an over-yeasted plan.
  let maxDosableRTH: number | null = null;
  if (totalColdHours === 0 && rawGrams < YEAST_MIN_GRAMS && flour > 0) {
    for (let tenths = Math.round(totalRTHours * 10); tenths >= 5; tenths--) {
      const pct = rtIDY(tenths / 10, kitchenTemp);
      if (pct !== null && flour * pct / 100 >= YEAST_MIN_GRAMS) {
        maxDosableRTH = Math.floor(tenths / 10 * 4) / 4;   // report to the quarter hour
        break;
      }
    }
    warnings.push({ key: 'doseFloorRT', params: {
      hours: Math.round(totalRTHours * 10) / 10,
      temp: kitchenTemp,
      dosable: maxDosableRTH ?? 0,
    } });
  }

  // Convert to selected yeast type
  const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
  const grams          = Math.round(rawGrams * 1000) / 1000;
  const convertedPct   = Math.round(rec * conversion * 10000) / 10000;
  const convertedGrams = Math.round(flour * convertedPct / 100 * 1000) / 1000;

  // Scale tip
  const scaleNeeded = convertedGrams < 0.5
    ? 'Precision scale (0.1g accuracy) required'
    : 'Standard kitchen scale is fine';

  // Dilution: 1 g of yeast into 100 g of THE DOUGH'S OWN WATER, giving
  // 0.01 g of yeast per gram of liquid. 0.15 g of yeast becomes 15 g of
  // solution, weighable to +-0.3% on a 0.1 g scale.
  //
  // The old arithmetic scaled the ratio instead of the volume: 0.07 g asked
  // the baker to dissolve 1 g of yeast in 1,430 g of water. Nobody has 1.4
  // litres of water in a pizza dough.
  //
  // Taking it from the dough's own water is the load-bearing half — added on
  // top it would change the hydration.
  let dilutionTip: { solutionG: number; waterG: number } | null = null;
  if (convertedGrams < 0.5) {
    const DILUTION_WATER_G = 100;
    dilutionTip = {
      waterG: DILUTION_WATER_G,
      solutionG: Math.round(convertedGrams * DILUTION_WATER_G * 10) / 10,
    };
  }

  // Explanation
  let explanation = '';
  if (kitchenTemp >= 30) {
    explanation = `Very hot kitchen (${kitchenTemp}°C) — minimal yeast. Use ice-cold water.`;
  } else if (kitchenTemp >= 28) {
    explanation = `Hot kitchen (${kitchenTemp}°C) — reduced yeast. Use cold water from fridge.`;
  } else if (kitchenTemp >= 25) {
    explanation = `Warm kitchen (${kitchenTemp}°C) — slightly reduced yeast.`;
  } else if (kitchenTemp <= 18) {
    explanation = `Cool kitchen (${kitchenTemp}°C) — increased yeast to compensate.`;
  } else {
    explanation = `Ideal conditions (${kitchenTemp}°C) — standard yeast amount.`;
  }

  if (totalColdHours >= 48) {
    explanation += ` Long cold retard (${totalColdHours}h) develops exceptional flavour.`;
  }

  if (fridgeTemp > 8) {
    warnings.push({ key: 'fridgeWarm', params: { temp: fridgeTemp } });
  }

  return {
    pct: rec,
    grams,
    convertedPct,
    convertedGrams,
    yeastType,
    scaleNeeded,
    dilutionTip,
    hitMinFloor,
    maxDosableRTH,
    recommendPoolish,
    notRecommended,
    explanation,
    warnings,
    osmoticStress: false,
  };
}

// ══════════════════════════════════════════
// 2. SOURDOUGH MODEL
// ══════════════════════════════════════════

export interface SourdoughResult {
  starterPctMin: number;
  starterPctMax: number;
  starterGramsMin: number;
  starterGramsMax: number;
  // The amount the recipe actually calls for, rounded to 5 g. Computed here
  // because three places need the same number: the enthalpy balance below, the
  // recipe card (which subtracts half of it back out of flour and water for
  // display) and the bake guide's feed seeding. It was duplicated in the two
  // components and utils.ts now needs it too — three sites is the pattern the
  // multi-engine rule exists to prevent.
  starterGramsMid: number;
  bulkCues: string[];
  warning: string | null;
}

function sourdoughGuidance(
  kitchenTemp: number,
  flour: number,
  feedToMixH?: number,
  flourStrength?: number,
): SourdoughResult {
  let min: number, max: number;

  if (kitchenTemp >= 28) {
    min = 10; max = 15;
  } else if (kitchenTemp >= 24) {
    min = 15; max = 20;
  } else {
    min = 20; max = 25;
  }

  if (feedToMixH && feedToMixH > 0) {
    const basePeakH = kitchenTemp >= 28 ? 5 : kitchenTemp >= 24 ? 7 : 9;
    const mid = (min + max) / 2;
    // Clamp the ratio before applying it — an unclamped short feed-to-mix
    // window (common on hot-kitchen "refresh now" plans) was scaling mid by
    // up to 2.5x+ and pinning the result at the 30% ceiling for any window
    // under ~2h. [0.7, 1.3] lets real timing differences nudge the % gently
    // without letting a short window dominate the whole range.
    const ratio = Math.max(0.7, Math.min(1.3, basePeakH / feedToMixH));
    const adjMid = Math.max(5, Math.min(30, Math.round(mid * ratio)));
    min = Math.max(5,  adjMid - 3);
    max = Math.min(30, adjMid + 3);
  }

  // Apply flour strength to starter % — weaker flour needs less starter to
  // avoid over-acidification; stronger flour tolerates more.
  if (flourStrength && flourStrength !== 1.0) {
    const ftm = Math.max(0.6, Math.min(1.5, flourStrength));
    min = Math.max(5,  Math.round(min * ftm));
    max = Math.min(30, Math.round(max * ftm));
  }

  const isWeakFlour   = flourStrength !== undefined && flourStrength < 0.85;
  const isStrongFlour = flourStrength !== undefined && flourStrength > 1.15;

  const bulkCues = isWeakFlour
    ? [
        'Dough has grown 50–75% in volume',
        'Surface looks domed — stop before it jiggles freely',
        'Sides of container look slightly pulled away',
        'Smells pleasantly tangy, not strongly sour',
        'Weaker flour ferments faster — watch closely',
      ]
    : isStrongFlour
    ? [
        'Dough has grown 75–100% in volume',
        'Surface is domed and slightly bubbly',
        'Dough jiggles when you gently shake the container',
        'Sides of container look slightly pulled away',
        'Smells pleasantly tangy — strong flour can go longer',
      ]
    : [
        'Dough has grown 75–100% in volume',
        'Surface looks domed and slightly bubbly',
        'Dough jiggles when you shake the container',
        'Sides of container look slightly pulled away',
        'Smells pleasantly tangy, not alcoholic',
      ];

  const warning = kitchenTemp >= 28
    ? `At ${kitchenTemp}°C your starter is very active. ` +
      `Use the lower end of the range and watch the dough, not the clock.`
    : null;

  const gramsMin = Math.round(flour * min / 100);
  const gramsMax = Math.round(flour * max / 100);

  return {
    starterPctMin: min,
    starterPctMax: max,
    starterGramsMin: gramsMin,
    starterGramsMax: gramsMax,
    starterGramsMid: Math.round((gramsMin + gramsMax) / 2 / 5) * 5,
    bulkCues,
    warning,
  };
}

// ══════════════════════════════════════════
// 3. SCHEDULE ENGINE
// ══════════════════════════════════════════

export interface AvailabilityBlock {
  from: Date;
  to: Date;
  label: string;
}

export interface ScheduleResult {
  mixingDurationH: number;
  bulkFermStart: Date;
  bulkFermHours: number;
  // Primary cold retard fields (backward compat for yeast engine)
  coldRetardStart: Date | null;
  coldRetardEnd: Date | null;
  coldRetardHours: number;
  finalProofStart: Date;
  finalProofHours: number;
  restRtHours: number;
  preheatStart: Date;
  bakeStart: Date;
  totalRTHours: number;
  totalColdHours: number;
  wasAutoAdjusted: boolean;
  kitchenTemp: number;
  // Two-phase cold retard fields
  coldRetard1Start: Date | null;   // bulk cold start
  coldRetard1End: Date | null;     // bulk cold end / divide moment
  coldRetard2Start: Date | null;   // ball cold start (null if single-phase)
  coldRetard2End: Date | null;     // ball cold end (null if single-phase)
  divideBallTime: Date;            // when divide & ball happens
  rtWarmupStart: Date | null;      // tropical warmup start (null if single-phase)
  rtWarmupEnd: Date | null;        // tropical warmup end (null if single-phase)
  bulkConflict: null | { missingMin: number; suggestEarlierByMin: number; suggestedEarlierStart?: Date };
  // The dough has to leave the fridge before it can proof, and that moment is
  // pinned to the bake time, not to anything the solver chooses. When it lands
  // inside a busy window the schedule has already done all it can (it extends
  // the retard to the end of the last block, then clamps for the final proof),
  // so the only remaining move belongs to the baker: bake later. Recorded here
  // so the plan step can say so instead of staying silent.
  coldExitConflict: null | { at: Date; blockLabel: string; suggestedBake: Date };
  scheduleNote: string | null;
}

function maxRTHours(kitchenTemp: number): number {
  if (kitchenTemp >= 28) return 2;
  if (kitchenTemp >= 25) return 4;
  if (kitchenTemp >= 22) return 6;
  return 8;
}

function maxFinalProofHours(kitchenTemp: number, hasColdRetard: boolean): number {
  // Balls from cold retard are already partially fermented — proof faster
  if (hasColdRetard) {
    if (kitchenTemp >= 28) return 1.0;
    if (kitchenTemp >= 25) return 1.5;
    if (kitchenTemp >= 22) return 2.5;
    return 3.5;
  }
  if (kitchenTemp >= 28) return 1.5;
  if (kitchenTemp >= 25) return 2.5;
  if (kitchenTemp >= 22) return 3.5;
  return 5;
}

function restRtMinutes(kitchenTemp: number): number {
  if (kitchenTemp >= 28) return 30;
  if (kitchenTemp >= 24) return 45;
  return 60;
}

function roundTo15(d: Date | null): Date | null {
  if (!d) return null;
  const r = new Date(d);
  const m = r.getMinutes();
  const rounded = Math.round(m / 15) * 15;
  if (rounded === 60) { r.setHours(r.getHours() + 1); r.setMinutes(0); }
  else r.setMinutes(rounded);
  r.setSeconds(0, 0);
  return r;
}

// ══════════════════════════════════════════
// PREFERMENT THERMAL MODEL + ENTHALPY DDT
// ══════════════════════════════════════════
// Why this exists: a fridge poolish/biga is 25–55% of the finished dough by
// mass. The classic 3-factor DDT rule (FDT×3 − flour − room − friction) has no
// preferment term, so it cannot see that a 6°C preferment drags the mix down by
// 4–8°C. The warm-up step was the (unmodelled, thermally token) patch for that.
// Here we model it properly: solve the water temperature from a real enthalpy
// balance, and only ask for warm-up when water alone cannot reach the target.

const CP_WATER = 4180;   // J/kg·K
const CP_FLOUR = 1800;   // J/kg·K (dry solids)

/** Target dough temperature by style. Hoisted so the warm-up solver can read it. */
export const TARGET_FDT: Record<string, number> = {
  neapolitan: 23, newyork: 24, roman: 25, pan: 25,
  sourdough: 24, pain_campagne: 24, pain_levain: 24,
  baguette: 24, pain_complet: 24, pain_seigle: 24,
  fougasse: 25, brioche: 22, pain_mie: 24, pain_viennois: 23,
};

export const WATER_TEMP_MIN = 2;
export const WATER_TEMP_MAX = 40;

/**
 * Warm-up ceiling. Deliberately equal to the OLD getPrefRTWarmupH maximum, so
 * the computed value can only ever be shorter than what shipped before — the
 * scheduler can get looser, never tighter.
 */
export const MAX_PREF_WARMUP_H = 2;

/**
 * Lumped-capacitance time constant (minutes) for a covered preferment mass
 * warming in still air. Bi correction accounts for the core lagging the skin.
 * ~400 g → 130 min · ~600 g → 152 min · ~1000 g → 185 min.
 */
export function prefThermalTauMin(massG: number, prefHydrationPct: number): number {
  const hyd = Math.max(0.2, prefHydrationPct / 100);
  const waterFrac = hyd / (1 + hyd);
  const cp = waterFrac * CP_WATER + (1 - waterFrac) * CP_FLOUR;
  const rho = 1000;                                    // kg/m³
  const V = Math.max(massG, 1) / 1000 / rho;           // m³
  const r = Math.cbrt((3 * V) / (4 * Math.PI));        // equivalent sphere radius, m
  const A = 4 * Math.PI * r * r * 0.85;                // container base insulates ~15%
  const h = 8;                                         // W/m²·K — still air, covered
  const k = 0.45;                                      // W/m·K — dough
  const Bi = (h * r) / k;
  return ((rho * V * cp) / (h * A) / 60) * (1 + Bi / 5);
}

/** Preferment temperature after `warmupH` at room temperature. */
export function prefTempAfterWarmup(
  massG: number, prefHydrationPct: number,
  fromTempC: number, roomTempC: number, warmupH: number,
): number {
  if (warmupH <= 0) return fromTempC;
  const tau = prefThermalTauMin(massG, prefHydrationPct);
  return roomTempC - (roomTempC - fromTempC) * Math.exp(-(warmupH * 60) / tau);
}

/**
 * Enthalpy-balance water temperature. Total flour/water are the WHOLE dough;
 * prefFlourG/prefWaterG are the portion already locked inside the preferment
 * at prefTempC. Returns the unclamped ideal and the dough temp actually
 * reachable once the water is clamped to [WATER_TEMP_MIN, WATER_TEMP_MAX].
 */
/**
 * Mixing heat for a mixer, in °C of dough temperature rise.
 *
 * rate x the mixing time the app itself prescribes. Keeping it derived means
 * changing a mixing instruction changes the thermal model with it, instead of
 * the two drifting apart. Returns a TRUE rise, to be ADDED WHOLE — never
 * divided by a factor count.
 */
export function mixerFrictionRiseC(mixerType: MixerType | undefined): number {
  const m = MIXER_TYPES[mixerType ?? 'hand'];
  if (!m) return 1.6;   // hand-knead equivalent
  return m.frictionRiseCPerMin * m.kneadMin;
}

export function solveWaterTempEnthalpy(p: {
  targetFDT: number; kitchenTemp: number; flourTemp: number; friction: number;
  flourG: number; waterG: number; saltG: number;
  prefFlourG: number; prefWaterG: number; prefTempC: number;
}): { idealWaterTemp: number; waterTemp: number; doughTempC: number; freeWaterG: number } {
  const prefMass = p.prefFlourG + p.prefWaterG;
  const freeWater = p.waterG - p.prefWaterG;
  const cPref = prefMass > 0 ? prefMass * ((p.prefWaterG / prefMass) * CP_WATER + (p.prefFlourG / prefMass) * CP_FLOUR) : 0;
  const cDry = (p.flourG - p.prefFlourG + p.saltG) * CP_FLOUR;
  const cWater = Math.max(0, freeWater) * CP_WATER;
  const total = cPref + cDry + cWater;

  // (FDT − friction) · Σc = cPref·Tpref + cDry·Tkitchen + cWater·Twater
  const target = (p.targetFDT - p.friction) * total;
  const idealWaterTemp = cWater > 0
    ? (target - cPref * p.prefTempC - cDry * p.flourTemp) / cWater
    : WATER_TEMP_MAX;
  const waterTemp = Math.max(WATER_TEMP_MIN, Math.min(WATER_TEMP_MAX, idealWaterTemp));
  const doughTempC = total > 0
    ? (cPref * p.prefTempC + cDry * p.flourTemp + cWater * waterTemp) / total + p.friction
    : p.targetFDT;
  return { idealWaterTemp, waterTemp, doughTempC, freeWaterG: freeWater };
}

/**
 * SINGLE SOURCE OF TRUTH for "how long does the preferment need out of the
 * fridge before mixing". Returns 0 whenever water temperature alone can hit the
 * target dough temperature — which, at the flour percentages a fridge poolish
 * actually uses (20–30%), is almost always.
 *
 * Biga returns 0 by protocol: it goes straight from the fridge into the mix
 * (matches the shipped Bake Guide copy), and the water carries the temperature.
 *
 * ANTI-FEEDBACK RULE: this is a PURE PROTOCOL FUNCTION of climate + style. It
 * deliberately takes no preferment percentage and no batch size, because both
 * are derived from prefOffsetH upstream (the default-% ladder) and feeding
 * either one back in would make the solver depend on its own previous answer —
 * the POOLISH-BIGA-AUDIT §1 bug class. Batch size only moves the thermal time
 * constant between ~128 and ~195 min across every realistic home batch, which
 * cannot shift a 15-minute-quantised answer; flour % is absorbed by the water
 * temperature instead, which is where fine adjustment belongs.
 */
export function requiredPrefWarmupH(o: {
  prefermentType: string;
  prefInFridge: boolean;
  styleKey: string;
  kitchenTemp: number;
  fridgeTemp: number;
  mixerType?: MixerType;
  targetDoughTemp?: number;
}): number {
  if (o.prefermentType !== 'poolish' || !o.prefInFridge) return 0;

  const style = ALL_STYLES[o.styleKey as StyleKey];
  const hydPct = style?.hydration ?? 62;
  const saltPct = style?.salt ?? 2.8;
  const prefHydPct = PREFERMENT_TYPES.poolish.hydration;      // 100
  // Canonical fridge-poolish fraction and batch size. Fridge windows are always
  // ≥12h, where the shipped default ladder gives 20–30% — 25% is the honest
  // midpoint, and a constant rather than a function of the current plan.
  const prefPct = 0.25;
  const targetFDT = o.targetDoughTemp ?? TARGET_FDT[o.styleKey] ?? 24;
  const friction = mixerFrictionRiseC(o.mixerType);

  const doughTotal = 1000;
  const flourG = doughTotal / (1 + hydPct / 100 + saltPct / 100);
  const waterG = flourG * (hydPct / 100);
  const saltG = flourG * (saltPct / 100);
  const prefFlourG = flourG * prefPct;
  const prefWaterG = prefFlourG * (prefHydPct / 100);
  if (waterG - prefWaterG <= 0) return MAX_PREF_WARMUP_H;      // no free water to steer with

  for (let w = 0; w <= MAX_PREF_WARMUP_H + 1e-9; w += 0.25) {
    const prefTempC = prefTempAfterWarmup(
      prefFlourG + prefWaterG, prefHydPct, o.fridgeTemp, o.kitchenTemp, w,
    );
    const { idealWaterTemp } = solveWaterTempEnthalpy({
      targetFDT, kitchenTemp: o.kitchenTemp, flourTemp: o.kitchenTemp, friction,
      flourG, waterG, saltG, prefFlourG, prefWaterG, prefTempC,
    });
    if (idealWaterTemp <= WATER_TEMP_MAX) return w;
  }
  return MAX_PREF_WARMUP_H;
}

const STYLE_FERM_DEFAULTS: Record<string, { coldH: number; rtH: number; coldHRequired?: boolean }> = {
  // Pizza — sweet spot = coldH + rtH (where dough peaks at bake)
  neapolitan:    { coldH: 24, rtH: 2 },                          // sweet: 26h
  newyork:       { coldH: 24, rtH: 2 },                          // sweet: 26h
  pizza_romana:  { coldH: 24, rtH: 2 },                          // sweet: 26h — same window as neapolitan
  roman:         { coldH: 0,  rtH: 6 },                          // RT only: sweet 6h
  pan:           { coldH: 0,  rtH: 5 },                          // RT only: sweet 5h
  sourdough:     { coldH: 24, rtH: 4 },                          // sweet: 28h
  // Bread
  pain_campagne: { coldH: 18, rtH: 3 },                          // sweet: 21h
  pain_levain:   { coldH: 16, rtH: 4 },                          // sweet: 20h
  baguette:      { coldH: 12, rtH: 2 },                          // sweet: 14h
  pain_complet:  { coldH: 12, rtH: 3 },                          // sweet: 15h
  pain_seigle:   { coldH: 0,  rtH: 5 },                          // RT only: sweet 5h
  fougasse:      { coldH: 8,  rtH: 2 },                          // sweet: 10h
  brioche:       { coldH: 8,  rtH: 2, coldHRequired: true },     // sweet: 10h
  pain_mie:      { coldH: 8,  rtH: 2, coldHRequired: true },     // sweet: 10h
  pain_viennois: { coldH: 6,  rtH: 2, coldHRequired: true },     // sweet: 8h
};

export function buildSchedule(
  startTime: Date,
  eatTime: Date,
  availabilityBlocks: AvailabilityBlock[],
  kitchenTemp: number,
  preheatMin: number,
  mixerType: MixerType = 'hand',
  styleKey: string = 'neapolitan',
): ScheduleResult {
  const bakeTime = new Date(eatTime.getTime() - preheatMin * 60000);
  const kneadMin = MIXER_TYPES[mixerType].kneadMin;
  const fermStart = new Date(startTime.getTime() + kneadMin * 60000);
  const mixingDurationH = kneadMin / 60;
  const preheatH = preheatMin / 60;

  const r15  = (d: Date) => roundTo15(d) as Date;
  const r15n = (d: Date | null) => roundTo15(d);

  function pushOutOfBlockers(t: Date, bks: AvailabilityBlock[]): Date {
    let result = new Date(t);
    let changed = true;
    let safety = 0;
    while (changed && safety++ < 10) {
      changed = false;
      for (const b of bks) {
        if (result >= b.from && result < b.to) {
          result = new Date(b.to);
          changed = true;
          break;
        }
      }
    }
    return result;
  }

  const totalWindowH = (eatTime.getTime() - startTime.getTime()) / 3600000;
  const restH = restRtMinutes(kitchenTemp) / 60;
  // maxFinalH computed after hasColdRetard is known — see below

  // ── Style-aware cold retard model ────────────────────────────
  const styleFerm = STYLE_FERM_DEFAULTS[styleKey] ?? { coldH: 0 };
  const preferredColdH = styleFerm.coldH;
  const coldHRequired = styleFerm.coldHRequired === true;

  const isTropical = kitchenTemp >= 28;
  const isVeryHot  = kitchenTemp >= 30;

  // RT minimums (climate-aware)
  const minBulkRT  = isTropical ? 0.5 : 1.5;
  const minFinalRT = 1.0;
  const minTotalRT = minBulkRT + minFinalRT;

  // CT maximization model
  let coldH: number;
  if (preferredColdH === 0) {
    coldH = 0;
  } else if (coldHRequired && isTropical) {
    // Never reduce below preferred for enriched doughs in tropical kitchens
    coldH = preferredColdH;
  } else if (totalWindowH >= preferredColdH + minTotalRT) {
    coldH = preferredColdH;
  } else if (totalWindowH > minTotalRT) {
    coldH = totalWindowH - minTotalRT;
  } else {
    coldH = 0;
  }

  const hasColdRetard = coldH > 0;
  const maxFinalH = maxFinalProofHours(kitchenTemp, hasColdRetard);

  // Schedule note (first match wins)
  let scheduleNote: string | null = null;
  if (coldHRequired && isTropical) {
    scheduleNote = `Enriched dough needs the fridge at ${kitchenTemp}°C — cold retard locked in.`;
  } else if (hasColdRetard && coldH < preferredColdH) {
    scheduleNote = `Cold retard shortened to ${formatHoursSchedule(coldH)} to fit your window — flavour will still develop.`;
  } else if (!hasColdRetard && preferredColdH > 0) {
    scheduleNote = `Working within your window — pure room temperature fermentation.`;
  } else if (isTropical && !hasColdRetard) {
    scheduleNote = `Tropical kitchen — fermentation times adjusted for your climate.`;
  }

  // Warm-up and final proof durations (temp-aware)
  const rtWarmupH = isVeryHot ? 0.5 : 0.75; // 30min at ≥30°C, 45min at 28-29°C

  // Initial bulk at RT (temp-aware)
  const initialBulkH = isVeryHot ? 0.5 : (isTropical ? 0.75 : 1.5);

  const minCold1H = isTropical ? 2 : 4;
  const minCold2H = 2;
  const divideH   = 15 / 60;
  const minTwoPhaseWindow = initialBulkH + minCold1H + divideH + minCold2H + minFinalRT + preheatH;
  const isTwoPhase = hasColdRetard && totalWindowH >= minTwoPhaseWindow;

  // Filter blocks overlapping the fermentation window [fermStart, bakeTime)
  const relevantBlocks = availabilityBlocks
    .filter(b => b.from < bakeTime && b.to > fermStart)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  // ── TWO-PHASE: Tropical AND cold retard AND window >= 16h ────
  if (isTwoPhase) {
    const naturalBulkEnd = new Date(fermStart.getTime() + initialBulkH * 3600000);
    const firstBlock = relevantBlocks[0] ?? null;
    let bulkConflict: ScheduleResult['bulkConflict'] = null;
    let actualBulkH = initialBulkH;
    if (firstBlock && firstBlock.from < naturalBulkEnd && firstBlock.from > fermStart) {
      const availableBulkH = (firstBlock.from.getTime() - fermStart.getTime()) / 3600000;
      const missingMin = Math.round((initialBulkH - availableBulkH) * 60);
      if (missingMin > 15) {
        const earlierStart = new Date(startTime.getTime() - missingMin * 60000);
        bulkConflict = { missingMin, suggestEarlierByMin: missingMin, suggestedEarlierStart: earlierStart };
      }
      actualBulkH = availableBulkH;
    }
    const coldRetard1Start = new Date(fermStart.getTime() + actualBulkH * 3600000);

    const earliestDivide = new Date(coldRetard1Start.getTime() + minCold1H * 3600000);
    const latestDivide   = new Date(bakeTime.getTime() - (minCold2H + minFinalRT + preheatH) * 3600000);
    const isInAnyBlocker = (t: Date) => relevantBlocks.some(b => t >= b.from && t < b.to);
    let divideBallTime: Date = earliestDivide;
    if (earliestDivide.getTime() <= latestDivide.getTime()) {
      let scan = new Date(earliestDivide);
      while (scan.getTime() <= latestDivide.getTime()) {
        if (!isInAnyBlocker(scan)) { divideBallTime = scan; break; }
        scan = new Date(scan.getTime() + 15 * 60000);
      }
    }
    const coldRetard1End = divideBallTime;

    // Divide & ball duration
    // numItems not available here; use a placeholder of 4 balls (15 min base)
    const divideBallDurationH = 15 / 60;

    // Phase 2 starts after divide & ball
    const coldRetard2Start = new Date(divideBallTime.getTime() + divideBallDurationH * 3600000);

    // Phase 2 ends to leave rtWarmupH + finalProofH before bake
    let coldRetard2End = new Date(bakeTime.getTime() - rtWarmupH * 3600000 - maxFinalH * 3600000);

    // Clamp: if blocks exist, extend phase 2 end to cover last block (but not past bakeTime - rtWarmupH)
    let wasAutoAdjusted = false;
    if (relevantBlocks.length > 1) {
      const lastBlockEnd = new Date(Math.max(...relevantBlocks.map(b => b.to.getTime())));
      const maxColdEnd = new Date(bakeTime.getTime() - rtWarmupH * 3600000);
      if (lastBlockEnd.getTime() > coldRetard2End.getTime()) {
        coldRetard2End = new Date(Math.min(lastBlockEnd.getTime(), maxColdEnd.getTime()));
        wasAutoAdjusted = true;
      }
    }

    // Safety: phase 2 end must not precede start
    if (coldRetard2End.getTime() < coldRetard2Start.getTime()) {
      coldRetard2End = new Date(coldRetard2Start.getTime());
    }

    const rtWarmupStart = coldRetard2End;
    const rtWarmupEnd = new Date(rtWarmupStart.getTime() + rtWarmupH * 3600000);

    const finalProofStart = rtWarmupEnd;
    const actualFinalProofH = Math.min(
      maxFinalH,
      Math.max(0, (eatTime.getTime() - finalProofStart.getTime()) / 3600000)
    );

    const coldRetard1Hours = Math.max(0,
      (coldRetard1End.getTime() - coldRetard1Start.getTime()) / 3600000
    );
    const coldRetard2Hours = Math.max(0,
      (coldRetard2End.getTime() - coldRetard2Start.getTime()) / 3600000
    );
    const totalColdHours = coldRetard1Hours + coldRetard2Hours;

    return {
      mixingDurationH,
      bulkFermStart: r15(fermStart),
      bulkFermHours: actualBulkH,
      // Backward compat: map to two-phase ends
      coldRetardStart: r15(coldRetard1Start),
      coldRetardEnd: r15(coldRetard2End),
      coldRetardHours: totalColdHours,
      finalProofStart: r15(finalProofStart),
      finalProofHours: actualFinalProofH,
      restRtHours: 0,
      preheatStart: r15(bakeTime),
      bakeStart: r15(eatTime),
      totalRTHours: actualBulkH + rtWarmupH + actualFinalProofH,
      totalColdHours,
      wasAutoAdjusted,
      kitchenTemp,
      // Two-phase fields
      coldRetard1Start: r15(coldRetard1Start),
      coldRetard1End: r15n(coldRetard1End),
      coldRetard2Start: r15n(coldRetard2Start),
      coldRetard2End: r15n(coldRetard2End),
      divideBallTime: r15(divideBallTime),
      rtWarmupStart: r15n(rtWarmupStart),
      rtWarmupEnd: r15n(rtWarmupEnd),
      bulkConflict,
      coldExitConflict: null,
      scheduleNote,
    };
  }

  // ── SINGLE PHASE ─────────────────────────────────────────────

  // ── PURE RT: no cold retard for this style ───────────────────
  if (!hasColdRetard) {
    const totalH      = Math.max(0, (bakeTime.getTime() - fermStart.getTime()) / 3600000);
    const finalProofH = Math.min(maxFinalH, totalH);
    const bulkFermH   = Math.max(0, totalH - finalProofH);
    const finalProofStart = new Date(fermStart.getTime() + bulkFermH * 3600000);
    const divideBallTime  = pushOutOfBlockers(finalProofStart, relevantBlocks);
    return {
      mixingDurationH,
      bulkFermStart: r15(fermStart),
      bulkFermHours: bulkFermH,
      coldRetardStart: null,
      coldRetardEnd: null,
      coldRetardHours: 0,
      finalProofStart: r15(finalProofStart),
      finalProofHours: finalProofH,
      restRtHours: 0,
      preheatStart: r15(bakeTime),
      bakeStart: r15(eatTime),
      totalRTHours: totalH,
      totalColdHours: 0,
      wasAutoAdjusted: false,
      kitchenTemp,
      coldRetard1Start: null,
      coldRetard1End: null,
      coldRetard2Start: null,
      coldRetard2End: null,
      divideBallTime: r15(divideBallTime),
      rtWarmupStart: null,
      rtWarmupEnd: null,
      bulkConflict: null,
      coldExitConflict: null,
      scheduleNote,
    };
  }

  // ── SINGLE-PHASE COLD RETARD: style-driven coldH ─────────────
  // Structure: Mix → initial bulk RT → Cold Retard (coldH) → Rest RT → Final Proof → Preheat → Bake
  const INITIAL_BULK_H = initialBulkH;

  const naturalBulkEnd = new Date(fermStart.getTime() + INITIAL_BULK_H * 3600000);
  const firstBlock = relevantBlocks[0] ?? null;
  let bulkConflict: ScheduleResult['bulkConflict'] = null;
  let actualBulkH = INITIAL_BULK_H;
  if (firstBlock && firstBlock.from < naturalBulkEnd && firstBlock.from > fermStart) {
    const availableBulkH = (firstBlock.from.getTime() - fermStart.getTime()) / 3600000;
    const missingMin = Math.round((INITIAL_BULK_H - availableBulkH) * 60);
    if (missingMin > 15) {
      const earlierStart = new Date(startTime.getTime() - missingMin * 60000);
      bulkConflict = { missingMin, suggestEarlierByMin: missingMin, suggestedEarlierStart: earlierStart };
    }
    actualBulkH = availableBulkH;
  }

  const coldRetardStart = new Date(fermStart.getTime() + actualBulkH * 3600000);

  // Target cold retard end based on style coldH; clamp to not crowd preheat
  let coldRetardEnd = new Date(coldRetardStart.getTime() + coldH * 3600000);
  const hardMaxColdEnd = new Date(bakeTime.getTime() - (restH + maxFinalH) * 3600000);
  if (coldRetardEnd.getTime() > hardMaxColdEnd.getTime()) {
    coldRetardEnd = new Date(hardMaxColdEnd.getTime());
  }

  // Blocks can extend cold retard end, but not past bakeTime - restH
  let wasAutoAdjusted = false;
  if (relevantBlocks.length > 0) {
    const lastBlockEnd = new Date(Math.max(...relevantBlocks.map(b => b.to.getTime())));
    const maxColdEnd = new Date(bakeTime.getTime() - restH * 3600000);
    if (lastBlockEnd.getTime() > coldRetardEnd.getTime()) {
      coldRetardEnd = new Date(Math.min(lastBlockEnd.getTime(), maxColdEnd.getTime()));
      wasAutoAdjusted = true;
    }
  }

  // Safety: end must not precede start
  if (coldRetardEnd.getTime() < coldRetardStart.getTime()) {
    coldRetardEnd = new Date(coldRetardStart.getTime());
  }

  // Did the clamp leave the exit inside a block anyway? With work until 18:00
  // and a bake at 18:00 no exit can clear it — the dough must come out before
  // it bakes. Exclusive edges, same convention as every other blocker test.
  let coldExitConflict: ScheduleResult['coldExitConflict'] = null;
  {
    const exitMs = coldRetardEnd.getTime();
    const hit = relevantBlocks.find(b => exitMs > b.from.getTime() && exitMs < b.to.getTime());
    if (hit) {
      // Earliest bake whose exit clears the window: the block ends, then the
      // dough still needs its rest and proof. Rounded up to the quarter hour
      // the rest of the app speaks in.
      const raw = hit.to.getTime() + restH * 3600000;
      const q = 15 * 60000;
      coldExitConflict = {
        at: new Date(exitMs),
        blockLabel: hit.label,
        suggestedBake: new Date(Math.ceil(raw / q) * q),
      };
    }
  }

  const actualColdH = Math.max(0,
    (coldRetardEnd.getTime() - coldRetardStart.getTime()) / 3600000
  );

  const finalProofStart = new Date(coldRetardEnd.getTime() + restH * 3600000);
  // Final proof runs to actual bake time (eatTime), not preheat start.
  // Preheat overlaps with the end of final proof — baker starts oven while dough finishes.
  const finalProofH = Math.min(
    maxFinalH,
    Math.max(0, (eatTime.getTime() - finalProofStart.getTime()) / 3600000)
  );

  // Divide & Ball happens when dough comes out of fridge (pushed out of any blocker)
  const divideBallTime = pushOutOfBlockers(coldRetardEnd, relevantBlocks);

  return {
    mixingDurationH,
    bulkFermStart: r15(fermStart),
    bulkFermHours: actualBulkH,
    coldRetardStart: r15(coldRetardStart),
    coldRetardEnd: r15(coldRetardEnd),
    coldRetardHours: actualColdH,
    finalProofStart: r15(finalProofStart),
    finalProofHours: finalProofH,
    restRtHours: restH,
    preheatStart: r15(bakeTime),
    bakeStart: r15(eatTime),
    totalRTHours: actualBulkH + finalProofH,
    totalColdHours: actualColdH,
    wasAutoAdjusted,
    kitchenTemp,
    coldRetard1Start: r15(coldRetardStart),
    coldRetard1End: r15(coldRetardEnd),
    coldRetard2Start: null,
    coldRetard2End: null,
    divideBallTime: r15(divideBallTime),
    rtWarmupStart: null,
    rtWarmupEnd: null,
    bulkConflict,
    coldExitConflict,
    scheduleNote,
  };
}

// ══════════════════════════════════════════
// 4. RECIPE CALCULATOR
// ══════════════════════════════════════════

function derivePriority(schedule: ScheduleResult): string | null {
  const windowH = (schedule.bakeStart.getTime() - schedule.bulkFermStart.getTime()) / 3600000;
  if (windowH < 6) return 'speed';
  if (schedule.totalRTHours + schedule.totalColdHours >= 24) return 'flavor';
  return null;
}

export interface RecipeResult {
  flour: number;
  water: number;
  salt: number;
  yeast: YeastResult | null;       // null for sourdough
  sourdough: SourdoughResult | null;
  oil: number;
  sugar: number;
  waterTemp: number;
  hydration: number;
  totalDough: number;
  autoPriority: string | null;     // what the engine chose automatically
  wastePct?: number;               // mixing loss buffer applied
  targetDoughTemp?: number;        // DDT used for water temp calculation
  blendProfile?: BlendProfile;
  preferment?: {
    prefFlour: number;
    prefWater: number;
    prefYeastGrams: number;
    prefYeastGramsIDY: number;
    prefYeastType: string;
    finalFlour: number;
    finalWater: number;
    fermentHoursMin: number;
    fermentHoursMax: number;
    cold: boolean;
    schedule: string;
    scheduleFr: string;
  } | null;
}

export function calculateRecipe(
  styleKey: StyleKey,
  ovenType: AnyOvenType,
  numItems: number,
  itemWeight: number,
  kitchenTemp: number,
  humidity: string,
  schedule: ScheduleResult,
  fridgeTemp: number,
  yeastType: YeastType,
  mode: 'simple' | 'custom',
  mixerType: MixerType = 'hand',           // needed for DDT friction factor
  manualHydration?: number,                // custom mode only
  manualOil?: number,                      // custom mode only
  manualSugar?: number,                    // custom mode only
  flourBlend?: FlourBlend,                 // custom mode only
  prefermentType?: PrefermentType,         // custom mode only
  manualPriorityOverride?: string | null,  // custom mode only
  flourPctOverride?: number,               // custom mode only
  manualSalt?: number,                     // custom mode only
  targetDoughTemp?: number,                // custom mode only — overrides TARGET_FDT
  flourInFridge?: boolean,                 // custom mode only — flour temp = 4°C vs kitchenTemp
  wastePct?: number,                       // custom mode only — mixing loss buffer
  prefGoesInFridgeOverride?: boolean,      // custom mode only — from SchedulePicker
  feedToMixH?: number,                     // sourdough only — hours from feed to mix
  prefActualHours?: number,                // actual planned preferment window (prefOffsetH)
): RecipeResult {
  const s = ALL_STYLES[styleKey];
  const oven = (ovenType in OVEN_TYPES)
    ? OVEN_TYPES[ovenType as OvenType]
    : BREAD_OVEN_TYPES[ovenType as BreadOvenType];
  if (!s || !oven) throw new Error('Unknown style or oven');

  const blendProfile: BlendProfile | null = flourBlend
    ? computeBlendProfile(flourBlend)
    : null;

  // Hydration
  // manualHydration = baker's exact value, zero engine adjustment
  // Otherwise: style baseline + oven + climate + blend — all modes
  // Climate is a physical reality, not a UI mode concept
  const HYDRATION_FLOOR: Record<string, number> = {
    neapolitan: 56, newyork: 58, roman: 70, pan: 68,
    sourdough: 58, pain_campagne: 68, pain_levain: 70,
    baguette: 65, pain_complet: 68, pain_seigle: 70,
    fougasse: 68, brioche: 52, pain_mie: 55, pain_viennois: 52,
  };
  // Enriched or high-oil styles: fat retains moisture, so oven environment
  // matters less. Apply half the oven hydration delta, rounded to nearest integer.
  // Scientific basis: Modernist Bread Vol. 6 — fat coats gluten strands and
  // reduces water absorption sensitivity to baking environment.
  const ENRICHED_STYLES = new Set([
    'pan', 'fougasse', 'brioche', 'pain_mie', 'pain_viennois',
  ]);
  const isEnriched = ENRICHED_STYLES.has(styleKey);

  let hydration: number;
  if (mode === 'custom' && manualHydration !== undefined) {
    hydration = manualHydration;
  } else {
    const effectiveDelta = isEnriched
      ? Math.round(oven.hydrationDelta / 2)
      : oven.hydrationDelta;
    hydration = s.hydration + effectiveDelta;
    if (kitchenTemp >= 28 || humidity === 'very-humid') hydration -= 2;
    else if (kitchenTemp <= 18) hydration += 2;
    if (blendProfile) {
      const delta = Math.max(-5, Math.min(8, blendProfile.hydrationDelta));
      hydration = Math.round((hydration + delta) * 10) / 10;
    }
    // Never go below the style's minimum workable hydration
    const hydFloor = HYDRATION_FLOOR[styleKey] ?? 55;
    hydration = Math.max(hydFloor, hydration);
  }

  // Salt
  const saltPct = mode === 'custom' && manualSalt !== undefined
    ? manualSalt
    : s.salt;

  // Oil and sugar
  const oil = mode === 'custom' && manualOil !== undefined
    ? manualOil
    : oven.forceOil !== null ? oven.forceOil : s.oil;

  const sugar = mode === 'custom' && manualSugar !== undefined
    ? manualSugar
    : oven.forceSugar !== null ? oven.forceSugar : s.sugar;

  // Quantities — apply waste buffer if set
  const wasteMult = mode === 'custom' && wastePct !== undefined && wastePct > 0
    ? 1 + wastePct / 100
    : 1;
  const totalDough = Math.round(numItems * itemWeight * wasteMult);
  const hydPct = hydration / 100;
  const flour  = Math.round(totalDough / (1 + hydPct + saltPct / 100));
  const water  = Math.round(flour * hydPct);
  const salt   = Math.round(flour * saltPct / 100);
  const oilG   = oil   > 0 ? Math.round(flour * oil / 100)   : 0;
  const sugarG = sugar > 0 ? Math.round(flour * sugar / 100 * 10) / 10 : 0;

  // Water temperature — DDT (Desired Dough Temperature).
  // FDT varies by style: extensible doughs target lower, enriched higher.
  // flourTemp ≈ kitchenTemp (flour stored at room temperature).
  // The solve itself happens AFTER the preferment is computed — see below —
  // because a cold preferment is 25–55% of the dough mass and the classic
  // 3-factor rule has no term for it.
  const targetFDT = (mode === 'custom' && targetDoughTemp !== undefined)
    ? targetDoughTemp
    : TARGET_FDT[styleKey] ?? 24;
  const flourTemp = (mode === 'custom' && flourInFridge)
    ? fridgeTemp
    : kitchenTemp;
  const frictionRiseC = mixerFrictionRiseC(mixerType);

  // Yeast or sourdough
  let yeast: YeastResult | null = null;
  let sourdough: SourdoughResult | null = null;
  let directNeedIDY: number | undefined;   // whole-dough IDY need — feeds preferment dosing

  const autoPriority = derivePriority(schedule);
  const effectivePriority = manualPriorityOverride !== undefined ? manualPriorityOverride : autoPriority;

  if (yeastType === 'sourdough') {
    sourdough = sourdoughGuidance(kitchenTemp, flour, feedToMixH, blendProfile?.fermToleranceMultiplier);
  } else {
    yeast = recommendYeast(
      schedule.totalRTHours,
      kitchenTemp,
      schedule.totalColdHours,
      fridgeTemp,
      yeastType,
      flour,
      effectivePriority,
      styleKey,
    );

    // STEP 4 — Apply fermentation tolerance from blend
    if (yeast && blendProfile && blendProfile.fermToleranceMultiplier !== 1.0) {
      let idyPct = yeast.pct / blendProfile.fermToleranceMultiplier;
      idyPct = Math.round(idyPct * 10000) / 10000;
      const rawGrams = Math.max(0.5, flour * idyPct / 100);
      const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
      yeast = {
        ...yeast,
        pct: idyPct,
        grams: Math.round(rawGrams * 1000) / 1000,
        convertedPct: Math.round(idyPct * conversion * 10000) / 10000,
        convertedGrams: Math.round(flour * idyPct * conversion / 100 * 1000) / 1000,
      };
    }

    // Whole-dough leavening requirement (direct-engine IDY grams), captured
    // BEFORE any preferment reduction — this is what the preferment must
    // ultimately deliver, and drives fraction-independent preferment dosing.
    directNeedIDY = yeast ? yeast.grams : undefined;

    // Apply yeast reduction from preferment
    if (yeast && prefermentType && prefermentType !== 'none') {
      const prefData = PREFERMENT_TYPES[prefermentType];
      if (prefData.yeastReduction > 0) {
        const newGrams = Math.max(0.5, yeast.grams * (1 - prefData.yeastReduction));
        const newConvertedGrams = Math.max(0.5, yeast.convertedGrams * (1 - prefData.yeastReduction));
        yeast = {
          ...yeast,
          grams: newGrams,
          convertedGrams: newConvertedGrams,
          // Keep percentages in lockstep with grams (recomputed from grams so
          // the 0.5g floor stays consistent) — displays diverged otherwise.
          pct: Math.round(newGrams / flour * 100 * 10000) / 10000,
          convertedPct: Math.round(newConvertedGrams / flour * 100 * 10000) / 10000,
        };
      }
    }

    // Osmotic stress correction — sugar above 2% OF FLOUR slows yeast.
    // (Was `sugarG > 2` — grams, not percent — so any dough with more than
    // 2g total sugar silently got +20% yeast.)
    if (yeast && flour > 0 && (sugarG / flour) * 100 > 2) {
      yeast = {
        ...yeast,
        grams: Math.round(yeast.grams * 1.2 * 1000) / 1000,
        convertedGrams: Math.round(yeast.convertedGrams * 1.2 * 1000) / 1000,
        pct: Math.round(yeast.pct * 1.2 * 10000) / 10000,
        convertedPct: Math.round(yeast.convertedPct * 1.2 * 10000) / 10000,
        osmoticStress: true,
        warnings: [...yeast.warnings, { key: 'osmoticStress' as const }],
      };
    }
  }

  // Compute preferment recipe — climate-aware
  const prefInFridge = prefGoesInFridgeOverride !== undefined
    ? prefGoesInFridgeOverride
    : prefermentType === 'biga' || (prefermentType === 'poolish' && kitchenTemp >= 26);
  const preferment = (prefermentType && prefermentType !== 'none')
    ? computePrefermentRecipe(
        prefermentType, flour, water,
        kitchenTemp, fridgeTemp, prefInFridge,
        flourPctOverride,
        yeastType,
        prefActualHours,
        directNeedIDY,
      )
    : null;

  // ── DDT solve ────────────────────────────────────────────────
  // ONE model for every dough: an enthalpy balance over the masses actually
  // in the bowl. The classic 3-factor rule that used to run here is gone.
  //
  // Why it had to go. It weights flour, room air and water a third each.
  // Room air is not in the bowl, and the real thermal split at 60%
  // hydration is water 58% / flour+salt 42%. Those two errors cancel only
  // when the room sits near the target dough temperature — the bakery
  // condition the rule was calibrated in — and they do not cancel in a 30°C
  // tropical kitchen, which is a case this app exists to get right.
  //
  // It also divided the mixer constant by three. That constant is a TRUE
  // temperature rise (MIXER_TYPES.frictionRiseC, validated against King
  // Arthur's published measurement), so every direct dough was getting about
  // a third of the mixing heat it really gets and the water came out warm.
  //
  // A preferment is always declared, cold or at room temperature: its water
  // is locked inside it and is not free water to steer the dough with.
  const isFlourPref = prefermentType === 'poolish' || prefermentType === 'biga';
  const prefIsCold = !!preferment && prefInFridge && isFlourPref;
  let prefTempC = kitchenTemp;
  if (prefIsCold && preferment) {
    const prefHydPct = PREFERMENT_TYPES[prefermentType as PrefermentType].hydration;
    const prefWarmupH = requiredPrefWarmupH({
      prefermentType: prefermentType as string,
      prefInFridge, styleKey, kitchenTemp, fridgeTemp,
      mixerType,
      targetDoughTemp: mode === 'custom' ? targetDoughTemp : undefined,
    });
    prefTempC = prefTempAfterWarmup(
      preferment.prefFlour + preferment.prefWater, prefHydPct,
      fridgeTemp, kitchenTemp, prefWarmupH,
    );
  }
  // The levain's flour and water are ALREADY inside `flour` and `water` — the
  // recipe card proves it by subtracting half the starter back out of each for
  // display and printing "+ Xg via the starter = Yg total". So the balance was
  // not missing mass, it had that mass in the wrong bucket: without this,
  // half the starter's weight in water was solved as if it arrived at the cold
  // water temperature, when a ripe levain goes in at room temperature.
  //
  // kitchenTemp, not fridgeTemp, even for a fridge starter: the sourdough plan
  // emits fridge_out ahead of the mix by warmupH, so a levain that reaches the
  // bowl is at room temperature by construction. If that stops being true,
  // this is the line that breaks.
  //
  // The preferment channel is a single bucket, so this only applies when there
  // is no poolish or biga — the same guard the recipe card uses for sdActive.
  const levainForBalance = preferment == null ? sourdough : null;
  const levainInBalance = levainForBalance != null;
  const levainHalfG = levainForBalance != null
    ? Math.round(levainForBalance.starterGramsMid / 2)
    : 0;

  const waterTemp = solveWaterTempEnthalpy({
    targetFDT, kitchenTemp, flourTemp, friction: frictionRiseC,
    flourG: flour, waterG: water, saltG: salt,
    prefFlourG: levainInBalance ? levainHalfG : (preferment && isFlourPref ? preferment.prefFlour : 0),
    prefWaterG: levainInBalance ? levainHalfG : (preferment && isFlourPref ? preferment.prefWater : 0),
    prefTempC: levainInBalance ? kitchenTemp : prefTempC,
  }).waterTemp;

  return {
    flour, water, salt, yeast, sourdough,
    oil: oilG, sugar: sugarG,
    waterTemp, hydration, totalDough,
    autoPriority,
    wastePct: mode === 'custom' && wastePct !== undefined && wastePct > 0 ? wastePct : undefined,
    targetDoughTemp: mode === 'custom' && targetDoughTemp !== undefined ? targetDoughTemp : undefined,
    blendProfile: blendProfile ?? undefined,
    preferment,
  };
}

function prefermentLeadHours(prefermentType: PrefermentType): number {
  if (prefermentType === 'none') return 0;
  const p = PREFERMENT_TYPES[prefermentType];
  return 'fermentHoursMax' in p ? p.fermentHoursMax : 0;
}

// ══════════════════════════════════════════
// 5. OVEN / MIXER WARNINGS
// ══════════════════════════════════════════

export function ovenHydrationWarning(
  ovenType: OvenType,
  hydration: number
): string | null {
  if (ovenType === 'pizza_oven') {
    if (hydration > 65) return `${hydration}% is high for a pizza oven. Traditional Neapolitan uses 60–63% at 450°C+.`;
    if (hydration < 58) return `${hydration}% is quite low. Minimum 58% recommended for workable dough.`;
  }
  if (ovenType === 'electric_pizza' && hydration > 68) {
    return `${hydration}% is on the high side for an electric pizza oven. Consider 63–66%.`;
  }
  if (ovenType === 'home_oven_steel' && hydration < 63) {
    return `${hydration}% may produce a dry crust in a home oven. Consider 65–70%.`;
  }
  if (ovenType === 'home_oven_standard' && hydration < 65) {
    return `${hydration}% may be too low for a standard oven. Consider 67–72%.`;
  }
  return null;
}

export function ovenOilWarning(
  ovenType: OvenType,
  oil: number
): string | null {
  if ((ovenType === 'pizza_oven' || ovenType === 'electric_pizza') && oil > 0) {
    return `Oil in dough is not recommended at 450°C+ — it may burn before the crust is cooked.`;
  }
  return null;
}

export function mixerHydrationWarning(
  mixerType: MixerType,
  hydration: number
): string | null {
  const mixer = MIXER_TYPES[mixerType];
  if (hydration > mixer.maxHydration) {
    return `${hydration}% hydration is challenging with a ${mixer.name}. ` +
      `${mixerType === 'hand'
        ? 'Use wet hands and a bench scraper.'
        : 'Add water gradually and scrape the bowl often.'}`;
  }
  return null;
}

// ══════════════════════════════════════════
// 6. TIME UTILITIES
// ══════════════════════════════════════════

export function formatTime(d: Date, locale?: string): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  const fr = locale === 'fr';
  const days = fr
    ? ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return fr ? `${days[d.getDay()]} ${hh}h${mm}` : `${days[d.getDay()]} ${hh}:${mm}`;
}

function toDateTimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

function formatHoursSchedule(h: number): string {
  const r = Math.round(h * 4) / 4;
  const w = Math.floor(r);
  const f = r - w;
  if (f === 0)    return `${w}h`;
  if (f === 0.25) return `${w}h15`;
  if (f === 0.5)  return `${w}h30`;
  if (f === 0.75) return `${w}h45`;
  return `${r}h`;
}

export function hoursLabel(h: number): string {
  const rounded = Math.round(h * 4) / 4; // round to nearest 0.25h = 15min
  if (rounded < 1) return `${Math.round(rounded * 60)} min`;
  const hrs = Math.floor(rounded);
  const mins = Math.round((rounded - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}
