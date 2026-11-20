import { breadNoun } from './breadNames';

/** A bake's name until the baker names it: what is made, or the meal for pizza ("Pizza night" from the bake hour).
 *  The Recipe's title, the rating sheet and the home rows all use it (20 Nov 2026 round 6: one name per bake). */
export function bakeTitleName(bakeType: string | null, styleKey: string | null, count: number, bakeHour: number | undefined, fr: boolean, styleName: string): string {
  if (bakeType === 'bread') {
    const noun = breadNoun(styleKey, count, fr);
    return ['pain', 'pains', 'loaf', 'loaves'].includes(noun) ? (styleName || (fr ? 'Pain' : 'Bread')) : noun.charAt(0).toUpperCase() + noun.slice(1);
  }
  const hour = bakeHour ?? 19;
  return hour >= 17 || hour < 4 ? (fr ? 'Soirée pizza' : 'Pizza night') : hour >= 11 ? (fr ? 'Déjeuner pizza' : 'Pizza lunch') : (fr ? 'Brunch pizza' : 'Pizza brunch');
}
