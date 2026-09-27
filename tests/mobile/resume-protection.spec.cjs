const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const draft=()=>({version:1,savedAt:Date.now(),bakeName:'AUDIT resume protection',tab:'simple',bakeType:'pizza',styleKey:'neapolitan',numItems:4,itemWeight:260,pizzaDiameter:30,ovenType:'home_oven_standard',mixerType:'hand',yeastType:'instant',kitchenTemp:22,humidity:'normal',fridgeTemp:5,flourBlend:{flour1:'pizza00',flour2:null,ratio1:100},prefermentType:'none',prefOffsetH:0,flourInFridge:false,eatTime:null,startTime:null,blocks:[],recipeGenerated:false,modeChosen:true,activeStep:3,highestStep:3,activeTab:'batch'});
for(const locale of ['fr','en']) {
 test(`${locale}: dismissing resume does not authorize replacing local work`,async({page})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  const original=JSON.stringify(draft());
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',value),original);
  await page.reload();
  await page.getByRole('button',{name:locale==='fr'?'Masquer':'Dismiss',exact:true}).tap();
  let prompted=false;
  page.once('dialog',async dialog=>{prompted=true;await dialog.dismiss();});
  await page.getByRole('button',{name:'Pizza',exact:true}).tap();
  expect(prompted).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe(original);
  await page.reload();
  await expect(page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true})).toBeVisible();
 });
 test(`${locale}: stale pagehide cannot overwrite a draft from another tab`,async({page,context})=>{
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,body:'{}'}));
  await page.goto(locale==='fr'?'/fr':'/');
  const original=draft();
  await page.evaluate(value=>localStorage.setItem('bh_session_v1',JSON.stringify(value)),original);
  await page.reload();
  await page.getByRole('button',{name:locale==='fr'?'Reprendre →':'Resume →',exact:true}).tap();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')).savedAt)).not.toBe(original.savedAt);
  // A second tab writes a distinct named fixture, after the first tab settled.
  const other=await context.newPage();await other.goto(locale==='fr'?'/fr':'/');
  const newer=JSON.stringify({...draft(),bakeName:'AUDIT newer tab',numItems:24});
  await other.evaluate(value=>localStorage.setItem('bh_session_v1',value),newer);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  expect(await other.evaluate(()=>localStorage.getItem('bh_session_v1'))).toBe(newer);
  await expect(page.getByRole('alert').filter({hasText:locale==='fr'?'Une autre fenêtre':'Another window'})).toBeVisible();
 });
}
