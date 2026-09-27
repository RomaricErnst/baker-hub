import { FLOUR_DATA, type FlourBlend } from '../data';

// Buying guidance for the existing style formulas, not a change to their hydration.
const recommendations: Record<string, {fr:string;en:string}> = {
  neapolitan: {fr:'Farine à pizza 00 (type Pizzeria ou équivalent)',en:'00 pizza flour (Pizzeria type or equivalent)'},
  newyork: {fr:'Farine de blé panifiable forte (13 % de protéines ou plus)',en:'Strong bread flour (13% protein or more)'},
  pizza_romana: {fr:'Farine à pizza mi-forte (W250–280)',en:'Medium-strong pizza flour (W250–280)'},
  roman: {fr:'Farine de blé forte pour pizza (W300 ou plus)',en:'Strong pizza flour (W300 or higher)'},
  sourdough: {fr:'Farine de blé panifiable forte (T65 ou 00 forte)',en:'Strong bread flour or strong 00 flour'},
  pain_campagne: {fr:'Farine de blé panifiable T65 ou équivalent',en:'White bread flour (French T65 or equivalent)'},
  pain_levain: {fr:'Farine de blé panifiable forte T65 ou équivalent',en:'Strong white bread flour (French T65 or equivalent)'},
  pain_complet: {fr:'Farine de blé complète T110 ou T150',en:'Wholemeal wheat flour (French T110 or T150)'},
  pain_seigle: {fr:'Farine panifiable de seigle T130/T170 ou mélange contenant au moins 60 % de seigle',en:'Rye bread flour (French T130/T170), or a bread blend with at least 60% rye'},
  brioche: {fr:'Farine de blé de force pour brioche (T45/T55 de gruau ou équivalent)',en:'Strong white flour suitable for brioche (bread flour or equivalent)'},
  pain_viennois: {fr:'Farine de blé T45 ou T55, sans levure incorporée',en:'Plain white wheat flour (French T45 or T55), not self-raising'},
  pain_mie: {fr:'Farine de blé T55, sans levure incorporée',en:'Plain white wheat flour (French T55), not self-raising'},
  piadina: {fr:'Farine de blé T55, sans levure incorporée',en:'Plain white wheat flour (French T55), not self-raising'},
};

export function recommendedFlourName(styleKey: string, locale: string): string {
  return (recommendations[styleKey] ?? {
    fr:'Farine de blé panifiable (T65 ou équivalent)',
    en:'White bread flour (French T65 or equivalent)',
  })[locale === 'fr' ? 'fr' : 'en'];
}

export function flourShoppingName(styleKey: string, locale: string, mode: 'simple'|'custom', blend?: FlourBlend): string {
  if (mode !== 'custom' || !blend) return recommendedFlourName(styleKey, locale);
  const name = (key: keyof typeof FLOUR_DATA, custom?: string) => custom || (locale === 'fr' ? FLOUR_DATA[key]?.nameFr : FLOUR_DATA[key]?.name) || key;
  const primary = name(blend.flour1, blend.brandProduct);
  if (!blend.flour2 || blend.ratio1 >= 100) return primary;
  const third = blend.flour3 && blend.ratio2 !== undefined && blend.ratio1 + blend.ratio2 < 100;
  const parts = [`${blend.ratio1} % ${primary}`, `${third ? blend.ratio2 : 100-blend.ratio1} % ${name(blend.flour2, blend.customFlour2Name)}`];
  if (third) parts.push(`${100-blend.ratio1-blend.ratio2!} % ${name(blend.flour3!, blend.customFlour3Name)}`);
  return parts.join(' + ');
}
