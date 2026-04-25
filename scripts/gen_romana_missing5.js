const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUT = path.join(__dirname, '../public/pizzas');
const DELAY = 4000;

const STYLE = `Authentic pizza on a round white ceramic plate, shot from directly overhead (flat lay), dark stone surface underneath, dramatic side lighting, extreme photorealism, food photography, 8K. The pizza is thin and crispy Roman-style, slightly irregular round shape, charred leopard spotting on crust edges.`;

const PIZZAS = [
  { id: 'jambon_espelette',  desc: 'Jambon de Bayonne thin slices, Espelette pepper sprinkled, mozzarella melted, tomato base, fresh flat-leaf parsley' },
  { id: 'la_reine',          desc: 'Classic ham slices, button mushrooms, mozzarella melted, rich tomato base, black olives — French bistro La Reine' },
  { id: 'la_royale',         desc: 'Ham, mushrooms, black olives, capers, anchovy fillets, mozzarella, rich tomato base — French La Royale' },
  { id: 'la_paysanne',       desc: 'Lardons, thin potato slices, emmental melted, crème fraîche base, fresh thyme — rustic French farmhouse style' },
  { id: 'jerusalem',         desc: 'Labneh dolloped generously, za\'atar herb blend, olive oil pooling, cherry tomatoes halved, fresh mint leaves — Jerusalem-style Middle Eastern pizza' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Generating ' + PIZZAS.length + ' missing _pizza_romana images...');
  let done = 0;
  const failed = [];

  for (let i = 0; i < PIZZAS.length; i++) {
    const { id, desc } = PIZZAS[i];
    const outPath = path.join(OUT, id + '_pizza_romana.webp');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + PIZZAS.length + '] Skip: ' + id + ' (exists)');
      done++; continue;
    }

    try {
      console.log('[' + (i+1) + '/' + PIZZAS.length + '] Generating: ' + id + '_pizza_romana...');
      const res = await client.images.generate({
        model: 'gpt-image-2',
        prompt: STYLE + ' Toppings: ' + desc,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        output_format: 'webp',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i+1) + '/' + PIZZAS.length + '] Done: ' + id + '_pizza_romana.webp');
      done++;
    } catch (e) {
      console.error('[' + (i+1) + '/' + PIZZAS.length + '] FAILED: ' + id + ' — ' + e.message);
      failed.push(id);
    }

    if (i < PIZZAS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\ngit add public/pizzas/ && git commit -m "feat: 5 missing pizza_romana images — jambon_espelette, la_reine, la_royale, la_paysanne, jerusalem" && git push');
}

run().catch(console.error);
