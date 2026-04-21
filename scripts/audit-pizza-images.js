// scripts/audit-pizza-images.js
// Audits all generated pizza images using Claude vision
// Run AFTER generate-pizza-images.js completes
// Usage: node scripts/audit-pizza-images.js

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PIZZAS_DIR = path.join(__dirname, '../public/pizzas');
const REPORT_PATH = path.join(__dirname, '../public/pizzas/_audit_report.json');
const DELAY_MS = 1000;

const PIZZAS = [
  { id: 'margherita', expect: 'tomato sauce, mozzarella, basil — NO meat, NO salami, NO pepperoni' },
  { id: 'marinara', expect: 'tomato sauce, garlic, oregano — NO cheese, NO meat, NO salami' },
  { id: 'diavola', expect: 'spicy salami slices, mozzarella, chilli' },
  { id: 'quattro_formaggi', expect: 'four cheeses, white base — NO meat, NO salami, NO pepperoni' },
  { id: 'capricciosa', expect: 'ham, mushrooms, olives, artichoke — NO salami, NO pepperoni' },
  { id: 'napoli', expect: 'anchovies, capers, olives — NO salami, NO pepperoni, NO meat' },
  { id: 'pepperoni', expect: 'pepperoni slices, mozzarella, tomato' },
  { id: 'nduja_mozzarella', expect: 'orange-red nduja spread, mozzarella — NO salami rounds, NO pepperoni' },
  { id: 'tonno_cipolla', expect: 'tuna chunks, onion rings — NO meat, NO salami' },
  { id: 'smoked_salmon_creme', expect: 'pink salmon slices, creme fraiche, dill, capers — NO meat, NO salami' },
  { id: 'ortolana', expect: 'courgette, aubergine, peppers — NO meat, NO salami, NO pepperoni' },
  { id: 'funghi_tartufo', expect: 'mushrooms, truffle — NO meat, NO salami, NO pepperoni' },
  { id: 'patate_rosmarino', expect: 'thin potato slices, rosemary — NO meat, NO salami, NO pepperoni' },
  { id: 'bianca_ricotta_spinaci', expect: 'ricotta, dark green spinach, white base — NO meat, NO salami' },
  { id: 'truffle_bianca', expect: 'truffle shavings, white cream base — NO meat, NO salami' },
  { id: 'prosciutto_rucola', expect: 'thin pink prosciutto ham draped, green rocket leaves — NOT salami rounds' },
  { id: 'burrata_prosciutto', expect: 'whole burrata cheese, prosciutto — NOT salami rounds' },
  { id: 'fig_gorgonzola', expect: 'halved figs, blue gorgonzola, walnuts, honey — NO meat, NO salami' },
  { id: 'pear_walnut_gorgonzola', expect: 'pear slices, walnuts, blue cheese, honey — NO meat, NO salami' },
  { id: 'bbq_chicken', expect: 'BBQ sauce base, grilled chicken pieces, red onion — NO salami, NO pepperoni' },
  { id: 'speck_brie', expect: 'smoked speck ham slices, melted brie — NOT salami rounds' },
  { id: 'tarte_flambee', expect: 'creme fraiche base, smoked lardons, white onion slices — NO salami, NO pepperoni' },
  { id: 'raclette_pommes', expect: 'melted raclette cheese, potato slices, lardons — NO salami, NO pepperoni' },
  { id: 'chevre_miel', expect: 'goat cheese rounds, honey drizzle, thyme — NO salami, NO pepperoni, NO cured meat rounds of any kind' },
  { id: 'andouille_moutarde', expect: 'sausage slices, mustard base, onions — NOT pepperoni-style rounds' },
  { id: 'maroilles_onion', expect: 'orange-rind cheese slices, golden caramelised onions — NO salami, NO pepperoni' },
  { id: 'jambon_bayonne', expect: 'thin ham slices, red pepper flakes — NOT salami rounds, NOT pepperoni' },
  { id: 'camembert_apple', expect: 'camembert wedges, apple slices, lardons — NO salami, NO pepperoni' },
  { id: 'tartiflette', expect: 'reblochon cheese melted, potato slices, lardons — NO salami, NO pepperoni' },
  { id: 'la_reine', expect: 'ham slices, mushrooms, black olives — NO salami rounds, NO pepperoni' },
  { id: 'la_royale', expect: 'ham and salami slices, red and green peppers' },
  { id: 'la_paysanne', expect: 'lardons, potato slices, creme fraiche — NO salami, NO pepperoni' },
  { id: 'quatre_saisons', expect: 'four distinct quarters: artichoke, ham, olives, mushrooms' },
  { id: 'margherita_sbagliata', expect: 'tomato dollops on top, mozzarella baked into white base, basil — NO meat' },
  { id: 'cosacca', expect: 'tomato sauce, grated pecorino, basil — NO mozzarella, NO meat, NO salami' },
  { id: 'salsiccia_friarielli', expect: 'sausage pieces, dark green broccoli rabe, white base — NOT pepperoni rounds' },
  { id: 'provola_pepe', expect: 'smoked cheese melted, cracked black pepper — NO meat, NO salami' },
  { id: 'acciughe_pomodorini', expect: 'anchovy fillets, halved cherry tomatoes, capers — NO salami, NO pepperoni' },
  { id: 'melanzane_parmigiana', expect: 'layered aubergine, parmesan, tomato, basil — NO meat, NO salami' },
  { id: 'zucca_provola', expect: 'orange pumpkin slices, smoked provola — NO meat, NO salami' },
  { id: 'boscaiola', expect: 'forest mushrooms, sausage pieces, tomato — NOT pepperoni rounds' },
  { id: 'bismarck', expect: 'whole egg cracked in center, ham, mushrooms — NOT salami rounds' },
  { id: 'pugliese', expect: 'black olives, capers, red onion slices — NO salami, NO pepperoni, NO meat' },
  { id: 'prosciutto_funghi', expect: 'ham slices, mushrooms — NOT salami rounds, NOT pepperoni' },
  { id: 'tonno_cipolla_rossa', expect: 'tuna flakes, red onion rings — NO meat, NO salami' },
  { id: 'piennolo', expect: 'Vesuvian cherry tomatoes halved, basil, olive oil — NO cheese, NO meat, absolutely nothing else' },
  { id: 'funghi_salsiccia', expect: 'earthy mushrooms, sausage pieces — NOT round pepperoni-style slices' },
  { id: 'salmone_rucola', expect: 'pink smoked salmon, fresh green rocket, capers — NO meat, NO salami' },
  { id: 'acciughe_burro', expect: 'anchovy fillets, white butter base — NO salami, NO pepperoni' },
  { id: 'pollo_pesto', expect: 'green pesto base, grilled chicken slices, cherry tomatoes — NO salami' },
  { id: 'genovese', expect: 'green pesto base, thin potato slices, green beans — NO meat, NO salami' },
  { id: 'polpette', expect: 'round meatballs (large irregular), tomato, basil — NOT pepperoni-style rounds' },
  { id: 'diavola_burrata', expect: 'spicy salami rounds, mozzarella, whole burrata placed on top cold' },
  { id: 'pistadella', expect: 'mortadella slices draped (large pink), green pistachio pesto — NOT salami rounds' },
  { id: 'stracciatella_datterini', expect: 'small datterini tomatoes, white stracciatella dollops — NO meat, NO salami' },
  { id: 'nduja_burrata', expect: 'orange-red nduja spread base, whole burrata in center — NO salami rounds, NO pepperoni' },
  { id: 'tartufo_fior_di_latte', expect: 'fior di latte mozzarella, truffle oil, truffle shavings — NO meat' },
  { id: 'lardo_rosmarino', expect: 'thin translucent white lardo slices, rosemary sprigs — NOT salami, NOT pepperoni' },
  { id: 'scarpetta', expect: 'buffalo mozzarella, Grana Padano fondue swirl, tomato compote dots — NO salami' },
  { id: 'caponata', expect: 'aubergine, peppers, capers, olives — NO meat, NO salami, NO pepperoni' },
  { id: 'soppressata_fichi', expect: 'soppressata salami slices, halved fresh figs, honey — correct salami here' },
  { id: 'guanciale_pecorino', expect: 'guanciale pork strips (not rounds), grated pecorino, tomato — NOT pepperoni-style rounds' },
  { id: 'honey_pecorino', expect: 'grated pecorino, golden honey drizzle, white base — NO meat, NO salami' },
  { id: 'burrata_prosciutto_crudo', expect: 'whole burrata, prosciutto draped, tomato — NOT salami rounds' },
  { id: 'porcini_stracciatella', expect: 'dark porcini mushrooms, stracciatella dollops — NO meat, NO salami' },
  { id: 'wagyu_onion', expect: 'premium beef slices, golden caramelised onion — NOT salami rounds' },
  { id: 'crudo_parma_stracciatella', expect: 'Parma ham draped (not rounds), stracciatella — NOT salami rounds' },
  { id: 'norma', expect: 'fried aubergine slices, ricotta salata grated, tomato, basil — NO meat, NO salami' },
  { id: 'carciofi_romana', expect: 'artichoke quarters, white olive oil base — NO meat, NO salami' },
  { id: 'fiori_zucca_alici', expect: 'yellow courgette flowers, anchovy fillets — NO salami, NO pepperoni' },
  { id: 'amatriciana', expect: 'guanciale strips (not rounds), tomato, pecorino — NOT pepperoni-style rounds' },
  { id: 'carbonara', expect: 'pale yellow egg cream base, guanciale strips, cracked black pepper — NOT pepperoni rounds' },
  { id: 'cacio_pepe', expect: 'white pecorino cream base, cracked black pepper only — NO meat, NO salami, NO other toppings' },
  { id: 'gricia', expect: 'guanciale strips (not rounds), grated pecorino, white base — NOT pepperoni rounds' },
  { id: 'bianca_rosmarino', expect: 'white olive oil base, rosemary sprigs, sea salt only — NO meat, NO cheese, NO salami, nothing else' },
  { id: 'bresaola_rucola', expect: 'dark red bresaola cured beef slices (thin, draped), green rocket — NOT salami rounds' },
  { id: 'speck_stracchino', expect: 'smoked speck slices, white stracchino cream — NOT salami rounds' },
  { id: 'indivia_gorgonzola', expect: 'pale endive leaves, crumbled gorgonzola, walnuts — NO meat, NO salami' },
  { id: 'prosciutto_stracciatella', expect: 'prosciutto draped (not rounds), cold stracciatella dollops — NOT salami rounds' },
  { id: 'patata_rosmarino_roman', expect: 'thin overlapping potato slices, rosemary, olive oil — NO meat, NO salami' },
  { id: 'verdure_grigliate_burrata', expect: 'grilled colourful vegetables, whole burrata in center — NO meat, NO salami' },
  { id: 'alici_pomodorini', expect: 'fresh anchovy fillets, halved cherry tomatoes, capers — NO salami, NO pepperoni' },
  { id: 'porcini_pecorino', expect: 'dark porcini mushrooms, grated pecorino — NO meat, NO salami' },
  { id: 'teglia_patata_provola', expect: 'rectangular pizza, potato slices, smoked provola — NO salami, NO pepperoni' },
  { id: 'teglia_funghi_salsiccia', expect: 'rectangular pizza, mushrooms, sausage pieces — NOT pepperoni rounds' },
  { id: 'teglia_prosciutto_funghi', expect: 'rectangular pizza, cooked ham slices, mushrooms — NOT salami rounds' },
  { id: 'teglia_zucchine_fiori', expect: 'rectangular pizza, courgette slices, yellow courgette flowers — NO meat, NO salami' },
  { id: 'teglia_mortadella_pistacchio', expect: 'rectangular pizza, mortadella draped (large pink), green pistachio — NOT salami rounds' },
  { id: 'teglia_tonno_cipolla', expect: 'rectangular pizza, tuna chunks, red onion — NO meat, NO salami' },
  { id: 'teglia_quattro_formaggi', expect: 'rectangular pizza, four melted cheeses — NO meat, NO salami' },
  { id: 'teglia_speck_brie', expect: 'rectangular pizza, smoked speck slices, melted brie — NOT salami rounds' },
  { id: 'teglia_verdure', expect: 'rectangular pizza, grilled mixed vegetables — NO meat, NO salami' },
  { id: 'teglia_nduja_stracciatella', expect: 'rectangular pizza, orange nduja spread, stracciatella dollops — NO salami rounds' },
  { id: 'ny_pepperoni', expect: 'thin NY crust, pepperoni cups curled at edges, tomato, mozzarella' },
  { id: 'hot_honey_pepperoni', expect: 'pepperoni cups, mozzarella, honey drizzle' },
  { id: 'white_clam_apizza', expect: 'chopped clams, garlic, white base — NO mozzarella, NO meat, NO salami' },
  { id: 'sausage_peppers', expect: 'sausage slices, green and red bell pepper strips — NOT pepperoni rounds' },
  { id: 'vodka_sauce', expect: 'pink tomato vodka cream sauce, mozzarella, basil — NO meat, NO salami' },
  { id: 'ny_white', expect: 'white garlic base, ricotta dollops, mozzarella — NO tomato, NO meat, NO salami' },
  { id: 'buffalo_chicken', expect: 'orange buffalo chicken pieces, blue cheese crumbles, celery — NO salami, NO pepperoni' },
  { id: 'california_bbq_chicken', expect: 'BBQ sauce, grilled chicken, red onion, fresh coriander — NO salami, NO pepperoni' },
  { id: 'smoked_salmon_cream_cheese', expect: 'pink salmon draped, cream cheese, dill, capers — NO meat, NO salami' },
  { id: 'clam_garlic_white', expect: 'chopped clams, garlic, white base, parsley — NO meat, NO salami' },
  { id: 'ny_margherita_bufala', expect: 'tomato, buffalo mozzarella slices, fresh basil — NO meat, NO salami' },
  { id: 'ny_diavola', expect: 'spicy salami slices, mozzarella, thin NY crust' },
  { id: 'detroit_red_top', expect: 'rectangular thick pizza, cheese caramelised to edges, pepperoni, tomato sauce stripes on top' },
  { id: 'detroit_white', expect: 'rectangular thick pizza, caramelised cheese edges, no tomato, herbs — NO salami rounds' },
  { id: 'detroit_sausage_mushroom', expect: 'rectangular thick pizza, sausage pieces, mushrooms — NOT pepperoni rounds' },
  { id: 'detroit_veggie', expect: 'rectangular thick pizza, roasted peppers, caramelised onion, caramelised cheese edges — NO meat, NO salami' },
  { id: 'chicago_deep_dish', expect: 'very deep round pan, very tall buttery crust walls, chunky tomato sauce on top, sausage layer inside' },
  { id: 'pan_margherita', expect: 'thick round pan base, tomato, mozzarella, basil — NO meat, NO salami' },
  { id: 'pan_hot_honey_pepperoni', expect: 'thick round pan, crispy pepperoni, honey drizzle' },
  { id: 'pan_bbq_chicken', expect: 'thick round pan, BBQ sauce, grilled chicken, red onion — NO salami, NO pepperoni' },
  { id: 'pan_nduja', expect: 'thick round pan, orange nduja spread, whole burrata center — NO salami rounds' },
  { id: 'pan_quattro_formaggi', expect: 'thick round pan, four melted cheeses — NO meat, NO salami' },
  { id: 'jamon_manchego', expect: 'silky Iberico ham draped (not rounds), manchego shavings — NOT salami rounds' },
  { id: 'sobrasada_miel', expect: 'orange-red sobrasada spread, honey drizzle — NO salami rounds, NOT pepperoni' },
  { id: 'escalivada', expect: 'fire-roasted aubergine strips, red peppers, onion — NO meat, NO salami' },
  { id: 'chorizo_padron', expect: 'chorizo slices, small green Padron peppers — NOT pepperoni-style' },
  { id: 'pulpo_gallega', expect: 'octopus tentacle pieces, potato slices, smoked paprika — NO salami, NO pepperoni' },
  { id: 'halloumi_zaatar', expect: 'grilled halloumi slices, zaatar herbs, tomatoes — NO meat, NO salami' },
  { id: 'zaatar', expect: 'zaatar herb blend spread, sesame seeds, white olive oil base — NO cheese, NO meat, NO salami' },
  { id: 'merguez_harissa', expect: 'merguez sausage slices, red harissa base, cracked egg — NOT round pepperoni-style' },
  { id: 'miso_funghi', expect: 'white miso cream base, shiitake and oyster mushrooms — NO meat, NO salami' },
  { id: 'mentaiko_cream', expect: 'pink mentaiko cream base, nori strips, spring onion slices — NO meat, NO salami' },
  { id: 'teriyaki_chicken', expect: 'teriyaki-glazed chicken pieces, spring onion, sesame seeds — NO salami, NO pepperoni' },
  { id: 'salmone_wasabi', expect: 'smoked salmon slices, wasabi cream base, nori, sesame — NO meat, NO salami' },
  { id: 'korean_bbq', expect: 'bulgogi beef strips (thin, marinated), kimchi, sesame — NOT round pepperoni-style' },
  { id: 'nori_sesame_bianca', expect: 'white sesame base, nori strips, sesame seeds — NO meat, NO salami' },
  { id: 'provencale', expect: 'black olives, anchovy fillets, herbes de Provence, tomato — NO salami, NO pepperoni' },
  { id: 'pizza_lorraine', expect: 'creme fraiche base, smoked lardons, emmental cheese, onions — NO salami, NO pepperoni' },
  { id: 'perigourdine', expect: 'duck confit pieces, walnut halves, foie gras — NOT salami rounds' },
  { id: 'pistou', expect: 'green pistou pesto base, summer vegetables, goat cheese — NO meat, NO salami' },
  { id: 'alsacienne_choucroute', expect: 'sauerkraut (pale shredded cabbage), smoked lardons, Munster cheese — NO salami rounds' },
  { id: 'basquaise', expect: 'Bayonne ham, red Espelette pepper, sheep cheese — NOT salami rounds' },
  { id: 'lyonnaise', expect: 'fromage blanc base, caramelised golden onions, smoked lardons — NO salami, NO pepperoni' },
  { id: 'normande_camembert', expect: 'camembert wedges melting, smoked lardons, apple slices, creme fraiche — NO salami, NO pepperoni' },
  { id: 'nutella_fraises', expect: 'Nutella chocolate spread base, fresh strawberry halves, powdered sugar — NO meat, NO salami, sweet dessert only' },
  { id: 'tarte_tatin_pizza', expect: 'caramelised apple slices in circle, golden caramel glaze — NO meat, NO salami, sweet dessert only' },
  { id: 'poire_chocolat', expect: 'dark chocolate cream base, pear slices, mascarpone — NO meat, NO salami, sweet dessert only' },
  { id: 'honey_fig_mascarpone', expect: 'white mascarpone base, halved figs, honey drizzle, pistachios — NO meat, NO salami, sweet dessert only' },
  { id: 'speculoos_banana', expect: 'speculoos spread base, banana slices, caramel drizzle — NO meat, NO salami, sweet dessert only' },
  { id: 'creme_brulee_pizza', expect: 'vanilla cream base, caramelised sugar crust crackled golden — NO meat, NO salami, sweet dessert only' },
  { id: 'crisommola', expect: 'white ricotta base, apricot halves, honey drizzle — NO meat, NO salami, sweet dessert only' },
  { id: 'ricotta_chestnut_honey', expect: 'fresh ricotta base, dark honey drizzle, toasted almond flakes — NO meat, NO salami, sweet dessert only' },
  { id: 'fragole_basilico', expect: 'white mascarpone base, fresh strawberry halves, basil leaves — NO meat, NO salami, sweet dessert only' },
  { id: 'cioccolato_peperoncino', expect: 'dark chocolate cream base, chilli flakes, sea salt — NO meat, NO salami, sweet dessert only' },
  { id: 'mela_cannella', expect: 'caramelised apple slices, cinnamon, cream cheese base — NO meat, NO salami, sweet dessert only' },
  { id: 'caramel_noisette', expect: 'salted caramel base, toasted hazelnut halves, vanilla cream — NO meat, NO salami, sweet dessert only' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function auditImage(pizza) {
  const filepath = path.join(PIZZAS_DIR, pizza.id + '.png');
  if (!fs.existsSync(filepath)) {
    return { id: pizza.id, status: 'MISSING', note: 'File not found' };
  }

  const imageData = fs.readFileSync(filepath).toString('base64');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: imageData },
        },
        {
          type: 'text',
          text: `This pizza image should show: ${pizza.expect}.

Check ALL of the following:
1. Does the image correctly show the expected ingredients?
2. Is it clearly a pizza (not raw dough, not a toy, not abstract, not just a circle)?
3. FAIL if any ingredients are scattered OUTSIDE the pizza edge as decoration (e.g. figs, nuts, tomatoes placed around the pizza).
4. FAIL if the background is not clean and dark — any cloth, napkin, kitchen towel, linen visible = FAIL.
5. FAIL if a plate, wooden board, marble board, pizza peel, or any serving surface is visible under the pizza.
6. FAIL if there is excessive flour, breadcrumbs, or powder scattered on the background surface.
7. FAIL if the image shows salami rounds or pepperoni slices when they are NOT listed in the expected ingredients.
8. FAIL if completely wrong ingredients are visible (e.g. walnuts on a margherita, salami on a chevre miel).
9. FAIL if the base colour is wrong — e.g. red tomato base when a white base is expected, or vice versa.

Reply in this exact format:
PASS or FAIL
REASON: one sentence listing the specific problem (mention plate/board/flour/decoration/wrong ingredient), or "correct" if passing`,
        },
      ],
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const pass = text.startsWith('PASS');
  const reason = text.replace(/^(PASS|FAIL)\n?/, '').replace('REASON: ', '').trim();

  return {
    id: pizza.id,
    status: pass ? 'PASS' : 'FAIL',
    note: reason,
    expect: pizza.expect,
  };
}

