const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Romaric, 14 Nov 2026: Custom showed Simple's silent assumptions (home oven, hand kneading,
// instant yeast) as already chosen, under "Your usual equipment". In Custom they start unselected
// and must be chosen; a selection from the baker's profile says so.
test.use({timezoneId:'Asia/Singapore'});

async function toCustom(page){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const time=page.getByLabel('Bake date and time',{exact:true});await time.focus();await time.blur();
 // Generate is in the bar; bring the Customize card clear of it before tapping.
 await page.locator('[data-customize-link]').evaluate(el=>el.scrollIntoView({block:'center'}));
 await page.getByRole('button',{name:/^Customize my bake/}).tap();
}
const forward=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible').first();

test('Custom asks the equipment and the yeast instead of assuming them',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await toCustom(page);
 const step=page.locator('#step-3:visible');
 await expect(step).toBeVisible();
 await expect(page.getByText(/Your usual equipment|From your profile/)).toHaveCount(0);
 // Oven: nothing selected, Mixing waits for a choice.
 await expect(step.locator('[aria-pressed="true"]')).toHaveCount(0);
 await expect(forward(page)).toBeDisabled();
 await step.getByRole('button',{name:/^Home oven \+ stone or steel/}).tap();
 await expect(forward(page)).toBeEnabled();
 await forward(page).tap();
 // Mixing: nothing selected either.
 await expect(step.locator('[aria-pressed="true"]')).toHaveCount(0);
 await expect(forward(page)).toBeDisabled();
 await step.locator('[role="button"]').first().tap();
 await expect(forward(page)).toBeEnabled();
 // Walk on to the yeast step; it waits for a choice too.
 for(let i=0;i<6&&!(await page.locator('#step-7:visible').count());i++){
  const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});
  if(await forward(page).isDisabled()&&await flour.count())await flour.first().tap();
  const direct=page.getByRole('button',{name:/^Direct dough/}).filter({visible:true});
  if(await forward(page).isDisabled()&&await direct.count())await direct.first().tap();
  await forward(page).tap();
 }
 const yeast=page.locator('#step-7:visible');
 await expect(yeast).toBeVisible();
 await expect(yeast.locator('[aria-pressed="true"]')).toHaveCount(0);
 await expect(forward(page)).toBeDisabled();
 expect(errors).toEqual([]);
});

test('equipment from the baker profile is preselected and named as such',async({page})=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem('p')){localStorage.setItem('bh_profile_v1',JSON.stringify({version:1,ovenTypePizza:'pizza_oven',mixerType:'stand'}));sessionStorage.setItem('p','1');}});
 await toCustom(page);
 const step=page.locator('#step-3:visible');
 await expect(step.locator('[data-equipment-profile]')).toHaveText('From your profile — check it for this bake.');
 await expect(step.locator('[aria-pressed="true"]')).toHaveCount(1);
 await expect(forward(page)).toBeEnabled();
});
