// scripts/audit-pizza-images.js
// Audits pizza images for WRONG INGREDIENTS ONLY
// Ignores: flour dust, decorations, plates/boards, lighting, background issues
// Run: node scripts/audit-pizza-images.js

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PIZZAS_DIR = path.join(__dirname, '../public/pizzas');
const REPORT_PATH = path.join(__dirname, '../public/pizzas/_audit_report.json');
const DELAY_MS = 1200;

// ONLY check for wrong ingredients — ignore background, flour, plate, lighting
const PIZZAS = [
  { id: 'margherita',            expect: 'tomato sauce, mozzarella, basil',                      forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'marinara',              expect: 'tomato sauce, garlic, oregano — NO cheese at all',      forbidden: 'mozzarella, cheese, salami, pepperoni' },
  { id: 'diavola',               expect: 'spicy salami rounds, mozzarella',                       forbidden: null },
  { id: 'quattro_formaggi',      expect: 'four cheeses, white base',                              forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'capricciosa',           expect: 'ham, mushrooms, olives, artichoke',                     forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'napoli',                expect: 'anchovies, capers, olives',                             forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'pepperoni',             expect: 'pepperoni slices curled at edges, mozzarella',          forbidden: null },
  { id: 'nduja_mozzarella',      expect: 'orange-red nduja spread in dollops, mozzarella',        forbidden: 'round salami slices, flat pepperoni rounds' },
  { id: 'tonno_cipolla',         expect: 'tuna, onion rings',                                     forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'smoked_salmon_creme',   expect: 'pink smoked salmon, cream base',                        forbidden: 'salami, pepperoni, meat rounds, tomato base' },
  { id: 'ortolana',              expect: 'grilled vegetables: courgette, aubergine, peppers',     forbidden: 'salami, pepperoni, cured meat' },
  { id: 'funghi_tartufo',        expect: 'mushrooms, white base',                                 forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'patate_rosmarino',      expect: 'thin potato slices, rosemary',                          forbidden: 'salami, pepperoni, meat, cheese' },
  { id: 'bianca_ricotta_spinaci',expect: 'ricotta, spinach, white base',                          forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'truffle_bianca',        expect: 'truffle shavings, white cream base',                    forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'prosciutto_rucola',     expect: 'thin prosciutto ham slices draped, green rocket',       forbidden: 'round salami slices, round pepperoni' },
  { id: 'burrata_prosciutto',    expect: 'whole burrata, prosciutto ham draped',                  forbidden: 'round salami slices, round pepperoni' },
  { id: 'fig_gorgonzola',        expect: 'halved figs, blue cheese, walnuts',                     forbidden: 'salami, pepperoni, meat rounds' },
  { id: 'pear_walnut_gorgonzola',expect: 'pear slices, walnuts, blue cheese',                     forbidden: 'salami, pepperoni, meat rounds' },
  { id: 'bbq_chicken',           expect: 'BBQ sauce base, grilled chicken pieces',                forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'speck_brie',            expect: 'smoked speck ham, brie',                                forbidden: 'round salami slices, round pepperoni' },
  { id: 'tarte_flambee',         expect: 'creme fraiche base, smoked lardons, onion',             forbidden: 'round salami, round pepperoni' },
  { id: 'raclette_pommes',       expect: 'melted raclette cheese, potato, lardons',               forbidden: 'round salami, round pepperoni' },
  { id: 'chevre_miel',           expect: 'goat cheese rounds, honey, walnuts',                    forbidden: 'salami rounds, pepperoni rounds, cured meat rounds' },
  { id: 'andouille_moutarde',    expect: 'sausage slices, mustard base, onion',                   forbidden: 'round pepperoni' },
  { id: 'maroilles_oignons',     expect: 'maroilles cheese, caramelised onions, cream base',      forbidden: 'salami, pepperoni, meat rounds' },
  { id: 'jambon_espelette',      expect: 'ham slices, red pepper, cheese',                        forbidden: 'round salami, round pepperoni' },
  { id: 'camembert_pommes',      expect: 'melted camembert, apple slices, lardons',               forbidden: 'round salami, round pepperoni' },
  { id: 'tartiflette_pizza',     expect: 'reblochon cheese melted, potato, lardons',              forbidden: 'round salami, round pepperoni' },
  { id: 'la_reine',              expect: 'ham, mushrooms, mozzarella, tomato base',               forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'la_royale',             expect: 'ham, mushrooms, black olives, mozzarella',              forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'la_paysanne',           expect: 'lardons, onion, creme fraiche base',                    forbidden: 'round salami, round pepperoni' },
  { id: 'quatre_saisons',        expect: 'four quarters: artichoke, ham, olives, mushrooms',      forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'margherita_sbagliata',  expect: 'mozzarella baked in, fresh tomato dollops on top',      forbidden: 'salami, pepperoni, meat' },
  { id: 'cosacca',               expect: 'tomato base, pecorino — NO mozzarella',                 forbidden: 'mozzarella, salami, pepperoni, meat' },
  { id: 'salsiccia_friarielli',  expect: 'crumbled sausage pieces, broccoli rabe, mozzarella',    forbidden: 'round salami slices, round pepperoni' },
  { id: 'provola_pepe',          expect: 'smoked provola melted, black pepper',                   forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'acciughe_pomodorini',   expect: 'anchovy fillets, cherry tomatoes',                      forbidden: 'salami, pepperoni, cured meat' },
  { id: 'melanzane_parmigiana',  expect: 'aubergine slices, parmesan, mozzarella',                forbidden: 'salami, pepperoni, cured meat' },
  { id: 'zucca_provola',         expect: 'orange pumpkin slices, provola cheese',                 forbidden: 'salami, pepperoni, meat' },
  { id: 'boscaiola',             expect: 'mushrooms, crumbled sausage (NOT flat rounds)',          forbidden: 'flat round salami, flat round pepperoni' },
  { id: 'bismarck',              expect: 'ham, mushrooms, whole egg in center',                   forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'pugliese',              expect: 'black olives, capers, red onion',                       forbidden: 'salami, pepperoni, cured meat' },
  { id: 'prosciutto_funghi',     expect: 'ham slices, mushrooms, mozzarella',                     forbidden: 'round salami, round pepperoni' },
  { id: 'tonno_cipolla_red',     expect: 'tuna, red onion, mozzarella',                           forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'piennolo',              expect: 'cherry tomatoes, olive oil — NO cheese, NO meat',       forbidden: 'mozzarella, cheese, salami, pepperoni, meat' },
  { id: 'funghi_salsiccia',      expect: 'mushrooms, crumbled sausage (NOT flat rounds)',         forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'salmone_rucola',        expect: 'smoked salmon, green rocket, white base',               forbidden: 'salami, pepperoni, meat rounds, tomato base' },
  { id: 'acciughe_burro',        expect: 'anchovy fillets, white base',                           forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'pollo_pesto',           expect: 'green pesto base, grilled chicken, cherry tomatoes',    forbidden: 'salami rounds, pepperoni rounds' },
  { id: 'genovese',              expect: 'green pesto base, potato slices, green beans',          forbidden: 'salami, pepperoni, cured meat' },
  { id: 'polpette',              expect: 'large round meatballs (big spheres), tomato base',      forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'diavola_burrata',       expect: 'spicy salami, mozzarella, whole burrata on top',        forbidden: null },
  { id: 'pistadella',            expect: 'large mortadella slices (pink deli meat), pistachio pesto', forbidden: 'round salami, round pepperoni' },
  { id: 'stracciatella_datterini',expect:'cherry tomatoes, stracciatella cheese dollops',         forbidden: 'salami, pepperoni, cured meat' },
  { id: 'nduja_burrata',         expect: 'orange nduja spread base, whole burrata',               forbidden: 'round salami slices, round pepperoni' },
  { id: 'tartufo_fior',          expect: 'truffle shavings, mozzarella, white base',              forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'lardo_rosmarino',       expect: 'thin white lardo slices, rosemary, white base',         forbidden: 'round salami, round pepperoni, tomato base' },
  { id: 'scarpetta',             expect: 'mozzarella, small tomato dots, white base',             forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'caponata_pizza',        expect: 'caponata vegetables: aubergine, peppers, olives',       forbidden: 'salami, pepperoni, cured meat' },
  { id: 'soppressata_fichi',     expect: 'soppressata salami, halved figs, honey',                forbidden: null },
  { id: 'guanciale_pecorino',    expect: 'guanciale strips (NOT flat rounds), pecorino, tomato',  forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'honey_pecorino',        expect: 'pecorino cheese, honey, white base',                    forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'burrata_prosciutto_gourmet',expect:'whole burrata, prosciutto ham draped, tomato',       forbidden: 'round salami, round pepperoni' },
  { id: 'porcini_stracciatella', expect: 'porcini mushrooms, stracciatella dollops, white base',  forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'wagyu_onion',           expect: 'thin wagyu beef slices, caramelised onions',            forbidden: 'round salami, round pepperoni' },
  { id: 'crudo_parma_stracciatella',expect:'Parma ham thin slices, stracciatella, tomato base',   forbidden: 'round salami, round pepperoni' },
  { id: 'norma',                 expect: 'aubergine slices, ricotta salata crumbled, tomato base',forbidden: 'salami, pepperoni, cured meat' },
  { id: 'carciofi_romana',       expect: 'artichoke quarters, white oil base',                    forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'fiori_zucca_alici',     expect: 'yellow courgette flowers, anchovies, white base',       forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'amatriciana_pizza',     expect: 'guanciale strips (NOT flat rounds), pecorino, tomato',  forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'carbonara_pizza',       expect: 'pale egg cream base, guanciale strips, pecorino',       forbidden: 'flat round pepperoni, tomato base' },
  { id: 'cacio_pepe_pizza',      expect: 'white pecorino base, black pepper — NO meat',           forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'gricia_pizza',          expect: 'guanciale strips (NOT flat rounds), pecorino, white base',forbidden:'flat round pepperoni, flat round salami, tomato base' },
  { id: 'bianca_rosmarino',      expect: 'rosemary pressed into dough, white oil base — NO meat, NO cheese', forbidden: 'salami, pepperoni, meat, cheese, mozzarella, tomato base' },
  { id: 'bresaola_rucola_pizza', expect: 'dark red bresaola thin slices (cured beef), green rocket', forbidden: 'round salami, round pepperoni' },
  { id: 'speck_stracchino',      expect: 'speck ham slices, stracchino cream base',               forbidden: 'round salami, round pepperoni' },
  { id: 'indivia_gorgonzola',    expect: 'pale endive, gorgonzola, walnuts, white base',          forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'prosciutto_stracciatella_romana',expect:'prosciutto ham draped, stracciatella dollops',  forbidden: 'round salami, round pepperoni' },
  { id: 'patata_rosmarino_romana',expect:'ultra-thin potato slices, rosemary, white base',        forbidden: 'salami, pepperoni, meat, cheese, tomato base' },
  { id: 'verdure_grigliate_burrata',expect:'grilled vegetables, whole burrata, white base',       forbidden: 'salami, pepperoni, meat' },
  { id: 'alici_fresche_romana',  expect: 'fresh anchovy fillets, cherry tomatoes',                forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'porcini_pecorino_romana',expect:'porcini mushrooms, pecorino, white base',               forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'teglia_patata_provola', expect: 'potato slices, provola cheese, rectangular base',       forbidden: 'salami, pepperoni, meat' },
  { id: 'teglia_funghi_salsiccia',expect:'mushrooms, crumbled sausage (NOT flat rounds), rectangular base', forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'teglia_prosciutto_cotto',expect:'cooked ham slices, mushrooms, rectangular base',        forbidden: 'round salami, round pepperoni' },
  { id: 'teglia_zucchine_fiori', expect: 'courgette, courgette flowers, white base, rectangular', forbidden: 'salami, pepperoni, meat' },
  { id: 'teglia_mortadella_pistacchio',expect:'large mortadella slices (pink deli meat), pistachio, rectangular', forbidden: 'round salami, round pepperoni' },
  { id: 'teglia_tonno_cipolla',  expect: 'tuna, red onion, rectangular base',                     forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'teglia_4_formaggi',     expect: 'four cheeses, rectangular base',                        forbidden: 'salami, pepperoni, meat' },
  { id: 'teglia_speck_brie',     expect: 'speck ham, brie, rectangular base',                     forbidden: 'round salami, round pepperoni' },
  { id: 'teglia_verdure',        expect: 'grilled vegetables, tomato base, rectangular',          forbidden: 'salami, pepperoni, cured meat' },
  { id: 'teglia_nduja_stracciatella',expect:'orange nduja spread, stracciatella, rectangular',    forbidden: 'round salami slices, round pepperoni' },
  { id: 'ny_pepperoni_slice',    expect: 'pepperoni curled at edges, mozzarella, NY style',       forbidden: null },
  { id: 'hot_honey_pepperoni',   expect: 'crispy pepperoni, mozzarella, honey drizzle',           forbidden: null },
  { id: 'white_clam_apizza',     expect: 'clams, garlic, white base — NO mozzarella',             forbidden: 'mozzarella, cheese, salami, pepperoni, tomato base' },
  { id: 'ny_sausage_peppers',    expect: 'crumbled sausage, bell peppers (NOT flat rounds)',       forbidden: 'flat round pepperoni' },
  { id: 'vodka_pizza',           expect: 'pink vodka cream sauce, mozzarella',                    forbidden: 'salami, pepperoni, meat' },
  { id: 'ny_white_pizza',        expect: 'white garlic base, ricotta, mozzarella',                forbidden: 'salami, pepperoni, tomato base, meat' },
  { id: 'buffalo_chicken',       expect: 'orange buffalo sauce chicken, mozzarella',              forbidden: 'round salami, round pepperoni' },
  { id: 'california_bbq_chicken',expect:'BBQ sauce base, chicken pieces, mozzarella',             forbidden: 'round salami, round pepperoni' },
  { id: 'smoked_salmon_cream_cheese',expect:'pink smoked salmon, cream cheese base',              forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'ny_clam_garlic',        expect: 'clams, garlic, white base',                             forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'ny_margherita_bufala',  expect: 'tomato base, buffalo mozzarella, basil',                forbidden: 'salami, pepperoni, meat' },
  { id: 'ny_diavola',            expect: 'spicy salami, mozzarella, tomato base',                 forbidden: null },
  { id: 'detroit_red_top',       expect: 'thick square base, caramelised frico edges, sauce stripes on top', forbidden: null },
  { id: 'detroit_white',         expect: 'thick square base, caramelised frico edges, white base',forbidden: 'tomato sauce, salami' },
  { id: 'detroit_sausage',       expect: 'thick square base, frico edges, sausage, mushrooms',    forbidden: 'flat round pepperoni' },
  { id: 'detroit_veggie',        expect: 'thick square base, frico edges, peppers, onions',       forbidden: 'salami, pepperoni, meat' },
  { id: 'chicago_deep_dish',     expect: 'very deep crust walls, tomato sauce on top',            forbidden: null },
  { id: 'pan_margherita',        expect: 'thick round base, tomato, mozzarella',                  forbidden: 'salami, pepperoni, meat' },
  { id: 'pan_pepperoni_hot_honey',expect:'thick round base, pepperoni, honey drizzle',            forbidden: null },
  { id: 'pan_bbq_chicken',       expect: 'thick round base, BBQ sauce, chicken',                  forbidden: 'round salami, round pepperoni' },
  { id: 'pan_nduja_burrata',     expect: 'thick round base, nduja spread, whole burrata',         forbidden: 'round salami slices, round pepperoni' },
  { id: 'pan_4_formaggi',        expect: 'thick round base, four cheeses, white base',            forbidden: 'salami, pepperoni, meat' },
  { id: 'jamon_manchego',        expect: 'Iberico ham thin slices draped, manchego shavings',     forbidden: 'round salami, round pepperoni' },
  { id: 'sobrasada_miel',        expect: 'orange sobrasada spread in dollops, honey, mozzarella', forbidden: 'round salami slices' },
  { id: 'escalivada',            expect: 'fire-roasted aubergine, red pepper strips, white base', forbidden: 'salami, pepperoni, meat, cheese, tomato base' },
  { id: 'chorizo_padron',        expect: 'chorizo slices, green Padron peppers, tomato base',     forbidden: null },
  { id: 'pulpo_gallega',         expect: 'octopus pieces, potato slices, paprika',                forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'halloumi_zaatar',       expect: 'grilled halloumi, zaatar herb blend, olive oil',        forbidden: 'salami, pepperoni, meat' },
  { id: 'zaatar_labneh',         expect: 'zaatar herb blend across base, labneh dollops',         forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'merguez_harissa',       expect: 'merguez sausage slices, red harissa base, egg',         forbidden: null },
  { id: 'miso_funghi',           expect: 'miso cream base, shiitake mushrooms, mozzarella',       forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'mentaiko_cream',        expect: 'pale pink mentaiko cream base, spring onion, nori',     forbidden: 'salami, pepperoni, meat' },
  { id: 'teriyaki_chicken',      expect: 'brown glazed chicken pieces, sesame seeds, mozzarella', forbidden: 'round salami, round pepperoni' },
  { id: 'salmon_wasabi',         expect: 'smoked salmon, pale green wasabi cream or white base',  forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'korean_bbq',            expect: 'thin bulgogi beef strips (NOT flat rounds), mozzarella',forbidden: 'flat round pepperoni, flat round salami' },
  { id: 'nori_sesame_bianca',    expect: 'white sesame base, sesame seeds, nori strips',          forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'provencale',            expect: 'tomato base, anchovies, black olives, herbes de Provence', forbidden: 'salami, pepperoni, cured meat rounds' },
  { id: 'lorraine_pizza',        expect: 'creme fraiche base, lardons, emmental, onions',         forbidden: 'round salami, round pepperoni, tomato base' },
  { id: 'perigourdine',          expect: 'duck confit pieces, walnuts, white base',               forbidden: 'round salami, round pepperoni' },
  { id: 'pistou_pizza',          expect: 'green pistou pesto base, vegetables, goat cheese',      forbidden: 'salami, pepperoni, meat, tomato base' },
  { id: 'alsacienne_choucroute', expect: 'pale sauerkraut, lardons, Munster cheese, cream base',  forbidden: 'round salami, round pepperoni, tomato base' },
  { id: 'basquaise',             expect: 'Bayonne ham, red Espelette pepper, tomato base',        forbidden: 'round salami, round pepperoni' },
  { id: 'lyonnaise',             expect: 'caramelised onions, lardons, fromage blanc base',       forbidden: 'round salami, round pepperoni, tomato base' },
  { id: 'normandie_camembert',   expect: 'melted camembert, lardons, apple, cream base',          forbidden: 'round salami, round pepperoni, tomato base' },
  { id: 'jerusalem',             expect: 'roasted aubergine, chickpeas, tahini, tomato base',     forbidden: 'salami, pepperoni, meat, cheese' },
  { id: 'shakshuka',             expect: 'spiced tomato base, whole eggs baked in, feta',         forbidden: 'salami, pepperoni, cured meat' },
  { id: 'nutella_fraises',       expect: 'chocolate Nutella spread, fresh strawberries',          forbidden: 'salami, pepperoni, cheese, tomato base' },
  { id: 'tarte_tatin_pizza',     expect: 'caramelised apple slices, golden caramel glaze',        forbidden: 'salami, pepperoni, cheese, tomato base' },
  { id: 'poire_chocolat',        expect: 'dark chocolate cream, pear slices',                    forbidden: 'salami, pepperoni, cheese, tomato base' },
  { id: 'honey_fig_mascarpone',  expect: 'mascarpone base, halved figs, honey, pistachios',       forbidden: 'salami, pepperoni, cheese savory, tomato base' },
  { id: 'speculoos_banana',      expect: 'speculoos cookie spread, banana slices, caramel',       forbidden: 'salami, pepperoni, cheese, tomato base' },
  { id: 'creme_brulee_pizza',    expect: 'crackled caramelised sugar crust, golden-brown surface',forbidden: 'salami, pepperoni, cheese, tomato base' },
  { id: 'crisommola',            expect: 'ricotta base, apricot halves, honey',                   forbidden: 'salami, pepperoni, savory cheese, tomato base' },
  { id: 'ricotta_miele_castagne',expect:'fresh ricotta spread, honey drizzle, almond flakes',     forbidden: 'salami, pepperoni, tomato base' },
  { id: 'fragole_basilico',      expect: 'mascarpone base, strawberry halves, basil',             forbidden: 'salami, pepperoni, savory cheese, tomato base' },
  { id: 'cioccolato_peperoncino',expect:'dark chocolate cream, red chilli flakes',                forbidden: 'salami, pepperoni, savory cheese, tomato base' },
  { id: 'mela_cannella',         expect: 'cream cheese base, caramelised apple, cinnamon',        forbidden: 'salami, pepperoni, savory cheese, tomato base' },
  { id: 'caramel_noisette',      expect: 'golden caramel spread, toasted hazelnuts',              forbidden: 'salami, pepperoni, savory cheese, tomato base' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function auditImage(pizza) {
  const filepath = path.join(PIZZAS_DIR, pizza.id + '.webp');
  if (!fs.existsSync(filepath)) {
    return { id: pizza.id, status: 'MISSING', reason: 'File not found' };
  }

  const imageData = fs.readFileSync(filepath).toString('base64');
  const forbiddenText = pizza.forbidden
    ? `\nWrong ingredients to check for: ${pizza.forbidden}`
    : '\nNo specific forbidden ingredients — just verify it looks like the right pizza.';

  const prompt = `You are checking a pizza image for WRONG INGREDIENTS ONLY.
Ignore completely: flour dust, decorations, plates, boards, background lighting, photographic styling.
Only fail if the pizza clearly contains ingredients it should NOT have.

Expected: ${pizza.expect}${forbiddenText}

Is the pizza showing the RIGHT ingredients (even approximately)?

Reply ONLY in this exact format:
PASS or FAIL
REASON: one sentence (if FAIL: name the specific wrong ingredient visible; if PASS: write "correct")`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
        { type: 'text', text: prompt },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const pass = text.startsWith('PASS');
  const reasonMatch = text.match(/REASON:\s*(.+)/);
  const reason = reasonMatch ? reasonMatch[1].trim() : text;

  return { id: pizza.id, status: pass ? 'PASS' : 'FAIL', reason };
}

async function runAudit() {
  const files = fs.readdirSync(PIZZAS_DIR).filter(f => f.endsWith('.webp') && !f.startsWith('_'));
  console.log(`\n🍕 Pizza Image Audit — ingredients only`);
  console.log(`📦 ${PIZZAS.length} pizzas to audit | 📁 ${files.length} files found\n`);

  const results = [];
  const failed = [];

  for (let i = 0; i < PIZZAS.length; i++) {
    const pizza = PIZZAS[i];
    process.stdout.write(`[${i+1}/${PIZZAS.length}] ${pizza.id}... `);

    try {
      const result = await auditImage(pizza);
      results.push(result);

      if (result.status === 'PASS') {
        console.log(`✅`);
      } else if (result.status === 'MISSING') {
        console.log(`⚠️  MISSING`);
      } else {
        console.log(`❌  ${result.reason}`);
        failed.push(result);
      }
    } catch (err) {
      console.log(`💥 ERROR: ${err.message}`);
      results.push({ id: pizza.id, status: 'ERROR', reason: err.message });
    }

    if (i < PIZZAS.length - 1) await sleep(DELAY_MS);
  }

  // Save report
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ results, failed, date: new Date().toISOString() }, null, 2));

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const failedCount = failed.length;
  const missing = results.filter(r => r.status === 'MISSING').length;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Passed: ${passed} | ❌ Failed: ${failedCount} | ⚠️  Missing: ${missing}`);

  if (failed.length > 0) {
    console.log(`\n❌ Images to regenerate:`);
    failed.forEach(f => console.log(`  rm public/pizzas/${f.id}.webp  # ${f.reason}`));
    console.log(`\nThen run: node scripts/generate-pizza-images.js`);
  } else {
    console.log(`\n🎉 All images have correct ingredients!`);
  }
}

runAudit().catch(console.error);