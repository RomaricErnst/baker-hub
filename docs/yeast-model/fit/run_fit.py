"""Phase 2 fit. Writes fit-results.json and fit-report.txt next to this file."""
import json, math, random, collections, sys
import numpy as np
from fit import R, fit, residuals, PAIRS, NESTEC, weights
import fit as F
from model import heq, dose, rel
from holdout import holdout_sources

TOPT = 32.3
def regime(e):
    if e['group'] == 'cold': return 'cold (' + e.get('school', '') + ')'
    if e['medium'] != 'dough': return e['group']
    T = e['seg'][0][1]; h = sum(s[0] for s in e['seg'])
    if T >= 27.5: return 'RT >=28 °C (dough)'
    return 'RT short (<=4 h)' if h <= 4 else ('RT long (4-12 h)' if h <= 12 else 'RT very long (>12 h)')

HOLD = set(holdout_sources())
import sys as _s
out = open("fit-report.txt", "w") if __name__ == "__main__" else open("/dev/null", "w")
def P(*a):
    print(*a); print(*a, file=out)

def is_e2(e):  # cold rows used for the cold tail: recipes (fridge holds, finish at RT), not community tables
    return not (e['group'] == 'cold' and e.get('school') == 'community table')
eligible = [e for e in R if e['use'] == 'fit' and is_e2(e)]
fitset = [e for e in eligible if e['source'] not in HOLD]
held = [e for e in R if e['use'] == 'fit' and e['source'] in HOLD]
pairs_fit = [(a, b) for a, b in PAIRS if a['source'] not in HOLD]
FIX = {'Topt': TOPT}

def fmt(p): return f"A={p['A']:.3f} b={p['b']:.3f} Tmin={p['Tmin']:.2f} Topt={p['Topt']:.2f} Mp={p['Mp']:.3f} Mb={p['Mb']:.3f}"

