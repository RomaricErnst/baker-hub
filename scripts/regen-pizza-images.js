// scripts/regen-pizza-images.js
// Regenerates pizza_romana variants (corrected dough) + teglia images (no tray)
// Also generates tarte_flambee base image (missing)
//
// Usage:
//   node scripts/regen-pizza-images.js --mode=anchors   ← validate 3 images first
//   node scripts/regen-pizza-images.js --mode=romana    ← all _pizza_romana variants
//   node scripts/regen-pizza-images.js --mode=teglia    ← all teglia images
//   node scripts/regen-pizza-images.js --mode=all       ← everything

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
const OUTPUT_FORMAT = 'webp';

const modeArg = process.argv.find(a => a.startsWith('--mode='));
const MODE = modeArg ? modeArg.split('=')[1] : 'anchors';

// ─────────────────────────────────────────────────────────────────────────────
// Shared style block — correct background, no plate, no props
// ─────────────────────────────────────────────────────────────────────────────
const STYLE = `
Single pizza only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium food photography, matte surfaces, clean edges, soft depth.
No plate, no board, no tray, no baking pan, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands.
No toppings other than the ones explicitly requested.
No text, no labels.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Geometry blocks
// ─────────────────────────────────────────────────────────────────────────────
const GEO_ROMA = `
A round pizza Romana.
Thin and crispy Roman-style, slightly irregular round shape.
Charred leopard spotting on crust edges.
`;

const GEO_TEG = `
A rectangular Roman teglia pizza portion placed directly on the dark surface.
Light and airy thick base with low height.
Straight edges, slightly rounded corners.
Flat, structured surface.
Absolutely NO tray, NO baking pan, NO dish visible anywhere.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────────────────────
function clean(text) { return text.replace(/\s+/g, ' ').trim(); }

function ROMA(toppings) {
  return clean(`${STYLE} ${GEO_ROMA} ${toppings} Toppings must be extremely restrained, flat, and integrated into the surface. No large topping pieces, no decorative garnish.`);
}

