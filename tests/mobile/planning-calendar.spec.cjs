const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const local=d=>new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
async function openPlan(page,mode='simple',blocks=[],preferment=false){
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);
 const start=new Date(+bake-26*3600000);
 const data={version:1,savedAt:Date.now(),tab:mode,bakeType:'pizza',styleKey:'neapolitan',numItems:2,itemWeight:250,pizzaDiameter:30,ovenType:'pizza_oven',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:null,prefermentType:preferment?'poolish':'none',prefOffsetH:preferment?12:0,prefGoesInFridge:true,flourInFridge:false,startTime:+start,eatTime:+bake,blocks,recipeGenerated:!preferment,modeChosen:true,qtyChosen:true,flourChosen:true,prefermentChosen:true,activeStep:7,advancedStep:9,highestStep:7,advancedHighestStep:9,setupOverview:false,activeTab:'setup'};
 await page.addInitScript(data=>{if(!sessionStorage.getItem('calendar-seeded')){localStorage.setItem('bh_session_v1',JSON.stringify(data));sessionStorage.setItem('calendar-seeded','1');}sessionStorage.setItem('bh_locale_resume',JSON.stringify({activeStep:7,advancedStep:9,setupOverview:false,activeTab:'setup',reviewMode:true}));},data);
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/fr');const plan=page.getByRole('region',{name:'Votre planning',exact:true});await expect(plan).toBeVisible();return {plan,start,bake};
}
for(const mode of ['simple','custom'])test(`${mode}: quiet calendar, draft cancel and checked commit`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {plan,start,bake}=await openPlan(page,mode);
 await expect(page.getByRole('tab',{name:'Actions',exact:true})).toHaveCount(0);
 await expect(plan.getByText('Dans le créneau',{exact:true})).toHaveCount(0);
 await expect(plan.getByText(/intervalle raccourci/)).toHaveCount(0);
 await expect(plan.getByText('Préchauffage',{exact:true})).toBeVisible();
 await plan.getByRole('button',{name:'Modifier Commencer la pâte',exact:true}).tap();
 const editor={fill:async(value)=>{await plan.getByLabel('Date de l’étape').fill(value.split('T')[0]);await plan.locator('input[type="time"]').fill(value.split('T')[1]);}};
 await expect(page.getByRole('button',{name:mode==='simple'?/Voir les ingrédients/:/^Continuer$/})).toHaveCount(0);
 const proposed=new Date(+start+15*60000);await editor.fill(local(proposed));
 await expect(plan.getByRole('button',{name:'Appliquer',exact:true})).toBeEnabled();
 expect((await stored(page)).startTime).toBe(+start);
 await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
 await expect(page.getByRole('button',{name:mode==='simple'?/Voir les ingrédients/:/^Continuer$/})).toBeVisible();
 await expect(plan.getByText('Proposition non enregistrée')).toHaveCount(0);expect((await stored(page)).startTime).toBe(+start);
 await plan.getByRole('button',{name:'Modifier Commencer la pâte',exact:true}).tap();
 await editor.fill(local(new Date(+bake-60*60000)));await expect(plan.getByRole('button',{name:'Appliquer',exact:true})).toBeDisabled();
 await expect(plan.getByText('Préchauffage',{exact:true}).locator('..').locator('..').getByText('45 min',{exact:true})).toBeVisible();
 await editor.fill(local(proposed));await expect(plan.getByRole('button',{name:'Appliquer',exact:true})).toBeEnabled();
 await plan.getByRole('button',{name:'Appliquer',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(+proposed);expect((await stored(page)).eatTime).toBe(+bake);
 await page.getByRole('button',{name:'Annuler le dernier ajustement',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(+start);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
 await testInfo.attach(`${mode}-calendar`,{body:await plan.screenshot(),contentType:'image/png'});expect(errors).toEqual([]);
});
test('unavailable periods are shaded and action conflicts remain visible',async({page})=>{
 const bake=new Date();bake.setDate(bake.getDate()+5);bake.setHours(18,0,0,0);
 const {plan}=await openPlan(page,'simple',[{from:+bake-45*60000,to:+bake-30*60000,label:'Appel'}]);
 await expect(plan.getByText('Indisponible · Appel')).toBeVisible();
 await expect(plan.getByText('Préchauffage',{exact:true}).locator('..').locator('..').getByText(/Cette étape chevauche/)).toBeVisible();
 await expect(plan.getByText('Horaire à ajuster',{exact:true})).toHaveCount(0);
});

for(const mode of ['simple','custom'])test(`${mode}: preferment carries maturation, applies and survives reload before recipe generation`,async({page})=>{
 const {plan,start,bake}=await openPlan(page,mode,[],true);
 await plan.getByRole('button',{name:'Modifier Préparer le Poolish',exact:true}).tap();
 await plan.getByRole('button',{name:'+15 min',exact:true}).tap();
 await expect(plan.getByRole('button',{name:'Appliquer',exact:true})).toBeEnabled();
 await plan.getByRole('button',{name:'Appliquer',exact:true}).tap();
 await expect.poll(async()=>(await stored(page)).startTime).toBe(+start+15*60000);
 expect((await stored(page)).prefOffsetH).toBe(12);expect((await stored(page)).eatTime).toBe(+bake);
 await page.reload();await expect(plan).toBeVisible();
 await expect(plan.getByRole('button',{name:'Modifier Commencer la pâte',exact:true})).toContainText(local(new Date(+start+15*60000)).split('T')[1]);
 expect((await stored(page)).prefOffsetH).toBe(12);
 await plan.getByRole('button',{name:'Modifier Préparer le Poolish',exact:true}).tap();
 const late=new Date(+bake-13*3600000);
 await plan.getByLabel('Date de l’étape').fill(local(late).split('T')[0]);await plan.locator('input[type="time"]').fill(local(late).split('T')[1]);
 await expect(plan.getByRole('button',{name:'Appliquer',exact:true})).toBeDisabled();
 await expect(plan.getByRole('alert')).toContainText('12 h de maturation');
 expect((await stored(page)).eatTime).toBe(+bake);
 await plan.getByRole('button',{name:'Annuler',exact:true}).tap();
});
