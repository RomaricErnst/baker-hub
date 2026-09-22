const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function loadFaq(){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/guideFaq.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports});return m.exports.GUIDE_FAQ;}
test('approved FAQ corrections and new cooling/fold questions are bilingual',()=>{
 const faq=loadFaq();
 a.equal(faq.cool.length,2);a.equal(faq.fold.length,2);
 for(const entries of Object.values(faq))for(const entry of entries)for(const language of ['en','fr'])a.ok(entry.q[language]&&entry.a[language]);
 a.match(faq.poolish.find(e=>/hold a ready/.test(e.q.en)).a.en,/warming it first is not always needed/);
 a.match(faq.mix.find(e=>/sticky/.test(e.q.en)).a.en,/either changes the recipe/);
 a.match(faq.cold.find(e=>/shorten or extend/.test(e.q.en)).a.en,/no single maximum/);
 a.match(faq.starter.find(e=>/^How do I know it is at peak/.test(e.q.en)).a.en,/float test alone cannot/);
});
test('step visuals exist, preserve containment and exclude rye membrane test',()=>{
 const guide=fs.readFileSync('app/components/BakeGuide.tsx','utf8');
 for(const asset of ['step-visuals/windowpane-v1.webp','step-visuals/spiral-pumpkin-wide-v1.webp','step-visuals/bowl-fold-v1.webp','step-visuals/coil-fold-v2.webp','preferment-photos/poolish-v1.webp','preferment-photos/biga-v1.webp']){a.ok(fs.statSync('public/'+asset).size>1000);a.ok(guide.includes('/'+asset));}
 a.match(guide,/objectFit:'contain'/);a.match(guide,/styleKey !== 'pain_seigle' && mixerType !== 'no_knead' && <StepVisual kind="mix"/);
 a.match(guide,/<StepVisual kind={isPoolish \? 'poolish' : 'biga'}/);
 a.doesNotMatch(guide,/src="\/Pumpkin.jpeg"/);
});
test('step cards render the supplied equipment icon',()=>{
 const guide=fs.readFileSync('app/components/BakeGuide.tsx','utf8');
 const card=guide.slice(guide.indexOf('function StepCard('),guide.indexOf('// ── Learn link'));
 a.match(card,/number, icon, title/);
 a.match(card,/<span aria-hidden="true"[^>]*>\{icon\}<\/span>/);
});
test('bread cooling is a separate completion step without fabricated schedule time',()=>{
 const guide=fs.readFileSync('app/components/BakeGuide.tsx','utf8');
 a.match(guide,/<StepCard final={!isBread}/);
 const cooling=guide.slice(guide.indexOf('{isBread && <StepCard final number={n()}'),guide.indexOf('      {learnTerm && ('));
 a.match(cooling,/faqKey="cool"/);a.match(cooling,/\.\.\.sc\(false, 'cooking'\)/);a.doesNotMatch(cooling,/time=|duration=/);
 const diagnostics=ts.transpileModule(guide,{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).diagnostics||[];
 a.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
});

test('interrupted fermentation is reassessed rather than paused by a fixed cooling factor',()=>{
 const faq=loadFaq(),answer=faq.bulk.find(e=>/have to leave/.test(e.q.en)).a;
 a.match(answer.en,/continues while the dough cools/);a.match(answer.en,/reassess/);
 a.match(answer.fr,/réévaluez/);a.doesNotMatch(JSON.stringify(answer),/5×|5x|where you left off/);
 a.doesNotMatch(JSON.stringify(faq.biga),/disappear during bulk|disparaissent pendant le pointage/);
 a.match(faq.biga.find(e=>/chunks/.test(e.q.en)).a.en,/incorporate it fully during mixing/);
});
