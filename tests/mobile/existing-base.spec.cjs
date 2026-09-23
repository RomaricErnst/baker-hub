const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
async function open(page){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous journey test"}'}));
 await page.goto('/fr/with-my-base');
 await page.evaluate(()=>localStorage.setItem('bh_session_v1','{"test":"homemade draft preserved"}'));
}
async function intact(page){
 expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe('{"test":"homemade draft preserved"}');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}
test('existing bread keeps optional garnishes and shopping through reload without touching homemade draft',async({page})=>{
 await open(page);
 await page.getByRole('button',{name:'Pain en tranches · tartines',exact:true}).tap();
 await page.getByRole('button',{name:'Voir la recette Avocat, œuf poché et feta',exact:true}).tap();
 const dialog=page.getByRole('dialog');
 const extra=dialog.getByRole('checkbox',{name:/Graines de grenade/});
 await expect(extra).not.toBeChecked();await extra.check();
 await dialog.getByRole('spinbutton',{name:'Quantité Avocat, œuf poché et feta',exact:true}).fill('2');
 await dialog.getByRole('button',{name:'Terminé',exact:true}).tap();
 await page.getByRole('button',{name:'Courses',exact:true}).tap();
 const row=page.locator('label').filter({hasText:'Graines de grenade'});
 await expect(row).toContainText('30 g');await row.getByRole('checkbox').check();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_existing_base_v1')).sandwiches.pain_campagne.tab)).toBe('shop');
 await page.reload();await expect(row.getByRole('checkbox')).toBeChecked();
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Préparez les garnitures',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Passer à l’assemblage →',exact:true}).tap();
 await page.getByRole('button',{name:'Une tartine prête',exact:true}).tap();
 await intact(page);
});
test('purchased pizza skips dough setup and persists served count',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Pâte à pizza',exact:true}).tap();
 const pizza=page.getByRole('button',{name:'Margherita',exact:true});await pizza.getByRole('button',{name:'+',exact:true}).tap();
 await page.getByRole('button',{name:'Courses',exact:true}).tap();
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await page.getByRole('button',{name:'Cuire et servir',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Cuire votre pâte achetée',exact:true})).toBeVisible();
 await expect(page.getByText(/Suivez l’emballage/)).toBeVisible();
 await page.getByRole('button',{name:'Une pizza servie',exact:true}).tap();
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
 await page.getByRole('button',{name:'Courses',exact:true}).tap();
 await expect(page.locator('label').filter({hasText:'Lait demi-écrémé'})).toBeVisible();
 await page.getByRole('button',{name:'Préparer les garnitures →',exact:true}).tap();
 await expect(page.getByText(/béchamel/i).first()).toBeVisible();
 await page.getByRole('button',{name:'Passer à l’assemblage →',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Assembler et servir',exact:true})).toBeVisible();
 await expect(page.locator('ol').filter({hasText:/180/})).toBeVisible();
 await page.getByRole('button',{name:'Un sandwich prêt',exact:true}).first().tap();
 await page.reload();await expect(page.getByRole('heading',{name:'Assembler et servir',exact:true})).toBeVisible();await intact(page);
});
