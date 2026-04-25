// scripts/gen_logo_variations.js
// 10 logo concept variations — all dual-purpose pizza + bread
// Output: public/logos/ (browse at bakerhub.app/logos/logo_vX.webp)
// Run: node scripts/gen_logo_variations.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT = path.join(__dirname, '../public/logos');
const MODEL = 'gpt-image-2';
const DELAY = 4000;

if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true });

const STYLE = `
Single object only, perfectly centered, square composition.
Background is deep charcoal (#1A1612) with a very subtle warm reddish-terracotta glow (#C4522A) radiating softly from centre behind the object.
Soft warm lighting from slightly above. Gentle depth. Soft diffused shadow underneath.
Premium artisan food illustration quality. Matte organic surfaces. Clean strong silhouette.
No text, no letters, no labels, no flour clouds, no tools, no hands, no background props.
The object must have a very strong clean silhouette that reads clearly at 32px app icon size.
The object is made of raw dough — cream ivory colour (#F5F0E8), slightly matte, organic texture.
This represents both pizza dough and bread dough — universal baker's dough.
`.trim();

const ITEMS = [

  // ── Concept A: The Classic Dough Ball ────────────────────────
  {
    id: 'logo_v1_doughball_pure',
    prompt: `${STYLE}
A single perfect raw dough ball. Smooth surface, soft dome shape, slightly flattened at base like a rested dough ball fresh from bulk fermentation.
Cream ivory colour. A very faint flour dusting on top catches warm light as tiny bright specks.
The silhouette is a perfect clean hemisphere — the universal form before baking, whether pizza or bread.`,
  },

  {
    id: 'logo_v2_doughball_alive',
    prompt: `${STYLE}
A single raw dough ball with a natural organic crack or tear on its surface — not made by a tool, just the dough splitting slightly as it ferments and expands.
Cream ivory, warm and alive. The crack creates a beautiful shadow line and shows the dough is active with yeast.
This happens naturally in both pizza dough balls and bread boules during bulk fermentation.
Strong dome silhouette with one honest organic imperfection.`,
  },

  {
    id: 'logo_v3_doughball_fermented',
    prompt: `${STYLE}
A single raw dough ball with a subtly alive surface — a few gentle fermentation bubbles just visible beneath the skin,
one or two tiny surface bubbles, slight organic irregularity suggesting very active yeast.
Cream ivory, warm and slightly golden tone suggesting a long slow ferment.
This dough is alive — pizza ball or bread boule, the yeast does not care.
Strong dome silhouette, full of life.`,
  },

  // ── Concept B: Dough in Motion ────────────────────────────────
  {
    id: 'logo_v4_stretch',
    prompt: `${STYLE}
Raw dough being gently stretched upward — a single smooth organic pull of elastic dough, frozen mid-stretch.
The dough tapers beautifully at the top stretch point, thick at base, thin at peak.
No hands visible — just the dough shape itself.
Cream ivory, the stretched section catches warm light along its thin upper area.
Stretch-and-fold is the core technique for both pizza and bread dough — this motion belongs to both.`,
  },

  {
    id: 'logo_v5_fold',
    prompt: `${STYLE}
A single piece of raw dough mid-fold — a smooth organic crescent shape, like the moment a baker folds dough over itself during bulk fermentation.
One clean graceful fold, cream ivory. The fold creates a curved interior shadow showing the dough layers.
Folding is universal — pizza bakers fold their dough, bread bakers fold their dough. Elegant and craft-focused.
Strong crescent silhouette.`,
  },

  {
    id: 'logo_v6_dough_in_tub',
    prompt: `${STYLE}
A straight-sided clear glass bowl viewed from slightly above, containing risen raw dough — the dough dome rises just above the bowl rim, smooth and proud, doubled in size.
Cream ivory dough dome, the bowl is minimal and clean glass.
Every pizza baker and bread baker knows this image — dough doubled in its container, ready.
The round bowl and dome create a clean satisfying silhouette. Warm light on the dome.`,
  },

  // ── Concept C: The Proofing Dome ─────────────────────────────
  {
    id: 'logo_v7_proofing_dome',
    prompt: `${STYLE}
A raw dough dome seen from a slight angle — a generous rounded arch, full and pillowy, taut with trapped fermentation gas inside.
Cream ivory, the dome is proud and round. This could be a pizza ball proofed in a dough tray or a bread boule — deliberately ambiguous.
Extremely clean minimal silhouette. Ultra strong shape that reads at any size.`,
  },

  {
    id: 'logo_v8_dough_rising',
    prompt: `${STYLE}
A raw dough ball seen from the side, clearly mid-rise — slightly domed, the surface just starting to dome upward with trapped gas.
A single large gas bubble dome pushes up from inside, creating a beautiful secondary curve on the surface.
Cream ivory, warm. The rise is the moment every baker waits for — pizza or bread.
Two overlapping dome curves create a distinctive, memorable silhouette.`,
  },

  // ── Concept D: The Pair ───────────────────────────────────────
  {
    id: 'logo_v9_two_balls',
    prompt: `${STYLE}
Two raw dough balls together — one larger (a bread boule, rounder and taller) and one smaller (a pizza dough ball, flatter and wider), touching gently side by side.
Both cream ivory, smooth, slightly flour-dusted. Warm light catches both domes.
Together they tell the Baker Hub story in one image: bread and pizza, one dough, one craft.
Clean and immediately understandable. The two domes create a beautiful double-arch silhouette.`,
  },

  {
    id: 'logo_v10_dough_close',
    prompt: `${STYLE}
Extreme close-up of a raw dough ball surface — filling the entire frame, shot from very close.
The organic texture of the dough skin is visible: smooth in places, tiny micro-bubbles in others, the natural cream-ivory colour with subtle warm tones.
The curvature of the ball creates a horizon line across the frame — dark charcoal below, lit dough surface above.
Abstract and beautiful. Feels alive. Works for pizza dough and bread dough equally.`,
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub — Logo Variations Generator');
  console.log('Concepts: ' + ITEMS.length + ' | Est: ~' + Math.ceil(ITEMS.length * DELAY / 60000) + ' min\n');

  let done = 0;
  const failed = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, prompt } = ITEMS[i];
    const outPath = path.join(OUTPUT, id + '.webp');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Skip (exists): ' + id);
      done++; continue;
    }

    try {
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Generating: ' + id + '...');
      const res = await client.images.generate({
        model: MODEL,
        prompt: prompt.replace(/\s+/g, ' ').trim(),
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'webp',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + ITEMS.length + '] Done: ' + id + '.webp');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + ITEMS.length + '] FAILED: ' + id + ' — ' + e.message);
      failed.push(id);
    }

    if (i < ITEMS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nView your logos at:');
  ITEMS.forEach(item => console.log('  https://bakerhub.app/logos/' + item.id + '.webp'));
  console.log('\nOnce you pick one:');
  console.log('  cp public/logos/YOUR_PICK.webp public/logo-mark.png');
  console.log('\ngit add public/logos/ && git commit -m "feat: 10 logo concept variations" && git push');
}

run().catch(console.error);
