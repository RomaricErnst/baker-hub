// scripts/gen_roman_missing.js
// Only the 26 roman pizzas that have compatibleStyles: roman but no _roman image
// Run: node scripts/gen_roman_missing.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT = path.join(__dirname, '../public/pizzas');
const MODEL = 'gpt-image-2';
const DELAY = 3000;

const STYLE = 'Single pizza only, square composition, top-down view (~30 degrees). Soft warm lighting. Background deep charcoal (#1A1612) with subtle warm reddish-terracotta glow (#C4522A). No text, no labels, no props. Roman Teglia style — rectangular or square thick focaccia-like base baked in an oiled metal tray. Thick, airy, crispy underneath. Toppings generous and cover the rectangular surface. Shape reads as square/rectangular, not round.';

const ITEMS = [
  { id: 'prosciutto_funghi',            toppings: 'cooked ham, mushrooms, mozzarella, tomato base' },
  { id: 'guanciale_pecorino',           toppings: 'guanciale, pecorino romano, black pepper, bianca base' },
  { id: 'carciofi_romana',              toppings: 'artichoke hearts, mozzarella, bianca base, garlic' },
  { id: 'fiori_zucca_alici',            toppings: 'courgette flowers, anchovies, mozzarella, bianca base' },
  { id: 'amatriciana_pizza',            toppings: 'guanciale, tomato sauce, pecorino romano, chilli' },
  { id: 'carbonara_pizza',              toppings: 'guanciale, egg yolk cream, pecorino, black pepper, bianca base' },
  { id: 'cacio_pepe_pizza',             toppings: 'pecorino cream, black pepper, mozzarella, bianca base' },
  { id: 'gricia_pizza',                 toppings: 'guanciale, pecorino, black pepper, bianca base, no tomato' },
  { id: 'bianca_rosmarino',             toppings: 'olive oil, rosemary, sea salt, dimpled focaccia surface, no cheese no tomato' },
  { id: 'bresaola_rucola_pizza',        toppings: 'bresaola added after baking, rocket, parmigiano shavings, mozzarella base' },
  { id: 'speck_stracchino',             toppings: 'speck slices, stracchino melted, bianca base' },
  { id: 'indivia_gorgonzola',           toppings: 'endive, gorgonzola, walnuts, bianca base' },
  { id: 'prosciutto_stracciatella_romana', toppings: 'prosciutto crudo after baking, stracciatella cream dollops, tomato base' },
  { id: 'patata_rosmarino_romana',      toppings: 'thin potato slices, rosemary, olive oil, sea salt, bianca base' },
  { id: 'verdure_grigliate_burrata',    toppings: 'grilled courgette aubergine red pepper, burrata added after baking, basil' },
  { id: 'alici_fresche_romana',         toppings: 'fresh anchovies, cherry tomatoes, capers, bianca base' },
  { id: 'porcini_pecorino_romana',      toppings: 'porcini mushrooms, pecorino romano, thyme, bianca base' },
  { id: 'teglia_zucchine_fiori',        toppings: 'courgette slices, courgette flowers, mozzarella, light cream base' },
  { id: 'teglia_mortadella_pistacchio', toppings: 'mortadella folds after baking, crushed pistachio, stracciatella cream' },
  { id: 'teglia_tonno_cipolla',         toppings: 'tuna, thin red onion rings, tomato base, olives' },
  { id: 'teglia_4_formaggi',            toppings: 'four melted cheeses mozzarella gorgonzola taleggio parmigiano, golden bubbling' },
  { id: 'teglia_speck_brie',            toppings: 'speck slices, brie wedges melting, honey drizzle' },
  { id: 'teglia_verdure',               toppings: 'grilled courgette aubergine red pepper cherry tomatoes herbs' },
  { id: 'teglia_nduja_stracciatella',   toppings: 'spicy nduja on tomato base, stracciatella cream dollops, fresh basil' },
  { id: 'lorraine_pizza',               toppings: 'creme fraiche base, smoked lardons, emmental, dijon mustard' },
  { id: 'shakshuka',                    toppings: 'spiced tomato sauce base, three whole eggs baked in, crumbled feta, fresh herbs' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nRoman Teglia — ' + ITEMS.length + ' missing images');
  console.log('Est: ~' + Math.ceil(ITEMS.length * DELAY / 60000) + ' min\n');
  let done = 0; const failed = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, toppings } = ITEMS[i];
    const outPath = path.join(OUTPUT, id + '_roman.webp');
    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Skip: ' + id);
      done++; continue;
    }
    const prompt = STYLE + ' ' + toppings + '.';
    try {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] ' + id + '...');
      const res = await client.images.generate({
        model: MODEL, prompt, n: 1,
        size: '1024x1024', quality: 'high', output_format: 'png',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Done: ' + id + '_roman.webp');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + ITEMS.length + '] FAILED: ' + id + ' — ' + e.message);
      failed.push(id);
    }
    if (i < ITEMS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nNext: git add public/pizzas/*_roman.webp && git commit -m "feat: roman teglia images for 26 missing pizzas" && git push');
}

run().catch(console.error);