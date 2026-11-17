const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8');

test('a reload on a generated bake destination resumes; the landing keeps the Resume card',()=>{
  // Only a generated bake, only from a history entry that is not the home screen, only for the same family.
  // A bake that is over (half a day past, or rated) is not reopened by a reload: home offers it again (17 Nov 2026).
  assert.match(page,/const reloadedMidBake = !bakeOver && !!session\.recipeGenerated && !!reloadedOn && !reloadedOn\.home && reloadedOn\.family === session\.bakeType;/);
  assert.match(page,/const bakeOver = !!session\.recipeGenerated && eatAt != null && \(eatAt \+ 12 \* 3600000 <= now/);
  assert.match(page,/if \(readAuthIntent\(\) \|\| sessionStorage\.getItem\('bh_locale_resume'\) \|\| reloadedMidBake\) \{/);
  // Everything else still waits behind Resume.
  assert.match(page,/    else setShowWelcomeBack\(true\);/);
  // Back after a reload with no bake applied still lands on the home screen with the card.
  assert.match(page,/After a reload the bake waits behind "Resume"/);
});
