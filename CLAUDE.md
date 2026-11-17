# Baker Hub — CLAUDE.md
Updated 11 November 2026. Verify the current production deployment against the GitHub merge commit.

Current navigation/design decisions in `PROJECT-HANDOFF.md` and dated audits supersede older examples below. The five destinations are My bake, Recipe, Shopping, Preparation and Baking & service. Since 16 Nov 2026 one bar ("My bake · Quantity", "Preparation · 4 pizzas") opens "Your bake" (`BakeNavigator`): the journey on one line, a ring on where you are, ticks behind, Recipe/Shopping/Preparation/Baking disabled "After your recipe" until it exists, Pizzas/Fillings optional; while My bake is current its answers sit folded in one line under it ("Quantity · 3 of 5", See all opens them, grouped The basics / Customize in Custom). The bar shows the setup step with its count, and after the recipe the plan's next step ("Next: Fold 1, 4:00pm"); Preparation marks the step the clock says you are on (Now, an unticked mix or preferment first) or the next one, and its button becomes "Go to: …" once the plan has started. On Pizzas/Fillings with nothing chosen, "Dough only? Skip to shopping list →" sits above the catalogue and the forward button reads "Shopping list · dough only →" (16 Nov 2026 blind review). Menu keeps the plan actions and the app only. My bake holds the choices only ("Review my choices"; the recipe bar's "My choices" link goes there). Journey map (12 Nov 2026): times change only from the plan — on the Recipe's Your plan, Start Dough (and Make Poolish/biga in Custom) is a tappable time that opens the timing editor inline, and "Update recipe" applies it and regenerates (13 Nov 2026; sourdough's "Change times" and Adjust timing in Preparation open the full editor; Custom shows "Fermentation curve ▾" in place, `planChart`, instead of a link); the Recipe opens on an editable title (automatic "Pizza night/lunch/brunch" from the bake hour, the name alone so it fits one line) and one summary line led by the day; the Bake time row in My bake asks only the bake time and busy times (`bakeTimeQuestion`), and when Custom was reached from the bake-time question (`customBakeQuestion`, persisted) Fine-tune ends Custom with "Create my recipe" (`fineTuneFinishes`): the question is not walked again, and its planner runs on Fine-tune showing only the "Before your recipe" sheet (`.bh-plan-sheet-only`). A clash is asked once: never inline on the bake-time question, but in a "Before your recipe" sheet when the baker taps Generate / Create my recipe (or returns from a bake-time edit); answering it creates the recipe. Customize defers it to the end of the customize steps. The full editor (Change times) still shows clashes where they arise; "See the plan →" opens it when the sheet cannot settle the plan. "Customize my bake" in My bake switches to Custom in place (more rows, same list); there is no mode-choice screen. Plan, buy, prepare: for pizza and breads with fillings the route is Recipe → Pizzas/Fillings (optional; the pizza section is named "Pizzas" since 14 Nov 2026) → Shopping list → Preparation → Baking & serving; toppings have no buttons inside the Recipe, the Shopping list or Preparation (Sections and the oven fallback still reach them; `fillingsReturn.forward` marks the in-journey visit). Every section's bottom bar goes back one section on the left and on to the next on the right (Recipe: My choices · Pizzas → (else Shopping list →); Pizzas: Back to Recipe · Shopping list →; Shopping: Back to Pizzas (else Recipe) · Go to preparation →; Preparation: Back to Shopping list; Baking & serving: Back to Preparation). `tests/mobile/journey-route.spec.cjs` walks the route in EN and FR. Back controls name their destination: "Previous step" in setup, "Back to my choices" when editing, "Back to Recipe / Shopping list / Preparation / Baking & serving" (FR "Retour à la recette / aux courses / à la préparation / à Cuisson & service") between sections; since 14 Nov 2026 they display short ("‹ Recipe", `BackLabel`) with that phrase as the accessible name. The calendar export lives on the Preparation summary. Show setup details in the local step summary. CI and browser results must identify the tested commit; a successful build alone does not certify the journeys.

