// scripts/generate-bread-images.js
// Regenerates ALL 9 bread style images with consistent photography style
// Run: node scripts/generate-bread-images.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public');
const MODEL = 'gpt-image-1';
const DELAY_MS = 3000;

const STYLE = `
Single bread loaf only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting from above-left with a strong warm rim light from behind-right
to separate the bread from the background.
Gentle shadow directly underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow
(#C4522A), low intensity, smooth gradient only.
Premium food photography style with soft volume and natural texture.
Not a logo, not a symbol, not flat icon style.
Authentic bread texture, real scoring cuts clearly visible.
No plate, no board, no tray, no parchment, no flour dusting, no props, no hands.
No text, no labels.
`.trim().replace(/\s+/g,' ');

const BREADS = [
  {
    id: 'pain_campagne',
    prompt: STYLE + ' A rustic round pain de campagne country bread loaf. Golden-brown crust dusted with flour, 3 bold parallel diagonal scoring cuts clearly open. Artisan and premium. Warm amber highlights on the scoring cuts.',
  },
  {
    id: 'pain_levain',
    prompt: STYLE + ' A round sourdough pain au levain loaf. Golden-brown crust, elegant decorative star or wheat-ear scoring pattern on top, clearly open cuts showing the structure. Slightly organic shape, artisan look.',
  },
  {
    id: 'baguette',
    prompt: STYLE + ' A classic French baguette. Long slim loaf placed diagonally across the frame. Golden-brown crust with 7 diagonal scoring cuts (grignes) clearly open. Crisp authentic French baguette.',
  },
  {
    id: 'pain_complet',
    prompt: STYLE + ' A round wholemeal pain complet loaf. Medium-brown darker tone than white bread, dense looking. 2-3 scoring cuts on top. Strong warm rim lighting separates the loaf from the background. Clearly visible surface texture.',
  },
  {
    id: 'pain_seigle',
    prompt: STYLE + ' A round dark rye bread pain de seigle. Very dark brown-grey crust, compact and dense. 3 parallel diagonal scoring cuts. STRONG warm amber rim lighting from behind-right creates a clear glowing edge separating the dark loaf from the dark background. The loaf must be clearly visible with warm highlights.',
  },
  {
    id: 'fougasse',
    prompt: STYLE + ' A fougasse bread. Flat wide oval shape. Decorative oval cut openings through the dough in a leaf or tree pattern. Golden-brown crust. Clearly flat and wide, cut openings clearly visible through the dough.',
  },
  {
    id: 'brioche',
    prompt: STYLE + ' A brioche loaf with 6 soft rounded domed segments arranged in two rows of 3. Deep golden-brown glossy crust from egg wash. Enriched, plump and elegant. Smooth and clearly enriched-looking.',
  },
  {
    id: 'pain_mie',
    prompt: STYLE + ' A pain de mie sandwich loaf. Square structured shape with a flat top and smooth pale golden crust. Clean geometric rectangular silhouette. Soft and clearly a sandwich loaf.',
  },
  {
    id: 'pain_viennois',
    prompt: STYLE + ' A pain viennois. Elongated oval enriched bread loaf. Smooth golden-brown crust with 6 shallow diagonal scoring cuts. Warm golden colour with slight gloss from egg wash. Clearly soft and enriched, not rustic.',
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateAll() {
  let generated = 0; const failed = [];

  console.log('\nBaker Hub Bread Image Generator');
  console.log('Model: ' + MODEL + ' | Quality: high');
  console.log('Breads: ' + BREADS.length);
  console.log('Est. cost: ~$' + (BREADS.length * 0.08).toFixed(2) + '\n');

  for (let i = 0; i < BREADS.length; i++) {
    const bread = BREADS[i];
    const filepath = path.join(OUTPUT_DIR, bread.id + '.png');

    try {
      console.log('[' + (i+1) + '/' + BREADS.length + '] ' + bread.id + '...');
      const response = await client.images.generate({
        model: MODEL,
        prompt: bread.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
      });
      const imageBuffer = Buffer.from(response.data[0].b64_json, 'base64');
      fs.writeFileSync(filepath, imageBuffer);
      console.log('[' + (i+1) + '/' + BREADS.length + '] Done: ' + bread.id + '.png');
      generated++;
    } catch (err) {
      console.error('[' + (i+1) + '/' + BREADS.length + '] Failed: ' + bread.id + ' — ' + err.message);
      failed.push(bread.id);
    }

    if (i < BREADS.length - 1) await sleep(DELAY_MS);
  }

  console.log('\nGenerated: ' + generated + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nNext: git add public/pain_*.png public/baguette.png public/fougasse.png public/brioche.png && git commit -m "feat: regenerate all 9 bread images with consistent photography style" && git push');
}

generateAll().catch(console.error);