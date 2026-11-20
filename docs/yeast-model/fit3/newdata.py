"""Phase 3 additions (read 19 Nov 2026). Every dose is instant yeast (IDY) % of the fermenting flour:
fresh / 3, active dry / 1.33 (x 0.75), unless the source states its own conversion. 'dry' or
'type unstated' is AMBIGUOUS: IDY is used and `idy_alt` holds the active-dry reading for the
sensitivity run. Assumptions are in `note`."""

F = 1 / 3.0          # fresh -> IDY
A = 1 / 1.33         # active dry -> IDY
TEMPER = (2.0, 21.0)

def row(i, source, url, quote, ytype, given, basis, idy, seg, T0, medium='dough', endpoint='ready', conf='table', note='', alt=None):
    return dict(id=i, source=source, url=url, quote=quote, yeast_type=ytype, dose_as_given=given, basis=basis,
                dose=idy, idy_alt=alt, seg=seg, T0=T0, medium=medium, endpoint=endpoint, conf=conf, note=note)

BL = 'https://www.biancolievito.it/en/biga-poolish'
FB = 'https://fond.kitchen/glossary/biga/'
JB = 'https://jordospizzacalculator.com/guides/biga-pizza-dough'
PZ = 'https://pizzamateur.fr/blogs/actualites/levure-seche-fraiche-ou-levain-comment-bien-doser'
TG = 'https://teigformel.de/wissen/hefe-dosierung'
AG = 'https://www.agricolaconforti.it/pizza-perfetta-e-impasto-da-maestro/'
ZG = 'https://www.scattidigusto.it/lezioni-di-pizza-biga-vincente/'
cold = lambda h, f: [(0.25, 21.0), (h, f), TEMPER]

