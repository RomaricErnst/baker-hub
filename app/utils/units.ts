export type UnitSystem = 'metric' | 'imperial';

// ── Temperature ──────────────────────────────────
export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}
export function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}
// Display a stored °C value in the baker's system
export function displayTemp(c: number, units: UnitSystem): string {
  return units === 'imperial' ? `${cToF(c)}°F` : `${c}°C`;
}
export function tempUnit(units: UnitSystem): string {
  return units === 'imperial' ? '°F' : '°C';
}
// Convert a typed display value back to °C for storage
export function inputTempToC(val: number, units: UnitSystem): number {
  return units === 'imperial' ? fToC(val) : val;
}
// Get display value from stored °C
export function cToDisplay(c: number, units: UnitSystem): number {
  return units === 'imperial' ? cToF(c) : c;
}
// Hardcoded single °C reference → display string
export function tempC(celsius: number, units: UnitSystem): string {
  return units === 'imperial' ? `${cToF(celsius)}°F` : `${celsius}°C`;
}
// Hardcoded °C range → display string
export function tempRange(low: number, high: number, units: UnitSystem): string {
  return units === 'imperial'
    ? `${cToF(low)}–${cToF(high)}°F`
    : `${low}–${high}°C`;
}

// ── Weight ───────────────────────────────────────
export function gToOz(g: number): number {
  return Math.round(g / 28.3495 * 10) / 10;
}
export function ozToG(oz: number): number {
  return Math.round(oz * 28.3495);
}
export function weightUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'oz' : 'g';
}
// Display a stored gram value in the baker's system
export function displayWeight(g: number, units: UnitSystem): string {
  if (units === 'imperial') return `${gToOz(g)} oz`;
  if (g <= 0) return '0 g';
  if (g < 1) return `${Math.max(0.1, parseFloat(g.toFixed(1)))} g`;
  const rounded = Math.round(g);
  return `${rounded >= 1000 ? rounded.toLocaleString() : rounded} g`;
}
// Get display value from stored grams (number only, no unit)
export function gToDisplay(g: number, units: UnitSystem): number {
  return units === 'imperial' ? gToOz(g) : Math.round(g);
}
// Convert a typed display value back to grams for storage
export function inputWeightToG(val: number, units: UnitSystem): number {
  return units === 'imperial' ? ozToG(val) : val;
}
