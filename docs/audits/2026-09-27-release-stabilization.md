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
