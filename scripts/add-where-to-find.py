#!/usr/bin/env python3
"""Insert whereToFind blocks into toppingDatabase.ts."""

FILE = '/Users/romaricernst/baker-hub/app/lib/toppingDatabase.ts'

with open(FILE, 'r') as f:
    content = f.read()

# In Python triple-quoted strings, single quotes don't need escaping.
# All apostrophes in shop names appear as-is.
# TS strings that contain apostrophes use double-quoted TS strings (e.g. "Ryan's Grocery").
WHERE_TO_FIND = {}

WHERE_TO_FIND['san_marzano'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant'], online: ['RedMart'], note: "Mutti Polpa easiest; Annalisa whole peeled at Marketplace" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais'], note: 'San Marzano DOP in most large supermarkets — canned tomato aisle' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Italian specialty stores'], online: ['Amazon', 'Eataly online'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado'], online: ['Ocado'], note: 'Look for DOP label — Mutti or Cirio brand' },
      australia: { shops: ['Harris Farm', 'Coles', 'IGA'], online: ['Amazon AU'], note: 'Mutti Polpa widely available' },
    },"""

WHERE_TO_FIND['fior_di_latte'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', "Huber's Butchery", 'Marketplace'], note: "Any fresh mozzarella ball — 'fior di latte' label rare, fresh mozzarella works identically" },
      france:    { shops: ['Grand Frais', 'Italian delis', 'Monoprix'], note: "Boule de mozzarella fraîche — look for 'au lait de vache' on label" },
      uk:        { shops: ['Waitrose', 'M&S', 'Lina Stores', 'Italian delis'] },
      australia: { shops: ['Coles', 'Woolworths Macro', 'Italian delis'], note: 'Fresh mozzarella balls — look for fridge section near deli counter' },
    },"""

WHERE_TO_FIND['mozzarella_lm'] = """\
    whereToFind: {
      singapore: { shops: ['NTUC FairPrice', 'Cold Storage', 'Giant'], online: ['RedMart'], note: "Kraft or Perfect Italiano brand — look for 'pizza mozzarella' block in cheese section" },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix'], note: 'Mozzarella râpée or mozzarella pour pizza — most supermarkets stock it' },
      us:        { shops: ['Any grocery store'], note: "Polly-O, Sargento, Kraft all work — look for 'low-moisture' or 'part-skim' block" },
      uk:        { shops: ['Any supermarket'], note: 'Galbani mozzarella for pizza — block form in cheese aisle' },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'], note: 'Perfect Italiano pizza mozzarella block — cheese aisle' },
    },"""

WHERE_TO_FIND['burrata'] = """\
    whereToFind: {
      singapore: { shops: ['Marketplace', "Ryan's Grocery", 'Culina', "Huber's Butchery"], note: "Call ahead — stock varies. Ryan's and Culina most reliable" },
      france:    { shops: ['Grand Frais', 'Italian delis', 'Monoprix', 'La Grande Épicerie'], note: 'Now widely available in most major French supermarkets' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Italian markets'], online: ['Eataly online', "Murray's Cheese"], note: 'Fresh burrata — refrigerated section near specialty cheeses' },
      uk:        { shops: ['Waitrose', 'M&S', 'Lina Stores', 'Ocado'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'Italian delis', 'Woolworths Metro'], note: 'Availability growing — Harris Farm most reliable' },
    },"""

WHERE_TO_FIND['stracciatella'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: 'Less common than burrata — call ahead. Burrata cream pulled apart is an excellent substitute' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'Grand Frais'], note: 'Rare in standard supermarkets — Italian speciality delis most reliable' },
      uk:        { shops: ['Lina Stores', 'Melrose & Morgan', 'good Italian delis'], online: ['Ocado (seasonal)'], note: 'Uncommon outside specialist shops — burrata is a reliable substitute' },
    },"""

WHERE_TO_FIND['stracchino'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina'], note: 'Very rare — call ahead. Taleggio is the best substitute if unavailable' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie'], note: 'Rare outside Italian speciality shops — crescenza is the same cheese' },
      uk:        { shops: ['Lina Stores', 'Gelupo', 'specialist Italian delis'], note: 'Not found in supermarkets — Italian delis only' },
    },"""

