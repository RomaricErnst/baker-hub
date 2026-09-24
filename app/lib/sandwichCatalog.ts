export type SandwichFamily = 'baguette' | 'focaccia' | 'bagel' | 'pita' | 'greek_pita' | 'kebab_bread' | 'batbout' | 'laffa' | 'piadina' | 'pan_bagnat' | 'ciabatta' | 'panuozzo' | 'tartine' | 'pain_mie';
export type SandwichText = { fr: string; en: string };
export type SandwichAllergen = 'gluten' | 'milk' | 'egg' | 'fish' | 'sesame' | 'nuts' | 'mustard' | 'soy';
export interface SandwichIngredient { id: string; name: SandwichText; kcalPer100g: number; allergens: SandwichAllergen[]; vegetarian: boolean; category: 'vegetables' | 'protein' | 'dairy' | 'pantry' | 'bread'; source: string; referenceFood: string; provenance: 'generic-food-estimate'; }
export interface SandwichPortion { ingredientId: string; grams: number; optionalGrams?: number; }
export interface SandwichStep { id: string; title: SandwichText; instruction: SandwichText; minutes: number; phase: 'prep' | 'cook' | 'assemble' | 'chill'; }
export interface SandwichRecipe { id: string; familyId: SandwichFamily; name: SandwichText; kind: 'classic' | 'inspired'; lighter: boolean; vegetarian: boolean; ingredients: SandwichPortion[]; steps: SandwichStep[]; allergens: SandwichAllergen[]; image: string; breadGrams: number; breadSlices?: number; sourceIds: string[]; }
export interface SandwichFamilyInfo { id: SandwichFamily; name: SandwichText; image: string; breadGrams: number; breadKcalPer100g: number; comparisonKcal: number; }
const text = (fr: string, en: string): SandwichText => ({fr, en});
const family = (id: SandwichFamily, fr: string, en: string, breadGrams: number, breadKcalPer100g: number, comparisonKcal: number): SandwichFamilyInfo => ({id,name:text(fr,en),image:`/images/approved/bread/${id}-rustic.webp`,breadGrams,breadKcalPer100g,comparisonKcal});
export const SANDWICH_FAMILIES: SandwichFamilyInfo[] = [
  {...family('tartine','Pain en tranches','Sliced bread',60,250,350),image:'/images/approved/bread/campagne-rustic.webp'},
  family('pain_mie','Pain de mie','Sandwich loaf',60,265,650),
  family('baguette','Baguette','Baguette',100,275,650), family('focaccia','Focaccia','Focaccia',100,300,750),
  family('bagel','Bagel','Bagel',95,270,650), family('pita','Pita à poche','Pocket pita',80,275,650),
  family('greek_pita','Pita grecque','Greek pita',85,290,700), family('kebab_bread','Pain kebab','Kebab bread',100,275,750),
  family('batbout','Batbout','Batbout',85,260,650), family('laffa','Laffa','Laffa',100,280,750),
  family('piadina','Piadina','Piadina',90,330,750), family('pan_bagnat','Pain à pan bagnat','Pan bagnat roll',100,275,700),
  family('ciabatta','Ciabatta','Ciabatta',100,270,700), family('panuozzo','Panuozzo','Panuozzo',110,270,800),
];
const USDA = 'https://fdc.nal.usda.gov/';
const CIQUAL = 'https://ciqual.anses.fr/';
type IngredientRow = [string,string,string,number,SandwichIngredient['category'],SandwichAllergen[]?,boolean?,string?];
const ingredientRows: IngredientRow[] = [
 ['tomato','Tomate','Tomato',18,'vegetables'],['lettuce','Laitue','Lettuce',15,'vegetables'],['rocket','Roquette','Rocket',25,'vegetables'],
 ['cucumber','Concombre','Cucumber',15,'vegetables'],['carrot','Carotte','Carrot',41,'vegetables'],['cabbage','Chou rouge','Red cabbage',31,'vegetables'],
 ['onion','Oignon rouge','Red onion',40,'vegetables'],['pepper','Poivron','Bell pepper',26,'vegetables'],['courgette','Courgette','Courgette',17,'vegetables'],
 ['aubergine','Aubergine','Aubergine',25,'vegetables'],['mushroom','Champignon','Mushroom',22,'vegetables'],['spinach','Épinards','Spinach',23,'vegetables'],
 ['avocado','Avocat','Avocado',160,'vegetables'],['radish','Radis','Radish',16,'vegetables'],['fennel','Fenouil','Fennel',31,'vegetables'],
 ['basil','Basilic','Basil',23,'vegetables'],['parsley','Persil','Parsley',36,'vegetables'],['mint','Menthe','Mint',44,'vegetables'],['garlic','Ail','Garlic',149,'vegetables'],
 ['lemon','Jus de citron','Lemon juice',22,'pantry'],['olive_oil','Huile d’olive','Olive oil',884,'pantry'],['butter','Beurre','Butter',717,'dairy',['milk']],
 ['bacon_cooked','Bacon déjà cuit prêt à consommer','Ready-to-eat cooked bacon',541,'protein',[],false],
 ['milk','Lait demi-écrémé','Semi-skimmed milk',47,'dairy',['milk']],
 ['wheat_flour','Farine de blé pour la béchamel','Wheat flour for béchamel',364,'pantry',['gluten']],
 ['nutmeg','Noix de muscade moulue','Ground nutmeg',525,'pantry'],
 ['ham','Jambon blanc cuit','Cooked ham',145,'protein',[],false],['chicken','Blanc de poulet déjà cuit','Cooked chicken breast',165,'protein',[],false],
 ['chicken_raw','Blanc de poulet cru sans peau ni os','Raw boneless skinless chicken breast',120,'protein',[],false],
 ['turkey','Dinde rôtie déjà cuite','Cooked roast turkey',135,'protein',[],false],['roast_beef','Rôti de bœuf déjà cuit','Cooked roast beef',175,'protein',[],false],
 ['mortadella','Mortadelle sans pistache','Mortadella without pistachios',311,'protein',[],false],['prosciutto','Jambon cru','Prosciutto',270,'protein',[],false],
 ['salami','Salami','Salami',407,'protein',[],false],['porchetta','Porchetta déjà cuite','Cooked porchetta',330,'protein',[],false],
 ['beef_kebab','Émincé de kebab de bœuf déjà cuit','Cooked beef kebab slices',250,'protein',[],false],['lamb','Agneau rôti déjà cuit','Cooked roast lamb',258,'protein',[],false],
 ['sausage','Saucisse de porc déjà cuite','Cooked pork sausage',300,'protein',[],false],['pancetta','Pancetta déjà cuite','Cooked pancetta',460,'protein',[],false],
 ['tuna','Thon au naturel égoutté','Drained tuna in water',116,'protein',['fish'],false],['smoked_salmon','Saumon fumé prêt à consommer','Ready-to-eat smoked salmon',180,'protein',['fish'],false],
 ['sardine','Sardines à l’huile égouttées','Drained sardines in oil',208,'protein',['fish'],false],['anchovy','Anchois à l’huile égouttés','Drained anchovies in oil',210,'protein',['fish'],false],
 ['egg','Œuf dur écalé','Peeled hard-boiled egg',155,'protein',['egg']],['chickpea','Pois chiches cuits égouttés','Drained cooked chickpeas',139,'protein'],
 ['egg_to_poach','Œuf à pocher','Egg for poaching',143,'protein',['egg']],
 ['pomegranate','Graines de grenade','Pomegranate seeds',83,'vegetables'],
 ['salt','Sel','Salt',0,'pantry'],['black_pepper','Poivre noir','Black pepper',251,'pantry'],
 ['white_bean','Haricots blancs cuits égouttés','Drained cooked white beans',114,'protein'],['falafel','Falafels déjà cuits','Cooked falafel',333,'protein',[],true],
 ['hummus','Houmous au tahini','Tahini hummus',237,'pantry',['sesame']],['tahini','Tahini','Tahini',595,'pantry',['sesame']],
 ['mozzarella','Mozzarella égouttée','Drained mozzarella',250,'dairy',['milk']],['burrata','Burrata égouttée','Drained burrata',300,'dairy',['milk']],
 ['cream_cheese','Fromage frais à tartiner','Cream cheese',240,'dairy',['milk']],['ricotta','Ricotta','Ricotta',174,'dairy',['milk']],
 ['feta','Feta','Feta',265,'dairy',['milk']],['goat_cheese','Fromage de chèvre','Goat cheese',280,'dairy',['milk']],
 ['emmental','Emmental','Emmental',380,'dairy',['milk']],['brie','Brie','Brie',334,'dairy',['milk']],
 ['provolone','Provolone','Provolone',351,'dairy',['milk']],['squacquerone','Squacquerone','Squacquerone',280,'dairy',['milk']],
 ['yogurt','Yaourt nature','Plain yogurt',61,'dairy',['milk']],['tzatziki','Tzatziki','Tzatziki',90,'dairy',['milk']],
 ['mustard','Moutarde','Mustard',66,'pantry',['mustard']],['mayonnaise','Mayonnaise','Mayonnaise',680,'pantry',['egg','mustard']],
 ['pesto','Pesto au basilic','Basil pesto',450,'pantry',['milk','nuts'],false],['olive','Olives dénoyautées','Pitted olives',145,'pantry'],
 ['pickle','Cornichons égouttés','Drained gherkins',12,'pantry',['mustard']],['caper','Câpres égouttées','Drained capers',23,'pantry'],
 ['artichoke','Cœurs d’artichaut au naturel égouttés','Drained artichoke hearts in water',47,'vegetables'],
 ['broad_bean','Fèves fraîches tendres écossées','Shelled tender fresh broad beans',88,'vegetables'],['pistachio','Pistaches décortiquées','Shelled pistachios',562,'pantry',['nuts']],
 ['walnut','Noix décortiquées','Shelled walnuts',654,'pantry',['nuts']],['honey','Miel','Honey',304,'pantry'],
 ['fig','Figue fraîche','Fresh fig',74,'vegetables'],['apple','Pomme','Apple',52,'vegetables'],['cumin','Cumin moulu','Ground cumin',375,'pantry'],
 ['paprika','Paprika doux','Sweet paprika',282,'pantry'],['oregano','Origan séché','Dried oregano',265,'pantry'],
 ['chili','Harissa','Harissa',100,'pantry'],['tomato_sauce','Sauce tomate','Tomato sauce',40,'pantry'],
];
/** Rounded generic food estimates, not brand-specific label values. See docs/SANDWICH-RECIPES.md. */
export const SANDWICH_INGREDIENTS: Record<string,SandwichIngredient> = Object.fromEntries(ingredientRows.map(([id,fr,en,kcalPer100g,category,allergens=[],vegetarian=true]) => [id,{id,name:text(fr,en),kcalPer100g,category,allergens,vegetarian,source:category==='dairy'||['porchetta','beef_kebab','squacquerone'].includes(id)?CIQUAL:USDA,referenceFood:en,provenance:'generic-food-estimate' as const}]));
for (const f of SANDWICH_FAMILIES) SANDWICH_INGREDIENTS[`bread_${f.id}`] = {id:`bread_${f.id}`,name:f.name,kcalPer100g:f.breadKcalPer100g,allergens:['gluten'],vegetarian:true,category:'bread',source:CIQUAL,referenceFood:`Generic ${f.name.en} bread estimate; recipe dependent`,provenance:'generic-food-estimate'};

