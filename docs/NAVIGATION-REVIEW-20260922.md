# Navigation and tartine review — 22 September 2026

Application commit: `c6193fbbbc2505776dd40423a8748e06f9560c25`.
Preview only; production unchanged.

## Resulting flow

- Pizza exposes My dough/Pizzas after the initial Pizza choice.
- Bread exposes My dough/Fillings only after choosing a supported bread style.
- Fillings uses that bread directly, without another family picker. Campagne, levain, wholemeal, rye and sandwich loaves use six tartine recipes, including avocado and hard-boiled egg. One tartine portion uses 60 g baked bread, one large or several small slices.
- Generated dough exposes local Plan/Recipe/Guide tabs (FR Plan/Recette/Protocole). Returning to My dough resumes the last dough view.
- Setup actions stay above the bottom destinations. Reading downward collapses header/destinations; upward scrolling or Navigation reveals them. Focused navigation and modal interaction retain access. Quantity changes and closing recipe sheets reveal selection actions.
- A blocked final setup/review screen shows a reason and correction action instead of leaving the action area empty. Validation remains intact.

## Review and repairs

Two specialist agents reviewed navigation hierarchy and mobile implementation. Parent and agent inspected macOS WebKit screenshots at 320/390px and relevant 430px setup views. Confirmed repairs included a hidden selection CTA after closing a sheet, 6px recipe-footer overflow at 320px, and the final-step missing-action branch reported in IMG_4019. Some test failures were stale quantity labels or assertions on wrapper boxes instead of visible controls; those assertions were corrected without suppressing genuine errors.

The deployment was fetched successfully; the selected-loaf tartine flow was exercised directly in the deployed preview using the cloud browser. This deployed interaction used Chrome, separately from the WebKit CI tests.

## Verification

- Local 230 unit tests and TypeScript passed for the final application change.
- CI 35712064741: 72/72 WebKit cases passed on navigation/tartine commit 42da084.
- CI 35712791836: 76/80; four review assertions matched an extra hidden status.
- Final CI [35713615578](https://github.com/RomaricErnst/baker-hub/actions/runs/35713615578), test-only correction `dfceeecd`: **230 unit tests, build and 80/80 WebKit cases passed**. The correction scopes the assertion to the visible status. Both final-step and review actions pass geometry and routing checks.
- Widths 320, 375, 390, 430; Playwright WebKit on macOS, iPhone device emulation.
- Native iOS Safari browser-toolbar and keyboard animation are not reproduced by this emulation.

## Visual content limit

Companion cards currently use bread illustrations rather than photographs of assembled fillings. Tartines retain the selected loaf identity; their image alt text names that bread.
