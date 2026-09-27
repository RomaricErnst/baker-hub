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
 await open(page);await page.getByRole('button',{name:'J’ai une pâte à cuire',exact:true}).tap();
 await page.getByRole('button',{name:'Bagels',exact:true}).tap();
 await page.getByLabel('Origine').selectOption('homemade');
 await page.getByLabel('Avancement').selectOption('shaped');
 await navigate(page,'Cuisson & service');
 await expect(page.getByText(/pochez les bagels/)).toBeVisible();
 await expect(page.getByRole('heading',{name:'Assembler et servir'})).toHaveCount(0);
 await page.getByRole('button',{name:'Mon pain est cuit et refroidi',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Annuler « pain cuit »'})).toBeVisible();
 await page.goBack();await expect(page.locator('.bh-navigator-current')).toContainText('Ma fournée');
 await expect(page.getByLabel('Avancement')).toHaveValue('shaped');
 await page.goForward();await expect(page.locator('.bh-navigator-current')).toContainText('Cuisson & service');
 await page.reload();await expect(page.getByRole('button',{name:'Annuler « pain cuit »'})).toBeVisible();
 await intact(page);
});

test('a new bread entry offers resume without silently selecting the previous bagel',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Bagels',exact:true}).tap();
 await page.getByRole('spinbutton').first().fill('2');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_existing_base_v1')).base)).toBe('bagel');
 await page.goto('/fr/with-my-base?family=bread');
 await expect(page.getByRole('button',{name:'Reprendre : Bagels',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Quel pain avez-vous ?',exact:true})).toBeVisible();
 await expect(page.locator('.bh-bake-navigator-trigger')).toHaveCount(0);
 await page.getByRole('button',{name:'Reprendre : Bagels',exact:true}).tap();
 await expect(page.getByRole('spinbutton').first()).toHaveValue('2');
 await page.reload();await expect(page.getByRole('spinbutton').first()).toHaveValue('2');
 await page.goto('/fr/with-my-base?family=bread');
 const replacementDialog=page.waitForEvent('dialog');
 const chooseNewBase=page.getByRole('button',{name:'Baguette',exact:true}).tap();
 const confirmation=await replacementDialog;
 expect(confirmation.type()).toBe('confirm');
 expect(confirmation.message()).toBe('Cette nouvelle préparation remplace la reprise locale de votre base existante. Continuer ?');
 await confirmation.accept();await chooseNewBase;
 await expect(page.getByLabel('Origine')).toHaveCount(0);
 await expect(page.getByLabel('État de la base')).toHaveCount(0);
 await expect(page.getByRole('spinbutton').first()).toHaveValue('0');
 await intact(page);
});

for(const base of ['pizza','laffa'])test(`existing ${base}: finish, download and undo`,async({page})=>{
 const id=base==='pizza'?'margherita':'laffa-shawarma-poulet';
 const snapshot={familyId:'laffa',qtys:{[id]:1},completed:{},shopTicks:{},prepTicks:{},tab:'serve',ingredientOverrides:{}};
 const draft={base,portions:1,pizza:base==='pizza'?{[id]:1}:{},done:{},section:'service',sandwiches:{laffa:snapshot},details:{[base]:{kind:'baked',origin:'purchased',stage:'ready',baked:true,notes:''}}};
 await page.addInitScript(d=>{if(!sessionStorage.getItem('completion-seed')){sessionStorage.setItem('completion-seed','1');localStorage.setItem('bh_existing_base_v1',JSON.stringify(d));}},draft);
 await page.goto(`/fr/with-my-base?active=1&family=${base==='pizza'?'pizza':'bread'}&section=service`);
 const end=page.getByRole('region',{name:'Fin de la fournée',exact:true});
 await expect(end).toHaveCount(0);
 await page.getByRole('button',{name:base==='pizza'?'Une pizza cuite et servie':'Un wrap prêt',exact:true}).tap();
 await expect(end).toContainText('Tout est prêt. Bon appétit !');
 await expect(end.getByRole('button',{name:'Partager',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');
 await end.getByRole('button',{name:'Télécharger la recette',exact:true}).tap();
 expect((await download).suggestedFilename()).toBe('bakerhub-recettes.txt');
 await page.reload();await expect(end).toBeVisible();
 await page.getByRole('button',{name:base==='pizza'?'Annuler':'Annuler le dernier',exact:true}).tap();
 await expect(end).toHaveCount(0);
});

for(const base of ['pizza','laffa'])test(`existing plain ${base} can finish without a filling recipe`,async({page})=>{
 const draft={base,portions:1,pizza:{},done:{},section:'service',sandwiches:{},details:{[base]:{kind:'baked',origin:'purchased',stage:'ready',baked:true,notes:''}}};
 await page.addInitScript(d=>{if(!sessionStorage.getItem('plain-completion')){sessionStorage.setItem('plain-completion','1');localStorage.setItem('bh_existing_base_v1',JSON.stringify(d));}},draft);
 await page.goto(`/fr/with-my-base?active=1&family=${base==='pizza'?'pizza':'bread'}&section=service`);
 await page.getByRole('button',{name:'Ma base est prête à servir',exact:true}).tap();
 const end=page.getByRole('region',{name:'Fin de la fournée',exact:true});
 await expect(end).toContainText('Tout est prêt. Bon appétit !');
 await page.reload();await expect(end).toBeVisible();
 await page.getByRole('button',{name:'Annuler « fournée terminée »',exact:true}).tap();
 await expect(end).toHaveCount(0);
});
