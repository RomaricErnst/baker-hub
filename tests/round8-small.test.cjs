// 21 Nov 2026 round 8 (small track): S4 the poolish sentence, S6 one jar for two bakes (home row, starter card,
// shopping, recorded feeds), S8 fridge times on the quarter hour, M3 the baguette apprêt sentence (about-science).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
require('./load-production.cjs');
const {sharedStarterFeedFor,starterEventsWithSharedFeed,savedStarterUse,carriedJarRecords,starterStepShownTime}=require('../app/utils/sharedStarter.ts');
const {mergeSharedJarRows}=require('../app/lib/localJournal.ts');
const {starterBuild}=require('../app/utils/starterBuild.ts');
const read=f=>fs.readFileSync(require.resolve('../'+f),'utf8');
const page=read('app/[locale]/page.tsx'),recipeOut=read('app/components/RecipeOutput.tsx'),guide=read('app/components/BakeGuide.tsx'),picker=read('app/components/SchedulePicker.tsx');
const H=3600000;
const at=(y,m,d,h,mi=0)=>+new Date(y,m-1,d,h,mi);

test('S4: the direct-dough note no longer says "A poolish needs its own preparation schedule"',()=>{
 const en=JSON.parse(read('messages/en.json')).yeastWarnings.poolishSuggestion,fr=JSON.parse(read('messages/fr.json')).yeastWarnings.poolishSuggestion;
 assert.equal(en,'Beyond {hours}h at room temperature, check the dough regularly.');
 assert.equal(fr,'Au-delà de {hours} h à température ambiante, surveillez régulièrement la pâte.');
 for(const f of ['messages/en.json','messages/fr.json'])assert.doesNotMatch(read(f),/own preparation schedule|propre planning de préparation/);
});

test('S8: a fridge step shows on the quarter hour; feeds keep their time',()=>{
 const d=new Date(2026,10,22,8,2);
 assert.equal(+starterStepShownTime({kind:'fridge_in',time:d}),at(2026,11,22,8,0));
 assert.equal(+starterStepShownTime({kind:'fridge_out',time:new Date(2026,10,22,8,8)}),at(2026,11,22,8,15));
 assert.equal(starterStepShownTime({kind:'pre_mix',time:d}),d,'a feed is not moved');
 // Every place a fridge time shows: the recipe's starter card, the guide's step, the plan/calendar rows, the picker card.
 assert.match(recipeOut,/fmtFull\(starterStepShownTime\(event\)\)/);
 assert.match(guide,/time=\{starterStepShownTime\(event\)\}/);
 assert.match(page,/at:starterStepShownTime\(event\),label,alertBeforeMin/);
 assert.equal((picker.match(/fmtCardDT\(starterStepShownTime\(ev\), isFr\)/g)||[]).length,2);
});

// Priya: the pain au levain (planned first) and the pizzas share one jar, both pre-mix feeds Friday 19:30.
const levain={id:'a-levain',createdAt:at(2026,11,21,9),session:{yeastType:'sourdough',levainNeed:{mid:39,max:45},startTime:at(2026,11,28,8,45),nextFeedRatio:1,
 starterEvents:[{kind:'fridge_in',time:at(2026,11,18,16),isPast:true,historicalStorage:true},{kind:'fridge_out',time:at(2026,11,27,18)},{kind:'pre_mix',time:at(2026,11,27,19,30),bellPeakTime:at(2026,11,28,9,15),feedingRatio:1}],
 starterFeedRecords:[]}};
const pizza={id:'b-pizza',createdAt:at(2026,11,21,10),session:{yeastType:'sourdough',levainNeed:{mid:105,max:110},startTime:at(2026,11,28,7,30),nextFeedRatio:1,
 starterEvents:[{kind:'fridge_in',time:at(2026,11,19,8,2),isPast:true,historicalStorage:true},{kind:'fridge_out',time:at(2026,11,27,18)},{kind:'pre_mix',time:at(2026,11,27,19,30),bellPeakTime:at(2026,11,28,9,15),feedingRatio:1}],
 starterFeedRecords:[]}};
const now=at(2026,11,27,12);

