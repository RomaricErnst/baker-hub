// ══════════════════════════════════════════
// BAKER HUB — Master Data File
// Single source of truth for all recipe data
// ══════════════════════════════════════════

// ── PIZZA STYLES ──────────────────────────
export const PIZZA_STYLES = {
  neapolitan: {
    name: 'Classic Neapolitan',
    nameFr: 'Napolitaine Classique',
    emoji: '🔥',
    image: '/Neapolitan.png',
    desc: 'Light, airy, charred cornicione.',
    hydration: 62, salt: 2.8, yeast: 0.08,
    oil: 0, sugar: 0,
    pref: 'none', bulkH: 3, ballW: 270,
    ovenNote: 'No oil or sugar — these burn at 450°C+.',
    flourNote: 'Caputo 00 Pizzeria or equivalent.',
  },
  newyork: {
    name: 'New York Style',
    nameFr: 'New York Style',
    emoji: '🗽',
    image: '/Newyork.png',
    desc: 'Foldable, crispy-edged big slices.',
    hydration: 62, salt: 2.5, yeast: 0.3,
    oil: 2, sugar: 0.8,
    pref: 'poolish', bulkH: 3.5, ballW: 300,
    ovenNote: 'Oil and sugar help browning at lower home oven temps.',
    flourNote: 'High-gluten bread flour (13%+ protein).',
  },
  roman: {
    name: 'Roman Teglia',
    nameFr: 'Teglia Romaine',
    emoji: '🏛️',
    image: '/Roman.png',
    desc: 'High-hydration, ultra-crispy rectangular.',
    hydration: 78, salt: 2.5, yeast: 0.2,
    oil: 3, sugar: 0,
    pref: 'biga', bulkH: 4, ballW: 700,
    ovenNote: 'Oil is essential for the crispy base.',
    flourNote: 'Strong flour W300+ for high hydration.',
  },
  pan: {
    name: 'Pan / Detroit',
    nameFr: 'Pan / Detroit',
    emoji: '🍞',
    image: '/Detroit.png',
    desc: 'Thick, fluffy, crispy-bottomed.',
    hydration: 70, salt: 2.5, yeast: 0.5,
    oil: 4, sugar: 0.5,
    pref: 'none', bulkH: 3, ballW: 600,
    ovenNote: 'High oil content — effectively fried in the pan.',
    flourNote: 'Bread flour for strong gluten structure.',
  },
  sourdough: {
    name: 'Sourdough Pizza',
    nameFr: 'Pizza au levain',
    emoji: '🌾',
    image: '/Sourdough.png',
    desc: 'Complex, tangy, naturally leavened.',
    hydration: 72, salt: 2.5, yeast: 0,
    oil: 0, sugar: 0,
    pref: 'levain', bulkH: 5, ballW: 280,
    ovenNote: 'No commercial yeast — starter only.',
    flourNote: 'Strong 00 or bread flour for long ferment.',
  },
} as const;

