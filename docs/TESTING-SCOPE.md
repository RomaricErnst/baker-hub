# Proportionate verification

- Wording and catalogue edits: relevant assertions and production build.
- Small UI changes: affected browser journeys at one normal phone width.
- Shared layout/navigation changes: narrow and normal phone widths.
- Scheduling changes: state/solver regressions across supported styles, temperatures, lead times and blockers, plus affected resume/edit/accept browser journeys.
- Broad design changes or periodic release review: manually run the four-width matrix with `full_matrix` enabled.

CI keeps the complete browser journey suite. Its normal matrix is 390 px; changes to shared layout controls or CSS add 320 px. The manual full matrix adds 375 and 430 px. A passing emulated browser check does not establish physical iPhone behaviour or validate fermentation experimentally.
