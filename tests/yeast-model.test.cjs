// Yeast model (19 Nov 2026; docs/YEAST-MODEL.md): unit properties, the data fit with the shipped constants,
// reference recipes, and the About page's worked examples recomputed from the engine.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const {utils,data}=require('./load-production.cjs');
const m=require('../app/utils/yeastModel.ts');
const H=3600000,d=s=>new Date(s+'Z');
const lnDose=(heq,medium='dough',rise=1)=>Math.log(m.doseForHeq(heq,medium,rise));

test('constants: published cardinal temperatures, fitted dose law and media, sourced endpoint',()=>{
 a.equal(m.YEAST_T_MAX,45.4);a.equal(m.YEAST_T_OPT,32.3);a.equal(m.YEAST_T_MIN,-0.5);
 a.equal(m.YEAST_DOSE_A,2.05);a.equal(m.YEAST_DOSE_B,1.24);
 a.equal(m.YEAST_MEDIUM_POOLISH,0.83);a.equal(m.YEAST_MEDIUM_BIGA,2.67);
 a.equal(m.YEAST_HEAT_RISE,0.6);a.equal(m.YEAST_HEAT_RISE_FROM_C,25);a.equal(m.YEAST_HEAT_RISE_TO_C,28);
 // The document states the same values.
 const doc=fs.readFileSync('docs/YEAST-MODEL.md','utf8');
 for(const v of ['45.4','32.3','−0.5','2.05','1.24','0.83','2.67','0.6'])a.ok(doc.includes(v),`docs/YEAST-MODEL.md states ${v}`);
});

test('activity: 1 at 25 °C, rising to the optimum, falling above it, positive from 1 to 40 °C',()=>{
 a.ok(Math.abs(m.yeastActivity(25)-1)<1e-12);
 let prev=0;
 for(let T=0;T<=m.YEAST_T_OPT;T+=0.25){const r=m.yeastActivity(T);a.ok(r>=prev,`rises at ${T}`);prev=r;}
 prev=m.yeastActivity(m.YEAST_T_OPT);
 for(let T=m.YEAST_T_OPT;T<=40;T+=0.25){const r=m.yeastActivity(T);a.ok(r<=prev+1e-12,`falls at ${T}`);prev=r;}
 for(let T=1;T<=40;T+=0.25)a.ok(m.yeastActivity(T)>0);
 a.equal(m.yeastActivity(m.YEAST_T_MIN),0);a.equal(m.yeastActivity(m.YEAST_T_MAX),0);
});

test('dose: falls with time, with temperature up to the optimum, and inverts exactly',()=>{
 for(let h=0.5;h<=200;h*=1.1)a.ok(m.doseForHeq(h*1.1)<m.doseForHeq(h));
 for(const H0 of [0.3,1,2.5,7,20,90])for(const med of ['dough','poolish','biga'])for(const R of [1,.8,.6]){
  a.ok(Math.abs(m.heqForDose(m.doseForHeq(H0,med,R),med,R)-H0)<1e-9*H0);
  a.ok(Math.abs(m.yeastBudget(m.doseForHeq(H0,med,R),H0,med,R)-1)<1e-12);
 }
 // recommendYeast on a constant-temperature path: more hours or a warmer kitchen (to Topt) never ask for more.
 for(const T of [4,10,16,22,28,32])for(const h of [1,2,4,8,16,32,64]){
  const at=(hh,TT)=>utils.recommendYeast(hh,TT,0,6,'instant',1000,null,'neapolitan').pct;
  a.ok(at(h+0.25,T)<=at(h,T)+1e-9,`${T} °C ${h} h`);
  if(T+0.25<=m.YEAST_T_OPT)a.ok(at(h,T+0.25)<=at(h,T)+1e-9,`${T} °C ${h} h warmer`);
 }
});

