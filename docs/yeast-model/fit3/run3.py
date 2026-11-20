"""Phase 3 fit, validation and plots. cd docs/yeast-model/fit3 && NBOOT=40 python3 run3.py .. (writes ../fit3-report.txt, ../fit3-results.json, ../flagged.json, ../plots/)"""
import json, math, random, sys, os, collections
import numpy as np
from data3 import assemble
from core import Fit, rel, heq, ln_dose, comparison_residual, rise
from holdout3 import holdout_lineages
from registry import R as REG

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(os.path.join(OUT, 'plots'), exist_ok=True)
rep = open(os.path.join(OUT, 'fit3-report.txt'), 'w')
def P(*a):
    print(*a); print(*a, file=rep); rep.flush()

GLOBAL = ['lnA', 'b', 'Tmin', 'Topt', 'lnMp', 'lnMb', 'Rh', 'c']
def show(p):
    return (f"A={math.exp(p['lnA']):.3f} b={p['b']:.3f} Tmin={p['Tmin']:.2f} Topt={p['Topt']:.2f} Mp={math.exp(p['lnMp']):.3f} "
            f"Mb={math.exp(p['lnMb']):.3f} Rh={p['Rh']:.3f} c={p.get('c', 0):.3f} | r(4)={rel(4, p):.3f} r(6)={rel(6, p):.3f} r(30)={rel(30, p):.3f} r(35)={rel(35, p):.3f}")

def fit(scheme='regime', **kw):
    fkw = {k: kw.pop(k) for k in ('fixed', 'use_c', 'use_tauc') if k in kw}
    rows, comps, pairs = assemble(scheme, **kw)
    return Fit(rows, comps, pairs, **fkw).run()

def dose_at(p, seg, T0, medium='dough'):
    H, Te = heq(seg, T0, p); return math.exp(ln_dose(H, Te, medium, p))

CHECKS = {
    'dough 8 h at 18 C': ([(8, 18)], 18, 'dough'), 'dough 8 h at 20 C': ([(8, 20)], 20, 'dough'), 'dough 12 h at 21 C': ([(12, 21)], 21, 'dough'),
    'dough 6.5 h at 30 C vs 22 C': None,
    'dough 2 h RT + 46 h at 6 C + 2 h': ([(2, 21), (46, 6), (2, 21)], 24, 'dough'),
    'biga 16 h at 18 C': ([(16, 18)], 19, 'biga'), 'biga 48 h fridge 5 C': ([(48, 5)], 21, 'biga'),
    'biga 2.5 h RT + 46 h at 5 C + 1.5 h': ([(2.5, 19), (46, 5), (1.5, 21)], 19, 'biga'),
    'poolish 12 h at 21 C': ([(12, 21)], 21, 'poolish'),
}
def checks(p):
    out = {}
    for k, v in CHECKS.items():
        if v is None:
            out[k] = dose_at(p, [(6.5, 30)], 25) / dose_at(p, [(6.5, 22)], 25)
        else:
            out[k] = dose_at(p, *v)
    return out

# ---------------------------------------------------------------- coverage (pre-fit)
rows0, comps0, pairs0 = assemble('regime')
P('== Coverage by regime (independent lineages; tier as weighted in that regime)')
cov = {}
for reg in ['rt_mild', 'cool', 'hot', 'cold', 'biga', 'poolish_rt', 'poolish_fridge']:
    lin = collections.defaultdict(float)
    for r in rows0:
        if r['regime'] == reg: lin[r['lineage']] = max(lin[r['lineage']], r['w0'])
    for c in comps0:
        if c['regime'] == reg: lin[c['lineage']] = max(lin[c['lineage']], c['w0'])
    strong = sum(1 for v in lin.values() if v >= 0.6)
    cov[reg] = dict(n=len(lin), strong=strong, lineages={k: v for k, v in sorted(lin.items())})
    P(f"  {reg:15s} lineages {len(lin):2d}, at tier >= 0.6: {strong}{'  -> LOW CONFIDENCE' if strong < 3 else ''}   {dict(sorted(lin.items()))}")
P(f'  rows {len(rows0)}, comparisons {len(comps0)}, proof pairs {len(pairs0)}, sources {len({r["source"] for r in rows0})}, lineages {len({r["lineage"] for r in rows0})}')
P('  yeast types:', dict(collections.Counter(r['yeast_type'].split(' ')[0].lower() for r in rows0)))

