const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./load-production.cjs'); // registers the TypeScript loader

const meta=require('../app/lib/siteMeta.ts');
const robots=require('../app/robots.ts').default;
const sitemap=require('../app/sitemap.ts').default;
const HOST='https://www.bakerhub.app';

test('robots points at the sitemap and keeps server routes out',()=>{
  const r=robots();
  assert.equal(r.sitemap,HOST+'/sitemap.xml');
  const rule=r.rules[0];
  assert.equal(rule.allow,'/');
  for(const p of ['/api/','/auth/']) assert.ok(rule.disallow.includes(p));
});

test('sitemap lists home, about, privacy and terms in both languages',()=>{
  const urls=sitemap().map(e=>e.url).sort();
  assert.deepEqual(urls,[
    HOST, HOST+'/about', HOST+'/fr', HOST+'/fr/about', HOST+'/fr/privacy',
    HOST+'/fr/terms', HOST+'/privacy', HOST+'/terms',
  ].sort());
  for(const entry of sitemap()) {
    assert.ok(entry.alternates.languages.en.startsWith(HOST));
    assert.ok(entry.alternates.languages.fr.startsWith(HOST+'/fr'));
  }
});

test('every page has its own localized title, description, canonical and share card',()=>{
  const seen=new Set();
  for(const locale of meta.SITE_LOCALES) for(const page of meta.SITE_PAGES) {
    const m=meta.pageMetadata(locale,page);
    assert.ok(m.title.includes('Baker Hub'));
    assert.ok(!seen.has(m.title),'duplicate title '+m.title); seen.add(m.title);
    assert.ok(m.description.length>=50 && m.description.length<=200,m.description);
    const expected=HOST+(locale==='fr'?'/fr':'')+page;
    assert.equal(m.alternates.canonical,expected);
    assert.equal(m.alternates.languages[locale],expected);
    assert.equal(m.alternates.languages['x-default'],HOST+page);
    assert.equal(m.openGraph.url,expected);
    assert.equal(m.openGraph.title,m.title);
    assert.equal(m.twitter.card,'summary_large_image');
    const image=m.openGraph.images[0];
    assert.equal(image.width,1200); assert.equal(image.height,630);
    assert.ok(fs.existsSync(path.join(__dirname,'../public',image.url)),image.url);
  }
  assert.match(meta.pageMetadata('fr','').title,/planifiées autour de votre journée/);
  assert.match(meta.pageMetadata('en','').title,/planned around your day/);
  assert.doesNotMatch(JSON.stringify(meta.SITE_META),/no other app|aucune autre/i);
});

test('the share cards are 1200×630 PNG files',()=>{
  for(const locale of ['en','fr']) {
    const b=fs.readFileSync(path.join(__dirname,`../public/og-${locale}.png`));
    assert.equal(b.toString('latin1',1,4),'PNG');
    assert.equal(b.readUInt32BE(16),1200); assert.equal(b.readUInt32BE(20),630);
  }
});

test('locale pages take their metadata from the shared table',()=>{
  const layout=fs.readFileSync(path.join(__dirname,'../app/[locale]/layout.tsx'),'utf8');
  assert.match(layout,/generateMetadata/); assert.match(layout,/metadataBase/);
  for(const page of ['about','privacy','terms']) {
    const src=fs.readFileSync(path.join(__dirname,`../app/[locale]/${page}/page.tsx`),'utf8');
    assert.ok(src.includes(`pageMetadata(locale, '/${page}')`));
  }
});
