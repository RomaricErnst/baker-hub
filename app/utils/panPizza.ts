/** Shaping, preheat and bake cards for pizzas that bake in their pan:
 * Pan / Detroit (`pan`) and Roman teglia (`roman`). No round-ball steps.
 * Instructions only; nothing here feeds the schedule or fermentation engines.
 */
import type { UnitSystem } from './units';

export type GuideStep = { bold: string; note: string };
type Lang = 'en' | 'fr';
type Both<T> = Record<Lang, T>;

export function isPanPizzaStyle(styleKey: string): boolean {
  return styleKey === 'pan' || styleKey === 'roman';
}

/** Dough loading the style assumes, in grams per cm² of pan.
 * Detroit-type pans run about 0.6–0.7 g/cm²; a Roman teglia is a little thinner.
 * The styles carry no pan dimensions, so the size is an estimate ("about").
 */
const LOADING: Readonly<Record<string, { gPerCm2: number; ratio: number }>> = {
  pan: { gPerCm2: 0.68, ratio: 7 / 5 },    // 600 g → about 25 × 35 cm
  roman: { gPerCm2: 0.58, ratio: 4 / 3 },  // 700 g → about 30 × 40 cm
};

/** Approximate rectangular pan, in cm, for one piece of dough. */
export function panSizeCm(styleKey: string, pieceWeightG: number): [number, number] | null {
  const loading = LOADING[styleKey];
  if (!loading || !Number.isFinite(pieceWeightG) || pieceWeightG <= 0) return null;
  const area = pieceWeightG / loading.gPerCm2;
  const short = Math.sqrt(area / loading.ratio);
  return [Math.round(short), Math.round(short * loading.ratio)];
}

export function panSizeLabel(styleKey: string, pieceWeightG: number, units: UnitSystem): string | null {
  const size = panSizeCm(styleKey, pieceWeightG);
  if (!size) return null;
  return units === 'imperial'
    ? `${Math.round(size[0] / 2.54)} × ${Math.round(size[1] / 2.54)} in`
    : `${size[0]} × ${size[1]} cm`;
}

export interface PanPizzaGuide {
  title: Both<string>;
  shaping: Both<GuideStep[]>;
  shapingWatchFor: Both<string[]>;
  shapingPitfalls: Both<string[]>;
  preheat: Both<GuideStep[]>;
  bake: Both<GuideStep[]>;
  bakeWatchFor: Both<string[]>;
  bakePitfalls: Both<string[]>;
}

const s = (bold: string, note = ''): GuideStep => ({ bold, note });
const both = <T,>(build: (lang: Lang) => T): Both<T> => ({ en: build('en'), fr: build('fr') });

