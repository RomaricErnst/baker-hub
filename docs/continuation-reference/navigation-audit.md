# Bakerhub navigation review

12 September 2026 · Source review and proposed prototype · No app changes.

## Start reviewing

Open [the clickable navigation prototype](design-proposals.html). Use **Menu** for global destinations, the bottom **Setup / My plan / Bake / Pizza party** shortcuts for the current session, and **Screen index** to inspect any of 98 review screens. **Inspect demo states** exposes failure, empty, stale and sign-in states. Use **Back** to return to the exact previous prototype screen.

Only prototype navigation, the screen search, and shopping checkboxes work. Saving, sign-in, uploads, AI, timers, calculation, sharing, deletion and language conversion are simulated. Example recipe numbers are not a baking recommendation.

## Current source map

| Layer | Existing implementation | Prototype coverage |
|---|---|---|
| Public routes | `/`, `/fr`, locale About, Privacy, Terms; `/[locale]/list/[shareId]`; auth callback; not-found/fallback | Home, About/science, legal placeholders, recipient list, callback, missing page |
| Entry/resume | Bake type; Simple/Custom; local welcome-back; cloud resume; new-session confirmation | Type/mode, local and cloud examples, start-over choice |
| Session navigation | `setup`, `plan`, `guide`, `pizzaparty`; dough/party top distinction; generated-state restrictions | Separate global Menu from session shortcuts; no-plan and stale examples |
| Simple setup | Style → Quantity → Equipment → Climate → Yeast → Schedule | Each step and overview; example choices, not every style |
| Custom setup | Style → Quantity → Equipment → Climate → Flour → Yeast → Preferment unless sourdough → Schedule → Fine-tune | Flour blend/scan, starter, preferment, scheduling subpages and fine-tuning |
| Recipe/Plan | Recipe output, stage information, fermentation timeline, save/share, stale regeneration | Ingredients, stage split, small-dose help, water/ice, timeline, edit and stale state |
| Bake guide | Current step, done steps, tips/FAQ/coach, learn terms, photo feedback and errors | Step/next/timer/finish, help subpages, recovery proposal, feedback simulation |
| Pizza party | Pick/shop/prep/bake; search/filter/style/quantity/details; creation sheet; pizza queue and nested tips/FAQ/Maestro | All four stages; picker/details/create, filtering, shopping/recipient, pizza help and photo feedback |
| Header drawer | Account/auth, profile, language, units, saved recipes and bake history, About | Menu, account, settings, profile, recipes and bakes as dedicated proposed destinations |
| Saved recipe | Rename/notes, load, delete confirmation | Recipe detail edit, reopen, simulated delete |
| Saved bake | SessionViewer: resume, rebake, rename, photos, comments, sharing, delete | Session detail, notes, resume, rebake, share and delete examples |
| Share layers | ShareCard: format, content toggles, photo crop, caption, multi-page preview, generating/copy/download/share states | Image, format/content/crop/caption subpages, success and failure examples |
| Guest/auth | Google or email → code; sign-in gate on relevant actions | Guest/signed-in branches; callback, return to save, failure |
| Settings/science | ProfileSheet, EN/FR switch, units, About | Dedicated proposed settings and layered science explanation |

Source anchors reviewed: `app/[locale]/page.tsx` step definitions around 2740–2940; resume around 3182/3291; setup 3341/3579; Plan 4137; Guide 4311; Party 4413; `Header.tsx` drawer/profile/language/history/About and SessionViewer handoff; `SessionViewer.tsx`, `ShareCard.tsx`, `BakeGuide.tsx`, `PizzaPartyTabBar.tsx` state declarations. A separate engineering reviewer cross-checked route and nested PizzaParty coverage. Source inspection is not live journey validation.

## Proposed changes to approve individually

| Proposal | Why | How |
|---|---|---|
| Separate global navigation from current bake | Account/history should not compete with step navigation | Menu holds library/settings; session bar holds Setup/Plan/Bake/Party |
| Give recipes and bakes distinct destinations | Reusable formula and dated session have different meanings | Recipes → use again; Bakes → resume or inspect results |
| Keep one next action per step | Dense options slow kitchen use | Strong primary action; optional help below |
| Show setup overview and stale-plan state | Editing inputs must not leave old results looking current | Mark affected plan out of date; review before regenerating |
| Preserve return locations | Nested help/share/auth can strand the baker | Close/back returns to exact parent; auth resumes intended action |
| Simplify sharing entry | Image, recipe details and shopping list serve different recipients | Choose output first, then preview, then explicit action |
| Clarify climate/schedule together | Room/fridge assumptions need to be visible when planning | Explicit measurements, stage times and observable readiness |
| Add recovery path | Real bakes run early or late | Explain what changes before confirming updated schedule; not currently approved |
| Truthful result states | A spinner or “saved” label must reflect real outcome | Pending, confirmed success, failure with retry and retained work |

## Back, close and resume

**Current:** most app navigation is React state on the same page; changing a tab need not create a browser history entry. The app separately restores local/cloud snapshots and has stale/generated flags. Do not assume browser Back undoes a setup step.

**Proposed production contract:** browser Back traverses meaningful screen changes; a modal close returns to its parent without losing entered values. In-step Back retains choices. Canceling a share leaves the recipe untouched. Sign-in returns to the initiating save/share action. Resume preserves the same dated session; Rebake creates a new session with refreshed conditions and empty progress.

**Prototype limitation:** its on-screen Back uses an in-memory screen trail. The fragment identifies the current screen on reload. Browser Back does **not** traverse the prototype trail (fragment updates replace history). This is explicitly not a validated production routing implementation. Review intended paths with the on-screen Back. Generic help pages have a guide shortcut; use Back for exact parent return after PizzaParty help.

## Remaining gaps before implementation

- No exhaustive style/oven/method compatibility reproduction; screen options are examples.
- Bread currently changes available controls and hides PizzaParty; the prototype exposes all reviewer shortcuts and does not enforce this conditional visibility.
- Simple sourdough can nudge users into Custom; prototype starter pages show intent but do not reproduce every guard/default or automatic step skip.
- Every nested overlay is represented as a focused screen, not a visually faithful modal/drawer. Closing, Escape, focus trapping and layering need final interaction design and browser tests.
- Account state is chosen explicitly per demo branch; no real authentication/global signed-in state.
- No timer, persistence, copying, downloads, AI, photos, science validation or backend tests occur here.
- Full live UI/UX coverage, translations, screen reader use, 200% zoom and keyboard flow remain separate verification work.

## Verification

Generated 98 screen definitions; all defined link destinations resolve. No external script, asset or backend requests are used. Visual rendering is **not verified**: earlier local-server binding was denied and opening the local file was blocked by browser URL policy. No bypass was attempted. The inherited prototype view restrictions still apply; static checks are not a substitute for mobile/desktop screenshot review.
