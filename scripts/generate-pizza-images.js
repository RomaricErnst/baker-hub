const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 4500;

const BASE = 'slightly viewed from above at a 30 degree angle, centered. Soft, warm lighting with gentle shadows and a subtle glow underneath. A round pizza with a thick, airy cornicione (puffy edge with soft irregular shape) and a thinner center. The pizza looks natural and slightly imperfect, with soft volume and depth. Background is a dark charcoal surface (#1A1612) with a warm reddish glow behind the pizza. Style is clean and minimal but still food-like, not flat, not graphic, not an icon. No text, no labels.';

const NEA = (toppings) => `A Neapolitan pizza, ${BASE} Toppings: ${toppings}`;
const NY  = (toppings) => `A New York-style thin crust pizza, ${BASE} Toppings: ${toppings}`;
const PAN = (toppings) => `A thick pan pizza with airy crust, ${BASE} Toppings: ${toppings}`;
const TEG = (toppings) => `A rectangular Roman teglia pizza (thick, airy, rectangular), ${BASE} Toppings: ${toppings}`;
const DET = (toppings) => `A rectangular Detroit-style pizza (thick, square, cheese caramelised to edges), ${BASE} Toppings: ${toppings}`;
const CHI = (toppings) => `A Chicago deep dish pizza (very deep round pan, tall buttery crust walls), ${BASE} Toppings: ${toppings}`;
const DES = (toppings) => `A round dessert pizza with pale golden base, ${BASE} Sweet toppings: ${toppings}`;

