// What the baker is making, named the way they would say it: "Ma brioche · 2 brioches",
// "Quand enfourner la brioche ?". Styles without an entry keep the generic bread words.
type Name = {en: [string, string]; fr: [string, string]; frArticle: [string, string]; title: {en: string; fr: string}};
const NAMES: Record<string, Name> = {
  brioche: {en: ['brioche', 'brioches'], fr: ['brioche', 'brioches'], frArticle: ['la', 'les'], title: {en: 'My brioche', fr: 'Ma brioche'}},
  baguette: {en: ['baguette', 'baguettes'], fr: ['baguette', 'baguettes'], frArticle: ['la', 'les'], title: {en: 'My baguettes', fr: 'Mes baguettes'}},
  fougasse: {en: ['fougasse', 'fougasses'], fr: ['fougasse', 'fougasses'], frArticle: ['la', 'les'], title: {en: 'My fougasse', fr: 'Ma fougasse'}},
  pain_mie: {en: ['sandwich loaf', 'sandwich loaves'], fr: ['pain de mie', 'pains de mie'], frArticle: ['le', 'les'], title: {en: 'My sandwich loaf', fr: 'Mon pain de mie'}},
  pain_viennois: {en: ['Vienna loaf', 'Vienna loaves'], fr: ['pain viennois', 'pains viennois'], frArticle: ['le', 'les'], title: {en: 'My Vienna bread', fr: 'Mon pain viennois'}},
  // Flatbreads and sandwich breads are counted as what they are, never as "loaves" (14 Nov 2026 audit).
  pita: {en: ['pita', 'pitas'], fr: ['pita', 'pitas'], frArticle: ['la', 'les'], title: {en: 'My pitas', fr: 'Mes pitas'}},
  greek_pita: {en: ['Greek pita', 'Greek pitas'], fr: ['pita grecque', 'pitas grecques'], frArticle: ['la', 'les'], title: {en: 'My Greek pitas', fr: 'Mes pitas grecques'}},
  kebab_bread: {en: ['kebab bread', 'kebab breads'], fr: ['pain kebab', 'pains kebab'], frArticle: ['le', 'les'], title: {en: 'My kebab breads', fr: 'Mes pains kebab'}},
  batbout: {en: ['batbout', 'batbouts'], fr: ['batbout', 'batbouts'], frArticle: ['le', 'les'], title: {en: 'My batbouts', fr: 'Mes batbouts'}},
  laffa: {en: ['laffa', 'laffas'], fr: ['laffa', 'laffas'], frArticle: ['la', 'les'], title: {en: 'My laffas', fr: 'Mes laffas'}},
  piadina: {en: ['piadina', 'piadinas'], fr: ['piadina', 'piadinas'], frArticle: ['la', 'les'], title: {en: 'My piadinas', fr: 'Mes piadinas'}},
  bagel: {en: ['bagel', 'bagels'], fr: ['bagel', 'bagels'], frArticle: ['le', 'les'], title: {en: 'My bagels', fr: 'Mes bagels'}},
  focaccia: {en: ['focaccia', 'focaccias'], fr: ['focaccia', 'focaccias'], frArticle: ['la', 'les'], title: {en: 'My focaccia', fr: 'Ma focaccia'}},
  ciabatta: {en: ['ciabatta', 'ciabattas'], fr: ['ciabatta', 'ciabattas'], frArticle: ['la', 'les'], title: {en: 'My ciabatta', fr: 'Ma ciabatta'}},
  pan_bagnat: {en: ['pan bagnat roll', 'pan bagnat rolls'], fr: ['pain bagnat', 'pains bagnats'], frArticle: ['le', 'les'], title: {en: 'My pan bagnat rolls', fr: 'Mes pains bagnats'}},
  panuozzo: {en: ['panuozzo', 'panuozzi'], fr: ['panuozzo', 'panuozzi'], frArticle: ['le', 'les'], title: {en: 'My panuozzi', fr: 'Mes panuozzi'}},
};

const PAN_COOKED = new Set(['batbout', 'piadina']);

/** "2 brioches", "1 pain", "3 loaves". */
export function breadNoun(styleKey: string | null | undefined, count: number, fr: boolean): string {
  const name = styleKey ? NAMES[styleKey] : undefined;
  const plural = count === 1 ? 0 : 1;
  if (name) return (fr ? name.fr : name.en)[plural];
  return fr ? (count === 1 ? 'pain' : 'pains') : (count === 1 ? 'loaf' : 'loaves');
}

/** Default bake title when the baker has not named the bake. */
export function breadBakeTitle(styleKey: string | null | undefined, fr: boolean): string {
  const name = styleKey ? NAMES[styleKey] : undefined;
  return name ? name.title[fr ? 'fr' : 'en'] : fr ? 'Ma fournée de pain' : 'My bread bake';
}

/** "Quand enfourner la brioche ?" / "When will the brioche go into the oven?" */
export function breadOvenQuestion(styleKey: string | null | undefined, count: number, fr: boolean): string {
  const name = styleKey ? NAMES[styleKey] : undefined;
  const plural = count > 1 ? 1 : 0;
  if (!name) return fr ? 'Quand enfourner le pain ?' : 'When will the bread go into the oven?';
  // Pan-cooked breads are not put in an oven.
  if (styleKey && PAN_COOKED.has(styleKey)) return fr
    ? `Quand cuire ${name.frArticle[plural]} ${name.fr[plural]} ?`
    : `When will you cook the ${name.en[plural]}?`;
  return fr
    ? `Quand enfourner ${name.frArticle[plural]} ${name.fr[plural]} ?`
    : `When will the ${name.en[plural]} go into the oven?`;
}

/** The other bake named as the subject of a sentence, with its number: "Les baguettes" (plural),
 *  "La brioche", "Les pizzas"; a name the baker gave stays as written (singular). Null when the
 *  style has no noun of its own (18 Nov 2026 retention round 4: "Baguette occupe" for 3 baguettes). */
export function bakeSubject(styleKey: string | null | undefined, count: number, fr: boolean, bakeType?: string | null): {text: string; plural: boolean} | null {
  const plural = count > 1 ? 1 : 0;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (bakeType === 'pizza') return {text: fr ? (plural ? 'Les pizzas' : 'La pizza') : (plural ? 'The pizzas' : 'The pizza'), plural: !!plural};
  const name = styleKey ? NAMES[styleKey] : undefined;
  if (!name) return null;
  return {text: fr ? cap(`${name.frArticle[plural]} ${name.fr[plural]}`) : `The ${name.en[plural]}`, plural: !!plural};
}

/** Eggs are weighed without shells; a count helps the shopping and the bowl. */
export function eggCountLabel(grams: number, fr: boolean): string {
  const lo = Math.max(1, Math.floor(grams / 50)), hi = Math.max(1, Math.ceil(grams / 50));
  if (lo === hi) return fr ? `environ ${lo} œuf${lo > 1 ? 's' : ''}` : `about ${lo} egg${lo > 1 ? 's' : ''}`;
  return fr ? `environ ${lo} à ${hi} œufs` : `about ${lo}–${hi} eggs`;
}
