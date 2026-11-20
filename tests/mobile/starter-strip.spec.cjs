const {test,expect}=require('../../.ci-tools/node_modules/@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// 20 Nov 2026 chart review (owner's decision): a Custom sourdough plan shows a starter readiness strip in Your
// plan, between the pre-mix feed and Start Dough, instead of the multi-day fermentation chart. Priya's bake
// (London 19 °C, fridge-kept starter, mix Fri 5:30pm, bake Sat 10:00am; fixture of the generated bake) opened
// on Thursday, before its feeds. The strip is an image with a text alternative, not sliders; the ready window
// is the solver's green band rounded inward to whole hours; the peak reads as the card writes it.
const storage=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/priya-levain-tue.json'),'utf8'));
test.use({timezoneId:'Europe/London'});

async function openRecipe(page,fr){
 await page.clock.install({time:new Date('2026-11-19T12:00:00Z')});
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.addInitScript(([s])=>{if(sessionStorage.getItem('strip-seeded'))return;sessionStorage.setItem('strip-seeded','1');localStorage.clear();for(const k in s)localStorage.setItem(k,s[k]);},[storage]);
 await page.goto(fr?'/fr':'/');
 await page.getByRole('button',{name:fr?'Reprendre →':'Resume →',exact:true}).tap();
 await page.locator('.bh-bake-navigator-trigger').tap();
 await page.getByRole('navigation',{name:fr?'Votre fournée':'Your bake',exact:true}).getByRole('button').filter({has:page.getByText(fr?'Recette':'Recipe',{exact:true})}).tap();
 const strip=page.locator('[data-recipe-plan] [data-starter-strip]:visible');
 await expect(strip).toHaveCount(1);
 return strip;
}

async function checkStrip(page,strip,fr){
 // Between the pre-mix feed and Start Dough.
 const item=page.locator('li[data-plan-strip]:visible');
 expect(await item.evaluate(li=>li.previousElementSibling?.textContent)).toMatch(fr?/Rafraîchi avant pétrissage/:/Pre-mix feed/);
 expect(await item.evaluate(li=>li.nextElementSibling?.textContent)).toMatch(fr?/Pétrir la pâte/:/Start Dough/);
 // Start Dough sits inside the ready window.
 const [from,to,mix,peak]=await Promise.all(['bandFrom','bandTo','mixMs','peakMs'].map(k=>strip.evaluate((el,k)=>Number(el.dataset[k]),k)));
 expect(mix).toBeGreaterThanOrEqual(from);expect(mix).toBeLessThanOrEqual(to);
 // An image with a text alternative; no sliders, no dragging.
 const img=strip.getByRole('img');
 const alt=await img.getAttribute('aria-label');
 expect(alt).toMatch(fr?/^Levain : prêt \d+h–\d+h, pic vers \d+h\d\d\. Pétrir la pâte 17h30\./:/^Starter: ready \d+(am|pm)?–\d+(am|pm), peak around \d+:\d\d(am|pm)\. Start Dough 5:30pm\./);
 await expect(strip.getByRole('slider')).toHaveCount(0);
 // The window named is inside the band, in whole hours, and the peak in the strip's words is the plan's peak
 // on its 15-minute grid (computed in the page's time zone).
 const expected=await strip.evaluate((el,fr)=>{
  const f=new Date(Number(el.dataset.bandFrom)),t=new Date(Number(el.dataset.bandTo)),q=new Date(Math.round(Number(el.dataset.peakMs)/900000)*900000);
  const h=q.getHours(),m=String(q.getMinutes()).padStart(2,'0');
  return {from:f.getHours()+(f.getMinutes()?1:0),to:t.getHours(),peak:fr?`pic vers ${h}h${m}`:`peak around ${h%12||12}:${m}${h<12?'am':'pm'}`};
 },fr);
 if(fr){const hours=alt.match(/prêt (\d+)h–(\d+)h/).slice(1).map(Number);expect(hours).toEqual([expected.from,expected.to]);}
 expect(alt).toContain(expected.peak);
 // Busy time shaded and named; plain labels.
 await expect(strip.locator('[data-strip-busy]').first()).toBeAttached();
 await expect(strip.locator('svg text').filter({hasText:fr?/^(nuit|travail)$/:/^(night|work)$/}).first()).toBeAttached();
 await expect(strip.locator('svg text').filter({hasText:fr?/^prêt /:/^ready /})).toHaveCount(1);
 // Fits: inside the viewport, every label inside the strip, the labels under the axis never overlap.
 const geo=await strip.evaluate(el=>{const svg=el.querySelector('svg').getBoundingClientRect();return {svg:{l:svg.left,r:svg.right},texts:[...el.querySelectorAll('svg text')].map(t=>{const b=t.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,y:t.getAttribute('y'),s:t.textContent};})};});
 const vw=page.viewportSize().width;
 expect(geo.svg.r).toBeLessThanOrEqual(vw-8);
 for(const t of geo.texts){expect(t.l,t.s).toBeGreaterThanOrEqual(geo.svg.l-0.5);expect(t.r,t.s).toBeLessThanOrEqual(geo.svg.r+0.5);}
 for(const row of ['122','135']){const r=geo.texts.filter(t=>t.y===row).sort((a,b)=>a.l-b.l);for(let i=1;i<r.length;i++)expect(r[i].l,`${r[i-1].s} / ${r[i].s}`).toBeGreaterThanOrEqual(r[i-1].r);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw);
}

test('EN 390 px: the starter strip sits before Start Dough, ready window around the card’s peak',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const strip=await openRecipe(page,false);
 await checkStrip(page,strip,false);
 // The card writes the same peak (Change times › pre-mix feed).
 const alt=await strip.getByRole('img').getAttribute('aria-label');
 const words=alt.match(/peak (around \d+:\d\d(am|pm))/)[1];
 await page.getByRole('button',{name:'Change times',exact:true}).tap();
 await page.getByRole('button',{name:/^Edit Pre-mix feed/}).first().tap();
 await expect(page.getByText(new RegExp('Peak '+words)).first()).toBeVisible();
 expect(errors).toEqual([]);
});

test.describe('FR 320 px',()=>{
 test.use({viewport:{width:320,height:700}});
 test('the strip fits in French at 320 px, 24 h clock',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const strip=await openRecipe(page,true);
  await checkStrip(page,strip,true);
  expect(errors).toEqual([]);
 });
});

test('the strip draws no curves and the Recipe no fermentation curve',async({page})=>{
 const strip=await openRecipe(page,false);
 await expect(page.locator('[data-plan-curve]')).toHaveCount(0);
 await expect(strip.locator('svg path')).toHaveCount(0); // bars and marks, no curves
});
