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
  MIXER_TYPES,
  YEAST_TYPES,
  type OvenType,
  type MixerType,
  type YeastType,
  type StyleKey,
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
  if (temp >= 33 && temp <= 35) return 1.25;
  if (temp >= 30 && temp <= 32) return 1.15;
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

export interface YeastResult {
  pct: number;           // IDY % of flour
  grams: number;         // absolute grams for recipe flour weight
  convertedPct: number;  // % for selected yeast type
  convertedGrams: number;// grams for selected yeast type
  yeastType: YeastType;
  scaleNeeded: string;
  dilutionTip: string | null;
  recommendPoolish: boolean;
  notRecommended: boolean;
  explanation: string;
  warnings: string[];
}

export function recommendYeast(
  totalRTHours: number,
  kitchenTemp: number,
  totalColdHours: number,
  fridgeTemp: number,       // guided = 4, advanced = user input
  yeastType: YeastType,
  flour: number,            // grams — for absolute calculation
  priority: string | null
): YeastResult {
  const warnings: string[] = [];
  let notRecommended = false;
  let recommendPoolish = false;
  let rec: number;

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
      rec = Math.max(YEAST_MIN_PCT, coldRec * 0.7 + rtRec * 0.15);
    }

  } else {
    // Pure room temperature
    if (totalRTHours > YEAST_RT_MAX_H) {
      recommendPoolish = true;
      warnings.push(
        `Room temp fermentation over ${YEAST_RT_MAX_H}h is unpredictable. ` +
        `A Poolish preferment gives you better control and more flavour.`
      );
    }
    const rtRec = rtIDY(totalRTHours, kitchenTemp);
    if (rtRec === null) {
      notRecommended = true;
      warnings.push(
        `${totalRTHours}h at ${kitchenTemp}°C room temp is not recommended — ` +
        `dough will over-ferment. Add a cold fermentation phase.`
      );
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

  // Hot climate warnings
  if (kitchenTemp >= 28 && totalColdHours === 0 && totalRTHours > 4) {
    warnings.push(
      `More than 4h at room temp in a ${kitchenTemp}°C kitchen is risky. ` +
      `Add a cold retard phase or use a Poolish.`
    );
  }

  // Convert to selected yeast type
  const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
  const convertedPct   = Math.round(rec * conversion * 10000) / 10000;
  const grams          = Math.round(flour * rec / 100 * 1000) / 1000;
  const convertedGrams = Math.round(flour * convertedPct / 100 * 1000) / 1000;

  // Scale tip
  const scaleNeeded = convertedGrams < 0.5
    ? 'Precision scale (0.1g accuracy) required'
    : 'Standard kitchen scale is fine';

  // Dilution tip
  let dilutionTip: string | null = null;
  if (convertedGrams < YEAST_MIN_GRAMS) {
    const ratio = Math.ceil(1 / convertedGrams * 10) * 10;
    const waterToUse = Math.round(convertedGrams * ratio * 10) / 10;
    dilutionTip =
      `Dissolve 1g yeast in ${ratio}g water. ` +
      `Use only ${waterToUse}g of that water in your dough.`;
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
    warnings.push(
      `Fridge at ${fridgeTemp}°C is warmer than ideal. ` +
      `Yeast will be more active than a standard 4°C fridge.`
    );
  }

  return {
    pct: rec,
    grams,
    convertedPct,
    convertedGrams,
    yeastType,
    scaleNeeded,
    dilutionTip,
    recommendPoolish,
    notRecommended,
    explanation,
    warnings,
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
  bulkCues: string[];
  warning: string | null;
}

export function sourdoughGuidance(
  kitchenTemp: number,
  flour: number
): SourdoughResult {
  let min: number, max: number;

  if (kitchenTemp >= 28) {
    min = 10; max = 15;
  } else if (kitchenTemp >= 24) {
    min = 15; max = 20;
  } else {
    min = 20; max = 25;
  }

  const bulkCues = [
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

  return {
    starterPctMin: min,
    starterPctMax: max,
    starterGramsMin: Math.round(flour * min / 100),
    starterGramsMax: Math.round(flour * max / 100),
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
  coldRetardStart: Date | null;
  coldRetardEnd: Date | null;
  coldRetardHours: number;
  finalProofStart: Date;
  finalProofHours: number;
  restRtHours: number;
  preheatStart: Date;
  bakeStart: Date;
  totalRTHours: number;   // bulkFermHours + finalProofHours
  totalColdHours: number; // coldRetardHours
  wasAutoAdjusted: boolean;
  kitchenTemp: number;
}

function maxRTHours(kitchenTemp: number): number {
  if (kitchenTemp >= 28) return 2;
  if (kitchenTemp >= 25) return 4;
  if (kitchenTemp >= 22) return 6;
  return 8;
}

function maxFinalProofHours(kitchenTemp: number): number {
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

export function buildSchedule(
  startTime: Date,
  eatTime: Date,
  availabilityBlocks: AvailabilityBlock[],
  kitchenTemp: number,
  preheatMin: number,
  mixerType: MixerType = 'hand',
): ScheduleResult {
  const bakeTime = new Date(eatTime.getTime() - preheatMin * 60000);
  const kneadMin = MIXER_TYPES[mixerType].kneadMin;
  const fermStart = new Date(startTime.getTime() + kneadMin * 60000);
  const mixingDurationH = kneadMin / 60;

  const maxBulkH  = maxRTHours(kitchenTemp);
  const restH     = restRtMinutes(kitchenTemp) / 60;
  const maxFinalH = maxFinalProofHours(kitchenTemp);

  // Filter blocks overlapping the fermentation window [fermStart, bakeTime)
  const relevantBlocks = availabilityBlocks
    .filter(b => b.from < bakeTime && b.to > fermStart)
    .sort((a, b) => a.from.getTime() - b.from.getTime());

  if (relevantBlocks.length === 0) {
    // No cold blocks — all RT fermentation
    const totalH      = Math.max(0, (bakeTime.getTime() - fermStart.getTime()) / 3600000);
    const finalProofH = Math.min(maxFinalH, totalH);
    const bulkFermH   = Math.max(0, totalH - finalProofH);
    const finalProofStart = new Date(fermStart.getTime() + bulkFermH * 3600000);

    return {
      mixingDurationH,
      bulkFermStart: fermStart,
      bulkFermHours: bulkFermH,
      coldRetardStart: null,
      coldRetardEnd: null,
      coldRetardHours: 0,
      finalProofStart,
      finalProofHours: finalProofH,
      restRtHours: 0,
      preheatStart: bakeTime,
      bakeStart: eatTime,
      totalRTHours: totalH,
      totalColdHours: 0,
      wasAutoAdjusted: false,
      kitchenTemp,
    };
  }

  let wasAutoAdjusted = false;

  // Cold retard starts at the first block, but not before fermStart
  let coldRetardStart = new Date(
    Math.max(relevantBlocks[0].from.getTime(), fermStart.getTime())
  );
  let bulkFermH = Math.max(0,
    (coldRetardStart.getTime() - fermStart.getTime()) / 3600000
  );

  // Auto-adjust: cap bulk ferm at maxBulkH
  if (bulkFermH > maxBulkH) {
    wasAutoAdjusted = true;
    coldRetardStart = new Date(fermStart.getTime() + maxBulkH * 3600000);
    bulkFermH = maxBulkH;
  }

  // Cold retard ends at the last block end, no later than bakeTime - restH
  const lastBlockEnd = new Date(
    Math.max(...relevantBlocks.map(b => b.to.getTime()))
  );
  const maxColdEnd = new Date(bakeTime.getTime() - restH * 3600000);
  let coldRetardEnd = new Date(
    Math.min(lastBlockEnd.getTime(), maxColdEnd.getTime())
  );
  if (coldRetardEnd.getTime() < coldRetardStart.getTime()) {
    coldRetardEnd = new Date(coldRetardStart.getTime());
  }

  let coldRetardH = Math.max(0,
    (coldRetardEnd.getTime() - coldRetardStart.getTime()) / 3600000
  );

  // Final proof starts after rest at room temperature
  let finalProofStart = new Date(coldRetardEnd.getTime() + restH * 3600000);
  let finalProofH = Math.max(0,
    (bakeTime.getTime() - finalProofStart.getTime()) / 3600000
  );

  // Cap final proof at maxFinalH — push coldRetardEnd earlier if too long
  if (finalProofH > maxFinalH) {
    wasAutoAdjusted = true;
    finalProofH = maxFinalH;
    finalProofStart = new Date(bakeTime.getTime() - maxFinalH * 3600000);
    coldRetardEnd = new Date(finalProofStart.getTime() - restH * 3600000);
    coldRetardH = Math.max(0,
      (coldRetardEnd.getTime() - coldRetardStart.getTime()) / 3600000
    );
  }

  return {
    mixingDurationH,
    bulkFermStart: fermStart,
    bulkFermHours: bulkFermH,
    coldRetardStart,
    coldRetardEnd,
    coldRetardHours: coldRetardH,
    finalProofStart,
    finalProofHours: finalProofH,
    restRtHours: restH,
    preheatStart: bakeTime,
    bakeStart: eatTime,
    totalRTHours: bulkFermH + finalProofH,
    totalColdHours: coldRetardH,
    wasAutoAdjusted,
    kitchenTemp,
  };
}

// ══════════════════════════════════════════
// 4. RECIPE CALCULATOR
// ══════════════════════════════════════════

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
}

export function calculateRecipe(
  styleKey: StyleKey,
  ovenType: OvenType,
  numItems: number,
  itemWeight: number,
  kitchenTemp: number,
  humidity: string,
  schedule: ScheduleResult,
  fridgeTemp: number,
  yeastType: YeastType,
  priority: string | null,
  mode: 'guided' | 'advanced',
  manualHydration?: number,         // advanced mode only
  manualOil?: number,               // advanced mode only
  manualSugar?: number,             // advanced mode only
): RecipeResult {
  const s = ALL_STYLES[styleKey];
  const oven = OVEN_TYPES[ovenType];
  if (!s || !oven) throw new Error('Unknown style or oven');

  // Hydration
  let hydration: number;
  if (mode === 'advanced' && manualHydration !== undefined) {
    hydration = manualHydration; // never auto-adjust in advanced
  } else {
    hydration = s.hydration + oven.hydrationDelta;
    // Climate adjustment (guided only)
    if (kitchenTemp >= 28 || humidity === 'very-humid') hydration -= 2;
    else if (kitchenTemp <= 18) hydration += 2;
  }

  // Oil and sugar
  const oil = mode === 'advanced' && manualOil !== undefined
    ? manualOil
    : oven.forceOil !== null ? oven.forceOil : s.oil;

  const sugar = mode === 'advanced' && manualSugar !== undefined
    ? manualSugar
    : oven.forceSugar !== null ? oven.forceSugar : s.sugar;

  // Quantities
  const totalDough = numItems * itemWeight;
  const hydPct = hydration / 100;
  const flour  = Math.round(totalDough / (1 + hydPct + s.salt / 100));
  const water  = Math.round(flour * hydPct);
  const salt   = Math.round(flour * s.salt / 100);
  const oilG   = oil   > 0 ? Math.round(flour * oil / 100)   : 0;
  const sugarG = sugar > 0 ? Math.round(flour * sugar / 100 * 10) / 10 : 0;

  // Water temperature (DDT method — target FDT 24°C)
  const frictionFactor = 3; // default stand mixer
  const waterTemp = Math.max(4, Math.min(40,
    24 * 3 - kitchenTemp - kitchenTemp - frictionFactor
  ));

  // Yeast or sourdough
  let yeast: YeastResult | null = null;
  let sourdough: SourdoughResult | null = null;

  if (yeastType === 'sourdough') {
    sourdough = sourdoughGuidance(kitchenTemp, flour);
  } else {
    yeast = recommendYeast(
      schedule.totalRTHours,
      kitchenTemp,
      schedule.totalColdHours,
      fridgeTemp,
      yeastType,
      flour,
      priority
    );
  }

  return {
    flour, water, salt, yeast, sourdough,
    oil: oilG, sugar: sugarG,
    waterTemp, hydration, totalDough,
  };
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

export function formatTime(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toDateTimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

export function hoursLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}