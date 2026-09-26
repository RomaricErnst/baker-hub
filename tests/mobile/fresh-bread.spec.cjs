const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

test.describe('fresh unleavened bread setup',()=>{
 test.use({timezoneId:'UTC'});
 test('Simple piadina: choose bread, quantity, griddle and rest, then create recipe',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2030-05-10T10:00:00Z'));
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"message":"Anonymous test"}'}));
  await page.goto('/');
  await page.getByRole('button',{name:'Bread',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'How would you like to set up your recipe?',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^(Me laisser guider|Guide me)\b/}).tap();
  await page.getByRole('button',{name:/^Piadina/}).tap();
  const proceed=()=>page.locator('.bh-step-page:visible').getByRole('button',{name:'Continue',exact:true}).tap();
  await proceed();
  await expect(page.getByLabel('Number of pieces',{exact:true})).toHaveValue('4');
  await expect(page.getByLabel('Dough per piece (g)',{exact:true})).toHaveValue('140');
  // Change the actual batch count; the cooking span must follow it downstream.
  await page.getByLabel('Number of pieces',{exact:true}).fill('5');
  await page.getByLabel('Number of pieces',{exact:true}).press('Enter');
  await proceed();
  await page.getByRole('button',{name:/^Skillet or griddle/}).tap();
  await page.getByRole('button',{name:'Choose mixing method',exact:true}).tap();
  await page.getByRole('button',{name:/^Hand knead/}).tap();
  await proceed();
  await expect(page.getByRole('heading',{name:'Preparation temperatures',exact:true})).toBeVisible();
  await proceed();
  // No yeast or preferment page may interrupt an unleavened dough journey.
  const rest=page.getByRole('region',{name:'Rest and cook',exact:true});
  await expect(rest).toBeVisible();
  await expect(page.getByRole('region',{name:'Your mixing window'})).toHaveCount(0);
  await page.getByLabel('Start pan-cooking at',{exact:true}).fill('2030-05-10T18:00');
  await rest.getByRole('button',{name:'Confirm plan',exact:true}).tap();
  await expect(rest.getByRole('button',{name:'Plan confirmed',exact:true})).toBeVisible();
  await expect(rest.getByText(/Cooking finished around .*6:30pm/)).toBeVisible(); // 5 pieces × 6 minutes
  await page.getByRole('button',{name:'Review my choices',exact:true}).tap();
  await page.getByRole('button',{name:'Create recipe',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Fillings',exact:true})).toBeVisible();
  await expect.poll(async()=>page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem('bh_session_v1')||'null');
   return s&&{generated:s.recipeGenerated,style:s.styleKey,oven:s.ovenType,count:s.numItems,weight:s.itemWeight,pref:s.prefermentType,minutes:(s.eatTime-s.startTime)/60000,cold:s.computedRecipe?.coldH,rt:s.computedRecipe?.rtH,yeast:s.computedRecipe?.yeastGrams};
  })).toEqual({generated:true,style:'piadina',oven:'griddle',count:5,weight:140,pref:'none',minutes:45,cold:0,rt:0,yeast:null});
  await page.getByRole('button',{name:'Fillings',exact:true}).tap();
  await expect(page.getByRole('heading',{name:'Your piadine',exact:true})).toBeVisible();
  await expect(page.getByRole('img',{name:'Piadina',exact:true})).toBeVisible();
  await testInfo.attach('fresh-piadina-sandwich-handoff',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  expect(errors).toEqual([]);
 });
});
