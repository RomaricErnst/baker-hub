export function formatDuration(hours: number, locale: string): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (locale === 'fr') return m ? `${h} h ${String(m).padStart(2,'0')}` : `${h} h`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** A planned step's length as a baker reads it: 5-minute steps under an hour ("45 min", never
 *  "43 min"), the plan's 15-minute grid above (14 Nov 2026 audit). Countdowns use formatDuration. */
export function formatPlanDuration(hours: number, locale: string): string {
  const exact = Math.max(0, hours * 60);
  const minutes = exact < 60 ? Math.max(exact > 0 ? 5 : 0, Math.round(exact / 5) * 5) : Math.round(exact / 15) * 15;
  return formatDuration(minutes / 60, locale);
}
