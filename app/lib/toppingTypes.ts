// Types only — no data.
// RULE: Every user-facing string uses Locale { en: string; fr: string }
// Components always render value[locale] — never value.en directly
// To add a filter: add to the union here → TypeScript flags every pizza missing it
// To rename: change here → compiler shows every affected location

export type Locale = { en: string; fr: string }

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all'

export type BaseType =
  | 'tomato_raw'
  | 'tomato_cooked'
  | 'tomato_concentrate'
  | 'bianca_cream'
  | 'bianca_oil'
  | 'bianca_ricotta'
  | 'pesto'
  | 'nduja'
  | 'truffle_cream'
  | 'bbq'
  | 'miso'
  | 'harissa'
  | 'zaatar'
  | 'vodka_cream'
  | 'other'

export type Category =
  | 'classic_italian'
  | 'meat'
  | 'seafood'
  | 'veg'
  | 'white'
  | 'modern'
  | 'fusion'
  | 'gourmet'
  | 'french_regional'
  | 'dessert'

export type RegionTag =
  | 'neapolitan' | 'roman'    | 'sicilian'
  | 'ligurian'   | 'venetian' | 'calabrian'
  | 'alsace'     | 'bretagne' | 'savoie'
  | 'provence'   | 'basque'   | 'lyonnais'
  | 'nord'       | 'normandie'
  | 'american'   | 'asian'    | 'fusion'
  | 'spanish'    | 'middle_eastern' | 'north_african'
  | 'japanese'   | 'northern_italian'

export type OccasionTag =
  | 'classic' | 'spicy' | 'kids'
  | 'party'   | 'impress' | 'quick'

export type DietaryTag =
  | 'veg' | 'vegan' | 'pescatarian'
  | 'dairy_free' | 'gluten_aware'
  | 'halal' | 'kosher'
  | 'no_pork' | 'no_nuts' | 'no_fish'

export type BudgetTier     = 1 | 2 | 3
export type ComplexityTier = 1 | 2 | 3
export type OvenTempTag    = 'high' | 'mid' | 'low'

export type StyleKey =
  | 'neapolitan' | 'sourdough' | 'pizza_romana'
  | 'roman'      | 'newyork'   | 'pan'

export type ShoppingContext =
  | 'singapore' | 'france' | 'uk'
  | 'us' | 'australia' | 'international'

// Wine: category only — all wines in same category produce identical filter results
export type WineCategory =
  | 'lr'   // light red:   Pinot Noir, Gamay, Beaujolais
  | 'fr'   // full red:    Barolo, Cabernet, Syrah, Malbec
  | 'cw'   // crisp white: Sauvignon Blanc, Pinot Grigio, Chablis
  | 'rw'   // rich white:  Chardonnay, Viognier, White Burgundy
  | 'sp'   // sparkling:   Champagne, Prosecco, Crémant
  | 'ro'   // rosé:        Provence, Tavel, Bandol

export type IngredientCategory =
  | 'sauce' | 'cheese' | 'meat' | 'seafood'
  | 'veg'   | 'finish' | 'base' | 'spice'

export type BakeOrder = 'before' | 'after'
// before = goes on before baking
// after  = added after baking — shown separately in Party Time tab

export type IngredientUnit =
  | 'g'      // grams
  | 'ml'     // millilitres
  | 'pcs'    // whole pieces (burrata, eggs, figs)
  | 'slices' // charcuterie slices
  | 'leaves' // herb leaves (basil)
  | 'sprigs' // herb sprigs (thyme, rosemary)
  | 'tbsp'   // tablespoons (capers, honey, oil)
  | 'pinch'  // pinch (oregano, pepper, salt)

export type IngredientQty = {
  amount: number
  unit: IngredientUnit
  noteEN?: string
  noteFR?: string
}

export type IngredientSubstitution = {
  name: Locale
  note?: Locale
  availableIn?: ShoppingContext[]
  brandExamples?: Partial<Record<ShoppingContext, string[]>>
}

export type Ingredient = {
  id: string
  name: Locale
  category: IngredientCategory
  bakeOrder: BakeOrder
  prepNote?: Locale
  goodEnough?: IngredientSubstitution   // close alternative — "Also great:"
  compromise?: IngredientSubstitution   // works but noticeably different — "If not available:"
  localSwap?: Partial<Record<ShoppingContext, IngredientSubstitution>>
  confusingNote?: Locale    // triggers ⓘ badge in UI
  isCommonPantry?: boolean  // pre-ticked in shopping list
  qtyPerPizza?: IngredientQty  // quantity for one 30cm pizza
  hardToFind?: boolean         // true = show substitution proactively in shopping list
}

