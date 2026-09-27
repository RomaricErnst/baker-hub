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
