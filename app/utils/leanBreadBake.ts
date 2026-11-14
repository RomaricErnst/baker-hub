/** Preheat and bake cards for the lean breads that have no BREAD_PROTOCOLS entry:
 * baguette, fougasse, pain de campagne, pain au levain, pain complet, pain de seigle,
 * pain au seigle.
 *
 * These are baking instructions only. They do not feed the fermentation or
 * schedule engines. Temperatures are written in °C here and converted for the
 * baker's unit system by ovenTempText.
 */
import { gToOz, type UnitSystem } from './units';

export type GuideStep = { bold: string; note: string };
type Lang = 'en' | 'fr';
type Both<T> = Record<Lang, T>;

export interface LeanBreadBake {
  /** Oven setting at loading, static heat and fan. */
  tempStaticC: number;
  tempFanC: number;
  /** Total minutes in the oven for one piece of the given weight. */
  minutes: [number, number];
  /** Minutes with steam (or under the lid) at the start; 0 when none. */
  steamMinutes: number;
  scored: boolean;
  preheat: Both<GuideStep[]>;
  bake: Both<GuideStep[]>;
  watchFor: Both<string[]>;
  pitfalls: Both<string[]>;
}

export const LEAN_BREAD_STYLES = ['baguette', 'fougasse', 'pain_campagne', 'pain_levain', 'pain_complet', 'pain_seigle', 'pain_au_seigle'] as const;

/** Oven settings are dialled in 5 °F steps: 250 °C is 480 °F, never 482. */
export function ovenTempF(celsius: number): number {
  return Math.round((celsius * 9 / 5 + 32) / 5) * 5;
}

/** Converts every "250°C" / "250 °C" in a guide line for imperial bakers.
 * Oven settings (120 °C and above) round to the nearest 5 °F; lower values
 * (core temperatures, water) keep the nearest degree. Values below fromC are
 * left as written. Metric text is unchanged.
 */
export function ovenTempText(text: string, units: UnitSystem, fromC = 0): string {
  if (units !== 'imperial') return text;
  const f = (c: number) => c >= 120 ? ovenTempF(c) : Math.round(c * 9 / 5 + 32);
  return text.replace(/(\d+)(?:–(\d+))?([\s  ]?)°C/g, (whole, a, b, gap) =>
    Number(b ?? a) < fromC ? whole : `${b ? `${f(Number(a))}–${f(Number(b))}` : f(Number(a))}${gap}°F`);
}

/** Converts every gram weight written in a guide line ("600 g", "60–100 g",
 * "±10g") for imperial bakers. Weights under 6 g stay in grams (they are
 * weighed on a fine scale); a ± tolerance is always converted, since it
 * describes a larger piece. Metric text keeps its numbers, gains a space
 * before the unit when it had none ("10g" → "10 g") and groups thousands. */
export function guideWeightText(text: string, units: UnitSystem, locale = 'en'): string {
  const fr = locale.startsWith('fr');
  // Same separator as displayWeight: a space in English, a narrow no-break space in French.
  const unitGap = fr ? ' ' : ' ';
  const num = (value: string) => Number(value.replace(',', '.'));
  const oz = (grams: number) => gToOz(grams).toLocaleString(fr ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 });
  const grams = (value: string) => num(value) >= 1000 && Number.isInteger(num(value)) ? num(value).toLocaleString(fr ? 'fr-FR' : 'en-US') : value;
  return text.replace(/(^|[^\w.,])(±\s?)?(\d+(?:[.,]\d+)?)(?:–(\d+(?:[.,]\d+)?))?([   ]?)g\b/g,
    (whole, pre: string, plusMinus: string | undefined, a: string, b: string | undefined, gap: string) => {
      const pm = plusMinus ? '±' : '';
      if (units !== 'imperial' || (!plusMinus && num(b ?? a) < 6)) return `${pre}${pm}${b ? `${grams(a)}–${grams(b)}` : grams(a)}${gap || unitGap}g`;
      return `${pre}${pm}${b ? `${oz(num(a))}–${oz(num(b))}` : oz(num(a))}${unitGap}oz`;
    });
}

/** Temperatures and weights of one guide line, in the baker's unit system. */
export function guideUnitText(text: string, units: UnitSystem, locale = 'en', fromC = 0): string {
  return guideWeightText(ovenTempText(text, units, fromC), units, locale);
}