// ── BREAD STYLES ──────────────────────────
export const BREAD_STYLES = {
  pain_campagne: {
    name: 'Pain de campagne',
    nameFr: 'Pain de campagne',
    emoji: '🍞',
    image: '/pain_campagne.png',
    desc: 'Rustic country bread. Wheat and rye blend, thick crust.',
    hydration: 72,
    salt: 2.0,
    yeast: 0.15,
    oil: 0,
    sugar: 0,
    pref: 'none',
    bulkH: 4,
    ballW: 800,
    ovenNote: 'Dutch oven: 240°C lid on 20min, lid off 20min.',
    flourNote: 'T65 or blend T65 + 10% T130 rye.',
  },
  pain_levain: {
    name: 'Pain au levain',
    nameFr: 'Pain au levain',
    emoji: '🫙',
    image: '/pain_levain.png',
    desc: 'Wild yeast sourdough. Deep flavour, open crumb.',
    hydration: 75,
    salt: 2.0,
    yeast: 0,
    oil: 0,
    sugar: 0,
    pref: 'levain',
    bulkH: 5,
    ballW: 900,
    ovenNote: 'Dutch oven: 250°C lid on 20min, lid off 25min.',
    flourNote: 'Strong T65 or bread flour.',
  },
  baguette: {
    name: 'Baguette',
    nameFr: 'Baguette',
    emoji: '🥖',
    image: '/baguette.png',
    desc: 'Crispy crust, airy crumb. The French classic.',
    hydration: 68,
    salt: 2.2,
    yeast: 0.3,
    oil: 0,
    sugar: 0,
    pref: 'poolish',
    bulkH: 3,
    ballW: 350,
    ovenNote: 'Steam essential — add ice cubes to oven tray.',
    flourNote: 'T55 or plain bread flour.',
  },
  pain_complet: {
    name: 'Pain complet',
    nameFr: 'Pain complet',
    emoji: '🌾',
    image: '/pain_complet.png',
    desc: 'Wholemeal loaf. Nutty, dense, nutritious.',
    hydration: 70,
    salt: 2.0,
    yeast: 0.4,
    oil: 1,
    sugar: 0,
    pref: 'none',
    bulkH: 3,
    ballW: 750,
    ovenNote: 'Score deeply — wholemeal dough is denser.',
    flourNote: 'T110 or T150 wholemeal flour.',
  },
  pain_seigle: {
    name: 'Pain de seigle',
    nameFr: 'Pain de seigle',
    emoji: '🌑',
    image: '/pain_seigle.png',
    desc: 'Dark rye bread. Dense, earthy, long-lasting.',
    hydration: 78,
    salt: 2.2,
    yeast: 0.5,
    oil: 0,
    sugar: 0,
    pref: 'none',
    bulkH: 2,
    ballW: 700,
    ovenNote: 'Bake in a loaf tin. Rye spreads without support.',
    flourNote: 'T130 or T170 rye flour, minimum 60% rye.',
  },
  fougasse: {
    name: 'Fougasse',
    nameFr: 'Fougasse',
    emoji: '🌿',
    image: '/fougasse.png',
    desc: 'Provençal flatbread. Olive oil, scored leaf pattern.',
    hydration: 70,
    salt: 2.2,
    yeast: 0.5,
    oil: 4,
    sugar: 0,
    pref: 'none',
    bulkH: 2,
    ballW: 400,
    ovenNote: 'Flatten, cut leaf pattern, bake 220°C 15–18min.',
    flourNote: 'T55 or T65.',
  },
  brioche: {
    name: 'Brioche',
    nameFr: 'Brioche',
    emoji: '🥐',
    image: '/brioche.png',
    desc: 'Enriched, buttery, pillowy soft.',
    hydration: 55,
    salt: 2.0,
    yeast: 0.8,
    oil: 0,
    sugar: 4,
    pref: 'none',
    bulkH: 3,
    ballW: 500,
    ovenNote: 'Egg wash for golden colour. 180°C fan.',
    flourNote: 'T45 — lower protein for tenderness.',
  },
  pain_mie: {
    name: 'Pain de mie',
    nameFr: 'Pain de mie',
    emoji: '🍞',
    image: '/pain_mie.png',
    desc: 'Soft sandwich loaf. Fine crumb, thin crust.',
    hydration: 62,
    salt: 1.8,
    yeast: 0.6,
    oil: 3,
    sugar: 2,
    pref: 'none',
    bulkH: 2,
    ballW: 600,
    ovenNote: 'Bake in a Pullman tin with lid for square slices.',
    flourNote: 'T55 or plain flour.',
  },
  pain_viennois: {
    name: 'Pain viennois',
    nameFr: 'Pain viennois',
    emoji: '🥐',
    image: '/pain_viennois.png',
    desc: 'Viennese soft roll. Slightly sweet, milk-enriched.',
    hydration: 58,
    salt: 1.8,
    yeast: 0.7,
    oil: 2,
    sugar: 5,
    pref: 'none',
    bulkH: 2,
    ballW: 120,
    ovenNote: 'Egg wash. Score with scissors for classic look.',
    flourNote: 'T45 or T55.',
  },
} as const;