test('smooth: no step beyond the curve itself per 0.25 °C or 0.25 h, 2–40 °C, 1–96 h, fridge 1–10 °C',()=>{
 // Room temperature: ln dose = ln A − b ln(h·r(T)) − rise term. Steps are bounded by the local slope:
 // 0.25 h at h hours moves the dose by at most b·ln(1+0.25/h); 0.25 °C moves it by at most 8 % from 10 to 38 °C.
 const dose=(h,T)=>{const p=m.pathHeq(T,[{hours:h,envC:T,tauH:2}]);return m.doseForHeq(p.heq,'dough',m.riseTarget(p.endC));};
 let worstT=0;
 for(let T=2;T<40;T+=0.25)for(const h of [1,3,8,24,96]){
  const s=Math.abs(Math.log(dose(h,T+0.25)/dose(h,T)));
  if(T>=10&&T<38)worstT=Math.max(worstT,s);
  a.ok(Number.isFinite(s));
 }
 a.ok(worstT<Math.log(1.08),`worst 0.25 °C step from 10 to 38 °C: ×${Math.exp(worstT).toFixed(3)}`);
 for(let h=1;h<96;h+=0.25)for(const T of [2,6,15,21,27,32,38]){
  const s=Math.abs(Math.log(dose(h+0.25,T)/dose(h,T)));
  a.ok(s<=m.YEAST_DOSE_B*Math.log(1+0.25/h)+1e-9,`${T} °C ${h} h`);
 }
 // No kink: second differences of ln dose stay small over temperature (E3's smoothstep included).
 for(const h of [4,12])for(let T=2.25;T<39.5;T+=0.25){
  const d2=Math.log(dose(h,T+0.25))-2*Math.log(dose(h,T))+Math.log(dose(h,T-0.25));
  a.ok(Math.abs(d2)<0.03,`curvature at ${T} °C ${h} h: ${d2}`);
 }
 // Fridge 1–10 °C, 24–72 h after 2 h at 21 °C, then 2 h at 21 °C: finite, falls with a warmer fridge and a longer stay.
 for(let F=1;F<=10;F+=0.25)for(const c of [24,48,72]){
  const at=(FF,cc)=>m.doseForHeq(m.pathHeq(24,[{hours:2,envC:21,tauH:2},{hours:cc,envC:FF,tauH:2},{hours:2,envC:21,tauH:2}]).heq);
  a.ok(Number.isFinite(at(F,c))&&at(F,c)>0);
  if(F<10)a.ok(at(F+0.25,c)<at(F,c));
  a.ok(at(F,c+1)<at(F,c));
 }
});

test('rise target: doubled below 25 °C, 0.6 from 28 °C, smooth and monotone between',()=>{
 a.equal(m.riseTarget(20),1);a.equal(m.riseTarget(25),1);a.equal(m.riseTarget(28),0.6);a.equal(m.riseTarget(35),0.6);
 let prev=1;for(let T=25;T<=28;T+=0.05){const r=m.riseTarget(T);a.ok(r<=prev+1e-12);a.ok(prev-r<0.025);prev=r;}
});

test('thermal path: a dough at its surroundings counts r(T) per hour; cooling and warming are in between',()=>{
 a.ok(Math.abs(m.pathHeq(21,[{hours:10,envC:21,tauH:2}]).heq-10*m.yeastActivity(21))<1e-9);
 const cool=m.pathHeq(24,[{hours:12,envC:6,tauH:2}]);
 a.ok(cool.heq>12*m.yeastActivity(6)&&cool.heq<12*m.yeastActivity(24));
 a.ok(Math.abs(cool.endC-(6+18*Math.exp(-6)))<1e-9);
 // The schedule path: the dough leaves the bowl at its target temperature, so iced water (a lower start) slows it.
 const plan=utils.buildSchedule(d('2026-11-21T12:00'),d('2026-11-21T18:30'),[],32,45,'hand','roman',3);
 const warm=utils.doughThermalPath(plan,3,300,70,32,6,32),cold=utils.doughThermalPath(plan,3,300,70,32,6,24);
 a.ok(cold.heq<warm.heq);a.equal(warm.warmHours,plan.totalRTHours);a.equal(warm.coldHours,plan.totalColdHours);
});

