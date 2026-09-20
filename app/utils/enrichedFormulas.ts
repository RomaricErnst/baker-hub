/** Ingredient ratios from published formulas; yeast remains the app's schedule estimate. */
export const ENRICHED_FORMULAS = {
  brioche: {milk:0,eggs:50,butter:50,water:9,sugar:12,salt:2.5,
    sourceUrl:'https://www.kingarthurbaking.com/pro/formulas/brioche',
    formulaVersion:'brioche-ka-2026-09-20'},
  pain_viennois: {milk:65,eggs:0,butter:8,water:0,sugar:4,salt:1.4,
    sourceUrl:'https://www.moulin-fritz.fr/wp-content/uploads/2016/05/recette-pain-viennois.pdf',
    formulaVersion:'viennois-fritz-2026-09-20'},
} as const;
// Approximate food composition, not measured ingredient water content.
export const ENRICHMENT_WATER_FRACTIONS = {milk:0.87,eggs:0.75,butter:0.16} as const;
export type RecipeEnrichment = {
 milk:number;eggs:number;butter:number;waterEquivalent:number;
 waterFractions:typeof ENRICHMENT_WATER_FRACTIONS;
 sourceUrl:string;formulaVersion:string;unsupportedMethod?:boolean;
 note:{en:string;fr:string};
};