function TEG(toppings) {
  return clean(`${STYLE} ${GEO_TEG} ${toppings} Toppings simple, understated, and evenly distributed. No decorative garnish.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pizza Romana — all _pizza_romana variants to regenerate
// ─────────────────────────────────────────────────────────────────────────────
const ROMANA_PIZZAS = [
  { id: 'margherita_pizza_romana',                   t: 'Red tomato sauce base, soft fior di latte mozzarella melted, fresh basil.' },
  { id: 'diavola_pizza_romana',                      t: 'Red tomato base, dark spicy salami rounds, melted mozzarella, chilli flakes.' },
  { id: 'quattro_formaggi_pizza_romana',             t: 'White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.' },
  { id: 'capricciosa_pizza_romana',                  t: 'Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives, artichoke wedges.' },
  { id: 'pepperoni_pizza_romana',                    t: 'Red tomato base, pepperoni slices, melted mozzarella.' },
  { id: 'ortolana_pizza_romana',                     t: 'Red tomato base, grilled courgette, grilled aubergine, pepper strips, melted mozzarella.' },
  { id: 'funghi_tartufo_pizza_romana',               t: 'White truffle cream base, dark mushrooms, melted mozzarella, truffle shavings after baking.' },
  { id: 'bianca_ricotta_spinaci_pizza_romana',       t: 'White ricotta base, wilted spinach, ricotta dollops. No meat.' },
  { id: 'truffle_bianca_pizza_romana',               t: 'White cream base, melted mozzarella, truffle shavings after baking. No meat.' },
  { id: 'prosciutto_rucola_pizza_romana',            t: 'Red tomato base, melted mozzarella, prosciutto after baking, fresh rocket leaves.' },
  { id: 'burrata_prosciutto_pizza_romana',           t: 'Red tomato base, burrata in center after baking, prosciutto around it.' },
  { id: 'fig_gorgonzola_pizza_romana',               t: 'White olive oil base, melted gorgonzola, halved fresh figs, honey drizzle, walnut halves. No meat.' },
  { id: 'pear_walnut_gorgonzola_pizza_romana',       t: 'White base, melted gorgonzola, pear slices, walnut halves, honey drizzle. No meat.' },
  { id: 'speck_brie_pizza_romana',                   t: 'White base, melted brie wedges, thin speck slices, rosemary.' },
  { id: 'tarte_flambee_pizza_romana',                t: 'White crème fraîche base, smoked lardons, softened white onion rings. No tomato, no mozzarella.' },
  { id: 'raclette_pommes_pizza_romana',              t: 'White base, golden raclette cheese, thin potato slices, smoked lardons.' },
  { id: 'chevre_miel_pizza_romana',                  t: 'White olive oil base, goat cheese rounds, honey drizzle, walnut halves, thyme. No meat.' },
  { id: 'andouille_moutarde_pizza_romana',           t: 'Pale mustard cream base, thick andouille rounds, softened onion rings, melted emmental.' },
  { id: 'maroilles_oignons_pizza_romana',            t: 'White crème fraîche base, melted maroilles, golden caramelised onions. No meat.' },
  { id: 'jambon_espelette_pizza_romana',             t: 'White base, melted cheese, thin Bayonne ham, Espelette pepper flakes.' },
  { id: 'camembert_pommes_pizza_romana',             t: 'White crème fraîche base, camembert wedges, thin apple slices, smoked lardons.' },
  { id: 'tartiflette_pizza_pizza_romana',            t: 'Cream base, melted reblochon, thin potato slices, smoked lardons.' },
  { id: 'la_reine_pizza_romana',                     t: 'Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives.' },
  { id: 'la_royale_pizza_romana',                    t: 'Red tomato base, melted mozzarella, cooked ham, sliced mushrooms, black olives.' },
  { id: 'la_paysanne_pizza_romana',                  t: 'White crème fraîche base, smoked lardons, softened onion rings, melted mozzarella. No tomato.' },
  { id: 'quatre_saisons_pizza_romana',               t: 'Red tomato base, mozzarella. Four distinct quarters: artichoke, cooked ham, black olives, sliced mushrooms.' },
  { id: 'cosacca_pizza_romana',                      t: 'Red tomato base, finely grated dry pecorino romano sprinkled, fresh basil, olive oil. No mozzarella.' },
  { id: 'acciughe_pomodorini_pizza_romana',          t: 'Red tomato base, thin anchovy fillets, halved roasted cherry tomatoes, melted mozzarella, capers.' },
  { id: 'melanzane_parmigiana_pizza_romana',         t: 'Red tomato base, layered aubergine slices, grated parmesan, basil, melted mozzarella.' },
  { id: 'boscaiola_pizza_romana',                    t: 'Red tomato base, dark forest mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.' },
  { id: 'bismarck_pizza_romana',                     t: 'Red tomato base, melted mozzarella, cooked ham slices, sliced mushrooms, whole egg baked in center.' },
  { id: 'pugliese_pizza_romana',                     t: 'Red tomato base, black olives, capers, thin red onion, melted mozzarella.' },
  { id: 'prosciutto_funghi_pizza_romana',            t: 'Red tomato base, melted mozzarella, thin cooked ham slices, sliced brown mushrooms.' },
  { id: 'tonno_cipolla_red_pizza_romana',            t: 'Red tomato base, melted mozzarella, softened red onion rings, tuna flakes placed cold on top.' },
  { id: 'funghi_salsiccia_pizza_romana',             t: 'Red tomato base, sliced mushrooms, crumbled loose Italian sausage pieces, melted mozzarella.' },
  { id: 'salmone_rucola_pizza_romana',               t: 'White cream base, pink smoked salmon slices draped after baking, fresh rocket, capers.' },
  { id: 'acciughe_burro_pizza_romana',               t: 'White butter-enriched base, thin anchovy fillets, melted mozzarella.' },
  { id: 'genovese_pizza_romana',                     t: 'Bright green pesto base, thin golden potato slices, green beans cooked, melted mozzarella.' },
  { id: 'stracciatella_datterini_pizza_romana',      t: 'Red tomato base, small datterini cherry tomatoes roasted, fresh stracciatella dollops placed cold on top.' },
  { id: 'tartufo_fior_pizza_romana',                 t: 'White base, melted fior di latte mozzarella, dark truffle shavings after baking.' },
  { id: 'lardo_rosmarino_pizza_romana',              t: 'White base, thin translucent lardo slices melting, rosemary sprigs, sea salt.' },
  { id: 'caponata_pizza_romana',                     t: 'White base, Sicilian caponata vegetables: aubergine, peppers, capers, olives, melted mozzarella.' },
  { id: 'soppressata_fichi_pizza_romana',            t: 'White base, soppressata salami baked, melted mozzarella, halved fresh figs, honey drizzle.' },
  { id: 'guanciale_pecorino_pizza_romana',           t: 'Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.' },
  { id: 'honey_pecorino_pizza_romana',               t: 'White base, grated pecorino melted, golden honey drizzle, cracked black pepper.' },
  { id: 'porcini_stracciatella_pizza_romana',        t: 'White base, dark porcini mushrooms cooked, truffle oil, fresh stracciatella dollops cold on top.' },
  { id: 'crudo_parma_stracciatella_pizza_romana',    t: 'Red tomato base, melted mozzarella, thin Parma ham slices draped after baking, stracciatella dollops, basil.' },
  { id: 'smoked_salmon_cream_cheese_pizza_romana',   t: 'White cream cheese base, pink smoked salmon slices draped after baking, capers, fresh dill.' },
  { id: 'jamon_manchego_pizza_romana',               t: 'White base, melted manchego cheese, thin Iberico ham slices draped after baking, olive oil drizzle.' },
  { id: 'sobrasada_miel_pizza_romana',               t: 'White base, orange-red sobrasada paste spread in dollops, melted mozzarella, honey drizzle.' },
  { id: 'escalivada_pizza_romana',                   t: 'White olive oil base, fire-roasted aubergine strips, roasted red pepper strips, sliced onion.' },
  { id: 'chorizo_padron_pizza_romana',               t: 'Red tomato base, chorizo slices cooked, whole small green Padrón peppers, melted mozzarella.' },
  { id: 'halloumi_zaatar_pizza_romana',              t: 'White olive oil base with zaatar herb blend, grilled golden halloumi slices, roasted cherry tomatoes.' },
  { id: 'zaatar_labneh_pizza_romana',                t: 'White base with zaatar herb blend and sesame seeds, cold labneh dollops after baking.' },
  { id: 'merguez_harissa_pizza_romana',              t: 'Red harissa base, diagonal merguez sausage slices, whole egg baked in center with runny yolk.' },
  { id: 'teriyaki_chicken_pizza_romana',             t: 'White base, teriyaki-glazed chicken pieces, melted mozzarella, sesame seeds, spring onion.' },
  { id: 'provencale_pizza_romana',                   t: 'Red tomato base, melted mozzarella, thin anchovy fillets, black olives, herbes de Provence.' },
  { id: 'lorraine_pizza_pizza_romana',               t: 'White crème fraîche base, smoked lardons, melted emmental, softened onions.' },
  { id: 'pistou_pizza_pizza_romana',                 t: 'Bright green pistou pesto base, courgette slices, tomato pieces, softened goat cheese.' },
  { id: 'alsacienne_choucroute_pizza_romana',        t: 'White crème fraîche base, pale shredded sauerkraut, smoked lardons, melted Munster cheese.' },
  { id: 'basquaise_pizza_romana',                    t: 'Red tomato base, thin Bayonne ham slices draped loosely, Espelette pepper flakes, melted sheep cheese.' },
  { id: 'lyonnaise_pizza_romana',                    t: 'White fromage blanc base, golden caramelised onions, smoked lardons, melted mozzarella.' },
  { id: 'normandie_camembert_pizza_romana',          t: 'White crème fraîche base, melted camembert wedges, thin golden apple slices, smoked lardons.' },
  { id: 'fiori_zucca_alici_pizza_romana',            t: 'White base, large yellow courgette flowers baked, thin anchovy fillets, melted mozzarella.' },
  { id: 'amatriciana_pizza_pizza_romana',            t: 'Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.' },
  { id: 'bresaola_rucola_pizza_romana',              t: 'White base, melted mozzarella, thin dark red bresaola slices draped after baking, fresh rocket, parmesan shavings.' },
  { id: 'speck_stracchino_pizza_romana',             t: 'White stracchino cream base, thin speck ham slices draped loosely, melted mozzarella.' },
  { id: 'napoli_pizza_romana',                       t: 'Red tomato base, melted mozzarella, anchovy fillets, capers, black olives.' },
  { id: 'nduja_mozzarella_pizza_romana',             t: 'Red tomato base, nduja in irregular dollops, melted mozzarella.' },
  { id: 'tonno_cipolla_pizza_romana',                t: 'Red tomato base, melted mozzarella, softened onion rings, tuna flakes placed on top.' },
  { id: 'smoked_salmon_creme_pizza_romana',          t: 'White crème fraîche base, smoked salmon after baking, capers, fresh dill.' },
  { id: 'indivia_gorgonzola_pizza_romana',           t: 'White base, pale endive leaves wilted, melted gorgonzola, walnut halves. No meat.' },
  { id: 'verdure_grigliate_burrata_pizza_romana',    t: 'White base, grilled courgette, peppers, aubergine, burrata after baking.' },
  { id: 'alici_fresche_romana_pizza_romana',         t: 'White base, fresh anchovy fillets, halved roasted cherry tomatoes, capers.' },
  { id: 'porcini_pecorino_romana_pizza_romana',      t: 'White olive oil base, dark porcini mushrooms, grated pecorino, cracked black pepper. No tomato.' },
  { id: 'carciofi_romana_pizza_romana',              t: 'White olive oil base, artichoke heart quarters, garlic slices, fresh mint. No meat.' },
  { id: 'norma_pizza_romana',                        t: 'Red tomato base, fried aubergine slices, melted mozzarella, basil, ricotta salata on top.' },
  { id: 'pollo_pesto_pizza_romana',                  t: 'Bright green pesto base, grilled chicken slices, melted mozzarella, roasted cherry tomatoes.' },
  { id: 'bbq_chicken_pizza_romana',                  t: 'Dark BBQ sauce base, grilled chicken breast pieces, softened red onion, melted mozzarella.' },
  { id: 'shakshuka_pizza_romana',                    t: 'Spiced red tomato base, roasted red pepper strips, two eggs baked in, crumbled feta.' },
  { id: 'jerusalem_pizza_romana',                    t: 'Red tomato base, roasted aubergine chunks, chickpeas, tahini drizzle after baking, fresh parsley.' },
  { id: 'nutella_fraises_pizza_romana',              t: 'Nutella chocolate spread, fresh strawberry halves, light powdered sugar.' },
  { id: 'tarte_tatin_pizza_pizza_romana',            t: 'Caramelised apple slices arranged in overlapping circles, caramel glaze, small crème fraîche dollop in center.' },
  { id: 'poire_chocolat_pizza_romana',               t: 'Dark chocolate cream spread, fanned pear slices, mascarpone dollops.' },
  { id: 'honey_fig_mascarpone_pizza_romana',         t: 'White mascarpone spread, halved fresh figs, golden honey drizzle, crushed pistachios.' },
  { id: 'speculoos_banana_pizza_romana',             t: 'Speculoos biscuit spread, fresh banana slices, caramel drizzle.' },
  { id: 'creme_brulee_pizza_pizza_romana',           t: 'Vanilla cream spread, caramelised sugar crust across entire surface.' },
  { id: 'crisommola_pizza_romana',                   t: 'White ricotta spread, apricot halves arranged, golden honey drizzle.' },
  { id: 'ricotta_miele_castagne_pizza_romana',       t: 'Fresh white ricotta spread, dark chestnut honey drizzle, toasted almond flakes.' },
  { id: 'fragole_basilico_pizza_romana',             t: 'White mascarpone spread, fresh strawberry halves, small fresh basil leaves.' },
  { id: 'cioccolato_peperoncino_pizza_romana',       t: 'Dark chocolate cream spread, red chilli flakes, sea salt flakes.' },
  { id: 'mela_cannella_pizza_romana',                t: 'Cream cheese spread, caramelised apple slices, cinnamon powder.' },
  { id: 'caramel_noisette_pizza_romana',             t: 'Salted caramel spread, toasted hazelnut halves, vanilla cream dollops, sea salt flakes.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Teglia — base + _roman variant for each
// ─────────────────────────────────────────────────────────────────────────────
const TEGLIA_BASE = [
  { id: 'teglia_patata_provola',        t: 'White olive oil base, thin golden potato slices, smoked provola, rosemary.' },
  { id: 'teglia_funghi_salsiccia',      t: 'Red tomato base, mushrooms, crumbled Italian sausage, melted mozzarella.' },
  { id: 'teglia_prosciutto_cotto',      t: 'Red tomato base, cooked ham, sliced mushrooms, melted mozzarella.' },
  { id: 'teglia_zucchine_fiori',        t: 'White base, courgette slices, courgette flowers, melted mozzarella.' },
  { id: 'teglia_mortadella_pistacchio', t: 'White base, melted mozzarella, mortadella after baking, pistachio crumble, stracciatella.' },
  { id: 'teglia_tonno_cipolla',         t: 'Red tomato base, softened red onion rings, melted mozzarella, tuna flakes on top.' },
  { id: 'teglia_4_formaggi',            t: 'White cream base with four cheeses: mozzarella, gruyere, ricotta, gorgonzola. No meat.' },
  { id: 'teglia_speck_brie',            t: 'White base, melted brie, thin speck slices, fresh herbs.' },
  { id: 'teglia_verdure',               t: 'Red tomato base, grilled peppers, courgette, aubergine, melted mozzarella.' },
  { id: 'teglia_nduja_stracciatella',   t: 'Orange nduja base, cold stracciatella on top, chilli oil drizzle.' },
];

// Expand to both {id}.webp and {id}_roman.webp
const TEGLIA_PIZZAS = [];
TEGLIA_BASE.forEach(p => {
  TEGLIA_PIZZAS.push({ id: p.id,             t: p.t });
  TEGLIA_PIZZAS.push({ id: `${p.id}_roman`,  t: p.t });
});

// Missing base image
const MISSING_BASE = [
  { id: 'tarte_flambee', t: 'White crème fraîche base, smoked lardons, softened white onion rings. No tomato, no mozzarella.', type: 'romana' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Anchors — 3 images to validate before full run
// ─────────────────────────────────────────────────────────────────────────────
const ANCHORS = [
  { id: 'margherita_pizza_romana',     t: 'Red tomato sauce base, soft fior di latte mozzarella melted, fresh basil.', type: 'romana' },
  { id: 'amatriciana_pizza_pizza_romana', t: 'Red tomato base, crispy guanciale strips, grated pecorino, cracked black pepper.', type: 'romana' },
  { id: 'teglia_patata_provola',       t: 'White olive oil base, thin golden potato slices, smoked provola, rosemary.', type: 'teglia' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Build queue based on mode
// ─────────────────────────────────────────────────────────────────────────────
function buildQueue() {
  const romana = ROMANA_PIZZAS.map(p => ({ ...p, type: 'romana' }));
  const teglia = TEGLIA_PIZZAS.map(p => ({ ...p, type: 'teglia' }));

  switch (MODE) {
    case 'anchors': return ANCHORS;
    case 'romana':  return [...romana, ...MISSING_BASE];
    case 'teglia':  return teglia;
    case 'all':     return [...romana, ...teglia, ...MISSING_BASE];
    default:
      console.error(`Unknown mode: ${MODE}. Use anchors | romana | teglia | all`);
      process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAll() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const queue = buildQueue();
  const total = queue.length;
  let generated = 0;
  const failed = [];

  console.log('\n🍕 Baker Hub — Pizza Image Regeneration');
  console.log(`Mode:   ${MODE}`);
  console.log(`Model:  ${MODEL}`);
  console.log(`Total:  ${total}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (let i = 0; i < queue.length; i++) {
    const { id, t, type } = queue[i];
    const filepath = path.join(OUTPUT_DIR, `${id}.webp`);

    // Always force overwrite — this script exists to fix existing files
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[${i+1}/${total}] 🗑  Deleted old ${id}.webp`);
    }

    const prompt = type === 'teglia' ? TEG(t) : ROMA(t);

    try {
      console.log(`[${i+1}/${total}] 🎨 ${id}...`);
      const response = await client.images.generate({
        model: MODEL,
        prompt,
        n: 1,
        size: SIZE,
        quality: QUALITY,
        output_format: OUTPUT_FORMAT,
      });
      const buf = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, buf);
      console.log(`[${i+1}/${total}] ✅ ${id}.webp`);
      generated++;
    } catch (err) {
      console.error(`[${i+1}/${total}] ❌ ${id} — ${err.message}`);
      failed.push(id);
    }

    if (i < queue.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Generated: ${generated}`);
  console.log(`❌ Failed:    ${failed.length}`);
  if (failed.length) console.log(`Failed IDs: ${failed.join(', ')}`);
}

generateAll().catch(console.error);