// ── OVEN TYPES ────────────────────────────
export const OVEN_TYPES = {
  pizza_oven: {
    name: 'Pizza oven',
    nameFr: 'Four à pizza',
    emoji: '🔥',
    image: '/oven_fire.png',
    desc: 'Leopard spotting, authentic cornicione, 90 sec.',
    descFr: 'Léopardage et cornicione en 90 sec.',
    hydrationDelta: -3,
    forceOil: 0,
    forceSugar: 0,
    preheatMin: 45,
  },
  home_oven_steel: {
    name: 'Home oven + stone',
    nameFr: 'Four + pierre ou acier',
    emoji: '🪨',
    image: '/oven_stone.png',
    desc: 'Crispy base, 5-7 min.',
    descFr: 'Base croustillante, 5-7 min.',
    hydrationDelta: 3,
    forceOil: null,
    forceSugar: null,
    preheatMin: 60,
  },
  home_oven_standard: {
    name: 'Home oven (standard)',
    nameFr: 'Four domestique standard',
    emoji: '🏠',
    image: '/oven_standard.png',
    desc: 'Best for thicker styles.',
    descFr: 'Idéal pour pizzas généreuses.',
    hydrationDelta: 5,
    forceOil: null,
    forceSugar: null,
    preheatMin: 30,
  },
  electric_pizza: {
    name: 'Electric pizza oven',
    nameFr: 'Four électrique à pizza',
    emoji: '⚡',
    image: '/oven_electric.png',
    desc: '400°C, easy to control.',
    descFr: '400°C, facile à contrôler.',
    hydrationDelta: -1,
    forceOil: 0,
    forceSugar: 0,
    preheatMin: 30,
  },
} as const;

// ── BREAD OVEN TYPES ──────────────────────
export const BREAD_OVEN_TYPES = {
  wood_fired: {
    name: 'Wood-fired oven',
    nameFr: 'Four à bois',
    emoji: '🔥',
    desc: 'Exceptional crust, natural steam.',
    descFr: 'Croûte exceptionnelle, vapeur naturelle.',
    hydrationDelta: 0,
    forceOil: null,
    forceSugar: null,
    preheatMin: 45,
    image: '/oven_wood_bread.png',
  },
  dutch_oven: {
    name: 'Dutch oven / Combo cooker',
    nameFr: 'Cocotte en fonte',
    emoji: '🫕',
    desc: 'Perfect steam, open crumb.',
    descFr: 'Vapeur parfaite, mie ouverte.',
    hydrationDelta: 2,
    forceOil: null,
    forceSugar: null,
    preheatMin: 45,
    image: '/oven_dutch.png',
  },
  home_oven_stone_bread: {
    name: 'Home oven + stone/steel',
    nameFr: 'Four + pierre ou acier',
    emoji: '🪨',
    desc: 'Great for baguettes and batards.',
    descFr: 'Idéal baguettes et bâtards.',
    hydrationDelta: 2,
    forceOil: null,
    forceSugar: null,
    preheatMin: 45,
    image: '/oven_stone_bread.png',
  },
  steam_oven: {
    name: 'Steam oven',
    nameFr: 'Four vapeur',
    emoji: '💨',
    desc: 'Professional results every time.',
    descFr: 'Résultats professionnels garantis.',
    hydrationDelta: 3,
    forceOil: null,
    forceSugar: null,
    preheatMin: 30,
    image: '/oven_steam.png',
  },
  standard_bread: {
    name: 'Standard home oven',
    nameFr: 'Four domestique standard',
    emoji: '🏠',
    desc: 'Best for enriched breads.',
    descFr: 'Idéal pour pains enrichis.',
    hydrationDelta: 3,
    forceOil: null,
    forceSugar: null,
    preheatMin: 20,
    image: '/oven_standard_bread.png',
  },
} as const;

// ── MIXER TYPES ───────────────────────────
export const MIXER_TYPES = {
  stand: {
    name: 'Stand Mixer',
    emoji: '⚙️',
    image: '/mixer_stand.png',
    desc: 'KitchenAid, Kenwood, Bosch',
    maxHydration: 72,
    kneadMin: 8,
    folds: 2,
    instructions: 'Speed 1 for 2 min to combine, Speed 2 for 6–8 min until dough clears the bowl.',
  },
  hand: {
    name: 'By Hand',
    emoji: '🙌',
    image: '/mixer_hand.png',
    desc: 'Classic technique',
    maxHydration: 70,
    kneadMin: 10,
    folds: 4,
    instructions: 'Mix until shaggy, rest 20 min (autolyse), then knead 8–10 min until smooth and elastic. Dough passes windowpane test.',
  },
  no_knead: {
    name: 'No-Knead',
    emoji: '⏰',
    image: '/mixer_noknead.png',
    desc: 'Time does the work',
    maxHydration: 100,
    kneadMin: 0,
    folds: 4,
    instructions: 'Mix just until no dry flour remains (~2 min). Time and stretch & folds develop the gluten.',
  },
  spiral: {
    name: 'Spiral Mixer',
    emoji: '🌀',
    image: '/mixer_spiral.png',
    desc: 'Ooni Halo, Famag, Sunmix',
    maxHydration: 100,
    kneadMin: 14,
    folds: 1,
    instructions: '1st speed 3 min, 2nd speed 5–7 min. Handles high hydration effortlessly. In hot kitchens (≥26°C): add ice cubes directly into the mixing bowl with the water — the breaker bar will break them down as mixing progresses. This is the professional technique used in pizzerias in warm climates. Aim for roughly 20–30% ice by weight of your total water. For other mixers use ice-cold water only — ice cubes can damage stand mixer hooks.',
  },
} as const;

