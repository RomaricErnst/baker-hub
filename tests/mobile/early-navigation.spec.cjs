const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

const bottom=page=>page.locator('#bh-bottom-nav');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
async function anonymous(page){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous navigation test"}'}));
}
async function twoDestinations(page,fr,companion){
 await expect(bottom(page)).toBeVisible();
 await expect(bottom(page).getByRole('button')).toHaveText([fr?'Ma pâte':'My dough',companion]);
 const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0;}).slice(-12).map(el=>({tag:el.tagName,text:el.textContent.slice(0,100),right:el.getBoundingClientRect().right})));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth),JSON.stringify(overflow)).toBeLessThanOrEqual(page.viewportSize().width);
}
async function revealNavigation(page){
 const reveal=page.getByRole('button',{name:'Navigation',exact:true});
 if(await reveal.isVisible())await reveal.tap();
}
async function actionAboveNavigation(page){
 const action=page.locator('.bh-step-page:visible .bh-step-actions button').last();
 await action.scrollIntoViewIfNeeded();
 await expect(action).toBeVisible();
 await expect.poll(async()=>{
  const [a,n]=await Promise.all([action.boundingBox(),bottom(page).boundingBox()]);
  return !!a&&!!n&&a.y+a.height<=n.y+1&&a.y>=0;
 }).toBe(true);
}

for(const fr of [false,true]){
 test(`${fr?'fr':'en'}: pizza browsing is reachable before mode, with two stable destinations`,async({page})=>{
  await anonymous(page);await page.goto(fr?'/fr':'/');
  await expect(bottom(page)).toBeHidden();
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await twoDestinations(page,fr,'Pizzas');
  const mode=page.getByRole('heading',{name:fr?'À votre façon':'Your way',exact:true});
  await expect(mode).toBeVisible();
  await bottom(page).getByRole('button',{name:'Pizzas',exact:true}).tap();
  await expect(mode).toBeHidden();
  await expect(page.getByRole('navigation',{name:fr?'Étapes des pizzas':'Pizza steps',exact:true})).toBeVisible();
  await bottom(page).getByRole('button',{name:fr?'Ma pâte':'My dough',exact:true}).tap();
  await expect(mode).toBeVisible();
  await twoDestinations(page,fr,'Pizzas');
 });
}

