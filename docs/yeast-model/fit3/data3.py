"""Assemble the Phase 3 data: Phase 1-2 rows (rows.py), Phase 3 rows and comparisons (newdata.py),
with lineage, tier and regime weights (registry.py)."""
import math, collections, copy, os, sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fit'))   # fit.py (Modernist proof pairs) and model.py
from rows import load
from newdata import ROWS as NEW, COMPARISONS
from registry import R as REG, weight

NESTEC_SRC = 'Nestec'

def regime_of(r):
    seg = r['seg']; tot = sum(h for h, _ in seg); cold = sum(h for h, c in seg if c < 10)
    if r['medium'] == 'biga': return 'biga'
    if r['medium'] == 'poolish': return 'poolish_fridge' if cold > 0 else 'poolish_rt'
    if cold > 0.5 * tot: return 'cold'
    T = max(c for h, c in seg if c >= 10) if any(c >= 10 for h, c in seg) else seg[0][1]
    if T >= 27.5: return 'hot'
    if T < 18: return 'cool'
    return 'rt_mild'

def old_rows():
    out = []
    for e in load():
        use = e['use']
        keep = use in ('fit', 'reference') or (e['group'] == 'fridge poolish' and use == 'check')
        if e['id'] in ('D052', 'D054', 'D056', 'D058', 'D060', 'D062') and e['seg']:
            keep = True   # Phase 1 flagged these as implausible; Phase 3 keeps them and lets the outlier rule decide
        if not keep or e['seg'] is None or e['dose'] is None or e['group'] == 'proof pair':
            continue
        if e['source'] not in REG:
            continue
        out.append(dict(id=e['id'], source=e['source'], dose=e['dose'], idy_alt=None, seg=e['seg'], T0=e['T0'],
                        medium=e['medium'], yeast_type=e['raw']['yeast_type'] or 'unstated', endpoint=e['endpoint'],
                        conf=e['conf'], note=e['note'], phase=1))
    return out

def proof_pairs():
    from fit import PAIRS
    return [dict(source='Modernist Pizza Vol. 4' if 'Pizza' in a['source'] else 'Modernist Bread', h21=a['seg'][0][0], h27=b['seg'][0][0], T0=23.0, ids=(a['id'], b['id'])) for a, b in PAIRS]

def assemble(scheme='regime', ambiguous='idy', exclude_ids=(), exclude_lineages=(), only_lineages=None):
    rows = old_rows() + [dict(r, phase=3) for r in copy.deepcopy(NEW)]
    for r in rows:
        if ambiguous == 'ady' and r.get('idy_alt'): r['dose'] = r['idy_alt']
        r['y'] = math.log(r['dose']); r['regime'] = regime_of(r); r['lineage'] = REG[r['source']]['lineage']
        r['w0'] = weight(r['source'], r['regime'], scheme)
    comps = copy.deepcopy(COMPARISONS)
    for c in comps:
        c['lineage'] = REG[c['source']]['lineage']; c['w0'] = weight(c['source'], c['regime'], scheme)
    pairs = proof_pairs()
    for pr in pairs:
        pr['lineage'] = 'Modernist pairs'; pr['w0'] = weight(pr['source'], 'rate', scheme)
    def keep(x):
        if x.get('id') in exclude_ids: return False
        if x['lineage'] in exclude_lineages: return False
        if only_lineages is not None and x['lineage'] not in only_lineages: return False
        return x['w0'] > 0
    rows = [r for r in rows if keep(r)]; comps = [c for c in comps if keep(c)]; pairs = [p for p in pairs if keep(p)]
    # Each lineage counts once: its rows share its weight (W = w0 / rows of that lineage in this set).
    n = collections.Counter([x['lineage'] for x in rows] + [x['lineage'] for x in comps] + [x['lineage'] for x in pairs])
    for x in rows + comps + pairs:
        x['W'] = x['w0'] / n[x['lineage']]
    # Normalise so the dose rows' weights sum to their count: sigma is then the typical (weighted) row residual.
    k = len(rows) / max(1e-12, sum(r['W'] for r in rows))
    for x in rows + comps + pairs:
        x['W'] *= k
    return rows, comps, pairs