/** Preheat for the lean breads: a heavy tray needs 30 min at 230–250 °C; a stone,
 * steel or cast-iron pot needs 45 min to heat through. Other breads keep the
 * oven's own figure. */
export function leanBreadPreheatMin(styleKey: string | undefined, ovenType: string | undefined, ovenPreheatMin: number): number {
  if (!styleKey || !(LEAN_BREAD_STYLES as readonly string[]).includes(styleKey)) return ovenPreheatMin;
  // Baguette, fougasse and rye bake on a tray or in a tin even when a Dutch oven
  // is chosen: the pot stays out, so the tray's 30 min applies.
  const potLoaf = !['baguette', 'fougasse', 'pain_seigle'].includes(styleKey);
  if (ovenType === 'home_oven_stone_bread' || (ovenType === 'dutch_oven' && potLoaf)) return 45;
  if (ovenType === 'standard_bread' || ovenType === 'dutch_oven') return 30;
  return ovenPreheatMin;
}

export function leanBreadMinutes(styleKey: string, weight: number): [number, number] | null {
  const w = Number.isFinite(weight) && weight > 0 ? weight : 0;
  switch (styleKey) {
    case 'baguette': return w < 200 ? [15, 20] : w <= 400 ? [20, 25] : [25, 30];
    case 'fougasse': return w <= 250 ? [12, 15] : w <= 500 ? [15, 20] : [18, 25];
    case 'pain_seigle': return w <= 500 ? [35, 45] : w <= 900 ? [45, 55] : [55, 70];
    case 'pain_campagne': case 'pain_levain': case 'pain_complet': case 'pain_au_seigle':
      return w <= 500 ? [30, 35] : w <= 800 ? [40, 45] : w <= 1100 ? [45, 50] : [50, 60];
    default: return null;
  }
}

const s = (bold: string, note = ''): GuideStep => ({ bold, note });
const en = (low: number, high: number) => `${low}–${high} min`;
const fr = (low: number, high: number) => `${low} à ${high} min`;
// French sets a no-break space before the degree sign.
const C = (lang: Lang, degrees: number) => lang === 'fr' ? `${degrees} °C` : `${degrees}°C`;
const setting = (lang: Lang, fixed: number, fan: number) => lang === 'fr'
  ? `${C(lang, fixed)} en chaleur statique / ${C(lang, fan)} en chaleur tournante`
  : `${C(lang, fixed)} static / ${C(lang, fan)} fan`;
const both = <T,>(build: (lang: Lang) => T): Both<T> => ({ en: build('en'), fr: build('fr') });

/** Null when the style is not a lean bread, or when its existing oven card
 * already states real temperatures (round loaves in a wood-fired oven).
 */
/** How many pieces one oven load takes (14 Nov 2026 audit: 20 baguettes in one "Bake the bread"
 *  step). Conservative home figures: a tray of baguettes or fougasses, two loaves, one per pot. */
export function piecesPerOvenLoad(styleKey: string, ovenType: string | undefined): number {
  if (ovenType === 'dutch_oven') return 1;
  const long = styleKey === 'baguette' || styleKey === 'fougasse';
  if (ovenType === 'wood_fired') return long ? 8 : 6;
  return long ? 4 : 2;
}

export function leanBreadBake(styleKey: string, pieceWeightG: number, ovenType: string | undefined, count = 1): LeanBreadBake | null {
  const base = leanBreadBakeOneLoad(styleKey, pieceWeightG, ovenType, count);
  if (!base) return null;
  const perLoad = piecesPerOvenLoad(styleKey, ovenType);
  if (count <= perLoad) return base;
  const rounds = Math.ceil(count / perLoad);
  const roundsStep = (lang: Lang) => lang === 'fr'
    ? s(`Cuisez en ${rounds} fournées de ${perLoad} au plus`, 'gardez les autres au frais, couvertes, jusqu’à leur tour ; laissez le four reprendre sa température entre deux fournées')
    : s(`Bake in ${rounds} rounds of up to ${perLoad}`, 'keep the waiting ones covered in the fridge until their turn; let the oven recover its heat between rounds');
  return { ...base, bake: { en: [roundsStep('en'), ...base.bake.en], fr: [roundsStep('fr'), ...base.bake.fr] } };
}