WHERE_TO_FIND['gorgonzola'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], online: ['RedMart'], note: "Gorgonzola dolce (creamy) preferred over piccante (aged) for pizza" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'fromageries'], note: 'Well stocked in most supermarkets and cheese shops' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Costco'], online: ["Murray's Cheese"], note: "Look for 'dolce' style" },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's", 'Ocado'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Coles', 'Woolworths', 'IGA'], note: 'Gorgonzola dolce in most major supermarkets' },
    },"""

WHERE_TO_FIND['taleggio'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Usually in stock at Ryan's and Culina — call ahead to confirm" },
      france:    { shops: ['Grand Frais', 'fromageries', 'Monoprix', 'La Grande Épicerie'], note: 'Available in most fromageries and Grand Frais cheese counters' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado'], online: ['Ocado'], note: 'Widely available in supermarkets with good cheese sections' },
    },"""

WHERE_TO_FIND['pecorino_romano'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], note: 'Grated Pecorino Romano in most Cold Storage locations — DOP label preferred' },
      france:    { shops: ['Carrefour', 'Monoprix', 'Italian delis'], note: 'Pecorino Romano râpé — available in most supermarkets. Grand Frais has best selection' },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'any grocery store'], note: 'Locatelli brand is excellent and widely available' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA', 'Italian delis'] },
    },"""

WHERE_TO_FIND['parmigiano'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], online: ['RedMart'], note: 'Pre-grated tubs at most Cold Storage — a wedge is better value and fresher' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'Grand Frais'], note: 'Parmigiano Reggiano AOP — ubiquitous in France. Buy a wedge, not pre-grated' },
      us:        { shops: ['Whole Foods', 'Costco (great value)', 'any grocery store'], note: 'Costco sells large wedges at excellent value' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado', 'Costco'], note: 'Widely available — Grana Padano is a great budget alternative' },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm', 'IGA'] },
    },"""

WHERE_TO_FIND['raclette'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery"], note: 'Swiss Raclette (not French AOP) usually in stock — Gruyère is an easy substitute' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Grand Frais', 'fromageries'], note: 'Raclette AOP and standard Raclette both widely available — essential alpine cheese in France' },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado'], online: ['Ocado'], note: 'Available in most major supermarkets with good cheese sections' },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'French delis'], note: "Less common — Gruyère is an easy substitute at any supermarket" },
    },"""

WHERE_TO_FIND['brie'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant', "Ryan's Grocery"], online: ['RedMart'], note: 'President Brie or Ile de France — most supermarkets have it' },
      france:    { shops: ['Any supermarket or fromagerie'], note: 'Brie de Meaux AOP or Brie de Melun AOP — buy from a fromagerie for best quality' },
      us:        { shops: ['Any supermarket', "Trader Joe's", 'Whole Foods'], note: 'Widely available — look for a French import for best melt' },
      uk:        { shops: ['Any supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'] },
    },"""

WHERE_TO_FIND['camembert'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant'], note: 'President Camembert widely available — small round boxes in cheese aisle' },
      france:    { shops: ['Any supermarket or fromagerie'], note: 'Camembert de Normandie AOP — get it from a fromagerie for raw milk version' },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'Ocado'] },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm'] },
    },"""

WHERE_TO_FIND['reblochon'] = """\
    whereToFind: {
      singapore: { shops: ['Marketplace', "Ryan's Grocery"], note: 'Seasonal availability — call ahead. Brie is the easiest substitute' },
      france:    { shops: ['Carrefour', 'Grand Frais', 'fromageries', 'Leclerc'], note: 'Reblochon AOP — widely available in France, especially in winter/autumn' },
      uk:        { shops: ['Waitrose', 'M&S', 'specialist cheesemongers'], online: ['Ocado'], note: 'Available but less common — Waitrose most reliable' },
    },"""

WHERE_TO_FIND['maroilles'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery (call ahead)", 'Culina'], note: 'Very rare — Munster or strong washed-rind brie is the best substitute' },
      france:    { shops: ['Carrefour', 'Leclerc', 'fromageries', 'Grand Frais'], note: 'Maroilles AOP — widely available in France, especially in the north' },
      uk:        { shops: ['Specialist cheesemongers', 'La Fromagerie (London)'], note: 'Very rare in UK supermarkets — Munster is the best substitute' },
    },"""

