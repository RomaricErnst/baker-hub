const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
require('./load-production.cjs');
const original=Module._load;
Module._load=function(id,parent,main){if(id==='next-intl')return {};if(id==='@/lib/flourDatabase')return {FLOUR_DB:require('../lib/flourCatalogue.json'),FLOUR_PHOTO_PROVENANCE:{}};return original.call(this,id,parent,main);};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:f}).outputText,f);
const {flourBehaviour,flourTypeLabel}=require('../app/components/FlourCatalogueBrowser.tsx');
Module._load=original;
test('catalogue type variants preserve wholegrain and rye calculation behaviour',()=>{
 for(const type of ['Whole Wheat','wholemeal','whole_wheat','T150','Whole Spelt'])a.equal(flourBehaviour({type,w:null}),'wholemeal',type);
 a.equal(flourBehaviour({type:'rye',w:null}),'rye');a.equal(flourBehaviour({type:'Bread',w:null}),'bread');a.equal(flourBehaviour({type:'All Purpose',w:null}),'allpurpose');
});
test('French flour facets use translated readable type names',()=>{a.equal(flourTypeLabel('Whole Wheat',true),'Blé complet');a.equal(flourTypeLabel('high_gluten',true),'Farine de force');a.equal(flourTypeLabel('T65',true),'T65');});
