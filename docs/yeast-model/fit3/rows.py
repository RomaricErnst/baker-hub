"""Every DATASET.csv row mapped to a protocol the model can integrate, with the
reason when a row is not used for fitting. Assumptions are written next to the row."""
import csv, os
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'DATASET.csv')   # Phase 1 rows only (D...); Phase 3 rows (N...) come from newdata.py
TEMPER_H = 2.0      # assumed RT finish for cold tables that state none (fond: 1.5-3 h; Modernist: 2 h)
TEMPER_C = 21.0

def source_key(s):
    s0 = s.lower()
    for k, v in [('modernist pizza', 'Modernist Pizza Vol. 4'), ('modernist bread', 'Modernist Bread'),
                 ('dough.school', 'dough.school'), ('crust kingdom', 'Crust Kingdom'), ('my pizza night', 'My Pizza Night'),
                 ("jordo", "Jordo's"), ('fond.kitchen', 'fond.kitchen'), ('biorito', 'Biorito'),
                 ('pizza napoletana doc', 'Pizza Napoletana DOC'), ('yozzause', 'yozzause (TFL)'), ('sage-the-baker', 'TFL AI post'),
                 ('khymos', 'khymos/PizzApp+'), ('github dough-designer', 'Craig via GitHub PR'), ('eu reg', 'EU TSG 97/2010'),
                 ('michelin', 'da Michele (Michelin SG)'), ('pizzastunde', 'Pizzastunde'), ('forkish', 'Forkish'), ('ooni', 'Ooni'),
                 ('baking steel', 'Baking Steel'), ('lehmann', 'Lehmann'), ('gozney', 'Gozney'),
                 ('v-zug', 'V-ZUG SG'), ('elmo', 'Elmo bakes'), ('mini oven', 'TFL Mini Oven'), ("pain in the", 'TFL Riviera Maya'),
                 ('weekend bakery', 'Weekend Bakery'), ('suas', 'Suas'), ('giorilli', 'Giorilli'), ('dissapore', 'Dissapore'),
                 ('pezzetta', 'Pezzetta'), ('dough formula', 'The Dough Formula'), ('calbeachbaker', 'CalBeachBaker (TFL)'),
                 ('finney', 'Finney et al. 1976')]:
        if k in s0:
            return v
    return s

def f(x):
    try: return float(x)
    except Exception: return None