# ---------------------------------------------------------------- primary fit and outliers
f0 = fit('regime')
P('\n== Primary (regime-weighted), all points:', show(f0.p))
P(f'   sigma (shape residual) {f0.sigma:.3f} (x{math.exp(f0.sigma):.2f}); tau (source offsets) {f0.tau_u:.3f} (x{math.exp(f0.tau_u):.2f})')
P('   SE:', {k: round(float(v), 3) for k, v in f0.se.items()})
rr = f0.row_residuals()
e = np.array([x[4] for x in rr]); mad = 1.4826 * np.median(np.abs(e - np.median(e)))
flag = [x[0]['id'] for x in rr if abs(x[4]) > 3 * mad]
P(f'   robust SD of offset-corrected residuals {mad:.3f}; flagged (> 3 robust SD):', [(x[0]['id'], x[0]['source'], round(x[4], 2)) for x in rr if x[0]['id'] in flag])
f1 = fit('regime', exclude_ids=tuple(flag))
P('== Primary without flagged points:', show(f1.p))
P(f'   sigma {f1.sigma:.3f} (x{math.exp(f1.sigma):.2f}); tau {f1.tau_u:.3f} (x{math.exp(f1.tau_u):.2f})')
P('   SE:', {k: round(float(v), 3) for k, v in f1.se.items()})
PRIMARY = f1

# ---------------------------------------------------------------- weighting schemes
P('\n== Weighting schemes (flagged points excluded)')
schemes = {}
for sch in ['equal', 'tier', 'pro', 'regime']:
    fs = fit(sch, exclude_ids=tuple(flag)); schemes[sch] = fs
    P(f'  {sch:7s} {show(fs.p)}  sigma {fs.sigma:.2f} tau {fs.tau_u:.2f}')
P('  shape moves beyond its own SE (vs regime):')
for k in ['b', 'Tmin', 'Topt', 'Rh', 'lnMb', 'lnMp']:
    se = PRIMARY.se.get(k, float('nan'))
    moves = {s: round(schemes[s].p[k] - PRIMARY.p[k], 3) for s in schemes if s != 'regime'}
    big = [s for s, d in moves.items() if abs(d) > se]
    P(f'    {k:5s} SE {se:.3f}  deltas {moves}  {"MOVES with: " + ", ".join(big) if big else "stable"}')

# ---------------------------------------------------------------- structure tests
P('\n== Structure tests (regime-weighted, flagged excluded)')
struct = {}
for tag, kw in [('Topt fixed 32.3 (Salvado growth)', dict(fixed={'Topt': 32.3})), ('no E3 (Rh = 1)', dict(fixed={'Rh': 1.0})),
                ('E3 Rh = 0.6 (Phase 2)', dict(fixed={'Rh': 0.6})), ('+ curvature c in ln Heq', dict(use_c=True)),
                ('ambiguous dry types read as active dry', dict(ambiguous='ady')),
                ('free fridge cooling time constant (tau into cold)', dict(use_tauc=True)),
                ('free fridge cooling, professional + measured only', dict(use_tauc=True, scheme_='pro'))]:
    sch_ = kw.pop('scheme_', 'regime')
    fs = fit(sch_, exclude_ids=tuple(flag), **kw); struct[tag] = fs
    obj = float(fs.sol.fun @ fs.sol.fun)
    cm = [x[4] for x in fs.row_residuals() if x[0]['regime'] == 'cold']
    P(f'  {tag:42s} {show(fs.p)} tauc={fs.p.get("tauc", 2.0):.2f}  sigma {fs.sigma:.3f} tau {fs.tau_u:.3f} objective {obj:.1f}  cold-row mean {sum(cm) / max(1, len(cm)):+.2f}')
P(f'  (primary objective {float(PRIMARY.sol.fun @ PRIMARY.sol.fun):.1f})')

# ---------------------------------------------------------------- hold-out
H = set(holdout_lineages())
P('\n== Hold-out (pre-registered lineages):', sorted(H))
fh = fit('regime', exclude_ids=tuple(flag), exclude_lineages=tuple(H))
P('   fit without them:', show(fh.p))
allrows, _, _ = assemble('regime', exclude_ids=tuple(flag))
held = [r for r in allrows if r['lineage'] in H]
res_new = []; by_src = collections.defaultdict(list)
for r in held:
    H_, Te = heq(r['seg'], r['T0'], fh.p); d = r['y'] - ln_dose(H_, Te, r['medium'], fh.p)
    res_new.append(d); by_src[r['source']].append(d)
