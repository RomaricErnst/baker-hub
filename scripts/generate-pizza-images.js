// scripts/generate-pizza-images.js
// Run: node scripts/generate-pizza-images.js

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OUTPUT_DIR = path.join(__dirname, '../public/pizzas');
const DELAY_MS = 4500;

// Short positive suffix — no negative rules, just describe what IS there
const SUFFIX = 'Soft warm lighting from above-left, gentle shadow directly beneath the pizza. Deep dark charcoal background with subtle warm reddish glow directly behind the pizza. The pizza sits directly on this dark surface. Nothing else in the image.';

const NEA = (t) => `A Neapolitan pizza slightly viewed from above at 30 degrees, centered. Puffy charred cornicione with leopard spots, thin center, organic shape. ${t} ${SUFFIX}`;
const ROMANA = (t) => `A Pizza Romana Tonda slightly viewed from above at 30 degrees, centered. Ultra-thin cracker-crisp flat base, no cornicione at all, paper-thin. ${t} ${SUFFIX}`;
const NY = (t) => `A New York style pizza slightly viewed from above at 30 degrees, centered. Large thin flat base, wide diameter, minimal crust lip at edge. ${t} ${SUFFIX}`;
const TEG = (t) => `A rectangular Roman Teglia pizza slightly viewed from above at 30 degrees, centered. Thick airy rectangular base, crispy bottom, generous height. ${t} ${SUFFIX}`;
const DET = (t) => `A rectangular Detroit style pizza slightly viewed from above at 30 degrees, centered. Very thick square base, cheese melted and caramelised crispy all the way to every single edge creating dark frico border on all four sides. ${t} ${SUFFIX}`;
const CHI = (t) => `A Chicago deep dish pizza slightly viewed from above at 30 degrees, centered. Extremely deep round pan, very tall buttery crust walls, chunky tomato sauce on top. ${t} ${SUFFIX}`;
const PAN = (t) => `A thick round pan pizza slightly viewed from above at 30 degrees, centered. Thick fluffy airy base, crispy bottom, visible crust height at edge. ${t} ${SUFFIX}`;
const DES = (t) => `A round dessert pizza slightly viewed from above at 30 degrees, centered. Round pizza dough base with visible crust edge — clearly a pizza, not a tart or pastry. ${t} ${SUFFIX}`;

// COOKING STATE NOTES used in prompts:
// BAKED ON = ingredient is cooked onto pizza, looks hot, melted, integrated
// ADDED COLD = ingredient placed on top after baking, looks fresh, cold, uncooked

