# Sourdough — Unified Peak-Model Pass (handoff)

Status: proposed refactor. The engine is currently in a good, validated state
(all sourdough plans align starter peak with mix within tolerance across a
16/24/32°C × fridge/RT × fed-state matrix). This pass removes the last source of
per-family drift and makes the whole engine derive one peak, cleanly.

Repo: github.com/RomaricErnst/baker-hub · engine file: app/components/SchedulePicker.tsx
Gate: `npx tsc --noEmit` (+ `node scripts/check-i18n.js` if messages touched).
Vercel is the build gate; a failed build never replaces live. Commit as
Romaric Ernst <romaric.ernst@gmail.com>. Engines are never edited via sed /
static analysis — un-export only, and gather sweep evidence for every branch.

## The problem this solves

The sourdough solver has several candidate "families":
peak1, peak2A (trough-feed), peak2B (refeed-now), fridge-hold Path B,
fridge-scan, bridge. Each computes TWO peak times that must be identical but
historically weren't:

- a SCORING peak — used to decide the green/yellow pill, computed during
  candidate generation (`peakHBF` passed to `starterScore`/`combinedScore`);
- a DISPLAY peak — the chart bell (`bellPeakTime`) and the card "Peak around…"
  / PEAK row.

They drifted because different code paths applied different stretch factors to
`adjPeakH`: bare `adjPeakH`, `adjPeakH × _refreshStretchFactor`, or
`adjPeakH × _preMixStretchFactor`. When the scoring peak was more optimistic
than the display peak, the pill went green while the bell peaked hours later
= FALSE GREEN (starter shown "ready at mix" while still rising).

This session fixed it family-by-family (peak1, fridge-revival branch of
deriveStarterPeakTime, RT-depleted branch, peak2B). The KNOWN remaining one is
peak2A (trough-feed), left unchanged on purpose: its display uses a different
stretch and a blind edit risked introducing a new mismatch. It currently
produces within-tolerance results, but it is not derived from the same peak as
its bell.

## The fix

Replace the scattered inline peak math with ONE helper, e.g.:

    computeStarterPeak(feedMs: number, state: 'refresh' | 'preMix' | 'healthy'): number

returning `feedMs + adjPeakH × stretch(state) × 3600000`, where `stretch` reads
a SINGLE table (the one already encoded in `_refreshStretchFactor`, ~line 3205,
based on hoursSinceFeed vs adjPeakH/troughH). Then wire it everywhere:

1. Every candidate family computes its scoring `peakHBF` from this helper
   (peak1, peak2A, peak2B, fridge-scan, Path B, bridge) — candidate scans are
   roughly lines 3530–4060.
2. The event builder's bell (`bellPeakTime`) and the card PEAK row read the
   SAME helper — event builder ~lines 2790–2940 (the refreshStretch /
   preMixStretch bell math).
3. `deriveStarterPeakTime` (~lines 2112–2340) uses it too, so its returned
   `peakTime` (which seeds peak1 scoring) matches.

Result: scoring peak ≡ bell peak ≡ card PEAK, for every family, by
construction. The pill is honest everywhere; no per-path drift possible.

Key existing anchors already computed and in scope in
findOptimalPositionSourdough:
- `adjPeakH` (temperature-adjusted peak hours)
- `_refreshStretchFactor` (declining/depleted stretch table, ~3205)
- `_adjPeakH_refresh = adjPeakH × _refreshStretchFactor` (~3230)
- `_preMixStretchFactor` (~2518, inside buildAndSetResult scope — check scope
  before reusing; may need lifting or recomputation)
- `troughH`, `warmupH`

Watch item: peak2A's "feed" can be a future trough OR effectively "now" (when
the trough lands ~now for a days-old starter). Its correct stretch is the
depletion stretch at feed time — align it to whatever the bell for that event
draws. Determine the bell's actual stretch for the peak2A/next-feed event
before choosing (do not assume refresh vs preMix).

## Fixes already shipped this session (do not redo)

- Degenerate <3h fridge excursion suppressed (computeNonPathBFridgeTimes).
- False "not enough time" pill fixed; windowTooShort copy corrected.
- Drag hint moved under the chart, softened to an invitation.
- peakTime uses the refresh bell's peak BEFORE the fridge-warmup fiction; fridge
  branches gated on a real render hold (_renderFridgeOutMs).
- Honest revival peak (refresh stretch) in deriveStarterPeakTime's fridge-revival
  and RT-depleted branches; peak2B scoring peak uses _adjPeakH_refresh.
- Past bake time no longer crashes (NaN-guarded toISOString keys + blocker
  helpers); calm "already passed" note during FRESH planning only
  (!recipeGenerated && !sessionRestored) so committed/resumed plans freeze.

## Test methodology (reuse — this is the regression gate)

Drive the LIVE site (bakerhub.app) via the Claude-in-Chrome extension:
- `window.confirm = () => true;` and `window.__bhTrace = []` before each run.
- Navigate Pain → Levain → scheduler (the deferred-tool ToolSearch loads the
  chrome MCP; batch the core tools in one call).
- Sweep: temp {16,24,32} × location {fridge, RT} × fed {today, yesterday,
  2-3 days, week} × horizon {Mon 6pm, Tue 6pm, tight same-day}.
- Per scenario capture: family (from __bhTrace), the card "Peak around …" vs
  "Start Dough …" (compute gap in hours), the pill text, and the chart bell
  x-position vs the Start-Dough diamond (decode the SVG axis: midnight day
  labels give px/hour; map x→time). Cross-check: card PEAK ≡ bell ≡ scoring.
- A temporary __bhTrace diagnostic (extra dbg_* fields on the trace push, ~line
  3036) gives exact runtime peak/mix/stretch values — add for the pass, REMOVE
  before the final commit.
- Pass criteria: every gap within TOL (fridge 2.0×ftm, RT ~adjPeakH×0.15
  clamped 1.0–3.0), green pill only when the starter is genuinely at/near peak
  at mix, no family regresses vs the pre-pass baseline, warm-kitchen cases stay
  green. Capture a baseline table BEFORE, then diff AFTER.

## Scoring reference (unchanged, for context)

combinedScore = (ss + ds)*100 + retardBonus*(retardW+tangW) + mixComfort*2
              + feedComfort*3
- starterScore(mixHBF, peakHBF): gap ≤ TOL → 2; ≤ TOL+1.5 → 1; else 0.
  (mix BEFORE peak, i.e. mixHBF > peakHBF, gets TOL+0.5 — the safer side.)
- Green pill requires best.sscore === 2 AND foundValid.

The whole point of the pass: make `peakHBF` in every family equal the bell, so
sscore=2 (green) is true only when the starter really is within TOL of peak at
the chosen mix.
