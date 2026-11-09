const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// The kitchen has its own screen between Quantity and Bake time, every bake.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const actions=page=>page.locator('.bh-step-actions:visible');
for(const locale of ['en','fr'])test(`${locale}: kitchen on its own screen, then a plain way to the recipe`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Continue with|Continuer avec)/}).tap();
 await expect(page.getByText(fr?/par pâton/:/per dough ball/)).toHaveCount(0);
 const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await actions(page).locator('[data-bh-forward]:visible').tap();
 // Kitchen screen.
 await expect(page.getByRole('heading',{name:fr?'Quelle température là où la pâte repose ?':'How warm is it where the dough rests?'})).toBeVisible();
 const slider=page.getByRole('slider',{name:fr?'Température là où la pâte repose':'Temperature where the dough rests'});
 expect((await slider.boundingBox()).height).toBeGreaterThanOrEqual(44);
 // The zone track is drawn by the page, not the browser's default slider.
 await expect.poll(()=>slider.evaluate(el=>getComputedStyle(el).webkitAppearance||getComputedStyle(el).appearance)).toBe('none');
 await slider.fill('34');
 await expect(page.locator('[data-kitchen-slider]')).toHaveAttribute('data-kitchen-zone','veryhot');
 await expect(page.locator('[data-kitchen-slider]')).toContainText(fr?'Cuisine tropicale sans climatisation':'A tropical kitchen without air conditioning');
 await slider.fill('27');
 await expect(page.locator('[data-kitchen-slider]')).toHaveAttribute('data-kitchen-zone','warm');
 await actions(page).locator('[data-bh-forward]:visible').tap();
 // Bake time screen: timing only.
 const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await bakeDate.fill('2026-10-04T19:00');await bakeDate.blur();
 await expect(page.locator('[data-kitchen-slider]')).toHaveCount(0);
 await expect(page.getByText(fr?/Travaillez-vous ce jour-là/:/Are you at work then/)).toHaveCount(0);
 await expect(page.locator('[data-create-hint]')).toHaveCount(0);
 const create=page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true});
 await expect(create).toBeEnabled();
 await expect(page.locator('[data-customize-link]')).toContainText(fr?'Personnaliser ma fournée':'Customize my bake');
 await create.tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 expect((await stored(page)).kitchenTemp).toBe(27);
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button',{name:fr?/^Préparation/:/^Preparation/}).first().tap();
 await expect(page.getByText(fr?/Cuisine d’environ/:/Assumes a kitchen around/)).toHaveCount(0);
 expect(errors).toEqual([]);
});
