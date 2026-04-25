const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUT = path.join(__dirname, '../public/pizzas');
const DELAY = 4000;

const STYLE = `Authentic pizza on a round white ceramic plate, shot from directly overhead (flat lay), dark stone surface underneath, dramatic side lighting, extreme photorealism, food photography, 8K. The pizza is thin and crispy Roman-style, slightly irregular round shape, charred leopard spotting on crust edges.`;

const PIZZAS = [
  { id: 'burrata_prosciutto',       desc: 'Fresh burrata whole in centre, prosciutto crudo draped loosely, cherry tomatoes, fresh basil, olive oil drizzle, tomato base' },
  { id: 'fig_gorgonzola',           desc: 'Fresh figs quartered, gorgonzola crumbled generously, crushed walnuts, honey drizzle, rocket on top, white cream base' },
  { id: 'pear_walnut_gorgonzola',   desc: 'Thin pear slices fanned elegantly, gorgonzola in generous pieces, crushed walnuts, honey drizzle, white cream base' },
  { id: 'speck_brie',               desc: 'Speck Alto Adige thin slices, brie melted in creamy pools, caramelised onion, fresh thyme, white base' },
  { id: 'tarte_flambee',            desc: 'Crème fraîche base spread thin, very thin onion rings, lardons scattered, black pepper, nutmeg, ultra thin crispy crust — Alsatian flammekueche style' },
  { id: 'raclette_pommes',          desc: 'Raclette cheese melted generously and slightly browned, thin apple slices, cornichon slices, fresh chives, white base' },
  { id: 'chevre_miel',              desc: 'Fresh goat cheese crumbled generously, honey drizzled in spirals, crushed walnuts, fresh thyme sprigs, white olive oil base' },
  { id: 'andouille_moutarde',       desc: 'Andouille sausage sliced thin, Dijon mustard base, emmental melted and golden, cornichon slices, fresh parsley' },
  { id: 'maroilles_oignons',        desc: 'Maroilles cheese melted in pools, caramelised onions golden-brown, fresh thyme, white crème fraîche base' },
  { id: 'jambon_espelette',         desc: 'Jambon de Bayonne thin slices, Espelette pepper sprinkled, mozzarella melted, tomato base, fresh flat-leaf parsley' },
  { id: 'camembert_pommes',         desc: 'Camembert slices arranged and melted, thin apple slices, walnut pieces, honey drizzle, white base' },
  { id: 'tartiflette_pizza',        desc: 'Reblochon cheese sliced thick and melted generously, thin potato slices, lardons, crème fraîche base — tartiflette on a crispy thin base' },
  { id: 'la_reine',                 desc: 'Classic ham, button mushrooms, mozzarella melted, tomato base, black olives — French bistro La Reine' },
  { id: 'la_royale',                desc: 'Ham, mushrooms, black olives, capers, anchovy fillets, mozzarella, rich tomato base — French La Royale' },
  { id: 'la_paysanne',              desc: 'Lardons, thin potato slices, emmental melted, crème fraîche base, fresh thyme — rustic French farmhouse style' },
  { id: 'jerusalem',                desc: 'Labneh dolloped, za\'atar herb blend generous, olive oil pooling, cherry tomatoes halved, fresh mint leaves — Jerusalem-style Middle Eastern pizza' },
  { id: 'shakshuka',                desc: 'Spiced tomato sauce with whole egg cracked in centre and just set, harissa swirled, feta crumbled, cumin seeds, fresh flat-leaf parsley — shakshuka pizza' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Generating ' + PIZZAS.length + ' _pizza_romana variants (~' + Math.ceil(PIZZAS.length * DELAY / 60000) + ' min)');
  let done = 0;
  const failed = [];

  for (let i = 0; i < PIZZAS.length; i++) {
    const { id, desc } = PIZZAS[i];
    const outPath = path.join(OUT, id + '_pizza_romana.webp');

    if (fs.existsSync(outPath)) {
      console.log('[' + (i+1) + '/' + PIZZAS.length + '] Skip: ' + id + '_pizza_romana (exists)');
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
  console.log('\ngit add public/pizzas/ && git commit -m "feat: pizza_romana images for French, Italian and Middle Eastern pizzas" && git push');
}

run().catch(console.error);
