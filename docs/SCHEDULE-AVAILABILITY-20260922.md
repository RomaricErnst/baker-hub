# Schedule availability — 22 September 2026

## Product decision

Keep one recommended protocol in Simple and Custom. Cold fermentation before and after dividing/shaping is a valid existing protocol, not an error. This change does not add a one-versus-two-cold-phase setting. A future optional preference would need independently validated alternatives.

Resolve hands-on conflicts where the existing protocol permits it. An explicit proposal is required to change mixing or baking time. Do not silently change the requested bake time, remove a cold phase, or call a timing window measured maturity.

## Bounded engine changes

- Shared availability checks use half-open periods: busy at the start, free at the end. Active spans can overlap a block even when their start is clear. Completed actions are history.
- Split the existing mixing budget into initial combining and final kneading around passive autolyse. This adds no mixing time and does not block passive rest. No-knead remains a point because no handling duration exists in that model.
- Check the existing 15-minute shaping interval and its fridge-return endpoint together. Find a feasible second cold exit while preserving the existing cold, warmup and proof minima. Passive cold may overlap unavailable periods.
- `findScheduleRepair` first searches nearby mixing times with the bake fixed, then proposes a later bake. Candidates are rebuilt and checked for action conflicts, phase ordering, minimum durations, unchanged cold-phase count and canonical displayed times. A caller predicate must additionally validate the selected preferment/starter method.
- No candidate is a valid outcome: retain an actionable availability message rather than inventing a safe time. Search is bounded, not an exhaustive scheduling proof.

## Verification

An independent comparison against `51427d7` found 6,480 no-block schedules identical apart from the new availability metadata: 15 styles, six temperatures, four mixers, six horizons and three preheat durations, including off-grid mixing inputs. Nine new engine regressions cover active/passive intervals, boundaries, both cold phases, joint shaping/exit feasibility, explicit repairs and rejected candidates.

The science review checked 20 relevant tests and 75 bounded probes. Dose, temperature and starter-ratio coefficients are unchanged. Numerical regression checks do not replace baking validation.

Final caller review passed after two safeguards: sourdough automatic proposals are withheld because the starter solver can re-optimize feeds after a bake edit; commercial proposals revalidate preparation deadlines with fresh time on Apply. Direct, poolish and biga retain selected methods. Expired proposals route to manual planning.

The deployed French preview was exercised with work 09:00–18:00 and a requested 18:00 bake: the proposal 20:30 required a tap, retained 16:00 mixing, cleared the conflict and preserved both cold intervals in Visual schedule. This fixture used the existing 45-minute preheat. The isolated iPhone test uses 60-minute preheat and independently checks the matching proposed time.

Final [CI run 35689438983](https://github.com/RomaricErnst/baker-hub/actions/runs/35689438983) at `f39a68b`: **179 unit tests passed, i18n/build passed, 28/28 iPhone WebKit checks passed**. The four new width cases verify explicit acceptance, unchanged mixing time, later bake matching the offered label, persisted parent timestamps after remount, no remaining conflict, and both cold phases. Existing Simple/Custom, French/English, preferment and header/save/menu cases remain green. Artifact `10677462989` expires 6 October 2026.

Preview `dpl_FvWZbWekpiwuRJs1iHFmQjtvbE91` is READY at https://baker-cq8hym6yp-thebaker-hubs-projects.vercel.app/fr . No production deployment/promotion. This is macOS WebKit with iPhone device settings, not a physical iPhone Safari test.

## Limits

Handling durations are scheduling estimates. Untimed preferment work and no-knead handling are not newly modelled. Existing quarter-hour bake rounding prevents a verified fixed-bake repair for off-grid requested bake times; the repair must not silently round the user's request. Hot room-only sourdough guidance and the separately documented extreme dose discontinuity remain outside this fix.
