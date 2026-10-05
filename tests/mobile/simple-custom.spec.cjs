const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const BAKE=Date.parse('2026-10-04T20:31:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const actions=page=>page.locator('.bh-step-actions:visible');
async function anonymous(page){
 await page.clock.setFixedTime(NOW);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
}
async function geometry(page){
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(actions(page)).toHaveCount(1);
 await expect(actions(page)).toHaveCSS('position','fixed');
 const button=actions(page).getByRole('button').last();
 const rect=await button.boundingBox();
 expect(rect.height).toBeGreaterThanOrEqual(44);
 expect(rect.y+rect.height).toBeLessThanOrEqual(page.viewportSize().height);
}
async function nextToRecipe(page,fr){
 const plan=page.getByRole('region',{name:fr?'Vos moments clés':'Your key times',exact:true});
 await expect(plan).toBeVisible();
 const create=actions(page).getByRole('button',{name:fr?'Créer ma recette':'Create my recipe',exact:true});
 await expect(create).toBeEnabled();
 await create.tap();
 await expect(page.locator('.bh-navigator-current')).toHaveText(fr?'Recette':'Recipe');
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
}

for(const locale of ['fr','en']){
 const fr=locale==='fr';
 test(`${locale}: fresh Simple pizza uses one kitchen confirmation before its plan and recipe`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await anonymous(page);await page.goto(fr?'/fr':'/');
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  await page.getByRole('button',{name:fr?'Napolitaine classique':'Classic Neapolitan',exact:true}).tap();
  await page.locator('.bh-style-confirm button').tap();
  const quantity=page.getByLabel(fr?'Nombre de pizzas':'Number of pizzas',{exact:true});
  await quantity.fill('4');await quantity.blur();
  await actions(page).getByRole('button',{name:fr?'Définir ma recette':'Set up my recipe',exact:true}).tap();
  await page.getByRole('button',{name:/^Simple\b/}).tap();
  await expect(page.getByRole('heading',{name:fr?'Votre cuisine':'Your kitchen',exact:true})).toBeVisible();
  const cooking=page.locator('details').filter({has:page.locator('summary').filter({hasText:fr?/^Cuisson ·/:/^Cooking ·/})}).first();
  const mixing=page.locator('details').filter({has:page.locator('summary').filter({hasText:fr?/^Pétrissage ·/:/^Mixing ·/})}).first();
  await expect(cooking).not.toHaveAttribute('open','');
  await expect(mixing).not.toHaveAttribute('open','');
  await expect(page.getByText(/Advanced settings · fridge and flour|Réglages avancés · frigo et farine/)).toHaveCount(0);
  await expect(page.getByText(/Usual flour-storage humidity|Humidité habituelle du stockage/)).toHaveCount(0);
  // DecisionList's accessible name also includes its explanatory tagline.
  await page.getByRole('button',{name:fr?/^Levure sèche instantanée/:/^Instant dry yeast/}).tap();
  await expect.poll(async()=>({oven:(await stored(page))?.ovenType,mixer:(await stored(page))?.mixerType,yeast:(await stored(page))?.yeastType})).toEqual({oven:'home_oven_standard',mixer:'hand',yeast:'instant'});
  await geometry(page);
  await actions(page).getByRole('button',{name:fr?'Continuer':'Continue',exact:true}).tap();
  const bakeDate=page.getByLabel(fr?'Date d’enfournement':'Baking date',{exact:true});
  await bakeDate.fill('2026-10-04');await bakeDate.blur();
  await nextToRecipe(page,fr);
  expect(errors).toEqual([]);
 });

 test(`${locale}: Custom poolish and formula survive Simple, reload and return to Custom`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await anonymous(page);
  const data={version:1,savedAt:NOW,tab:'custom',bakeType:'pizza',bakeName:'Simple Custom regression',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'spiral',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'bread',flour2:null,ratio1:100},manualHydration:64,manualSalt:2.7,manualOil:0,manualSugar:0,prefermentType:'poolish',prefermentFlourPct:20,prefOffsetH:11,prefGoesInFridge:true,flourInFridge:false,startTime:Date.parse('2026-10-03T23:40:00+08:00'),eatTime:BAKE,blocks:[],recipeGenerated:false,modeChosen:false,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:3,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
  // Start from a real saved Custom review, then use its visible Mode action.
  data.modeChosen=true;data.setupOverview=true;
  await page.addInitScript(data=>{
   if(sessionStorage.getItem('simple-custom-seeded'))return;
   sessionStorage.setItem('simple-custom-seeded','1');
   localStorage.setItem('bh_session_v1',JSON.stringify(data));
   sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:3,advancedStep:9,setupOverview:true,activeTab:'setup',reviewMode:true}));
  },data);
  await page.goto(fr?'/fr':'/');
  await page.getByRole('button',{name:fr?'Modifier : Mode':'Edit : Mode',exact:true}).tap();
  await page.getByRole('button',{name:/^Simple\b/}).tap();
  await expect(page.getByText(fr?'Méthode conservée · poolish':'Retained method · poolish',{exact:true})).toBeVisible();
  const formula=async()=>{const s=await stored(page);return {tab:s?.tab,preferment:s?.prefermentType,hydration:s?.manualHydration,salt:s?.manualSalt,flour:s?.flourBlend};};
  await expect.poll(formula).toEqual({tab:'simple',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  await page.reload();
  const resume=page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true});
  await expect(resume).toBeVisible();await resume.tap();
  await expect.poll(formula).toEqual({tab:'simple',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  await actions(page).getByRole('button',{name:fr?'Continuer':'Continue',exact:true}).tap();
  await nextToRecipe(page,fr);
  await expect(page.getByRole('region',{name:fr?'Quantités totales':'Total ingredients',exact:true})).toBeVisible();
  await page.locator('summary').filter({hasText:fr?'Ingrédients par étape':'Ingredients by stage'}).tap();
  await expect(page.getByText(/Poolish/).first()).toBeVisible();
  await page.getByRole('button',{name:fr?'Modifier l’organisation et les horaires':'Edit setup & timing',exact:true}).tap();
  await page.getByRole('button',{name:fr?'Modifier : Mode':'Edit : Mode',exact:true}).tap();
  await page.getByRole('button',{name:fr?/^Personnalisé(?:\s|$)/:/^Custom\b/}).tap();
  await expect.poll(formula).toEqual({tab:'custom',preferment:'poolish',hydration:64,salt:2.7,flour:data.flourBlend});
  expect(errors).toEqual([]);
 });
}