export function panPizzaGuide(input: {
  styleKey: string; pieceWeightG: number; count: number; ovenType?: string;
  units: UnitSystem; chilledAfterShaping?: boolean;
}): PanPizzaGuide | null {
  const { styleKey, pieceWeightG, count, ovenType, units, chilledAfterShaping = false } = input;
  if (!isPanPizzaStyle(styleKey)) return null;
  const detroit = styleKey === 'pan';
  const many = count > 1;
  const known = Number.isFinite(pieceWeightG) && pieceWeightG > 0;
  const grams = Math.round(pieceWeightG);
  const size = panSizeLabel(styleKey, pieceWeightG, units);
  // French names the two vessels differently: a deep "moule" for pan / Detroit,
  // a flat "plaque" for teglia. English says "pan" for both.
  const pan = (lang: Lang) => lang === 'fr' ? (detroit ? 'le moule' : 'la plaque') : 'the pan';
  const inPan = (lang: Lang) => lang === 'fr' ? (detroit ? 'dans le moule' : 'sur la plaque') : 'in the pan';
  const C = (lang: Lang, degrees: number) => lang === 'fr' ? `${degrees} °C` : `${degrees}°C`;
  const maxNote = (lang: Lang) => lang === 'fr' ? 'ou au maximum de votre four s’il est plus bas' : 'or your oven’s maximum if it is lower';

  const shaping = both(lang => [
    ...(many ? [lang === 'fr'
      ? s(`Pesez la pâte et divisez-la en ${count} pâtons de même poids${known ? ` (environ ${grams} g chacun)` : ''}`, detroit ? 'un pâton par moule' : 'un pâton par plaque')
      : s(`Weigh the dough and divide it into ${count} equal pieces${known ? ` (about ${grams} g each)` : ''}`, 'one piece per pan')] : []),
    lang === 'fr'
      ? s(`Huilez généreusement ${pan(lang)}, jusque dans les coins`, size ? `cette recette prévoit ${detroit ? 'un moule' : 'une plaque'} d’environ ${size} pour ${grams} g de pâte` : '')
      : s(`Oil ${pan(lang)} generously, corners included`, size ? `this recipe assumes a pan of about ${size} for ${grams} g of dough` : ''),
    lang === 'fr'
      ? s(`Déposez la pâte ${inPan(lang)} et étalez-la vers les bords du bout des doigts huilés`, 'sans la forcer ni la déchirer')
      : s(`Place the dough ${inPan(lang)} and press it out towards the edges with oiled fingertips`, 'without forcing or tearing it'),
    lang === 'fr'
      ? s('Si la pâte se rétracte, couvrez, laissez-la reposer 10 min, puis étalez de nouveau jusqu’aux coins', 'le repos détend la pâte : elle s’étire ensuite sans résister')
      : s('If the dough springs back, cover it, rest 10 min, then press again until it reaches the corners', 'the rest relaxes the dough: it then stretches without resisting'),
    chilledAfterShaping
      ? (lang === 'fr' ? s(`Couvrez ${pan(lang)} et placez au réfrigérateur`, 'suivez la durée de repos au froid prévue')
        : s(`Cover ${pan(lang)} and refrigerate`, 'follow the planned cold-rest duration'))
      : (lang === 'fr' ? s(`Couvrez et laissez la pâte lever ${inPan(lang)} jusqu’à ce qu’elle soit bien gonflée`, 'suivez la durée d’apprêt prévue')
        : s(`Cover and let the dough rise ${inPan(lang)} until puffy`, 'follow the planned proof time')),
  ]);

  const homeOven = (lang: Lang) => lang === 'fr'
    ? s(`Préchauffez le four à environ ${C(lang, 250)}`, maxNote(lang))
    : s(`Heat the oven to about ${C(lang, 250)}`, maxNote(lang));
  const preheat = both(lang => ovenType === 'pizza_oven' ? (lang === 'fr' ? [
    s(`Chauffez le four, puis laissez-le redescendre vers 250–${C(lang, 300)} avec une flamme basse`, 'une pizza en moule demande un four plus doux qu’une pizza ronde : elle y reste plus de 10 min'),
    s('Contrôlez la température de la sole avant d’enfourner', 'un thermomètre infrarouge donne la mesure la plus fiable'),
  ] : [
    s(`Heat the oven, then let it settle to about 250–${C(lang, 300)} with a low flame`, 'a pan pizza needs a gentler oven than a round pizza: it stays in for more than 10 min'),
    s('Check the floor temperature before the pan goes in', 'an infrared thermometer is the reliable check'),
  ]) : ovenType === 'electric_pizza' ? (lang === 'fr' ? [
    s(`Réglez le four à environ ${C(lang, 250)}`, 'vérifiez d’abord que le moule entre dans le four, porte fermée'),
    s('Laissez le four atteindre sa température', '15 à 20 min pour la plupart des modèles'),
  ] : [
    s(`Set the oven to about ${C(lang, 250)}`, 'first check that the pan fits inside with the door closed'),
    s('Let the oven reach temperature', '15–20 min for most models'),
  ]) : ovenType === 'home_oven_steel' ? [
    lang === 'fr' ? s('Placez la pierre ou l’acier sur la grille la plus basse', 'le moule sera posé directement dessus : le dessous croustille mieux')
      : s('Place the stone or steel on the lowest rack', 'the pan will sit directly on it: the base crisps better'),
    homeOven(lang),
    lang === 'fr' ? s('Comptez 45 min de préchauffage', 'la pierre ou l’acier doit chauffer à cœur') : s('Allow 45 min of preheating', 'the stone or steel has to heat through'),
  ] : [
    lang === 'fr' ? s('Placez une grille en position basse', 'la chaleur du bas saisit le dessous de la pizza') : s('Set a rack in the lowest position', 'bottom heat is what crisps the base'),
    homeOven(lang),
    lang === 'fr' ? s('Comptez 20 à 30 min de préchauffage', 'rien d’autre à préchauffer : la pâte cuit dans son moule') : s('Allow 20–30 min of preheating', 'nothing else to preheat: the dough bakes in its own pan'),
  ]);

  const minutes = ovenType === 'pizza_oven' ? [8, 12] : [12, 15];
  const range = (lang: Lang) => lang === 'fr' ? `${minutes[0]} à ${minutes[1]} min` : `${minutes[0]}–${minutes[1]} min`;
  const where = (lang: Lang) => ovenType === 'pizza_oven'
    ? (lang === 'fr' ? `Enfournez ${pan(lang)}, loin de la flamme, et cuisez ${range(lang)} en le tournant à mi-cuisson` : `Slide ${pan(lang)} in, away from the flame, and bake ${range(lang)}, turning it halfway`)
    : ovenType === 'home_oven_steel'
    ? (lang === 'fr' ? `Posez ${pan(lang)} sur la pierre chaude, en bas du four, et cuisez ${range(lang)}` : `Set ${pan(lang)} on the hot stone, low in the oven, and bake ${range(lang)}`)
    : ovenType === 'electric_pizza'
    ? (lang === 'fr' ? `Enfournez ${pan(lang)} et cuisez ${range(lang)}` : `Slide ${pan(lang)} in and bake ${range(lang)}`)
    : (lang === 'fr' ? `Enfournez ${pan(lang)} sur la grille basse et cuisez ${range(lang)}` : `Place ${pan(lang)} on the lowest rack and bake ${range(lang)}`);
  const bake = both(lang => [
    detroit
      ? (lang === 'fr' ? s('Garnissez la pâte dans son moule, le fromage jusqu’aux bords', 'il caramélise contre les parois ; la sauce se pose en bandes dessus, ou après la cuisson')
        : s('Top the dough in its pan, with the cheese right to the edges', 'it caramelises against the sides; the sauce goes on in stripes, or after baking'))
      : (lang === 'fr' ? s('Garnissez légèrement la pâte sur sa plaque', 'les ingrédients fragiles s’ajoutent à la sortie du four')
        : s('Top the dough lightly in its pan', 'delicate toppings go on after baking')),
    s(where(lang), lang === 'fr' ? 'c’est cuit quand les bords sont brun foncé ; une pâte épaisse peut demander quelques minutes de plus'
      : 'ready when the edges are deep brown; a thick dough may need a few minutes more'),
    lang === 'fr' ? s('Soulevez un coin avec une spatule pour contrôler le dessous', 'il doit être doré et croustillant ; encore pâle, poursuivez 2 à 3 min')
      : s('Lift a corner with a spatula to check the base', 'it should be golden brown and crisp; if it is still pale, give it 2–3 min more'),
    lang === 'fr' ? s(`Laissez reposer 2 min, puis faites glisser la pizza hors ${detroit ? 'du moule' : 'de la plaque'}`, 'passez d’abord la spatule le long des bords ; découpez sur une planche ou une grille')
      : s('Rest 2 min, then slide the pizza out of the pan', 'run the spatula around the edges first; cut it on a board or a rack'),
  ]);

  return {
    title: both(lang => many
      ? (lang === 'fr' ? (detroit ? 'Diviser et étaler en moule' : 'Diviser et étaler sur plaque') : 'Divide and press into the pans')
      : (lang === 'fr' ? (detroit ? 'Étaler la pâte dans le moule' : 'Étaler la pâte sur la plaque') : 'Press the dough into the pan')),
    shaping,
    shapingWatchFor: both(lang => lang === 'fr' ? [
      'La pâte atteint les coins sans se déchirer',
      'Épaisseur régulière : les zones fines colorent en premier',
    ] : [
      'The dough reaches the corners without tearing',
      'Even thickness across the pan: thin spots brown first',
    ]),
    shapingPitfalls: both(lang => lang === 'fr' ? [
      'Forcer une pâte qui se rétracte la déchire : laissez-la reposer, puis reprenez',
      'Des coins peu huilés : la pizza attache et les bords croustillent moins',
    ] : [
      'Forcing dough that springs back tears it: let it rest, then try again',
      'Too little oil in the corners: the pizza sticks and the edges crisp less',
    ]),
    preheat,
    bake,
    bakeWatchFor: both(lang => lang === 'fr' ? [
      'Bords : brun foncé et croustillants',
      'Dessous : doré et ferme quand on soulève un coin',
      'Fromage : fondu, avec des bulles dorées',
    ] : [
      'Edges: deep brown and crisp',
      'Base: golden and firm when you lift a corner',
      'Cheese: melted, with golden bubbles',
    ]),
    bakePitfalls: both(lang => lang === 'fr' ? [
      'Un dessous pâle manque de chaleur par le bas : descendez la pizza d’un cran ou prolongez de quelques minutes',
      'Une garniture trop humide détrempe la mie : égouttez les ingrédients',
      'Démouler trop vite : laissez reposer 2 min pour que les bords se décollent',
    ] : [
      'A pale base needs more bottom heat: move the pizza down a rack or bake a few minutes longer',
      'Wet toppings make the crumb soggy: drain them first',
      'Unmoulding straight away: rest 2 min so the edges release',
    ]),
  };
}