res_new = np.array(res_new)
shape = np.concatenate([np.array(v) - np.mean(v) for v in by_src.values() if len(v) > 1]) if by_src else np.array([])
P(f'   held-out rows {len(held)}: rms (new source, no offset) {math.sqrt(np.mean(res_new ** 2)):.3f} (x{math.exp(math.sqrt(np.mean(res_new ** 2))):.2f}); '
  f'bias {np.mean(res_new):+.3f}; within x2 {int(np.sum(np.abs(res_new) <= math.log(2)))}/{len(held)}')
if len(shape): P(f'   held-out shape residual (each source minus its own mean, sources with >1 row) rms {math.sqrt(np.mean(shape ** 2)):.3f} (x{math.exp(math.sqrt(np.mean(shape ** 2))):.2f})')
P(f'   compare: source spread tau {fh.tau_u:.3f} (x{math.exp(fh.tau_u):.2f}), total sqrt(sigma^2+tau^2) {math.sqrt(fh.sigma ** 2 + fh.tau_u ** 2):.3f} (x{math.exp(math.sqrt(fh.sigma ** 2 + fh.tau_u ** 2)):.2f})')
for s, v in sorted(by_src.items()):
    P(f'     {s:28s} n={len(v)} mean {np.mean(v):+.2f} rms {math.sqrt(np.mean(np.square(v))):.2f}')

# ---------------------------------------------------------------- bootstrap by lineage
NB = int(os.environ.get('NBOOT', '40'))
P(f'\n== Lineage bootstrap (B={NB}), 2.5 / 50 / 97.5 %')
lin = sorted({r['lineage'] for r in allrows}); rng = random.Random(11); boot = collections.defaultdict(list)
for bi in range(NB):
    pick = [rng.choice(lin) for _ in lin]
    cnt = collections.Counter(pick)
    rows, comps, pairs = assemble('regime', exclude_ids=tuple(flag))
    def rep_(xs):
        out = []
        for x in xs:
            for _ in range(cnt.get(x['lineage'], 0 if x['lineage'] in lin else 1)): out.append(dict(x))
        return out
    rows2, comps2, pairs2 = rep_(rows), rep_(comps), rep_(pairs)
    if not any(r['medium'] == 'biga' for r in rows2) or not any(r['medium'] == 'poolish' for r in rows2): continue
    try:
        fb = Fit(rows2, comps2, pairs2).run(iters=5)
    except Exception as ex:
        continue
    for k in ['b', 'Tmin', 'Topt', 'Rh']: boot[k].append(fb.p[k])
    for k in ['lnA', 'lnMp', 'lnMb']: boot[k[2:]].append(math.exp(fb.p[k]))
    for k, v in checks(fb.p).items(): boot[k].append(v)
    boot['r(6)'].append(rel(6, fb.p)); boot['r(30)'].append(rel(30, fb.p)); boot['r(35)'].append(rel(35, fb.p))
ci = {}
for k, v in boot.items():
    ci[k] = [float(np.percentile(v, q)) for q in (2.5, 50, 97.5)]
    P(f'   {k:36s} {ci[k][0]:.3f} / {ci[k][1]:.3f} / {ci[k][2]:.3f}  (n={len(v)})')

# ---------------------------------------------------------------- residual trends (structural check)
P('\n== Residual trends after source offsets (primary): weighted slope +- SE; |slope/SE| > 2 marks a trend')
rr = PRIMARY.row_residuals()
def trend(xs, ys, ws, label):
    xs, ys, ws = map(np.array, (xs, ys, ws))
    if len(xs) < 4 or np.ptp(xs) == 0: return
    X = np.vstack([np.ones_like(xs), xs]).T; Wm = np.diag(ws)
    beta = np.linalg.solve(X.T @ Wm @ X, X.T @ Wm @ ys); res = ys - X @ beta
    s2 = float(np.sum(ws * res ** 2) / max(1, len(xs) - 2)); se = math.sqrt(s2 * np.linalg.inv(X.T @ Wm @ X)[1, 1])
    P(f'   {label:44s} n={len(xs):3d} slope {beta[1]:+.4f} +- {se:.4f}  {"TREND" if abs(beta[1]) > 2 * se else "ok"}')
