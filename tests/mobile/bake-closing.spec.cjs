const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// The last step of Baking & serving closes the bake: "How did it turn out?" opens
// this bake's journal entry, and "Start your next bake" starts a new one while
// this bake stays in My bakes.
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')||'[]'));
async function generate(page,fr){
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await page.locator('.bh-step-actions:visible').locator('[data-bh-forward]:visible').tap();
 await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
 const value=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(19,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const bakeDate=page.getByLabel(fr?'Date et heure de cuisson':'Bake date and time',{exact:true});
 await bakeDate.fill(value);await bakeDate.blur();
 await page.getByRole('button',{name:fr?'Générer ma recette':'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await journal(page)).length).toBe(1);
}
async function go(page,name){
 const trigger=page.locator('.bh-bake-navigator-trigger');
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:/^(Your bake|Votre fournée)$/}).getByRole('button',{name:new RegExp('^'+name)}).first().tap();
}

for(const locale of ['en','fr'])test(`${locale}: the bake ends with the journal and the next bake`,async({page})=>{
 const fr=locale==='fr';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await generate(page,fr);
 const [entry]=await journal(page);
 await go(page,fr?'Cuisson & service':'Baking & serving');
 // Open the last step of the section (its title is a button while the section shows
 // the overview of steps; once open, the closing block is inside it).
 const steps=page.locator('[data-guide-step]:visible');
 const closing=page.locator('[data-bake-closing]:visible');
 await expect.poll(async()=>{
  if(await closing.count())return true;
  // The section may open on one step: go to its overview of steps first.
  const overview=page.locator('button.bh-step-trigger:visible',{hasText:fr?'Vue d’ensemble':'Overview'});
  if(await overview.count())await overview.first().tap();
  const title=steps.last().locator(':scope > button').first();
  if(await title.count()){await title.tap();await closing.first().waitFor({timeout:4000}).catch(()=>{});}
  return (await closing.count())>0;
 },{timeout:20000}).toBe(true);
 await expect(closing).toBeVisible();
 await expect(closing.getByText(fr?'Cette fournée reste dans Mes fournées.':'This bake stays in My bakes.',{exact:true})).toBeVisible();
 await closing.getByRole('button',{name:fr?'Comment s’est passée cette fournée ?':'How did it turn out?',exact:true}).tap();
 const sheet=page.getByRole('dialog',{name:fr?'Fournée du journal':'Bake journal entry'});
 await expect(sheet).toBeVisible();
 await sheet.getByRole('button',{name:fr?'Fermer':'Close',exact:true}).first().tap();
 await closing.getByRole('button',{name:fr?'Préparer ma prochaine fournée':'Start your next bake',exact:true}).tap();
 // A new bake starts at the beginning; the finished one is still in the journal.
 await expect(page.getByRole('button',{name:'Pizza',exact:true})).toBeVisible();
 expect((await journal(page)).some(row=>row.id===entry.id)).toBe(true);
 expect(errors).toEqual([]);
});
