const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 18 Nov 2026, owner's decision (round-4 retest, Thomas, Lyon 20 °C): a poolish is never past its peak at
// the knead. 2 baguettes, poolish 20 %, fresh yeast, poolish 7:00, knead 18:15. Yeast model (19 Nov 2026):
// the poolish holds the peak dose of its own 11.25 h and the final dough its own yeast, so the poolish peaks
// at the knead whatever the storage: the plan is returned as found (room temperature), and the final dough
// has its yeast line. The poolish % is the baker's.
const H=3600000,Z=s=>Date.parse(s+'Z');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({actionTimeout:20000,timezoneId:'Europe/Paris'});
const nights=[19,20,21,22].map(d=>({label:'Sat night',from:Z(`2026-11-${d}T22:00`),to:Z(`2026-11-${d+1}T06:00`)}));
const thomas={version:1,tab:'custom',bakeType:'bread',bakeName:'',mixerType:'hand',yeastType:'fresh',humidity:'normal',fridgeTemp:6,
 flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,prefermentType:'poolish',prefermentFlourPct:20,prefOffsetH:11.25,prefGoesInFridge:false,
 flourInFridge:false,modeChosen:true,qtyChosen:true,prefermentChosen:true,customKitchenConfirmed:true,styleKey:'baguette',numItems:2,itemWeight:250,
 ovenType:'home_oven_stone_bread',kitchenTemp:20,startTime:Z('2026-11-21T17:15'),eatTime:Z('2026-11-22T09:00'),blocks:nights,
 confirmedSettings:['oven=home_oven_stone_bread','mixer=hand','yeast=fresh','climate=20']};
async function open(page,session){
 await page.clock.install({time:new Date(Z('2026-11-20T18:00'))});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(s=>{if(sessionStorage.getItem('pp-seeded'))return;sessionStorage.setItem('pp-seeded','1');localStorage.clear();localStorage.setItem('bh_session_v1',JSON.stringify(s));},session);
}
async function goRecipe(page){
 if(await page.locator('[data-recipe-stages]').isVisible())return;
 const t=page.locator('.bh-bake-navigator-trigger');if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name:/^Recipe/}).first().tap();
}
const finalDough=page=>page.locator('[data-recipe-stages] > div').filter({has:page.getByText(/^(Final dough|Pâte finale)$/)});
const makePoolish=page=>page.locator('[data-recipe-stages] > div').first();

test('storage fixed to room: the poolish holds its peak dose, the final dough its own yeast line',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,{...thomas,savedAt:Z('2026-11-20T17:00'),poolishStorage:'room',recipeGenerated:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan'});
 await page.goto('/');
 await page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).first().tap();
 await goRecipe(page);
 await expect(page.locator('[data-recipe-stages]')).toBeVisible();
 // Before (#137): 0.2 g in the poolish and 0.5 g in the final dough (0.7 g). Yeast model (Phase 3 refit,
 // 20 Nov 2026): 0.2 g and 2.2 g (the final dough's own need for 4.8 h at 20 °C and 10.25 h in the fridge),
 // 2.4 g in all (Phase 2: 2.6 g and 2.8 g).
 await expect(makePoolish(page)).toContainText('Fresh yeast');
 // Round 7 stage yeast (stageYeastDoses): 0.2 + 2.3 g would read 2.5 g against the whole dough's 2.4 g, so both stages
 // take one more figure (0.16 + 2.27 g = 2.4 g).
 // Round 7 Fine-tune: with the 1.5 % bowl-loss margin the stages add up at one decimal again (0.2 g poolish).
 await expect(makePoolish(page)).toContainText('0.2 g');
 await expect(finalDough(page)).toContainText('Fresh yeast');
 // Round 7 (D4, 20 Nov 2026): the baguette apprêt bound (2 h to the bake at 20 °C) takes the dough out 15 min
 // later, a shorter warm tail: the final dough's own need 2.2 → 2.3 g (tests/poolish-peak.test.cjs 2.211 → 2.271); the whole dough still rounds to 2.4 g.
 // Round 8 (flour): the bread flour's tolerance no longer divides the yeast again at a fixed plan (× 0.9): the final dough
 // 2.3 → 2.07 g (one more figure so the stages add up to the whole dough).
 await expect(finalDough(page)).toContainText('2.07 g');
 await expect(page.locator('[data-whole-dough]')).toContainText('2.2 g'); // 0.2 + 2.07 g at the whole dough's precision (was 2.5 g)
 const s=await stored(page);
 expect(s.prefGoesInFridge).toBe(false);expect(s.prefOffsetH).toBe(11.25);expect(s.prefermentFlourPct).toBe(20);
 // The knead method adds that yeast (20 Nov 2026 round 6, Thomas: it was listed, never added in the steps).
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button').filter({has:page.getByText('Preparation',{exact:true})}).tap();
 await page.getByRole('button',{name:/^Start Dough/}).first().tap();
 await expect(page.getByText('Add the prepared poolish and the yeast, then the salt.',{exact:true}).first()).toBeVisible();
 expect(errors).toEqual([]);
});

test('storage auto: Generate keeps the room-temperature poolish, which now peaks at the knead',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,{...thomas,savedAt:Z('2026-11-20T17:00'),recipeGenerated:false,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'});
 await page.goto('/');
 await page.getByRole('button',{name:/^Resume/}).first().tap();
 // A draft keeps its saved times on reopening: Nights off and on again asks the planner afresh.
 const plan=page.getByRole('region',{name:'Your key times',exact:true});
 await expect(plan).toContainText('Room temperature');
 const nightsChip=page.getByRole('button',{name:/^Nights/});
 await nightsChip.tap();await expect(nightsChip).toHaveAttribute('aria-pressed','false');
 await nightsChip.tap();await expect(nightsChip).toHaveAttribute('aria-pressed','true');
 // Round 21 (rule E1): asked afresh with the Nights, the room plan would knead 18:30 with its balls going in on the 23:00
 // edge, and the fridge poolish (made 7:00 when the night ends, kneaded 16:45, shaping done by 22:45) is the plan the
 // planner prefers between the two; 'auto' storage takes it. The poolish still starts when the night ends (below).
 await expect(plan).toContainText(/Room temperature|Refrigerated/);
 const generate=page.getByRole('button',{name:/^(Generate my recipe|Create my recipe)/}).first();
 for(let i=0;i<10&&!(await generate.isVisible());i++){await page.getByRole('button',{name:/^(Fine-tune|Continue|Next)\b.*→$|→$/}).filter({hasNotText:'‹'}).last().tap();await page.waitForTimeout(300);}
 await generate.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:30000}).toBe(true);
 const s=await stored(page);
 expect(s.eatTime).toBe(Z('2026-11-22T09:00'));
 // Round 21 (rule E1): the poolish starts at 7:00 when the night ends (a long step may start at a busy time's end), in the
 // fridge 9.75 h, kneaded 16:45 (Paris); main kept it at room temperature 11.25 h, kneaded 18:15.
 expect(s.startTime-s.prefOffsetH*H).toBe(Z('2026-11-21T06:00'));
 expect(s.prefermentFlourPct).toBe(20);
 await expect(page.locator('[data-recipe-stages]')).toBeVisible();
 await expect(finalDough(page)).toContainText('Fresh yeast');
 expect(errors).toEqual([]);
});