test('early bread selections survive mode choice, matching bread style and later setup navigation',async({page},testInfo)=>{
 await anonymous(page);await page.goto('/');
 await page.getByRole('button',{name:'Bread',exact:true}).tap();
 await expect(bottom(page)).toBeHidden();
 await page.getByRole('button',{name:/^Simple\b/}).tap();
 await expect(bottom(page)).toBeHidden();
 await page.getByRole('button',{name:/^Baguette\b/}).tap();
 await twoDestinations(page,false,'Fillings');
 await bottom(page).getByRole('button',{name:'Fillings',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Which bread will you fill?',exact:true})).toHaveCount(0);
 const quantity=page.getByRole('spinbutton',{name:/^Quantity /}).first();
 const quantityName=await quantity.getAttribute('aria-label');
 await quantity.fill('2');await quantity.blur();
 await expect.poll(async()=>Object.values((await stored(page))?.sandwichParty?.qtys??{})).toEqual([2]);
 expect((await stored(page)).styleKey).toBe('baguette');
 await revealNavigation(page);
 await bottom(page).getByRole('button',{name:'My dough',exact:true}).tap();
 await expect(page.getByRole('button',{name:/^Baguette\b/})).toBeVisible();
 await actionAboveNavigation(page);
 await page.locator('.bh-step-page:visible').getByRole('button',{name:'Continue',exact:true}).tap();
 await expect(page.getByLabel('Number of loaves',{exact:true})).toBeVisible();
 await page.getByLabel('Number of loaves',{exact:true}).fill('5');
 await page.getByLabel('Number of loaves',{exact:true}).blur();
 await bottom(page).getByRole('button',{name:'Fillings',exact:true}).tap();
 await expect(page.getByRole('spinbutton',{name:quantityName,exact:true})).toHaveValue('2');
 await revealNavigation(page);
 await bottom(page).getByRole('button',{name:'My dough',exact:true}).tap();
 await expect(page.getByLabel('Number of loaves',{exact:true})).toHaveValue('5');
 await actionAboveNavigation(page);
 await twoDestinations(page,false,'Fillings');
 await testInfo.attach('setup-actions-above-two-tabs',{body:await page.screenshot(),contentType:'image/png'});
});

test('generated dough uses local phases and returns to Recipe after browsing fillings',async({page})=>{
 await anonymous(page);
 const bake=Date.now()+4*24*3600000;
 const session={version:1,savedAt:Date.now(),tab:'custom',bakeType:'bread',styleKey:'bagel',numItems:6,itemWeight:110,pizzaDiameter:30,ovenType:'standard_bread',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-6*3600000,eatTime:bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan'};
 await page.addInitScript(data=>{
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));
 },session);
 await page.goto('/fr');
 await twoDestinations(page,true,'Garnitures');
 const phases=page.getByRole('navigation',{name:'Votre pâte',exact:true});
 await expect(phases.getByRole('button')).toHaveText(['Plan','Recette','Protocole']);
 await expect(phases.getByRole('button',{name:'Recette',exact:true})).toHaveAttribute('aria-current','step');
 await bottom(page).getByRole('button',{name:'Garnitures',exact:true}).tap();
 await expect(phases).toBeHidden();
 await bottom(page).getByRole('button',{name:'Ma pâte',exact:true}).tap();
 await expect(phases.getByRole('button',{name:'Recette',exact:true})).toHaveAttribute('aria-current','step');
 await twoDestinations(page,true,'Garnitures');
});

test('Safari companion scrolling hides chrome, preserves phase access and reveals navigation',async({page},testInfo)=>{
 await anonymous(page);await page.goto('/fr');
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 await expect(bottom(page)).toBeHidden();
 await page.getByRole('button',{name:/^Simple\b/}).tap();
 await page.getByRole('button',{name:/^Baguette\b/}).tap();
 await bottom(page).getByRole('button',{name:'Garnitures',exact:true}).tap();
 await expect(page.getByRole('article').first()).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,450));
 await expect.poll(async()=>{
  const [nav,header]=await Promise.all([bottom(page).boundingBox(),page.locator('header.bh-header').boundingBox()]);
  return !!nav&&!!header&&nav.y>=page.viewportSize().height-1&&header.y+header.height<=1;
 }).toBe(true);
 const phases=page.getByRole('navigation',{name:'Étapes des sandwichs',exact:true});
 await expect(phases).toBeVisible();
 const reveal=page.getByRole('button',{name:'Navigation',exact:true});
 await expect(reveal).toBeVisible();
 expect((await reveal.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await testInfo.attach('safari-reading-chrome-hidden',{body:await page.screenshot(),contentType:'image/png'});
 const before=await page.evaluate(()=>window.scrollY);
 await reveal.tap();
 await expect.poll(async()=>{
  const nav=await bottom(page).boundingBox();
  return !!nav&&nav.height>=60&&nav.y+nav.height<=page.viewportSize().height+1;
 }).toBe(true);
 expect(Math.abs((await page.evaluate(()=>window.scrollY))-before)).toBeLessThanOrEqual(1);
 await page.evaluate(()=>window.scrollBy(0,160));
 await expect.poll(async()=>(await bottom(page).boundingBox()).y).toBeGreaterThanOrEqual(page.viewportSize().height-1);
 await page.evaluate(()=>window.scrollBy(0,-60));
 await expect.poll(async()=>{
  const nav=await bottom(page).boundingBox();
  return nav.height>=60&&nav.y+nav.height<=page.viewportSize().height+1;
 }).toBe(true);
 await expect.poll(async()=>(await page.locator('header.bh-header').boundingBox()).y).toBeGreaterThanOrEqual(0);
 await testInfo.attach('safari-upward-scroll-navigation-visible',{body:await page.screenshot(),contentType:'image/png'});
 await bottom(page).getByRole('button',{name:'Ma pâte',exact:true}).tap();
 await page.evaluate(()=>window.scrollTo(0,450));
 await actionAboveNavigation(page);
 await twoDestinations(page,true,'Garnitures');
});

for(const style of ['Pain de campagne','Pain complet']) test(`${style}: chosen loaf opens tartines without a second bread choice`,async({page},testInfo)=>{
 await anonymous(page); await page.goto('/fr');
 await page.getByRole('button',{name:'Pain',exact:true}).tap();
 await expect(bottom(page)).toBeHidden();
 await page.getByRole('button',{name:/^Simple\b/}).tap();
 await page.getByRole('button',{name:new RegExp('^'+style+'\\b')}).tap();
 await bottom(page).getByRole('button',{name:'Garnitures',exact:true}).tap();
 await expect(page.getByRole('heading',{name:'Vos tartines',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Quel pain/})).toHaveCount(0);
 const avocado=page.getByRole('article').filter({hasText:'Avocat'}).first();
 await expect(avocado).toContainText(/œuf/);
 await avocado.getByRole('spinbutton').fill('2');
 await avocado.getByRole('button',{name:'Recette et garnitures',exact:true}).tap();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toContainText(style);
 await expect(dialog).toContainText('60 g');
 await expect(dialog).toContainText(/tartine/);
 await testInfo.attach('tartine-selected-loaf',{body:await dialog.screenshot(),contentType:'image/png'});
 await dialog.getByRole('button',{name:'Terminé',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Voir ma sélection · 2',exact:true})).toBeVisible();
});
