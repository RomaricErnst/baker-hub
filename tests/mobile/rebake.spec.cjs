const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Bake again from My bakes: the kitchen is asked again, then the scheduler opens
// on the shifted bake (a week later), not the previous bake's times, and the
// recipe can be generated.
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')||'[]'));
const local=(page,days,h)=>page.evaluate(([days,h])=>{const d=new Date();d.setDate(d.getDate()+days);d.setHours(h,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);},[days,h]);

for(const mode of ['simple','custom'])test(`${mode}: bake again opens the next week's bake and generates it`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 const quantity=page.getByLabel('Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await page.locator('.bh-step-actions:visible').locator('[data-bh-forward]:visible').tap();
 if(await page.locator('[data-kitchen-slider]:visible').count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill(await local(page,2,19));await bakeDate.blur();
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await journal(page)).length).toBe(1);
 const [first]=await journal(page);
 if(mode==='custom'){
  // Make it a Custom bake: the saved session says so.
  await page.evaluate(id=>{const all=JSON.parse(localStorage.getItem('bh_journal_v1'));all[0].session.tab='custom';localStorage.setItem('bh_journal_v1',JSON.stringify(all));},first.id);
 }
 await page.getByRole('button',{name:'Menu',exact:true}).tap();
 await page.getByRole('button',{name:'My bakes',exact:true}).tap();
 await page.locator(`#bakerhub-menu [data-journal-entry="${first.id}"]`).tap();
 await page.getByRole('dialog',{name:'Bake journal entry'}).getByRole('button',{name:/^Bake again next week/}).tap();
 const nextWeek=await local(page,9,19);
 // A new bake asks the kitchen again first.
 await expect(page.locator('[data-kitchen-slider]:visible')).toBeVisible();
 if(mode==='custom')return expect(errors).toEqual([]);
 await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 await expect(page.getByLabel('Bake date and time',{exact:true})).toHaveValue(nextWeek);
 await expect(page.getByText('Adjust the plan above to continue.')).toHaveCount(0);
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await journal(page)).length).toBe(2);
 const want=await page.evaluate(v=>+new Date(v),nextWeek);
 await expect.poll(()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('bh_session_v1')||'null');return s&&s.recipeGenerated?+new Date(s.eatTime):null;})).toBe(want);
 await expect(page.locator('[data-recipe-plan]')).toBeVisible();
 expect(errors).toEqual([]);
});
