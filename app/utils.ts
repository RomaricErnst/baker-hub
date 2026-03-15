// ══════════════════════════════════════════
// BAKER HUB — Utils & Engine
// ══════════════════════════════════════════
// Contains:
//   1. Yeast Engine (lookup table)
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
// Lookup table validated against:
// - PizzaBlab (primary source)
// - dough.school reference table
// - CrustKingdom tested values
// - Craig's Baker's Yeast Prediction Model
//
// All values = Instant Dry Yeast (IDY) % of flour
// null = not recommended at this combination
// ══════════════════════════════════════════

const RT_TABLE: Record<number, Record<number, number | null>> = {
   2: {18:1.20, 20:1.00, 22:0.80, 25:0.50, 28:0.30, 30:0.20},
   4: {18:0.60, 20:0.45, 22:0.35, 25:0.20, 28:0.12, 30:0.08},
   6: {18:0.35, 20:0.25, 22:0.18, 25:0.10, 28:0.06, 30:0.04},
   8: {18:0.20, 20:0.14, 22:0.10, 25:0.06, 28:0.04, 30:0.03},
  12: {18:0.10, 20:0.07, 22:0.05, 25:0.03, 28:0.02, 30:0.015},
  18: {18:0.06, 20:0.04, 22:0.03, 25:0.018,28:0.012,30:0.010},
  24: {18:0.04, 20:0.025,22:0.018,25:0.010,28:0.008,30:0.006},
  30: {18:0.025,20:0.015,22:0.012,25:0.006,28:null, 30:null },
  36: {18:0.015,20:0.010,22:0.008,25:null, 28:null, 30:null },
};

const COLD_TABLE: Record<number, number> = {
  12: 0.25,
  24: 0.12,
  36: 0.08,
  48: 0.06,
  60: 0.04,
  72: 0.03,
  96: 0.02,
  120: 0.015,
};

const TEMPS    = [18, 20, 22, 25, 28, 30];
const HOURS_RT = [2, 4, 6, 8, 12, 18, 24, 30, 36];
const HOURS_COLD = [12, 24, 36, 48, 60, 72, 96, 120];

// Practical limits
const YEAST_MIN_PCT   = 0.05;   // hard floor for cold ferments
const YEAST_MIN_GRAMS = 0.1;    // minimum weighable on 0.1g scale
const YEAST_RT_MAX_H  = 8;      // max RT hours before poolish recommended

function nearest(val: number, arr: number[]): number {
  return arr.reduce((a, b) =>
    Math.abs(b - val) < Math.abs(a - val) ? b : a
  );
}

function interpolateRT(hours: number, temp: number): number | null {
  const h1 = HOURS_RT.filter(x => x <= hours).pop() ?? HOURS_RT[0];
  const h2 = HOURS_RT.filter(x => x >= hours)[0] ?? HOURS_RT[HOURS_RT.length - 1];
  const t1 = TEMPS.filter(x => x <= temp).pop() ?? TEMPS[0];
  const t2 = TEMPS.filter(x => x >= temp)[0] ?? TEMPS[TEMPS.length - 1];

  const v11 = RT_TABLE[h1]?.[t1];
  const v12 = RT_TABLE[h1]?.[t2];
  const v21 = RT_TABLE[h2]?.[t1];
  const v22 = RT_TABLE[h2]?.[t2];

  if (v11 === null || v12 === null || v21 === null || v22 === null) return null;
  if (v11 === undefined || v12 === undefined ||
      v21 === undefined || v22 === undefined) return 0.01;

  const fh = h1 === h2 ? 0 : (hours - h1) / (h2 - h1);
  const ft = t1 === t2 ? 0 : (temp - t1) / (t2 - t1);

  return (
    (1 - fh) * ((1 - ft) * v11 + ft * v12) +
    fh       * ((1 - ft) * v21 + ft * v22)
  );
}

