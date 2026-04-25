// scripts/fix-substitutions.ts
// Programmatically patches missing goodEnough/compromise into toppingDatabase.ts
// Safe: only edits ING object entries, uses unique id: string anchors

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(__dirname, '../app/lib/toppingDatabase.ts');
let text = fs.readFileSync(DB_PATH, 'utf8');

// Helper: insert text after the first occurrence of anchor string
function insertAfter(anchor: string, insertion: string): boolean {
  const idx = text.indexOf(anchor);
  if (idx === -1) { console.error('ANCHOR NOT FOUND: ' + anchor); return false; }
  // Find the end of this line
  const lineEnd = text.indexOf('\n', idx);
  text = text.substring(0, lineEnd + 1) + insertion + text.substring(lineEnd + 1);
  console.log('OK: inserted after ' + anchor.trim().substring(0, 50));
  return true;
}

// Helper: replace one specific string with another
function replaceOnce(from: string, to: string): boolean {
  if (!text.includes(from)) { console.error('NOT FOUND: ' + from.substring(0, 60)); return false; }
  text = text.replace(from, to);
  console.log('OK: replaced ' + from.trim().substring(0, 50));
  return true;
}

// ── mozzarellaLM: insert after prepNoteByStyle block ──
// Find by unique id string
insertAfter(
  "id: 'mozzarella_lm'",
  ''  // placeholder — we use block below
);
// Reset and use block approach
text = fs.readFileSync(DB_PATH, 'utf8'); // re-read clean

// Actually use replaceOnce on unique surrounding context for each ingredient

// mozzarellaLM — find unique context: the hardToFind: false line just before qtyMultiplierByStyle
replaceOnce(
  "  mozzarellaLM: {\n    id: 'mozzarella_lm',",
  `  mozzarellaLM: {\n    id: 'mozzarella_lm',`
); // no-op test

// Better approach: find each ingredient's closing brace context and insert before it
// Use the unique id strings as anchors

const patches: Array<{id: string, field: string, code: string}> = [
  {
    id: "id: 'mozzarella_lm'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Block mozzarella (any brand)', fr: 'Mozzarella en bloc (toute marque)' },
      note: { en: 'Grate or slice thin. Melts evenly. Works perfectly for NY and Pan styles.', fr: 'Râper ou trancher finement. Fonte uniforme. Parfaite pour NY et Pan.' },
    },
    compromise: {
      name: { en: 'Mild cheddar or young gouda', fr: 'Cheddar doux ou jeune gouda' },
      note: { en: 'Melts well but flavour is noticeably different. Last resort only.', fr: 'Fond bien mais le goût est différent. En dernier recours uniquement.' },
    },
`,
  },
  {
    id: "id: 'fior_di_latte'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Fresh mozzarella ball (any brand)', fr: 'Boule de mozzarella fraîche (toute marque)' },
      note: { en: 'Slice 5mm and drain 20-30 min on paper. Minimal difference in most home ovens.', fr: 'Trancher à 5mm et égoutter 20-30 min. Différence minime dans la plupart des fours domestiques.' },
    },
    compromise: {
      name: { en: 'Low-moisture mozzarella block', fr: 'Mozzarella en bloc faible humidité' },
      note: { en: 'No draining needed but loses the fresh milky character. Melts more evenly.', fr: 'Pas besoin d\'égoutter mais perd le caractère lacté frais. Fonte plus uniforme.' },
    },
`,
  },
  {
    id: "id: 'creme_fraiche'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Full-fat sour cream', fr: 'Crème aigre entière' },
      note: { en: 'Very close — same tang, slightly thinner. Full-fat only: light versions split in the oven.', fr: 'Très proche — même acidité, légèrement plus liquide. Entière uniquement : les allégées se séparent au four.' },
    },
    compromise: {
      name: { en: 'Full-fat Greek yogurt (strained overnight)', fr: 'Yaourt grec entier (égoutté une nuit)' },
      note: { en: 'Strain overnight in a sieve. Tangier and less rich — spread thinly.', fr: 'Égoutter une nuit dans une passoire. Plus acide et moins riche — étaler finement.' },
    },
