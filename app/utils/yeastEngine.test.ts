// ══════════════════════════════════════════
// Craig's Yeast Engine — Validation Tests
// T1–T8: IDY% of flour
// ══════════════════════════════════════════
// Run: npx ts-node --project tsconfig.json app/utils/yeastEngine.test.ts
// ══════════════════════════════════════════
//
// Craig's formulas:
//   RT:   IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
//   Cold: IDY% = 7.5 / hours^1.313
//   Multi-stage: bisection, convergence 0.0001%, max 50 iterations
//   Tropical: 30-32°C ×1.15, 33-35°C ×1.25 (RT phases only)
//   Floor: 0.05%  Ceiling: 2.0%
// ══════════════════════════════════════════

const FLOOR   = 0.05;
const CEILING = 2.0;

// ─── Core formula functions ─────────────────────────────────────────────────

function rtRequired(hours: number, temp: number): number {
  return 9.5 / (Math.pow(hours, 1.65) * Math.pow(2.5, (temp - 25) / 10));
}

function coldRequired(hours: number): number {
  return 7.5 / Math.pow(hours, 1.313);
}

function tropicalFactor(temp: number): number {
  if (temp >= 33 && temp <= 35) return 1.25;
  if (temp >= 30 && temp <= 32) return 1.15;
  return 1.0;
}

function clamp(v: number): number {
  return Math.min(CEILING, Math.max(FLOOR, v));
}

// ─── Single-stage helpers ───────────────────────────────────────────────────

function calcRT(hours: number, temp: number): number {
  const tropical = tropicalFactor(temp);
  const idy = rtRequired(hours, temp) / tropical;
  return clamp(idy);
}

function calcCold(hours: number): number {
  return clamp(coldRequired(hours));
}

// ─── Multi-stage bisection ──────────────────────────────────────────────────
// Models "fermentation progress" as a linear contribution from each phase:
//   progress_RT   = IDY × h^1.65 × 2.5^((t-25)/10) × tropical(t) / 9.5
//   progress_cold = IDY × h^1.313 / 7.5
// Finds IDY where total progress = 1.0

interface RTPhase { hours: number; temp: number }

function calcMultiStage(rtPhases: RTPhase[], coldHours: number): number {
  // Coefficient K: total contribution per unit IDY
  // (linear in IDY → bisection converges in ~50 iters on [0.00001, 10])
  function contribution(idy: number): number {
    let total = 0;
    for (const p of rtPhases) {
      const tropical = tropicalFactor(p.temp);
      total += idy * Math.pow(p.hours, 1.65) * Math.pow(2.5, (p.temp - 25) / 10) * tropical / 9.5;
    }
    if (coldHours > 0) {
      total += idy * Math.pow(coldHours, 1.313) / 7.5;
    }
    return total;
  }

  let lo = 0.00001;
  let hi = 10.0;

  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (contribution(mid) < 1.0) lo = mid;
    else hi = mid;
    if ((hi - lo) < 0.000001) break; // convergence 0.0001% (in absolute IDY terms)
  }

  return clamp((lo + hi) / 2);
}

// ─── Test runner ─────────────────────────────────────────────────────────────

function pass(label: string, idy: number, lo: number, hi: number): void {
  const ok = idy >= lo && idy <= hi;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}  ${label}: IDY = ${idy.toFixed(4)}%  (expected ${lo}%–${hi}%)`);
}

function passLower(label: string, idy: number, ref: number, refLabel: string): void {
  const ok = idy < ref;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}  ${label}: IDY = ${idy.toFixed(4)}%  (expected < ${refLabel} = ${ref.toFixed(4)}%)`);
}

function passNear(label: string, idy: number, target: number, tolerance: number): void {
  const ok = Math.abs(idy - target) <= tolerance;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}  ${label}: IDY = ${idy.toFixed(4)}%  (expected ~${target}% ± ${tolerance}%)`);
}

// ─── Test cases ──────────────────────────────────────────────────────────────

console.log('\n═══ Craig\'s Yeast Engine — T1–T8 Validation ═══\n');

// T1: Neapolitan, 24h cold + 2h RT at 25°C → 0.05%–0.20%
const t1 = calcMultiStage([{ hours: 2, temp: 25 }], 24);
pass('T1 Neapolitan 24h cold + 2h RT @25°C', t1, 0.05, 0.20);

// T2: Same scenario but 33°C → IDY lower than T1 (tropical correction)
const t2 = calcMultiStage([{ hours: 2, temp: 33 }], 24);
passLower('T2 Neapolitan 24h cold + 2h RT @33°C', t2, t1, 'T1');

// T3: Same-day Roman, 8h RT at 25°C → 0.1%–0.5%
const t3 = calcRT(8, 25);
pass('T3 Same-day Roman 8h RT @25°C', t3, 0.1, 0.5);

// T4: Same-day Roman, 8h RT at 33°C → IDY lower than T3
const t4 = calcRT(8, 33);
passLower('T4 Same-day Roman 8h RT @33°C', t4, t3, 'T3');

// T5: Very short, 2h RT at 25°C → at or near ceiling 2.0%
const t5 = calcRT(2, 25);
passNear('T5 Very short 2h RT @25°C', t5, CEILING, 0.1);

// T6: Very long, 72h cold at 4°C → at floor 0.05%
const t6 = calcCold(72);
passNear('T6 Very long 72h cold @4°C', t6, FLOOR, 0.001);

// T7: Multi-stage: 4h RT + 24h cold + 2h RT at 25°C → 0.05%–0.15%
const t7 = calcMultiStage([{ hours: 4, temp: 25 }, { hours: 2, temp: 25 }], 24);
pass('T7 Multi-stage 4h RT + 24h cold + 2h RT @25°C', t7, 0.05, 0.15);

// T8: Tropical 33°C, 4h RT → IDY lower than same at 25°C
const t8tropical = calcRT(4, 33);
const t8ref25    = calcRT(4, 25);
passLower('T8 Tropical 4h RT @33°C vs @25°C', t8tropical, t8ref25, '4h @25°C');

console.log('\n═══ End of validation ═══\n');
