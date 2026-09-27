import type {Ingredient} from './toppingTypes';

/** These fresh cheeses are sold in packing liquid; low-moisture pizza cheese is not. */
export const DRAINED_MOZZARELLA_IDS = new Set(['fior_di_latte','buffalo_mozzarella','mozzarella']);
export const drainedWeightShoppingNote = {
  fr:'Utilisez le poids net égoutté du paquet, sans la saumure.',
  en:'Use the pack’s declared drained weight, excluding brine.',
};
export function withDrainedCheeseWeight(ingredient:Ingredient):Ingredient {
  if(!DRAINED_MOZZARELLA_IDS.has(ingredient.id))return ingredient;
  const byPiece=ingredient.qtyPerPizza?.unit==='pcs';
  const suffix=byPiece?{fr:' (sans saumure)',en:' (without brine)'}:{fr:' (poids égoutté)',en:' (drained weight)'};
  const name={...ingredient.name};
  for(const lang of ['fr','en'] as const)if(!/égoutt|drained|sans saumure|without brine/i.test(name[lang]))name[lang]+=suffix[lang];
  return {...ingredient,name,qtyPerPizza:ingredient.qtyPerPizza?{...ingredient.qtyPerPizza,
    noteFR:byPiece?'Nombre de boules de fromage ; leur taille varie.':'Poids du fromage égoutté, sans saumure.',noteEN:byPiece?'Number of cheese balls; their size varies.':'Drained cheese weight, without brine.',
  }:undefined};
}

export function mozzarellaShoppingNote(unit?:string) {
  return unit==='pcs'?{fr:'Quantité en boules de fromage, pas en paquets. Vérifiez leur taille.',en:'Quantity counts cheese balls, not packs. Check their size.'}:drainedWeightShoppingNote;
}

/** Recipe amounts for these toppings are edible cooked meat, not raw purchase weight. */
export const COOKED_CHICKEN_IDS = new Set(['grilled_chicken', 'chicken_thigh_grilled']);

export function withCookedChickenWeight(ingredient: Ingredient): Ingredient {
  if (!COOKED_CHICKEN_IDS.has(ingredient.id)) return ingredient;
  const name = {...ingredient.name};
  if (!/poids cuit/i.test(name.fr)) name.fr += ' (poids cuit)';
  if (!/cooked weight/i.test(name.en)) name.en += ' (cooked weight)';
  // FSIS safe-temperature chart: all poultry 165 F / 73.9 C measured at the centre.
  const safety = {
    fr: 'Cuisez séparément le poulet cru à au moins 74 °C à cœur, vérifiés au thermomètre, avant de garnir. Pesez ensuite la quantité cuite indiquée.',
    en: 'Cook raw chicken separately to at least 74°C at the centre, checked with a thermometer, before topping. Then weigh the listed cooked amount.',
  };
  const prepNote = {...ingredient.prepNote, timing: Math.max(30, ingredient.prepNote?.timing ?? 0),
    fr: `${ingredient.prepNote?.fr ?? ''} ${safety.fr}`.trim(),
    en: `${ingredient.prepNote?.en ?? ''} ${safety.en}`.trim(),
  };
  return {...ingredient, name, prepNote, qtyPerPizza: ingredient.qtyPerPizza ? {...ingredient.qtyPerPizza,
    noteFR:'Poids de viande cuite, sans peau ni os.', noteEN:'Cooked meat weight, without skin or bones.'} : undefined};
}

/** Shopping/export note only; never changes the recipe's cooked-weight total.
 * Breast estimate matches sandwichCatalog's 0.73 tenderloin-yield assumption.
 * That cut-specific estimate must not silently be applied to thighs or bone-in poultry. */
export function pizzaShoppingWeightNote(id: string, cookedGrams: number | undefined, unit: string | undefined, locale: string): string {
  const l = locale === 'fr' ? 'fr' : 'en';
  if (DRAINED_MOZZARELLA_IDS.has(id)) return mozzarellaShoppingNote(unit)[l];
  if (!COOKED_CHICKEN_IDS.has(id) || unit !== 'g' || !Number.isFinite(cookedGrams) || (cookedGrams ?? 0) <= 0) return '';
  const cooked = Math.round(cookedGrams!);
  if (id === 'chicken_thigh_grilled') return l === 'fr'
    ? `Il faut ${cooked} g de haut de cuisse cuit, sans peau ni os. Pour un achat cru, prévoyez davantage : la perte varie selon la découpe et la cuisson. Ou achetez ${cooked} g déjà cuits.`
    : `You need ${cooked} g cooked thigh meat, without skin or bones. Buy more if starting raw: yield varies with the cut and cooking. Or buy ${cooked} g already cooked.`;
  const raw = Math.ceil(cookedGrams! / 0.73 / 10) * 10;
  return l === 'fr'
    ? `À acheter : environ ${raw} g de blanc cru sans peau ni os pour ${cooked} g cuits (rendement estimé 73 %, variable selon la cuisson). Ou ${cooked} g déjà cuits.`
    : `Buy about ${raw} g raw boneless skinless breast for ${cooked} g cooked (estimated 73% yield; varies with cooking). Or ${cooked} g already cooked.`;
}
