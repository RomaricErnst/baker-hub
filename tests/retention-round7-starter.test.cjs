const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('./load-production.cjs');
const {planIntermediateFeeds,restStretchFactor}=require('../app/utils/starterPeak.ts');
const {sharedStarterFeedFor,sharedFeedLine,starterEventsWithSharedFeed}=require('../app/utils/sharedStarter.ts');
const {starterBuild}=require('../app/utils/starterBuild.ts');
// 20 Nov 2026 retention round 7 (starter track). Local times: run under any TZ, the night window is checked by hour.
const H=3600000;
const picker=fs.readFileSync(require.resolve('../app/components/SchedulePicker.tsx'),'utf8');
const page=fs.readFileSync(require.resolve('../app/[locale]/page.tsx'),'utf8');
const at=(y,m,d,h,mi=0)=>+new Date(y,m-1,d,h,mi);

test('B3: from a rest, intermediate feeds are placed back from the pre-mix feed',()=>{
 // A counter starter fed Mon 6:00, pre-mix feed Thu 10:00, 22 °C-like rise: adjPeakH 9, spacing 11.25 h.
 const fed=at(2026,11,2,6),preMix=at(2026,11,5,10),now=at(2026,11,2,10),adj=9,spacing=11.25;
 const forward=planIntermediateFeeds(fed,preMix,spacing,0,adj,now);
 const back=planIntermediateFeeds(fed,preMix,spacing,0,adj,now,1,true);
 assert.equal(forward.length,2);assert.equal(back.length,2);
 // Forward: both feeds early on, the pre-mix after a day and a half on the counter.
 assert.ok((preMix-forward.at(-1))/H>30,'forward leaves a long rest before the pre-mix');
 // Backward: the pre-mix follows a regular cadence (the rest ladder's 1.05 step at most).
 const rest=(preMix-back.at(-1))/H;
 assert.ok(rest<=adj*1.5,'pre-mix one cadence after the last feed: '+rest);
 assert.ok(restStretchFactor(rest,adj,adj*1.8)<=1.05);
 // Each feed waits for the previous one's peak, at least 6 h apart, in waking hours (7:00–23:00).
 const chain=[...back,preMix];
 for(let i=1;i<chain.length;i++){assert.ok(chain[i]-chain[i-1]>=Math.max(6,adj*0.75)*H);assert.ok(chain[i-1]+adj*H<=chain[i]+15*60000);}
 for(const t of back){const h=new Date(t).getHours();assert.ok(h>=7&&h<=22,'waking hours: '+new Date(t));assert.equal(t%(15*60000),0);}
});

test('B3: a chain already on cadence, or after a planned refresh, is placed as before',()=>{
 const start=at(2026,11,2,8),now=at(2026,11,2,7),adj=9,spacing=11.25;
 // Two cadences to the next major feed: forward already ends one cadence before it.
 const next=start+2*spacing*H;
 assert.deepEqual(planIntermediateFeeds(start,next,spacing,0,adj,now,1,true),planIntermediateFeeds(start,next,spacing,0,adj,now));
 // fromRest false (a planned refresh, a fridge-kept starter): the established forward placement.
 const far=at(2026,11,5,10);
 assert.deepEqual(planIntermediateFeeds(start,far,spacing,0,adj,now,1,false),planIntermediateFeeds(start,far,spacing,0,adj,now));
 // The solver places back only for a counter starter from its last recorded feed.
 assert.ok(/firstIntermediateStretch\(cand\), restRules\(\) && !_starterRefeedTime && starterLocation !== 'fridge'\);/.test(picker));
});

test('B3: the rest stretch applies to counter starters too (one model for every path)',()=>{
 assert.ok(/function restRules\(\): boolean \{ return planningMode === 'last_fed'; \}/.test(picker),'no fridge-only gate on the rest rules');
 assert.ok(!/starterLocation !== 'fridge' \|\| !lastFedTime\) return preMix;/.test(picker),'the pre-mix bell stretch has no fridge-only gate');
 assert.ok(!/!_bridgeRefreshMs && starterLocation === 'fridge' && planningMode === 'last_fed' \? refreshStretch/.test(picker),'nor the first intermediate bell');
 // The shared placement is the solver's: no private copy of planIntermediateFeeds in the picker.
 assert.ok(!/function planIntermediateFeeds\(/.test(picker)&&/planIntermediateFeeds, preMixRiseH/.test(picker));
});

