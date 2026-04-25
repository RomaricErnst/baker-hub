// scripts/gen_newyork_missing.js
// 9 missing NY variant images
// Run: node scripts/gen_newyork_missing.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT = path.join(__dirname, '../public/pizzas');
const MODEL = 'gpt-image-2';
const DELAY = 3000;

const STYLE = `
Single pizza only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium food object illustration with soft volume.
Not a logo, not a symbol, not a UI badge, not graphic design, not flat icon style.
Matte surfaces, clean edges, soft depth.
No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props of any kind.
No text, no labels, no watermarks.
`.trim();

const NY_GEO = `
A single New York-style pizza slice.
Large triangular slice with a thin base.
Gently raised but relatively flat crust lip.
Tip slightly thinner and more flexible to suggest foldability.
Overall look is thin, broad, and slightly flexible.
`.trim();

const buildPrompt = (toppings) => `${STYLE}\n${NY_GEO}\n${toppings}`;

const ITEMS = [
  {
    id: 'smoked_salmon_creme',
    suffix: '_newyork',
    toppings: 'NY style — crème fraîche base, smoked salmon slices laid across after baking, capers, fresh dill, thin red onion rings. Elegant white pizza.',
  },
  {
    id: 'ny_pepperoni_slice',
    suffix: '_newyork',
    toppings: 'NY pepperoni slice — classic tomato sauce, generous mozzarella, large cupped pepperoni slices that curl and char slightly at the edges. Very generous pepperoni coverage.',
  },
  {
    id: 'white_clam_apizza',
    suffix: '_newyork',
    toppings: 'New Haven white clam pizza — no tomato, olive oil base, fresh chopped clams, garlic, oregano, pecorino romano, no mozzarella. Minimal but bold.',
  },
  {
    id: 'ny_sausage_peppers',
    suffix: '_newyork',
    toppings: 'NY sausage and peppers — tomato base, mozzarella, crumbled Italian sausage, sliced green and red bell peppers, caramelised onion.',
  },
  {
    id: 'buffalo_chicken',
    suffix: '_newyork',
    toppings: 'Buffalo chicken pizza NY style — white cream base, generous mozzarella, buffalo-sauced chicken pieces, drizzle of ranch or blue cheese dressing, celery flecks.',
  },
  {
    id: 'smoked_salmon_cream_cheese',
    suffix: '_newyork',
    toppings: 'NY smoked salmon and cream cheese — cream cheese base spread generously, smoked salmon slices added after baking, capers, red onion, fresh dill.',
  },
  {
    id: 'ny_clam_garlic',
    suffix: '_newyork',
    toppings: 'NY clam and garlic white pizza — olive oil base, mozzarella, clam pieces, sliced garlic, fresh parsley, parmesan. No tomato.',
  },
  {
    id: 'ny_margherita_bufala',
    suffix: '_newyork',
    toppings: 'NY margherita with buffalo mozzarella — large round NY-style, tomato sauce, torn buffalo mozzarella in generous pieces, fresh basil leaves, olive oil drizzle.',
  },
  {
    id: 'ny_diavola',
    suffix: '_newyork',
    toppings: 'NY diavola — large NY-style round, tomato base, mozzarella, spicy salami slices, fresh chilli rings, chilli oil drizzle.',
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub — NY Missing Image Generator');
  console.log('Images: ' + ITEMS.length + ' | Est: ~' + Math.ceil(ITEMS.length * DELAY / 60000) + ' min\n');

  let done = 0;
  const failed = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, suffix, toppings } = ITEMS[i];
    const outPath = path.join(OUTPUT, id + suffix + '.png');

    if (fs.existsSync(outPath)) {
      fs.unlinkSync(outPath);
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Deleted existing: ' + id + suffix + '.png');
    }

    const prompt = buildPrompt(toppings);
    try {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Generating: ' + id + suffix + '...');
      const res = await client.images.generate({
        model: MODEL, prompt, n: 1,
        size: '1024x1024', quality: 'high', output_format: 'png',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Done: ' + id + suffix + '.png');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + ITEMS.length + '] FAILED: ' + id + ' — ' + e.message);
      failed.push(id + suffix);
    }

    if (i < ITEMS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nNext: git add public/pizzas/*_newyork.png && git commit -m "feat: add 9 missing NY variant images" && git push');
}

run().catch(console.error);