def load():
    rows = [r for r in csv.DictReader(open(DATA)) if not r['id'].startswith('N')]
    out = []
    for x in rows:
        i = x['id']; src = source_key(x['source']); d = f(x['idy_pct_fermenting_flour'])
        rt_c, rt_h, fr_c, fr_h = f(x['rt_c']), f(x['rt_h']), f(x['fridge_c']), f(x['fridge_h'])
        med = x['medium']; conf = x['confidence']
        e = dict(id=i, source=src, dose=d, medium='dough', group=None, use=None, seg=None, T0=None,
                 note='', conf=conf, endpoint=x['endpoint'], raw=x)
        n = int(i[1:])
        # ---- exclusions first ----------------------------------------------------------
        if src == 'dough.school':
            e.update(use='reference', group='direct RT' if fr_h is None else 'cold',
                     note='not independent: the table reproduces the current engine (Phase 1 §0)')
        elif src == 'Craig via GitHub PR':
            e.update(use='reference', group='direct RT', note='secondary description of Craig; original unreachable')
        elif conf == 'EXCLUDED':
            e.update(use='excluded', note='AI post / chemical leavening')
        elif src == 'Pizza Napoletana DOC' and fr_h is not None:
            e.update(use='excluded', note='flagged implausible in Phase 1 (fridge only 1.5-2x RT time)')
        elif (d is None and not med.startswith('dough (proof')) or (rt_h is None and fr_h is None):
            e.update(use='excluded', note='no dose or no time')
        if e['use'] is None:
            e['use'] = 'fit'
        # ---- protocol -------------------------------------------------------------------
        T0 = rt_c
        if 'poolish' in med and 'dough' not in med:
            e['medium'] = 'poolish'; e['group'] = 'poolish' if 'fridge' not in med else 'fridge poolish'
        elif med == 'biga':
            e['medium'] = 'biga'; e['group'] = 'biga'
        elif med.startswith('dough (proof'):
            e['group'] = 'proof pair'
        elif 'poolish' in med and 'dough' in med:
            e['group'] = 'poolish dough (total yeast)'; e['use'] = 'check' if e['use'] == 'fit' else e['use']
        elif 'sponge' in med or 'pâte' in med:
            e['group'] = 'other preferment'; e['use'] = 'check' if e['use'] == 'fit' else e['use']
        elif e['group'] is None:
            e['group'] = 'direct RT' if fr_h is None else 'cold'
        if e['group'] == 'cold' or (e['group'] == 'poolish dough (total yeast)' and fr_h):
            pass
        seg = None
        if e['group'] in ('direct RT', 'poolish', 'biga', 'other preferment', 'proof pair', 'poolish dough (total yeast)') and rt_h and not fr_h:
            seg = [(rt_h, rt_c if rt_c is not None else None)]
        # Row-specific protocols (assumptions stated)
        P = {
            'D019': ([(2, 21), (22, 4), (TEMPER_H, TEMPER_C)], 21), 'D020': ([(2, 21), (46, 4), (TEMPER_H, TEMPER_C)], 21),
            'D021': ([(2, 21), (70, 4), (TEMPER_H, TEMPER_C)], 21), 'D022': ([(2, 21), (46, 3), (5, 21)], 21),
            'D046': ([(1.08, 21), (48, 4), (2.25, 21)], 21),
            'D077': ([(2, 24), (10, 6.5), (6, 24)], 24.5),
            'D079': ([(0.25, 21), (48, 4), (5, 21)], 26),
            'D084': ([(0.25, 21), (48, 3), (1.25, 21)], 28),
            'D085': ([(1.5, 21), (36, 4), (4.5, 21)], 21),
            'D109': ([(0.33, 21), (36, 4), (2, 21)], 27), 'D111': ([(0.33, 21), (36, 4), (2, 21)], 27),
            'D113': ([(0.33, 21), (36, 4), (2, 21)], 27), 'D114': ([(0.33, 21), (36, 4), (2, 21)], 27),
            'D156': ([(0.5, 21), (24, 3.3), (TEMPER_H, TEMPER_C)], 21),
            'D152': ([(0.5, 21), (18, 4), (1.0, 21)], 21), 'D153': ([(0.5, 21), (24, 4), (1.0, 21)], 21),
        }
        if i in P:
            seg, T0 = P[i]
        elif e['group'] == 'cold' and fr_h and not rt_h:
            # straight into the fridge after mixing, then an assumed temper
            seg = [(0.25, 21), (fr_h, fr_c), (TEMPER_H, TEMPER_C)]; T0 = 21
            e['note'] += ' assumed: mixed at 21 °C, straight to fridge, 2 h temper at 21 °C'
        # Mix temperature where stated (notes / profile)
        if src == 'Modernist Pizza Vol. 4' and e['group'] in ('direct RT', 'poolish dough (total yeast)') and i not in P: T0 = 27
        if i == 'D128': T0 = 25
        if i in ('D080', 'D081'): T0 = 25.5
        if i == 'D082': T0 = 28
        if i == 'D077': T0 = 24.5
        if i in ('D134', 'D135', 'D136', 'D155', 'D063', 'D064', 'D065', 'D066', 'D067', 'D068', 'D069', 'D070'):
            if i.startswith('D06') or i == 'D070':
                seg = [(rt_h, 26.5)]; T0 = 26.5; e['use'] = 'check'
                e['note'] = 'dough temperature not stated (26.5 °C assumed): check only'
            else:
                e['use'] = 'excluded'; e['note'] = 'temperature not given (duplicate relay of Suas / unstated)'
        if i in ('D087', 'D106'):
            e['use'] = 'check'; e['note'] = 'enriched/sweet: tests the fixed enriched dose, not the lean law'
        if e['group'] == 'fridge poolish' and e['use'] == 'fit':
            e['use'] = 'check'; e['note'] = 'fridge temperature not stated (4 °C assumed): check only'
        if e['group'] == 'cold':
            e['school'] = 'community table' if src in ('Crust Kingdom', 'My Pizza Night', "Jordo's", 'Biorito', 'dough.school') or i in ('D044', 'D045') else 'recipe'
        if e['group'] == 'proof pair':
            e['use'] = 'pair' if e['use'] == 'fit' else e['use']
        if seg is not None:
            seg = [(h, c if c is not None else 21.0) for h, c in seg]
        e['seg'] = seg; e['T0'] = T0 if T0 is not None else (seg[0][1] if seg else None)
        if e['use'] in ('fit', 'check', 'reference') and seg is None and e['group'] != 'proof pair':
            e['use'] = 'excluded'; e['note'] += ' no usable protocol'
        out.append(e)
    return out

if __name__ == '__main__':
    import collections
    R = load()
    print(collections.Counter((e['group'], e['use']) for e in R))
    for e in R:
        if e['use'] == 'excluded': print(e['id'], e['source'], e['note'])