test('data fit: the shipped constants against 79 points from 21 sources (fit + 5 held-out sources)',()=>{
 const F=JSON.parse(fs.readFileSync('tests/fixtures/yeast-model-data.json','utf8'));
 const res=r=>Math.log(r.dose/m.doseForHeq(m.pathHeq(r.T0,r.phases.map(([h,c])=>({hours:h,envC:c,tauH:F.tauH}))).heq,r.medium));
 const stat=rows=>{const rs=rows.map(res);return {n:rs.length,mean:rs.reduce((x,y)=>x+y,0)/rs.length,rms:Math.sqrt(rs.reduce((x,y)=>x+y*y,0)/rs.length),within2:rs.filter(r=>Math.abs(r)<=Math.log(2)).length};};
 const fit=stat(F.rows.filter(r=>r.set==='fit')),held=stat(F.rows.filter(r=>r.set==='heldout')),all=stat(F.rows.filter(r=>r.set!=='community-cold'));
 a.equal(all.n,79);a.equal(new Set(F.rows.filter(r=>r.set!=='community-cold').map(r=>r.source)).size,21);
 a.ok(all.rms<0.6,`rms ${all.rms}`);a.ok(Math.abs(all.mean)<0.1,`bias ${all.mean}`);a.ok(all.within2>=55);
 a.ok(fit.rms<0.6);a.ok(held.rms<0.65,`held-out rms ${held.rms}`);a.ok(held.within2>=8);
 // Per regime: no group off by more than a factor of 1.6 on average (≥ 28 °C has two points, documented).
 const by={};for(const r of F.rows.filter(r=>r.set!=='community-cold'))(by[r.regime]??=[]).push(r);
 for(const [k,rows] of Object.entries(by))if(rows.length>2)a.ok(Math.abs(stat(rows).mean)<Math.log(1.6),`${k}: ${stat(rows).mean}`);
 // The community cold tables (rise in the fridge) ask for less yeast than the model: the endpoint E2 differs.
 const cc=stat(F.rows.filter(r=>r.set==='community-cold'));a.ok(cc.mean<-0.6);
 // Proof pairs (same dough at 21 and 27 °C): the model's 27 °C proof is at most 1.35× slower than the books'.
 const pairs=F.pairs.map(p=>Math.log(m.pathHeq(p.T0,[{hours:p.h21,envC:21,tauH:2}]).heq/m.pathHeq(p.T0,[{hours:p.h27,envC:27,tauH:2}]).heq));
 a.ok(pairs.reduce((x,y)=>x+y,0)/pairs.length<Math.log(1.35));
});

