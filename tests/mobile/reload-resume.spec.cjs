const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// A reload in the middle of a generated bake reopens it where it was; a new
// visit to the landing still offers the Resume card.
const navigator=page=>page.locator('.bh-bake-navigator-trigger');
const resumeCard=(page,fr)=>page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true});
async function seed(page,locale){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const now=Date.now(),bake=now+4*86400000;
 const data={version:1,savedAt:now,tab:'simple',bakeType:'pizza',bakeName:'Reload audit',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null},confirmedSettings:['climate=22']};
 await page.addInitScript(data=>{
  if(sessionStorage.getItem('reload-seeded'))return;
  sessionStorage.setItem('reload-seeded','1');
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

for(const locale of ['fr','en'])test(`${locale}: reload on a bake destination reopens it, Back still works, a new visit offers Resume`,async({page,context})=>{
 const fr=locale==='fr';
 await seed(page,locale);
 const preparation=fr?'Préparation':'Preparation',shopping=fr?'Courses':'Shopping list';
 await go(page,shopping,fr);
 await go(page,preparation,fr);
 await page.reload();
 await expect(navigator(page)).toBeVisible();
 await expect(page.locator('.bh-navigator-current')).toContainText(preparation);
 await expect(resumeCard(page,fr)).toHaveCount(0);
 await expect(page.getByRole('heading',{level:1,name:'Reload audit',exact:true})).toHaveCount(1);
 // Back replays the entry before the reload.
 await page.goBack();
 await expect(page.locator('.bh-navigator-current')).toContainText(shopping);
 // A new visit (a new tab, no history entry) is not a reload mid-bake: the bake waits behind Resume.
 const visit=await context.newPage();
 await visit.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await visit.goto(fr?'/fr':'/');
 await expect(resumeCard(visit,fr)).toBeVisible();
 await expect(navigator(visit)).toHaveCount(0);
 // The same holds after a reload on the landing itself.
 await visit.reload();
 await expect(resumeCard(visit,fr)).toBeVisible();
});
