const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Romaric, 12 Nov 2026: a clash answered on the bake time came back in Custom as a
// stack of per-step cards. Before the recipe, Custom's bake-time step asks the same
// single question as Simple; the full editor lives behind Change times.
// 13 Nov 2026: the bake time was answered before customizing, so Custom ends on Fine-tune
// with "Create my recipe" and never walks back to that question.
test.use({timezoneId:'Asia/Singapore'});
test('Customize from the bake time: the clash is asked once, in a sheet, when the recipe is created',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 // A weekday bake at 1:00pm, two or more days ahead, with working hours busy: the bake itself clashes, whatever the time of day the test runs.
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);d.setHours(13,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel('Bake date and time',{exact:true});
 await time.fill(target);await time.blur();
 const busy=page;
 for(const name of [/^Weekdays/,/^Nights/]){const chip=busy.getByRole('button',{name}).filter({visible:true}).first();if(await chip.getAttribute('aria-pressed')!=='true')await chip.tap();}
 // The clash is not asked here: customizing defers it to the moment the recipe is created.
 await expect(page.locator('[data-simple-decision]:visible')).toHaveCount(0);
 await page.getByRole('button',{name:/^Customize my bake/}).tap();
 // Walk the Custom steps with their recommended values, choosing a poolish when offered.
 const finish=page.locator('[data-finetune-generate]');
 for(let i=0;i<14&&!(await finish.isVisible());i++){
  await expect(time).toBeHidden();
  const poolish=page.getByRole('button',{name:/^Poolish/}).filter({visible:true});
  if(await poolish.count()&&await poolish.first().getAttribute('aria-pressed')!=='true')await poolish.first().tap();
  const forward=page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first();
  if(await forward.isDisabled()){const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});if(await flour.count())await flour.first().tap();}
  await forward.tap();
  await page.waitForTimeout(300);
 }
 await expect(finish).toHaveText('Create my recipe');
 await expect(time).toBeHidden();
 await testInfo.attach('custom-fine-tune-end',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await expect(page.getByText('I can cover this step').filter({visible:true})).toHaveCount(0);
 await expect(page.getByText(/steps? falls? during your unavailable hours/).filter({visible:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Yes, this step is covered'}).filter({visible:true})).toHaveCount(0);
 await expect(page.locator('[data-simple-decision]:visible')).toHaveCount(0);
 // Create my recipe asks the one question, in a sheet; answering it creates the recipe.
 await finish.tap();
 const sheet=page.locator('[data-decision-sheet]');
 {
  await expect(sheet.getByRole('dialog',{name:'Before your recipe'})).toBeVisible();
  await expect(sheet.locator('[data-simple-decision]')).toHaveCount(1);
  await testInfo.attach('decision-sheet',{body:await page.screenshot(),contentType:'image/png'});
  await sheet.locator('[data-simple-keep-all], [data-simple-keep], [data-simple-accept]').first().tap();
 }
 await expect(page.locator('.bh-navigator-current')).toContainText('Recipe');
 expect(errors).toEqual([]);
});

test('Simple: the bake time shows no clash card; Generate asks it once, in a sheet',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/fr');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Napolitaine classique',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantité →$/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);d.setHours(13,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel('Date et heure de cuisson',{exact:true});
 await time.fill(target);await time.blur();
 for(const name of [/^Jours ouvrés/,/^Nuits/]){const chip=page.getByRole('button',{name}).filter({visible:true}).first();if(await chip.getAttribute('aria-pressed')!=='true')await chip.tap();}
 await expect(page.locator('[data-simple-decision]:visible')).toHaveCount(0);
 await page.locator('[data-generate-recipe]').tap();
 const sheet=page.locator('[data-decision-sheet]');
 await expect(sheet.getByRole('dialog',{name:'Avant votre recette'})).toBeVisible();
 // Not now closes it without creating anything.
 await sheet.locator('[data-decision-sheet-close]').tap();
 await expect(sheet).toHaveCount(0);
 await page.locator('[data-generate-recipe]').tap();
 await sheet.locator('[data-simple-keep-all], [data-simple-keep], [data-simple-accept]').first().tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Recette');
 expect(errors).toEqual([]);
});

test('an empty bake time opens the picker about 48 h ahead at 7:00pm for a Neapolitan, and confirming it keeps that time',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const time=page.getByLabel('Bake date and time',{exact:true});
 await expect(time).toHaveValue(/T19:00$/);
 const hoursAhead=await time.evaluate(el=>(new Date(el.value)-Date.now())/3600000);
 expect(hoursAhead).toBeGreaterThan(36);
 expect(hoursAhead).toBeLessThan(63);
 // A phone picker confirmed without moving sends no change; the opening value is kept.
 await time.focus();await time.blur();
 await expect(page.getByText(/· 7:00pm$/).filter({visible:true}).first()).toBeVisible();
});
