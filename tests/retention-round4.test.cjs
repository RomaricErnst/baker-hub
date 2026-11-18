const {test}=require('node:test'),assert=require('node:assert/strict');
require('./load-production.cjs');
// 18 Nov 2026 retention round 4 (flow).
const {clockMark,rowStep}=require('../app/utils/guideProgress.ts');
const {overdueStarterFeed}=require('../app/utils/bakeExecution.ts');
const {translateGuideTitle}=require('../app/utils/guideTitles.ts');
const m=60000,h=3600000,T=Date.UTC(2026,10,20,17,30);

test('a mix and its rise planned at the same minute: the unticked mix is Now, never the rise',()=>{
 const steps=[{step:1,at:T-9*h,action:true,done:false},{step:2,at:T,action:true,done:false},{step:3,at:T,action:false,done:false},{step:4,at:T+5*h,action:true,done:false}];
 assert.deepEqual(clockMark(steps,T+5*m),{step:2,kind:'now',held:false});
 // Ticked: the rise is next in line at that minute.
 assert.equal(clockMark(steps.map(s=>s.step===2?{...s,done:true}:s),T+5*m).step,3);
});

test('home row: the next thing to do, nearest now, never a wait or a step long past',()=>{
 const steps=[{step:1,at:T-5*h,action:true,done:false},{step:2,at:T+20*m,action:true,done:false},{step:3,at:T+50*m,action:false,done:false}];
 assert.deepEqual(rowStep(steps,T),{step:2,current:false});
 const proof=[{step:1,at:T-2*h,action:true,done:true},{step:2,at:T-h,action:false,done:false},{step:3,at:T+h,action:true,done:false}];
 assert.deepEqual(rowStep(proof,T),{step:3,current:false});
 assert.deepEqual(rowStep([{step:1,at:T-h,action:false,done:false}],T),{step:1,current:true});
});

test('an unanswered pre-mix feed is asked until the mix, not until the next starter event',()=>{
 const pre={kind:'pre_mix',time:new Date(T-9*h)};
 const events=[{kind:'last_fed',time:new Date(T-60*h)},pre];
 assert.equal(overdueStarterFeed(events,[],T-h,T),pre);
 assert.equal(overdueStarterFeed(events,[],T+5*m,T),undefined);
 // Without the mix it stayed (the round-4 bug).
 assert.equal(overdueStarterFeed(events,[],T+5*m),pre);
});

test('guide titles cross languages for a home row',()=>{
 assert.equal(translateGuideTitle('Feed your starter','fr'),'Rafraîchir le levain');
 assert.equal(translateGuideTitle('Préchauffer le four','en'),'Preheat the oven');
 assert.equal(translateGuideTitle('Pre-mix feed','fr'),'Rafraîchi avant pétrissage');
 assert.equal(translateGuideTitle('Something else','fr'),'Something else');
});
