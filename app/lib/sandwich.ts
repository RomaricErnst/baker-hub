import { SANDWICH_FAMILIES, SANDWICH_INGREDIENTS, SANDWICH_RECIPES, buildSandwichSteps, type SandwichFamily, type SandwichRecipe, type SandwichPortion } from './sandwichCatalog';
export type SandwichTab = 'pick' | 'shop' | 'prep' | 'serve';
export interface SandwichSnapshot {
  familyId: SandwichFamily | null;
  qtys: Record<string,number>;
  completed: Record<string,number>;
  shopTicks: Record<string,boolean>;
  prepTicks: Record<string,boolean>;
  tab: SandwichTab;
  ingredientOverrides?: Record<string,Record<string,number>>;
}
const record = (value: unknown): Record<string,unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value,key);
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(99,Math.max(0,Math.floor(value))) : 0;
export function createSandwichSnapshot(familyId: SandwichFamily | null = null): SandwichSnapshot {
  return {familyId,qtys:{},completed:{},shopTicks:{},prepTicks:{},tab:'pick',ingredientOverrides:{}};
}
export function sandwichFamilyForStyle(styleKey: string): SandwichFamily | null {
  const aliases: Record<string,SandwichFamily> = {baguette:'baguette',focaccia:'focaccia',bagel:'bagel',bagels:'bagel',pita:'pita',greek_pita:'greek_pita',kebab_bread:'kebab_bread',batbout:'batbout',laffa:'laffa',piadina:'piadina',pan_bagnat:'pan_bagnat',ciabatta:'ciabatta',panuozzo:'panuozzo'};
  return own(aliases,styleKey) ? aliases[styleKey] : null;
}
export const getSandwichFamily = sandwichFamilyForStyle;
export function getSandwichRecipe(id: string): SandwichRecipe | undefined { return SANDWICH_RECIPES.find(recipe => recipe.id === id); }
export function reconcileSandwichSelection(familyId: SandwichFamily | null, qtys: Record<string,number>): Record<string,number> {
  const valid: Record<string,number> = {};
  for (const recipe of SANDWICH_RECIPES) if (recipe.familyId === familyId && own(qtys,recipe.id) && count(qtys[recipe.id])) valid[recipe.id] = count(qtys[recipe.id]);
  return valid;
}
export function normalizeSandwichSnapshot(value: unknown, resetProgress = false): SandwichSnapshot {
  const source = record(value);
  const familyId = SANDWICH_FAMILIES.find(f => f.id === source.familyId)?.id ?? null;
  const result = createSandwichSnapshot(familyId);
  result.qtys = reconcileSandwichSelection(familyId,record(source.qtys) as Record<string,number>);
  const overrides = record(source.ingredientOverrides);
  for (const recipe of SANDWICH_RECIPES.filter(recipe=>recipe.familyId===familyId)) {
    const recipeId = recipe.id;
    const values = record(overrides[recipeId]);
    const clean: Record<string,number> = {};
    for (const ingredient of recipe.ingredients) {
      const grams = values[ingredient.ingredientId];
      if (own(values,ingredient.ingredientId) && typeof grams === 'number' && Number.isFinite(grams) && grams >= 0 && grams <= 1000) clean[ingredient.ingredientId] = Math.round(grams*10)/10;
    }
    if (Object.keys(clean).length) result.ingredientOverrides![recipeId] = clean;
  }
  if (!resetProgress) {
    for (const [id,qty] of Object.entries(result.qtys)) result.completed[id] = Math.min(qty,count(record(source.completed)[id]));
    const shopping = aggregateSandwichShopping(result.qtys,result.ingredientOverrides,familyId);
    for (const item of shopping) if (record(source.shopTicks)[item.key] === true) result.shopTicks[item.key] = true;
    for (const [key,checked] of Object.entries(record(source.shopTicks))) {
      if (checked === true && /^dough:[a-zA-Z0-9_-]{1,100}:\d+(?:\.\d+)?$/.test(key) && key.length<150) result.shopTicks[key] = true;
    }
    for (const id of Object.keys(result.qtys)) {
      const recipe = getSandwichRecipe(id)!;
      for (const step of recipe.steps) {
        const key = sandwichPrepKey(recipe,step.id,result.qtys[id],result.ingredientOverrides?.[id]);
        if (record(source.prepTicks)[key] === true) result.prepTicks[key] = true;
      }
    }
    if (['pick','shop','prep','serve'].includes(String(source.tab))) result.tab = source.tab as SandwichTab;
  }
  return result;
}
export function switchSandwichFamily(snapshot: SandwichSnapshot, familyId: SandwichFamily | null): SandwichSnapshot {
  return snapshot.familyId === familyId ? normalizeSandwichSnapshot(snapshot) : createSandwichSnapshot(familyId);
}
/** Edible filling weights per sandwich. Bread is separate and included by the kcal helper. */
export function effectiveIngredients(recipe: SandwichRecipe, overrides: Record<string,number> = {}): SandwichPortion[] {
  return recipe.ingredients.map(item => {
    const grams = own(overrides,item.ingredientId) ? overrides[item.ingredientId] : item.grams;
    return {...item,grams:typeof grams==='number' && Number.isFinite(grams) && grams>=0 && grams<=1000 ? Math.round(grams*10)/10 : item.grams};
  }).filter(item => item.grams > 0);
}
export function estimatedSandwichKcal(recipe: SandwichRecipe, overrides: Record<string,number> = {}): number {
  return Math.round(sandwichEnergy(recipe,overrides));
}
function sandwichEnergy(recipe: SandwichRecipe, overrides: Record<string,number> = {}): number {
  const family = SANDWICH_FAMILIES.find(f=>f.id===recipe.familyId);
  if (!family) throw new Error(`Unknown sandwich family: ${recipe.familyId}`);
  let kcal = recipe.breadGrams * family.breadKcalPer100g / 100;
  for (const item of effectiveIngredients(recipe,overrides)) {
    const ingredient = SANDWICH_INGREDIENTS[item.ingredientId];
    if (!ingredient || !Number.isFinite(ingredient.kcalPer100g)) throw new Error(`Missing sandwich nutrition: ${item.ingredientId}`);
    kcal += ingredient.kcalPer100g * item.grams / 100;
  }
  return kcal;
}
export function isLighterSandwich(recipe: SandwichRecipe, overrides: Record<string,number> = {}): boolean {
  const family=SANDWICH_FAMILIES.find(f=>f.id===recipe.familyId);
  return !!family && sandwichEnergy(recipe,overrides)<=family.comparisonKcal*.8;
}
export function effectiveSandwichSteps(recipe: SandwichRecipe, overrides: Record<string,number> = {}) {
  const ingredients=effectiveIngredients(recipe,overrides);
  return buildSandwichSteps(recipe.id,recipe.familyId,ingredients,ingredients.every(i=>SANDWICH_INGREDIENTS[i.ingredientId].vegetarian));
}
export interface SandwichShoppingItem { key:string; ingredientId:string; grams:number; name:{fr:string;en:string}; category:string; allergens:string[]; }
/** Fillings only: the bread is baked in the parent dough recipe. Tick keys include grams. */
export function aggregateSandwichShopping(qtys: Record<string,number>, overrides: Record<string,Record<string,number>> = {}, familyId?: SandwichFamily | null): SandwichShoppingItem[] {
  const totals = new Map<string,number>();
  for (const recipe of SANDWICH_RECIPES) {
    const qty = count(qtys[recipe.id]);
    if (!qty || (familyId !== undefined && recipe.familyId !== familyId)) continue;
    for (const item of effectiveIngredients(recipe,overrides[recipe.id])) totals.set(item.ingredientId,(totals.get(item.ingredientId)??0)+item.grams*qty);
  }
  return [...totals].map(([ingredientId,raw])=>{
    const grams = Math.round(raw*10)/10;
    const ingredient = SANDWICH_INGREDIENTS[ingredientId];
    if (!ingredient) throw new Error(`Missing sandwich ingredient: ${ingredientId}`);
    return {ingredientId,grams,key:`${ingredientId}:${grams}`,name:ingredient.name,category:ingredient.category,allergens:ingredient.allergens};
  }).sort((a,b)=>a.category.localeCompare(b.category)||a.ingredientId.localeCompare(b.ingredientId));
}
export function sandwichPrepKey(recipe: SandwichRecipe, stepId: string, quantity: number, overrides?: Record<string,number>): string {
  return `${recipe.id}:${stepId}:${count(quantity)}:${effectiveIngredients(recipe,overrides).map(i=>`${i.ingredientId}=${i.grams}`).join(',')}`;
}
export function sandwichQueue(qtys: Record<string,number>, completed: Record<string,number> = {}, familyId?: SandwichFamily | null) {
  return SANDWICH_RECIPES.filter(r=>count(qtys[r.id])>0 && (familyId===undefined||r.familyId===familyId)).map(recipe=>({recipe,recipeId:recipe.id,quantity:count(qtys[recipe.id]),completed:Math.min(count(qtys[recipe.id]),count(completed[recipe.id])),remaining:Math.max(0,count(qtys[recipe.id])-count(completed[recipe.id]))}));
}
/** Invalidates fulfilled portions and all changed-quantity shopping/preparation checks. */
export function updateSandwichRecipe(snapshot: SandwichSnapshot, recipeId: string, quantity: number, overrides?: Record<string,number>): SandwichSnapshot {
  const recipe = getSandwichRecipe(recipeId);
  if (!recipe || recipe.familyId !== snapshot.familyId) return normalizeSandwichSnapshot(snapshot);
  const next: SandwichSnapshot = {...snapshot,qtys:{...snapshot.qtys,[recipeId]:count(quantity)},completed:{...snapshot.completed,[recipeId]:0},ingredientOverrides:{...snapshot.ingredientOverrides,...(overrides?{[recipeId]:overrides}:{})}};
  return normalizeSandwichSnapshot(next);
}
