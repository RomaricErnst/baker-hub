const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 9 (22 Nov 2026, flow and display track; FINDINGS round 8 A, E, S3, S5).
// Thomas: 4 baguettes, 20 °C, standard home oven, nights busy, bake Sat 28 Nov 11:30; a Simple recipe, then
// "Customize my bake" in place. A: Fine-tune's "Why this value?" sum is the recipe's 71 % (style 68 · oven +3; the
// flour was never chosen, so no "flour type +1" and no W note). S3: the French boxes read « 2,2 ». E: an entered
// yeast's Update recipe opens the recipe straight from Fine-tune (no bake time, no "Which preferment?"); the
// Preferment and Yeast screens show the recipe's choice selected, with a live way back to the recipe.
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
test.setTimeout(150000);
test.use({timezoneId:'Europe/Paris',actionTimeout:20000});

const L={
 en:{root:'/',bread:/^Bread/,kitchen:/^Temperature where the dough rests/,bakeLabel:'Bake date and time',generate:/^Generate my recipe/,choices:/My choices/,customize:'Customize my bake',
  dough:'Edit: Fine-tune the dough',pref:'Edit: Preferment',yeast:'Edit: Yeast',why:'Why this value?',update:'Update recipe',back:'Back to Recipe',sum:'Style 68% · oven +3 → 71%',salt:'2.2',
  water:'71%',plan:/^Your plan$/,direct:/^Direct dough/,instant:/^Instant dry yeast/},
 fr:{root:'/fr',bread:/^Pain/,kitchen:/^Température/,bakeLabel:'Date et heure de cuisson',generate:/^Générer ma recette/,choices:/Mes choix/,customize:'Personnaliser ma fournée',
  dough:'Modifier : Peaufiner la pâte',pref:'Modifier : Préferment',yeast:'Modifier : Levure',why:'Pourquoi cette valeur ?',update:'Mettre à jour la recette',back:'Retour à la recette',sum:'Style 68 % · four +3 → 71 %',salt:'2,2',
  water:'71 %',plan:/^Votre plan$/,direct:/^Pâte directe/,instant:/^Levure sèche instantanée/},
};

async function simpleThomas(page,locale){
 const l=L[locale];
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const busy={version:1,blockers:{sleep:{enabled:true,from:'23:00',to:'07:00'},work:{enabled:false,from:'09:00',to:'18:00'}}};
 await page.clock.install({time:new Date('2026-11-26T18:30:00Z')});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([b])=>{if(sessionStorage.getItem('r9-seeded'))return;sessionStorage.setItem('r9-seeded','1');localStorage.clear();localStorage.setItem('bh_profile_v1',b);},[JSON.stringify(busy)]);
 await page.goto(l.root);
 await page.getByRole('button',{name:l.bread}).first().tap();
 await page.getByRole('button',{name:/^Baguette/}).first().tap();
 const bake=page.getByLabel(l.bakeLabel,{exact:true});
 for(let i=0;i<8&&!(await bake.isVisible());i++){
  const k=page.getByLabel(l.kitchen).filter({visible:true});
  if(await k.count()){await k.first().fill('20');await k.first().blur();}
  await page.locator('[data-bh-forward]:visible').first().tap();await page.waitForTimeout(300);
 }
 await bake.fill('2026-11-28T11:30');await bake.blur();
 await page.getByRole('button',{name:l.generate}).tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated??false,{timeout:30000}).toBe(true);
 await page.getByRole('button',{name:l.choices}).last().tap();
 await page.getByRole('button',{name:l.customize}).tap();
 return errors;
}
const shot=async(page,name)=>page.screenshot({path:test.info().outputPath(`${name}.png`),fullPage:true});

