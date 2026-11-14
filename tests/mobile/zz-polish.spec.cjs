const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
test.use({timezoneId:'Asia/Singapore'});
const S='/tmp/claude-0/-home-claude/95a4be40-6056-5c1e-aeaf-75fb16280be2/scratchpad/shots/';
const fwd=page=>page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first();
async function toBakeTime(page,fr=false){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await fwd(page).tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
}
test('weigh panel',async({page})=>{
 await toBakeTime(page);
 const time=page.getByLabel('Bake date and time',{exact:true});await time.focus();await time.blur();
 await page.locator('[data-generate-recipe]').tap();
 const help=page.locator('[data-yeast-help]:visible').first();
 await help.locator('summary').tap();
 await help.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
 await page.screenshot({path:S+'a-weigh.png'});
});
test('biga too close',async({page})=>{
 await toBakeTime(page);
 const time=page.getByLabel('Bake date and time',{exact:true});
 const d=new Date(Date.now()+8*3600000);const p=n=>String(n).padStart(2,'0');
 await time.fill(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:00`);await time.blur();
 await page.getByRole('button',{name:/^Customize my bake/}).tap();
 for(let i=0;i<8&&!(await page.locator('#step-8:visible').count());i++){
  const step=page.locator('.bh-step-page:visible, [id^="step-"]:visible').first();
  if(await fwd(page).isDisabled()){
   const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});
   if(await flour.count())await flour.first().tap();
   else await page.locator('[id^="step-"]:visible [role="button"][aria-pressed]').first().tap();
  }
  await fwd(page).tap();
 }
 await page.getByRole('button',{name:/^Biga/}).filter({visible:true}).first().tap();
 await page.locator('[data-preferment-too-close]').scrollIntoViewIfNeeded();
 await page.screenshot({path:S+'b-biga.png'});
 await expect(fwd(page)).toBeDisabled();
});