// Ingredient quantities are edible grams for ONE serving: a sandwich, or an open-faced tartine portion.
type RecipeRow = [SandwichFamily,string,string,string,'classic'|'inspired',boolean,string];
const recipeRows: RecipeRow[] = [
 // Editorial portions, not a cooked/nutrition trial. Structure references checked 2026-09-23:
 // https://www.bbcgoodfood.com/recipes/club-sandwich
 // https://www.atelierdeschefs.fr/recettes/13755/croque-monsieur-bechamel/
 ['pain_mie','club-sandwich','Club sandwich au poulet et bacon','Chicken & bacon club sandwich','classic',false,'chicken:70 bacon_cooked:25 mayonnaise:20 lettuce:20 tomato:60'],
 ['pain_mie','croque-monsieur','Croque-monsieur à la béchamel','Croque monsieur with béchamel','classic',false,'ham:50 emmental:40 milk:60 wheat_flour:5 butter:5 mustard:0:4 salt:0.2 black_pepper:0.1 nutmeg:0:0.1'],
 ['tartine','avocat-oeuf','Avocat, œuf poché et feta','Avocado, poached egg & feta','inspired',false,'avocado:60 egg_to_poach:55 feta:25 lemon:5 salt:0.3 black_pepper:0.1 pomegranate:0:15'],
 ['tartine','chevre-miel-noix','Chèvre, miel et noix','Goat cheese, honey & walnuts','classic',false,'goat_cheese:40 honey:8 walnut:10'],
 ['tartine','jambon-emmental','Jambon et emmental','Ham & Emmental','classic',false,'ham:45 emmental:25 butter:5'],
 ['tartine','champignons-ricotta','Champignons et ricotta','Mushrooms & ricotta','inspired',false,'mushroom:80 ricotta:35 olive_oil:3 parsley:0:3'],
 ['tartine','tomate-ricotta','Tomate, ricotta et basilic','Tomato, ricotta & basil','inspired',true,'tomato:70 ricotta:30 basil:3'],
 ['tartine','thon-yaourt','Thon, yaourt et concombre','Tuna, yogurt & cucumber','inspired',true,'tuna:50 yogurt:20 cucumber:40 lemon:5'],
 ['baguette','jambon-beurre','Jambon-beurre','Ham & butter','classic',false,'ham:70 butter:18 pickle:20'],
 ['baguette','parisien','Le Parisien','Ham & Emmental','classic',false,'ham:65 emmental:35 butter:12 lettuce:15'],
 ['baguette','poulet-mayo','Poulet mayonnaise','Chicken & mayonnaise','classic',false,'chicken:85 mayonnaise:20 lettuce:20 tomato:50'],
 ['baguette','thon-crudites','Thon et crudités','Tuna salad','classic',false,'tuna:80 mayonnaise:18 tomato:60 lettuce:20 egg:40'],
 ['baguette','brie-noix','Brie et noix','Brie & walnuts','classic',false,'brie:60 walnut:15 lettuce:20 butter:8'],
 ['baguette','rosette','Salami et cornichons','Salami & gherkins','classic',false,'salami:65 butter:15 pickle:25'],
 ['baguette','chevre-miel','Chèvre, miel et noix','Goat cheese, honey & walnuts','inspired',false,'goat_cheese:55 honey:10 walnut:12 rocket:20'],
 ['baguette','legumes-mozza','Légumes rôtis et mozzarella','Roasted vegetables & mozzarella','inspired',false,'courgette:60 pepper:50 mozzarella:55 olive_oil:5 basil:3'],
 ['baguette','poulet-citron','Poulet citron et croquant','Lemon chicken & crunch','inspired',true,'chicken:55 yogurt:20 lemon:8 lettuce:25 cucumber:50 carrot:30'],
 ['baguette','thon-yaourt','Thon, yaourt et concombre','Tuna, yogurt & cucumber','inspired',true,'tuna:65 yogurt:20 cucumber:60 tomato:40 lemon:6'],
 ['focaccia','mortadelle-pistache','Mortadelle et burrata','Mortadella & burrata','classic',false,'mortadella:65 burrata:60 pistachio:0:12 rocket:15'],
 ['focaccia','crudo-mozza','Jambon cru et mozzarella','Prosciutto & mozzarella','classic',false,'prosciutto:60 mozzarella:65 tomato:50 rocket:15'],
 ['focaccia','porchetta','Porchetta et roquette','Porchetta & rocket','classic',false,'porchetta:100 rocket:20 mustard:8'],
 ['focaccia','caprese','Tomate, mozzarella et basilic','Tomato, mozzarella & basil','classic',false,'mozzarella:85 tomato:90 basil:5 olive_oil:8'],
 ['focaccia','salame-provolone','Salami et provolone','Salami & provolone','classic',false,'salami:55 provolone:45 rocket:20'],
 ['focaccia','saumon-avocat','Saumon et avocat','Salmon & avocado','inspired',false,'smoked_salmon:65 avocado:65 cream_cheese:25 lemon:6'],
 ['focaccia','champignons-ricotta','Champignons et ricotta','Mushrooms & ricotta','inspired',false,'mushroom:120 ricotta:70 olive_oil:6 parsley:0:4'],
 ['focaccia','aubergine-pesto','Aubergine, mozzarella et pesto','Aubergine, mozzarella & pesto','inspired',false,'aubergine:100 mozzarella:60 pesto:15 olive_oil:5'],
 ['focaccia','poulet-roquette','Poulet, roquette et citron','Chicken, rocket & lemon','inspired',true,'chicken:60 rocket:25 tomato:70 yogurt:20 lemon:8'],
 ['focaccia','legumes-ricotta','Légumes rôtis et ricotta','Roasted vegetables & ricotta','inspired',true,'courgette:80 pepper:60 ricotta:35 olive_oil:3 basil:4'],
 ['bagel','saumon-cream-cheese','Saumon et fromage frais','Smoked salmon & cream cheese','classic',false,'smoked_salmon:75 cream_cheese:45 cucumber:35 caper:0:8 onion:10'],
 ['bagel','oeuf-cheddar','Œuf et emmental','Egg & Emmental','classic',false,'egg:100 emmental:40 butter:8'],
 ['bagel','thon-mayo','Thon mayonnaise','Tuna mayonnaise','classic',false,'tuna:85 mayonnaise:25 lettuce:20 tomato:40'],
 ['bagel','roast-beef','Bœuf, moutarde et cornichons','Roast beef, mustard & gherkins','classic',false,'roast_beef:90 cream_cheese:25 mustard:10 pickle:25'],
 ['bagel','avocat-oeuf','Avocat et œuf','Avocado & egg','inspired',false,'avocado:75 egg:55 tomato:40 lemon:5'],
 ['bagel','pomme-brie','Brie, pomme et noix','Brie, apple & walnuts','inspired',false,'brie:55 apple:60 walnut:10 honey:5'],
 ['bagel','dinde-croquante','Dinde et légumes croquants','Turkey & crunchy vegetables','inspired',true,'turkey:55 cucumber:50 lettuce:25 mustard:8 yogurt:15'],
 ['bagel','thon-citron','Thon citron et radis','Lemon tuna & radish','inspired',true,'tuna:65 radish:40 cucumber:40 yogurt:20 lemon:6'],
 ['pita','falafel-tahini','Falafels et tahini','Falafel & tahini','classic',false,'falafel:100 tahini:18 tomato:50 cucumber:40 parsley:5 lemon:10'],
 ['pita','poulet-shawarma','Shawarma · poulet déjà cuit','Shawarma · already cooked chicken','inspired',false,'chicken:100 yogurt:35 olive_oil:8 cumin:1 paprika:1 cabbage:40 pickle:20'],
 ['pita','aubergine-oeuf','Aubergine, œuf et tahini','Aubergine, egg & tahini','inspired',false,'aubergine:100 egg:60 tahini:18 olive_oil:8 parsley:5'],
 ['pita','agneau','Agneau, crudités et yaourt','Lamb, salad & yogurt','classic',false,'lamb:110 yogurt:30 tomato:50 onion:20 olive_oil:5'],
 ['pita','poulet-citron','Poulet citron · déjà cuit','Lemon chicken · already cooked','inspired',true,'chicken:65 yogurt:25 cucumber:70 lettuce:20 lemon:8'],
 ['pita','poulet-cru-citron','Poulet citron · à cuisiner cru','Lemon chicken · cook from raw','inspired',true,'chicken_raw:100 yogurt:25 cucumber:70 lettuce:20 lemon:8 olive_oil:3'],
 ['pita','pois-chiches','Pois chiches et légumes croquants','Chickpeas & crunchy vegetables','inspired',true,'chickpea:70 tomato:50 cucumber:50 yogurt:20 lemon:8 parsley:5'],
 ['greek_pita','poulet-tzatziki','Poulet et tzatziki','Chicken & tzatziki','classic',false,'chicken:120 tzatziki:50 tomato:55 onion:25 olive_oil:8 oregano:1'],
 ['greek_pita','agneau-feta','Agneau et feta','Lamb & feta','inspired',false,'lamb:100 feta:40 tomato:50 onion:20 yogurt:25'],
 ['greek_pita','halloumi-feta','Feta, olives et tomates','Feta, olives & tomatoes','classic',false,'feta:90 olive:30 tomato:80 cucumber:40 olive_oil:8 oregano:1'],
 ['greek_pita','falafel','Falafels et salade grecque','Falafel & Greek-style salad','inspired',false,'falafel:100 feta:30 tomato:60 tzatziki:30'],
 ['greek_pita','dinde-citron','Dinde, citron et concombre','Turkey, lemon & cucumber','inspired',true,'turkey:65 yogurt:25 cucumber:70 tomato:50 lemon:8 oregano:1'],
 ['greek_pita','haricots-herbes','Haricots blancs et herbes','White beans & herbs','inspired',true,'white_bean:80 tomato:60 cucumber:50 yogurt:20 parsley:5 lemon:8'],
 ['kebab_bread','boeuf-classique','Kebab de bœuf et crudités','Beef kebab & salad','classic',false,'beef_kebab:130 yogurt:40 mayonnaise:15 cabbage:45 tomato:50 onion:20'],
 ['kebab_bread','poulet','Poulet, crudités et sauce blanche','Chicken, salad & white sauce','classic',false,'chicken:120 yogurt:35 mayonnaise:20 cabbage:40 tomato:50 olive_oil:7'],
 ['kebab_bread','agneau','Agneau et harissa douce','Lamb & mild harissa','inspired',false,'lamb:115 yogurt:40 chili:10 tomato:55 onion:25 olive_oil:5'],
 ['kebab_bread','falafel','Falafels et houmous','Falafel & hummus','inspired',false,'falafel:95 hummus:50 tomato:50 cabbage:35'],
 ['kebab_bread','poulet-yaourt','Poulet au yaourt et crudités','Chicken, yogurt & fresh salad','inspired',true,'chicken:70 yogurt:30 cabbage:55 tomato:60 lemon:8'],
 ['kebab_bread','pois-chiches-croquants','Pois chiches citronnés et croquant','Lemony chickpeas & crunch','inspired',true,'chickpea:75 yogurt:20 cucumber:50 carrot:40 lemon:10 parsley:5'],
 ['batbout','thon-olive','Thon, olives et mayonnaise','Tuna, olives & mayonnaise','classic',false,'tuna:80 olive:25 mayonnaise:20 lettuce:20 tomato:40'],
 ['batbout','poulet-epices','Poulet aux épices douces','Mild-spiced chicken','classic',false,'chicken:100 mayonnaise:18 carrot:40 olive_oil:5 cumin:1 paprika:1'],
 ['batbout','boeuf-poivron','Bœuf et poivron rôti','Beef & roasted pepper','inspired',false,'roast_beef:95 pepper:80 olive_oil:8 yogurt:30 cumin:1'],
 ['batbout','oeuf-fromage','Œuf et fromage','Egg & cheese','classic',false,'egg:85 emmental:40 mayonnaise:15 tomato:40'],
 ['batbout','thon-citron','Thon citron et légumes','Lemon tuna & vegetables','inspired',true,'tuna:60 yogurt:20 cucumber:50 carrot:35 lemon:8'],
 ['batbout','haricots-cumin','Haricots blancs et cumin','White beans & cumin','inspired',true,'white_bean:75 tomato:55 parsley:5 lemon:10 yogurt:20 cumin:1'],
 ['laffa','shawarma-poulet','Shawarma · poulet déjà cuit','Shawarma · already cooked chicken','inspired',false,'chicken:120 tahini:25 tomato:55 pickle:30 olive_oil:8 cumin:1 paprika:1'],
 ['laffa','falafel-houmous','Falafels et houmous','Falafel & hummus','classic',false,'falafel:115 hummus:55 tomato:60 cucumber:40 parsley:5'],
 ['laffa','agneau-tahini','Agneau et tahini citronné','Lamb & lemon tahini','classic',false,'lamb:120 tahini:25 tomato:55 onion:25 lemon:10'],
 ['laffa','aubergine-oeuf','Aubergine, œuf et tahini','Aubergine, egg & tahini','inspired',false,'aubergine:110 egg:70 tahini:25 olive_oil:8 parsley:5'],
 ['laffa','dinde-croquante','Dinde citron et croquant','Lemon turkey & crunch','inspired',true,'turkey:75 yogurt:30 cucumber:60 cabbage:45 lemon:8'],
 ['laffa','haricots-tomate','Haricots blancs et tomates','White beans & tomatoes','inspired',true,'white_bean:90 tomato:80 cucumber:50 parsley:5 lemon:10 olive_oil:3'],
 ['piadina','crudo-squacquerone','Jambon cru, squacquerone et roquette','Prosciutto, squacquerone & rocket','classic',false,'prosciutto:65 squacquerone:70 rocket:25'],
 ['piadina','jambon-fromage','Jambon et provolone','Ham & provolone','classic',false,'ham:80 provolone:60 tomato:40'],
 ['piadina','salame','Salami et mozzarella','Salami & mozzarella','classic',false,'salami:60 mozzarella:65 rocket:20'],
 ['piadina','legumes-chevre','Légumes grillés et chèvre','Grilled vegetables & goat cheese','inspired',false,'courgette:75 aubergine:70 goat_cheese:60 olive_oil:6'],
 ['piadina','poulet-citron','Poulet citron et salade','Lemon chicken & salad','inspired',true,'chicken:55 yogurt:20 lettuce:30 tomato:60 lemon:8'],
 ['piadina','legumes-ricotta','Légumes rôtis et ricotta','Roasted vegetables & ricotta','inspired',true,'courgette:80 pepper:60 ricotta:35 olive_oil:3 basil:4'],
 ['pan_bagnat','nicois','Pan bagnat niçois','Niçois pan bagnat','classic',false,'tomato:100 tuna:60 egg:50 anchovy:12 pepper:25 onion:15 olive:20 olive_oil:12 basil:4 garlic:2 radish:20 broad_bean:20'],
 ['pan_bagnat','thon-citron','Inspiré : thon citron et crudités','Inspired: lemon tuna & salad','inspired',true,'tuna:65 tomato:90 cucumber:50 onion:10 olive_oil:3 lemon:8 basil:4'],
 ['pan_bagnat','haricots-crudites','Inspiré : haricots blancs et crudités','Inspired: white beans & salad','inspired',true,'white_bean:70 tomato:90 cucumber:50 radish:30 olive_oil:3 lemon:8 basil:4'],
 ['pan_bagnat','poulet-basilic','Inspiré : poulet et basilic','Inspired: chicken & basil','inspired',false,'chicken:90 tomato:80 egg:50 olive:20 olive_oil:8 basil:4'],
 ['pan_bagnat','mozza-legumes','Inspiré : mozzarella et légumes','Inspired: mozzarella & vegetables','inspired',false,'mozzarella:85 tomato:100 pepper:40 olive:20 olive_oil:8 basil:4'],
 ['pan_bagnat','sardines','Inspiré : sardines et fenouil','Inspired: sardines & fennel','inspired',false,'sardine:95 fennel:60 tomato:70 olive:15 olive_oil:6 lemon:10'],
 ['ciabatta','caprese','Tomate, mozzarella et basilic','Tomato, mozzarella & basil','classic',false,'mozzarella:85 tomato:90 olive_oil:8 basil:5'],
 ['ciabatta','crudo','Jambon cru et mozzarella','Prosciutto & mozzarella','classic',false,'prosciutto:65 mozzarella:65 rocket:20 olive_oil:5'],
 ['ciabatta','porchetta','Porchetta et poivrons','Porchetta & peppers','classic',false,'porchetta:110 pepper:70 olive_oil:5 rocket:20'],
 ['ciabatta','champignons-provolone','Champignons et provolone','Mushrooms & provolone','inspired',false,'mushroom:110 provolone:65 olive_oil:8 parsley:0:5'],
 ['ciabatta','dinde-crudites','Dinde et crudités','Turkey & fresh salad','inspired',true,'turkey:60 yogurt:20 cucumber:55 tomato:55 lettuce:20 mustard:5'],
 ['ciabatta','haricots-roquette','Haricots blancs et roquette','White beans & rocket','inspired',true,'white_bean:75 rocket:25 tomato:80 olive_oil:3 lemon:8'],
 ['panuozzo','pancetta-mozza','Pancetta et mozzarella','Pancetta & mozzarella','classic',false,'pancetta:60 mozzarella:85'],
 ['panuozzo','saucisse-legumes','Saucisse et épinards','Sausage & spinach','inspired',false,'sausage:110 spinach:100 olive_oil:8 garlic:3'],
 ['panuozzo','jambon-provolone','Jambon et provolone','Ham & provolone','classic',false,'ham:85 provolone:70 tomato_sauce:35'],
 ['panuozzo','aubergine-mozza','Aubergine et mozzarella','Aubergine & mozzarella','classic',false,'aubergine:110 mozzarella:90 tomato_sauce:45 olive_oil:8 basil:4'],
 ['panuozzo','poulet-tomate','Poulet, tomate et roquette','Chicken, tomato & rocket','inspired',true,'chicken:65 tomato:80 rocket:25 yogurt:20 lemon:8'],
 ['panuozzo','legumes-ricotta','Légumes rôtis et ricotta','Roasted vegetables & ricotta','inspired',true,'courgette:90 pepper:70 ricotta:40 olive_oil:3 basil:4'],
];