`,
  },
  {
    id: "id: 'ricotta'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Fromage blanc or quark (well-drained)', fr: 'Fromage blanc ou quark (bien égoutté)' },
      note: { en: 'Season with salt and nutmeg as you would ricotta. Slightly wetter — drain briefly.', fr: 'Assaisonner avec sel et muscade comme la ricotta. Légèrement plus humide — égoutter brièvement.' },
    },
`,
  },
  {
    id: "id: 'marinara_sauce'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Good quality passata + olive oil + garlic', fr: 'Passata de qualité + huile d\'olive + ail' },
      note: { en: 'Simmer passata 10 min with olive oil, crushed garlic and salt. Or use raw for Neapolitan.', fr: 'Mijoter la passata 10 min avec huile d\'olive, ail écrasé et sel. Ou crue pour le style napolitain.' },
    },
    compromise: {
      name: { en: 'Canned crushed tomatoes (hand-crushed, drained)', fr: 'Tomates concassées en conserve (écrasées à la main, égouttées)' },
      note: { en: 'Drain, crush by hand, season. Use raw for Neapolitan, simmer 15 min for NY and Pan.', fr: 'Égoutter, écraser à la main, assaisonner. Cru pour napolitain, mijoter 15 min pour NY et Pan.' },
    },
`,
  },
  {
    id: "id: 'miso_paste'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'White or yellow miso paste (shiro or shinshu)', fr: 'Pâte de miso blanc ou jaune (shiro ou shinshu)' },
      note: { en: 'Any white or yellow miso — milder and sweeter than red. Thin with cream or olive oil before spreading.', fr: 'Tout miso blanc ou jaune — plus doux et sucré que le rouge. Diluer avec crème ou huile avant d\'étaler.' },
    },
    compromise: {
      name: { en: 'Tahini thinned with soy sauce and sesame oil', fr: 'Tahini dilué avec sauce soja et huile de sésame' },
      note: { en: '2 tbsp tahini + 1 tbsp soy + a few drops toasted sesame oil. Different but similar deep umami.', fr: '2 cs tahini + 1 cs soja + quelques gouttes d\'huile de sésame. Différent mais profondeur umami similaire.' },
    },
`,
  },
  {
    id: "id: 'kimchi'",
    field: 'goodEnough',
    code: `    goodEnough: {
      name: { en: 'Store-bought kimchi (any Korean brand)', fr: 'Kimchi du commerce (toute marque coréenne)' },
      note: { en: 'Any kimchi works — drain excess brine before adding. Available in Asian supermarkets everywhere.', fr: 'Tout kimchi convient — égoutter l\'excès de saumure. Disponible dans tous les supermarchés asiatiques.' },
    },
`,
  },
];

// Missing compromise only
const compromisePatches: Array<{id: string, after: string, code: string}> = [
  {
    id: "id: 'brie_cheese'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Mild goat cheese log (buchette)', fr: 'Bûche de chèvre douce' },
      note: { en: 'Crumbles rather than melts — place in small pieces. Delicious but different texture.', fr: 'S\'émiette plutôt que de fondre — en petits morceaux. Délicieux mais texture différente.' },
    },
`,
  },
  {
    id: "id: 'pepperoni'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Spicy chorizo (sliced thin)', fr: 'Chorizo piquant (tranché finement)' },
      note: { en: 'Different flavour but similar fat rendering and spice. Slice very thin.', fr: 'Saveur différente mais rendu du gras et piquant similaires. Trancher très finement.' },
    },
`,
  },
  {
    id: "id: 'smoked_salmon'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Smoked trout', fr: 'Truite fumée' },
      note: { en: 'Milder smoke, slightly earthier. Pairs well with dill and cream cheese. Add after baking.', fr: 'Fumée plus douce, légèrement plus terreux. S\'associe bien avec aneth et fromage frais. Après cuisson.' },
    },
`,
  },
  {
    id: "id: 'anchovies'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Salted capers (rinsed and finely chopped)', fr: 'Câpres salées (rincées et finement hachées)' },
      note: { en: 'Loses the fishy brine character but adds strong umami. Use double quantity, rinse thoroughly.', fr: 'Perd le caractère marin mais apporte de l\'umami intense. Utiliser le double, bien rincer.' },
    },
`,
  },
  {
    id: "id: 'tuna'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Canned sardines in olive oil', fr: 'Sardines en conserve à l\'huile d\'olive' },
      note: { en: 'Remove bones, flake, pat dry. Stronger and fishier — use less. Surprisingly good on tomato base.', fr: 'Enlever les arêtes, émietter, éponger. Plus fort — en mettre moins. Étonnamment bon sur base tomate.' },
    },
`,
  },
  {
    id: "id: 'truffle_oil'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Truffle salt + good olive oil', fr: 'Sel à la truffe + bonne huile d\'olive' },
      note: { en: 'Finish with truffle salt and a generous drizzle of high-quality olive oil. Subtle but effective.', fr: 'Finir avec sel à la truffe et un filet généreux d\'huile d\'olive de qualité. Subtil mais efficace.' },
    },
`,
  },
  {
    id: "id: 'wasabi_cream'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Horseradish cream + cream cheese', fr: 'Crème de raifort + fromage frais' },
      note: { en: 'Similar pungent heat, different flavour. Mix equal parts. Works well with smoked salmon and dill.', fr: 'Chaleur piquante similaire, saveur différente. Mélanger à parts égales. Bien avec saumon fumé et aneth.' },
    },
