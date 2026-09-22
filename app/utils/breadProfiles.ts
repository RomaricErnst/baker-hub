/** New bread defaults are product adaptations of the linked primary recipes.
 * Timing uses the existing climate/dose engine; these are not new kinetic coefficients.
 * Oil/sugar below belong to dough only; pan oil, toppings and fillings are separate.
 */
export interface BreadProtocol {
  method: 'yeasted' | 'unleavened';
  cooking: 'oven' | 'griddle' | 'boil-bake';
  supportedPreferments: readonly ('none' | 'poolish' | 'biga' | 'levain')[];
  equipment: readonly string[];
  supportedMixers: readonly ('hand' | 'stand' | 'spiral' | 'no_knead')[];
  portions: {weight: number; count: number};
  shaping: {en: string[]; fr: string[]};
  proof: {en: string[]; fr: string[]};
  preheat: {en: string[]; fr: string[]};
  cookingSteps: {en: string[]; fr: string[]};
  cooling: {en: string[]; fr: string[]};
  sourceUrls: string[];
  ovenTempC: number | null;
  cookMinutes: [number, number];
  restMinutes?: number;
}

export const BREAD_STYLE_DEFINITIONS = {
  "focaccia": {
    "name": "Focaccia",
    "nameFr": "Focaccia",
    "emoji": "🫓",
    "image": "/images/approved/bread/focaccia-rustic.webp",
    "desc": "Airy olive-oil bread baked in a tray.",
    "descFr": "Pain alvéolé à l’huile d’olive, cuit en plaque.",
    "hydration": 75,
    "salt": 2,
    "yeast": 0.3,
    "oil": 5,
    "sugar": 0,
    "pref": "none",
    "bulkH": 3,
    "ballW": 700,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "bagel": {
    "name": "Bagel",
    "nameFr": "Bagel",
    "emoji": "🥯",
    "image": "/images/approved/bread/bagel-rustic.webp",
    "desc": "Chewy rings, poached before baking.",
    "descFr": "Anneaux moelleux et denses, pochés avant cuisson.",
    "hydration": 60,
    "salt": 2,
    "yeast": 0.3,
    "oil": 0,
    "sugar": 3,
    "pref": "none",
    "bulkH": 4,
    "ballW": 110,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "pita": {
    "name": "Pocket pita",
    "nameFr": "Pita à poche",
    "emoji": "🫓",
    "image": "/images/approved/bread/pita-rustic.webp",
    "desc": "Thin rounds that puff into a pocket.",
    "descFr": "Disques fins qui gonflent pour former une poche.",
    "hydration": 63,
    "salt": 2,
    "yeast": 0.3,
    "oil": 3,
    "sugar": 1,
    "pref": "none",
    "bulkH": 3,
    "ballW": 100,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "greek_pita": {
    "name": "Greek pita",
    "nameFr": "Pita grecque",
    "emoji": "🫓",
    "image": "/images/approved/bread/greek_pita-rustic.webp",
    "desc": "Soft, pocketless flatbread for wrapping.",
    "descFr": "Pain plat souple sans poche, à garnir et replier.",
    "hydration": 68,
    "salt": 2,
    "yeast": 0.3,
    "oil": 0,
    "sugar": 1,
    "pref": "none",
    "bulkH": 3,
    "ballW": 140,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "kebab_bread": {
    "name": "Kebab bread",
    "nameFr": "Pain kebab",
    "emoji": "🫓",
    "image": "/images/approved/bread/kebab_bread-rustic.webp",
    "desc": "Soft oval sandwich bread, inspired by Turkish pide.",
    "descFr": "Pain ovale moelleux pour sandwich, inspiré du pide turc.",
    "hydration": 65,
    "salt": 2,
    "yeast": 0.3,
    "oil": 3,
    "sugar": 1,
    "pref": "none",
    "bulkH": 4,
    "ballW": 180,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "batbout": {
    "name": "Batbout",
    "nameFr": "Batbout",
    "emoji": "🫓",
    "image": "/images/approved/bread/batbout-rustic.webp",
    "desc": "Moroccan semolina pocket bread cooked in a pan.",
    "descFr": "Petit pain marocain à la semoule, cuit à la poêle.",
    "hydration": 65,
    "salt": 2,
    "yeast": 0.3,
    "oil": 1,
    "sugar": 1,
    "pref": "none",
    "bulkH": 3,
    "ballW": 100,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; use fine durum semolina for about one third of the blend."
  },
  "laffa": {
    "name": "Laffa",
    "nameFr": "Laffa",
    "emoji": "🫓",
    "image": "/images/approved/bread/laffa-rustic.webp",
    "desc": "Large, thin flatbread for generous wraps.",
    "descFr": "Grande galette fine et souple pour wraps.",
    "hydration": 68,
    "salt": 2,
    "yeast": 0.3,
    "oil": 5,
    "sugar": 1.5,
    "pref": "none",
    "bulkH": 3,
    "ballW": 160,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "piadina": {
    "name": "Piadina",
    "nameFr": "Piadina",
    "emoji": "🫓",
    "image": "/images/approved/bread/piadina-rustic.webp",
    "desc": "Unleavened olive-oil flatbread; rest, roll and pan-cook.",
    "descFr": "Galette sans levure à l’huile d’olive : repos, abaisse et poêle.",
    "hydration": 50,
    "salt": 1.5,
    "yeast": 0,
    "oil": 10,
    "sugar": 0,
    "pref": "none",
    "bulkH": 0.5,
    "ballW": 140,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "pan_bagnat": {
    "name": "Pan bagnat roll",
    "nameFr": "Pain pour pan bagnat",
    "emoji": "🥖",
    "image": "/images/approved/bread/pan_bagnat-rustic.webp",
    "desc": "Round sandwich roll for a Niçoise-style filling.",
    "descFr": "Pain rond à sandwich pour une garniture niçoise.",
    "hydration": 62,
    "salt": 2,
    "yeast": 0.3,
    "oil": 6,
    "sugar": 0,
    "pref": "none",
    "bulkH": 4,
    "ballW": 220,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "ciabatta": {
    "name": "Ciabatta",
    "nameFr": "Ciabatta",
    "emoji": "🥖",
    "image": "/images/approved/bread/ciabatta-rustic.webp",
    "desc": "Flour-dusted rectangles with a light, open crumb.",
    "descFr": "Rectangles farinés, mie légère et très alvéolée.",
    "hydration": 78,
    "salt": 2,
    "yeast": 0.3,
    "oil": 0,
    "sugar": 0,
    "pref": "none",
    "bulkH": 3,
    "ballW": 250,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  },
  "panuozzo": {
    "name": "Panuozzo",
    "nameFr": "Panuozzo",
    "emoji": "🫓",
    "image": "/images/approved/bread/panuozzo-rustic.webp",
    "desc": "Pizza-dough sandwich bread, baked then filled.",
    "descFr": "Pain-sandwich en pâte à pizza, cuit puis garni.",
    "hydration": 65,
    "salt": 2,
    "yeast": 0.3,
    "oil": 0,
    "sugar": 0,
    "pref": "none",
    "bulkH": 2,
    "ballW": 280,
    "ovenNote": "Follow the style-specific shaping and cooking steps.",
    "flourNote": "Bread flour; adjust water to its absorption."
  }
} as const;

export const BREAD_FERMENTATION_DEFAULTS = {
  "focaccia": {
    "coldH": 12,
    "rtH": 3,
    "minColdH": 4,
    "minTotalFermH": 4,
    "preferredColdH": 16
  },
  "bagel": {
    "coldH": 0,
    "rtH": 4,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "pita": {
    "coldH": 0,
    "rtH": 3,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "greek_pita": {
    "coldH": 0,
    "rtH": 3,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "kebab_bread": {
    "coldH": 0,
    "rtH": 4,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "batbout": {
    "coldH": 0,
    "rtH": 3,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "laffa": {
    "coldH": 0,
    "rtH": 3,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "piadina": {
    "coldH": 0,
    "rtH": 0.5,
    "minColdH": 0,
    "minTotalFermH": 0.5
  },
  "pan_bagnat": {
    "coldH": 0,
    "rtH": 4,
    "minColdH": 0,
    "minTotalFermH": 2
  },
  "ciabatta": {
    "coldH": 12,
    "rtH": 3,
    "minColdH": 4,
    "minTotalFermH": 6,
    "preferredColdH": 16
  },
  "panuozzo": {
    "coldH": 24,
    "rtH": 2,
    "minColdH": 4,
    "minTotalFermH": 8,
    "preferredColdH": 28
  }
} as const;

export const BREAD_PROTOCOLS: Record<keyof typeof BREAD_STYLE_DEFINITIONS, BreadProtocol> = {
  "focaccia": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none",
      "poolish",
      "biga",
      "levain"
    ],
    "equipment": [
      "standard_bread",
      "home_oven_stone_bread",
      "steam_oven",
      "wood_fired"
    ],
    "portions": {
      "weight": 700,
      "count": 1
    },
    "shaping": {
      "en": [
        "Oil the tray, gently spread the dough, then rest if it resists stretching."
      ],
      "fr": [
        "Huilez la plaque, étirez doucement la pâte et laissez-la se détendre si elle résiste."
      ]
    },
    "proof": {
      "en": [
        "Let the dough become bubbly and jiggly. Oil your fingers and dimple without flattening it."
      ],
      "fr": [
        "Attendez une pâte bulleuse et souple. Huilez les doigts et creusez des empreintes sans l’aplatir."
      ]
    },
    "preheat": {
      "en": [
        "Heat the oven to 230°C; use an oiled metal tray."
      ],
      "fr": [
        "Préchauffez à 230 °C ; utilisez une plaque métallique huilée."
      ]
    },
    "cookingSteps": {
      "en": [
        "Bake at 230°C for about 20–25 minutes, until the top and underside are golden."
      ],
      "fr": [
        "Cuisez à 230 °C environ 20–25 min, jusqu’à dorer le dessus et le dessous."
      ]
    },
    "cooling": {
      "en": [
        "Lift from the tray and cool on a rack for 15 minutes."
      ],
      "fr": [
        "Démoulez et laissez tiédir 15 min sur une grille."
      ]
    },
    "sourceUrls": [
      "https://www.kingarthurbaking.com/recipes/big-and-bubbly-focaccia-recipe"
    ],
    "ovenTempC": 230,
    "cookMinutes": [
      20,
      25
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "bagel": {
    "method": "yeasted",
    "cooking": "boil-bake",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "standard_bread",
      "home_oven_stone_bread",
      "steam_oven",
      "wood_fired"
    ],
    "portions": {
      "weight": 110,
      "count": 6
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g. Form tight balls, pierce the centre and widen each hole."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g. Boulez, percez le centre et élargissez chaque trou."
      ]
    },
    "proof": {
      "en": [
        "Rest covered until slightly puffy. A test ring should float in water; if it sinks, give the others more time."
      ],
      "fr": [
        "Laissez légèrement gonfler à couvert. Testez un anneau dans l’eau : s’il coule, prolongez le repos des autres."
      ]
    },
    "preheat": {
      "en": [
        "Heat the oven to 220°C and bring a wide saucepan of water to a gentle boil."
      ],
      "fr": [
        "Préchauffez à 220 °C et portez une grande casserole d’eau à petite ébullition."
      ]
    },
    "cookingSteps": {
      "en": [
        "Poach a few bagels at a time for about 30 seconds per side, then drain onto a lined tray.",
        "Bake at 220°C for 20–25 minutes, until deeply golden."
      ],
      "fr": [
        "Pochez quelques bagels à la fois environ 30 s par face, puis égouttez-les sur une plaque chemisée.",
        "Cuisez à 220 °C pendant 20–25 min, jusqu’à une couleur bien dorée."
      ]
    },
    "cooling": {
      "en": [
        "Cool on a rack for at least 20 minutes before slicing."
      ],
      "fr": [
        "Laissez refroidir sur une grille au moins 20 min avant de couper."
      ]
    },
    "sourceUrls": [
      "https://www.kingarthurbaking.com/recipes/water-bagels-recipe",
      "https://www.kingarthurbaking.com/recipes/martins-bagels-recipe"
    ],
    "ovenTempC": 220,
    "cookMinutes": [
      20,
      25
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral"
    ]
  },
  "pita": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "home_oven_stone_bread",
      "standard_bread",
      "wood_fired"
    ],
    "portions": {
      "weight": 100,
      "count": 6
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g; rest covered, then roll evenly to 3–4 mm without tearing."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g ; détendez à couvert puis abaissez uniformément à 3–4 mm sans déchirer."
      ]
    },
    "proof": {
      "en": [
        "Keep the rolled rounds covered while the oven heats; their surface must not dry out."
      ],
      "fr": [
        "Gardez les disques abaissés couverts pendant la chauffe ; leur surface ne doit pas sécher."
      ]
    },
    "preheat": {
      "en": [
        "Heat a stone, steel or heavy tray thoroughly at 250°C."
      ],
      "fr": [
        "Chauffez bien une pierre, un acier ou une plaque épaisse à 250 °C."
      ]
    },
    "cookingSteps": {
      "en": [
        "Bake in small batches for 3–5 minutes until inflated and just set; avoid drying them out."
      ],
      "fr": [
        "Cuisez par petites fournées 3–5 min jusqu’à gonflement et cuisson complète, sans les dessécher."
      ]
    },
    "cooling": {
      "en": [
        "Stack under a clean towel to keep soft; let steam settle before cutting the pocket."
      ],
      "fr": [
        "Empilez sous un torchon propre pour garder le moelleux ; laissez retomber la vapeur avant d’ouvrir la poche."
      ]
    },
    "sourceUrls": [
      "https://www.kingarthurbaking.com/recipes/golden-pita-bread-recipe"
    ],
    "ovenTempC": 250,
    "cookMinutes": [
      3,
      5
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "greek_pita": {
    "method": "yeasted",
    "cooking": "griddle",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "griddle"
    ],
    "portions": {
      "weight": 140,
      "count": 6
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g. Rest, then press into thick rounds; dimple or dock to avoid a full pocket."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g. Détendez puis étalez en disques épais ; marquez ou piquez pour éviter une grande poche."
      ]
    },
    "proof": {
      "en": [
        "After bulk rise, rest the portions covered for about 15 minutes so they stretch easily."
      ],
      "fr": [
        "Après la première pousse, détendez les pâtons environ 15 min à couvert pour les étaler facilement."
      ]
    },
    "preheat": {
      "en": [
        "Heat a heavy pan over medium heat and wipe with a little oil."
      ],
      "fr": [
        "Chauffez une poêle épaisse à feu moyen et huilez-la légèrement."
      ]
    },
    "cookingSteps": {
      "en": [
        "Cook about 3 minutes per side until lightly coloured and cooked through, keeping the bread flexible."
      ],
      "fr": [
        "Cuisez environ 3 min par face, jusqu’à légère coloration et cuisson à cœur, en gardant le pain souple."
      ]
    },
    "cooling": {
      "en": [
        "Stack under a towel and serve warm."
      ],
      "fr": [
        "Empilez sous un torchon et servez tiède."
      ]
    },
    "sourceUrls": [
      "https://www.mygreekdish.com/recipe/the-easiest-homemade-pita-bread/"
    ],
    "ovenTempC": null,
    "cookMinutes": [
      5,
      7
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "kebab_bread": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "standard_bread",
      "home_oven_stone_bread",
      "steam_oven",
      "wood_fired"
    ],
    "portions": {
      "weight": 180,
      "count": 4
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g and flatten into thick ovals. Mark a shallow grid with your fingertips."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g et aplatissez en ovales épais. Marquez un quadrillage avec les doigts."
      ]
    },
    "proof": {
      "en": [
        "Keep covered until visibly puffy; follow the dough as well as the planned time."
      ],
      "fr": [
        "Gardez couvert jusqu’à une pâte visiblement gonflée ; observez-la en plus du planning."
      ]
    },
    "preheat": {
      "en": [
        "Heat the oven to 220°C with a heavy tray."
      ],
      "fr": [
        "Préchauffez à 220 °C avec une plaque épaisse."
      ]
    },
    "cookingSteps": {
      "en": [
        "Bake for about 15–20 minutes until golden and cooked inside; these are thick sandwich breads, not pocket pitas."
      ],
      "fr": [
        "Cuisez environ 15–20 min jusqu’à dorer et cuire à cœur ; ce sont des pains à sandwich épais, pas des pitas à poche."
      ]
    },
    "cooling": {
      "en": [
        "Cover loosely with a towel; let cool enough to split horizontally."
      ],
      "fr": [
        "Couvrez légèrement d’un torchon ; laissez tiédir avant de fendre horizontalement."
      ]
    },
    "sourceUrls": [
      "https://vidarbergum.com/recipe/turkish-flatbread-zaatar-zahterli-pide/"
    ],
    "ovenTempC": 220,
    "cookMinutes": [
      15,
      20
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "batbout": {
    "method": "yeasted",
    "cooking": "griddle",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "griddle"
    ],
    "portions": {
      "weight": 100,
      "count": 6
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g. Dust with fine semolina and roll into discs about 5–6 mm thick."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g. Farinez de semoule fine et abaissez en disques d’environ 5–6 mm."
      ]
    },
    "proof": {
      "en": [
        "Let the shaped discs rise covered until visibly puffy; preserve them when lifting."
      ],
      "fr": [
        "Laissez gonfler les disques façonnés à couvert ; soulevez-les sans les dégazer."
      ]
    },
    "preheat": {
      "en": [
        "Heat a heavy pan over medium heat; lower it if the surface colours before the centre cooks."
      ],
      "fr": [
        "Chauffez une poêle épaisse à feu moyen ; baissez si la surface colore avant la cuisson du centre."
      ]
    },
    "cookingSteps": {
      "en": [
        "Cook on both sides, turning several times, until puffed, spotted and cooked inside. Allow about 5–8 minutes per bread."
      ],
      "fr": [
        "Cuisez des deux côtés en retournant plusieurs fois, jusqu’à gonflement et cuisson à cœur. Comptez environ 5–8 min par pain."
      ]
    },
    "cooling": {
      "en": [
        "Cool under a clean towel before opening for sandwiches."
      ],
      "fr": [
        "Laissez tiédir sous un torchon propre avant d’ouvrir pour garnir."
      ]
    },
    "sourceUrls": [
      "https://tasteofmaroc.com/batbout-moroccan-pita-bread/"
    ],
    "ovenTempC": null,
    "cookMinutes": [
      5,
      8
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "laffa": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "home_oven_stone_bread",
      "standard_bread",
      "wood_fired"
    ],
    "portions": {
      "weight": 160,
      "count": 6
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g and cover while they relax."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g et gardez-les couverts pour les détendre."
      ]
    },
    "proof": {
      "en": [
        "Let the portions become relaxed and puffy before rolling; keep the remaining dough covered."
      ],
      "fr": [
        "Attendez des pâtons détendus et gonflés avant d’abaisser ; gardez les autres couverts."
      ]
    },
    "preheat": {
      "en": [
        "Heat a stone or heavy inverted tray thoroughly at 250–260°C, within your oven’s rating."
      ],
      "fr": [
        "Chauffez bien une pierre ou une plaque épaisse retournée à 250–260 °C, selon la capacité du four."
      ]
    },
    "cookingSteps": {
      "en": [
        "Roll each portion into a large, very thin round. Bake briefly, about 1–3 minutes, until blistered and cooked but still flexible."
      ],
      "fr": [
        "Abaissez chaque pâton en un grand disque très fin. Cuisez brièvement, environ 1–3 min, jusqu’à cloques et cuisson complète en gardant sa souplesse."
      ]
    },
    "cooling": {
      "en": [
        "Stack under a towel and fill while warm."
      ],
      "fr": [
        "Empilez sous un torchon et garnissez tiède."
      ]
    },
    "sourceUrls": [
      "https://bakefromscratch.com/laffa/"
    ],
    "ovenTempC": 260,
    "cookMinutes": [
      1,
      3
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "piadina": {
    "method": "unleavened",
    "cooking": "griddle",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "griddle"
    ],
    "portions": {
      "weight": 140,
      "count": 4
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g. After the covered rest, roll each to 2–3 mm."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g. Après le repos couvert, abaissez chacun à 2–3 mm."
      ]
    },
    "proof": {
      "en": [
        "No yeast and no rise are needed: this covered rest relaxes the dough."
      ],
      "fr": [
        "Aucune levure ni pousse : ce repos couvert détend la pâte."
      ]
    },
    "preheat": {
      "en": [
        "Heat a heavy dry pan over medium-high heat."
      ],
      "fr": [
        "Chauffez une poêle épaisse sèche à feu moyen-vif."
      ]
    },
    "cookingSteps": {
      "en": [
        "Cook one at a time, about 2–3 minutes per side, until brown spots appear and the centre is cooked."
      ],
      "fr": [
        "Cuisez une galette à la fois, environ 2–3 min par face, jusqu’à des taches brunes et une pâte cuite à cœur."
      ]
    },
    "cooling": {
      "en": [
        "Stack under a towel and fill while warm and flexible."
      ],
      "fr": [
        "Empilez sous un torchon et garnissez tiède, pendant qu’elles sont souples."
      ]
    },
    "sourceUrls": [
      "https://www.giallozafferano.fr/recettes/piadina-sans-saindoux.html"
    ],
    "ovenTempC": null,
    "cookMinutes": [
      4,
      6
    ],
    "restMinutes": 30,
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "pan_bagnat": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none"
    ],
    "equipment": [
      "standard_bread",
      "home_oven_stone_bread",
      "steam_oven",
      "wood_fired"
    ],
    "portions": {
      "weight": 220,
      "count": 4
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g. Make smooth round rolls, slightly flattened for sandwiches."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g. Boulez et aplatissez légèrement pour des pains à sandwich."
      ]
    },
    "proof": {
      "en": [
        "Keep covered until visibly puffy; follow the dough as well as the planned time."
      ],
      "fr": [
        "Gardez couvert jusqu’à une pâte visiblement gonflée ; observez-la en plus du planning."
      ]
    },
    "preheat": {
      "en": [
        "Heat the oven to 220°C."
      ],
      "fr": [
        "Préchauffez le four à 220 °C."
      ]
    },
    "cookingSteps": {
      "en": [
        "Bake about 15–20 minutes until golden, adjusting for the size of your rolls."
      ],
      "fr": [
        "Cuisez environ 15–20 min jusqu’à dorer, en adaptant à la taille des pains."
      ]
    },
    "cooling": {
      "en": [
        "Cool fully on a rack before adding the moist sandwich filling."
      ],
      "fr": [
        "Refroidissez complètement sur grille avant d’ajouter la garniture humide."
      ]
    },
    "sourceUrls": [
      "https://www.marmiteag.ch/Pain-pour-pan-bagnat"
    ],
    "ovenTempC": 220,
    "cookMinutes": [
      15,
      20
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "ciabatta": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none",
      "poolish",
      "biga",
      "levain"
    ],
    "equipment": [
      "standard_bread",
      "home_oven_stone_bread",
      "steam_oven",
      "wood_fired"
    ],
    "portions": {
      "weight": 250,
      "count": 4
    },
    "shaping": {
      "en": [
        "Tip onto a well-floured bench. Cut {count} rectangles of about {weight} g; do not roll into tight balls or press out the gas."
      ],
      "fr": [
        "Versez sur un plan bien fariné. Découpez {count} rectangles d’environ {weight} g ; ne boulez pas serré et ne chassez pas le gaz."
      ]
    },
    "proof": {
      "en": [
        "Support the soft rectangles on floured cloth or paper and let them become light and aerated."
      ],
      "fr": [
        "Soutenez les rectangles souples sur une toile farinée ou du papier et laissez-les s’alléger et s’aérer."
      ]
    },
    "preheat": {
      "en": [
        "Heat the oven and baking surface to 230°C; use your oven’s steam function if available."
      ],
      "fr": [
        "Préchauffez le four et le support à 230 °C ; utilisez la fonction vapeur si disponible."
      ]
    },
    "cookingSteps": {
      "en": [
        "Transfer gently without scoring. Bake about 20–25 minutes until well coloured and the sides feel set."
      ],
      "fr": [
        "Transférez délicatement sans grigner. Cuisez environ 20–25 min jusqu’à une belle coloration et des côtés bien pris."
      ]
    },
    "cooling": {
      "en": [
        "Cool at least 30 minutes on a rack to let the moist crumb set."
      ],
      "fr": [
        "Refroidissez au moins 30 min sur grille pour laisser la mie humide se stabiliser."
      ]
    },
    "sourceUrls": [
      "https://www.kingarthurbaking.com/recipes/rustic-italian-ciabatta-recipe"
    ],
    "ovenTempC": 230,
    "cookMinutes": [
      20,
      25
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  },
  "panuozzo": {
    "method": "yeasted",
    "cooking": "oven",
    "supportedPreferments": [
      "none",
      "poolish",
      "biga",
      "levain"
    ],
    "equipment": [
      "home_oven_stone_bread",
      "standard_bread",
      "wood_fired"
    ],
    "portions": {
      "weight": 280,
      "count": 4
    },
    "shaping": {
      "en": [
        "Divide into {count} pieces of {weight} g and make loose balls, preserving the gas."
      ],
      "fr": [
        "Divisez en {count} pâtons de {weight} g et boulez doucement en gardant du gaz."
      ]
    },
    "proof": {
      "en": [
        "Keep the portions covered until relaxed and airy; stretch only when ready to bake."
      ],
      "fr": [
        "Gardez les pâtons couverts jusqu’à détente et aération ; étirez juste avant cuisson."
      ]
    },
    "preheat": {
      "en": [
        "Heat a stone or steel thoroughly at 250°C."
      ],
      "fr": [
        "Chauffez bien une pierre ou un acier à 250 °C."
      ]
    },
    "cookingSteps": {
      "en": [
        "Stretch into long ovals and bake the unfilled bread about 8–12 minutes until puffed and cooked.",
        "Split, add your filling, then return briefly to the oven if the filling needs warming."
      ],
      "fr": [
        "Étirez en ovales allongés et cuisez le pain non garni environ 8–12 min jusqu’à gonflement et cuisson complète.",
        "Fendez, garnissez puis repassez brièvement au four si la garniture doit chauffer."
      ]
    },
    "cooling": {
      "en": [
        "Rest a few minutes before splitting; serve the filled bread warm."
      ],
      "fr": [
        "Attendez quelques minutes avant de fendre ; servez le pain garni chaud."
      ]
    },
    "sourceUrls": [
      "https://ricette.giallozafferano.it/Panuozzo-napoletano.html"
    ],
    "ovenTempC": 250,
    "cookMinutes": [
      8,
      12
    ],
    "supportedMixers": [
      "hand",
      "stand",
      "spiral",
      "no_knead"
    ]
  }
};

export function getBreadProtocol(styleKey: string): BreadProtocol | undefined {
  return Object.prototype.hasOwnProperty.call(BREAD_PROTOCOLS, styleKey)
    ? BREAD_PROTOCOLS[styleKey as keyof typeof BREAD_PROTOCOLS] : undefined;
}

/** Conservative hands-on budget: one griddle bread at a time. Oven baking is passive. */
export function breadActiveCookMinutes(styleKey: string, numItems?: number): number {
  const profile = getBreadProtocol(styleKey);
  if (profile?.cooking !== 'griddle') return 0;
  const count = typeof numItems === 'number' && Number.isFinite(numItems) && numItems > 0
    ? Math.ceil(numItems) : profile.portions.count;
  return count * profile.cookMinutes[1];
}

/** Planning allowance: one minute in water plus one minute to transfer each bagel. */
export function breadPoachMinutes(styleKey: string, numItems?: number): number {
  const profile = getBreadProtocol(styleKey);
  if (profile?.cooking !== 'boil-bake') return 0;
  const count = typeof numItems === 'number' && Number.isFinite(numItems) && numItems > 0
    ? Math.ceil(numItems) : profile.portions.count;
  return count * 2;
}
