const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 18 Nov 2026, owner's decision (round-4 retest, Thomas, Lyon 20 °C): a poolish is never past its peak at
// the knead. 2 baguettes, poolish 20 %, fresh yeast, poolish 7:00, knead 18:15. Storage auto → the planner
// puts the poolish in the fridge; storage fixed to room → the plan stands and the final dough gets the rest
// of the same total yeast (one line, no explanation). The poolish % is the baker's.
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

test('storage fixed to room: the poolish keeps its peak dose, the final dough one yeast line, same total',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await open(page,{...thomas,savedAt:Z('2026-11-20T17:00'),poolishStorage:'room',recipeGenerated:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan'});
 await page.goto('/');
 await page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).first().tap();
 await goRecipe(page);
 await expect(page.locator('[data-recipe-stages]')).toBeVisible();
 // Before (main): 0.7 g fresh yeast in the poolish, nothing in the final dough.
 await expect(makePoolish(page)).toContainText('Fresh yeast');
 await expect(makePoolish(page)).toContainText('0.2 g');
 await expect(finalDough(page)).toContainText('Fresh yeast');
 await expect(finalDough(page)).toContainText('0.5 g');
 await expect(page.locator('[data-whole-dough]')).toContainText('0.7 g');
 const s=await stored(page);
 expect(s.prefGoesInFridge).toBe(false);expect(s.prefOffsetH).toBe(11.25);expect(s.prefermentFlourPct).toBe(20);
 expect(errors).toEqual([]);
});

test('storage auto: Generate puts the poolish in the fridge for the same knead, all its yeast inside',async({page})=>{
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
 await expect(plan).toContainText('Refrigerated');
 const generate=page.getByRole('button',{name:/^(Generate my recipe|Create my recipe)/}).first();
 for(let i=0;i<10&&!(await generate.isVisible());i++){await page.getByRole('button',{name:/^(Fine-tune|Continue|Next)\b.*→$|→$/}).filter({hasNotText:'‹'}).last().tap();await page.waitForTimeout(300);}
 await generate.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:30000}).toBe(true);
 const s=await stored(page);
 expect(s.prefGoesInFridge).toBe(true);
 expect(s.eatTime).toBe(Z('2026-11-22T09:00'));
 expect(s.prefOffsetH).toBe(10.75);expect(s.startTime).toBe(Z('2026-11-21T17:15'));// poolish 7:30, knead 18:15 (Paris)
 expect(s.prefermentFlourPct).toBe(20);
 await expect(page.locator('[data-recipe-stages]')).toBeVisible();
 await expect(finalDough(page)).not.toContainText('Fresh yeast');
 expect(errors).toEqual([]);
});