WHERE_TO_FIND['ossau_iraty'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Marketplace'], note: 'Manchego is a reliable substitute available at Cold Storage' },
      france:    { shops: ['Grand Frais', 'fromageries', 'Carrefour', 'Monoprix'], note: 'Ossau-Iraty AOP — common in France, especially in southwest and Paris shops' },
      uk:        { shops: ['Waitrose', "Neal's Yard Dairy", 'specialist cheesemongers'], online: ['Ocado'] },
    },"""

WHERE_TO_FIND['labneh'] = """\
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Al-Ansar grocery', 'Middle Eastern shops'], online: ['RedMart (Puck brand)'], note: 'Puck cream cheese labneh at Mustafa or online — thick Greek yogurt strained overnight is a great substitute' },
      france:    { shops: ['Monoprix', 'Carrefour', 'épiceries du Moyen-Orient'], note: 'Available in most Monoprix locations and Middle Eastern grocers' },
      us:        { shops: ['Whole Foods', 'Middle Eastern grocery stores', "Trader Joe's (seasonal)"], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern grocery stores'], online: ['Ocado'], note: 'Al Wadi or Puck brand — now in most major UK supermarkets' },
      australia: { shops: ['Harris Farm', 'Middle Eastern delis', 'IGA'], note: 'Becoming more available — Middle Eastern delis most reliable' },
    },"""

WHERE_TO_FIND['nduja'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', "Huber's Butchery"], note: 'Call ahead — availability varies. Chorizo paste is an easy substitute' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'Monoprix (some locations)'], online: ['Amazon FR'], note: "'Nduja in jars now at some Monoprix — Italian delis most reliable" },
      us:        { shops: ['Whole Foods', 'Eataly', 'Italian delis'], online: ['Eataly online', 'Amazon'], note: 'Becoming more mainstream — Whole Foods usually carries it' },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's"], online: ['Ocado'], note: 'Now in most major UK supermarkets — great availability' },
      australia: { shops: ['Harris Farm', 'Italian delis', 'Simon Johnson'], note: 'Less common — Italian delis most reliable' },
    },"""

WHERE_TO_FIND['guanciale'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", "Huber's Butchery", 'Culina'], note: 'Specialty item — call ahead. Pancetta is the best substitute' },
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'specialist charcuteries'], note: 'Rare in standard supermarkets — Italian delis and charcuteries most reliable' },
      us:        { shops: ['Eataly', 'Italian specialty stores'], online: ['Amazon', 'Di Bruno Bros'], note: 'Specialty item — online ordering most reliable outside major cities' },
      uk:        { shops: ['Lina Stores', 'Natoora', 'Italian delis'], note: 'Specialist only — Pancetta is widely available and works well' },
    },"""

WHERE_TO_FIND['prosciutto'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Culina'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'charcuteries'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'any grocery store'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm', 'IGA'] },
    },"""

WHERE_TO_FIND['speck'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Marketplace', 'Culina'], note: 'Less common than prosciutto — smoked ham works well as substitute' },
      france:    { shops: ['Grand Frais', 'Italian delis', 'La Grande Épicerie'], note: 'Available at Italian delis and Grand Frais — less common in standard supermarkets' },
      us:        { shops: ['Eataly', 'Whole Foods (some)', 'Italian delis'], online: ['Amazon', 'Eataly online'] },
      uk:        { shops: ['Waitrose', 'Natoora', 'Lina Stores'], online: ['Ocado'] },
    },"""

WHERE_TO_FIND['bresaola'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: 'Available at specialty delis — call ahead' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'La Grande Épicerie', 'Monoprix (some)'] },
      uk:        { shops: ['Waitrose', 'M&S', "Sainsbury's", 'Italian delis'], online: ['Ocado'] },
    },"""

