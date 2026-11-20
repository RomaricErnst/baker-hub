import { starterActionLabel } from './starterBuild';

/**
 * The guide's step titles in both languages, for a home row of a bake whose guide was last shown in the other
 * language (18 Nov 2026 retention round 4: "Feed your starter" on /fr). The guide saves each language it is
 * shown in; this table only covers a bake not yet seen in the page's language. A title it does not know stays.
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['Make your Poolish', 'Préparer le poolish'],
  ['Make your Biga', 'Préparer la biga'],
  ['Chill the poolish', 'Réfrigérer le poolish'],
  ['Feed your starter', 'Rafraîchir le levain'],
  ['Feed your starter — first feed', 'Rafraîchir le levain — premier rafraîchi'],
  ['Feed your starter — second feed', 'Rafraîchir le levain — deuxième rafraîchi'],
  ['Remove starter from fridge', 'Sortir le levain du frigo'],
  ['Put starter in fridge', 'Mettre le levain au frigo'],
  ['Soak the seeds', 'Tremper les graines'],
  ['Start Dough', 'Pétrir la pâte'],
  ['Autolyse, then mixing', 'Autolyse puis pétrissage'],
  ['Let the dough rise', 'Pointage'],
  ['Refrigerate the dough', 'Pointage au froid'],
  ['Divide and shape', 'Division et façonnage'],
  ['Divide and shape dough balls', 'Division et boulage'],
  ['Refrigerate the shaped dough', 'Apprêt froid'],
  ['Refrigerate the dough balls', 'Pâtons au réfrigérateur'],
  ['Let the shaped dough rise', 'Apprêt'],
  ['Take the shaped loaf out of the fridge', 'Sortir le pâton du réfrigérateur'],
  ['Take the shaped dough out of the fridge', 'Sortir les pâtons du réfrigérateur'],
  ['Take the dough out of the fridge', 'Sortir les pâtons'],
  ['Preheat the oven', 'Préchauffer le four'],
  ['Heat the griddle', 'Chauffer la poêle'],
  ['Bake the pizzas', 'Cuire les pizzas'],
  ...(['refresh', 'intermediate_refresh', 'pre_mix', 'fridge_in', 'fridge_out'].map(kind => [starterActionLabel(kind, false)!, starterActionLabel(kind, true)!] as const)),
];

export function translateGuideTitle(title: string, to: string): string {
  const pair = PAIRS.find(([en, fr]) => en === title || fr === title);
  if (!pair) return title;
  return to === 'fr' ? pair[1] : pair[0];
}
