/** Size a 100%-hydration build in whole grams while preserving the chosen 1:R:R feed. */
export function starterBuild(requiredGrams: number, maximumGrams: number, ratio: number) {
  const needed = Math.max(requiredGrams, maximumGrams);
  const keep = Math.round(maximumGrams * 0.2);
  // Allow 10% of the prepared build to remain on the jar and utensils.
  const seed = needed > 0 ? Math.ceil((needed + keep) / (0.9 * (1 + 2 * ratio))) : 50;
  const flour = seed * ratio;
  return {seed, flour, water:flour, total:seed + 2 * flour, keep};
}

export function starterActionLabel(kind: string, isFr: boolean): string | undefined {
  if (kind==='fridge_in') return isFr ? 'Mettre le levain au réfrigérateur' : 'Refrigerate starter';
  if (kind==='fridge_out') return isFr ? 'Sortir le levain du réfrigérateur' : 'Take starter out of the fridge';
  return starterFeedRoleLabel(kind,isFr);
}

export function starterFeedRoleLabel(kind: string, isFr: boolean): string | undefined {
  switch (kind) {
    case 'refresh': return isFr ? 'Rafraîchir le levain' : 'Refresh feed';
    case 'intermediate_refresh': return isFr ? 'Rafraîchi intermédiaire' : 'Intermediate feed';
    case 'pre_mix': return isFr ? 'Rafraîchi avant pétrissage' : 'Pre-mix feed';
  }
}
