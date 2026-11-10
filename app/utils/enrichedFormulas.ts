/** Ingredient ratios from published formulas (pain de mie: the owner's milk-and-butter loaf);
 * yeast is the app's schedule estimate, or the fixed enriched dose from 10 % sugar. */
export const ENRICHED_FORMULAS = {
  brioche: {milk:0,eggs:50,butter:50,water:9,sugar:12,salt:2.5,
    sourceUrl:'https://www.kingarthurbaking.com/pro/formulas/brioche',
    formulaVersion:'brioche-ka-2026-09-20'},
  pain_viennois: {milk:65,eggs:0,butter:8,water:0,sugar:4,salt:1.4,
    sourceUrl:'https://www.moulin-fritz.fr/wp-content/uploads/2016/05/recette-pain-viennois.pdf',
    formulaVersion:'viennois-fritz-2026-09-20'},
  // Owner's sandwich loaf: half water, half milk, 8 % butter, 5 % sugar. The
  // liquid gives about 63 % effective hydration, as the former water-only loaf.
  // At 5 % sugar it keeps the temperature-model yeast dose.
  pain_mie: {milk:33,eggs:0,butter:8,water:33,sugar:5,salt:1.8,
    sourceUrl:'https://www.kingarthurbaking.com/recipes/pain-de-mie-recipe',
    formulaVersion:'pain-mie-milk-butter-2026-11-10'},
} as const;
// Approximate food composition, not measured ingredient water content.
export const ENRICHMENT_WATER_FRACTIONS = {milk:0.87,eggs:0.75,butter:0.16} as const;
export type RecipeEnrichment = {
 milk:number;eggs:number;butter:number;waterEquivalent:number;
 waterFractions:typeof ENRICHMENT_WATER_FRACTIONS;
 sourceUrl:string;formulaVersion:string;unsupportedMethod?:boolean;
 note:{en:string;fr:string};
};
