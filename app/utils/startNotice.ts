import { formatClock } from './units';
import { formatDuration } from './duration';

const QUARTER = 15 * 60000;
const SOON = 2 * 3600000;

/** The first quarter hour a proposed start may use: at least 15 minutes from now. */
export function earliestQuarterStart(now: number): number {
  return Math.ceil((now + QUARTER) / QUARTER) * QUARTER;
}

/** Proposed times speak in quarter hours, never earlier than `earliestQuarterStart`. */
export function quarterStartNoEarlier(at: number, now: number): number {
  return Math.max(earliestQuarterStart(now), Math.round(at / QUARTER) * QUARTER);
}

/** "today 11:45am · in 30 min" when the start is within the next two hours; null otherwise.
 * The distance is rounded to five minutes so a re-render a minute later does not jitter. */
export function soonStartLabel(at: Date, now: number, locale: string): string | null {
  const ahead = +at - now;
  if (!Number.isFinite(ahead) || ahead <= 0 || ahead > SOON) return null;
  const fr = locale.startsWith('fr');
  const minutes = Math.max(5, Math.round(ahead / 300000) * 5);
  const sameDay = new Date(now).toDateString() === at.toDateString();
  const day = sameDay ? (fr ? 'aujourd’hui' : 'today') : (fr ? 'demain' : 'tomorrow');
  const inLabel = formatDuration(minutes / 60, fr ? 'fr' : 'en');
  return `${day} ${formatClock(at, locale)} · ${fr ? 'dans' : 'in'} ${inLabel}`;
}
