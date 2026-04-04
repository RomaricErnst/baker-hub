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
  computeBlendProfile,
  computePrefermentRecipe,
  PREFERMENT_TYPES,
  type OvenType,
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
  hitMinFloor: boolean;  // true when 0.5g IDY floor was applied
  recommendPoolish: boolean;
  notRecommended: boolean;
  explanation: string;
  warnings: string[];
  osmoticStress: boolean; // true when sugar > 2% — yeast amount increased 20%
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

  // Absolute 0.5g IDY floor — never output less than this
  const YEAST_FLOOR_GRAMS = 0.5;
  let rawGrams = flour * rec / 100;
  const hitMinFloor = rawGrams < YEAST_FLOOR_GRAMS;
  if (hitMinFloor) {
    rawGrams = YEAST_FLOOR_GRAMS;
    rec = rawGrams / flour * 100;
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
    hitMinFloor,
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
  scheduleNote: string | null;
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

const STYLE_FERM_DEFAULTS: Record<string, { coldH: number; rtH: number; coldHRequired?: boolean }> = {
  // Pizza — sweet spot = coldH + rtH (where dough peaks at bake)
  neapolitan:    { coldH: 24, rtH: 2 },                          // sweet: 26h
  newyork:       { coldH: 24, rtH: 2 },                          // sweet: 26h
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
  const restH     = restRtMinutes(kitchenTemp) / 60;
  const maxFinalH = maxFinalProofHours(kitchenTemp);

  // ── Style-aware cold retard model ────────────────────────────
  const styleFerm = STYLE_FERM_DEFAULTS[styleKey] ?? { coldH: 0 };
  const preferredColdH = styleFerm.coldH;
  const coldHRequired = styleFerm.coldHRequired === true;

  const isTropical = kitchenTemp >= 28;
  const isVeryHot  = kitchenTemp >= 30;

  // RT minimums (climate-aware)
  const minBulkRT  = isTropical ? 0.5 : 1.5;
  const minFinalRT = 1.0;
  const minTotalRT = minBulkRT + minFinalRT + preheatH;

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

  // Schedule note (first match wins)
  let scheduleNote: string | null = null;
  if (coldHRequired && isTropical) {
    scheduleNote = `🧈 Butter needs the cold — fridge retard is mandatory at ${kitchenTemp}°C`;
  } else if (hasColdRetard && coldH < preferredColdH) {
    scheduleNote = `⏱ Short window — cold retard reduced to ${formatHoursSchedule(coldH)} to fit your schedule`;
  } else if (!hasColdRetard && preferredColdH > 0) {
    scheduleNote = `🌡️ Tight schedule — pure room temperature fermentation`;
  } else if (isTropical && !hasColdRetard) {
    scheduleNote = `🌴 Tropical kitchen — reduced fermentation times applied`;
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
      Math.max(0, (bakeTime.getTime() - finalProofStart.getTime()) / 3600000)
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

  const actualColdH = Math.max(0,
    (coldRetardEnd.getTime() - coldRetardStart.getTime()) / 3600000
  );

  const finalProofStart = new Date(coldRetardEnd.getTime() + restH * 3600000);
  const finalProofH = Math.min(
    maxFinalH,
    Math.max(0, (bakeTime.getTime() - finalProofStart.getTime()) / 3600000)
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
  blendProfile?: BlendProfile;
  preferment?: {
    prefFlour: number;
    prefWater: number;
    prefYeastGrams: number;
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
  ovenType: OvenType,
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
): RecipeResult {
  const s = ALL_STYLES[styleKey];
  const oven = OVEN_TYPES[ovenType];
  if (!s || !oven) throw new Error('Unknown style or oven');

  const blendProfile: BlendProfile | null = flourBlend
    ? computeBlendProfile(flourBlend)
    : null;

  // Hydration
  let hydration: number;
  if (mode === 'custom' && manualHydration !== undefined) {
    hydration = manualHydration; // never auto-adjust in advanced
  } else if (mode === 'custom' && blendProfile) {
    // Apply blend's hydration delta on top of style baseline + oven delta
    hydration = s.hydration + oven.hydrationDelta + blendProfile.hydrationDelta;
  } else {
    hydration = s.hydration + oven.hydrationDelta;
    // Climate adjustment (guided only)
    if (kitchenTemp >= 28 || humidity === 'very-humid') hydration -= 2;
    else if (kitchenTemp <= 18) hydration += 2;
  }

  // STEP 3 — Apply hydration delta from blend
  if (blendProfile) {
    const delta = Math.max(-5, Math.min(8, blendProfile.hydrationDelta));
    hydration = Math.round((hydration + delta) * 10) / 10;
  }

  // Oil and sugar
  const oil = mode === 'custom' && manualOil !== undefined
    ? manualOil
    : oven.forceOil !== null ? oven.forceOil : s.oil;

  const sugar = mode === 'custom' && manualSugar !== undefined
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

  // Water temperature — DDT method (Desired Dough Temperature)
  // Formula: waterTemp = (FDT × 3) - flourTemp - kitchenTemp - frictionFactor
  // flourTemp ≈ kitchenTemp (flour stored at room temperature)
  // FDT varies by style: extensible doughs target lower, enriched higher
  const TARGET_FDT: Record<string, number> = {
    neapolitan: 23, newyork: 24, roman: 25, pan: 25,
    sourdough: 24, pain_campagne: 24, pain_levain: 24,
    baguette: 24, pain_complet: 24, pain_seigle: 24,
    fougasse: 25, brioche: 22, pain_mie: 24, pain_viennois: 23,
  };
  const targetFDT = TARGET_FDT[styleKey] ?? 24;
  const frictionFactor = MIXER_TYPES[mixerType]?.frictionFactor ?? 3;
  const waterTemp = Math.max(2, Math.min(40,
    targetFDT * 3 - kitchenTemp - kitchenTemp - frictionFactor
  ));

  // Yeast or sourdough
  let yeast: YeastResult | null = null;
  let sourdough: SourdoughResult | null = null;

  const autoPriority = derivePriority(schedule);
  const effectivePriority = manualPriorityOverride !== undefined ? manualPriorityOverride : autoPriority;

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
      effectivePriority
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

    // Apply yeast reduction from preferment
    if (yeast && prefermentType && prefermentType !== 'none') {
      const prefData = PREFERMENT_TYPES[prefermentType];
      if (prefData.yeastReduction > 0) {
        yeast = {
          ...yeast,
          grams: Math.max(0.5, yeast.grams * (1 - prefData.yeastReduction)),
          convertedGrams: Math.max(0.5, yeast.convertedGrams * (1 - prefData.yeastReduction)),
        };
      }
    }

    // Osmotic stress correction — sugar > 2% slows yeast
    if (yeast && sugarG > 2) {
      yeast = {
        ...yeast,
        grams: Math.round(yeast.grams * 1.2 * 1000) / 1000,
        convertedGrams: Math.round(yeast.convertedGrams * 1.2 * 1000) / 1000,
        osmoticStress: true,
        warnings: [...yeast.warnings, 'Sugar above 2% creates osmotic stress — yeast amount increased 20%. Consider SAF Gold osmotolerant yeast for best results.'],
      };
    }
  }

  // Compute preferment recipe
  const preferment = (prefermentType && prefermentType !== 'none')
    ? computePrefermentRecipe(prefermentType, flour, water, flourPctOverride)
    : null;

  return {
    flour, water, salt, yeast, sourdough,
    oil: oilG, sugar: sugarG,
    waterTemp, hydration, totalDough,
    autoPriority,
    blendProfile: blendProfile ?? undefined,
    preferment,
  };
}

export function prefermentLeadHours(prefermentType: PrefermentType): number {
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

export function formatTime(d: Date): string {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toDateTimeLocal(d: Date): string {
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
