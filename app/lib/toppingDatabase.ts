// Data only — types imported from toppingTypes.ts
// RULE: ALL user-facing strings use Locale { en: string; fr: string }
// Even identical names (Burrata, Nduja) must have both en and fr fields
// bakeOrder: 'before' = goes on before baking | 'after' = added after baking

import type { Pizza, Ingredient } from './toppingTypes'

export type { Pizza, Ingredient }
export type {
  Locale, Season, BaseType, Category, RegionTag, OccasionTag, DietaryTag,
  BudgetTier, ComplexityTier, OvenTempTag, ShoppingContext, WineCategory,
  IngredientCategory, BakeOrder, IngredientSubstitution,
  PizzaSlot, PizzaPartySession, FilterState, StyleKey,
} from './toppingTypes'
export {
  BASE_LABELS, OCCASION_LABELS, SEASON_LABELS,
  WINE_CATEGORY_LABELS, WINE_EXAMPLES,
  BUDGET_LABELS, COMPLEXITY_LABELS,
  CATEGORY_LABELS, REGION_LABELS,
  INGREDIENT_CATEGORY_LABELS,
  getCurrentSeason, filterPizzas, getFilterCounts, DEFAULT_FILTER,
} from './toppingTypes'
export type { IngredientUnit, IngredientQty } from './toppingTypes'

// ─── Shared ingredients ──────────────────────────────────────