function leanBreadBakeOneLoad(styleKey: string, pieceWeightG: number, ovenType: string | undefined, count = 1): LeanBreadBake | null {
  const minutes = leanBreadMinutes(styleKey, pieceWeightG);
  if (!minutes) return null;
  const [low, high] = minutes;
  const grams = Math.round(pieceWeightG / 10) * 10;
  const many = count > 1;
  const stone = ovenType === 'home_oven_stone_bread';
  const steamOven = ovenType === 'steam_oven';
  const wood = ovenType === 'wood_fired';
  const dutch = ovenType === 'dutch_oven';
  const maxNote = (lang: Lang) => lang === 'fr' ? 'ou au maximum de votre four s’il est plus bas' : 'or your oven’s maximum if it is lower';
  const surfaceStep = (lang: Lang) => stone
    ? (lang === 'fr'
      ? s('Placez la pierre ou l’acier à mi-hauteur avant d’allumer le four', 'comptez au moins 45 min pour une chauffe à cœur')
      : s('Place the baking stone or steel on the middle rack before switching the oven on', 'it needs at least 45 min to heat through'))
    : (lang === 'fr'
      ? s('Laissez une plaque épaisse à mi-hauteur pendant la chauffe', 'comptez 30 min ; la plaque chaude colore le dessous')
      : s('Leave a heavy baking tray on the middle rack while the oven heats', 'allow 30 min; the hot tray colours the base'));
  const surface = (lang: Lang) => stone ? (lang === 'fr' ? 'la pierre chaude' : 'the hot stone') : (lang === 'fr' ? 'la plaque chaude' : 'the hot tray');
  const steamTray = (lang: Lang) => lang === 'fr'
    ? s('Glissez une lèchefrite vide tout en bas du four', 'elle servira à produire la buée à l’enfournement')
    : s('Place an empty metal tray on the bottom rack', 'for steam when the bread goes in');
  const woodFire = (lang: Lang, floorLow: number, floorHigh: number) => lang === 'fr' ? [
    s('Allumez le four et laissez les flammes retomber en braises', 'four léger : environ 45 min · four traditionnel en brique ou en pierre : 2 à 3 h de chauffe'),
    s(`Repoussez les braises sur le côté et laissez la sole redescendre vers ${floorLow}–${C(lang, floorHigh)}`, 'un thermomètre infrarouge donne la mesure la plus fiable ; une sole trop chaude brûle le dessous'),
  ] : [
    s('Fire the oven and let the flames die down to embers', 'light oven: about 45 min · traditional brick or stone oven: 2–3 h of firing'),
    s(`Push the embers to one side and let the floor settle to about ${floorLow}–${C(lang, floorHigh)}`, 'an infrared thermometer is the reliable check; a floor that is too hot scorches the base'),
  ];
  const steamOvenPreheat = (lang: Lang, degrees: number, withSteam: boolean) => lang === 'fr' ? [
    s(`Réglez le four vapeur sur ${C(lang, degrees)}${withSteam ? ', avec vapeur' : ', en chaleur sèche'}`, maxNote(lang)),
    s('Laissez le four atteindre sa température', '20 à 30 min'),
  ] : [
    s(`Set the steam oven to ${C(lang, degrees)}${withSteam ? ' with steam' : ', dry heat'}`, maxNote(lang)),
    s('Let the oven reach temperature', '20–30 min'),
  ];

  if (styleKey === 'baguette') {
    const steam = 10;
    const it = (lang: Lang) => lang === 'fr' ? (many ? 'les baguettes' : 'la baguette') : (many ? 'the baguettes' : 'the baguette');
    const pieces = (lang: Lang) => lang === 'fr' ? (many ? `des pâtons d’environ ${grams} g` : `un pâton d’environ ${grams} g`) : (many ? `pieces of about ${grams} g` : `a piece of about ${grams} g`);
    const done = (lang: Lang) => lang === 'fr' ? 'c’est cuit quand la croûte est bien dorée et que le dessous sonne creux' : 'ready when the crust is deep golden and the base sounds hollow when tapped';
    const score = (lang: Lang) => lang === 'fr'
      ? s(many ? 'Grignez chaque baguette de 3 à 5 incisions obliques qui se chevauchent' : 'Grignez la baguette de 3 à 5 incisions obliques qui se chevauchent', 'lame presque à plat, environ 5 mm de profondeur, d’un geste rapide')
      : s(many ? 'Score each baguette with 3 to 5 slanted, overlapping cuts' : 'Score the baguette with 3 to 5 slanted, overlapping cuts', 'blade almost flat to the dough, about 5 mm deep, one quick stroke per cut');
    const rack = (lang: Lang) => lang === 'fr'
      ? s(`Posez ${it(lang)} sur une grille`, 'l’air qui circule dessous garde la croûte croustillante')
      : s(`Move ${it(lang)} to a rack`, 'air circulating underneath keeps the crust crisp');
    const finish = (lang: Lang, after: number) => lang === 'fr'
      ? s(`Poursuivez la cuisson ${fr(low - after, high - after)} : ${fr(low, high)} au total pour ${pieces(lang)}`, done(lang))
      : s(`Bake ${en(low - after, high - after)} more: ${en(low, high)} in total for ${pieces(lang)}`, done(lang));
    return {
      tempStaticC: 250, tempFanC: 230, minutes, steamMinutes: steam, scored: true,
      preheat: both(lang => wood ? woodFire(lang, 250, 270) : steamOven ? steamOvenPreheat(lang, 240, true) : [
        s(lang === 'fr' ? `Préchauffez le four à ${setting(lang, 250, 230)}` : `Heat the oven to ${setting(lang, 250, 230)}`, maxNote(lang)),
        ...(dutch ? [lang === 'fr'
          ? s('Une baguette est trop longue pour une cocotte : cuisez-la sur une plaque épaisse', 'laissez la plaque à mi-hauteur pendant les 30 min de chauffe')
          : s('A baguette is too long for a Dutch oven: bake it on a heavy tray', 'leave the tray on the middle rack for the 30 min of preheating')] : [surfaceStep(lang)]),
        steamTray(lang),
      ]),
      bake: both(lang => wood ? [
        score(lang),
        lang === 'fr' ? s(`Enfournez ${it(lang)} à la pelle et fermez la porte`, 'le four fermé garde la buée de la pâte pendant les 10 premières minutes')
          : s(`Load ${it(lang)} with a peel and close the door`, 'the closed oven keeps the dough’s own steam for the first 10 min'),
        lang === 'fr' ? s(`Tournez ${it(lang)} après 10 min, puis cuisez jusqu’à une croûte bien dorée : ${fr(low, high)} au total pour ${pieces(lang)}`, `un four à bois cuit souvent plus vite : surveillez dès ${low - 5} min ; ${done(lang)}`)
          : s(`Turn ${it(lang)} after 10 min, then bake until deep golden: ${en(low, high)} in total for ${pieces(lang)}`, `a wood-fired oven often bakes faster: start checking at ${low - 5} min; ${done(lang)}`),
        rack(lang),
      ] : steamOven ? [
        score(lang),
        lang === 'fr' ? s(`Enfournez ${it(lang)} et cuisez ${steam} min avec vapeur`, 'gardez la porte fermée')
          : s(`Load ${it(lang)} and bake ${steam} min with steam`, 'keep the door closed'),
        lang === 'fr' ? s(`Passez en chaleur sèche à ${C(lang, 230)} et poursuivez ${fr(low - steam, high - steam)} : ${fr(low, high)} au total pour ${pieces(lang)}`, done(lang))
          : s(`Switch to dry heat at ${C(lang, 230)} and bake ${en(low - steam, high - steam)} more: ${en(low, high)} in total for ${pieces(lang)}`, done(lang)),
        rack(lang),
      ] : [
        score(lang),
        lang === 'fr' ? s(`Glissez ${it(lang)} sur ${surface(lang)}, versez une tasse d’eau bouillante dans la lèchefrite et refermez aussitôt`, 'une feuille de papier cuisson facilite l’enfournement')
          : s(`Slide ${it(lang)} onto ${surface(lang)}, pour a cup of boiling water into the steam tray and close the door at once`, 'a sheet of baking paper makes the transfer easier'),
        lang === 'fr' ? s(`Cuisez ${steam} min avec la buée, puis retirez la lèchefrite`, 'la porte ouverte un instant laisse sortir le reste de vapeur')
          : s(`Bake ${steam} min with steam, then take the steam tray out`, 'opening the door for a moment lets the remaining steam out'),
        finish(lang, steam),
        rack(lang),
      ]),
      watchFor: both(lang => lang === 'fr' ? [
        'Développement au four : la baguette gonfle nettement pendant les 10 premières minutes',
        'Grignes : les incisions s’ouvrent et forment des oreilles',
        'Couleur : une croûte bien dorée, plus foncée sur les arêtes des grignes',
        'Le dessous sonne creux quand on le tapote',
      ] : [
        'Oven spring: the baguette swells clearly in the first 10 min',
        'Scores: the cuts open and lift into ears',
        'Colour: deep golden crust, darker along the edges of the cuts',
        'The base sounds hollow when tapped',
      ]),
      pitfalls: both(lang => lang === 'fr' ? [
        'Des incisions droites en travers de la baguette s’ouvrent mal : gardez-les obliques, presque dans la longueur',
        'Ouvrir la porte pendant les 10 premières minutes laisse sortir la buée : la croûte se fige avant la fin du développement',
        'Une baguette pâle manque encore de cuisson : fiez-vous à la couleur et au son creux plutôt qu’à la minuterie',
      ] : [
        'Cuts made straight across the baguette open poorly: keep them slanted, almost along its length',
        'Opening the door in the first 10 min lets the steam out: the crust sets before the baguette has finished rising',
        'A pale baguette needs longer: trust the colour and the hollow sound rather than the timer',
      ]),
    };
  }

  if (styleKey === 'fougasse') {
    const it = (lang: Lang) => lang === 'fr' ? (many ? 'les fougasses' : 'la fougasse') : (many ? 'the fougasses' : 'the fougasse');
    const pieces = (lang: Lang) => lang === 'fr' ? (many ? `des pièces d’environ ${grams} g` : `une pièce d’environ ${grams} g`) : (many ? `pieces of about ${grams} g` : `a piece of about ${grams} g`);
    const done = (lang: Lang) => lang === 'fr' ? 'c’est cuit quand la fougasse est bien dorée, avec des bords plus foncés' : 'ready when golden brown, with darker edges';
    const reopen = (lang: Lang) => lang === 'fr'
      ? s('Rouvrez les entailles du bout des doigts si elles se sont refermées', 'pas de grigne : le motif en feuille a été découpé avant l’apprêt')
      : s('Open the cuts again with your fingertips if they have closed', 'no scoring: the leaf pattern was cut before the final proof');
    const oil = (lang: Lang) => lang === 'fr'
      ? s('Badigeonnez d’huile d’olive dès la sortie du four', 'la croûte chaude l’absorbe ; ajoutez une pincée de fleur de sel si vous aimez')
      : s('Brush with olive oil as soon as it comes out of the oven', 'the hot crust absorbs it; add a pinch of flaky salt if you like');
    const rack = (lang: Lang) => lang === 'fr'
      ? s(`Posez ${it(lang)} sur une grille`, 'elle est meilleure tiède, le jour même')
      : s(`Move ${it(lang)} to a rack`, 'best eaten warm, the same day');
    return {
      tempStaticC: 230, tempFanC: 210, minutes, steamMinutes: 0, scored: false,
      preheat: both(lang => wood ? woodFire(lang, 230, 250) : steamOven ? steamOvenPreheat(lang, 230, false) : [
        s(lang === 'fr' ? `Préchauffez le four à ${setting(lang, 230, 210)}` : `Heat the oven to ${setting(lang, 230, 210)}`, maxNote(lang)),
        stone ? surfaceStep(lang) : lang === 'fr'
          ? s(dutch ? 'La fougasse cuit à plat sur sa plaque : la cocotte ne sert pas ici' : 'Gardez la fougasse sur sa plaque garnie de papier cuisson', 'comptez 30 min de préchauffage ; pas besoin de buée')
          : s(dutch ? 'Fougasse bakes flat on its tray: the Dutch oven is not needed here' : 'Keep the fougasse on its lined tray', 'allow 30 min of preheating; no steam needed'),
      ]),
      bake: both(lang => [
        reopen(lang),
        wood
          ? (lang === 'fr' ? s(`Enfournez à la pelle et cuisez ${fr(low, high)} pour ${pieces(lang)}, en tournant à mi-cuisson`, `un four à bois cuit souvent plus vite : surveillez dès ${low - 4} min ; ${done(lang)}`)
            : s(`Load with a peel and bake ${en(low, high)} for ${pieces(lang)}, turning halfway`, `a wood-fired oven often bakes faster: start checking at ${low - 4} min; ${done(lang)}`))
          : stone
          ? (lang === 'fr' ? s(`Glissez ${it(lang)} avec son papier cuisson sur la pierre chaude et cuisez ${fr(low, high)}`, `pour ${pieces(lang)} ; ${done(lang)}`)
            : s(`Slide ${it(lang)} on its baking paper onto the hot stone and bake ${en(low, high)}`, `for ${pieces(lang)}; ${done(lang)}`))
          : (lang === 'fr' ? s(`Enfournez la plaque à mi-hauteur et cuisez ${fr(low, high)}`, `pour ${pieces(lang)} ; ${done(lang)}`)
            : s(`Bake on the middle rack for ${en(low, high)}`, `for ${pieces(lang)}; ${done(lang)}`)),
        oil(lang),
        rack(lang),
      ]),
      watchFor: both(lang => lang === 'fr' ? [
        'Les entailles restent ouvertes et leurs bords dorent en premier',
        'Couleur : bien dorée, avec des bords plus foncés et croustillants',
        'Le dessous est doré et se détache du papier',
      ] : [
        'The cuts stay open and their edges colour first',
        'Colour: golden brown, with darker, crisp edges',
        'The underside is golden and releases from the paper',
      ]),
      pitfalls: both(lang => lang === 'fr' ? [
        'Les bords fins colorent vite : surveillez les dernières minutes',
        'Une fougasse trop cuite devient sèche et dure : sortez-la dès qu’elle est bien dorée',
        'L’huile d’olive se passe à la sortie du four, pas avant : elle parfume la croûte sans la ramollir',
      ] : [
        'Thin edges colour quickly: watch the last few minutes',
        'An over-baked fougasse turns dry and hard: take it out as soon as it is golden brown',
        'Brush the olive oil on after baking, not before: it flavours the crust without softening it',
      ]),
    };
  }

  if (styleKey === 'pain_seigle') {
    const steam = 15;
    const loaf = (lang: Lang) => lang === 'fr' ? `un pain d’environ ${grams} g` : `a loaf of about ${grams} g`;
    const done = (lang: Lang) => lang === 'fr'
      ? `c’est cuit quand la croûte est brun foncé et que le cœur atteint 96–${C(lang, 98)} ; démoulé, le pain sonne creux`
      : `ready when the crust is dark brown and the centre reaches 96–${C(lang, 98)}; unmoulded, the loaf sounds hollow`;
    const unmould = (lang: Lang) => lang === 'fr'
      ? s('Démoulez aussitôt sur une grille', 'laissé dans son moule, le pain ramollit')
      : s('Unmould straight away onto a rack', 'left in its tin, the crust turns damp');
    return {
      tempStaticC: 240, tempFanC: 220, minutes, steamMinutes: steam, scored: false,
      preheat: both(lang => steamOven ? steamOvenPreheat(lang, 230, true) : wood ? woodFire(lang, 230, 250) : [
        s(lang === 'fr' ? `Préchauffez le four à ${setting(lang, 240, 220)}` : `Heat the oven to ${setting(lang, 240, 220)}`, maxNote(lang)),
        ...(dutch ? [lang === 'fr'
          ? s('Le pain de seigle cuit dans son moule : la cocotte ne sert pas ici', 'comptez 30 min de préchauffage')
          : s('Rye bread bakes in its tin: the Dutch oven is not needed here', 'allow 30 min of preheating')] : stone ? [surfaceStep(lang)] : []),
        steamTray(lang),
      ]),
      bake: both(lang => steamOven ? [
        lang === 'fr' ? s(`Enfournez le moule et cuisez ${steam} min avec vapeur`, 'gardez la porte fermée') : s(`Load the tin and bake ${steam} min with steam`, 'keep the door closed'),
        lang === 'fr' ? s(`Passez en chaleur sèche à ${C(lang, 210)} et poursuivez ${fr(low - steam, high - steam)} : ${fr(low, high)} au total pour ${loaf(lang)}`, done(lang))
          : s(`Switch to dry heat at ${C(lang, 210)} and bake ${en(low - steam, high - steam)} more: ${en(low, high)} in total for ${loaf(lang)}`, done(lang)),
        unmould(lang),
      ] : wood ? [
        lang === 'fr' ? s('Enfournez le moule et fermez la porte', 'le four fermé garde l’humidité de la pâte en début de cuisson') : s('Load the tin and close the door', 'the closed oven keeps the dough’s moisture at the start of the bake'),
        lang === 'fr' ? s(`Tournez le moule à mi-cuisson : ${fr(low, high)} au total pour ${loaf(lang)}`, done(lang)) : s(`Turn the tin halfway: ${en(low, high)} in total for ${loaf(lang)}`, done(lang)),
        unmould(lang),
      ] : [
        lang === 'fr' ? s('Enfournez le moule à mi-hauteur, versez une tasse d’eau bouillante dans la lèchefrite et refermez aussitôt', 'pas de grigne : le pain de seigle se fendille de lui-même')
          : s('Place the tin on the middle rack, pour a cup of boiling water into the steam tray and close the door at once', 'no scoring: rye bread cracks open by itself'),
        lang === 'fr' ? s(`Cuisez ${steam} min avec la buée`, 'sans ouvrir la porte') : s(`Bake ${steam} min with steam`, 'without opening the door'),
        lang === 'fr' ? s(`Retirez la lèchefrite, baissez à ${setting(lang, 210, 190)} et poursuivez ${fr(low - steam, high - steam)}`, `${fr(low, high)} au total pour ${loaf(lang)} ; ${done(lang)}`)
          : s(`Take the steam tray out, lower the oven to ${setting(lang, 210, 190)} and bake ${en(low - steam, high - steam)} more`, `${en(low, high)} in total for ${loaf(lang)}; ${done(lang)}`),
        unmould(lang),
      ]),
      watchFor: both(lang => lang === 'fr' ? [
        'La surface se fendille et brunit : c’est l’aspect normal d’un pain de seigle',
        `Température à cœur : 96–${C(lang, 98)}`,
        'Démoulé, le pain sonne creux quand on tapote le dessous',
      ] : [
        'The surface cracks and darkens: this is how rye bread should look',
        `Core temperature: 96–${C(lang, 98)}`,
        'Unmoulded, the loaf sounds hollow when tapped underneath',
      ]),
      pitfalls: both(lang => lang === 'fr' ? [
        'Un pain de seigle sorti trop tôt reste collant au centre : contrôlez la température à cœur',
        'Trancher le jour même donne une mie pâteuse : le seigle finit de se stabiliser en refroidissant',
      ] : [
        'Rye bread taken out too early stays sticky in the middle: check the core temperature',
        'Slicing on the same day gives a pasty crumb: rye finishes setting as it cools',
      ]),
    };
  }

  // Round and oval loaves: pain de campagne, pain au levain, pain complet, pain au seigle.
  // Their wood-fired card already gives floor temperature and total time.
  if (wood) return null;
  const steam = 20;
  const loaf = (lang: Lang) => lang === 'fr' ? `un pain d’environ ${grams} g` : `a loaf of about ${grams} g`;
  const it = (lang: Lang) => lang === 'fr' ? (many ? 'un pain' : 'le pain') : (many ? 'one loaf' : 'the loaf');
  const done = (lang: Lang) => lang === 'fr'
    ? `c’est cuit quand la croûte est brun foncé, que le dessous sonne creux et que le cœur atteint 96–${C(lang, 98)}`
    : `ready when the crust is deep brown, the base sounds hollow and the centre reaches 96–${C(lang, 98)}`;
  const score = (lang: Lang) => lang === 'fr'
    ? s('Grignez le pain : une incision ou une croix', 'lame bien affûtée tenue à 30–45°, environ 1 cm de profondeur, d’un geste franc')
    : s('Score the loaf: one slash or a cross', 'sharp blade held at 30–45°, about 1 cm deep, in one confident stroke');
  const rack = (lang: Lang) => lang === 'fr'
    ? s('Posez le pain sur une grille', 'la mie finit de se fixer en refroidissant : tranché chaud, il reste collant')
    : s('Move the loaf to a rack', 'the crumb finishes setting as it cools: sliced hot, it stays gummy');
  const total = (lang: Lang) => lang === 'fr' ? `${fr(low, high)} au total pour ${loaf(lang)}` : `${en(low, high)} in total for ${loaf(lang)}`;
  return {
    tempStaticC: 250, tempFanC: 230, minutes, steamMinutes: steam, scored: true,
    preheat: both(lang => steamOven ? steamOvenPreheat(lang, 240, true) : dutch ? [
      lang === 'fr' ? s('Placez la cocotte et son couvercle dans le four froid', 'les deux doivent être brûlants au moment d’enfourner')
        : s('Put the Dutch oven and its lid in the cold oven', 'both must be fully hot when the loaf goes in'),
      s(lang === 'fr' ? `Préchauffez à ${setting(lang, 250, 230)} pendant 45 min` : `Heat to ${setting(lang, 250, 230)} for 45 min`, maxNote(lang)),
    ] : [
      s(lang === 'fr' ? `Préchauffez le four à ${setting(lang, 250, 230)}` : `Heat the oven to ${setting(lang, 250, 230)}`, maxNote(lang)),
      surfaceStep(lang),
      steamTray(lang),
    ]),
    bake: both(lang => steamOven ? [
      score(lang),
      lang === 'fr' ? s(`Enfournez ${it(lang)} et cuisez ${steam} min avec vapeur`, 'gardez la porte fermée') : s(`Load ${it(lang)} and bake ${steam} min with steam`, 'keep the door closed'),
      lang === 'fr' ? s(`Passez en chaleur sèche à ${C(lang, 220)} et poursuivez ${fr(low - steam, high - steam)}`, `${total(lang)} ; ${done(lang)}`)
        : s(`Switch to dry heat at ${C(lang, 220)} and bake ${en(low - steam, high - steam)} more`, `${total(lang)}; ${done(lang)}`),
      rack(lang),
    ] : dutch ? [
      score(lang),
      lang === 'fr' ? s(`Déposez ${it(lang)} dans la cocotte à l’aide d’un papier cuisson et remettez le couvercle`, 'la cocotte est brûlante : utilisez des gants épais')
        : s(`Lower ${it(lang)} into the Dutch oven on baking paper and put the lid back on`, 'the pot is very hot: use thick oven gloves'),
      lang === 'fr' ? s(`Cuisez ${steam} min à couvert`, 'la vapeur retenue sous le couvercle laisse le pain se développer') : s(`Bake ${steam} min with the lid on`, 'the steam held under the lid lets the loaf spring'),
      lang === 'fr' ? s(`Retirez le couvercle, baissez à ${setting(lang, 230, 210)} et poursuivez ${fr(low - steam, high - steam)}`, `${total(lang)} ; ${done(lang)}`)
        : s(`Remove the lid, lower the oven to ${setting(lang, 230, 210)} and bake ${en(low - steam, high - steam)} more`, `${total(lang)}; ${done(lang)}`),
      rack(lang),
    ] : [
      score(lang),
      lang === 'fr' ? s(`Glissez ${it(lang)} sur ${surface(lang)}, versez une tasse d’eau bouillante dans la lèchefrite et refermez aussitôt`, 'une feuille de papier cuisson facilite l’enfournement')
        : s(`Slide ${it(lang)} onto ${surface(lang)}, pour a cup of boiling water into the steam tray and close the door at once`, 'a sheet of baking paper makes the transfer easier'),
      lang === 'fr' ? s(`Cuisez ${steam} min avec la buée, sans ouvrir la porte`, 'la buée garde la croûte souple pendant que le pain se développe')
        : s(`Bake ${steam} min with steam, without opening the door`, 'steam keeps the crust supple while the loaf springs'),
      lang === 'fr' ? s(`Retirez la lèchefrite, baissez à ${setting(lang, 230, 210)} et poursuivez ${fr(low - steam, high - steam)}`, `${total(lang)} ; ${done(lang)}`)
        : s(`Take the steam tray out, lower the oven to ${setting(lang, 230, 210)} and bake ${en(low - steam, high - steam)} more`, `${total(lang)}; ${done(lang)}`),
      rack(lang),
    ]),
    // The existing loaf watch-for and pitfall lists already fit these breads.
    watchFor: { en: [], fr: [] },
    pitfalls: { en: [], fr: [] },
  };
}
