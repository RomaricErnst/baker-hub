import json,math
from data3 import assemble
from core import Fit, rel
import os
fl=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','flagged.json')))   # structure test: free fridge cooling time constant (also in run3.py)
for sch in ['regime','equal','tier','pro']:
  rows,comps,pairs=assemble(sch,exclude_ids=fl)
  f0=Fit(rows,comps,pairs).run(); f1=Fit(rows,comps,pairs,use_tauc=True).run()
  o0=float(f0.sol.fun@f0.sol.fun); o1=float(f1.sol.fun@f1.sol.fun)
  for f,o in((f0,o0),(f1,o1)):
    p=f.p; print(sch, {k:round(v,3) for k,v in p.items()}, 'r6 %.3f'%rel(6,p),'obj %.1f'%o,'sig %.3f tau %.3f'%(f.sigma,f.tau_u),'se tauc',round(f.se.get('tauc',float('nan')),2))
  # cold residual mean
  for f in (f0,f1):
    rr=[x for x in f.row_residuals() if x[0]['regime']=='cold']; print('  cold mean',round(sum(x[4] for x in rr)/len(rr),3))