export const ING: Record<string, Ingredient> = {

  sanMarzano: {
    id: 'san_marzano', category: 'sauce', bakeOrder: 'before',
    name: { en: 'San Marzano DOP tomatoes', fr: 'Tomates San Marzano DOP' },
    prepNote: { en: 'Hand-crush, salt only — never cook before baking', fr: 'Écraser à la main, saler uniquement — ne jamais cuire avant enfournement' },
    prepNoteByStyle: {
      newyork:    { en: 'For NY style: cook the sauce 15–20 min with garlic and olive oil — raw tomato releases too much water on the longer NY bake.', fr: 'Pour le style NY : cuire la sauce 15–20 min avec ail et huile d\'olive — la tomate crue rend trop d\'eau sur la cuisson plus longue.', timing: 20 },
      pan:        { en: 'For pan/Detroit: cook sauce 20 min to a thick concentrate — it goes on top of the cheese and needs to hold its shape.', fr: 'Pour le style pan/Detroit : cuire la sauce 20 min en concentré épais — elle va sur le fromage et doit tenir.', timing: 20 },
      roman:      { en: 'For Pizza Romana: a light cook (10 min) works well — the thin crispy base can\'t handle excess moisture.', fr: 'Pour la Pizza Romana : une cuisson légère (10 min) est idéale — la base fine et croustillante ne supporte pas l\'excès d\'humidité.', timing: 10 },
    },
    qtyPerPizza: { amount: 80, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
    bakeOrderByStyle: { pan: 'after' },
    hardToFind: true,
    goodEnough: {
      name: { en: 'Mutti Polpa crushed tomatoes', fr: 'Tomates concassées Mutti' },
      note: { en: 'Excellent — used by most Italian restaurants', fr: 'Excellent — utilisé par la plupart des restaurants italiens' },
    },
    compromise: {
      name: { en: 'Any quality canned plum tomato', fr: "N'importe quelle tomate pelée de qualité" },
    },
    localSwap: {
      singapore: {
        name: { en: 'Mutti Polpa or Annalisa whole peeled', fr: 'Mutti Polpa ou Annalisa tomates entières' },
        brandExamples: { singapore: ['Mutti Polpa — Cold Storage', 'Annalisa whole peeled — Marketplace'] },
      },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant'], online: ['RedMart'], note: "Mutti Polpa easiest; Annalisa whole peeled at Marketplace" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais'], note: 'San Marzano DOP in most large supermarkets — canned tomato aisle' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Italian specialty stores'], online: ['Amazon', 'Eataly online'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado'], online: ['Ocado'], note: 'Look for DOP label — Mutti or Cirio brand' },
      australia: { shops: ['Harris Farm', 'Coles', 'IGA'], online: ['Amazon AU'], note: 'Mutti Polpa widely available' },
    },
  },

  marinaraSauce: {
    id: 'marinara_sauce', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Cooked marinara sauce', fr: 'Sauce marinara cuite' },
    prepNote: { en: 'Simmer 20 min: olive oil, garlic (remove), San Marzano, basil, salt', fr: 'Mijoter 20 min : huile, ail (retirer), San Marzano, basilic, sel', timing: 30 },
    prepNoteByStyle: {
      neapolitan: { en: 'For Neapolitan: use raw hand-crushed San Marzano instead — cooked sauce scorches at 450°C. Season with salt only.', fr: 'Pour le napolitain : utiliser des San Marzano écrasées à la main crues — la sauce cuite brûle à 450°C. Assaisonner avec du sel uniquement.', timing: 0 },
      sourdough:  { en: 'For sourdough: same as Neapolitan — use raw crushed tomatoes, do not cook.', fr: 'Pour le levain : même approche que le napolitain — tomates crues écrasées, ne pas cuire.', timing: 0 },
    },
    qtyPerPizza: { amount: 80, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
    bakeOrderByStyle: { pan: 'after' },
    goodEnough: {
      name: { en: 'Good quality passata (strained tomatoes)', fr: 'Passata de bonne qualité (tomates tamisées)' },
      note: { en: 'Reduce in a pan 10 min with olive oil, garlic, salt and a pinch of sugar. Or use straight from the bottle if good quality.', fr: "Réduire à la casserole 10 min avec huile d'olive, ail, sel et une pincée de sucre. Ou utiliser directement si bonne qualité." },
    },
    compromise: {
      name: { en: 'Good quality canned crushed tomatoes', fr: 'Tomates concassées de bonne qualité en conserve' },
      note: { en: 'Drain excess liquid first. Crush by hand, season with salt and olive oil. Works well for Neapolitan style raw.', fr: "Égoutter l'excès de liquide d'abord. Écraser à la main, assaisonner avec sel et huile d'olive. Fonctionne bien cru pour le style napolitain." },
    },
  },

  olioBase: {
    id: 'olio_base', category: 'base', bakeOrder: 'before',
    name: { en: 'Olive oil base', fr: 'Base huile d\'olive' },
    isCommonPantry: true,
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
  },

  fiordilatte: {
    id: 'fior_di_latte', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Fior di latte', fr: 'Fior di latte' },
    prepNote: { en: 'Slice 5mm, drain on paper towel 30 min before baking', fr: 'Trancher à 5mm, égoutter sur papier 30 min avant cuisson', timing: 30 },
    prepNoteByStyle: {
      newyork: { en: 'For NY style, low-moisture mozzarella is preferred. If using fresh fior di latte: dice small and drain very well — excess moisture makes NY crust soggy.', fr: 'Pour le style NY, la mozzarella faible humidité est préférable. Si vous utilisez de la fior di latte fraîche : couper en petits dés et bien égoutter.', timing: 10 },
      pan:     { en: 'Dice small for pan style — needs to melt into the thick base. Low-moisture preferred. Press to edges for frico crust.', fr: 'Couper en petits dés pour le style pan — doit fondre dans la base épaisse. Faible humidité préférable. Pousser jusqu\'aux bords pour la croûte frico.', timing: 5 },
    },
    qtyPerPizza: { amount: 100, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.5 },
    hardToFind: true,
    goodEnough: { name: { en: 'Fresh mozzarella ball (any brand)', fr: 'Boule de mozzarella fraîche (toute marque)' }, note: { en: 'Slice 5mm and drain on paper towel. The difference from fior di latte is minimal for most home ovens.', fr: 'Trancher à 5mm et égoutter sur papier. La différence avec la fior di latte est minime pour la plupart des fours domestiques.' } },
    compromise: { name: { en: 'Low-moisture mozzarella block', fr: 'Mozzarella en bloc faible humidité' }, note: { en: 'No draining needed but loses the fresh milky character. Melts more evenly.', fr: 'Pas besoin d\'égoutter mais perd le caractère lacté frais. Fonte plus uniforme.' } },
    localSwap: {
      singapore: {
        name: { en: 'Fresh mozzarella — FairPrice Finest or Cold Storage', fr: 'Mozzarella fraîche — FairPrice Finest ou Cold Storage' },
        brandExamples: { singapore: ['FairPrice Finest fresh mozz', 'Bel Paese — Cold Storage'] },
      },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', "Huber's Butchery", 'Marketplace'], note: "Any fresh mozzarella ball — 'fior di latte' label rare, fresh mozzarella works identically" },
      france:    { shops: ['Grand Frais', 'Italian delis', 'Monoprix'], note: "Boule de mozzarella fraîche — look for 'au lait de vache' on label" },
      uk:        { shops: ['Waitrose', 'M&S', 'Lina Stores', 'Italian delis'] },
      australia: { shops: ['Coles', 'Woolworths Macro', 'Italian delis'], note: 'Fresh mozzarella balls — look for fridge section near deli counter' },
    },
  },

  burrata: {
    id: 'burrata', category: 'cheese', bakeOrder: 'after',
    name: { en: 'Burrata', fr: 'Burrata' },
    prepNote: { en: 'Add whole after baking — break open at the table', fr: 'Ajouter entière après cuisson — ouvrir à table' },
    prepNoteByStyle: {
      pan:   { en: 'Break into 3–4 large pieces before adding — a whole burrata gets lost on the thick pan base.', fr: 'Couper en 3–4 grands morceaux avant d\'ajouter — une burrata entière se perd sur la base épaisse.', timing: 0 },
      roman: { en: 'Break into pieces before adding — add after baking.', fr: 'Couper en morceaux avant d\'ajouter — après cuisson.', timing: 0 },
    },
    qtyPerPizza: { amount: 1, unit: 'pcs' },
    qtyMultiplierByStyle: { roman: 1.1 },
    hardToFind: true,
    goodEnough: { name: { en: 'Fresh mozzarella + a drizzle of cream', fr: 'Mozzarella fraîche + filet de crème' } },
    compromise: {
      name: { en: 'Fresh mozzarella only — no cream centre', fr: 'Mozzarella fraîche seule — sans cœur crémeux' },
    },
    localSwap: {
      singapore: {
        name: { en: 'Burrata — Marketplace, Ryan\'s Grocery, Culina', fr: 'Burrata — Marketplace, Ryan\'s Grocery, Culina' },
      },
    },
    whereToFind: {
      singapore: { shops: ['Marketplace', "Ryan's Grocery", 'Culina', "Huber's Butchery"], note: "Call ahead — stock varies. Ryan's and Culina most reliable" },
      france:    { shops: ['Grand Frais', 'Italian delis', 'Monoprix', 'La Grande Épicerie'], note: 'Now widely available in most major French supermarkets' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Italian markets'], online: ['Eataly online', "Murray's Cheese"], note: 'Fresh burrata — refrigerated section near specialty cheeses' },
      uk:        { shops: ['Waitrose', 'M&S', 'Lina Stores', 'Ocado'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'Italian delis', 'Woolworths Metro'], note: 'Availability growing — Harris Farm most reliable' },
    },
  },

  cream35: {
    id: 'cream_35', category: 'base', bakeOrder: 'before',
    name: { en: 'Whipping cream 35%+ fat', fr: 'Crème liquide entière 35%+ MG' },
    confusingNote: {
      en: 'Must be 35%+ fat — "cooking cream" is usually 15% and splits in the oven. Look for "whipping" or "fleurette".',
      fr: 'Doit être 35%+ MG — la "crème cuisine" est souvent 15% et tranche au four. Cherchez "entière" ou "fleurette".',
    },
    goodEnough: { name: { en: 'Crème fraîche — best choice, stable at high heat', fr: 'Crème fraîche — meilleur choix, stable à haute température' } },
    qtyPerPizza: { amount: 80, unit: 'ml' },
    hardToFind: true,
    localSwap: {
      singapore: {
        name: { en: 'President Whipping (35%) or Meiji Hokkaido (40%)', fr: 'President Whipping (35%) ou Meiji Hokkaido (40%)' },
        note: { en: 'Avoid Elle & Vire Cooking Cream (15%) and Greenfields Fresh Cream (25%)', fr: 'Éviter Elle & Vire Cuisine (15%) et Greenfields (25%)' },
        brandExamples: { singapore: ['President Whipping (35%) — Cold Storage', 'Meiji Hokkaido (40%) — FairPrice Finest', 'Bulla Thickened (35%) — Marketplace'] },
      },
      france: {
        name: { en: 'Crème fleurette or crème fraîche épaisse', fr: 'Crème fleurette ou crème fraîche épaisse' },
        brandExamples: { france: ['Président crème fleurette', 'Elle & Vire fleurette 30%'] },
      },
    },
  },

  cremeFraiche: {
    id: 'creme_fraiche', category: 'base', bakeOrder: 'before',
    name: { en: 'Crème fraîche', fr: 'Crème fraîche' },
    prepNote: { en: 'Spread thinly — stable at high heat, slightly tangy', fr: 'Étaler finement — stable à haute chaleur, légèrement acidulée' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'per pizza', noteFR: 'par pizza' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
    localSwap: {
      singapore: {
        name: { en: 'President Crème Fraîche (Marketplace) or President Whipping Cream', fr: 'Crème fraîche Président (Marketplace) ou President Whipping' },
        brandExamples: { singapore: ['President Crème Fraîche — Marketplace', 'Ryan\'s Grocery'] },
      },
    },
    goodEnough: {
      name: { en: 'Sour cream (full fat)', fr: 'Crème aigre entière' },
      note: { en: 'Very close — same tang, slightly thinner. Full fat only, light versions split in the oven.', fr: 'Très proche — même acidité, légèrement plus liquide. Entière uniquement, les versions allégées se séparent au four.' },
    },
    compromise: {
      name: { en: 'Greek yogurt (full fat, strained)', fr: 'Yaourt grec entier (égoutté)' },
      note: { en: 'Spread thicker and strain overnight if possible. Tangier and less rich but works in a pinch.', fr: "Étaler plus épais et égoutter si possible. Plus acide et moins riche mais dépanne bien." },
    },
  },

  fromageBlancBase: {
    id: 'fromage_blanc', category: 'base', bakeOrder: 'before',
    name: { en: 'Fromage blanc + crème fraîche (50/50)', fr: 'Fromage blanc + crème fraîche (50/50)' },
    prepNote: {
      en: 'Always mix 50% fromage blanc + 50% crème fraîche (30%+ MG). NEVER use fromage blanc alone — too low in fat (0–3%), splits and makes base watery in the oven.',
      fr: 'Toujours mélanger 50% fromage blanc + 50% crème fraîche (30%+ MG). Ne JAMAIS utiliser le fromage blanc seul — trop maigre (0–3% MG), tranche et détrempe la base au four.',
    },
    confusingNote: {
      en: 'Fromage blanc alone (0–3% fat) cannot be cooked — it splits. It must always be combined with crème fraîche (30%+ fat) in equal parts for pizza.',
      fr: 'Le fromage blanc seul (0–3% MG) ne se cuit pas — il tranche. Il doit toujours être mélangé en parts égales avec de la crème fraîche (30%+ MG).',
    },
    goodEnough: {
      name: { en: 'Crème fraîche only (30%+ MG) — richer, slightly tangier', fr: 'Crème fraîche seule (30%+ MG) — plus riche, légèrement plus acidulée' },
    },
    compromise: {
      name: { en: 'Greek yogurt (10%+ fat) mixed with crème fraîche 50/50 — mid/low oven only', fr: 'Yaourt grec (10%+ MG) mélangé avec crème fraîche 50/50 — four moyen uniquement' },
    },
    qtyPerPizza: { amount: 80, unit: 'g', noteEN: 'total of the 50/50 mix', noteFR: 'total du mélange 50/50' },
    localSwap: {
      singapore: {
        name: { en: "Fromage blanc — Marketplace or Ryan's. Mix with President Crème Fraîche (30%)", fr: "Fromage blanc — Marketplace ou Ryan's. Mélanger avec President Crème Fraîche (30%)" },
      },
    },
  },

  raclette: {
    id: 'raclette', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Raclette AOP', fr: 'Raclette AOP' },
    confusingNote: {
      en: 'Use proper Raclette AOP — melts smoothly. Swiss Raclette also works. Avoid pre-sliced industrial versions.',
      fr: 'Utiliser du Raclette AOP — fond parfaitement. Le Raclette suisse convient aussi. Éviter les versions tranchées industrielles.',
    },
    qtyPerPizza: { amount: 100, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Gruyère or Emmental — same alpine family, melts well', fr: 'Gruyère ou Emmental — même famille alpine, fond bien' } },
    compromise: { name: { en: 'Fontina or Comté — firm, melts well but different character', fr: 'Fontina ou Comté — ferme, fond bien mais caractère différent' } },
    localSwap: {
      singapore: {
        name: { en: 'Swiss Raclette — Cold Storage or Marketplace', fr: 'Raclette suisse — Cold Storage ou Marketplace' },
        brandExamples: { singapore: ['Swiss Raclette — Marketplace', 'Emmental — Cold Storage'] },
      },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], note: 'Swiss Raclette (not French AOP) usually in stock — Gruyère is an easy substitute' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Grand Frais', 'fromageries'], note: 'Raclette AOP and standard Raclette both widely available — essential alpine cheese in France' },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado'], online: ['Ocado'], note: 'Available in most major supermarkets with good cheese sections' },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'French delis'], note: "Less common — Gruyère is an easy substitute at any supermarket" },
    },
  },

  chevreFrais: {
    id: 'chevre_frais', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Chèvre frais (fresh goat cheese)', fr: 'Chèvre frais' },
    prepNote: { en: 'Crumble or slice — place after spreading olive oil base', fr: 'Émietter ou trancher — poser après l\'huile d\'olive' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'per pizza', noteFR: 'par pizza' },
    goodEnough: { name: { en: 'Any fresh mild goat cheese log', fr: 'N\'importe quelle bûchette de chèvre doux' } },
    localSwap: {
      singapore: { name: { en: 'Goat cheese — Marketplace, Ryan\'s Grocery or Cold Storage', fr: 'Fromage de chèvre — Marketplace, Ryan\'s ou Cold Storage' } },
    },
  },

  mozzarellaLM: {
    id: 'mozzarella_lm', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Low-moisture mozzarella', fr: 'Mozzarella faible humidité' },
    prepNote: { en: 'Grate or slice thin — melts evenly without excess water', fr: 'Râper ou trancher fin — fond sans excès d\'eau', timing: 5 },
    prepNoteByStyle: {
      neapolitan: { en: 'Dice or tear into small pieces — never grate for Neapolitan. Grating creates a dry uniform layer instead of the characteristic molten pools.', fr: 'Couper en dés ou déchirer — ne jamais râper pour le napolitain. Râpé, elle perd ses poches de fondu caractéristiques.', timing: 5 },
      sourdough:  { en: 'Dice or tear into small pieces — same approach as Neapolitan.', fr: 'Couper en dés ou déchirer — même approche que le napolitain.', timing: 5 },
      pizza_romana: { en: 'Slice thin or dice — do not grate for Pizza Romana.', fr: 'Trancher finement ou couper en dés — ne pas râper pour la Pizza Romana.', timing: 5 },
    },
    qtyPerPizza: { amount: 100, unit: 'g', noteEN: 'low-moisture block', noteFR: 'bloc faible humidité' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.5 },
    goodEnough: {
      name: { en: 'Block mozzarella (any brand)', fr: 'Mozzarella en bloc (toute marque)' },
      note: { en: 'Grate or slice thin. Drier than fresh — less pooling, more even melt. Works perfectly for NY and Pan styles.', fr: 'Râper ou trancher finement. Plus sèche que la fraîche — fonte uniforme. Parfait pour NY et Pan.' },
    },
    compromise: {
      name: { en: 'Mild cheddar or young gouda', fr: 'Cheddar doux ou jeune gouda' },
      note: { en: 'Melts well but flavour is noticeably different. Use only if nothing else available.', fr: 'Fond bien mais le goût est différent. À utiliser en dernier recours.' },
    },
    whereToFind: {
      singapore: { shops: ['NTUC FairPrice', 'Cold Storage', 'Giant'], online: ['RedMart'], note: "Kraft or Perfect Italiano brand — look for 'pizza mozzarella' block in cheese section" },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix'], note: 'Mozzarella râpée or mozzarella pour pizza — most supermarkets stock it' },
      us:        { shops: ['Any grocery store'], note: "Polly-O, Sargento, Kraft all work — look for 'low-moisture' or 'part-skim' block" },
      uk:        { shops: ['Any supermarket'], note: 'Galbani mozzarella for pizza — block form in cheese aisle' },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'], note: 'Perfect Italiano pizza mozzarella block — cheese aisle' },
    },
  },

  nduja: {
    id: 'nduja', category: 'meat', bakeOrder: 'before',
    name: { en: 'Nduja', fr: 'Nduja' },
    prepNote: { en: 'Spread directly on base before other toppings', fr: 'Étaler directement sur la base avant les autres garnitures' },
    prepNoteByStyle: {
      pan:   { en: 'Mix nduja with a little olive oil before spreading — lower oven temps (230°C) need help to melt it evenly.', fr: 'Mélanger la nduja avec un peu d\'huile d\'olive avant d\'étaler — les températures plus basses (230°C) nécessitent de l\'aide pour la faire fondre uniformément.', timing: 3 },
      roman: { en: 'Mix with a touch of olive oil before spreading — ensures even melt at lower temperatures.', fr: 'Mélanger avec un peu d\'huile d\'olive avant d\'étaler — pour une fonte uniforme à température plus basse.', timing: 3 },
    },
    qtyPerPizza: { amount: 40, unit: 'g', noteEN: 'spread generously', noteFR: 'étaler généreusement' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
    goodEnough: { name: { en: 'Chorizo paste or spicy sobrasada', fr: 'Pâte de chorizo ou sobrasada épicée' } },
    localSwap: {
      singapore: {
        name: { en: 'Nduja — found occasionally at Culina, Ryan\'s, Huber\'s', fr: 'Nduja — disponible parfois chez Culina, Ryan\'s, Huber\'s' },
        brandExamples: { singapore: ['Culina', 'Ryan\'s Grocery', 'Huber\'s Butchery'] },
      },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', "Huber's Butchery"], note: 'Call ahead — availability varies. Chorizo paste is an easy substitute' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'Monoprix (some locations)'], online: ['Amazon FR'], note: "'Nduja in jars now at some Monoprix — Italian delis most reliable" },
      us:        { shops: ['Whole Foods', 'Eataly', 'Italian delis'], online: ['Eataly online', 'Amazon'], note: 'Becoming more mainstream — Whole Foods usually carries it' },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's"], online: ['Ocado'], note: 'Now in most major UK supermarkets — great availability' },
      australia: { shops: ['Harris Farm', 'Italian delis', 'Simon Johnson'], note: 'Less common — Italian delis most reliable' },
    },
  },

  prosciutto: {
    id: 'prosciutto', category: 'meat', bakeOrder: 'after',
    name: { en: 'Prosciutto di Parma', fr: 'Prosciutto di Parma' },
    prepNote: { en: 'Add after baking — heat ruins the delicate texture', fr: 'Ajouter après cuisson — la chaleur détruit la texture délicate' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4–5 slices', noteFR: '4–5 tranches' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
    goodEnough: { name: { en: 'Good quality Parma ham', fr: 'Jambon de Parme de qualité' } },
    compromise: {
      name: { en: 'Good cooked ham — less delicate, milder', fr: 'Bon jambon cuit — moins délicat, plus doux' },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Culina'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'charcuteries'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'any grocery store'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm', 'IGA'] },
    },
  },

  smokedLardons: {
    id: 'smoked_lardons', category: 'meat', bakeOrder: 'before',
    name: { en: 'Smoked lardons', fr: 'Lardons fumés' },
    prepNote: { en: 'No need to pre-cook — render perfectly in the oven', fr: 'Pas besoin de précuire — fondent parfaitement au four' },
    prepNoteByStyle: {
      neapolitan: { en: 'Par-cook 1–2 min in a dry pan before adding — at 450°C the pizza bakes too fast for lardons to render on their own.', fr: 'Précuire 1–2 min à sec avant d\'ajouter — à 450°C la pizza cuit trop vite pour que les lardons fondent seuls.', timing: 5 },
      sourdough:  { en: 'Par-cook 1–2 min in a dry pan — sourdough Neapolitan bakes fast, lardons need a head start.', fr: 'Précuire 1–2 min à sec — le levain napolitain cuit vite, les lardons ont besoin d\'un coup de pouce.', timing: 5 },
    },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Diced smoked bacon', fr: 'Bacon fumé en dés' } },
    compromise: { name: { en: 'Unsmoked lardons — less flavour', fr: 'Lardons non fumés — moins de goût' } },
  },

  spicySalami: {
    id: 'spicy_salami', category: 'meat', bakeOrder: 'before',
    name: { en: 'Spicy Calabrian salami', fr: 'Salami calabrais épicé' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '8–10 slices', noteFR: '8–10 tranches' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.5 },
    goodEnough: { name: { en: 'Any spicy salami or pepperoni', fr: 'Tout salami épicé ou pepperoni' } },
    compromise: {
      name: { en: 'Regular salami + chilli flakes', fr: 'Salami ordinaire + flocons de piment' },
    },
  },

  pepperoni: {
    id: 'pepperoni', category: 'meat', bakeOrder: 'before',
    name: { en: 'Pepperoni', fr: 'Pepperoni' },
    prepNote: { en: 'Slice thin — cups and crisps beautifully in the oven', fr: 'Trancher finement — se gondole et croustille au four' },
    qtyPerPizza: { amount: 50, unit: 'g', noteEN: '12–15 slices', noteFR: '12–15 tranches' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.5 },
    goodEnough: {
      name: { en: 'Salami piccante or diavola salami', fr: 'Salami piccante ou salami diavola' },
      note: { en: "Won't cup as dramatically as US pepperoni but crisps well and has great spice. Slice thin.", fr: 'Ne formera pas autant de coupelles que le pepperoni américain mais croustille bien et est bien épicé. Trancher finement.' },
    },
    compromise: {
      name: { en: 'Any spicy cured salami', fr: 'Tout salami épicé séché' },
      note: { en: 'Chorizo, spicy sobrasada, or hot coppa all work. Slice thin.', fr: 'Chorizo, sobrasada piquante ou coppa forte conviennent. Trancher finement.' },
    },
  },

  grilledChicken: {
    id: 'grilled_chicken', category: 'meat', bakeOrder: 'before',
    name: { en: 'Grilled chicken', fr: 'Poulet grillé' },
    prepNote: { en: 'Slice thin, season well before adding', fr: 'Trancher finement, bien assaisonner avant d\'ajouter', timing: 30 },
    qtyPerPizza: { amount: 120, unit: 'g', noteEN: '1 breast per pizza', noteFR: '1 blanc par pizza' },
  },

  speck: {
    id: 'speck', category: 'meat', bakeOrder: 'before',
    name: { en: 'Speck Alto Adige', fr: 'Speck Alto Adige' },
    prepNote: { en: 'Lay flat, add last 2 min of baking or after', fr: 'Poser à plat, ajouter les 2 dernières min ou après' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4–5 slices', noteFR: '4–5 tranches' },
    hardToFind: true,
    goodEnough: { name: { en: 'Good quality smoked ham', fr: 'Jambon fumé de qualité' } },
    compromise: {
      name: { en: 'Prosciutto — less smoky but same delicacy', fr: 'Prosciutto — moins fumé mais même délicatesse' },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Marketplace', 'Culina'], note: 'Less common than prosciutto — smoked ham works well as substitute' },
      france:    { shops: ['Grand Frais', 'Italian delis', 'La Grande Épicerie'], note: 'Available at Italian delis and Grand Frais — less common in standard supermarkets' },
      us:        { shops: ['Eataly', 'Whole Foods (some)', 'Italian delis'], online: ['Amazon', 'Eataly online'] },
      uk:        { shops: ['Waitrose', 'Natoora', 'Lina Stores'], online: ['Ocado'] },
    },
  },

  ham: {
    id: 'cooked_ham', category: 'meat', bakeOrder: 'before',
    name: { en: 'Cooked ham', fr: 'Jambon cuit' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: {
      name: { en: 'Cooked ham (jambon cuit, any quality)', fr: 'Jambon cuit (toute qualité)' },
      note: { en: 'Any cooked ham works — Paris ham, honey ham, rosemary ham. Avoid overly watery supermarket ham.', fr: 'Tout jambon cuit convient — jambon de Paris, jambon au miel, au romarin. Éviter les jambons industriels trop aqueux.' },
    },
    compromise: {
      name: { en: 'Turkey breast (sliced)', fr: 'Blanc de dinde (en tranches)' },
      note: { en: 'Milder and leaner. Works but pizza will be less rich.', fr: 'Plus doux et moins gras. Fonctionne mais la pizza sera moins riche.' },
    },
  },

  smSalmon: {
    id: 'smoked_salmon', category: 'seafood', bakeOrder: 'after',
    name: { en: 'Smoked salmon', fr: 'Saumon fumé' },
    prepNote: { en: 'Always add after baking — never cook smoked salmon', fr: 'Toujours ajouter après cuisson — ne jamais cuire le saumon fumé' },
    qtyPerPizza: { amount: 60, unit: 'g' },
    goodEnough: {
      name: { en: 'Hot-smoked salmon (flaked)', fr: 'Saumon fumé à chaud (émietté)' },
      note: { en: 'Different texture — flakier, meatier. Add after baking like cold-smoked.', fr: 'Texture différente — plus feuilletée, plus charnue. Ajouter après cuisson comme le saumon fumé à froid.' },
    },
    compromise: {
      name: { en: 'Smoked trout', fr: 'Truite fumée' },
      note: { en: 'Milder smoke, slightly earthier. Works well with cream cheese and dill. Add after baking.', fr: 'Fumée plus douce, légèrement plus terreux. Fonctionne bien avec fromage frais et aneth. Ajouter après cuisson.' },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Giant'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'fishmongers'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Costco', 'any grocery store'] },
      uk:        { shops: ['Any supermarket'], note: 'Smoked salmon is a British staple — excellent quality widely available' },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm'] },
    },
  },

  anchovies: {
    id: 'anchovies', category: 'seafood', bakeOrder: 'before',
    name: { en: 'Anchovy fillets in oil', fr: 'Filets d\'anchois à l\'huile' },
    prepNote: { en: 'No extra salt needed — anchovies season the entire pizza', fr: 'Pas besoin de sel — les anchois assaisonnent toute la pizza' },
    isCommonPantry: true,
    qtyMultiplierByStyle: { roman: 1.2 },
    goodEnough: {
      name: { en: 'Anchovy paste (tube)', fr: "Pâte d'anchois (tube)" },
      note: { en: 'Squeeze small dots across the pizza before baking. Same depth of flavour, easier to distribute.', fr: 'Déposer de petits points sur la pizza avant cuisson. Même profondeur de goût, plus facile à répartir.' },
    },
    compromise: {
      name: { en: 'Cured black olives (finely chopped)', fr: 'Olives noires séchées (finement hachées)' },
      note: { en: 'Loses the briny fish character but adds umami depth. Use only if no anchovy source available.', fr: "Perd le caractère marin mais apporte de l'umami. À utiliser uniquement si aucune source d'anchois disponible." },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant', 'NTUC FairPrice'], online: ['RedMart'], note: 'Roland or Ortiz brand — olive oil packed in the canned fish aisle' },
      france:    { shops: ['Any supermarket'], note: "Filets d'anchois à l'huile — ubiquitous in France" },
      us:        { shops: ['Any grocery store'], note: 'Ortiz (premium) or any jarred anchovies in olive oil' },
      uk:        { shops: ['Any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'] },
    },
  },

  tuna: {
    id: 'tuna', category: 'seafood', bakeOrder: 'before',
    name: { en: 'Good quality canned tuna in oil', fr: 'Thon de qualité à l\'huile' },
    prepNote: { en: 'Drain well before adding', fr: 'Bien égoutter avant d\'ajouter', timing: 5 },
    qtyPerPizza: { amount: 80, unit: 'g', noteEN: 'drained weight', noteFR: 'poids égoutté' },
    goodEnough: {
      name: { en: 'Tuna in olive oil (any good brand)', fr: "Thon à l'huile d'olive (bonne marque)" },
      note: { en: 'Quality matters here — avoid brine-packed tuna which is too wet. Rio Mare, Ortiz, or equivalent.', fr: 'La qualité compte ici — éviter le thon au naturel trop aqueux. Rio Mare, Ortiz ou équivalent.' },
    },
    compromise: {
      name: { en: 'Canned sardines in olive oil (drained)', fr: "Sardines en conserve à l'huile d'olive (égouttées)" },
      note: { en: 'Stronger flavour. Remove bones, flake, pat dry. Unexpectedly good on pizza.', fr: 'Goût plus fort. Enlever les arêtes, émietter, éponger. Étonnamment bon sur pizza.' },
    },
  },

  thinPotato: {
    id: 'thin_potato', category: 'veg', bakeOrder: 'before',
    name: { en: 'Thinly sliced potato', fr: 'Pomme de terre en fines tranches' },
    prepNote: { en: 'Slice 2mm — no pre-cooking for mid/low oven. High oven: blanch 2 min first.', fr: 'Trancher à 2mm — pas de précuisson four moyen. Four très chaud : blanchir 2 min.', timing: 10 },
    qtyPerPizza: { amount: 150, unit: 'g', noteEN: 'sliced 2mm', noteFR: 'tranché à 2mm' },
  },

  mushrooms: {
    id: 'mushrooms', category: 'veg', bakeOrder: 'before',
    name: { en: 'Mixed mushrooms', fr: 'Champignons mélangés' },
    prepNote: { en: 'Sauté briefly before adding — removes excess water', fr: 'Faire revenir brièvement — élimine l\'excès d\'eau', timing: 15 },
    prepNoteByStyle: {
      neapolitan: { en: 'Must sauté 3–4 min before adding — the 90-second Neapolitan bake will not cook raw mushrooms. They must be pre-cooked and excess water removed.', fr: 'Doit être sauté 3–4 min avant — la cuisson napolitaine de 90 secondes ne cuira pas les champignons crus. Ils doivent être précuits et l\'eau excédentaire retirée.', timing: 5 },
      sourdough:  { en: 'Sauté 3–4 min before adding — same reasoning as Neapolitan.', fr: 'Sauter 3–4 min avant — même raisonnement que le napolitain.', timing: 5 },
      pan:        { en: 'Can add raw — the 20–25 min pan bake cooks them through. Sautéing first gives better flavour but is optional.', fr: 'Peut être ajouté cru — la cuisson pan de 20–25 min les cuit entièrement. Sauter d\'abord donne plus de saveur mais est optionnel.', timing: 0 },
      roman:      { en: 'Can add raw or lightly sautéed — the longer bake handles raw mushrooms well.', fr: 'Peut être ajouté cru ou légèrement sauté — la cuisson plus longue gère bien les champignons crus.', timing: 0 },
    },
    qtyPerPizza: { amount: 80, unit: 'g', noteEN: 'sliced', noteFR: 'émincés' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
  },

  porcini: {
    id: 'porcini', category: 'veg', bakeOrder: 'before',
    name: { en: 'Porcini mushrooms', fr: 'Cèpes' },
    prepNote: { en: 'Sauté in butter before adding', fr: 'Faire revenir au beurre avant d\'ajouter', timing: 15 },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'fresh or rehydrated', noteFR: 'frais ou réhydratés' },
    goodEnough: { name: { en: 'Dried porcini (rehydrated) or chestnut mushrooms', fr: 'Cèpes séchés (réhydratés) ou champignons de châtaigne' } },
  },

  artichoke: {
    id: 'artichoke', category: 'veg', bakeOrder: 'before',
    name: { en: 'Artichoke hearts (jarred)', fr: 'Cœurs d\'artichaut (en bocal)' },
    prepNote: { en: 'Drain and halve before adding', fr: 'Égoutter et couper en deux avant d\'ajouter' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'hearts, quartered', noteFR: 'coeurs en quartiers' },
  },

  blackOlives: {
    id: 'black_olives', category: 'veg', bakeOrder: 'before',
    name: { en: 'Black olives', fr: 'Olives noires' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 30, unit: 'g' },
  },

  capers: {
    id: 'capers', category: 'veg', bakeOrder: 'before',
    name: { en: 'Capers', fr: 'Câpres' },
    prepNote: { en: 'Rinse if salted', fr: 'Rincer si au sel' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  redOnion: {
    id: 'red_onion', category: 'veg', bakeOrder: 'before',
    name: { en: 'Red onion', fr: 'Oignon rouge' },
    prepNote: { en: 'Slice very thin, raw — caramelises in the oven', fr: 'Trancher très finement, cru — caramélise au four' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 50, unit: 'g' },
  },

  sweetcorn: {
    id: 'sweetcorn', category: 'veg', bakeOrder: 'before',
    name: { en: 'Sweetcorn', fr: 'Maïs doux' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 50, unit: 'g' },
  },

  spinach: {
    id: 'spinach', category: 'veg', bakeOrder: 'before',
    name: { en: 'Fresh spinach', fr: 'Épinards frais' },
    prepNote: { en: 'Wilt briefly, squeeze out water completely before adding', fr: 'Faire tomber rapidement, presser l\'eau complètement avant d\'ajouter', timing: 10 },
    qtyPerPizza: { amount: 80, unit: 'g', noteEN: 'fresh, wilts to ~30g', noteFR: 'frais, réduit à ~30g' },
  },

  aubergine: {
    id: 'aubergine', category: 'veg', bakeOrder: 'before',
    name: { en: 'Aubergine', fr: 'Aubergine' },
    prepNote: { en: 'Slice, salt 20 min, pat dry — roast or fry before adding', fr: 'Trancher, saler 20 min, sécher — rôtir ou frire avant d\'ajouter', timing: 35 },
    prepNoteByStyle: {
      neapolitan: { en: 'Must pre-roast or fry — the 90-second bake will not cook raw aubergine. Salt, drain, then roast at 220°C for 15 min or pan-fry until golden.', fr: 'Doit être prérotie ou frite — la cuisson de 90 secondes ne cuira pas l\'aubergine crue. Saler, égoutter, puis rôtir à 220°C 15 min ou frire à la poêle jusqu\'à dorée.', timing: 20 },
      pan:        { en: 'Semi-raw works for pan style — slice thin, salt 20 min, pat dry. The 20+ min bake finishes them. Pre-roasting gives richer flavour.', fr: 'Semi-crue fonctionne pour le style pan — trancher finement, saler 20 min, éponger. La cuisson de 20+ min les termine. Prérotie donne plus de saveur.', timing: 20 },
      roman:      { en: 'Same as pan — semi-raw works. Salt and drain, the longer bake handles the rest.', fr: 'Même que le pan — semi-crue fonctionne. Saler et égoutter, la cuisson plus longue s\'occupe du reste.', timing: 20 },
    },
    qtyPerPizza: { amount: 100, unit: 'g', noteEN: 'sliced and grilled', noteFR: 'tranché et grillé' },
  },

  courgette: {
    id: 'courgette', category: 'veg', bakeOrder: 'before',
    name: { en: 'Courgette', fr: 'Courgette' },
    prepNote: { en: 'Slice thin', fr: 'Trancher finement' },
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  courgFlower: {
    id: 'courgette_flower', category: 'veg', bakeOrder: 'before',
    name: { en: 'Courgette flowers', fr: 'Fleurs de courgette' },
    prepNote: { en: 'Open flat, remove pistil, add before baking', fr: 'Ouvrir à plat, retirer le pistil, ajouter avant cuisson', timing: 5 },
    qtyPerPizza: { amount: 2, unit: 'pcs' },
    hardToFind: true,
    goodEnough: { name: { en: 'Thinly sliced courgette', fr: 'Courgette tranchée finement' } },
    compromise: { name: { en: 'Thinly sliced courgette', fr: 'Courgette tranchée finement' } },
  },

  roastedPepper: {
    id: 'roasted_pepper', category: 'veg', bakeOrder: 'before',
    name: { en: 'Roasted red pepper', fr: 'Poivron rouge rôti' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  freshThyme: {
    id: 'fresh_thyme', category: 'veg', bakeOrder: 'before',
    name: { en: 'Fresh thyme', fr: 'Thym frais' },
    qtyPerPizza: { amount: 3, unit: 'sprigs' },
  },

  fig: {
    id: 'fig', category: 'veg', bakeOrder: 'after',
    name: { en: 'Fresh figs', fr: 'Figues fraîches' },
    prepNote: { en: 'Quarter and add after baking — heat ruins their texture', fr: 'Couper en quatre et ajouter après cuisson — la chaleur détruit leur texture' },
    qtyPerPizza: { amount: 2, unit: 'pcs' },
  },

  pear: {
    id: 'pear', category: 'veg', bakeOrder: 'before',
    name: { en: 'Pear', fr: 'Poire' },
    prepNote: { en: 'Slice thin, add before baking', fr: 'Trancher finement, ajouter avant cuisson' },
    qtyPerPizza: { amount: 1, unit: 'pcs' },
  },

  gorgonzola: {
    id: 'gorgonzola', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Gorgonzola dolce', fr: 'Gorgonzola dolce' },
    prepNote: { en: 'Crumble over base — melts beautifully', fr: 'Émietter sur la base — fond magnifiquement' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'crumbled', noteFR: 'émietté' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
    goodEnough: { name: { en: 'Any creamy blue cheese', fr: 'N\'importe quel fromage bleu crémeux' } },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], online: ['RedMart'], note: "Gorgonzola dolce (creamy) preferred over piccante (aged) for pizza" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'fromageries'], note: 'Well stocked in most supermarkets and cheese shops' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Costco'], online: ["Murray's Cheese"], note: "Look for 'dolce' style" },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's", 'Ocado'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Coles', 'Woolworths', 'IGA'], note: 'Gorgonzola dolce in most major supermarkets' },
    },
  },

  taleggio: {
    id: 'taleggio', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Taleggio', fr: 'Taleggio' },
    prepNote: { en: 'Slice thin — melts beautifully and evenly', fr: 'Trancher finement — fond parfaitement' },
    qtyPerPizza: { amount: 30, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
    hardToFind: true,
    goodEnough: { name: { en: 'Young Fontina — same washed-rind family, melts identically', fr: 'Fontina jeune — même famille à croûte lavée, fond pareil' } },
    compromise: { name: { en: 'Brie (double cream) — different character but melts well', fr: 'Brie (double crème) — caractère différent mais fond bien' } },
    localSwap: {
      singapore: { name: { en: 'Ryan\'s Grocery or Culina — usually in stock', fr: 'Ryan\'s Grocery ou Culina — généralement en stock' } },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Usually in stock at Ryan's and Culina — call ahead to confirm" },
      france:    { shops: ['Grand Frais', 'fromageries', 'Monoprix', 'La Grande Épicerie'], note: 'Available in most fromageries and Grand Frais cheese counters' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado'], online: ['Ocado'], note: 'Widely available in supermarkets with good cheese sections' },
    },
  },

  parmigiano: {
    id: 'parmigiano', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Parmigiano Reggiano', fr: 'Parmesan Reggiano' },
    prepNote: { en: 'Grate finely — melts into other cheeses', fr: 'Râper finement — se mélange aux autres fromages' },
    prepNoteByStyle: {
      neapolitan: { en: 'Use very sparingly — just a light dusting. Neapolitan style is not parmesan-heavy. Half before baking, half after.', fr: 'Utiliser très peu — juste un léger saupoudrage. Le style napolitain n\'est pas riche en parmesan. Moitié avant, moitié après cuisson.', timing: 3 },
      sourdough:  { en: 'Use sparingly — light dusting only. Add half before baking, half after.', fr: 'Utiliser avec parcimonie. Moitié avant, moitié après cuisson.', timing: 3 },
    },
    qtyPerPizza: { amount: 30, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
    goodEnough: { name: { en: 'Grana Padano — slightly milder, works well', fr: 'Grana Padano — légèrement plus doux, fonctionne bien' } },
    compromise: { name: { en: 'Any hard aged cheese, finely grated', fr: 'Tout fromage à pâte dure affiné, finement râpé' } },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], online: ['RedMart'], note: 'Pre-grated tubs at most Cold Storage — a wedge is better value and fresher' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'Grand Frais'], note: 'Parmigiano Reggiano AOP — ubiquitous in France. Buy a wedge, not pre-grated' },
      us:        { shops: ['Whole Foods', 'Costco (great value)', 'any grocery store'], note: 'Costco sells large wedges at excellent value' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado', 'Costco'], note: 'Widely available — Grana Padano is a great budget alternative' },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm', 'IGA'] },
    },
  },

  brie: {
    id: 'brie', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Brie', fr: 'Brie' },
    prepNote: { en: 'Slice thin with rind on — melts beautifully', fr: 'Trancher finement avec la croûte — fond magnifiquement' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: {
      name: { en: 'Camembert', fr: 'Camembert' },
      note: { en: 'Same melt profile, slightly stronger flavour. Remove rind or leave on — both work.', fr: 'Même comportement à la fonte, goût légèrement plus fort. Avec ou sans croûte — les deux fonctionnent.' },
    },
    compromise: {
      name: { en: 'Mild goat cheese log (buchette)', fr: 'Bûche de chèvre douce' },
      note: { en: 'Crumbles rather than melts — place in small pieces. Delicious but different texture.', fr: "S'émiette plutôt que de fondre — placer en petits morceaux. Délicieux mais texture différente." },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant', "Ryan's Grocery"], online: ['RedMart'], note: 'President Brie or Ile de France — most supermarkets have it' },
      france:    { shops: ['Any supermarket or fromagerie'], note: 'Brie de Meaux AOP or Brie de Melun AOP — buy from a fromagerie for best quality' },
      us:        { shops: ['Any supermarket', "Trader Joe's", 'Whole Foods'], note: 'Widely available — look for a French import for best melt' },
      uk:        { shops: ['Any supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'] },
    },
  },

  ricotta: {
    id: 'ricotta', category: 'base', bakeOrder: 'before',
    name: { en: 'Fresh ricotta', fr: 'Ricotta fraîche' },
    prepNote: { en: 'Spread as base, season with salt and a pinch of nutmeg', fr: 'Étaler comme base, assaisonner sel et noix de muscade' },
    confusingNote: {
      en: 'Use fresh ricotta — not dry or smoked. Should be creamy and spreadable.',
      fr: 'Utiliser de la ricotta fraîche — pas sèche ni fumée. Doit être crémeuse.',
    },
    qtyPerPizza: { amount: 100, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.2, pan: 1.3 },
    compromise: {
      name: { en: 'Mascarpone — richer, no tang', fr: 'Mascarpone — plus riche, sans acidité' },
    },
    goodEnough: {
      name: { en: 'Fresh fromage blanc or quark', fr: 'Fromage blanc frais ou quark' },
      note: { en: 'Season with salt and nutmeg as you would ricotta. Slightly wetter — drain briefly if needed.', fr: 'Assaisonner avec sel et noix de muscade comme la ricotta. Légèrement plus humide — égoutter brièvement si besoin.' },
    },
  },

  truffleOil: {
    id: 'truffle_oil', category: 'finish', bakeOrder: 'after',
    name: { en: 'Truffle oil', fr: 'Huile de truffe' },
    prepNote: { en: 'Drizzle after baking — never cook truffle oil', fr: 'Arroser après cuisson — ne jamais cuire l\'huile de truffe' },
    qtyPerPizza: { amount: 10, unit: 'ml', noteEN: 'drizzle only', noteFR: 'filet seulement' },
    goodEnough: {
      name: { en: 'Black truffle paste (small jar)', fr: 'Crème de truffe noire (petit bocal)' },
      note: { en: 'Thin with a little olive oil and drizzle after baking. More flavourful than most truffle oils.', fr: "Diluer avec un peu d'huile d'olive et arroser après cuisson. Plus parfumé que la plupart des huiles de truffe." },
    },
    compromise: {
      name: { en: "Truffle salt + extra olive oil", fr: "Sel à la truffe + huile d'olive" },
      note: { en: 'Finish the pizza with truffle salt and a generous drizzle of good olive oil. Subtle but effective.', fr: "Finir la pizza avec du sel à la truffe et un généreux filet d'huile d'olive de qualité. Subtil mais efficace." },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Culina'], online: ['RedMart', 'Lazada'], note: 'Tartufi Jimmy or Roland brand — avoid very cheap versions with no real truffle' },
      france:    { shops: ['Carrefour', 'Monoprix', 'La Grande Épicerie', 'specialty oil shops'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'specialty food stores'], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado', 'any major supermarket'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'Coles (some)', 'specialty delis'] },
    },
  },

  honey: {
    id: 'honey', category: 'finish', bakeOrder: 'after',
    name: { en: 'Honey drizzle', fr: 'Filet de miel' },
    prepNote: { en: 'Drizzle after baking', fr: 'Arroser après cuisson' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  walnuts: {
    id: 'walnuts', category: 'finish', bakeOrder: 'before',
    name: { en: 'Walnuts', fr: 'Noix' },
    prepNote: { en: 'Roughly crush — toast lightly for more flavour', fr: 'Concasser grossièrement — légèrement torréfier pour plus de goût', timing: 10 },
    isCommonPantry: true,
    qtyPerPizza: { amount: 30, unit: 'g' },
    compromise: { name: { en: 'Pecans or hazelnuts', fr: 'Noix de pécan ou noisettes' } },
  },

  freshBasil: {
    id: 'fresh_basil', category: 'finish', bakeOrder: 'after',
    name: { en: 'Fresh basil', fr: 'Basilic frais' },
    prepNote: { en: 'Tear and add after baking — wilts and blackens in the oven', fr: 'Déchirer et ajouter après cuisson — se flétrit et noircit au four' },
    qtyPerPizza: { amount: 5, unit: 'leaves' },
    goodEnough: { name: { en: 'Thai basil — slightly more anise flavour', fr: 'Basilic thaï — légèrement plus anisé' } },
    compromise: { name: { en: 'Thai basil — slightly more anise', fr: 'Basilic thaï — légèrement plus anisé' } },
    localSwap: {
      singapore: { name: { en: 'Thai basil widely available; Italian basil at FairPrice Finest', fr: 'Basilic thaï très disponible ; basilic italien chez FairPrice Finest' } },
    },
  },

  rocket: {
    id: 'rocket', category: 'finish', bakeOrder: 'after',
    name: { en: 'Rocket (rucola)', fr: 'Roquette' },
    prepNote: { en: 'Add after baking — wilts immediately if added before', fr: 'Ajouter après cuisson — flétrit immédiatement si ajoutée avant' },
    qtyPerPizza: { amount: 20, unit: 'g' },
    compromise: { name: { en: 'Baby spinach — milder, less peppery', fr: "Jeunes pousses d'épinard — plus doux, moins poivré" } },
    localSwap: {
      singapore: { name: { en: 'Rocket — FairPrice Finest or Cold Storage', fr: 'Roquette — FairPrice Finest ou Cold Storage' } },
    },
  },

  evoOil: {
    id: 'evo_oil', category: 'finish', bakeOrder: 'after',
    name: { en: 'Extra virgin olive oil', fr: 'Huile d\'olive extra vierge' },
    prepNote: { en: 'Drizzle after baking — high heat destroys the flavour', fr: 'Arroser après cuisson — la forte chaleur détruit le goût' },
    isCommonPantry: true,
  },

  blackPepper: {
    id: 'black_pepper', category: 'finish', bakeOrder: 'after',
    name: { en: 'Black pepper', fr: 'Poivre noir' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pinch' },
  },

  dill: {
    id: 'dill', category: 'finish', bakeOrder: 'after',
    name: { en: 'Fresh dill', fr: 'Aneth frais' },
    prepNote: { en: 'Add after baking', fr: 'Ajouter après cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp', noteEN: 'fresh, chopped', noteFR: 'frais, ciselé' },
  },

  lemonWedge: {
    id: 'lemon_wedge', category: 'finish', bakeOrder: 'after',
    name: { en: 'Lemon wedge', fr: 'Quartier de citron' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pcs' },
  },

  parmigianoShavings: {
    id: 'parmigiano_shavings', category: 'cheese', bakeOrder: 'after',
    name: { en: 'Parmigiano shavings', fr: 'Copeaux de parmesan' },
    prepNote: { en: 'Use a peeler — add after baking', fr: 'Utiliser un économe — ajouter après cuisson' },
    qtyPerPizza: { amount: 20, unit: 'g' },
  },

  chilli: {
    id: 'chilli', category: 'veg', bakeOrder: 'before',
    name: { en: 'Fresh chilli', fr: 'Piment frais' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pcs' },
  },

  rosemary: {
    id: 'rosemary', category: 'veg', bakeOrder: 'before',
    name: { en: 'Fresh rosemary', fr: 'Romarin frais' },
    qtyPerPizza: { amount: 2, unit: 'sprigs' },
  },

  seaSalt: {
    id: 'sea_salt', category: 'finish', bakeOrder: 'after',
    name: { en: 'Sea salt flakes', fr: 'Fleur de sel' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pinch' },
  },

  bbqSauce: {
    id: 'bbq_sauce', category: 'sauce', bakeOrder: 'before',
    name: { en: 'BBQ sauce', fr: 'Sauce BBQ' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  freshCoriander: {
    id: 'fresh_coriander', category: 'finish', bakeOrder: 'after',
    name: { en: 'Fresh coriander', fr: 'Coriandre fraîche' },
    prepNote: { en: 'Add after baking', fr: 'Ajouter après cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  pesto: {
    id: 'pesto', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Fresh basil pesto', fr: 'Pesto basilic frais' },
    prepNote: { en: 'Spread thinly — intense flavour', fr: 'Étaler finement — goût intense' },
    qtyPerPizza: { amount: 40, unit: 'g' },
    goodEnough: { name: { en: 'Good quality jarred pesto', fr: 'Pesto en bocal de bonne qualité' } },
    compromise: { name: { en: 'Good quality jarred pesto', fr: 'Pesto en bocal de qualité' } },
  },

  garlic: {
    id: 'garlic', category: 'veg', bakeOrder: 'before',
    name: { en: 'Garlic', fr: 'Ail' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 2, unit: 'pcs', noteEN: 'cloves', noteFR: 'gousses' },
  },

  oregano: {
    id: 'oregano', category: 'spice', bakeOrder: 'before',
    name: { en: 'Dried oregano', fr: 'Origan séché' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pinch' },
  },

  nutella: {
    id: 'nutella', category: 'base', bakeOrder: 'before',
    name: { en: 'Nutella', fr: 'Nutella' },
    prepNote: { en: 'Spread after baking — do not bake Nutella', fr: 'Étaler après cuisson — ne pas cuire le Nutella' },
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  strawberries: {
    id: 'strawberries', category: 'veg', bakeOrder: 'after',
    name: { en: 'Fresh strawberries', fr: 'Fraises fraîches' },
    prepNote: { en: 'Slice and add after baking', fr: 'Trancher et ajouter après cuisson' },
    qtyPerPizza: { amount: 80, unit: 'g' },
  },

  icingSugar: {
    id: 'icing_sugar', category: 'finish', bakeOrder: 'after',
    name: { en: 'Icing sugar', fr: 'Sucre glace' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  caramelisedApple: {
    id: 'caramelised_apple', category: 'veg', bakeOrder: 'before',
    name: { en: 'Caramelised apple', fr: 'Pomme caramélisée' },
    prepNote: { en: 'Cook apple slices in butter and brown sugar 10 min before adding', fr: 'Cuire les tranches de pomme dans beurre et cassonade 10 min avant d\'ajouter', timing: 20 },
    qtyPerPizza: { amount: 1, unit: 'pcs', noteEN: '1 apple per pizza', noteFR: '1 pomme par pizza' },
  },

  cinnamon: {
    id: 'cinnamon', category: 'spice', bakeOrder: 'before',
    name: { en: 'Cinnamon', fr: 'Cannelle' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 1, unit: 'pinch' },
  },

  darkChocCream: {
    id: 'dark_choc_cream', category: 'base', bakeOrder: 'before',
    name: { en: 'Dark chocolate cream', fr: 'Crème au chocolat noir' },
    prepNote: { en: 'Melt dark chocolate with cream (2:1) — spread warm', fr: 'Fondre le chocolat noir avec la crème (2:1) — étaler tiède', timing: 15 },
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  pearSlices: {
    id: 'pear_slices', category: 'veg', bakeOrder: 'before',
    name: { en: 'Thin pear slices', fr: 'Tranches fines de poire' },
    prepNote: { en: 'Slice 3mm, fan over base', fr: 'Trancher à 3mm, disposer en éventail' },
    qtyPerPizza: { amount: 1, unit: 'pcs' },
  },

  almondFlakes: {
    id: 'almond_flakes', category: 'finish', bakeOrder: 'before',
    name: { en: 'Almond flakes', fr: 'Amandes effilées' },
    prepNote: { en: 'Toast lightly before adding', fr: 'Légèrement torréfier avant d\'ajouter', timing: 10 },
    qtyPerPizza: { amount: 20, unit: 'g', noteEN: 'toasted', noteFR: 'grillées' },
  },

  asparagus: {
    id: 'asparagus', category: 'veg', bakeOrder: 'before',
    name: { en: 'Asparagus', fr: 'Asperges' },
    prepNote: { en: 'Blanch 2 min, slice lengthways, add before baking', fr: 'Blanchir 2 min, couper en longueur, ajouter avant cuisson', timing: 10 },
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  cornichons: {
    id: 'cornichons', category: 'veg', bakeOrder: 'after',
    name: { en: 'Cornichons', fr: 'Cornichons' },
    prepNote: { en: 'Slice and add after baking — acidity balances the richness', fr: 'Trancher et ajouter après cuisson — l\'acidité équilibre le gras' },
    isCommonPantry: true,
  },

  freshChives: {
    id: 'fresh_chives', category: 'finish', bakeOrder: 'after',
    name: { en: 'Fresh chives', fr: 'Ciboulette fraîche' },
    prepNote: { en: 'Snip and add after baking', fr: 'Ciseler et ajouter après cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp', noteEN: 'chopped', noteFR: 'ciselée' },
  },

  andouille: {
    id: 'andouille', category: 'meat', bakeOrder: 'before',
    name: { en: 'Andouille sausage (sliced)', fr: 'Andouille (en tranches)' },
    prepNote: { en: 'Slice 3mm — distinctive smoky flavour', fr: 'Trancher à 3mm — goût fumé distinctif' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4–5 slices', noteFR: '4–5 tranches' },
    hardToFind: true,
    goodEnough: { name: { en: 'Smoked sausage or chorizo', fr: 'Saucisse fumée ou chorizo' } },
    compromise: { name: { en: 'Smoked chorizo — different flavour but works', fr: 'Chorizo fumé — goût différent mais fonctionne' } },
    localSwap: {
      singapore: { name: { en: 'Smoked sausage — Cold Storage or specialty delis', fr: 'Saucisse fumée — Cold Storage ou épiceries spécialisées' } },
    },
  },

  dijonMustard: {
    id: 'dijon_mustard', category: 'base', bakeOrder: 'before',
    name: { en: 'Dijon mustard base', fr: 'Base moutarde de Dijon' },
    prepNote: { en: 'Spread thin layer as base instead of tomato sauce', fr: 'Étaler en fine couche comme base à la place de la sauce tomate' },
    isCommonPantry: true,
    qtyPerPizza: { amount: 2, unit: 'tbsp' },
  },

  emmental: {
    id: 'emmental', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Emmental', fr: 'Emmental' },
    prepNote: { en: 'Grate — melts evenly', fr: 'Râper — fond uniformément' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Gruyère or Comté', fr: 'Gruyère ou Comté' }, note: { en: 'Better flavour than emmental, same melt. Slightly more expensive but worth it.', fr: "Meilleur goût que l'emmental, même fonte. Légèrement plus cher mais ça vaut le coup." } },
    compromise: { name: { en: 'Any semi-hard melting cheese', fr: 'Tout fromage à pâte semi-dure fondant' }, note: { en: 'Edam, mild gouda, or raclette all work. Avoid anything too strong.', fr: 'Edam, gouda doux ou raclette conviennent. Éviter les fromages trop forts.' } },
  },

  bayonneHam: {
    id: 'bayonne_ham', category: 'meat', bakeOrder: 'after',
    name: { en: 'Jambon de Bayonne', fr: 'Jambon de Bayonne' },
    prepNote: { en: 'Add after baking — delicate texture', fr: 'Ajouter après cuisson — texture délicate' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4 slices', noteFR: '4 tranches' },
    hardToFind: true,
    goodEnough: { name: { en: 'Prosciutto or good quality cured ham', fr: 'Prosciutto ou jambon cru de qualité' } },
    compromise: { name: { en: 'Good prosciutto — less smoky', fr: 'Bon prosciutto — moins fumé' } },
  },

  espelettePepper: {
    id: 'espelette_pepper', category: 'spice', bakeOrder: 'before',
    name: { en: 'Piment d\'Espelette', fr: 'Piment d\'Espelette' },
    prepNote: { en: 'Sprinkle lightly — gentle heat, fruity flavour', fr: 'Saupoudrer légèrement — chaleur douce, goût fruité' },
    qtyPerPizza: { amount: 1, unit: 'pinch' },
    hardToFind: true,
    goodEnough: { name: { en: 'Mild chilli flakes or sweet paprika', fr: 'Flocons de piment doux ou paprika doux' } },
    compromise: { name: { en: 'Sweet paprika + pinch of cayenne', fr: 'Paprika doux + pincée de cayenne' } },
    localSwap: {
      singapore: { name: { en: 'Mild chilli flakes — widely available', fr: 'Flocons de piment doux — très disponibles' } },
    },
  },

  ossauIraty: {
    id: 'ossau_iraty', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Ossau-Iraty (Basque sheep cheese)', fr: 'Ossau-Iraty' },
    prepNote: { en: 'Slice or grate — nutty, slightly tangy', fr: 'Trancher ou râper — noiseté, légèrement acidulé' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: 'sliced thin', noteFR: 'tranché fin' },
    goodEnough: { name: { en: 'Manchego or any mild sheep cheese', fr: 'Manchego ou tout fromage de brebis doux' } },
    localSwap: {
      singapore: { name: { en: 'Manchego — Marketplace or Ryan\'s Grocery', fr: 'Manchego — Marketplace ou Ryan\'s Grocery' } },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Marketplace'], note: 'Manchego is a reliable substitute available at Cold Storage' },
      france:    { shops: ['Grand Frais', 'fromageries', 'Carrefour', 'Monoprix'], note: 'Ossau-Iraty AOP — common in France, especially in southwest and Paris shops' },
      uk:        { shops: ['Waitrose', "Neal's Yard Dairy", 'specialist cheesemongers'], online: ['Ocado'] },
    },
  },

  maroilles: {
    id: 'maroilles', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Maroilles (washed-rind cheese)', fr: 'Maroilles' },
    prepNote: { en: 'Slice — strong aroma softens beautifully when baked', fr: 'Trancher — l\'arôme fort s\'adoucit magnifiquement à la cuisson' },
    qtyPerPizza: { amount: 100, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Munster or any washed-rind cheese', fr: 'Munster ou tout fromage à croûte lavée' } },
    compromise: { name: { en: "Any strong washed-rind cheese — Époisses, Pont-l'Évêque", fr: "Tout fromage à croûte lavée fort — Époisses, Pont-l'Évêque" } },
    localSwap: {
      singapore: { name: { en: 'Limburger or strong brie — specialty delis', fr: 'Limburger ou brie fort — épiceries spécialisées' } },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery (call ahead)", 'Culina'], note: 'Very rare — Munster or strong washed-rind brie is the best substitute' },
      france:    { shops: ['Carrefour', 'Leclerc', 'fromageries', 'Grand Frais'], note: 'Maroilles AOP — widely available in France, especially in the north' },
      uk:        { shops: ['Specialist cheesemongers', 'La Fromagerie (London)'], note: 'Very rare in UK supermarkets — Munster is the best substitute' },
    },
  },

  caramelisedOnion: {
    id: 'caramelised_onion', category: 'veg', bakeOrder: 'before',
    name: { en: 'Caramelised onion', fr: 'Oignon caramélisé' },
    prepNote: { en: 'Cook sliced onion low and slow 25 min in butter — deeply sweet', fr: 'Cuire l\'oignon émincé à feu doux 25 min dans du beurre — très doux et sucré', timing: 35 },
    qtyPerPizza: { amount: 80, unit: 'g', noteEN: '2 onions cooked down', noteFR: '2 oignons fondus' },
  },

  camembert: {
    id: 'camembert', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Camembert', fr: 'Camembert' },
    prepNote: { en: 'Slice and distribute — melts into rich pools', fr: 'Trancher et distribuer — fond en flaque crémeuse' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Brie — same soft-ripened family, melts the same way', fr: 'Brie — même famille à pâte molle, fond pareillement' } },
    compromise: { name: { en: 'Any soft melting cheese', fr: 'Tout fromage fondant à pâte molle' } },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant'], note: 'President Camembert widely available — small round boxes in cheese aisle' },
      france:    { shops: ['Any supermarket or fromagerie'], note: 'Camembert de Normandie AOP — get it from a fromagerie for raw milk version' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'Ocado'] },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm'] },
    },
  },

  ciderReduction: {
    id: 'cider_reduction', category: 'finish', bakeOrder: 'after',
    name: { en: 'Cider reduction drizzle', fr: 'Réduction de cidre' },
    prepNote: { en: 'Reduce dry cider by half, drizzle after baking', fr: 'Réduire le cidre brut de moitié, arroser après cuisson', timing: 20 },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  reblochon: {
    id: 'reblochon', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Reblochon', fr: 'Reblochon' },
    prepNote: { en: 'Slice thin — melts into a creamy, rich layer', fr: 'Trancher finement — fond en couche crémeuse et riche' },
    qtyPerPizza: { amount: 100, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Brie or soft washed-rind cheese', fr: 'Brie ou fromage à croûte lavée moelleux' } },
    compromise: { name: { en: 'Soft Brie — different character but melts similarly', fr: 'Brie moelleux — caractère différent mais fond pareillement' } },
    localSwap: {
      singapore: { name: { en: 'Soft brie — Marketplace or Cold Storage', fr: 'Brie moelleux — Marketplace ou Cold Storage' } },
    },
    whereToFind: {
      singapore: { shops: ['Marketplace', "Ryan's Grocery"], note: 'Seasonal availability — call ahead. Brie is the easiest substitute' },
      france:    { shops: ['Carrefour', 'Grand Frais', 'fromageries', 'Leclerc'], note: 'Reblochon AOP — widely available in France, especially in winter/autumn' },
      uk:        { shops: ['Waitrose', 'M&S', 'specialist cheesemongers'], online: ['Ocado'], note: 'Available but less common — Waitrose most reliable' },
    },
  },

  merguez: {
    id: 'merguez', category: 'meat', bakeOrder: 'before',
    name: { en: 'Merguez sausage', fr: 'Merguez' },
    prepNote: { en: 'Slice thin — spiced lamb sausage with harissa', fr: "Trancher finement — saucisse d'agneau épicée au harissa" },
    qtyPerPizza: { amount: 100, unit: 'g' },
    goodEnough: { name: { en: 'Chorizo or spiced lamb sausage', fr: "Chorizo ou saucisse d'agneau épicée" } },
    compromise: { name: { en: 'Spicy Italian sausage — different spice profile', fr: "Saucisse italienne épicée — profil d'épices différent" } },
    localSwap: {
      singapore: { name: { en: "Spicy lamb sausage — Ryan's Grocery or halal butcher", fr: "Saucisse d'agneau épicée — Ryan's Grocery ou boucherie halal" } },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'halal butchers', 'Arab Street area shops'], note: 'Available at halal butchers — spiced lamb sausage' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'boucheries halal'], note: 'Very widely available in France — standard supermarket item' },
      uk:        { shops: ["Sainsbury's", 'Waitrose', 'Middle Eastern butchers'], online: ['Ocado'] },
      australia: { shops: ['Middle Eastern butchers', 'specialty delis'], note: 'Less common — halal butchers most reliable' },
    },
  },

  chorizo: {
    id: 'chorizo', category: 'meat', bakeOrder: 'before',
    name: { en: 'Chorizo', fr: 'Chorizo' },
    prepNote: { en: 'Slice thin — Spanish cured pork with paprika', fr: 'Trancher finement — charcuterie espagnole au paprika' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Pepperoni — similar heat and fat render', fr: 'Pepperoni — chaleur et fonte similaires' } },
    localSwap: {
      singapore: { name: { en: 'Chorizo — Cold Storage or Marketplace', fr: 'Chorizo — Cold Storage ou Marketplace' } },
    },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Giant'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'charcuteries'] },
      us:        { shops: ['Any grocery store', "Trader Joe's", 'Whole Foods'] },
      uk:        { shops: ['Any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA', 'Harris Farm'] },
    },
  },

  mixedPeppers: {
    id: 'mixed_peppers', category: 'veg', bakeOrder: 'before',
    name: { en: 'Mixed peppers (roasted)', fr: 'Poivrons mélangés (rôtis)' },
    prepNote: { en: 'Slice and roast at 200°C until soft — or use jarred roasted peppers', fr: "Couper et rôtir à 200°C jusqu'à tendreté — ou utiliser des poivrons en bocal", timing: 25 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Jarred roasted red peppers — excellent substitute', fr: 'Poivrons rouges rôtis en bocal — excellent substitut' } },
  },

  egg: {
    id: 'egg', category: 'base', bakeOrder: 'before',
    name: { en: 'Egg (cracked on top)', fr: 'Œuf (cassé sur la pizza)' },
    prepNote: { en: 'Crack directly onto pizza halfway through baking — yolk stays runny', fr: 'Casser directement sur la pizza à mi-cuisson — jaune reste coulant' },
    prepNoteByStyle: {
      neapolitan: { en: 'Add in the last 60–90 seconds only — at 450°C the egg sets almost instantly. Add too early and the yolk will be hard.', fr: 'Ajouter les 60–90 dernières secondes seulement — à 450°C l\'œuf se cuit presque instantanément. Trop tôt et le jaune sera dur.', timing: 0 },
      sourdough:  { en: 'Add in the last 60–90 seconds — same as Neapolitan, high heat sets the egg very quickly.', fr: 'Ajouter les 60–90 dernières secondes — même que le napolitain, la chaleur élevée cuit l\'œuf très rapidement.', timing: 0 },
      pan:        { en: 'Add at the 10-minute mark — lower temperature (230°C) needs more time to set the egg properly.', fr: 'Ajouter à la 10e minute — la température plus basse (230°C) nécessite plus de temps pour cuire l\'œuf correctement.', timing: 0 },
      roman:      { en: 'Add halfway through — mid-temperature oven sets the egg in about 5–7 min.', fr: 'Ajouter à mi-cuisson — le four à température moyenne cuit l\'œuf en 5–7 min environ.', timing: 0 },
    },
    qtyPerPizza: { amount: 1, unit: 'pcs', noteEN: 'per pizza', noteFR: 'par pizza' },
  },

  // ── New ingredients for pizza expansion ──────────────────

  guanciale: {
    id: 'guanciale', category: 'meat', bakeOrder: 'before',
    name: { en: 'Guanciale (cured pork cheek)', fr: 'Guanciale (joue de porc séchée)' },
    prepNote: { en: 'Slice thin — renders and crisps beautifully', fr: 'Trancher finement — fond et croustille parfaitement' },
    prepNoteByStyle: {
      neapolitan: { en: 'Slice paper-thin (1–2mm) — at 450°C it crisps in under 90 seconds. Too thick and it won\'t render in time.', fr: 'Trancher très finement (1–2mm) — à 450°C il croustille en moins de 90 secondes. Trop épais, il ne fondra pas à temps.', timing: 3 },
      pan:        { en: 'Slice 3–4mm — the lower temperature (230°C) and longer bake give fat time to render. Thicker slices stay juicy.', fr: 'Trancher à 3–4mm — la température plus basse (230°C) et la cuisson plus longue laissent le temps au gras de fondre. Les tranches plus épaisses restent juteuses.', timing: 3 },
      roman:      { en: 'Slice 2–3mm — medium thickness works well for the intermediate oven temperature.', fr: 'Trancher à 2–3mm — l\'épaisseur moyenne convient à la température de four intermédiaire.', timing: 3 },
    },
    qtyPerPizza: { amount: 60, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Pancetta or smoked bacon', fr: 'Pancetta ou bacon fumé' } },
    compromise: { name: { en: 'Smoked lardons', fr: 'Lardons fumés' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", "Huber's Butchery", 'Culina'], note: 'Specialty item — call ahead. Pancetta is the best substitute' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'specialist charcuteries'], note: 'Rare in standard supermarkets — Italian delis and charcuteries most reliable' },
      us:        { shops: ['Eataly', 'Italian specialty stores'], online: ['Amazon', 'Di Bruno Bros'], note: 'Specialty item — online ordering most reliable outside major cities' },
      uk:        { shops: ['Lina Stores', 'Natoora', 'Italian delis'], note: 'Specialist only — Pancetta is widely available and works well' },
    },
  },

  pecorinoRomano: {
    id: 'pecorino_romano', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Pecorino Romano (grated)', fr: 'Pecorino Romano (râpé)' },
    prepNote: { en: 'Grate finely — saltier than parmesan, use sparingly', fr: 'Râper finement — plus salé que le parmesan, utiliser avec parcimonie' },
    prepNoteByStyle: {
      neapolitan: { en: 'Add half before baking, half after — at 450°C pecorino browns quickly. The post-bake addition gives fresh sharpness.', fr: 'Ajouter moitié avant, moitié après cuisson — à 450°C le pecorino dore rapidement. L\'ajout après cuisson donne une note fraîche et tranchante.', timing: 3 },
      sourdough:  { en: 'Same as Neapolitan — split between before and after baking.', fr: 'Même que le napolitain — partager entre avant et après cuisson.', timing: 3 },
    },
    qtyPerPizza: { amount: 30, unit: 'g' },
    goodEnough: { name: { en: 'Aged Pecorino or Parmigiano Reggiano', fr: 'Pecorino affiné ou Parmigiano Reggiano' } },
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], note: 'Grated Pecorino Romano in most Cold Storage locations — DOP label preferred' },
      france:    { shops: ['Carrefour', 'Monoprix', 'Italian delis'], note: 'Pecorino Romano râpé — available in most supermarkets. Grand Frais has best selection' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'any grocery store'], note: 'Locatelli brand is excellent and widely available' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA', 'Italian delis'] },
    },
  },

  smokedProvola: {
    id: 'smoked_provola', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Provola affumicata (smoked)', fr: 'Provola affumicata (fumée)' },
    prepNote: { en: 'Slice thin — melts and adds deep smoky flavour', fr: 'Trancher finement — fond en apportant une profonde saveur fumée' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Scamorza affumicata', fr: 'Scamorza affumicata' } },
    compromise: { name: { en: 'Smoked mozzarella or smoked cheddar', fr: 'Mozzarella fumée ou cheddar fumé' } },
  },

  salsiccia: {
    id: 'salsiccia', category: 'meat', bakeOrder: 'before',
    name: { en: 'Italian sausage (salsiccia)', fr: 'Saucisse italienne (salsiccia)' },
    prepNote: { en: 'Remove casing, crumble over pizza before baking', fr: 'Retirer le boyau, émietter sur la pizza avant cuisson', timing: 5 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.3, pan: 1.4 },
    goodEnough: { name: { en: 'Any good pork sausage, casing removed', fr: 'Toute bonne saucisse de porc, sans boyau' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", "Huber's Butchery", 'Culina'], note: 'Italian-style pork sausage — any good pork sausage with fennel works' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'some charcuteries'], note: 'Saucisse italienne or chair à saucisse — butchers can make fresh on request' },
      uk:        { shops: ['Italian delis', 'Waitrose (Italian sausages)', 'Natoora'], online: ['Ocado'] },
    },
  },

  friarielli: {
    id: 'friarielli', category: 'veg', bakeOrder: 'before',
    name: { en: 'Friarielli (Neapolitan broccoli)', fr: 'Friarielli (brocoli napolitain)' },
    prepNote: { en: "Sauté with garlic and olive oil before adding — do not use raw", fr: "Faire revenir avec ail et huile d'olive avant d'ajouter — ne pas utiliser cru", timing: 15 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Cime di rapa (rapini/broccoli rabe)', fr: 'Cime di rapa (brocoli rave)' } },
    compromise: { name: { en: 'Tenderstem broccoli sautéed with chilli and garlic', fr: 'Broccolini sauté avec piment et ail' } },
    localSwap: {
      singapore: { name: { en: "Kai lan (Chinese broccoli) sautéed with garlic", fr: "Kai lan sauté à l'ail — Cold Storage ou wet markets" } },
    },
  },

  stracciatella: {
    id: 'stracciatella', category: 'cheese', bakeOrder: 'after',
    name: { en: 'Stracciatella', fr: 'Stracciatella' },
    prepNote: { en: 'Always add after baking — heat destroys its creamy texture', fr: 'Toujours ajouter après cuisson — la chaleur détruit sa texture crémeuse' },
    prepNoteByStyle: {
      pan: { en: 'Can add in last 3 min of baking — the thick pan base insulates it. Still best after baking.', fr: 'Peut être ajoutée les 3 dernières min de cuisson — la base épaisse l\'isole. Meilleure après cuisson.', timing: 0 },
    },
    qtyPerPizza: { amount: 80, unit: 'g' },
    qtyMultiplierByStyle: { roman: 1.2 },
    hardToFind: true,
    goodEnough: { name: { en: 'Burrata cream pulled apart', fr: 'Crème de burrata défaite' } },
    compromise: { name: { en: 'Fresh mozzarella torn and drizzled with cream', fr: 'Mozzarella fraîche déchirée avec un filet de crème' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: 'Less common than burrata — call ahead. Burrata cream pulled apart is an excellent substitute' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'Grand Frais'], note: 'Rare in standard supermarkets — Italian speciality delis most reliable' },
      uk:        { shops: ['Lina Stores', 'Melrose & Morgan', 'good Italian delis'], online: ['Ocado (seasonal)'], note: 'Uncommon outside specialist shops — burrata is a reliable substitute' },
    },
  },

  mortadella: {
    id: 'mortadella', category: 'meat', bakeOrder: 'after',
    name: { en: 'Mortadella (sliced)', fr: 'Mortadelle (tranchée)' },
    prepNote: { en: 'Add after baking — drape loosely so it just warms through', fr: 'Ajouter après cuisson — disposer librement pour elle se réchauffe doucement' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4–5 thin slices', noteFR: '4–5 tranches fines' },
    goodEnough: { name: { en: 'Any quality cooked ham, sliced thin', fr: 'Tout jambon cuit de qualité, tranché fin' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Growing availability — Ryan's most reliable" },
      france:    { shops: ['Italian delis', 'Grand Frais', 'La Grande Épicerie', 'Monoprix (some)'], note: 'Mortadelle de Bologne — Italian delis and Grand Frais best' },
      uk:        { shops: ['Waitrose', 'Lina Stores', 'Natoora', 'Italian delis'], online: ['Ocado'] },
    },
  },

  pistachiosPesto: {
    id: 'pistachios_pesto', category: 'base', bakeOrder: 'before',
    name: { en: 'Pistachio pesto', fr: 'Pesto de pistaches' },
    prepNote: { en: 'Blend pistachios, garlic, olive oil, parmesan — thick consistency', fr: "Mixer pistaches, ail, huile d'olive, parmesan — consistance épaisse", timing: 15 },
    qtyPerPizza: { amount: 40, unit: 'g' },
    goodEnough: { name: { en: 'Basil pesto with crushed pistachios added', fr: 'Pesto basilic avec pistaches concassées' } },
    whereToFind: {
      singapore: { shops: ['Phoon Huat', 'Cold Storage', 'Marketplace'], note: 'Raw pistachios for blending at Phoon Huat — make pesto fresh. Jarred pistachio pesto at Culina' },
      france:    { shops: ['Monoprix', 'Carrefour', 'Italian delis'], note: 'Pesto de pistaches en pot — available at Italian delis and some Monoprix' },
      us:        { shops: ["Trader Joe's (pistachio pesto jar)", 'Whole Foods', 'Italian specialty stores'], online: ['Amazon', 'Eataly'] },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado', 'Italian delis'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'specialty delis'], note: 'Pistachio nuts widely available — make pesto fresh or find jarred version at delis' },
    },
  },

  pistachiosTopped: {
    id: 'pistachios_topped', category: 'finish', bakeOrder: 'after',
    name: { en: 'Crushed pistachios', fr: 'Pistaches concassées' },
    prepNote: { en: 'Add after baking for crunch', fr: 'Ajouter après cuisson pour le croquant' },
    qtyPerPizza: { amount: 20, unit: 'g' },
  },

  brickCheese: {
    id: 'brick_cheese', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Wisconsin brick cheese', fr: 'Fromage brick du Wisconsin' },
    prepNote: { en: 'Spread to edges — caramelises against the pan for the frico crust', fr: "Étaler jusqu'aux bords — caramélise contre le moule pour le frico croustillant" },
    qtyPerPizza: { amount: 150, unit: 'g' },
    qtyMultiplierByStyle: { pan: 1.0 },
    hardToFind: true,
    goodEnough: { name: { en: 'Low-moisture mozzarella + mild cheddar 50/50', fr: 'Mozzarella faible humidité + cheddar doux 50/50' } },
    compromise: { name: { en: 'Low-moisture mozzarella alone', fr: 'Mozzarella faible humidité seule' } },
  },

  hotHoney: {
    id: 'hot_honey', category: 'finish', bakeOrder: 'after',
    name: { en: 'Hot honey', fr: 'Miel pimenté' },
    prepNote: { en: 'Drizzle after baking', fr: 'Verser en filet après cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
    goodEnough: { name: { en: 'Regular honey + pinch of chilli flakes', fr: 'Miel ordinaire + pincée de flocons de piment' } },
  },

  harissaBase: {
    id: 'harissa_base', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Harissa (base)', fr: 'Harissa (base)' },
    prepNote: { en: 'Spread thin — very concentrated, a little goes a long way', fr: 'Étaler finement — très concentré, un peu suffit largement' },
    qtyPerPizza: { amount: 2, unit: 'tbsp' },
    goodEnough: { name: { en: 'Rose harissa for milder heat', fr: 'Harissa rose pour une chaleur plus douce' } },
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Cold Storage (some locations)', 'Middle Eastern shops'], online: ['RedMart', 'Lazada'], note: "Le Phare du Cap Bon (tube) at Mustafa Centre most reliable" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Leclerc', 'épiceries du Maghreb'], note: 'Harissa très répandue en France — tubes et bocaux dans tous les supermarchés' },
      us:        { shops: ['Whole Foods', "Trader Joe's (seasonal)", 'Middle Eastern grocery stores'], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern shops', 'any major supermarket'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'IGA', 'Middle Eastern delis', 'Woolworths (some)'] },
    },
  },

  labneh: {
    id: 'labneh', category: 'cheese', bakeOrder: 'after',
    name: { en: 'Labneh (strained yogurt)', fr: 'Labneh (yaourt égoutté)' },
    prepNote: { en: 'Dollop after baking — never cook it', fr: 'Déposer en petites boules après cuisson — ne jamais cuire' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Thick Greek yogurt 10%+ fat', fr: 'Yaourt grec épais 10%+ MG' } },
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Al-Ansar grocery', 'Middle Eastern shops'], online: ['RedMart (Puck brand)'], note: 'Puck cream cheese labneh at Mustafa or online — thick Greek yogurt strained overnight is a great substitute' },
      france:    { shops: ['Monoprix', 'Carrefour', 'épiceries du Moyen-Orient'], note: 'Available in most Monoprix locations and Middle Eastern grocers' },
      us:        { shops: ['Whole Foods', 'Middle Eastern grocery stores', "Trader Joe's (seasonal)"], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern grocery stores'], online: ['Ocado'], note: 'Al Wadi or Puck brand — now in most major UK supermarkets' },
      australia: { shops: ['Harris Farm', 'Middle Eastern delis', 'IGA'], note: 'Becoming more available — Middle Eastern delis most reliable' },
    },
  },

  zaatarMix: {
    id: 'zaatar_mix', category: 'spice', bakeOrder: 'before',
    name: { en: "Za'atar spice blend", fr: "Mélange za'atar" },
    prepNote: { en: 'Mix with olive oil before spreading', fr: "Mélanger avec de l'huile d'olive avant d'étaler", timing: 5 },
    qtyPerPizza: { amount: 2, unit: 'tbsp' },
    hardToFind: false,
    goodEnough: { name: { en: 'Dried thyme + sesame + sumac + salt', fr: 'Thym séché + sésame + sumac + sel' } },
    localSwap: {
      singapore: { name: { en: "Za'atar readily available at Mustafa Centre or Jamal Kazura", fr: "Za'atar disponible chez Mustafa Centre ou Jamal Kazura" } },
    },
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Jamal Kazura', 'Arab Street area shops', 'Phoon Huat'], note: "Za'atar blend at Mustafa Centre — great value and quality" },
      france:    { shops: ['Épiceries du Moyen-Orient', 'Carrefour (some)', 'Monoprix (some)'], note: 'Disponible dans les épiceries du Moyen-Orient et certains supermarchés' },
      us:        { shops: ['Whole Foods', 'Middle Eastern grocery stores', "Trader Joe's (seasonal)"], online: ['Amazon', "Kalustyan's"] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern grocery stores'], online: ['Ocado'] },
      australia: { shops: ['Middle Eastern delis', 'Harris Farm (some)', 'IGA', 'spice shops'] },
    },
  },

  jamon: {
    id: 'jamon', category: 'meat', bakeOrder: 'after',
    name: { en: 'Jamón Ibérico', fr: 'Jamón Ibérico' },
    prepNote: { en: 'Always add after baking — heat destroys the fat and flavour', fr: 'Toujours ajouter après cuisson — la chaleur détruit le gras et la saveur' },
    qtyPerPizza: { amount: 50, unit: 'g', noteEN: '4–5 slices', noteFR: '4–5 tranches' },
    hardToFind: true,
    goodEnough: { name: { en: 'Jamón Serrano', fr: 'Jamón Serrano' } },
    compromise: { name: { en: 'Good Prosciutto di Parma', fr: 'Bon Prosciutto di Parma' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace', 'Cold Storage'], note: "Jamón Serrano widely available — Ibérico at Ryan's and Culina" },
      france:    { shops: ['Carrefour', 'Monoprix', 'charcuteries espagnoles', 'Grand Frais'], note: 'Jamón Serrano in all supermarkets; Ibérico at specialty delis' },
      us:        { shops: ['Whole Foods', "Trader Joe's (Serrano)", 'Spanish specialty stores'], online: ['La Tienda', 'Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'any major supermarket'] },
      australia: { shops: ['Harris Farm', 'Spanish delis', 'Woolworths (Serrano)'] },
    },
  },

  sobrasada: {
    id: 'sobrasada', category: 'meat', bakeOrder: 'before',
    name: { en: 'Sobrasada (Mallorcan sausage)', fr: 'Sobrasada (saucisse majorquine)' },
    prepNote: { en: 'Crumble or spread in small pieces — it melts into the dough', fr: 'Émietter ou déposer en petits morceaux — elle fond dans la pâte' },
    qtyPerPizza: { amount: 50, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Nduja — similar spreadable spicy format', fr: 'Nduja — format tartinable épicé similaire' } },
    compromise: { name: { en: 'Chorizo paste crumbled', fr: 'Pâte de chorizo émiettée' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery (call ahead)", 'Culina'], note: "Rare — Nduja is the most widely available substitute" },
      france:    { shops: ['Épiceries espagnoles', 'Grand Frais', 'La Grande Épicerie'], note: 'Available in Spanish specialty shops and some Grand Frais locations' },
      us:        { shops: ['Spanish specialty stores', 'La Tienda'], online: ['La Tienda', 'Amazon'] },
      uk:        { shops: ['Brindisa (London)', 'Spanish delis'], online: ['Brindisa online'] },
    },
  },

  misoPaste: {
    id: 'miso_paste', category: 'sauce', bakeOrder: 'before',
    name: { en: 'White miso paste (base)', fr: 'Pâte miso blanc (base)' },
    prepNote: { en: 'Mix with a little cream or olive oil to thin before spreading', fr: "Diluer avec un peu de crème ou huile d'olive avant d'étaler", timing: 5 },
    qtyPerPizza: { amount: 2, unit: 'tbsp' },
    hardToFind: false,
    localSwap: {
      singapore: { name: { en: 'Shiro miso at Meidi-Ya, Don Don Donki or any Japanese supermarket', fr: 'Miso blanc chez Meidi-Ya, Don Don Donki ou tout supermarché japonais' } },
    },
    goodEnough: {
      name: { en: 'White or yellow miso paste (shiro or shinshu)', fr: 'Pâte de miso blanc ou jaune (shiro ou shinshu)' },
      note: { en: 'Any white or yellow miso works — milder and sweeter than red. Thin with cream or olive oil before spreading.', fr: "Tout miso blanc ou jaune convient — plus doux et sucré que le rouge. Diluer avec crème ou huile avant d'étaler." },
    },
    compromise: {
      name: { en: 'Tahini thinned with soy sauce and sesame oil', fr: 'Tahini dilué avec sauce soja et huile de sésame' },
      note: { en: 'Mix 2 tbsp tahini + 1 tbsp soy + a few drops toasted sesame oil. Different but gives similar deep umami.', fr: "Mélanger 2 cs tahini + 1 cs soja + quelques gouttes d'huile de sésame. Différent mais profondeur umami similaire." },
    },
    whereToFind: {
      singapore: { shops: ['Meidi-Ya', 'Don Don Donki', 'Isetan B2', 'any Japanese supermarket'], online: ['RedMart'], note: 'Shiro (white) miso — abundant in Singapore. Any Japanese supermarket' },
      france:    { shops: ['Naturalia', "Bio c'Bon", 'Asian supermarkets', 'Monoprix (some)'], online: ['Amazon FR'], note: 'Miso blanc in organic and Asian grocery stores' },
      us:        { shops: ['Whole Foods', 'any Asian grocery store', "Trader Joe's (white miso)"], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Japan Centre', 'Asian supermarkets'], online: ['Ocado', 'Japan Centre online'] },
      australia: { shops: ['Asian grocery stores', 'Woolworths (some)', 'Harris Farm'], note: 'Any Japanese or Asian grocery — white miso widely available' },
    },
  },

  mentaiko: {
    id: 'mentaiko', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Mentaiko (spicy pollock roe)', fr: 'Mentaiko (œufs de lieu épicés)' },
    prepNote: { en: 'Mix with cream or mayo — spread as base or drizzle after baking', fr: 'Mélanger avec crème ou mayo — étaler en base ou verser après cuisson', timing: 5 },
    qtyPerPizza: { amount: 40, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Ikura (salmon roe) added after baking', fr: 'Ikura (œufs de saumon) ajouté après cuisson' } },
    localSwap: {
      singapore: { name: { en: 'Mentaiko at Don Don Donki, Meidi-Ya or Isetan supermarket', fr: 'Mentaiko chez Don Don Donki, Meidi-Ya ou Isetan' } },
    },
    whereToFind: {
      singapore: { shops: ['Don Don Donki', 'Meidi-Ya', 'Isetan supermarket'], note: 'Fresh mentaiko in the seafood/deli section — Don Don Donki most reliable and affordable' },
      us:        { shops: ['Japanese grocery stores', 'Mitsuwa', 'Nijiya Market'], online: ['Amazon (frozen)', 'Weee! grocery'] },
      australia: { shops: ['Japanese grocery stores', 'Fuji Mart', 'Tokyo Mart'], note: 'Japanese specialty grocery stores — major cities only' },
    },
  },

  vodkaCream: {
    id: 'vodka_cream', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Vodka tomato cream sauce', fr: 'Sauce tomate crémée à la vodka' },
    prepNote: { en: "Simmer tomato + cream + splash vodka until thickened — sauce should coat a spoon", fr: "Mijoter tomate + crème + trait de vodka jusqu'à épaississement — la sauce doit napper une cuillère", timing: 25 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Cooked tomato sauce + tablespoon of cream', fr: 'Sauce tomate cuite + cuillère à soupe de crème' } },
  },

  lardo: {
    id: 'lardo', category: 'meat', bakeOrder: 'after',
    name: { en: 'Lardo di Colonnata', fr: 'Lardo di Colonnata' },
    prepNote: { en: 'Add immediately after baking — it melts on the hot pizza', fr: 'Ajouter immédiatement après cuisson — il fond sur la pizza chaude' },
    prepNoteByStyle: {
      neapolitan: { en: 'Add in the last 20–30 seconds of baking — at 450°C the pizza is so hot it melts lardo instantly even after the oven. Either way works.', fr: 'Ajouter les 20–30 dernières secondes de cuisson — à 450°C la pizza est si chaude qu\'elle fait fondre le lardo instantanément même après le four.', timing: 0 },
    },
    qtyPerPizza: { amount: 40, unit: 'g', noteEN: '4–6 thin slices', noteFR: '4–6 tranches fines' },
    hardToFind: true,
    goodEnough: { name: { en: 'Any quality lard or fatback, sliced paper-thin', fr: 'Lard de qualité tranché très finement' } },
    whereToFind: {
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'specialist charcuteries'], note: 'Rare even in France — Lardo di Colonnata DOP from Italian delis' },
      us:        { shops: ['Eataly', 'specialty Italian stores'], online: ['Di Bruno Bros', 'Formaggio Kitchen'], note: 'Online ordering most reliable outside major cities' },
      uk:        { shops: ['Lina Stores', 'Natoora', 'Borough Market'], note: 'Specialist only — worth finding for the right pizza' },
    },
  },

  stracchino: {
    id: 'stracchino', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Stracchino (crescenza)', fr: 'Stracchino (crescenza)' },
    prepNote: { en: 'Dollop cold over pizza before the last 2 minutes of baking', fr: 'Déposer froid sur la pizza pendant les 2 dernières minutes de cuisson' },
    prepNoteByStyle: {
      neapolitan: { en: 'Add after baking only — 450°C will burn it instantly. Dollop while the pizza is still hot.', fr: 'Ajouter après cuisson uniquement — 450°C le brûlerait instantanément. Déposer pendant que la pizza est encore chaude.', timing: 0 },
      sourdough:  { en: 'Add after baking — high heat burns stracchino. Dollop on the hot pizza.', fr: 'Ajouter après cuisson — la chaleur brûle le stracchino. Déposer sur la pizza chaude.', timing: 0 },
    },
    qtyPerPizza: { amount: 80, unit: 'g' },
    hardToFind: true,
    goodEnough: { name: { en: 'Taleggio — similar soft melting character', fr: 'Taleggio — même caractère fondant doux' } },
    compromise: { name: { en: 'Brie centre without rind + squeeze of lemon', fr: 'Intérieur de brie sans croûte + trait de citron' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina'], note: 'Very rare — call ahead. Taleggio is the best substitute if unavailable' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie'], note: 'Rare outside Italian speciality shops — crescenza is the same cheese' },
      uk:        { shops: ['Lina Stores', 'Gelupo', 'specialist Italian delis'], note: 'Not found in supermarkets — Italian delis only' },
    },
  },

  bresaola: {
    id: 'bresaola', category: 'meat', bakeOrder: 'after',
    name: { en: 'Bresaola (cured beef)', fr: 'Bresaola (bœuf séché)' },
    prepNote: { en: 'Always add after baking — drape over warm pizza', fr: 'Toujours ajouter après cuisson — disposer sur la pizza chaude' },
    qtyPerPizza: { amount: 50, unit: 'g', noteEN: '5–6 slices', noteFR: '5–6 tranches' },
    hardToFind: true,
    goodEnough: { name: { en: 'Thinly sliced roast beef', fr: 'Bœuf rôti tranché finement' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: 'Available at specialty delis — call ahead' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'La Grande Épicerie', 'Monoprix (some)'] },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's", 'Italian delis'], online: ['Ocado'] },
    },
  },

  octopus: {
    id: 'octopus', category: 'seafood', bakeOrder: 'before',
    name: { en: 'Octopus (cooked, sliced)', fr: 'Poulpe (cuit, tranché)' },
    prepNote: { en: 'Must be pre-cooked tender before adding — raw octopus will not cook through on pizza', fr: "Doit être précuit et tendre avant d'ajouter — le poulpe cru ne cuira pas assez sur la pizza", timing: 60 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    hardToFind: false,
    goodEnough: { name: { en: 'Calamari rings (pre-cooked)', fr: 'Rondelles de calamar (précuites)' } },
  },

  smokedPaprika: {
    id: 'smoked_paprika', category: 'spice', bakeOrder: 'before',
    name: { en: 'Smoked paprika', fr: 'Paprika fumé' },
    prepNote: { en: 'Sprinkle before baking', fr: 'Saupoudrer avant cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
    isCommonPantry: true,
  },

  springOnion: {
    id: 'spring_onion', category: 'veg', bakeOrder: 'after',
    name: { en: 'Spring onion (sliced)', fr: 'Ciboule (émincée)' },
    prepNote: { en: 'Add after baking for freshness', fr: 'Ajouter après cuisson pour la fraîcheur' },
    qtyPerPizza: { amount: 2, unit: 'tbsp' },
    isCommonPantry: true,
  },

  teriyakiSauce: {
    id: 'teriyaki_sauce', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Teriyaki sauce', fr: 'Sauce teriyaki' },
    prepNote: { en: 'Spread thin — sweet, reduces quickly in the oven', fr: 'Étaler finement — sucré, réduit rapidement au four' },
    qtyPerPizza: { amount: 3, unit: 'tbsp' },
    isCommonPantry: false,
    goodEnough: {
      name: { en: 'Homemade teriyaki: soy + mirin + sugar + sake', fr: 'Teriyaki maison : sauce soja + mirin + sucre + saké' },
      note: { en: 'Simmer 2 tbsp soy + 1 tbsp mirin + 1 tsp sugar + 1 tbsp sake until slightly thickened. Better than most bottles.', fr: "Mijoter 2 cs de sauce soja + 1 cs de mirin + 1 cc de sucre + 1 cs de saké jusqu'à légèrement épaississement." },
    },
    compromise: {
      name: { en: 'Hoisin sauce (thinned with soy)', fr: 'Sauce hoisin (diluée avec soja)' },
      note: { en: 'Mix 1 tbsp hoisin + 1 tsp soy. Sweeter and more complex but gives similar sticky umami quality.', fr: 'Mélanger 1 cs de hoisin + 1 cc de soja. Plus sucré et complexe mais donne une qualité umami collante similaire.' },
    },
  },

  kimchi: {
    id: 'kimchi', category: 'veg', bakeOrder: 'after',
    name: { en: 'Kimchi', fr: 'Kimchi' },
    prepNote: { en: 'Add after baking — cooking kimchi loses its probiotic character and becomes too sour', fr: 'Ajouter après cuisson — cuire le kimchi perd son caractère probiotique et devient trop acide' },
    qtyPerPizza: { amount: 60, unit: 'g' },
    localSwap: {
      singapore: { name: { en: 'Korean kimchi widely available at NTUC FairPrice, Don Don Donki', fr: 'Kimchi coréen disponible chez NTUC FairPrice, Don Don Donki' } },
    },
    goodEnough: {
      name: { en: 'Store-bought kimchi (any Korean brand)', fr: 'Kimchi du commerce (toute marque coréenne)' },
      note: { en: 'Any kimchi works — drain excess brine before adding. Available in Asian supermarkets everywhere.', fr: "Tout kimchi convient — égoutter l'excès de saumure avant d'ajouter. Disponible dans tous les supermarchés asiatiques." },
    },
    compromise: {
      name: { en: 'Quick-pickled napa cabbage with gochugaru', fr: 'Chou de Pékin rapidement mariné avec gochugaru' },
      note: { en: 'Slice cabbage thin, toss with rice vinegar, gochugaru, garlic and salt. Rest 30 min. Not fermented but punchy.', fr: 'Trancher finement le chou, mélanger avec vinaigre de riz, gochugaru, ail et sel. Reposer 30 min. Pas fermenté mais incisif.' },
    },
    whereToFind: {
      singapore: { shops: ['NTUC FairPrice', 'Don Don Donki', 'Cold Storage', 'Korean grocery stores'], online: ['RedMart'] },
      france:    { shops: ['Épiceries coréennes et asiatiques', 'K-Market', 'Tang Frères'], online: ['Amazon FR'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Korean grocery stores (H-Mart)', 'any major grocery'], online: ['Amazon', 'Weee!'] },
      uk:        { shops: ["Sainsbury's", 'Waitrose', 'Korean grocery stores', 'Wing Yip'], online: ['Ocado'] },
      australia: { shops: ['Woolworths', 'Coles (some)', 'Korean grocery stores', 'Asian supermarkets'] },
    },
  },

  bulgogi: {
    id: 'bulgogi', category: 'meat', bakeOrder: 'before',
    name: { en: 'Bulgogi (Korean BBQ beef)', fr: 'Bulgogi (bœuf BBQ coréen)' },
    prepNote: { en: "Pre-marinate and cook beef before adding — it won't cook through on pizza", fr: "Pré-mariner et cuire le bœuf avant d'ajouter — il ne cuira pas assez sur la pizza", timing: 45 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Thinly sliced beef with soy-sesame marinade', fr: 'Bœuf tranché finement avec marinade soja-sésame' } },
  },

  sesameOil: {
    id: 'sesame_oil', category: 'finish', bakeOrder: 'after',
    name: { en: 'Sesame oil (drizzle)', fr: 'Huile de sésame (filet)' },
    prepNote: { en: 'A few drops after baking — use toasted sesame oil only', fr: "Quelques gouttes après cuisson — utiliser uniquement de l'huile de sésame grillée" },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  nori: {
    id: 'nori', category: 'finish', bakeOrder: 'after',
    name: { en: 'Nori (toasted seaweed)', fr: 'Nori (algue grillée)' },
    prepNote: { en: 'Crumble or cut in strips — add after baking', fr: 'Émietter ou couper en lanières — ajouter après cuisson' },
    qtyPerPizza: { amount: 1, unit: 'tbsp' },
  },

  wasabiCream: {
    id: 'wasabi_cream', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Wasabi cream base', fr: 'Base crème wasabi' },
    prepNote: { en: 'Mix crème fraîche 30%+ + wasabi paste to taste — spread thin', fr: 'Mélanger crème fraîche 30%+ + pâte wasabi — étaler finement', timing: 5 },
    qtyPerPizza: { amount: 60, unit: 'g' },
    goodEnough: {
      name: { en: 'Wasabi paste + crème fraîche (mix yourself)', fr: 'Pâte de wasabi + crème fraîche (à mélanger)' },
      note: { en: 'Mix 1 tsp wasabi paste into 3 tbsp crème fraîche or cream cheese. Adjust heat to taste.', fr: 'Mélanger 1 cc de pâte de wasabi dans 3 cs de crème fraîche ou fromage frais. Ajuster le piquant selon le goût.' },
    },
    compromise: {
      name: { en: 'Horseradish cream + cream cheese', fr: 'Crème de raifort + fromage frais' },
      note: { en: 'Similar pungent heat, different flavour. Mix equal parts. Works especially well with smoked salmon and dill.', fr: 'Chaleur piquante similaire, saveur différente. Mélanger à parts égales. Particulièrement bien avec saumon fumé et aneth.' },
    },
  },

  duckConfit: {
    id: 'duck_confit', category: 'meat', bakeOrder: 'before',
    name: { en: 'Duck confit (shredded)', fr: 'Confit de canard (effiloché)' },
    prepNote: { en: "Shred and remove excess fat before adding", fr: "Effilocher et retirer l'excès de gras avant d'ajouter", timing: 10 },
    qtyPerPizza: { amount: 80, unit: 'g' },
    hardToFind: false,
    compromise: { name: { en: 'Slow-cooked duck leg, shredded', fr: 'Cuisse de canard mijotée, effilochée' } },
    goodEnough: {
      name: { en: 'Duck leg confit (jarred or vacuum-packed)', fr: 'Cuisse de canard confite (en bocal ou sous vide)' },
      note: { en: 'The jarred/vacuum version is widely available and excellent. Remove skin and shred the meat while warm.', fr: 'La version en bocal ou sous vide est largement disponible et excellente. Retirer la peau et effilocher la viande encore chaude.' },
    },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace', 'Cold Storage (jarred)'], note: 'Jarred duck confit (Maison Montfort or similar) in the specialty/French section' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'any supermarket'], note: 'Confit de canard en bocal — essential French pantry item, in every supermarket' },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado'], online: ['Ocado'], note: 'Duck confit pouches — Waitrose and M&S both stock reliably' },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'specialty delis', 'Woolworths Metro (some)'], note: 'Jarred or vacuum-packed confit — specialty delis most reliable' },
    },
  },

  foieGras: {
    id: 'foie_gras', category: 'meat', bakeOrder: 'after',
    name: { en: 'Foie gras (sliced)', fr: 'Foie gras (tranché)' },
    prepNote: { en: 'Add immediately after baking — it just needs to warm through', fr: 'Ajouter immédiatement après cuisson — il a juste besoin de se réchauffer' },
    qtyPerPizza: { amount: 40, unit: 'g' },
    hardToFind: true,
    compromise: { name: { en: 'Good duck liver pâté', fr: 'Bonne terrine de foie de canard' } },
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Fresh foie gras rare — bloc de foie gras (preserved) at Culina and Ryan's" },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'épiceries fines', 'Périgord speciality shops'], note: 'Foie gras de canard — standard supermarket item in France especially in southwest' },
      uk:        { shops: ['Selfridges Food Hall', 'Harvey Nichols', 'specialist delis'], note: 'Legal to sell in UK — Fortnum & Mason and Selfridges Food Hall carry it' },
    },
  },

  cookedHam: {
    id: 'cooked_ham', category: 'meat', bakeOrder: 'before',
    name: { en: 'Cooked ham', fr: 'Jambon cuit' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: {
      name: { en: 'Smoked ham', fr: 'Jambon fumé' },
      note: { en: 'Adds smokiness — works great', fr: 'Ajoute un goût fumé — très bien' },
    },
  },

  pineapple: {
    id: 'pineapple', category: 'veg', bakeOrder: 'before',
    name: { en: 'Pineapple chunks', fr: 'Morceaux d\'ananas' },
    qtyPerPizza: { amount: 100, unit: 'g', noteEN: 'Fresh or well-drained tinned', noteFR: 'Frais ou en conserve bien égoutté' },
    goodEnough: {
      name: { en: 'Tinned pineapple in juice (not syrup)', fr: 'Ananas en conserve au jus (pas au sirop)' },
      note: { en: 'Drain and pat dry well', fr: 'Bien égoutter et éponger' },
    },
    localSwap: {
      singapore: {
        name: { en: 'Fresh pineapple — widely available', fr: 'Ananas frais — très disponible' },
        brandExamples: { singapore: ['Fresh pineapple — any wet market or supermarket'] },
      },
    },
  },

}

// ─── Pizza database — 35 pizzas ──────────────────────────────
// 25 Italian/fusion + 10 French regional + 6 desserts
// All user-facing strings bilingual via Locale type

export const PIZZAS: Pizza[] = [

  // ── CLASSIC ITALIAN ──────────────────────────────────────

  {
    id: 'margherita',
    name: { en: 'Margherita', fr: 'Margherita' },
    story: { en: 'Tomato, fior di latte, fresh basil — Naples\' most iconic pizza, born 1889', fr: 'Tomate, fior di latte, basilic frais — la pizza la plus emblématique de Naples, née en 1889' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'kids', 'quick', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 1, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Falanghina · crisp white or sparkling', fr: 'Falanghina · blanc frais ou pétillant' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'marinara',
    name: { en: 'Marinara', fr: 'Marinara' },
    story: { en: 'The original — no cheese, just perfect tomato and garlic', fr: 'L\'originale — sans fromage, juste tomate et ail parfaits' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'vegan', 'dairy_free', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 1, prepMinutes: 3, ovenTemp: 'high',
    wine: ['cw'],
    flavour: { richness: 1, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.garlic, ING.oregano, ING.evoOil],
    wineNote: { en: 'Vermentino or crisp Pinot Grigio', fr: 'Vermentino ou Pinot Gris frais' },
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'diavola',
    name: { en: 'Diavola', fr: 'Diavola' },
    story: { en: 'Spicy salami, mozzarella, chilli oil — the devil\'s pizza with Calabrian heat', fr: 'Salami épicé, mozzarella, huile pimentée — la pizza du diable à la chaleur calabraise' },
    category: 'classic_italian', region: 'calabrian',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'spicy', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'fr'],
    flavour: { richness: 3, boldness: 5, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.spicySalami, ING.chilli, ING.evoOil],
    wineNote: { en: 'Primitivo or bold red', fr: 'Primitivo ou rouge puissant' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'quattro_formaggi',
    name: { en: '4 Formaggi', fr: '4 Fromages' },
    story: { en: 'Four cheeses — one extraordinary pizza', fr: 'Quatre fromages — une pizza extraordinaire' },
    category: 'classic_italian', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['fr', 'rw'],
    flavour: { richness: 5, boldness: 3, creative: 1, refined: 4 },
    ingredients: [ING.olioBase, ING.mozzarellaLM, ING.gorgonzola, ING.parmigiano, ING.taleggio, ING.blackPepper],
    wineNote: { en: 'Barolo or aged Chianti', fr: 'Barolo ou Chianti vieilli' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'capricciosa',
    name: { en: 'Capricciosa', fr: 'Capricciosa' },
    story: { en: 'Ham, mushrooms, artichoke, olives — loaded with Italian classics', fr: 'Jambon, champignons, artichaut, olives — garnie de classiques italiens' },
    category: 'classic_italian', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 1, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.fiordilatte, ING.mushrooms, ING.ham, ING.blackOlives, ING.artichoke, ING.evoOil],
    wineNote: { en: 'Chianti Classico · light red', fr: 'Chianti Classico · rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'napoli',
    name: { en: 'Napoli', fr: 'Napoli' },
    story: { en: 'Anchovies, capers, olives — the sea on a pizza', fr: 'Anchois, câpres, olives — la mer sur une pizza' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw'],
    flavour: { richness: 2, boldness: 4, creative: 1, refined: 3 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.anchovies, ING.capers, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Verdicchio or Fiano · crisp white', fr: 'Verdicchio ou Fiano · blanc frais' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  // ── MEAT ─────────────────────────────────────────────────

  {
    id: 'pepperoni',
    name: { en: 'Pepperoni', fr: 'Pepperoni' },
    story: { en: 'Pepperoni, mozzarella — America\'s favourite, crispy-cupped and irresistible', fr: 'Pepperoni, mozzarella — la préférée des Américains, croustillante et irrésistible' },
    category: 'fusion', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['kids', 'party', 'quick'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 3, creative: 1, refined: 1 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.pepperoni],
    wineNote: { en: 'Zinfandel or light red', fr: 'Zinfandel ou rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'nduja_mozzarella',
    name: { en: 'Nduja e Mozzarella', fr: 'Nduja & Mozzarella' },
    story: { en: '\'Nduja (fiery spreadable Calabrian salami), mozzarella — fire and cream on tomato', fr: '\'Nduja (salami calabrais épicé tartinable), mozzarella — feu et crème sur tomate' },
    category: 'meat', region: 'calabrian',
    base: 'tomato_raw', season: ['all'],
    occasion: ['spicy', 'impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['fr'],
    flavour: { richness: 4, boldness: 5, creative: 2, refined: 3 },
    ingredients: [ING.sanMarzano, ING.nduja, ING.fiordilatte, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Aglianico or bold Calabrian red', fr: 'Aglianico ou rouge calabrais puissant' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  // ── SEAFOOD ──────────────────────────────────────────────

  {
    id: 'tonno_cipolla',
    name: { en: 'Tonno e Cipolla', fr: 'Thon & Oignon' },
    story: { en: 'A southern Italian classic — tuna and sweet onion', fr: 'Un classique du Sud de l\'Italie — thon et oignon doux' },
    category: 'seafood', region: 'sicilian',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw'],
    flavour: { richness: 2, boldness: 3, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.tuna, ING.redOnion, ING.evoOil],
    wineNote: { en: 'Grillo or Sicilian white · crisp white', fr: 'Grillo ou blanc sicilien · blanc frais' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'smoked_salmon_creme',
    name: { en: 'Smoked Salmon & Crème Fraîche', fr: 'Saumon fumé & Crème fraîche' },
    story: { en: 'Parisian bistro energy — cool salmon on a warm pizza', fr: 'Énergie bistrot parisien — saumon frais sur pizza chaude' },
    category: 'seafood', region: 'normandie',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['sp', 'cw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.cremeFraiche, ING.fiordilatte, ING.smSalmon, ING.capers, ING.dill, ING.lemonWedge],
    wineNote: { en: 'Champagne or Chablis', fr: 'Champagne ou Chablis' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork'],
  },

  // ── VEGETABLE ────────────────────────────────────────────

  {
    id: 'ortolana',
    name: { en: 'Ortolana', fr: 'Ortolana' },
    story: { en: 'Grilled courgette, aubergine, peppers, tomato — the gardener\'s seasonal pizza', fr: 'Courgette grillée, aubergine, poivrons, tomate — la pizza du jardinier de saison' },
    category: 'veg',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'ro'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.fiordilatte, ING.aubergine, ING.courgette, ING.roastedPepper, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Bardolino or light red', fr: 'Bardolino ou rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'funghi_tartufo',
    name: { en: 'Funghi e Tartufo', fr: 'Champignons & Truffe' },
    story: { en: 'Earthy mushrooms elevated with truffle', fr: 'Champignons terreux sublimés à la truffe' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['fr', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 2, refined: 5 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.porcini, ING.mushrooms, ING.truffleOil, ING.evoOil],
    wineNote: { en: 'Burgundy or earthy full red', fr: 'Bourgogne rouge ou rouge terreux' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  // ── WHITE ────────────────────────────────────────────────

  {
    id: 'patate_rosmarino',
    name: { en: 'Patate e Rosmarino', fr: 'Pommes de terre & Romarin' },
    story: { en: 'Thin potato slices, rosemary, olive oil — Roman street food at its most satisfying', fr: 'Fines tranches de pomme de terre, romarin, huile d\'olive — la street food romaine dans toute sa générosité' },
    category: 'white', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'kids'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw'],
    flavour: { richness: 3, boldness: 1, creative: 1, refined: 2 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.thinPotato, ING.rosemary, ING.seaSalt, ING.evoOil],
    wineNote: { en: 'Frascati or Soave · crisp white', fr: 'Frascati ou Soave · blanc frais' },
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'bianca_ricotta_spinaci',
    name: { en: 'Bianca Ricotta e Spinaci', fr: 'Bianca Ricotta & Épinards' },
    story: { en: 'Creamy ricotta, wilted spinach, a hint of nutmeg', fr: 'Ricotta crémeuse, épinards fondants, pointe de noix de muscade' },
    category: 'white',
    base: 'bianca_ricotta', season: ['all'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.ricotta, ING.fiordilatte, ING.spinach, ING.evoOil],
    wineNote: { en: 'Pinot Grigio or Soave · crisp white', fr: 'Pinot Gris ou Soave · blanc frais' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'truffle_bianca',
    name: { en: 'Truffle Bianca', fr: 'Bianca Truffe' },
    story: { en: 'The showstopper — cream, truffle, and pure luxury', fr: 'Le clou du spectacle — crème, truffe et luxe absolu' },
    category: 'gourmet', region: 'roman',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['rw', 'fr'],
    flavour: { richness: 5, boldness: 3, creative: 3, refined: 5 },
    ingredients: [ING.cream35, ING.fiordilatte, ING.parmigianoShavings, ING.truffleOil],
    wineNote: { en: 'White Burgundy or aged Barolo', fr: 'Bourgogne blanc ou Barolo vieilli' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  // ── MODERN ───────────────────────────────────────────────

  {
    id: 'prosciutto_rucola',
    name: { en: 'Prosciutto e Rucola', fr: 'Prosciutto & Roquette' },
    story: { en: 'Cool rocket, warm pizza, silky prosciutto — a perfect contrast', fr: 'Roquette fraîche, pizza chaude, prosciutto soyeux — un contraste parfait' },
    category: 'modern', region: 'roman',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp', 'cw'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.prosciutto, ING.rocket, ING.parmigianoShavings, ING.evoOil],
    wineNote: { en: 'Prosecco or light Pinot Noir', fr: 'Prosecco ou Pinot Noir léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'burrata_prosciutto',
    name: { en: 'Burrata e Prosciutto', fr: 'Burrata & Prosciutto' },
    story: { en: 'Burrata, prosciutto crudo, tomato — two Italian masterpieces on one pizza', fr: 'Burrata, prosciutto crudo, tomate — deux chefs-d\'œuvre italiens sur une pizza' },
    category: 'modern',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp', 'cw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.burrata, ING.prosciutto, ING.rocket, ING.evoOil],
    wineNote: { en: 'Champagne or Franciacorta', fr: 'Champagne ou Franciacorta' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'fig_gorgonzola',
    name: { en: 'Fig & Gorgonzola', fr: 'Figue & Gorgonzola' },
    story: { en: 'Sweet figs, bold blue cheese — a perfect autumn combination', fr: 'Figues sucrées, fromage bleu puissant — une combinaison automnale parfaite' },
    category: 'modern',
    base: 'bianca_oil', season: ['summer', 'autumn'],
    occasion: ['impress'],
    dietary: ['veg', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 3, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'ro'],
    flavour: { richness: 4, boldness: 4, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.gorgonzola, ING.fig, ING.honey, ING.rocket, ING.evoOil],
    wineNote: { en: 'Sauternes or late-harvest Riesling', fr: 'Sauternes ou Riesling vendanges tardives' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'pear_walnut_gorgonzola',
    name: { en: 'Pear, Walnut & Gorgonzola', fr: 'Poire, Noix & Gorgonzola' },
    story: { en: 'Pear, walnut, gorgonzola (blue cheese), honey — a classic bistro combination on pizza', fr: 'Poire, noix, gorgonzola (fromage bleu), miel — un classique bistrot réinventé sur pizza' },
    category: 'modern', region: 'lyonnais',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'sp'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.gorgonzola, ING.pear, ING.walnuts, ING.honey, ING.evoOil],
    wineNote: { en: 'Monbazillac or rich white', fr: 'Monbazillac ou blanc riche' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  // ── FUSION ───────────────────────────────────────────────

  {
    id: 'bbq_chicken',
    name: { en: 'BBQ Chicken', fr: 'Poulet BBQ' },
    story: { en: 'BBQ chicken, red onion, mozzarella, BBQ sauce — smoky, sweet, crowd-pleasing', fr: 'Poulet BBQ, oignon rouge, mozzarella, sauce BBQ — fumé, sucré, apprécié de tous' },
    category: 'fusion', region: 'american',
    base: 'bbq', season: ['all'],
    occasion: ['kids', 'party'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 1 },
    ingredients: [ING.bbqSauce, ING.mozzarellaLM, ING.grilledChicken, ING.redOnion, ING.sweetcorn, ING.freshCoriander],
    wineNote: { en: 'Off-dry Riesling or light red', fr: 'Riesling demi-sec ou rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'newyork', 'pan'],
  },

  // ── GOURMET ──────────────────────────────────────────────

  {
    id: 'speck_brie',
    name: { en: 'Speck & Brie', fr: 'Speck & Brie' },
    story: { en: 'Alpine speck meets French brie — a mountain pizza', fr: 'Speck alpin rencontre le brie français — une pizza de montagne' },
    category: 'gourmet',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['no_fish'],
    budget: 3, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'lr'],
    flavour: { richness: 5, boldness: 3, creative: 4, refined: 5 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.brie, ING.speck, ING.honey, ING.walnuts, ING.evoOil],
    wineNote: { en: 'Alsatian Pinot Gris or light Beaujolais', fr: 'Pinot Gris d\'Alsace ou Beaujolais léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  // ── FRENCH REGIONAL ──────────────────────────────────────

  {
    id: 'tarte_flambee',
    name: { en: 'Tarte Flambée', fr: 'Tarte Flambée' },
    story: { en: 'Crème fraîche, smoked lardons, onion — Alsace\'s answer to pizza on thin crispy dough', fr: 'Crème fraîche, lardons fumés, oignon — le monument alsacien sur pâte fine et croustillante' },
    category: 'french_regional', region: 'alsace',
    base: 'bianca_cream', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 1, prepMinutes: 10, ovenTemp: 'high',
    wine: ['rw', 'cw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.fromageBlancBase, ING.cremeFraiche, ING.smokedLardons, ING.redOnion],
    wineNote: { en: 'Alsatian Riesling or Pinot Gris · rich white', fr: 'Riesling alsacien ou Pinot Gris · blanc riche' },
    compatibleStyles: ['neapolitan', 'pizza_romana'],
  },

  {
    id: 'raclette_pommes',
    name: { en: 'Raclette & Pommes de Terre', fr: 'Raclette & Pommes de Terre' },
    story: { en: 'Raclette (melted mountain cheese), potato, smoked lardons — pure Savoie winter comfort', fr: 'Raclette (fromage de montagne fondu), pomme de terre, lardons fumés — pur réconfort savoyard' },
    category: 'french_regional', region: 'savoie',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.raclette, ING.thinPotato, ING.smokedLardons, ING.cornichons, ING.freshChives],
    wineNote: { en: 'Chignin or Apremont · crisp Savoie white', fr: 'Chignin ou Apremont · blanc de Savoie frais' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'chevre_miel',
    name: { en: 'Chèvre & Miel', fr: 'Chèvre & Miel' },
    story: { en: 'Provence sun — goat cheese, honey and thyme', fr: 'Soleil provençal — chèvre, miel et thym' },
    category: 'french_regional', region: 'provence',
    base: 'bianca_oil', season: ['spring', 'summer'],
    occasion: ['impress'],
    dietary: ['veg', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'ro'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.olioBase, ING.chevreFrais, ING.fiordilatte, ING.freshThyme, ING.walnuts, ING.honey, ING.evoOil],
    wineNote: { en: 'Sancerre or Provence rosé', fr: 'Sancerre ou rosé de Provence' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'andouille_moutarde',
    name: { en: 'Andouille & Moutarde', fr: 'Andouille & Moutarde' },
    story: { en: 'Andouille (smoked pork sausage), mustard, crème fraîche — bold and unmistakably Breton', fr: 'Andouille (saucisse de porc fumée), moutarde, crème fraîche — puissant et inimitable de Bretagne' },
    category: 'french_regional', region: 'bretagne',
    base: 'other', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 1, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr', 'cw'],
    flavour: { richness: 4, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.dijonMustard, ING.emmental, ING.andouille, ING.redOnion, ING.evoOil],
    wineNote: { en: 'Muscadet or light red', fr: 'Muscadet ou rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'maroilles_oignons',
    name: { en: 'Maroilles & Caramelised Onion', fr: 'Maroilles & Oignons Caramélisés' },
    story: { en: 'Maroilles (strong washed-rind cheese), caramelised onion, crème fraîche — bold northern France', fr: 'Maroilles (fromage à croûte lavée puissant), oignon caramélisé, crème fraîche — généreux du Nord' },
    category: 'french_regional', region: 'nord',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish'],
    budget: 2, complexity: 2, prepMinutes: 30, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 5, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.olioBase, ING.maroilles, ING.caramelisedOnion, ING.freshThyme, ING.blackPepper],
    wineNote: { en: 'Côtes du Rhône or rich white', fr: 'Côtes du Rhône ou blanc riche' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'jambon_espelette',
    name: { en: 'Jambon de Bayonne & Espelette', fr: 'Jambon de Bayonne & Piment d\'Espelette' },
    story: { en: 'Basque country on a pizza — gentle heat, world-class ham', fr: 'Le Pays Basque sur une pizza — piment doux, jambon d\'exception' },
    category: 'french_regional', region: 'basque',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.bayonneHam, ING.espelettePepper, ING.evoOil],
    wineNote: { en: 'Irouléguy or Basque rosé', fr: 'Irouléguy ou rosé basque' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'camembert_pommes',
    name: { en: 'Camembert & Apple', fr: 'Camembert & Pommes' },
    story: { en: 'Camembert, apple, smoked lardons, cider reduction — Normandy\'s finest on pizza', fr: 'Camembert, pomme, lardons fumés, réduction de cidre — le meilleur de Normandie sur pizza' },
    category: 'french_regional', region: 'normandie',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_fish'],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['sp', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.camembert, ING.caramelisedApple, ING.walnuts, ING.honey, ING.ciderReduction],
    wineNote: { en: 'Normandy cider or sparkling', fr: 'Cidre de Normandie ou pétillant' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'tartiflette_pizza',
    name: { en: 'Tartiflette Pizza', fr: 'Pizza Tartiflette' },
    story: { en: 'Reblochon (soft mountain cheese), potato, smoked lardons, onion — Savoie\'s most indulgent dish on pizza', fr: 'Reblochon, pomme de terre, lardons fumés, oignon — le plat le plus gourmand de Savoie sur pizza' },
    category: 'french_regional', region: 'savoie',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 5, boldness: 3, creative: 3, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.reblochon, ING.thinPotato, ING.smokedLardons, ING.redOnion, ING.blackPepper],
    wineNote: { en: 'Roussette de Savoie · crisp alpine white', fr: 'Roussette de Savoie · blanc alpin frais' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'la_reine',
    name: { en: 'La Reine', fr: 'La Reine' },
    story: { en: 'The classic French bistro pizza — ham, mushrooms, olives', fr: 'La classique des pizzerias françaises — jambon, champignons, olives' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'kids', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.mushrooms, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes du Rhône or rosé', fr: 'Côtes du Rhône ou rosé' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'la_royale',
    name: { en: 'La Royale', fr: 'La Royale' },
    story: { en: 'Ham + salami + peppers — the generously topped French classic', fr: 'Jambon + salami + poivrons — la classique bien garnie' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 1, prepMinutes: 10, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 3, boldness: 3, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.salami, ING.mixedPeppers, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes du Rhône or Languedoc red', fr: 'Côtes du Rhône ou rouge du Languedoc' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'la_paysanne',
    name: { en: 'La Paysanne', fr: 'La Paysanne' },
    story: { en: 'Rustic farmhouse pizza — lardons, potatoes, crème fraîche', fr: 'La pizza paysanne — lardons, pommes de terre, crème fraîche' },
    category: 'french_regional', region: 'lyonnais',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'lr'],
    flavour: { richness: 4, boldness: 2, creative: 2, refined: 2 },
    ingredients: [ING.cremeFraiche, ING.fiordilatte, ING.smokedLardons, ING.thinPotato, ING.redOnion, ING.freshChives],
    wineNote: { en: 'Mâcon white or light Burgundy red', fr: 'Mâcon blanc ou Bourgogne rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'quatre_saisons',
    name: { en: 'Quatre Saisons', fr: 'Quatre Saisons' },
    story: { en: 'Four quarters, four toppings — artichoke, ham, olives, mushrooms', fr: 'Quatre quarts, quatre garnitures — artichaut, jambon, olives, champignons' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['lr', 'ro', 'cw'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 3 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.mushrooms, ING.artichoke, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes de Provence rosé or light red', fr: 'Rosé Côtes de Provence ou rouge léger' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork', 'pan'],
  },

  {
    id: 'margherita_sbagliata',
    name: { en: 'Margherita Sbagliata', fr: 'Margherita Sbagliata' },
    story: { en: 'Fior di latte on base, fresh tomato added after baking — Franco Pepe\'s iconic inversion of the Margherita', fr: 'Fior di latte à la base, tomate fraîche ajoutée après cuisson — l\'inversion iconique de Franco Pepe' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.fiordilatte, ING.sanMarzano, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'cosacca',
    name: { en: 'Cosacca', fr: 'Cosacca' },
    story: { en: "Ancient Naples — tomato and pecorino only, no mozzarella. The purist's pizza.", fr: 'Naples ancienne — tomate et pecorino seuls, sans mozzarella. La pizza du puriste.' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 3, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 1, boldness: 2, creative: 1, refined: 3 },
    ingredients: [ING.sanMarzano, ING.pecorinoRomano, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'salsiccia_friarielli',
    name: { en: 'Salsiccia e Friarielli', fr: 'Saucisse et Friarielli' },
    story: { en: 'Italian pork sausage, friarielli (broccoli rabe), fior di latte — Naples\' most loved pizza after Margherita', fr: 'Saucisse de porc italienne, friarielli (brocoli-rave), fior di latte — la pizza napolitaine la plus aimée après la Margherita' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 3 },
    ingredients: [ING.fiordilatte, ING.salsiccia, ING.friarielli, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'provola_pepe',
    name: { en: 'Provola e Pepe', fr: 'Provola et Poivre' },
    story: { en: 'Naples simplicity at its best — smoked provola and cracked black pepper', fr: 'La simplicité napolitaine dans toute sa splendeur — provola fumée et poivre concassé' },
    category: 'white', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.smokedProvola, ING.blackPepper, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'acciughe_pomodorini',
    name: { en: 'Acciughe e Pomodorini', fr: 'Anchois et Tomates Cerises' },
    story: { en: 'Salty anchovies, sweet cherry tomatoes — the Neapolitan sea on pizza', fr: 'Anchois salés, tomates cerises sucrées — la mer napolitaine sur la pizza' },
    category: 'seafood', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 3, creative: 2, refined: 3 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.anchovies, ING.capers, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'melanzane_parmigiana',
    name: { en: 'Melanzane alla Parmigiana', fr: 'Aubergine à la Parmigiana' },
    story: { en: 'Aubergine, tomato, parmesan, basil — the beloved Southern Italian comfort dish on pizza', fr: 'Aubergine, tomate, parmesan, basilic — le grand classique du Sud de l\'Italie réinterprété en pizza' },
    category: 'veg', region: 'sicilian',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 3, prepMinutes: 30, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.marinaraSauce, ING.aubergine, ING.fiordilatte, ING.parmigianoShavings, ING.freshBasil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'zucca_provola',
    name: { en: 'Zucca e Provola', fr: 'Courge et Provola' },
    story: { en: 'Autumn in Naples — sweet pumpkin and smoky provola on white base', fr: "L'automne à Naples — courge douce et provola fumée sur base blanche" },
    category: 'veg', region: 'neapolitan',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.smokedProvola, ING.roastedPepper, ING.rosemary, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'boscaiola',
    name: { en: 'Boscaiola', fr: 'Boscaiola' },
    story: { en: 'Forest pizza — mushrooms, sausage and tomato from the Italian woodland tradition', fr: 'Pizza de la forêt — champignons, saucisse et tomate de la tradition italienne des bois' },
    category: 'meat', region: 'neapolitan',
    base: 'tomato_cooked', season: ['autumn', 'winter'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.mushrooms, ING.salsiccia, ING.freshThyme],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'bismarck',
    name: { en: 'Bismarck', fr: 'Bismarck' },
    story: { en: 'The egg pizza — a classic Italian tradition named for the German chancellor', fr: "La pizza à l'œuf — une tradition italienne classique nommée d'après le chancelier allemand" },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.ham, ING.egg],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'pugliese',
    name: { en: 'Pugliese', fr: 'Pouilles' },
    story: { en: 'Olives, capers, red onion, tomato — from the heel of Italy\'s boot', fr: 'Olives, câpres, oignon rouge, tomate — du talon de la botte italienne' },
    category: 'classic_italian', region: 'sicilian',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 2, boldness: 3, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.mozzarellaLM, ING.redOnion, ING.blackOlives, ING.capers, ING.oregano],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'prosciutto_funghi',
    name: { en: 'Prosciutto e Funghi', fr: 'Jambon et Champignons' },
    story: { en: 'The Italian bistro classic — ham and mushrooms, simple and always right', fr: 'Le classique du bistrot italien — jambon et champignons, simple et toujours juste' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'quick'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'cw'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.ham, ING.mushrooms],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'tonno_cipolla_red',
    name: { en: 'Tonno e Cipolla Rossa', fr: 'Thon et Oignon Rouge' },
    story: { en: 'Mediterranean classic — tuna and sweet red onion on tomato base', fr: 'Classique méditerranéen — thon et oignon rouge doux sur base tomate' },
    category: 'seafood', region: 'neapolitan',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.tuna, ING.redOnion, ING.capers],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'piennolo',
    name: { en: 'Piennolo', fr: 'Piennolo' },
    story: { en: 'Vesuvian cherry tomatoes only — a celebration of the finest tomato in Italy', fr: "Tomates cerises du Vésuve uniquement — une célébration de la meilleure tomate d'Italie" },
    category: 'veg', region: 'neapolitan',
    base: 'bianca_oil', season: ['summer'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'vegan', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 1, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.sanMarzano, ING.garlic, ING.oregano, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'funghi_salsiccia',
    name: { en: 'Funghi e Salsiccia', fr: 'Champignons et Saucisse' },
    story: { en: 'A Neapolitan comfort combination — earthy mushrooms and fennel sausage', fr: 'Une combinaison napolitaine réconfortante — champignons terreux et saucisse au fenouil' },
    category: 'meat', region: 'neapolitan',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.mushrooms, ING.salsiccia],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'salmone_rucola',
    name: { en: 'Salmone e Rucola', fr: 'Saumon et Roquette' },
    story: { en: 'Cold smoked salmon on a warm white base — a modern Italian staple', fr: 'Saumon fumé froid sur base blanche chaude — un classique moderne de la table italienne' },
    category: 'seafood', region: 'neapolitan',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.smSalmon, ING.rocket, ING.dill, ING.lemonWedge],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'acciughe_burro',
    name: { en: 'Acciughe e Burro', fr: 'Anchois et Beurre' },
    story: { en: 'Milan-Neapolitan crossover — salty anchovies on a butter-enriched white base', fr: 'Croisement Milan-Naples — anchois salés sur base blanche au beurre' },
    category: 'seafood', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 4 },
    ingredients: [ING.fiordilatte, ING.anchovies, ING.capers, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'pollo_pesto',
    name: { en: 'Pollo e Pesto', fr: 'Poulet et Pesto' },
    story: { en: 'Grilled chicken on a fragrant basil pesto base — a crowd-pleasing classic', fr: 'Poulet grillé sur base de pesto au basilic parfumé — un classique apprécié de tous' },
    category: 'meat', region: 'ligurian',
    base: 'pesto', season: ['all'],
    occasion: ['classic', 'kids', 'quick'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 2 },
    ingredients: [ING.pesto, ING.mozzarellaLM, ING.grilledChicken, ING.rocket, ING.parmigianoShavings],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'newyork'],
  },

  {
    id: 'genovese',
    name: { en: 'Genovese', fr: 'Génoise' },
    story: { en: 'Ligurian soul — pesto with potato and green beans, a triumvirate of flavour', fr: 'Âme ligure — pesto avec pomme de terre et haricots verts, un trio de saveurs' },
    category: 'veg', region: 'ligurian',
    base: 'pesto', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['veg', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.pesto, ING.mozzarellaLM, ING.thinPotato, ING.spinach, ING.parmigianoShavings],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'polpette',
    name: { en: 'Polpette', fr: 'Boulettes' },
    story: { en: 'Italian-American soul — meatballs on pizza, where two classics become one', fr: "Âme italo-américaine — boulettes sur pizza, là où deux classiques n'en font qu'un" },
    category: 'meat', region: 'neapolitan',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['kids', 'party', 'classic'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 1, complexity: 3, prepMinutes: 25, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.salsiccia, ING.freshBasil],
    compatibleStyles: ['neapolitan', 'sourdough', 'newyork'],
  },

  {
    id: 'diavola_burrata',
    name: { en: 'Diavola e Burrata', fr: 'Diavola et Burrata' },
    story: { en: 'Fire and cream — spicy salami tempered by cold creamy burrata after the oven', fr: 'Feu et crème — salami épicé tempéré par une burrata froide et crémeuse après le four' },
    category: 'meat', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress', 'spicy'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 4, creative: 3, refined: 4 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.spicySalami, ING.burrata, ING.freshBasil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },


  // ── Gourmet Neapolitan ──────────────────────────────────────

  {
    id: 'pistadella',
    name: { en: 'Pistadella', fr: 'Pistadella' },
    story: { en: 'Mortadella (Italian cold cut), pistachio pesto, fior di latte — Diego Vitagliano\'s global signature pizza', fr: 'Mortadelle (charcuterie italienne), pesto de pistaches, fior di latte — la signature mondiale de Diego Vitagliano' },
    category: 'gourmet', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.fiordilatte, ING.mortadella, ING.pistachiosPesto, ING.pistachiosTopped, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'stracciatella_datterini',
    name: { en: 'Stracciatella e Datterini', fr: 'Stracciatella et Tomates Datterini' },
    story: { en: 'Sweet datterini tomatoes, cold stracciatella added after — pure contrast', fr: 'Tomates datterini sucrées, stracciatella froide ajoutée après — pur contraste' },
    category: 'gourmet', region: 'neapolitan',
    base: 'tomato_raw', season: ['summer'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 4, refined: 5 },
    ingredients: [ING.sanMarzano, ING.stracciatella, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'nduja_burrata',
    name: { en: "'Nduja e Burrata", fr: "'Nduja et Burrata" },
    story: { en: '\'Nduja (fiery spreadable salami), burrata (creamy fresh cheese) — the ultimate hot-cold contrast', fr: '\'Nduja (salami tartinable ardent), burrata (fromage frais crémeux) — l\'ultime contraste chaud-froid' },
    category: 'gourmet', region: 'calabrian',
    base: 'nduja', season: ['all'],
    occasion: ['impress', 'spicy'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 5, creative: 4, refined: 4 },
    ingredients: [ING.nduja, ING.fiordilatte, ING.burrata, ING.freshBasil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'tartufo_fior',
    name: { en: 'Tartufo e Fior di Latte', fr: 'Truffe et Fior di Latte' },
    story: { en: 'The luxury Neapolitan — truffle oil over creamy fior di latte on a white base', fr: 'Le napolitain luxueux — huile de truffe sur fior di latte crémeux sur base blanche' },
    category: 'gourmet', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.fiordilatte, ING.truffleOil, ING.parmigianoShavings, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'lardo_rosmarino',
    name: { en: 'Lardo e Rosmarino', fr: 'Lardo et Romarin' },
    story: { en: 'Tuscan gourmet — Colonnata lard melts on the hot pizza with fresh rosemary', fr: 'Gastronomie toscane — le lard de Colonnata fond sur la pizza chaude avec du romarin frais' },
    category: 'gourmet', region: 'ligurian',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.fiordilatte, ING.lardo, ING.rosemary, ING.seaSalt, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'scarpetta',
    name: { en: 'Scarpetta', fr: 'Scarpetta' },
    story: { en: 'Pepe in Grani signature — buffalo mozz, Grana Padano fondue, tomato compote', fr: 'Signature de Pepe in Grani — mozz de bufala, fondue de Grana Padano, compote de tomate' },
    category: 'gourmet', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 3, complexity: 3, prepMinutes: 25, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.burrata, ING.parmigianoShavings, ING.sanMarzano, ING.pesto, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'caponata_pizza',
    name: { en: 'Caponata', fr: 'Caponata' },
    story: { en: 'Sicilian sweet-sour aubergine on pizza — agrodolce richness on a warm base', fr: 'Aubergine sicilienne aigre-douce sur pizza — richesse agrodolce sur une base chaude' },
    category: 'veg', region: 'sicilian',
    base: 'bianca_oil', season: ['summer', 'autumn'],
    occasion: ['impress', 'classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 3, prepMinutes: 30, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 3, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.aubergine, ING.blackOlives, ING.capers, ING.ricotta, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'soppressata_fichi',
    name: { en: 'Soppressata e Fichi', fr: 'Soppressata et Figues' },
    story: { en: 'Sweet-savoury Italian — spicy soppressata and fresh figs with honey', fr: 'Italien doux-salé — soppressata épicée et figues fraîches avec du miel' },
    category: 'gourmet', region: 'calabrian',
    base: 'bianca_cream', season: ['summer', 'autumn'],
    occasion: ['impress', 'party'],
    dietary: ['no_fish'], budget: 2, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['rw', 'lr'],
    flavour: { richness: 3, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.spicySalami, ING.fig, ING.honey, ING.walnuts],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'guanciale_pecorino',
    name: { en: 'Guanciale e Pecorino', fr: 'Guanciale et Pecorino' },
    story: { en: 'Guanciale (cured pork cheek), pecorino (aged sheep cheese), tomato — inspired by pasta all\'Amatriciana', fr: 'Guanciale (joue de porc séchée), pecorino (fromage de brebis affiné), tomate — inspiré des pâtes all\'Amatriciana' },
    category: 'gourmet', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.marinaraSauce, ING.fiordilatte, ING.guanciale, ING.pecorinoRomano, ING.blackPepper],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'honey_pecorino',
    name: { en: 'Honey & Pecorino', fr: 'Miel et Pecorino' },
    story: { en: 'Ancient Sardinian flavour combination — sharp pecorino and golden honey', fr: 'Ancienne combinaison de saveurs sardes — pecorino tranchant et miel doré' },
    category: 'gourmet', region: 'sicilian',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 5 },
    ingredients: [ING.fiordilatte, ING.pecorinoRomano, ING.honey, ING.walnuts, ING.rocket],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'burrata_prosciutto_gourmet',
    name: { en: 'Burrata e Prosciutto Crudo', fr: 'Burrata et Prosciutto Crudo' },
    story: { en: 'The modern Italian classic — oozing burrata, raw prosciutto and tomato', fr: 'Le classique italien moderne — burrata crémeuse, prosciutto cru et tomate' },
    category: 'gourmet', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.prosciutto, ING.burrata, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'porcini_stracciatella',
    name: { en: 'Porcini e Stracciatella', fr: 'Porcini et Stracciatella' },
    story: { en: 'Deep forest mushrooms with cooling stracciatella — the gourmet white pizza', fr: 'Champignons des bois profonds avec stracciatella fraîche — la pizza blanche gastronomique' },
    category: 'gourmet', region: 'neapolitan',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 3, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['rw', 'cw'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 5 },
    ingredients: [ING.fiordilatte, ING.porcini, ING.stracciatella, ING.truffleOil, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'wagyu_onion',
    name: { en: 'Wagyu & Caramelised Onion', fr: 'Wagyu et Oignon Caramélisé' },
    story: { en: 'The luxury American-Italian fusion — premium wagyu beef and slow caramelised onion', fr: 'La fusion américano-italienne de luxe — bœuf wagyu premium et oignon caramélisé lentement' },
    category: 'gourmet', region: 'american',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 3, complexity: 3, prepMinutes: 40, ovenTemp: 'high',
    wine: ['rw', 'lr'],
    flavour: { richness: 5, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.cremeFraiche, ING.fiordilatte, ING.bulgogi, ING.caramelisedOnion, ING.rocket],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'crudo_parma_stracciatella',
    name: { en: 'Crudo di Parma e Stracciatella', fr: 'Parme et Stracciatella' },
    story: { en: 'The contemporary Italian luxury — Parma ham after the oven, cool stracciatella', fr: 'Le luxe contemporain italien — jambon de Parme après le four, stracciatella fraîche' },
    category: 'gourmet', region: 'neapolitan',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.fiordilatte, ING.prosciutto, ING.stracciatella, ING.rocket, ING.parmigianoShavings],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'norma',
    name: { en: 'Norma', fr: 'Norma' },
    story: { en: 'Aubergine, ricotta salata (salted dried ricotta), tomato, basil — Catania\'s greatest pizza export', fr: 'Aubergine, ricotta salata (ricotta séchée salée), tomate, basilic — la plus grande exportation pizza de Catane' },
    category: 'veg', region: 'sicilian',
    base: 'tomato_cooked', season: ['summer', 'autumn'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'high',
    wine: ['lr', 'cw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.marinaraSauce, ING.aubergine, ING.ricotta, ING.parmigianoShavings, ING.freshBasil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },


  // ── Roman Tonda (pizza_romana specific) ───────────────────

  {
    id: 'carciofi_romana',
    name: { en: 'Carciofi alla Romana', fr: 'Artichauts à la Romaine' },
    story: { en: 'Artichoke, olive oil, garlic, mint — Rome\'s iconic vegetable on a crispy white base', fr: 'Artichaut, huile d\'olive, ail, menthe — le légume iconique de Rome sur base blanche croustillante' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['spring'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.artichoke, ING.pecorinoRomano, ING.garlic, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'fiori_zucca_alici',
    name: { en: 'Fiori di Zucca e Alici', fr: 'Fleurs de Courgette et Anchois' },
    story: { en: 'Courgette flowers, anchovies, mozzarella — Rome\'s most beloved seasonal pizza topping', fr: 'Fleurs de courgette, anchois, mozzarella — la garniture printanière préférée des pizzas romaines' },
    category: 'seafood', region: 'roman',
    base: 'bianca_oil', season: ['spring', 'summer'],
    occasion: ['impress', 'classic'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.mozzarellaLM, ING.courgFlower, ING.anchovies, ING.evoOil],
    compatibleStyles: ['pizza_romana', 'roman', 'neapolitan'],
  },

  {
    id: 'amatriciana_pizza',
    name: { en: 'Amatriciana', fr: 'Amatriciana' },
    story: { en: 'Guanciale (cured pork cheek), tomato, pecorino — Rome\'s greatest pasta reborn as pizza', fr: 'Guanciale (joue de porc séchée), tomate, pecorino — les grandes pâtes de Rome réinterprétées en pizza' },
    category: 'classic_italian', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.guanciale, ING.pecorinoRomano, ING.blackPepper],
    compatibleStyles: ['pizza_romana', 'roman', 'neapolitan', 'sourdough'],
  },

  {
    id: 'carbonara_pizza',
    name: { en: 'Carbonara', fr: 'Carbonara' },
    story: { en: 'Guanciale (cured pork cheek), egg cream, pecorino — Rome\'s most debated pasta reinvented as pizza', fr: 'Guanciale (joue de porc séchée), crème d\'œuf, pecorino — les pâtes les plus débattues de Rome en pizza' },
    category: 'gourmet', region: 'roman',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 3, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.guanciale, ING.egg, ING.pecorinoRomano, ING.blackPepper],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'cacio_pepe_pizza',
    name: { en: 'Cacio e Pepe', fr: 'Cacio e Pepe' },
    story: { en: 'The Roman minimalist masterpiece — just pecorino cream and cracked black pepper', fr: "Le chef-d'œuvre minimaliste romain — juste crème de pecorino et poivre concassé" },
    category: 'white', region: 'roman',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 5 },
    ingredients: [ING.cremeFraiche, ING.pecorinoRomano, ING.blackPepper, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'gricia_pizza',
    name: { en: 'Gricia', fr: 'Gricia' },
    story: { en: 'Guanciale (cured pork cheek), pecorino, black pepper — Amatriciana\'s ancestor without the tomato', fr: 'Guanciale (joue de porc séchée), pecorino, poivre noir — l\'ancêtre de l\'Amatriciana sans la tomate' },
    category: 'white', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 2, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.guanciale, ING.pecorinoRomano, ING.blackPepper],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'bianca_rosmarino',
    name: { en: 'Bianca al Rosmarino', fr: 'Blanche au Romarin' },
    story: { en: 'The Roman street food staple — focaccia-style white pizza with rosemary and sea salt', fr: 'Le classique de la rue romaine — pizza blanche façon focaccia avec romarin et sel de mer' },
    category: 'white', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['quick', 'kids', 'party'],
    dietary: ['veg', 'vegan', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 3, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 1, boldness: 1, creative: 1, refined: 3 },
    ingredients: [ING.rosemary, ING.seaSalt, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'bresaola_rucola_pizza',
    name: { en: 'Bresaola e Rucola', fr: 'Bresaola et Roquette' },
    story: { en: 'Northern Italian cool — cured beef, peppery rocket and parmesan shavings', fr: "Fraîcheur d'Italie du Nord — bœuf séché, roquette poivrée et copeaux de parmesan" },
    category: 'meat', region: 'venetian',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.bresaola, ING.rocket, ING.parmigianoShavings, ING.lemonWedge],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'speck_stracchino',
    name: { en: 'Speck e Stracchino', fr: 'Speck et Stracchino' },
    story: { en: 'Alpine northern Italian — smoked speck and creamy stracchino on white base', fr: "Alpin d'Italie du Nord — speck fumé et stracchino crémeux sur base blanche" },
    category: 'meat', region: 'venetian',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.stracchino, ING.speck, ING.freshThyme, ING.evoOil],
    compatibleStyles: ['pizza_romana', 'roman', 'neapolitan'],
  },

  {
    id: 'indivia_gorgonzola',
    name: { en: 'Indivia e Gorgonzola', fr: 'Endive et Gorgonzola' },
    story: { en: 'Roman bianca — bitter endive and creamy gorgonzola on a crispy white base', fr: 'Bianca romaine — endive amère et gorgonzola crémeux sur base blanche croustillante' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.gorgonzola, ING.walnuts, ING.honey, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'prosciutto_stracciatella_romana',
    name: { en: 'Prosciutto e Stracciatella', fr: 'Prosciutto et Stracciatella' },
    story: { en: 'The crispy Roman base makes the cold stracciatella contrast even more striking', fr: 'La base romaine croustillante rend le contraste de la stracciatella froide encore plus saisissant' },
    category: 'meat', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.mozzarellaLM, ING.prosciutto, ING.stracciatella, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'patata_rosmarino_romana',
    name: { en: 'Patata e Rosmarino', fr: 'Pomme de terre et Romarin' },
    story: { en: 'The Roman white pizza classic — thin potato, rosemary and olive oil on crispy base', fr: "Le classique blanc romain — pomme de terre fine, romarin et huile d'olive sur base croustillante" },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'kids', 'quick'],
    dietary: ['veg', 'vegan', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 1, creative: 1, refined: 3 },
    ingredients: [ING.thinPotato, ING.rosemary, ING.seaSalt, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'verdure_grigliate_burrata',
    name: { en: 'Verdure Grigliate e Burrata', fr: 'Légumes Grillés et Burrata' },
    story: { en: 'Summer Roman — colourful grilled vegetables with cold burrata', fr: 'Romain estival — légumes grillés colorés avec burrata froide' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['summer'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.courgette, ING.roastedPepper, ING.aubergine, ING.burrata, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'alici_fresche_romana',
    name: { en: 'Alici Fresche e Pomodorini', fr: 'Anchois Frais et Tomates Cerises' },
    story: { en: 'Roman seafood — fresh anchovies with sweet cherry tomatoes and capers', fr: 'Fruits de mer romains — anchois frais avec tomates cerises sucrées et câpres' },
    category: 'seafood', region: 'roman',
    base: 'tomato_raw', season: ['summer'],
    occasion: ['classic', 'impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 3, creative: 2, refined: 4 },
    ingredients: [ING.sanMarzano, ING.mozzarellaLM, ING.anchovies, ING.capers, ING.oregano],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'porcini_pecorino_romana',
    name: { en: 'Porcini e Pecorino Romano', fr: 'Porcini et Pecorino Romano' },
    story: { en: 'Autumn in Rome — earthy porcini and sharp pecorino on crispy white base', fr: 'Automne à Rome — porcini terreux et pecorino tranchant sur base blanche croustillante' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress', 'classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 2, prepMinutes: 12, ovenTemp: 'mid',
    wine: ['rw', 'cw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.porcini, ING.pecorinoRomano, ING.freshThyme, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },


  // ── Roman Teglia (roman key) ───────────────────────────────

  {
    id: 'teglia_patata_provola',
    name: { en: 'Teglia Patata e Provola', fr: 'Teglia Pomme de terre et Provola' },
    story: { en: 'Roman bakery staple — potato and smoked provola on a high-hydration crispy base', fr: 'Incontournable de la boulangerie romaine — pomme de terre et provola fumée sur base croustillante' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'kids', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.mozzarellaLM, ING.thinPotato, ING.smokedProvola, ING.rosemary, ING.evoOil],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_funghi_salsiccia',
    name: { en: 'Teglia Funghi e Salsiccia', fr: 'Teglia Champignons et Saucisse' },
    story: { en: 'Bakery Roman — earthy mushrooms and sausage on thick crispy teglia base', fr: 'Romain de boulangerie — champignons terreux et saucisse sur épaisse base croustillante teglia' },
    category: 'meat', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party', 'kids'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr', 'cw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.mushrooms, ING.salsiccia],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_prosciutto_cotto',
    name: { en: 'Teglia Prosciutto Cotto e Funghi', fr: 'Teglia Jambon Cuit et Champignons' },
    story: { en: 'The Roman bakery classic — cooked ham and mushrooms on thick airy teglia', fr: 'Le classique de la boulangerie romaine — jambon cuit et champignons sur épaisse teglia aérée' },
    category: 'classic_italian', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'quick'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'cw'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.ham, ING.mushrooms],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_zucchine_fiori',
    name: { en: 'Teglia Zucchine e Fiori', fr: 'Teglia Courgettes et Fleurs' },
    story: { en: 'Roman summer bakery — courgette and its flowers on white base', fr: 'Boulangerie romaine estivale — courgette et ses fleurs sur base blanche' },
    category: 'veg', region: 'roman',
    base: 'bianca_cream', season: ['spring', 'summer'],
    occasion: ['impress', 'classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.courgette, ING.courgFlower, ING.evoOil],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_mortadella_pistacchio',
    name: { en: 'Teglia Mortadella e Pistacchio', fr: 'Teglia Mortadelle et Pistache' },
    story: { en: 'Bologna meets Rome — mortadella and pistachio on thick airy teglia base', fr: 'Bologne rencontre Rome — mortadelle et pistache sur épaisse base teglia aérée' },
    category: 'gourmet', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_fish'], budget: 2, complexity: 2, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.fiordilatte, ING.mortadella, ING.pistachiosPesto, ING.pistachiosTopped],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_tonno_cipolla',
    name: { en: 'Teglia Tonno e Cipolla', fr: 'Teglia Thon et Oignon' },
    story: { en: 'Roman bakery seafood staple — tuna and red onion on thick crispy base', fr: 'Incontournable marin de la boulangerie romaine — thon et oignon rouge sur épaisse base croustillante' },
    category: 'seafood', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.tuna, ING.redOnion, ING.capers],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_4_formaggi',
    name: { en: 'Teglia Quattro Formaggi', fr: 'Teglia Quatre Fromages' },
    story: { en: 'Molten four-cheese on thick Roman base — pure indulgence', fr: 'Quatre fromages fondants sur épaisse base romaine — pure indulgence' },
    category: 'white', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'party', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['rw', 'cw'],
    flavour: { richness: 5, boldness: 3, creative: 2, refined: 3 },
    ingredients: [ING.mozzarellaLM, ING.gorgonzola, ING.parmigianoShavings, ING.ricotta],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_speck_brie',
    name: { en: 'Teglia Speck e Brie', fr: 'Teglia Speck et Brie' },
    story: { en: 'Northern Italian meets Roman — smoky speck and melted brie on thick airy base', fr: 'Italie du Nord rencontre Rome — speck fumé et brie fondu sur épaisse base aérée' },
    category: 'meat', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.speck, ING.brie, ING.walnuts, ING.honey],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_verdure',
    name: { en: 'Teglia Verdure', fr: 'Teglia Légumes' },
    story: { en: 'Grilled peppers, courgette, aubergine, tomato — colourful Roman bakery vegetable medley on thick base', fr: 'Poivrons grillés, courgette, aubergine, tomate — médley de légumes colorés de la boulangerie romaine' },
    category: 'veg', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.courgette, ING.roastedPepper, ING.aubergine, ING.mushrooms],
    compatibleStyles: ['roman'],
  },

  {
    id: 'teglia_nduja_stracciatella',
    name: { en: "Teglia 'Nduja e Stracciatella", fr: "Teglia 'Nduja et Stracciatella" },
    story: { en: 'The spicy and creamy teglia — Calabrian nduja heat cooled by cold stracciatella', fr: 'La teglia épicée et crémeuse — chaleur de la nduja calabraise refroidie par la stracciatella froide' },
    category: 'gourmet', region: 'roman',
    base: 'nduja', season: ['all'],
    occasion: ['impress', 'spicy'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 5, creative: 4, refined: 4 },
    ingredients: [ING.nduja, ING.mozzarellaLM, ING.stracciatella, ING.freshBasil],
    compatibleStyles: ['roman'],
  },


  // ── New York style ─────────────────────────────────────────

  {
    id: 'ny_pepperoni_slice',
    name: { en: 'NY Pepperoni Slice', fr: 'Part New York Pepperoni' },
    story: { en: 'The classic foldable New York slice — extra pepperoni cups, extra grease, extra good', fr: 'La part new-yorkaise classique à plier — extra pepperoni en coupelles, extra savoureux' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'quick', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 1, refined: 1 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.pepperoni],
    compatibleStyles: ['newyork'],
  },

  {
    id: 'hot_honey_pepperoni',
    name: { en: 'Hot Honey & Pepperoni', fr: 'Pepperoni au Miel Pimenté' },
    story: { en: 'The viral New York trend — crispy pepperoni cups with hot honey drizzle', fr: 'La tendance new-yorkaise virale — coupelles de pepperoni croustillantes avec miel pimenté' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['impress', 'party', 'spicy'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.pepperoni, ING.hotHoney],
    compatibleStyles: ['newyork', 'pan'],
  },

  {
    id: 'white_clam_apizza',
    name: { en: 'White Clam Apizza', fr: 'Clam Pizza Blanche' },
    story: { en: 'Clams, garlic, olive oil, no mozzarella — Frank Pepe\'s legendary New Haven invention from the 1960s', fr: 'Palourdes, ail, huile d\'olive, sans mozzarella — l\'invention légendaire de Frank Pepe à New Haven' },
    category: 'seafood', region: 'american',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.anchovies, ING.garlic, ING.pecorinoRomano, ING.capers, ING.evoOil, ING.oregano],
    compatibleStyles: ['newyork'],
  },

  {
    id: 'ny_sausage_peppers',
    name: { en: 'Sausage & Peppers', fr: 'Saucisse et Poivrons NY' },
    story: { en: 'New York Italian-American — sweet Italian sausage and bell peppers on red sauce', fr: 'Italo-américain de New York — saucisse italienne douce et poivrons sur sauce rouge' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party', 'kids'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.salsiccia, ING.roastedPepper, ING.redOnion],
    compatibleStyles: ['newyork', 'pan'],
  },

  {
    id: 'vodka_pizza',
    name: { en: 'Vodka Sauce Pizza', fr: 'Pizza Sauce Vodka' },
    story: { en: 'New York Italian-American — tomato cream vodka sauce, a 1980s NYC classic', fr: 'Italo-américain de New York — sauce tomate crémeuse à la vodka, un classique NYC des années 80' },
    category: 'classic_italian', region: 'american',
    base: 'vodka_cream', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'lr'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 3 },
    ingredients: [ING.vodkaCream, ING.mozzarellaLM, ING.prosciutto, ING.freshBasil],
    compatibleStyles: ['newyork', 'pan'],
  },

  {
    id: 'ny_white_pizza',
    name: { en: 'NY White Pizza', fr: 'Pizza Blanche New York' },
    story: { en: 'New York pizzeria staple — garlic oil base, ricotta dollops, low-moisture mozzarella', fr: "Incontournable des pizzerias new-yorkaises — base à l'ail, ricotta en cuillerées, mozzarella" },
    category: 'white', region: 'american',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 1, creative: 2, refined: 3 },
    ingredients: [ING.mozzarellaLM, ING.ricotta, ING.garlic, ING.oregano, ING.evoOil],
    compatibleStyles: ['newyork'],
  },

  {
    id: 'buffalo_chicken',
    name: { en: 'Buffalo Chicken', fr: 'Poulet Buffalo' },
    story: { en: 'American sports bar classic — spicy buffalo chicken, blue cheese, celery', fr: 'Classique du bar sportif américain — poulet buffalo épicé, bleu, céleri' },
    category: 'fusion', region: 'american',
    base: 'bianca_cream', season: ['all'],
    occasion: ['party', 'spicy', 'kids'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 3, refined: 2 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.grilledChicken, ING.chilli, ING.gorgonzola, ING.freshCoriander],
    compatibleStyles: ['newyork', 'pan'],
  },

  {
    id: 'california_bbq_chicken',
    name: { en: 'California BBQ Chicken', fr: 'Poulet BBQ Californien' },
    story: { en: 'BBQ chicken, red onion, fresh coriander, mozzarella — Wolfgang Puck\'s Spago original from 1980s LA', fr: 'Poulet BBQ, oignon rouge, coriandre fraîche, mozzarella — l\'original Spago de Wolfgang Puck, LA années 80' },
    category: 'fusion', region: 'american',
    base: 'bbq', season: ['all'],
    occasion: ['classic', 'party', 'kids'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 2 },
    ingredients: [ING.bbqSauce, ING.mozzarellaLM, ING.grilledChicken, ING.redOnion, ING.freshCoriander],
    compatibleStyles: ['newyork', 'pan'],
  },

  {
    id: 'smoked_salmon_cream_cheese',
    name: { en: 'Smoked Salmon & Cream Cheese', fr: 'Saumon Fumé et Fromage Frais' },
    story: { en: 'California-inspired — white base with smoked salmon and cream cheese after baking', fr: 'Inspiration californienne — base blanche avec saumon fumé et fromage frais après cuisson' },
    category: 'seafood', region: 'american',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.smSalmon, ING.dill, ING.lemonWedge, ING.capers],
    compatibleStyles: ['newyork', 'pizza_romana'],
  },

  {
    id: 'ny_clam_garlic',
    name: { en: 'Clam & Garlic White', fr: 'Palourde et Ail Blanc' },
    story: { en: 'New York pizzeria classic — chopped clams, garlic, white wine, mozzarella', fr: 'Classique des pizzerias new-yorkaises — palourdes hachées, ail, vin blanc, mozzarella' },
    category: 'seafood', region: 'american',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.anchovies, ING.garlic, ING.capers, ING.evoOil, ING.freshThyme],
    compatibleStyles: ['newyork'],
  },

  {
    id: 'ny_margherita_bufala',
    name: { en: 'NY Margherita Bufala', fr: 'Margherita Bufala NY' },
    story: { en: 'San Marzano tomato, buffalo mozzarella, fresh basil — New York\'s Italian tribute on a crispy NY base', fr: 'Tomate San Marzano, mozzarella de bufala, basilic frais — hommage italien de New York sur base croustillante' },
    category: 'classic_italian', region: 'american',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.sanMarzano, ING.burrata, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['newyork', 'neapolitan', 'sourdough'],
  },

  {
    id: 'ny_diavola',
    name: { en: 'NY Diavola', fr: 'Diavola New York' },
    story: { en: 'The spicy New York slice — generous spicy salami on a crispy NY base', fr: 'La part new-yorkaise épicée — généreux salami épicé sur base croustillante NY' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'spicy', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.spicySalami, ING.chilli],
    compatibleStyles: ['newyork', 'neapolitan', 'sourdough'],
  },


  // ── Detroit / Pan style ────────────────────────────────────

  {
    id: 'detroit_red_top',
    name: { en: 'Detroit Red Top', fr: 'Detroit Red Top' },
    story: { en: 'Brick cheese caramelised to the edges, pepperoni, tomato sauce on top — Buddy\'s Pizza 1946 original', fr: 'Fromage brick caramélisé jusqu\'aux bords, pepperoni, sauce tomate sur le dessus — l\'original Buddy\'s Pizza 1946' },
    category: 'classic_italian', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.brickCheese, ING.pepperoni],
    compatibleStyles: ['pan'],
  },

  {
    id: 'detroit_white',
    name: { en: 'Detroit White', fr: 'Detroit Blanc' },
    story: { en: 'Detroit without the sauce — garlic, brick cheese caramelised edges, herbs', fr: 'Detroit sans la sauce — ail, bords caramélisés au fromage brick, herbes' },
    category: 'white', region: 'american',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.brickCheese, ING.garlic, ING.rosemary, ING.evoOil],
    compatibleStyles: ['pan'],
  },

  {
    id: 'detroit_sausage',
    name: { en: 'Detroit Sausage & Mushroom', fr: 'Detroit Saucisse et Champignons' },
    story: { en: 'Motor City classic — Italian sausage and mushrooms on caramelised-edge Detroit base', fr: 'Classique de Motor City — saucisse italienne et champignons sur base Detroit aux bords caramélisés' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.brickCheese, ING.salsiccia, ING.mushrooms],
    compatibleStyles: ['pan'],
  },

  {
    id: 'detroit_veggie',
    name: { en: 'Detroit Veggie', fr: 'Detroit Végétarien' },
    story: { en: 'Colourful Motor City — roasted peppers, caramelised onion and brick cheese frico', fr: 'Motor City coloré — poivrons rôtis, oignon caramélisé et frico de fromage brick' },
    category: 'veg', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['cw', 'lr'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.brickCheese, ING.caramelisedOnion, ING.roastedPepper, ING.mushrooms],
    compatibleStyles: ['pan'],
  },

  {
    id: 'chicago_deep_dish',
    name: { en: 'Chicago Deep Dish', fr: 'Chicago Deep Dish' },
    story: { en: 'Pizzeria Uno 1943 — thick buttery crust, sausage inside, chunky tomato on top', fr: "Pizzeria Uno 1943 — croûte épaisse et beurrée, saucisse à l'intérieur, tomate épaisse au-dessus" },
    category: 'classic_italian', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 3, prepMinutes: 35, ovenTemp: 'low',
    wine: ['lr', 'rw'],
    flavour: { richness: 5, boldness: 3, creative: 2, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.salsiccia, ING.mushrooms, ING.oregano],
    compatibleStyles: ['pan'],
  },

  {
    id: 'pan_margherita',
    name: { en: 'Pan Margherita', fr: 'Margherita Pan' },
    story: { en: 'Tomato, mozzarella, fresh basil on a thick airy pan base — the crowd-pleasing Margherita', fr: 'Tomate, mozzarella, basilic frais sur épaisse base pan aérée — la Margherita pour régaler tout le monde' },
    category: 'classic_italian', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'kids', 'party', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.freshBasil, ING.evoOil],
    compatibleStyles: ['pan'],
  },

  {
    id: 'pan_pepperoni_hot_honey',
    name: { en: 'Pan Hot Honey Pepperoni', fr: 'Pan Pepperoni Miel Pimenté' },
    story: { en: 'American trend meets thick pan base — hot honey with crispy pepperoni cups', fr: 'Tendance américaine sur épaisse base pan — miel pimenté avec coupelles de pepperoni croustillantes' },
    category: 'meat', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['party', 'spicy', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 3, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.pepperoni, ING.hotHoney],
    compatibleStyles: ['pan'],
  },

  {
    id: 'pan_bbq_chicken',
    name: { en: 'Pan BBQ Chicken', fr: 'Pan Poulet BBQ' },
    story: { en: 'Thick pan base for the American BBQ chicken favourite', fr: 'Épaisse base pan pour le favori américain au poulet BBQ' },
    category: 'fusion', region: 'american',
    base: 'bbq', season: ['all'],
    occasion: ['kids', 'party', 'classic'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 2 },
    ingredients: [ING.bbqSauce, ING.mozzarellaLM, ING.grilledChicken, ING.redOnion, ING.freshCoriander],
    compatibleStyles: ['pan'],
  },

  {
    id: 'pan_nduja_burrata',
    name: { en: "Pan 'Nduja e Burrata", fr: "Pan 'Nduja et Burrata" },
    story: { en: '\'Nduja (fiery spreadable salami), burrata, mozzarella on thick pan — spicy Calabrian heat cooled by creamy burrata', fr: '\'Nduja (salami tartinable ardent), burrata, mozzarella sur base pan — chaleur calabraise refroidie par la burrata crémeuse' },
    category: 'gourmet', region: 'american',
    base: 'nduja', season: ['all'],
    occasion: ['impress', 'spicy'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 5, creative: 4, refined: 3 },
    ingredients: [ING.nduja, ING.mozzarellaLM, ING.burrata, ING.freshBasil],
    compatibleStyles: ['pan'],
  },

  {
    id: 'pan_4_formaggi',
    name: { en: 'Pan Quattro Formaggi', fr: 'Pan Quatre Fromages' },
    story: { en: 'Four cheeses melted into the airy pan crust — ultimate indulgence', fr: 'Quatre fromages fondus dans la croûte pan aérée — ultime indulgence' },
    category: 'white', region: 'american',
    base: 'bianca_oil', season: ['all'],
    occasion: ['party', 'kids', 'classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['rw', 'cw'],
    flavour: { richness: 5, boldness: 3, creative: 2, refined: 3 },
    ingredients: [ING.mozzarellaLM, ING.gorgonzola, ING.brickCheese, ING.parmigianoShavings],
    compatibleStyles: ['pan'],
  },


  // ── Spanish & Mediterranean ────────────────────────────────

  {
    id: 'jamon_manchego',
    name: { en: 'Jamón Ibérico e Manchego', fr: 'Jamón Ibérico et Manchego' },
    story: { en: 'Spanish tapas on pizza — silky Ibérico ham and aged Manchego after the oven', fr: 'Tapas espagnoles sur pizza — jambon Ibérico soyeux et Manchego affiné après le four' },
    category: 'gourmet', region: 'spanish',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 5 },
    ingredients: [ING.mozzarellaLM, ING.jamon, ING.rocket, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'sobrasada_miel',
    name: { en: 'Sobrasada e Miel', fr: 'Sobrasada et Miel' },
    story: { en: 'Mallorcan treasure — spicy spreadable sobrasada and raw honey on white base', fr: 'Trésor majorquin — sobrasada tartinable épicée et miel cru sur base blanche' },
    category: 'gourmet', region: 'spanish',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['rw', 'lr'],
    flavour: { richness: 3, boldness: 4, creative: 4, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.sobrasada, ING.honey, ING.freshThyme],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'escalivada',
    name: { en: 'Escalivada', fr: 'Escalivada' },
    story: { en: 'Catalan fire-roasted vegetables — aubergine, peppers, onion on white base', fr: 'Légumes grillés catalans — aubergine, poivrons, oignon sur base blanche' },
    category: 'veg', region: 'spanish',
    base: 'bianca_oil', season: ['summer', 'autumn'],
    occasion: ['impress'],
    dietary: ['veg', 'vegan', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 3, prepMinutes: 40, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 2, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.aubergine, ING.roastedPepper, ING.redOnion, ING.blackOlives, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'chorizo_padron',
    name: { en: 'Chorizo e Padrón', fr: 'Chorizo et Padrón' },
    story: { en: 'Spanish bar food on pizza — chorizo with Padrón peppers, some are hot, some not', fr: "Bar espagnol sur pizza — chorizo avec poivrons Padrón, certains sont forts, d'autres non" },
    category: 'meat', region: 'spanish',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['party', 'spicy', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.chorizo, ING.roastedPepper, ING.smokedPaprika],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'pulpo_gallega',
    name: { en: 'Pulpo a la Gallega', fr: 'Poulpe à la Galicienne' },
    story: { en: 'Galician seafood tradition on pizza — octopus, potato, smoked paprika', fr: 'Tradition maritime galicienne sur pizza — poulpe, pomme de terre, paprika fumé' },
    category: 'seafood', region: 'spanish',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork'], budget: 3, complexity: 3, prepMinutes: 60, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.octopus, ING.thinPotato, ING.smokedPaprika, ING.evoOil, ING.seaSalt],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'halloumi_zaatar',
    name: { en: "Halloumi & Za'atar", fr: "Halloumi et Za'atar" },
    story: { en: "Eastern Mediterranean — grilled halloumi and za'atar on olive oil base", fr: "Méditerranée orientale — halloumi grillé et za'atar sur base à l'huile d'olive" },
    category: 'veg', region: 'middle_eastern',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_pork', 'no_nuts', 'no_fish', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 4, refined: 3 },
    ingredients: [ING.mozzarellaLM, ING.raclette, ING.zaatarMix, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'zaatar_labneh',
    name: { en: "Za'atar & Labneh", fr: "Za'atar et Labneh" },
    story: { en: 'Za\'atar (wild thyme herb blend), olive oil, white base — inspired by Lebanese flatbread', fr: 'Za\'atar (mélange d\'herbes au thym sauvage), huile d\'olive, base blanche — inspiré du pain plat libanais' },
    category: 'veg', region: 'middle_eastern',
    base: 'zaatar', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_pork', 'no_nuts', 'no_fish', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 5, refined: 4 },
    ingredients: [ING.zaatarMix, ING.labneh, ING.redOnion, ING.freshThyme, ING.evoOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'merguez_harissa',
    name: { en: 'Merguez & Harissa', fr: 'Merguez et Harissa' },
    story: { en: 'North African spice on pizza — merguez sausage on harissa base with egg', fr: "Épices d'Afrique du Nord sur pizza — saucisse merguez sur base harissa avec œuf" },
    category: 'fusion', region: 'north_african',
    base: 'harissa', season: ['all'],
    occasion: ['impress', 'spicy', 'party'],
    dietary: ['halal', 'no_pork', 'no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 12, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 5, creative: 5, refined: 3 },
    ingredients: [ING.harissaBase, ING.mozzarellaLM, ING.merguez, ING.egg, ING.freshCoriander],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },


  // ── Japanese fusion ────────────────────────────────────────

  {
    id: 'miso_funghi',
    name: { en: 'Miso e Funghi', fr: 'Miso et Champignons' },
    story: { en: 'Tokyo-Neapolitan fusion — white miso base with mushrooms and mozzarella', fr: 'Fusion Tokyo-Naples — base miso blanc avec champignons et mozzarella' },
    category: 'fusion', region: 'japanese',
    base: 'miso', season: ['all'],
    occasion: ['impress'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.misoPaste, ING.mozzarellaLM, ING.mushrooms, ING.porcini, ING.sesameOil, ING.springOnion],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'mentaiko_cream',
    name: { en: 'Mentaiko Cream', fr: 'Crème Mentaiko' },
    story: { en: 'Japanese pizza classic — spicy pollock roe cream base, mozzarella, spring onion', fr: 'Classique japonais de la pizza — base crème de mentaiko épicée, mozzarella, ciboule' },
    category: 'fusion', region: 'japanese',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 3, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 4, boldness: 4, creative: 5, refined: 5 },
    ingredients: [ING.mentaiko, ING.mozzarellaLM, ING.springOnion, ING.sesameOil, ING.nori],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'teriyaki_chicken',
    name: { en: 'Teriyaki Chicken', fr: 'Poulet Teriyaki' },
    story: { en: 'The global Japanese-Italian fusion staple — teriyaki chicken with spring onion', fr: "L'incontournable fusion japonaise-italienne mondiale — poulet teriyaki avec ciboule" },
    category: 'fusion', region: 'japanese',
    base: 'other', season: ['all'],
    occasion: ['kids', 'party', 'classic'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['cw', 'lr'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 3 },
    ingredients: [ING.teriyakiSauce, ING.mozzarellaLM, ING.grilledChicken, ING.springOnion, ING.sesameOil],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'salmon_wasabi',
    name: { en: 'Salmone e Wasabi', fr: 'Saumon et Wasabi' },
    story: { en: 'Japanese-Neapolitan — wasabi cream base, smoked salmon, sesame after baking', fr: 'Japonaise-napolitaine — base crème wasabi, saumon fumé, sésame après cuisson' },
    category: 'fusion', region: 'japanese',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress'],
    dietary: ['pescatarian', 'no_nuts', 'no_pork', 'halal', 'kosher'], budget: 2, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 3, boldness: 4, creative: 5, refined: 5 },
    ingredients: [ING.wasabiCream, ING.mozzarellaLM, ING.smSalmon, ING.nori, ING.sesameOil, ING.springOnion],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'korean_bbq',
    name: { en: 'Korean BBQ', fr: 'BBQ Coréen' },
    story: { en: 'Seoul meets Naples — sweet-savoury bulgogi beef with kimchi after the oven', fr: 'Séoul rencontre Naples — bœuf bulgogi doux-salé avec kimchi après le four' },
    category: 'fusion', region: 'asian',
    base: 'other', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['no_nuts', 'no_fish', 'no_pork', 'halal'], budget: 2, complexity: 3, prepMinutes: 30, ovenTemp: 'high',
    wine: ['lr', 'rw'],
    flavour: { richness: 3, boldness: 4, creative: 5, refined: 4 },
    ingredients: [ING.teriyakiSauce, ING.mozzarellaLM, ING.bulgogi, ING.kimchi, ING.springOnion, ING.sesameOil],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'nori_sesame_bianca',
    name: { en: 'Nori & Sesame Bianca', fr: 'Bianca Nori et Sésame' },
    story: { en: 'Japanese minimalism on pizza — white base, sesame, nori strips after baking', fr: 'Minimalisme japonais sur pizza — base blanche, sésame, lanières de nori après cuisson' },
    category: 'fusion', region: 'japanese',
    base: 'bianca_oil', season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 5, refined: 4 },
    ingredients: [ING.mozzarellaLM, ING.nori, ING.sesameOil, ING.springOnion],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },


  // ── French regional additions ──────────────────────────────

  {
    id: 'provencale',
    name: { en: 'Provençale', fr: 'Provençale' },
    story: { en: 'Provence in summer — tomatoes, olives, anchovies and herbes de Provence', fr: 'La Provence en été — tomates, olives, anchois et herbes de Provence' },
    category: 'french_regional', region: 'provence',
    base: 'tomato_cooked', season: ['summer'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'high',
    wine: ['rw', 'cw'],
    flavour: { richness: 2, boldness: 3, creative: 2, refined: 3 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.anchovies, ING.blackOlives, ING.capers, ING.freshThyme],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'lorraine_pizza',
    name: { en: 'Pizza Lorraine', fr: 'Pizza Lorraine' },
    story: { en: 'Quiche Lorraine reimagined — crème fraîche, lardons and emmental on pizza', fr: 'Quiche Lorraine réinterprétée — crème fraîche, lardons et emmental sur pizza' },
    category: 'french_regional', region: 'alsace',
    base: 'bianca_cream', season: ['all'],
    occasion: ['classic', 'impress', 'kids'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.smokedLardons, ING.emmental, ING.redOnion],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'perigourdine',
    name: { en: 'Périgourdine', fr: 'Périgourdine' },
    story: { en: 'Périgord luxury — duck confit and walnut on white base, with foie gras after', fr: 'Luxe du Périgord — confit de canard et noix sur base blanche, avec foie gras après cuisson' },
    category: 'french_regional', region: 'nord',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 3, complexity: 3, prepMinutes: 20, ovenTemp: 'high',
    wine: ['rw', 'lr'],
    flavour: { richness: 5, boldness: 3, creative: 5, refined: 5 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.duckConfit, ING.walnuts, ING.foieGras, ING.honey],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'pistou_pizza',
    name: { en: 'Pistou', fr: 'Pistou' },
    story: { en: 'Provençal pesto — pistou base with summer vegetables and goat cheese', fr: "Pesto provençal — base pistou avec légumes d'été et fromage de chèvre" },
    category: 'french_regional', region: 'provence',
    base: 'pesto', season: ['summer'],
    occasion: ['impress', 'classic'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'], budget: 1, complexity: 2, prepMinutes: 12, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.pesto, ING.mozzarellaLM, ING.courgette, ING.chevreFrais, ING.freshThyme],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'alsacienne_choucroute',
    name: { en: 'Alsacienne au Choucroute', fr: 'Alsacienne au Choucroute' },
    story: { en: 'Alsace on pizza — crème fraîche, sauerkraut, smoked lardons and Munster', fr: "L'Alsace sur pizza — crème fraîche, choucroute, lardons fumés et munster" },
    category: 'french_regional', region: 'alsace',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 4, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.smokedLardons, ING.maroilles, ING.caramelisedOnion],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'basquaise',
    name: { en: 'Basquaise', fr: 'Basquaise' },
    story: { en: 'Basque Country on pizza — Bayonne ham, Espelette pepper and Ossau-Iraty', fr: "Le Pays Basque sur pizza — jambon de Bayonne, piment d'Espelette et Ossau-Iraty" },
    category: 'french_regional', region: 'basque',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.bayonneHam, ING.roastedPepper, ING.espelettePepper, ING.ossauIraty],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'lyonnaise',
    name: { en: 'Lyonnaise', fr: 'Lyonnaise' },
    story: { en: 'Lyon bistro on pizza — fromage blanc, caramelised onion, smoked lardons', fr: 'Bistrot lyonnais sur pizza — fromage blanc, oignon caramélisé, lardons fumés' },
    category: 'french_regional', region: 'lyonnais',
    base: 'bianca_cream', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['no_nuts', 'no_fish'], budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.fromageBlancBase, ING.mozzarellaLM, ING.smokedLardons, ING.caramelisedOnion, ING.freshChives],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'normandie_camembert',
    name: { en: 'Normande au Camembert', fr: 'Normande au Camembert' },
    story: { en: 'Camembert, smoked lardons, cider reduction, crème fraîche — the best of Normandy on pizza', fr: 'Camembert, lardons fumés, réduction de cidre, crème fraîche — le meilleur de Normandie sur pizza' },
    category: 'french_regional', region: 'normandie',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'classic'],
    dietary: ['no_fish'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.mozzarellaLM, ING.camembert, ING.smokedLardons, ING.ciderReduction, ING.freshThyme],
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'jerusalem',
    name: { en: 'Jerusalem', fr: 'Jérusalem' },
    story: { en: 'Roasted aubergine, chickpeas, tahini — Middle Eastern flavours on a Neapolitan base', fr: 'Aubergine rôtie, pois chiches, tahini — saveurs du Moyen-Orient sur base napolitaine' },
    category: 'modern',
    base: 'tomato_cooked',
    season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['veg', 'vegan', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 2, complexity: 2, prepMinutes: 12, ovenTemp: 'high',
    wine: ['cw'],
    flavour: { richness: 2, boldness: 3, creative: 4, refined: 3 },
    ingredients: [ING.sanMarzano, ING.evoOil, ING.freshBasil],
    wineNote: { en: 'Crisp white · Sauvignon Blanc or dry rosé', fr: 'Blanc vif · Sauvignon Blanc ou rosé sec' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana'],
  },

  {
    id: 'shakshuka',
    name: { en: 'Shakshuka', fr: 'Shakshuka' },
    story: { en: 'Spiced tomato base, poached egg, feta, roasted peppers — North African brunch on pizza', fr: 'Base tomate épicée, œuf poché, feta, poivrons rôtis — brunch nord-africain sur pizza' },
    category: 'fusion',
    base: 'tomato_cooked',
    season: ['all'],
    occasion: ['impress', 'quick'],
    dietary: ['veg', 'no_nuts', 'no_fish', 'no_pork', 'halal', 'kosher'],
    budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['ro', 'cw'],
    flavour: { richness: 2, boldness: 4, creative: 4, refined: 2 },
    ingredients: [ING.sanMarzano, ING.evoOil, ING.freshBasil],
    wineNote: { en: 'Dry rosé · or crisp white with citrus notes', fr: 'Rosé sec · ou blanc vif aux notes d\'agrumes' },
    compatibleStyles: ['neapolitan', 'sourdough', 'pizza_romana', 'roman'],
  },

  {
    id: 'hawaiian',
    name: { en: 'Hawaiian', fr: 'Hawaïenne' },
    story: { en: 'Ham, pineapple, mozzarella — the pizza that divided a generation', fr: 'Jambon, ananas, mozzarella — la pizza qui a divisé une génération' },
    category: 'fusion', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['kids', 'party'],
    dietary: ['no_nuts', 'no_fish', 'halal'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['sp', 'ro'],
    flavour: { richness: 2, boldness: 2, creative: 3, refined: 1 },
    compatibleStyles: ['neapolitan', 'newyork', 'pan', 'sourdough'],
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.cookedHam, ING.pineapple],
    wineNote: { en: 'Sparkling or off-dry rosé — match the sweetness', fr: 'Pétillant ou rosé demi-sec — pour équilibrer le sucré' },
    funNote: {
      en: "Illegal in Naples. My wife's favourite. Some battles aren't worth fighting.",
      fr: "Interdit à Naples. Le préféré de ma femme. Certaines batailles ne valent pas la peine.",
    },
  },

]

// ─── Dessert pizzas ───────────────────────────────────────────
// Shown in a separate section — always visible, never behind a filter

export const DESSERT_PIZZAS: Pizza[] = [

  {
    id: 'nutella_fraises',
    name: { en: 'Nutella & Fraises', fr: 'Nutella & Fraises' },
    story: { en: 'Nutella, fresh strawberries — always asked for, always loved', fr: 'Nutella, fraises fraîches — toujours demandée, toujours adorée' },
    category: 'dessert', season: ['spring', 'summer'],
    base: 'other', occasion: ['kids', 'party', 'quick'], dietary: ['veg'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: [],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 1 },
    ingredients: [
      { ...ING.nutella, bakeOrder: 'after' },
      { ...ING.strawberries, bakeOrder: 'after' },
      ING.icingSugar,
    ],
    compatibleStyles: ['neapolitan', 'sourdough'],
  },

  {
    id: 'tarte_tatin_pizza',
    name: { en: 'Tarte Tatin Pizza', fr: 'Pizza Tarte Tatin' },
    story: { en: 'Caramelised apple — a French classic reimagined', fr: 'Pomme caramélisée — un classique français réinventé' },
    category: 'dessert', region: 'lyonnais',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress'], dietary: ['veg'],
    budget: 2, complexity: 2, prepMinutes: 25, ovenTemp: 'mid',
    wine: ['sp'],
    flavour: { richness: 4, boldness: 2, creative: 4, refined: 4 },
    ingredients: [ING.cremeFraiche, ING.caramelisedApple, ING.cinnamon, ING.icingSugar],
    wineNote: { en: 'Crémant or sparkling', fr: 'Crémant ou pétillant' },
  },

  {
    id: 'poire_chocolat',
    name: { en: 'Poire & Chocolat', fr: 'Poire & Chocolat' },
    story: { en: 'Elegant — dark chocolate cream and pear', fr: 'Élégant — crème au chocolat noir et poire' },
    category: 'dessert', season: ['autumn', 'winter'],
    base: 'other', occasion: ['impress'], dietary: ['veg'],
    budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: [],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.darkChocCream, ING.pearSlices, ING.almondFlakes, ING.icingSugar],
  },

  {
    id: 'honey_fig_mascarpone',
    name: { en: 'Honey, Fig & Mascarpone', fr: 'Miel, Figue & Mascarpone' },
    story: { en: 'Autumn on a pizza — sweet figs, creamy mascarpone', fr: 'L\'automne sur une pizza — figues sucrées, mascarpone crémeux' },
    category: 'dessert', season: ['summer', 'autumn'],
    base: 'bianca_ricotta', occasion: ['impress'], dietary: ['veg'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['sp', 'ro'],
    flavour: { richness: 4, boldness: 2, creative: 4, refined: 5 },
    ingredients: [
      { id: 'mascarpone', category: 'base', bakeOrder: 'before', name: { en: 'Mascarpone', fr: 'Mascarpone' }, prepNote: { en: 'Spread as base', fr: 'Étaler comme base' } },
      ING.fig,
      ING.honey,
      ING.walnuts,
    ],
    wineNote: { en: 'Moscato d\'Asti or rosé sparkling', fr: 'Moscato d\'Asti ou rosé pétillant' },
  },

  {
    id: 'speculoos_banana',
    name: { en: 'Speculoos & Banana', fr: 'Speculoos & Banane' },
    story: { en: 'Belgian biscuit spread, caramel, banana — crowd favourite', fr: 'Pâte de speculoos, caramel, banane — favori de la fête' },
    category: 'dessert', season: ['all'],
    base: 'other', occasion: ['kids', 'party'], dietary: ['veg'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: [],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 1 },
    ingredients: [
      { id: 'speculoos_spread', category: 'base', bakeOrder: 'before', name: { en: 'Speculoos spread', fr: 'Pâte de speculoos' } },
      { id: 'banana', category: 'veg', bakeOrder: 'after', name: { en: 'Banana (sliced)', fr: 'Banane (tranchée)' }, prepNote: { en: 'Add after baking', fr: 'Ajouter après cuisson' } },
      { id: 'caramel_drizzle', category: 'finish', bakeOrder: 'after', name: { en: 'Caramel drizzle', fr: 'Filet de caramel' } },
      ING.icingSugar,
    ],
  },

  {
    id: 'creme_brulee_pizza',
    name: { en: 'Crème Brûlée Pizza', fr: 'Pizza Crème Brûlée' },
    story: { en: 'Vanilla cream, caramelised sugar crust torched at the table — the showstopper dessert pizza', fr: 'Crème vanille, sucre caramélisé au chalumeau à table — le dessert pizza spectaculaire' },
    category: 'dessert', season: ['all'],
    base: 'bianca_cream', occasion: ['impress'], dietary: ['veg'],
    budget: 2, complexity: 3, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['sp'],
    flavour: { richness: 5, boldness: 1, creative: 5, refined: 5 },
    ingredients: [
      { id: 'vanilla_cream', category: 'base', bakeOrder: 'before', name: { en: 'Vanilla pastry cream', fr: 'Crème pâtissière vanille' }, prepNote: { en: 'Make ahead — 15 min', fr: 'Préparer à l\'avance — 15 min' } },
      { id: 'sugar_crust', category: 'finish', bakeOrder: 'after', name: { en: 'Caster sugar (blowtorch to caramelise)', fr: 'Sucre semoule (chalumeau pour caraméliser)' }, prepNote: { en: 'Sprinkle after baking, caramelise with blowtorch at table', fr: 'Saupoudrer après cuisson, caraméliser au chalumeau à table' } },
      { id: 'mixed_berries', category: 'finish', bakeOrder: 'after', name: { en: 'Mixed berries', fr: 'Fruits rouges mélangés' } },
    ],
    wineNote: { en: 'Champagne brut or Crémant', fr: 'Champagne brut ou Crémant' },
  },

  {
    id: 'crisommola',
    name: { en: 'Crisommola', fr: 'Crisommola' },
    story: { en: 'Vesuvian apricots, creamy ricotta, honey — Franco Pepe\'s iconic dessert pizza from Caiazzo', fr: 'Abricots du Vésuve, ricotta crémeuse, miel — la pizza dessert iconique de Franco Pepe de Caiazzo' },
    category: 'dessert', region: 'neapolitan',
    base: 'bianca_ricotta', season: ['summer'],
    occasion: ['impress', 'party'],
    dietary: ['veg'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'high',
    wine: ['sp'],
    flavour: { richness: 3, boldness: 2, creative: 5, refined: 5 },
    ingredients: [ING.ricotta, ING.caramelisedApple, ING.honey, ING.evoOil],
  },

  {
    id: 'ricotta_miele_castagne',
    name: { en: 'Ricotta & Chestnut Honey', fr: 'Ricotta et Miel de Châtaigne' },
    story: { en: 'Autumn Italian dessert — fresh ricotta with dark chestnut honey and almond', fr: "Dessert italien d'automne — ricotta fraîche avec miel de châtaigne sombre et amandes" },
    category: 'dessert', region: 'neapolitan',
    base: 'bianca_ricotta', season: ['autumn'],
    occasion: ['impress', 'quick'],
    dietary: ['veg'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.ricotta, ING.honey, ING.almondFlakes, ING.cinnamon],
  },

  {
    id: 'fragole_basilico',
    name: { en: 'Fragole e Basilico', fr: 'Fraises et Basilic' },
    story: { en: 'Summer surprise — fresh strawberries with mascarpone and basil', fr: 'Surprise estivale — fraises fraîches avec mascarpone et basilic' },
    category: 'dessert', region: 'neapolitan',
    base: 'bianca_ricotta', season: ['spring', 'summer'],
    occasion: ['impress', 'party'],
    dietary: ['veg'], budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp'],
    flavour: { richness: 3, boldness: 2, creative: 4, refined: 4 },
    ingredients: [ING.ricotta, ING.strawberries, ING.freshBasil, ING.honey, ING.evoOil],
  },

  {
    id: 'cioccolato_peperoncino',
    name: { en: 'Cioccolato e Peperoncino', fr: 'Chocolat et Piment' },
    story: { en: 'Italian fire and chocolate — dark chocolate cream with chilli heat', fr: 'Feu et chocolat italiens — crème chocolat noir avec chaleur du piment' },
    category: 'dessert', region: 'neapolitan',
    base: 'other', season: ['all'],
    occasion: ['impress', 'spicy', 'party'],
    dietary: ['veg'], budget: 1, complexity: 2, prepMinutes: 8, ovenTemp: 'high',
    wine: ['sp'],
    flavour: { richness: 4, boldness: 4, creative: 5, refined: 4 },
    ingredients: [ING.darkChocCream, ING.chilli, ING.seaSalt, ING.almondFlakes],
  },

  {
    id: 'mela_cannella',
    name: { en: 'Mela e Cannella', fr: 'Pomme et Cannelle' },
    story: { en: 'Autumn Italian comfort — caramelised apple, cinnamon and cream cheese', fr: 'Réconfort automnal italien — pomme caramélisée, cannelle et fromage crémeux' },
    category: 'dessert', region: 'neapolitan',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['kids', 'classic', 'party'],
    dietary: ['veg'], budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['sp'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.caramelisedApple, ING.cinnamon, ING.almondFlakes, ING.honey],
  },

  {
    id: 'caramel_noisette',
    name: { en: 'Caramel Salé & Noisette', fr: 'Caramel Salé et Noisette' },
    story: { en: 'French pâtisserie on pizza — salted caramel, hazelnut and vanilla cream', fr: 'Pâtisserie française sur pizza — caramel salé, noisette et crème vanille' },
    category: 'dessert', region: 'normandie',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress', 'party'],
    dietary: ['veg'], budget: 2, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['sp'],
    flavour: { richness: 5, boldness: 2, creative: 4, refined: 5 },
    ingredients: [ING.cremeFraiche, { id: 'caramel_drizzle', category: 'finish', bakeOrder: 'after', name: { en: 'Caramel drizzle', fr: 'Filet de caramel' } }, ING.almondFlakes, ING.seaSalt, ING.walnuts],
  },

]

// ─── Helpers ─────────────────────────────────────────────────

export function getPizzaById(id: string): Pizza | undefined {
  return [...PIZZAS, ...DESSERT_PIZZAS].find(p => p.id === id)
}

export function getAllPizzas(): Pizza[] {
  return PIZZAS
}

export function getDessertPizzas(): Pizza[] {
  return DESSERT_PIZZAS
}
