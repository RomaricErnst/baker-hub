// scripts/gen_new_pizzas.js
// 49 missing images for 14 new pizzas + missing romana variants
// Run: node scripts/gen_new_pizzas.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT = path.join(__dirname, '../public/pizzas');
const MODEL = 'gpt-image-2';
const DELAY = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Shared style block — verbatim from generate-pizza-images.js
// ─────────────────────────────────────────────────────────────────────────────

const STYLE = `
Single pizza only, centered, square composition.
Slight top-down angle (~30 degrees).
Soft warm lighting with gentle depth and a soft diffused shadow underneath.
Background is deep charcoal (#1A1612) with a subtle warm reddish-terracotta glow (#C4522A), low intensity, smooth gradient only.
Premium food object illustration with soft volume.
Not a logo, not a symbol, not a UI badge, not graphic design, not flat icon style.
Matte surfaces, clean edges, soft depth.
No plate, no board, no tray, no parchment, no tableware, no napkin, no flour, no garnish, no extra ingredients, no props, no hands.
No toppings other than the ones explicitly requested.
No text, no labels.
`.trim();

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry blocks — verbatim from generate-pizza-images.js
// ─────────────────────────────────────────────────────────────────────────────

const GEO = {
  NEA: `
A round Neapolitan-style pizza.
Slightly organic shape, not perfectly circular.
Airy puffy cornicione with soft uneven volume.
Thinner center.
Overall look is soft, generous, and airy.
`,
  ROMA_TONDA: `
A round pizza Romana.
Extremely thin and flat, almost like a flat disc.
Virtually no raised crust edge and no puffy cornicione.
Very crisp, very flat silhouette.
Overall look is precise, elegant, and minimal.
`,
  NY: `
A single New York-style pizza slice.
Large triangular slice with a thin base.
Gently raised but relatively flat crust lip.
Tip slightly thinner and more flexible to suggest foldability.
Overall look is thin, broad, and slightly flexible.
`,
  PAN: `
A thick round pan pizza.
Clearly thicker than Neapolitan and New York.
Soft, fluffy structure with visible height.
Overall look is round, thick, and substantial.
`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Topping adapters — verbatim from generate-pizza-images.js
// ─────────────────────────────────────────────────────────────────────────────

function adaptToppingsForStyle(styleKey, text) {
  let t = text.trim();

  if (styleKey === 'ROMA_TONDA') {
    t += ' Toppings must be extremely restrained, flat, and integrated into the surface. No mozzarella discs, no large topping pieces, no decorative garnish.';
  }

  if (styleKey === 'NY') {
    t += ' Toppings should feel slightly embedded into the cheese surface, not floating.';
  }

  if (styleKey === 'NEA') {
    t += ' Keep toppings restrained and premium, softly integrated into the surface.';
  }

  return t;
}

function buildPrompt(styleKey, toppings) {
  return clean(`
    ${STYLE}
    ${GEO[styleKey]}
    ${adaptToppingsForStyle(styleKey, toppings)}
  `);
}

const NEA  = (t) => buildPrompt('NEA', t);
const ROMA = (t) => buildPrompt('ROMA_TONDA', t);
const NY   = (t) => buildPrompt('NY', t);
const PAN  = (t) => buildPrompt('PAN', t);

// ─────────────────────────────────────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS = [

  // ── SECTION 1: BASE (Neapolitan) — 14 images ──
  { id: 'hawaiian',               prompt: NEA('Tomato sauce base, melted mozzarella fior di latte, cooked ham slices, pineapple chunks. Classic Neapolitan round.') },
  { id: 'tom_yam_prawn',          prompt: NEA('Pale orange-cream tom yam coconut base, mozzarella, tiger prawns, sliced lemongrass, kaffir lime leaf chiffonade, fresh coriander after baking.') },
  { id: 'thai_peanut_chicken',    prompt: NEA('Peanut sauce base (warm brown), mozzarella, grilled chicken strips, spring onion, crushed roasted peanuts, fresh coriander after baking.') },
  { id: 'satay_chicken',          prompt: NEA('Satay peanut sauce base, mozzarella, grilled chicken strips, thin red onion rings, crushed peanuts, coriander leaves.') },
  { id: 'laksa_prawn',            prompt: NEA('Rich golden coconut laksa base, mozzarella, tiger prawns, bean sprouts, spring onion, fresh coriander.') },
  { id: 'rendang_beef',           prompt: NEA('Dark rich rendang paste base with coconut cream, mozzarella, shredded slow-cooked beef, spring onion, coriander.') },
  { id: 'banh_mi_pizza',          prompt: NEA('Hoisin sauce base, mozzarella, char siu pork slices, pickled daikon and carrot julienne, fresh jalapeño rings, coriander leaves.') },
  { id: 'peking_duck',            prompt: NEA('Hoisin sauce base, mozzarella, shredded Peking duck, thin cucumber strips, spring onion, drizzle of sesame oil.') },
  { id: 'korean_bulgogi',         prompt: NEA('Gochujang-honey sauce base (deep red), mozzarella, bulgogi beef strips, spring onion, sesame oil drizzle.') },
  { id: 'meat_lovers',            prompt: NEA('Tomato sauce base, generous mozzarella, pepperoni rounds, crumbled Italian sausage, smoked bacon lardons, cooked ham. Fully loaded.') },
  { id: 'cheeseburger_pizza',     prompt: NEA('Ketchup-mustard sauce base, mozzarella, cheddar, seasoned ground beef crumbles, thin red onion, pickle slices added after baking.') },
  { id: 'pistacchio_mortadella',  prompt: NEA('Pistachio cream base (pale green), stracciatella dollops, thin mortadella slices draped after baking, crushed pistachios scattered. Elegant.') },
  { id: 'truffle_egg',            prompt: NEA('Truffle cream white base, mozzarella, one whole egg cracked in centre (yolk intact, slightly runny), pecorino shavings, black truffle shavings.') },
  { id: 'stracciatella_pomodoro', prompt: NEA('Tomato sauce base, generous stracciatella dollops, fresh cherry tomatoes halved, basil leaves, olive oil drizzle. Simple and elegant.') },

  // ── SECTION 2: NY SLICE — 9 images ──
  { id: 'hawaiian',               suffix: '_newyork', prompt: NY('Tomato sauce, mozzarella, cooked ham, pineapple chunks. Large NY triangular slice.') },
  { id: 'thai_peanut_chicken',    suffix: '_newyork', prompt: NY('Peanut sauce base, mozzarella, grilled chicken, spring onion, crushed peanuts, coriander.') },
  { id: 'satay_chicken',          suffix: '_newyork', prompt: NY('Satay peanut sauce base, mozzarella, chicken strips, red onion, crushed peanuts.') },
  { id: 'laksa_prawn',            suffix: '_newyork', prompt: NY('Coconut laksa base, mozzarella, tiger prawns, bean sprouts, coriander.') },
  { id: 'rendang_beef',           suffix: '_newyork', prompt: NY('Rendang paste and coconut base, mozzarella, shredded beef, spring onion.') },
  { id: 'banh_mi_pizza',          suffix: '_newyork', prompt: NY('Hoisin base, mozzarella, char siu pork, pickled daikon, jalapeño, coriander.') },
  { id: 'korean_bulgogi',         suffix: '_newyork', prompt: NY('Gochujang-honey base, mozzarella, bulgogi beef, spring onion, sesame drizzle.') },
  { id: 'meat_lovers',            suffix: '_newyork', prompt: NY('Tomato sauce, mozzarella, pepperoni, sausage, bacon, ham. Fully loaded NY slice.') },
  { id: 'cheeseburger_pizza',     suffix: '_newyork', prompt: NY('Ketchup-mustard base, mozzarella, cheddar, ground beef, red onion, pickles.') },

  // ── SECTION 3: PAN — 7 images ──
  { id: 'hawaiian',               suffix: '_pan', prompt: PAN('Tomato sauce, mozzarella, cooked ham, pineapple. Deep pan base, thick airy crust.') },
  { id: 'satay_chicken',          suffix: '_pan', prompt: PAN('Satay sauce base, mozzarella, chicken, crushed peanuts, spring onion.') },
  { id: 'laksa_prawn',            suffix: '_pan', prompt: PAN('Rich coconut laksa base, mozzarella, tiger prawns, bean sprouts. Thick pan base holds the rich sauce.') },
  { id: 'rendang_beef',           suffix: '_pan', prompt: PAN('Dark rendang paste base, coconut cream, mozzarella, slow-cooked shredded beef, coriander.') },
  { id: 'korean_bulgogi',         suffix: '_pan', prompt: PAN('Gochujang sauce base, mozzarella, bulgogi beef strips, sesame, spring onion.') },
  { id: 'meat_lovers',            suffix: '_pan', prompt: PAN('Tomato sauce, mozzarella, generous pepperoni, crumbled sausage, bacon, ham. Deep pan fully loaded.') },
  { id: 'cheeseburger_pizza',     suffix: '_pan', prompt: PAN('Ketchup-mustard base, mozzarella, cheddar, seasoned ground beef, red onion, pickles after baking.') },

  // ── SECTION 4: PIZZA ROMANA — 19 images ──
  // New pizzas needing romana variant
  { id: 'tom_yam_prawn',          suffix: '_pizza_romana', prompt: ROMA('Tom yam coconut base, mozzarella, tiger prawns, lemongrass, kaffir lime. Ultra-thin crispy romana base.') },
  { id: 'thai_peanut_chicken',    suffix: '_pizza_romana', prompt: ROMA('Peanut sauce base, mozzarella, chicken, crushed peanuts, coriander. Paper-thin romana.') },
  { id: 'banh_mi_pizza',          suffix: '_pizza_romana', prompt: ROMA('Hoisin base, mozzarella, char siu pork, pickled daikon, jalapeño, coriander. Razor-thin romana.') },
  { id: 'peking_duck',            suffix: '_pizza_romana', prompt: ROMA('Hoisin base, mozzarella, shredded Peking duck, cucumber, spring onion, sesame. Crispy thin romana.') },
  { id: 'pistacchio_mortadella',  suffix: '_pizza_romana', prompt: ROMA('Pistachio cream base, stracciatella, mortadella draped after baking, crushed pistachios. Elegant thin romana.') },
  { id: 'truffle_egg',            suffix: '_pizza_romana', prompt: ROMA('Truffle cream base, mozzarella, whole egg cracked in centre, pecorino, black truffle. Paper-thin romana.') },
  { id: 'stracciatella_pomodoro', suffix: '_pizza_romana', prompt: ROMA('Tomato base, stracciatella, cherry tomatoes, basil, olive oil. Simple thin romana.') },
  // Roman-specific pizzas missing their romana image
  { id: 'carciofi_romana',        suffix: '_pizza_romana', prompt: ROMA('Roman artichoke pizza — sliced artichoke hearts, mozzarella, garlic, olive oil. Thin crispy base.') },
  { id: 'carbonara_pizza',        suffix: '_pizza_romana', prompt: ROMA('Carbonara pizza — cream and egg yolk base, guanciale (cured pork cheek), pecorino, black pepper. No tomato.') },
  { id: 'cacio_pepe_pizza',       suffix: '_pizza_romana', prompt: ROMA('Cacio e pepe pizza — white base, generous pecorino romano, abundant cracked black pepper. Minimalist.') },
  { id: 'gricia_pizza',           suffix: '_pizza_romana', prompt: ROMA('Gricia pizza — white base, guanciale pieces, pecorino romano, black pepper. No tomato, no egg.') },
  { id: 'bianca_rosmarino',       suffix: '_pizza_romana', prompt: ROMA('White pizza — olive oil base, fresh rosemary sprigs, flaky sea salt, no cheese. Pure and aromatic.') },
  { id: 'bresaola_rucola_pizza',  suffix: '_pizza_romana', prompt: ROMA('Thin mozzarella base, bresaola slices draped after baking, generous rocket, parmesan shavings, lemon.') },
  { id: 'indivia_gorgonzola',     suffix: '_pizza_romana', prompt: ROMA('White base, gorgonzola dollops, Belgian endive (indivia) leaves wilted, walnuts, honey drizzle.') },
  { id: 'prosciutto_stracciatella_romana', suffix: '_pizza_romana', prompt: ROMA('Tomato base, stracciatella dollops, thin prosciutto crudo draped after baking, basil. Elegant romana.') },
  { id: 'patata_rosmarino_romana', suffix: '_pizza_romana', prompt: ROMA('Olive oil base, very thin potato slices layered, fresh rosemary, sea salt. No cheese. Roman street food.') },
  { id: 'verdure_grigliate_burrata', suffix: '_pizza_romana', prompt: ROMA('Olive oil base, mixed grilled vegetables (courgette, aubergine, peppers), burrata centre, basil.') },
  { id: 'alici_fresche_romana',   suffix: '_pizza_romana', prompt: ROMA('Tomato base, fresh anchovy fillets, cherry tomatoes, oregano, olive oil. Simple bold romana.') },
  { id: 'porcini_pecorino_romana', suffix: '_pizza_romana', prompt: ROMA('White base, porcini mushrooms, pecorino romano shavings, garlic, thyme, olive oil.') },
];

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('\nBaker Hub — New Pizza Image Generator');
  console.log('Images: ' + ITEMS.length + ' | Est: ~' + Math.ceil(ITEMS.length * DELAY / 60000) + ' min\n');

  let done = 0;
  const failed = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const { id, suffix = '', prompt } = ITEMS[i];
    const filename = id + suffix + '.webp';
    const outPath = path.join(OUTPUT, filename);

    if (fs.existsSync(outPath)) {
      console.log('[' + (i + 1) + '/' + ITEMS.length + '] Skip: ' + filename);
      done++;
      continue;
    }

    try {
      console.log('[' + (i + 1) + '/' + ITEMS.length + '] Generating: ' + filename + '...');
      const res = await client.images.generate({
        model: MODEL, prompt, n: 1,
        size: '1024x1024', quality: 'high', output_format: 'webp',
      });
      fs.writeFileSync(outPath, Buffer.from(res.data[0].b64_json, 'base64'));
      console.log('[' + (i + 1) + '/' + ITEMS.length + '] Done: ' + filename);
      done++;
    } catch (e) {
      console.error('[' + (i + 1) + '/' + ITEMS.length + '] FAILED: ' + filename + ' — ' + e.message);
      failed.push(filename);
    }

    if (i < ITEMS.length - 1) await sleep(DELAY);
  }

  console.log('\nDone: ' + done + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('\nNext:');
  console.log('git add public/pizzas/ && git commit -m "feat: generate 49 new pizza images (14 new pizzas × all styles + missing romana)" && git push');
}

run().catch(console.error);
