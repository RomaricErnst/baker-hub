# Baker Hub — CLAUDE.md

## NVM / Node Setup

```bash
nvm use          # picks version from .nvmrc
npm run dev      # Next.js dev server on http://localhost:3000
npx tsc --noEmit # type-check without emitting
```

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, `'use client'` throughout) |
| Language | TypeScript strict |
| Styling | Inline `style` objects only — no CSS modules, no Tailwind |
| Fonts | DM Sans, DM Mono, Playfair Display (via `next/font`) |

## Design Tokens (CSS vars in `app/globals.css`)

```
--terra      warm terracotta CTA colour
--cream      page background
--warm       card/input background
--char       near-black text
--smoke      secondary text
--border     subtle borders
--ash        dark neutral
--sage       success green
--bread      bread-mode accent
--gold       gold/warning
--card-shadow / --card-shadow-hover
```

## Current Branch

`main` — all work lands here directly (no feature branches in use).

## File Map

```
app/
  page.tsx               — guided wizard (6 steps + results)
  data.ts                — style/oven/mixer/yeast definitions
  utils.ts               — yeast engine, schedule engine, recipe calculator
  components/
    SchedulePicker.tsx   — bake-time-first 3-phase flow
    Timeline.tsx         — step-by-step baking schedule
    RecipeOutput.tsx     — ingredient card
    ClimatePicker.tsx    — temp/humidity/fridge inputs
    StylePicker.tsx      — dough style cards
    OvenPicker.tsx       — oven type cards
    MixerPicker.tsx      — mixer type cards
    YeastHelper.tsx      — yeast identification modal
    LearnModal.tsx       — term glossary modal
    Header.tsx
```

## Yeast Engine Formulas

### Room Temperature (IDY % of flour)
```
IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
```
Implemented via `RT_TABLE` bilinear interpolation in `utils.ts → interpolateRT()`.

### Cold Retard (IDY % of flour)
```
IDY% = 50.2 / hours^1.313
```
Implemented via `COLD_TABLE` nearest-neighbor lookup + `coldActivityFactor(fridgeTemp)` Q10 correction.

### Conversion factors (relative to IDY)
- Active Dry Yeast: ×1.33
- Fresh Yeast: ×3.0

## Schedule Engine (flat 7-phase model)

Phases in order: Mix & Knead → Bulk Ferm → Divide & Ball → Cold Retard? → Rest RT? → Final Proof → Preheat → Bake

Key rules:
- `maxRTHours(temp)`: 2h @≥28°C, 4h @≥25°C, 6h @≥22°C, 8h cooler
- `maxFinalProofHours(temp)`: 1.5h / 2.5h / 3.5h / 5h
- Auto-adjust fires if bulk ferm or final proof exceeds cap → inserts cold retard
- Divide & Ball: 15 min base + 2 min per ball over 4

## Session-End Checklist

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run dev` boots and guided flow renders end-to-end
- [ ] SchedulePicker phases: bake_time → start_confirm → blockers all functional
- [ ] Timeline shows Divide & Ball step for all schedules
- [ ] Scroll-to-step fires on each advance (70px offset, 150ms delay)
- [ ] `git add . && git commit && git push`
