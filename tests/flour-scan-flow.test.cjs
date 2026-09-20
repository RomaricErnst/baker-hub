const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const catalogue=require('../lib/flourCatalogue.json');
const moduleResult={exports:{}};
const code=ts.transpileModule(fs.readFileSync('app/components/FlourScan.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(code,{module:moduleResult,exports:moduleResult.exports,require:p=>p==='@/lib/flourDatabase'?{FLOUR_DB:catalogue}:require(p)});
const {matchScannedFlour,validScannedValues}=moduleResult.exports;
test('scan matches a complete catalogue identity and retains flour type and provenance',()=>{
 const entry=catalogue.find(f=>f.brand&&f.type==='rye');
 assert.ok(entry);
 const result=matchScannedFlour(`  ${entry.brand.toUpperCase()} ${entry.name.toUpperCase()}  `);
 assert.equal(result.id,entry.id);assert.equal(result.type,'rye');assert.equal(result.wPublished,entry.wPublished);
 assert.equal(matchScannedFlour(entry.brand),undefined);
 assert.equal(matchScannedFlour('Unlisted mill rye flour'),undefined);
});
test('invalid extraction and adjustment numbers cannot be used',()=>{
 for(const [w,protein] of [[NaN,12],[Infinity,12],[0,12],[501,12],[250,NaN],[250,0],[250,31]])assert.equal(validScannedValues(w,protein),false);
 assert.equal(validScannedValues(250,12.5),true);
});
