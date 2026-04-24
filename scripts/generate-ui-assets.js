// scripts/generate-ui-assets.js
// Run: node scripts/generate-ui-assets.js
// Generates all non-pizza Baker Hub UI images
// Output: public/ (root, matching data.ts image paths)

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_ROOT = path.join(__dirname, '../public');
const MODEL = 'gpt-image-1'; // change to gpt-image-2 when available
const SIZE = '1024x1024';
const QUALITY = 'medium';
const OUTPUT_FORMAT = 'png';
const DELAY_MS = 2500;

const STYLE = `
Single object only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium object illustration with soft volume.
Not a logo, not a symbol, not a UI badge, not a flat icon.
Matte surfaces, clean edges, soft depth.
No text, no labels, no props, no extra objects unless explicitly requested.
No plate, no table, no cutlery, no flour, no decoration, no hands unless explicitly requested.
`.replace(/\s+/g, ' ').trim();

function buildPrompt(t) {
  return `${STYLE} ${t}`.replace(/\s+/g, ' ').trim();
}

const OVEN      = (t) => buildPrompt(`Single oven object. Clean product-style illustration. ${t}`);
const MIXING    = (t) => buildPrompt(`Single dough preparation object or action. Clean minimal baking illustration. ${t}`);
const YEAST     = (t) => buildPrompt(`Single yeast ingredient object. Clean ingredient illustration, simple and readable. ${t}`);
const PREFERMENT= (t) => buildPrompt(`Single preferment object. Clean bowl or jar, dough state clearly readable. ${t}`);
const BREAD     = (t) => buildPrompt(`Single bread loaf only. Clean bread object illustration with soft volume. ${t}`);

