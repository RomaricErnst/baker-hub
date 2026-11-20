// One way to say when a starter peaks (20 Nov 2026 chart review, owner): the starter card, the readiness
// strip in Your plan and any feed row read the same peak (the peak-model invariant: the one value the solver
// scores) through these helpers, on the plan's 15-minute grid, so they can never disagree ("5:42pm" on the
// card beside "5:45pm" on the chart). The underlying peak is never changed, only how it is written.
import { formatPlanClock, formatBakeDateTime, roundToQuarter } from './units';

const HOUR = 3600000;

/** "5:45pm" / "17h45": the peak on the plan's 15-minute grid. */
export function peakClock(peak: Date, fr: boolean): string {
  return formatPlanClock(peak, fr ? 'fr' : 'en');
}

/** "around 5:45pm" / "vers 17h45"; with `day`, "around Fri 20 Nov · 5:45pm". */
export function peakAround(peak: Date, fr: boolean, opts: { day?: boolean } = {}): string {
  const text = opts.day ? formatBakeDateTime(roundToQuarter(peak), fr ? 'fr' : 'en') : peakClock(peak, fr);
  return (fr ? 'vers ' : 'around ') + text;
}

/** The solver's green band around a peak (mixNearPeak in starterPeak.ts: tolerance adjPeakH × 0.15
 * clamped 1–3 h, half an hour more on the rising side). A mix inside [from, to] is near the peak. */
export function readyBand(peakMs: number, adjPeakH: number): { from: number; to: number } {
  const tol = Math.max(1, Math.min(3, adjPeakH * 0.15));
  return { from: peakMs - (tol + 0.5) * HOUR, to: peakMs + tol * HOUR };
}

/** The band rounded INWARD to whole hours (so every hour named is inside it), or null when no whole
 * hour fits (a band is at least 2.5 h wide, so this does not happen with the solver's tolerance). */
export function readyHours(band: { from: number; to: number }): { from: Date; to: Date } | null {
  const from = new Date(band.from), to = new Date(band.to);
  if (from.getMinutes() || from.getSeconds() || from.getMilliseconds()) { from.setMinutes(60, 0, 0); }
  to.setMinutes(0, 0, 0);
  return +from < +to ? { from, to } : null;
}

function hourText(d: Date, fr: boolean): { text: string; suffix: string } {
  const h = d.getHours();
  if (fr) return { text: `${h}h`, suffix: '' };
  return { text: String(h % 12 || 12), suffix: h < 12 ? 'am' : 'pm' };
}

/** "ready 4–7pm", "ready 11am–1pm" / "prêt 16h–19h". */
export function readyLabel(hours: { from: Date; to: Date }, fr: boolean): string {
  const a = hourText(hours.from, fr), b = hourText(hours.to, fr);
  if (fr) return `prêt ${a.text}–${b.text}`;
  return `ready ${a.text}${a.suffix === b.suffix ? '' : a.suffix}–${b.text}${b.suffix}`;
}

/** A card note with the peak written from the event's peak, so a note saved before the shared format
 * ("Peak around 5:42pm" in a stored bake) reads like the strip ("around 5:45pm"). Other notes pass. */
export function peakNote(event: { cardNote?: string; bellPeakTime?: Date }, fr: boolean): string | undefined {
  const note = event.cardNote;
  if (!note || !event.bellPeakTime || !Number.isFinite(+event.bellPeakTime)) return note;
  return note.replace(fr ? /\bvers \d{1,2}h\d{2}/ : /\baround \d{1,2}:\d{2}(am|pm)/, peakAround(event.bellPeakTime, fr));
}
