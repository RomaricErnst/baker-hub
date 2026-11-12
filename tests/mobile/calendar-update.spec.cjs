const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs');

// Re-adding a plan to the calendar: the card notices when steps have moved since
// the last export, and the new file cancels steps that left the plan.
async function generate(page){
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 const quantity=page.getByLabel('Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await page.locator('.bh-step-actions:visible').locator('[data-bh-forward]:visible').tap();
 if(await page.locator('[data-kitchen-slider]:visible').count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const value=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(19,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill(value);await bakeDate.blur();
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
}
async function download(page,name){
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator('[data-preparation-timing] [data-add-calendar]').tap()]);
 return fs.readFileSync(await file.path(),'utf8');
}

test('a moved plan asks to update the calendar; the update cancels a step that left the plan',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await generate(page);
 // The calendar lives on the Preparation summary.
 await (async()=>{const t=page.locator('.bh-bake-navigator-trigger');if(await t.getAttribute('aria-expanded')!=='true')await t.tap();await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name:/^Preparation/}).first().tap();})();
 const card=page.locator('[data-preparation-timing]');
 await expect(card).toBeVisible();
 await expect(card.locator('[data-calendar-outdated]')).toHaveCount(0);
 const first=await download(page,'Add to my calendar');
 expect(first).toContain('BEGIN:VCALENDAR');
 expect(first).not.toContain('STATUS:CANCELLED');
 // What was exported now differs from the plan: one step moved, one step is gone.
 await page.evaluate(()=>{
  const all=JSON.parse(localStorage.getItem('bh_calendar_exports_v1')||'{}');
  const id=Object.keys(all)[0];
  const steps=all[id];const key=Object.keys(steps)[0];
  steps[key].at-=3600000;
  steps['old-step']={at:Date.now()+86400000,label:'Old step'};
  localStorage.setItem('bh_calendar_exports_v1',JSON.stringify(all));
 });
 await page.reload();
 await (async()=>{if(!(await card.isVisible()))await (async()=>{const t=page.locator('.bh-bake-navigator-trigger');if(await t.getAttribute('aria-expanded')!=='true')await t.tap();await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name:/^Preparation/}).first().tap();})();})();
 await expect(card.locator('[data-calendar-outdated]')).toHaveText('The steps have changed since you added this plan to your calendar. Add it again to update it.');
 await expect(card.locator('[data-add-calendar]')).toHaveText('Update my calendar');
 const second=await download(page,'Update my calendar');
 expect(second).toMatch(/UID:[^\r]+-old-step@bakerhub\.app[\s\S]*?STATUS:CANCELLED/);
 const uids=s=>[...s.matchAll(/UID:(\S+)/g)].map(m=>m[1]).filter(u=>!u.includes('old-step'));
 expect(uids(second)).toEqual(uids(first));
 await expect(card.locator('[data-calendar-outdated]')).toHaveCount(0);
 await expect(card.locator('[data-add-calendar]')).toHaveText('Add to my calendar');
 expect(errors).toEqual([]);
});