export type Pizza = {
  // Core identity
  id: string
  name: Locale
  story?: Locale
  // Classification
  category: Category
  region?: RegionTag
  base: BaseType
  season: Season[]          // ['all'] = year-round
  // Filters
  occasion: OccasionTag[]
  dietary: DietaryTag[]
  budget: BudgetTier
  complexity: ComplexityTier
  prepMinutes: number
  ovenTemp: OvenTempTag
  wine: WineCategory[]      // empty = no specific pairing
  // Ingredients — bakeOrder on each drives before/after split in Party Time tab
  ingredients: Ingredient[]
  // Flavour profile — powers sliders (numeric, no translation needed)
  flavour: {
    richness: 1 | 2 | 3 | 4 | 5   // 1=light    5=rich
    boldness: 1 | 2 | 3 | 4 | 5   // 1=delicate 5=bold
    creative: 1 | 2 | 3 | 4 | 5   // 1=classic  5=creative
    refined:  1 | 2 | 3 | 4 | 5   // 1=comfort  5=refined
  }
  // Style compatibility — drives filtering in Pizza Party when baker selects a style
  // If omitted, pizza shows for ALL styles
  compatibleStyles?: StyleKey[]
  // V3 fields — optional, not rendered in V2 UI
  wineNote?: Locale
  photoUrl?: string
  bakerPhotoUrl?: string
  shareableId?: string
}

export type PizzaSlot = {
  pizzaId: string | null
  quantity: number
  customizations?: {
    swaps?: Record<string, string>
    notes?: string
  }
}

export type PizzaPartySession = {
  slots: PizzaSlot[]
  shoppingContext: ShoppingContext
  locationConfirmed: boolean
}

export type FilterState = {
  base: BaseType | null
  region: RegionTag | null
  occasion: OccasionTag[]
  dietary: DietaryTag[]
  season: Season              // 'all' = no season filter
  wine: WineCategory[]        // empty = no wine filter
  budget: BudgetTier | null
  complexity: ComplexityTier | null
  flavour: {
    richness: [number, number] | null
    boldness: [number, number] | null
    creative: [number, number] | null
    refined:  [number, number] | null
  }
  ingredientSearch: string    // free text — matches pizza name + all ingredient names
  ingredientChips: string[]   // selected quick-chips — OR logic
  styleKey?: StyleKey
}

// ─── Label maps — bilingual ───────────────────────────────────

export const BASE_LABELS: Record<BaseType, Locale> = {
  tomato_raw:         { en: 'Tomato (raw)',    fr: 'Tomate crue' },
  tomato_cooked:      { en: 'Tomato (cooked)', fr: 'Tomate cuite' },
  tomato_concentrate: { en: 'Concentrate',     fr: 'Concentré' },
  bianca_cream:       { en: 'Cream',           fr: 'Crème' },
  bianca_oil:         { en: 'Olive oil',       fr: 'Huile d\'olive' },
  bianca_ricotta:     { en: 'Ricotta',         fr: 'Ricotta' },
  pesto:              { en: 'Pesto',           fr: 'Pesto' },
  nduja:              { en: 'Nduja',           fr: 'Nduja' },
  truffle_cream:      { en: 'Truffle',         fr: 'Truffe' },
  bbq:                { en: 'BBQ',             fr: 'BBQ' },
  miso:               { en: 'Miso',            fr: 'Miso' },
  harissa:            { en: 'Harissa',         fr: 'Harissa' },
  zaatar:             { en: "Za'atar",         fr: "Za'atar" },
  vodka_cream:        { en: 'Vodka cream',     fr: 'Crème vodka' },
  other:              { en: 'Other',           fr: 'Autre' },
}

export const OCCASION_LABELS: Record<OccasionTag, Locale> = {
  classic: { en: 'Classic',  fr: 'Classique' },
  spicy:   { en: 'Spicy',    fr: 'Épicé' },
  kids:    { en: 'Kids',     fr: 'Enfants' },
  party:   { en: 'Party',    fr: 'Fête' },
  impress: { en: 'Impress',  fr: 'Impressionner' },
  quick:   { en: 'Quick',    fr: 'Rapide' },
}

export const SEASON_LABELS: Record<Season, Locale> = {
  all:    { en: 'All year',  fr: 'Toute l\'année' },
  spring: { en: 'Spring',    fr: 'Printemps' },
  summer: { en: 'Summer',    fr: 'Été' },
  autumn: { en: 'Autumn',    fr: 'Automne' },
  winter: { en: 'Winter',    fr: 'Hiver' },
}

