const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Romaric, 12 Nov 2026: a clash answered on the bake time came back in Custom as a
// stack of per-step cards. Before the recipe, Custom's bake-time step asks the same
// single question as Simple; the full editor lives behind Change times.
test.use({timezoneId:'Asia/Singapore'});
test('Custom before the recipe: one bake-time question, no per-step cards',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Continue with/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 // Tomorrow 7:30pm with weekday working hours: steps fall in the busy time.
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+1);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);d.setHours(19,30,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel('Bake date and time',{exact:true});
 await time.fill(target);await time.blur();
 const busy=page;
 for(const name of [/^Weekdays/,/^Nights/]){const chip=busy.getByRole('button',{name}).filter({visible:true}).first();if(await chip.getAttribute('aria-pressed')!=='true')await chip.tap();}
 const decision=page.locator('[data-simple-decision]:visible');
 if(await decision.count())await decision.locator('[data-simple-keep-all], [data-simple-keep]').first().tap();
 await page.getByRole('button',{name:/^Customize my bake/}).tap();
 // Walk the Custom steps with their recommended values, choosing a poolish when offered.
 for(let i=0;i<14&&!(await time.isVisible());i++){
  const poolish=page.getByRole('button',{name:/^Poolish/}).filter({visible:true});
  if(await poolish.count()&&await poolish.first().getAttribute('aria-pressed')!=='true')await poolish.first().tap();
  const forward=page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first();
  if(await forward.isDisabled()){const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});if(await flour.count())await flour.first().tap();}
  await forward.tap();
  await page.waitForTimeout(300);
 }
 await expect(time).toBeVisible();
 await testInfo.attach('custom-bake-time',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await expect(page.getByText('I can cover this step').filter({visible:true})).toHaveCount(0);
 await expect(page.getByText(/steps? falls? during your unavailable hours/).filter({visible:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Yes, this step is covered'}).filter({visible:true})).toHaveCount(0);
 expect(await page.locator('[data-simple-decision]:visible').count()).toBeLessThanOrEqual(1);
 if(await decision.count())await decision.locator('.bh-plan-option').first().tap();
 const create=page.getByRole('button',{name:'Create my recipe',exact:true}).filter({visible:true}).first();
 await expect(create).toBeEnabled();
 await create.tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Recipe');
 expect(errors).toEqual([]);
});
