"""Pre-registered hold-out: 5 of 21 fit-eligible sources (24 %), drawn with a fixed seed under
constraints that keep every parameter identifiable in the fit set."""
import random
from rows import load
def holdout_sources():
    R = load()
    srcs = sorted({e['source'] for e in R if e['use'] in ('fit', 'pair')})
    rng = random.Random(20261119)
    while True:
        h = set(rng.sample(srcs, 5))
        if {'Modernist Pizza Vol. 4', 'Modernist Bread'} <= h: continue          # pairs + poolish anchor
        if {'Modernist Bread', 'Dissapore'} <= h: continue                       # biga needs one
        if len(h & {'Lehmann', 'Ooni', 'da Michele (Michelin SG)', 'fond.kitchen'}) > 2: continue
        return sorted(h)
if __name__ == '__main__':
    print(holdout_sources())