WHERE_TO_FIND['mortadella'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Growing availability — Ryan's most reliable" },
      france:    { shops: ['Italian delis', 'Grand Frais', 'La Grande Épicerie', 'Monoprix (some)'], note: 'Mortadelle de Bologne — Italian delis and Grand Frais best' },
      uk:        { shops: ['Waitrose', 'Lina Stores', 'Natoora', 'Italian delis'], online: ['Ocado'] },
    },"""

WHERE_TO_FIND['lardo'] = """\
    whereToFind: {
      france:    { shops: ['Italian delis', 'La Grande Épicerie', 'specialist charcuteries'], note: 'Rare even in France — Lardo di Colonnata DOP from Italian delis' },
      us:        { shops: ['Eataly', 'specialty Italian stores'], online: ['Di Bruno Bros', 'Formaggio Kitchen'], note: 'Online ordering most reliable outside major cities' },
      uk:        { shops: ['Lina Stores', 'Natoora', 'Borough Market'], note: 'Specialist only — worth finding for the right pizza' },
    },"""

WHERE_TO_FIND['salsiccia'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", "Huber's Butchery", 'Culina'], note: 'Italian-style pork sausage — any good pork sausage with fennel works' },
      france:    { shops: ['Italian delis', 'Grand Frais', 'some charcuteries'], note: 'Saucisse italienne or chair à saucisse — butchers can make fresh on request' },
      uk:        { shops: ['Italian delis', 'Waitrose (Italian sausages)', 'Natoora'], online: ['Ocado'] },
    },"""

WHERE_TO_FIND['jamon'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace', 'Cold Storage'], note: "Jamón Serrano widely available — Ibérico at Ryan's and Culina" },
      france:    { shops: ['Carrefour', 'Monoprix', 'charcuteries espagnoles', 'Grand Frais'], note: 'Jamón Serrano in all supermarkets; Ibérico at specialty delis' },
      us:        { shops: ['Whole Foods', "Trader Joe's (Serrano)", 'Spanish specialty stores'], online: ['La Tienda', 'Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'M&S', 'any major supermarket'] },
      australia: { shops: ['Harris Farm', 'Spanish delis', 'Woolworths (Serrano)'] },
    },"""

WHERE_TO_FIND['sobrasada'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery (call ahead)", 'Culina'], note: "Rare — Nduja is the most widely available substitute" },
      france:    { shops: ['Épiceries espagnoles', 'Grand Frais', 'La Grande Épicerie'], note: 'Available in Spanish specialty shops and some Grand Frais locations' },
      us:        { shops: ['Spanish specialty stores', 'La Tienda'], online: ['La Tienda', 'Amazon'] },
      uk:        { shops: ['Brindisa (London)', 'Spanish delis'], online: ['Brindisa online'] },
    },"""

WHERE_TO_FIND['merguez'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'halal butchers', 'Arab Street area shops'], note: 'Available at halal butchers — spiced lamb sausage' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'boucheries halal'], note: 'Very widely available in France — standard supermarket item' },
      uk:        { shops: ["Sainsbury's", 'Waitrose', 'Middle Eastern butchers'], online: ['Ocado'] },
      australia: { shops: ['Middle Eastern butchers', 'specialty delis'], note: 'Less common — halal butchers most reliable' },
    },"""

WHERE_TO_FIND['chorizo'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Giant'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'charcuteries'] },
      us:        { shops: ['Any grocery store', "Trader Joe's", 'Whole Foods'] },
      uk:        { shops: ['Any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA', 'Harris Farm'] },
    },"""

WHERE_TO_FIND['anchovies'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', 'Giant', 'NTUC FairPrice'], online: ['RedMart'], note: 'Roland or Ortiz brand — olive oil packed in the canned fish aisle' },
      france:    { shops: ['Any supermarket'], note: "Filets d'anchois à l'huile — ubiquitous in France" },
      us:        { shops: ['Any grocery store'], note: 'Ortiz (premium) or any jarred anchovies in olive oil' },
      uk:        { shops: ['Any major supermarket'] },
      australia: { shops: ['Coles', 'Woolworths', 'IGA'] },
    },"""

WHERE_TO_FIND['smoked_salmon'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Giant'], online: ['RedMart'] },
      france:    { shops: ['Carrefour', 'Monoprix', 'Grand Frais', 'fishmongers'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Costco', 'any grocery store'] },
      uk:        { shops: ['Any supermarket'], note: 'Smoked salmon is a British staple — excellent quality widely available' },
      australia: { shops: ['Coles', 'Woolworths', 'Harris Farm'] },
    },"""

