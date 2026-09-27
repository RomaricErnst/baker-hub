const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
for(const lang of ['fr','en'])test(`${lang}: flour quantity survives setup and reload without early fillings`,async({page})=>{
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,body:'{}'}));
 await page.goto(lang==='fr'?'/fr':'/');
 await page.getByRole('button',{name:lang==='fr'?'Pain':'Bread',exact:true}).tap();
 await page.getByRole('button',{name:'Brioche',exact:true}).tap();
 await page.locator('.bh-style-confirm button').tap();
 await expect(page.locator('.bh-fillings-invitation')).toHaveCount(0);
 await page.getByRole('button',{name:lang==='fr'?'Par quantité de farine':'By flour weight',exact:true}).tap();
 const flour=page.locator('#quantity-total-flour');
 await flour.fill('750');await flour.blur();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).totalFlourTarget)).toBe(750);
 await page.reload();
 const resume=page.getByRole('button',{name:lang==='fr'?'Reprendre →':'Resume →',exact:true});
 if(await resume.isVisible())await resume.tap();
 await expect(flour).toHaveValue('750');
 await expect(page.getByRole('button',{name:lang==='fr'?'Par quantité de farine':'By flour weight',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