// ── YEAST TYPES ───────────────────────────
export const YEAST_TYPES = {
  instant: {
    name: 'Instant Dry',
    shortName: 'IDY',
    emoji: '🟡',
    image: '/yeast_instant.png',
    also: 'Rapid rise, Fast action, Easy bake',
    form: 'Fine powder or tiny granules',
    color: 'Light beige/cream',
    usage: 'Add directly to flour — no proofing needed',
    shelfLife: '1–2 years sealed',
    conversion: 1.00,
    commonIn: 'Europe, professional baking',
  },
  active_dry: {
    name: 'Active Dry',
    shortName: 'ADY',
    emoji: '🟤',
    image: '/yeast_active.png',
    also: 'Traditional yeast, Dry yeast',
    form: 'Larger brown granules',
    color: 'Tan/brown',
    usage: 'Dissolve in warm water (38–43°C) for 5–10 min before adding to flour',
    shelfLife: '1 year sealed',
    conversion: 1.33,
    commonIn: 'USA, widely available',
  },
  fresh: {
    name: 'Fresh Yeast',
    shortName: 'Fresh',
    emoji: '🧱',
    image: '/yeast_fresh.png',
    also: 'Cake yeast, Compressed yeast',
    form: 'Soft block, crumbly',
    color: 'Beige/grey, slightly moist',
    usage: 'Crumble directly into dough or dissolve in water',
    shelfLife: '1–2 weeks refrigerated',
    conversion: 3.00,
    commonIn: 'Professional bakeries, Europe',
  },
  sourdough: {
    name: 'Sourdough Starter',
    shortName: 'Starter',
    emoji: '🫙',
    image: '/yeast_sourdough.png',
    also: 'Levain, Wild yeast',
    form: 'Thick paste or liquid',
    color: 'Off-white to grey',
    usage: 'Feed 4–12h before use. Use at peak activity.',
    shelfLife: 'Indefinite if maintained',
    conversion: 0,
    commonIn: 'Artisan baking worldwide',
  },
} as const;

// ── FLOUR DATA ────────────────────────────
export const FLOUR_DATA = {
  pizza00: {
    name: 'Pizza flour 00',
    nameFr: 'Farine à pizza 00',
    w: 250,
    protein: 12.5,
    hydrationBase: 62,
    hydrationDelta: 0,
    fermTolerance: 1.0,
    absorbency: 1.0,
  },
  strong00: {
    name: 'Strong 00 W270+',
    nameFr: 'Farine 00 forte W270+',
    w: 300,
    protein: 13.5,
    hydrationBase: 65,
    hydrationDelta: +2,
    fermTolerance: 1.2,
    absorbency: 1.05,
  },
  bread: {
    name: 'Bread flour / T65',
    nameFr: 'Farine à pain / T65',
    w: 200,
    protein: 11.5,
    hydrationBase: 65,
    hydrationDelta: +1,
    fermTolerance: 0.9,
    absorbency: 1.02,
  },
  allpurpose: {
    name: 'All-purpose / T55',
    nameFr: 'Farine tout usage / T55',
    w: 130,
    protein: 10.0,
    hydrationBase: 60,
    hydrationDelta: -2,
    fermTolerance: 0.75,
    absorbency: 0.97,
  },
  semolina: {
    name: 'Semolina / Semola rimacinata',
    nameFr: 'Semoule fine / Semola',
    w: 180,
    protein: 12.0,
    hydrationBase: 60,
    hydrationDelta: -1,
    fermTolerance: 0.85,
    absorbency: 0.95,
  },
  wholemeal: {
    name: 'Wholemeal / T110',
    nameFr: 'Farine complète / T110',
    w: 160,
    protein: 13.0,
    hydrationBase: 72,
    hydrationDelta: +4,
    fermTolerance: 0.8,
    absorbency: 1.10,
  },
  rye: {
    name: 'Rye / T130',
    nameFr: 'Seigle / T130',
    w: 120,
    protein: 8.0,
    hydrationBase: 75,
    hydrationDelta: +6,
    fermTolerance: 0.7,
    absorbency: 1.15,
  },
} as const;

