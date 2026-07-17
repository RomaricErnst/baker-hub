# Baker Hub — Post-deploy Test Checklist (soft launch)

Run on the live site after Vercel finishes deploying `e4335ad`. ~15 min. Each item lists
what to do and what "pass" looks like.

## 1. Persistence (the biggest reported bug)
- [ ] Custom pizza, set a future bake date/time, add a day + night blocker, generate.
      Note the Start Dough time. Close the tab, reopen bakerhub.app.
      **Pass:** times come back exactly as planned — nothing jumps to "now".
- [ ] Pizza Party → tick several shopping-list items and a couple of prep tasks.
      Leave the app, come back. **Pass:** the same items are still ticked.
- [ ] Open a Guide, mark 2–3 steps done, leave, return. **Pass:** those steps stay ticked.
- [ ] Sign in, Save session, then reopen it from My Sessions.
      **Pass:** bake time, blockers, and (for sourdough) starter state all restore.

## 2. Biga (day + night blocker)
- [ ] Custom pizza, Biga preferment, add work + night blockers, near-ish bake date.
      **Pass:** the Make Biga window can reach "double green" (no false "window too short").
- [ ] Check the recipe: yeast amount appears in the **Make your Biga** card, and the
      yeast-detail callouts below the main ingredients are **not** shown (all yeast is
      in the biga). **Pass:** no contradictory yeast numbers.
- [ ] A shorter biga window (e.g. ~20h) should show a smaller yeast amount than a 48h one.

## 3. Sausage / pre-cook
- [ ] Pizza Party → pick a pizza with sausage (Salsiccia e Friarielli) or add merguez /
      grilled chicken. Check the Prep tab. **Pass:** the note says pre-cook / pan-brown
      first (raw-crumble only mentioned for 450°C+ ovens).

## 4. Setup flow
- [ ] Custom mode: walk every step. **Pass:** Oven step is NOT skipped; each pre-filled
      step shows a Continue button; nothing forces a re-click to advance.
- [ ] Switch Simple ↔ Custom after filling several steps. **Pass:** lands on the first
      step still needing input, earlier choices preserved.
- [ ] After generating, the recipe's black header card shows an **Edit setup** link
      (third entry point) above the protocol.

## 5. Guide mode (rebuilt)
- [ ] Open a Guide. **Pass:** clean timeline; each step's secondary content is behind
      **Tips & tricks / FAQ / Maestro** pills, closed by default.
- [ ] Open FAQ on a step → questions expand/collapse.
- [ ] Maestro pill → "Ask Maestro" text box: type a question (e.g. "my dough is sticky").
      **Pass:** a short 2–4 line answer, not a wall of text.
- [ ] Photo coach (poolish/proof/bake steps): upload a photo. **Pass:** answer is the
      short structured form — verdict line, then ✓ / → lines, ≤4 lines.

## 6. Maestro good/bad photo spot-check (owner)
- [ ] A clearly under-baked pale pizza → Maestro flags undercooked crust / pale cornicione.
- [ ] A well-baked pizza → Maestro gives a positive verdict + at most a minor tweak.
- [ ] A raw dough ball at "shape" → sensible shaping feedback.
      If any answer drifts long or vague, paste it back and it can be tuned.

## 7. Error / 404
- [ ] Visit bakerhub.app/en/does-not-exist → branded "out of the oven" 404, not a raw error.

## 8. First-run
- [ ] Fresh visit (or Start Over) → hero shows the new one-line subtitle explaining the app.
- [ ] Tab to the Pizza/Bread cards with the keyboard, press Enter. **Pass:** selects — the
      cards are keyboard-reachable now.

---
Anything that fails: note the step number + what you saw, and it can be fixed next session.
