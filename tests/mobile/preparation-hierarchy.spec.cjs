const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

async function anonymous(page){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous hierarchy test"}'}));
}
async function navigate(page,label){
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:'Votre fournée',exact:true}).getByRole('button').filter({has:page.getByText(label,{exact:true})}).tap();
}
for(const scenario of [
 {style:'neapolitan',bread:false,total:2,oven:'pizza_oven',hours:24,weight:260},
 {style:'baguette',bread:true,total:3,oven:'standard_bread',hours:24,weight:250},
 {style:'bagel',bread:true,total:4,oven:'standard_bread',hours:6,weight:110},
 {style:'piadina',bread:true,total:2,oven:'griddle',hours:1,weight:140},
])test(`${scenario.style}: cooking has one local phase counter and overview toggle`,async({page})=>{
 await anonymous(page);
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(18,0,0,0);
 const data={version:1,savedAt:Date.now(),tab:'custom',bakeType:scenario.bread?'bread':'pizza',styleKey:scenario.style,numItems:4,itemWeight:scenario.weight,pizzaDiameter:30,ovenType:scenario.oven,mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:+bake-scenario.hours*3600000,eatTime:+bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'service',navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null}};
 await page.addInitScript(data=>{
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,activeTab:'service',setupOverview:false,reviewMode:true,navigation:data.navigation}));
 },data);
 await page.goto('/fr');
 const progress=page.locator('.bh-local-progress .bh-step-trigger');
 await expect(progress).toHaveCount(1);
 await expect(progress).toHaveText(`Étape 1 / ${scenario.total}`);
 await expect(page.locator('.bh-bake-navigator .bh-step-trigger')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Étapes de cuisson',exact:true})).toHaveCount(1);
 await progress.tap();
 await expect(progress).toHaveText('Reprendre');
 await expect(page.locator('section[data-guide-phase="cooking"]:visible')).toHaveCount(scenario.total);
 await progress.tap();
 await expect(progress).toHaveText(`Étape 1 / ${scenario.total}`);
 await expect(page.locator('section[data-guide-phase="cooking"]:visible')).toHaveCount(1);
});

test('existing pizza: late selection returns to service after reload and preparation has one forward action',async({page})=>{
 await anonymous(page);
 const draft={base:'pizza',portions:4,pizza:{margherita:2},done:{margherita:1},section:'service',sandwiches:{},details:{pizza:{kind:'dough',origin:'purchased',stage:'ready',baked:false,notes:''}}};
 await page.addInitScript(draft=>{
  if(sessionStorage.getItem('hierarchy-base-seeded'))return;
  sessionStorage.setItem('hierarchy-base-seeded','1');localStorage.setItem('bh_existing_base_v1',JSON.stringify(draft));
 },draft);
 await page.goto('/fr/with-my-base?active=1&family=pizza&section=service');
 await navigate(page,'Ma fournée');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_existing_base_v1')).selectionReturn)).toBe('service');
 await page.reload();
 // Optional summary must honor the same late-return destination as direct confirmation.
 await page.getByRole('button',{name:'Ma sélection · 2',exact:true}).tap();
 await page.getByRole('button',{name:'Valider et revenir à la cuisson et au service',exact:true}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText('Cuisson & service');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_existing_base_v1')).done.margherita)).toBe(1);
 await page.getByRole('button',{name:'Préparer les garnitures',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Cuire les pizzas →',exact:true})).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Cuisson & service →',exact:true})).toHaveCount(0);
});
