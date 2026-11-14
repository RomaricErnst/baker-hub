const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// The route agreed on the journey map (12 Nov 2026), walked end to end:
// one setup path, sections in order with the same bottom bar, times changed only
// from the plan (in place on the Recipe), My bake holds the choices, and customizing continues in place.
test.use({timezoneId:'Asia/Singapore'});
const bar=page=>page.locator('.bh-step-actions:visible, .bh-recipe-next:visible').last();

for(const fr of [false,true])test(`${fr?'fr':'en'}: the whole route, without detours`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const L=(en,f)=>fr?f:en;
 await page.goto(fr?'/fr':'/');
 // Setup: one straight path to the bake time.
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:L('Classic Neapolitan','Napolitaine classique'),exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:L(/^Quantity →$/,/^Quantité →$/)}).tap();
 const quantity=page.getByLabel(L('Number of pizzas','Nombre de pizzas'),{exact:true});
 await quantity.fill('4');await quantity.blur();
 await page.locator('.bh-step-actions:visible [data-bh-forward]:visible, .bh-batch-actions:visible [data-bh-forward]:visible').first().tap();
 await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
 await expect(page.getByRole('heading',{name:L('How would you like to set up your recipe?','Comment définir votre recette ?')})).toHaveCount(0);
 const target=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+2);d.setHours(19,30,0,0);return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const time=page.getByLabel(L('Bake date and time','Date et heure de cuisson'),{exact:true});
 await time.fill(target);await time.blur();
 await expect(page.locator('[data-busy-question]')).toContainText(L('When are you busy? (optional)','Quand êtes-vous occupé ? (facultatif)'));
 await expect(page.locator('[data-busy-question]')).toContainText(L('We won’t plan any hands-on step at these times.','Nous ne prévoirons aucune étape manuelle à ces heures.'));

 // Generate: the ingredients show first; the plan never shows above them.
 await page.evaluate(()=>{window.__planFirst=false;const f=()=>{const p=document.querySelector('[data-recipe-plan]');if(p&&p.offsetParent&&p.getBoundingClientRect().top<innerHeight*0.6)window.__planFirst=true;if(!document.querySelector('[data-recipe-plan-steps]')||performance.now()<window.__until)requestAnimationFrame(f);};window.__until=performance.now()+3000;requestAnimationFrame(f);});
 await page.getByRole('button',{name:L('Generate my recipe','Générer ma recette'),exact:true}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Recipe','Recette'));
 await page.waitForTimeout(1500);
 expect(await page.evaluate(()=>window.__planFirst)).toBe(false);

 // Recipe: times change from the plan; one bottom bar, no Preparation shortcut.
 await expect(page.locator('[data-go-preparation]')).toHaveCount(0);
 // The water line: no kneading-equipment question, and a "how to get it" toggle only when it has steps (ice).
 await expect(page.getByText(L(/Use a mixer|hand kneading/,/Utiliser un robot|pétrissage à la main/)).filter({visible:true})).toHaveCount(0);
 if(await page.locator('[data-water-help]:visible').count())await expect(page.locator('[data-water-temp]:visible').first()).toContainText(L('ice','glace'));
 // Pizzas are planned with the dough: the Recipe leads to them, and carries no toppings button of its own.
 await expect(bar(page).getByRole('button')).toHaveText([L('My choices','Mes choix'),'Pizzas →']);
 await expect(page.locator('.bh-fillings-invitation')).toHaveCount(0);
 // Start Dough moves in place, on the Recipe: no trip to the timing screen.
 await expect(page.locator('[data-change-times]')).toHaveCount(0);
 await page.locator('[data-plan-edit]').tap();
 await expect(page.locator('[data-plan-editor]')).toBeVisible();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Recipe','Recette'));
 await page.locator('[data-plan-editor]').getByRole('button',{name:L(/^Close /,/^Fermer /)}).tap();
 await expect(page.locator('[data-plan-editor]')).toHaveCount(0);

 // Sections in order: Recipe → Pizzas → Shopping list → Preparation; each bar goes back one and on to the next.
 const companion=page.locator('[data-companion-action]:visible');
 await bar(page).getByRole('button',{name:'Pizzas →',exact:true}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Pizzas');
 await expect(companion.getByRole('button')).toHaveText([L('Back to Recipe','Retour à Recette'),L('Shopping list →','Liste de courses →')]);
 await companion.getByRole('button',{name:L('Back to Recipe','Retour à Recette'),exact:true}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Recipe','Recette'));
 await bar(page).getByRole('button',{name:'Pizzas →',exact:true}).tap();
 await companion.getByRole('button',{name:L('Shopping list →','Liste de courses →'),exact:true}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Shopping list','Courses'));
 await expect(page.getByRole('button',{name:L('Add toppings — optional','Ajouter des garnitures — facultatif')}).filter({visible:true})).toHaveCount(0);
 await expect(bar(page).getByRole('button').first()).toHaveText(L('Back to Pizzas','Retour aux pizzas'));
 await bar(page).getByRole('button').last().tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Preparation','Préparation'));
 await expect(bar(page).getByRole('button').first()).toHaveText(L('Back to Shopping list','Retour à Courses'));
 await expect(page.locator('.bh-late-fillings')).toHaveCount(0);
 const sections=async label=>{const t=page.locator('.bh-bake-navigator-trigger:visible').first();await t.scrollIntoViewIfNeeded();if(await t.getAttribute('aria-expanded')!=='true')await t.tap();await page.getByRole('navigation',{name:L('Your bake','Votre fournée'),exact:true}).getByRole('button',{name:label}).first().tap();};
 await sections(L(/^Baking/,/^Cuisson/));
 await expect(bar(page).getByRole('button').first()).toHaveText(L('Back to Preparation','Retour à Préparation'));

 // My bake: the choices only. The bake time asks only the question.
 await sections(L(/^My bake/,/^Ma fournée/));
 await expect(page.getByRole('heading',{level:1,name:L('Review my choices','Revoir mes choix'),exact:true})).toBeVisible();
 await expect(page.locator('[data-my-bake-plan]')).toHaveCount(0);
 await page.getByRole('button',{name:L('Edit : Bake time','Modifier : Heure de cuisson'),exact:true}).tap();
 await expect(time).toBeVisible();
 await expect(page.getByText(L('See all hands-on steps','Voir toutes les interventions')).filter({visible:true})).toHaveCount(0);
 // The edit returns to where the baker came from (Baking & serving here).
 const back=page.locator('.bh-step-actions:visible').getByRole('button').last();
 await expect(back).toHaveText(L('Back to Baking & serving','Retour à Cuisson & service'));
 await back.tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(L('Baking','Cuisson'));

 // Customizing continues in place: more rows, same page.
 await sections(L(/^My bake/,/^Ma fournée/));
 await page.locator('[data-mode-switch]').tap();
 await expect(page.getByRole('heading',{level:1,name:L('Review my choices','Revoir mes choix'),exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:L('How would you like to set up your recipe?','Comment définir votre recette ?')})).toHaveCount(0);
 await expect(page.getByRole('button',{name:L('Edit : Flour','Modifier : Farine'),exact:true})).toBeVisible();
 await expect(page.locator('[data-mode-switch]')).toHaveText(L('Use the recommended settings','Revenir aux réglages conseillés'));
 expect(errors).toEqual([]);
});