async function runAudit() {
  if (!fs.existsSync(PIZZAS_DIR)) {
    console.error('❌ Pizzas directory not found: ' + PIZZAS_DIR);
    console.error('Run generate-pizza-images.js first.');
    process.exit(1);
  }

  const files = fs.readdirSync(PIZZAS_DIR).filter(f => f.endsWith('.png') && !f.startsWith('_'));
  console.log('\n🔍 Baker Hub Pizza Image Auditor');
  console.log('📦 ' + PIZZAS.length + ' pizzas to audit | 🖼  ' + files.length + ' files found\n');

  const results = { pass: [], fail: [], missing: [] };

  for (let i = 0; i < PIZZAS.length; i++) {
    const pizza = PIZZAS[i];
    process.stdout.write('[' + (i+1) + '/' + PIZZAS.length + '] ' + pizza.id + '... ');
    try {
      const result = await auditImage(pizza);
      if (result.status === 'PASS') {
        results.pass.push(result);
        console.log('✅');
      } else if (result.status === 'MISSING') {
        results.missing.push(result);
        console.log('⚠️  MISSING');
      } else {
        results.fail.push(result);
        console.log('❌  ' + result.note);
      }
    } catch (err) {
      console.log('💥 ERROR: ' + err.message);
      results.fail.push({ id: pizza.id, status: 'ERROR', note: err.message });
    }
    if (i < PIZZAS.length - 1) await sleep(DELAY_MS);
  }

  // Save full report
  fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PASS:    ' + results.pass.length);
  console.log('❌ FAIL:    ' + results.fail.length);
  console.log('⚠️  MISSING: ' + results.missing.length);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (results.fail.length > 0) {
    console.log('\n❌ Failed pizzas — delete and regenerate:');
    results.fail.forEach(r => console.log('  • ' + r.id + ': ' + r.note));
    console.log('\n📋 Copy-paste to delete all failed images:');
    console.log(results.fail.map(r => 'rm public/pizzas/' + r.id + '.png').join('\n'));
  }

  if (results.missing.length > 0) {
    console.log('\n⚠️  Missing images — will be generated on next run:');
    results.missing.forEach(r => console.log('  • ' + r.id));
  }

  console.log('\n📄 Full report: public/pizzas/_audit_report.json');
  console.log('\nAfter deleting failed images, run:');
  console.log('  node scripts/generate-pizza-images.js');
}

runAudit().catch(console.error);