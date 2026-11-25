const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 18 Nov 2026 retention round 4 (engine), owner's decisions:
// item 4, a longer preheat moves only the Preheat step; item 7, Bake again one hour later keeps the time out of the
// fridge when the later exit is free; item 8, one "Before your recipe" statement for a night exit and another bake's oven.
const H=3600000,Z=s=>Date.parse(s+'Z');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({actionTimeout:20000});
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r4-seeded'))return;sessionStorage.setItem('r4-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
// Your plan opens on the key stages (round 7); the rows these tests read are under All steps.
const allSteps=async page=>{await expect(page.locator('[data-recipe-plan]:visible').first()).toBeVisible();const t=page.locator('[data-plan-all-steps]:visible').first();if(await t.count()&&await t.getAttribute('aria-expanded')==='false')await t.tap();};
const planRow=(page,name)=>page.locator('li,div').filter({hasText:new RegExp('^\\s*\\S+\\s*'+name+'$')}).last();
const busy={version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:true,from:'09:00',to:'19:00'}}};
const breadBase={version:1,tab:'custom',bakeType:'bread',bakeName:'',mixerType:'hand',yeastType:'fresh',humidity:'normal',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},flourChosen:true,prefermentType:'poolish',prefermentFlourPct:20,prefOffsetH:11,prefGoesInFridge:false,flourInFridge:false,recipeGenerated:true,modeChosen:true,qtyChosen:true,prefermentChosen:true,customKitchenConfirmed:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan'};

test.describe('Maya: a longer preheat',()=>{
 test.use({timezoneId:'Asia/Singapore',locale:'en-SG'});
 // The standard home oven preheats 45 min since 20 Nov 2026 (round 5): Preheat 6:45pm, take-out 5:15pm.
 test('moves the Preheat step only; the take-out stays at 5:15pm',async({page})=>{
  const start=Z('2026-11-20T10:00'),eat=Z('2026-11-21T11:30');
  const s={...breadBase,tab:'simple',savedAt:start-48*H,bakeType:'pizza',styleKey:'neapolitan',numItems:6,itemWeight:250,pizzaDiameter:30,ovenType:'home_oven_standard',yeastType:'instant',kitchenTemp:30,humidity:'humid',prefermentType:'none',prefOffsetH:0,startTime:start,eatTime:eat,blocks:[],previousNote:'Bases a bit pale — preheat longer.'};
  await install(page,{bh_session_v1:JSON.stringify(s)},'2026-11-19T02:00:00Z');
  await page.goto('/');
  await page.getByRole('button',{name:/^(Resume|View ingredients) →$/}).first().tap();
  await allSteps(page);
  await expect(planRow(page,'Take the shaped dough out of the fridge')).toContainText('5:15pm');
  await page.getByRole('button',{name:/Preheat/}).first().tap();
  await page.getByLabel('Preheat the oven',{exact:true}).fill('18:30');
  await page.getByRole('button',{name:'Update recipe',exact:true}).first().tap();
  await expect.poll(async()=>(await stored(page)).preheatExtraMin).toBe(15);
  await expect(planRow(page,'Preheat the oven')).toContainText('6:30pm');
  await expect(planRow(page,'Take the shaped dough out of the fridge')).toContainText('5:15pm');
 });
});

