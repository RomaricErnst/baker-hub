const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 20 Nov 2026 retention round 6 (engine track), owner-approved batch.
// B2 (Priya): Customize after a Simple sourdough recipe clears the feed Simple implied; Update recipe asks
// the Starter question and shows no clash computed without it. B4 (Thomas): a pizza kneaded after work
// gets "out of the fridge when you're home, bake after the shortest warm-up" in the Before-your-recipe sheet.
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.use({actionTimeout:20000});
async function install(page,storage,at){
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([storage])=>{if(sessionStorage.getItem('r6-seeded'))return;sessionStorage.setItem('r6-seeded','1');localStorage.clear();for(const k in storage)localStorage.setItem(k,storage[k]);},[storage]);
}
async function walkTo(page,title,fill){
 for(let i=0;i<8;i++){
  const h=(await page.locator('h1').first().innerText()).trim();
  if(title.test(h))return;
  await fill?.(h);
  await page.locator('[data-bh-forward]:visible').first().tap();await page.waitForTimeout(300);
 }
}

test.describe('Priya: Customize after a Simple levain recipe',()=>{
 test.use({timezoneId:'Europe/London',locale:'en-GB'});
 test('Update recipe asks the Starter question, with no clash from a plan without it',async({page})=>{
  const busy={version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:true,from:'09:00',to:'17:30'}}};
  await install(page,{bh_profile_v1:JSON.stringify(busy)},'2026-11-30T19:30:00Z');
  await page.goto('/');
  await page.getByRole('button',{name:/^Bread & meals/}).tap();
  await page.getByRole('button',{name:/^Pain au levain/}).first().tap();
  await walkTo(page,/baking plan/i,async h=>{
   if(/warm/i.test(h)){const t=page.getByLabel('Temperature where the dough rests');await t.fill('19');await t.blur();}
   if(/starter/i.test(h))await page.getByRole('button',{name:'In the fridge'}).tap();
  });
  const bakeDate=page.getByLabel('Bake date and time');
  await bakeDate.fill('2026-12-06T11:00');await bakeDate.blur();
  await page.getByRole('button',{name:/^Generate my recipe/}).tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:30000}).toBe(true);
  await page.getByRole('button',{name:/My choices/}).last().tap();
  await page.getByRole('button',{name:'Customize my bake'}).tap();
  // Priya's path: the bake time first (the plan now hangs off a provisional mix), then Update recipe.
  await page.getByRole('button',{name:'Edit : Bake time'}).tap();
  await expect(page.getByText('Tell us when your starter was last fed.')).toBeVisible();
  await expect(page.locator('[data-simple-decision]')).toHaveCount(0);
  await page.getByRole('button',{name:/Back to my choices/}).tap();
  await page.getByRole('button',{name:'Update recipe'}).first().tap();
  await expect(page.getByRole('heading',{name:'Your starter'})).toBeVisible();
  await expect(page.locator('[data-simple-decision]')).toHaveCount(0);
  expect((await stored(page)).lastFedTime??null).toBeNull();
  // Answered, the recipe is made from a complete plan, with its starter feeds.
  await page.getByRole('button',{name:'4–5 days ago'}).tap();
  await page.getByRole('button',{name:'Active & healthy'}).tap();
  await page.getByRole('button',{name:'Update recipe'}).last().tap();
  await expect.poll(async()=>(await stored(page))?.starterEvents?.some(e=>e.kind==='pre_mix')??false,{timeout:30000}).toBe(true);
  await expect(page.locator('[data-simple-decision]')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:/^Pain au levain/})).toBeVisible();
 });
});

test.describe('Thomas: pizza kneaded after work',()=>{
 test.use({timezoneId:'Europe/Paris',locale:'fr-FR'});
 test('one fridge trip: the dough stays whole until after work, shaped at 19h00, bake 21h00',async({page})=>{
  const busy={version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:true,from:'09:00',to:'19:00'}}};
  await install(page,{bh_profile_v1:JSON.stringify(busy),bh_last_equipment_v1:JSON.stringify({ovenPizza:'home_oven_steel',mixer:'hand',kitchenTemp:20,fridgeTemp:6,yeast:'fresh'})},'2026-12-03T19:00:00Z');
  await page.goto('/fr');
  await page.getByRole('button',{name:/^Pizza/}).first().tap();
  await page.getByRole('button',{name:/^Napolitaine/}).first().tap();
  await walkTo(page,/plan/i);
  const bakeDate=page.getByLabel('Date et heure de cuisson',{exact:true});
  await bakeDate.fill('2026-12-04T20:30');await bakeDate.blur();
  await page.getByRole('button',{name:/^Générer ma recette/}).tap();
  const sheet=page.getByRole('dialog',{name:'Avant votre recette'});
  // Round 8 (owner: one fridge trip in Simple, every kitchen): shaping after the 21h00 knead's rise would be a
  // new step at night, so the dough stays in the fridge in one piece until after work and is shaped then (was:
  // shaped at 7h00, the balls out at 17h45). The clash is that take-out, in the generic sentence (it is not the
  // shaped balls' final exit), at 18h30 (the latest before the 60 min preheat and a 1 h rest).
  await expect(sheet).toContainText('Sortir la pâte du réfrigérateur tombe à 18h30, pendant vos heures de travail.');
  const options=sheet.locator('.bh-plan-option');
  // The shortest warm-up is for shaped balls (none in this plan); the later bake is the one that takes the dough
  // out at 19h00, when he is free: 2 h before the bake (1 h rest after shaping, then the proof while the oven heats).
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toContainText('Enfourner à 21h00');
  await expect(options.nth(0)).toContainText('Sortie du frigo à 19h00');
  await expect(options.nth(0)).toContainText('2 h pour se réchauffer');
  await expect(options.nth(1)).toContainText('Garder 20h30');
  await options.nth(0).tap();
  await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:20000}).toBe(true);
  const s=await stored(page);
  expect(s.eatTime).toBe(Date.parse('2026-12-04T20:00:00Z'));
  const row=name=>page.locator('li,div').filter({hasText:new RegExp('^\\s*\\S+\\s*'+name+'$')}).last();
  // Your plan opens on the key stages (round 7); the take-out and preheat rows are under All steps.
  {const t=page.locator('[data-plan-all-steps]:visible').first();await expect(t).toBeVisible();if(await t.getAttribute('aria-expanded')==='false')await t.tap();}
  await expect(row('Sortir la pâte du réfrigérateur · Diviser et façonner')).toContainText('19h00');
  await expect(row('Préchauffer le four')).toContainText('20h00');
 });
});
