// scripts/generate-pizza-images.js
// Usage:
//   node scripts/generate-pizza-images.js --mode=anchors
//   node scripts/generate-pizza-images.js --mode=full
//
// What it does:
// - anchors mode: generates only 5 reference pizzas so you can validate style
// - full mode: generates the entire catalog
// - skips existing files, safe to rerun
//
// Notes:
// - tuned for gpt-image-2
// - keeps your ingredient list logic
// - avoids "plate / props / random salami / over-decoration" drift

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 3000;
const MODEL = 'gpt-image-2';
const QUALITY = 'medium';
const SIZE = '1024x1024';
const OUTPUT_FORMAT = 'png';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'anchors';

// ─────────────────────────────────────────────────────────────────────────────
// Shared style block
// ─────────────────────────────────────────────────────────────────────────────

const STYLE = `
Single pizza only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium food object illustration with soft volume.
Not a logo, not a symbol, not a UI badge, not graphic design, not flat icon style.
Matte surfaces, clean edges, soft depth.
No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands.
No toppings other than the ones explicitly requested.
No text, no labels.
`.trim();

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry blocks
// ─────────────────────────────────────────────────────────────────────────────

const GEO = {
  NEA: `
A round Neapolitan-style pizza.
Slightly organic shape, not perfectly circular.
Airy puffy cornicione with soft uneven volume.
Thinner center.
Overall look is soft, generous, and airy.
`,
  ROMA_TONDA: `
A round pizza Romana.
Extremely thin and flat, almost like a flat disc.
Virtually no raised crust edge and no puffy cornicione.
Very crisp, very flat silhouette.
Overall look is precise, elegant, and minimal.
`,
  NY: `
A single New York-style pizza slice.
Large triangular slice with a thin base.
Gently raised but relatively flat crust lip.
Tip slightly thinner and more flexible to suggest foldability.
Overall look is thin, broad, and slightly flexible.
`,
  TEG: `
A rectangular Roman teglia pizza.
Light and airy rectangular base with low height.
Straight edges, slightly rounded corners.
Flat, structured surface.
Overall look is light, tray-baked, and elegant.
`,
  DET: `
A rectangular Detroit-style pizza.
Thick, tall, compact block-like base.
Strong vertical sides and structured pan-baked form.
Flat top surface.
Overall look is bold, dense, and thick.
`,
  CHI: `
A Chicago deep dish pizza.
Very deep round pan shape with tall crust walls.
Dense, high-sided, pie-like structure.
Overall look is very tall and substantial.
`,
  PAN: `
A thick round pan pizza.
Clearly thicker than Neapolitan and New York.
Soft, fluffy structure with visible height.
Overall look is round, thick, and substantial.
`,
  DES: `
A round dessert pizza.
Pizza dough base with visible crust edge.
Overall look is dessert-like but still clearly pizza dough.
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Topping adapters by style
// These help reduce drift. Same ingredient idea, slightly adapted by geometry.
// ─────────────────────────────────────────────────────────────────────────────

function adaptToppingsForStyle(styleKey, text) {
  let t = text.trim();

  if (styleKey === 'ROMA_TONDA') {
    t += ' Toppings must be extremely restrained, flat, and integrated into the surface. No mozzarella discs, no large topping pieces, no decorative garnish.';
  }

  if (styleKey === 'DET') {
    t += ' Toppings should be minimal, bold, and block-like. No herbs, no decorative garnish, no extra detail.';
  }

  if (styleKey === 'TEG') {
    t += ' Toppings should be simple, understated, and evenly distributed. No decorative garnish.';
  }

  if (styleKey === 'NY') {
    t += ' Toppings should feel slightly embedded into the cheese surface, not floating.';
  }

  if (styleKey === 'NEA') {
    t += ' Keep toppings restrained and premium, softly integrated into the surface.';
  }

  return t;
}

function buildPrompt(styleKey, toppings) {
  return clean(`
    ${STYLE}
    ${GEO[styleKey]}
    ${adaptToppingsForStyle(styleKey, toppings)}
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers
// ─────────────────────────────────────────────────────────────────────────────

const NEA  = (t) => buildPrompt('NEA', t);
const ROMA = (t) => buildPrompt('ROMA_TONDA', t);
const NY   = (t) => buildPrompt('NY', t);
const TEG  = (t) => buildPrompt('TEG', t);
const DET  = (t) => buildPrompt('DET', t);
const CHI  = (t) => buildPrompt('CHI', t);
const PAN  = (t) => buildPrompt('PAN', t);
const DES  = (t) => buildPrompt('DES', t);

// Variant wrappers
const NY_V   = (t) => NY(t);
const ROMA_V = (t) => ROMA(t);
const PAN_V  = (t) => PAN(t);

// ─────────────────────────────────────────────────────────────────────────────
// Top 15 pizzas that get style variants
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_TOPPINGS = {
  margherita:            'Red tomato sauce base, soft fior di latte mozzarella melted, fresh basil.',
  diavola:               'Red tomato base, dark spicy salami rounds, melted mozzarella, chilli flakes.',
  quattro_formaggi:      'White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.',
  pepperoni:             'Red tomato base, pepperoni slices, melted mozzarella.',
  prosciutto_rucola:     'Red tomato base, melted mozzarella, prosciutto added after baking, fresh rocket leaves.',
  capricciosa:           'Red tomato base, melted mozzarella, cooked ham, mushrooms, black olives, artichoke wedges.',
  quatre_saisons:        'Red tomato base, mozzarella. Four distinct quarters: artichoke, cooked ham, black olives, sliced mushrooms.',
  bbq_chicken:           'Dark BBQ sauce base, grilled chicken pieces, softened red onion, melted mozzarella.',
  funghi_tartufo:        'White truffle cream base, dark mushrooms, melted mozzarella, truffle shavings after baking.',
  bianca_ricotta_spinaci:'White ricotta base, dark green spinach, ricotta dollops. No meat.',
  truffle_bianca:        'White cream base, melted mozzarella, dark truffle shavings after baking. No meat.',
  salsiccia_friarielli:  'White olive oil base, crumbled Italian sausage, dark green broccoli rabe, melted mozzarella.',
  norma:                 'Red tomato base, fried aubergine slices, melted mozzarella, basil, ricotta salata on top.',
  pollo_pesto:           'Bright green pesto base, grilled chicken slices, melted mozzarella, roasted cherry tomatoes.',
  ortolana:              'Red tomato base, grilled courgette, grilled aubergine, red and yellow pepper strips, melted mozzarella.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Base pizzas
// ─────────────────────────────────────────────────────────────────────────────

const BASE_PIZZAS = [
  // Classic Italian
  { id: 'margherita',             prompt: NEA('Red tomato sauce base, soft fior di latte mozzarella melted, fresh basil.') },
  { id: 'marinara',               prompt: NEA('Rich red tomato sauce base, roasted garlic, dried oregano, olive oil drizzle. No cheese at all.') },
  { id: 'diavola',                prompt: NEA('Red tomato base, dark spicy salami rounds, melted mozzarella, chilli flakes.') },
  { id: 'quattro_formaggi',       prompt: NEA('White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.') },
  { id: 'capricciosa',            prompt: NEA('Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives, artichoke wedges.') },
  { id: 'napoli',                 prompt: NEA('Red tomato base, melted mozzarella, anchovy fillets, capers, black olives.') },
  { id: 'pepperoni',              prompt: NEA('Red tomato base, pepperoni slices, melted mozzarella.') },
  { id: 'nduja_mozzarella',       prompt: NEA('Red tomato base, nduja in irregular dollops, melted mozzarella.') },
  { id: 'tonno_cipolla',          prompt: NEA('Red tomato base, melted mozzarella, softened onion rings, tuna flakes placed on top.') },
  { id: 'smoked_salmon_creme',    prompt: NEA('White crème fraîche base, smoked salmon after baking, capers, fresh dill.') },
  { id: 'ortolana',               prompt: NEA('Red tomato base, grilled courgette, grilled aubergine, pepper strips, melted mozzarella.') },
  { id: 'funghi_tartufo',         prompt: NEA('White truffle cream base, dark mushrooms, melted mozzarella, truffle shavings after baking.') },
  { id: 'patate_rosmarino',       prompt: NEA('White olive oil base, thin potato slices, rosemary, sea salt. No meat, no cheese.') },
  { id: 'bianca_ricotta_spinaci', prompt: NEA('White ricotta base, wilted spinach, ricotta dollops. No meat.') },
  { id: 'truffle_bianca',         prompt: NEA('White cream base, melted mozzarella, truffle shavings after baking. No meat.') },
  { id: 'prosciutto_rucola',      prompt: NEA('Red tomato base, melted mozzarella, prosciutto after baking, fresh rocket leaves.') },
  { id: 'burrata_prosciutto',     prompt: NEA('Red tomato base, burrata in center after baking, prosciutto around it.') },
  { id: 'fig_gorgonzola',         prompt: NEA('White olive oil base, melted gorgonzola, halved fresh figs, honey drizzle, walnut halves. No meat.') },
  { id: 'pear_walnut_gorgonzola', prompt: NEA('White base, melted gorgonzola, pear slices, walnut halves, honey drizzle. No meat.') },
  { id: 'bbq_chicken',            prompt: NEA('Dark BBQ sauce base, grilled chicken breast pieces, softened red onion, melted mozzarella.') },
  { id: 'speck_brie',             prompt: NEA('White base, melted brie wedges, thin speck slices, rosemary.') },
  { id: 'tarte_flambee',          prompt: NEA('White crème fraîche base, smoked lardons, softened white onion rings. No tomato, no mozzarella.') },
  { id: 'raclette_pommes',        prompt: NEA('White base, golden raclette cheese, thin potato slices, smoked lardons.') },
  { id: 'chevre_miel',            prompt: NEA('White olive oil base, goat cheese rounds, honey drizzle, walnut halves, thyme. No meat.') },
  { id: 'andouille_moutarde',     prompt: NEA('Pale mustard cream base, thick andouille rounds, softened onion rings, melted emmental.') },
  { id: 'maroilles_oignons',      prompt: NEA('White crème fraîche base, melted maroilles, golden caramelised onions. No meat.') },
  { id: 'jambon_espelette',       prompt: NEA('White base, melted cheese, thin Bayonne ham, Espelette pepper flakes.') },
  { id: 'camembert_pommes',       prompt: NEA('White crème fraîche base, camembert wedges, thin apple slices, smoked lardons.') },
  { id: 'tartiflette_pizza',      prompt: NEA('Cream base, melted reblochon, thin potato slices, smoked lardons.') },
  { id: 'la_reine',               prompt: NEA('Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives.') },
  { id: 'la_royale',              prompt: NEA('Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives.') },
  { id: 'la_paysanne',            prompt: NEA('White crème fraîche base, smoked lardons, softened onion rings, melted mozzarella. No tomato.') },
  { id: 'quatre_saisons',         prompt: NEA('Red tomato base, mozzarella. Four distinct quarters: artichoke, cooked ham, black olives, sliced mushrooms.') },
  { id: 'margherita_sbagliata',   prompt: NEA('White base with mozzarella baked in, fresh crushed tomato dollops after baking, basil.') },
  { id: 'cosacca',                prompt: NEA('Red tomato base, finely grated pecorino romano, fresh basil, olive oil. No mozzarella.') },
  { id: 'salsiccia_friarielli',   prompt: NEA('White olive oil base, crumbled Italian sausage, dark green broccoli rabe, melted fior di latte.') },
  { id: 'provola_pepe',           prompt: NEA('White base, smoked provola, generous cracked black pepper. No meat.') },
  { id: 'acciughe_pomodorini',    prompt: NEA('Red tomato base, anchovy fillets, halved roasted cherry tomatoes, melted mozzarella, capers.') },
  { id: 'melanzane_parmigiana',   prompt: NEA('Red tomato base, layered aubergine slices, grated parmesan, basil, melted mozzarella.') },
  { id: 'zucca_provola',          prompt: NEA('White base, pumpkin slices, smoked provola, pumpkin seeds. No meat.') },
  { id: 'boscaiola',              prompt: NEA('Red tomato base, dark mushrooms, crumbled Italian sausage, melted mozzarella.') },
  { id: 'bismarck',               prompt: NEA('Red tomato base, melted mozzarella, cooked ham, mushrooms, whole egg baked in center.') },
  { id: 'pugliese',               prompt: NEA('Red tomato base, black olives, capers, thin red onion, melted mozzarella. No meat.') },
  { id: 'prosciutto_funghi',      prompt: NEA('Red tomato base, melted mozzarella, cooked ham, sliced brown mushrooms.') },
  { id: 'tonno_cipolla_red',      prompt: NEA('Red tomato base, melted mozzarella, softened red onion rings, tuna flakes placed on top.') },
  { id: 'piennolo',               prompt: NEA('White olive oil base, roasted cherry tomatoes, basil, sea salt. No cheese, no meat.') },
  { id: 'funghi_salsiccia',       prompt: NEA('Red tomato base, sliced mushrooms, crumbled Italian sausage, melted mozzarella.') },
  { id: 'salmone_rucola',         prompt: NEA('White cream base, smoked salmon after baking, fresh rocket, capers.') },
  { id: 'acciughe_burro',         prompt: NEA('White butter-enriched base, anchovy fillets, melted mozzarella.') },
  { id: 'pollo_pesto',            prompt: NEA('Bright green pesto base, grilled chicken slices, melted mozzarella, roasted cherry tomatoes.') },
  { id: 'genovese',               prompt: NEA('Bright green pesto base, potato slices, green beans, melted mozzarella. No meat.') },
  { id: 'polpette',               prompt: NEA('Red tomato base, large meatballs baked in, melted mozzarella, basil.') },
  { id: 'diavola_burrata',        prompt: NEA('Red tomato base, dark spicy salami rounds, melted mozzarella, burrata after baking.') },
  { id: 'pistadella',             prompt: NEA('White base, melted fior di latte, green pistachio pesto swirl, large mortadella slices after baking.') },
  { id: 'stracciatella_datterini',prompt: NEA('Red tomato base, small roasted cherry tomatoes, fresh stracciatella after baking.') },
  { id: 'nduja_burrata',          prompt: NEA('Orange nduja base, burrata in center after baking, chilli oil drizzle.') },
  { id: 'tartufo_fior',           prompt: NEA('White base, melted fior di latte, dark truffle shavings after baking, truffle oil.') },
  { id: 'lardo_rosmarino',        prompt: NEA('White base, thin lardo slices melting on hot pizza, rosemary, sea salt.') },
  { id: 'scarpetta',              prompt: NEA('White base, buffalo mozzarella, Grana Padano fondue swirl, small tomato compote dots.') },
  { id: 'caponata_pizza',         prompt: NEA('White base, Sicilian caponata vegetables, melted mozzarella.') },
  { id: 'soppressata_fichi',      prompt: NEA('White base, soppressata salami, melted mozzarella, halved fresh figs, honey drizzle.') },
  { id: 'guanciale_pecorino',     prompt: NEA('Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.') },
  { id: 'honey_pecorino',         prompt: NEA('White base, grated pecorino, golden honey drizzle, cracked black pepper. No meat.') },
  { id: 'burrata_prosciutto_gourmet', prompt: NEA('Red tomato base, burrata in center after baking, prosciutto, basil.') },
  { id: 'porcini_stracciatella',  prompt: NEA('White base, dark porcini mushrooms, truffle oil, fresh stracciatella after baking.') },
  { id: 'wagyu_onion',            prompt: NEA('White base, golden caramelised onions, melted mozzarella, thin wagyu slices after baking.') },
  { id: 'crudo_parma_stracciatella', prompt: NEA('Red tomato base, melted mozzarella, Parma ham after baking, stracciatella, basil.') },
  { id: 'norma',                  prompt: NEA('Red tomato base, fried aubergine slices, melted mozzarella, basil, ricotta salata on top.') },
  { id: 'carciofi_romana',        prompt: ROMA('White olive oil base, artichoke heart quarters, garlic slices, fresh mint. No meat.') },
  { id: 'fiori_zucca_alici',      prompt: ROMA('White base, courgette flowers baked, anchovy fillets, melted mozzarella.') },
  { id: 'amatriciana_pizza',      prompt: ROMA('Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.') },
  { id: 'carbonara_pizza',        prompt: ROMA('Pale yellow egg cream base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato.') },
  { id: 'cacio_pepe_pizza',       prompt: ROMA('White pecorino cream base, generous cracked black pepper. Nothing else.') },
  { id: 'gricia_pizza',           prompt: ROMA('White olive oil base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato.') },
  { id: 'bianca_rosmarino',       prompt: ROMA('White olive oil base, rosemary sprigs pressed into dough, sea salt crystals. Nothing else.') },
  { id: 'bresaola_rucola_pizza',  prompt: ROMA('White base, melted mozzarella, dark red bresaola after baking, fresh rocket, parmesan shavings.') },
  { id: 'speck_stracchino',       prompt: ROMA('White stracchino cream base, thin speck ham slices, melted mozzarella.') },
  { id: 'indivia_gorgonzola',     prompt: ROMA('White base, pale endive leaves wilted, melted gorgonzola, walnut halves. No meat.') },
  { id: 'prosciutto_stracciatella_romana', prompt: ROMA('White base, cold stracciatella on top, thin prosciutto slices.') },
  { id: 'patata_rosmarino_romana',prompt: ROMA('White olive oil base, ultra-thin golden potato slices, rosemary, sea salt. No meat, no cheese.') },
  { id: 'verdure_grigliate_burrata', prompt: ROMA('White base, grilled courgette, peppers, aubergine, burrata after baking.') },
  { id: 'alici_fresche_romana',   prompt: ROMA('White base, fresh anchovy fillets, halved roasted cherry tomatoes, capers.') },
  { id: 'porcini_pecorino_romana',prompt: ROMA('White olive oil base, dark porcini mushrooms, grated pecorino, cracked black pepper. No tomato.') },

  // Roman Teglia
  { id: 'teglia_patata_provola',  prompt: TEG('White olive oil base, thin golden potato slices, smoked provola, rosemary.') },
  { id: 'teglia_funghi_salsiccia',prompt: TEG('Red tomato base, mushrooms, crumbled Italian sausage, melted mozzarella.') },
  { id: 'teglia_prosciutto_cotto',prompt: TEG('Red tomato base, cooked ham, sliced mushrooms, melted mozzarella.') },
  { id: 'teglia_zucchine_fiori',  prompt: TEG('White base, courgette slices, courgette flowers, melted mozzarella.') },
  { id: 'teglia_mortadella_pistacchio', prompt: TEG('White base, melted mozzarella, mortadella after baking, pistachio crumble, stracciatella.') },
  { id: 'teglia_tonno_cipolla',   prompt: TEG('Red tomato base, softened red onion rings, melted mozzarella, tuna flakes on top.') },
  { id: 'teglia_4_formaggi',      prompt: TEG('White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.') },
  { id: 'teglia_speck_brie',      prompt: TEG('White base, melted brie, thin speck slices, fresh herbs.') },
  { id: 'teglia_verdure',         prompt: TEG('Red tomato base, grilled peppers, courgette, aubergine, melted mozzarella.') },
  { id: 'teglia_nduja_stracciatella', prompt: TEG('Orange nduja base, cold stracciatella on top, chilli oil drizzle.') },

  // New York
  { id: 'ny_pepperoni_slice',     prompt: NY('Red tomato base, pepperoni slices, melted mozzarella.') },
  { id: 'hot_honey_pepperoni',    prompt: NY('Red tomato base, crispy pepperoni cups, melted mozzarella, hot honey drizzle.') },
  { id: 'white_clam_apizza',      prompt: NY('White olive oil base, chopped clams, sliced garlic, dried oregano. No tomato, no cheese.') },
  { id: 'ny_sausage_peppers',     prompt: NY('Red tomato base, crumbled Italian sausage, green and red pepper strips, melted mozzarella.') },
  { id: 'vodka_pizza',            prompt: NY('Pale pink-orange vodka cream sauce base, melted mozzarella, fresh basil. No meat.') },
  { id: 'ny_white_pizza',         prompt: NY('White garlic oil base, melted mozzarella, ricotta dollops. No tomato, no meat.') },
  { id: 'buffalo_chicken',        prompt: NY('White base, buffalo sauce chicken pieces, melted mozzarella, blue cheese crumbles, celery.') },
  { id: 'california_bbq_chicken', prompt: NY('Dark BBQ sauce base, grilled chicken pieces, red onion, melted mozzarella, fresh coriander after baking.') },
  { id: 'smoked_salmon_cream_cheese', prompt: NY('White cream cheese base, smoked salmon after baking, capers, fresh dill.') },
  { id: 'ny_clam_garlic',         prompt: NY('White garlic oil base, chopped clams, melted mozzarella, fresh parsley.') },
  { id: 'ny_margherita_bufala',   prompt: NY('Red tomato base, buffalo mozzarella melted, fresh basil.') },
  { id: 'ny_diavola',             prompt: NY('Red tomato base, dark spicy salami slices, melted mozzarella.') },

  // Detroit
  { id: 'detroit_red_top',        prompt: DET('Brick cheese under sauce, three clean red sauce stripes on top. Pepperoni baked under cheese. Keep toppings minimal and block-like.') },
  { id: 'detroit_white',          prompt: DET('White garlic base, brick cheese integrated, minimal herbs. No tomato.') },
  { id: 'detroit_sausage',        prompt: DET('Red tomato base, brick cheese, simple crumbled Italian sausage pieces, sliced mushrooms.') },
  { id: 'detroit_veggie',         prompt: DET('Brick cheese, roasted peppers, caramelised onions. Minimal and clean.') },

  // Chicago
  { id: 'chicago_deep_dish',      prompt: CHI('Tall buttery crust walls, cheese inside, chunky tomato sauce covering the top surface.') },

  // Pan
  { id: 'pan_margherita',         prompt: PAN('Red tomato base, melted mozzarella, fresh basil after baking.') },
  { id: 'pan_pepperoni_hot_honey',prompt: PAN('Red tomato base, pepperoni, melted mozzarella, hot honey drizzle.') },
  { id: 'pan_bbq_chicken',        prompt: PAN('Dark BBQ sauce base, grilled chicken pieces, red onion, melted mozzarella.') },
  { id: 'pan_nduja_burrata',      prompt: PAN('Orange nduja base, burrata after baking, chilli oil drizzle.') },
  { id: 'pan_4_formaggi',         prompt: PAN('White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.') },

  // Spanish
  { id: 'jamon_manchego',         prompt: NEA('White base, melted manchego, thin Iberico ham after baking, olive oil drizzle.') },
  { id: 'sobrasada_miel',         prompt: NEA('White base, sobrasada in irregular dollops, melted mozzarella, honey drizzle.') },
  { id: 'escalivada',             prompt: NEA('White olive oil base, fire-roasted aubergine strips, roasted red pepper strips, sliced onion. No meat, no cheese.') },
  { id: 'chorizo_padron',         prompt: NEA('Red tomato base, chorizo slices, whole small green Padrón peppers, melted mozzarella.') },
  { id: 'pulpo_gallega',          prompt: NEA('White base, thin potato slices, octopus pieces, smoked paprika, olive oil.') },

  // Middle Eastern / Asian
  { id: 'halloumi_zaatar',        prompt: NEA('White olive oil base with zaatar, grilled halloumi slices, roasted cherry tomatoes.') },
  { id: 'zaatar_labneh',          prompt: NEA('White base with zaatar and sesame, cold labneh dollops after baking, olive oil.') },
  { id: 'merguez_harissa',        prompt: NEA('Red harissa base, merguez slices, whole egg baked in center, crumbled feta.') },
  { id: 'miso_funghi',            prompt: NEA('Pale beige miso cream base, shiitake and oyster mushrooms, melted mozzarella. No meat.') },
  { id: 'mentaiko_cream',         prompt: NEA('Pale pink mentaiko cream base, melted mozzarella, spring onion slices, nori strips.') },
  { id: 'teriyaki_chicken',       prompt: NEA('White base, teriyaki-glazed chicken pieces, melted mozzarella, sesame seeds, spring onion.') },
  { id: 'salmon_wasabi',          prompt: NEA('Pale green wasabi cream base, smoked salmon after baking, sesame seeds, nori strips.') },
  { id: 'korean_bbq',             prompt: NEA('White base, melted mozzarella, thin bulgogi beef after baking, kimchi, sesame seeds.') },
  { id: 'nori_sesame_bianca',     prompt: NEA('White sesame oil base, melted mozzarella, black and white sesame seeds, nori strips.') },

  // French regional
  { id: 'provencale',             prompt: NEA('Red tomato base, melted mozzarella, anchovy fillets, black olives, herbes de Provence.') },
  { id: 'lorraine_pizza',         prompt: NEA('White crème fraîche base, smoked lardons, melted emmental, softened onions. No tomato.') },
  { id: 'perigourdine',           prompt: NEA('White base, shredded duck confit, walnut halves.') },
  { id: 'pistou_pizza',           prompt: NEA('Bright green pistou pesto base, courgette slices, tomato pieces, softened goat cheese.') },
  { id: 'alsacienne_choucroute',  prompt: NEA('White crème fraîche base, shredded sauerkraut, smoked lardons, melted Munster.') },
  { id: 'basquaise',              prompt: NEA('Red tomato base, thin Bayonne ham, Espelette pepper flakes, melted Ossau-Iraty.') },
  { id: 'lyonnaise',              prompt: NEA('White fromage blanc base, caramelised onions, smoked lardons, melted mozzarella. No tomato.') },
  { id: 'normandie_camembert',    prompt: NEA('White crème fraîche base, camembert wedges, thin apple slices, smoked lardons.') },

  // Kosher
  { id: 'jerusalem',              prompt: NEA('Red tomato base, roasted aubergine chunks, chickpeas, tahini drizzle after baking, fresh parsley, olive oil.') },
  { id: 'shakshuka',              prompt: NEA('Spiced red tomato base, roasted red pepper strips, two eggs baked in, crumbled feta.') },

  // Desserts
  { id: 'nutella_fraises',        prompt: DES('Nutella chocolate spread, fresh strawberry halves, light powdered sugar.') },
  { id: 'tarte_tatin_pizza',      prompt: DES('Caramelised apple slices arranged in overlapping circles, caramel glaze, small crème fraîche dollop in center.') },
  { id: 'poire_chocolat',         prompt: DES('Dark chocolate cream spread, fanned pear slices, mascarpone dollops.') },
  { id: 'honey_fig_mascarpone',   prompt: DES('White mascarpone spread, halved fresh figs, golden honey drizzle, crushed pistachios.') },
  { id: 'speculoos_banana',       prompt: DES('Speculoos biscuit spread, fresh banana slices, caramel drizzle.') },
  { id: 'creme_brulee_pizza',     prompt: DES('Vanilla cream spread, caramelised sugar crust across entire surface.') },
  { id: 'crisommola',             prompt: DES('White ricotta spread, apricot halves arranged, golden honey drizzle.') },
  { id: 'ricotta_miele_castagne', prompt: DES('Fresh white ricotta spread, dark chestnut honey drizzle, toasted almond flakes.') },
  { id: 'fragole_basilico',       prompt: DES('White mascarpone spread, fresh strawberry halves, small fresh basil leaves.') },
  { id: 'cioccolato_peperoncino', prompt: DES('Dark chocolate cream spread, red chilli flakes, sea salt flakes.') },
  { id: 'mela_cannella',          prompt: DES('Cream cheese spread, caramelised apple slices, cinnamon powder.') },
  { id: 'caramel_noisette',       prompt: DES('Salted caramel spread, toasted hazelnut halves, vanilla cream dollops, sea salt flakes.') },

  // Pizza Romana — extended catalog
  { id: 'cosacca_pizza_romana',              prompt: ROMA('Red tomato base, finely grated dry pecorino romano sprinkled as white powder, fresh basil, olive oil. No mozzarella.') },
  { id: 'acciughe_pomodorini_pizza_romana',  prompt: ROMA('Red tomato base, thin anchovy fillets, halved roasted cherry tomatoes, melted mozzarella, capers.') },
  { id: 'melanzane_parmigiana_pizza_romana', prompt: ROMA('Red tomato base, layered aubergine slices, grated parmesan, basil, melted mozzarella.') },
  { id: 'boscaiola_pizza_romana',            prompt: ROMA('Red tomato base, dark forest mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.') },
  { id: 'bismarck_pizza_romana',             prompt: ROMA('Red tomato base, melted mozzarella, cooked ham slices, sliced mushrooms, whole egg baked in center.') },
  { id: 'pugliese_pizza_romana',             prompt: ROMA('Red tomato base, black olives, capers, thin red onion, melted mozzarella.') },
  { id: 'prosciutto_funghi_pizza_romana',    prompt: ROMA('Red tomato base, melted mozzarella, thin cooked ham slices, sliced brown mushrooms.') },
  { id: 'tonno_cipolla_red_pizza_romana',    prompt: ROMA('Red tomato base, melted mozzarella, softened red onion rings, tuna flakes placed cold on top.') },
  { id: 'funghi_salsiccia_pizza_romana',     prompt: ROMA('Red tomato base, sliced mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.') },
  { id: 'salmone_rucola_pizza_romana',       prompt: ROMA('White cream base, pink smoked salmon slices draped after baking, fresh rocket, capers.') },
  { id: 'acciughe_burro_pizza_romana',       prompt: ROMA('White butter-enriched base, thin anchovy fillets, melted mozzarella.') },
  { id: 'genovese_pizza_romana',             prompt: ROMA('Bright green pesto base, thin golden potato slices, green beans cooked, melted mozzarella.') },
  { id: 'stracciatella_datterini_pizza_romana', prompt: ROMA('Red tomato base, small datterini cherry tomatoes roasted, fresh stracciatella dollops placed cold on top.') },
  { id: 'tartufo_fior_pizza_romana',         prompt: ROMA('White base, melted fior di latte mozzarella, dark truffle shavings after baking.') },
  { id: 'lardo_rosmarino_pizza_romana',      prompt: ROMA('White base, thin translucent lardo slices melting, rosemary sprigs, sea salt.') },
  { id: 'caponata_pizza_romana',             prompt: ROMA('White base, Sicilian caponata vegetables cooked: aubergine, peppers, capers, olives, melted mozzarella.') },
  { id: 'soppressata_fichi_pizza_romana',    prompt: ROMA('White base, soppressata salami baked, melted mozzarella, halved fresh figs, honey drizzle.') },
  { id: 'guanciale_pecorino_pizza_romana',   prompt: ROMA('Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.') },
  { id: 'honey_pecorino_pizza_romana',       prompt: ROMA('White base, grated pecorino melted, golden honey drizzle, cracked black pepper.') },
  { id: 'porcini_stracciatella_pizza_romana',prompt: ROMA('White base, dark porcini mushrooms cooked, truffle oil, fresh stracciatella dollops cold on top.') },
  { id: 'crudo_parma_stracciatella_pizza_romana', prompt: ROMA('Red tomato base, melted mozzarella, thin Parma ham slices draped after baking, stracciatella dollops, basil.') },
  { id: 'smoked_salmon_cream_cheese_pizza_romana', prompt: ROMA('White cream cheese base, pink smoked salmon slices draped after baking, capers, fresh dill.') },
  { id: 'jamon_manchego_pizza_romana',       prompt: ROMA('White base, melted manchego cheese, thin Iberico ham slices draped after baking, olive oil drizzle.') },
  { id: 'sobrasada_miel_pizza_romana',       prompt: ROMA('White base, orange-red sobrasada paste spread in dollops, melted mozzarella, honey drizzle.') },
  { id: 'escalivada_pizza_romana',           prompt: ROMA('White olive oil base, fire-roasted aubergine strips, roasted red pepper strips, sliced onion.') },
  { id: 'chorizo_padron_pizza_romana',       prompt: ROMA('Red tomato base, chorizo slices cooked, whole small green Padrón peppers, melted mozzarella.') },
  { id: 'halloumi_zaatar_pizza_romana',      prompt: ROMA('White olive oil base with zaatar herb blend, grilled golden halloumi slices, roasted cherry tomatoes.') },
  { id: 'zaatar_labneh_pizza_romana',        prompt: ROMA('White base generously coated with zaatar herb blend and sesame seeds, cold labneh dollops after baking.') },
  { id: 'merguez_harissa_pizza_romana',      prompt: ROMA('Red harissa base, diagonal merguez sausage slices, whole egg baked in center with runny yolk.') },
  { id: 'teriyaki_chicken_pizza_romana',     prompt: ROMA('White base, teriyaki-glazed chicken pieces, melted mozzarella, sesame seeds, spring onion.') },
  { id: 'provencale_pizza_romana',           prompt: ROMA('Red tomato base, melted mozzarella, thin anchovy fillets, black olives, herbes de Provence.') },
  { id: 'lorraine_pizza_pizza_romana',       prompt: ROMA('White crème fraîche base, smoked lardons, melted emmental, softened onions.') },
  { id: 'pistou_pizza_pizza_romana',         prompt: ROMA('Bright green pistou pesto base, courgette slices, tomato pieces, softened goat cheese.') },
  { id: 'alsacienne_choucroute_pizza_romana',prompt: ROMA('White crème fraîche base, pale shredded sauerkraut, smoked lardons, melted Munster cheese.') },
  { id: 'basquaise_pizza_romana',            prompt: ROMA('Red tomato base, thin Bayonne ham slices draped loosely, Espelette pepper flakes, melted sheep cheese.') },
  { id: 'lyonnaise_pizza_romana',            prompt: ROMA('White fromage blanc base, golden caramelised onions, smoked lardons, melted mozzarella.') },
  { id: 'normandie_camembert_pizza_romana',  prompt: ROMA('White crème fraîche base, melted camembert wedges, thin golden apple slices, smoked lardons.') },
  { id: 'fiori_zucca_alici_pizza_romana',    prompt: ROMA('White base, large yellow courgette flowers baked, thin anchovy fillets, melted mozzarella.') },
  { id: 'amatriciana_pizza_pizza_romana',    prompt: ROMA('Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.') },
  { id: 'bresaola_rucola_pizza_romana',      prompt: ROMA('White base, melted mozzarella, thin dark red bresaola slices draped after baking, fresh rocket, parmesan shavings.') },
  { id: 'speck_stracchino_pizza_romana',     prompt: ROMA('White stracchino cream base, thin speck ham slices draped loosely, melted mozzarella.') },
];

// ── New York variants for shared pizzas ──
{ id: 'boscaiola_newyork',          prompt: NY('Red tomato base, dark forest mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.') },
{ id: 'pugliese_newyork',           prompt: NY('Red tomato base, black olives, capers, thin red onion, melted mozzarella.') },
{ id: 'prosciutto_funghi_newyork',  prompt: NY('Red tomato base, melted mozzarella, thin cooked ham slices, sliced brown mushrooms.') },
{ id: 'tonno_cipolla_red_newyork',  prompt: NY('Red tomato base, melted mozzarella, softened red onion rings, tuna flakes placed cold on top.') },
{ id: 'funghi_salsiccia_newyork',   prompt: NY('Red tomato base, sliced mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.') },
{ id: 'salmone_rucola_newyork',     prompt: NY('White cream base, pink smoked salmon slices draped after baking, fresh rocket, capers.') },
{ id: 'polpette_newyork',           prompt: NY('Red tomato base, large spherical meatballs baked in, melted mozzarella, basil.') },
{ id: 'hot_honey_pepperoni_newyork',prompt: NY('Red tomato base, crispy pepperoni cups curled from heat, melted mozzarella, hot honey drizzle.') },
{ id: 'vodka_pizza_newyork',        prompt: NY('Pale pink-orange vodka cream sauce base, melted mozzarella, fresh basil.') },
{ id: 'ny_white_pizza_newyork',     prompt: NY('White garlic oil base, melted mozzarella, ricotta dollops.') },
{ id: 'california_bbq_chicken_newyork', prompt: NY('Dark BBQ sauce base, grilled chicken pieces, red onion, melted mozzarella, fresh coriander after baking.') },
// ─────────────────────────────────────────────────────────────────────────────
// Variant generation
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_PIZZAS = [];
Object.entries(VARIANT_TOPPINGS).forEach(([id, toppings]) => {
  VARIANT_PIZZAS.push({ id: `${id}_newyork`,      prompt: NY_V(toppings) });
  VARIANT_PIZZAS.push({ id: `${id}_pizza_romana`, prompt: ROMA_V(toppings) });
  VARIANT_PIZZAS.push({ id: `${id}_pan`,          prompt: PAN_V(toppings) });
});

const ALL_PIZZAS = [...BASE_PIZZAS, ...VARIANT_PIZZAS];

// ─────────────────────────────────────────────────────────────────────────────
// Anchors
// ─────────────────────────────────────────────────────────────────────────────

const ANCHOR_IDS = [
  'margherita',
  'ny_pepperoni_slice',
  'patata_rosmarino_romana',
  'teglia_patata_provola',
  'detroit_red_top',
];

const PIZZAS_TO_GENERATE =
  MODE === 'anchors'
    ? ALL_PIZZAS.filter((p) => ANCHOR_IDS.includes(p.id))
    : ALL_PIZZAS;

// ─────────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateAll() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const total = PIZZAS_TO_GENERATE.length;
  let generated = 0;
  let skipped = 0;
  const failed = [];

  console.log('\n🍕 Baker Hub Pizza Image Generator');
  console.log(`Mode: ${MODE}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Images: ${total}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (let i = 0; i < PIZZAS_TO_GENERATE.length; i++) {
    const pizza = PIZZAS_TO_GENERATE[i];
    const filepath = path.join(OUTPUT_DIR, `${pizza.id}.png`);

    if (fs.existsSync(filepath)) {
      console.log(`[${i + 1}/${total}] ⏭  ${pizza.id}`);
      skipped++;
      continue;
    }

    try {
      console.log(`[${i + 1}/${total}] 🎨 ${pizza.id}...`);

      const response = await client.images.generate({
        model: MODEL,
        prompt: pizza.prompt,
        n: 1,
        size: SIZE,
        quality: QUALITY,
        output_format: OUTPUT_FORMAT,
      });

      const imageBuffer = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, imageBuffer);

      console.log(`[${i + 1}/${total}] ✅ ${pizza.id}.png`);
      generated++;
    } catch (err) {
      console.error(`[${i + 1}/${total}] ❌ ${pizza.id} — ${err.message}`);
      failed.push(pizza.id);
    }

    if (i < PIZZAS_TO_GENERATE.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Generated: ${generated}`);
  console.log(`⏭  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed.length}`);
  if (failed.length) {
    console.log(`Failed IDs: ${failed.join(', ')}`);
  }
}

generateAll().catch(console.error);