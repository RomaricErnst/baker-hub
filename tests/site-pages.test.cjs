const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('About describes the kitchen screen and the current menu entry',()=>{
  const about=read('app/[locale]/about/AboutClient.tsx');
  assert.doesNotMatch(about,/assumes a kitchen around 22|suppose une cuisine autour de 22|a kitchen around 22°C, a standard|cuisine autour de 22 °C, farine/);
  assert.doesNotMatch(about,/My preferences|Mes préférences/);
  assert.match(about,/Kitchen preferences/); assert.match(about,/Préférences de cuisine/);
  assert.match(about,/Every bake asks for your kitchen temperature/);
  assert.match(about,/Chaque fournée vous demande la température de votre cuisine/);
  assert.match(about,/promise: 'Tell Baker Hub when you want to eat/);
  assert.match(about,/promise: 'Dites à Baker Hub quand vous voulez manger/);
  // The menu label the page quotes is the one the header really shows.
  const header=read('app/components/Header.tsx');
  assert.match(header,/'Préférences de cuisine' : 'Kitchen preferences'/);
});

test('Privacy names the language cookie and the transfer to Singapore in both languages',()=>{
  const privacy=read('app/[locale]/privacy/PrivacyClient.tsx');
  assert.doesNotMatch(privacy,/The only cookie|Le seul cookie/);
  assert.equal(privacy.match(/NEXT_LOCALE/g).length,2);
  assert.match(privacy,/your data is transferred to Singapore and stored there/);
  assert.match(privacy,/vos données sont transférées à Singapour et y sont conservées/);
  // The app does set that cookie: next-intl's middleware runs on every page.
  assert.match(read('proxy.ts'),/createMiddleware\(routing\)/);
});

test('Privacy and Terms are reachable from the menu and beside sign-in',()=>{
  const header=read('app/components/Header.tsx');
  for(const page of ['privacy','terms']) {
    const links=header.match(new RegExp(`href=\\{locale === 'fr' \\? '/fr/${page}' : '/${page}'\\}`,'g'))||[];
    assert.equal(links.length,2,page);
  }
});

test('About uses the app’s own names, the plan card and the starter screen, and no leftover English in French',()=>{
  const about=read('app/[locale]/about/AboutClient.tsx');
  const fr=about.slice(about.indexOf('  fr: {'));
  assert.doesNotMatch(about,/Mode Avancé|mode Avancé|l’Avancé|mode Custom/);
  assert.match(about,/Customize my bake/);assert.match(fr,/Personnaliser ma fournée/);
  // The recipe opens with the plan card; timing is no longer said to live only in Preparation.
  assert.doesNotMatch(about,/La page recette ne montre que la recette|The recipe page shows the recipe; all timing/);
  assert.match(about,/Add to my calendar/);assert.match(fr,/Ajouter à mon agenda/);
  assert.match(about,/Your starter<\/strong>/);assert.match(fr,/Votre levain<\/strong>/);
  // No starter percentages that could disagree with the recipe.
  assert.doesNotMatch(about,/20–25 ?%|10–25 ?%|15–20 ?%/);
  // French reads as French.
  assert.doesNotMatch(fr,/\bTA\b|IDY|fallback|\bscor|\bscale|Bake Guide|Pizza Party|Léopardage|blocker|\bFDT\b|hours\^/);
  assert.doesNotMatch(about,/IDY/);
});

test('one brand spelling in the menu and the setup choices',()=>{
  const header=read('app/components/Header.tsx'),page=read('app/[locale]/page.tsx');
  assert.match(header,/'À propos de Baker Hub' : 'About Baker Hub'/);
  assert.doesNotMatch(header+page,/Bakerhub|BakerHub/);
});
