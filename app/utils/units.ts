export type UnitSystem = 'metric' | 'imperial';

// ── Temperature ──────────────────────────────────
export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}
export function fToC(f: number): number {
  return Math.round((f - 32) * 5 / 9);
}
// Display a stored °C value in the baker's system.
// Rounds: stored °C can be a solver float (the enthalpy DDT model returns
// e.g. 10.350770172523642) and a baker sets water by thermometer, not by
// twelve decimal places. cToF already rounds, so imperial never showed it.
export function displayTemp(c: number, units: UnitSystem): string {
  return units === 'imperial' ? `${cToF(c)}°F` : `${Math.round(c)}°C`;
}
export function tempUnit(units: UnitSystem): string {
  return units === 'imperial' ? '°F' : '°C';
}
// Convert a typed display value back to °C for storage
export function inputTempToC(val: number, units: UnitSystem): number {
  return units === 'imperial' ? fToC(val) : val;
}
// Get display value from stored °C — same rounding rule as displayTemp,
// so a float can never reach a number input or a bare {value}{unit} render.
export function cToDisplay(c: number, units: UnitSystem): number {
  return units === 'imperial' ? cToF(c) : Math.round(c);
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
// Display a stored gram value in the baker's system
export function formatClock(date: Date, locale: string): string {
  if (!Number.isFinite(+date)) return '—';
  const h = date.getHours(), m = String(date.getMinutes()).padStart(2,'0');
  return locale.startsWith('fr') ? `${h}h${m}` : `${h % 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`;
}

// Planned steps are shown on the plan's 15-minute grid. The engine keeps exact minutes; every
// screen that shows a planned time rounds the same way, so the Recipe, the curve and Preparation
// agree (14 Nov 2026 audit: 7:44 in one place, 7:45 in another).
export function roundToQuarter(date: Date): Date {
  if (!Number.isFinite(+date)) return date;
  return new Date(Math.round(+date / 900000) * 900000);
}
export function formatPlanClock(date: Date, locale: string): string {
  return formatClock(roundToQuarter(date), locale);
}

export function formatBakeDateTime(date: Date, locale: string): string {
  if (!Number.isFinite(+date)) return '—';
  const lang = locale.startsWith('fr') ? 'fr-FR' : 'en-GB';
  const weekday = date.toLocaleDateString(lang, {weekday:'short'});
  const month = date.toLocaleDateString(lang, {month:'short'});
  return `${weekday} ${date.getDate()} ${month} · ${formatClock(date,locale)}`;
}

export function formatLongDay(date: Date, locale: string): string {
  const fr=locale.startsWith('fr');
  const formatter=new Intl.DateTimeFormat(fr?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'long'});
  return formatter.formatToParts(date).map(part=>fr&&part.type==='day'&&part.value==='1'?'1er':part.value).join('');
}

export function formatPercent(value: number, locale: string): string {
  const fr = locale.startsWith('fr');
  return value.toLocaleString(fr ? 'fr-FR' : 'en-US', {maximumFractionDigits:1}) + (fr ? '\u202f%' : '%');
}

export function displayWeight(g: number, units: UnitSystem, locale='en'): string {
  const oz = units === 'imperial' && (g <= 0 || g >= 10); // under 10 g an ounce reads too coarsely (0.3 oz salt) — 14 Nov 2026
  const value = oz ? gToOz(g) : g > 0 && g < 1 ? Math.max(0.1,g) : Math.max(0,g);
  const fr = locale.startsWith('fr');
  return value.toLocaleString(fr ? 'fr-FR' : 'en-US', {maximumFractionDigits:oz || g < 10 ? 1 : 0}) + (fr ? '\u202f' : ' ') + (oz ? 'oz' : 'g');
}
