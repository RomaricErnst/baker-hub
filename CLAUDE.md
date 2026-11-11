# Baker Hub — CLAUDE.md
Updated 11 November 2026. Verify the current production deployment against the GitHub merge commit.

Current navigation/design decisions in `PROJECT-HANDOFF.md` and dated audits supersede older examples below. The five destinations are My bake, Recipe, Shopping, Preparation and Baking & service. The step pill opens local setup navigation ("Where you are"), Sections switches destinations, My bake opens on the plan card above "Review my choices" (the recipe bar's "My choices" link goes there), and Adjust timing opens the timing editor. Back controls name their destination: "Previous step" in setup, "Back to my choices" when editing, "Back to Recipe / Shopping list / Preparation / Baking & serving" (FR "Retour à Recette / Courses / Préparation / Cuisson & service") between sections. The calendar export lives on the Preparation summary. Show setup details in the local step summary. CI and browser results must identify the tested commit; a successful build alone does not certify the journeys.

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
--terra #C4522A primary CTA (sparingly) · --cream #F5F0E8 page bg · --warm #FDFBF7 cards
--char #1A1612 text · --ash #3D3530 · --smoke #8A7F78 secondary · --border #E8E0D5
--sage #6B7A5A success · --gold #D4A853 trust · --bread #8B6914 bread accent
Cards 18px radius, shadow 0 2px 12px rgba(26,22,18,0.06) · buttons 12px · inputs 8px · pills 20px
90/10 rule: 90% neutrals, ≤10% accent. Sliders: blue slow · sage sweet spot · gold adventurous · coral challenging.

## File Map
app/
  [locale]/page.tsx     — main flow: family, style, quantity, bake time and optional availability, then Simple recipe or Custom settings; review, editing and session restoration
  api/flour-scan/route.ts — AI flour scanner (server-side, model via ANTHROPIC_VISION_MODEL env)
  auth/callback/route.ts
  data.ts               — styles (name/nameFr/descFr), ovens, mixers, yeasts, preferments
  utils.ts              — yeast engine, schedule engine, DDT, recipe calculator, formatTime(d, locale)
  utils/units.ts        — g/°C ↔ oz/°F (weights <6 g stay grams in imperial)
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
The water-temperature balance includes flour, starter or preferment, thermal input from kneading, and the heat of melting ice. A levain's flour and water are already inside the dough's totals; in the balance they sit at the starter's temperature: room temperature after a feed, the warmed temperature (`prefTempAfterWarmup` from fridge to kitchen over the time out) when a fridge starter goes into the dough without another feed, or the baker's measured temperature (Fine-tune), which always wins (`prefTempForBalance` in page.tsx). Use the calculated result for the specific formula. In Simple, keep kneading guidance method-neutral and identify the equipment assumption wherever it affects a water or batch calculation. Custom exposes equipment explicitly.

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

**Fridge-kept starter, distant bake (11 Nov 2026):** `deriveStarterPeakTime` starts the revival in the run-up (cycles + dough + 12 h) when the bake is more than 96 h past the earliest feed, at a time clear of busy periods; `fridge-starter.mjs` asserts no feed in the first 48 h for 216–240 h bakes. Feed labels: the first planned feed is never "intermediate" (`starterFeedLabelFor`).

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