ROWS = [
 # --- biga ---------------------------------------------------------------------------------------
 row('N001', 'biancolievito.it', BL, 'Fresh Yeast: 1% of the flour weight ... Quick biga: 16 to 20 hours ... 18-19 C', 'fresh', '1 %', 'biga flour', 1 * F, [(18, 18.5)], 19, 'biga', 'ripe'),
 row('N002', 'biancolievito.it', BL, 'Long biga ... +4 C for 12 to 24 hours, then at 18 C for the last 24 hours (same 1 % fresh)', 'fresh', '1 %', 'biga flour', 1 * F, [(18, 4), (24, 18)], 19, 'biga', 'ripe'),
 row('N003', 'italianpizzasecrets.com', 'https://www.italianpizzasecrets.com/best-biga-pizza-recipe-for-home-oven/', '2.8 g Yeast (fresh) / 280 g flour ... mature at 16-18 C for 16/18 hours', 'fresh', '2.8 g / 280 g', 'biga flour', 1 * F, [(0.4, 21), (17, 17)], 20.5, 'biga', 'ripe'),
 row('N004', 'Ooni', 'https://ca.ooni.com/blogs/recipes/100-biga', '4 g fresh or 2 g active dried or 1.3 g instant dried / 1000 g flour ... 16 hours at room temperature', 'instant (fresh, ADY alternatives stated)', '1.3 g / 1000 g', 'biga flour (100 % biga)', 0.13, [(16, 21)], 22, 'biga', 'ripe', 'recipe', 'room temperature 21 C assumed'),
 row('N005', 'Burnhard', 'https://www.burnhard.com/en/recipes/pizza/pizza-dough-with-biga', '5 g yeast (fresh) / 500 g ... rise in the refrigerator for 48 hours', 'fresh', '5 g / 500 g', 'biga flour (100 % biga)', 1 * F, [(48, 5)], 21, 'biga', 'ripe', 'recipe', 'fridge temperature unstated (5 C assumed)'),
 row('N006', 'fond.kitchen', FB, '0.1 % ... instant ... 12-16 hours at 18-20 C', 'instant', '0.1 %', 'biga flour', 0.1, [(14, 19)], 19, 'biga', 'ripe'),
 row('N007', 'fond.kitchen', FB, 'Longer fermentation at 15-16 C (18-24 hours)', 'instant', '0.1 %', 'biga flour', 0.1, [(21, 15.5)], 15.5, 'biga', 'ripe'),
 row('N008', 'fond.kitchen', FB, 'shorter at 22-24 C (8-12 hours)', 'instant', '0.1 %', 'biga flour', 0.1, [(10, 23)], 23, 'biga', 'ripe'),
 row('N009', 'fond.kitchen', FB, 'room temperature for 2-3 hours, then refrigerate at 4-6 C for up to 48 hours. Remove it 1-2 hours before mixing', 'instant', '0.1 %', 'biga flour', 0.1, [(2.5, 19), (46, 5), (1.5, 21)], 19, 'biga', 'ripe', 'recipe'),
 row('N010', "Jordo's", JB, 'Biga yeast = biga flour x 0.1% ... 16-18C for 18-24 hours', 'unstated (AMBIGUOUS)', '0.1 %', 'biga flour', 0.1, [(21, 17)], 17, 'biga', 'ripe', alt=0.1 * A),
 row('N011', "Jordo's", JB, '18-22C for 12-16 hours (0.1%)', 'unstated (AMBIGUOUS)', '0.1 %', 'biga flour', 0.1, [(14, 20)], 20, 'biga', 'ripe', alt=0.1 * A),
 row('N012', "Jordo's", JB, '22-26C for 8-12 hours (0.05%)', 'unstated (AMBIGUOUS)', '0.05 %', 'biga flour', 0.05, [(10, 24)], 24, 'biga', 'ripe', alt=0.05 * A),
 row('N013', 'behindthecrust', 'https://behindthecrust.substack.com/p/biga-pizza-dough', '1 gram of dry yeast ... 660 g flour ... room temperature for about 16 hours', 'dry (AMBIGUOUS)', '1 g / 660 g', 'biga flour (100 % biga)', 1 / 6.6, [(16, 21)], 21, 'biga', 'ripe', 'recipe', 'room 21 C assumed', alt=1 / 6.6 * A),
 row('N014', 'Zaghini (Scatti di Gusto)', ZG, '1% lievito, calcolato sulla farina di biga ... Short biga: 16 hours ... 18-19 C', 'fresh (compressed; the final dough uses compressed yeast)', '1 %', 'biga flour', 1 * F, [(16, 18.5)], 20.5, 'biga', 'ripe'),
 row('N015', 'Zaghini (Scatti di Gusto)', ZG, 'Long biga: 48 hours, the first 24 hours refrigerated (4 C) and the next 24 at room temperature (18-19 C)', 'fresh', '1 %', 'biga flour', 1 * F, [(24, 4), (24, 18.5)], 20.5, 'biga', 'ripe'),
 # --- poolish ------------------------------------------------------------------------------------
 *[row(f'N0{16 + k}', 'biancolievito.it', BL, f'Poolish ready in {h} hours: {p}% fresh (final temperature about 23 C)', 'fresh', f'{p} %', 'poolish flour', p * F, [(h, 23)], 23, 'poolish', 'ripe')
   for k, (h, p) in enumerate([(2, 3), (4, 1.5), (8, 0.75), (12, 0.2), (18, 0.1)])],
 # --- room-temperature and cold doughs ------------------------------------------------------------
 *[row(f'N0{21 + k}', 'pizzamateur.fr', PZ, f'{h} h, {T} C: {p} % fresh', 'fresh', f'{p} %', 'total flour', p * F, [(h, T)], T)
   for k, (h, T, p) in enumerate([(2, 22, 1.25), (4, 22, 0.6), (8, 20, 0.3), (24, 18, 0.15)])],
 row('N025', 'pizzamateur.fr', PZ, '48 h, 4 C (fridge): 0.5-1 g fresh per kg', 'fresh', '0.075 %', 'total flour', 0.075 * F, cold(48, 4), 21, note='straight to fridge, 2 h temper assumed'),
 row('N026', 'pizzamateur.fr', PZ, '72 h, 4 C (fridge): 0.3-0.5 g fresh per kg', 'fresh', '0.04 %', 'total flour', 0.04 * F, cold(72, 4), 21, note='straight to fridge, 2 h temper assumed'),
 *[row(f'N0{27 + k}', 'teigformel.de', TG, f'Room temp {h} h, 20-22 C: Richtwert {p} % Frischhefe', 'fresh', f'{p} %', 'total flour', p * F, [(h, 21)], 21)
   for k, (h, p) in enumerate([(4, 0.8), (6, 0.45), (8, 0.28), (12, 0.15)])],
 *[row(f'N0{31 + k}', 'teigformel.de', TG, f'Cold ferment {h} h, 4 C: Richtwert {p} % Frischhefe', 'fresh', f'{p} %', 'total flour', p * F, cold(h, 4), 21, note='straight to fridge, 2 h temper assumed')
   for k, (h, p) in enumerate([(24, 0.2), (48, 0.1), (72, 0.05)])],
 row('N034', 'agricolaconforti.it', AG, 'Per 8 ore, 3-5 grammi [fresco per kg]', 'fresh', '4 g/kg', 'total flour', 0.4 * F, [(8, 22)], 23.5, conf='anecdote', note='no temperature stated: 22 C room, dough 23-24 C (stated target)'),
 row('N035', 'agricolaconforti.it', AG, 'Per 4 ore, 8-10 grammi', 'fresh', '9 g/kg', 'total flour', 0.9 * F, [(4, 22)], 23.5, conf='anecdote', note='no temperature stated: 22 C room assumed'),
]

