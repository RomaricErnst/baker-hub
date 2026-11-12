const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Bake journal on this device, signed out: a generated bake appears under
// "My bakes"; rating and note survive a reload; delete is confirmed in the page.
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')||'[]'));
async function generate(page,fr,count=1){
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
 await expect.poll(async()=>(await journal(page)).length).toBe(count);
}
async function openMyBakes(page,fr){
 await page.getByRole('button',{name:'Menu',exact:true}).tap();
 await page.getByRole('button',{name:fr?'Mes fournées':'My bakes',exact:true}).tap();
}

for(const lang of ['en','fr'])test(`${lang}: journal entry without signing in — rate, note, reload, delete`,async({page})=>{
 const fr=lang==='fr';
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let confirms=0;page.on('dialog',d=>{confirms++;d.dismiss();});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await generate(page,fr);
 const [first]=await journal(page);
 expect(first.styleKey).toBe('neapolitan');expect(first.numItems).toBe(4);expect(first.session.recipeGenerated).toBe(true);

 await openMyBakes(page,fr);
 const menu=page.locator('#bakerhub-menu');
 await expect(menu.getByText(fr?'Sur cet appareil':'On this device',{exact:true})).toBeVisible();
 await expect(menu.getByText(fr?'Connectez-vous pour retrouver vos fournées sur tous vos appareils.':'Sign in to keep your bakes on all your devices.',{exact:true})).toBeVisible();
 const card=menu.locator(`[data-journal-entry="${first.id}"]`);
 await expect(card).toContainText(fr?'Napolitaine classique':'Classic Neapolitan');
 await card.tap();

 const sheet=page.getByRole('dialog',{name:fr?'Fournée du journal':'Bake journal entry'});
 await expect(sheet.getByText(fr?'Enregistré sur cet appareil uniquement.':'Saved on this device only.',{exact:true})).toBeVisible();
 // Before the bake the entry shows the plan; rating is one tap away.
 await expect(sheet.locator('[data-journal-plan]')).toBeVisible();
 await expect(sheet.getByText(fr?'Comment s’est passée votre cuisson ?':'How did it turn out?',{exact:true})).toHaveCount(0);
 await sheet.locator('[data-rate-now]').tap();
 await expect(sheet.getByText(fr?'Comment s’est passée votre cuisson ?':'How did it turn out?',{exact:true})).toBeVisible();
 await sheet.getByRole('button',{name:fr?'4 sur 5':'4 out of 5',exact:true}).tap();
 await expect(sheet.getByRole('button',{name:fr?'4 sur 5':'4 out of 5',exact:true})).toHaveAttribute('aria-pressed','true');
 await sheet.getByLabel('Notes',{exact:true}).fill('Leopard spots, a little pale underneath');
 await sheet.getByRole('button',{name:fr?'Enregistrer la note':'Save note',exact:true}).tap();
 await expect(sheet.getByRole('status')).toHaveText(fr?'Note enregistrée.':'Note saved.');
 await expect(sheet.getByRole('button',{name:fr?'Ouvrir ma fournée':'Open my bake',exact:true})).toBeVisible();
 await expect(sheet.getByRole('button',{name:fr?/^Refaire la semaine suivante \(/:/^Bake again next week \(/})).toBeVisible();
 await expect(sheet.getByRole('button',{name:fr?'Enregistrer dans mon compte':'Save to my account'})).toHaveCount(0);

 await page.reload();
 await openMyBakes(page,fr);
 await expect(menu.locator(`[data-journal-entry="${first.id}"]`)).toContainText(fr?'Noté 4/5':'Rated 4/5');
 await menu.locator(`[data-journal-entry="${first.id}"]`).tap();
 await expect(sheet.getByLabel('Notes',{exact:true})).toHaveValue('Leopard spots, a little pale underneath');
 await expect(sheet.getByRole('button',{name:fr?'4 sur 5':'4 out of 5',exact:true})).toHaveAttribute('aria-pressed','true');

 // Delete asks in the page; "Keep it" keeps it.
 await sheet.getByRole('button',{name:fr?'Supprimer':'Delete',exact:true}).tap();
 await expect(sheet.getByText(fr?'Supprimer cette fournée de cet appareil ? Ses notes et ses photos seront supprimées aussi.':'Delete this bake from this device? Its notes and photos go with it.',{exact:true})).toBeVisible();
 await sheet.getByRole('button',{name:fr?'La garder':'Keep it',exact:true}).tap();
 expect((await journal(page)).length).toBe(1);
 await sheet.getByRole('button',{name:fr?'Supprimer':'Delete',exact:true}).tap();
 await sheet.getByRole('button',{name:fr?'Supprimer':'Delete',exact:true}).tap();
 await expect(sheet).toHaveCount(0);
 expect(await journal(page)).toEqual([]);
 expect(confirms).toBe(0);
 // The bake itself is still open in the page.
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null')?.recipeGenerated)).toBe(true);
 expect(errors).toEqual([]);
});

test('en: photos stay on the device and a new bake adds a second entry',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await generate(page,false);
 const [entry]=await journal(page);
 await openMyBakes(page,false);
 await page.locator(`[data-journal-entry="${entry.id}"]`).tap();
 const sheet=page.getByRole('dialog',{name:'Bake journal entry'});
 // Before the bake the entry shows the plan; photos are one tap away.
 await sheet.locator('[data-rate-now]').tap();
 // A small PNG chosen from the device: downscaled to JPEG and kept in IndexedDB.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12P8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==','base64');
 await sheet.locator('input[type=file]').setInputFiles({name:'crumb.png',mimeType:'image/png',buffer:png});
 await expect(sheet.locator('img')).toHaveCount(1);
 await expect(sheet.getByText('1 of 3 photos',{exact:true})).toBeVisible();
 expect((await journal(page))[0].photoIds.length).toBe(1);
 expect(await page.evaluate(()=>localStorage.getItem('bh_journal_v1').length)).toBeLessThan(200000);
 await page.reload();
 await openMyBakes(page,false);
 await page.locator(`[data-journal-entry="${entry.id}"]`).tap();
 await expect(sheet.locator('img')).toHaveCount(1);
 await sheet.getByRole('button',{name:'Close',exact:true}).tap();
 // Start a new bake: the earlier entry stays, the next generation adds one.
 // A reload now reopens the bake itself; a new visit shows the Resume card with "Start a new bake".
 const visit=await page.context().newPage();
 visit.on('pageerror',e=>errors.push(e.message));
 await visit.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await visit.goto('/');
 await visit.getByRole('button',{name:'Start a new bake',exact:true}).tap();
 await generate(visit,false,2);
 expect((await journal(visit)).some(row=>row.id===entry.id&&row.photoIds.length===1)).toBe(true);
 expect(errors).toEqual([]);
});
