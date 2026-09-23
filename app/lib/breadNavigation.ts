/** Each bread appears once; grouping describes its shape/use, not a required meal. */
export const BREAD_GROUPS = [
 {id:'loaves',fr:'Pains à trancher',en:'Loaves & sliced bread',keys:['pain_campagne','pain_levain','pain_complet','pain_seigle','pain_mie']},
 {id:'sandwich',fr:'Baguettes & pains à garnir',en:'Baguettes & sandwich breads',keys:['baguette','focaccia','ciabatta','bagel','pan_bagnat','panuozzo']},
 {id:'flat',fr:'Pains plats & poches',en:'Flatbreads & pockets',keys:['pita','greek_pita','kebab_bread','batbout','laffa','piadina']},
 {id:'sharing',fr:'Brioches & pains à partager',en:'Brioches & sharing breads',keys:['brioche','pain_viennois','fougasse']},
] as const;
