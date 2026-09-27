// Keep small commercial preferment doses meaningful in both unit systems.
export function formatPrefermentDose(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '0 g';
  return `${Number(grams.toPrecision(3))} g`;
}

export function prefermentDilution(doseGrams: number, prefermentWaterGrams: number) {
  if (!Number.isFinite(doseGrams) || !Number.isFinite(prefermentWaterGrams)
    || doseGrams <= 0 || doseGrams >= 0.5) return null;
  // 1 g of the selected yeast in 99 g water makes a 1% suspension by mass.
  // Only the water in the aliquot enters the dough, not the discarded stock.
  const solutionGrams = doseGrams * 100;
  const waterInSolutionGrams = doseGrams * 99;
  if (waterInSolutionGrams > prefermentWaterGrams) return null;
  return { solutionGrams, waterInSolutionGrams,
    remainingWaterGrams: prefermentWaterGrams - waterInSolutionGrams };
}
