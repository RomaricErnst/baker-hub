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
| Framework | Next.js 16 (App Router, `'use client'` throughout) |
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
  page.tsx               — guided wizard (8 steps + results)
  data.ts                — style/oven/mixer/yeast definitions
  utils.ts               — yeast engine, schedule engine, recipe calculator
  components/
    SchedulePicker.tsx   — bake-time-first 2-phase flow (bake_time → start_confirm)
    Timeline.tsx         — step-by-step baking schedule (single- and two-phase cold retard)
    RecipeOutput.tsx     — ingredient card
    ClimatePicker.tsx    — temp/humidity/fridge inputs
    StylePicker.tsx      — dough style cards
    OvenPicker.tsx       — oven type cards
    MixerPicker.tsx      — mixer type cards
    YeastHelper.tsx      — yeast identification modal
    LearnModal.tsx       — term glossary modal
    Header.tsx
messages/
  en.json                — English copy (next-intl pending proper setup)
  fr.json                — French copy (next-intl pending proper setup)
```

## Yeast Engine Formulas

### Room Temperature (IDY % of flour)
```
IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
```
Direct formula — no lookup table.

### Cold Retard (IDY % of flour)
```
IDY% = 7.5 / hours^1.313
```
Direct formula + `coldActivityFactor(fridgeTemp)` Q10 correction.

### Conversion factors (relative to IDY)
- Active Dry Yeast: ×1.33
- Fresh Yeast: ×3.0

## Schedule Engine — Temperature-Aware Two-Phase Model

### ScheduleResult fields
Standard fields: `mixingDurationH`, `bulkFermStart`, `bulkFermHours`, `coldRetardStart`, `coldRetardEnd`, `coldRetardHours`, `finalProofStart`, `finalProofHours`, `restRtHours`, `preheatStart`, `bakeStart`, `totalRTHours`, `totalColdHours`, `wasAutoAdjusted`, `kitchenTemp`

New two-phase fields: `coldRetard1Start/End`, `coldRetard2Start/End`, `divideBallTime`, `rtWarmupStart/End`

Backward-compat mapping: `coldRetardStart` = `coldRetard1Start`, `coldRetardEnd` = last cold phase end, `coldRetardHours` = sum of both phases.

### Case 1 — Short window (<16h) OR temperate (<28°C)
Single cold retard path:
Mix → Bulk RT (1.5h) → Cold Retard → Divide & Ball → Rest RT → Final Proof → Preheat → Bake

### Case 2 — Long window (≥16h) AND tropical (≥28°C)
Two-phase cold retard path:
Mix → Bulk RT (30min@≥30°C / 45min@28-29°C) → Cold Retard 1 (bulk mass) → Divide & Ball → Cold Retard 2 (individual balls) → RT Warmup (30-45min) → Final Proof → Preheat → Bake

### Key rules
- `maxRTHours(temp)`: 2h @≥28°C, 4h @≥25°C, 6h @≥22°C, 8h cooler
- `maxFinalProofHours(temp)`: 1.5h / 2.5h / 3.5h / 5h
- Divide & Ball: 15 min base + 2 min per ball over 4
- Bulk ferm tip is dynamic (4 tiers based on actual duration)
- Blocker blocks mapped to cold retard boundary in Case 3

## i18n Status

Message files exist at `messages/en.json` and `messages/fr.json`. The `next-intl` plugin was **removed** from `next.config.ts` (and uninstalled) because it caused Vercel build failures when misconfigured without middleware and `[locale]` routing. Re-add in a dedicated session with proper App Router i18n setup.

## Session 3 Priorities

1. Fix start time field — should be editable (currently read-only display)
2. Fix final proof copy — should be dynamic for two-phase schedules (tip mentions cold dough context)
3. Verify yeast IDY% is correct for two-phase schedules (totalRTHours and totalColdHours plumbed correctly)
4. Design polish pass

## Session-End Checklist

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` clean
- [ ] SchedulePicker phases: bake_time → start_confirm functional
- [ ] Timeline shows correct steps for both single-phase and two-phase schedules
- [ ] Two-phase triggers at ≥28°C + ≥16h window
- [ ] Divide & Ball step always present
- [ ] Scroll-to-step fires on each advance (70px offset, 150ms delay)
- [ ] `git add . && git commit && git push`
