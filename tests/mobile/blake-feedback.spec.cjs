const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
// 14 Nov 2026: the flour basis sits behind Adjust on Quantity, in Simple and Custom alike.
for(const lang of ['fr','en'])test(`${lang}: Quantity asks only how many; the flour basis waits behind Adjust and survives reload`,async({page})=>{
 const fr=lang==='fr';
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,body:'{}'}));
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:fr?'Pain & repas':'Bread & meals',exact:true}).tap();
 await page.getByRole('button',{name:'Brioche',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 await expect(page.locator('.bh-fillings-invitation')).toHaveCount(0);
 // The quantity screen asks one thing.
 await expect(page.locator('#quantity-count')).toBeVisible();
 await expect(page.locator('[data-flour-basis]')).toHaveCount(0);
 await expect(page.locator('#quantity-total-flour')).toHaveCount(0);
 await page.locator('[data-adjust-weight]').tap();
 await page.locator('[data-flour-basis="on"]').tap();
 const flour=page.locator('#quantity-total-flour');
 await flour.fill('750');await flour.blur();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null')?.totalFlourTarget)).toBe(750);
 await page.reload();
 const resume=page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true});
 if(await resume.count())await resume.tap();
 await page.locator('[data-adjust-weight]').tap();
 await expect(flour).toHaveValue('750');
 await expect(page.locator('[data-flour-basis="off"]')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('compact navigation reaches every section above the footer and Custom keeps the selected oven label',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-03T09:00:00'));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,body:'{}'}));
 await page.goto('/fr');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Napolitaine classique',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 await page.locator('[data-bh-forward]:visible').tap();
 await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
 const bakeDate=page.getByLabel('Date et heure de cuisson',{exact:true});
 await bakeDate.fill('2026-10-05T19:30');await bakeDate.blur();
 const customize=page.getByRole('button',{name:/^Personnaliser ma fournée/});
 await page.evaluate(()=>{const el=document.querySelector('[data-customize-link]');if(el){document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.scrollIntoView({block:'center'});}});
 await customize.tap();
 const actions=page.locator('.bh-step-actions:visible');
 await actions.getByRole('button',{name:'Étape précédente',exact:true}).tap();
 await expect(bakeDate).toHaveValue('2026-10-05T19:30');
 await page.evaluate(()=>{const el=document.querySelector('[data-customize-link]');if(el){document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.scrollIntoView({block:'center'});}});
 await customize.tap();
 // One bar opens "Your bake": the journey, with My bake's answers grouped (16 Nov 2026).
 await page.locator('.bh-bake-navigator-trigger').tap();
 const summary=page.getByRole('dialog',{name:'Votre fournée'});
 await expect(summary.locator('[data-destination-label]')).toHaveCount(5);
 // The answers fold into one line so the whole journey fits; See all opens them (16 Nov 2026 review).
 await summary.locator('.bh-journey-choices').tap();
 // Custom groups the answers: the group being answered is open, the other is one line.
 await expect(summary.getByRole('button',{name:/^Les bases/})).toHaveAttribute('aria-expanded','false');
 await expect(summary.getByRole('button',{name:/^Personnaliser/})).toHaveAttribute('aria-expanded','true');
 await expect(summary.getByRole('button',{name:/^Farine/})).toBeVisible();
 const last=summary.getByRole('button').last();
 await last.scrollIntoViewIfNeeded();
 await expect(last).toBeInViewport();
 await summary.getByRole('button',{name:'Terminé',exact:true}).tap();
 // Custom opens on its equipment page.
 await page.getByRole('button',{name:/^Four à pizza traditionnel/}).tap();
 await actions.locator('[data-bh-forward]:visible').tap();
 await expect(page.locator('#step-3:visible')).toContainText('Four à pizza traditionnel');
 await expect(page.getByText('Four maçonné',{exact:true})).toHaveCount(0);
});

test('flour-first recipe edits ignore a restored extra-dough allowance',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,body:'{}'}));
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(18,0,0,0);
 const data={version:1,savedAt:Date.now(),tab:'custom',bakeType:'bread',styleKey:'brioche',numItems:2,itemWeight:840,totalFlourTarget:750,wastePct:3,ovenType:'standard_bread',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,flourInFridge:false,startTime:+bake-10*3600000,eatTime:+bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',navigation:{batchView:'quantity',protocolView:'dough',serviceView:'dough',returnTo:null}};
 await page.addInitScript(data=>{
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,activeTab:'plan',setupOverview:false,reviewMode:true}));
 },data);
 await page.goto('/fr');
 await expect(page.getByText('750 g',{exact:true}).first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).itemWeight)).toBeGreaterThan(830);
 await page.getByRole('button',{name:'Mes choix',exact:true}).tap();
 await expect(page.getByText('750 g de farine · 2 pièces',{exact:true})).toBeVisible();
 await expect(page.locator('[data-mode-switch]')).toBeVisible();
 await page.getByRole('button',{name:'Modifier : Pâte',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Peaufinez votre pâte',exact:true})).toBeVisible();
 // Round 7: the row is "Marge pour les pertes" (accessible name below); still absent on a flour-first bread.
 await expect(page.getByLabel('Marge pour les pertes au pétrissage, % de la pâte',{exact:true})).toHaveCount(0);
});