test.describe('Thomas',()=>{
 test.use({timezoneId:'Europe/Paris',locale:'fr-FR'});
 // Round 7 (D4, 20 Nov 2026): a baguette's longest apprêt at 20 °C is 2 h (2 h 45 out of the fridge with the
 // warm-up), so a 3 h lead from an older plan is outside the bounds and not kept; this fixture's lead is 2 h 30.
 test('Bake again one hour later: out of the fridge at 8:30 with the same 2 h 30',async({page})=>{
  const nights=[19,20,21,22].map(d=>({label:'Sat night',from:Z(`2026-11-${d}T22:00`),to:Z(`2026-11-${d+1}T06:00`)}));
  const bag={...breadBase,savedAt:Z('2026-11-22T12:00'),styleKey:'baguette',numItems:2,itemWeight:250,ovenType:'home_oven_stone_bread',kitchenTemp:20,startTime:Z('2026-11-21T17:15'),eatTime:Z('2026-11-22T09:00'),blocks:nights,confirmedSettings:['oven=home_oven_stone_bread','mixer=hand','yeast=fresh','climate=20'],planExitLead:{min:150,kitchenTemp:20,styleKey:'baguette'},bakedDone:true};
  const entry={v:1,id:'bag-1',createdAt:bag.savedAt,updatedAt:bag.savedAt,bakeType:'bread',styleKey:'baguette',bakeName:'',numItems:2,itemWeight:250,kitchenTemp:20,eatTime:bag.eatTime,session:bag,rating:4,note:'Bonne grigne.',photoIds:[],accountEventId:null};
  await install(page,{bh_profile_v1:JSON.stringify(busy),bh_journal_v1:JSON.stringify([entry]),bh_session_v1:JSON.stringify(bag),bh_journal_current_v1:'bag-1'},'2026-11-26T19:30:00Z');
  page.on('dialog',d=>d.accept());
  await page.goto('/fr');
  await page.getByRole('button',{name:/^Refaire/}).first().tap();
  const bakeDate=page.getByLabel('Date et heure de cuisson',{exact:true});
  const planHeading=page.getByRole('heading',{name:'Votre plan',exact:true});
  for(let i=0;i<6&&!(await planHeading.isVisible());i++){await page.locator('[data-bh-forward]:visible').first().tap();await page.waitForTimeout(300);}
  await bakeDate.fill('2026-11-29T11:00');await bakeDate.blur();
  await page.getByRole('button',{name:/^(Générer ma recette|Créer ma recette)/}).first().tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated&&(await stored(page)).eatTime,{timeout:30000}).toBe(Z('2026-11-29T10:00'));
  await allSteps(page);
  await expect(planRow(page,'Sortir les pâtons du réfrigérateur')).toContainText('8h30');
 });
 test('a night exit and the baguettes\' oven: one statement, one decision',async({page})=>{
  const bag={...breadBase,savedAt:Z('2026-11-19T18:00'),styleKey:'baguette',numItems:3,itemWeight:250,ovenType:'home_oven_stone_bread',kitchenTemp:20,startTime:Z('2026-11-21T17:15'),eatTime:Z('2026-11-22T09:00'),blocks:[],ovenFrom:Z('2026-11-22T08:15'),ovenTo:Z('2026-11-22T09:45')};
  const entry={v:1,id:'bag-1',createdAt:bag.savedAt,updatedAt:bag.savedAt,bakeType:'bread',styleKey:'baguette',bakeName:'',numItems:3,itemWeight:250,kitchenTemp:20,eatTime:bag.eatTime,session:bag,rating:null,note:'',photoIds:[],accountEventId:null};
  await install(page,{bh_profile_v1:JSON.stringify(busy),bh_journal_v1:JSON.stringify([entry]),bh_last_equipment_v1:JSON.stringify({ovenBread:'home_oven_stone_bread',mixer:'hand',kitchenTemp:20,fridgeTemp:6})},'2026-11-19T19:30:00Z');
  await page.goto('/fr');
  await page.getByRole('button',{name:/^Pain & repas/}).tap();
  await page.getByRole('button',{name:/^Pain de campagne/}).first().tap();
  await page.locator('.bh-style-confirm [data-bh-forward]').tap();
  const bakeDate=page.getByLabel('Date et heure de cuisson',{exact:true});
  const planHeading=page.getByRole('heading',{name:'Votre plan',exact:true});
  for(let i=0;i<6&&!(await planHeading.isVisible());i++){await page.locator('[data-bh-forward]:visible').first().tap();await page.waitForTimeout(300);}
  await bakeDate.fill('2026-11-22T09:15');await bakeDate.blur();
  await page.getByRole('button',{name:/^Générer ma recette/}).tap();
  const sheet=page.getByRole('dialog',{name:'Avant votre recette'});
  // Round 21 (rule E1): the take-out is a quick step, free at 7h00 when the night ends (within the warm-up and shortest
  // proof before the 9h15 bake), so the night is no longer in the sentence; the baguettes' oven still is.
  await expect(sheet).toContainText('Les baguettes occupent le four de 9h15 à 10h45.');
  await expect(sheet).not.toContainText('pendant la nuit');
  await expect(sheet.getByRole('button',{name:/^Enfourner à 11h30/})).toBeVisible();
  await sheet.getByRole('button',{name:/^Garder 9h15/}).tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:20000}).toBe(true);
  expect((await stored(page)).eatTime).toBe(Z('2026-11-22T08:15'));
  await expect(page.locator('[data-oven-sheet]')).toHaveCount(0);
 });
});