test('S6: a saved bake is a jar use; the pair holds after the shared feed only when both were planned before it',()=>{
 const L=savedStarterUse(levain,'the levain loaf'),P=savedStarterUse(pizza,'the pizzas');
 assert.equal(L.feedAt,at(2026,11,27,19,30));assert.equal(L.events.length,3);assert.ok(L.events[0].time instanceof Date);
 const fromP=sharedStarterFeedFor(P,[L],now),fromL=sharedStarterFeedFor(L,[P],now);
 assert.equal(fromL.leads,true);assert.equal(fromP.leads,false);assert.equal(fromP.otherId,'a-levain');
 // What stays in the jar once both doughs took theirs.
 const a=starterBuild(39,45,1),b=starterBuild(105,110,1);
 assert.equal(fromP.keep,a.total+b.total-39-105);
 // Friday 21:00: the shared feed is done, both mixes ahead, both bakes planned before it: still one feed.
 const later=at(2026,11,27,21);
 assert.ok(sharedStarterFeedFor(P,[L],later),'kept after the feed');
 // A bake planned after the other bake's feed was done never claims it.
 assert.equal(sharedStarterFeedFor({...P,createdAt:at(2026,11,27,20)},[L],later),null);
 assert.equal(sharedStarterFeedFor({...P,createdAt:undefined},[L],later),null);
 // Bakes older than levainNeed never share.
 assert.equal(savedStarterUse({...pizza,session:{...pizza.session,levainNeed:undefined}},'x'),null);
});

test('S6: the bake that follows shows the jar\'s own steps and fridge dates, then its own after the shared feed',()=>{
 const L=savedStarterUse(levain,'the levain loaf'),P=savedStarterUse(pizza,'the pizzas');
 const shared=sharedStarterFeedFor(P,[L],now);
 const own=P.events;
 const shown=starterEventsWithSharedFeed(own,shared,now,L.events);
 assert.deepEqual(shown.map(e=>[e.kind,+e.time,!!e.jar]),[['fridge_in',at(2026,11,18,16),true],['fridge_out',at(2026,11,27,18),true],['pre_mix',at(2026,11,27,19,30),false]]);
 assert.equal(+shown[2].bellPeakTime,shared.peakAt);
 // The leading bake keeps its own array; with one bake nothing changes (rule B).
 const lead=sharedStarterFeedFor(L,[P],now);
 assert.equal(starterEventsWithSharedFeed(L.events,lead,now,P.events),L.events);
 assert.equal(starterEventsWithSharedFeed(own,null,now,L.events),own);
});

