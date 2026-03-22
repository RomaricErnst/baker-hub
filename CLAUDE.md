# Baker Hub — CLAUDE.md

## NVM / Node Setup
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
npm run dev        # Next.js dev server on http://localhost:3000
npx tsc --noEmit   # type-check without emitting
npm run build      # full build — must pass before every commit
```

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, `'use client'` throughout) |
| Language | TypeScript strict |
| Styling | Inline `style` objects only — no Tailwind, no CSS modules |
| Fonts | DM Sans, DM Mono, Playfair Display (via `next/font`) |
| Backend | Supabase — wired (auth + DB) |
| Deploy | Vercel — auto-deploys on git push to main |

## Design Tokens (CSS vars in `app/globals.css`)
--terra    #C4522A   primary CTA — use sparingly
--cream    #F5F0E8   page background
--warm     #FDFBF7   card/input background
--char     #1A1612   body text
--smoke    #8A7F78   secondary text
--border   #E8E0D5   subtle borders
--ash      #3D3530   dark neutral
--sage     #6B7A5A   success/natural
--gold     #D4A853   trust signals, achievement
--bread    #8B6914   bread mode accent
--card-shadow: 0 2px 12px rgba(26,22,18,0.06)

## File Map
app/
page.tsx          — Simple mode wizard (8 steps) / Complet mode (9 steps) + results
data.ts           — style/oven/mixer/yeast definitions
utils.ts          — yeast engine, schedule engine, recipe calculator
globals.css       — CSS variables and global styles
components/
SchedulePicker.tsx  — 2-phase flow: bake_time → start_confirm
Timeline.tsx        — baking schedule (single + two-phase cold retard)
RecipeOutput.tsx    — ingredient card + flour note + yeast note
ClimatePicker.tsx   — temp/humidity/fridge inputs + warm climate nudge
StylePicker.tsx     — dough style cards
OvenPicker.tsx      — oven type cards
MixerPicker.tsx     — mixer type cards
YeastHelper.tsx     — yeast identification + transparency panel
LearnModal.tsx      — term glossary modal
Header.tsx
messages/
en.json           — English copy (next-intl pending proper setup)
fr.json           — French copy

## Yeast Engine — Craig's Model v1.1

### RT formula
IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
### Cold formula
IDY% = 7.5 / hours^1.313 × coldActivityFactor(fridgeTemp)
coldActivityFactor = 2^((fridgeTemp−4)/10)
### Tropical corrections (RT phases only)
- 30–32°C → ÷1.15
- 33–35°C → ÷1.25

### Practical floors
- IDY minimum: 0.5g hard floor regardless of formula
- When convertedGrams < 1g: show sachet dilution note
- When hitMinFloor: show gold ⚠️ callout

### Yeast conversions
- ADY: IDY × 1.33
- Fresh: IDY × 3.0

## Schedule Engine

### Two paths
**Single-phase** (window <16h OR kitchen <28°C):
Mix → Bulk RT (1.5h) → Cold Retard → Divide & Ball → Rest RT → Final Proof → Preheat → Bake

**Two-phase tropical** (window ≥16h AND kitchen ≥28°C):
Mix → Bulk RT (30–45min) → Cold Retard 1 (bulk) → Divide & Ball → Cold Retard 2 (balls) → RT Warmup → Final Proof → Preheat → Bake

### Key rules
- All schedule times rounded to nearest 15min (roundTo15 helper)
- Divide & Ball is always pushed out of any blocker window
- Bulk ferm conflict: if blocker cuts >15min into bulk, surface yellow banner with "start earlier" / "continue anyway" options
- maxRTHours: 2h @≥28°C / 4h @≥25°C / 6h @≥22°C / 8h cooler
- maxFinalProofHours: 1.5h / 2.5h / 3.5h / 5h
- Night blockers: 10pm → 7am
- formatTime() shows HH:MM (real minutes, 15min rounded)
- hoursLabel() rounds to nearest 15min

### ScheduleResult key fields
Standard: mixingDurationH, bulkFermStart, bulkFermHours, coldRetardStart/End/Hours, finalProofStart/Hours, restRtHours, preheatStart, bakeStart, totalRTHours, totalColdHours, wasAutoAdjusted, kitchenTemp, bulkConflict
Two-phase: coldRetard1Start/End, coldRetard2Start/End, divideBallTime, rtWarmupStart/End

## Scheduler (SchedulePicker)

### Phase 1 — Bake time
- Date input + hour select (no minutes)
- "Plan my bake →" disabled until date picked

### Phase 2 — Start confirmation
- Scenario engine: too_short / tight / plenty
- ±1h stepper + date+hour picker for jumping days
- ±4h range shown in suggestion message
- Blocker presets: Weekdays 9am–6pm, nights 10pm–7am, custom
- bulkConflict banner when blocker cuts >15min into bulk ferm

## Supabase & Auth
- Project URL: https://mguwsdonfsyioyelseuf.supabase.co
- Anon key: stored in .env.local as NEXT_PUBLIC_SUPABASE_ANON_KEY
- Auth provider: Google OAuth configured in Supabase dashboard
- Google Client ID: 1094526045258-8k41mv9dap6dd5goqu3p2kfetlnimqn6.apps.googleusercontent.com
- Callback URL: https://www.bakerhub.app/auth/callback
- Local callback: http://localhost:3000/auth/callback
- Client files: app/lib/supabase/client.ts (browser) + server.ts (server)
- Auth callback route: app/auth/callback/route.ts
- NEVER commit .env.local to git

## i18n Architecture
- next-intl installed
- Locales: en (default), fr
- Strategy: localePrefix 'as-needed' — English has no prefix (/), French uses /fr/
- Middleware: middleware.ts in project root
- Request config: app/i18n/request.ts
- Language toggle: cookie NEXT_LOCALE, set in Header.tsx
- String migration: Session 6 (replace hardcoded strings with t('key'))

## Current Priorities (Session 5)
- Supabase + Google OAuth — wired up
- i18n infrastructure — installed, toggle in header
- Session 6: French string migration (replace all hardcoded strings with t('key'))
- Session 6: Save recipe to Supabase
- Session 7: Baking Mode V1
- Testers: Friday — French speakers, need French translation before then

## Session-End Checklist
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — clean
- [ ] git add . && git commit -m "[message]" && git push
- [ ] Update CLAUDE.md if architecture changed
