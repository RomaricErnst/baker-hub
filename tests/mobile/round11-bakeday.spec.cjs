const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 22 Nov 2026 round 11 (bake day), EN and FR.
// 3: a mix recorded within the plan's 15 minutes ("Mixed now" 1 min early, Maya) never reads "The rest of the plan needs new times".
// 5: a Simple sourdough pizza (22 °C, bake Sat 7:30pm, nights) goes into the fridge once.
// 6: two bakes feeding the jar at the same time (the pizza's refresh and the loaf's pre-mix feed, Wed 9:45pm) share
//    that feed: one line with both amounts on both cards, one "keep the rest", and the fridge starter's take-out step.
// R11_SHOTS=<dir> saves screenshots for review.
const shot=async(page,name)=>{if(process.env.R11_SHOTS)await page.screenshot({path:`${process.env.R11_SHOTS}/${name}-${page.viewportSize().width}.png`,fullPage:true});};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible');
async function visit(context,at,lang){
 const page=await context.newPage();
 await page.clock.install({time:new Date(at)});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(lang==='fr'?'/fr':'/');
 return page;
}
async function generate(page,fr,bake){
 const date=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await date.fill(bake);await date.blur();
 const go=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(go).toBeEnabled({timeout:20000});await go.tap();
 const keep=page.locator('[data-decision-sheet] [data-simple-keep-all]');
 await page.waitForTimeout(800);if(await keep.count())await keep.first().tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated,{timeout:20000}).toBe(true);
}
async function section(page,fr,name){
 const t=page.locator('.bh-bake-navigator-trigger');
 if(await t.getAttribute('aria-expanded')!=='true')await t.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).first().tap();
}
async function sourdoughPizza(page,fr){
 await page.getByRole('button',{name:/^Pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Pizza au levain/:/^Sourdough pizza/}).first().tap();
 await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
 await forward(page).tap();
 await page.getByRole('slider').first().fill('22');
 await forward(page).tap();
 await page.getByRole('button',{name:fr?'Au réfrigérateur':'In the fridge',exact:true}).tap();
 await forward(page).tap();
 await generate(page,fr,'2026-11-28T19:30');
}
async function starterCard(page,fr){
 const sum=page.getByText(fr?'Préparer le levain':'Prepare the starter',{exact:true});
 await sum.scrollIntoViewIfNeeded();if(await page.locator('[data-starter-amount]:visible').count()===0)await sum.tap();
 await expect(page.locator('[data-starter-amount]:visible')).toHaveCount(1);
 return page.locator('[data-starter-amount]:visible').first().locator('xpath=..');
}

