"""Pre-registered Phase 3 hold-out: 25 % of the dose lineages (seed 20261120), keeping identifiability."""
import random
from data3 import assemble
def holdout_lineages():
    rows, _, _ = assemble('regime')
    lin = sorted({r['lineage'] for r in rows})
    rng = random.Random(20261120)
    k = round(0.25 * len(lin))
    must_keep = {'Modernist', 'Nestec'}
    while True:
        h = set(rng.sample(lin, k))
        if h & must_keep: continue
        biga = {r['lineage'] for r in rows if r['medium'] == 'biga'}
        hot = {r['lineage'] for r in rows if r['regime'] == 'hot'}
        cold = {r['lineage'] for r in rows if r['regime'] == 'cold'}
        if len(biga - h) < 3 or len(hot - h) < 2 or len(cold - h) < 3: continue
        if not (h & biga) or not (h & cold): continue      # each weak regime also has held-out evidence
        return sorted(h)
if __name__ == '__main__':
    print(holdout_lineages())