test('Task 2: a pinned mix the busy times no longer allow stays on screen with the nearest mix that works',()=>{
 assert.ok(/function nearestKeptMix\(/.test(picker));
 assert.ok(/if\(!foundValid&&overrides\.mix!=null&&\+pendingStart===overrides\.mix&&completedMixAt===undefined&&!execution&&displayStarterEvents\.length\)/.test(picker),'only for a pinned, unstarted plan on screen');
 assert.ok(/const pinWithoutPlan=isSourdough&&completedMixAt===undefined&&!execution&&manualTimes\.mix!=null/.test(picker),'a pin with no plan reaching it keeps the editor');
 assert.ok(/data-unkept-pin/.test(picker)&&(picker.match(/data-nearest-mix/g)||[]).length===2,'in the clash card, else in the editor');
 assert.ok(/const notice=pinUnkept&&simpleDecisionPending\?undefined:/.test(picker),'never both');
 // One statement: no step list and no per-row note beside it; Return to recommended times stays in the header.
 assert.ok(/simpleDecisionPending\|\|pinUnkept\|\|mode==='simple'/.test(picker));
 assert.ok(/no longer fits your busy times\./.test(picker)&&/ne s’accorde plus avec vos indisponibilités\./.test(picker));
 assert.ok(!/no longer fits your busy times[^`]*!/.test(picker),'no alarm punctuation');
});

const campagne={id:'a',name:'the campagne',feedAt:at(2026,11,21,8),peakAt:at(2026,11,21,17),mixAt:at(2026,11,21,17),ratio:2,need:{mid:100,max:110}};
const baguettes={id:'b',name:'the baguettes',feedAt:at(2026,11,21,9,30),peakAt:at(2026,11,21,18,30),mixAt:at(2026,11,21,18),ratio:2,need:{mid:100,max:110}};
const now=at(2026,11,20,20);

test('B5: two bakes on one jar share the earlier pre-mix feed when the later mix is in its ready window',()=>{
 const fromBaguettes=sharedStarterFeedFor(baguettes,[campagne],now);
 const fromCampagne=sharedStarterFeedFor(campagne,[baguettes],now);
 assert.ok(fromBaguettes&&fromCampagne);
 // Both bakes see the same feed: the campagne's, at its ratio, sized for both.
 assert.equal(fromBaguettes.at,campagne.feedAt);assert.equal(fromCampagne.at,campagne.feedAt);
 assert.equal(fromCampagne.leads,true);assert.equal(fromBaguettes.leads,false);
 const one=starterBuild(100,110,2);
 assert.deepEqual(fromBaguettes.build,{seed:2*one.seed,flour:2*one.flour,water:2*one.water,total:2*one.total});
 assert.equal(sharedFeedLine(fromBaguettes,false,g=>g+' g'),`Feed 1:2:2 for both bakes · ${2*one.total} g: ${one.total} g for the campagne, ${one.total} g for the baguettes`);
 assert.equal(sharedFeedLine(fromBaguettes,true,g=>g+' g'),`Rafraîchir 1:2:2 pour les deux fournées · ${2*one.total} g : ${one.total} g pour the campagne, ${one.total} g pour the baguettes`);
});

test('B5: no shared feed outside the ready window, for past feeds, or with no other bake',()=>{
 const late={...baguettes,mixAt:at(2026,11,21,22),feedAt:at(2026,11,21,13),peakAt:at(2026,11,21,22)};
 assert.equal(sharedStarterFeedFor(late,[campagne],now),null,'a mix 5 h after the shared peak builds its own levain');
 assert.equal(sharedStarterFeedFor(baguettes,[{...campagne,feedAt:now-H,peakAt:now+8*H}],now),null,'a feed already done is not planned again');
 assert.equal(sharedStarterFeedFor(baguettes,[],now),null);
});

test('B5 rule B: one bake keeps its plan untouched (same array); the following bake drops its own feeds before the shared one',()=>{
 const events=[{kind:'last_fed',time:new Date(now-10*H),isPast:true},{kind:'intermediate_refresh',time:new Date(at(2026,11,20,22))},{kind:'pre_mix',time:new Date(baguettes.feedAt),bellPeakTime:new Date(baguettes.peakAt)}];
 assert.equal(starterEventsWithSharedFeed(events,null,now),events);
 const leads=sharedStarterFeedFor(campagne,[baguettes],now);
 assert.equal(starterEventsWithSharedFeed(events,leads,now),events,'the bake that leads keeps its plan');
 const follows=starterEventsWithSharedFeed(events,sharedStarterFeedFor(baguettes,[campagne],now),now);
 assert.deepEqual(follows.map(e=>[e.kind,+e.time]),[['last_fed',now-10*H],['pre_mix',campagne.feedAt]]);
 assert.equal(+follows[1].bellPeakTime,campagne.peakAt);
 // The page computes nothing without another bake: the guide gets the plan's own array.
 assert.ok(/const others=otherStarterUses\(\);if\(!others\.length\)return null;/.test(page));
 assert.ok(/starterEvents=\{guideStarterEvents\} sharedStarterFeed=\{sharedFeedNote\}/.test(page));
});

test('Task 4: a saved plan the model does not re-derive is judged as shown; no plan is never "a past preparation"',()=>{
 assert.ok(/if\(!derived\.valid&&recipeGenerated&&completedMixAt===undefined&&!execution&&savedStarterEvents\.length&&displayStarterEvents\.length\s*&&\+pendingStart===\+startTime&&eatTime!=null&&\+pendingEatTime===\+eatTime\)\{\s*const asShown=validateKeptStarterPlan\(candidateBlocks\);\s*if\(asShown\.valid\)return asShown;/.test(picker),'only the saved plan, only when valid as shown');
 assert.ok(/:result&&\(!historyKept\|\|!noNewPastActions\)\|\|validation\.reason==='date'/.test(picker));
});
