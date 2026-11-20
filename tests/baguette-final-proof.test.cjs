// Baguette final proof (apprêt) after a cold phase (20 Nov 2026 round 7, D4; docs/YEAST-MODEL.md §13).
// A shaped baguette proofs at most the equivalent of 1.5 h at 24 °C (Hamelman 1–1.5 h at 24 °C; Grands
// Moulins de Paris 30–60 min at 25 °C after 12–14 h at 4 °C; Bouabsa 45 min; King Arthur Pro 1.5–2 h at
// 24 °C after a 10 °C retard): 2 h to the bake at 20 °C. The fridge exit moves later (the cold spell absorbs
// the time) and the yeast is re-solved on the new path, so the dough still reaches its target at the bake.
const {test}=require('node:test'),a=require('node:assert/strict');
const {utils}=require('./load-production.cjs');
const H=3600000;
const bake=new Date(2026,10,28,12,0);
// Thomas (Lyon, 20 °C): kneads Friday 21:00, asleep 23:30–7:00, bakes Saturday noon; 4 baguettes of 320 g.
const start=new Date(2026,10,27,21,0);
const night=[{from:new Date(2026,10,27,23,30),to:new Date(2026,10,28,7,0),label:'Friday night'}];
const plan=(blocks,T=20,style='baguette',s=start,n=4)=>utils.buildSchedule(s,bake,blocks,T,45,'hand',style,n,1);
const recipe=(s,T=20,style='baguette',n=4,w=320)=>utils.calculateRecipe(style,'home_oven_standard',n,w,T,'normal',s,6,'instant','simple','hand');
const outToBake=s=>(+s.bakeStart-+s.coldRetardEnd)/H;
const hm=d=>`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;

test('bound: 1.5 h at 24 °C converted by the yeast model, minus the preheat, never below 1 h nor above the generic bound',()=>{
 // Hours to the bake (preheat 0): 3 h at 16 °C, 2.5 h at 18, 2 h at 20, 1.75 h at 22, 1.5 h at 24, 1.25 h at 26, 1 h from 28.
 const toBake={16:3,18:2.5,20:2,22:1.75,24:1.5,26:1.25,28:1,30:1,32:1};
 for(const [T,h] of Object.entries(toBake)){
  a.equal(utils.styleMaxFinalProofHours('baguette',+T,true,false,0),h,`${T} °C`);
  // The engine measures to the preheat start: a 45 min preheat leaves 1.25 h at 20 °C, at least 1 h.
  a.equal(utils.styleMaxFinalProofHours('baguette',+T,true,false,0.75),Math.max(1,h-0.75),`${T} °C, 45 min preheat`);
 }
 // Other styles and a levain baguette keep the generic bound (3.5 h after the fridge, 5 h without, at 20 °C).
 for(const style of ['pain_campagne','pain_complet','pain_au_seigle','neapolitan','newyork','fougasse','pain_viennois']){
  a.equal(utils.styleMaxFinalProofHours(style,20,true,false,0.75),3.5,style);
  a.equal(utils.styleMaxFinalProofHours(style,20,false,false,0.75),5,style);
 }
 a.equal(utils.styleMaxFinalProofHours('baguette',20,true,true,0.75),3.5,'levain baguette: its own solver');
});

test('Thomas, 20 °C, nights: out at 9:45 (was 9:15), 1 h rest and 1 h 15 apprêt, 2 h 15 out of the fridge (was 2 h 45)',()=>{
 const s=plan(night);
 a.equal(s.availabilityConflicts.length,0);
 a.equal(hm(s.coldRetardStart),'23:15');
 a.equal(hm(s.coldRetardEnd),'9:45');        // main: 9:15
 a.equal(hm(s.finalProofStart),'10:45');     // main: 10:15
 a.equal(s.restRtHours,1);
 a.equal(s.finalProofHours,1.25);            // main: 1.75
 a.equal(outToBake(s),2.25);                 // main: 2.75
 a.equal(s.totalColdHours,10.5);             // main: 10
 // The yeast is re-solved on the new path: more yeast for the shorter warm tail (main 0.213 %, 1.57 g).
 const r=recipe(s);
 a.equal(r.flour,734);
 a.ok(Math.abs(r.yeast.pct-0.223)<0.0015,`IDY ${r.yeast.pct}`);
 a.ok(Math.abs(r.yeast.grams-1.64)<0.015,`grams ${r.yeast.grams}`);
});

test('Thomas, 20 °C, no busy times: out at 9:00 after the whole cold, 1 h rest and 2 h apprêt (main: out 7:30, 3.5 h)',()=>{
 // Splitting the cold (shaping during it) would shape at 3:15, a night step main does not have:
 // the whole cold stays before shaping (owner, 20 Nov 2026).
 const s=plan([]);
 a.equal(hm(s.coldRetardEnd),'9:00');        // main: 7:30
 a.ok(!s.coldRetard2Start);
 a.equal(hm(s.finalProofStart),'10:00');     // main: 8:30
 a.equal(s.finalProofHours,2);               // main: 3.5
 a.equal(outToBake(s),3);                    // main: 4.5
 const r=recipe(s);
 a.ok(Math.abs(r.yeast.pct-0.209)<0.0015,`IDY ${r.yeast.pct}`);   // main 0.180 %
});

test('every baguette plan proofs within the bound; the dose meets its target on the new path',()=>{
 const blocksets=[[],night];
 for(const T of [16,18,20,22,24,26,28,30,32])for(const blocks of blocksets)for(let w=6;w<=30;w++){
  const s=plan(blocks,T,'baguette',new Date(+bake-w*H));
  if(s.preparationInvalid||s.availabilityConflicts.length)continue;
  // Main's own plan where the style's bound would add a night step or a cold phase (owner, 20 Nov 2026).
  if(s.finalProofBound!=='style')continue;
  // Main's own artefact, unchanged here: a second fridge spell under 1 h is dropped (accountScheduleTime)
  // and its time joins the proof (28 °C, 7 h: 3.25 h on main too). Not a bound this change sets.
  if(s.totalColdHours>0&&!s.rtWarmupStart&&!s.restRtHours&&!s.coldRetard2Start)continue;
  const bound=utils.styleMaxFinalProofHours('baguette',T,s.totalColdHours>0,false,0)+1e-9;
  const proof=(+s.bakeStart-+s.finalProofStart)/H;
  // A short plan may leave less (never more) than the bound; the shortest final proof keeps 1 h before the preheat.
  a.ok(proof<=Math.max(bound,1.75+1e-9),`${T} °C ${w} h: apprêt ${proof} h > ${bound}`);
  const r=recipe(s,T);
  const p=utils.doughThermalPath(s,4,320,68,T,6,r.targetDoughTemp??24);
  if(r.yeast.pct>0.0501&&r.yeast.pct<1.499){
   const b=utils.fermentationBudget(r.yeast.pct,p.warmHours,T,p.coldHours,6,p);
   a.ok(Math.abs(b-1)<0.02,`${T} °C ${w} h: budget ${b}`);
  }
 }
});

test('boules, bâtards and pizza keep their plans (main numbers)',()=>{
 // Pain de campagne 800 g at 20 °C, 21 h free window: out 4.75 h before the bake, as on main.
 const camp=utils.buildSchedule(new Date(+bake-21*H),bake,[],20,45,'hand','pain_campagne',1,1);
 a.equal(camp.finalProofHours,4.25);
 const nea=utils.buildSchedule(new Date(+bake-26*H),bake,[],20,45,'hand','neapolitan',4,1);
 a.equal(nea.finalProofHours,4.25);
});

// Owner adjustments (20 Nov 2026): a plan main runs at room temperature stays there, and no hands-on step
// newly falls between 22:00 and 07:00 unless the baker declared that time free; else main's timing.
const onMain=(s)=>s.finalProofBound===undefined;
const nightIds=s=>s.availabilityActions.filter(x=>x.at.getHours()>=22||x.at.getHours()<7).map(x=>x.id);

test('a room-temperature plan stays at room temperature: the shorter apprêt goes to the bulk, less yeast',()=>{
 // 20 °C, 9 h, no busy times. Main: shaped 6:15, 5.5 h apprêt, 0.170 % IDY.
 const s=plan([],20,'baguette',new Date(+bake-9*H));
 a.equal(s.totalColdHours,0);
 a.equal(s.finalProofBound,'style');
 a.equal(hm(s.divideBallTime),'10:00');      // main: 6:15
 a.equal(s.finalProofHours,1.75);            // main: 5.5
 a.equal(+s.totalRTHours.toFixed(2),8.28);   // the window is unchanged; the bulk holds what the apprêt gave up
 a.ok(Math.abs(recipe(s).yeast.pct-0.167)<0.0015,`IDY ${recipe(s).yeast.pct}`);   // main 0.1696 %
 // Every window main plans at room temperature here (6–11 h at 16–20 °C, no busy times) stays there.
 for(const T of [16,18,20])for(let w=6;w<=11;w++)
  a.equal(plan([],T,'baguette',new Date(+bake-w*H)).totalColdHours,0,`${T} °C ${w} h`);
});

test('no new night shaping: a 14 h window to a noon bake keeps the whole cold before shaping at 9:00',()=>{
 // 20 °C, mixed 22:00, no busy times. Main shaped at 7:30; splitting the cold would shape at 4:15.
 const s=plan([],20,'baguette',new Date(+bake-14*H));
 a.equal(s.finalProofBound,'style');
 a.ok(!s.coldRetard2Start);
 a.equal(hm(s.coldRetardEnd),'9:00');        // main: 7:30
 a.equal(hm(s.divideBallTime),'9:00');
 a.equal(s.finalProofHours,2);               // main: 3.5
 a.deepEqual(nightIds(s).sort(),['cold-in','fold-1','fold-2','mix','mix-finish']);   // main's own night steps
});

test('no new night step: where the shorter apprêt would add folds before 7:00, main\'s plan stays',()=>{
 // 16 °C, mixed 4:00 for noon. Main shapes at 6:15; a longer bulk would add folds 3 and 4 at 6:13 and 6:43.
 const s=plan([],16,'baguette',new Date(+bake-8*H));
 a.ok(onMain(s));
 a.equal(hm(s.divideBallTime),'6:15');
 a.equal(s.finalProofHours,5.5);
 a.deepEqual(nightIds(s).sort(),['divide','fold-1','fold-2','mix','mix-finish']);
 // Every baguette plan of the grid: a step at night only where main had that step at night.
 for(const T of [16,18,20,22,24,26])for(const blocks of [[],night])for(let w=6;w<=30;w++){
  const p=plan(blocks,T,'baguette',new Date(+bake-w*H));if(onMain(p))continue;
  const base=new Set(nightIds(utils.buildSchedule(new Date(+bake-w*H),bake,blocks,T,45,'hand','baguette',4,1)));
  for(const id of nightIds(p))a.ok(base.has(id),`${T} °C ${w} h: ${id}`);
 }
});