const PIZZAS = [
  // ── Classic Italian ──
  { id: 'margherita', prompt: NEA('Toppings baked on: bright red tomato sauce base, 5 soft irregular fior di latte mozzarella discs melted, 2 fresh green basil leaves placed after baking.') },
  { id: 'marinara', prompt: NEA('Toppings baked on: rich red tomato sauce base, whole garlic cloves, dried oregano. No cheese at all.') },
  { id: 'diavola', prompt: NEA('Toppings baked on: red tomato base, overlapping dark spicy salami rounds, mozzarella melted, chilli flakes.') },
  { id: 'quattro_formaggi', prompt: NEA('Toppings baked on: white cream base, four melted cheeses in distinct patches — pale mozzarella, golden gruyere, white ricotta, blue gorgonzola. No meat.') },
  { id: 'capricciosa', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, cooked ham, sliced mushrooms, black olives, artichoke wedges.') },
  { id: 'napoli', prompt: NEA('Toppings baked on: red tomato base, anchovy fillets, capers, black olives, mozzarella melted.') },
  { id: 'pepperoni', prompt: NEA('Toppings baked on: red tomato base, generous pepperoni slices curled and cupped from oven heat, mozzarella melted underneath.') },
  { id: 'nduja_mozzarella', prompt: NEA('Toppings baked on: red tomato base, orange-red nduja spread in irregular melted dollops, white mozzarella discs melted.') },
  { id: 'tonno_cipolla', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, white onion rings softened. Tuna chunks added cold after baking — they look raw/canned not cooked.') },
  { id: 'smoked_salmon_creme', prompt: NEA('Base baked: white crème fraîche base, no tomato. Toppings added cold after baking: pink smoked salmon slices draped, capers, fresh dill fronds.') },
  { id: 'ortolana', prompt: NEA('Toppings baked on: red tomato base, grilled courgette, aubergine, red and yellow peppers, mozzarella melted. No meat.') },
  { id: 'funghi_tartufo', prompt: NEA('Toppings baked on: white truffle cream base, dark forest mushrooms cooked, mozzarella melted. Truffle shavings added cold after baking. No meat.') },
  { id: 'patate_rosmarino', prompt: NEA('Toppings baked on: white olive oil base, thin potato slices cooked golden and overlapping, fresh rosemary sprigs, sea salt. No cheese, no meat.') },
  { id: 'bianca_ricotta_spinaci', prompt: NEA('Toppings baked on: white ricotta base, dark green wilted spinach, ricotta dollops melted slightly. No meat.') },
  { id: 'truffle_bianca', prompt: NEA('Toppings baked on: white cream base, mozzarella melted. Truffle shavings added cold after baking. No meat.') },
  { id: 'prosciutto_rucola', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted. Added cold after baking: thin pink prosciutto slices draped loosely, fresh green rocket leaves. No round salami.') },
  { id: 'burrata_prosciutto', prompt: NEA('Toppings baked on: red tomato base. Added cold after baking: one whole burrata placed in center oozing slightly, pink prosciutto crudo slices draped around.') },
  { id: 'fig_gorgonzola', prompt: NEA('Toppings baked on: white olive oil base, gorgonzola melted. Added after: halved fresh figs showing pink inside, honey drizzle, walnut halves. No meat.') },
  { id: 'pear_walnut_gorgonzola', prompt: NEA('Toppings baked on: white base, gorgonzola melted. Added after: pear slices fanned, walnut halves, honey drizzle. No meat.') },
  { id: 'bbq_chicken', prompt: NEA('Toppings baked on: dark BBQ sauce base, grilled chicken pieces cooked, red onion softened, mozzarella melted. No salami.') },
  { id: 'speck_brie', prompt: NEA('Toppings baked on: white base, brie wedges melted, speck ham slices, rosemary. No round salami.') },
  { id: 'tarte_flambee', prompt: NEA('Toppings baked on: white crème fraîche base, smoked lardons cooked, white onion slices softened. No tomato, no salami.') },
  { id: 'raclette_pommes', prompt: NEA('Toppings baked on: white base, raclette cheese fully melted, potato slices cooked, smoked lardons cooked. No salami.') },
  { id: 'chevre_miel', prompt: NEA('Toppings baked on: white base, goat cheese rounds softened. Added after: honey drizzle, fresh thyme sprigs, walnut halves. No salami, no pepperoni, no cured meat rounds.') },
  { id: 'andouille_moutarde', prompt: NEA('Toppings baked on: mustard cream base, andouille sausage slices cooked, onions softened, emmental melted. No round pepperoni.') },
  { id: 'maroilles_oignons', prompt: NEA('Toppings baked on: crème fraîche base, maroilles orange-rind cheese melted, golden caramelised onions. No salami.') },
  { id: 'jambon_espelette', prompt: NEA('Toppings baked on: white base, cheese melted, Bayonne ham slices, red Espelette pepper flakes. No round salami.') },
  { id: 'camembert_pommes', prompt: NEA('Toppings baked on: white base, camembert wedges melted, apple slices softened, smoked lardons cooked. No salami.') },
  { id: 'tartiflette_pizza', prompt: NEA('Toppings baked on: cream base, reblochon cheese fully melted, potato slices cooked, smoked lardons cooked, onions. No salami.') },
  { id: 'la_reine', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, cooked ham, mushrooms, black olives. No round salami.') },
  { id: 'la_royale', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, cooked ham, salami slices, red and green peppers.') },
  { id: 'la_paysanne', prompt: NEA('Toppings baked on: crème fraîche base, smoked lardons cooked, potato slices cooked, onions softened. No salami.') },
  { id: 'quatre_saisons', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted. Four distinct quarters: artichoke top-left, ham top-right, black olives bottom-left, mushrooms bottom-right.') },
  { id: 'margherita_sbagliata', prompt: NEA('Baked on: white base, mozzarella baked in, no tomato baked. Added cold after: fresh crushed tomato dollops on top, basil. No meat.') },
  { id: 'cosacca', prompt: NEA('Toppings baked on: red tomato base, grated pecorino, basil, olive oil drizzle. No mozzarella, no meat.') },
  { id: 'salsiccia_friarielli', prompt: NEA('Toppings baked on: white olive oil base, crumbled Italian sausage cooked, dark green broccoli rabe wilted, fior di latte melted.') },
  { id: 'provola_pepe', prompt: NEA('Toppings baked on: white base, smoked provola melted across surface, cracked black pepper. No meat.') },
  { id: 'acciughe_pomodorini', prompt: NEA('Toppings baked on: red tomato base, anchovy fillets cooked, halved cherry tomatoes roasted, mozzarella melted, capers.') },
  { id: 'melanzane_parmigiana', prompt: NEA('Toppings baked on: red tomato base, layered aubergine slices cooked, parmesan grated, basil, mozzarella melted. No meat.') },
  { id: 'zucca_provola', prompt: NEA('Toppings baked on: white base, orange pumpkin slices cooked, smoked provola melted, pumpkin seeds. No meat.') },
  { id: 'boscaiola', prompt: NEA('Toppings baked on: red tomato base, dark forest mushrooms cooked, crumbled Italian sausage cooked, mozzarella melted.') },
  { id: 'bismarck', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, cooked ham, mushrooms. Whole egg baked in center — yolk still golden and slightly runny.') },
  { id: 'pugliese', prompt: NEA('Toppings baked on: red tomato base, black olives, capers, red onion softened, mozzarella melted. No meat.') },
  { id: 'prosciutto_funghi', prompt: NEA('Toppings baked on: red tomato base, mozzarella melted, cooked ham, mushrooms sliced cooked. No round salami.') },
  { id: 'tonno_cipolla_red', prompt: NEA('Baked on: red tomato base, mozzarella melted, red onion rings softened. Tuna flakes added cold after baking — sitting on top uncooked. No meat.') },
  { id: 'piennolo', prompt: NEA('Toppings baked on: white olive oil base, Vesuvian cherry tomatoes halved and roasted, basil, sea salt. No cheese, no meat, nothing else.') },
  { id: 'funghi_salsiccia', prompt: NEA('Toppings baked on: red tomato base, earthy mushrooms cooked, crumbled sausage cooked, mozzarella melted.') },
  { id: 'salmone_rucola', prompt: NEA('Baked on: white cream base. Added cold after baking: pink smoked salmon slices draped, fresh green rocket leaves, capers. No meat.') },
  { id: 'acciughe_burro', prompt: NEA('Toppings baked on: white butter-enriched base, anchovy fillets cooked onto base, mozzarella melted. No salami.') },
  { id: 'pollo_pesto', prompt: NEA('Toppings baked on: green pesto base, grilled chicken pieces cooked, mozzarella melted, cherry tomatoes roasted. No salami.') },
  { id: 'genovese', prompt: NEA('Toppings baked on: green pesto base, thin potato slices cooked, green beans cooked, mozzarella melted. No meat.') },
  { id: 'polpette', prompt: NEA('Toppings baked on: red tomato base, large round meatballs baked in (big irregular spheres, not flat rounds), mozzarella melted, basil.') },
  { id: 'diavola_burrata', prompt: NEA('Baked on: red tomato base, spicy salami, mozzarella melted. Added cold after baking: one whole burrata placed on top center.') },
  { id: 'pistadella', prompt: NEA('Baked on: white base, fior di latte melted, green pistachio pesto swirl. Added cold after baking: large mortadella slices draped (pink deli meat with white fat specks, not salami).') },
  { id: 'stracciatella_datterini', prompt: NEA('Baked on: red tomato base, small datterini tomatoes halved and roasted. Added cold after: white stracciatella cheese dollops sitting on top unmelted. No meat.') },
  { id: 'nduja_burrata', prompt: NEA('Baked on: orange-red nduja spread base. Added cold after baking: one whole burrata placed in center, chilli oil drizzle. No round salami.') },
  { id: 'tartufo_fior', prompt: NEA('Baked on: white base, fior di latte mozzarella melted. Added cold after: dark truffle shavings, truffle oil drizzle. No meat.') },
  { id: 'lardo_rosmarino', prompt: NEA('Toppings baked on: white base, very thin translucent white lardo slices melting on hot pizza, rosemary sprigs, sea salt.') },
  { id: 'scarpetta', prompt: NEA('Toppings baked on: white base, buffalo mozzarella, Grana Padano fondue swirl, small tomato compote dots. No salami.') },
  { id: 'caponata_pizza', prompt: NEA('Toppings baked on: white base, Sicilian caponata mixture cooked — aubergine, peppers, capers, olives — mozzarella melted. No meat.') },
  { id: 'soppressata_fichi', prompt: NEA('Baked on: white base, soppressata salami baked, mozzarella melted. Added after: halved fresh figs, honey drizzle.') },
  { id: 'guanciale_pecorino', prompt: NEA('Toppings baked on: red tomato base, guanciale strips cooked (irregular strips not rounds), pecorino grated, black pepper.') },
  { id: 'honey_pecorino', prompt: NEA('Baked on: white base, pecorino grated and melted. Added after: golden honey drizzle, cracked black pepper. No meat.') },
  { id: 'burrata_prosciutto_gourmet', prompt: NEA('Baked on: red tomato base. Added cold after: one whole burrata placed center, thin prosciutto crudo draped, fresh basil. No round salami.') },
  { id: 'porcini_stracciatella', prompt: NEA('Baked on: white base, dark porcini mushrooms cooked, truffle oil. Added cold after: stracciatella dollops sitting on top unmelted. No meat.') },
  { id: 'wagyu_onion', prompt: NEA('Baked on: white base, golden caramelised onions, mozzarella melted. Added after: premium thin wagyu beef slices draped. No round pepperoni.') },
  { id: 'crudo_parma_stracciatella', prompt: NEA('Baked on: red tomato base, mozzarella melted. Added cold after: Parma ham thin slices draped, stracciatella dollops, fresh basil.') },
  { id: 'norma', prompt: NEA('Toppings baked on: red tomato base, fried aubergine slices cooked, mozzarella melted, basil. Added after: grated ricotta salata (white crumbly cheese) on top. No meat.') },
  { id: 'carciofi_romana', prompt: NEA('Toppings baked on: white olive oil base, artichoke quarters cooked, garlic slices, fresh mint. No meat.') },
  { id: 'fiori_zucca_alici', prompt: NEA('Toppings baked on: white base, yellow courgette flowers baked, anchovy fillets cooked onto base, mozzarella melted. No salami.') },
  { id: 'amatriciana_pizza', prompt: NEA('Toppings baked on: red tomato base, guanciale strips cooked and slightly crispy (irregular strips), pecorino grated, black pepper.') },
  { id: 'carbonara_pizza', prompt: NEA('Toppings baked on: pale yellow egg cream base (not tomato), guanciale strips cooked (not rounds), pecorino grated, cracked black pepper.') },
  { id: 'cacio_pepe_pizza', prompt: NEA('Toppings baked on: white pecorino cream base, cracked black pepper generously across surface. Nothing else at all. No meat.') },
  { id: 'gricia_pizza', prompt: NEA('Toppings baked on: white olive oil base, guanciale strips cooked (not rounds), pecorino grated, black pepper. No tomato.') },
  { id: 'bianca_rosmarino', prompt: NEA('Baked on: white olive oil base, rosemary sprigs pressed into dough, sea salt crystals. Nothing else. No cheese, no meat.') },
  { id: 'bresaola_rucola_pizza', prompt: NEA('Baked on: white base, mozzarella melted. Added cold after: dark red bresaola thin slices draped (cured beef, not salami), fresh green rocket, parmesan shavings.') },
  { id: 'speck_stracchino', prompt: NEA('Toppings baked on: white stracchino cream base, speck ham slices cooked, mozzarella melted. No round salami.') },
  { id: 'indivia_gorgonzola', prompt: NEA('Toppings baked on: white base, pale endive leaves wilted, gorgonzola melted, walnut halves. No meat.') },
  { id: 'prosciutto_stracciatella_romana', prompt: NEA('Baked on: white base. Added cold after: cold stracciatella dollops sitting on top unmelted, thin prosciutto ham draped. No round salami.') },
  { id: 'patata_rosmarino_romana', prompt: ROMANA('Baked on: white olive oil base, ultra-thin potato slices cooked golden and overlapping, rosemary, sea salt. No meat, no cheese.') },
  { id: 'verdure_grigliate_burrata', prompt: NEA('Baked on: white base, grilled courgette, red and yellow peppers, aubergine cooked. Added cold after: one whole burrata placed in center. No meat.') },
  { id: 'alici_fresche_romana', prompt: NEA('Toppings baked on: white base, fresh anchovy fillets cooked, halved cherry tomatoes roasted, capers. No salami.') },
  { id: 'porcini_pecorino_romana', prompt: NEA('Toppings baked on: white base, dark porcini mushrooms cooked, pecorino grated and melted, black pepper. No meat.') },

  // ── Roman Teglia ──
  { id: 'teglia_patata_provola', prompt: TEG('Baked on: white olive oil base, overlapping potato slices cooked golden, smoked provola melted, rosemary. No meat.') },
  { id: 'teglia_funghi_salsiccia', prompt: TEG('Baked on: red tomato base, mushrooms cooked, crumbled sausage cooked (not round pepperoni), mozzarella melted.') },
  { id: 'teglia_prosciutto_cotto', prompt: TEG('Baked on: red tomato base, cooked ham slices, mushrooms cooked, mozzarella melted. No round salami.') },
  { id: 'teglia_zucchine_fiori', prompt: TEG('Baked on: white base, courgette slices cooked, yellow courgette flowers baked, mozzarella melted. No meat.') },
  { id: 'teglia_mortadella_pistacchio', prompt: TEG('Baked on: white base, mozzarella melted. Added cold after: large mortadella slices draped (pink deli meat, not salami), green pistachio crumble, stracciatella dollops.') },
  { id: 'teglia_tonno_cipolla', prompt: TEG('Baked on: red tomato base, red onion rings softened, mozzarella melted. Added cold after: tuna chunks sitting on top uncooked. No meat.') },
  { id: 'teglia_4_formaggi', prompt: TEG('Baked on: white base, four melted cheeses in distinct areas. No meat.') },
  { id: 'teglia_speck_brie', prompt: TEG('Baked on: white base, brie melted, speck ham slices, herbs. No round salami.') },
  { id: 'teglia_verdure', prompt: TEG('Baked on: red tomato base, grilled peppers, courgette, aubergine cooked, mozzarella melted. No meat.') },
  { id: 'teglia_nduja_stracciatella', prompt: TEG('Baked on: orange nduja spread base. Added cold after: stracciatella dollops sitting unmelted, chilli oil drizzle. No round salami.') },

  // ── New York ──
  { id: 'ny_pepperoni_slice', prompt: NY('Baked on: red tomato base, pepperoni slices curled and cupped from oven heat, mozzarella melted.') },
  { id: 'hot_honey_pepperoni', prompt: NY('Baked on: red tomato base, crispy pepperoni cups, mozzarella melted. Added after: hot honey drizzle on top.') },
  { id: 'white_clam_apizza', prompt: NY('Baked on: white olive oil base, chopped clams cooked, garlic slices, oregano. No tomato, no cheese.') },
  { id: 'ny_sausage_peppers', prompt: NY('Baked on: red tomato base, crumbled sausage cooked, green and red bell peppers cooked, mozzarella melted. Not round pepperoni.') },
  { id: 'vodka_pizza', prompt: NY('Baked on: pink tomato-cream vodka sauce base, mozzarella melted, basil. No meat.') },
  { id: 'ny_white_pizza', prompt: NY('Baked on: white garlic oil base, mozzarella melted, ricotta dollops. No tomato, no meat.') },
  { id: 'buffalo_chicken', prompt: NY('Baked on: white base, orange buffalo sauce chicken pieces cooked, mozzarella melted. Added after: blue cheese crumbles, celery. No salami.') },
  { id: 'california_bbq_chicken', prompt: NY('Baked on: dark BBQ sauce base, chicken pieces cooked, red onion, mozzarella melted. Added after: fresh coriander. No salami.') },
  { id: 'smoked_salmon_cream_cheese', prompt: NY('Baked on: white cream cheese base. Added cold after baking: pink smoked salmon draped, capers, dill fronds. No meat.') },
  { id: 'ny_clam_garlic', prompt: NY('Baked on: white garlic base, chopped clams cooked, mozzarella melted, parsley. No meat.') },
  { id: 'ny_margherita_bufala', prompt: NY('Baked on: red tomato base, buffalo mozzarella melted, basil. No meat.') },
  { id: 'ny_diavola', prompt: NY('Baked on: red tomato base, spicy salami slices baked, mozzarella melted.') },

  // ── Detroit ──
  { id: 'detroit_red_top', prompt: DET('Baked: brick cheese melted and caramelised crispy frico to every edge. Pepperoni baked under cheese. Three parallel stripes of chunky tomato sauce poured on top as final layer — sauce is ON TOP not underneath.') },
  { id: 'detroit_white', prompt: DET('Baked: brick cheese melted and caramelised crispy frico to every edge. White garlic base, herbs baked in. No tomato.') },
  { id: 'detroit_sausage', prompt: DET('Baked: brick cheese caramelised frico edges, red tomato base, crumbled sausage cooked, mushrooms cooked on top.') },
  { id: 'detroit_veggie', prompt: DET('Baked: brick cheese caramelised frico edges, roasted red and yellow peppers, golden caramelised onions on top. No meat.') },

  // ── Chicago ──
  { id: 'chicago_deep_dish', prompt: CHI('Baked: thick buttery crust walls. Sausage layer buried inside under cheese. Chunky tomato sauce generously covering the entire top surface — visible as the top layer.') },

  // ── Pan ──
  { id: 'pan_margherita', prompt: PAN('Baked on: red tomato base, mozzarella melted, fresh basil added after. No meat.') },
  { id: 'pan_pepperoni_hot_honey', prompt: PAN('Baked on: red tomato base, pepperoni cups curled from heat, mozzarella melted. Added after: hot honey drizzle.') },
  { id: 'pan_bbq_chicken', prompt: PAN('Baked on: dark BBQ sauce base, chicken pieces cooked, red onion, mozzarella melted. No salami.') },
  { id: 'pan_nduja_burrata', prompt: PAN('Baked on: orange nduja spread base. Added cold after: one whole burrata center, chilli oil drizzle. No round salami.') },
  { id: 'pan_4_formaggi', prompt: PAN('Baked on: white base, four melted cheeses in distinct areas. No meat.') },

  // ── Spanish ──
  { id: 'jamon_manchego', prompt: NEA('Baked on: white base, manchego cheese melted. Added cold after: silky Iberico ham thin slices draped (not round salami), olive oil drizzle.') },
  { id: 'sobrasada_miel', prompt: NEA('Baked on: white base, orange-red sobrasada spread dollops melting, mozzarella. Added after: honey drizzle.') },
  { id: 'escalivada', prompt: NEA('Baked on: white base, fire-roasted aubergine strips, red pepper strips, onion, olive oil. No meat, no cheese.') },
  { id: 'chorizo_padron', prompt: NEA('Baked on: red tomato base, chorizo slices cooked, whole green Padrón peppers, mozzarella melted.') },
  { id: 'pulpo_gallega', prompt: NEA('Baked on: white base, potato slices cooked. Added after: octopus tentacle pieces cooked and placed, smoked paprika powder, olive oil.') },

  // ── Middle Eastern / Asian ──
  { id: 'halloumi_zaatar', prompt: NEA('Baked on: white olive oil base with zaatar herb blend, grilled halloumi slices cooked golden, cherry tomatoes roasted. No meat.') },
  { id: 'zaatar_labneh', prompt: NEA('Baked on: white base generously coated with zaatar herb blend and sesame seeds. Added cold after: labneh white cheese dollops, olive oil. No meat.') },
  { id: 'merguez_harissa', prompt: NEA('Baked on: red harissa base, merguez sausage diagonal slices cooked, whole egg baked in center with runny yolk, mozzarella.') },
  { id: 'miso_funghi', prompt: NEA('Baked on: pale beige white miso cream base, shiitake and oyster mushrooms cooked, mozzarella melted. No meat.') },
  { id: 'mentaiko_cream', prompt: NEA('Baked on: pale pink mentaiko cream base, mozzarella melted, spring onion slices softened, nori strips. No meat.') },
  { id: 'teriyaki_chicken', prompt: NEA('Baked on: white base, teriyaki-glazed chicken pieces cooked brown-glazed, mozzarella melted, sesame seeds, spring onion slices. No salami.') },
  { id: 'salmon_wasabi', prompt: NEA('Baked on: pale green wasabi cream base. Added cold after: smoked salmon slices draped, sesame seeds, nori strips. No meat.') },
  { id: 'korean_bbq', prompt: NEA('Baked on: white base, mozzarella melted. Added cold after: thin bulgogi beef strips (marinated thin beef, not rounds), kimchi, sesame seeds.') },
  { id: 'nori_sesame_bianca', prompt: NEA('Baked on: white sesame oil base, mozzarella melted, black and white sesame seeds, nori strips baked. No meat.') },

  // ── French regional ──
  { id: 'provencale', prompt: NEA('Baked on: red tomato base, anchovy fillets cooked, black olives, herbes de Provence, mozzarella melted. No salami.') },
  { id: 'lorraine_pizza', prompt: NEA('Baked on: crème fraîche base, smoked lardons cooked, emmental melted, onions softened. No tomato, no salami.') },
  { id: 'perigourdine', prompt: NEA('Baked on: white base, duck confit shredded pieces cooked, walnut halves. Added cold after: foie gras slice placed on top. No round salami.') },
  { id: 'pistou_pizza', prompt: NEA('Baked on: green pistou pesto base, courgette and tomato cooked, goat cheese softened. No meat.') },
  { id: 'alsacienne_choucroute', prompt: NEA('Baked on: crème fraîche base, pale sauerkraut shredded cabbage, smoked lardons cooked, Munster cheese melted. No round salami.') },
  { id: 'basquaise', prompt: NEA('Baked on: red tomato base, Bayonne ham slices, Espelette red pepper, Ossau-Iraty sheep cheese melted. No round salami.') },
  { id: 'lyonnaise', prompt: NEA('Baked on: white fromage blanc base, golden caramelised onions, smoked lardons cooked, mozzarella melted. No salami.') },
  { id: 'normandie_camembert', prompt: NEA('Baked on: crème fraîche base, camembert wedges fully melted, smoked lardons cooked, apple slices softened. No salami.') },

  // ── New Kosher ──
  { id: 'jerusalem', prompt: NEA('Baked on: red tomato base, roasted aubergine chunks cooked, chickpeas. Added cold after: tahini drizzle, fresh parsley, olive oil. No meat, no cheese.') },
  { id: 'shakshuka', prompt: NEA('Baked on: spiced red tomato base, roasted red pepper strips. Two whole eggs baked in until just set, yolks visible. Added cold after: crumbled feta on top. No meat.') },

  // ── Desserts ──
  { id: 'nutella_fraises', prompt: DES('Baked: pale golden pizza dough with visible crust. Added cold after baking: Nutella chocolate spread across surface, fresh strawberry halves on top, light powdered sugar dusted.') },
  { id: 'tarte_tatin_pizza', prompt: DES('Baked on pizza dough: caramelised apple slices arranged in overlapping circle, golden caramel glaze. Small crème fraîche dollop added cold in center. Visible pizza crust edge.') },
  { id: 'poire_chocolat', prompt: DES('Baked: pale golden pizza dough. Added after: dark chocolate cream spread, pear slices fanned, mascarpone dollops. Visible crust edge.') },
  { id: 'honey_fig_mascarpone', prompt: DES('Baked: pale golden pizza dough. Added cold after: white mascarpone spread, halved fresh figs, honey drizzle, crushed pistachios. Visible crust edge.') },
  { id: 'speculoos_banana', prompt: DES('Baked: pale golden pizza dough. Added cold after: speculoos cookie spread (caramel-brown), fresh banana slices, caramel drizzle. Visible crust edge.') },
  { id: 'creme_brulee_pizza', prompt: DES('Baked: pale golden pizza dough with vanilla cream. Caramelised sugar crust torched on top — golden-brown crackled glassy surface covering entire top. Visible crust edge. Not a ramekin.') },
  { id: 'crisommola', prompt: DES('Baked: pale golden pizza dough, white ricotta spread. Added after: apricot halves arranged, honey drizzle. Visible crust edge.') },
  { id: 'ricotta_miele_castagne', prompt: DES('Baked: pale golden pizza dough, fresh ricotta spread. Added after: dark chestnut honey drizzle, toasted almond flakes. Visible crust edge.') },
  { id: 'fragole_basilico', prompt: DES('Baked: pale golden pizza dough, white mascarpone spread. Added cold after: fresh strawberry halves, small fresh basil leaves. Visible crust edge.') },
  { id: 'cioccolato_peperoncino', prompt: DES('Baked: pale golden pizza dough. Added after: dark chocolate cream spread, red chilli flakes, sea salt flakes. Visible crust edge.') },
  { id: 'mela_cannella', prompt: DES('Baked: pale golden pizza dough, cream cheese spread. Added after: caramelised apple slices arranged, cinnamon powder dusted. Visible crust edge.') },
  { id: 'caramel_noisette', prompt: DES('Baked: pale golden pizza dough. Added after: golden-amber salted caramel spread, toasted hazelnut halves, vanilla cream dollops, sea salt flakes. Visible crust edge.') },
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
  console.log('💰 ~$' + (generated * 0.04).toFixed(2));
}

generateAll().catch(console.error);