export type FlourKey = keyof typeof FLOUR_DATA;

// ── FLOUR BRANDS ──────────────────────────
export const FLOUR_BRANDS = {
  caputo: {
    name: 'Caputo',
    logo: '🔵',
    products: [
      { name: 'Pizzeria', w: 260, protein: 12.5, desc: 'Blue bag — most common, 24-48h' },
      { name: 'Cuoco', w: 300, protein: 13.0, desc: 'Red bag — strong, 48-72h' },
      { name: 'Nuvola', w: 270, protein: 12.5, desc: 'Light airy cornicione' },
      { name: 'Saccorosso', w: 330, protein: 13.5, desc: 'Professional, 72h+' },
    ],
  },
  stagioni: {
    name: '5 Stagioni',
    logo: '⭐',
    products: [
      { name: 'Pizza', w: 270, protein: 12.5, desc: 'Classic — 24-48h' },
      { name: 'Napoletana', w: 290, protein: 13.0, desc: 'Long ferment — 48-72h' },
      { name: 'Gold', w: 380, protein: 14.0, desc: 'Professional — 72h+' },
    ],
  },
} as const;

export type BrandKey = keyof typeof FLOUR_BRANDS;

// ── PREFERMENT TYPES ──────────────────────
export const PREFERMENT_TYPES = {
  none: {
    name: 'Direct',
    nameFr: 'Direct',
    emoji: '⚡',
    desc: 'No preferment — mix everything together.',
    descFr: 'Sans pré-ferment — tout mélanger directement.',
    flourPct: 0,
    hydration: 0,
    yeastPct: 0,
    fermentHours: 0,
    fermentTemp: 0,
    cold: false,
    yeastReduction: 0,
    flavourNote: '',
    bestFor: [] as string[],
  },
  poolish: {
    name: 'Poolish',
    nameFr: 'Poolish',
    emoji: '🏺',
    desc: 'Liquid pre-ferment. Adds extensibility and complex flavour.',
    descFr: 'Pré-ferment liquide. Apporte extensibilité et saveur complexe.',
    flourPct: 50,
    hydration: 100,
    yeastPct: 0.2,
    fermentHoursMin: 8,
    fermentHoursMax: 16,
    fermentTemp: 20,
    cold: false,
    yeastReduction: 0.30,
    flavourNote: 'Extensible, open crumb, mild tang.',
    flavourNoteFr: 'Pâte extensible, mie ouverte, légèrement acidulé.',
    bestFor: ['baguette', 'newyork', 'roman'] as string[],
  },
  biga: {
    name: 'Biga',
    nameFr: 'Biga',
    emoji: '🧱',
    desc: 'Stiff Italian pre-ferment. Adds structure, strength and complex flavour.',
    descFr: 'Pré-ferment rigide italien. Structure, force et saveur complexe.',
    flourPct: 45,
    hydration: 45,
    yeastPct: 0.5,
    fermentHoursMin: 16,
    fermentHoursMax: 48,
    fermentTemp: 4,
    cold: true,
    yeastReduction: 0.40,
    flavourNote: 'Strong structure, complex flavour, ideal for high hydration.',
    flavourNoteFr: 'Structure forte, saveur complexe, idéal pour haute hydratation.',
    bestFor: ['roman', 'newyork', 'pain_campagne'] as string[],
  },
  levain: {
    name: 'Levain / Sourdough',
    nameFr: 'Levain',
    emoji: '🫙',
    desc: 'Wild yeast preferment. Deep flavour, better digestibility.',
    descFr: 'Pré-ferment au levain naturel. Saveur profonde, meilleure digestibilité.',
    flourPct: 20,
    hydration: 100,
    yeastPct: 0,
    fermentHoursMin: 4,
    fermentHoursMax: 12,
    fermentTemp: 24,
    cold: false,
    yeastReduction: 1.0,
    flavourNote: 'Tangy, digestible, unique wild yeast character.',
    flavourNoteFr: 'Acidulé, digestible, caractère unique du levain naturel.',
    bestFor: ['neapolitan', 'pain_levain', 'baguette'] as string[],
  },
} as const;

export type PrefermentType = keyof typeof PREFERMENT_TYPES;

