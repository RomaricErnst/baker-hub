const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// 14 Nov 2026 polish audit: a preferment that cannot be ready before the bake is said so on its
// own step, with what fits instead (never a plan starting in the past); the yeast's weighing help
// opens full width under its row; planned times read on the 15-minute grid.
test.use({timezoneId:'Asia/Singapore'});
const fwd=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first();
async function start(page){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await fwd(page).tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
}

test('a biga that cannot be ready offers direct dough or a later bake',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);
 const time=page.getByLabel('Bake date and time',{exact:true});
 const d=new Date(Date.now()+8*3600000);const p=n=>String(n).padStart(2,'0');
 await time.fill(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:00`);await time.blur();
 await page.locator('[data-customize-link]').evaluate(b=>b.click());
 for(let i=0;i<8&&!(await page.locator('#step-8:visible').count());i++){
  if(await fwd(page).isDisabled()){
   const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});
   if(await flour.count())await flour.first().tap();
   else await page.locator('[id^="step-"]:visible [role="button"][aria-pressed]').first().tap();
  }
  await fwd(page).tap();
 }
 await page.getByRole('button',{name:/^Biga/}).filter({visible:true}).first().tap();
 const note=page.locator('[data-preferment-too-close]');
 await expect(note).toContainText(/^A biga needs about \d+h before baking; your bake is in \d+h\./);
 await expect(fwd(page)).toBeDisabled();
 await note.locator('[data-preferment-fallback="none"]').tap();
 await expect(note).toHaveCount(0);
 await expect(fwd(page)).toBeEnabled();
 expect(errors).toEqual([]);
});

test('the weighing help opens under the yeast row, at full width',async({page})=>{
 await start(page);
 const time=page.getByLabel('Bake date and time',{exact:true});await time.focus();await time.blur();
 await page.locator('[data-generate-recipe]').tap();
 const help=page.locator('[data-yeast-help]:visible').first();
 await help.locator('summary').tap();
 await expect(help.locator('summary')).toHaveText(/▴$/);
 const note=help.locator('[data-weigh-note]');
 await expect(note).toBeVisible();
 const box=await note.boundingBox(),vw=page.viewportSize().width;
 expect(box.width).toBeGreaterThan(vw*0.8);
 // Your plan: every time on the quarter hour.
 const times=await page.locator('[data-recipe-plan-steps] li span:first-child').allTextContents();
 for(const t of times.filter(Boolean))expect(t).toMatch(/:(00|15|30|45)(am|pm)/);
});
