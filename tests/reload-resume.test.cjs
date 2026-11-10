const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8');

test('a reload on a generated bake destination resumes; the landing keeps the Resume card',()=>{
  // Only a generated bake, only from a history entry that is not the home screen, only for the same family.
  assert.match(page,/const reloadedMidBake = !!session\.recipeGenerated && !!reloadedOn && !reloadedOn\.home && reloadedOn\.family === session\.bakeType;/);
  assert.match(page,/if \(readAuthIntent\(\) \|\| sessionStorage\.getItem\('bh_locale_resume'\) \|\| reloadedMidBake\) \{/);
  // Everything else still waits behind Resume.
  assert.match(page,/    else setShowWelcomeBack\(true\);/);
  // Back after a reload with no bake applied still lands on the home screen with the card.
  assert.match(page,/After a reload the bake waits behind "Resume"/);
});
