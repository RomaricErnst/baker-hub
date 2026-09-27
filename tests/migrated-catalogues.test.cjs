const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const flours=require('../lib/flourCatalogue.json');
const recipes=require('../app/lib/auditedPizzaRecipes.json');
test('selectable branded flour catalogue has unique IDs and local photos',()=>{
 a.equal(new Set(flours.map(f=>f.id)).size,flours.length);
 const branded=flours.filter(f=>f.brand!=='Generic');a.equal(branded.length,244);
 for(const f of branded){a.notEqual(f.catalogStatus,'retired');a.ok(f.bagImage.startsWith('/images/flours/'),f.id);a.ok(fs.statSync(path.join(root,'public',f.bagImage)).size>1000,f.id);}
});
test('audited recipe ingredients retain bilingual names and valid amounts',()=>{
 a.equal(Object.keys(recipes).length,156);
 for(const [id,r]of Object.entries(recipes)){
  a.ok(r.ingredients.length,id);
  for(const i of r.ingredients){a.ok(i.name.en&&i.name.fr,`${id}/${i.id}`);if(i.qtyPerPizza?.amount!=null)a.ok(i.qtyPerPizza.amount>=0,`${id}/${i.id}`);}
  a.ok(fs.existsSync(path.join(root,'public/pizzas',id+'.webp')),id);
 }
});
