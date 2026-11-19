"""Phase 3 model and mixed-effects fit.

ln dose_i = ln A + ln M_medium + ln R(T_end) - b ln Heq_i - c (ln Heq_i - ln 8)^2 + u_source + e_i
  u_source ~ N(0, tau^2): a per-source offset (endpoint, flour, style), profiled out analytically
  e_i ~ N(0, sigma^2 / W_i): W_i = credibility weight / rows of the row's lineage
A is anchored to the dough sources (E1, 'ready/doubled'): their offsets average zero.
Comparisons (temperature-speed statements, hot/cold dose ratios, Nestec, proof pairs) carry no offset.
"""
import math, collections
import numpy as np
from scipy.optimize import least_squares

TMAX = 45.4
B_SCALE = 1.2   # fixed conversion of time/rate ratios to ln-dose units (a fitted b here would reward a small b)

def ctmi_v(T, Tmin, Topt):
    T = np.asarray(T, dtype=float)
    num = (T - TMAX) * (T - Tmin) ** 2
    den = (Topt - Tmin) * ((Topt - Tmin) * (T - Topt) - (Topt - TMAX) * (Topt + Tmin - 2 * T))
    return np.where((T > Tmin) & (T < TMAX), num / den, 0.0)

def rel(T, p):
    return float(ctmi_v(T, p['Tmin'], p['Topt']) / ctmi_v(25.0, p['Tmin'], p['Topt']))

def heq(segments, T0, p, tau0=2.0, n=96):
    ref = float(ctmi_v(25.0, p['Tmin'], p['Topt']))
    T, s = T0, 0.0
    for hours, env in segments:
        if hours <= 0: continue
        tau = p.get('tauc', tau0) if env < 10 else tau0   # cooling into a fridge: its own time constant (structure test)
        trans = min(hours, 8 * tau)
        t = np.linspace(0, trans, n + 1)
        Tt = env + (T - env) * np.exp(-t / tau)
        y = ctmi_v(Tt, p['Tmin'], p['Topt']) / ref
        h = trans / n
        s += h / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum())
        T = float(Tt[-1])
        if hours > trans:
            s += (hours - trans) * float(ctmi_v(env, p['Tmin'], p['Topt']) / ref)
            T = env + (T - env) * math.exp(-(hours - trans) / tau)
    return s, T

def rise(Tend, p):
    x = min(1.0, max(0.0, (Tend - 25.0) / 3.0)); sm = x * x * (3 - 2 * x)
    return 1 - (1 - p['Rh']) * sm

def ln_dose(H, Tend, medium, p, rise_applies=True):
    M = {'dough': 0.0, 'poolish': p['lnMp'], 'biga': p['lnMb']}[medium]
    R = math.log(rise(Tend, p)) if (rise_applies and medium == 'dough') else 0.0
    lH = math.log(max(H, 1e-6))
    return p['lnA'] + M + R - p['b'] * lH - p.get('c', 0.0) * (lH - math.log(8)) ** 2

NAMES = ['lnA', 'b', 'Tmin', 'Topt', 'lnMp', 'lnMb', 'Rh', 'c', 'tauc']
BOUNDS = {'lnA': (-3, 4), 'b': (0.5, 2.2), 'Tmin': (-10, 8), 'Topt': (27, 40), 'lnMp': (-3, 3), 'lnMb': (-3, 3), 'Rh': (0.3, 1.0), 'c': (-0.6, 0.6), 'tauc': (0.5, 8.0)}
X0 = {'lnA': 0.7, 'b': 1.2, 'Tmin': -0.5, 'Topt': 32.3, 'lnMp': -0.2, 'lnMb': 0.5, 'Rh': 0.8, 'c': 0.0, 'tauc': 2.0}

def time_to(dose_ln, T, p, medium='dough', tau=2.0):
    """hours at constant T (dough starting at T) for a dose to reach its target (rise from the end temperature = T)."""
    lnR = math.log(rise(T, p)) if medium == 'dough' else 0.0
    target = math.exp((p['lnA'] + lnR - dose_ln) / p['b'])   # c ignored here: comparisons are on rates
    r = rel(T, p)
    return target / r if r > 0 else float('inf')

def comparison_residual(cm, p):
    """In ln-dose units."""
    if cm['kind'] == 'rate':
        rr = rel(cm['other'], p) / rel(cm['ref'], p)
        return B_SCALE * (math.log(cm['ratio']) - math.log(max(rr, 1e-9)))
    if cm['kind'] == 'dose':
        a, o = cm['ref'], cm['other']
        Ha, Ta = heq(a['seg'], a['T0'], p); Ho, To = heq(o['seg'], o['T0'], p)
        pred = ln_dose(Ho, To, o['medium'], p) - ln_dose(Ha, Ta, a['medium'], p)
        return math.log(cm['ratio']) - pred
    if cm['kind'] == 'time':
        # same dose: the one that makes the reference schedule ready; time ratio t_ref / t_other
        a, o = cm['ref'], cm['other']
        Ta, To = a['seg'][0][1], o['seg'][0][1]
        d = ln_dose(a['seg'][0][0] * rel(Ta, p), Ta, 'dough', p)
        t_other = time_to(d, To, p)
        pred = a['seg'][0][0] / t_other
        return B_SCALE * (math.log(cm['ratio']) - math.log(max(pred, 1e-9)))
    raise ValueError(cm['kind'])