// Wine: selectable category pill (left) + read-only examples (right, informational only)
export const WINE_CATEGORY_LABELS: Record<WineCategory, Locale> = {
  lr: { en: 'Light red',   fr: 'Rouge léger' },
  fr: { en: 'Full red',    fr: 'Rouge puissant' },
  cw: { en: 'Crisp white', fr: 'Blanc frais' },
  rw: { en: 'Rich white',  fr: 'Blanc riche' },
  sp: { en: 'Sparkling',   fr: 'Pétillant' },
  ro: { en: 'Rosé',        fr: 'Rosé' },
}

// Read-only examples shown next to each category pill
// Helps baker recognise which category their bottle belongs to
export const WINE_EXAMPLES: Record<WineCategory, Locale> = {
  lr: { en: 'Pinot Noir · Gamay · Beaujolais · Bardolino',     fr: 'Pinot Noir · Gamay · Beaujolais · Bardolino' },
  fr: { en: 'Barolo · Cabernet · Syrah · Malbec · Primitivo',  fr: 'Barolo · Cabernet · Syrah · Malbec · Primitivo' },
  cw: { en: 'Sauvignon Blanc · Pinot Grigio · Chablis · Gavi', fr: 'Sauvignon Blanc · Pinot Gris · Chablis · Gavi' },
  rw: { en: 'Chardonnay · Viognier · White Burgundy · Soave',  fr: 'Chardonnay · Viognier · Bourgogne blanc · Soave' },
  sp: { en: 'Champagne · Prosecco · Crémant · Franciacorta',   fr: 'Champagne · Prosecco · Crémant · Franciacorta' },
  ro: { en: 'Provence · Tavel · Bandol · Côtes de Provence',   fr: 'Provence · Tavel · Bandol · Côtes de Provence' },
}

export const BUDGET_LABELS: Record<BudgetTier, Locale> = {
  1: { en: '€ Everyday',           fr: '€ Quotidien' },
  2: { en: '€€ Weekend',           fr: '€€ Week-end' },
  3: { en: '€€€ Special occasion', fr: '€€€ Grande occasion' },
}

export const COMPLEXITY_LABELS: Record<ComplexityTier, Locale> = {
  1: { en: 'No cook',    fr: 'Sans cuisson' },
  2: { en: 'Light prep', fr: 'Légère préparation' },
  3: { en: 'Cooked',     fr: 'Cuisiné' },
}

export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, Locale> = {
  sauce:   { en: 'Sauce',   fr: 'Sauce' },
  cheese:  { en: 'Cheese',  fr: 'Fromage' },
  meat:    { en: 'Meat',    fr: 'Viande' },
  seafood: { en: 'Seafood', fr: 'Poisson' },
  veg:     { en: 'Veg',     fr: 'Légume' },
  finish:  { en: 'Finish',  fr: 'Finition' },
  base:    { en: 'Base',    fr: 'Base' },
  spice:   { en: 'Spice',   fr: 'Épice' },
}

export const CATEGORY_LABELS: Record<Category, Locale> = {
  classic_italian: { en: 'Classic Italian',  fr: 'Classique italien' },
  meat:            { en: 'Meat',             fr: 'Viande' },
  seafood:         { en: 'Seafood',          fr: 'Poisson & fruits de mer' },
  veg:             { en: 'Vegetable',        fr: 'Légumes' },
  white:           { en: 'White',            fr: 'Blanche' },
  modern:          { en: 'Modern',           fr: 'Moderne' },
  fusion:          { en: 'Fusion',           fr: 'Fusion' },
  gourmet:         { en: 'Gourmet',          fr: 'Gastronomique' },
  french_regional: { en: 'French Regional',  fr: 'Régionale française' },
  dessert:         { en: 'Dessert',          fr: 'Dessert' },
}

