const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Round 7: About (and Privacy, Terms) opened from the menu keep a way back in the sticky header —
// below the status bar, 44 px, named "Back to Baker Hub" — and Back (header, end of page or the
// system back) returns to the very bake section the baker left, the bake intact.
const navigator=page=>page.locator('.bh-bake-navigator-trigger');
async function seed(page,locale){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const now=Date.now(),bake=now+4*86400000;
 const data={version:1,savedAt:now,tab:'simple',bakeType:'pizza',bakeName:'About audit',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null},confirmedSettings:['climate=22']};
 await page.addInitScript(data=>{
  if(sessionStorage.getItem('about-seeded'))return;
  sessionStorage.setItem('about-seeded','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));
 },data);
 await page.goto(locale==='fr'?'/fr':'/');
 await expect(navigator(page)).toBeVisible();
}
async function go(page,label,fr){
 if(await navigator(page).getAttribute('aria-expanded')!=='true')await navigator(page).tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(label,{exact:true})}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(label);
}
async function openFromMenu(page,name,path){
 await page.locator('.bh-header-menu').tap();
 const link=page.locator('#bakerhub-menu').getByRole('link',{name,exact:true});
 await expect(link).toBeVisible();
 await link.tap();
 await expect(page).toHaveURL(new RegExp(`/${path}$`));
}
async function headerBackReachable(page,fr){
 const back=page.getByRole('link',{name:fr?'Retour à Baker Hub':'Back to Baker Hub',exact:true}).first();
 await expect(back).toBeVisible();
 await expect(back).toHaveText(fr?/Retour/:/Back/);
 const box=await back.boundingBox();
 expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);
 expect(box.y).toBeGreaterThanOrEqual(0);
 // Nothing sits over it: the element at its centre is the link itself.
 expect(await back.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el.contains(hit);})).toBe(true);
 return back;
}
async function scrollToEnd(page){
 await page.evaluate(()=>window.dispatchEvent(new Event('touchstart')));
 await page.evaluate(()=>window.dispatchEvent(new Event('touchmove'))); // mobile WebKit has no mouse wheel: mark the reader's scroll as custom-equipment.spec does
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
}

for(const locale of ['en','fr'])test(`${locale}: About from the menu keeps its Back reachable, and every way back returns to the bake`,async({page})=>{
 const fr=locale==='fr';
 await seed(page,locale);
 const preparation=fr?'Préparation':'Preparation';
 await go(page,preparation,fr);
 const about=fr?'À propos de Baker Hub':'About Baker Hub';

 // 1. Header Back after scrolling.
 await openFromMenu(page,about,'about');
 await expect(page.getByRole('heading',{level:1,name:about})).toBeVisible();
 // Open the long science sections, then scroll: the header's Back stays on screen.
 await page.getByRole('button',{name:fr?'Le moteur de levain':'The sourdough engine'}).tap();
 await page.getByRole('button',{name:fr?'Le moteur de levure':'The yeast engine'}).tap();
 await scrollToEnd(page);
 await (await headerBackReachable(page,fr)).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(preparation);
 await expect(page.getByRole('heading',{level:1,name:preparation,exact:true})).toHaveCount(1);

 // 2. The end-of-page Back.
 await openFromMenu(page,about,'about');
 await scrollToEnd(page);
 await page.locator('.bh-page-back-end').tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(preparation);

 // 3. The system back (browser, Android gesture).
 await openFromMenu(page,about,'about');
 await expect(page.getByRole('heading',{level:1,name:about})).toBeVisible();
 await page.goBack();
 await expect(page.locator('.bh-navigator-current')).toContainText(preparation);

 // 4. Privacy from the menu, then About's sibling links: Back unwinds to the bake.
 await openFromMenu(page,fr?'Confidentialité':'Privacy','privacy');
 await (await headerBackReachable(page,fr)).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(preparation);
 // The bake itself is the one seeded.
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).bakeName)).toBe('About audit');
});

for(const locale of ['en','fr'])test(`${locale}: About opened directly goes home from Back, and its folded maths stay folded`,async({page})=>{
 const fr=locale==='fr';
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto(fr?'/fr/about':'/about');
 await page.getByRole('button',{name:fr?'Le moteur de levure':'The yeast engine'}).tap();
 // Plain explanation and table visible; equations under The maths.
 await expect(page.getByRole('cell',{name:fr?'0,11':'0.11',exact:true})).toBeVisible();
 const maths=page.locator('details[data-yeast-maths]').first();
 await expect(maths).not.toHaveAttribute('open','');
 await expect(page.getByText(/docs\/|github|YEAST-MODEL/i)).toHaveCount(0);
 const back=await headerBackReachable(page,fr);
 await back.tap();
 await expect(page).toHaveURL(fr?/\/fr$/:/\/$/);
});
