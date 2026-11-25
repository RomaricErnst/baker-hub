const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Bake journal on this device, signed out: a generated bake appears under
// "My bakes"; rating and note survive a reload; delete is immediate, with Undo (round 18).
const journal=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_journal_v1')||'[]'));
// Round 20 (item 7): a bake still to come offers no rating and no Bake again; these tests move the bake into the past.
// The draft is the same bake: it moves too, or the next save writes its future bake time back over the entry's
// (round 20 CI: WebKit saved the draft after the reload and the sheet still showed a bake to come).
// Round 21 (F1, cause): the move was written while the page still held the bake in memory, and the page saves its draft on
// pagehide (the reload) — over the moved entry, when WebKit's save landed after the write. The move now runs in the NEXT
// page, before any app script (an init script, once per move), so no save of the old page can follow it.
// (2 h ago: still within the 12 h when the sheet offers "Open my bake".)
async function bakedTwoHoursAgo(page,id){
 const token=`moved-${id}-${Date.now()}`;
 await page.addInitScript(([id,token])=>{
  if(sessionStorage.getItem(token))return;sessionStorage.setItem(token,'1');
  const rows=JSON.parse(localStorage.getItem('bh_journal_v1')||'[]');const row=rows.find(r=>r.id===id);if(!row)return;
  const shift=Date.now()-2*3600000-row.eatTime;
  const move=s=>{if(!s)return s;for(const k of ['startTime','eatTime','acceptedStartTime','acceptedPreparationAt','acceptedEatTime'])if(typeof s[k]==='number')s[k]+=shift;return s;};
  row.eatTime+=shift;move(row.session);localStorage.setItem('bh_journal_v1',JSON.stringify(rows));
  if(localStorage.getItem('bh_journal_current_v1')===id){const d=JSON.parse(localStorage.getItem('bh_session_v1')||'null');if(d)localStorage.setItem('bh_session_v1',JSON.stringify(move(d)));}
 },[id,token]);
 await page.reload();
 await expect.poll(()=>page.evaluate(id=>(JSON.parse(localStorage.getItem('bh_journal_v1')||'[]').find(r=>r.id===id)||{}).eatTime<Date.now(),id)).toBe(true);
}
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
 // A second bake in the same oven at the same time is asked once (18 Nov 2026 retention round 3): keep it.
 // (Round 20: the first bake may be behind, then there is no oven to share and no question.)
 if(count>1){await page.waitForTimeout(1500);const keep=page.locator('[data-oven-keep]');if(await keep.count())await keep.tap();}
 await expect.poll(async()=>(await journal(page)).length).toBe(count);
}
async function openMyBakes(page,fr){
 // A bake baked within 12 h opens its rating sheet by itself when the page comes back (round 6); on a slow
 // runner it can land after the reload settles (round 20 CI). Close it: My bakes opens the same sheet.
 const auto=page.getByRole('dialog',{name:fr?'Fournée du journal':'Bake journal entry'});
 for(let i=0;;i++){
  if(await auto.count())await auto.getByRole('button',{name:fr?'Fermer':'Close',exact:true}).tap();
  try{await page.getByRole('button',{name:'Menu',exact:true}).tap({timeout:5000});break;}catch(e){if(i>=5)throw e;}
 }
 await page.getByRole('button',{name:fr?'Mes fournées':'My bakes',exact:true}).tap();
}

for(const lang of ['en','fr'])test(`${lang}: journal entry without signing in — rate, note, reload, delete`,async({page})=>{
 const fr=lang==='fr';
 test.setTimeout(120000); // two reloads and a full generate: a slow runner needs more than the default minute
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
 // Before the bake the entry shows the plan; nothing to rate yet and no Bake again (round 20, item 7).
 await expect(sheet.locator('[data-journal-plan]')).toBeVisible();
 await expect(sheet.getByText(fr?'Comment s’est passée votre cuisson ?':'How did it turn out?',{exact:true})).toHaveCount(0);
 await expect(sheet.locator('[data-rate-now]')).toHaveCount(0);
 await expect(sheet.getByRole('button',{name:fr?/^Refaire la semaine suivante/:/^Bake again next week/})).toHaveCount(0);
 await sheet.getByRole('button',{name:fr?'Fermer':'Close',exact:true}).tap();
 await bakedTwoHoursAgo(page,first.id); // reloads
 await openMyBakes(page,fr);
 await menu.locator(`[data-journal-entry="${first.id}"]`).tap();
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

 // Delete is immediate, with Undo in My bakes where its card was (round 18, H3); never a confirm.
 // The draft as it stands (a bake behind is no longer a live recipe on reload): Undo brings back this one.
 const draftBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null')?.recipeGenerated);
 await sheet.getByRole('button',{name:fr?'Supprimer de cet appareil':'Delete from this device',exact:true}).tap();
 await expect(sheet).toHaveCount(0);
 expect(await journal(page)).toEqual([]);
 const removed=menu.locator(`[data-journal-removed="${first.id}"]`);
 await expect(removed).toContainText(fr?/Pizza du soir supprimée ·|supprimée ·/:/Pizza night removed ·|removed ·/);
 // It was the bake on screen: its draft goes with it, and Undo brings both back.
 expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBeNull();
 await removed.locator('[data-journal-undo]').tap();
 await expect.poll(async()=>(await journal(page)).map(e=>e.id)).toEqual([first.id]);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null')?.recipeGenerated)).toBe(draftBefore);
 await expect(menu.locator(`[data-journal-entry="${first.id}"]`)).toBeVisible();
 // Delete again and close the menu: Undo is gone.
 await menu.locator(`[data-journal-entry="${first.id}"]`).tap();
 await sheet.getByRole('button',{name:fr?'Supprimer de cet appareil':'Delete from this device',exact:true}).tap();
 await expect(removed).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('[data-journal-removed]')).toHaveCount(0);
 expect(await journal(page)).toEqual([]);
 expect(confirms).toBe(0);
 expect(errors).toEqual([]);
});

test('en: photos stay on the device and a new bake adds a second entry',async({page})=>{
 test.setTimeout(120000); // a full generate, two reloads and a second generate (as the test above)
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await generate(page,false);
 const [entry]=await journal(page);
 await openMyBakes(page,false);
 await page.locator(`[data-journal-entry="${entry.id}"]`).tap();
 const sheet=page.getByRole('dialog',{name:'Bake journal entry'});
 // After the bake the entry takes photos (a bake still to come offers no rating, round 20).
 await sheet.getByRole('button',{name:'Close',exact:true}).tap();
 await bakedTwoHoursAgo(page,entry.id); // reloads
 await openMyBakes(page,false);
 await page.locator(`[data-journal-entry="${entry.id}"]`).tap();
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
 // A new visit shows the Resume card; a family card on home starts a fresh bake (round 18, H2).
 const visit=await page.context().newPage();
 visit.on('pageerror',e=>errors.push(e.message));
 await visit.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await visit.goto('/');
 await generate(visit,false,2);
 expect((await journal(visit)).some(row=>row.id===entry.id&&row.photoIds.length===1)).toBe(true);
 expect(errors).toEqual([]);
});
