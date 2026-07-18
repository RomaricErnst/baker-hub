# Baker Hub — CLAUDE.md
Updated July 2026 · Live at bakerhub.app · Status: soft-launch ready

## NVM / Node Setup
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
npm run dev        # Next.js dev server on http://localhost:3000
npx tsc --noEmit   # type-check — ZERO errors before every commit
npm run build      # must pass before every push (fails in remote sandboxes: Google Fonts blocked — tsc + Vercel build instead)
```

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `'use client'` throughout) |
| Language | TypeScript strict |
| Styling | Inline `style` objects only — no Tailwind, no CSS modules |
| Fonts | Playfair Display (headings), DM Sans (body), DM Mono (numbers) via `next/font` |
| i18n | next-intl — en at `/`, fr at `/fr`, cookie NEXT_LOCALE; build fails if fr.json misses keys |
| Backend | Supabase (magic link + Google OAuth, bake_events + photos + pizza-party slots) |
| Deploy | Vercel — auto on push to main (~90–120 s); a failed build never replaces the live deployment |

## Design Tokens (CSS vars in `app/globals.css`)
--terra #C4522A primary CTA (sparingly) · --cream #F5F0E8 page bg · --warm #FDFBF7 cards
--char #1A1612 text · --ash #3D3530 · --smoke #8A7F78 secondary · --border #E8E0D5
--sage #6B7A5A success · --gold #D4A853 trust · --bread #8B6914 bread accent
Cards 18px radius, shadow 0 2px 12px rgba(26,22,18,0.06) · buttons 12px · inputs 8px · pills 20px
90/10 rule: 90% neutrals, ≤10% accent. Sliders: blue slow · sage sweet spot · gold adventurous · coral challenging.

## File Map
app/
  [locale]/page.tsx     — main flow: bake-type picker, Simple (7 steps) / Custom (10 steps), tabs, nav layer, session save/restore/rebake
  api/flour-scan/route.ts — AI flour scanner (server-side, model via ANTHROPIC_VISION_MODEL env)
  auth/callback/route.ts
  data.ts               — styles (name/nameFr/descFr), ovens, mixers, yeasts, preferments
  utils.ts              — yeast engine, schedule engine, DDT, recipe calculator, formatTime(d, locale)
  utils/units.ts        — g/°C ↔ oz/°F (weights <6 g stay grams in imperial)
components/
  SchedulePicker.tsx    — schedulers: colour bar (Simple), FermentChart flow (Custom), sourdough solver (findOptimalPositionSourdough)
  FermentChart.tsx      — event-driven bells/diamonds, premix/postmix fade, width-aware label stagger
  Timeline.tsx          — bake plan steps (single + two-phase)
  RecipeOutput.tsx      — ingredient cards, baker's %, batch splitting, water/ice guidance
  BakeGuide.tsx         — step-by-step guide, 9 oven types, Maestro coach
  PizzaParty.tsx + pizzaParty/ + ToppingSelector.tsx + ShoppingList.tsx — Ma Soirée Pizza (4th tab)
  ShareCard.tsx         — session share: post/square/story exports, photo crops; preview must equal export pixel-for-pixel
  SessionViewer.tsx     — saved-session popup, photos, share
  Header.tsx            — ☰ menu: language, units, MY SESSIONS (resume/rebake/delete), auth
  ClimatePicker / StylePicker / OvenPicker / MixerPicker / PrefermentPicker / FlourPicker / FlourScan / YeastHelper / LearnModal
messages/en.json + fr.json — i18n check script keeps them in sync

## Engines (source of truth — see PROJECT-INSTRUCTIONS.md for full detail)

### Yeast — Craig's Model v1.1
RT: IDY% = 9.5 / (h^1.65 × 2.5^((T−25)/10)) · Cold: 7.5 / h^1.313 × 2^((Tfrigo−4)/10)
Tropical ÷1.15 @30–32°C, ÷1.25 @33–35°C · IDY floor 0.5 g · ADY ×1.33, Fresh ×3.0
ALWAYS display convertedGrams (never IDY-equivalent). Osmotic +20% only when sugar >2 **percent** of flour.

### Schedule
Single-phase, or two-phase tropical when window ≥16 h AND kitchen ≥28 °C.
15-min rounding · blocker edges EXCLUSIVE (> and <, never >= <=) · default fridge 6 °C · default bake 18h.

### DDT
waterTemp = FDT×3 − flourTemp − kitchenTemp − friction (stand 5 / hand 1 / no-knead 0 / spiral 8). Ice protocol only ≥50 g.

### Preferments
Poolish RT 6–14 h, fridge ≤24 h · Biga fridge ≤72 h · Levain = sourdough only.

### Sourdough solver (SchedulePicker)
Isolated from non-sourdough engine (early return). Candidate pools Peak1/2A/2B/fridge-hold, blocker-aware,
fridge revival biology, event-driven chart, traffic-light pills (no red in starter card).
Compute style defaults LOCALLY inside the solver (stale `_sfDef` closures caused real bugs).

### Multi-engine rule (CRITICAL)
Any change to coldH/rtH/preferredColdH/minColdH for a style updates ALL THREE together:
utils.ts STYLE_FERM_DEFAULTS · SchedulePicker.tsx STYLE_FERM_DEFAULTS · FermentChart.tsx sweet-center/sigma constants.

## UX Principles
- Empathetic companion: no red text, no ⚠️, warnings are observations. Info only when actionable.
- Water source-agnostic. "Make Poolish" / "Start Dough" everywhere. FR levain: Rafraîchi/Rafraîchir (never Repas/Nourrir), Pétrissage.
- EN 12 h clock · FR 24 h (18h30) and FR weekdays (dim. lun. …) — formatTime(d, locale).
- Mobile first: instant scrolls only; nothing fixed over the bottom nav; visualViewport guard when keyboard open; deferred date-picker apply on coarse pointers; keep tab content mounted (display:none) — never use timed toasts for hidden-tab changes.
- No step numbers on StepCard. bakeType-aware copy (bread uses bread language). Internal mode strings: 'simple' | 'custom'.

## Supabase & Auth
- Project: mguwsdonfsyioyelseuf (ap-southeast-1) · URL https://mguwsdonfsyioyelseuf.supabase.co
- Anon key in .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY) — NEVER commit .env.local
- Auth: magic link + Google OAuth · callback /auth/callback (prod + localhost)
- bake_events.dough_snapshot = full SessionData JSON (incl. sourdough starter state, activeTab, blocks, startTime)
- localStorage bh_session_v1 mirrors the session for non-signed-in bakers

## Testing (what works)
- Live-site automation: JS click helpers; refs go stale after navigation; form_input for date inputs.
- window.confirm BLOCKS automation and looks like a frozen renderer — override with `window.confirm = () => true` when regenerating saved sessions.
- Cross-check chart SVG ↔ card text ↔ solver props; divergence = bug. Chart ticks are labels, not event times.
- Minified prod stacks: install window error listener BEFORE reproducing; check console timestamps for staleness.
- Sweep matrices via React-fiber injection (window.__audit pattern), then visual spot-check 3–5 scenarios.

## Session-End Checklist
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — clean (local Mac only)
- [ ] Commit as Romaric Ernst <romaric.ernst@gmail.com> · push to main
- [ ] Never commit: .env.local, .claude/settings.local.json, untracked QA .md reports
- [ ] Update CLAUDE.md / PROJECT-INSTRUCTIONS.md if architecture or rules changed