def rtT(r): return max([c for h, c in r['seg'] if c >= 10] or [r['seg'][0][1]])
def hrs(r): return sum(h for h, _ in r['seg'])
def cshare(r): return sum(h for h, c in r['seg'] if c < 10) / hrs(r)
trend([rtT(x[0]) for x in rr], [x[4] for x in rr], [x[0]['W'] for x in rr], 'vs room temperature (all rows)')
trend([math.log(hrs(x[0])) for x in rr], [x[4] for x in rr], [x[0]['W'] for x in rr], 'vs ln hours (all rows)')
trend([cshare(x[0]) for x in rr], [x[4] for x in rr], [x[0]['W'] for x in rr], 'vs cold share (all rows)')
for reg in ['rt_mild', 'cold', 'biga', 'poolish_rt']:
    sub = [x for x in rr if x[0]['regime'] == reg]
    trend([math.log(hrs(x[0])) for x in sub], [x[4] for x in sub], [x[0]['W'] for x in sub], f'vs ln hours ({reg})')
    if reg in ('rt_mild', 'poolish_rt', 'biga'): trend([rtT(x[0]) for x in sub], [x[4] for x in sub], [x[0]['W'] for x in sub], f'vs room temperature ({reg})')
P('   mean residual by regime / yeast type (after offsets):')
for key in ('regime', 'yeast_type'):
    g = collections.defaultdict(list)
    for x in rr: g[x[0][key].split(' ')[0].lower() if key == 'yeast_type' else x[0][key]].append(x[4])
    P('     ' + '; '.join(f'{k} n={len(v)} {np.mean(v):+.2f}' for k, v in sorted(g.items())))
P('   comparisons (stated vs model, ln-dose units):')
for c in PRIMARY.comps:
    P(f"     {c['id']} {c['source'][:22]:22s} {c['kind']:5s} stated {c['ratio']:.3f} residual {comparison_residual(c, PRIMARY.p):+.2f}")

# ---------------------------------------------------------------- regime checks
P('\n== Regime checks (primary):')
for k, v in checks(PRIMARY.p).items(): P(f'   {k:40s} {v:.3f}')

json.dump({'primary': {k: float(v) for k, v in PRIMARY.p.items()}, 'se': {k: float(v) for k, v in PRIMARY.se.items()},
           'sigma': PRIMARY.sigma, 'tau': PRIMARY.tau_u, 'flagged': flag, 'holdout': sorted(H), 'ci': ci, 'coverage': {k: {kk: vv for kk, vv in v.items() if kk != 'lineages'} for k, v in cov.items()},
           'schemes': {s: {k: float(v) for k, v in fs.p.items()} for s, fs in schemes.items()},
           'offsets': PRIMARY.u}, open(os.path.join(OUT, 'fit3-results.json'), 'w'), indent=1)

# ---------------------------------------------------------------- plots
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
p = PRIMARY.p
COL = {'rt_mild': '#1f77b4', 'cool': '#17becf', 'hot': '#d62728', 'cold': '#9467bd', 'biga': '#8c564b', 'poolish_rt': '#2ca02c', 'poolish_fridge': '#bcbd22'}
MK = {'fresh': 'o', 'instant': 's', 'idy': 's', 'unstated': 'x', 'dry': '^', 'ady': 'D', 'cy': 'o', 'unknown': 'x'}
def mk(t):
    t = t.lower()
    for k in ('fresh', 'cy', 'instant', 'idy', 'ady', 'active', 'dry', 'unstated'):
        if t.startswith(k): return {'active': 'D'}.get(k, MK.get(k, 'x'))
    return 'x'
def collapse(ax, use_offsets, title, params=p, fitobj=PRIMARY):
    for row, H_, Te, raw, adj in fitobj.row_residuals(params):
        lnM = {'dough': 0, 'poolish': params['lnMp'], 'biga': params['lnMb']}[row['medium']]
        lnR = math.log(rise(Te, params)) if row['medium'] == 'dough' else 0
        y = row['y'] - lnM - lnR - (fitobj.u.get(row['source'], 0) if use_offsets else 0)
        ax.scatter(math.log(H_), y, c=COL[row['regime']], marker=mk(row['yeast_type']), s=22, alpha=0.75)
    xs = np.linspace(-1, 3.6, 50)
    ys = params['lnA'] - params['b'] * xs - params.get('c', 0) * (xs - math.log(8)) ** 2
    band = math.sqrt(fitobj.sigma ** 2 + (0 if use_offsets else fitobj.tau_u ** 2))
    ax.plot(xs, ys, 'k-'); ax.fill_between(xs, ys - band, ys + band, color='k', alpha=0.1)
    ax.set_xlabel('ln Heq (equivalent hours at 25 C)'); ax.set_ylabel('ln(dose / (M R))'); ax.set_title(title, fontsize=10)
    for reg, cc in COL.items(): ax.scatter([], [], c=cc, label=reg, s=18)
    ax.legend(fontsize=7, loc='lower left')