if __name__ == '__main__':
    P('Hold-out sources (pre-registered, seed 20261119):', sorted(HOLD))
    P(f'fit rows {len(fitset)}, held-out rows {len(held)}, pairs in fit {len(pairs_fit)}/{len(PAIRS)}, Nestec points {len(NESTEC)}')
    p_fit, se_fit, sol, names = fit(fitset, fixed=FIX, pairs_rows=pairs_fit)
    P(f"\nLoss: {F.LOSS}, f_scale {F.F_SCALE}"); P("\n== Fit on fit set (Topt fixed 32.3, Tmax 45.4):", fmt(p_fit))
    P('   SE:', {k: round(float(v), 3) for k, v in se_fit.items()})

    # Final constants: refit on every eligible source (hold-out included) after validation, as is standard
    p_all, se_all, _, _ = fit(eligible, fixed=FIX)
    P('== Final fit on all eligible sources:', fmt(p_all))
    P('   SE:', {k: round(float(v), 3) for k, v in se_all.items()})

    def table(p, rows, title):
        P(f'\n-- {title}: per row (ln residual = ln observed - ln model; x = factor)')
        by_src = collections.defaultdict(list); by_reg = collections.defaultdict(list)
        for e in rows:
            H = heq(e['seg'], e['T0'], p); pr = dose(H, p, e['medium']); r = math.log(e['dose'] / pr)
            by_src[e['source']].append(r); by_reg[regime(e)].append(r)
            eng = e['raw'].get('engine_idy_pct'); engr = (math.log(e['dose'] / float(eng)) if eng not in ('', None) else None)
            P(f"   {e['id']} {e['source'][:28]:28s} {regime(e):22s} obs {e['dose']:.4f} model {pr:.4f} Heq {H:5.2f} h  resid {r:+.2f} (x{math.exp(r):.2f})" + (f"  | old engine x{math.exp(engr):.2f}" if engr is not None else ''))
        P(f'   per source: ' + '; '.join(f"{k} n={len(v)} mean {np.mean(v):+.2f} sd {np.std(v):.2f}" for k, v in sorted(by_src.items())))
        P(f'   per regime: ' + '; '.join(f"{k} n={len(v)} mean {np.mean(v):+.2f} rms {math.sqrt(np.mean(np.square(v))):.2f}" for k, v in sorted(by_reg.items())))
        allr = [r for v in by_src.values() for r in v]
        P(f'   ALL n={len(allr)} mean {np.mean(allr):+.3f} rms {math.sqrt(np.mean(np.square(allr))):.3f} (x{math.exp(math.sqrt(np.mean(np.square(allr)))):.2f}); within x2: {sum(abs(r) <= math.log(2) for r in allr)}/{len(allr)}')
        return allr

    r_fit = table(p_fit, fitset, 'FIT SET, fit-set parameters')
    r_held = table(p_fit, held, 'HELD-OUT SET, fit-set parameters')
    def pair_report(p, prs, title):
        rs = []
        for a, b in prs:
            Ha = heq([(a['seg'][0][0], 21.0)], F.PAIR_T0, p); Hb = heq([(b['seg'][0][0], 27.0)], F.PAIR_T0, p)
            rs.append(math.log(Ha / Hb))
        P(f'-- {title}: n={len(rs)} mean ln(Heq21/Heq27) {np.mean(rs):+.3f} rms {math.sqrt(np.mean(np.square(rs))):.3f} (time factor x{math.exp(math.sqrt(np.mean(np.square(rs)))):.2f})')
    pair_report(p_fit, pairs_fit, 'proof pairs, fit set')
    pair_report(p_fit, [(a, b) for a, b in PAIRS if a['source'] in HOLD], 'proof pairs, held out')
    P('-- Nestec (gas rate relative to 30 °C): ' + '; '.join(f"{T} °C obs {o:.3f} model {rel(T, p_all) / rel(30, p_all):.3f}" for T, o in NESTEC))

    # Leave-one-source-out
    P('\n== Leave-one-source-out (each eligible source predicted by a fit without it)')
    loso = {}
    for s in sorted({e['source'] for e in eligible}):
        rows = [e for e in eligible if e['source'] != s]
        p, _, _, _ = fit(rows, fixed=FIX, pairs_rows=[(a, b) for a, b in PAIRS if a['source'] != s])
        rs = [math.log(e['dose'] / dose(heq(e['seg'], e['T0'], p), p, e['medium'])) for e in eligible if e['source'] == s]
        loso[s] = rs
        P(f"   {s:28s} n={len(rs):2d} mean {np.mean(rs):+.2f} rms {math.sqrt(np.mean(np.square(rs))):.2f}   ({fmt(p)})")
    allr = [r for v in loso.values() for r in v]
    P(f"   LOSO ALL n={len(allr)} rms {math.sqrt(np.mean(np.square(allr))):.3f} (x{math.exp(math.sqrt(np.mean(np.square(allr)))):.2f}); within x2 {sum(abs(r)<=math.log(2) for r in allr)}/{len(allr)}")

    # Source bootstrap
    P('\n== Source bootstrap (B=200), final-fit parameters: 2.5/50/97.5 percentiles')
    rng = random.Random(7)
    srcs = sorted({e['source'] for e in eligible}); boot = collections.defaultdict(list)
    for _ in range(200):
        pick = [rng.choice(srcs) for _ in srcs]
        rows = [e for s in pick for e in eligible if e['source'] == s]
        prs = [pr for s in pick for pr in PAIRS if pr[0]['source'] == s]
        if not any(e['medium'] == 'poolish' for e in rows) or not any(e['medium'] == 'biga' for e in rows): continue
        try: p, _, _, _ = fit(rows, fixed=FIX, pairs_rows=prs)
        except Exception: continue
        for k in ('A', 'b', 'Tmin', 'Mp', 'Mb'): boot[k].append(p[k])
        for T in (4, 6, 15, 30, 35): boot[f'r{T}'].append(rel(T, p))
        boot['d12h21'].append(dose(heq([(12, 21)], 21, p), p))
        boot['d48cold'].append(dose(heq([(2, 21), (46, 6), (2, 21)], 24, p), p))
    for k, v in boot.items():
        P(f"   {k:8s} {np.percentile(v, 2.5):.3f} / {np.percentile(v, 50):.3f} / {np.percentile(v, 97.5):.3f}  (n={len(v)})")

    # Sensitivity
    P('\n== Sensitivity of the final fit to assumptions')
    for tag, kw, pre in [('tau 1.5 h', dict(tau=1.5), None), ('tau 3 h', dict(tau=3.0), None),
                         ('proof-pair start 21 °C', {}, ('PAIR_T0', 21.0)), ('proof-pair start 25 °C', {}, ('PAIR_T0', 25.0)),
                         ('Topt free', {}, 'free'), ('cold: all sources incl. community tables', {}, 'allcold'),
                         ('no Nestec', dict(use_nestec=False), None), ('no proof pairs', dict(use_pairs=False), None)]:
        old = F.PAIR_T0; rows = eligible; fixed = FIX
        if isinstance(pre, tuple): setattr(F, pre[0], pre[1])
        if pre == 'free': fixed = {}
        if pre == 'allcold': rows = [e for e in R if e['use'] == 'fit']
        p, se, _, _ = fit(rows, fixed=fixed, **kw)
        F.PAIR_T0 = old
        P(f"   {tag:42s} {fmt(p)}  r(6)={rel(6,p):.3f} r(30)={rel(30,p):.3f}  12h@21: {dose(heq([(12,21)],21,p),p):.3f}%  2+46h@6+2: {dose(heq([(2,21),(46,6),(2,21)],24,p),p):.3f}%")

    json.dump({'hold_out_sources': sorted(HOLD), 'fit_set': {k: float(v) for k, v in p_fit.items()}, 'final': {k: float(v) for k, v in p_all.items()},
               'final_se': {k: float(v) for k, v in se_all.items()},
               'fit_rms': math.sqrt(np.mean(np.square(r_fit))), 'held_rms': math.sqrt(np.mean(np.square(r_held))),
               'held_mean': float(np.mean(r_held)), 'loso_rms': math.sqrt(np.mean(np.square(allr))),
               'bootstrap': {k: [float(np.percentile(v, 2.5)), float(np.percentile(v, 50)), float(np.percentile(v, 97.5))] for k, v in boot.items()}},
              open('fit-results.json', 'w'), indent=1)