const perishableSafe = text('Servez aussitôt. Sinon, réfrigérez rapidement à 4 °C ou moins : au plus 2 h hors du froid, 1 h s’il fait plus de 32 °C. Respectez les dates des produits.', 'Serve promptly. Otherwise refrigerate promptly at 4°C or below: no more than 2 hours unrefrigerated, or 1 hour above 32°C. Follow product use-by dates.');
export function buildSandwichSteps(id: string, familyId: SandwichFamily, ingredients: SandwichPortion[], vegetarian: boolean): SandwichStep[] {
  const has = (ingredientId: string) => ingredients.some(i=>i.ingredientId===ingredientId && i.grams>0);
  const steps: SandwichStep[] = [];
  const add = (key:string,fr:string,en:string,frInstruction:string,enInstruction:string,minutes:number,phase:SandwichStep['phase']) => steps.push({id:`${id}-${key}`,title:text(fr,en),instruction:text(frInstruction,enInstruction),minutes,phase});
  if (familyId==='pain_mie') {
    const names = (ids: string[], lang: 'fr' | 'en') => ids.filter(has).map(key=>SANDWICH_INGREDIENTS[key].name[lang].toLowerCase()).join(', ');
    if (id==='pain_mie-club-sandwich') {
      const vegetables=['lettuce','tomato'];
      const meats=['chicken','bacon_cooked'];
      add('prep','Préparer la garniture froide','Prepare the cold filling',
        ['Pesez les garnitures pour toutes les portions.',vegetables.some(has)?`Lavez et séchez ${names(vegetables,'fr')}.`:'',has('tomato')?'Coupez la tomate en fines rondelles et épongez son jus.':'',meats.some(has)?`Utilisez uniquement les produits déjà cuits et prêts à consommer : ${names(meats,'fr')}. Les poids indiqués sont cuits ; émincez-les sur une planche propre.`:'','Gardez les garnitures périssables au réfrigérateur à 4 °C ou moins jusqu’au montage.'].filter(Boolean).join(' '),
        ['Weigh the fillings for all portions.',vegetables.some(has)?`Wash and dry ${names(vegetables,'en')}.`:'',has('tomato')?'Thinly slice the tomato and blot away its juice.':'',meats.some(has)?`Use only the already cooked, ready-to-eat products: ${names(meats,'en')}. Listed weights are cooked; slice on a clean board.`:'','Refrigerate perishable fillings at 4°C or below until assembly.'].filter(Boolean).join(' '),6,'prep');
      // Every bread-dependent action belongs to serving; the preparation screen runs before the loaf is baked.
      add('toast','Trancher et toaster le pain refroidi','Slice and toast the cooled bread',
        'Attendez que le pain de mie soit cuit et complètement refroidi. Par club, prévoyez 3 tranches d’environ 30 g chacune, soit 90 g de pain cuit. Toastez-les légèrement des deux côtés, puis laissez retomber la chaleur sur une grille. Une portion est un club à deux étages, pas un pain entier.',
        'Wait until the sandwich loaf is baked and fully cooled. For each club, use 3 slices of about 30 g each, or 90 g baked bread. Lightly toast both sides and let the heat subside on a rack. One portion is a two-layer club, not a whole loaf.',4,'assemble');
      const first=['chicken','lettuce'];
      const second=['tomato','bacon_cooked'];
      add('stack','Monter les deux étages','Build both layers',
        [has('mayonnaise')?'Répartissez la mayonnaise mesurée sur les 4 faces intérieures : le dessus de la première tranche, les deux faces de celle du milieu et le dessous de la dernière.':'',first.some(has)?`Sur la première tranche, disposez ${names(first,'fr')}.`:'Posez la première tranche à plat.',`Ajoutez la tranche centrale${second.some(has)?`, puis ${names(second,'fr')}`:''}. Fermez avec la troisième tranche, face tartinée vers l’intérieur si elle l’est. Pressez très légèrement.`].filter(Boolean).join(' '),
        [has('mayonnaise')?'Divide the measured mayonnaise over the 4 inward-facing surfaces: the top of the first slice, both sides of the middle slice and the underside of the last.':'',first.some(has)?`Layer ${names(first,'en')} on the first slice.`:'Lay the first slice flat.',`Add the middle slice${second.some(has)?`, then ${names(second,'en')}`:''}. Close with the third slice, spread side inward if spread. Press very gently.`].filter(Boolean).join(' '),4,'assemble');
      add('serve','Couper et servir le club','Cut and serve the club','Coupez en 2 ou 4 triangles avec un couteau dentelé. Si vous utilisez des piques pour maintenir les étages, retirez-les avant de manger. '+perishableSafe.fr,'Cut into 2 or 4 triangles with a serrated knife. If using picks to secure the layers, remove them before eating. '+perishableSafe.en,1,'assemble');
      return steps;
    }
    if (id==='pain_mie-croque-monsieur') {
      const sauceCore=['milk','wheat_flour','butter'];
      const sauceComplete=sauceCore.every(has);
      const saucePartial=sauceCore.some(has)&&!sauceComplete;
      const seasoning=['salt','black_pepper','nutmeg'];
      add('prep','Préparer les ingrédients du croque','Prepare the croque ingredients',
        ['Pesez les ingrédients pour toutes les portions.',has('emmental')?'Râpez l’emmental ; réservez-en la moitié pour le dessus.':'',has('ham')?'Utilisez le jambon blanc déjà cuit prévu dans la liste.':'','Gardez les produits périssables au réfrigérateur à 4 °C ou moins.'].filter(Boolean).join(' '),
        ['Weigh the ingredients for all portions.',has('emmental')?'Grate the Emmental; reserve half for the topping.':'',has('ham')?'Use the already cooked ham listed.':'','Keep perishables refrigerated at 4°C or below.'].filter(Boolean).join(' '),3,'prep');
      if (saucePartial) {
        const correctionFr='La béchamel est incomplète. Rétablissez les quantités de lait, farine et beurre, ou retirez les trois pour une version sans béchamel. Ne poursuivez pas le montage avec de la farine crue ; les étapes de sauce et de cuisson réapparaîtront après correction.';
        const correctionEn='The béchamel is incomplete. Restore the milk, flour and butter amounts, or remove all three for a version without béchamel. Do not assemble with raw flour; the sauce and baking steps will return after correction.';
        add('correct-sauce','Corriger la béchamel','Correct the béchamel',correctionFr,correctionEn,0,'prep');
        add('correct-before-serving','Vérifier les ingrédients avant de continuer','Check ingredients before continuing',correctionFr,correctionEn,0,'assemble');
        return steps;
      }
      if (sauceComplete) {
        add('bechamel','Cuire la béchamel','Cook the béchamel',
          'Dans une casserole, faites fondre le beurre à feu doux. Incorporez la farine et remuez 2 min sans laisser brunir. Versez le lait progressivement en fouettant. Portez à petits bouillons, puis faites cuire environ 5 min en remuant jusqu’à obtenir une sauce épaisse et lisse.'+(seasoning.some(has)?` Ajoutez les quantités prévues de ${names(seasoning,'fr')}, selon votre goût.`:''),
          'Melt the butter in a saucepan over low heat. Stir in the flour for 2 minutes without browning. Whisk in the milk gradually. Bring to a gentle simmer and cook for about 5 minutes, stirring until thick and smooth.'+(seasoning.some(has)?` Add the listed amounts of ${names(seasoning,'en')} to taste.`:''),8,'cook');
        add('chill-sauce','Réserver la sauce jusqu’au montage','Keep the sauce until assembly',
          'Si le pain n’est pas encore prêt, transvasez la béchamel dans un récipient peu profond et réfrigérez rapidement à 4 °C ou moins. Ne la laissez pas attendre pendant la levée ou la cuisson du pain. Sortez-la seulement au moment de monter les croques. '+perishableSafe.fr,
          'If the bread is not ready yet, transfer the béchamel to a shallow container and refrigerate promptly at 4°C or below. Do not leave it out during the bread’s rise or bake. Take it out only when assembling the croques. '+perishableSafe.en,0,'chill');
      }
      add('bread','Préparer le pain refroidi et le four','Prepare the cooled bread and oven',
        'Une fois le pain de mie cuit et complètement refroidi, coupez 2 tranches d’environ 30 g par croque, soit 60 g de pain cuit. Une portion est un croque, pas un pain entier. Préchauffez le four à 180 °C en chaleur statique. Posez les premières tranches sur une plaque garnie de papier cuisson.',
        'Once the sandwich loaf is baked and fully cooled, cut 2 slices of about 30 g per croque, or 60 g baked bread. One portion is a croque, not a whole loaf. Preheat a conventional oven to 180°C. Place the bottom slices on a baking-paper-lined tray.',5,'assemble');
      add('stack','Assembler les croques','Assemble the croques',
        [has('mustard')?'Étalez la moutarde mesurée sur les tranches du dessous.':'',sauceComplete?'Étalez la moitié de la béchamel sur ces tranches ; réservez le reste pour le dessus.':'Version personnalisée sans béchamel.',has('ham')?'Ajoutez le jambon.':'',has('emmental')?'Ajoutez la moitié de l’emmental.':'','Fermez avec les secondes tranches.',sauceComplete?'Nappez avec le reste de béchamel.':'',has('emmental')?'Répartissez le reste d’emmental sur le dessus.':'',!sauceComplete&&seasoning.some(has)?`Assaisonnez avec ${names(seasoning,'fr')}, selon votre goût.`:''].filter(Boolean).join(' '),
        [has('mustard')?'Spread the measured mustard on the bottom slices.':'',sauceComplete?'Spread half the béchamel over these slices; reserve the rest for the top.':'Customized version without béchamel.',has('ham')?'Add the ham.':'',has('emmental')?'Add half the Emmental.':'','Close with the second slices.',sauceComplete?'Cover with the remaining béchamel.':'',has('emmental')?'Scatter the remaining Emmental on top.':'',!sauceComplete&&seasoning.some(has)?`Season with ${names(seasoning,'en')} to taste.`:''].filter(Boolean).join(' '),4,'assemble');
      add('bake','Cuire les croques montés','Bake the assembled croques',
        `Enfournez à 180 °C pour environ 10–15 min${has('emmental')?', jusqu’à ce que le dessus soit doré et le fromage fondu':', jusqu’à ce que le pain soit doré'}. La garniture doit être bien chaude au centre. Si vous réchauffez une sauce préparée à l’avance ou des restes, vérifiez 74 °C à cœur avec un thermomètre et prolongez si nécessaire. Le temps dépend du four et de la température de départ.`,
        `Bake at 180°C for about 10–15 minutes${has('emmental')?', until golden on top and the cheese has melted':', until the bread is golden'}. The filling must be hot in the centre. When reheating made-ahead sauce or leftovers, check 74°C in the centre with a food thermometer and continue if needed. Timing depends on the oven and starting temperature.`,15,'assemble');
      add('serve','Servir chaud','Serve hot','Sortez la plaque avec des gants et transférez les croques sur les assiettes avec une spatule. Laissez retomber la chaleur pour éviter de vous brûler, puis servez. '+perishableSafe.fr,'Use oven gloves to remove the tray and a spatula to transfer the croques to plates. Let the heat subside enough to avoid burns, then serve. '+perishableSafe.en,1,'assemble');
      return steps;
    }
  }
  // These pocket-pita meals deliberately distinguish raw and ready-cooked weights.
  if (id==='pita-poulet-cru-citron' || id==='pita-poulet-citron' || id==='pita-poulet-shawarma') {
    const names = (ids: string[], lang: 'fr' | 'en') => ids.filter(has).map(key=>SANDWICH_INGREDIENTS[key].name[lang].toLowerCase()).join(', ');
    const saladIds = ['cucumber','lettuce','cabbage','pickle'];
    const sauceIds = ['yogurt','lemon','cumin','paprika'];
    add('prep','Préparer avant la cuisson des pitas','Prepare before baking the pitas',
      'Pesez les quantités de garniture indiquées pour toutes les portions. Préparez une poêle antiadhésive, une assiette propre et un thermomètre alimentaire. Gardez les produits frais à 4 °C ou moins jusqu’à leur utilisation.',
      'Weigh the listed filling quantities for all portions. Have a nonstick pan, a clean plate and a food thermometer ready. Keep perishables at 4°C or below until needed.',3,'prep');
    if (saladIds.some(has)) add('salad','Préparer les crudités','Prepare the salad',
      `Préparez les ingrédients sélectionnés : ${names(saladIds,'fr')}. Lavez et séchez les légumes frais, puis émincez-les.${has('pickle')?' Égouttez et tranchez les cornichons.':''} Réservez au réfrigérateur dans un récipient propre.`,
      `Prepare the selected ingredients: ${names(saladIds,'en')}. Wash and dry fresh vegetables, then slice thinly.${has('pickle')?' Drain and slice the gherkins.':''} Refrigerate in a clean container.`,4,'prep');
    if (has('chicken_raw')) {
      add('raw','Découper le poulet cru','Cut the raw chicken',
        'Utilisez du poulet réfrigéré, entièrement décongelé si nécessaire. La quantité indiquée est pesée crue, sans peau ni os. Ne rincez pas le poulet. Sur une planche réservée à la viande crue, coupez-le en lanières régulières d’environ 1 cm d’épaisseur. Lavez ensuite les mains au savon, et la planche, le couteau et les surfaces à l’eau chaude savonneuse avant de toucher la sauce ou les crudités. Gardez le poulet au froid si vous ne le cuisez pas immédiatement.',
        'Use chilled chicken, fully thawed if necessary. The listed weight is raw, without skin or bones. Do not rinse chicken. On a board reserved for raw meat, cut into even strips about 1 cm thick. Then wash hands with soap and clean the board, knife and surfaces with hot, soapy water before touching sauce or salad. Refrigerate the chicken if not cooking immediately.',4,'prep');
      add('cook','Cuire le poulet à cœur','Cook the chicken through',
        `Commencez lorsque les pitas approchent de leur cuisson, ou juste après leur sortie du four si vous cuisinez seul. Chauffez la poêle à feu moyen${has('olive_oil')?' avec toute l’huile mesurée':''}. Déposez le poulet en une seule couche ; faites plusieurs fournées si nécessaire. Faites cuire environ 6–10 min par fournée, en retournant régulièrement. Vérifiez au thermomètre au centre des morceaux les plus épais : au moins 74 °C avant de retirer du feu. Le temps est indicatif ; poursuivez si nécessaire. Transférez avec un ustensile propre sur l’assiette propre.`,
        `Start when the pitas are close to baking, or just after they leave the oven if cooking alone. Heat the pan over medium heat${has('olive_oil')?' with all the measured oil':''}. Add chicken in a single layer; cook in batches if needed. Cook for approximately 6–10 minutes per batch, turning regularly. Check the centre of the thickest pieces with a food thermometer: at least 74°C before removing from heat. Timing is a guide; continue cooking as needed. Transfer with a clean utensil to the clean plate.`,10,'cook');
    } else if (has('chicken')) {
      add('heat','Réchauffer le poulet déjà cuit','Reheat the already cooked chicken',
        `Utilisez uniquement du poulet déjà cuit : la quantité indiquée est son poids cuit. Lorsque les pitas sont presque prêtes, émincez et réchauffez le poulet dans la poêle à feu moyen${has('olive_oil')?' avec toute l’huile mesurée':''}, en remuant, selon les instructions de l’emballage. Pour des restes, vérifiez au thermomètre au moins 74 °C à cœur. Comptez environ 5–8 min, à adapter ; gardez les crudités à part.`,
        `Use already cooked chicken only: the listed quantity is its cooked weight. When the pitas are nearly ready, slice and reheat the chicken in the pan over medium heat${has('olive_oil')?' with all the measured oil':''}, stirring, according to package instructions. For leftovers, check at least 74°C throughout with a thermometer. Allow approximately 5–8 minutes, adjusting as needed; keep salad separate.`,8,'cook');
    }
    if (sauceIds.some(has)) add('sauce',has('yogurt')?'Mélanger la sauce':'Préparer l’assaisonnement',has('yogurt')?'Mix the sauce':'Prepare the dressing',
      `Dans un bol propre, mélangez uniquement les quantités prévues de ${names(sauceIds,'fr')}.${has('olive_oil')&&!has('chicken_raw')&&!has('chicken')?' Ajoutez l’huile mesurée.':''} Gardez au froid jusqu’au moment de garnir.`,
      `In a clean bowl, mix only the listed amounts of ${names(sauceIds,'en')}.${has('olive_oil')&&!has('chicken_raw')&&!has('chicken')?' Add the measured oil.':''} Keep chilled until filling.`,2,'prep');
    if (has('olive_oil') && !has('chicken_raw') && !has('chicken') && !sauceIds.some(has)) add('oil','Assaisonner','Dress the filling','Répartissez l’huile mesurée sur les garnitures conservées ou directement sur le pain.','Drizzle the measured oil over the retained filling or directly over the bread.',1,'prep');
    const fillingIds = [...(has('chicken_raw')?['chicken_raw']:has('chicken')?['chicken']:[]),...saladIds.filter(has)];
    const fillingNames = (lang: 'fr'|'en') => fillingIds.map(key=>key==='chicken_raw'||key==='chicken'?(lang==='fr'?'poulet cuit':'cooked chicken'):SANDWICH_INGREDIENTS[key].name[lang].toLowerCase()).join(', ');
    add('assemble','Garnir les pitas prêtes et servir','Fill the ready pitas and serve',
      `Attendez que les pitas soient cuites et assez tièdes pour être manipulées. Ouvrez délicatement une poche dans chaque pita${sauceIds.some(has)?', répartissez la sauce ou l’assaisonnement':''}${fillingIds.length?`, puis ${fillingNames('fr')}`:''}. Si la poche ne s’ouvre pas, servez le pain plié autour de la garniture. Servez aussitôt.`,
      `Wait until the pitas are baked and cool enough to handle. Carefully open a pocket in each pita${sauceIds.some(has)?', divide the sauce or dressing between them':''}${fillingIds.length?`, then add ${fillingNames('en')}`:''}. If a pocket does not open, serve the bread folded around the filling. Serve immediately.`,3,'assemble');
    add('serve','Si le repas attend','If serving is delayed',perishableSafe.fr,perishableSafe.en,0,'chill');
    return steps;
  }
  if (id==='tartine-avocat-oeuf') {
    add('prep','Préparer la garniture','Prepare the toppings','Pesez les garnitures par portion. Préparez le citron et, si elle est sélectionnée, la grenade. Émiettez la feta si elle est conservée.','Weigh the toppings per portion. Prepare the lemon and, if selected, the pomegranate. Crumble the feta if retained.',3,'prep');
    add('bread','Trancher et toaster','Slice and toast','Pesez 60 g de pain déjà cuit et refroidi par portion : une grande tranche ou plusieurs petites. Toastez légèrement. Une portion ne correspond pas à un pain entier.','Weigh 60 g of baked, cooled bread per portion: one large slice or several small ones. Toast lightly. One portion is not one whole loaf.',3,'cook');
    if (has('avocado')) add('avocado','Écraser l’avocat','Mash the avocado','Écrasez l’avocat à la fourchette avec le citron s’il est conservé. Assaisonnez avec un peu du sel et du poivre prévus, en tenant compte de la feta déjà salée.','Mash the avocado with the lemon if retained. Season with a little of the listed salt and pepper, allowing for the saltiness of the feta.',2,'prep');
    if (has('egg_to_poach')) add('egg','Pocher l’œuf','Poach the egg','Comptez environ 1 œuf par portion (55 g sans coquille). Cassez chaque œuf dans une petite tasse. Glissez-le dans une casserole d’eau frémissante, sans gros bouillons. Pochez 3–4 min, jusqu’à ce que le blanc soit pris ; prolongez pour un jaune plus ferme. Égouttez délicatement avec une écumoire.','Allow about 1 egg per portion (55 g without shell). Crack each egg into a small cup. Slide into gently simmering water, not a rolling boil. Poach for 3–4 minutes until the white is set; cook longer for a firmer yolk. Lift out gently with a slotted spoon and drain.',5,'cook');
    const toppingsFr=[has('avocado')?'Étalez l’avocat sur le pain.':'Disposez les garnitures conservées sur le pain.',has('feta')?'Répartissez la feta émiettée.':'',has('egg_to_poach')?'Déposez délicatement l’œuf poché.':'',has('salt')||has('black_pepper')?'Terminez avec le sel et le poivre conservés, selon votre goût.':'',has('pomegranate')?'Parsemez les graines de grenade sélectionnées.':'','Servez ouvert, sans seconde tranche par-dessus, aussitôt.'].filter(Boolean).join(' ');
    const toppingsEn=[has('avocado')?'Spread the avocado over the toast.':'Arrange the retained toppings over the toast.',has('feta')?'Scatter over the crumbled feta.':'',has('egg_to_poach')?'Gently place the poached egg on top.':'',has('salt')||has('black_pepper')?'Finish with the retained salt and pepper to taste.':'',has('pomegranate')?'Sprinkle over the selected pomegranate seeds.':'','Serve open-faced, without another slice on top, immediately.'].filter(Boolean).join(' ');
    add('assemble','Garnir et servir','Top and serve',toppingsFr,toppingsEn,2,'assemble');
    return steps;
  }
  const vegetables=ingredients.filter(i=>SANDWICH_INGREDIENTS[i.ingredientId]?.category==='vegetables');
  const vegetableNames=(locale:'fr'|'en')=>vegetables.map(i=>SANDWICH_INGREDIENTS[i.ingredientId].name[locale]).join(', ');
  add('prep','Préparer la garniture','Prepare the filling',
    [vegetables.length?`Lavez et préparez les ingrédients sélectionnés : ${vegetableNames('fr')}.`:'',has('carrot')?'Râpez la carotte.':'','Pesez les quantités par sandwich. Égouttez seulement les ingrédients indiqués égouttés dans la liste.'].filter(Boolean).join(' '),
    [vegetables.length?`Wash and prepare the selected ingredients: ${vegetableNames('en')}.`:'',has('carrot')?'Grate the carrot.':'','Weigh the amounts per sandwich. Drain only ingredients labelled drained in the list.'].filter(Boolean).join(' '),8,'prep');
  if (familyId==='tartine') steps[0].instruction = text(steps[0].instruction.fr.replace('par sandwich','par portion de tartine'),steps[0].instruction.en.replace('per sandwich','per tartine portion'));
  if (has('egg')) add('egg','Préparer l’œuf','Prepare the egg','Utilisez l’œuf dur écalé prévu dans la liste. Si vous le cuisez vous-même, faites-le cuire jusqu’à ce que le blanc et le jaune soient fermes, refroidissez-le rapidement, puis écalez et tranchez.','Use the peeled hard-boiled egg listed. If cooking it yourself, cook until white and yolk are firm, cool promptly, then peel and slice.',10,'cook');
  if (has('courgette')||has('aubergine')||has('pepper')&&familyId!=='pan_bagnat') add('roast','Rôtir les légumes','Roast the vegetables','Coupez la courgette et l’aubergine en tranches fines, le poivron en lanières, selon la liste. Répartissez l’huile mesurée sur ces légumes (réservez-en si besoin pour la sauce). Rôtissez à 210 °C pendant 18–25 min, en retournant à mi-cuisson, jusqu’à ce qu’ils soient tendres.','Thinly slice the courgette and aubergine and cut pepper into strips, as listed. Use the measured oil on these vegetables (reserve some if needed for sauce). Roast at 210°C for 18–25 minutes, turning halfway, until tender.',25,'cook');
  if (has('mushroom')||has('spinach')) add('saute','Cuire à la poêle','Cook in a pan','Émincez les champignons ou rincez les épinards selon la liste. Faites-les revenir avec l’huile mesurée 6–10 min, jusqu’à évaporation de l’eau. Ajoutez l’ail ou le persil prévu en fin de cuisson.','Slice the mushrooms or rinse the spinach, as listed. Cook with the measured oil for 6–10 minutes until released water evaporates. Add the listed garlic or parsley near the end.',10,'cook');
  const reheat = ['porchetta','beef_kebab','lamb','sausage','pancetta','falafel'].some(has) || (['pita','greek_pita','kebab_bread','laffa','panuozzo'].includes(familyId)&&has('chicken'));
  if (reheat) add('heat','Réchauffer la garniture cuite','Heat the cooked filling','La viande et les falafels de la liste sont déjà cuits. Réchauffez seulement ces éléments selon l’emballage ; pour des restes cuits, atteignez 74 °C à cœur. Gardez les crudités et sauces froides à part.','The listed meat and falafel are already cooked. Reheat these items according to the package; cooked leftovers should reach 74°C throughout. Keep salad vegetables and cold sauces separate.',8,'cook');
  if (['yogurt','tahini','lemon','mustard','honey','cumin','paprika','oregano'].some(has) && (familyId!=='tartine' || ['yogurt','tahini','mustard'].some(has))) add('sauce','Préparer la sauce','Mix the sauce','Mélangez les ingrédients de sauce prévus : yaourt ou tahini, citron, moutarde, miel et épices selon la liste. Détendez le tahini avec un peu d’eau. N’ajoutez pas d’huile ou de mayonnaise en plus des quantités indiquées.','Mix the listed sauce ingredients: yogurt or tahini, lemon, mustard, honey and spices as applicable. Loosen tahini with a little water. Use only the listed amounts of oil or mayonnaise.',3,'prep');
  if (has('chickpea')||has('white_bean')) add('mash','Préparer les légumineuses','Prepare the beans','Rincez et égouttez les pois chiches ou haricots cuits. Écrasez-en légèrement la moitié à la fourchette pour que la garniture tienne, puis ajoutez les herbes et la sauce prévues.','Rinse and drain the cooked chickpeas or beans. Lightly crush half with a fork to help the filling hold together, then mix with the listed herbs and dressing.',3,'prep');
  if (familyId==='tartine') {
    add('bread','Trancher et toaster','Slice and toast','Pesez 60 g de pain déjà cuit et refroidi par portion : une grande tranche ou plusieurs petites. Toastez légèrement si souhaité, puis laissez tiédir avant de garnir. Une portion de tartine ne correspond pas à un pain entier.','Weigh 60 g of baked, cooled bread per portion: one large slice or several small ones. Toast lightly if desired, then let cool slightly before topping. One tartine portion is not one whole loaf.',3,'cook');
    if (has('avocado')) add('avocado','Écraser l’avocat','Mash the avocado','Écrasez l’avocat à la fourchette. Incorporez le jus de citron prévu, s’il est conservé dans la garniture.','Mash the avocado with a fork. Add the listed lemon juice if retained in the topping.',2,'prep');
  }
  if (familyId==='bagel') add('bread','Ouvrir et toaster','Split and toast','Coupez le bagel horizontalement. Toastez les faces coupées 2–3 min si souhaité, puis laissez tiédir avant d’ajouter les garnitures choisies.','Split the bagel horizontally. Toast the cut sides for 2–3 minutes if desired, then let cool slightly before adding the selected fillings.',3,'cook');
  if (['greek_pita','laffa','piadina'].includes(familyId)) add('bread','Assouplir le pain','Warm the flatbread','Réchauffez le pain déjà cuit dans une poêle sèche, environ 30–60 s par face, juste pour l’assouplir. Gardez-le sous un torchon propre pendant la préparation.','Warm the baked bread in a dry pan for about 30–60 seconds per side, just until flexible. Keep under a clean towel while preparing.',2,'cook');
  const assembleFr = familyId==='tartine' ? 'Répartissez les garnitures prévues sur les tranches de pain : commencez par le beurre, la ricotta, la sauce ou l’avocat selon la recette, puis disposez les autres ingrédients. Terminez par les herbes, les noix ou un filet de miel prévus. Servez ouvert, sans seconde tranche par-dessus.' : familyId==='pita'||familyId==='batbout' ? 'Ouvrez délicatement une poche dans le pain. Répartissez la sauce, puis la garniture et les crudités sans trop tasser.' : ['greek_pita','laffa','piadina'].includes(familyId) ? 'Étalez la sauce sur le pain, répartissez la garniture et les crudités au centre, puis pliez ou roulez en retenant la base.' : familyId==='pan_bagnat' ? 'Ouvrez le pain. Pour la version niçoise, frottez l’ail prévu sur la mie et répartissez l’huile et le jus de tomate prévus. Disposez la garniture, refermez et pressez doucement.' : familyId==='panuozzo' ? 'Ouvrez le pain horizontalement. Pour une version chaude, placez la garniture cuite et le fromage, en réservant les crudités et sauces froides pour la sortie du four. Pour une version fraîche, répartissez tous les ingrédients dans le pain tiédi.' : 'Ouvrez le pain horizontalement. Étalez la sauce ou le beurre prévu ; répartissez la garniture, le fromage et les crudités en couches régulières, puis refermez.';
  const assembleEn = familyId==='tartine' ? 'Spread the listed toppings over the bread slices: start with the butter, ricotta, sauce or avocado as applicable, then arrange the remaining ingredients. Finish with the listed herbs, walnuts or drizzle of honey. Serve open-faced, without another slice on top.' : familyId==='pita'||familyId==='batbout' ? 'Carefully open a pocket in the bread. Add the sauce, filling and salad without packing too tightly.' : ['greek_pita','laffa','piadina'].includes(familyId) ? 'Spread the sauce on the bread, place the filling and salad down the centre, then fold or roll, tucking in the base.' : familyId==='pan_bagnat' ? 'Split the bread. For the Niçois version, rub the listed garlic on the crumb and distribute the listed oil and tomato juices. Layer the filling, close and press gently.' : familyId==='panuozzo' ? 'Split the bread horizontally. For a hot version, add the cooked filling and cheese, reserving salad and cold sauces until after the oven. For a fresh version, arrange all the ingredients in the warmed bread.' : 'Split the bread horizontally. Spread the listed sauce or butter, arrange the filling, cheese and salad in even layers, then close.';
  add('assemble','Garnir','Fill the bread',assembleFr,assembleEn,4,'assemble');
  if (familyId==='panuozzo') add('finish','Finir au four','Finish in the oven','Pour une garniture chaude, remettez le pain garni de viande cuite et de fromage 3–5 min au four à 220 °C, jusqu’au fromage fondu ; les restes de viande doivent atteindre 74 °C. Ajoutez ensuite la roquette, les crudités et les sauces froides. Pour une version fraîche, garnissez le pain simplement tiédi.','For a hot filling, return the bread with cooked meat and cheese to a 220°C oven for 3–5 minutes until the cheese melts; leftover meat must reach 74°C. Add rocket, salad and cold sauces afterwards. For a fresh version, fill bread that has only been warmed.',5,'cook');
  if (familyId==='pan_bagnat') add('rest','Laisser les saveurs se mêler','Let the flavours settle','Emballez le sandwich et laissez-le reposer 20 min au réfrigérateur à 4 °C ou moins. Gardez-le au frais jusqu’au repas.','Wrap the sandwich and rest for 20 minutes in the refrigerator at 4°C or below. Keep chilled until serving.',20,'chill');
  add('serve','Servir ou garder au frais','Serve or chill',perishableSafe.fr,perishableSafe.en,0,'chill');
  if (vegetarian && ingredients.some(i=>SANDWICH_INGREDIENTS[i.ingredientId].category==='dairy')) steps[0].instruction = text(`${steps[0].instruction.fr} Pour une version végétarienne, choisissez des fromages étiquetés végétariens (présure non animale).`,`${steps[0].instruction.en} For a vegetarian version, choose cheese labelled vegetarian (non-animal rennet).`);
  return steps;
}
export const SANDWICH_RECIPES: SandwichRecipe[] = recipeRows.map(([familyId,slug,fr,en,kind,lighter,encoded])=>{
  const info=SANDWICH_FAMILIES.find(f=>f.id===familyId)!;
  const ingredients=encoded.split(' ').map(part=>{const [ingredientId,grams,optionalGrams]=part.split(':');return {ingredientId,grams:Number(grams),...(optionalGrams?{optionalGrams:Number(optionalGrams)}:{})};});
  const vegetarian=ingredients.every(i=>SANDWICH_INGREDIENTS[i.ingredientId].vegetarian);
  const id=`${familyId}-${slug}`;
  return {id,familyId,name:text(fr,en),kind,lighter,vegetarian,ingredients,steps:buildSandwichSteps(id,familyId,ingredients.filter(i=>i.grams>0),vegetarian),allergens:[...new Set<SandwichAllergen>(['gluten',...ingredients.flatMap(i=>SANDWICH_INGREDIENTS[i.ingredientId].allergens)])],image:`/images/approved/sandwich/${id}.webp`,breadGrams:id==='pain_mie-club-sandwich'?90:info.breadGrams,...(familyId==='pain_mie'?{breadSlices:id==='pain_mie-club-sandwich'?3:2}:{}),sourceIds:familyId==='pan_bagnat'&&kind==='classic'?['nice-pan-bagnat']:familyId==='piadina'&&kind==='classic'?['romagna-piadina']:['bakerhub-editorial']};
});
const recipeEnergy = (r:SandwichRecipe) => r.breadGrams*SANDWICH_FAMILIES.find(f=>f.id===r.familyId)!.breadKcalPer100g/100+r.ingredients.reduce((sum,i)=>sum+i.grams*SANDWICH_INGREDIENTS[i.ingredientId].kcalPer100g/100,0);
// "Lighter" means >=20% less estimated energy than this family's classic recipes,
// at the SAME stated bread mass. It is not a health claim or a tradition claim.
for (const f of SANDWICH_FAMILIES) {
  const classics=SANDWICH_RECIPES.filter(r=>r.familyId===f.id&&r.kind==='classic');
  f.comparisonKcal=classics.reduce((sum,r)=>sum+recipeEnergy(r),0)/classics.length;
  for(const recipe of SANDWICH_RECIPES.filter(r=>r.familyId===f.id)) recipe.lighter=recipe.lighter&&recipeEnergy(recipe)<=f.comparisonKcal*.8;
}
