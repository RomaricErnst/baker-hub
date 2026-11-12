const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// One visible H1 per view, and arrival focus (usePageTop) lands on it.
const navigator=page=>page.locator('.bh-bake-navigator-trigger');
async function anonymous(page){
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
}
async function oneTitle(page,name,focus=true){
 const h1=page.locator('h1:visible');
 await expect(h1).toHaveCount(1);
 if(name)await expect(h1).toHaveText(name);
 if(focus)await expect.poll(()=>page.evaluate(()=>document.activeElement?.tagName==='H1'&&document.activeElement.classList.contains('bh-page-title'))).toBe(true);
}
async function seed(page,{bread=false,mode='simple',locale='en',style}={}){
 await anonymous(page);
 const now=Date.now(),bake=now+4*86400000;
 const data={version:1,savedAt:now,tab:mode,bakeType:bread?'bread':'pizza',bakeName:'Heading audit',styleKey:style||(bread?'baguette':'neapolitan'),numItems:2,itemWeight:bread?250:(style==='pan'?600:260),pizzaDiameter:30,ovenType:bread?'standard_bread':'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'medium',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},prefermentType:'none',prefermentFlourPct:20,prefOffsetH:0,prefGoesInFridge:false,flourInFridge:false,startTime:bake-24*3600000,eatTime:bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:'plan',navigation:{batchView:'style',protocolView:'dough',serviceView:'dough',returnTo:null},sandwichParty:{familyId:bread?'baguette':'neapolitan',qtys:{},completed:{},shopTicks:{},prepTicks:{},tab:'pick',ingredientOverrides:{}}};
 await page.addInitScript(data=>{
  if(sessionStorage.getItem('headings-seeded'))return;
  sessionStorage.setItem('headings-seeded','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,setupOverview:false,activeTab:'plan',reviewMode:true}));
 },data);
 await page.goto(locale==='fr'?'/fr':'/');
 await expect(navigator(page)).toBeVisible();
}
async function go(page,label,locale){
 await navigator(page).scrollIntoViewIfNeeded();
 if(await navigator(page).getAttribute('aria-expanded')!=='true')await navigator(page).tap();
 const nav=page.getByRole('navigation',{name:locale==='fr'?'Votre fournée':'Your bake',exact:true});
 const dough=nav.getByRole('button',{name:locale==='fr'?'Pâte':'Dough',exact:true});
 if((label==='Recette'||label==='Recipe')&&await dough.count())await dough.tap();
 else await nav.getByRole('button').filter({has:page.getByText(label,{exact:true})}).tap();
 await expect(page.locator('.bh-navigator-current')).toContainText(label);
}

for(const bread of [false,true])test(`generated ${bread?'bread':'pizza'} views each have one H1`,async({page})=>{
 await seed(page,{bread});
 await go(page,'Preparation','en');await oneTitle(page,'Heading audit');
 await go(page,'Recipe','en');await oneTitle(page,'Heading audit');
 await go(page,'Baking & serving','en');await oneTitle(page,'Heading audit');
 await expect(page.getByRole('heading',{level:2,name:'Baking & serving',exact:true})).toHaveCount(1);
 await go(page,'Shopping list','en');await oneTitle(page,bread?'Heading audit':'Shopping list');
 await go(page,'My bake','en');await oneTitle(page,'Review my choices');
});

for(const locale of ['en','fr'])test(`${locale}: Simple setup steps start at one H1 and the tray pizza says what one pizza is`,async({page})=>{
 const fr=locale==='fr';
 await anonymous(page);
 await page.goto(fr?'/fr':'/');
 // The landing heading is not a page-arrival target.
 await oneTitle(page,undefined,false);
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await oneTitle(page,fr?'Quel style de pizza ?':'Which pizza style?');
 await page.getByRole('button',{name:fr?/^Pizza en moule|^Pan/:'Pan pizza'}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^(Quantity|Quantité) →$/}).tap();
 await oneTitle(page,fr?'Quelle quantité de pâte ?':'How much dough?');
 await expect(page.locator('[data-each-pizza]:visible')).toHaveText(fr?/^Chaque pizza : \d+\s?g dans un moule d’environ \d+ × \d+ cm · Ajuster$/:/^Each pizza: \d+ g in a pan of about \d+ × \d+ cm · Adjust$/);
});

test('recipe card repeats the pan size, and follows imperial units',async({page})=>{
 await page.addInitScript(()=>{try{localStorage.setItem('bh_units','imperial');}catch{}});
 await seed(page,{style:'pan'});
 await go(page,'Recipe','en');
 await expect(page.locator('.bh-bake-context [data-each-pizza]')).toHaveText(/^Each pizza: \d+(\.\d)? oz in a pan of about \d+ × \d+ in$/);
});
