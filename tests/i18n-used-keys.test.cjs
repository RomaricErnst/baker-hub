const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('used keys fail when absent in both locales and respect translator scopes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bh-i18n-'));
 try {
  for(const sub of ['app','scripts','messages']) fs.mkdirSync(path.join(dir,sub));
  fs.copyFileSync(path.join(__dirname,'../scripts/check-i18n.js'),path.join(dir,'scripts/check-i18n.js'));
  fs.symlinkSync(path.join(__dirname,'../node_modules'),path.join(dir,'node_modules'));
  const messages={scheduler:{taste:{info:'Taste guidance'}},header:{title:'Header'}};
  for(const locale of ['en','fr']) fs.writeFileSync(path.join(dir,'messages',locale+'.json'),JSON.stringify(messages));
  fs.writeFileSync(path.join(dir,'app/test.tsx'),`
    function Schedule(){const t=useTranslations('scheduler');return t('taste.info');}
    function Header(){const t=useTranslations('header');return t('title');}
  `);
  const run=()=>spawnSync(process.execPath,[path.join(dir,'scripts/check-i18n.js')],{encoding:'utf8'});
  assert.equal(run().status,0);
  delete messages.scheduler.taste.info;
  for(const locale of ['en','fr']) fs.writeFileSync(path.join(dir,'messages',locale+'.json'),JSON.stringify(messages));
  const failed=run();
  assert.equal(failed.status,1);
  assert.match(failed.stderr,/en: scheduler.taste.info/);
  assert.match(failed.stderr,/fr: scheduler.taste.info/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