fig, ax = plt.subplots(figsize=(7, 5)); collapse(ax, True, 'a. Data collapse after source offsets (band = shape residual)')
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'plots', 'a-collapse.png'), dpi=110); plt.close(fig)
fig, axs = plt.subplots(1, 2, figsize=(12, 5), sharey=True)
collapse(axs[0], False, 'c. Before source offsets (band = shape + source spread)'); collapse(axs[1], True, 'c. After source offsets')
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'plots', 'c-before-after-offsets.png'), dpi=110); plt.close(fig)
fig, axs = plt.subplots(2, 2, figsize=(12, 9))
rr = PRIMARY.row_residuals()
for ax, (fx, lab) in zip(axs.flat, [(rtT, 'room temperature (C)'), (lambda r: math.log(hrs(r)), 'ln hours'), (cshare, 'cold share of hours'), (None, 'regime')]):
    if fx is None:
        regs = list(COL)
        for i, reg in enumerate(regs):
            ys = [x[4] for x in rr if x[0]['regime'] == reg]
            ax.scatter(np.full(len(ys), i) + np.random.RandomState(1).uniform(-.2, .2, len(ys)), ys, c=COL[reg], s=14)
        ax.set_xticks(range(len(regs))); ax.set_xticklabels(regs, rotation=30, fontsize=8)
    else:
        for x in rr: ax.scatter(fx(x[0]), x[4], c=COL[x[0]['regime']], marker=mk(x[0]['yeast_type']), s=16, alpha=0.75)
    ax.axhline(0, color='k', lw=0.8); ax.set_xlabel(lab); ax.set_ylabel('residual after offsets (ln)')
fig.suptitle('b. Residuals after source offsets'); fig.tight_layout(); fig.savefig(os.path.join(OUT, 'plots', 'b-residuals.png'), dpi=110); plt.close(fig)
# d. old engine (main, Craig v1.1) vs Phase 2 vs Phase 3, constant room temperature, dough 23 C at the mix
P2 = {'lnA': math.log(2.05), 'b': 1.24, 'Tmin': -0.5, 'Topt': 32.3, 'lnMp': math.log(0.83), 'lnMb': math.log(2.67), 'Rh': 0.6, 'c': 0.0, 'tauc': 2.0}
fig, axs = plt.subplots(1, 2, figsize=(12, 5))
hs = np.linspace(2, 24, 60)
for T, cc in ((18, '#17becf'), (22, '#1f77b4'), (26, '#2ca02c'), (30, '#d62728')):
    old = 9.5 / (hs ** 1.65 * 2.5 ** ((T - 25) / 10)) * (1 / 1.15 if T >= 30 else 1)
    axs[0].plot(hs, old, ':', c=cc); axs[0].plot(hs, [dose_at(P2, [(h, T)], 23) for h in hs], '--', c=cc)
    axs[0].plot(hs, [dose_at(p, [(h, T)], 23) for h in hs], '-', c=cc, label=f'{T} C')
for ax in axs: ax.set_yscale('log'); ax.set_xlabel('hours'); ax.set_ylabel('IDY % of flour')
axs[0].set_title('d. Room temperature: dotted main (Craig v1.1), dashed Phase 2, solid Phase 3', fontsize=9); axs[0].legend(fontsize=8)
cs = np.linspace(12, 72, 40)
oldc = lambda h: 7.5 / h ** 1.313 * 2 ** ((6 - 4) / 10)
axs[1].plot(cs, [oldc(h) for h in cs], 'k:', label='dough, main')
axs[1].plot(cs, [dose_at(P2, [(2, 22), (h, 6), (2, 22)], 23) for h in cs], 'k--', label='dough, Phase 2')
axs[1].plot(cs, [dose_at(p, [(2, 22), (h, 6), (2, 22)], 23) for h in cs], 'k-', label='dough, Phase 3')
axs[1].plot(cs, [dose_at(P2, [(1, 20), (h, 5), (1, 20)], 20, 'biga') for h in cs], '--', c='#8c564b', label='biga, Phase 2')
axs[1].plot(cs, [dose_at(p, [(1, 20), (h, 5), (1, 20)], 20, 'biga') for h in cs], '-', c='#8c564b', label='biga, Phase 3')
axs[1].set_xlabel('hours in the fridge (6 C dough, 5 C biga)'); axs[1].set_title('d. Cold: 2 h room + fridge + 2 h room (dough)', fontsize=9); axs[1].legend(fontsize=8)
fig.tight_layout(); fig.savefig(os.path.join(OUT, 'plots', 'd-old-vs-new.png'), dpi=110); plt.close(fig)
json.dump(flag, open(os.path.join(OUT, 'flagged.json'), 'w'))
P('\nplots written to', os.path.join(OUT, 'plots'))
