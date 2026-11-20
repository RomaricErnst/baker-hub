// Fine-tune yeast rows (20 Nov 2026 round 7): one-line labels and the "Auto" box.

const EN: Record<string, string> = { instant: 'instant dry', active_dry: 'active dry', fresh: 'fresh' };
const FR: Record<string, string> = { instant: 'instantanée', active_dry: 'sèche active', fresh: 'fraîche' };

/** "Yeast · instant dry" / « Levure · instantanée »; a prefix names a preferment's or the final dough's yeast. */
export function yeastRowLabel(yeastType: string, fr: boolean, prefix?: string): string {
  const kind = (fr ? FR : EN)[yeastType];
  const head = prefix ?? (fr ? 'Levure' : 'Yeast');
  return kind ? `${head} · ${kind}` : head;
}

/** The amount shown in the baker's yeast, rounded for reading: 2 decimals, 3 below 0.1 %. */
export function roundShownPct(pct: number): number {
  return pct < 0.1 ? Math.round(pct * 1000) / 1000 : Math.round(pct * 100) / 100;
}

/** An empty yeast box: "Auto" before a plan, then the plan's amount greyed ("0.18 · auto", the owner's wording; the % is in the label's accessible name and appears once a number is typed). */
export function autoPctPlaceholder(pct: number | undefined, fr: boolean): string {
  if (pct === undefined || !Number.isFinite(pct)) return 'Auto';
  const n = roundShownPct(pct);
  return fr ? `${String(n).replace('.', ',')} · auto` : `${n} · auto`;
}
