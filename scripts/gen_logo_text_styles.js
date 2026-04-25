// scripts/gen_logo_text_styles.js
// Uses GPT-Image-2 edit mode to integrate "Baker Hub" text into the dough dome logo
// in various organic, baker-authentic styles.
// Requires: public/logos/logo_v7_proofing_dome.webp to exist locally
// Run: node scripts/gen_logo_text_styles.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DOME = path.join(__dirname, '../public/logos/logo_v7_proofing_dome.webp');
const OUTPUT = path.join(__dirname, '../public/logos');
const MODEL = 'gpt-image-2';
const DELAY = 5000;

if (!fs.existsSync(DOME)) {
  console.error('ERROR: logo_v7_proofing_dome.webp not found in public/logos/');
  process.exit(1);
}

// Each variation uses images.edit() — the dome image is the base,
// and GPT-Image-2 integrates the text organically into the scene.

const VARIATIONS = [

  // ── Direction A: Flour dusted text on the dark surface ────────
  {
    id: 'logo_text_v1_flour_below',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Add the text "Baker Hub" written in flour dust on the dark surface directly below the dough ball.
The letters should look like they were traced by a baker's finger through flour dusted on a dark counter — warm cream-white powder, soft edges, slightly uneven but legible.
Below "Baker Hub" in much smaller flour-dusted lettering: "dough planned around your life" in a lighter, thinner flour trace.
Do not change the dough ball or the background glow. Only add the flour text below.`,
  },

  {
    id: 'logo_text_v2_flour_beside',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Recompose the scene so the dough ball sits in the upper-left area of the image.
In the lower-right area of the dark surface, write "Baker Hub" in flour dust — as if a baker traced the letters through flour scattered on a dark counter.
Warm cream-white flour, soft powder texture, slightly hand-traced look.
Below it, much smaller: "dough planned around your life" in thin flour lettering.
Keep the terracotta glow behind the dough. Dark charcoal background throughout.`,
  },

  // ── Direction B: Text carved / pressed into the dough ─────────
  {
    id: 'logo_text_v3_carved_dome',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Press / emboss the text "Baker Hub" into the surface of the dough ball itself — like a baker's wooden stamp pressed gently into the dough.
The letters should be slightly recessed into the dough surface, creating soft shadows in the indentations.
The font style is clean but with a handmade quality — like a bread stamp or a wooden type block.
The text should be readable but feel like it belongs to the dough, not overlaid on top.
Below the dome on the dark surface, add very small light letters: "dough planned around your life".
Do not change the background or the terracotta glow.`,
  },

  {
    id: 'logo_text_v4_scored_dome',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Use a baker's lame (scoring blade) to score the letters "B H" as a monogram into the top of the dough dome — the way a baker scores a bread loaf before baking.
The score lines should be clean, confident cuts into the dough surface, creating beautiful shadows in the cuts.
Around the base of the dome on the dark surface, write "Baker Hub" and below it "dough planned around your life" in warm cream-coloured chalk lettering.
Do not change the background or the terracotta glow.`,
  },

  // ── Direction C: Bakery sign / chalk / handwritten ────────────
  {
    id: 'logo_text_v5_chalk_below',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Below the dough ball, write "Baker Hub" in a warm cream hand-lettered style — like a skilled baker's handwriting on a bakery chalkboard.
The letterforms should be slightly irregular, warm, and artisanal — not a computer font.
Think of the handwriting style on a French boulangerie window or a rustic Italian pizzeria sign.
Below "Baker Hub" in smaller lettering: "dough planned around your life" in italics.
The text colour should be warm cream (#F5F0E8) against the dark background.
Do not change the dough ball or the terracotta glow.`,
  },

  {
    id: 'logo_text_v6_stamp_circle',
    prompt: `The image shows a beautiful raw dough ball on a dark charcoal background with a warm terracotta glow.
Add a circular baker's stamp design around the dough ball — like a round rubber stamp or a bread brand.
The circle contains "BAKER HUB" in uppercase spaced around the top arc of the circle, and "dough planned around your life" around the bottom arc in smaller text.
The circle line and text should be in warm terra cotta (#C4522A) — subtle, like a watermark or a light impression.
The dough ball sits in the centre of the circle.
Do not significantly change the dough ball appearance or the background glow.`,
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub — Logo Text Style Generator');
  console.log('Method: GPT-Image-2 edit mode');
  console.log('Variations: ' + VARIATIONS.length + ' | Est: ~' + Math.ceil(VARIATIONS.length * DELAY / 60000) + ' min\n');

  const domeBuffer = fs.readFileSync(DOME);
  let done = 0;
  const failed = [];

  for (let i = 0; i < VARIATIONS.length; i++) {
    const { id, prompt } = VARIATIONS[i];
    const outPath = path.join(OUTPUT, id + '.webp');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + VARIATIONS.length + '] Skip (exists): ' + id);
      done++; continue;
    }

    try {
      console.log('[' + (i+1) + '/' + VARIATIONS.length + '] Generating: ' + id + '...');

      // Use images.edit with the dome as the base image
      const res = await client.images.edit({
        model: MODEL,
        image: new File([domeBuffer], 'logo_v7_proofing_dome.webp', { type: 'image/webp' }),
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'webp',
      });

      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + VARIATIONS.length + '] Done: ' + id + '.webp');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + VARIATIONS.length + '] FAILED: ' + id + ' — ' + e.message);
      failed.push(id);
    }

    if (i < VARIATIONS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nView at:');
  VARIATIONS.forEach(v => console.log('  https://bakerhub.app/logos/' + v.id + '.webp'));
  console.log('\ngit add public/logos/ && git commit -m "feat: 6 Baker Hub logo text style variations" && git push');
}

run().catch(console.error);
