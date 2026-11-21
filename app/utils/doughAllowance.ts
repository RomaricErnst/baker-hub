// Extra for bowl loss (20 Nov 2026 round 7): every bake adds 1.5 % to the total dough so the dough
// left in the bowl and on the hands does not come out of the last ball. Ball weights stay what the
// baker asked; only the total grows.
export const DEFAULT_WASTE_PCT = 1.5;

/** The allowance a recipe uses: the baker's value, else the default. */
export function effectiveWastePct(set: number | undefined): number {
  return typeof set === 'number' && Number.isFinite(set) ? set : DEFAULT_WASTE_PCT;
}

/**
 * The allowance state a restored session starts from. A saved number is kept (an old bake saved
 * with 0 stays at 0). A missing value means "not set": the default applies, except for a bake
 * whose dough (or preferment) is already made: it was weighed without the allowance, so it keeps 0.
 */
export function restoredWastePct(saved: unknown, doughMade = false): number | undefined {
  if (typeof saved === 'number' && Number.isFinite(saved)) return saved;
  return doughMade ? 0 : undefined;
}
