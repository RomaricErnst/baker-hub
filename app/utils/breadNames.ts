// What the baker is making, named the way they would say it: "Ma brioche · 2 brioches",
// "Quand enfourner la brioche ?". Styles without an entry keep the generic bread words.
type Name = {en: [string, string]; fr: [string, string]; frArticle: [string, string]; title: {en: string; fr: string}};
const NAMES: Record<string, Name> = {
  brioche: {en: ['brioche', 'brioches'], fr: ['brioche', 'brioches'], frArticle: ['la', 'les'], title: {en: 'My brioche', fr: 'Ma brioche'}},
  baguette: {en: ['baguette', 'baguettes'], fr: ['baguette', 'baguettes'], frArticle: ['la', 'les'], title: {en: 'My baguettes', fr: 'Mes baguettes'}},
  fougasse: {en: ['fougasse', 'fougasses'], fr: ['fougasse', 'fougasses'], frArticle: ['la', 'les'], title: {en: 'My fougasse', fr: 'Ma fougasse'}},
  pain_mie: {en: ['sandwich loaf', 'sandwich loaves'], fr: ['pain de mie', 'pains de mie'], frArticle: ['le', 'les'], title: {en: 'My sandwich loaf', fr: 'Mon pain de mie'}},
  pain_viennois: {en: ['Vienna loaf', 'Vienna loaves'], fr: ['pain viennois', 'pains viennois'], frArticle: ['le', 'les'], title: {en: 'My Vienna bread', fr: 'Mon pain viennois'}},
};

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
  return fr
    ? `Quand enfourner ${name.frArticle[plural]} ${name.fr[plural]} ?`
    : `When will the ${name.en[plural]} go into the oven?`;
}

/** Eggs are weighed without shells; a count helps the shopping and the bowl. */
export function eggCountLabel(grams: number, fr: boolean): string {
  const lo = Math.max(1, Math.floor(grams / 50)), hi = Math.max(1, Math.ceil(grams / 50));
  if (lo === hi) return fr ? `environ ${lo} œuf${lo > 1 ? 's' : ''}` : `about ${lo} egg${lo > 1 ? 's' : ''}`;
  return fr ? `environ ${lo} à ${hi} œufs` : `about ${lo}–${hi} eggs`;
}
