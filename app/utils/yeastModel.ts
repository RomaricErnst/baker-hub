// ══════════════════════════════════════════════════════════════════════════
// Commercial yeast model (19 Nov 2026). One model for every commercial-yeast
// dose and timing in the app: direct dough, cold retard, tropical kitchens,
// poolish and biga, the inverse used for a baker-entered amount, and the
// poolish peak. Sourdough (levain) has its own model and does not use this.
//
//   r(T)  = CTMI(T) / CTMI(25 °C)                      activity relative to 25 °C
//   Heq   = ∫ r(T(t)) dt                               equivalent hours at 25 °C
//           T(t) relaxes to each phase's surroundings: dT/dt = (T_env − T) / τ
//   dose  = A · M · R · Heq^(−b)                       instant yeast, % of the fermenting flour
//           M  medium: salted dough 1, poolish MP, biga MB
//           R  rise target: 1 (doubled, E1), 0.6 when the dough ends above 28 °C (E3)
//
// Every constant, its basis and its residuals: docs/YEAST-MODEL.md. The fit
// script and data are referenced there; tests/yeast-model.test.cjs keeps the
// constants, the data fit and the About page in step.
// ══════════════════════════════════════════════════════════════════════════

/** Cardinal temperatures of the activity curve (°C). */
export const YEAST_T_MAX = 45.4;   // (a) Salvadó et al. 2011, S. cerevisiae Tmax
export const YEAST_T_OPT = 32.3;   // (a) Salvadó et al. 2011, S. cerevisiae Topt (free fit 34 ± 4, not identifiable)
export const YEAST_T_MIN = -0.5;   // (c) fitted: cold-recipe protocols + Nestec cold gas rates
/** Dose law: dose = A · Heq^(−b) for a salted dough doubling (E1). */
export const YEAST_DOSE_A = 2.05;  // (c) fitted, IDY % at 1 h equivalent at 25 °C
export const YEAST_DOSE_B = 1.24;  // (c) fitted, dose–time exponent
/** Medium factors (preferment dose relative to a salted dough at the same Heq, ripe endpoint). */
export const YEAST_MEDIUM_POOLISH = 0.83; // (c) fitted: MP4 KM p. 2, MB6 KM p. 20 and 7 other poolish tables
export const YEAST_MEDIUM_BIGA = 2.67;    // (c) fitted: MB6 KM pp. 19 and 22, Giorilli (via Dissapore)
/** E3: smaller target rise in a warm dough. You Knead Sourdough: 30 % bulk rise at 28 °C+, 50 % below 25 °C. */
export const YEAST_HEAT_RISE = 0.6;        // (a) 30/50, (b) dose ∝ rise target because gas ∝ dose · Heq^b
export const YEAST_HEAT_RISE_FROM_C = 25;  // (a) full target below 25 °C
export const YEAST_HEAT_RISE_TO_C = 28;    // (a) reduced target from 28 °C

export type YeastMedium = 'dough' | 'poolish' | 'biga';

const CP_WATER = 4180;   // J/kg·K
const CP_FLOUR = 1800;   // J/kg·K (dry solids)

/** Lumped-capacitance time constant (hours) of a covered dough or preferment
 * mass in still air, with a Biot correction for the core lagging the skin
 * (the engine's existing thermal estimate, moved here so every path shares it).
 * ~250 g → 1.6 h · ~1 kg → 2.8 h. Lehmann cross-stacks 16–24 oz balls 2–2.5 h. */
export function thermalTauH(massG: number, hydrationPct: number): number {
  const hyd = Math.max(0.2, hydrationPct / 100);
  const waterFrac = hyd / (1 + hyd);
  const cp = waterFrac * CP_WATER + (1 - waterFrac) * CP_FLOUR;
  const rho = 1000;
  const V = Math.max(massG, 1) / 1000 / rho;
  const r = Math.cbrt((3 * V) / (4 * Math.PI));
  const A = 4 * Math.PI * r * r * 0.85;
  const h = 8;
  const k = 0.45;
  const Bi = (h * r) / k;
  return ((rho * V * cp) / (h * A) / 3600) * (1 + Bi / 5);
}

function ctmi(T: number): number {
  const tmin = YEAST_T_MIN, topt = YEAST_T_OPT, tmax = YEAST_T_MAX;
  if (!(T > tmin && T < tmax)) return 0;
  return ((T - tmax) * (T - tmin) ** 2)
    / ((topt - tmin) * ((topt - tmin) * (T - topt) - (topt - tmax) * (topt + tmin - 2 * T)));
}
const CTMI_25 = ctmi(25);

