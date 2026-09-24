const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
async function open(page){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous journey test"}'}));
 await page.goto('/fr/with-my-base');
 await page.evaluate(()=>localStorage.setItem('bh_session_v1','{"test":"homemade draft preserved"}'));
}
async function navigate(page,name){
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Votre fournée',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).tap();
}
async function intact(page){
 expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe('{"test":"homemade draft preserved"}');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}
test('existing bread keeps optional garnishes and shopping through reload without touching homemade draft',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'Pain de campagne · tartines',exact:true}).tap();
 await page.getByRole('button',{name:'Voir la recette Avocat, œuf poché et feta',exact:true}).tap();
 const dialog=page.getByRole('dialog');
 const extra=dialog.getByRole('checkbox',{name:/Graines de grenade/});
 await expect(extra).not.toBeChecked();await extra.check();
 await dialog.getByRole('spinbutton',{name:'Quantité Avocat, œuf poché et feta',exact:true}).fill('2');
 await dialog.getByRole('button',{name:'Terminé',exact:true}).tap();
 await navigate(page,'Courses');
 const row=page.locator('label').filter({hasText:'Graines de grenade'});
 await expect(row).toContainText('30 g');await row.getByRole('checkbox').check();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_existing_base_v1')).section)).toBe('shopping');
 await page.reload();await expect(row.getByRole('checkbox')).toBeChecked();
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Préparez les garnitures',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Passer à l’assemblage →',exact:true}).tap();
 await page.getByRole('button',{name:'Une tartine prête',exact:true}).tap();
 await intact(page);
});
test('purchased pizza skips dough setup and persists served count',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 const pizza=page.getByRole('button',{name:'Margherita',exact:true});await pizza.getByRole('button',{name:'+',exact:true}).tap();
 await navigate(page,'Courses');
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await navigate(page,'Cuisson & service');
 await expect(page.getByRole('heading',{name:'Cuire et servir vos pizzas',exact:true})).toBeVisible();
 await expect(page.getByText(/Suivez l’emballage/).first()).toBeVisible();
 await page.getByRole('button',{name:'Une pizza cuite et servie',exact:true}).tap();
 await expect.poll(()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('bh_existing_base_v1')).done).reduce((s,n)=>s+n,0))).toBe(1);
 await page.reload();await expect(page.getByText('1 / 1 servies',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Annuler',exact:true}).tap();
 await expect(page.getByText('0 / 1 servies',{exact:true})).toBeVisible();await intact(page);
});

test('pain de mie clubs and croques use slices and cook after assembly',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Pain de mie · clubs & croques',exact:true}).tap();
 await page.getByRole('spinbutton',{name:'Quantité Club sandwich au poulet et bacon',exact:true}).fill('2');
 await page.getByRole('spinbutton',{name:'Quantité Croque-monsieur à la béchamel',exact:true}).fill('1');
 await expect(page.getByText(/8 tranches/)).toBeVisible();
 await navigate(page,'Courses');
 await expect(page.locator('label').filter({hasText:'Lait demi-écrémé'})).toBeVisible();
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await expect(page.getByText(/béchamel/i).first()).toBeVisible();
 await page.getByRole('button',{name:'Passer à l’assemblage →',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Assembler et servir',exact:true})).toBeVisible();
 await expect(page.locator('ol').filter({hasText:/180/})).toBeVisible();
 await page.getByRole('button',{name:'Un sandwich prêt',exact:true}).first().tap();
 await page.reload();await expect(page.getByRole('heading',{name:'Assembler et servir',exact:true})).toBeVisible();await intact(page);
});

test('raw bagel requires baking and cooling; six sections and browser Back preserve choices',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Bagels',exact:true}).tap();
 await page.getByLabel('État de la base').selectOption('dough');
 await page.getByLabel('Origine').selectOption('homemade');
 await page.getByLabel('Avancement').selectOption('shaped');
 await navigate(page,'Cuisson & service');
 await expect(page.getByText(/pochez les bagels/)).toBeVisible();
 await expect(page.getByRole('heading',{name:'Assembler et servir'})).toHaveCount(0);
 await page.getByRole('button',{name:'Mon pain est cuit et refroidi',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Annuler « pain cuit »'})).toBeVisible();
 await page.goBack();await expect(page.locator('.bh-bake-navigator-trigger')).toContainText('Ma fournée');
 await expect(page.getByLabel('État de la base')).toHaveValue('dough');
 await page.goForward();await expect(page.locator('.bh-bake-navigator-trigger')).toContainText('Cuisson & service');
 await page.reload();await expect(page.getByRole('button',{name:'Annuler « pain cuit »'})).toBeVisible();
 await intact(page);
});
