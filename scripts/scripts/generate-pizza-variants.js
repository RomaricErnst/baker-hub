// scripts/generate-pizza-variants.js
// Generates style variants for top 15 pizzas × 3 styles (NY, Pizza Romana, Pan)
// Run AFTER generate-pizza-images.js completes
// Cost: ~$1.80 | Time: ~4 minutes

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 4500;

// Same SUFFIX as main script
const SUFFIX = 'Soft warm lighting from above-left, gentle shadow directly beneath the pizza. The pizza sits on a deep dark charcoal surface with a subtle warm reddish glow behind it. The surface around the pizza is completely bare — no flour, no dust, no powder, no crumbs, no props. Nothing else in the image except the pizza and the dark background.';

// Style-specific shapes — toppings stay identical to base, only crust changes
const NY = (t) => `A New York style pizza slightly viewed from above at 30 degrees, centered. Large wide thin flat base, wide diameter, minimal thin crust lip at edge only, foldable-looking. ${t} ${SUFFIX}`;
const ROMANA = (t) => `A Pizza Romana Tonda slightly viewed from above at 30 degrees, centered. Ultra-thin cracker-crisp flat base, absolutely no cornicione at all, completely flat paper-thin dough with no raised edge. ${t} ${SUFFIX}`;
const PAN = (t) => `A thick round pan pizza slightly viewed from above at 30 degrees, centered. Thick fluffy airy base with crispy bottom, clearly visible height and thickness at crust edge, deeper and softer than NY. ${t} ${SUFFIX}`;

// Top 15 pizzas — same toppings as base script
const TOPPINGS = {
  margherita:         'Baked on: bright red tomato sauce base, 5 soft irregular fior di latte mozzarella discs melted, 2 fresh green basil leaves placed after baking.',
  diavola:            'Baked on: red tomato base, overlapping dark spicy salami rounds, mozzarella melted, chilli flakes.',
  quattro_formaggi:   'Baked on: white cream base, four melted cheeses in distinct patches — pale mozzarella, golden gruyere, white ricotta, blue gorgonzola. No meat.',
  pepperoni:          'Baked on: red tomato base, generous pepperoni slices curled and cupped from oven heat, mozzarella melted underneath.',
  prosciutto_rucola:  'Baked on: red tomato base, mozzarella melted. Added cold after baking: thin pink prosciutto slices draped loosely, fresh green rocket leaves.',
  capricciosa:        'Baked on: red tomato base, mozzarella melted, cooked ham, sliced mushrooms, black olives, artichoke wedges.',
  quatre_saisons:     'Baked on: red tomato base, mozzarella melted. Four distinct quarters: artichoke top-left, ham top-right, black olives bottom-left, mushrooms bottom-right.',
  bbq_chicken:        'Baked on: dark BBQ sauce base, grilled chicken pieces cooked, red onion softened, mozzarella melted. No salami.',
  funghi_tartufo:     'Baked on: white truffle cream base, dark forest mushrooms cooked, mozzarella melted. Truffle shavings added cold after baking. No meat.',
  bianca_ricotta_spinaci: 'Baked on: white ricotta base, dark green wilted spinach, ricotta dollops melted slightly. No meat.',
  truffle_bianca:     'Baked on: white cream base, mozzarella melted. Truffle shavings added cold after baking. No meat.',
  salsiccia_friarielli: 'Baked on: white olive oil base, crumbled Italian sausage cooked, dark green broccoli rabe wilted, fior di latte melted.',
  norma:              'Baked on: red tomato base, fried aubergine slices cooked, mozzarella melted, basil. Added after: grated ricotta salata on top. No meat.',
  pollo_pesto:        'Baked on: green pesto base, grilled chicken pieces cooked, mozzarella melted, cherry tomatoes roasted. No salami.',
  ortolana:           'Baked on: red tomato base, grilled courgette, aubergine, red and yellow peppers cooked, mozzarella melted. No meat.',
};

// Build all 45 variants
const VARIANTS = [];
Object.entries(TOPPINGS).forEach(([id, toppings]) => {
  VARIANTS.push({ id: `${id}_newyork`,      prompt: NY(toppings) });
  VARIANTS.push({ id: `${id}_pizza_romana`, prompt: ROMANA(toppings) });
  VARIANTS.push({ id: `${id}_pan`,          prompt: PAN(toppings) });
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

async function generateAll() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const total = VARIANTS.length;
  let generated = 0, skipped = 0, failed = [];

  console.log('\n🍕 Pizza Style Variant Generator');
  console.log('📦 ' + total + ' variants | 💰 ~$' + (total * 0.04).toFixed(2) + ' | ⏱ ~' + Math.ceil(total * DELAY_MS / 60000) + ' min\n');
  console.log('Styles: _newyork · _pizza_romana · _pan\n');

  for (let i = 0; i < VARIANTS.length; i++) {
    const v = VARIANTS[i];
    const filepath = path.join(OUTPUT_DIR, v.id + '.png');

    if (fs.existsSync(filepath)) {
      console.log('[' + (i+1) + '/' + total + '] ⏭  Skipping: ' + v.id);
      skipped++;
      continue;
    }

    try {
      console.log('[' + (i+1) + '/' + total + '] 🎨 Generating: ' + v.id + '...');
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: v.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });
      await downloadImage(response.data[0].url, filepath);
      console.log('[' + (i+1) + '/' + total + '] ✅ ' + v.id + '.png');
      generated++;
    } catch (err) {
      console.error('[' + (i+1) + '/' + total + '] ❌ ' + v.id + ' — ' + err.message);
      failed.push(v.id);
    }

    if (i < VARIANTS.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n✅ Done! Generated: ' + generated + ' | Skipped: ' + skipped + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('💰 ~$' + (generated * 0.04).toFixed(2));
  console.log('\nFiles saved to: public/pizzas/[id]_newyork.png etc.');
  console.log('Run: git add public/pizzas && git commit -m "feat: pizza style variant images" && git push');
}

generateAll().catch(console.error);