const ASSETS = [
  // ── Pizza ovens ──
  { id: 'oven_fire',           prompt: OVEN('A traditional wood-fired pizza oven with rounded masonry dome. Front opening with warm fire glow inside. Rustic and grounded.') },
  { id: 'oven_stone',          prompt: OVEN('A home oven with door open. A baking stone or steel visible inside. One pizza inside, softly lit. Clean domestic oven.') },
  { id: 'oven_standard',       prompt: OVEN('A standard home oven with door open. One pizza inside. No stone. Clean simple domestic oven.') },
  { id: 'oven_electric',       prompt: OVEN('A compact electric pizza oven, round shape, modern design. Heating elements visible inside glowing orange.') },

  // ── Bread ovens ──
  { id: 'oven_wood_bread',     prompt: OVEN('A traditional masonry bread oven, rounded dome, front opening with warm internal glow. One round bread loaf visible inside.') },
  { id: 'oven_dutch',          prompt: OVEN('A dark cast-iron Dutch oven with lid slightly open. One round bread loaf visible inside with warm interior glow. Heavy and compact.') },
  { id: 'oven_stone_bread',    prompt: OVEN('A home oven with door open. A baking stone visible inside. One bread loaf inside, softly lit. Clean domestic oven.') },
  { id: 'oven_steam',          prompt: OVEN('A professional deck oven with multiple shelves and bread loaves inside. Premium and structured.') },
  { id: 'oven_standard_bread', prompt: OVEN('A standard home oven with door open. One bread loaf inside. No stone. Clean simple domestic oven.') },

  // ── Mixers ──
  { id: 'mixer_stand',         prompt: MIXING('A stand mixer with metal bowl. Clean home kitchen appliance, front three-quarter view. No dough outside bowl.') },
  { id: 'mixer_hand',          prompt: MIXING('Two hands kneading a smooth dough ball on a flat surface. Minimal flour. Focus on dough and hands only.') },
  { id: 'mixer_noknead',       prompt: MIXING('A transparent glass bowl with dough inside. Simple cloth cover on top. Small clock beside bowl. Clean and minimal.') },
  { id: 'mixer_spiral',        prompt: MIXING('A compact industrial spiral mixer. Heavy dense proportions, metal bowl, spiral hook visible above rim. No brand.') },

  // ── Yeast ──
  { id: 'yeast_instant',       prompt: YEAST('A small open paper sachet of fine dry yeast powder spilling slightly. Clean folded shape.') },
  { id: 'yeast_active',        prompt: YEAST('A small glass jar filled with active dry yeast granules, lid removed beside it.') },
  { id: 'yeast_fresh',         prompt: YEAST('A small rectangular block of fresh compressed yeast, one corner slightly crumbled. Clean and geometric.') },
  { id: 'yeast_sourdough',     prompt: YEAST('A glass jar containing active sourdough starter. Visible rise line and bubbles through the side. Minimal cloth cover.') },

  // ── Preferments ──
  { id: 'preferment-direct',   prompt: PREFERMENT('A simple matte mixing bowl with one smooth domed dough mass inside. No bubbles, no cracks.') },
  { id: 'preferment-poolish',  prompt: PREFERMENT('A small transparent glass jar containing a liquid preferment. Flat glossy surface. A few large bubbles visible through side.') },
  { id: 'preferment-biga',     prompt: PREFERMENT('A small bowl with stiff preferment as compact dough chunks. Dense and structured, not liquid.') },

  // ── Breads ──
  { id: 'pain_campagne',       prompt: BREAD('A rustic round country bread loaf with 3 bold scoring cuts. Minimal flour dusting.') },
  { id: 'pain_levain',         prompt: BREAD('A round sourdough loaf with elegant scoring cuts. Artisan and clean.') },
  { id: 'baguette',            prompt: BREAD('A classic baguette, long and slim, with diagonal scoring cuts. Crisp silhouette.') },
  { id: 'pain_complet',        prompt: BREAD('A wholemeal loaf, round, with 2-3 scoring cuts. Darker brown tone.') },
  { id: 'pain_seigle',         prompt: BREAD('A dark rye loaf, round and compact, with simple scoring cuts.') },
  { id: 'fougasse',            prompt: BREAD('A fougasse bread, flat and leaf-shaped, with decorative cut openings through the dough.') },
  { id: 'brioche',             prompt: BREAD('A brioche loaf with soft rounded segments. Smooth, enriched, plump and elegant.') },
  { id: 'pain_mie',            prompt: BREAD('A pain de mie loaf, square and structured with a smooth surface. Simple sandwich loaf.') },
  { id: 'pain_viennois',       prompt: BREAD('A pain viennois loaf, elongated and soft, with shallow diagonal cuts.') },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAll() {
  if (!fs.existsSync(OUTPUT_ROOT)) fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  let generated = 0, skipped = 0;
  const failed = [];

  console.log('\n🎨 Baker Hub UI Asset Generator');
  console.log(`🤖 Model: ${MODEL}`);
  console.log(`🖼  Assets: ${ASSETS.length}`);
  console.log(`📁 Output: ${OUTPUT_ROOT}\n`);

  for (let i = 0; i < ASSETS.length; i++) {
    const asset = ASSETS[i];
    const filepath = path.join(OUTPUT_ROOT, `${asset.id}.png`);

    if (fs.existsSync(filepath)) {
      console.log(`[${i+1}/${ASSETS.length}] ⏭  ${asset.id}`);
      skipped++;
      continue;
    }

    try {
      console.log(`[${i+1}/${ASSETS.length}] 🎨 ${asset.id}...`);
      const response = await client.images.generate({
        model: MODEL,
        prompt: asset.prompt,
        n: 1,
        size: SIZE,
        quality: QUALITY,
        output_format: OUTPUT_FORMAT,
      });
      const imageBuffer = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, imageBuffer);
      console.log(`[${i+1}/${ASSETS.length}] ✅ ${asset.id}.png`);
      generated++;
    } catch (err) {
      console.error(`[${i+1}/${ASSETS.length}] ❌ ${asset.id} — ${err.message}`);
      failed.push(asset.id);
    }

    if (i < ASSETS.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Generated: ${generated} | ⏭  Skipped: ${skipped} | ❌ Failed: ${failed.length}`);
  if (failed.length) console.log(`Failed: ${failed.join(', ')}`);
  console.log(`\nNext: git add public/*.png && git commit -m "feat: UI assets" && git push`);
}

generateAll().catch(console.error);
