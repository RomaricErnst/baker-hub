"""Phase 3: is the room-temperature level split by yeast type? Source offsets grouped by the yeast type the source states,
and a fit on the dry-yeast lineages only / fresh-yeast lineages only."""
import json, math, collections
from data3 import assemble
from core import Fit, heq, ln_dose
import os
fl = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'flagged.json')))
rows, comps, pairs = assemble('regime', exclude_ids=fl)
f = Fit(rows, comps, pairs).run()
kind = lambda t: 'fresh' if t.lower().startswith(('fresh', 'cy')) else ('dry' if t.lower().startswith(('idy', 'instant', 'ady', 'active', 'dry')) else 'unstated')
src = collections.defaultdict(set)
for r in rows: src[r['source']].add(kind(r['yeast_type']))
g = collections.defaultdict(list)
for s, ks in src.items(): g['/'.join(sorted(ks))].append(f.u[s])
for k, v in g.items(): print(f'offsets of {k:14s} sources: n={len(v):2d} mean {sum(v)/len(v):+.2f} (x{math.exp(sum(v)/len(v)):.2f})')
def d820(p):
    H, Te = heq([(8, 20)], 20, p); return math.exp(ln_dose(H, Te, 'dough', p))
print('all lineages: 8 h at 20 C', round(d820(f.p), 3))
for want in ('dry', 'fresh'):
    lin = {r['lineage'] for r in rows if all(kind(x['yeast_type']) == want for x in rows if x['lineage'] == r['lineage'])}
    lin |= {'Nestec', 'Istudor', 'Modernist pairs'}   # rate-only evidence carries no yeast-type level
    rr, cc, pp = assemble('regime', exclude_ids=fl, only_lineages=lin)
    fx = Fit(rr, cc, pp).run()
    print(f'{want}-yeast lineages only ({len(rr)} rows, {len(lin) - 3} lineages): A={math.exp(fx.p["lnA"]):.2f} b={fx.p["b"]:.2f} Tmin={fx.p["Tmin"]:.1f} 8 h at 20 C {d820(fx.p):.3f}')