# --- comparisons -----------------------------------------------------------------------------------
# kind 'dose': ratio of doses (hot or cold kitchen / reference) on the same schedule, each with its own path.
# kind 'time': ratio of times for the SAME dose (t_ref / t_other), constant temperatures.
def cmp(i, source, kind, ratio, ref, other, note, regime):
    return dict(id=i, source=source, kind=kind, ratio=ratio, ref=ref, other=other, note=note, regime=regime)

def P(h, T, T0=None, medium='dough'):
    return dict(seg=[(h, T)], T0=T if T0 is None else T0, medium=medium)

COMPARISONS = [
 cmp('C01', 'My Pizza Night', 'dose', 0.75, P(8, 17), P(8, 25.5), '"reduce your yeast by 20-30% compared to a winter kitchen at 17 C for the same fermentation time" (>=25 C; 25.5, 8 h assumed)', 'hot'),
 cmp('C02', 'fond.kitchen', 'dose', 0.75, P(7, 22, 24), P(7, 27, 23), '"use cold water and cut the yeast by 20-30%" (summer 27 C with cold water vs 22 C, 7 h assumed)', 'hot'),
 cmp('C03', 'biancolievito.it', 'dose', 0.7, P(18, 18.5, 19, 'biga'), P(18, 26, 19, 'biga'), 'biga: "Summer (room above 25 C): reduce fresh yeast to 0.7%" (from 1 %); water formula holds the biga at 18-20 C', 'hot'),
 cmp('C04', 'biancolievito.it', 'dose', 1.1, P(18, 18.5, 19, 'biga'), P(18, 14, 19, 'biga'), 'biga: "raise fresh yeast to 1.1%, but only if the room falls below 15 C"', 'cool'),
 cmp('C05', 'pizzamateur.fr', 'dose', 1.5, P(8, 20.5, 23.5), P(8, 17, 23.5), '"16 a 18 C (hiver) x1,5" vs 19-22 C; water to hold the dough at 23-24 C', 'cool'),
 cmp('C06', 'pizzamateur.fr', 'dose', 0.7, P(8, 20.5, 23.5), P(8, 24, 23.5), '"23 a 25 C x0,7"', 'rt_mild'),
 cmp('C07', 'pizzamateur.fr', 'dose', 0.5, P(8, 20.5, 23.5), P(8, 27, 23.5), '"26 a 28 C (ete) x0,5"; "je divise ma dose par deux au-dessus de 25 C"', 'hot'),
 cmp('C08', 'TFL Mini Oven', 'dose', 0.5, P(4, 24), P(4, 38, 30), '"cut the yeast amount in half" at 38 C (vs a temperate 24 C assumed)', 'hot'),
 cmp('C09', 'Pizzastunde', 'dose', 0.5, dict(seg=[(2, 22), (24, 4), (2, 22)], T0=23, medium='dough'), dict(seg=[(24, 4), (0.75, 35)], T0=23.5, medium='dough'),
     'normal 2 g fresh/kg vs 1 g/kg in 35 C summer: ice water (dough < 23-24 C), fridge only, 30-60 min warm-up (normal protocol assumed: 2 h RT, 24 h fridge, 2 h RT at 22 C)', 'hot'),
 cmp('C10', 'Pizzastunde', 'time', 24 / 9, P(24, 21), P(9, 35), 'a dough planned for 24 h at room temperature is "fully fermented in 8-10 hours" at 35 C (21 C reference assumed)', 'hot'),
 cmp('C11', 'technomitron (AAINB)', 'time', 3.0, P(1, 20), P(1, 30), '"At 30 C, fermentation is about three times faster than at 20 C"', 'rate'),
 cmp('C12', 'Reinhart (secondhand)', 'time', 2.0, P(1, 20), P(1, 29.4), '"For every 17 degree [F] increase ... the rate of fermentation doubles"', 'rate'),
 cmp('C13', 'Weekend Bakery', 'time', 4.0, P(1, 15), P(1, 30), 'a loaf proofing 4 h at 15 C takes about 1 h at 30 C', 'rate'),
 cmp('C14', 'fond.kitchen', 'time', 2.0, P(1, 18), P(1, 27), '"8-10 C warmer, about twice as fast"', 'rate'),
 cmp('C15', 'My Pizza Night', 'time', 2.0, P(1, 15), P(1, 25), '"roughly doubles with every 10 C increase"', 'rate'),
 cmp('C16', 'Biorito', 'time', 2.0, P(1, 17), P(1, 22), '"every five degrees less ... almost double the time"', 'rate'),
 cmp('C17', 'Bake Magazine', 'time', 2.6, P(1, 20), P(1, 30), '"a 1 C rise ... accelerate yeast activity by about 10 percent"', 'rate'),
 cmp('C18', 'Istudor 2020', 'rate', 1.079, 30, 33, 'CO2 33 vs 30 C, 1 h proving, 3 % CY', 'hot'),
 cmp('C19', 'Istudor 2020', 'rate', 1.216, 30, 36, 'CO2 36 vs 30 C', 'hot'),
 cmp('C20', 'Istudor 2020', 'rate', 1.52, 30, 39, 'CO2 39 vs 30 C', 'hot'),
 *[cmp(f'C2{1 + k}', 'Nestec', 'rate', r, 30, T, f'gas rate {T} C / 30 C, US 5,827,724', 'cold') for k, (T, r) in enumerate([(4, 0.051), (7, 0.061), (10, 0.095)])],
]

NOT_USED = [
 ('europeanzest.com 48 h biga', 'not found: the site lists no such recipe and search did not surface it (not verified, not used)'),
 ('pizzachef.it 50 %', 'page not found by search (not verified, not used)'),
 ('TFL node 45279 halve', 'read: "cut the yeast amount in half" (Mini Oven), used as C08'),
 ('chimica-online.it', 'no temperature stated; dry type unclear'),
 ('moulinsafarine.fr', 'states it was generated by AI without review: excluded'),
 ('millebolle.ch, technomitron dosage', 'no time-specific numbers'),
 ('manufacturer tables (Lesaffre, Lallemand, AB Mauri, Fermipan)', 'no time/temperature dosing table reachable'),
 ('Plotzblog, Ketex, Calvel, Japanese and SE-Asian schools', 'no reachable quantitative page found this session'),
]
