import type { Ingredient, Locale } from './toppingTypes';
import recipes from './auditedPizzaRecipes.json';
export const AUDITED_PIZZA_RECIPES = recipes as unknown as Record<string, { ingredients: Ingredient[]; story: Locale; preparationSequence?: Locale }>;
