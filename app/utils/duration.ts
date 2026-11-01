export function formatDuration(hours: number, locale: string): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (locale === 'fr') return m ? `${h} h ${String(m).padStart(2,'0')}` : `${h} h`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
