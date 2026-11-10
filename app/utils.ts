import { formatClock } from './utils/units';
import { formatDuration } from './utils/duration';
import { BREAD_FERMENTATION_DEFAULTS, getBreadProtocol, breadActiveCookMinutes, breadPoachMinutes } from './utils/breadProfiles';
import { scheduledFoldMinutes } from './utils/scheduleFolds';
import { actionConflicts, findAvailabilityConflicts, isTimeBlocked, isFridgeRemovalCovered, type AvailabilityAction, type AvailabilityConflict } from './utils/scheduleAvailability';
import { ENRICHED_FORMULAS, ENRICHMENT_WATER_FRACTIONS, type RecipeEnrichment } from './utils/enrichedFormulas';
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
  BREAD_STYLES,
  FLOUR_DATA,
  OVEN_TYPES,
  BREAD_OVEN_TYPES,
  MIXER_TYPES,
  kneadMinFor,
  autolyseMinFor,
  preMixAutolyseMinFor,
  YEAST_TYPES,
  computeBlendProfile,
  recipeFlourBlend,
  isLevainStyle,
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
// Craig-style empirical single-temperature dose laws
// All values = Instant Dry Yeast (IDY) % of flour
//   RT:   IDY% = 9.5  / (hours^1.65 × 2.5^((temp−25)/10))
//   Cold: IDY% = 7.5  / hours^1.313
//   Tropical (RT only): ÷1.15 @30-32°C, ÷1.25 @33-35°C
//   Fridge correction: Q10 — 2^((fridgeTemp−4)/10)
// ══════════════════════════════════════════

// Practical dose bounds. Modernist Pizza, Kitchen Manual pp.38 and 44,
// illustrates the range with distinct Neapolitan formulas: 0.04% instant
// yeast for the long room-temperature formula and 1% for the emergency
// formula. These are recipe cross-checks, not validation of every mixed
// temperature trajectory. The retained 0.05% floor is a product limit.
const YEAST_MIN_PCT   = 0.05;   // automatic estimate before an explicit override
const YEAST_MIN_GRAMS = 0.1;
/** Sugar (% of flour) from which a dough takes the fixed enriched yeast dose. */
export const ENRICHED_FIXED_SUGAR_PCT = 10;
/** Fixed enriched dose, instant yeast % of flour (3 % fresh, 1.33 % active dry). */
export const ENRICHED_FIXED_IDY_PCT = 1;    // minimum weighable on 0.1g scale
const YEAST_RT_MAX_H  = 8;      // max RT hours before poolish recommended