WHERE_TO_FIND['harissa_base'] = """\
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Cold Storage (some locations)', 'Middle Eastern shops'], online: ['RedMart', 'Lazada'], note: "Le Phare du Cap Bon (tube) at Mustafa Centre most reliable" },
      france:    { shops: ['Carrefour', 'Monoprix', 'Leclerc', 'épiceries du Maghreb'], note: 'Harissa très répandue en France — tubes et bocaux dans tous les supermarchés' },
      us:        { shops: ['Whole Foods', "Trader Joe's (seasonal)", 'Middle Eastern grocery stores'], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern shops', 'any major supermarket'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'IGA', 'Middle Eastern delis', 'Woolworths (some)'] },
    },"""

WHERE_TO_FIND['zaatar_mix'] = """\
    whereToFind: {
      singapore: { shops: ['Mustafa Centre', 'Jamal Kazura', 'Arab Street area shops', 'Phoon Huat'], note: "Za'atar blend at Mustafa Centre — great value and quality" },
      france:    { shops: ['Épiceries du Moyen-Orient', 'Carrefour (some)', 'Monoprix (some)'], note: 'Disponible dans les épiceries du Moyen-Orient et certains supermarchés' },
      us:        { shops: ['Whole Foods', 'Middle Eastern grocery stores', "Trader Joe's (seasonal)"], online: ['Amazon', "Kalustyan's"] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Middle Eastern grocery stores'], online: ['Ocado'] },
      australia: { shops: ['Middle Eastern delis', 'Harris Farm (some)', 'IGA', 'spice shops'] },
    },"""

WHERE_TO_FIND['miso_paste'] = """\
    whereToFind: {
      singapore: { shops: ['Meidi-Ya', 'Don Don Donki', 'Isetan B2', 'any Japanese supermarket'], online: ['RedMart'], note: 'Shiro (white) miso — abundant in Singapore. Any Japanese supermarket' },
      france:    { shops: ['Naturalia', "Bio c'Bon", 'Asian supermarkets', 'Monoprix (some)'], online: ['Amazon FR'], note: 'Miso blanc in organic and Asian grocery stores' },
      us:        { shops: ['Whole Foods', 'any Asian grocery store', "Trader Joe's (white miso)"], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Japan Centre', 'Asian supermarkets'], online: ['Ocado', 'Japan Centre online'] },
      australia: { shops: ['Asian grocery stores', 'Woolworths (some)', 'Harris Farm'], note: 'Any Japanese or Asian grocery — white miso widely available' },
    },"""

WHERE_TO_FIND['mentaiko'] = """\
    whereToFind: {
      singapore: { shops: ['Don Don Donki', 'Meidi-Ya', 'Isetan supermarket'], note: 'Fresh mentaiko in the seafood/deli section — Don Don Donki most reliable and affordable' },
      us:        { shops: ['Japanese grocery stores', 'Mitsuwa', 'Nijiya Market'], online: ['Amazon (frozen)', 'Weee! grocery'] },
      australia: { shops: ['Japanese grocery stores', 'Fuji Mart', 'Tokyo Mart'], note: 'Japanese specialty grocery stores — major cities only' },
    },"""

WHERE_TO_FIND['kimchi'] = """\
    whereToFind: {
      singapore: { shops: ['NTUC FairPrice', 'Don Don Donki', 'Cold Storage', 'Korean grocery stores'], online: ['RedMart'] },
      france:    { shops: ['Épiceries coréennes et asiatiques', 'K-Market', 'Tang Frères'], online: ['Amazon FR'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'Korean grocery stores (H-Mart)', 'any major grocery'], online: ['Amazon', 'Weee!'] },
      uk:        { shops: ["Sainsbury's", 'Waitrose', 'Korean grocery stores', 'Wing Yip'], online: ['Ocado'] },
      australia: { shops: ['Woolworths', 'Coles (some)', 'Korean grocery stores', 'Asian supermarkets'] },
    },"""

