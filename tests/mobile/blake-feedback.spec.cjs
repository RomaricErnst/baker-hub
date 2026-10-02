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
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null')?.totalFlourTarget)).toBe(750);
 await page.reload();
 const resume=page.getByRole('button',{name:lang==='fr'?'Reprendre →':'Resume →',exact:true});
 await expect(resume).toBeVisible();await resume.tap();
 await expect(flour).toHaveValue('750');
 await expect(page.getByRole('button',{name:lang==='fr'?'Par quantité de farine':'By flour weight',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('traditional pizza oven label stays consistent after selection',async({page})=>{
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,body:'{}'}));
 await page.goto('/fr');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Napolitaine classique',exact:true}).tap();
 await page.locator('.bh-style-confirm button').tap();
 await page.getByRole('button',{name:'Définir ma recette',exact:true}).tap();
 await page.getByRole('button',{name:/^Me laisser guider/}).tap();
 await page.getByRole('button',{name:/^Four à pizza traditionnel/}).tap();
 await page.getByRole('button',{name:'Continuer',exact:true}).tap();
 await expect(page.getByText('Four à pizza traditionnel',{exact:true})).toBeVisible();
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
 await page.getByRole('button',{name:'Modifier l’organisation et les horaires',exact:true}).tap();
 await expect(page.getByText('750 g de farine · 2 pièces',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Modifier : Mode',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Modifier : Peaufiner',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Peaufinez votre pâte',exact:true})).toBeVisible();
 await expect(page.getByLabel('Marge de pâte supplémentaire (%)',{exact:true})).toHaveCount(0);
});
