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
  PizzaSlot, PizzaPartySession, FilterState,
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

const ING: Record<string, Ingredient> = {

  sanMarzano: {
    id: 'san_marzano', category: 'sauce', bakeOrder: 'before',
    name: { en: 'San Marzano DOP tomatoes', fr: 'Tomates San Marzano DOP' },
    prepNote: { en: 'Hand-crush, salt only — never cook before baking', fr: 'Écraser à la main, saler uniquement — ne jamais cuire avant enfournement' },
    qtyPerPizza: { amount: 80, unit: 'g' },
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
  },

  marinaraSauce: {
    id: 'marinara_sauce', category: 'sauce', bakeOrder: 'before',
    name: { en: 'Cooked marinara sauce', fr: 'Sauce marinara cuite' },
    prepNote: { en: 'Simmer 20 min: olive oil, garlic (remove), San Marzano, basil, salt', fr: 'Mijoter 20 min : huile, ail (retirer), San Marzano, basilic, sel' },
    qtyPerPizza: { amount: 80, unit: 'g' },
  },

  olioBase: {
    id: 'olio_base', category: 'base', bakeOrder: 'before',
    name: { en: 'Olive oil base', fr: 'Base huile d\'olive' },
    isCommonPantry: true,
  },

  fiordilatte: {
    id: 'fior_di_latte', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Fior di latte', fr: 'Fior di latte' },
    prepNote: { en: 'Slice 5mm, drain on paper towel 30 min before baking', fr: 'Trancher à 5mm, égoutter sur papier 30 min avant cuisson' },
    qtyPerPizza: { amount: 100, unit: 'g' },
    hardToFind: true,
    goodEnough: {
      name: { en: 'Fresh mozzarella', fr: 'Mozzarella fraîche' },
      note: { en: 'Widely available, minimal difference', fr: 'Très disponible, différence minimale' },
    },
    compromise: {
      name: { en: 'Low-moisture mozzarella — melts differently, less fresh', fr: 'Mozzarella faible humidité — fond différemment, moins fraîche' },
    },
    localSwap: {
      singapore: {
        name: { en: 'Fresh mozzarella — FairPrice Finest or Cold Storage', fr: 'Mozzarella fraîche — FairPrice Finest ou Cold Storage' },
        brandExamples: { singapore: ['FairPrice Finest fresh mozz', 'Bel Paese — Cold Storage'] },
      },
    },
  },

  burrata: {
    id: 'burrata', category: 'cheese', bakeOrder: 'after',
    name: { en: 'Burrata', fr: 'Burrata' },
    prepNote: { en: 'Add whole after baking — break open at the table', fr: 'Ajouter entière après cuisson — ouvrir à table' },
    qtyPerPizza: { amount: 1, unit: 'pcs' },
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
    localSwap: {
      singapore: {
        name: { en: 'President Crème Fraîche (Marketplace) or President Whipping Cream', fr: 'Crème fraîche Président (Marketplace) ou President Whipping' },
        brandExamples: { singapore: ['President Crème Fraîche — Marketplace', 'Ryan\'s Grocery'] },
      },
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
  },

  chevreFrais: {
    id: 'chevre_frais', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Chèvre frais (fresh goat cheese)', fr: 'Chèvre frais' },
    prepNote: { en: 'Crumble or slice — place after spreading olive oil base', fr: 'Émietter ou trancher — poser après l\'huile d\'olive' },
    goodEnough: { name: { en: 'Any fresh mild goat cheese log', fr: 'N\'importe quelle bûchette de chèvre doux' } },
    localSwap: {
      singapore: { name: { en: 'Goat cheese — Marketplace, Ryan\'s Grocery or Cold Storage', fr: 'Fromage de chèvre — Marketplace, Ryan\'s ou Cold Storage' } },
    },
  },

  mozzarellaLM: {
    id: 'mozzarella_lm', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Low-moisture mozzarella', fr: 'Mozzarella faible humidité' },
    prepNote: { en: 'Grate or slice thin — melts evenly without excess water', fr: 'Râper ou trancher fin — fond sans excès d\'eau' },
  },

  fourCheeses: {
    id: 'four_cheeses', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Four cheeses: mozzarella, gorgonzola, parmesan, taleggio', fr: 'Quatre fromages : mozzarella, gorgonzola, parmesan, taleggio' },
    prepNote: { en: 'Grate parmesan, crumble gorgonzola, slice taleggio thin, tear mozzarella', fr: 'Râper parmesan, émietter gorgonzola, trancher taleggio finement, déchirer mozzarella' },
    qtyPerPizza: { amount: 120, unit: 'g', noteEN: 'total across 4 cheeses', noteFR: 'total pour 4 fromages' },
    hardToFind: true,
    goodEnough: { name: { en: 'Replace taleggio with young Fontina — same washed-rind family, melts identically', fr: 'Remplacer le taleggio par du Fontina jeune — même famille à croûte lavée, fond pareil' } },
    compromise: { name: { en: 'Replace taleggio with Brie (double cream) — different character but melts well', fr: 'Remplacer le taleggio par du Brie (double crème) — caractère différent mais fond bien' } },
  },

  nduja: {
    id: 'nduja', category: 'meat', bakeOrder: 'before',
    name: { en: 'Nduja', fr: 'Nduja' },
    prepNote: { en: 'Spread directly on base before other toppings', fr: 'Étaler directement sur la base avant les autres garnitures' },
    goodEnough: { name: { en: 'Chorizo paste or spicy sobrasada', fr: 'Pâte de chorizo ou sobrasada épicée' } },
    localSwap: {
      singapore: {
        name: { en: 'Nduja — found occasionally at Culina, Ryan\'s, Huber\'s', fr: 'Nduja — disponible parfois chez Culina, Ryan\'s, Huber\'s' },
        brandExamples: { singapore: ['Culina', 'Ryan\'s Grocery', 'Huber\'s Butchery'] },
      },
    },
  },

  prosciutto: {
    id: 'prosciutto', category: 'meat', bakeOrder: 'after',
    name: { en: 'Prosciutto di Parma', fr: 'Prosciutto di Parma' },
    prepNote: { en: 'Add after baking — heat ruins the delicate texture', fr: 'Ajouter après cuisson — la chaleur détruit la texture délicate' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '4–5 slices', noteFR: '4–5 tranches' },
    goodEnough: { name: { en: 'Good quality Parma ham', fr: 'Jambon de Parme de qualité' } },
    compromise: {
      name: { en: 'Good cooked ham — less delicate, milder', fr: 'Bon jambon cuit — moins délicat, plus doux' },
    },
  },

  smokedLardons: {
    id: 'smoked_lardons', category: 'meat', bakeOrder: 'before',
    name: { en: 'Smoked lardons', fr: 'Lardons fumés' },
    prepNote: { en: 'No need to pre-cook — render perfectly in the oven', fr: 'Pas besoin de précuire — fondent parfaitement au four' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Diced smoked bacon', fr: 'Bacon fumé en dés' } },
    compromise: { name: { en: 'Unsmoked lardons — less flavour', fr: 'Lardons non fumés — moins de goût' } },
  },

  spicySalami: {
    id: 'spicy_salami', category: 'meat', bakeOrder: 'before',
    name: { en: 'Spicy Calabrian salami', fr: 'Salami calabrais épicé' },
    qtyPerPizza: { amount: 60, unit: 'g', noteEN: '8–10 slices', noteFR: '8–10 tranches' },
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
  },

  grilledChicken: {
    id: 'grilled_chicken', category: 'meat', bakeOrder: 'before',
    name: { en: 'Grilled chicken', fr: 'Poulet grillé' },
    prepNote: { en: 'Slice thin, season well before adding', fr: 'Trancher finement, bien assaisonner avant d\'ajouter' },
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
  },

  ham: {
    id: 'cooked_ham', category: 'meat', bakeOrder: 'before',
    name: { en: 'Cooked ham', fr: 'Jambon cuit' },
    qtyPerPizza: { amount: 80, unit: 'g' },
  },

  smSalmon: {
    id: 'smoked_salmon', category: 'seafood', bakeOrder: 'after',
    name: { en: 'Smoked salmon', fr: 'Saumon fumé' },
    prepNote: { en: 'Always add after baking — never cook smoked salmon', fr: 'Toujours ajouter après cuisson — ne jamais cuire le saumon fumé' },
    qtyPerPizza: { amount: 60, unit: 'g' },
  },

  anchovies: {
    id: 'anchovies', category: 'seafood', bakeOrder: 'before',
    name: { en: 'Anchovy fillets in oil', fr: 'Filets d\'anchois à l\'huile' },
    prepNote: { en: 'No extra salt needed — anchovies season the entire pizza', fr: 'Pas besoin de sel — les anchois assaisonnent toute la pizza' },
    isCommonPantry: true,
  },

  tuna: {
    id: 'tuna', category: 'seafood', bakeOrder: 'before',
    name: { en: 'Good quality canned tuna in oil', fr: 'Thon de qualité à l\'huile' },
    prepNote: { en: 'Drain well before adding', fr: 'Bien égoutter avant d\'ajouter' },
  },

  thinPotato: {
    id: 'thin_potato', category: 'veg', bakeOrder: 'before',
    name: { en: 'Thinly sliced potato', fr: 'Pomme de terre en fines tranches' },
    prepNote: { en: 'Slice 2mm — no pre-cooking for mid/low oven. High oven: blanch 2 min first.', fr: 'Trancher à 2mm — pas de précuisson four moyen. Four très chaud : blanchir 2 min.' },
    qtyPerPizza: { amount: 150, unit: 'g', noteEN: 'sliced 2mm', noteFR: 'tranché à 2mm' },
  },

  mushrooms: {
    id: 'mushrooms', category: 'veg', bakeOrder: 'before',
    name: { en: 'Mixed mushrooms', fr: 'Champignons mélangés' },
    prepNote: { en: 'Sauté briefly before adding — removes excess water', fr: 'Faire revenir brièvement — élimine l\'excès d\'eau' },
  },

  porcini: {
    id: 'porcini', category: 'veg', bakeOrder: 'before',
    name: { en: 'Porcini mushrooms', fr: 'Cèpes' },
    prepNote: { en: 'Sauté in butter before adding', fr: 'Faire revenir au beurre avant d\'ajouter' },
    goodEnough: { name: { en: 'Dried porcini (rehydrated) or chestnut mushrooms', fr: 'Cèpes séchés (réhydratés) ou champignons de châtaigne' } },
  },

  artichoke: {
    id: 'artichoke', category: 'veg', bakeOrder: 'before',
    name: { en: 'Artichoke hearts (jarred)', fr: 'Cœurs d\'artichaut (en bocal)' },
    prepNote: { en: 'Drain and halve before adding', fr: 'Égoutter et couper en deux avant d\'ajouter' },
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
    prepNote: { en: 'Wilt briefly, squeeze out water completely before adding', fr: 'Faire tomber rapidement, presser l\'eau complètement avant d\'ajouter' },
  },

  aubergine: {
    id: 'aubergine', category: 'veg', bakeOrder: 'before',
    name: { en: 'Aubergine', fr: 'Aubergine' },
    prepNote: { en: 'Slice, salt 20 min, pat dry — roast or fry before adding', fr: 'Trancher, saler 20 min, sécher — rôtir ou frire avant d\'ajouter' },
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
    prepNote: { en: 'Open flat, remove pistil, add before baking', fr: 'Ouvrir à plat, retirer le pistil, ajouter avant cuisson' },
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
    goodEnough: { name: { en: 'Any creamy blue cheese', fr: 'N\'importe quel fromage bleu crémeux' } },
  },

  brie: {
    id: 'brie', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Brie', fr: 'Brie' },
    prepNote: { en: 'Slice thin with rind on — melts beautifully', fr: 'Trancher finement avec la croûte — fond magnifiquement' },
    qtyPerPizza: { amount: 80, unit: 'g' },
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
    compromise: {
      name: { en: 'Mascarpone — richer, no tang', fr: 'Mascarpone — plus riche, sans acidité' },
    },
  },

  truffleOil: {
    id: 'truffle_oil', category: 'finish', bakeOrder: 'after',
    name: { en: 'Truffle oil', fr: 'Huile de truffe' },
    prepNote: { en: 'Drizzle after baking — never cook truffle oil', fr: 'Arroser après cuisson — ne jamais cuire l\'huile de truffe' },
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
    prepNote: { en: 'Roughly crush — toast lightly for more flavour', fr: 'Concasser grossièrement — légèrement torréfier pour plus de goût' },
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
    prepNote: { en: 'Cook apple slices in butter and brown sugar 10 min before adding', fr: 'Cuire les tranches de pomme dans beurre et cassonade 10 min avant d\'ajouter' },
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
    prepNote: { en: 'Melt dark chocolate with cream (2:1) — spread warm', fr: 'Fondre le chocolat noir avec la crème (2:1) — étaler tiède' },
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
    prepNote: { en: 'Toast lightly before adding', fr: 'Légèrement torréfier avant d\'ajouter' },
  },

  asparagus: {
    id: 'asparagus', category: 'veg', bakeOrder: 'before',
    name: { en: 'Asparagus', fr: 'Asperges' },
    prepNote: { en: 'Blanch 2 min, slice lengthways, add before baking', fr: 'Blanchir 2 min, couper en longueur, ajouter avant cuisson' },
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
    goodEnough: { name: { en: 'Manchego or any mild sheep cheese', fr: 'Manchego ou tout fromage de brebis doux' } },
    localSwap: {
      singapore: { name: { en: 'Manchego — Marketplace or Ryan\'s Grocery', fr: 'Manchego — Marketplace ou Ryan\'s Grocery' } },
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
  },

  caramelisedOnion: {
    id: 'caramelised_onion', category: 'veg', bakeOrder: 'before',
    name: { en: 'Caramelised onion', fr: 'Oignon caramélisé' },
    prepNote: { en: 'Cook sliced onion low and slow 25 min in butter — deeply sweet', fr: 'Cuire l\'oignon émincé à feu doux 25 min dans du beurre — très doux et sucré' },
  },

  camembert: {
    id: 'camembert', category: 'cheese', bakeOrder: 'before',
    name: { en: 'Camembert', fr: 'Camembert' },
    prepNote: { en: 'Slice and distribute — melts into rich pools', fr: 'Trancher et distribuer — fond en flaque crémeuse' },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Brie — same soft-ripened family, melts the same way', fr: 'Brie — même famille à pâte molle, fond pareillement' } },
    compromise: { name: { en: 'Any soft melting cheese', fr: 'Tout fromage fondant à pâte molle' } },
  },

  ciderReduction: {
    id: 'cider_reduction', category: 'finish', bakeOrder: 'after',
    name: { en: 'Cider reduction drizzle', fr: 'Réduction de cidre' },
    prepNote: { en: 'Reduce dry cider by half, drizzle after baking', fr: 'Réduire le cidre brut de moitié, arroser après cuisson' },
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
  },

  mixedPeppers: {
    id: 'mixed_peppers', category: 'veg', bakeOrder: 'before',
    name: { en: 'Mixed peppers (roasted)', fr: 'Poivrons mélangés (rôtis)' },
    prepNote: { en: 'Slice and roast at 200°C until soft — or use jarred roasted peppers', fr: "Couper et rôtir à 200°C jusqu'à tendreté — ou utiliser des poivrons en bocal" },
    qtyPerPizza: { amount: 80, unit: 'g' },
    goodEnough: { name: { en: 'Jarred roasted red peppers — excellent substitute', fr: 'Poivrons rouges rôtis en bocal — excellent substitut' } },
  },

  egg: {
    id: 'egg', category: 'base', bakeOrder: 'before',
    name: { en: 'Egg (cracked on top)', fr: 'Œuf (cassé sur la pizza)' },
    prepNote: { en: 'Crack directly onto pizza halfway through baking — yolk stays runny', fr: 'Casser directement sur la pizza à mi-cuisson — jaune reste coulant' },
    qtyPerPizza: { amount: 1, unit: 'pcs', noteEN: 'per pizza', noteFR: 'par pizza' },
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
    story: { en: 'Naples\' most iconic pizza — born 1889', fr: 'La pizza la plus emblématique de Naples — née en 1889' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'kids', 'quick', 'party'],
    dietary: ['veg'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw', 'sp'],
    flavour: { richness: 2, boldness: 1, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Falanghina · crisp white or sparkling', fr: 'Falanghina · blanc frais ou pétillant' },
  },

  {
    id: 'marinara',
    name: { en: 'Marinara', fr: 'Marinara' },
    story: { en: 'The original — no cheese, just perfect tomato and garlic', fr: 'L\'originale — sans fromage, juste tomate et ail parfaits' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg', 'vegan', 'dairy_free'],
    budget: 1, complexity: 1, prepMinutes: 3, ovenTemp: 'high',
    wine: ['cw'],
    flavour: { richness: 1, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.garlic, ING.oregano, ING.evoOil],
    wineNote: { en: 'Vermentino or crisp Pinot Grigio', fr: 'Vermentino ou Pinot Gris frais' },
  },

  {
    id: 'diavola',
    name: { en: 'Diavola', fr: 'Diavola' },
    story: { en: 'The devil\'s pizza — spicy Calabrian heat', fr: 'La pizza du diable — piment calabrais épicé' },
    category: 'classic_italian', region: 'calabrian',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'spicy', 'party'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'fr'],
    flavour: { richness: 3, boldness: 5, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.spicySalami, ING.chilli, ING.evoOil],
    wineNote: { en: 'Primitivo or bold red', fr: 'Primitivo ou rouge puissant' },
  },

  {
    id: 'quattro_formaggi',
    name: { en: '4 Formaggi', fr: '4 Fromages' },
    story: { en: 'Four cheeses — one extraordinary pizza', fr: 'Quatre fromages — une pizza extraordinaire' },
    category: 'classic_italian', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: ['veg'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['fr', 'rw'],
    flavour: { richness: 5, boldness: 3, creative: 1, refined: 4 },
    ingredients: [ING.olioBase, ING.fourCheeses, ING.blackPepper],
    wineNote: { en: 'Barolo or aged Chianti', fr: 'Barolo ou Chianti vieilli' },
  },

  {
    id: 'capricciosa',
    name: { en: 'Capricciosa', fr: 'Capricciosa' },
    story: { en: 'The capricious one — loaded with Italian classics', fr: 'La capricieuse — garnie de classiques italiens' },
    category: 'classic_italian', region: 'roman',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: [],
    budget: 2, complexity: 1, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.fiordilatte, ING.mushrooms, ING.ham, ING.blackOlives, ING.artichoke, ING.evoOil],
    wineNote: { en: 'Chianti Classico · light red', fr: 'Chianti Classico · rouge léger' },
  },

  {
    id: 'napoli',
    name: { en: 'Napoli', fr: 'Napoli' },
    story: { en: 'Anchovies, capers, olives — the sea on a pizza', fr: 'Anchois, câpres, olives — la mer sur une pizza' },
    category: 'classic_italian', region: 'neapolitan',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic'],
    dietary: ['pescatarian'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['cw'],
    flavour: { richness: 2, boldness: 4, creative: 1, refined: 3 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.anchovies, ING.capers, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Verdicchio or Fiano · crisp white', fr: 'Verdicchio ou Fiano · blanc frais' },
  },

  // ── MEAT ─────────────────────────────────────────────────

  {
    id: 'pepperoni',
    name: { en: 'Pepperoni', fr: 'Pepperoni' },
    story: { en: 'America\'s favourite — crispy-edged and irresistible', fr: 'La préférée des Américains — bords croustillants et irrésistible' },
    category: 'fusion', region: 'american',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['kids', 'party', 'quick'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 3, creative: 1, refined: 1 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.pepperoni],
    wineNote: { en: 'Zinfandel or light red', fr: 'Zinfandel ou rouge léger' },
  },

  {
    id: 'nduja_mozzarella',
    name: { en: 'Nduja e Mozzarella', fr: 'Nduja & Mozzarella' },
    story: { en: 'Calabria\'s fiery spreadable salami meets fresh mozzarella', fr: 'Le salami calabrais épicé rencontre la mozzarella fraîche' },
    category: 'meat', region: 'calabrian',
    base: 'tomato_raw', season: ['all'],
    occasion: ['spicy', 'impress'],
    dietary: [],
    budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['fr'],
    flavour: { richness: 4, boldness: 5, creative: 2, refined: 3 },
    ingredients: [ING.sanMarzano, ING.nduja, ING.fiordilatte, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Aglianico or bold Calabrian red', fr: 'Aglianico ou rouge calabrais puissant' },
  },

  // ── SEAFOOD ──────────────────────────────────────────────

  {
    id: 'tonno_cipolla',
    name: { en: 'Tonno e Cipolla', fr: 'Thon & Oignon' },
    story: { en: 'A southern Italian classic — tuna and sweet onion', fr: 'Un classique du Sud de l\'Italie — thon et oignon doux' },
    category: 'seafood', region: 'sicilian',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['pescatarian'],
    budget: 1, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['cw'],
    flavour: { richness: 2, boldness: 3, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.mozzarellaLM, ING.tuna, ING.redOnion, ING.evoOil],
    wineNote: { en: 'Grillo or Sicilian white · crisp white', fr: 'Grillo ou blanc sicilien · blanc frais' },
  },

  {
    id: 'smoked_salmon_creme',
    name: { en: 'Smoked Salmon & Crème Fraîche', fr: 'Saumon fumé & Crème fraîche' },
    story: { en: 'Parisian bistro energy — cool salmon on a warm pizza', fr: 'Énergie bistrot parisien — saumon frais sur pizza chaude' },
    category: 'seafood', region: 'normandie',
    base: 'bianca_cream', season: ['all'],
    occasion: ['impress'],
    dietary: ['pescatarian'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['sp', 'cw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.cremeFraiche, ING.fiordilatte, ING.smSalmon, ING.capers, ING.dill, ING.lemonWedge],
    wineNote: { en: 'Champagne or Chablis', fr: 'Champagne ou Chablis' },
  },

  // ── VEGETABLE ────────────────────────────────────────────

  {
    id: 'ortolana',
    name: { en: 'Ortolana', fr: 'Ortolana' },
    story: { en: 'The gardener\'s pizza — seasonal vegetables simply prepared', fr: 'La pizza du jardinier — légumes de saison simplement préparés' },
    category: 'veg',
    base: 'tomato_cooked', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: ['veg'],
    budget: 1, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr', 'ro'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.marinaraSauce, ING.fiordilatte, ING.aubergine, ING.courgette, ING.roastedPepper, ING.freshBasil, ING.evoOil],
    wineNote: { en: 'Bardolino or light red', fr: 'Bardolino ou rouge léger' },
  },

  {
    id: 'funghi_tartufo',
    name: { en: 'Funghi e Tartufo', fr: 'Champignons & Truffe' },
    story: { en: 'Earthy mushrooms elevated with truffle', fr: 'Champignons terreux sublimés à la truffe' },
    category: 'veg', region: 'roman',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['fr', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 2, refined: 5 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.porcini, ING.mushrooms, ING.truffleOil, ING.evoOil],
    wineNote: { en: 'Burgundy or earthy full red', fr: 'Bourgogne rouge ou rouge terreux' },
  },

  // ── WHITE ────────────────────────────────────────────────

  {
    id: 'patate_rosmarino',
    name: { en: 'Patate e Rosmarino', fr: 'Pommes de terre & Romarin' },
    story: { en: 'Roman street food at its most satisfying', fr: 'La street food romaine dans toute sa générosité' },
    category: 'white', region: 'roman',
    base: 'bianca_oil', season: ['all'],
    occasion: ['classic', 'kids'],
    dietary: ['veg'],
    budget: 1, complexity: 2, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['cw'],
    flavour: { richness: 3, boldness: 1, creative: 1, refined: 2 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.thinPotato, ING.rosemary, ING.seaSalt, ING.evoOil],
    wineNote: { en: 'Frascati or Soave · crisp white', fr: 'Frascati ou Soave · blanc frais' },
  },

  {
    id: 'bianca_ricotta_spinaci',
    name: { en: 'Bianca Ricotta e Spinaci', fr: 'Bianca Ricotta & Épinards' },
    story: { en: 'Creamy ricotta, wilted spinach, a hint of nutmeg', fr: 'Ricotta crémeuse, épinards fondants, pointe de noix de muscade' },
    category: 'white',
    base: 'bianca_ricotta', season: ['all'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.ricotta, ING.fiordilatte, ING.spinach, ING.evoOil],
    wineNote: { en: 'Pinot Grigio or Soave · crisp white', fr: 'Pinot Gris ou Soave · blanc frais' },
  },

  {
    id: 'truffle_bianca',
    name: { en: 'Truffle Bianca', fr: 'Bianca Truffe' },
    story: { en: 'The showstopper — cream, truffle, and pure luxury', fr: 'Le clou du spectacle — crème, truffe et luxe absolu' },
    category: 'gourmet', region: 'roman',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'mid',
    wine: ['rw', 'fr'],
    flavour: { richness: 5, boldness: 3, creative: 3, refined: 5 },
    ingredients: [ING.cream35, ING.fiordilatte, ING.parmigianoShavings, ING.truffleOil],
    wineNote: { en: 'White Burgundy or aged Barolo', fr: 'Bourgogne blanc ou Barolo vieilli' },
  },

  // ── MODERN ───────────────────────────────────────────────

  {
    id: 'prosciutto_rucola',
    name: { en: 'Prosciutto e Rucola', fr: 'Prosciutto & Roquette' },
    story: { en: 'Cool rocket, warm pizza, silky prosciutto — a perfect contrast', fr: 'Roquette fraîche, pizza chaude, prosciutto soyeux — un contraste parfait' },
    category: 'modern', region: 'roman',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: [],
    budget: 2, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp', 'cw'],
    flavour: { richness: 2, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.prosciutto, ING.rocket, ING.parmigianoShavings, ING.evoOil],
    wineNote: { en: 'Prosecco or light Pinot Noir', fr: 'Prosecco ou Pinot Noir léger' },
  },

  {
    id: 'burrata_prosciutto',
    name: { en: 'Burrata e Prosciutto', fr: 'Burrata & Prosciutto' },
    story: { en: 'Two Italian masterpieces on one pizza', fr: 'Deux chefs-d\'œuvre italiens sur une pizza' },
    category: 'modern',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: [],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['sp', 'cw'],
    flavour: { richness: 4, boldness: 2, creative: 3, refined: 5 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.burrata, ING.prosciutto, ING.rocket, ING.evoOil],
    wineNote: { en: 'Champagne or Franciacorta', fr: 'Champagne ou Franciacorta' },
  },

  {
    id: 'fig_gorgonzola',
    name: { en: 'Fig & Gorgonzola', fr: 'Figue & Gorgonzola' },
    story: { en: 'Sweet figs, bold blue cheese — a perfect autumn combination', fr: 'Figues sucrées, fromage bleu puissant — une combinaison automnale parfaite' },
    category: 'modern',
    base: 'bianca_oil', season: ['summer', 'autumn'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 3, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'ro'],
    flavour: { richness: 4, boldness: 4, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.gorgonzola, ING.fig, ING.honey, ING.rocket, ING.evoOil],
    wineNote: { en: 'Sauternes or late-harvest Riesling', fr: 'Sauternes ou Riesling vendanges tardives' },
  },

  {
    id: 'pear_walnut_gorgonzola',
    name: { en: 'Pear, Walnut & Gorgonzola', fr: 'Poire, Noix & Gorgonzola' },
    story: { en: 'A classic bistro combination reimagined on pizza dough', fr: 'Un classique bistrot réinventé sur pâte à pizza' },
    category: 'modern', region: 'lyonnais',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'sp'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.gorgonzola, ING.pear, ING.walnuts, ING.honey, ING.evoOil],
    wineNote: { en: 'Monbazillac or rich white', fr: 'Monbazillac ou blanc riche' },
  },

  // ── FUSION ───────────────────────────────────────────────

  {
    id: 'bbq_chicken',
    name: { en: 'BBQ Chicken', fr: 'Poulet BBQ' },
    story: { en: 'American crowd-pleaser — smoky, sweet, satisfying', fr: 'Plaisir américain — fumé, sucré, généreux' },
    category: 'fusion', region: 'american',
    base: 'bbq', season: ['all'],
    occasion: ['kids', 'party'],
    dietary: [],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'mid',
    wine: ['lr'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 1 },
    ingredients: [ING.bbqSauce, ING.mozzarellaLM, ING.grilledChicken, ING.redOnion, ING.sweetcorn, ING.freshCoriander],
    wineNote: { en: 'Off-dry Riesling or light red', fr: 'Riesling demi-sec ou rouge léger' },
  },

  // ── GOURMET ──────────────────────────────────────────────

  {
    id: 'speck_brie',
    name: { en: 'Speck & Brie', fr: 'Speck & Brie' },
    story: { en: 'Alpine speck meets French brie — a mountain pizza', fr: 'Speck alpin rencontre le brie français — une pizza de montagne' },
    category: 'gourmet',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: [],
    budget: 3, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['rw', 'lr'],
    flavour: { richness: 5, boldness: 3, creative: 4, refined: 5 },
    ingredients: [ING.olioBase, ING.fiordilatte, ING.brie, ING.speck, ING.honey, ING.walnuts, ING.evoOil],
    wineNote: { en: 'Alsatian Pinot Gris or light Beaujolais', fr: 'Pinot Gris d\'Alsace ou Beaujolais léger' },
  },

  // ── FRENCH REGIONAL ──────────────────────────────────────

  {
    id: 'tarte_flambee',
    name: { en: 'Tarte Flambée', fr: 'Tarte Flambée' },
    story: { en: 'Alsace\'s iconic flatbread — crisp, delicate, perfect', fr: 'Le monument alsacien — croustillant, délicat, parfait' },
    category: 'french_regional', region: 'alsace',
    base: 'bianca_cream', season: ['all'],
    occasion: ['classic', 'quick'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 10, ovenTemp: 'high',
    wine: ['rw', 'cw'],
    flavour: { richness: 3, boldness: 2, creative: 2, refined: 4 },
    ingredients: [ING.fromageBlancBase, ING.cremeFraiche, ING.smokedLardons, ING.redOnion],
    wineNote: { en: 'Alsatian Riesling or Pinot Gris · rich white', fr: 'Riesling alsacien ou Pinot Gris · blanc riche' },
  },

  {
    id: 'raclette_pommes',
    name: { en: 'Raclette & Pommes de Terre', fr: 'Raclette & Pommes de Terre' },
    story: { en: 'Savoie mountain pizza — pure winter comfort', fr: 'La pizza savoyarde — pur réconfort hivernal' },
    category: 'french_regional', region: 'savoie',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress', 'party'],
    dietary: [],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 4, boldness: 2, creative: 2, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.raclette, ING.thinPotato, ING.smokedLardons, ING.cornichons, ING.freshChives],
    wineNote: { en: 'Chignin or Apremont · crisp Savoie white', fr: 'Chignin ou Apremont · blanc de Savoie frais' },
  },

  {
    id: 'chevre_miel',
    name: { en: 'Chèvre & Miel', fr: 'Chèvre & Miel' },
    story: { en: 'Provence sun — goat cheese, honey and thyme', fr: 'Soleil provençal — chèvre, miel et thym' },
    category: 'french_regional', region: 'provence',
    base: 'bianca_oil', season: ['spring', 'summer'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 1, prepMinutes: 8, ovenTemp: 'mid',
    wine: ['cw', 'ro'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 4 },
    ingredients: [ING.olioBase, ING.chevreFrais, ING.fiordilatte, ING.freshThyme, ING.walnuts, ING.honey, ING.evoOil],
    wineNote: { en: 'Sancerre or Provence rosé', fr: 'Sancerre ou rosé de Provence' },
  },

  {
    id: 'andouille_moutarde',
    name: { en: 'Andouille & Moutarde', fr: 'Andouille & Moutarde' },
    story: { en: 'Brittany on a pizza — bold, smoky, unmistakably French', fr: 'La Bretagne sur une pizza — puissant, fumé, inimitable' },
    category: 'french_regional', region: 'bretagne',
    base: 'other', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: [],
    budget: 2, complexity: 1, prepMinutes: 10, ovenTemp: 'mid',
    wine: ['lr', 'cw'],
    flavour: { richness: 4, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.dijonMustard, ING.emmental, ING.andouille, ING.redOnion, ING.evoOil],
    wineNote: { en: 'Muscadet or light red', fr: 'Muscadet ou rouge léger' },
  },

  {
    id: 'maroilles_oignons',
    name: { en: 'Maroilles & Caramelised Onion', fr: 'Maroilles & Oignons Caramélisés' },
    story: { en: 'Nord\'s famous washed-rind cheese — bold and deeply satisfying', fr: 'Le fromage à croûte lavée du Nord — puissant et généreux' },
    category: 'french_regional', region: 'nord',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 2, prepMinutes: 30, ovenTemp: 'mid',
    wine: ['lr', 'rw'],
    flavour: { richness: 5, boldness: 4, creative: 3, refined: 3 },
    ingredients: [ING.olioBase, ING.maroilles, ING.caramelisedOnion, ING.freshThyme, ING.blackPepper],
    wineNote: { en: 'Côtes du Rhône or rich white', fr: 'Côtes du Rhône ou blanc riche' },
  },

  {
    id: 'jambon_espelette',
    name: { en: 'Jambon de Bayonne & Espelette', fr: 'Jambon de Bayonne & Piment d\'Espelette' },
    story: { en: 'Basque country on a pizza — gentle heat, world-class ham', fr: 'Le Pays Basque sur une pizza — piment doux, jambon d\'exception' },
    category: 'french_regional', region: 'basque',
    base: 'tomato_raw', season: ['all'],
    occasion: ['impress'],
    dietary: [],
    budget: 3, complexity: 1, prepMinutes: 5, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 3, boldness: 3, creative: 3, refined: 4 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.bayonneHam, ING.espelettePepper, ING.evoOil],
    wineNote: { en: 'Irouléguy or Basque rosé', fr: 'Irouléguy ou rosé basque' },
  },

  {
    id: 'camembert_pommes',
    name: { en: 'Camembert & Apple', fr: 'Camembert & Pommes' },
    story: { en: 'Normandy in one pizza — cider country\'s finest ingredients', fr: 'La Normandie en une pizza — les meilleurs ingrédients du pays du cidre' },
    category: 'french_regional', region: 'normandie',
    base: 'bianca_oil', season: ['autumn', 'winter'],
    occasion: ['impress'],
    dietary: ['veg'],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['sp', 'rw'],
    flavour: { richness: 4, boldness: 3, creative: 4, refined: 4 },
    ingredients: [ING.olioBase, ING.camembert, ING.caramelisedApple, ING.walnuts, ING.honey, ING.ciderReduction],
    wineNote: { en: 'Normandy cider or sparkling', fr: 'Cidre de Normandie ou pétillant' },
  },

  {
    id: 'tartiflette_pizza',
    name: { en: 'Tartiflette Pizza', fr: 'Pizza Tartiflette' },
    story: { en: 'Savoie\'s most indulgent dish — reimagined on pizza dough', fr: 'Le plat le plus gourmand de Savoie — réinventé sur pâte à pizza' },
    category: 'french_regional', region: 'savoie',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['impress', 'party'],
    dietary: [],
    budget: 2, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'rw'],
    flavour: { richness: 5, boldness: 3, creative: 3, refined: 3 },
    ingredients: [ING.cremeFraiche, ING.reblochon, ING.thinPotato, ING.smokedLardons, ING.redOnion, ING.blackPepper],
    wineNote: { en: 'Roussette de Savoie · crisp alpine white', fr: 'Roussette de Savoie · blanc alpin frais' },
  },

  {
    id: 'la_reine',
    name: { en: 'La Reine', fr: 'La Reine' },
    story: { en: 'The classic French bistro pizza — ham, mushrooms, olives', fr: 'La classique des pizzerias françaises — jambon, champignons, olives' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'kids', 'party'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 8, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 2, boldness: 2, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.mushrooms, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes du Rhône or rosé', fr: 'Côtes du Rhône ou rosé' },
  },

  {
    id: 'la_royale',
    name: { en: 'La Royale', fr: 'La Royale' },
    story: { en: 'Ham + salami + peppers — the generously topped French classic', fr: 'Jambon + salami + poivrons — la classique bien garnie' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'party'],
    dietary: [],
    budget: 1, complexity: 1, prepMinutes: 10, ovenTemp: 'high',
    wine: ['lr', 'ro'],
    flavour: { richness: 3, boldness: 3, creative: 1, refined: 2 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.salami, ING.mixedPeppers, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes du Rhône or Languedoc red', fr: 'Côtes du Rhône ou rouge du Languedoc' },
  },

  {
    id: 'la_paysanne',
    name: { en: 'La Paysanne', fr: 'La Paysanne' },
    story: { en: 'Rustic farmhouse pizza — lardons, potatoes, crème fraîche', fr: 'La pizza paysanne — lardons, pommes de terre, crème fraîche' },
    category: 'french_regional', region: 'lyonnais',
    base: 'bianca_cream', season: ['autumn', 'winter'],
    occasion: ['classic', 'party'],
    dietary: [],
    budget: 1, complexity: 2, prepMinutes: 20, ovenTemp: 'mid',
    wine: ['cw', 'lr'],
    flavour: { richness: 4, boldness: 2, creative: 2, refined: 2 },
    ingredients: [ING.cremeFraiche, ING.fiordilatte, ING.smokedLardons, ING.thinPotato, ING.redOnion, ING.freshChives],
    wineNote: { en: 'Mâcon white or light Burgundy red', fr: 'Mâcon blanc ou Bourgogne rouge léger' },
  },

  {
    id: 'quatre_saisons',
    name: { en: 'Quatre Saisons', fr: 'Quatre Saisons' },
    story: { en: 'Four quarters, four toppings — artichoke, ham, olives, mushrooms', fr: 'Quatre quarts, quatre garnitures — artichaut, jambon, olives, champignons' },
    category: 'french_regional', region: 'lyonnais',
    base: 'tomato_raw', season: ['all'],
    occasion: ['classic', 'impress'],
    dietary: [],
    budget: 2, complexity: 2, prepMinutes: 15, ovenTemp: 'high',
    wine: ['lr', 'ro', 'cw'],
    flavour: { richness: 3, boldness: 2, creative: 3, refined: 3 },
    ingredients: [ING.sanMarzano, ING.fiordilatte, ING.curedHam, ING.mushrooms, ING.artichoke, ING.blackOlives, ING.evoOil],
    wineNote: { en: 'Côtes de Provence rosé or light red', fr: 'Rosé Côtes de Provence ou rouge léger' },
  },

]

// ─── Dessert pizzas ───────────────────────────────────────────
// Shown in a separate section — always visible, never behind a filter

export const DESSERT_PIZZAS: Pizza[] = [

  {
    id: 'nutella_fraises',
    name: { en: 'Nutella & Fraises', fr: 'Nutella & Fraises' },
    story: { en: 'Always asked for — always loved', fr: 'Toujours demandée — toujours adorée' },
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
    id: 'miel_figue_mascarpone',
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
    id: 'speculoos_banane',
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
    story: { en: 'The showstopper dessert — caramelised sugar crust at the table', fr: 'Le dessert spectaculaire — sucre caramélisé à table' },
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
