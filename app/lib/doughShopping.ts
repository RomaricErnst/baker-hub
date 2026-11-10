/** The dough part of the shopping list: what to buy for the recipe, named and
 * measured the way the recipe card does. Pure, so the page can build its list
 * from the live recipe with one call.
 */
import { displayWeight, type UnitSystem } from '../utils/units';
import { formatYeastDose } from '../utils/prefermentDose';

export interface DoughShoppingItem { name: string; amount: string; tickKey?: string }

interface DoughShoppingRecipe {
  flour: number; salt: number; oil?: number; sugar?: number;
  flourParts?: { key: string; name: string; nameFr: string; grams: number }[];
  yeast?: { convertedGrams: number; yeastType?: string } | null;
  sourdough?: unknown | null;
  preferment?: { prefYeastGrams: number; prefYeastType?: string } | null;
  enrichment?: { milk: number; eggs: number; butter: number } | null;
}

/** The name on the packet, so the baker buys the yeast the amount was computed for. */
export function yeastShoppingName(yeastType: string | undefined, locale: string): string {
  const fr = locale === 'fr';
  switch (yeastType) {
    case 'fresh': return fr ? 'Levure de boulanger fraîche' : 'Fresh yeast';
    case 'active_dry': return fr ? 'Levure de boulanger sèche active' : 'Active dry yeast';
    default: return fr ? 'Levure de boulanger sèche instantanée' : 'Instant dry yeast';
  }
}

/** One format for every quantity on the list: a space before the unit
 * ("616 g", never "616g"), and "1 pc" / "2 pcs". Leaves other text alone. */
export function shoppingAmount(amount: string): string {
  return amount.replace(/(\d)(g|kg|ml|cl|l|oz|lb)\b/g, '$1 $2').replace(/\b1 pcs\b/, '1 pc');
}

export function doughShoppingItems(input: {
  recipe: DoughShoppingRecipe; yeastType: string; locale: string; units?: UnitSystem; flourName: string;
}): DoughShoppingItem[] {
  const { recipe, yeastType, locale, units = 'metric', flourName } = input;
  const fr = locale === 'fr';
  // Whole grams on a shopping list; the selected unit system like the recipe.
  const weight = (grams: number) => displayWeight(Math.round(grams), units, locale).replace(' ', ' ');
  const items: DoughShoppingItem[] = [
    ...(recipe.flourParts?.length
      ? recipe.flourParts.map(part => ({ tickKey: `dough_flour_${part.key}`, name: fr ? part.nameFr : part.name, amount: weight(part.grams) }))
      : [{ tickKey: 'dough_0', name: flourName, amount: weight(recipe.flour) }]),
    { tickKey: 'dough_1', name: fr ? 'Sel' : 'Salt', amount: weight(recipe.salt) },
  ];
  const yeastGrams = recipe.preferment != null ? recipe.preferment.prefYeastGrams : recipe.yeast?.convertedGrams;
  const leavened = yeastType === 'sourdough' || (!!yeastGrams && yeastGrams > 0);
  if (yeastType === 'sourdough') {
    items.push({ tickKey: 'dough_2', name: fr ? 'Levain actif' : 'Active starter', amount: '—' });
  } else if (yeastGrams && yeastGrams > 0) {
    // The amount is the one for this yeast type, so the name must say which.
    const type = recipe.preferment?.prefYeastType ?? recipe.yeast?.yeastType ?? yeastType;
    items.push({ tickKey: 'dough_2', name: yeastShoppingName(type, locale), amount: formatYeastDose(yeastGrams, locale).replace(' ', ' ') });
  }
  if ((recipe.sugar ?? 0) > 0) {
    const sugar = recipe.sugar ?? 0;
    items.push({ tickKey: 'dough_sugar', name: fr ? 'Sucre' : 'Sugar', amount: sugar < 10 ? displayWeight(sugar, units, locale).replace(' ', ' ') : weight(sugar) });
  }
  if ((recipe.oil ?? 0) > 0) {
    items.push({ tickKey: leavened ? 'dough_3' : 'dough_2', name: fr ? 'Huile d’olive' : 'Olive oil', amount: weight(recipe.oil ?? 0) });
  }
  // Milk, eggs and butter of an enriched dough (brioche, pain de mie, pain viennois).
  const enrichment = recipe.enrichment;
  if (enrichment) {
    if (enrichment.milk > 0) items.push({ tickKey: 'dough_milk', name: fr ? 'Lait' : 'Milk', amount: weight(enrichment.milk) });
    if (enrichment.eggs > 0) items.push({ tickKey: 'dough_eggs', name: fr ? 'Œufs, pesés sans coquille' : 'Eggs, weighed without shells', amount: weight(enrichment.eggs) });
    if (enrichment.butter > 0) items.push({ tickKey: 'dough_butter', name: fr ? 'Beurre' : 'Butter', amount: weight(enrichment.butter) });
  }
  return items;
}
