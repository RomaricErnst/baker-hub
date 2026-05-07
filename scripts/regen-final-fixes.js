// scripts/regen-final-fixes.js
// Final targeted fixes:
// - 4 neapolitan base images for sourdough filter (cacio_pepe, carbonara, gricia, ny_margherita_bufala)  
// - 1 force regen stracciatella_pomodoro_pizza_romana (old style)
// - 1 force regen prosciutto_stracciatella_romana_roman (tray style)
// Run: node scripts/regen-final-fixes.js

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

const STYLE = `Single pizza only, centered, square composition. Slight top-down angle (~30 degrees). Soft warm lighting with gentle depth and a soft diffused shadow underneath. Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only. Premium food photography, matte surfaces, clean edges, soft depth. No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands. No toppings other than the ones explicitly requested. No text, no labels.`;

const GEO_NEA = `A round Neapolitan-style pizza. Slightly organic shape, not perfectly circular. Airy puffy cornicione with soft uneven volume. Thinner center. Overall look is soft, generous, and airy.`;

const GEO_ROMA = `A round pizza Romana. Thin and crispy Roman-style, slightly irregular round shape. Charred leopard spotting on crust edges.`;

const GEO_TEG = `A rectangular Roman teglia pizza portion placed directly on the dark surface. Light and airy thick base with low height. Straight edges, slightly rounded corners. Absolutely NO tray, NO baking pan, NO dish visible anywhere.`;

function clean(t) { return t.replace(/\s+/g, ' ').trim(); }
function NEA(t) { return clean(`${STYLE} ${GEO_NEA} ${t} Keep toppings restrained and premium, softly integrated into the surface.`); }
function ROMA(t) { return clean(`${STYLE} ${GEO_ROMA} ${t} Toppings must be extremely restrained, flat, and integrated into the surface. No large topping pieces, no decorative garnish.`); }
function TEG(t) { return clean(`${STYLE} ${GEO_TEG} ${t} Toppings simple, understated, and evenly distributed. No decorative garnish.`); }

const QUEUE = [
  // Generate proper neapolitan base images (needed for sourdough filter)
  { id: 'cacio_pepe_pizza',       force: true,  prompt: NEA('White pecorino cream base, generous cracked black pepper covering the surface. Nothing else. No meat, no tomato.') },
  { id: 'carbonara_pizza',        force: true,  prompt: NEA('Pale yellow egg cream base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato.') },
  { id: 'gricia_pizza',           force: true,  prompt: NEA('White olive oil base, crispy guanciale strips, grated pecorino, cracked black pepper. No tomato, no egg.') },
  { id: 'ny_margherita_bufala',   force: true,  prompt: NEA('Red tomato sauce base, buffalo mozzarella torn in generous pieces, fresh basil leaves, olive oil drizzle.') },
  // Force regen old-style romana
  { id: 'stracciatella_pomodoro_pizza_romana', force: true, prompt: ROMA('Bright red crushed tomato base, large cold stracciatella dollops placed after baking, torn fresh basil, olive oil drizzle.') },
  // Force regen tray-style teglia
  { id: 'prosciutto_stracciatella_romana_roman', force: true, prompt: TEG('White base, melted fior di latte, cold stracciatella dollops placed after baking, thin prosciutto crudo draped in generous folds after baking.') },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const total = QUEUE.length;
  let generated = 0;
  const failed = [];

  console.log('\n🍕 Final Fix Image Generation');
  console.log(`Total: ${total}\n`);

  for (let i = 0; i < QUEUE.length; i++) {
    const { id, prompt, force } = QUEUE[i];
    const filepath = path.join(OUTPUT_DIR, `${id}.webp`);

    if (fs.existsSync(filepath)) {
      if (force) {
        fs.unlinkSync(filepath);
        console.log(`[${i+1}/${total}] 🗑  Deleted old ${id}.webp`);
      } else {
        console.log(`[${i+1}/${total}] ⏭  Skipped: ${id}.webp`);
        continue;
      }
    }

    try {
      console.log(`[${i+1}/${total}] 🎨 Generating ${id}...`);
      const response = await client.images.generate({
        model: MODEL, prompt, n: 1,
        size: SIZE, quality: QUALITY, output_format: OUTPUT_FORMAT,
      });
      fs.writeFileSync(filepath, Buffer.from(response.data[0].b64_json, 'base64'));
      console.log(`[${i+1}/${total}] ✅ ${id}.webp`);
      generated++;
    } catch (err) {
      console.error(`[${i+1}/${total}] ❌ ${id} — ${err.message}`);
      failed.push(id);
    }

    if (i < QUEUE.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Generated: ${generated} | ❌ Failed: ${failed.length}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
}

run().catch(console.error);