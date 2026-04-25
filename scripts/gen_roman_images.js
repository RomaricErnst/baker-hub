// scripts/gen_roman_images.js
// Generates _roman variant images for ALL 64 pizzas with roman compatibleStyle
// Run: node scripts/gen_roman_images.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT = path.join(__dirname, '../public/pizzas');
const MODEL = 'gpt-image-2';
const DELAY = 3000;

const STYLE = 'Single pizza only, square composition, top-down view (~30 degrees). Soft warm lighting. Background deep charcoal (#1A1612) with subtle warm reddish-terracotta glow (#C4522A). No text, no labels, no props. This is a Roman Teglia pizza — rectangular or square thick focaccia-like base, baked in a metal tray. The base is thick, airy, crispy underneath. Toppings are generous and cover the rectangular surface. The overall shape reads as square/rectangular, not round.';

const ITEMS = [
  // Dedicated teglia entries
  { id: 'teglia_patata_provola',        toppings: 'Teglia Patata e Provola — thin potato slices, smoked provola melted, rosemary' },
  { id: 'teglia_funghi_salsiccia',      toppings: 'Teglia Funghi e Salsiccia — mushrooms, crumbled salsiccia, mozzarella' },
  { id: 'teglia_prosciutto_cotto',      toppings: 'Teglia Prosciutto Cotto — cooked ham, mushrooms, mozzarella, tomato base' },
  { id: 'teglia_zucchine_fiori',        toppings: 'Teglia Zucchine e Fiori — courgette slices, courgette flowers, mozzarella, light cream base' },
  { id: 'teglia_mortadella_pistacchio', toppings: 'Teglia Mortadella e Pistacchio — mortadella folds added after baking, crushed pistachio, stracciatella' },
  { id: 'teglia_tonno_cipolla',         toppings: 'Teglia Tonno e Cipolla — tuna, thin red onion rings, tomato, olives' },
  { id: 'teglia_4_formaggi',            toppings: 'Teglia Quattro Formaggi — four melted cheeses, mozzarella gorgonzola taleggio parmigiano, golden bubbling' },
  { id: 'teglia_speck_brie',            toppings: 'Teglia Speck e Brie — speck slices, brie wedges melting, honey drizzle' },
  { id: 'teglia_verdure',              toppings: 'Teglia Verdure — grilled courgette aubergine red pepper cherry tomatoes herbs' },
  { id: 'teglia_nduja_stracciatella',   toppings: 'Teglia Nduja e Stracciatella — spicy nduja on tomato base, stracciatella cream dollops, fresh basil' },
  // Roman-compatible non-teglia pizzas
  { id: 'cosacca',                      toppings: 'Cosacca — tomato sauce, pecorino romano, basil, no mozzarella' },
  { id: 'acciughe_pomodorini',          toppings: 'Acciughe e Pomodorini — cherry tomatoes, anchovies, capers, olives' },
  { id: 'melanzane_parmigiana',         toppings: 'Melanzane alla Parmigiana — fried aubergine slices, tomato, mozzarella, basil' },
  { id: 'boscaiola',                    toppings: 'Boscaiola — mushrooms, salsiccia, cream base, mozzarella' },
  { id: 'bismarck',                     toppings: 'Bismarck — tomato base, mozzarella, whole baked egg in center, ham' },
  { id: 'pugliese',                     toppings: 'Pugliese — olives, capers, cherry tomatoes, red onion, anchovies' },
  { id: 'prosciutto_funghi',            toppings: 'Prosciutto e Funghi — cooked ham, mushrooms, mozzarella, tomato base' },
  { id: 'tonno_cipolla_red',            toppings: 'Tonno e Cipolla Rossa — tuna, red onion, tomato, capers' },
  { id: 'funghi_salsiccia',             toppings: 'Funghi e Salsiccia — mushrooms, crumbled sausage, mozzarella, tomato' },
  { id: 'salmone_rucola',               toppings: 'Salmone e Rucola — smoked salmon added after baking, rocket, cream cheese base, capers' },
  { id: 'acciughe_burro',               toppings: 'Acciughe e Burro — anchovies, butter, bianca base' },
  { id: 'pollo_pesto',                  toppings: 'Pollo e Pesto — grilled chicken, pesto base, mozzarella, cherry tomatoes' },
  { id: 'genovese',                     toppings: 'Genovese — pesto base, thin potato slices, green beans, mozzarella' },
  { id: 'stracciatella_datterini',      toppings: 'Stracciatella e Datterini — cherry tomatoes, stracciatella cream dollops, fresh basil' },
  { id: 'tartufo_fior',                 toppings: 'Tartufo e Fior di Latte — truffle oil, fior di latte mozzarella, bianca base' },
  { id: 'lardo_rosmarino',              toppings: 'Lardo e Rosmarino — lardo slices melting, rosemary, bianca base' },
  { id: 'caponata_pizza',               toppings: 'Caponata — Sicilian caponata vegetables, mozzarella, tomato' },
  { id: 'soppressata_fichi',            toppings: 'Soppressata e Fichi — soppressata salami, fresh figs, mozzarella' },
  { id: 'guanciale_pecorino',           toppings: 'Guanciale e Pecorino — guanciale, pecorino, black pepper, bianca base' },
  { id: 'honey_pecorino',               toppings: 'Honey e Pecorino — honey drizzle, pecorino, walnuts, bianca cream base' },
  { id: 'porcini_stracciatella',        toppings: 'Porcini e Stracciatella — porcini mushrooms, stracciatella cream, bianca base' },
  { id: 'crudo_parma_stracciatella',    toppings: 'Crudo di Parma e Stracciatella — prosciutto crudo added after baking, stracciatella, tomato base' },
  { id: 'norma',                        toppings: 'Norma — fried aubergine, tomato, ricotta salata, basil' },
  { id: 'carciofi_romana',              toppings: 'Carciofi alla Romana — artichoke hearts, mozzarella, bianca base, garlic' },
  { id: 'fiori_zucca_alici',            toppings: 'Fiori di Zucca e Alici — courgette flowers, anchovies, mozzarella, bianca base' },
  { id: 'amatriciana_pizza',            toppings: 'Amatriciana — guanciale, tomato sauce, pecorino, chilli' },
  { id: 'carbonara_pizza',              toppings: 'Carbonara — guanciale, egg yolk cream, pecorino, black pepper, bianca base' },
  { id: 'cacio_pepe_pizza',             toppings: 'Cacio e Pepe — pecorino cream, black pepper, mozzarella, bianca base' },
  { id: 'gricia_pizza',                 toppings: 'Gricia — guanciale, pecorino, black pepper, bianca base, no tomato' },
  { id: 'bianca_rosmarino',             toppings: 'Bianca al Rosmarino — olive oil, rosemary, sea salt, no cheese no tomato, just dimpled focaccia surface' },
  { id: 'bresaola_rucola_pizza',        toppings: 'Bresaola e Rucola — bresaola added after baking, rocket, parmigiano shavings, mozzarella' },
  { id: 'speck_stracchino',             toppings: 'Speck e Stracchino — speck slices, stracchino melted, bianca base' },
  { id: 'indivia_gorgonzola',           toppings: 'Indivia e Gorgonzola — endive, gorgonzola, walnuts, bianca base' },
  { id: 'prosciutto_stracciatella_romana', toppings: 'Prosciutto e Stracciatella — prosciutto after baking, stracciatella cream, tomato base' },
  { id: 'patata_rosmarino_romana',      toppings: 'Patata e Rosmarino — thin potato slices, rosemary, olive oil, sea salt, bianca base' },
  { id: 'verdure_grigliate_burrata',    toppings: 'Verdure Grigliate e Burrata — grilled mixed vegetables, burrata added after baking, basil' },
  { id: 'alici_fresche_romana',         toppings: 'Alici Fresche e Pomodorini — fresh anchovies, cherry tomatoes, capers, bianca base' },
  { id: 'porcini_pecorino_romana',      toppings: 'Porcini e Pecorino Romano — porcini mushrooms, pecorino romano, thyme, bianca base' },
  { id: 'smoked_salmon_cream_cheese',   toppings: 'Smoked Salmon and Cream Cheese — smoked salmon added after baking, cream cheese base, capers, dill' },
  { id: 'jamon_manchego',               toppings: 'Jamon Iberico e Manchego — jamón ibérico after baking, manchego melted, tomato base' },
  { id: 'sobrasada_miel',               toppings: 'Sobrasada e Miel — sobrasada spread, honey drizzle, mozzarella' },
  { id: 'escalivada',                   toppings: 'Escalivada — roasted red pepper and aubergine, anchovy, bianca base' },
  { id: 'chorizo_padron',               toppings: 'Chorizo e Padron — chorizo slices, padron peppers, tomato base, mozzarella' },
  { id: 'halloumi_zaatar',              toppings: 'Halloumi e Zaatar — halloumi slices golden, zaatar, tomato base, olive oil' },
  { id: 'zaatar_labneh',               toppings: 'Zaatar e Labneh — labneh cream dollops, zaatar herb blend, olive oil drizzle, bianca base' },
  { id: 'merguez_harissa',              toppings: 'Merguez e Harissa — merguez sausage slices, harissa base, mozzarella' },
  { id: 'teriyaki_chicken',             toppings: 'Teriyaki Chicken — teriyaki glazed chicken, sesame seeds, spring onion, mozzarella' },
  { id: 'provencale',                   toppings: 'Provencale — tomato base, olives, herbes de Provence, anchovies, bianca areas' },
  { id: 'lorraine_pizza',               toppings: 'Lorraine — creme fraiche base, smoked lardons, emmental, dijon mustard' },
  { id: 'pistou_pizza',                 toppings: 'Pistou — pistou pesto base, goat cheese crumbles, cherry tomatoes' },
  { id: 'alsacienne_choucroute',        toppings: 'Alsacienne au Choucroute — creme fraiche base, sauerkraut, smoked lardons, munster cheese' },
  { id: 'basquaise',                    toppings: 'Basquaise — piperade pepper sauce base, bayonne ham slices, mozzarella' },
  { id: 'lyonnaise',                    toppings: 'Lyonnaise — caramelised onion, smoked lardons, creme fraiche base, emmental' },
  { id: 'normandie_camembert',          toppings: 'Normande au Camembert — camembert wedges, apple slices, smoked lardons, cider reduction drizzle' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub Roman Teglia Image Generator');
  console.log('Model: ' + MODEL + ' | Total: ' + ITEMS.length + ' images');
  console.log('Est. time: ~' + Math.ceil(ITEMS.length * DELAY / 60000) + ' min\n');

  let done = 0;
  const failed = [];
  const skipped = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, toppings } = ITEMS[i];
    const outPath = path.join(OUTPUT, id + '_roman.png');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Skip (exists): ' + id);
      skipped.push(id);
      done++;
      continue;
    }

    const prompt = STYLE + ' ' + toppings + '.';

    try {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Generating: ' + id + '...');
      const res = await client.images.generate({
        model: MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Done: ' + id + '_roman.png');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + ITEMS.length + '] Failed: ' + id + ' — ' + e.message);
      failed.push(id);
    }

    if (i < ITEMS.length - 1) await sleep(DELAY);
  }

  console.log('\n--- COMPLETE ---');
  console.log('Done: ' + done + ' | Skipped: ' + skipped.length + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed IDs: ' + failed.join(', '));
  console.log('\nNext step:');
  console.log('git add public/pizzas/*_roman.png && git commit -m "feat: roman teglia variant images for all 64 compatible pizzas" && git push');
}

run().catch(console.error);