const PIZZAS = [
  { id: 'margherita', prompt: NEA('rich tomato base, 5-6 soft mozzarella discs, a few fresh basil leaves in center') },
  { id: 'marinara', prompt: NEA('rich tomato base, whole garlic cloves, dried oregano, olive oil drizzle, no cheese') },
  { id: 'diavola', prompt: NEA('tomato base, overlapping dark spicy salami slices, mozzarella, pinch of chilli flakes') },
  { id: 'quattro_formaggi', prompt: NEA('white cream base, four different melted cheeses in distinct patches, golden bubbly surface') },
  { id: 'capricciosa', prompt: NEA('tomato base, mozzarella, ham slices, mushrooms, black olives, artichoke pieces') },
  { id: 'napoli', prompt: NEA('tomato base, anchovy fillets, capers, black olives, mozzarella') },
  { id: 'pepperoni', prompt: NEA('tomato base, generous pepperoni slices curled at edges, melted mozzarella') },
  { id: 'nduja_mozzarella', prompt: NEA('tomato base, orange-red nduja sausage dollops, white mozzarella') },
  { id: 'tonno_cipolla', prompt: NEA('tomato base, tuna chunks, white onion rings, mozzarella') },
  { id: 'smoked_salmon_creme', prompt: NEA('white creme fraiche base, pink smoked salmon slices, capers, dill fronds') },
  { id: 'ortolana', prompt: NEA('tomato base, grilled courgette, aubergine, red and yellow peppers, mozzarella') },
  { id: 'funghi_tartufo', prompt: NEA('white truffle cream base, dark forest mushrooms, truffle shavings, mozzarella') },
  { id: 'patate_rosmarino', prompt: NEA('white olive oil base, thin overlapping potato slices, fresh rosemary sprigs, sea salt') },
  { id: 'bianca_ricotta_spinaci', prompt: NEA('white ricotta base, dark green wilted spinach, ricotta dollops') },
  { id: 'truffle_bianca', prompt: NEA('white cream base, dark truffle shavings, mozzarella, truffle oil drizzle') },
  { id: 'prosciutto_rucola', prompt: NEA('tomato base, mozzarella baked, thin pink prosciutto draped over after baking, fresh green rocket leaves') },
  { id: 'burrata_prosciutto', prompt: NEA('tomato base, whole burrata in center, pink prosciutto crudo draped around it') },
  { id: 'fig_gorgonzola', prompt: NEA('white base, halved fresh figs, crumbled blue gorgonzola, honey drizzle, walnuts') },
  { id: 'pear_walnut_gorgonzola', prompt: NEA('white base, pear slices fanned out, crumbled gorgonzola, walnut halves, honey drizzle') },
  { id: 'bbq_chicken', prompt: NEA('dark smoky BBQ sauce base, grilled chicken pieces, red onion slices, mozzarella') },
  { id: 'speck_brie', prompt: NEA('white base, smoked speck slices, melted brie wedges, rosemary') },
  { id: 'tarte_flambee', prompt: NEA('white creme fraiche base, smoked lardons, sliced white onions') },
  { id: 'raclette_pommes', prompt: NEA('white base, melted raclette cheese, thin potato slices, smoked lardons') },
  { id: 'chevre_miel', prompt: NEA('white base, goat cheese rounds, honey drizzle, fresh thyme sprigs, walnuts') },
  { id: 'andouille_moutarde', prompt: NEA('mustard cream base, andouille sausage slices, onions, emmental cheese') },
  { id: 'maroilles_onion', prompt: NEA('creme fraiche base, orange-rind maroilles cheese slices, golden caramelised onions') },
  { id: 'jambon_bayonne', prompt: NEA('white base, thin Bayonne ham slices, red Espelette pepper flakes, melted cheese') },
  { id: 'camembert_apple', prompt: NEA('white base, melted camembert wedges, apple slices, smoked lardons') },
  { id: 'tartiflette', prompt: NEA('cream base, reblochon cheese melted, potato slices, smoked lardons, onions') },
  { id: 'la_reine', prompt: NEA('tomato base, mozzarella, ham slices, mushrooms, black olives') },
  { id: 'la_royale', prompt: NEA('tomato base, ham, salami slices, red and green peppers, mozzarella') },
  { id: 'la_paysanne', prompt: NEA('creme fraiche base, smoked lardons, potato slices, onions') },
  { id: 'quatre_saisons', prompt: NEA('tomato base, four distinct quarters: artichoke, ham, black olives, mushrooms') },
  { id: 'margherita_sbagliata', prompt: NEA('mozzarella baked into white base, fresh crushed tomato dollops on top, basil') },
  { id: 'cosacca', prompt: NEA('tomato base, grated pecorino, basil, olive oil drizzle, no mozzarella') },
  { id: 'salsiccia_friarielli', prompt: NEA('white olive oil base, Italian pork sausage pieces, dark green broccoli rabe, fior di latte') },
  { id: 'provola_pepe', prompt: NEA('white base, smoked provola cheese melted, generous cracked black pepper') },
  { id: 'acciughe_pomodorini', prompt: NEA('tomato base, anchovy fillets, halved cherry tomatoes, mozzarella, capers') },
  { id: 'melanzane_parmigiana', prompt: NEA('tomato base, layered aubergine slices, parmesan, basil, mozzarella') },
  { id: 'zucca_provola', prompt: NEA('white base, orange pumpkin slices, smoked provola, pumpkin seeds') },
  { id: 'boscaiola', prompt: NEA('tomato base, forest mushrooms, sausage pieces, mozzarella') },
  { id: 'bismarck', prompt: NEA('tomato base, mozzarella, whole egg cracked in center, ham, mushrooms') },
  { id: 'pugliese', prompt: NEA('tomato base, black olives, capers, sliced red onion, mozzarella') },
  { id: 'prosciutto_funghi', prompt: NEA('tomato base, mozzarella, ham slices, sliced mushrooms') },
  { id: 'tonno_cipolla_rossa', prompt: NEA('tomato base, tuna flakes, red onion rings, mozzarella') },
  { id: 'piennolo', prompt: NEA('white olive oil base, Vesuvian cherry tomatoes halved, basil, no cheese, sea salt') },
  { id: 'funghi_salsiccia', prompt: NEA('tomato base, earthy mushrooms, sausage pieces, mozzarella') },
  { id: 'salmone_rucola', prompt: NEA('white cream base, pink smoked salmon, fresh green rocket, capers') },
  { id: 'acciughe_burro', prompt: NEA('white butter-enriched base, anchovy fillets, mozzarella') },
  { id: 'pollo_pesto', prompt: NEA('green pesto base, grilled chicken slices, mozzarella, cherry tomatoes') },
  { id: 'genovese', prompt: NEA('green pesto base, thin potato slices, green beans, mozzarella') },
  { id: 'polpette', prompt: NEA('tomato base, round Italian meatballs, mozzarella, basil') },
  { id: 'diavola_burrata', prompt: NEA('tomato base, spicy dark salami, mozzarella, whole burrata added cold on top') },
  { id: 'pistadella', prompt: NEA('white base, mortadella slices draped, green pistachio pesto swirl, fior di latte') },
  { id: 'stracciatella_datterini', prompt: NEA('tomato base, small sweet datterini tomatoes, white stracciatella cheese dollops') },
  { id: 'nduja_burrata', prompt: NEA('orange-red nduja spread base, whole burrata in center, chilli oil drizzle') },
  { id: 'tartufo_fior_di_latte', prompt: NEA('white base, fior di latte mozzarella, truffle oil drizzle, truffle shavings') },
  { id: 'lardo_rosmarino', prompt: NEA('white base, thin translucent white lardo slices, rosemary sprigs, sea salt') },
  { id: 'scarpetta', prompt: NEA('white base, buffalo mozzarella, Grana Padano fondue swirl, tomato compote dots') },
  { id: 'caponata', prompt: NEA('white base, Sicilian caponata with aubergine peppers capers olives, mozzarella') },
  { id: 'soppressata_fichi', prompt: NEA('white base, spicy soppressata slices, halved fresh figs, honey drizzle, mozzarella') },
  { id: 'guanciale_pecorino', prompt: NEA('tomato base, guanciale pork strip pieces, grated pecorino, black pepper') },
  { id: 'honey_pecorino', prompt: NEA('white base, grated aged pecorino, golden honey drizzle, black pepper') },
  { id: 'burrata_prosciutto_crudo', prompt: NEA('tomato base, whole burrata, thin prosciutto crudo draped, basil') },
  { id: 'porcini_stracciatella', prompt: NEA('white base, dark porcini mushrooms, stracciatella cheese dollops, truffle oil') },
  { id: 'wagyu_onion', prompt: NEA('white base, premium wagyu beef slices, golden caramelised onion, mozzarella') },
  { id: 'crudo_parma_stracciatella', prompt: NEA('tomato base baked, Parma ham draped over after baking, stracciatella dollops, basil') },
  { id: 'norma', prompt: NEA('tomato base, fried aubergine slices, grated ricotta salata, basil, mozzarella') },
  { id: 'carciofi_romana', prompt: NEA('white olive oil base, artichoke quarters, garlic, fresh mint leaves') },
  { id: 'fiori_zucca_alici', prompt: NEA('white base, yellow courgette flowers, anchovy fillets, mozzarella') },
  { id: 'amatriciana', prompt: NEA('tomato base, guanciale strips, grated pecorino, black pepper') },
  { id: 'carbonara', prompt: NEA('pale yellow egg cream base, guanciale strips, pecorino, cracked black pepper') },
  { id: 'cacio_pepe', prompt: NEA('white pecorino cream base, generous cracked black pepper, no other toppings') },
  { id: 'gricia', prompt: NEA('white olive oil base, guanciale strips, grated pecorino, black pepper') },
  { id: 'bianca_rosmarino', prompt: NEA('white olive oil base only, rosemary sprigs, sea salt crystals, focaccia style') },
  { id: 'bresaola_rucola', prompt: NEA('white base, dark red bresaola cured beef slices, green rocket, parmesan shavings') },
  { id: 'speck_stracchino', prompt: NEA('white stracchino cream base, smoked speck slices, mozzarella') },
  { id: 'indivia_gorgonzola', prompt: NEA('white base, pale endive leaves, crumbled gorgonzola, walnuts') },
  { id: 'prosciutto_stracciatella', prompt: NEA('white base, cold stracciatella dollops, prosciutto draped over') },
  { id: 'patata_rosmarino_roman', prompt: NEA('white base, thin overlapping potato slices, rosemary, olive oil, sea salt') },
  { id: 'verdure_grigliate_burrata', prompt: NEA('white base, colourful grilled courgette peppers aubergine, whole burrata in center') },
  { id: 'alici_pomodorini', prompt: NEA('white base, fresh anchovy fillets, halved cherry tomatoes, capers') },
  { id: 'porcini_pecorino', prompt: NEA('white base, dark porcini mushrooms, grated pecorino romano, black pepper') },
  { id: 'teglia_patata_provola', prompt: TEG('white base, overlapping potato slices, smoked provola cheese, rosemary') },
  { id: 'teglia_funghi_salsiccia', prompt: TEG('tomato base, mushrooms, sausage pieces, mozzarella') },
  { id: 'teglia_prosciutto_funghi', prompt: TEG('tomato base, cooked ham slices, mushrooms, mozzarella') },
  { id: 'teglia_zucchine_fiori', prompt: TEG('white base, courgette slices, yellow courgette flowers, mozzarella') },
  { id: 'teglia_mortadella_pistacchio', prompt: TEG('white base, mortadella draped, green pistachio crumble, stracciatella dollops') },
  { id: 'teglia_tonno_cipolla', prompt: TEG('tomato base, tuna chunks, red onion rings, mozzarella') },
  { id: 'teglia_quattro_formaggi', prompt: TEG('white base, four melted cheeses, golden bubbly surface') },
  { id: 'teglia_speck_brie', prompt: TEG('white base, smoked speck slices, melted brie, herbs') },
  { id: 'teglia_verdure', prompt: TEG('tomato base, grilled peppers courgette aubergine, mozzarella') },
  { id: 'teglia_nduja_stracciatella', prompt: TEG('orange nduja spread base, stracciatella dollops, chilli oil drizzle') },
  { id: 'ny_pepperoni', prompt: NY('generous pepperoni cups curled at edges, melted mozzarella, tomato base') },
  { id: 'hot_honey_pepperoni', prompt: NY('tomato base, crispy pepperoni cups, mozzarella, hot honey drizzle') },
  { id: 'white_clam_apizza', prompt: NY('white olive oil base, chopped clams, garlic slices, no mozzarella, oregano') },
  { id: 'sausage_peppers', prompt: NY('tomato base, Italian sausage slices, green and red bell pepper strips, mozzarella') },
  { id: 'vodka_sauce', prompt: NY('pink tomato vodka cream sauce, mozzarella, fresh basil') },
  { id: 'ny_white', prompt: NY('garlic olive oil base, ricotta dollops, mozzarella, no tomato') },
  { id: 'buffalo_chicken', prompt: NY('white base, spicy orange buffalo chicken pieces, blue cheese crumbles, celery') },
  { id: 'california_bbq_chicken', prompt: NY('BBQ sauce base, grilled chicken, red onion, fresh coriander, mozzarella') },
  { id: 'smoked_salmon_cream_cheese', prompt: NY('white cream cheese base, pink smoked salmon draped, capers, dill') },
  { id: 'clam_garlic_white', prompt: NY('white garlic base, chopped clams, mozzarella, parsley') },
  { id: 'ny_margherita_bufala', prompt: NY('tomato base, buffalo mozzarella slices, fresh basil') },
  { id: 'ny_diavola', prompt: NY('tomato base, generous spicy salami slices, mozzarella') },
  { id: 'detroit_red_top', prompt: DET('brick cheese caramelised to all four edges, pepperoni, three tomato sauce stripes on top') },
  { id: 'detroit_white', prompt: DET('garlic, brick cheese caramelised to all edges, herbs, no tomato') },
  { id: 'detroit_sausage_mushroom', prompt: DET('Italian sausage, mushrooms, caramelised cheese edges, tomato sauce') },
  { id: 'detroit_veggie', prompt: DET('roasted peppers, caramelised onion, brick cheese frico caramelised edges') },
  { id: 'chicago_deep_dish', prompt: CHI('thick buttery crust walls, sausage layer inside, chunky tomato sauce on top') },
  { id: 'pan_margherita', prompt: PAN('tomato base, mozzarella, fresh basil') },
  { id: 'pan_hot_honey_pepperoni', prompt: PAN('crispy pepperoni, mozzarella, hot honey drizzle') },
  { id: 'pan_bbq_chicken', prompt: PAN('BBQ sauce, grilled chicken pieces, red onion, mozzarella') },
  { id: 'pan_nduja', prompt: PAN('orange nduja spread, whole burrata in center, chilli oil drizzle') },
  { id: 'pan_quattro_formaggi', prompt: PAN('four melted cheeses, golden bubbly surface') },
  { id: 'jamon_manchego', prompt: NEA('white base, silky Iberico ham draped, aged manchego shavings, olive oil drizzle') },
  { id: 'sobrasada_miel', prompt: NEA('white base, orange-red sobrasada spread, honey drizzle, mozzarella') },
  { id: 'escalivada', prompt: NEA('white base, fire-roasted aubergine strips, red peppers, onion, olive oil') },
  { id: 'chorizo_padron', prompt: NEA('tomato base, chorizo slices, small green Padron peppers, mozzarella') },
  { id: 'pulpo_gallega', prompt: NEA('white base, octopus tentacle pieces, potato slices, smoked paprika, olive oil') },
  { id: 'halloumi_zaatar', prompt: NEA('white base, grilled halloumi slices, zaatar herb blend, olive oil, tomatoes') },
  { id: 'zaatar', prompt: NEA('white olive oil base, generous zaatar herb blend spread, sesame seeds, no cheese') },
  { id: 'merguez_harissa', prompt: NEA('red harissa base, merguez sausage slices, cracked egg in center, mozzarella') },
  { id: 'miso_funghi', prompt: NEA('white miso cream base, shiitake and oyster mushrooms, mozzarella') },
  { id: 'mentaiko_cream', prompt: NEA('pink mentaiko cream base, mozzarella, spring onion slices, nori strips') },
  { id: 'teriyaki_chicken', prompt: NEA('white base, teriyaki-glazed chicken pieces, spring onion, sesame seeds, mozzarella') },
  { id: 'salmone_wasabi', prompt: NEA('white wasabi cream base, smoked salmon slices, sesame seeds, nori') },
  { id: 'korean_bbq', prompt: NEA('white base, bulgogi beef strips, mozzarella, kimchi, sesame seeds') },
  { id: 'nori_sesame_bianca', prompt: NEA('white sesame oil base, mozzarella, black and white sesame seeds, nori strips') },
  { id: 'provencale', prompt: NEA('tomato base, black olives, anchovy fillets, herbes de Provence, mozzarella') },
  { id: 'pizza_lorraine', prompt: NEA('creme fraiche base, smoked lardons, emmental cheese, onions') },
  { id: 'perigourdine', prompt: NEA('white base, duck confit pieces, walnut halves, foie gras slice') },
  { id: 'pistou', prompt: NEA('green pistou pesto base, summer vegetables courgette tomato, goat cheese') },
  { id: 'alsacienne_choucroute', prompt: NEA('creme fraiche base, sauerkraut, smoked lardons, Munster cheese slices') },
  { id: 'basquaise', prompt: NEA('tomato base, Bayonne ham, Espelette red pepper, sheep cheese') },
  { id: 'lyonnaise', prompt: NEA('fromage blanc base, caramelised golden onions, smoked lardons, mozzarella') },
  { id: 'normande_camembert', prompt: NEA('creme fraiche base, camembert wedges melting, smoked lardons, apple slices') },
  { id: 'nutella_fraises', prompt: DES('Nutella chocolate spread base, fresh strawberry halves, powdered sugar') },
  { id: 'tarte_tatin_pizza', prompt: DES('caramelised apple slices in circle, golden caramel glaze, creme fraiche center') },
  { id: 'poire_chocolat', prompt: DES('dark chocolate cream base, pear slices fanned, mascarpone dollops') },
  { id: 'honey_fig_mascarpone', prompt: DES('white mascarpone base, halved figs, honey drizzle, crushed pistachios') },
  { id: 'speculoos_banana', prompt: DES('speculoos cookie spread base, banana slices, caramel drizzle') },
  { id: 'creme_brulee_pizza', prompt: DES('vanilla cream base, caramelised sugar crust golden brown crackled surface') },
  { id: 'crisommola', prompt: DES('white ricotta base, apricot halves, honey drizzle') },
  { id: 'ricotta_chestnut_honey', prompt: DES('fresh ricotta base, dark chestnut honey drizzle, toasted almond flakes') },
  { id: 'fragole_basilico', prompt: DES('white mascarpone base, fresh strawberry halves, basil leaves') },
  { id: 'cioccolato_peperoncino', prompt: DES('dark chocolate cream base, chilli flakes, sea salt') },
  { id: 'mela_cannella', prompt: DES('cream cheese base, caramelised apple slices, cinnamon powder, brown sugar') },
  { id: 'caramel_noisette', prompt: DES('salted caramel base, toasted hazelnut halves, vanilla cream dollops, sea salt flakes') },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { fs.unlink(filepath, () => {}); reject(err); });
  });
}