// Tropical correction divisor (RT phases only)
function tropicalFactor(temp: number): number {
  // The bands are closed at the top, so anything above 35 C fell through to
  // 1.0 — a 36 C kitchen got LESS correction than a 33 C one and was dosed
  // more yeast while fermenting faster. The climate slider goes to 38, so
  // this was reachable, not theoretical.
  //
  // Product allowance for faster dough breakdown in the heat, not a microbial
  // growth coefficient. Above 35 C we HOLD the last validated value rather than extrapolate.
  // Do not extrapolate the allowance beyond the hottest supported band.
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

/** Fraction of the model's fermentation target reached at the supplied dose.
 * Call with cooling-adjusted exposure, as used by recommendYeast.
 */
export function fermentationBudget(dosePct: number, warmHours: number, kitchenTemp: number, coldHours: number, fridgeTemp: number): number {
  const warmRate = Math.pow(2.5, (kitchenTemp - 25) / 10) * tropicalFactor(kitchenTemp) / 9.5;
  const coldRate = coldActivityFactor(fridgeTemp) / 7.5;
  return Math.max(0, warmHours) * Math.pow(Math.max(0, dosePct) * warmRate, 1 / 1.65)
    + Math.max(0, coldHours) * Math.pow(Math.max(0, dosePct) * coldRate, 1 / 1.313);
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
  | 'osmoticStress'       // sweet dough — check yeast suitability
  | 'fermentationBudget' // dose limits leave the predicted fermentation outside its target
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
  dilutionTip: { solutionG: number; waterG: number; waterInSolutionGrams?: number; remainingWaterGrams?: number } | null;
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
  osmoticStress: boolean; // true for sweet dough
  /** Enriched dough (sugar >= 10 % of flour): fixed 1 % instant-yeast dose, not the model. */
  fixedEnrichedDose?: boolean;
}

// Existing UI instructs 1 g yeast + waterG water: stock mass is waterG + 1.
export function commercialDilution(doseGrams: number, availableWater = Infinity, limitGrams = 0.5) {
  if (!Number.isFinite(doseGrams) || doseGrams <= 0 || doseGrams >= limitGrams) return null;
  const waterG = 100;
  if (doseGrams * waterG > availableWater) return null;
  return {waterG, solutionG: doseGrams * (waterG + 1), waterInSolutionGrams: doseGrams * waterG, remainingWaterGrams: Number.isFinite(availableWater) ? availableWater - doseGrams * waterG : undefined};
}

export function recommendYeast(
  totalRTHours: number,
  kitchenTemp: number,
  totalColdHours: number,
  fridgeTemp: number,       // guided = 4, advanced = user input
  yeastType: YeastType,
  flour: number,            // grams — for absolute calculation
  priority: string | null,
  styleKey?: string,        // used to suppress false warnings for RT-only styles
  doseOverride?: number,    // Custom: the baker's IDY %; the plan is re-timed to it
): YeastResult {
  const warnings: YeastWarning[] = [];
  let notRecommended = false;
  let recommendPoolish = false;
  let rec: number;

  const RT_ONLY_STYLES = new Set(['pan', 'roman', 'pain_seigle']);
  const isRTOnlyStyle = RT_ONLY_STYLES.has(styleKey ?? '');

  // Each term is the fraction of its isolated fermentation duration used at a
  // candidate dose. Inverting the existing pure-temperature laws preserves their
  // calibration while making contributions additive across successive phases.
  // At a fixed bake time, replacing warm hours with cold can need MORE yeast;
  // extending the same plan with extra cold exposure cannot.
  const rtRec = totalRTHours > 0 ? rtIDY(totalRTHours, kitchenTemp) : undefined;
  if (rtRec === null) {
    notRecommended = true;
    warnings.push({key: 'overFermentRT', params: {hours: totalRTHours, temp: kitchenTemp}});
    rec = YEAST_MIN_PCT;
  } else if (totalColdHours > 0 && totalRTHours > 0) {
    const warmRate = Math.pow(2.5, (kitchenTemp - 25) / 10) * tropicalFactor(kitchenTemp) / 9.5;
    const coldRate = coldActivityFactor(fridgeTemp) / 7.5;
    let lo = 0, hi = 1.5;
    for (let i = 0; i < 25; i++) {
      const dose = (lo + hi) / 2;
      const progress = totalRTHours * Math.pow(dose * warmRate, 1 / 1.65)
        + totalColdHours * Math.pow(dose * coldRate, 1 / 1.313);
      if (progress < 1) lo = dose; else hi = dose;
    }
    rec = (lo + hi) / 2;
  } else if (totalColdHours > 0) {
    rec = coldIDY(totalColdHours, fridgeTemp);
  } else {
    rec = rtRec ?? 1.5;
    if (totalRTHours > YEAST_RT_MAX_H && !isRTOnlyStyle) {
      recommendPoolish = true;
      warnings.push({key: 'poolishSuggestion', params:{hours:YEAST_RT_MAX_H}});
    }
  }
  rec = Math.max(YEAST_MIN_PCT, rec);
  // Only explicit baker overrides alter the schedule-derived dose. Inferring
  // these from duration double-counted the short/long fermentation window.
  if (priority === 'flavor') rec *= 0.7;
  if (priority === 'speed') rec *= 1.8;
  rec = Math.min(1.5, rec);
  // A baker-entered amount replaces the derived one. The schedule is timed to
  // it upstream (fermentationHoursForYeast); the budget check below reports
  // any residual mismatch, e.g. when availability moved the mix.
  if (doseOverride !== undefined && Number.isFinite(doseOverride) && doseOverride > 0) rec = doseOverride;
  rec = Math.round(rec * 10000) / 10000;

  const budget = fermentationBudget(rec, totalRTHours, kitchenTemp, totalColdHours, fridgeTemp);
  if (priority !== 'speed' && priority !== 'flavor' && (budget > 1.1 || budget < 0.9)) {
    warnings.push({key: 'fermentationBudget', params: {percent: Math.round(budget * 100), direction: budget > 1 ? 'earlier' : 'later'}});
  }

  // Hot climate warnings — suppressed for styles that are intentionally RT-only
  if (kitchenTemp >= 28 && totalRTHours > 4 && !isRTOnlyStyle) {
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

  // Flag a room-temperature dose below scale resolution. Preserve the actual
  // dose and offer dilution; do not round up the yeast to make it weighable.
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
  const dilutionTip = commercialDilution(convertedGrams);

  let explanation = `Yeast is estimated for this dough's warm and refrigerated fermentation time at ${kitchenTemp}°C and ${fridgeTemp}°C.`;


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

/** The engine's recommended starter band (% of flour) for a kitchen temperature. */
function starterBand(kitchenTemp: number): { min: number; max: number } {
  return kitchenTemp >= 28 ? { min: 10, max: 15 } : kitchenTemp >= 24 ? { min: 15, max: 20 } : { min: 20, max: 25 };
}

/** Recommended mid starter % before feed-timing adjustment, with the same
 * flour-strength scaling sourdoughGuidance applies. Reference for starterBulkFactor. */
export function referenceStarterPct(kitchenTemp: number, flourStrength = 1): number {
  let { min, max } = starterBand(kitchenTemp);
  if (flourStrength && flourStrength !== 1.0) {
    const ftm = Math.max(0.6, Math.min(1.5, flourStrength));
    min = Math.max(5, Math.round(min * ftm));
    max = Math.min(30, Math.round(max * ftm));
  }
  return (min + max) / 2;
}

// Craig (TXCraig1, pizzamaking.com, Jan 2013): hours from mix to ready at
// 23.9 °C against starter as a fraction of flour, regressed on real doughs and
// tested on held-out 65/70 °F data. The Sourdough Journey timetables (2023, 60+
// controlled batches) agree within ~2 h across 5-20 %. Each halving of the
// starter adds about one doubling time.
function craigSourdoughHours(fraction: number): number {
  return -5.368 * Math.log(fraction) - 0.6014;
}

/** Multiplier on the levain room-temperature bulk for a baker-chosen starter %.
 * Exactly 1 without a choice. Craig extends his curve across temperature by a
 * growth-rate ratio, which cancels in this ratio; temperature enters through
 * the reference % (the engine's band for this kitchen) and the bulk it scales
 * (Q10 in sourdoughBulkH). Cold phases are not scaled: by the Gänzle et al.
 * (1998) growth curves Craig uses, an hour at 5 °C does about 5 % of an hour
 * at 24 °C, so a fridge retard cannot absorb an inoculation change. */
export function starterBulkFactor(starterPct: number | undefined, kitchenTemp: number, flourStrength = 1): number {
  if (starterPct === undefined || !Number.isFinite(starterPct) || starterPct <= 0) return 1;
  const p = Math.max(5, Math.min(30, starterPct)) / 100;
  const p0 = referenceStarterPct(kitchenTemp, flourStrength) / 100;
  return Math.round(craigSourdoughHours(p) / craigSourdoughHours(p0) * 1000) / 1000;
}

/** Levain room-temperature bulk at the reference starter: 5 h at 22 °C, Q10 2. */
// Other levain styles (pain de seigle among them) use pain au levain's reference.
export function sourdoughBulkH(styleKey: string, kitchenTemp: number): number {
  const nativeSourdough = styleKey === 'pain_levain' || styleKey === 'sourdough';
  return (nativeSourdough ? ALL_STYLES[styleKey as StyleKey].bulkH : ALL_STYLES.pain_levain.bulkH) * Math.pow(2, (22 - Math.min(30, kitchenTemp)) / 10);
}

function sourdoughGuidance(
  kitchenTemp: number,
  flour: number,
  feedToMixH?: number,
  flourStrength?: number,
  starterPctOverride?: number,
): SourdoughResult {
  let { min, max } = starterBand(kitchenTemp);

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

  // A baker-chosen starter % replaces the range; the schedule's bulk is
  // stretched or shortened to it by starterBulkFactor.
  if (starterPctOverride !== undefined && Number.isFinite(starterPctOverride) && starterPctOverride > 0) {
    min = max = Math.max(5, Math.min(30, starterPctOverride));
  }
  const gramsMin = Math.round(flour * min / 100);
  const gramsMax = Math.round(flour * max / 100);

  return {
    starterPctMin: min,
    starterPctMax: max,
    starterGramsMin: gramsMin,
    starterGramsMax: gramsMax,
    // A single amount (baker-chosen %) is used as is: rounding it to 5 g
    // printed "Amount 63 g" beside "Use 65 g in the dough".
    starterGramsMid: gramsMin === gramsMax ? gramsMin : Math.round((gramsMin + gramsMax) / 2 / 5) * 5,
    bulkCues,
    warning,
  };
}

// ══════════════════════════════════════════
// 3. SCHEDULE ENGINE
// ══════════════════════════════════════════

export interface AvailabilityBlock {
  coveredActions?: import('./utils/scheduleAvailability').CoveredAction[];
  from: Date;
  to: Date;
  label: string;
  fridgeRemoval?: import('./utils/scheduleAvailability').FridgeRemovalArrangement;
}

export interface ScheduleResult {
  doughMethod?: 'yeasted' | 'unleavened';
  preparationInvalid?: boolean;
  activeCookMinutes?: number;
  divisionMinutes?: number;
  rollStart?: Date;
  requiredColdHours?: number;
  coldTimingConflict?: { requiredHours: number; actualHours: number };
  poachStart?: Date;
  poachMinutes?: number;
  /** Known hands-on work; passive rests are deliberately absent. */
  availabilityActions?: AvailabilityAction[];
  prefermentCooldownHours?: number;
  availabilityConflicts?: AvailabilityConflict[];
  /** Planned assistance only; this never marks the preparation action completed. */
  fridgeRemovalArranged?: boolean;
  mixingDurationH: number;
  /** Sequential use of one mixer; fermentation of early lots continues while later ones mix. */
  mixingBatches?: number;
  firstBatchReadyAt?: Date;
  batchMixWindows?: { start: Date; end: Date }[];
  /** Shared batch protocol cannot defer the first lot's prescribed fold until all lots finish. */
  batchTimingConflict?: { firstFoldAt: Date; mixingEnd: Date };
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
  focaccia: 24, bagel: 24, pita: 24, greek_pita: 24, kebab_bread: 24,
  batbout: 24, laffa: 24, piadina: 24, pan_bagnat: 24, ciabatta: 24, panuozzo: 23,
  neapolitan: 23, newyork: 24, roman: 25, pan: 25,
  sourdough: 24, pain_campagne: 24, pain_levain: 24,
  baguette: 24, pain_complet: 24, pain_seigle: 24, pain_au_seigle: 24,
  fougasse: 25, brioche: 22, pain_mie: 24, pain_viennois: 23,
};

export const WATER_TEMP_MIN = 2;
export const WATER_TEMP_MAX = 40;

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
 * Use only explicit recipe inputs here. Never feed solver-derived percentages
 * or durations back into the schedule that produced them.
 */
interface PrefermentThermalInputs {
  prefermentType: string;
  prefInFridge: boolean;
  styleKey: string;
  kitchenTemp: number;
  fridgeTemp: number;
  mixerType?: MixerType;
  targetDoughTemp?: number;
  prefermentFlourPct?: number;
  doughMassG?: number;
  hydrationPct?: number;
  flourTempC?: number;
}

export function requiredPrefWarmupH(o: PrefermentThermalInputs): number {
  return o.prefInFridge ? prefermentConditioningHours(o) : 0;
}

export function requiredPrefCooldownH(o: PrefermentThermalInputs): number {
  return o.prefInFridge ? 0 : prefermentConditioningHours(o);
}

function prefermentConditioningHours(o: PrefermentThermalInputs): number {
  if (o.prefermentType !== 'poolish') return 0;
  const fromTemp = o.prefInFridge ? o.fridgeTemp : o.kitchenTemp;
  const toTemp = o.prefInFridge ? o.kitchenTemp : o.fridgeTemp;

  const style = ALL_STYLES[o.styleKey as StyleKey];
  const hydPct = o.hydrationPct ?? style?.hydration ?? 62;
  const saltPct = style?.salt ?? 2.8;
  const prefHydPct = PREFERMENT_TYPES.poolish.hydration;      // 100
  const prefPct = (o.prefermentFlourPct ?? 25) / 100;
  const targetFDT = o.targetDoughTemp ?? TARGET_FDT[o.styleKey] ?? 24;
  const friction = mixerFrictionRiseC(o.mixerType);

  const doughTotal = o.doughMassG ?? 1000;
  const flourG = doughTotal / (1 + hydPct / 100 + saltPct / 100);
  const waterG = flourG * (hydPct / 100);
  const saltG = flourG * (saltPct / 100);
  const prefFlourG = flourG * prefPct;
  const prefWaterG = prefFlourG * (prefHydPct / 100);
  // Three thermal time constants reach 95% of room temperature. Beyond
  // that, extra waiting offers little temperature change. The final water
  // balance must still show any target that is thermodynamically unreachable.
  const thermalHorizon = Math.ceil(3 * prefThermalTauMin(prefFlourG + prefWaterG, prefHydPct) / 60 * 4) / 4;
  if (waterG - prefWaterG <= 0) return thermalHorizon;

  for (let w = 0; w <= thermalHorizon + 1e-9; w += 0.25) {
    const prefTempC = prefTempAfterWarmup(
      prefFlourG + prefWaterG, prefHydPct, fromTemp, toTemp, w,
    );
    const { idealWaterTemp } = solveWaterTempEnthalpy({
      targetFDT, kitchenTemp: o.kitchenTemp, flourTemp: o.flourTempC ?? o.kitchenTemp, friction,
      flourG, waterG, saltG, prefFlourG, prefWaterG, prefTempC,
    });
    if (o.prefInFridge ? idealWaterTemp <= WATER_TEMP_MAX : idealWaterTemp >= WATER_TEMP_MIN) return w;
  }
  return thermalHorizon;
}

/** Existing supported lower bounds, also used by setup readiness windows. */
export const REQUIRED_COLD_MIN_HOURS: Readonly<Record<string, number>> = { brioche: 4, pain_mie: 4, pain_viennois: 3 };

const STYLE_FERM_DEFAULTS: Record<string, { coldH: number; rtH: number; coldHRequired?: boolean }> = {
  ...BREAD_FERMENTATION_DEFAULTS,
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

/** Longest single fridge spell a near-minimum window is planned without (hours). */
export const SHORT_COLD_SPELL_MAX_H = 4;

/** Durations describe the returned event times, including proof during preheat.
 * Keep planning limits separate: a cap must never erase elapsed fermentation. */
function accountScheduleTime(schedule: ScheduleResult): ScheduleResult {
  const hours = (from: Date | null, to: Date | null) => from && to
    ? Math.max(0, (to.getTime() - from.getTime()) / 3600000) : 0;
  // A brief fridge visit cannot cool the dough meaningfully. Keep handling
  // times fixed, remove the appliance trip, and count that interval as warm.
  const shortFirst = schedule.coldRetard1Start && schedule.coldRetard1End
    && hours(schedule.coldRetard1Start, schedule.coldRetard1End) < 1;
  const shortSecond = schedule.coldRetard2Start && schedule.coldRetard2End
    && hours(schedule.coldRetard2Start, schedule.coldRetard2End) < 1;
  if (shortFirst || shortSecond) {
    schedule = {...schedule};
    if (shortFirst) {
      schedule.coldRetard1Start = null;
      schedule.coldRetard1End = null;
    }
    if (shortSecond) {
      schedule.finalProofStart = schedule.coldRetard2Start!;
      schedule.coldRetard2Start = null;
      schedule.coldRetard2End = null;
      schedule.rtWarmupStart = null;
      schedule.rtWarmupEnd = null;
    }
    schedule.coldRetardStart = schedule.coldRetard1Start ?? schedule.coldRetard2Start;
    schedule.coldRetardEnd = schedule.coldRetard2End ?? schedule.coldRetard1End;
    if (!schedule.coldRetardStart) {
      schedule.restRtHours = 0;
      schedule.coldExitConflict = null;
    }
  }
  const coldHours = schedule.coldRetard2Start
    ? hours(schedule.coldRetard1Start, schedule.coldRetard1End)
      + hours(schedule.coldRetard2Start, schedule.coldRetard2End)
    : hours(schedule.coldRetardStart, schedule.coldRetardEnd);
  return {
    ...schedule,
    bulkFermHours: hours(schedule.bulkFermStart, schedule.coldRetard1Start ?? schedule.divideBallTime),
    finalProofHours: hours(schedule.finalProofStart, schedule.bakeStart),
    restRtHours: schedule.restRtHours > 0
      ? hours(schedule.coldRetardEnd, schedule.finalProofStart) : 0,
    coldRetardHours: coldHours,
    totalColdHours: coldHours,
    // Includes handling between cold phases and warmup, not only named proof.
    totalRTHours: Math.max(0, hours(schedule.bulkFermStart, schedule.bakeStart) - coldHours),
  };
}

function buildSchedulePhases(
  startTime: Date,
  eatTime: Date,
  availabilityBlocks: AvailabilityBlock[],
  kitchenTemp: number,
  preheatMin: number,
  mixerType: MixerType = 'hand',
  styleKey: string = 'neapolitan',
  mixingBatches = 1,
  numItems?: number,
  isSourdough = false,
  starterFactor = 1,
): ScheduleResult {
  const bakeTime = new Date(eatTime.getTime() - preheatMin * 60000);
  // Elapsed mixing time is style-dependent (Modernist publishes it per style);
  // see kneadMinFor in data.ts. This drives WHEN bulk fermentation starts and
  // how long the Timeline's mixing block runs.
  //
  // It deliberately does NOT drive friction. mixerFrictionRiseC still uses the
  // mixer's flat kneadMin, because the rise is not proportional to elapsed
  // time across styles: al taglio runs ~20 min yet must come off the mixer
  // below 24 C from 21 C water — under 3 C of rise — because most of that time
  // is low speed either side of a 30 min autolyse, while Neapolitan's 11 min
  // to full development is a measured 6 C. One measured point and one
  // published constraint cannot calibrate a speed-weighted model, so water
  // temperature and ice are left exactly as they were.
  const kneadMin = kneadMinFor(mixerType, styleKey);
  // The autolyse sits BETWEEN the initial and the final mix, so the window
  // from Start Dough to the beginning of bulk is mix + rest + mix. Both the
  // Timeline and the Bake Guide derive the mix start by subtracting
  // mixingDurationH from bulkFermStart, so folding it in here keeps all three
  // agreed — they disagreed once before, see the note at BakeGuide ~896.
  const autolyseMin = autolyseMinFor(mixerType, styleKey);
  const mixWindowMin = (kneadMin + autolyseMin) * mixingBatches;
  // Preserve the exact preparation window; rounding bulk backwards silently
  // removes kneading and makes consumers infer a different mix start.
  const fermStart = new Date(startTime.getTime() + mixWindowMin * 60000);
  const mixingDurationH = mixWindowMin / 60;
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
  // Native levain styles carry a five-hour reference bulk at 22 °C. Keep
  // that independent of the commercial dough minimum. This temperature
  // adjustment is a planning estimate; the protocol still uses rise cues.
  // A baker-chosen starter % scales this bulk (starterBulkFactor, 1 by default).
  const initialBulkH = isSourdough
    ? sourdoughBulkH(styleKey, kitchenTemp) * starterFactor
    : isVeryHot ? 0.5 : isTropical ? 0.75 : 1.5;

  const minCold1H = isTropical ? 2 : 4;
  const minCold2H = 2;
  const divideH = divisionMinutesFor(numItems) / 60;
  const minTwoPhaseWindow = initialBulkH + minCold1H + divideH + minCold2H + minFinalRT + preheatH;
  const isTwoPhase = hasColdRetard && totalWindowH >= minTwoPhaseWindow;

  // Filter blocks overlapping the fermentation window [fermStart, bakeTime)
  const relevantBlocks = availabilityBlocks
    .filter(b => b.from < bakeTime && b.to > fermStart)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  // A fridge spell that covers unavailable time is how the plan bridges it.
  const bridgesUnavailable = (from: Date, to: Date) => relevantBlocks.some(b => b.from < to && b.to > from);

  // Keep a physically ordered fallback when a short window cannot fit a cold
  // phase plus the required room-temperature proof. A duration clamp alone
  // would leave the proof timestamp after bake while reporting zero hours.
  const pureRoomTemperatureFallback = (note: string): ScheduleResult => {
    const displayFermStart = fermStart.getTime() > bakeTime.getTime() ? bakeTime : fermStart;
    const totalH = Math.max(0, (bakeTime.getTime() - displayFermStart.getTime()) / 3600000);
    const rtFinalMaxH = maxFinalProofHours(kitchenTemp, false);
    // The final proof never takes the whole window: in a cool kitchen its cap (5 h)
    // exceeded a short plan and left the dough no first rise before shaping.
    const finalProofH = Math.min(rtFinalMaxH, totalH > minTotalRT ? totalH - minBulkRT : totalH);
    const finalProofStart = new Date(Math.min(
      bakeTime.getTime(),
      displayFermStart.getTime() + Math.max(0, totalH - finalProofH) * 3600000,
    ));
    const divideBallTime = new Date(Math.min(
      bakeTime.getTime(),
      pushOutOfBlockers(finalProofStart, relevantBlocks).getTime(),
    ));
    return accountScheduleTime({
      mixingDurationH,
      bulkFermStart: displayFermStart,
      bulkFermHours: Math.max(0, (finalProofStart.getTime() - displayFermStart.getTime()) / 3600000),
      coldRetardStart: null,
      coldRetardEnd: null,
      coldRetardHours: 0,
      finalProofStart: new Date(Math.max(+displayFermStart, +r15(finalProofStart))),
      finalProofHours: finalProofH,
      restRtHours: 0,
      preheatStart: new Date(bakeTime),
      bakeStart: new Date(eatTime),
      totalRTHours: totalH,
      totalColdHours: 0,
      wasAutoAdjusted: false,
      kitchenTemp,
      coldRetard1Start: null,
      coldRetard1End: null,
      coldRetard2Start: null,
      coldRetard2End: null,
      divideBallTime: new Date(Math.max(+displayFermStart, +r15(divideBallTime))),
      rtWarmupStart: null,
      rtWarmupEnd: null,
      bulkConflict: null,
      coldExitConflict: null,
      scheduleNote: note,
    });
  };

  // ── TWO-PHASE: Tropical AND cold retard AND window >= 16h ────
  if (isTwoPhase) {
    // Bulk fermentation is passive except for the guide's scheduled folds.
    // Preserve its modeled duration; canonical actions below check folds and
    // fridge entry, and the fixed-bake solver moves mixing when required.
    const bulkConflict: ScheduleResult['bulkConflict'] = null;
    const actualBulkH = initialBulkH;
    const coldRetard1Start = new Date(fermStart.getTime() + actualBulkH * 3600000);

    const earliestDivide = new Date(coldRetard1Start.getTime() + minCold1H * 3600000);
    const latestDivide   = new Date(bakeTime.getTime() - (minCold2H + minFinalRT + preheatH) * 3600000);
    const divideIsBlocked = (t: Date) => actionConflicts({ id: 'divide', at: t, end: new Date(+t + divideH * 3600000) }, relevantBlocks)
      || isTimeBlocked(+t + divideH * 3600000, relevantBlocks);
    // Cold time may be spent in portions for these developed pizza doughs.
    // Modernist Pizza Kitchen Manual pp.17,24,41 supports balling before cold
    // proof. Keep the existing bulk/folds and total cold budget. The 15-minute
    // floor separates the two fridge actions; it is not a maturation minimum.
    const flexibleColdSplit = ['neapolitan', 'newyork', 'pizza_romana'].includes(styleKey);
    const searchDivideFrom = relevantBlocks.length && flexibleColdSplit && divideIsBlocked(r15(earliestDivide))
      ? new Date(+coldRetard1Start + 15 * 60000) : earliestDivide;
    let divideBallTime: Date = earliestDivide;
    let availableDivide: Date | null = null;
    let constrainedExit: Date | null = null;
    const naturalExit = r15(new Date(+bakeTime - (rtWarmupH + maxFinalH) * 3600000));
    const maxExit = +bakeTime - (rtWarmupH + minFinalRT) * 3600000;
    if (searchDivideFrom.getTime() <= latestDivide.getTime()) {
      // With constraints, scan the actual quarter-hour timestamps returned below.
      // Shape and the second cold exit are one choice: a clear shaping slot is
      // not useful if it removes the minimum second cold or final proof.
      let scan = relevantBlocks.length ? new Date(Math.ceil(+searchDivideFrom / 900000) * 900000) : new Date(earliestDivide);
      while (scan.getTime() <= latestDivide.getTime()) {
        if (!divideIsBlocked(scan)) {
          // Retain this repair even if the final warming exit cannot fit.
          // A later conflict must not force shaping back into blocked hours.
          if (+scan + (divideH + minCold2H) * 3600000 <= +naturalExit) availableDivide ??= new Date(scan);
          if (!relevantBlocks.length) { divideBallTime = scan; break; }
          const minExit = Math.max(+naturalExit, +scan + (divideH + minCold2H) * 3600000);
          for (let at = Math.ceil(minExit / 900000) * 900000; at <= maxExit; at += 900000) {
            if (!isTimeBlocked(at, relevantBlocks)) { constrainedExit = new Date(at); break; }
          }
          if (constrainedExit) { divideBallTime = scan; break; }
        }
        scan = new Date(scan.getTime() + 15 * 60000);
      }
    }
    if (!constrainedExit && availableDivide) divideBallTime = availableDivide;
    const coldRetard1End = divideBallTime;

    const divideBallDurationH = divideH;

    // Phase 2 starts after divide & ball
    const coldRetard2Start = new Date(+r15(divideBallTime) + divideBallDurationH * 3600000);

    // Passive cold can overlap unavailable time. Only the joint action scan
    // above may move this exit; it preserves both cold phases and final proof.
    let coldRetard2End = constrainedExit ?? new Date(bakeTime.getTime() - rtWarmupH * 3600000 - maxFinalH * 3600000);
    const wasAutoAdjusted = +r15(divideBallTime) !== +r15(earliestDivide) || (constrainedExit != null && +constrainedExit !== +naturalExit);

    // Safety: phase 2 end must not precede start
    if (coldRetard2End.getTime() < coldRetard2Start.getTime()) {
      coldRetard2End = new Date(coldRetard2Start.getTime());
    }

    const rtWarmupStart = coldRetard2End;
    const rtWarmupEnd = new Date(rtWarmupStart.getTime() + rtWarmupH * 3600000);

    if (rtWarmupEnd.getTime() > bakeTime.getTime()) {
      return pureRoomTemperatureFallback(
        'Not enough time for the planned cold phases — room-temperature timing shown; bake later for the full plan.',
      );
    }

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
    // Same rule as the single fridge spell below: two short spells near the
    // minimum window add handling, not cold.
    if (!coldHRequired && !isTropical && !isSourdough && coldH < preferredColdH
      && !bridgesUnavailable(coldRetard1Start, coldRetard2End) && totalColdHours < SHORT_COLD_SPELL_MAX_H + 0.25) {
      return pureRoomTemperatureFallback('Working within your window — pure room temperature fermentation.');
    }

    return accountScheduleTime({
      mixingDurationH,
      bulkFermStart: fermStart,
      bulkFermHours: actualBulkH,
      // Backward compat: map to two-phase ends
      coldRetardStart: r15(coldRetard1Start),
      coldRetardEnd: r15(coldRetard2End),
      coldRetardHours: totalColdHours,
      finalProofStart: r15(finalProofStart),
      finalProofHours: actualFinalProofH,
      restRtHours: 0,
      preheatStart: new Date(bakeTime),
      bakeStart: new Date(eatTime),
      totalRTHours: actualBulkH + rtWarmupH + actualFinalProofH,
      totalColdHours,
      wasAutoAdjusted,
      kitchenTemp,
      // Two-phase fields
      coldRetard1Start: r15(coldRetard1Start),
      coldRetard1End: r15n(coldRetard1End),
      coldRetard2Start,
      coldRetard2End: r15n(coldRetard2End),
      divideBallTime: r15(divideBallTime),
      rtWarmupStart: r15n(rtWarmupStart),
      rtWarmupEnd: r15n(rtWarmupEnd),
      bulkConflict,
      coldExitConflict: null,
      scheduleNote,
    });
  }

  // ── SINGLE PHASE ─────────────────────────────────────────────

  // ── PURE RT: no cold retard for this style ───────────────────
  if (!hasColdRetard) {
    return pureRoomTemperatureFallback(scheduleNote ?? 'Room-temperature fermentation fits this window.');
  }

  // ── SINGLE-PHASE COLD RETARD: style-driven coldH ─────────────
  // Structure: Mix → initial bulk RT → Cold Retard (coldH) → Rest RT → Final Proof → Preheat → Bake
  const INITIAL_BULK_H = initialBulkH;

  // Do not truncate passive bulk when an availability block starts. Fold
  // points and the fridge transfer are checked by canonical availability.
  const bulkConflict: ScheduleResult['bulkConflict'] = null;
  const actualBulkH = INITIAL_BULK_H;

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

  if (coldRetardEnd.getTime() + restH * 3600000 > bakeTime.getTime()) {
    return pureRoomTemperatureFallback(
      'Not enough time for the planned cold phase — room-temperature timing shown; bake later for the full plan.',
    );
  }

  // A window near the minimum leaves only a short fridge spell between bulk and
  // shaping (2–4 h). On the engine's thermal trajectory the dough barely cools
  // in that time, so it adds handling and nothing else: ferment at room
  // temperature instead. Kept for tropical kitchens (cold keeps the dough
  // within limits there), required-cold doughs, sourdough (its own solver) and
  // a fridge spell that bridges unavailable time; long windows keep their full cold.
  if (!coldHRequired && !isTropical && !isSourdough && coldH < preferredColdH && !bridgesUnavailable(coldRetardStart, coldRetardEnd)
    && (coldRetardEnd.getTime() - coldRetardStart.getTime()) / 3600000 < SHORT_COLD_SPELL_MAX_H + 0.25) {
    return pureRoomTemperatureFallback('Working within your window — pure room temperature fermentation.');
  }

  // Did the clamp leave the exit inside a block anyway? With work until 18:00
  // and a bake at 18:00 no exit can clear it — the dough must come out before
  // it bakes. Exclusive edges, same convention as every other blocker test.
  let coldExitConflict: ScheduleResult['coldExitConflict'] = null;
  {
    const exitMs = coldRetardEnd.getTime();
    const hit = relevantBlocks.find(b => exitMs >= b.from.getTime() && exitMs < b.to.getTime());
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

  // Moving shaping beyond the final proof cannot resolve a clash. Keep the
  // viable shaping time so the baker can cover it or choose a later bake.
  const nextAvailableDivision = pushOutOfBlockers(coldRetardEnd, relevantBlocks);
  const divideBallTime = +nextAvailableDivision + divisionMinutesFor(numItems) * 60000 + minFinalRT * 3600000 <= +eatTime
    ? nextAvailableDivision : coldRetardEnd;

  return accountScheduleTime({
    mixingDurationH,
    bulkFermStart: fermStart,
    bulkFermHours: actualBulkH,
    coldRetardStart: r15(coldRetardStart),
    coldRetardEnd: r15(coldRetardEnd),
    coldRetardHours: actualColdH,
    finalProofStart: r15(finalProofStart),
    finalProofHours: finalProofH,
    restRtHours: restH,
    preheatStart: new Date(bakeTime),
    bakeStart: new Date(eatTime),
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
  });
}

// ══════════════════════════════════════════
// 4. RECIPE CALCULATOR
// ══════════════════════════════════════════

/** Existing guide budget, shared by the planner and all consumers. */
/** Shared visible proof/relaxation bounds: never overlap division. */
export function finalProofWindow(schedule: ScheduleResult, numItems = 4): { start: Date; end: Date; hours: number } {
  const rawStart = schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart;
  const divisionEnd = +schedule.divideBallTime + (schedule.divisionMinutes ?? divisionMinutesFor(numItems)) * 60000;
  const start = new Date(Math.max(+rawStart, divisionEnd));
  const end = schedule.rollStart ?? schedule.poachStart ?? schedule.bakeStart;
  return { start, end, hours: Math.max(0, (+end - +start) / 3600000) };
}

export function divisionMinutesFor(numItems = 4): number {
  return 15 + 2 * Math.max(0, (Number.isFinite(numItems) ? Math.floor(numItems) : 4) - 4);
}

/** Build canonical phases, then describe only work with an existing time budget. */
export function buildSchedule(
  startTime: Date, eatTime: Date, availabilityBlocks: AvailabilityBlock[],
  kitchenTemp: number, preheatMin: number, mixerType: MixerType = 'hand',
  styleKey: string = 'neapolitan', numItems?: number, requestedMixingBatches = 1,
  isSourdough = isLevainStyle(styleKey),
  starterFactor = 1,
): ScheduleResult {
  const mixingBatches = Number.isFinite(requestedMixingBatches) ? Math.max(1, Math.min(100, Math.floor(requestedMixingBatches))) : 1;
  const poachMinutes = breadPoachMinutes(styleKey, numItems);
  const fermentationEnd = poachMinutes ? new Date(+eatTime - poachMinutes * 60000) : eatTime;
  // Poaching ends fermentation. For bagels only, derive the dough phases up
  // to that action; the selected oven time remains unchanged.
  const schedule = buildSchedulePhases(startTime, fermentationEnd, availabilityBlocks, kitchenTemp, poachMinutes ? 0 : preheatMin, mixerType, styleKey, mixingBatches, numItems, isSourdough, isSourdough ? starterFactor : 1);
  schedule.divisionMinutes = divisionMinutesFor(numItems);
  const requiredCold = REQUIRED_COLD_MIN_HOURS[styleKey] ?? 0;
  if (requiredCold) {
    // This is the existing supported recipe's minimum cold budget, not a universal
    // biological minimum for every enriched dough. Validate final timestamps.
    schedule.requiredColdHours = requiredCold;
    if (schedule.totalColdHours + 1e-9 < requiredCold) {
      schedule.preparationInvalid = true;
      schedule.coldTimingConflict = { requiredHours: requiredCold, actualHours: schedule.totalColdHours };
      schedule.scheduleNote = `Not enough time: this recipe requires ${requiredCold}h of cold rest; the plan only provides ${formatHoursSchedule(schedule.totalColdHours)}. Start earlier or bake later.`;
    }
  }
  if (!schedule.coldTimingConflict && schedule.scheduleNote?.startsWith('Cold retard shortened')) {
    schedule.scheduleNote = schedule.totalColdHours > 0
      ? `Cold retard shortened to ${formatHoursSchedule(schedule.totalColdHours)} to fit your window — flavour will still develop.`
      : 'No cold rest fits this window; room-temperature timing shown.';
  }
  if (getBreadProtocol(styleKey)?.method !== 'unleavened' && !schedule.coldRetard2Start) {
    const divisionEnd = new Date(+schedule.divideBallTime + schedule.divisionMinutes * 60000);
    if (+schedule.finalProofStart < +divisionEnd) {
      schedule.finalProofStart = new Date(Math.min(+divisionEnd, +schedule.bakeStart));
      schedule.finalProofHours = Math.max(0, (+schedule.bakeStart - +schedule.finalProofStart) / 3600000);
    }
    if (+divisionEnd >= +fermentationEnd) schedule.preparationInvalid = true;
    if (!schedule.coldRetardStart) schedule.bulkFermHours = Math.max(0, (+schedule.divideBallTime - +schedule.bulkFermStart) / 3600000);
  }
  if (styleKey === 'greek_pita') {
    // Greek pita is divided, relaxed, then rolled/docked immediately before
    // cooking. Keep the existing total fermentation window; allocate the
    // covered relaxation explicitly instead of a generic shaped proof.
    const rollMinutes = Math.max(10, Math.ceil((numItems ?? 4) * 2));
    schedule.rollStart = new Date(+eatTime - rollMinutes * 60000);
    schedule.finalProofStart = new Date(+schedule.rollStart - 15 * 60000);
    schedule.divideBallTime = new Date(+schedule.finalProofStart - schedule.divisionMinutes * 60000);
    schedule.finalProofHours = 15 / 60;
    schedule.bulkFermHours = Math.max(0, (+schedule.divideBallTime - +schedule.bulkFermStart) / 3600000);
    if (+schedule.divideBallTime <= +schedule.bulkFermStart) schedule.preparationInvalid = true;
  }
  if (poachMinutes) {
    schedule.poachStart = fermentationEnd;
    schedule.poachMinutes = poachMinutes;
    schedule.bakeStart = new Date(eatTime);
    schedule.preheatStart = new Date(Math.min(+eatTime - preheatMin * 60000, +fermentationEnd));
    schedule.finalProofHours = Math.max(0, (+fermentationEnd - +schedule.finalProofStart) / 3600000);
    schedule.totalRTHours = Math.max(0, (+fermentationEnd - +schedule.bulkFermStart) / 3600000 - schedule.totalColdHours);
    schedule.preparationInvalid = schedule.preparationInvalid || +fermentationEnd - +startTime < BREAD_FERMENTATION_DEFAULTS.bagel.minTotalFermH * 3600000
      || +schedule.bulkFermStart >= +fermentationEnd || +schedule.divideBallTime >= +fermentationEnd
      || +schedule.divideBallTime > +schedule.finalProofStart;
  }
  if (getBreadProtocol(styleKey)?.method === 'unleavened') {
    // Piadina relaxes; it does not ferment. Preserve the requested cooking
    // time and do not create a yeast dose or a fictional maturity window.
    const mixEnd = new Date(+startTime + kneadMinFor(mixerType, styleKey) * mixingBatches * 60000);
    Object.assign(schedule, {
      doughMethod: 'unleavened', preparationInvalid: +eatTime - +startTime < (45 + (mixingBatches - 1) * kneadMinFor(mixerType, styleKey)) * 60000 || +eatTime - +startTime > 2 * 3600000 + (mixingBatches - 1) * kneadMinFor(mixerType, styleKey) * 60000, bulkFermStart: mixEnd, bulkFermHours: 0,
      finalProofStart: mixEnd, finalProofHours: 0,
      restRtHours: Math.max(0, (+eatTime - 10 * 60000 - +mixEnd) / 3600000),
      totalRTHours: 0, totalColdHours: 0, divideBallTime: new Date(+eatTime - 10 * 60000),
      rollStart: new Date(+eatTime - 10 * 60000), divisionMinutes: 10,
      preheatStart: new Date(+eatTime - preheatMin * 60000), bakeStart: new Date(eatTime),
      scheduleNote: 'Unleavened dough: covered rest before rolling and cooking.',
    });
  }
  const actions: AvailabilityAction[] = [];
  const activeMin = kneadMinFor(mixerType, styleKey);
  const restMin = autolyseMinFor(mixerType, styleKey);
  const batchMinutes = activeMin + restMin;
  schedule.mixingBatches = mixingBatches;
  schedule.firstBatchReadyAt = new Date(+startTime + batchMinutes * 60000);
  schedule.batchMixWindows = Array.from({length:mixingBatches}, (_,index) => ({
    start:new Date(+startTime + index * batchMinutes * 60000),
    end:new Date(+startTime + (index + 1) * batchMinutes * 60000),
  }));
  for (const [index, window] of schedule.batchMixWindows.entries()) {
    // Keep first-lot canonical ids; later lots get unique keys so previews and
    // conflict explanations cannot accidentally point back to the first lot.
    const mixId = index === 0 ? 'mix' : `mix-batch-${index + 1}`;
    const preRest=preMixAutolyseMinFor(mixerType,styleKey);
    if(preRest>0&&index===0){
      // Combining flour and water is a 2-minute job: start it on a 5-minute mark
      // (never later than the full rest allows) instead of 7:13–7:15.
      const autolyseAt=Math.floor((+startTime-(preRest+2*mixingBatches)*60000)/300000)*300000;
      actions.push({id:'autolyse',at:new Date(autolyseAt),end:new Date(autolyseAt+2*mixingBatches*60000)});
    }
    const finishId = index === 0 ? 'mix-finish' : `mix-finish-batch-${index + 1}`;
    if (activeMin > 0) {
      const initialMin = restMin > 0 ? Math.min(activeMin, mixerType === 'spiral' ? 3 : 2) : activeMin;
      actions.push({ id: mixId, at: window.start, end: new Date(+window.start + initialMin * 60000) });
      if (restMin > 0 && activeMin > initialMin) actions.push({
        id: finishId, at: new Date(+window.start + (initialMin + restMin) * 60000), end: window.end,
      });
    } else actions.push({id:mixId,at:window.start});
  }
  if (schedule.doughMethod !== 'unleavened' && mixingBatches > 1) {
    // One shared formula: account for the earliest finished lot's full room
    // exposure instead of pretending fermentation waits for the final mix.
    // No model coefficients change; the guide discloses shared timing.
    schedule.totalRTHours += (mixingBatches - 1) * batchMinutes / 60;
  }
  if (+schedule.bulkFermStart > +schedule.finalProofStart || +schedule.bulkFermStart >= +schedule.bakeStart)
    schedule.preparationInvalid = true;
  const foldMinutes = scheduledFoldMinutes(schedule.bulkFermHours, styleKey);
  let foldDelayMs = 0;
  if (mixingBatches > 1 && foldMinutes.length && schedule.doughMethod !== 'unleavened') {
    const firstFoldAt = new Date(+schedule.firstBatchReadyAt + foldMinutes[0] * 60000);
    if (+firstFoldAt < +schedule.bulkFermStart) {
      // The baker cannot fold the first lot while still mixing a later one:
      // every fold waits until the last mix is done, keeping the same spacing.
      foldDelayMs = +schedule.bulkFermStart - +firstFoldAt;
      const lastFoldAt = +schedule.batchMixWindows[mixingBatches - 1].end + foldMinutes[foldMinutes.length - 1] * 60000 + foldDelayMs;
      const bulkEnd = +(schedule.coldRetard1Start ?? schedule.divideBallTime);
      if (lastFoldAt >= bulkEnd) {
        foldDelayMs = 0;
        schedule.batchTimingConflict = {firstFoldAt, mixingEnd:schedule.bulkFermStart};
        schedule.preparationInvalid = true;
      }
    }
  }
  for (const [batchIndex, window] of schedule.batchMixWindows.entries()) {
    foldMinutes.forEach((minutes, index) => {
      actions.push({ id: `fold-${index + 1}${batchIndex ? `-batch-${batchIndex + 1}` : ''}`,
        at: new Date(+window.end + minutes * 60000 + foldDelayMs) });
    });
  }
  const point = (id: string, at: Date | null) => { if (at) actions.push({ id, at }); };
  point('cold-in', schedule.coldRetard1Start);
  point('cold-out', schedule.coldRetard1End);
  actions.push({ id: 'divide', at: schedule.divideBallTime,
    end: new Date(+schedule.divideBallTime + schedule.divisionMinutes! * 60000),
  });
  point('cold-in-2', schedule.coldRetard2Start);
  point('cold-out-2', schedule.coldRetard2End);
  // This acknowledgement changes availability only. Keep all phase timestamps
  // and solver scans identical; bulk removal followed by balling is not eligible.
  const finalRemoval = actions.find(action => action.id === 'cold-out-2');
  if (finalRemoval && schedule.coldRetard2Start
    && +schedule.divideBallTime + schedule.divisionMinutes! * 60000 <= +schedule.coldRetard2Start
    && +schedule.coldRetard2Start < +finalRemoval.at && +finalRemoval.at < +schedule.bakeStart) {
    finalRemoval.fridgeRemovalBake = +schedule.bakeStart;
  }
  if (schedule.poachStart) actions.push({ id: 'poach', at: schedule.poachStart, end: schedule.bakeStart });
  if (schedule.rollStart) actions.push({ id: 'roll', at: schedule.rollStart!, end: new Date(eatTime) });
  point('preheat', schedule.preheatStart);
  const activeCookMinutes = breadActiveCookMinutes(styleKey, numItems);
  if (activeCookMinutes) {
    schedule.activeCookMinutes = activeCookMinutes;
    actions.push({ id: 'bake', at: schedule.bakeStart, end: new Date(+schedule.bakeStart + activeCookMinutes * 60000) });
  } else point('bake', schedule.bakeStart);
  schedule.availabilityActions = actions;
  schedule.availabilityConflicts = findAvailabilityConflicts(actions, availabilityBlocks);
  if (schedule.coldExitConflict && !schedule.availabilityConflicts.some(conflict => conflict.action.id === 'cold-out')) {
    schedule.coldExitConflict = null;
  }
  if (finalRemoval?.fridgeRemovalBake !== undefined) {
    const overlapping = availabilityBlocks.filter(block => +block.from <= +finalRemoval.at && +finalRemoval.at < +block.to);
    schedule.fridgeRemovalArranged = overlapping.length > 0 && overlapping.every(block => isFridgeRemovalCovered(finalRemoval, block));
  }
  return schedule;
}

/** The two storage intervals describe bulk and shaped dough independently.
 * Either interval can be absent when a short refrigerator visit was removed. */
export function hasCoherentScheduleShape(schedule: ScheduleResult, start: Date): boolean {
  const bake = +schedule.bakeStart;
  const ordered = schedule.doughMethod === 'unleavened'
    ? [start, schedule.bulkFermStart, schedule.divideBallTime, schedule.bakeStart]
    : [start, schedule.bulkFermStart, schedule.divideBallTime, schedule.finalProofStart, schedule.bakeStart];
  if (ordered.some((at,index) => !Number.isFinite(+at) || (index > 0 && +at < +ordered[index-1]))) return false;
  if (schedule.poachStart && (+schedule.finalProofStart > +schedule.poachStart || +schedule.divideBallTime >= +schedule.poachStart)) return false;
  const stages = [[schedule.coldRetard1Start,schedule.coldRetard1End],[schedule.coldRetard2Start,schedule.coldRetard2End]];
  for (const [from,to] of stages) {
    if (!from && !to) continue;
    if (!from || !to || !Number.isFinite(+from) || !Number.isFinite(+to)
      || +from < +schedule.bulkFermStart || +to > bake || +to - +from < 3600000) return false;
  }
  if (schedule.coldRetard1End && +schedule.coldRetard1End > +schedule.divideBallTime) return false;
  if (schedule.coldRetard2Start && +schedule.coldRetard2Start < +schedule.divideBallTime) return false;
  if (schedule.coldRetard2End && +schedule.coldRetard2End > +schedule.finalProofStart) return false;
  return (schedule.availabilityActions ?? []).every(action =>
    Number.isFinite(+action.at) && +action.at <= bake
    && (!action.end || (+action.end >= +action.at && +action.end <= bake + (action.id === 'bake' ? schedule.activeCookMinutes ?? 0 : 0) * 60000)));
}

export interface ScheduleRepairInput {
  isSourdough?: boolean;
  startTime: Date;
  eatTime: Date;
  availabilityBlocks: AvailabilityBlock[];
  kitchenTemp: number;
  preheatMin: number;
  mixerType?: MixerType;
  numItems?: number;
  mixingBatches?: number;
  styleKey?: string;
  /** Levain bulk multiplier for a baker-chosen starter % (starterBulkFactor). */
  starterFactor?: number;
  /** Supply the planning clock explicitly for reproducible candidate checks. */
  now?: Date;
  allowStartShift?: boolean;
  /** Candidate mix window for the selected method, expressed as absolute time. */
  mixWindow?: (bake: Date) => {from: Date; to: Date};
  /** Method-specific constraints are checked for every candidate, not only the first. */
  acceptCandidate?: (candidate: { startTime: Date; eatTime: Date; schedule: ScheduleResult }) => boolean;
}
export interface ScheduleRepair {
  startTime: Date;
  eatTime: Date;
  schedule: ScheduleResult;
  kind: 'start' | 'bake';
}

/** An explicit proposal only: callers must never apply it without a user action.
 * Validates known dough actions, not untimed preferment work or starter biology.
 * Callers must additionally validate their selected preferment/starter plan.
 */
export function findScheduleRepair(input: ScheduleRepairInput): ScheduleRepair | null {
  const { startTime, eatTime, availabilityBlocks, kitchenTemp, preheatMin } = input;
  const mixer = input.mixerType ?? 'hand', style = input.styleKey ?? 'neapolitan';
  const now = +(input.now ?? new Date());
  if (![+startTime, +eatTime, now, kitchenTemp, preheatMin].every(Number.isFinite)
      || +startTime < now || +startTime >= +eatTime || preheatMin < 0) return null;
  const build = (start: Date, bake: Date) => buildSchedule(start, bake, availabilityBlocks, kitchenTemp, preheatMin, mixer, style, input.numItems, input.mixingBatches, input.isSourdough, input.starterFactor ?? 1);
  const original = build(startTime, eatTime);
  const valid = (schedule: ScheduleResult, start: Date, bake: Date) =>
    +schedule.bakeStart === +bake && hasCoherentScheduleShape(schedule, start)
    && !(STYLE_FERM_DEFAULTS[style]?.coldHRequired && !schedule.coldRetardStart)
    && !schedule.availabilityConflicts?.length && !schedule.bulkConflict && !schedule.coldExitConflict
    && !(schedule.availabilityActions ?? []).some(action => +action.at < now)
    && !schedule.preparationInvalid && (input.acceptCandidate?.({startTime:start, eatTime:bake, schedule}) ?? true);
  if (valid(original,startTime,eatTime)) return null;
  const quarter = 15 * 60000;
  const duration = +eatTime - +startTime;
  const searchAtBake = (bake: Date): ScheduleRepair | null => {
    const later = +bake !== +eatTime;
    const preferredStart = +bake - duration;
    const bounds = input.mixWindow?.(bake);
    const earliest = Math.max(now + 1, bounds ? +bounds.from : preferredStart - 12 * 3600000);
    const latest = Math.min(+bake - 1, bounds ? +bounds.to : preferredStart + 12 * 3600000);
    if (earliest > latest) return null;
    const availableStart = (start: Date) => +start > now && +start < +bake && !isTimeBlocked(start,availabilityBlocks)
      && (!bounds || (+start >= +bounds.from && +start <= +bounds.to));
    // Retain the baker's preparation time when a later bake alone clears the conflict.
    if (later && availableStart(startTime)) {
      const schedule = build(startTime,bake);
      if (valid(schedule,startTime,bake)) return {startTime,eatTime:bake,schedule,kind:'bake'};
    }
    if (input.allowStartShift === false) return null;
    const first = Math.ceil(earliest / quarter) * quarter, last = Math.floor(latest / quarter) * quarter;
    if (first > last) return null;
    const center = Math.min(last, Math.max(first, Math.round(preferredStart / quarter) * quarter));
    const maxShift = Math.max(center - first, last - center) / quarter;
    for (let step = 0; step <= maxShift; step++) {
      for (const direction of step === 0 ? [0] : [-1, 1]) {
        const start = new Date(center + direction * step * quarter);
        if (+start < first || +start > last || +start === +startTime || !availableStart(start)) continue;
        const schedule = build(start, bake);
        if (valid(schedule,start,bake)) return {startTime:start,eatTime:bake,schedule,kind:later?'bake':'start'};
      }
    }
    return null;
  };
  for (let step = 0; step <= 72 * 4; step++) {
    const bake = new Date(+eatTime + step * quarter);
    if (isTimeBlocked(bake,availabilityBlocks) || isTimeBlocked(new Date(+bake - preheatMin * 60000),availabilityBlocks)) continue;
    const candidate = searchAtBake(bake);
    if (candidate) return candidate;
  }
  return null;
}

/** Estimate the exposure between room and fridge temperature. A covered bulk
 * cools as one mass; each shaped piece cools/warms separately. Integrating the
 * existing exponential thermal estimate avoids treating transfers as instant
 * temperature changes. Interpolation of biological rates between the two
 * calibrated endpoints is an estimate, not a measured temperature curve. */
function doughCoolingExposure(schedule: ScheduleResult, count: number, weight: number, hydration: number) {
  const batches = Math.max(1, schedule.batchMixWindows?.length ?? 1);
  const stages = [
    {from:schedule.coldRetard1Start, to:schedule.coldRetard1End, mass:Math.ceil(count / batches) * weight},
    {from:schedule.coldRetard2Start, to:schedule.coldRetard2End, mass:weight},
  ];
  let warmth = 1, correction = 0;
  let cursor = +schedule.bulkFermStart;
  const pieceTau = prefThermalTauMin(weight, hydration) / 60;
  const warmTo = (to: number) => {
    const dt = Math.max(0, (to - cursor) / 3600000);
    const warmed = -Math.expm1(-dt / pieceTau);
    correction -= (1 - warmth) * pieceTau * warmed;
    warmth += (1 - warmth) * warmed;
    cursor = to;
  };
  for (const stage of stages) {
    if (!stage.from || !stage.to || +stage.to <= +stage.from) continue;
    warmTo(+stage.from);
    const tau = prefThermalTauMin(stage.mass, hydration) / 60;
    const duration = (+stage.to - cursor) / 3600000;
    const cooled = -Math.expm1(-duration / tau);
    correction += warmth * tau * cooled;
    warmth *= 1 - cooled;
    cursor = +stage.to;
  }
  warmTo(+schedule.bakeStart);
  correction = Math.min(schedule.totalColdHours, Math.max(-schedule.totalRTHours, correction));
  return {warmHours:schedule.totalRTHours + correction, coldHours:schedule.totalColdHours - correction};
}

export interface RecipeResult {
  saltPct?: number;
  protocolIssue?: 'method' | 'equipment' | 'timing';
  flourParts?: { key: string; name: string; nameFr: string; grams: number; pct: number }[];
  enrichment?: RecipeEnrichment;
  flour: number;
  water: number;
  salt: number;
  yeast: YeastResult | null;       // null for sourdough
  sourdough: SourdoughResult | null;
  oil: number;
  sugar: number;
  waterTemp: number;
  thermal?: {
    idealWaterTemp: number;
    doughTempC: number;
    freeWaterG: number;
    targetDoughTemp: number;
    /** True when the ideal water temperature is outside the practical 2–40 °C range. */
    waterWasClamped: boolean;
    prefermentCooldownHours?: number;
    /** Signed achieved dough temperature minus the requested target (°C). */
    doughTempResidualC: number;
  };
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

/** Mix-to-bake hours at which a chosen IDY dose meets the fermentation target.
 * Inverts the same budget recommendYeast uses, through the real schedule
 * builder and cooling exposure, so the planned timing and the dose agree by
 * construction. `budget` 1 is the target; 1.1 / 0.9 bound the readiness window.
 * Returns null when no window up to 96 h is long enough for so little yeast. */
export function fermentationHoursForYeast(modelIdyPct: number, o: {
  bake: Date; blocks: AvailabilityBlock[]; kitchenTemp: number; preheatMin: number;
  mixerType: MixerType; styleKey: string; numItems: number; itemWeight: number;
  mixingBatches: number; fridgeTemp: number; hydration: number; budget?: number;
}): number | null {
  const target = o.budget ?? 1;
  const reached = (hours: number) => {
    try {
      const schedule = buildSchedule(new Date(+o.bake - hours * 3600000), o.bake, o.blocks, o.kitchenTemp, o.preheatMin, o.mixerType, o.styleKey, o.numItems, o.mixingBatches, false);
      const exposure = doughCoolingExposure(schedule, o.numItems, o.itemWeight, o.hydration);
      return fermentationBudget(modelIdyPct, exposure.warmHours, o.kitchenTemp, exposure.coldHours, o.fridgeTemp);
    } catch { return NaN; }
  };
  const minimum = 2 + o.preheatMin / 60, maximum = 96;
  if (!(modelIdyPct > 0)) return null;
  const longest = reached(maximum);
  if (!(longest >= target)) return null;
  if (reached(minimum) >= target) return minimum;
  let lo = minimum, hi = maximum;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (reached(mid) >= target) hi = mid; else lo = mid;
  }
  return Math.round(hi * 4) / 4;
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
  measuredFlourTemp?: number,              // measured temperature at mixing, °C
  measuredPrefermentTemp?: number,         // measured poolish, biga or levain temperature, °C
  totalFlourTarget?: number,               // bread: total formula flour, preferment included
  yeastPctOverride?: number,               // custom, direct dough: final IDY % chosen by the baker
  starterPctOverride?: number,             // custom, levain: starter % of flour chosen by the baker
): RecipeResult {
  const s = ALL_STYLES[styleKey];
  const oven = (ovenType in OVEN_TYPES)
    ? OVEN_TYPES[ovenType as OvenType]
    : BREAD_OVEN_TYPES[ovenType as BreadOvenType];
  if (!s || !oven) throw new Error('Unknown style or oven');

  // Blend styles (batbout, pain de campagne…) carry their own flours until the
  // baker chooses another in Custom.
  flourBlend = recipeFlourBlend(styleKey, mode, flourBlend);
  const blendProfile: BlendProfile | null = flourBlend
    ? computeBlendProfile(flourBlend)
    : null;

  const breadProtocol = getBreadProtocol(styleKey);
  const unleavened = breadProtocol?.method === 'unleavened';
  const methodKey = yeastType === 'sourdough' ? 'levain' : prefermentType ?? 'none';
  const protocolIssue = breadProtocol && schedule.preparationInvalid ? 'timing' as const
    : breadProtocol && !breadProtocol.equipment.includes(ovenType) ? 'equipment' as const
    : breadProtocol && !breadProtocol.supportedMixers.includes(mixerType) ? 'method' as const
    : breadProtocol && !unleavened && !breadProtocol.supportedPreferments.includes(methodKey as 'none' | 'poolish' | 'biga' | 'levain') ? 'method' as const : undefined;
  if (unleavened) prefermentType = 'none';
  const enrichedFormula = ENRICHED_FORMULAS[styleKey as keyof typeof ENRICHED_FORMULAS];
  const unsupportedEnrichedMethod = !!enrichedFormula && (yeastType === 'sourdough' || !!prefermentType && prefermentType !== 'none');
  // Published direct-dough formula, explicitly marked if a legacy method is incompatible.
  if (enrichedFormula) { prefermentType = 'none'; if (yeastType === 'sourdough') yeastType = 'instant'; }
  // Hydration
  // manualHydration = baker's exact value, zero engine adjustment
  // Otherwise: style baseline + oven + climate + blend — all modes
  // Climate is a physical reality, not a UI mode concept
  const HYDRATION_FLOOR: Record<string, number> = {
    focaccia: 70, bagel: 55, pita: 58, greek_pita: 62, kebab_bread: 60,
    batbout: 60, laffa: 62, piadina: 48, pan_bagnat: 58, ciabatta: 72, panuozzo: 60,
    neapolitan: 56, newyork: 58, roman: 70, pan: 68,
    sourdough: 58, pain_campagne: 68, pain_levain: 70,
    baguette: 65, pain_complet: 68, pain_seigle: 70, pain_au_seigle: 64,
    fougasse: 68, brioche: 52, pain_mie: 55, pain_viennois: 52,
  };
  // Enriched or high-oil styles: fat retains moisture, so oven environment
  // matters less. Apply half the oven hydration delta, rounded to nearest integer.
  // Scientific basis: Modernist Bread Vol. 6 — fat coats gluten strands and
  // reduces water absorption sensitivity to baking environment.
  const ENRICHED_STYLES = new Set([
    'pan', 'fougasse', 'brioche', 'pain_mie', 'pain_viennois',
  ]);
  const isEnriched = ENRICHED_STYLES.has(styleKey) || ['focaccia', 'piadina', 'pan_bagnat', 'laffa'].includes(styleKey);

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

  if (unleavened && !(mode === 'custom' && manualHydration !== undefined)) hydration = s.hydration;
  if (enrichedFormula) hydration = enrichedFormula.water + enrichedFormula.milk * ENRICHMENT_WATER_FRACTIONS.milk + enrichedFormula.eggs * ENRICHMENT_WATER_FRACTIONS.eggs + enrichedFormula.butter * ENRICHMENT_WATER_FRACTIONS.butter;
  // Salt
  const saltPct = enrichedFormula ? enrichedFormula.salt : mode === 'custom' && manualSalt !== undefined
    ? manualSalt
    : s.salt;

  // Oil and sugar
  const oil = enrichedFormula ? 0 : mode === 'custom' && manualOil !== undefined
    ? manualOil
    : oven.forceOil !== null ? oven.forceOil : s.oil;

  const sugar = enrichedFormula ? enrichedFormula.sugar : mode === 'custom' && manualSugar !== undefined
    ? manualSugar
    : oven.forceSugar !== null ? oven.forceSugar : s.sugar;

  // Quantities — apply waste buffer if set
  const wasteMult = mode === 'custom' && wastePct !== undefined && wastePct > 0
    ? 1 + wastePct / 100
    : 1;
  let totalDough = Math.round(numItems * itemWeight * wasteMult);
  const hydPct = (enrichedFormula ? enrichedFormula.water : hydration) / 100;
  const ingredientRatio = 1 + hydPct + (enrichedFormula ? (enrichedFormula.milk + enrichedFormula.eggs + enrichedFormula.butter) / 100 : 0) + (saltPct + Math.max(0, oil) + Math.max(0, sugar)) / 100;
  const fixedFlour = styleKey in BREAD_STYLES && Number.isFinite(totalFlourTarget) && totalFlourTarget! >= 50 && totalFlourTarget! <= 25000 ? Math.round(totalFlourTarget!) : undefined;
  let flour = fixedFlour ?? Math.round(totalDough / ingredientRatio);
  let water = 0;
  let salt = 0;
  let oilG = 0;
  let sugarG = 0;

  // Water temperature — DDT (Desired Dough Temperature).
  // FDT varies by style: extensible doughs target lower, enriched higher.
  // flourTemp ≈ kitchenTemp (flour stored at room temperature).
  // The solve itself happens AFTER the preferment is computed — see below —
  // because a cold preferment is 25–55% of the dough mass and the classic
  // 3-factor rule has no term for it.
  const targetFDT = (mode === 'custom' && targetDoughTemp !== undefined)
    ? targetDoughTemp
    : TARGET_FDT[styleKey] ?? 24;
  const flourTemp = typeof measuredFlourTemp === 'number' && Number.isFinite(measuredFlourTemp)
    ? measuredFlourTemp
    : flourInFridge ? fridgeTemp : kitchenTemp;
  const frictionRiseC = mixerFrictionRiseC(mixerType);

  // Yeast or sourdough
  let yeast: YeastResult | null = null;
  let sourdough: SourdoughResult | null = null;
  let directNeedIDY: number | undefined;   // whole-dough IDY need — feeds preferment dosing

  const autoPriority = null;
  const effectivePriority = manualPriorityOverride ?? null;

  const prefInFridge = prefGoesInFridgeOverride !== undefined
    ? prefGoesInFridgeOverride
    : prefermentType === 'biga' || (prefermentType === 'poolish' && kitchenTemp >= 26);
  let preferment: ReturnType<typeof computePrefermentRecipe> | null = null;

  // Yeast is an additional ingredient; preferment flour/water are already
  // included in the totals. Re-evaluate the existing dosing rules as flour
  // settles, rather than adding yeast on top of the requested batch weight.
  for (let pass = 0; pass < 4; pass++) {
    water = Math.round(flour * hydPct);
    salt = Math.round(flour * saltPct / 100);
    oilG = oil > 0 ? Math.round(flour * oil / 100) : 0;
    sugarG = sugar > 0 ? Math.round(flour * sugar / 100 * 10) / 10 : 0;
    yeast = null;
    sourdough = null;
    directNeedIDY = undefined;

    if (!unleavened && yeastType === 'sourdough') {
      sourdough = sourdoughGuidance(kitchenTemp, flour, feedToMixH, blendProfile?.fermToleranceMultiplier, starterPctOverride);
    } else if (!unleavened) {
      const exposure = doughCoolingExposure(schedule, numItems, itemWeight, hydration);
      yeast = recommendYeast(
        exposure.warmHours,
        kitchenTemp,
        exposure.coldHours,
        fridgeTemp,
        yeastType,
        flour,
        effectivePriority,
        styleKey,
        // The blend step below divides by the tolerance multiplier; multiply
        // here so the recipe shows exactly the amount the baker entered.
        yeastPctOverride !== undefined && (!prefermentType || prefermentType === 'none')
          ? yeastPctOverride * (blendProfile?.fermToleranceMultiplier ?? 1) : undefined,
      );

      // STEP 4 — Apply fermentation tolerance from blend
      if (yeast && blendProfile && blendProfile.fermToleranceMultiplier !== 1.0) {
        let idyPct = yeast.pct / blendProfile.fermToleranceMultiplier;
        idyPct = Math.round(idyPct * 10000) / 10000;
        const rawGrams = Math.max(0.001, flour * idyPct / 100);
        const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
        yeast = {
          ...yeast,
          pct: idyPct,
          grams: Math.round(rawGrams * 1000) / 1000,
          convertedPct: Math.round(idyPct * conversion * 10000) / 10000,
          convertedGrams: Math.round(flour * idyPct * conversion / 100 * 1000) / 1000,
        };
      }

      // Enriched doughs (sugar >= 10 % of flour, brioche): a fixed dose of
      // 1 % instant yeast of flour replaces the temperature model, which gives
      // about 0.3 % and has no calibration for sugar. French brioche recipes use
      // 15-20 g fresh yeast per 500 g flour (3-4 %, i.e. 1-1.3 % instant), sugar
      // above ~5-6 % measurably slows yeast, and no published curve gives a
      // correction factor, so the classic dose is used as it stands. Only the
      // amount changes; the schedule stays the engine's. A baker-entered amount
      // in Custom still wins. The budget comparison measures the model dose,
      // so its "ready early" note does not apply here.
      if (yeast && sugar >= ENRICHED_FIXED_SUGAR_PCT && yeastPctOverride === undefined) {
        const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
        const pct = ENRICHED_FIXED_IDY_PCT;
        const convertedPct = Math.round(pct * conversion * 10000) / 10000;
        const convertedGrams = Math.round(flour * convertedPct / 100 * 1000) / 1000;
        yeast = {
          ...yeast,
          pct,
          grams: Math.round(flour * pct / 100 * 1000) / 1000,
          convertedPct,
          convertedGrams,
          hitMinFloor: flour * pct / 100 < 0.5,
          maxDosableRTH: null,
          scaleNeeded: convertedGrams < 0.5 ? 'Precision scale (0.1g accuracy) required' : 'Standard kitchen scale is fine',
          warnings: yeast.warnings.filter(w => w.key !== 'fermentationBudget' && w.key !== 'doseFloorRT'),
          fixedEnrichedDose: true,
        };
      }
      // Sugar concentration, strain and water availability all affect leavening.
      // A universal 20% dose increase at 2% flour-basis sugar isn't warranted.
      // The fixed enriched dose above already accounts for its sugar.
      if (yeast && sugar > 5 && !yeast.fixedEnrichedDose) {
        yeast = {...yeast, osmoticStress:true, warnings:[...yeast.warnings,{key:'osmoticStress'}]};
      }
      // Whole-dough leavening requirement (direct-engine IDY grams), captured
      // BEFORE any preferment reduction — this is what the preferment must
      // ultimately deliver, and drives fraction-independent preferment dosing.
      directNeedIDY = yeast ? yeast.grams : undefined;

      // Apply yeast reduction from preferment
      if (yeast && prefermentType && prefermentType !== 'none') {
        const prefData = PREFERMENT_TYPES[prefermentType];
        if (prefData.yeastReduction > 0) {
          const newGrams = Math.max(0.001, yeast.grams * (1 - prefData.yeastReduction));
          const newConvertedGrams = Math.max(0.001, yeast.convertedGrams * (1 - prefData.yeastReduction));
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

    }

    // Compute preferment recipe — climate-aware
    preferment = (yeastType !== 'sourdough' && prefermentType && prefermentType !== 'none' && prefermentType !== 'levain')
      ? computePrefermentRecipe(
          prefermentType, flour, water,
          kitchenTemp, fridgeTemp, prefInFridge,
          flourPctOverride,
          yeastType,
          prefActualHours,
          directNeedIDY,
        )
      : null;

    // Do not change the pending sourdough model: starter flour and water
    // remain part of the formula totals, not an additional yeast mass.
    const addedYeast = yeastType === 'sourdough' ? 0
      : preferment ? preferment.prefYeastGrams : yeast?.convertedGrams ?? 0;
    if (fixedFlour !== undefined) { totalDough = Math.round(flour * ingredientRatio + addedYeast); break; }
    const nextFlour = Math.round((totalDough - addedYeast) / ingredientRatio);
    if (nextFlour === flour || pass === 3) break;
    flour = nextFlour;
  }

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
  let prefTempC = kitchenTemp;
  let prefermentCooldownHours = 0;
  if (isFlourPref && preferment) {
    const prefHydPct = PREFERMENT_TYPES[prefermentType as PrefermentType].hydration;
    const conditioningHours = prefInFridge ? requiredPrefWarmupH({
      prefermentType: prefermentType as string,
      prefInFridge, styleKey, kitchenTemp, fridgeTemp,
      mixerType, prefermentFlourPct: flourPctOverride, doughMassG: numItems * itemWeight,
      hydrationPct: manualHydration ?? s.hydration, flourTempC: flourTemp,
      targetDoughTemp: mode === 'custom' ? targetDoughTemp : undefined,
    }) : prefermentType === 'poolish' ? schedule.prefermentCooldownHours ?? 0 : 0;
    if (!prefInFridge) prefermentCooldownHours = conditioningHours;
    prefTempC = prefTempAfterWarmup(
      preferment.prefFlour + preferment.prefWater, prefHydPct,
      prefInFridge ? fridgeTemp : kitchenTemp, prefInFridge ? kitchenTemp : fridgeTemp, conditioningHours,
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
  // bowl defaults to room temperature. A measured temperature overrides that
  // assumption for the actual ingredient going into the bowl.
  //
  // The preferment channel is a single bucket, so this only applies when there
  // is no poolish or biga — the same guard the recipe card uses for sdActive.
  const levainForBalance = preferment == null ? sourdough : null;
  const levainInBalance = levainForBalance != null;
  const levainHalfG = levainForBalance != null
    ? Math.round(levainForBalance.starterGramsMid / 2)
    : 0;

  const thermal = solveWaterTempEnthalpy({
    targetFDT, kitchenTemp, flourTemp, friction: frictionRiseC,
    flourG: flour, waterG: water, saltG: salt,
    prefFlourG: levainInBalance ? levainHalfG : (preferment && isFlourPref ? preferment.prefFlour : 0),
    prefWaterG: levainInBalance ? levainHalfG : (preferment && isFlourPref ? preferment.prefWater : 0),
    prefTempC: typeof measuredPrefermentTemp === 'number' && Number.isFinite(measuredPrefermentTemp)
      ? measuredPrefermentTemp
      : levainInBalance ? kitchenTemp : prefTempC,
  });
  const waterTemp = thermal.waterTemp;
  const enrichment: RecipeEnrichment | undefined = enrichedFormula ? {
    milk: Math.round(flour * enrichedFormula.milk / 100),
    eggs: Math.round(flour * enrichedFormula.eggs / 100),
    butter: Math.round(flour * enrichedFormula.butter / 100),
    waterEquivalent: 0,
    waterFractions: ENRICHMENT_WATER_FRACTIONS,
    sourceUrl: enrichedFormula.sourceUrl, formulaVersion: enrichedFormula.formulaVersion,
    unsupportedMethod: unsupportedEnrichedMethod,
    note: enrichmentNote(styleKey, !!yeast?.fixedEnrichedDose, enrichedFormula.eggs > 0),
  } : undefined;
  if (enrichment) enrichment.waterEquivalent = water + enrichment.milk * .87 + enrichment.eggs * .75 + enrichment.butter * .16;
  // All flour-strength, preferment and sugar modifiers have now settled.
  if (yeast) yeast = {...yeast, dilutionTip: commercialDilution(yeast.convertedGrams, water)};

  let flourParts: RecipeResult['flourParts'];
  if (flourBlend) {
    const hasSecond = !!flourBlend.flour2 && flourBlend.ratio1 < 100;
    const hasThird = hasSecond && !!flourBlend.flour3 && flourBlend.ratio2 !== undefined
      && flourBlend.ratio1 + flourBlend.ratio2 < 100;
    const components = [
      { key: flourBlend.flour1, pct: hasSecond ? flourBlend.ratio1 : 100, custom: flourBlend.brandProduct },
      ...(hasSecond ? [{ key: flourBlend.flour2!, pct: hasThird ? flourBlend.ratio2! : 100 - flourBlend.ratio1, custom: flourBlend.customFlour2Name }] : []),
      ...(hasThird ? [{ key: flourBlend.flour3!, pct: 100 - flourBlend.ratio1 - flourBlend.ratio2!, custom: flourBlend.customFlour3Name }] : []),
    ];
    const primaryFlour = preferment?.prefFlour ?? (sourdough ? Math.round(sourdough.starterGramsMid / 2) : 0);
    const addedFlour = flour - primaryFlour;
    let remaining = addedFlour;
    flourParts = components.map((part, index) => {
      const grams = index === components.length - 1 ? remaining : Math.round(addedFlour * part.pct / 100);
      remaining -= grams;
      const definition = FLOUR_DATA[part.key];
      return { key: part.key, name: part.custom ?? definition.name, nameFr: part.custom ?? definition.nameFr, grams: grams + (index === 0 ? primaryFlour : 0), pct: primaryFlour ? (grams + (index === 0 ? primaryFlour : 0)) / flour * 100 : part.pct };
    });
  }

  return {
    flour, water, salt, saltPct, yeast, sourdough, enrichment, protocolIssue, flourParts,
    oil: oilG, sugar: sugarG,
    waterTemp, thermal: enrichment ? undefined : {
      idealWaterTemp: thermal.idealWaterTemp,
      doughTempC: thermal.doughTempC,
      freeWaterG: thermal.freeWaterG,
      targetDoughTemp: targetFDT,
      prefermentCooldownHours,
      waterWasClamped: Math.abs(thermal.idealWaterTemp - thermal.waterTemp) > 0.1,
      doughTempResidualC: thermal.doughTempC - targetFDT,
    }, hydration, totalDough,
    autoPriority,
    wastePct: mode === 'custom' && wastePct !== undefined && wastePct > 0 ? wastePct : undefined,
    targetDoughTemp: mode === 'custom' && targetDoughTemp !== undefined ? targetDoughTemp : undefined,
    blendProfile: blendProfile ?? undefined,
    preferment,
  };
}

/** Short provenance note for an enriched formula, in both languages. */
function enrichmentNote(styleKey: string, fixedDose: boolean, eggs: boolean): { en: string; fr: string } {
  const ownRatios = styleKey === 'pain_mie';
  const en = [
    ownRatios ? 'Sandwich-loaf ratios: half water, half milk, butter and a little sugar; direct commercial-yeast version.' : 'Published ingredient ratios; direct commercial-yeast version.',
    fixedDose ? 'Yeast is the usual enriched-dough amount; timing is the app’s estimate, not the source schedule.' : 'Yeast and timing are app estimates, not the source schedule.',
    `Hydration includes estimated water in ${eggs ? 'milk, eggs and butter' : 'milk and butter'}.`,
    'Ingredient temperatures are not modelled.',
    ...(eggs ? ['Weigh eggs without shells; egg wash is separate.'] : []),
  ];
  const fr = [
    ownRatios ? 'Proportions du pain de mie : moitié eau, moitié lait, beurre et un peu de sucre ; version directe à levure boulangère.' : 'Proportions publiées ; version directe à levure boulangère.',
    fixedDose ? 'Levure à la dose habituelle des pâtes enrichies ; durées estimées par l’application, différentes du planning source.' : 'Levure et durées estimées par l’application, différentes du planning source.',
    `Hydratation incluant l’eau estimée ${eggs ? 'du lait, des œufs et du beurre' : 'du lait et du beurre'}.`,
    'Températures de ces ingrédients non modélisées.',
    ...(eggs ? ['Pesez les œufs sans coquille ; dorure à part.'] : []),
  ];
  return { en: en.join(' '), fr: fr.join(' ') };
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
  return `${days[d.getDay()]} ${formatClock(d, locale ?? 'en')}`;
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

export function hoursLabel(h: number, locale = 'en'): string {
  return formatDuration(h, locale);
}
