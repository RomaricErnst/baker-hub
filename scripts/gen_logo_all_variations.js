// scripts/gen_logo_all_variations.js
// Variations of V3 (carved), V1 (flour script), V4 (BH scored)
// Each in desktop logo + header lockup formats
// Uses images.edit() on existing generated logos
// Run: node scripts/gen_logo_all_variations.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const LOGOS_DIR = path.join(__dirname, '../public/logos');
const MODEL = 'gpt-image-2';
const DELAY = 5000;

const SOURCES = {
  v3: path.join(LOGOS_DIR, 'logo_text_v3_carved_dome.webp'),
  v1: path.join(LOGOS_DIR, 'logo_text_v1_flour_below.webp'),
  v4: path.join(LOGOS_DIR, 'logo_text_v4_scored_dome.webp'),
};

// Verify sources exist
Object.entries(SOURCES).forEach(([key, p]) => {
  if (!fs.existsSync(p)) {
    console.error('ERROR: Missing source: ' + p);
    process.exit(1);
  }
});

const BASE = `
The image is a Baker Hub logo — a raw dough ball on a deep charcoal background (#1A1612) with a warm reddish-terracotta glow (#C4522A) behind it.
Baker Hub design tokens: background #1A1612, accent #C4522A (terra), cream #F5F0E8, gold #D4A853, smoke #8A7F78.
Tagline: "dough planned around your life" in warm cream or gold italic.
`;

