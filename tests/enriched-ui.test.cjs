const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const read=name=>fs.readFileSync('app/components/'+name+'.tsx','utf8');
test('enriched recipe quantities are separate ingredients and zero plain water is supported',()=>{
 const recipe=read('RecipeOutput'),share=read('ShareCard'),saved=read('SessionViewer');
 a.match(recipe,/\['milk','eggs','butter'\]/);a.match(recipe,/water > 0 && <IngRow/);a.match(recipe,/!enrichment \? <details/);a.match(recipe,/enrichment\.sourceUrl/);
 a.match(share,/waterIngStr \|\| enrichmentStr/);a.match(saved,/cr\?\.enrichment \?\? recipe\?\.enrichment \?\? null/);
});
test('enriched mixing replaces lean autolyse and suppresses unmodelled water-temperature advice',()=>{
 const guide=read('BakeGuide');
 a.match(guide,/enriched && <Steps/);a.match(guide,/!enriched && styleKey !== 'pain_seigle' && <>/);a.match(guide,/!enriched && styleKey === 'pain_seigle' && <p>/);a.match(guide,/Add softened butter gradually/);
 a.match(guide,/!enriched && !\(simpleMode && recipe\?\.waterTemp == null\)/);
 a.match(guide,/enrichment\?\.unsupportedMethod/);a.match(read('RecipeOutput'),/enrichment\?\.unsupportedMethod/);
});
test('enriched display components retain valid TSX syntax',()=>{
 for(const name of ['RecipeOutput','BakeGuide','ShareCard','SessionViewer']){
 const result=ts.transpileModule(read(name),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}});
 a.equal((result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name);
 }
});