class Fit:
    def __init__(self, rows, comps, pairs, fixed=None, sigma=0.4, tau_u=0.5, use_c=False, use_tauc=False):
        self.rows, self.comps, self.pairs = rows, comps, pairs
        self.fixed = dict(fixed or {})
        if not use_c: self.fixed.setdefault('c', 0.0)
        if not use_tauc: self.fixed.setdefault('tauc', 2.0)
        self.names = [k for k in NAMES if k not in self.fixed]
        self.sigma, self.tau_u = sigma, tau_u
        self.src = sorted({r['source'] for r in rows})
        self.idx = {s: i for i, s in enumerate(self.src)}
        self.anchor = sorted({r['source'] for r in rows if r['medium'] == 'dough'})
        self.has = {m: any(r['medium'] == m for r in rows) for m in ('poolish', 'biga')}
        if not self.has['poolish']: self.fixed['lnMp'] = 0.0
        if not self.has['biga']: self.fixed['lnMb'] = 0.0
        self.names = [k for k in NAMES if k not in self.fixed]

    def params(self, th):
        p = dict(self.fixed); p.update(zip(self.names, th)); return p

    def raw(self, p):
        r = np.array([row['y'] - ln_dose(*heq(row['seg'], row['T0'], p), row['medium'], p) for row in self.rows])
        return r

    def offsets(self, r):
        lam = (self.sigma / self.tau_u) ** 2
        num = collections.defaultdict(float); den = collections.defaultdict(float)
        for row, ri in zip(self.rows, r):
            num[row['source']] += row['W'] * ri; den[row['source']] += row['W']
        u = {s: num[s] / (den[s] + lam) for s in self.src}
        return u

    def resid(self, th, detail=False):
        p = self.params(th)
        r = self.raw(p)
        u = self.offsets(r)
        shift = np.mean([u[s] for s in self.anchor]) if self.anchor else 0.0   # anchor: E1 offsets average zero
        out = [math.sqrt(row['W']) * (ri - u[row['source']]) / self.sigma for row, ri in zip(self.rows, r)]
        lam = (self.sigma / self.tau_u) ** 2
        out += [math.sqrt(lam) * u[s] / self.sigma for s in self.src]
        for cm in self.comps:
            out.append(math.sqrt(cm['W']) * comparison_residual(cm, p) / self.sigma)
        for pr in self.pairs:
            Ha, _ = heq([(pr['h21'], 21.0)], pr['T0'], p); Hb, _ = heq([(pr['h27'], 27.0)], pr['T0'], p)
            out.append(math.sqrt(pr['W']) * B_SCALE * math.log(Ha / Hb) / self.sigma)
        if detail:
            return np.array(out), r, u, shift, p
        return np.array(out)

    def run(self, iters=8):
        x0 = [X0[k] for k in self.names]
        lo = [BOUNDS[k][0] for k in self.names]; hi = [BOUNDS[k][1] for k in self.names]
        for it in range(iters):
            sol = least_squares(self.resid, x0, bounds=(lo, hi), x_scale='jac')
            x0 = sol.x
            _, r, u, shift, p = self.resid(sol.x, detail=True)
            e = np.array([ri - u[row['source']] for row, ri in zip(self.rows, r)])
            W = np.array([row['W'] for row in self.rows])
            sig = math.sqrt(float(np.sum(W * e ** 2) / max(1e-9, np.sum(W))) * len(e) / max(1, len(e) - len(self.names)))
            # EM update of the offset variance: E[u^2] = u_hat^2 + posterior variance
            den = collections.defaultdict(float)
            for row in self.rows: den[row['source']] += row['W']
            post = [1.0 / (den[s] / self.sigma ** 2 + 1.0 / self.tau_u ** 2) for s in self.src]
            uu = np.array([u[s] for s in self.src])
            tau = math.sqrt(max(0.0025, float(np.mean(uu ** 2 + np.array(post)))))
            self.sigma, self.tau_u = max(0.05, sig), max(0.05, tau)
        self.sol = sol
        _, r, u, shift, p = self.resid(sol.x, detail=True)
        p = dict(p); p['lnA'] += shift
        self.u = {s: u[s] - shift for s in self.src}
        self.p = p
        J = sol.jac; dof = max(1, len(sol.fun) - len(self.names))
        try:
            cov = np.linalg.inv(J.T @ J) * float(sol.fun @ sol.fun) / dof
            self.se = dict(zip(self.names, np.sqrt(np.diag(cov))))
        except np.linalg.LinAlgError:
            self.se = {k: float('nan') for k in self.names}
        return self

    def row_residuals(self, p=None, with_offset=True):
        p = p or self.p
        out = []
        for row in self.rows:
            H, Te = heq(row['seg'], row['T0'], p)
            raw = row['y'] - ln_dose(H, Te, row['medium'], p)
            out.append((row, H, Te, raw, raw - (self.u.get(row['source'], 0.0) if with_offset else 0.0)))
        return out