for(const locale of ['en','fr']){
 const l=L[locale];
 test(`${locale}: Customize in place — one hydration, French commas, Update recipe straight to the recipe, the choices selected`,async({page})=>{
  const errors=await simpleThomas(page,locale);
  await page.getByRole('button',{name:l.dough}).tap();
  const fineTune=page.locator('#step-10:visible');
  await expect(fineTune.getByLabel(/^(Hydration|Hydratation), % /)).toHaveValue('71');
  await fineTune.locator('summary').filter({hasText:l.why}).tap();
  // A: the sum the recipe uses; no flour line and no W note for a flour never chosen.
  await expect(fineTune.getByText(l.sum,{exact:true})).toBeVisible();
  await expect(fineTune.locator('[data-hydration-w-note]')).toHaveCount(0);
  await expect(fineTune.getByText(/flour type|type de farine/)).toHaveCount(0);
  // S3: the locale's decimal in the box.
  await expect(fineTune.getByLabel(/^(Salt|Sel), % /)).toHaveValue(l.salt);
  await shot(page,`r9-finetune-${locale}`);
  // E: an entered yeast, then Update recipe: the recipe, never the bake time or "Which preferment?".
  const headings=[];
  const yeast=fineTune.locator('[data-yeast-override] input');
  await yeast.fill(locale==='fr'?'0,13':'0.13');await yeast.blur();
  await expect.poll(async()=>(await stored(page)).yeastPctOverride).toBeTruthy();
  await page.evaluate(()=>{window.__h1=[];const seen=()=>{const h=document.querySelector('h1');const t=h&&h.offsetParent?h.textContent.trim():'';if(t&&window.__h1.at(-1)!==t)window.__h1.push(t);};new MutationObserver(seen).observe(document.body,{subtree:true,childList:true,attributes:true});});
  await page.locator('.bh-step-actions:visible button').filter({hasText:l.update}).first().tap();
  await expect.poll(async()=>{const s=await stored(page);return s.recipeGenerated&&!s.protocolStale&&s.activeTab==='plan';},{timeout:30000}).toBe(true);
  headings.push(...await page.evaluate(()=>window.__h1));
  expect(headings.some(h=>l.plan.test(h)||/préferment|preferment/i.test(h))).toBe(false);
  await expect(page.getByRole('heading',{level:1,name:/^Baguettes/})).toBeVisible();
  // The recipe's water is the Fine-tune number.
  await expect(page.locator('[data-whole-dough], body').getByText(l.water,{exact:true}).filter({visible:true}).first()).toBeVisible();
  await shot(page,`r9-recipe-${locale}`);
  // Preferment and Yeast show the recipe's choice, and the way back is live.
  await page.getByRole('button',{name:l.choices}).last().tap();
  await page.getByRole('button',{name:l.pref}).tap();
  const pref=page.locator('#step-8:visible');
  await expect(pref.getByRole('button',{name:l.direct})).toHaveAttribute('aria-pressed','true');
  const prefForward=page.locator('.bh-step-actions:visible button').last();
  await expect(prefForward).toHaveText(l.back);await expect(prefForward).toBeEnabled();
  await shot(page,`r9-preferment-${locale}`);
  await page.locator('.bh-step-actions:visible button').first().tap();
  await page.getByRole('button',{name:l.yeast}).tap();
  const yeastStep=page.locator('#step-7:visible');
  await expect(yeastStep.locator('[aria-pressed="true"]').filter({hasText:l.instant})).toHaveCount(1);
  await expect(page.getByText(/^(Choose your yeast\.|Choisissez votre levure\.)$/)).toHaveCount(0);
  const yeastForward=page.locator('.bh-step-actions:visible button').last();
  await expect(yeastForward).toHaveText(l.back);await expect(yeastForward).toBeEnabled();
  await shot(page,`r9-yeast-${locale}`);
  await yeastForward.tap();
  await expect(page.getByRole('heading',{level:1,name:/^Baguettes/})).toBeVisible();
  expect(errors).toEqual([]);
 });
}

// S5: the "Before your recipe" sheet on Fine-tune (Custom reached from the bake time): "Back to the bake time" opens it.
test('S5: Back to the bake time from the Fine-tune sheet opens the bake time',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Quantity →$/}).tap();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);while([0,6].includes(d.getDay()))d.setDate(d.getDate()+1);d.setHours(13,0,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel('Bake date and time',{exact:true});
 await time.fill(target);await time.blur();
 for(const name of [/^Weekdays/,/^Nights/]){const chip=page.getByRole('button',{name}).filter({visible:true}).first();if(await chip.getAttribute('aria-pressed')!=='true')await chip.tap();}
 await page.getByRole('button',{name:/^Customize my bake/}).tap();
 const finish=page.locator('[data-finetune-generate]');
 for(let i=0;i<14&&!(await finish.isVisible());i++){
  const forward=page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first();
  if(await forward.isDisabled()){const flour=page.getByText('Caputo Pizzeria',{exact:true}).filter({visible:true});if(await flour.count())await flour.first().tap();}
  if(await forward.isDisabled()){const option=page.locator('.bh-step:visible [role="group"] [role="button"][aria-pressed="false"], #step-3:visible [role="button"][aria-pressed="false"], #step-7:visible [role="button"][aria-pressed="false"], #step-8:visible [role="button"][aria-pressed="false"]').first();if(await option.count())await option.tap();}
  await forward.tap();
  await page.waitForTimeout(300);
 }
 await finish.tap();
 const sheet=page.locator('[data-decision-sheet]');
 await expect(sheet.getByRole('dialog',{name:'Before your recipe'})).toBeVisible();
 await sheet.locator('[data-decision-sheet-close]').tap();
 await expect(sheet).toHaveCount(0);
 // The bake time itself, not Fine-tune with the sheet closed.
 await expect(time).toBeVisible();
 await expect(finish).toBeHidden();
 await shot(page,'r9-back-to-bake-time');
 expect(errors).toEqual([]);
});
