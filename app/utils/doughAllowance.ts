// Extra for bowl loss (20 Nov 2026 round 7): every bake adds 1.5 % to the total dough so the dough
// left in the bowl and on the hands does not come out of the last ball. Ball weights stay what the
// baker asked; only the total grows.
export const DEFAULT_WASTE_PCT = 1.5;

/** The allowance a recipe uses: the baker's value, else the default. */
export function effectiveWastePct(set: number | undefined): number {
  return typeof set === 'number' && Number.isFinite(set) ? set : DEFAULT_WASTE_PCT;
}

/** The allowance state a restored session starts from: a saved number (the baker's), else not set (the default). */
export function restoredWastePct(saved: unknown): number | undefined {
  return typeof saved === 'number' && Number.isFinite(saved) ? saved : undefined;
}