test('S6: a feed recorded in one bake is done in the other (jar steps up to the shared feed only)',()=>{
 const rec={kind:'pre_mix',plannedAt:at(2026,11,27,19,30),actualAt:at(2026,11,27,19,30),recordedAt:at(2026,11,27,19,31),ratio:1,stated:false};
 const after={kind:'refresh',plannedAt:at(2026,11,28,20),actualAt:at(2026,11,28,20),recordedAt:0,ratio:1};
 const L=savedStarterUse({...levain,session:{...levain.session,starterFeedRecords:[rec,after]}},'the levain loaf'),P=savedStarterUse(pizza,'the pizzas');
 const shared=sharedStarterFeedFor(P,[L],now);
 assert.deepEqual(carriedJarRecords(shared,L),[rec]);
 assert.deepEqual(carriedJarRecords(null,L),[],'no shared feed, nothing carried');
 // The page counts them in the guide's ticks and in the feed question; a jar feed is recorded, never re-planned here.
 assert.match(page,/const shownFeedRecords=jarRecords\.length\?\[\.\.\.starterFeedRecords,\.\.\.jarRecords\]:starterFeedRecords;/);
 assert.match(page,/overdueStarterFeed\(guideStarterEvents,shownFeedRecords,executionClock,\+startTime\)/);
 assert.match(page,/if\(!starterEvents\.includes\(feedEvent\)\)\{/);
});

const row=(entry,at,label)=>({entry,at,label,current:false});
test('S6: home shows one row for the jar\'s step, naming both bakes; the other bake keeps a row for its next step; rule B',()=>{
 const rows=[row(levain,at(2026,11,27,18),'Take starter out of the fridge'),row(pizza,at(2026,11,27,18),'Take starter out of the fridge')];
 const merged=mergeSharedJarRows(rows,now);
 assert.equal(merged.filter(r=>r.label==='Take starter out of the fridge').length,1,'one row for the jar');
 assert.equal(merged[0].entry.id,'a-levain');assert.deepEqual(merged[0].jarWith.map(e=>e.id),['b-pizza']);
 // The pizzas stay one tap away: their own row, at their mix (no guide snapshot here), after the jar's step.
 assert.equal(merged.length,2);assert.equal(merged[1].entry.id,'b-pizza');assert.equal(merged[1].at,at(2026,11,28,7,30));assert.equal(merged[1].label,null);assert.ok(!merged[1].jarWith);
 // A follower whose stale guide still names its own fridge step at another time joins too (its own starter step).
 const stale={...pizza,session:{...pizza.session,starterEvents:pizza.session.starterEvents.map(e=>e.kind==='fridge_out'?{...e,time:at(2026,11,27,17)}:e)}};
 assert.equal(mergeSharedJarRows([rows[0],row(stale,at(2026,11,27,17),'Take starter out of the fridge')],now).filter(r=>r.jarWith).length,1);
 // After the jar's steps (the pizza's own dough step) the rows stay as they are.
 const apartAfter=[rows[0],row(pizza,at(2026,11,28,7,30),'Start Dough')];
 assert.equal(mergeSharedJarRows(apartAfter,now),apartAfter);
 // One sourdough bake (or bakes that do not share): the same array.
 const one=[rows[0]];assert.equal(mergeSharedJarRows(one,now),one);
 const far={...pizza,session:{...pizza.session,startTime:at(2026,11,29,18),starterEvents:pizza.session.starterEvents.map(e=>e.kind==='pre_mix'?{...e,time:at(2026,11,29,8),bellPeakTime:at(2026,11,29,17)}:e)}};
 const apart=[rows[0],row(far,at(2026,11,27,18),'Take starter out of the fridge')];assert.equal(mergeSharedJarRows(apart,now),apart);
 assert.match(page,/mergeSharedJarRows\(rows, Date\.now\(\), locale\)\);/);
 // Round 9 (N): the names go through jarRowName (two of the same name read once, "· both bakes").
 assert.match(page,/const jarEntries = \[row\.entry, \.\.\.\(row\.jarWith \?\? \[\]\)\];\n\s*const name = jarRowName\(jarEntries\.map\(nameOf\), locale\);/);
});

test('S6: the starter card and the shopping list follow the shared feed',()=>{
 // Card: the shown events (jar steps) and the shared line in place of the bake's own feed; the jar's rest after both.
 assert.equal((page.match(/starterEvents=\{guideStarterEvents\} sharedStarterFeed=\{sharedFeedNote\} mixingTime=\{startTime\}/g)||[]).length,2);
 assert.match(recipeOut,/sharedStarterFeed && \+event\.time === sharedStarterFeed\.at \? sharedStarterFeed\.line : describeFeed/);
 // Your plan's starter strip reads the same shown feeds.
 assert.match(page,/<StarterStrip events=\{guideStarterEvents\} mixAt=\{startTime\}/);
 assert.match(recipeOut,/const starterLeft = sharedStarterFeed \? sharedStarterFeed\.keep :/);
 // Shopping: the feeds this bake shows, the jar's earlier steps not counted again, the shared feed at its ratio.
 assert.match(page,/return guideStarterEvents\.filter\(event => !event\.isPast && !\(event as \{jar\?:boolean\}\)\.jar/);
 // Computed before the card, the list and the question read it (no use before declaration: `fr` is read as locale).
 assert.ok(page.indexOf('const sharedStarterPair =')<page.indexOf('const starterFeedFlour = useMemo'));
 assert.ok(page.indexOf('const sharedStarterPair =')<page.indexOf('const missedStarterFeed='));
 const code=t=>t.replace(/\/\/.*$/gm,'');
 const block=code(page.slice(page.indexOf('const sharedStarterPair ='),page.indexOf('const sharedFeedNote =')));
 assert.doesNotMatch(block,/(?<!['\w])fr(?!['\w])|styleDisplayName/);
 const fn=code(page.slice(page.indexOf('function otherStarterUses()'),page.indexOf('// Other bakes under way on this device that use the oven')));
 assert.doesNotMatch(fn,/(?<!['\w])fr(?!['\w])|styleDisplayName/,'called before fr and styleDisplayName are declared');
});
