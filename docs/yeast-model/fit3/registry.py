"""Pre-registered source registry (Phase 3, 19 Nov 2026, written before any Phase 3 fit was run).

For every source: its LINEAGE (what its numbers are derived from; copies share one lineage and one
weight), its credibility TIER, and the REGIMES it tested or specialises in. Outside those regimes the
source drops one tier (1.0 -> 0.8 -> 0.6 -> 0.4 -> 0.2 -> 0.1).

Tiers (owner, 19 Nov 2026 20:17):
  1.0 measured (Finney 1976, Nestec, peer-reviewed kinetics; Craig's own measured data, not reachable)
  0.8 tested professional tables (Modernist, Suas, Hamelman, Giorilli/AVPN/Zaghini technical texts, Calvel, Lehmann)
  0.6 manufacturer dosing tables (none with a time/temperature table was reachable this session)
  0.4 recipe sites and calculators with an independent basis
  0.2 forum and anecdotal reports
Regimes: rt_mild (dough at room temperature 18-27 C), cool (<18 C), hot (>=28 C), cold (more than half the
hours in the fridge), poolish_rt, poolish_fridge, biga, rate (temperature-speed statements).
"""

DROP = {1.0: 0.8, 0.8: 0.6, 0.6: 0.4, 0.4: 0.2, 0.2: 0.1}

R = {}
def reg(name, lineage, tier, regimes, reason):
    R[name] = dict(lineage=lineage, tier=tier, regimes=set(regimes), reason=reason)

