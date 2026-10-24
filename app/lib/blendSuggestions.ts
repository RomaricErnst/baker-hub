import { FLOUR_DATA, type FlourBlend } from '../data';

export type BlendSuggestion = { id: string; percent: number; en: string; fr: string };
// Optional starting points, not a claim that two flours improve every dough.
// Strength is a rough type/product estimate; the actual recipe still uses the
// selected product's existing properties and fermentation validation.
export function blendSuggestions(style: string, blend: FlourBlend): BlendSuggestion[] {
  const strength = blend.w1 ?? blend.wOverride ?? FLOUR_DATA[blend.flour1].w;
  const suggestions: BlendSuggestion[] = [];
  const add = (id: string, percent: number, en: string, fr: string) => suggestions.push({ id, percent, en, fr });
  if (style === 'batbout' && blend.flour1 !== 'semolina') {
    add('caputo_semola', 33, 'Fine remilled semolina · traditional blend', 'Semoule fine remoulue · mélange traditionnel');
  } else if (['neapolitan', 'newyork', 'roman', 'pan', 'contemporary', 'focaccia', 'panuozzo', 'bagel', 'brioche', 'pain_viennois'].includes(style)) {
    if (strength < 300 && !['rye', 'semolina', 'wholemeal', 'manitoba'].includes(blend.flour1))
      add('caputo_manitoba', 15, 'More strength · optional', 'Plus de force · facultatif');
    if (['neapolitan', 'roman', 'pan', 'focaccia', 'panuozzo'].includes(style) && blend.flour1 !== 'semolina')
      add('caputo_semola', 10, 'Fine remilled semolina · texture variation, in the dough (not dusting)', 'Semoule fine remoulue · variante de texture, dans la pâte (pas le fleurage)');
  } else if (['sourdough', 'pain_levain', 'pain_campagne', 'pain_complet', 'baguette'].includes(style)) {
    if (blend.flour1 !== 'rye') add('celnat_seigle_t130', style === 'baguette' ? 5 : 10, 'Rye · flavour variation', 'Seigle · variante de goût');
    if (blend.flour1 !== 'wholemeal') add('francine_complete', style === 'baguette' ? 5 : 15, 'Whole wheat · wholegrain flavour', 'Blé complet · goût de céréales');
  } else if (style === 'pain_seigle' && blend.flour1 === 'rye') {
    add('foricher_t65', 30, 'Wheat · a wheat–rye variation', 'Blé · variante blé–seigle');
  }
  return suggestions;
}