`,
  },
  {
    id: "id: 'teriyaki_sauce'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Hoisin sauce thinned with soy sauce', fr: 'Sauce hoisin diluée avec sauce soja' },
      note: { en: '1 tbsp hoisin + 1 tsp soy. Sweeter but gives a similar sticky umami glaze.', fr: '1 cs de hoisin + 1 cc de sauce soja. Plus sucré mais donne une laque umami collante similaire.' },
    },
`,
  },
  {
    id: "id: 'emmental'",
    after: 'goodEnough:',
    code: `    compromise: {
      name: { en: 'Edam, mild gouda, or raclette', fr: 'Édam, jeune gouda ou raclette' },
      note: { en: 'All melt cleanly. Avoid anything too pungent or aged — it will overpower the other toppings.', fr: 'Fondent tous proprement. Éviter les fromages trop forts ou affinés.' },
    },
`,
  },
];

// Re-read fresh
text = fs.readFileSync(DB_PATH, 'utf8');

let patchCount = 0;

// Apply goodEnough patches — insert after the id: line of each ingredient
patches.forEach(({ id, field, code }) => {
  const idx = text.indexOf(id);
  if (idx === -1) { console.error('NOT FOUND: ' + id); return; }
  const section = text.substring(idx, idx + 800);
  if (section.includes(field + ':')) {
    console.log('SKIP (already has ' + field + '): ' + id);
    return;
  }
  // Find the end of the prepNote or prepNoteByStyle block for this ingredient
  // Insert before qtyPerPizza or hardToFind or localSwap or whereToFind or goodEnough
  const insertMarkers = ['    qtyPerPizza:', '    hardToFind:', '    localSwap:', '    whereToFind:', '    goodEnough:'];
  let insertPos = -1;
  let markerFound = '';
  for (const marker of insertMarkers) {
    const mIdx = text.indexOf(marker, idx);
    if (mIdx > 0 && mIdx < idx + 800) {
      insertPos = mIdx;
      markerFound = marker;
      break;
    }
  }
  if (insertPos === -1) { console.error('NO INSERT POINT for: ' + id); return; }
  text = text.substring(0, insertPos) + code + text.substring(insertPos);
  console.log('PATCHED goodEnough: ' + id + ' (before ' + markerFound.trim() + ')');
  patchCount++;
});

// Apply compromise patches — insert after the goodEnough closing brace
compromisePatches.forEach(({ id, after, code }) => {
  const idx = text.indexOf(id);
  if (idx === -1) { console.error('NOT FOUND: ' + id); return; }
  const section = text.substring(idx, idx + 1000);
  if (section.includes('compromise:')) {
    console.log('SKIP (already has compromise): ' + id);
    return;
  }
  // Find goodEnough closing brace },
  const geIdx = text.indexOf('    goodEnough:', idx);
  if (geIdx === -1 || geIdx > idx + 800) { console.error('NO goodEnough found for compromise patch: ' + id); return; }
  // Find the closing }, of goodEnough
  const closeIdx = text.indexOf('\n    },\n', geIdx);
  if (closeIdx === -1) { console.error('NO CLOSE for goodEnough in: ' + id); return; }
  const insertPos = closeIdx + '\n    },\n'.length;
  text = text.substring(0, insertPos) + code + text.substring(insertPos);
  console.log('PATCHED compromise: ' + id);
  patchCount++;
});

// Write back
fs.writeFileSync(DB_PATH, text, 'utf8');
console.log('\nTotal patches applied: ' + patchCount);

// Verify
const verify = ['mozzarella_lm','fior_di_latte','creme_fraiche','brie_cheese','emmental',
  'ricotta','pepperoni','smoked_salmon','anchovies','tuna','marinara_sauce',
  'truffle_oil','miso_paste','wasabi_cream','teriyaki_sauce','kimchi'];
console.log('\nVerification:');
verify.forEach(id => {
  const idx = text.indexOf("id: '" + id + "'");
  if (idx === -1) { console.log('  NOT FOUND: ' + id); return; }
  const section = text.substring(idx, idx + 600);
  const ge = section.includes('goodEnough:');
  const co = section.includes('compromise:');
  const status = ge && co ? '✓' : ge ? 'ge only' : co ? 'co only' : '✗ MISSING BOTH';
  console.log('  ' + status + ' ' + id);
});