async function generateAll() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const total = PIZZAS.length;
  let generated = 0, skipped = 0, failed = [];

  console.log('\n🍕 Baker Hub Pizza Image Generator');
  console.log('📦 ' + total + ' pizzas | 💰 ~$' + (total * 0.04).toFixed(2) + ' | ⏱ ~' + Math.ceil(total * DELAY_MS / 60000) + ' min\n');

  for (let i = 0; i < PIZZAS.length; i++) {
    const pizza = PIZZAS[i];
    const filepath = path.join(OUTPUT_DIR, pizza.id + '.png');

    if (fs.existsSync(filepath)) {
      console.log('[' + (i+1) + '/' + total + '] ⏭  Skipping: ' + pizza.id);
      skipped++;
      continue;
    }

    try {
      console.log('[' + (i+1) + '/' + total + '] 🎨 Generating: ' + pizza.id + '...');
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: pizza.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'url',
      });
      await downloadImage(response.data[0].url, filepath);
      console.log('[' + (i+1) + '/' + total + '] ✅ ' + pizza.id + '.png');
      generated++;
    } catch (err) {
      console.error('[' + (i+1) + '/' + total + '] ❌ ' + pizza.id + ' — ' + err.message);
      failed.push(pizza.id);
    }

    if (i < PIZZAS.length - 1) await sleep(DELAY_MS);
  }

  console.log('\n✅ Done! Generated: ' + generated + ' | Skipped: ' + skipped + ' | Failed: ' + failed.length);
  if (failed.length) console.log('Failed: ' + failed.join(', '));
  console.log('💰 Total cost: ~$' + (generated * 0.04).toFixed(2));
}

generateAll().catch(console.error);