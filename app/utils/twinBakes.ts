// Two bakes of the same name (22 Nov 2026 round 9, N/S7, Priya: two "Pizza night" bakes on Saturday read
// "Pizza night & Pizza night" on home and "156 g for the pizzas, 156 g for the pizzas" in the shared feed line).
// A bake is told apart by its bake day, and by its bake time as well when another bake of that name is on the
// same day. A name no other bake shares gets nothing (owner's rule B: one bake, nothing new).
import { formatClock } from './units';

/** "Sat", "Sat 7:30pm" (FR « Sam. », « Sam. 19h30 »), or '' when no other bake has this name. */
export function twinBakeWhen(bakeAt: number | null | undefined, othersOfSameName: readonly (number | null | undefined)[], locale: string): string {
  const others = othersOfSameName.filter((at): at is number => typeof at === 'number' && Number.isFinite(at));
  if (bakeAt == null || !Number.isFinite(bakeAt) || !others.length) return '';
  const date = new Date(bakeAt);
  const day = date.toLocaleDateString(locale.startsWith('fr') ? 'fr-FR' : 'en-GB', { weekday: 'short' });
  const Day = day.charAt(0).toUpperCase() + day.slice(1);
  const sameDay = others.some(at => new Date(at).toDateString() === date.toDateString());
  return sameDay ? `${Day} ${formatClock(date, locale)}` : Day;
}

/** The name a home row gives the bakes of one jar step: one name for each, or, when every bake of the row has the
 *  same name, that name once with "both bakes" (FR « les deux fournées »): the step is the jar's, for both. */
export function jarRowName(names: readonly string[], locale: string): string {
  const fr = locale.startsWith('fr');
  if (names.length > 1 && names.every(name => name === names[0])) return `${names[0]} · ${fr ? (names.length === 2 ? 'les deux fournées' : `${names.length} fournées`) : (names.length === 2 ? 'both bakes' : `${names.length} bakes`)}`;
  return names.join(fr ? ' et ' : ' & ');
}
