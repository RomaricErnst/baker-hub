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

// Approximate packet convention for dry yeast (7 g = 2¼ tsp).
// Avoid "scant" and "heaped": those measures cannot reliably resolve small doses.
export function dryYeastSpoonHint(grams:number, type:string, locale:string) {
  if (!Number.isFinite(grams) || grams < 0.35 || grams > 6 || (type!=='instant' && type!=='active_dry')) return '';
  const spoons = [[1/8,'⅛'],[1/4,'¼'],[1/2,'½'],[3/4,'¾'],[1,'1'],[1.5,'1½'],[2,'2']] as const;
  const nearest = spoons.reduce((best,spoon)=>Math.abs(grams-spoon[0]*7/2.25)<Math.abs(grams-best[0]*7/2.25)?spoon:best);
  return Math.abs(grams-nearest[0]*7/2.25)<=grams*0.15
    ? `≈ ${nearest[1]} ${locale==='fr'?'c. à café':'tsp'}` : '';
}
