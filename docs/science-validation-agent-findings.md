# Science validation agent findings

Audit run against branch `codex/prototype-migration-20260920` at commit
`c4b31cd`. The existing suite passes all 59 tests, but the matrix below found
two acceptance blockers that the current tests do not cover.

## 1. Short-window schedules can place proof after baking

`app/utils.ts:1003-1057` clamps a short cold-retard end to the cold start and
then unconditionally adds `restH` to form `finalProofStart`. In a short window
this can put the event after `bakeStart`, while `finalProofHours` is silently
clamped to zero.

Reproduction with the production `buildSchedule` function:

| style | kitchen | horizon | mixer | preheat | final proof | bake |
| --- | ---: | ---: | --- | ---: | --- | --- |
| Pizza Romana | 28°C | 2 h | hand | 90 min | 10:15 | 10:00 |
| Baguette | 28°C | 2 h | spiral | 90 min | 10:15 | 10:00 |
| Brioche | 28°C | 1 h | hand | 0 min | 09:30 | 09:00 |

A matrix across 15 styles, 7 temperatures (16–38°C), 14 horizons, 4 preheat
durations and 4 mixers produced 182 such cases. The schedule must instead
reject or clearly flag an insufficient window, or select a valid RT fallback,
before it is shown as executable.

## 2. Unreachable dough-temperature residual is hidden

`solveWaterTempEnthalpy` correctly returns both the requested ideal water
temperature and the achievable dough temperature (`app/utils.ts:600-617`).
For a 38°C kitchen, Neapolitan dough with a spiral mixer returns ideal water
`-0.4°C`, clips the supplied water to `2°C`, and predicts `24.4°C` dough against
a `23°C` target. The 35°C case returns `23.2°C` against the same target.

`RecipeOutput.tsx` passes `idealWaterTemp` and the target into
`WaterPreparation`, but `WaterPreparation.tsx:44-70` only displays the generic
“This preparation cannot reach the dough target” message. It does not display
the achieved temperature or the residual, so the baker cannot choose between
chilling flour, changing the mixer method, or accepting the warmer dough.

## 3. Remaining wording to soften

Most unsupported About claims were corrected. These still need review:

- `app/[locale]/about/AboutClient.tsx:194` says “The dough retards itself in
  the fridge once you step away”; refrigeration is a user action.
- `:268` and `:325` present longer cold fermentation as developing more flavour
  complexity; this should be framed as a recipe preference/estimate.
- `:367` presents fewer refreshes as the tangier path; this is a heuristic and
  should defer to observed starter activity.

## What passed

`npm test` completed with all 59 tests passing. Enriched formulas, preferment
dose conservation, sourdough/levain chart rendering at 16/24/32/38°C, graph
finite geometry, humidity handling disclosure, and bilingual catalogue checks
passed. These tests do not currently assert the schedule ordering or residual
temperature behavior described above.
