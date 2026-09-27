const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>{const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;module._compile(out,file);};
const {archivedBlendSelections}=require('../app/lib/flourRecovery.ts');
const {FLOUR_DB,FLOUR_ARCHIVE}=require('../lib/flourDatabase.ts');
test('archived base and blend flour stay identifiable without substituting active products',()=>{
 const activeNames=new Set(FLOUR_DB.map(f=>`${f.brand} ${f.name}`));const retired=FLOUR_ARCHIVE.find(f=>!activeNames.has(`${f.brand} ${f.name}`));assert.ok(retired);
 const name=`${retired.brand} ${retired.name}`;const blend={flour1:'pizza00',flour2:'bread',ratio1:80,brandProduct:name,customFlour2Name:name,w1:217,w2:283};const before=JSON.stringify(blend);
 assert.deepEqual(archivedBlendSelections(blend),[name,name]);assert.equal(JSON.stringify(blend),before);
 const active=FLOUR_DB.find(f=>f.brand!=='Generic');assert.deepEqual(archivedBlendSelections({...blend,brandProduct:`${active.brand} ${active.name}`,flour2:null}),[]);
 assert.deepEqual(archivedBlendSelections({flour1:'pizza00',flour2:null,ratio1:100,brandProduct:'My scanned local flour',w1Source:'photo'}),[]);
});
