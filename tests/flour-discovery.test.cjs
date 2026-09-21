const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
require('./load-production.cjs');
const original=Module._load;
Module._load=function(id,parent,main){if(id==='next-intl')return {useLocale:()=> 'fr'};if(id==='@/lib/flourDatabase')return {FLOUR_DB:require('../lib/flourCatalogue.json'),FLOUR_PHOTO_PROVENANCE:{}};return original.call(this,id,parent,main);};
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:f}).outputText,f);
const {orderFlourCatalogue,matchesFlour,FlourProductButton,default:Catalogue}=require('../app/components/FlourCatalogueBrowser.tsx');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
test('popular ordering retains every flour and global search can find a non-shortlisted product',()=>{
 const entries=[{id:'a',brand:'Other',name:'T65',type:'T65'},{id:'b',brand:'Caputo',name:'Pizzeria',type:'00'},{id:'c',brand:'Third',name:'Bread',type:'bread'}];
 const ordered=orderFlourCatalogue(entries,['b']);a.deepEqual(ordered.map(f=>f.id),['b','a','c']);a.equal(ordered.filter(f=>matchesFlour(f,'Other T65'))[0].id,'a');a.deepEqual(entries.map(f=>f.id),['a','b','c']);
});
test('selection does not require opening details',()=>{
 const entry={id:'test',brand:'Test',name:'T65',country:'fr',type:'T65',w:220,protein:11};let selected=0;
 const tree=FlourProductButton;
 const html=renderToStaticMarkup(React.createElement(tree,{entry,onChoose:()=>selected++,selected:true}));
 a.match(html,/aria-pressed="true"/);a.match(html,/Farine sélectionnée/);a.match(html,/Photo et détails/);
 const source=fs.readFileSync('app/components/FlourCatalogueBrowser.tsx','utf8');a.match(source,/aria-pressed=\{selected\} onClick=\{onChoose\}/);
});
test('initial catalogue has visible facets and inline expansion rather than a hidden catalogue mode',()=>{
 const html=renderToStaticMarkup(React.createElement(Catalogue,{recommendedIds:['caputo_pizzeria'],styleKey:'neapolitan',onChoose:()=>{},onGeneric:()=>{},onScan:()=>{}}));
 a.equal((html.match(/<select/g)||[]).length,3);a.doesNotMatch(html,/<details|Voir les 244|Pour votre style/);a.match(html,/Choix populaires/);a.match(html,/Afficher plus de farines/);a.match(html,/Scanner mon sac/);
});
