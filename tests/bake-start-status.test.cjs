const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require('./load-production.cjs');
require.extensions['.tsx']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const Status=require('../app/components/BakeStartStatus.tsx').default;
const Feed=require('../app/components/StarterFeedStatus.tsx').default;
const NOW=Date.parse('2030-04-01T12:00Z'),plannedAt=NOW-3600000;
function render(overrides={}){
 const props={fr:false,method:'none',plannedAt,now:NOW,preparing:false,onMade(){},onNotYet(){},onRecipe(){},onNext(){},onUndo(){},...overrides};
 return renderToStaticMarkup(React.createElement(Status,props));
}
test('overdue preparation asks one question with one yes and one not-yet action in both languages',()=>{
 for(const fr of [false,true])for(const method of ['none','poolish','biga'])for(const preparing of [false,true]){
  const html=render({fr,method,preparing});
  // Same day in FR: "Oui, à 11h00" (18 Nov 2026 retention round 3).
  assert.equal((html.match(fr?/Oui, à/g:/Yes, at/g)||[]).length,1);
  assert.equal((html.match(fr?/Pas encore/g:/Not yet/g)||[]).length,1);
  assert.doesNotMatch(html,/Made now|Préparé maintenant|Mixed now|Pétrie maintenant|Start mixing now|Commencer le pétrissage maintenant/,'the overdue question must not offer competing completion actions');
 }
});
test('future preparation does not interrupt recipe viewing; a recorded fact does not ask again',()=>{
 assert.equal(render({plannedAt:NOW+3600000}), '');
 const execution={method:'none',actualAt:plannedAt,recordedAt:NOW,inFridge:false,prefHours:0,recipe:{flour:1000,water:620,salt:25,totalDough:1645}};
 for(const preparing of [false,true]){
  const html=render({execution,preparing});
  // In Preparation the recorded fact is said on its step (Completed · time, Change time): no strip.
  if(preparing){assert.equal(html,'');continue;}
  assert.doesNotMatch(html,/Have you mixed|Not yet|Yes, at/);
  assert.match(html,/Change time/);
  assert.match(html,/Undo completion/);
  if(preparing)assert.doesNotMatch(html,/Go to preparation|Next step/,'already in preparation: no self-navigation action');
 }
});
test('missed starter feed asks one equivalent question without an additional confirmation',()=>{
 for(const fr of [false,true]){
  const html=renderToStaticMarkup(React.createElement(Feed,{fr,plannedAt,onFed(){},onNotYet(){}}));
  assert.match(html,fr?/Avez-vous rafraîchi le levain/:/Have you fed the starter/);
  assert.equal((html.match(fr?/Oui, le/g:/Yes, at/g)||[]).length,1);
  assert.equal((html.match(fr?/Pas encore/g:/Not yet/g)||[]).length,1);
  assert.doesNotMatch(html,/dialog|Are you sure|Êtes-vous sûr/);
 }
});


test('planned mixing uses one completed action, without a separate start or finish flow',()=>{
 for(const fr of [false,true]){
  assert.equal(render({fr,method:'none',plannedAt:NOW+30*60000+1,preparing:true}), '');
  const html=render({fr,method:'none',plannedAt:NOW+30*60000,preparing:true});
  assert.equal((html.match(fr?/Pétrie maintenant/g:/Mixed now/g)||[]).length,1);
  assert.doesNotMatch(html,/Start mixing|Finish mixing|Commencer le pétrissage|Terminer le pétrissage|Yes, at|Oui, le/);
 }
});
// 16 Nov 2026 retention review: at the planned minute the honest answer is "starting now".
test('the first 45 minutes after the planned start offer a start, not the did-you question',()=>{
 for(const fr of [false,true]){
  const html=render({fr,plannedAt:NOW-10*60000});
  assert.match(html,fr?/C’est l’heure de pétrir/:/Time to mix the dough/);
  assert.match(html,fr?/Je commence →/:/Start now →/);
  assert.doesNotMatch(html,/Not yet|Pas encore|Have you mixed|Avez-vous pétri/);
  assert.equal(render({fr,plannedAt:NOW-10*60000,preparing:true}),'','in Preparation the step marked Now takes over');
  assert.match(render({fr,plannedAt:NOW-46*60000}),fr?/Avez-vous pétri/:/Have you mixed/);
 }
});

test('another day reads "Oui, le …"; a question the clock has moved past goes (18 Nov 2026 retention round 3)',()=>{
 const html=render({fr:true,plannedAt:NOW-26*3600000});
 assert.match(html,/Oui, le /);
 assert.equal(render({superseded:true}),'','an unanswered question never stays once a later step is Now');
});