## NVM / Node Setup
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
npm run dev        # Next.js dev server on http://localhost:3000
npx tsc --noEmit   # type-check — ZERO errors before every commit
npm run build      # must pass before every push (fails in remote sandboxes: Google Fonts blocked — tsc + Vercel build instead)
```

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `'use client'` throughout) |
| Language | TypeScript strict |
| Styling | Existing inline styles, shared globals.css and scoped SandwichParty CSS; avoid unrelated styling migrations during stabilization |
| Fonts | Figtree (`--font-ui`) for UI, explicit Georgia serif stack (`--font-display`) for page titles, DM Mono for formula panels |
| i18n | next-intl — en at `/`, fr at `/fr`, cookie NEXT_LOCALE; build checks both locale key sets and literal translation calls in application code |
| Backend | Supabase (magic link + Google OAuth, bake_events + photos + pizza-party slots) |
| Deploy | Vercel — auto on push to main (~90–120 s); a failed build never replaces the live deployment |

## Design Tokens (CSS vars in `app/globals.css`)
`app/globals.css` is authoritative; these lines mirror it (checked 17 Nov 2026).
--terra #6B4423 primary CTA, crust brown (sparingly; hover --terra-l #8B5A32) · --terra-on-dark #C88A52 dark surfaces only, never on cream
--warm #FDFBF7 page bg (body) and cards · --cream #F0EBE0 bands, selected chips, secondary fills · --paper/--card #FFFFFF inputs
--char #2B2420 text · --ash #3D3530 · --smoke #6B635D secondary · --border #E0D8CC
--sage #6B7A5A success (--sage-text #4F5B42 for text) · --gold #9C8248 marks/borders (--gold-text #7A6332 for text) · --bread #8B6914 bread accent (--bread-l #F5EDD8)
Cards 18px radius, shadow --card-shadow 0 2px 12px rgba(43,36,32,0.06) · buttons 12px · inputs 8px · pills 20px
One brown filled (primary) button per screen; shared button styles in `app/lib/navButtons.ts` (NEXT_CTA, BACK_CTA, SECONDARY_CTA, SHEET_TITLE, SHEET_CLOSE, `oneLineCta` for bottom-bar labels that must not wrap). Selected chips: cream fill + brown border.
90/10 rule: 90% neutrals, ≤10% accent. Sliders: blue slow · sage sweet spot · gold adventurous · coral challenging.

## File Map
app/
  [locale]/page.tsx     — main flow: family, style, quantity, kitchen, bake time and optional availability, then Generate my recipe, with Customize my bake as the optional deeper path (internal 'simple' | 'custom'; never shown to bakers as modes); review, editing and session restoration
  api/flour-scan/route.ts — AI flour scanner (server-side, model via ANTHROPIC_VISION_MODEL env)
  auth/callback/route.ts
  data.ts               — styles (name/nameFr/descFr), ovens, mixers, yeasts, preferments
  utils.ts              — yeast engine, schedule engine, DDT, recipe calculator, formatTime(d, locale)
  utils/units.ts        — g/°C ↔ oz/°F (weights <10 g stay grams in imperial)
  utils/breadNames.ts   — what is being made (Ma brioche, 2 baguettes), oven question, egg count
  utils/planCalendar.ts — .ics export: key steps, close steps merged into one event, cancellations on re-export
  utils/stepWhy.ts      — reasons moved out of step lines into one "Why?"
components/
  SchedulePicker.tsx    — shared timing inputs, validated preparation times, optional Custom curve, sourdough scheduling
  FermentChart.tsx      — event-driven bells/diamonds, premix/postmix fade, width-aware label stagger
  Timeline.tsx          — bake plan steps (single + two-phase)
  RecipeOutput.tsx      — ingredient cards, baker's %, batch splitting, water/ice guidance
  BakeGuide.tsx         — step-by-step guide, 9 oven types, Maestro coach
  PizzaParty.tsx + pizzaParty/ + ToppingSelector.tsx + ShoppingList.tsx — Ma Soirée Pizza (4th tab)
  ShareCard.tsx         — session share: post/square/story exports, photo crops; preview must equal export pixel-for-pixel
  SessionViewer.tsx     — saved-session popup, photos, share
  Header.tsx            — ☰ menu: language, units, MY SESSIONS (resume/rebake/delete), auth
  ClimatePicker / StylePicker / OvenPicker / MixerPicker / PrefermentPicker / FlourPicker / FlourScan / YeastHelper / LearnModal
messages/en.json + fr.json — i18n check script keeps them in sync

## Calculation and display conventions

### Commercial yeast
Room-temperature and cold phases share one fermentation budget. The thermal trajectory includes cooling and rewarming, so brief fridge spells do not immediately count as fully cold. Use regression evidence and published guidance before retuning. Kitchen trials remain necessary for calibration.

Read the implemented room-temperature and cold-fermentation calculations and their numeric regression tests before changing a coefficient. Distinguish extending a bake with cold time from replacing room-temperature time at a fixed bake time. Display the converted amount for the selected yeast. ADY and fresh yeast have different conversions. The 0.5 g threshold flags measurement difficulty. The automatic minimum is 0.05% IDY before an explicit override. The 0.5 g figure flags weighing difficulty.

### Schedule
Single-phase, or two-phase tropical when window ≥16 h AND kitchen ≥28 °C.
15-min rounding · blocker edges EXCLUSIVE (> and <, never >= <=) · default fridge 6 °C · default bake 18h.

### DDT
The water-temperature balance includes flour, starter or preferment, thermal input from kneading, and the heat of melting ice. A levain's flour and water are already inside the dough's totals; in the balance they sit at the starter's temperature: room temperature after a feed, the warmed temperature (`prefTempAfterWarmup` from fridge to kitchen over the time out) when a fridge starter goes into the dough without another feed, or the baker's measured temperature (Fine-tune), which always wins (`prefTempForBalance` in page.tsx). Use the calculated result for the specific formula. In Simple, kneading is assumed by hand and never mentioned on the recipe (12 Nov 2026: the mixer question under Water was removed; a mixer would add only a few degrees of friction, and Custom exposes equipment explicitly). The water line (`waterGuideLine`) says how to reach the temperature without a thermometer — room temperature, a fridge/room split, lukewarm, or ice — and offers "how to get it ▾" only when there are steps (ice, or a measured water source).

### Preferments
Poolish RT 6–14 h, fridge ≤24 h · Biga fridge ≤72 h · Levain = sourdough only.

### Baker overrides (Custom)
A baker-entered yeast amount (direct commercial dough) re-times the plan: `fermentationHoursForYeast` inverts `fermentationBudget` through `buildSchedule`, and the solver, readiness window and chart use that window. Never display an entered amount on a schedule timed for another. Poolish storage can be fixed to fridge or room; 'auto' compares both. Plan-input edits made on other steps reach the scheduler through the page's `planReplanPending` flag, not a change-only effect (the scheduler is unmounted on those steps). A baker-entered starter % (levain) scales the room-temperature bulk by `starterBulkFactor` (Craig's regression against the engine's reference % for the kitchen; exactly 1 without a choice). Every schedule build (`buildSchedule`, draft validation, repair search) and the sourdough solver windows (`starterBulkDeltaH`) must add the same hours. Cold phases are not scaled.

### Custom levain Starter step
The page renders ONE Custom scheduler element (`renderCustomScheduler(section)`): `schedulerSection='starter'` on step 8 shows only the starter card; `'plan'` on step 9 hides it; `'all'` elsewhere. Only one step is mounted at a time, so there is never a second solver instance. Keep starter state lifted in the page.

### Sourdough solver (SchedulePicker)
Isolated from non-sourdough engine (early return). Candidate pools Peak1/2A/2B/fridge-hold, blocker-aware,
fridge revival biology, event-driven chart, traffic-light pills (no red in starter card).
The starter ratio multiplier uses 1 + 0.5 × ln(feed ratio). Keep scoring, card and curve on the same peak estimate.
Compute style defaults LOCALLY inside the solver (stale `_sfDef` closures caused real bugs).

**Peak-model invariant (learned July 2026):** every candidate family must derive ONE peak.
Each family produces a *scoring* peak (drives the green/yellow pill, in candidate generation)
and a *display* peak (chart bell `bellPeakTime` + card "Peak around…"/PEAK row). They MUST be
equal. They drifted because paths applied different stretch to `adjPeakH` (bare vs
`× _refreshStretchFactor` vs `× _preMixStretchFactor`) → scoring more optimistic than the bell
→ FALSE GREEN (starter "ready at mix" while still rising). Every family, peak2A included, now
scores through `computeStarterPeakMs(feedMs, refPeak, adjPeakH)`, the same helper and reference
the pre-mix bell uses. `tests/roundtrip/peak-consistency.mjs` (CI) sweeps 384 temperature ×
location × last-fed × horizon × Nights cases and asserts card PEAK ≡ active bell and that green
means mix within the solver's tolerance of the shown peak. The trace's `scoredPeakMs` may differ
from the shown peak when the render re-aligns a feed onto the mix; the pill is judged on the shown peak.

**Fridge-kept starter, distant bake (11 Nov 2026):** `deriveStarterPeakTime` starts the revival in the run-up (cycles + dough + 12 h) when that leaves more than 24 h before it (16 Nov 2026; was 96 h), at a time clear of busy periods (earlier first, then later within the 12 h margin), with the cycles of the age the starter will have then (`starterAgeAt`: it ages in the fridge); `fridge-starter.mjs` asserts no feed in the first 48 h for 216–240 h bakes. Feed labels: the first planned feed is never "intermediate" (`starterFeedLabelFor`).

**After-work levain, cool kitchen (17 Nov 2026):** three parts, all in the bounded search, never in a free plan.
(1) A fixed-mix probe of a fridge-revival starter with busy times that finds no plan from the bake-relative revival start retries once with the revival started from that mix (`evaluateStarterCandidate` → `probeRevivalFromMixRef` → `fromMix` in `deriveStarterPeakTime`): removal, first feed, the intermediates the solver will place (`planIntermediateFeeds`, shared with `computeIntermediatesForCandidate`) and any fridge spell before the build must be free, so the levain build can sit before work for an evening mix. Plans main already finds are untouched.
(2) `searchStarterCandidate(…, ratios=true)` (requested bake only, from `replanStarter`): when the current last-feed ratio finds no plan, it retries at the other ratios (nearest the baker's usual first; never in 'keep' or with a chosen ratio) through `probeRatioRef`; a probe at a ratio recommends that ratio, so the ratio-apply effect lands on the plan's ratio. The Stage 2 ratio evaluator counts a ratio clear only when its mix's dough steps are clear too (`doughStepsClear`).
(3) Raised levain %: when no plan fits at the default %, `replanCurrentSchedule` tries `raisedStarterPcts` (2.5-point steps above `referenceStarterPct`, ≤ `AUTO_STARTER_MAX_PCT` 30) through `probeBulkFactorRef` (every solver window, draft check and dough check of the probe reads `solverBulkFactor()`/`solverBulkDeltaH()`), smallest first, holding the ratio. Only without a baker-entered % (`canRaiseStarterPct` is absent then) and when `raisedLevainFits`: the levain build's seed (`starterBuild`) must come from the jar a default bake keeps, multiplied by each earlier feed of the plan (a single 1:1:1 build cannot reach 25–30 %). The page stores it as `autoStarterPct` (session + rebake) and `effectiveStarterOverride = starterPctOverride ?? autoStarterPct` drives recipe, DDT, every `buildSchedule` and `levainBulkFactor`; the base search always runs at the default (factor 1), other days (`targetSearch`) too. Kneaded by hand (Simple: autolyse 30 min + mix before bulk) her 19 °C Friday needs ~33 %, so it still offers another day. Tests: `tests/levain-raise.test.cjs`, `tests/roundtrip/levain-raise.mjs`.

**Intermediate refreshes (fixed 3 Nov 2026):** the winner's scored intermediates (`renderIntermediatesMs`) are rendered as-is; never recompute them in the event builder. `tests/roundtrip/fridge-starter.mjs` guards the fridge-kept starter case.

**How to work it (methodology that connects to everything here):** this is engine code — obey the
Multi-engine rule below, never sed, un-export only, gather sweep evidence per branch. Validate on the
LIVE site via the matrix sweep (see Testing): drive Pain→Levain→scheduler with `window.__bhTrace = []`,
sweep temp {16,24,32} × location {fridge,RT} × fed {today…week} × horizon, and for each compare the
card "Peak around…" vs "Start Dough…" (the gap) AND the chart bell x-position vs the Start-Dough
diamond — card ≡ bell ≡ scoring, gap within TOL, no family regresses, warm cases stay green. A temp
`__bhTrace` diagnostic (extra dbg_* on the trace push, ~L3036) gives exact runtime peak/mix/stretch —
add for the pass, REMOVE before the final commit.

### Multi-engine rule (CRITICAL)
Any change to coldH/rtH/preferredColdH/minColdH for a style updates ALL THREE together:
utils.ts STYLE_FERM_DEFAULTS · SchedulePicker.tsx STYLE_FERM_DEFAULTS · FermentChart.tsx sweet-center/sigma constants.

## UX Principles
- Empathetic companion: no red text, no ⚠️, warnings are observations. Info only when actionable.
- Water source-agnostic. "Make Poolish" / "Start Dough" everywhere. FR levain: Rafraîchi/Rafraîchir (never Repas/Nourrir), Pétrissage.
- EN 12 h clock · FR 24 h (18h30) and FR weekdays (dim. lun. …) — formatTime(d, locale).
- Mobile first: instant scrolls only; nothing fixed over the bottom nav; visualViewport guard when keyboard open; deferred date-picker apply on coarse pointers; keep tab content mounted (display:none) — never use timed toasts for hidden-tab changes.
- No step numbers on StepCard. bakeType-aware copy (bread uses bread language). Internal mode strings: 'simple' | 'custom'.

## Supabase & Auth
- Project: mguwsdonfsyioyelseuf (ap-southeast-1) · URL https://mguwsdonfsyioyelseuf.supabase.co
- Anon key in .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY) — NEVER commit .env.local
- Auth: magic link + Google OAuth · callback /auth/callback (prod + localhost)
- bake_events.dough_snapshot = full SessionData JSON (incl. sourdough starter state, activeTab, blocks, startTime)
- localStorage bh_session_v1 mirrors the session for non-signed-in bakers

## Testing (what works)
- Live-site automation: JS click helpers; refs go stale after navigation; form_input for date inputs.
- window.confirm BLOCKS automation and looks like a frozen renderer — override with `window.confirm = () => true` when regenerating saved sessions.
- Cross-check chart SVG ↔ card text ↔ solver props; divergence = bug. Chart ticks are labels, not event times.
- Minified prod stacks: install window error listener BEFORE reproducing; check console timestamps for staleness.
- Sweep matrices via React-fiber injection (window.__audit pattern), then visual spot-check 3–5 scenarios.

## Session-End Checklist
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — clean (local Mac only)
- [ ] Commit as Romaric Ernst <romaric.ernst@gmail.com> · push to main
- [ ] Never commit: .env.local, .claude/settings.local.json, untracked QA .md reports
- [ ] Update CLAUDE.md / PROJECT-INSTRUCTIONS.md if architecture or rules changed


## Credentials
Use authenticated connectors or environment-provided credentials. Keep tokens out of project instructions and committed files. The November follow-up found no GitHub token in the current Markdown files; this does not audit external instructions or Git history.
