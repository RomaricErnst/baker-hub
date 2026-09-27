# Mobile WebKit review — 21 September 2026

## Environment
Playwright WebKit 26.6 with iPhone 13 device settings (touch/mobile user agent), content viewports 375×600 and 390×664; iPad-sized 768×900 ingredient check. Short viewports reserve space for Safari browser controls. This is engine/device emulation, not a physical iPhone: native browser toolbar animation, on-screen keyboard and camera hardware remain outside this check.

## Changes
- Mobile setup hides the bottom destination tabs and retains the Continue action. The tabs return in the generated recipe and pizza module; Menu offers pizza access during setup.
- Setup progress scrolls with content. Mobile header is 56px, with comfortable 44px controls.
- Header hides by its measured height after deliberate downward travel; minor reversals do not flash it open. Upward travel and top-of-page restore it. Modal/keyboard focus and reduced-motion preferences are respected.
- Bake summary scrolls away instead of occupying the pinned navigation stack.
- Hidden navigation uses the device safe-area clearance, avoiding an empty offset beneath actions.
- Pizza discovery has a more compact heading/search/filter area. Search text is 16px; filter and quantity controls have 44px touch targets. The selection bar appears after the first pizza is selected; empty selection no longer reserves a disabled action bar.
- Ingredient water disclosure has a 44px touch target. Baking queue cards support keyboard activation. Shopping location wraps rather than squeezing the item count.

## Verified
- Header top/down/minor reversal/up: visible bottom 56/0/0/56px, no horizontal overflow.
- Setup: style, quantity, equipment, climate, flour catalogue/manual/scan screen, yeast, preferment, scheduling date input (date change reflected in actions), fine-tuning and flat review. Manual entry hides the unrelated Continue action.
- Pizza: discovery, filters, detail, selection review, shopping, preparation, baking queue and detail sheet. Sheet close and quantity controls remain reachable.
- Generated pizza/biga ingredients, expanded guide help, previous/next steps, menu.
- Bread ingredients, final cooling instructions/help; iPad ingredient layout.
- Full automated suite: 149 tests pass. TypeScript passes.

Screenshots were inspected from /tmp/webkit-*.png. Physical camera capture and native iOS keyboard behaviour were not claimed as tested.
