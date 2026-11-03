const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// The kitchen is asked once, with the bake time, every bake; nothing assumed.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const actions=page=>page.locator('.bh-step-actions:visible');
for(const locale of ['en','fr'])test(`${locale}: kitchen asked with the bake time, then not again`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Continue with|Continuer avec)/}).tap();
 // Quantity asks only how many.
 await expect(page.getByText(fr?/par pâton/:/per dough ball/)).toHaveCount(0);
 const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await actions(page).locator('[data-bh-forward]:visible').tap();
 const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await bakeDate.fill('2026-10-04T19:00');await bakeDate.blur();
 const kitchen=page.locator('[data-kitchen-warmth]:visible');
 await expect(kitchen).toBeVisible();
 await expect(kitchen.locator('[aria-pressed="true"]')).toHaveCount(0);
 const create=page.getByRole('button',{name:fr?'Créer ma recette simple':'Create my simple recipe',exact:true});
 await expect(create).toBeDisabled();
 await expect(page.locator('[data-create-hint]')).toHaveText(fr?'Indiquez la température pour continuer.':'Choose how warm it is to continue.');
 await expect(page.getByText(fr?/Travaillez-vous ce jour-là/:/Are you at work then/)).toHaveCount(0);
 for(const band of await kitchen.locator('[data-kitchen-band]').all())expect((await band.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await kitchen.locator('[data-kitchen-band="warm"]').tap();
 await expect(kitchen.locator('[data-kitchen-band="warm"]')).toHaveAttribute('aria-pressed','true');
 await expect(create).toBeEnabled();
 await create.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 expect((await stored(page)).kitchenTemp).toBe(27);
 // Preparation shows no assumption to correct.
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button',{name:fr?/^Préparation/:/^Preparation/}).first().tap();
 await expect(page.getByText(fr?/Cuisine d’environ/:/Assumes a kitchen around/)).toHaveCount(0);
 expect(errors).toEqual([]);
});
