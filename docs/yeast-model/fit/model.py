"""Holistic yeast model (Phase 2). Shared by fit.py and the TypeScript port (app/utils/yeastModel.ts).

Equations
  r(T)   = CTMI(T; Tmin, Topt, Tmax) / CTMI(25 °C)          relative fermentation activity (Rosso et al. 1993)
  T(t)   : dough temperature relaxes to each phase's surroundings, dT/dt = (T_env - T)/tau
  Heq    = integral r(T(t)) dt                               equivalent hours at 25 °C over the dough's real path
  dose   = A * M * R * Heq^-b                                instant yeast, % of the fermenting flour
           M = medium factor (salted dough 1, poolish Mp, biga Mb); R = rise target (E1 = 1)
"""
import math
import numpy as np

TMAX = 45.4   # Salvadó et al. 2011, S. cerevisiae (AEM 77:2292)

def ctmi(T, Tmin, Topt, Tmax=TMAX):
    if T <= Tmin or T >= Tmax:
        return 0.0
    num = (T - Tmax) * (T - Tmin) ** 2
    den = (Topt - Tmin) * ((Topt - Tmin) * (T - Topt) - (Topt - Tmax) * (Topt + Tmin - 2 * T))
    return num / den

def rel(T, p):
    return ctmi(T, p['Tmin'], p['Topt']) / ctmi(25.0, p['Tmin'], p['Topt'])

def ctmi_v(T, Tmin, Topt, Tmax=TMAX):
    T = np.asarray(T, dtype=float)
    num = (T - Tmax) * (T - Tmin) ** 2
    den = (Topt - Tmin) * ((Topt - Tmin) * (T - Topt) - (Topt - Tmax) * (Topt + Tmin - 2 * T))
    out = num / den
    return np.where((T > Tmin) & (T < Tmax), out, 0.0)

def heq(segments, T0, p, tau=2.0, dt=0.02):
    """Vectorised: fine Simpson grid over the first 8 tau of each phase, then the settled remainder."""
    ref = ctmi(25.0, p['Tmin'], p['Topt'])
    T = T0; s = 0.0
    for hours, env in segments:
        trans = min(hours, 8 * tau)
        n = max(2, int(math.ceil(trans / dt)));  n += n % 2
        t = np.linspace(0, trans, n + 1)
        Tt = env + (T - env) * np.exp(-t / tau)
        y = ctmi_v(Tt, p['Tmin'], p['Topt']) / ref
        h = trans / n
        s += h / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum())
        T = float(Tt[-1])
        if hours > trans:
            s += (hours - trans) * rel(env, p)  # T is within 0.03 % of env
            T = env + (T - env) * math.exp(-(hours - trans) / tau)
    return s

def heq_slow(segments, T0, p, tau=2.0, dt=0.02):
    """segments: [(hours, env_C)]; dough starts at T0. Exact exponential relaxation per step, midpoint rate."""
    T = T0
    s = 0.0
    for hours, env in segments:
        n = max(1, int(math.ceil(hours / dt)))
        h = hours / n
        a = math.exp(-h / tau)
        for _ in range(n):
            Tn = env + (T - env) * a
            Tm = env + (T - env) * math.exp(-h / (2 * tau))
            s += h * (rel(T, p) + 4 * rel(Tm, p) + rel(Tn, p)) / 6
            T = Tn
    return s

def dose(H, p, medium='dough', rise=1.0):
    M = {'dough': 1.0, 'poolish': p.get('Mp', 1.0), 'biga': p.get('Mb', 1.0)}[medium]
    return p['A'] * M * rise * H ** (-p['b'])
