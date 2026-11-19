import math, json, random, sys, collections
import numpy as np
from scipy.optimize import least_squares
from model import heq, dose, rel, ctmi
from rows import load

R = load()
NESTEC = [(4.0, 0.051), (7.0, 0.061), (10.0, 0.095)]   # gas rate relative to 30 °C (US 5,827,724 control, LBB)

def pairs(rows):
    by = collections.defaultdict(list)
    for e in rows:
        if e['use'] == 'pair': by[e['raw']['notes'] + e['raw']['quote'] + e['source']].append(e)
    out = []
    ids = sorted([e for e in rows if e['use'] == 'pair'], key=lambda e: e['id'])
    for a, b in zip(ids[0::2], ids[1::2]):
        assert a['seg'][0][1] == 21 and b['seg'][0][1] == 27, (a['id'], b['id'])
        out.append((a, b))
    return out

PAIRS = pairs(R)
PAIR_T0 = 23.0   # dough temperature at the start of the final proof (assumed; sensitivity tested)

def unpack(th, fixed):
    p = dict(fixed); names = [k for k in ORDER if k not in fixed]
    for k, v in zip(names, th): p[k] = v
    p['A'] = math.exp(p['lnA']); p['Mp'] = math.exp(p['lnMp']); p['Mb'] = math.exp(p['lnMb'])
    return p

ORDER = ['lnA', 'b', 'Tmin', 'Topt', 'lnMp', 'lnMb']

def weights(rows):
    n = collections.Counter(e['source'] for e in rows)
    w = {}
    for e in rows:
        c = 0.5 if e['conf'] == 'anecdote' else 1.0
        w[e['id']] = c / math.sqrt(n[e['source']])
    return w

def residuals(p, rows, tau, use_pairs=True, use_nestec=True, pairs_rows=None, detail=False):
    res, info = [], []
    w = weights(rows)
    for e in rows:
        H = heq(e['seg'], e['T0'], p, tau)
        pred = dose(H, p, e['medium'])
        r = math.log(e['dose']) - math.log(pred)
        res.append(w[e['id']] * r); info.append((e, H, pred, r))
    if use_pairs:
        pr = pairs_rows if pairs_rows is not None else PAIRS
        n = collections.Counter(a['source'] for a, b in pr)
        for a, b in pr:
            Ha = heq([(a['seg'][0][0], 21.0)], PAIR_T0, p, tau); Hb = heq([(b['seg'][0][0], 27.0)], PAIR_T0, p, tau)
            r = p['b'] * math.log(Ha / Hb)
            res.append(r / math.sqrt(n[a['source']])); info.append(((a, b), Ha, Hb, r))
    if use_nestec:
        for T, obs in NESTEC:
            r = p['b'] * (math.log(rel(T, p) / rel(30.0, p)) - math.log(obs)) if rel(T, p) > 0 else -10.0
            res.append(r / math.sqrt(len(NESTEC))); info.append((('Nestec', T), obs, rel(T, p) / rel(30.0, p), r))
    return (np.array(res), info) if detail else np.array(res)

BOUNDS = {'lnA': (-5, 5), 'b': (0.6, 2.2), 'Tmin': (-15, 6), 'Topt': (28, 42), 'lnMp': (-3, 3), 'lnMb': (-3, 3)}
X0 = {'lnA': 0.6, 'b': 1.25, 'Tmin': 0.0, 'Topt': 33.0, 'lnMp': -0.3, 'lnMb': 0.3}

LOSS = 'soft_l1'; F_SCALE = 0.5   # robust least squares in ln(dose); f_scale ~ one between-source SD

def fit(rows, fixed=None, tau=2.0, **kw):
    fixed = dict(fixed or {})
    names = [k for k in ORDER if k not in fixed]
    lo = [BOUNDS[k][0] for k in names]; hi = [BOUNDS[k][1] for k in names]
    x0 = [X0[k] for k in names]
    has_p = any(e['medium'] == 'poolish' for e in rows); has_b = any(e['medium'] == 'biga' for e in rows)
    if not has_p and 'lnMp' not in fixed: fixed['lnMp'] = 0.0
    if not has_b and 'lnMb' not in fixed: fixed['lnMb'] = 0.0
    names = [k for k in ORDER if k not in fixed]
    lo = [BOUNDS[k][0] for k in names]; hi = [BOUNDS[k][1] for k in names]; x0 = [X0[k] for k in names]
    f = lambda th: residuals(unpack(th, fixed), rows, tau, **kw)
    sol = least_squares(f, x0, bounds=(lo, hi), x_scale='jac', loss=LOSS, f_scale=F_SCALE)
    p = unpack(sol.x, fixed)
    J = sol.jac; dof = max(1, len(sol.fun) - len(names))
    s2 = float(sol.fun @ sol.fun) / dof   # residual variance of the (unweighted) ln residuals
    try:
        cov = np.linalg.inv(J.T @ J) * s2; se = dict(zip(names, np.sqrt(np.diag(cov))))
    except np.linalg.LinAlgError:
        se = {k: float('nan') for k in names}
    return p, se, sol, names
