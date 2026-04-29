const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 4000;

const STYLE = `Single pizza only, centered, square composition. Slight top-down angle (~30 degrees). Soft warm lighting with gentle depth and a soft diffused shadow underneath. Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only. Premium food object illustration with soft volume. Not a logo, not a symbol, not a UI badge. Matte surfaces, clean edges, soft depth. No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no props, no hands. No toppings other than the ones explicitly requested. No text, no labels.`;

const GEO_ROMANA = `An extremely thin and flat Roman-style pizza (pizza romana). Perfectly round, crisp and flat from edge to edge. No raised cornicione, no puffiness. Paper-thin, cracker-like base. Toppings visible on a very flat surface.`;

function buildPrompt(toppings) {
  return [STYLE, GEO_ROMANA, toppings.trim()].join(' ');
}

const DESSERTS = [
  { id: 'nutella_fraises',         toppings: 'White base, generous Nutella spread, fresh sliced strawberries, dusting of icing sugar.' },
  { id: 'tarte_tatin_pizza',       toppings: 'Crème fraîche base, golden caramelised apple slices arranged neatly, cinnamon dust, icing sugar.' },
  { id: 'poire_chocolat',          toppings: 'Dark chocolate cream base, thin pear slices fanned out, toasted almond flakes, icing sugar.' },
  { id: 'honey_fig_mascarpone',    toppings: 'Mascarpone base, halved fresh figs, honey drizzle, crushed walnuts.' },
  { id: 'speculoos_banana',        toppings: 'Speculoos spread base, thin banana slices, caramel drizzle, icing sugar.' },
  { id: 'creme_brulee_pizza',      toppings: 'Vanilla cream base, caramelised sugar crust on top, mixed berries scattered.' },
  { id: 'crisommola',              toppings: 'Ricotta base, caramelised apple slices, honey drizzle, cinnamon.' },
  { id: 'ricotta_miele_castagne',  toppings: 'Ricotta base, chestnut honey drizzle, toasted almond flakes.' },
  { id: 'fragole_basilico',        toppings: 'Ricotta base, fresh strawberries, fresh basil leaves, honey drizzle.' },
  { id: 'cioccolato_peperoncino',  toppings: 'Dark chocolate cream base, red chilli flakes, flaky sea salt.' },
  { id: 'mela_cannella',           toppings: 'Crème fraîche base, caramelised apple slices, cinnamon dust, icing sugar.' },
  { id: 'caramel_noisette',        toppings: 'Crème fraîche base, caramel drizzle, crushed hazelnuts, flaky sea salt.' },
];

async function generate(dessert) {
  const outPath = path.join(OUTPUT_DIR, `${dessert.id}_pizza_romana.webp`);
  if (fs.existsSync(outPath)) {
    console.log(`SKIP  ${dessert.id}_pizza_romana.webp`);
    return;
  }
  console.log(`GEN   ${dessert.id}_pizza_romana...`);
  try {
    const response = await client.images.generate({
      model: 'gpt-image-2',
      prompt: buildPrompt(dessert.toppings),
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'webp',
    });
    const b64 = response.data[0].b64_json;
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    console.log(`DONE  ${dessert.id}_pizza_romana.webp`);
  } catch (err) {
    console.error(`ERR   ${dessert.id}: ${err.message}`);
  }
}

async function main() {
  for (const d of DESSERTS) {
    await generate(d);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.log('All done.');
}

main();