// Q10 factor: yeast activity doubles every 10°C
function coldActivityFactor(fridgeTemp: number): number {
  return Math.pow(2.0, (fridgeTemp - 4) / 10);
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

  const temp = Math.max(18, Math.min(30, kitchenTemp));

  if (totalColdHours > 0 && totalRTHours <= 4) {
    // Primarily cold fermentation
    const ch = nearest(Math.max(12, totalColdHours), HOURS_COLD);
    rec = COLD_TABLE[ch] ?? 0.10;
    // Adjust for actual fridge temperature
    const factor = coldActivityFactor(fridgeTemp);
    rec = rec / factor;
    // Floor for cold ferments
    rec = Math.max(YEAST_MIN_PCT, rec);

  } else if (totalColdHours > 0) {
    // Mixed: room temp + cold
    const rtRec = interpolateRT(totalRTHours, temp);
    const ch = nearest(Math.max(12, totalColdHours), HOURS_COLD);
    const coldRec = (COLD_TABLE[ch] ?? 0.10) / coldActivityFactor(fridgeTemp);
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
    const rtRec = interpolateRT(totalRTHours, temp);
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

export interface FermentWindow {
  from: Date;
  to: Date;
  type: 'room_temp' | 'cold';
  hours: number;
}

export interface ScheduleResult {
  rtWindows: FermentWindow[];
  coldWindows: FermentWindow[];
  totalRTHours: number;
  totalColdHours: number;
  wasAutoAdjusted: boolean;
}

function maxRTHours(kitchenTemp: number): number {
  if (kitchenTemp >= 28) return 2;
  if (kitchenTemp >= 25) return 4;
  if (kitchenTemp >= 22) return 6;
  return 8;
}

export function buildSchedule(
  startTime: Date,
  eatTime: Date,
  availabilityBlocks: AvailabilityBlock[],
  kitchenTemp: number,
  preheatMin: number
): ScheduleResult {
  // Adjust eat time backwards for preheat
  const bakeTime = new Date(eatTime.getTime() - preheatMin * 60000);

  // Start with one big room temp window
  let windows: FermentWindow[] = [{
    from: new Date(startTime),
    to: new Date(bakeTime),
    type: 'room_temp',
    hours: (bakeTime.getTime() - startTime.getTime()) / 3600000,
  }];

  // Split by availability blocks → cold periods
  for (const block of availabilityBlocks) {
    const next: FermentWindow[] = [];
    for (const w of windows) {
      if (w.type !== 'room_temp') { next.push(w); continue; }
      if (block.from >= w.to || block.to <= w.from) {
        next.push(w); continue;
      }
      // Split this window around the block
      if (block.from > w.from) {
        next.push({
          from: w.from, to: block.from, type: 'room_temp',
          hours: (block.from.getTime() - w.from.getTime()) / 3600000,
        });
      }
      next.push({
        from: new Date(Math.max(block.from.getTime(), w.from.getTime())),
        to: new Date(Math.min(block.to.getTime(), w.to.getTime())),
        type: 'cold',
        hours: (Math.min(block.to.getTime(), w.to.getTime()) -
                Math.max(block.from.getTime(), w.from.getTime())) / 3600000,
      });
      if (block.to < w.to) {
        next.push({
          from: block.to, to: w.to, type: 'room_temp',
          hours: (w.to.getTime() - block.to.getTime()) / 3600000,
        });
      }
    }
    windows = next;
  }

  // Apply max RT rule — auto-split long RT windows
  let wasAutoAdjusted = false;
  const maxRT = maxRTHours(kitchenTemp);
  const adjusted: FermentWindow[] = [];

  for (const w of windows) {
    if (w.type !== 'room_temp' || w.hours <= maxRT) {
      adjusted.push(w); continue;
    }
    // Split: maxRT hours RT, then cold for the rest
    wasAutoAdjusted = true;
    const splitPoint = new Date(w.from.getTime() + maxRT * 3600000);
    adjusted.push({
      from: w.from, to: splitPoint,
      type: 'room_temp', hours: maxRT,
    });
    adjusted.push({
      from: splitPoint, to: w.to,
      type: 'cold',
      hours: (w.to.getTime() - splitPoint.getTime()) / 3600000,
    });
  }

  const rtWindows   = adjusted.filter(w => w.type === 'room_temp');
  const coldWindows = adjusted.filter(w => w.type === 'cold');
  const totalRTHours   = rtWindows.reduce((s, w) => s + w.hours, 0);
  const totalColdHours = coldWindows.reduce((s, w) => s + w.hours, 0);

  return {
    rtWindows,
    coldWindows,
    totalRTHours,
    totalColdHours,
    wasAutoAdjusted,
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