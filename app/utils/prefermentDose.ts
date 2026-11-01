// Keep small commercial preferment doses meaningful in both unit systems.
export function formatPrefermentDose(grams: number, locale='en'): string {
  if (!Number.isFinite(grams) || grams <= 0) return '0 g';
  return `${new Intl.NumberFormat(locale,{maximumSignificantDigits:3}).format(grams)} g`;
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



// Final-dough yeast is split to hundredths of a gram between mixing batches.
export function formatYeastDose(grams:number, locale='en') {
  if (!(grams > 0) || !Number.isFinite(grams)) return '0 g';
  if (grams < 0.01) return formatPrefermentDose(grams,locale);
  return `${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(grams)} g`;
}

// Show a spoon only when the target closely matches a real measuring spoon.
// The approximation uses the dry-yeast packet convention (7 g = 2¼ tsp).
export function dryYeastSpoonHint(grams:number, type:string, locale:string) {
  if (!(grams > 0 && grams < 1) || (type!=='instant' && type!=='active_dry')) return '';
  for (const [fraction,label] of [[1/8,'⅛'],[1/4,'¼']] as const) {
    if (Math.abs(grams-fraction*7/2.25)<=grams*0.05) return `≈ ${label} ${locale==='fr'?'c. à café':'tsp'}`;
  }
  return '';
}