const VARIATIONS = [

  // ════════════════════════════════════════════════════
  // V3 — CARVED "Baker Hub" into the dough
  // ════════════════════════════════════════════════════

  {
    source: 'v3',
    id: 'v3_desktop_no_tagline',
    prompt: `${BASE}
This version has "Baker Hub" carved into the dough dome in an elegant serif font, with a small tagline below.
TASK: Remove the tagline "dough planned around your life" completely from below the dome.
Give the dome more breathing room — recentre it with generous dark space all around.
Result: the carved dome alone, no text below. Clean premium desktop logo mark.
Do not change the dome, the carving, or the terracotta glow.`,
  },

  {
    source: 'v3',
    id: 'v3_desktop_tagline_readable',
    prompt: `${BASE}
This version has "Baker Hub" carved into the dough dome, with a small tagline below.
TASK: Keep everything exactly as-is but make "dough planned around your life" below the dome at least 3x larger and clearly readable.
Style: warm cream colour, elegant spaced serif italic, tracking wide.
The tagline should feel like a natural confident part of the composition — same visual weight as a subtitle on a book cover.
Do not change the dome, the carving, or the terracotta glow.`,
  },

  {
    source: 'v3',
    id: 'v3_header_horizontal',
    prompt: `${BASE}
This version has "Baker Hub" carved into the dough dome on a dark background.
TASK: Recompose as a wide horizontal header lockup (roughly 3:1 landscape ratio):
Left side (40% of width): the dough dome with "Baker Hub" carved into it, tight crop showing the dome clearly.
Right side (60% of width): pure dark charcoal background (#1A1612) with two lines of text —
  Line 1: "Baker Hub" in large warm cream elegant serif, ~40px equivalent
  Line 2: "dough planned around your life" in terra cotta (#C4522A) italic serif, ~18px equivalent
A thin horizontal terra cotta line separates the two text lines.
This is designed to fit in a 60px tall website header bar. Keep the terracotta glow behind the dome only.`,
  },

  {
    source: 'v3',
    id: 'v3_header_dome_icon_only',
    prompt: `${BASE}
This version has "Baker Hub" carved into the dough dome.
TASK: Crop this tightly as a square icon — the dome fills 85% of the frame, small dark border around it.
The carved "Baker Hub" text on the dome must be fully visible and well-centred.
No tagline. Square format. This is the favicon and app icon version.
Keep the terracotta glow, dome texture, and carving depth exactly as-is.`,
  },

  {
    source: 'v3',
    id: 'v3_tagline_right',
    prompt: `${BASE}
This version has "Baker Hub" carved into the dough dome, with a small tagline below.
TASK: Move the tagline from below the dome to the RIGHT side of the dome.
The dome sits on the left half of the image.
On the right side of the dark background, vertically centred next to the dome:
  "dough planned around your life" in warm cream italic serif, written vertically (rotated 90° clockwise) OR horizontally in two short lines: "dough planned / around your life".
The tagline should be clearly readable, roughly 16-18px equivalent size.
Do not change the dome, the carving, or the terracotta glow.`,
  },

  // ════════════════════════════════════════════════════
  // V1 — FLOUR SCRIPT "Baker Hub" below the dome
  // ════════════════════════════════════════════════════

  {
    source: 'v1',
    id: 'v1_desktop_tagline_gold',
    prompt: `${BASE}
This version has a dough dome above and "Baker Hub" written in flour script below it, with a tagline beneath.
TASK: Keep the composition exactly as-is but change the tagline "dough planned around your life" colour to warm gold (#D4A853) and increase its size to be clearly readable — about half the size of the "Baker Hub" flour script text.
The tagline should feel warm and premium, not an afterthought.
Do not change the dome, the flour script title, or the background.`,
  },

  {
    source: 'v1',
    id: 'v1_desktop_title_larger',
    prompt: `${BASE}
This version has a dough dome above and "Baker Hub" written in flour/dust script below it.
TASK: Make the "Baker Hub" flour script significantly larger — it should be the dominant visual element below the dome, roughly 1.5x its current size.
The flour script letterforms should remain organic and hand-traced, not digital.
Below the larger title: "dough planned around your life" in smaller warm cream spaced italic, clearly readable.
Rebalance the composition so dome and title have equal visual weight.
Do not change the dome texture or background.`,
  },

  {
    source: 'v1',
    id: 'v1_header_horizontal',
    prompt: `${BASE}
This version has a dough dome above flour script "Baker Hub" text.
TASK: Recompose as a wide horizontal header lockup (roughly 3:1 landscape ratio):
Left side (35% of width): the clean dough dome alone, no text on it, tight vertical crop.
Right side (65% of width): pure dark charcoal background with —
  Line 1: "Baker Hub" in flour/dust script style, large, warm cream, organic hand-lettered look
  Line 2: "dough planned around your life" in smaller warm gold (#D4A853) spaced italic
This is designed for a 60px tall website header. The flour script should feel like it was dusted onto the dark surface next to the dome.`,
  },

  {
    source: 'v1',
    id: 'v1_title_beside_dome',
    prompt: `${BASE}
This version currently has the dome above and flour script below it in a vertical stack.
TASK: Recompose as a side-by-side layout:
Left: the dough dome, occupying the left 45% of the image
Right: the flour script "Baker Hub" vertically centred next to the dome, large and prominent
Below both, spanning the full width: "dough planned around your life" in warm gold spaced italic, clearly readable
The flour script and dome should feel like they belong together — same warm tone, same lighting.`,
  },

  // ════════════════════════════════════════════════════
  // V4 — BH SCORED monogram on dome + chalk text below
  // ════════════════════════════════════════════════════

  {
    source: 'v4',
    id: 'v4_desktop_clean_chalk',
    prompt: `${BASE}
This version has a dough dome with "BH" scored into it, and "Baker Hub" + tagline in chalk-style text below.
TASK: Clean up the lower half — remove the underline decoration below the tagline.
Make "Baker Hub" in the chalk text slightly larger and bolder.
Make "dough planned around your life" clearly readable — warm cream, not grey.
The BH scoring on the dome should remain exactly as-is.
Result: dome with scored BH + clean readable chalk text below, no decorative underline.`,
  },

  {
    source: 'v4',
    id: 'v4_header_horizontal',
    prompt: `${BASE}
This version has a dough dome with "BH" scored into it, and chalk-style "Baker Hub" text below.
TASK: Recompose as a wide horizontal header lockup (roughly 3:1 landscape ratio):
Left side (35%): the dough dome with BH scored into it, tight crop showing the dome and scoring clearly.
Right side (65%): dark charcoal background (#1A1612) with —
  Line 1: "Baker Hub" in warm cream elegant serif (NOT chalk style — clean and refined), large
  Line 2: "dough planned around your life" in terra cotta (#C4522A) italic, clearly readable
The BH on the dome acts as the icon/monogram. The text on the right is clean and digital, contrasting with the organic dome.`,
  },

  {
    source: 'v4',
    id: 'v4_bh_icon_square',
    prompt: `${BASE}
This version has a dough dome with "BH" scored into it and chalk text below.
TASK: Crop tightly to just the dome as a square icon.
The dome fills 85% of the frame. The scored BH is clearly visible and well-centred.
Remove all text below the dome — just the dome with the BH scoring.
Small dark border around the dome. This is the favicon/app icon version of V4.
Keep the terracotta glow and dome texture exactly as-is.`,
  },

  {
    source: 'v4',
    id: 'v4_full_name_scored',
    prompt: `${BASE}
This version has a dough dome with "BH" scored into it.
TASK: Replace the "BH" scoring with the full "Baker Hub" text scored into the dome — like a professional baker's stamp with the full brand name.
The scoring should look like confident lame cuts — clean lines creating the letters, with beautiful shadows in the cuts.
"Baker" on the upper portion of the dome, "Hub" on the lower portion, both well-centred.
Below the dome on the dark surface: "dough planned around your life" in warm cream spaced italic, clearly readable.
Keep the terracotta glow and dome texture.`,
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub — All Logo Variations (V3 + V1 + V4)');
  console.log('Total: ' + VARIATIONS.length + ' variations | Est: ~' + Math.ceil(VARIATIONS.length * DELAY / 60000) + ' min\n');

  let done = 0;
  const failed = [];
  const srcBuffers = {};
  Object.entries(SOURCES).forEach(([key, p]) => {
    srcBuffers[key] = fs.readFileSync(p);
  });

  for (let i = 0; i < VARIATIONS.length; i++) {
    const { source, id, prompt } = VARIATIONS[i];
    const outPath = path.join(LOGOS_DIR, id + '.webp');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + VARIATIONS.length + '] Skip: ' + id);
      done++; continue;
    }

    const srcFile = SOURCES[source];
    const srcBuf = srcBuffers[source];

    try {
      console.log('[' + (i+1) + '/' + VARIATIONS.length + '] Generating: ' + id + ' (from ' + source + ')...');
      const res = await client.images.edit({
        model: MODEL,
        image: new File([srcBuf], path.basename(srcFile), { type: 'image/webp' }),
        prompt,
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
  console.log('\nView results at https://bakerhub.app/logos/');
  console.log('\nV3 variations:');
  VARIATIONS.filter(v => v.source === 'v3').forEach(v => console.log('  /logos/' + v.id + '.webp'));
  console.log('\nV1 variations:');
  VARIATIONS.filter(v => v.source === 'v1').forEach(v => console.log('  /logos/' + v.id + '.webp'));
  console.log('\nV4 variations:');
  VARIATIONS.filter(v => v.source === 'v4').forEach(v => console.log('  /logos/' + v.id + '.webp'));
  console.log('\ngit add public/logos/ && git commit -m "feat: V3+V1+V4 logo variations — desktop + header" && git push');
}

run().catch(console.error);
