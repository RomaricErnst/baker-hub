const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');

// Opening the timing editor and changing nothing leaves the recipe current.
test.use({timezoneId:'Asia/Singapore'});
const NOW=Date.parse('2026-10-03T15:25:00+08:00');
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('bh_session_v1')||'null'));
const actions=page=>page.locator('.bh-step-actions:visible');
async function go(page,label){
 const trigger=page.locator('.bh-bake-navigator-trigger');
 await trigger.scrollIntoViewIfNeeded();
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.tap();
 await page.getByRole('navigation',{name:'Your bake',exact:true}).getByRole('button',{name:new RegExp('^'+label)}).first().tap();
}
test('Adjust timing without a change keeps the recipe current',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:NOW});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('/');
 await page.getByRole('button',{name:'Pizza',exact:true}).tap();
 await page.getByRole('button',{name:'Classic Neapolitan',exact:true}).tap();
 await page.locator('.bh-style-confirm').getByRole('button',{name:/^Continue with/}).tap();
 const quantity=page.getByLabel('Number of pizzas',{exact:true});
 await quantity.fill('4');await quantity.blur();
 await actions(page).locator('[data-bh-forward]:visible').tap();
 await (async()=>{const k=page.locator('[data-kitchen-slider]:visible');if(await k.count())await page.locator('.bh-batch-actions:visible [data-bh-forward]:visible').tap();})();
 const bakeDate=page.getByLabel('Bake date and time',{exact:true});
 await bakeDate.fill('2026-10-04T19:00');await bakeDate.blur();
 await page.getByRole('button',{name:'Generate my recipe',exact:true}).tap();
 await expect.poll(async()=>(await stored(page))?.recipeGenerated).toBe(true);
 const before=await stored(page);
 console.log('start',new Date(before.startTime).toISOString(),'now',new Date(NOW).toISOString());
 await page.clock.fastForward('20:00');
 await go(page,'Preparation');
 await page.locator('[data-preparation-timing]:visible').getByRole('button',{name:'Adjust timing',exact:true}).tap();
 await page.waitForTimeout(1500);
 await go(page,'Baking & serving');
 await page.waitForTimeout(800);
 const after=await stored(page);
 const diff=Object.keys(after).filter(k=>JSON.stringify(after[k])!==JSON.stringify(before[k])&&k!=='savedAt');
 console.log('changed keys',diff.map(k=>k+': '+JSON.stringify(before[k])?.slice(0,120)+' → '+JSON.stringify(after[k])?.slice(0,120)).join('\n'));
 await expect(page.getByRole('heading',{name:'Update your recipe',exact:true})).toHaveCount(0);
 expect(errors).toEqual([]);
});