// ── Reference recipes (the real engine, before → after in docs/YEAST-MODEL.md) ─────────────
const nights=[19,20,21,22,23].map(day=>({label:'night',from:d(`2026-11-${day}T22:00`),to:d(`2026-11-${day+1}T06:00`)}));
function ref(style,oven,n,w,T,start,bake,blocks,yt,pref,pct,ph,pfr){
 const plan=utils.buildSchedule(d(start),d(bake),blocks,T,45,'hand',style,n,1,false);
 const r=utils.calculateRecipe(style,oven,n,w,T,'normal',plan,6,yt,'custom','hand',undefined,undefined,undefined,undefined,pref,null,pref?pct:undefined,undefined,undefined,false,undefined,pref?pfr:undefined,undefined,pref?ph:undefined);
 const pf=r.preferment,idy=pf?pf.prefYeastGramsIDY+(pf.finalYeastGramsIDY??0):r.yeast.grams;
 return {r,pf,total:idy/r.flour*100,poolishPct:pf?pf.prefYeastGramsIDY/pf.prefFlour*100:null};
}
test('reference recipes land inside their sources\' ranges',()=>{
 // Thomas: 11 h poolish at 20 °C peaks at the mix; the final dough has its own yeast (Modernist poolish doughs).
 const th=ref('baguette','home_oven_stone_bread',2,250,20,'2026-11-21T17:15','2026-11-22T09:00',nights,'fresh','poolish',20,11,false);
 a.ok(Math.abs(data.poolishPeakHours(th.poolishPct,false,20,6,{massG:th.pf.prefFlour+th.pf.prefWater})-11)<1e-6);
 a.ok(th.poolishPct>0.1&&th.poolishPct<0.2,'MP4 p. 2 / MB6 p. 20: 0.1–0.2 % at 12 h');
 a.ok(th.total>0.2&&th.total<0.6);
 // Neapolitan with a 12 h poolish at 22 °C: poolish in the books' 12–16 h row, total near MP4's 0.40 %.
 const np=ref('neapolitan','pizza_oven',4,250,22,'2026-11-20T18:00','2026-11-21T20:00',[],'instant','poolish',30,12,false);
 a.ok(np.poolishPct>0.08&&np.poolishPct<0.2);a.ok(np.total>0.12&&np.total<0.5);
 // Fridge poolish 18 h at 6 °C: Weekend Bakery's 0.5 % for 18 h (fridge temperature unstated), within 2×.
 const fp=ref('newyork','home_oven_steel',4,280,22,'2026-11-20T18:00','2026-11-21T20:00',[],'instant','poolish',30,18,true);
 a.ok(fp.poolishPct>0.25&&fp.poolishPct<1.0);a.equal(fp.pf.pastPeak,undefined);
 // Direct cold Neapolitan at 21 °C: 24 h and 48 h cold, between the community tables and the professional recipes.
 const c24=ref('neapolitan','pizza_oven',4,250,21,'2026-11-20T18:00','2026-11-21T20:00',[],'instant');
 const c48=ref('neapolitan','pizza_oven',4,250,21,'2026-11-19T18:00','2026-11-21T20:00',[],'instant');
 a.ok(c24.total>0.1&&c24.total<0.4);a.ok(c48.total>0.07&&c48.total<0.4);a.ok(c48.total<c24.total);
 // 30–32 °C kitchens: the warm room-temperature dough gets less yeast than at 22 °C; the cold plan more than the old engine's 0.07 %.
 const hot6=ref('roman','home_oven_steel',3,300,30,'2026-11-21T12:00','2026-11-21T18:30',[],'instant');
 const mild6=ref('roman','home_oven_steel',3,300,22,'2026-11-21T12:00','2026-11-21T18:30',[],'instant');
 a.ok(hot6.total<mild6.total*0.65,'hot-kitchen practice: about half the yeast');
 const hot26=ref('neapolitan','pizza_oven',4,250,32,'2026-11-20T18:00','2026-11-21T20:00',[],'instant');
 a.ok(hot26.total>0.1&&hot26.total<0.4);
 // A 2.5 h emergency dough: Modernist's 0.8–1 % for 2.3 h, within 1.5×, under the 1.5 % ceiling.
 const em=ref('neapolitan','pizza_oven',4,250,22,'2026-11-21T17:30','2026-11-21T20:00',[],'instant');
 a.ok(em.total>0.6&&em.total<1.5);a.ok(!em.r.yeast.warnings.some(w=>w.key==='fermentationBudget'));
 // Enriched brioche keeps the fixed 1 % (MP4 Pizza Gourmet: 1.08 % at 10.7 % sugar).
 const br=ref('brioche','standard_bread',1,600,22,'2026-11-21T22:00','2026-11-22T08:00',[],'instant');
 a.equal(br.r.yeast.pct,1);a.equal(br.r.yeast.fixedEnrichedDose,true);
});

