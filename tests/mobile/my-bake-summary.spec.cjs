const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// My bake: proposed values are named once, names read in sentence case, the
// starter answer replaces the method on levain breads, and weights follow the units.
const navigator=page=>page.locator('.bh-bake-navigator-trigger');
async function seed(page,{locale='fr',mode='simple',bread=false,style,extra={},units}={}){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 const now=Date.now(),bake=now+4*86400000;
 const data={version:1,savedAt:now,tab:mode,bakeType:bread?'bread':'pizza',bakeName:'Summary audit',styleKey:style||(bread?'baguette':'neapolitan'),numItems:2,itemWeight:bread?600:260,pizzaDiameter:30,ovenType:bread?'standard_bread':'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:6,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:true,activeTab:'batch',navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null},confirmedSettings:['climate=22'],...extra};
 await page.addInitScript(({data,units})=>{
  if(sessionStorage.getItem('summary-seeded'))return;
  sessionStorage.setItem('summary-seeded','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  if(units)localStorage.setItem('bh_units',units);
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));
 },{data,units});
 await page.goto(locale==='fr'?'/fr':'/');
 await expect(navigator(page)).toBeVisible();
 if(await navigator(page).getAttribute('aria-expanded')!=='true')await navigator(page).tap();
 await page.getByRole('navigation',{name:locale==='fr'?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(locale==='fr'?'Ma fournée':'My bake',{exact:true})}).tap();
 await expect(page.getByRole('heading',{level:1,name:locale==='fr'?'Revoir mes choix':'Review my choices',exact:true})).toBeVisible();
}

test('fr Simple: one note for proposed values, sentence-case names',async({page})=>{
 await seed(page);
 const main=page.locator('body');
 await expect(page.locator('[data-suggested-note]')).toHaveText('Valeurs proposées : four, pétrissage, levure. Touchez Modifier pour choisir les vôtres.');
 await expect(main).not.toContainText('· valeur proposée');
 await expect(main).toContainText('Four domestique standard · À la main · Réfrigérateur 6°C · Levure sèche instantanée');
 await expect(main).toContainText('2 × 260 g');
});

test('en Simple: chosen values drop out of the note; imperial quantity',async({page})=>{
 await seed(page,{locale:'en',units:'imperial',extra:{confirmedSettings:['climate=22','oven=home_oven_standard','mixer=hand']}});
 await expect(page.locator('[data-suggested-note]')).toHaveText('Suggested values: yeast. Tap Edit to choose your own.');
 await expect(page.locator('body')).toContainText('2 × 9.2 oz');
 await expect(page.locator('body')).not.toContainText('× 260 g');
});

test('fr Custom levain bread: the Levain row shows the starter answer',async({page})=>{
 const fed=Date.now()-20*3600000;
 await seed(page,{mode:'custom',bread:true,style:'pain_levain',extra:{yeastType:'sourdough',prefermentType:'levain',itemWeight:800,numItems:1,starterLocation:'rt',lastFedAge:'yesterday',lastFedTime:fed,planningMode:'last_fed'}});
 const row=page.locator('body div').filter({has:page.getByRole('button',{name:'Modifier : Levain',exact:true})}).last();
 await expect(row).not.toContainText('valeur proposée');
 await expect(row).toContainText('rafraîchi hier');
 await expect(page.locator('[data-suggested-note]')).not.toContainText('levain');
});
