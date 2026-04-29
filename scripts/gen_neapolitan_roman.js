const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 4000;

const STYLE = `Single pizza only, centered, square composition. Slight top-down angle (~30 degrees). Soft warm lighting with gentle depth and a soft diffused shadow underneath. Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only. Premium food object illustration with soft volume. Not a logo, not a symbol, not a UI badge, not graphic design, not flat icon style. Matte surfaces, clean edges, soft depth. No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands. No toppings other than the ones explicitly requested. No text, no labels.`;

const GEO_NEA = `A round Neapolitan-style pizza. Slightly organic shape, not perfectly circular. Airy puffy cornicione with soft uneven volume. Thinner center. Overall look is soft, generous, and airy. Keep toppings restrained and premium, softly integrated into the surface.`;

function buildPrompt(toppings) {
  return [STYLE, GEO_NEA, toppings.trim()].join(' ');
}

const PIZZAS = [
  {
    id: 'carciofi_romana',
    toppings: 'White olive oil base, quartered artichoke hearts softly wilted, melted fior di latte mozzarella, thin garlic slices, fresh mint leaves scattered.',
  },
  {
    id: 'fiori_zucca_alici',
    toppings: 'White cream base, open courgette flowers gently baked, fresh anchovy fillets laid across, soft fior di latte mozzarella melted.',
  },
  {
    id: 'bianca_rosmarino',
    toppings: 'White olive oil base, fresh rosemary sprigs pressed into dough, flaky sea salt. No cheese, no tomato.',
  },
  {
    id: 'bresaola_rucola_pizza',
    toppings: 'Red tomato base, melted fior di latte mozzarella, dark red bresaola slices added after baking, fresh rocket leaves, parmesan shavings.',
  },
  {
    id: 'speck_stracchino',
    toppings: 'White stracchino cream spread thinly, thin speck slices, melted fior di latte mozzarella.',
  },
  {
    id: 'indivia_gorgonzola',
    toppings: 'White cream base, pale endive strips wilted, gorgonzola crumbles, melted mozzarella.',
  },
  {
    id: 'verdure_grigliate_burrata',
    toppings: 'Red tomato base, grilled courgette strips, grilled aubergine slices, grilled pepper strips, burrata dollop added after baking.',
  },
  {
    id: 'alici_fresche_romana',
    toppings: 'Red tomato base, fresh anchovy fillets, halved cherry tomatoes, capers, olive oil drizzle.',
  },
  {
    id: 'porcini_pecorino_romana',
    toppings: 'White olive oil base, dark porcini mushrooms scattered, shaved pecorino, fresh thyme sprigs.',
  },
];

async function generate(pizza) {
  const outPath = path.join(OUTPUT_DIR, `${pizza.id}.webp`);
  if (fs.existsSync(outPath)) {
    console.log(`SKIP  ${pizza.id}.webp (already exists)`);
    return;
  }
  console.log(`GEN   ${pizza.id}...`);
  try {
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: buildPrompt(pizza.toppings),
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'webp',
    });
    const b64 = response.data[0].b64_json;
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    console.log(`DONE  ${pizza.id}.webp`);
  } catch (err) {
    console.error(`ERR   ${pizza.id}: ${err.message}`);
  }
}

async function main() {
  for (const pizza of PIZZAS) {
    await generate(pizza);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log('All done.');
}

main();
