const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const page=fs.readFileSync(path.join(__dirname,'../app/[locale]/page.tsx'),'utf8');

test('rows the baker has not chosen are left out of the Simple summary, without a tag',()=>{
  assert.doesNotMatch(page,/Suggested values: |Valeurs proposées : /);
  assert.doesNotMatch(page,/data-suggested-tag/);
  assert.match(page,/hideSuggested && flow\.recipeGenerated && suggestedRows\[row\.key\]/);
});

test('catalogue names read in sentence case in the summary',()=>{
  const line=page.split('\n').find(l=>l.includes('const sentenceCase ='));
  const sentenceCase=new Function(line.replace(/^\s*const sentenceCase = /,'return ').replace(/:string/g,'').replace(/\(value\|null\)|value:string\|null/,'value').replace(/;\s*$/,''))();
  assert.equal(sentenceCase('Levure Sèche Instantanée'),'Levure sèche instantanée');
  assert.equal(sentenceCase('Stand Mixer'),'Stand mixer');
  assert.equal(sentenceCase('Four domestique standard'),'Four domestique standard');
});

test('Custom levain breads show the starter answer, and quantities follow the units',()=>{
  assert.match(page,/\.\.\.\(levainCustom \? \{\} : \{8:/);
  assert.equal((page.match(/`\$\{numItems\} × \$\{displayWeight\(Math\.round\(itemWeight\),units,locale\)\}`/g)||[]).length,2);
});