WHERE_TO_FIND['truffle_oil'] = """\
    whereToFind: {
      singapore: { shops: ['Cold Storage', 'Marketplace', "Ryan's Grocery", 'Culina'], online: ['RedMart', 'Lazada'], note: 'Tartufi Jimmy or Roland brand — avoid very cheap versions with no real truffle' },
      france:    { shops: ['Carrefour', 'Monoprix', 'La Grande Épicerie', 'specialty oil shops'] },
      us:        { shops: ['Whole Foods', "Trader Joe's", 'specialty food stores'], online: ['Amazon'] },
      uk:        { shops: ['Waitrose', "Sainsbury's", 'Ocado', 'any major supermarket'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'Coles (some)', 'specialty delis'] },
    },"""

WHERE_TO_FIND['duck_confit'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace', 'Cold Storage (jarred)'], note: 'Jarred duck confit (Maison Montfort or similar) in the specialty/French section' },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'any supermarket'], note: 'Confit de canard en bocal — essential French pantry item, in every supermarket' },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado'], online: ['Ocado'], note: 'Duck confit pouches — Waitrose and M&S both stock reliably' },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'specialty delis', 'Woolworths Metro (some)'], note: 'Jarred or vacuum-packed confit — specialty delis most reliable' },
    },"""

WHERE_TO_FIND['foie_gras'] = """\
    whereToFind: {
      singapore: { shops: ["Ryan's Grocery", 'Culina', 'Marketplace'], note: "Fresh foie gras rare — bloc de foie gras (preserved) at Culina and Ryan's" },
      france:    { shops: ['Carrefour', 'Leclerc', 'Monoprix', 'épiceries fines', 'Périgord speciality shops'], note: 'Foie gras de canard — standard supermarket item in France especially in southwest' },
      uk:        { shops: ['Selfridges Food Hall', 'Harvey Nichols', 'specialist delis'], note: 'Legal to sell in UK — Fortnum & Mason and Selfridges Food Hall carry it' },
    },"""

WHERE_TO_FIND['pistachios_pesto'] = """\
    whereToFind: {
      singapore: { shops: ['Phoon Huat', 'Cold Storage', 'Marketplace'], note: 'Raw pistachios for blending at Phoon Huat — make pesto fresh. Jarred pistachio pesto at Culina' },
      france:    { shops: ['Monoprix', 'Carrefour', 'Italian delis'], note: 'Pesto de pistaches en pot — available at Italian delis and some Monoprix' },
      us:        { shops: ["Trader Joe's (pistachio pesto jar)", 'Whole Foods', 'Italian specialty stores'], online: ['Amazon', 'Eataly'] },
      uk:        { shops: ['Waitrose', 'M&S', 'Ocado', 'Italian delis'], online: ['Ocado'] },
      australia: { shops: ['Harris Farm', 'Simon Johnson', 'specialty delis'], note: 'Pistachio nuts widely available — make pesto fresh or find jarred version at delis' },
    },"""


def add_where_to_find(content, ingredient_id, where_block):
    id_pattern = f"id: '{ingredient_id}'"
    id_pos = content.find(id_pattern)
    if id_pos == -1:
        print(f"  ERROR: Could not find id: '{ingredient_id}'")
        return content

    block_open = content.rfind('{\n', 0, id_pos)

    pos = block_open
    depth = 1
    pos += 1
    while pos < len(content) and depth > 0:
        ch = content[pos]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        pos += 1
    block_end = pos

    block_content = content[block_open:block_end]
    if 'whereToFind' in block_content:
        print(f"  SKIP: {ingredient_id} already has whereToFind")
        return content

    close_brace_pos = block_end - 1
    line_start = content.rfind('\n', 0, close_brace_pos)
    insert_pos = line_start + 1

    insertion = where_block + '\n'
    new_content = content[:insert_pos] + insertion + content[insert_pos:]
    print(f"  OK: {ingredient_id}")
    return new_content


print("Adding whereToFind blocks...")
for ing_id, where_block in WHERE_TO_FIND.items():
    content = add_where_to_find(content, ing_id, where_block)

with open(FILE, 'w') as f:
    f.write(content)

print("\nDone.")
