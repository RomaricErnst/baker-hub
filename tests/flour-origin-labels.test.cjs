const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('app/components/FlourPicker.tsx','utf8');
const start=source.indexOf('const ORIGIN_LABELS_FR:'),end=source.indexOf('// ── APAC country sub-filter',start);
const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleResult={exports:{}};vm.runInNewContext(code,{module:moduleResult,exports:moduleResult.exports});
const {flourOriginLabel}=moduleResult.exports;
test('flour origin names localize independently of unchanged filter keys',()=>{
 for(const [key,translated] of [['Italy','Italie'],['UK','Royaume-Uni'],['Americas','Amériques'],['Asia-Pacific','Asie-Pacifique'],['Singapore','Singapour'],['Germany','Allemagne'],['United States','États-Unis'],['Australia','Australie'],['Netherlands','Pays-Bas'],['Japan','Japon']]){
  assert.equal(flourOriginLabel(key,'fr'),translated);assert.equal(flourOriginLabel(key,'en'),key);
 }
 assert.equal(flourOriginLabel('Canada','fr'),'Canada');
 assert.equal((source.match(/<FlourCatalogueBrowser\b/g)||[]).length,2);
});
