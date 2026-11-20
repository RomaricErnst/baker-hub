const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 7 (owner, 20 Nov 2026): the "Your bake" sheet sums My bake up in one headline line (option A),
// and the Recipe reads whole dough first, then a smaller breakdown by stage. Custom's % column is one
// aligned column; Simple has none. Checked at 320 px in EN and FR.
test.use({timezoneId:'Asia/Singapore',viewport:{width:320,height:568}});
const NOW=Date.parse('2026-11-20T15:25:00+08:00');
const BAKE=Date.parse('2026-11-22T19:00:00+08:00');
function seed(tab,pref,extra={}){
 return {version:1,savedAt:NOW,tab,bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:6,
  flourBlend:{flour1:'pizza00',flour2:'manitoba',ratio1:85},manualHydration:62,manualSalt:2.8,manualOil:0,manualSugar:0,prefermentType:pref,prefermentFlourPct:20,
  eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:true,activeTab:'setup',...extra};
}
const GENERATED={recipeGenerated:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'recipe',
 startTime:Date.parse('2026-11-21T11:45:00+08:00'),prefOffsetH:13,prefGoesInFridge:true,flourInFridge:false};
async function open(page,data,fr){
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(data=>{if(sessionStorage.getItem('r7-seeded'))return;sessionStorage.setItem('r7-seeded','1');localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:data.activeStep,advancedStep:data.advancedStep,setupOverview:data.setupOverview,activeTab:data.activeTab,reviewMode:true}));},data);
 await page.goto(fr?'/fr':'/');
 const resume=page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true});
 if(await resume.isVisible().catch(()=>false))await resume.tap();
}
async function toRecipe(page,fr){
 const name=page.locator('.bh-navigator-name');
 await expect(name).toBeVisible();
 if((await name.textContent())?.trim()===(fr?'Recette':'Recipe'))return;
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button',{name:fr?/^Recette/:/^Recipe/}).first().tap();
 await expect(name).toHaveText(fr?'Recette':'Recipe');
}
async function noOverflow(page){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}

for(const fr of [false,true]){
 const L=(en,f)=>fr?f:en;
 test(`${fr?'fr':'en'}: Your bake sums My bake up in one line, See all opens the grouped list`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,seed('custom','poolish'),fr);
  await page.locator('.bh-bake-navigator-trigger').tap();
  const sheet=page.getByRole('dialog',{name:L('Your bake','Votre fournée')});
  const headline=sheet.locator('[data-journey-headline]');
  await expect(headline).toHaveText(L('4 Neapolitan pizzas · Sun 22 Nov, 7:00pm',/^4 pizzas napolitaines · dim\. 22 nov\. à 19h00$/));
  // The bar names the step; the card has no step label and no comma list of every answer.
  const myBake=sheet.locator('li.is-current');
  await expect(myBake).not.toContainText(L('Fine-tune','Peaufiner'));
  await expect(myBake).not.toContainText(L('Your choices','Vos choix'));
  await expect(myBake).not.toContainText(L('hydration','hydratation'));
  // The bake time is set: the Recipe waits for "Create my recipe", not for the bake time.
  await expect(sheet.locator('#bh-journey-sub-recipe')).toHaveText(L('Ready when you create your recipe','Prête quand vous créez votre recette'));
  await noOverflow(page);
  await sheet.locator('.bh-journey-choices').tap();
  await expect(sheet.getByRole('button',{name:L(/^The basics/,/^Les bases/)})).toBeVisible();
  await expect(sheet.getByRole('button',{name:L(/^Customize/,/^Personnaliser/)})).toBeVisible();
  expect(errors).toEqual([]);
 });

 test(`${fr?'fr':'en'}: Custom recipe — summary led by the day, whole dough first, one aligned % column`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,seed('custom','poolish',GENERATED),fr);
  await toRecipe(page,fr);
  await expect(page.locator('[data-bake-summary]')).toHaveText(L(/^Sun 22 Nov · 7:00pm · 4 × \d+ g Neapolitan$/,/^dim\. 22 nov\. · 19h00 · 4 pizzas napolitaines de \d+\s?g$/));
  await expect(page.locator('[data-recipe-when]')).toHaveCount(0);
  const whole=page.locator('[data-whole-dough]:visible'),stages=page.locator('[data-recipe-stages]:visible');
  await expect(whole).toBeVisible();await expect(stages).toBeVisible();
  expect((await whole.boundingBox()).y).toBeLessThan((await stages.boundingBox()).y);
  await expect(page.locator('.bh-recipe-output:visible')).not.toContainText(L(/Of which|selected blend|Poolish total|Remaining water|all of it/,/Dont farine|mélange choisi|Total poolish|Eau restante|tout entier/));
  await expect(stages.locator('[data-stage="preferment"] h3')).toHaveText('Poolish');
  await expect(stages.locator('[data-stage="final"] h3')).toHaveText(L('Final dough','Pâte finale'));
  // One % column: every % cell, in the whole dough and in each stage, ends at the same x (±1 px), on one line.
  const cells=page.locator('.bh-recipe-output:visible [data-pct]');
  const boxes=await cells.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {right:r.right,height:r.height,text:el.textContent};}));
  expect(boxes.filter(b=>b.text).length).toBeGreaterThan(8);
  const right=boxes[0].right;
  for(const b of boxes){expect(Math.abs(b.right-right),JSON.stringify(b)).toBeLessThanOrEqual(1);expect(b.height,JSON.stringify(b)).toBeLessThan(24);}
  // The header sits over the two columns, on one line.
  const header=await page.locator('.bh-recipe-output:visible [data-pct-header]').evaluate(el=>{const [,pct,weight]=el.children;return {pct:pct.getBoundingClientRect().right,height:el.getBoundingClientRect().height,weight:weight.getBoundingClientRect().right};});
  expect(Math.abs(header.pct-right)).toBeLessThanOrEqual(1);
  expect(header.height).toBeLessThan(24);
  const grams=await page.locator('.bh-recipe-output:visible [data-grams]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().right));
  for(const g of grams)expect(Math.abs(g-header.weight)).toBeLessThanOrEqual(1);
  await noOverflow(page);
  expect(errors).toEqual([]);
 });

 test(`${fr?'fr':'en'}: Simple recipe — same order, grams only`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await open(page,seed('simple','poolish',GENERATED),fr);
  await toRecipe(page,fr);
  const whole=page.locator('[data-whole-dough]:visible'),stages=page.locator('[data-recipe-stages]:visible');
  await expect(whole).toBeVisible();await expect(stages).toBeVisible();
  expect((await whole.boundingBox()).y).toBeLessThan((await stages.boundingBox()).y);
  await expect(page.locator('.bh-recipe-output:visible [data-pct]')).toHaveCount(0);
  await expect(page.locator('.bh-recipe-output:visible [data-pct-header]')).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
 });
}