/** Fermentation activity at a dough temperature, relative to 25 °C (Rosso et al. 1993 cardinal model). */
export function yeastActivity(tempC: number): number {
  return ctmi(tempC) / CTMI_25;
}

export interface ThermalPhase {
  /** Duration in hours. */
  hours: number;
  /** Temperature the dough relaxes towards (kitchen or fridge), °C. */
  envC: number;
  /** Thermal time constant of the mass in this phase, hours. */
  tauH: number;
}

export interface PathResult {
  /** Equivalent hours at 25 °C. */
  heq: number;
  /** Dough temperature at the end of the path, °C. */
  endC: number;
}

/** Equivalent 25 °C hours over a dough's temperature path: the dough starts at
 * `startC` and relaxes exponentially to each phase's surroundings. Simpson's
 * rule over the first 8 τ of a phase, the settled remainder at the surroundings. */
export function pathHeq(startC: number, phases: ThermalPhase[]): PathResult {
  let T = startC, heq = 0;
  for (const phase of phases) {
    const hours = Math.max(0, phase.hours);
    if (!(hours > 0)) continue;
    const tau = Math.max(0.05, phase.tauH), env = phase.envC;
    const transient = Math.min(hours, 8 * tau);
    const n = 64, h = transient / n;
    let sum = 0;
    for (let i = 0; i <= n; i++) {
      const Ti = env + (T - env) * Math.exp(-(i * h) / tau);
      const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
      sum += w * yeastActivity(Ti);
    }
    heq += sum * h / 3;
    T = env + (T - env) * Math.exp(-transient / tau);
    if (hours > transient) {
      heq += (hours - transient) * yeastActivity(env);
      T = env + (T - env) * Math.exp(-(hours - transient) / tau);
    }
  }
  return { heq, endC: T };
}

/** Rise target R (E1 = 1, doubled). E3: a dough that ends warm is used at a
 * smaller rise, smoothly from 25 °C (1) to 28 °C (0.6) of dough temperature. */
export function riseTarget(endDoughC: number): number {
  const x = Math.max(0, Math.min(1, (endDoughC - YEAST_HEAT_RISE_FROM_C) / (YEAST_HEAT_RISE_TO_C - YEAST_HEAT_RISE_FROM_C)));
  const s = x * x * (3 - 2 * x);
  return 1 - (1 - YEAST_HEAT_RISE) * s;
}

function mediumFactor(medium: YeastMedium): number {
  return medium === 'poolish' ? YEAST_MEDIUM_POOLISH : medium === 'biga' ? YEAST_MEDIUM_BIGA : 1;
}

/** Instant-yeast % of the fermenting flour that reaches the target after `heq`
 * equivalent hours. No floor or cap: callers apply the product limits. */
export function doseForHeq(heq: number, medium: YeastMedium = 'dough', rise = 1): number {
  const H = Math.max(1e-6, heq);
  return YEAST_DOSE_A * mediumFactor(medium) * rise * Math.pow(H, -YEAST_DOSE_B);
}

/** Equivalent 25 °C hours a dose needs to reach the target: the inverse of doseForHeq. */
export function heqForDose(dosePct: number, medium: YeastMedium = 'dough', rise = 1): number {
  if (!(dosePct > 0)) return Infinity;
  return Math.pow(YEAST_DOSE_A * mediumFactor(medium) * rise / dosePct, 1 / YEAST_DOSE_B);
}

/** Fraction of the target reached: 1 on target, above 1 ahead, below 1 behind. */
export function yeastBudget(dosePct: number, heq: number, medium: YeastMedium = 'dough', rise = 1): number {
  const need = heqForDose(dosePct, medium, rise);
  return Number.isFinite(need) ? Math.max(0, heq) / need : 0;
}

/** Hours at a constant surrounding temperature for a path starting at `startC` to reach `targetHeq`
 * (bisection on pathHeq; Infinity if not reached within `maxH`). */
export function hoursToHeq(targetHeq: number, startC: number, envC: number, tauH: number, maxH = 400): number {
  if (!(targetHeq > 0)) return 0;
  if (pathHeq(startC, [{ hours: maxH, envC, tauH }]).heq < targetHeq) return Infinity;
  let lo = 0, hi = maxH;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (pathHeq(startC, [{ hours: mid, envC, tauH }]).heq < targetHeq) lo = mid; else hi = mid;
  }
  return hi;
}
