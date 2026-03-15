// ══════════════════════════════════════════
// BAKER HUB — Master Data File
// Single source of truth for all recipe data
// ══════════════════════════════════════════

// ── PIZZA STYLES ──────────────────────────
export const PIZZA_STYLES = {
  neapolitan: {
    name: 'Classic Neapolitan',
    emoji: '🔥',
    desc: 'Light, airy, charred cornicione.',
    hydration: 62, salt: 2.8, yeast: 0.08,
    oil: 0, sugar: 0,
    pref: 'none', bulkH: 3, ballW: 270,
    ovenNote: 'No oil or sugar — these burn at 450°C+.',
    flourNote: 'Caputo 00 Pizzeria or equivalent.',
  },
  newyork: {
    name: 'New York Style',
    emoji: '🗽',
    desc: 'Foldable, crispy-edged big slices.',
    hydration: 62, salt: 2.5, yeast: 0.3,
    oil: 2, sugar: 0.8,
    pref: 'poolish', bulkH: 3.5, ballW: 300,
    ovenNote: 'Oil and sugar help browning at lower home oven temps.',
    flourNote: 'High-gluten bread flour (13%+ protein).',
  },
  roman: {
    name: 'Roman Teglia',
    emoji: '🏛️',
    desc: 'High-hydration, ultra-crispy rectangular.',
    hydration: 78, salt: 2.5, yeast: 0.2,
    oil: 3, sugar: 0,
    pref: 'biga', bulkH: 4, ballW: 700,
    ovenNote: 'Oil is essential for the crispy base.',
    flourNote: 'Strong flour W300+ for high hydration.',
  },
  pan: {
    name: 'Pan / Detroit',
    emoji: '🍞',
    desc: 'Thick, fluffy, crispy-bottomed.',
    hydration: 70, salt: 2.5, yeast: 0.5,
    oil: 4, sugar: 0.5,
    pref: 'none', bulkH: 3, ballW: 600,
    ovenNote: 'High oil content — effectively fried in the pan.',
    flourNote: 'Bread flour for strong gluten structure.',
  },
  sourdough: {
    name: 'Sourdough Pizza',
    emoji: '🌾',
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
  sourdough_bread: {
    name: 'Sourdough Loaf',
    emoji: '🫓',
    desc: 'Open crumb, chewy, tangy.',
    hydration: 75, salt: 2.0, yeast: 0,
    oil: 0, sugar: 0,
    pref: 'levain', bulkH: 5, ballW: 900,
    ovenNote: 'Dutch oven: 250°C lid on 20min, lid off 25min.',
    flourNote: 'Strong bread flour or blend with wholemeal.',
  },
  baguette: {
    name: 'Baguette',
    emoji: '🥖',
    desc: 'Crispy crust, airy crumb.',
    hydration: 68, salt: 2.2, yeast: 0.3,
    oil: 0, sugar: 0,
    pref: 'poolish', bulkH: 3, ballW: 350,
    ovenNote: 'Steam essential — add ice cubes to oven tray.',
    flourNote: 'T55 or plain bread flour.',
  },
  focaccia: {
    name: 'Focaccia',
    emoji: '🥙',
    desc: 'Thick, oily, dimpled.',
    hydration: 80, salt: 2.5, yeast: 0.4,
    oil: 5, sugar: 0,
    pref: 'none', bulkH: 3.5, ballW: 800,
    ovenNote: 'Generous olive oil in pan — creates crispy base.',
    flourNote: 'Caputo Nuvola or strong bread flour.',
  },
  ciabatta: {
    name: 'Ciabatta',
    emoji: '🍞',
    desc: 'Very open crumb, high hydration.',
    hydration: 78, salt: 2.0, yeast: 0.2,
    oil: 1, sugar: 0,
    pref: 'poolish', bulkH: 4, ballW: 400,
    ovenNote: 'Steam first 10 min then dry heat for crust.',
    flourNote: 'Strong bread flour W300+.',
  },
  brioche: {
    name: 'Brioche',
    emoji: '🥐',
    desc: 'Enriched, buttery, pillowy soft.',
    hydration: 55, salt: 2.0, yeast: 0.8,
    oil: 0, sugar: 4,
    pref: 'none', bulkH: 3, ballW: 500,
    ovenNote: 'Egg wash for golden colour. 180°C fan.',
    flourNote: 'Plain flour or T45 — lower protein for tenderness.',
  },
} as const;

// ── OVEN TYPES ────────────────────────────
export const OVEN_TYPES = {
  pizza_oven: {
    name: 'Pizza oven',
    emoji: '🔥',
    desc: 'Ooni, Gozney, wood-fired. 450°C+',
    hydrationDelta: -3,
    forceOil: 0,
    forceSugar: 0,
    preheatMin: 45,
    tempNote: 'Preheat 45 min. Cook 60–90 seconds.',
  },
  home_oven_steel: {
    name: 'Home oven + steel/stone',
    emoji: '🪨',
    desc: 'Standard oven with baking steel or stone.',
    hydrationDelta: 3,
    forceOil: null,
    forceSugar: null,
    preheatMin: 60,
    tempNote: 'Preheat steel/stone 1h at max temp. Cook 5–7 min.',
  },
  home_oven_standard: {
    name: 'Home oven (standard)',
    emoji: '🏠',
    desc: 'Standard oven, no steel or stone.',
    hydrationDelta: 5,
    forceOil: null,
    forceSugar: null,
    preheatMin: 30,
    tempNote: 'Preheat 30 min at 230°C. Cook 8–12 min.',
  },
  electric_pizza: {
    name: 'Electric pizza oven',
    emoji: '⚡',
    desc: 'Breville, Effeuno, G3 Ferrari. 400°C.',
    hydrationDelta: -1,
    forceOil: 0,
    forceSugar: 0,
    preheatMin: 30,
    tempNote: 'Preheat 30 min at max. Cook 2–4 min.',
  },
} as const;

// ── MIXER TYPES ───────────────────────────
export const MIXER_TYPES = {
  hand: {
    name: 'By Hand',
    emoji: '🙌',
    desc: 'Classic technique',
    maxHydration: 70,
    kneadMin: 10,
    folds: 4,
    instructions: 'Mix until shaggy, rest 20 min (autolyse), then knead 8–10 min until smooth and elastic. Dough passes windowpane test.',
  },
  stand: {
    name: 'Stand Mixer',
    emoji: '⚙️',
    desc: 'KitchenAid, Kenwood, Bosch',
    maxHydration: 72,
    kneadMin: 8,
    folds: 2,
    instructions: 'Speed 1 for 2 min to combine, Speed 2 for 6–8 min until dough clears the bowl.',
  },
  spiral: {
    name: 'Spiral Mixer',
    emoji: '🌀',
    desc: 'Ooni Halo, Famag, Sunmix',
    maxHydration: 100,
    kneadMin: 14,
    folds: 1,
    instructions: '1st speed 3 min, 2nd speed 5–7 min. Handles high hydration effortlessly. In hot kitchens (≥26°C): add ice cubes directly into the mixing bowl with the water — the breaker bar will break them down as mixing progresses. This is the professional technique used in pizzerias in warm climates. Aim for roughly 20–30% ice by weight of your total water. For other mixers use ice-cold water only — ice cubes can damage stand mixer hooks.',
  },
  no_knead: {
    name: 'No-Knead',
    emoji: '⏰',
    desc: 'Time does the work',
    maxHydration: 100,
    kneadMin: 0,
    folds: 4,
    instructions: 'Mix just until no dry flour remains (~2 min). Time and stretch & folds develop the gluten.',
  },
} as const;

// ── YEAST TYPES ───────────────────────────
export const YEAST_TYPES = {
  instant: {
    name: 'Instant Dry',
    shortName: 'IDY',
    emoji: '🟡',
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
    also: 'Levain, Wild yeast',
    form: 'Thick paste or liquid',
    color: 'Off-white to grey',
    usage: 'Feed 4–12h before use. Use at peak activity.',
    shelfLife: 'Indefinite if maintained',
    conversion: 0,
    commonIn: 'Artisan baking worldwide',
  },
} as const;

// ── TYPE EXPORTS ──────────────────────────
export type PizzaStyleKey = keyof typeof PIZZA_STYLES;
export type BreadStyleKey = keyof typeof BREAD_STYLES;
export type StyleKey = PizzaStyleKey | BreadStyleKey;
export type BakeType = 'pizza' | 'bread';
export type OvenType = keyof typeof OVEN_TYPES;
export type MixerType = keyof typeof MIXER_TYPES;
export type YeastType = keyof typeof YEAST_TYPES;

export const ALL_STYLES = { ...PIZZA_STYLES, ...BREAD_STYLES };