# --- books, professionals, measured ------------------------------------------------------------
reg('Modernist Pizza Vol. 4', 'Modernist', 0.8, ['rt_mild', 'cool', 'cold', 'poolish_rt', 'rate'], 'tested recipes and tables, 21-24 C rooms, 4 C cold-proof; extrapolated at >=28 C')
reg('Modernist Bread', 'Modernist', 0.8, ['rt_mild', 'cool', 'poolish_rt', 'biga', 'rate'], 'same team and tables as MP4; biga table p. 19/22')
reg('Suas', 'Suas', 0.8, ['poolish_rt', 'hot'], 'professional text; poolish table stated for 26-29 C dough')
reg('Giorilli', 'Giorilli', 0.8, ['biga'], 'biga specialist (Giorilli method)')
reg('Zaghini (Scatti di Gusto)', 'Zaghini', 0.8, ['biga'], 'professional biga method (Cristian Zaghini)')
reg('Pezzetta', 'Pezzetta', 0.8, ['poolish_rt'], 'professional pizzaiolo, poolish method')
reg('Lehmann', 'Lehmann', 0.8, ['cold', 'hot'], 'commercial cold-dough specialist, hot shops')
reg('EU TSG 97/2010', 'AVPN/TSG', 0.8, ['rt_mild'], 'regulatory Neapolitan schedule at ~25 C')
reg('Forkish', 'Forkish', 0.8, ['rt_mild'], 'professional baker, tested book recipes')
reg('Finney et al. 1976', 'Finney', 1.0, ['hot', 'rt_mild'], 'measured optimised test bakes at 30 C')
reg('Nestec', 'Nestec', 1.0, ['cold'], 'measured gas production 3-10 C (US 5,827,724)')
reg('Istudor 2020', 'Istudor', 0.8, ['hot'], 'measured, but 1 h gas tests, not multi-hour dough (one tier down from 1.0)')
reg('technomitron (AAINB)', 'technomitron', 0.8, ['rate', 'rt_mild', 'hot'], 'French bakers association technical reference')
# --- recipe sites and calculators (0.4) ---------------------------------------------------------
reg('dough.school', 'Craig', 0.4, ['rt_mild', 'cool'], 'calculator reproducing Craig/TXCraig1 charts: Craig lineage; weak at >=28 C and long cold')
reg('Craig via GitHub PR', 'Craig', 0.4, ['rt_mild'], 'secondhand Craig chart: Craig lineage')
reg('Crust Kingdom', 'Craig', 0.4, ['rt_mild'], 'credits a pizzamaking.com (Craig) post: Craig lineage')
reg('My Pizza Night', 'My Pizza Night', 0.4, ['rt_mild', 'cool', 'rate'], 'home-baking guide')
reg("Jordo's", "Jordo's", 0.4, ['rt_mild'], 'calculator, basis unstated')
reg('fond.kitchen', 'fond.kitchen', 0.4, ['rt_mild', 'poolish_rt', 'rate'], 'home-baking guide citing Weekend Bakery, Hamelman, Craig')
reg('Biorito', 'Biorito', 0.4, ['rt_mild', 'rate'], 'Italian yeast-product site')
reg('Pizza Napoletana DOC', 'Pizza Napoletana DOC', 0.4, ['rt_mild'], 'Italian pizzeria blog')
reg('khymos/PizzApp+', 'PizzApp', 0.4, ['rt_mild'], 'calculator (PizzApp+), own basis')
reg('da Michele (Michelin SG)', 'da Michele', 0.4, ['cold'], 'pizzeria recipe with a fridge stage, published for Singapore')
reg('Ooni', 'Ooni', 0.4, ['rt_mild', 'cold'], 'oven maker recipes')
reg('Baking Steel', 'Baking Steel', 0.4, ['rt_mild'], 'equipment maker recipe')
reg('Gozney', 'Gozney', 0.4, ['cold'], 'oven maker recipe')
reg('Weekend Bakery', 'Weekend Bakery', 0.4, ['poolish_rt', 'poolish_fridge', 'rate'], 'baking blog, poolish guide')
reg('Dissapore', 'Dissapore', 0.4, ['poolish_rt'], 'Italian food site, poolish table')
reg('The Dough Formula', 'The Dough Formula', 0.4, ['poolish_rt', 'hot'], 'guide giving a 27 C poolish point')
reg('biancolievito.it', 'Giorilli', 0.4, ['biga', 'poolish_rt'], 'restates the Giorilli biga method: Giorilli lineage')
reg('italianpizzasecrets.com', 'italianpizzasecrets', 0.4, ['biga'], 'biga recipe site')
reg('Burnhard', 'Burnhard', 0.4, [], 'oven maker recipe, fridge temperature unstated')
reg('behindthecrust', 'behindthecrust', 0.4, [], 'personal blog recipe')
reg('pizzamateur.fr', 'pizzamateur', 0.4, ['rt_mild', 'cool', 'rate'], 'French pizza site, fresh-yeast table and room coefficients')
reg('teigformel.de', 'teigformel', 0.4, ['rt_mild'], 'calculator anchor points, basis unstated')
reg('agricolaconforti.it', 'agricolaconforti', 0.2, [], 'consumer page, no temperature stated (22 C assumed)')
reg('Pizzastunde', 'Pizzastunde', 0.4, ['hot'], 'summer 35 C pizza practice')
reg('Bake Magazine', 'Bake Magazine', 0.4, ['rate'], 'trade magazine rule of thumb')
reg('Reinhart (secondhand)', 'Reinhart', 0.4, ['rate'], 'book rule quoted on Forno Bravo / TFL')
# --- forum / anecdote (0.2) ---------------------------------------------------------------------
reg('yozzause (TFL)', 'yozzause', 0.2, [], 'forum, technical-school notes, temperature unstated')
reg('CalBeachBaker (TFL)', 'CalBeachBaker', 0.2, [], 'forum recipe')
reg('TFL Mini Oven', 'TFL Mini Oven', 0.2, ['hot'], 'forum, tropical (Laos) baker')
reg('Elmo bakes', 'Elmo bakes', 0.2, ['hot'], 'Singapore home baker')
reg('V-ZUG SG', 'V-ZUG SG', 0.4, [], 'appliance recipe, yeast type unstated')


def weight(source, regime, scheme):
    """scheme: equal | tier | pro (tier >= 0.8 only, else 0) | regime (tier, one tier down outside its regimes)."""
    r = R[source]
    if scheme == 'equal':
        return 1.0
    if scheme == 'tier':
        return r['tier']
    if scheme == 'pro':
        return 1.0 if r['tier'] >= 0.8 else 0.0
    if scheme == 'regime':
        return r['tier'] if regime in r['regimes'] else DROP[r['tier']]
    raise ValueError(scheme)