export function computePrefermentRecipe(
  prefermentType: PrefermentType,
  totalFlourGrams: number,
  totalWaterGrams: number,
): {
  prefFlour: number;
  prefWater: number;
  prefYeastGrams: number;
  finalFlour: number;
  finalWater: number;
  fermentHoursMin: number;
  fermentHoursMax: number;
  cold: boolean;
  schedule: string;
  scheduleFr: string;
} | null {
  if (prefermentType === 'none') return null;
  const p = PREFERMENT_TYPES[prefermentType];

  const prefFlour = Math.round(totalFlourGrams * p.flourPct / 100);
  const prefWater = Math.round(prefFlour * p.hydration / 100);
  const prefYeastGrams = Math.round(prefFlour * p.yeastPct / 100 * 10) / 10;
  const finalFlour = totalFlourGrams - prefFlour;
  const finalWater = totalWaterGrams - prefWater;

  const cold = p.cold;
  const fermentHoursMin = p.fermentHoursMin;
  const fermentHoursMax = p.fermentHoursMax;

  const schedule = cold
    ? `Mix preferment ${fermentHoursMax}h before baking. Ferment in fridge at ${p.fermentTemp}°C.`
    : `Mix preferment ${fermentHoursMin}–${fermentHoursMax}h before baking. Ferment at room temperature.`;

  const scheduleFr = cold
    ? `Préparez le pré-ferment ${fermentHoursMax}h avant la cuisson. Fermentez au frigo à ${p.fermentTemp}°C.`
    : `Préparez le pré-ferment ${fermentHoursMin}–${fermentHoursMax}h avant la cuisson. Fermentez à température ambiante.`;

  return {
    prefFlour,
    prefWater,
    prefYeastGrams,
    finalFlour,
    finalWater,
    fermentHoursMin,
    fermentHoursMax,
    cold,
    schedule,
    scheduleFr,
  };
}

export interface FlourBlend {
  flour1: FlourKey;
  flour2: FlourKey | null;
  ratio1: number;        // 0-100, percentage of flour1
  wOverride?: number;    // manual W value override
  brandKey?: BrandKey;   // selected brand
  brandProduct?: string; // selected product name
}

export interface BlendProfile {
  blendedW: number;
  hydrationDelta: number;
  fermToleranceMultiplier: number;
  displayName: string;
  displayNameFr: string;
}

export function computeBlendProfile(blend: FlourBlend): BlendProfile {
  const f1 = FLOUR_DATA[blend.flour1];
  const effectiveW1 = blend.wOverride ?? f1.w;
  if (!blend.flour2 || blend.ratio1 === 100) {
    return {
      blendedW: effectiveW1,
      hydrationDelta: f1.hydrationDelta,
      fermToleranceMultiplier: f1.fermTolerance,
      displayName: f1.name,
      displayNameFr: f1.nameFr,
    };
  }
  const f2 = FLOUR_DATA[blend.flour2];
  const r1 = blend.ratio1 / 100;
  const r2 = 1 - r1;
  return {
    blendedW: Math.round(effectiveW1 * r1 + f2.w * r2),
    hydrationDelta: Math.round((f1.hydrationDelta * r1 + f2.hydrationDelta * r2) * 10) / 10,
    fermToleranceMultiplier: Math.round((f1.fermTolerance * r1 + f2.fermTolerance * r2) * 100) / 100,
    displayName: blend.ratio1 === 50
      ? `${f1.name} + ${f2.name}`
      : `${blend.ratio1}% ${f1.name} + ${100 - blend.ratio1}% ${f2.name}`,
    displayNameFr: blend.ratio1 === 50
      ? `${f1.nameFr} + ${f2.nameFr}`
      : `${blend.ratio1}% ${f1.nameFr} + ${100 - blend.ratio1}% ${f2.nameFr}`,
  };
}

// ── TYPE EXPORTS ──────────────────────────
export type PizzaStyleKey = keyof typeof PIZZA_STYLES;
export type BreadStyleKey = keyof typeof BREAD_STYLES;
export type StyleKey = PizzaStyleKey | BreadStyleKey;
export type BakeType = 'pizza' | 'bread';
export type OvenType = keyof typeof OVEN_TYPES;
export type BreadOvenType = keyof typeof BREAD_OVEN_TYPES;
export type AnyOvenType = OvenType | BreadOvenType;
export type MixerType = keyof typeof MIXER_TYPES;
export type YeastType = keyof typeof YEAST_TYPES;

export const ALL_STYLES = { ...PIZZA_STYLES, ...BREAD_STYLES };