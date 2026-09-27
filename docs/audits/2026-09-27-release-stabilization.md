# Release stabilization — 27 September 2026

Target: codex/navigation-polish-20260923 only. No main update or production promotion.

## Confirmed baseline

The supplied fixed-clock harness reproduced six Nights divergences out of twelve
on b78559c (three scenarios in both ratio modes). GitHub run 36293556128 completed
with 335 unit tests and a successful build, but 216 mobile passes and 28 failures.
The latter are seven scenarios repeated across four widths, not 28 unique bugs.

## Corrections

- If the full dough agenda rejects a new automatic starter plan, recompute and
  display the starter recommendation under the new blockers instead of retaining
  an overnight plan from the previous availability. Full-plan validation still
  blocks continuation; an incomplete recommendation is not certified green.
- Explicit timing pins are retained. Notification loop budgets restart for user
  constraint changes, and solver callbacks publish the blocks used in the solve.
- Nights and location round trips now have executable CI coverage using both
  displayed content and parent state. The original matrix reached 0/24 text and
  data divergences locally, with no runtime errors. Final-CI evidence is separate.
- Mobile assertions target the actual style card, omit redundant dough tabs when
  no fillings exist, and compare completion independently of last-visited pages.
- Pizza quantity review has dialog semantics, focus/keyboard handling and focus
  restoration. Its visible review/quantity decision is retained.
- Restore current preparation-hierarchy cases to the active browser suite; add
  night-toggle/reload checks on the real page. Older bottom-tab/graph specs remain
  historical references; they cannot run unchanged against the replacement UI.
- CI covers main pushes and PRs to main, without a branch-only job guard; main
  runs are not cancelled by a subsequent push. Artifact upload uses Node 24.
- French starter terminology uses rafraîchi/rafraîchir; mixing step names use
  pétrissage. Ingredient mixing instructions remain context-specific.
- Explicit --font-display serif stack preserves the approved appearance. The
  repository instructions now describe Figtree UI and serif page headings.

## Release gates and limits

Local unit/TypeScript/build checks and jsdom are not substitutes for WebKit.
The local WebKit executable downloaded, but OS libraries could not be installed
in this environment; use the macOS workflow for authoritative browser results.
Physical iPhone toolbar behaviour and signed-in cloud save/share still require
an authenticated acceptance pass. The harness does not wire the full parent
dough schedule and cannot validate readiness indicators by itself.

The user must rotate the two tokens reported in Claude project/conversation
content. No credentials were read or changed, and no reported token is in these
Git trees. Styling migration, broad i18n cleanup and Git-history size reduction
are separate maintenance work, not prerequisites for these targeted fixes.


## Consistent journey endings (follow-up)

The user's wrap report revealed that SandwichParty ended with a status only. Added a shared completion section with save/share actions to sandwich assembly, bread cooling, and plain pizza cooking, in both guided and custom modes. Filled breads hand off to assembly before presenting completion. Undo hides the completion state; partial pizza/sandwich sessions can still be saved. Existing-base journeys export recipe text and use native sharing (copyable text fallback), explicitly distinguished from the authenticated homemade-session cloud flow. No existing-base data is written into a homemade dough session.

Added mobile regressions for guided/custom bread, plain pizza, baguette sandwiches and chicken wraps, plus existing pizza/wrap downloads and completion restoration/undo. These new browser scenarios await CI; local TypeScript, 335 unit tests and production build pass. The preceding solver-fix preview 357b94e is READY (dpl_AcqVnxnijhwHRuvhzBjr7eWCu6DL); its CI has passed units, round trips, images and build, with WebKit still running. Cloud-browser preview access is blocked by Vercel authentication, so authenticated save/share is not yet verified.

Rendered all 91 sandwich/toast recipes across 14 families in FR/EN with the real component: unserved, completed, undone and empty selections. Completion actions and status behaved correctly in all rendered states. Added this as a unit regression (336 tests total). Pizza completion now uses explicit saveCurrentSession rather than the photo/event helper, so anonymous Save requests authentication and an existing session is actually updated.

Existing-base journeys with no chosen filling now have a final ready-to-serve confirmation too; its completion survives reload and can be undone. This avoids requiring a sandwich selection just to finish a plain base.

CI36298131124 finished with274/288 WebKit passing. Twelve failures were selectors (Baguette accessible name; summary button scoped to its dialog). Two were a real fast-toggle sourdough70h/recommend divergence. Follow-up removes a render-lag overwrite of the authoritative blockers, uses that reference for the Nights handler, keeps automatic future cold patterns free to replan (explicit pins/history still protected), and routes ratio re-solves through full candidate validation. A stale fridge-out value is cleared for RT-only winners. The added full-schedule rapid test now passes all12 cases with identical visible and parent plans. Full original matrix and final WebKit rerun pending at this checkpoint.
