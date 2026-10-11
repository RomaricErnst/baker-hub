const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

async function seed(page,locale,partial,chosen=false){
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Isolated audit fixture"}'}));
 const bake=new Date();bake.setDate(bake.getDate()+4);bake.setHours(19,30,0,0);
 const data={version:1,savedAt:Date.now(),bakeName:'AUDIT isolated coverage',tab:'simple',bakeType:'pizza',styleKey:'neapolitan',numItems:partial?24:2,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefOffsetH:0,flourInFridge:false,startTime:+bake-24*3600000,eatTime:+bake,blocks:[],recipeGenerated:true,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:99,advancedStep:99,highestStep:99,advancedHighestStep:99,setupOverview:false,activeTab:partial?'service':'plan',pizzaParty:{qtys:partial?{margherita:2}:{},bakedQtys:{},tab:partial?'bake':'pick'},navigation:{batchView:'style',protocolView:'fillings',serviceView:'fillings',returnTo:null}};
 data.flourChosen=chosen;
 await page.addInitScript(data=>{
  if(sessionStorage.getItem('audit-production-fixture'))return;
  sessionStorage.setItem('audit-production-fixture','1');
  localStorage.setItem('bh_session_v1',JSON.stringify(data));
  sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:99,advancedStep:99,activeTab:data.activeTab,setupOverview:false,navigation:data.navigation}));
 },data);
 await page.goto(locale==='fr'?'/fr':'/');
}

async function navigate(page,name,locale){
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:locale==='fr'?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(name,{exact:true})}).tap();
}

for(const locale of ['fr','en']){
 for(const chosen of [false,true])test(`${locale}: ${chosen?'selected':'recommended'} flour is named in recipe and shopping`,async({page})=>{
  await seed(page,locale,false,chosen);
  const flour=locale==='fr'?'Farine à pizza 00':chosen?'Pizza flour 00':'00 pizza flour';
  await expect(page.getByText(new RegExp(flour)).filter({visible:true}).first()).toBeVisible();
  await navigate(page,locale==='fr'?'Courses':'Shopping list',locale);
  await expect(page.getByText(new RegExp(flour)).filter({visible:true}).first()).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
 test(`${locale}: partial toppings are disclosed before cooking and throughout preparation`,async({page})=>{
  await seed(page,locale,true);
  const visible=()=>page.locator('[data-testid="selection-coverage"]:visible');
  const coverage=locale==='fr'?'Garnitures pour 2 pizzas sur 24.':'Toppings for 2 of 24 pizzas.';
  await expect(visible()).toContainText(coverage);
  await expect(visible()).toContainText('22');
  await expect(page.getByText(locale==='fr'?'Tout est prêt. Bon appétit !':'Everything is ready. Enjoy!',{exact:true})).toHaveCount(0);
  await navigate(page,locale==='fr'?'Courses':'Shopping list',locale);
  await expect(visible()).toContainText(coverage);
  await navigate(page,locale==='fr'?'Préparation':'Preparation',locale);
  await expect(visible()).toContainText(coverage);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}
