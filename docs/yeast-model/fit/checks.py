"""Checks of the final constants against rows not used to fit them, and the endpoint rules."""
import json, math, collections
import numpy as np
from model import heq, dose, rel
from rows import load
R = load(); J = json.load(open('fit-results.json')); p = J['final']
out = open('checks-report.txt', 'w')
def P(*a): print(*a); print(*a, file=out)
P('Final constants:', {k: round(v, 4) for k, v in p.items() if k in ('A', 'b', 'Tmin', 'Topt', 'Mp', 'Mb')})

def eng_rms(rows):
    rs = [math.log(e['dose'] / float(e['raw']['engine_idy_pct'])) for e in rows if e['raw']['engine_idy_pct'] not in ('', None)]
    return len(rs), math.sqrt(np.mean(np.square(rs))), np.mean(rs)
def mdl_rms(rows):
    rs = [math.log(e['dose'] / dose(heq(e['seg'], e['T0'], p), p, e['medium'])) for e in rows]
    return len(rs), math.sqrt(np.mean(np.square(rs))), np.mean(rs)
elig = [e for e in R if e['use'] == 'fit' and not (e['group'] == 'cold' and e.get('school') == 'community table')]
P('\n1. Same rows, old engine vs new model (old engine column from Phase 1, no thermal path):')
for g in ('direct RT', 'cold', 'poolish', 'biga'):
    rows = [e for e in elig if e['group'] == g]
    n, r, m = eng_rms(rows); n2, r2, m2 = mdl_rms(rows)
    P(f'   {g:10s} old engine n={n} rms {r:.2f} (x{math.exp(r):.2f}) bias {m:+.2f} | new n={n2} rms {r2:.2f} (x{math.exp(r2):.2f}) bias {m2:+.2f}')
n, r, m = eng_rms(elig); n2, r2, m2 = mdl_rms(elig)
P(f'   ALL        old engine n={n} rms {r:.2f} (x{math.exp(r):.2f}) bias {m:+.2f} | new n={n2} rms {r2:.2f} (x{math.exp(r2):.2f}) bias {m2:+.2f}')

P('\n2. Community cold tables (endpoint "rise in the fridge", not used for the cold tail under E2):')
for e in R:
    if e['group'] == 'cold' and e.get('school') == 'community table' and e['use'] in ('fit', 'reference'):
        H = heq(e['seg'], e['T0'], p); d = dose(H, p)
        P(f"   {e['id']} {e['source'][:22]:22s} {e['seg']} obs {e['dose']:.3f} model {d:.3f} -> source/model x{e['dose']/d:.2f}")

P('\n3. Poolish doughs: total yeast (% of all flour) vs the direct-dough need of the post-mix path:')
for e in R:
    if e['group'] == 'poolish dough (total yeast)' and e['seg']:
        H = heq(e['seg'], e['T0'], p); d = dose(H, p)
        P(f"   {e['id']} {e['source'][:22]:22s} post-mix {e['seg']} T0 {e['T0']} obs total {e['dose']:.3f} direct need {d:.3f} ratio {e['dose']/d:.2f}")

P('\n4. Other checks:')
for e in R:
    if e['use'] in ('check', 'reference') and e['group'] not in ('poolish dough (total yeast)',) and not (e['group'] == 'cold' and e.get('school') == 'community table') and e['seg']:
        H = heq(e['seg'], e['T0'], p); d = dose(H, p, e['medium'])
        P(f"   {e['id']} {e['source'][:22]:22s} {e['group']:16s} {e['seg']} obs {e['dose']:.3f} model {d:.3f} ratio {e['dose']/d:.2f}  [{e['note'][:60]}]")
# pâte fermentée (salted, ripe) as dough medium; sponge
P('\n5. Endpoint / temperature rules')
for T in (21, 25, 28, 30, 32, 35, 38):
    P(f"   r({T}) = {rel(T, p):.3f}   time factor vs 21 °C at the same dose: {rel(T, p) / rel(21, p):.2f}")
# Pizzastunde: dough planned 24 h at ~21 °C is fully fermented in 8-10 h at 35 °C
d24 = dose(heq([(24, 21)], 21, p), p)
def hours_to(dose_pct, T, rise=1.0, T0=None):
    target = (p['A'] * rise / dose_pct) ** (1 / p['b'])
    lo, hi = 0.05, 200
    for _ in range(60):
        mid = (lo + hi) / 2
        if heq([(mid, T)], T0 if T0 is not None else T, p) < target: lo = mid
        else: hi = mid
    return hi
for rise in (1.0, 0.6):
    P(f"   Pizzastunde: the 24 h / 21 °C dose ({d24:.3f} %) at 35 °C reaches rise target {rise} after {hours_to(d24, 35, rise):.1f} h (source: 8-10 h)")
P(f"   Elmo bakes 30 °C, 1.2 % 'dry' doubles in ~40 min: model hours to double at 30 °C {hours_to(1.2, 30):.2f} h; with E3 {hours_to(1.2, 30, 0.6):.2f} h")
# Istudor CO2 (1 h proving, 3 % CY) relative to 30 °C
for T, obs in ((33, 1.079), (36, 1.216), (39, 1.52)):
    P(f"   Istudor 2020 short-term CO2 {T}/30 °C: obs {obs:.2f} model {rel(T, p) / rel(30, p):.2f}")
