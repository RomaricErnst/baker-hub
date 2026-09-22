export type SandwichFamily = 'baguette' | 'focaccia' | 'bagel' | 'pita' | 'greek_pita' | 'kebab_bread' | 'batbout' | 'laffa' | 'piadina' | 'pan_bagnat' | 'ciabatta' | 'panuozzo' | 'tartine';
export type SandwichText = { fr: string; en: string };
export type SandwichAllergen = 'gluten' | 'milk' | 'egg' | 'fish' | 'sesame' | 'nuts' | 'mustard' | 'soy';
export interface SandwichIngredient { id: string; name: SandwichText; kcalPer100g: number; allergens: SandwichAllergen[]; vegetarian: boolean; category: 'vegetables' | 'protein' | 'dairy' | 'pantry' | 'bread'; source: string; referenceFood: string; provenance: 'generic-food-estimate'; }
export interface SandwichPortion { ingredientId: string; grams: number; optionalGrams?: number; }
export interface SandwichStep { id: string; title: SandwichText; instruction: SandwichText; minutes: number; phase: 'prep' | 'cook' | 'assemble' | 'chill'; }
export interface SandwichRecipe { id: string; familyId: SandwichFamily; name: SandwichText; kind: 'classic' | 'inspired'; lighter: boolean; vegetarian: boolean; ingredients: SandwichPortion[]; steps: SandwichStep[]; allergens: SandwichAllergen[]; image: string; breadGrams: number; sourceIds: string[]; }
export interface SandwichFamilyInfo { id: SandwichFamily; name: SandwichText; image: string; breadGrams: number; breadKcalPer100g: number; comparisonKcal: number; }
const text = (fr: string, en: string): SandwichText => ({fr, en});
const family = (id: SandwichFamily, fr: string, en: string, breadGrams: number, breadKcalPer100g: number, comparisonKcal: number): SandwichFamilyInfo => ({id,name:text(fr,en),image:`/images/approved/bread/${id}-rustic.webp`,breadGrams,breadKcalPer100g,comparisonKcal});
export const SANDWICH_FAMILIES: SandwichFamilyInfo[] = [
  {...family('tartine','Pain en tranches','Sliced bread',60,250,350),image:'/images/approved/bread/campagne-rustic.webp'},
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
 ['ham','Jambon blanc cuit','Cooked ham',145,'protein',[],false],['chicken','Blanc de poulet déjà cuit','Cooked chicken breast',165,'protein',[],false],
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
 ['pita','poulet-shawarma','Poulet façon shawarma','Shawarma-inspired chicken','inspired',false,'chicken:100 yogurt:35 olive_oil:8 cumin:1 paprika:1 cabbage:40 pickle:20'],
 ['pita','aubergine-oeuf','Aubergine, œuf et tahini','Aubergine, egg & tahini','inspired',false,'aubergine:100 egg:60 tahini:18 olive_oil:8 parsley:5'],
 ['pita','agneau','Agneau, crudités et yaourt','Lamb, salad & yogurt','classic',false,'lamb:110 yogurt:30 tomato:50 onion:20 olive_oil:5'],
 ['pita','poulet-citron','Poulet citron et concombre','Lemon chicken & cucumber','inspired',true,'chicken:65 yogurt:25 cucumber:70 lettuce:20 lemon:8'],
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
 ['laffa','shawarma-poulet','Poulet façon shawarma','Shawarma-inspired chicken','inspired',false,'chicken:120 tahini:25 tomato:55 pickle:30 olive_oil:8 cumin:1 paprika:1'],
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
  const has = (ingredientId: string) => ingredients.some(i=>i.ingredientId===ingredientId);
  const steps: SandwichStep[] = [];
  const add = (key:string,fr:string,en:string,frInstruction:string,enInstruction:string,minutes:number,phase:SandwichStep['phase']) => steps.push({id:`${id}-${key}`,title:text(fr,en),instruction:text(frInstruction,enInstruction),minutes,phase});
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
  add('prep','Préparer la garniture','Prepare the filling','Lavez et séchez les légumes et les herbes. Émincez les crudités, râpez la carotte si présente. Égouttez les conserves et les fromages indiqués égouttés. Pesez les quantités par sandwich.','Wash and dry the vegetables and herbs. Thinly slice salad vegetables; grate carrot if included. Drain canned ingredients and cheeses labelled drained. Weigh the amounts per sandwich.',8,'prep');
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
  if (familyId==='bagel') add('bread','Ouvrir et toaster','Split and toast','Coupez le bagel horizontalement. Toastez les faces coupées 2–3 min si souhaité, puis laissez tiédir avant le fromage frais ou le saumon.','Split the bagel horizontally. Toast the cut sides for 2–3 minutes if desired, then let cool slightly before adding cream cheese or salmon.',3,'cook');
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
  return {id,familyId,name:text(fr,en),kind,lighter,vegetarian,ingredients,steps:buildSandwichSteps(id,familyId,ingredients.filter(i=>i.grams>0),vegetarian),allergens:[...new Set<SandwichAllergen>(['gluten',...ingredients.flatMap(i=>SANDWICH_INGREDIENTS[i.ingredientId].allergens)])],image:`/images/approved/sandwich/${id}.webp`,breadGrams:info.breadGrams,sourceIds:familyId==='pan_bagnat'&&kind==='classic'?['nice-pan-bagnat']:familyId==='piadina'&&kind==='classic'?['romagna-piadina']:['bakerhub-editorial']};
});
const recipeEnergy = (r:SandwichRecipe) => r.breadGrams*SANDWICH_FAMILIES.find(f=>f.id===r.familyId)!.breadKcalPer100g/100+r.ingredients.reduce((sum,i)=>sum+i.grams*SANDWICH_INGREDIENTS[i.ingredientId].kcalPer100g/100,0);
// "Lighter" means >=20% less estimated energy than this family's classic recipes,
// at the SAME stated bread mass. It is not a health claim or a tradition claim.
for (const f of SANDWICH_FAMILIES) {
  const classics=SANDWICH_RECIPES.filter(r=>r.familyId===f.id&&r.kind==='classic');
  f.comparisonKcal=classics.reduce((sum,r)=>sum+recipeEnergy(r),0)/classics.length;
  for(const recipe of SANDWICH_RECIPES.filter(r=>r.familyId===f.id)) recipe.lighter=recipe.lighter&&recipeEnergy(recipe)<=f.comparisonKcal*.8;
}