export const REGION_LABELS: Record<RegionTag, Locale> = {
  neapolitan: { en: 'Naples',   fr: 'Naples' },
  roman:      { en: 'Rome',     fr: 'Rome' },
  sicilian:   { en: 'Sicily',   fr: 'Sicile' },
  ligurian:   { en: 'Liguria',  fr: 'Ligurie' },
  venetian:   { en: 'Venice',   fr: 'Venise' },
  calabrian:  { en: 'Calabria', fr: 'Calabre' },
  alsace:     { en: 'Alsace',   fr: 'Alsace' },
  bretagne:   { en: 'Brittany', fr: 'Bretagne' },
  savoie:     { en: 'Savoie',   fr: 'Savoie' },
  provence:   { en: 'Provence', fr: 'Provence' },
  basque:     { en: 'Basque',   fr: 'Pays Basque' },
  lyonnais:   { en: 'Lyon',     fr: 'Lyonnais' },
  nord:       { en: 'Nord',     fr: 'Nord' },
  normandie:  { en: 'Normandy', fr: 'Normandie' },
  american:         { en: 'American',        fr: 'Américaine' },
  asian:            { en: 'Asian',           fr: 'Asiatique' },
  fusion:           { en: 'Fusion',          fr: 'Fusion' },
  spanish:          { en: 'Spanish',         fr: 'Espagnole' },
  middle_eastern:   { en: 'Middle Eastern',  fr: 'Moyen-Orient' },
  north_african:    { en: 'North African',   fr: 'Afrique du Nord' },
  japanese:         { en: 'Japanese',        fr: 'Japonaise' },
  northern_italian: { en: 'Northern Italy',  fr: 'Italie du Nord' },
}

// ─── Helpers ─────────────────────────────────────────────────

export function getCurrentSeason(): Season {
  const m = new Date().getMonth() + 1
  if (m >= 3 && m <= 5)  return 'spring'
  if (m >= 6 && m <= 8)  return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function filterPizzas(pizzas: Pizza[], f: FilterState): Pizza[] {
  return pizzas.filter(p => {
    if (f.styleKey && p.compatibleStyles && p.compatibleStyles.length > 0 &&
        !p.compatibleStyles.includes(f.styleKey)) return false
    if (f.base && p.base !== f.base) return false
    if (f.region && p.region !== f.region) return false
    if (f.occasion.length && !f.occasion.some(o => p.occasion.includes(o))) return false
    if (f.dietary.length && !f.dietary.every(d => p.dietary.includes(d))) return false
    if (f.season !== 'all' && !p.season.includes('all') && !p.season.includes(f.season)) return false
    if (f.wine.length && !f.wine.some(w => p.wine.includes(w))) return false
    if (f.budget && p.budget !== f.budget) return false
    if (f.complexity && p.complexity !== f.complexity) return false
    if (f.ingredientSearch.trim()) {
      const q = f.ingredientSearch.toLowerCase()
      const match =
        p.name.en.toLowerCase().includes(q) ||
        p.name.fr.toLowerCase().includes(q) ||
        p.ingredients.some(i =>
          i.name.en.toLowerCase().includes(q) ||
          i.name.fr.toLowerCase().includes(q)
        )
      if (!match) return false
    }
    if (f.ingredientChips && f.ingredientChips.length > 0) {
      const allText = [
        p.name.en, p.name.fr ?? '',
        ...(p.ingredients ?? []).flatMap((ing: { name?: { en?: string; fr?: string } }) =>
          [ing.name?.en ?? '', ing.name?.fr ?? '']
        ),
      ].join(' ').toLowerCase();
      const matches = f.ingredientChips.some(chip =>
        allText.includes(chip.toLowerCase())
      );
      if (!matches) return false;
    }
    if (f.flavour.richness && (p.flavour.richness < f.flavour.richness[0] || p.flavour.richness > f.flavour.richness[1])) return false
    if (f.flavour.boldness && (p.flavour.boldness < f.flavour.boldness[0] || p.flavour.boldness > f.flavour.boldness[1])) return false
    if (f.flavour.creative && (p.flavour.creative < f.flavour.creative[0] || p.flavour.creative > f.flavour.creative[1])) return false
    if (f.flavour.refined  && (p.flavour.refined  < f.flavour.refined[0]  || p.flavour.refined  > f.flavour.refined[1]))  return false
    return true
  })
}

export function getFilterCounts(pizzas: Pizza[]): Record<string, number> {
  const counts: Record<string, number> = {}
  pizzas.forEach(p => {
    counts[`base_${p.base}`] = (counts[`base_${p.base}`] ?? 0) + 1
    p.occasion.forEach(o => { counts[`occ_${o}`] = (counts[`occ_${o}`] ?? 0) + 1 })
    p.wine.forEach(w => { counts[`wine_${w}`] = (counts[`wine_${w}`] ?? 0) + 1 })
  })
  return counts
}

export const DEFAULT_FILTER: FilterState = {
  base: null,
  region: null,
  occasion: [],
  dietary: [],
  season: 'all',
  wine: [],
  budget: null,
  complexity: null,
  flavour: { richness: null, boldness: null, creative: null, refined: null },
  ingredientSearch: '',
  ingredientChips: [],
}