for(const lang of ['en','fr']){
 const fr=lang==='fr';
 test.describe(`round 11 bake day (${lang})`,()=>{
  test.use({timezoneId:'Asia/Singapore',locale:fr?'fr-FR':'en-GB'});

  test('3: a mix recorded 1 min before the plan keeps the plan, with no clash line',async({context})=>{
   test.setTimeout(120000);
   const plan=await visit(context,'2026-11-26T20:20:00+08:00',lang);
   await plan.getByRole('button',{name:/^Pizza/}).first().tap();
   await plan.getByRole('button',{name:fr?/^Napolitaine/:/^Classic Neapolitan/}).first().tap();
   await plan.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(plan).tap();
   await plan.getByRole('slider').first().fill('30');
   await forward(plan).tap();
   await generate(plan,fr,'2026-11-27T19:30');
   const mixAt=(await stored(plan)).startTime;
   await plan.close();
   // One minute before the planned mix: Preparation, "Mixed now".
   const page=await visit(context,mixAt-60000,lang);
   const resume=page.getByRole('button',{name:fr?/Reprendre/:/Resume/}).first();
   await expect(resume).toBeVisible({timeout:20000});await resume.tap();
   await section(page,fr,fr?'Préparation':'Preparation');
   // Round 21 (P): no separate "Done now" card; the step's own Step done, then "Different time?" (the tap's clock).
   const startStep=page.getByRole('button',{name:fr?/^Pétrir la pâte/:/^Start Dough/});
   if(!(await page.getByRole('checkbox',{name:fr?/Étape faite/:/Step done/}).filter({visible:true}).count())&&await startStep.count())await startStep.filter({visible:true}).first().tap();
   const done=page.getByRole('checkbox',{name:fr?/Étape faite/:/Step done/}).filter({visible:true}).first();
   // A tap, not check(): ticking moves Preparation on and closes the step, so check() would wait on a hidden box.
   await done.scrollIntoViewIfNeeded();await done.tap();
   const different=page.getByRole('button',{name:fr?'À une autre heure ?':'Different time?'}).filter({visible:true});
   if(!(await different.count()))await startStep.filter({visible:true}).first().tap();
   await different.first().tap();
   await page.locator('[data-done-time]:visible').getByRole('button',{name:fr?'Enregistrer':'Set time',exact:true}).first().tap();
   await expect.poll(async()=>(await stored(page))?.mixExecution??(await stored(page))?.execution,{timeout:10000}).toBeTruthy();
   const s=await stored(page);
   expect(s.executionClash).toBe(false);
   await expect(page.locator('[data-plan-clash]:visible')).toHaveCount(0);
   await shot(page,`r11-mixed-early-${lang}`);
  });

  test('5 and 6: one fridge trip for the pizza; one jar feed for pizza and loaf, one rest, a take-out step',async({context})=>{
   test.setTimeout(180000);
   const pizza=await visit(context,'2026-11-25T20:00:00+08:00',lang);
   await sourdoughPizza(pizza,fr);
   const steps=(await stored(pizza)).computedRecipe?.timelineSteps??[];
   expect(steps.length).toBeGreaterThan(0);
   // One fridge trip: the balls go in once, nothing comes out to be shaped and goes back.
   expect(steps.filter(s=>/^cold_?1$/.test(s.id)).length).toBe(0);
   const all=pizza.getByRole('button',{name:fr?/^Toutes les étapes/:/^All steps/}).first();
   if(await all.count()){await all.scrollIntoViewIfNeeded();await all.tap();}
   await expect(pizza.getByText(fr?/Pâte au réfrigérateur/:/Dough into the fridge/)).toHaveCount(0);
   await shot(pizza,`r11-pizza-one-trip-${lang}`);
   await pizza.close();
   // The loaf, five minutes later, feeds the same jar at 9:45pm for its own levain.
   const page=await visit(context,'2026-11-25T20:05:00+08:00',lang);
   // Round 18 (H2): the family card on home starts the new bake.
   await page.getByRole('button',{name:fr?'Pain & repas':'Bread & meals',exact:true}).tap();
   await page.getByRole('button',{name:'Pain au levain',exact:true}).tap();
   await page.getByRole('button',{name:fr?/^Quantité →$/:/^Quantity →$/}).tap();
   await forward(page).tap();
   if(await page.getByRole('slider').count()){await page.getByRole('slider').first().fill('22');await forward(page).tap();}
   await page.getByRole('button',{name:fr?'Au réfrigérateur':'In the fridge',exact:true}).tap();
   await forward(page).tap();
   await generate(page,fr,'2026-11-27T11:30');
   const loafCard=await starterCard(page,fr);
   const both=fr?/Rafraîchir 1:1:1 pour les deux fournées · \d+\s*g\s*:\s*\d+\s*g pour les pizzas, \d+\s*g pour/:/Feed 1:1:1 for both bakes · \d+\s*g: \d+\s*g for the pizzas, \d+\s*g for/;
   await expect(loafCard.locator('[data-starter-feed-line]').filter({hasText:both})).toHaveCount(1);
   const keepOf=async card=>(await card.locator('[data-starter-amount]').first().innerText()).match(/(\d+)\s*g (?:stays in the jar|dans le bocal)/)[1]; // round 23: "after both bakes, N g stays in the jar"
   const loafKeep=await keepOf(loafCard);
   // The jar still serves the pizzas: no "return it to the fridge" line under a shared feed.
   await expect(loafCard.getByText(fr?/remettez-le au frigo/:/return it to the fridge/)).toHaveCount(0);
   await shot(page,`r11-loaf-shared-${lang}`);
   await page.close();
   // The pizza's card: the take-out, the shared line on its refresh, the same rest.
   const again=await visit(context,'2026-11-25T20:07:00+08:00',lang);
   const jarRow=again.locator('[data-live-jar]');
   await expect(jarRow).toHaveCount(1);
   await jarRow.tap();
   await section(again,fr,fr?'Recette':'Recipe');
   const pizzaCard=await starterCard(again,fr);
   await expect(pizzaCard.getByText(fr?'Sortir du frigo':'Remove from fridge',{exact:true})).toHaveCount(1);
   await expect(pizzaCard.locator('[data-starter-feed-line]').filter({hasText:both})).toHaveCount(1);
   expect(await keepOf(pizzaCard)).toBe(loafKeep);
   await shot(again,`r11-pizza-shared-${lang}`);
  });
 });
}