test('About page: every worked example and constant is the engine\'s, in both locales',()=>{
 const page=fs.readFileSync('app/[locale]/about/yeastModelSection.tsx','utf8');
 const [en,fr]=page.split('export function YeastModelSectionFr');
 const fmt=(x,dp,loc)=>x.toFixed(dp).replace('.',loc==='fr'?',':'.');
 const has=(x,dp,suffix='')=>{for(const [loc,src] of [['en',en],['fr',fr]])a.ok(src.includes(fmt(x,dp,loc)+suffix),`${loc}: ${fmt(x,dp,loc)}${suffix}`);};
 for(const T of [4,6,15,21,25,30,35])has(m.yeastActivity(T),2,"'");
 const ex=(T0,ph,med='dough')=>{const p=m.pathHeq(T0,ph.map(([h,c])=>({hours:h,envC:c,tauH:2})));return {p,dose:m.doseForHeq(p.heq,med,med==='dough'?m.riseTarget(p.endC):1)};};
 const e1=ex(21,[[12,21]]),e2=ex(24,[[2,21],[46,6],[2,21]]),e3=ex(21,[[12,21]],'poolish'),e4=ex(24,[[6,30]]);
 for(const e of [e1,e2,e3,e4]){has(e.p.heq,1,' h');has(e.dose,2,' %');}
 has(e4.p.endC,1,' °C');has(m.riseTarget(e4.p.endC),1,')');
 for(const [v,dp] of [[m.YEAST_DOSE_A,2],[m.YEAST_DOSE_B,2],[m.YEAST_MEDIUM_POOLISH,2],[m.YEAST_MEDIUM_BIGA,2],[m.YEAST_T_MAX,1],[m.YEAST_T_OPT,1]])has(v,dp);
 for(const src of [en,fr])a.ok(src.includes('−0'+(src===en?'.':',')+'5 °C'));
});

test('inversion: every rising crossing of a non-monotone budget, the one nearest the style window within the time left',()=>{
 const bake=d('2026-12-05T19:00'),o={bake,blocks:[],kitchenTemp:22,preheatMin:45,mixerType:'hand',styleKey:'neapolitan',numItems:4,itemWeight:260,mixingBatches:1,fridgeTemp:6,hydration:65};
 const budgetAt=(dose,h)=>{const s=utils.buildSchedule(new Date(+bake-h*H),bake,[],22,45,'hand','neapolitan',4,1,false);const p=utils.doughThermalPath(s,4,260,65,22,6,23);return {b:utils.fermentationBudget(dose,p.warmHours,22,p.coldHours,6,p),cold:s.totalColdHours};};
 // The room-temperature 10 h plan ferments more than the 11 h cold-retard plan.
 a.ok(budgetAt(0.15,10).b>budgetAt(0.15,11).b);
 const cold=utils.fermentationHoursForYeast(0.15,o);
 a.ok(cold>11&&budgetAt(0.15,cold).cold>0&&Math.abs(budgetAt(0.15,cold).b-1)<0.05,`cold window ${cold}`);
 // 0.17 % has both: a cold window near the style's 26 h and a room-temperature one within 10 h.
 a.ok(utils.fermentationHoursForYeast(0.17,o)>11);
 const rt=utils.fermentationHoursForYeast(0.17,{...o,maxH:10});
 a.ok(rt<=10&&budgetAt(0.17,rt).cold===0&&Math.abs(budgetAt(0.17,rt).b-1)<0.05,`room window ${rt}`);
 const w=utils.fermentationWindowForYeast(0.15,o);
 a.equal(w.center,cold);a.ok(w.from>=w.center&&w.to<=w.center);
 // More yeast is never slower within the same time left.
 let prev=Infinity;for(const dose of [0.14,0.16,0.2,0.3,0.5,1]){const h=utils.fermentationHoursForYeast(dose,{...o,maxH:30});if(h!==null){a.ok(h<=prev+1e-9);prev=h;}}
});
