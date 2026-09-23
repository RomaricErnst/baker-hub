/** Each bread appears once; grouping describes its shape/use, not a required meal. */
export const BREAD_GROUPS = [
 {id:'loaves',fr:'Pains à trancher',en:'Loaves & sliced bread',keys:['pain_campagne','pain_levain','pain_complet','pain_seigle','pain_mie']},
 {id:'sandwich',fr:'Baguettes & pains à garnir',en:'Baguettes & sandwich breads',keys:['baguette','focaccia','ciabatta','bagel','pan_bagnat','panuozzo']},
 {id:'flat',fr:'Pitas & wraps',en:'Pitas & wraps',keys:['pita','greek_pita','kebab_bread','batbout','laffa','piadina']},
 {id:'sharing',fr:'Brioches & pains à partager',en:'Brioches & sharing breads',keys:['brioche','pain_viennois','fougasse']},
] as const;

/** Small meal examples accompany, but never replace, the primary bread photo. */
export const BREAD_MEAL_EXAMPLES: Record<string, {recipeId:string; kind:'tartine'|'sandwich'|'wrap'}> = {
  ...Object.fromEntries(['pain_campagne','pain_levain','pain_complet','pain_seigle','pain_mie'].map(key=>[key,{recipeId:'tartine-avocat-oeuf',kind:'tartine' as const}])),
  baguette:{recipeId:'baguette-jambon-beurre',kind:'sandwich'},
  focaccia:{recipeId:'focaccia-caprese',kind:'sandwich'},
  ciabatta:{recipeId:'ciabatta-caprese',kind:'sandwich'},
  bagel:{recipeId:'bagel-saumon-cream-cheese',kind:'sandwich'},
  pan_bagnat:{recipeId:'pan_bagnat-nicois',kind:'sandwich'},
  panuozzo:{recipeId:'panuozzo-pancetta-mozza',kind:'sandwich'},
  pita:{recipeId:'pita-poulet-cru-citron',kind:'sandwich'},
  greek_pita:{recipeId:'greek_pita-poulet-tzatziki',kind:'wrap'},
  kebab_bread:{recipeId:'kebab_bread-boeuf-classique',kind:'sandwich'},
  batbout:{recipeId:'batbout-thon-olive',kind:'sandwich'},
  laffa:{recipeId:'laffa-falafel-houmous',kind:'wrap'},
  piadina:{recipeId:'piadina-crudo-squacquerone',kind:'wrap'},
};
