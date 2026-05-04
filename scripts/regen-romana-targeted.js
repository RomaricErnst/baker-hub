// scripts/regen-romana-targeted.js
// Regenerates 11 old-style pizza_romana images + generates 8 missing images
// Run: node scripts/regen-romana-targeted.js

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

const STYLE = `
Single pizza only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium food photography, matte surfaces, clean edges, soft depth.
No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands.
No toppings other than the ones explicitly requested.
No text, no labels.
`.trim();

const GEO_ROMA = `
A round pizza Romana.
Thin and crispy Roman-style, slightly irregular round shape.
Charred leopard spotting on crust edges.
`;

const GEO_TEG = `
A rectangular Roman teglia pizza portion placed directly on the dark surface.
Light and airy thick base with low height. Straight edges, slightly rounded corners.
Absolutely NO tray, NO baking pan, NO dish visible anywhere.
`;

const GEO_PAN = `
A thick round pan pizza. Clearly thicker than Neapolitan.
Soft, fluffy structure with visible height. Round, thick, and substantial.
`;

function clean(t) { return t.replace(/\s+/g, ' ').trim(); }

function ROMA(t) {
  return clean(`${STYLE} ${GEO_ROMA} ${t} Toppings must be extremely restrained, flat, and integrated into the surface. No large topping pieces, no decorative garnish.`);
}
function TEG(t) {
  return clean(`${STYLE} ${GEO_TEG} ${t} Toppings simple, understated, and evenly distributed. No decorative garnish.`);
}
function PAN(t) {
  return clean(`${STYLE} ${GEO_PAN} ${t}`);
}

// FORCE = true means delete existing file before regenerating
// FORCE = false means skip if file exists (for new files)
const QUEUE = [
  // ── 11 OLD-STYLE ROMANA TO FORCE REGENERATE ──────────────────────────────
  { id: 'prosciutto_stracciatella_romana_pizza_romana', force: true,
    prompt: ROMA('White base, cold stracciatella dollops placed generously after baking, thin prosciutto crudo draped in generous folds after baking.') },
  { id: 'truffle_egg_pizza_romana', force: true,
    prompt: ROMA('Dark truffle cream base, melted fior di latte around edges, whole egg baked in center with runny yolk, black truffle shavings, grated parmesan.') },
  { id: 'pistacchio_mortadella_pizza_romana', force: true,
    prompt: ROMA('Pale green pistachio cream base, melted fior di latte, large billowing mortadella folds placed cold after baking, crushed pistachios, stracciatella dollops.') },
  { id: 'peking_duck_pizza_romana', force: true,
    prompt: ROMA('Dark hoisin base, shredded crispy Peking duck, julienned spring onion, thin cucumber strips added cold, sesame seeds.') },
  { id: 'banh_mi_pizza_pizza_romana', force: true,
    prompt: ROMA('Smooth pale pâté base, thin char siu pork slices with caramelised glaze, julienned pickled daikon and carrot, fresh coriander, jalapeño slices.') },
  { id: 'tom_yam_prawn_pizza_romana', force: true,
    prompt: ROMA('Pale orange spiced tom yam cream base, whole prawns, straw mushrooms, spring onion slices.') },
  { id: 'bresaola_rucola_pizza_pizza_romana', force: true,
    prompt: ROMA('White base, melted mozzarella, thin dark red bresaola slices draped after baking, fresh rocket, parmesan shavings.') },
  { id: 'bianca_rosmarino_pizza_romana', force: true,
    prompt: ROMA('White olive oil base, rosemary sprigs pressed into dough, sea salt crystals. Nothing else.') },
  { id: 'gricia_pizza_pizza_romana', force: true,
    prompt: ROMA('White olive oil base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato.') },
  { id: 'cacio_pepe_pizza_pizza_romana', force: true,
    prompt: ROMA('White pecorino cream base, generous cracked black pepper. Nothing else.') },
  { id: 'carbonara_pizza_pizza_romana', force: true,
    prompt: ROMA('Pale yellow egg cream base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato.') },

  // ── NEW MISSING IMAGES ────────────────────────────────────────────────────
  { id: 'caponata_pizza_pizza_romana', force: false,
    prompt: ROMA('White base, Sicilian caponata: diced aubergine, peppers, capers, olives, melted mozzarella.') },
  { id: 'patate_rosmarino_pizza_romana', force: false,
    prompt: ROMA('White olive oil base, ultra-thin golden potato slices, fresh rosemary, sea salt. No meat, no cheese.') },
  { id: 'patate_rosmarino_roman', force: false,
    prompt: TEG('White olive oil base, ultra-thin golden potato slices, fresh rosemary, sea salt. No meat, no cheese.') },
  { id: 'hot_honey_pepperoni_pan', force: false,
    prompt: PAN('Red tomato base, crispy pepperoni cups curling from heat, melted mozzarella, hot honey drizzle.') },
  { id: 'ny_sausage_peppers_pan', force: false,
    prompt: PAN('Red tomato base, crumbled Italian sausage, green and red pepper strips, caramelised onion, melted mozzarella.') },
  { id: 'vodka_pizza_pan', force: false,
    prompt: PAN('Pale pink-orange vodka cream sauce base, melted mozzarella, fresh basil. No meat.') },
  { id: 'buffalo_chicken_pan', force: false,
    prompt: PAN('White base, buffalo sauce chicken pieces, melted mozzarella, blue cheese crumbles.') },
  { id: 'california_bbq_chicken_pan', force: false,
    prompt: PAN('Dark BBQ sauce base, grilled chicken pieces, red onion, melted mozzarella, fresh coriander.') },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const total = QUEUE.length;
  let generated = 0;
  const failed = [];

  console.log('\n🍕 Targeted Pizza Image Regeneration');
  console.log(`Total: ${total} (11 force regen + 8 new)\n`);

  for (let i = 0; i < QUEUE.length; i++) {
    const { id, prompt, force } = QUEUE[i];
    const filepath = path.join(OUTPUT_DIR, `${id}.webp`);

    if (fs.existsSync(filepath)) {
      if (force) {
        fs.unlinkSync(filepath);
        console.log(`[${i+1}/${total}] 🗑  Deleted old ${id}.webp`);
      } else {
        console.log(`[${i+1}/${total}] ⏭  Skipped (exists): ${id}.webp`);
        continue;
      }
    }

    try {
      console.log(`[${i+1}/${total}] 🎨 Generating ${id}...`);
      const response = await client.images.generate({
        model: MODEL, prompt, n: 1,
        size: SIZE, quality: QUALITY, output_format: OUTPUT_FORMAT,
      });
      const buf = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, buf);
      console.log(`[${i+1}/${total}] ✅ ${id}.webp`);
      generated++;
    } catch (err) {
      console.error(`[${i+1}/${total}] ❌ ${id} — ${err.message}`);
      failed.push(id);
    }

    if (i < QUEUE.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Generated: ${generated}`);
  console.log(`❌ Failed:    ${failed.length}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

run().catch(console.error);