'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import dynamic from 'next/dynamic';
const ProfileSheet = dynamic(() => import('../components/ProfileSheet'), { ssr: false });
import { loadProfile, setProfileListener } from '../lib/profile';
import { useBottomNavHeight } from '../hooks/useBottomNavHeight';
import { pushProfile, pullAndMergeProfile } from '../lib/supabase/profileSync';
import StylePicker from '../components/StylePicker';
import CompanionSteps from '../components/CompanionSteps';
import { useMobileKeyboard } from '../hooks/useMobileKeyboard';
import { NEXT_CTA, BACK_CTA } from '../lib/navButtons';
import OvenPicker from '../components/OvenPicker';
import PrototypeQuantityPicker from '../components/PrototypeQuantityPicker';
import MixerPicker from '../components/MixerPicker';
const SchedulePicker = dynamic(() => import('../components/SchedulePicker'), { ssr: false });
import { starterFeedToMixHours } from '../lib/starterTiming';
import type { StarterEvent } from '../components/SchedulePicker';
import ClimatePicker from '../components/ClimatePicker';
const RecipeOutput = dynamic(() => import('../components/RecipeOutput'), { ssr: false });
import PlanNav from '../components/PlanNav';
const BakeGuide = dynamic(() => import('../components/BakeGuide'), { ssr: false });
import { getPrefPeakH_RT } from '../components/FermentChart';
import YeastHelper from '../components/YeastHelper';
const PizzaParty = dynamic(() => import('../components/PizzaParty'), { ssr: false });
const SandwichParty = dynamic(() => import('../components/SandwichParty'), { ssr: false });
import { createSandwichSnapshot, normalizeSandwichSnapshot, switchSandwichFamily, sandwichFamilyForStyle, type SandwichSnapshot } from '../lib/sandwich';
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import type { SavedRecipe } from '../lib/supabase/fetchRecipes';
import { archivedBlendSelections } from '../lib/flourRecovery';
import { clearSession, loadSession, saveSession, serializeStarterEvents, restoreStarterEvents, normalizeMixingBatches, stashAuthIntent, readAuthIntent, clearAuthIntent, type SessionData } from '../lib/session';
import { upsertBakeEvent } from '../lib/supabase/saveBakeEvent';
import { bakeEventTitle, type BakeEvent } from '../lib/supabase/fetchBakeEvents';
import { useSessionSave } from '../hooks/useSessionSave';
import { type UnitSystem, cToDisplay, inputTempToC, tempUnit } from '../utils/units';
import {
  ALL_STYLES, OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PREFERMENT_TYPES,
  PIZZA_STYLES, BREAD_STYLES, FLOUR_DATA,
  computeBlendProfile,
  type BakeType, type StyleKey, type OvenType, type BreadOvenType, type AnyOvenType, type MixerType, type YeastType, type FlourBlend, type PrefermentType,
} from '../data';
import {
  buildSchedule, calculateRecipe, formatTime, requiredPrefWarmupH,
  type AvailabilityBlock,
} from '../utils';
import { getBreadProtocol } from '../utils/breadProfiles';
import { buildItems } from '@/app/components/Timeline';


// ── Constants ────────────────────────────────

const PIZZA_WEIGHT_TABLE: Record<string, [number, number, number, number][]> = {
  neapolitan: [
    [22, 195, 205, 215], [24, 205, 215, 225], [26, 220, 230, 240],
    [28, 235, 245, 255], [30, 250, 260, 270], [32, 260, 268, 276],
    [33, 264, 272, 280], [35, 270, 278, 280],
  ],
  newyork: [
    [30, 240, 260, 280], [33, 275, 295, 315], [35, 300, 320, 340],
    [38, 335, 355, 375], [40, 360, 385, 405],
  ],
  sourdough: [
    [22, 200, 210, 220], [24, 210, 220, 230], [26, 225, 235, 248],
    [28, 240, 252, 264], [30, 255, 265, 278], [33, 268, 278, 288],
    [35, 278, 288, 295],
  ],
  pizza_romana: [
    [24, 175, 185, 195],
    [26, 185, 195, 205],
    [28, 195, 205, 215],
    [30, 205, 215, 225],
    [32, 215, 223, 231],
    [35, 225, 233, 240],
  ],
};
const STYLE_HAS_DIAMETER = ['neapolitan', 'newyork', 'sourdough', 'pizza_romana'];
const STYLE_DEFAULT_DIAMETER: Record<string, number> = { neapolitan: 30, newyork: 35, sourdough: 30, pizza_romana: 30 };
const STYLE_BALL_DEFAULTS: Record<string, number> = {
  neapolitan: 4, newyork: 4, pizza_romana: 4, roman: 2, pan: 2, sourdough: 4,
  pain_campagne: 1, pain_levain: 1, baguette: 4, pain_complet: 1,
  pain_seigle: 1, fougasse: 2, brioche: 6, pain_mie: 1, pain_viennois: 8,
};
const CORN_LABELS = ['Thin', 'Classic', 'Generous'];
const CORN_LABELS_FR = ['Fine', 'Classique', 'Généreuse'];

// ── Percentage stepper — salt · oil · sugar ─────────────────
// One definition. These were three near-copies that drifted apart: salt had
// no info dot and its own header layout, sugar's "+" had a 8px radius against
// everyone else's 12px, and only salt showed an inline note.
//
// No info dot, and no paragraph either. The guidance is a zone word in the
// same blue/sage/gold/coral semantics the sliders above already use, so the
// steppers read the way the rest of the screen does. A full sentence appears
// only where the value earns one — sugar past 2%, oil in a pizza oven. Both
// rows keep a reserved height so one column cannot shove its neighbours.
function PctStepper({
  label, display, onDec, onInc, reset, zone, note, children,
}: {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  reset?: { onReset: () => void; label: string };
  /** One or two words naming where this value sits, in the same colour
   *  semantics as the sliders above. Always shown. */
  zone?: { word: string; color: string };
  /** The exception, not the rule: a sentence only where the value earns one. */
  note?: string;
  children?: React.ReactNode;
}) {
  const btn: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '14px', flexShrink: 0,
    border: '1.5px solid var(--border)', background: 'var(--cream)',
    fontSize: '15px', cursor: 'pointer', color: 'var(--char)',
    fontFamily: 'var(--font-ui)', lineHeight: 1, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: '4px',
        minHeight: '20px', marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase',
          letterSpacing: '.06em', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
        }}>{label}</span>
        {reset && (
          <button
            onClick={reset.onReset}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
              textDecoration: 'underline', padding: 0, whiteSpace: 'nowrap',
            }}
          >↺ {reset.label}</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={onDec} style={btn} aria-label="−">−</button>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)',
          fontSize: '13px', color: 'var(--char)', fontVariantNumeric: 'tabular-nums',
        }}>{display}</span>
        <button onClick={onInc} style={btn} aria-label="+">+</button>
      </div>
      <div style={{
        fontSize: '11px', lineHeight: 1.3, marginTop: '5px', minHeight: '15px',
        color: zone?.color ?? 'var(--smoke)', fontFamily: 'var(--font-ui)',
        textAlign: 'center',
      }}>{zone?.word ?? ''}</div>
      {note && (
        <div style={{
          fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic',
          lineHeight: 1.4, marginTop: '3px',
        }}>{note}</div>
      )}
      {children}
    </div>
  );
}

function pizzaWeightFromTable(sk: string, d: number, corn: number): number {
  const table = PIZZA_WEIGHT_TABLE[sk];
  if (!table) return 270;
  d = Math.max(table[0][0], Math.min(table[table.length - 1][0], d));
  for (let i = 0; i < table.length - 1; i++) {
    if (d >= table[i][0] && d <= table[i + 1][0]) {
      const r = (d - table[i][0]) / (table[i + 1][0] - table[i][0]);
      const w = table[i][corn + 1] + r * (table[i + 1][corn + 1] - table[i][corn + 1]);
      return Math.round(w / 5) * 5;
    }
  }
  return Math.round(table[table.length - 1][corn + 1] / 5) * 5;
}

// Diameter, crust and weight are three controls over two degrees of freedom:
// weight is what the table gives for a diameter and a crust. So editing weight
// has to move one of the other two, and which one is a real decision.
//
// It used to move the DIAMETER: asking for 270g at 30cm quietly made the pizza
// 33cm. But diameter is an intent — "I want 30cm pizzas" — and it should not
// drift because the baker wanted more dough. Crust is a description of how much
// dough sits on that area, which is exactly what weight expresses.
function cornFromWeight(sk: string, d: number, w: number): number {
  let best = 1, bestDiff = Infinity;
  for (let c = 0; c <= 2; c++) {
    const diff = Math.abs(pizzaWeightFromTable(sk, d, c) - w);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }
  return best;
}

// True when the weight is exactly what the chosen crust gives at this
// diameter. When it is not, no crust segment is highlighted — the label would
// otherwise claim a precision the number does not have.
function crustMatchesWeight(sk: string, d: number, corn: number, w: number): boolean {
  return pizzaWeightFromTable(sk, d, corn) === w;
}

function getWeightBounds(sk: string | null, bt: string | null): { min: number; max: number; step: number } {
  if (bt !== 'bread' || !sk) return { min: 150, max: 500, step: 5 };
  const profile = getBreadProtocol(sk);
  if (profile) return {min: Math.max(40, Math.floor(profile.portions.weight / 2 / 5) * 5), max: Math.max(400, profile.portions.weight * 3), step: 5};
  switch (sk) {
    case 'baguette':      return { min: 200, max: 450,  step: 10 };
    case 'pain_viennois': return { min: 50,  max: 300,  step: 10 };
    case 'brioche':       return { min: 150, max: 900,  step: 25 };
    case 'pain_mie':      return { min: 300, max: 1200, step: 25 };
    case 'pain_levain':
    case 'pain_campagne':
    case 'pain_complet':
    case 'pain_seigle':   return { min: 300, max: 1500, step: 25 };
    default:              return { min: 200, max: 1200, step: 25 };
  }
}

const STYLE_HYDRATION_ZONES: Record<string, {
  min: number; classicMin: number; classicMax: number; advancedMax: number; max: number; name: string;
}> = {
  neapolitan:    { min: 55, classicMin: 60, classicMax: 65, advancedMax: 70, max: 80, name: 'Neapolitan' },
  newyork:       { min: 57, classicMin: 62, classicMax: 67, advancedMax: 72, max: 82, name: 'New York' },
  roman:         { min: 65, classicMin: 72, classicMax: 80, advancedMax: 85, max: 90, name: 'Roman Teglia' },
  pan:           { min: 60, classicMin: 65, classicMax: 72, advancedMax: 78, max: 85, name: 'Pan/Detroit' },
  sourdough:     { min: 60, classicMin: 68, classicMax: 76, advancedMax: 82, max: 88, name: 'Sourdough Pizza' },
  pain_campagne: { min: 60, classicMin: 68, classicMax: 75, advancedMax: 80, max: 85, name: 'Pain de Campagne' },
  pain_levain:   { min: 62, classicMin: 70, classicMax: 78, advancedMax: 84, max: 90, name: 'Pain au Levain' },
  baguette:      { min: 58, classicMin: 65, classicMax: 70, advancedMax: 75, max: 80, name: 'Baguette' },
  pain_complet:  { min: 62, classicMin: 68, classicMax: 75, advancedMax: 80, max: 85, name: 'Pain Complet' },
  pain_seigle:   { min: 65, classicMin: 72, classicMax: 80, advancedMax: 85, max: 90, name: 'Pain de Seigle' },
  fougasse:      { min: 65, classicMin: 70, classicMax: 78, advancedMax: 83, max: 88, name: 'Fougasse' },
  brioche:       { min: 45, classicMin: 50, classicMax: 58, advancedMax: 65, max: 72, name: 'Brioche' },
  pain_mie:      { min: 55, classicMin: 60, classicMax: 65, advancedMax: 70, max: 75, name: 'Pain de Mie' },
  pain_viennois: { min: 52, classicMin: 58, classicMax: 65, advancedMax: 70, max: 75, name: 'Pain Viennois' },
};
const FALLBACK_ZONE = { min: 50, classicMin: 60, classicMax: 70, advancedMax: 78, max: 85, name: 'Custom' };

// ── Step flow model ──────────────────────────
// One derived list per mode is the single source of truth for: the chip
// carousel, the "Étape N sur X" counter, Prev/Next targets and the
// missing-field CTA. Step `id`s stay the historical numbers so the existing
// advance()/restore/skip logic keeps working; the displayed position is the
// index in this list, so merging or hiding a step never means renumbering.
type StepDef = {
  id: number;
  chip: string;          // short label carried by the chip
  title: string;         // page title
  value: string | null;  // summary, null when the step has no answer
  // Short form for the summary bar when the full values no longer fit one
  // line. Only steps whose value is long need one; the rest fall back.
  short?: string | null;
  prefilled?: boolean;   // value is a code default, not a baker's decision
  gap: string;           // sentence used by the missing-field CTA
  // Which of the review page's four questions this step answers. Display
  // only — the flow, the ids and their order are untouched by it.
  group?: 'making' | 'kitchen' | 'dough' | 'plan';
};

type StepFlow = {
  steps: StepDef[];
  activeId: number;
  highestStep: number;
  locale: string;
  onJump: (id: number) => void;
  onGapJump: (id: number) => void;
  onPrev: (id: number) => void;
  onNext: (id: number) => void;
  nextIdFor: (id: number) => number;
  onGenerate: () => void;
  showGenerate: boolean;
  generateLabel: string;
  onSeePlan: () => void;
  recipeGenerated: boolean;
  gapReturn: boolean;
  onGapReturn: () => void;
};

// ── Swipe between step pages ──────────────────
// Secondary to the buttons, never the only way anywhere: iOS Safari owns the
// first ~24px of the left edge for its own back gesture, so a swipe-back
// started there never reaches us.
function useStepSwipe(flow: StepFlow, enabled: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let sx = 0, sy = 0, live = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as HTMLElement | null;
      // Anything that drags or scrolls horizontally keeps its gesture:
      // range inputs, the chart's draggable diamonds, chip rows, carousels.
      // Any control keeps its own gesture. A tap that drifts sideways on a
      // button — the filter toggle, a chip, a stepper — could turn the page
      // under the baker's finger.
      if (target?.closest('button, a, input, select, textarea, svg, [role="button"], [data-noswipe]')) { live = false; return; }
      let n: HTMLElement | null = target;
      while (n && n !== el) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) { live = false; return; }
        n = n.parentElement;
      }
      if (t.clientX < 24 || t.clientX > window.innerWidth - 8) { live = false; return; }
      live = true; sx = t.clientX; sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.58) return;
      const i = flow.steps.findIndex(x => x.id === flow.activeId);
      if (i < 0) return;
      if (dx < 0) { if (i < flow.steps.length - 1) flow.onNext(flow.activeId); }
      else        { if (i > 0) flow.onPrev(flow.activeId); }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
    };
  }, [flow, enabled]);
  return ref;
}

// A code default is a suggestion until the baker has moved past its page:
// passing through with Suivant counts as adopting it, which is exactly what
// highestStep already records.
function stepAnswered(s: StepDef, highest: number, list?: StepDef[]): boolean {
  if (s.value == null) return false;
  if (!s.prefilled) return true;
  // A default counts as adopted once the baker has moved past its page — but
  // there is no past the last page. Without this the final step's own CTA read
  // "Dough not confirmed" forever and jumped to the page it was already on.
  const isLast = list != null && list.length > 0 && list[list.length - 1].id === s.id;
  return isLast ? highest >= s.id : highest > s.id;
}

// ── Summary chip carousel ─────────────────────
// Appears progressively while the baker advances, and becomes the navigation
// once they come back from the recipe. One mechanic, two uses.
// ── Step groups ───────────────────────────────
// The review page asks four questions instead of listing ten settings.
// Groups are display-only: ids, order and the flow are untouched.
const GROUP_ORDER = ['making', 'kitchen', 'dough', 'plan'] as const;
type StepGroup = typeof GROUP_ORDER[number];
const GROUP_TITLE: Record<StepGroup, { en: string; fr: string }> = {
  making:  { en: 'What you\u2019re making', fr: 'Ce que vous préparez' },
  kitchen: { en: 'Your kitchen',          fr: 'Votre cuisine' },
  dough:   { en: 'What goes in it',       fr: 'Ce qu\u2019il y a dedans' },
  plan:    { en: 'When you\u2019re baking', fr: 'Quand vous enfournez' },
};

// `prefilled` means one thing now: the value came from the baker's profile
// rather than from this session. It used to be set statically on Quantity,
// Climate, Flour, Preferment and Fine-tune and stayed true after an edit,
// which is why surfacing it as an ASSUMED badge told bakers that choices they
// had just made were guesses.
//
// Quantity, Flour and Preferment no longer carry a static `prefilled` at all.
// They report `value: null` until qtyChosen / flourChosen / prefermentChosen
// says the baker or their profile settled them, so `stepAnswered` returns
// false on its own and the door names the step. Nothing is drawn from
// `prefilled` today; whether anything ever should be is a separate question.

// ── Summary chip carousel ─────────────────────
// Two questions, two controls. The rail shows what the baker has DECIDED —
// real answers only, never placeholders, because ten grey slots on step one
// turns a guided flow into a form. The pinned door shows HOW FAR ALONG they
// are, and opening it shows WHAT IS LEFT. Neither has to compromise.
//
// The count is a tally (answers out of total), not a page position. The old
// objection — that a number at the head of a line naming the current page
// reads as position — does not apply once it wears a SET caption and sits
// beside chips that are the very things being counted. The progress rule
// below fills on the same tally, so the two can never disagree.
// Not sticky. It renders inside the phase bar's sticky box, which is the
// whole point: one sticky element for the module's navigation, so there is no
// offset to compute and nothing to disagree with. Every previous version of
// this — topOffset, raised, stickTop, phaseBarH — was arithmetic trying to
// keep two independent sticky elements from landing on each other.
function SummaryBar({ flow, modeChip }:
  { flow: StepFlow;
    modeChip?: { value: string; onClick: () => void } }) {
  const [open, setOpen] = React.useState(false);
  const overviewRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overviewRef.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key !== 'Tab') return;
      const items = Array.from(overviewRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? []);
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === overviewRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === overviewRef.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open]);
  // A bottom sheet that can only be dismissed by tapping outside is a sheet in
  // appearance only — the grab handle promises a drag it did not accept.
  const [dragY, setDragY] = React.useState(0);
  const dragFrom = React.useRef<number | null>(null);
  // `dragging` mirrors the ref for render use: reading a ref while rendering is
  // untracked, so the transition could be computed from a stale value.
  const [dragging, setDragging] = React.useState(false);
  const fr = flow.locale === 'fr';
  const answered = flow.steps.filter(s => stepAnswered(s, flow.highestStep, flow.steps));
  const pending  = flow.steps.filter(s => !stepAnswered(s, flow.highestStep, flow.steps));

  const total = flow.steps.length + (modeChip ? 1 : 0);
  const count = answered.length + (modeChip ? 1 : 0);
  // No progress rule under the rail. It was the same fact a third time: the
  // chips say WHICH steps are set, the pin says HOW MANY, and the rule said
  // how many again as a length — the least informative of the three, since a
  // bar cannot name a step. The sticky container's own shadow already
  // separates the bar from the content it floats over.

  // A gap the baker has WALKED PAST is different from a step they simply have
  // not reached. Only the first goes gold — otherwise the pin screams warning
  // through the whole first run, when nothing is wrong at all.
  const walkedPast = pending.find(s => flow.highestStep > s.id) ?? null;

  // The newest chip is the one the baker just earned, and it is the one that
  // lands off-screen once the rail overflows. Instant, never smooth: smooth
  // scrolling moves targets under fingers.
  const railRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = railRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [answered.length]);

  const chipStyle: React.CSSProperties = {
    flex: '0 0 auto', background: 'var(--warm)', border: '1px solid var(--border)',
    borderRadius: '20px', padding: '5px 11px', color: 'var(--ash)',
    fontSize: '12.5px', lineHeight: 1.25, whiteSpace: 'nowrap',
    fontFamily: 'var(--font-ui)', cursor: 'pointer', textAlign: 'left',
    minHeight: '38px',
  };
  const chipKeyStyle: React.CSSProperties = {
    color: 'var(--smoke)', fontSize: '9px', display: 'block',
    letterSpacing: '.05em', textTransform: 'uppercase', lineHeight: 1.3,
  };

  return (
    <>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',minHeight:44}}>
        <span style={{fontSize:14,fontWeight:600}}>{fr?'Votre recette':'Your recipe'}</span>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}
          style={{minHeight:44,padding:'0 4px',border:0,background:'transparent',fontSize:14,color:'var(--ash)',cursor:'pointer'}}>
          {fr?'Étape':'Step'} {Math.max(1,flow.steps.findIndex(s=>s.id===flow.activeId)+1)}/{flow.steps.length} <span aria-hidden="true">⌄</span>
        </button>
      </div>

      {open && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.45)', zIndex: 150,
          }} />
          <div ref={overviewRef} role="dialog" aria-modal="true" aria-label={fr ? 'Votre plan' : 'Your plan'} tabIndex={-1} style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151,
            background: 'var(--warm)', borderRadius: '20px 20px 0 0',
            padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
            maxHeight: '74vh', overflowY: 'auto',
            transform: `translateY(${dragY}px)`,
            transition: dragging ? 'none' : 'transform .22s ease',
          }}>
            <button type="button" onClick={() => setOpen(false)} style={{ display: 'block', marginLeft: 'auto', minHeight: 44, padding: '8px 12px', background: 'transparent', color: 'var(--terra)', border: 0, cursor: 'pointer' }}>{fr ? 'Terminé' : 'Done'}</button>
            {/* The drag lives on the handle and the header, not the whole
                sheet: the list below scrolls, and a sheet that follows the
                finger while the list is trying to scroll fights the baker. */}
            <div
              onPointerDown={e => { dragFrom.current = e.clientY; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (dragFrom.current !== null) setDragY(Math.max(0, e.clientY - dragFrom.current)); }}
              onPointerUp={() => {
                // Past a quarter of the sheet it closes; short of that it
                // springs back, so a hesitant pull is not a decision.
                const shouldClose = dragY > 120;
                dragFrom.current = null;
                setDragging(false);
                setDragY(0);
                if (shouldClose) setOpen(false);
              }}
              style={{ padding: '4px 0 10px', margin: '-4px 0 0', touchAction: 'none', cursor: 'grab' }}
            >
              <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: '#E0D8CC', margin: '0 auto' }} />
            </div>
            <h3
              onPointerDown={e => { dragFrom.current = e.clientY; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={e => { if (dragFrom.current !== null) setDragY(Math.max(0, e.clientY - dragFrom.current)); }}
              onPointerUp={() => {
                const shouldClose = dragY > 120;
                dragFrom.current = null;
                setDragging(false);
                setDragY(0);
                if (shouldClose) setOpen(false);
              }}
              style={{
                fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700,
                margin: '2px 0 12px', touchAction: 'none', cursor: 'grab',
              }}
            >
              {fr ? 'Où vous en êtes' : 'Where you are'}
            </h3>

            <div style={sheetHeadStyle}>
              {fr ? `Choisis \u2014 ${count}` : `Set \u2014 ${count}`}
            </div>
            {modeChip && (
              <button
                onClick={() => { setOpen(false); modeChip.onClick(); }}
                style={sheetRowStyle}
              >
                <span style={sheetKeyStyle}>{fr ? 'Mode' : 'Mode'}</span>
                <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 600, textAlign: 'left' }}>{modeChip.value}</span>
                <SheetChevron />
              </button>
            )}
            {answered.map(st => (
              <SetupRow key={st.id} step={st} ok
                onClick={() => { setOpen(false); flow.onJump(st.id); }} />
            ))}

            {/* The road ahead, on demand and only on demand. Not styled as an
                error: nothing is wrong, the baker simply has not got there. */}
            {pending.length > 0 && (
              <>
                <div style={sheetHeadStyle}>
                  {fr ? `Reste à faire \u2014 ${pending.length}` : `Still to come \u2014 ${pending.length}`}
                </div>
                {pending.map(st => (
                  <SetupRow key={st.id} step={st} ok={false}
                    onClick={() => { setOpen(false); flow.onJump(st.id); }} />
                ))}
              </>
            )}
          </div>
        </>
      , document.body)}
    </>
  );
}

const sheetHeadStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '9.5px', letterSpacing: '.09em',
  textTransform: 'uppercase', color: 'var(--smoke)', padding: '14px 2px 4px',
};

// ── Setup review ──────────────────────────────
function SetupReview({ flow, modeChip, onJump, onBackToRecipe, nameField, stale = false, reviewValues = {} }: {
  nameField?: React.ReactNode;
  flow: StepFlow;
  modeChip?: { value: string; onClick: () => void };
  onJump: (id: number) => void;
  onBackToRecipe: () => void;
  stale?: boolean;
  reviewValues?: Record<number, string | null>;
}) {
  const fr = flow.locale === 'fr';
  // Timing closes the review; the guided step order remains unchanged.
  const steps = [...flow.steps.filter(s => s.group !== 'plan'), ...flow.steps.filter(s => s.group === 'plan')];
  const rows = [
    ...(modeChip ? [{ key: 'mode', label: 'Mode', value: modeChip.value, onClick: modeChip.onClick }] : []),
    ...steps.map(step => ({ key: String(step.id), label: step.chip, value: reviewValues[step.id] ?? step.value ?? step.gap, onClick: () => onJump(step.id) })),
  ];
  return (
    <div style={{ padding: '4px 0 8px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, margin: '2px 0 6px', letterSpacing: '-.4px' }}>{fr ? 'Vérifier mes choix' : 'Review my choices'}</h2>
      {nameField}
      <div>
        {rows.map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--smoke)', marginBottom: '5px' }}>{row.label}</span>
              <strong style={{ fontSize: '14px', lineHeight: 1.5, fontWeight: 600 }}>{row.value}</strong>
            </div>
            <button onClick={row.onClick} aria-label={`${fr ? 'Modifier' : 'Edit'} : ${row.label}`} style={{ minHeight: '44px', border: 'none', background: 'none', color: 'var(--terra)', font: 'inherit', fontSize: '13px', cursor: 'pointer', padding: '8px 0 8px 8px' }}>{fr ? 'Modifier' : 'Edit'}</button>
          </div>
        ))}
      </div>
      {(flow.recipeGenerated || flow.showGenerate) && (
        <button onClick={onBackToRecipe} style={{ ...NEXT_CTA, marginTop: '22px' }}>
          {!flow.recipeGenerated ? (fr ? 'Créer la recette' : 'Create recipe') : stale ? (fr ? 'Mettre à jour la recette' : 'Update recipe') : (fr ? 'Voir les ingrédients' : 'View ingredients')}
        </button>
      )}
    </div>
  );
}

// Compact row for the progress sheet.
function SetupRow({ step, ok, onClick, inset, last }: {
  step: StepDef; ok: boolean; onClick: () => void;
  inset?: boolean; last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
        padding: inset ? '13px 15px' : '14px 2px',
        background: 'none', border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',
        borderBottomStyle: 'solid',
        cursor: 'pointer', fontFamily: 'var(--font-ui)', minHeight: '44px',
        textAlign: 'left',
      }}
    >
      <span style={{ ...sheetKeyStyle, width: inset ? '84px' : '96px' }}>{step.chip}</span>
      <span style={{ flex: 1, fontSize: '14.5px', textAlign: 'left', lineHeight: 1.35 }}>
        {ok ? (
          <span style={{ fontWeight: 600, color: 'var(--char)' }}>
            {step.value}
          </span>
        ) : (
          <span style={{ color: '#9C8248', fontWeight: 400 }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px',
              borderRadius: '50%', background: 'var(--gold)',
              marginRight: '6px', verticalAlign: '1px',
            }} />
            {step.gap}
          </span>
        )}
      </span>
      <SheetChevron />
    </button>
  );
}

const sheetRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
  padding: '14px 2px', borderBottom: '1px solid var(--border)',
  background: 'none', border: 'none', borderBottomStyle: 'solid',
  cursor: 'pointer', fontFamily: 'var(--font-ui)', minHeight: '44px',
};
const sheetKeyStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--smoke)', width: '96px', flexShrink: 0, textAlign: 'left',
};
function SheetChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0A69B"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// Every forward move in the journey wears the same button: Suivant between
// step pages, Generer ma recette at the end of setup, Planifier ma Pizza Party
// at the end of the protocol. They were three different shapes for one idea.
// NEXT_CTA and BACK_CTA now live in app/lib/navButtons so Pizza Party can
// use the same objects. #6B4423 became var(--terra), which is that exact
// value — the token was already the crust brown.

// ── One step = one page ───────────────────────

// ── Style is not an optional input ───────────────────────────
// It IS the fermentation biology: Neapolitan is 24h cold + 2h room, Roman is
// 6h at room temperature and never sees a fridge. Without it there is no
// dough to schedule, so a plan is not a degraded answer, it is a fabricated
// one — and it silently rewrites itself the moment a style is picked.
//
// Three engines used to disagree about an unset style. The recommender fell
// back to no cold retard at all, buildSchedule fell back to Neapolitan, and
// the recipe refused outright. That is how a 4-hour plan appeared under a
// 26-hour curve. All three now agree: no style, no plan.
//
// This is not a new gate. Style is already step 1; the only way to reach the
// plan without it is jumping backwards. This just makes the plan step honour
// an order the flow already asserts.
function NeedsStyleFirst({ fr, onChoose }: { fr: boolean; onChoose: () => void }) {
  return (
    <div style={{ padding: '8px 0 4px' }}>
      <p style={{
        fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
        lineHeight: 1.55, margin: '0 0 16px',
      }}>
        {fr
          ? 'Choisissez un style pour adapter les ingrédients et le planning.'
          : 'Choose a style to tailor the ingredients and schedule.'}
      </p>
      <button
        onClick={onChoose}
        style={{
          ...NEXT_CTA,
          background: 'var(--warm)', color: '#6B4423',
          border: '1.5px solid #6B4423', boxShadow: 'none',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
        }}
      >
        {fr ? 'Choisir le style →' : 'Choose your style →'}
      </button>
    </div>
  );
}

function StepPage({ flow, id, children, nextOverride }: { flow: StepFlow; id: number; children: React.ReactNode; nextOverride?: React.ReactNode }) {
  const navigationHeight = useBottomNavHeight(64);
  if (flow.activeId !== id) return null;
  const idx  = flow.steps.findIndex(s => s.id === id);
  const step = flow.steps[idx];
  if (!step) return null;
  const fr     = flow.locale === 'fr';
  const isLast = idx === flow.steps.length - 1;
  const gap    = flow.steps.find(s => !stepAnswered(s, flow.highestStep, flow.steps));

  const nextStyle = NEXT_CTA;  // A dead button is a dead end: the CTA stays live and names what's missing.
  const missingStyle: React.CSSProperties = {
    ...nextStyle,
    background: 'var(--warm)', color: '#6B4423',
    border: '1.5px solid #6B4423', boxShadow: 'none',
    fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
  };

  let next: React.ReactNode = null;
  if (id === 1 && !step.value) {
    next = <div style={{ width: '100%' }}>
      <p style={{ fontSize: '13px', color: 'var(--ash)', margin: '0 0 8px' }}>{fr ? 'Sélectionnez un style pour continuer.' : 'Select a style to continue.'}</p>
      <button disabled style={{ ...nextStyle, opacity: 0.5, cursor: 'not-allowed' }}>{fr ? 'Continuer' : 'Continue'}</button>
    </div>;
  } else if (flow.gapReturn && !isLast) {
    // Filling one gap should hand the baker straight to the next one. Bouncing
    // back to the last step to be told what is still missing makes them walk
    // the same loop once per gap. This step counts as settled the moment they
    // leave it, so it is excluded when looking for what is next.
    // FORWARD ONLY. Searching for any unanswered step and merely excluding
    // this one lets two genuinely-empty steps hand the baker back and forth
    // for ever — Style → Yeast → Style. Only ever looking at steps after this
    // one makes the chain monotonic, so it has to end at the plan.
    const lastId = flow.steps[flow.steps.length - 1].id;
    const found = flow.steps.find(s => s.id > id && !stepAnswered(s, flow.highestStep, flow.steps));
    const nextGap = found && found.id !== lastId ? found : undefined;
    // Name where the button GOES, never what is absent. A step that is not
    // set yet is the normal state of almost every step for almost all of the
    // journey; saying so on every screen turns a guided flow into a list of
    // failures. The gap sentences still exist on the review page and in the
    // sheet, where they describe a state rather than block a baker who is
    // simply walking forward.
    next = nextGap
      ? <button onClick={flow.onGapReturn} style={nextStyle}>
          {nextGap.chip} →
        </button>
      : <button onClick={flow.onGapReturn} style={nextStyle}>
          {fr ? 'Terminer →' : 'Finish →'}
        </button>;
  } else if (isLast) {
    if (gap) {
      // Outlined here, because on the final step an unfilled one really is
      // what stands between the baker and a recipe — but named, not accused.
      next = <button onClick={() => flow.onGapJump(gap.id)} style={missingStyle}>
        {gap.chip} →
      </button>;
    } else if (flow.showGenerate) {
      next = <button onClick={flow.onGenerate} style={nextStyle}>{flow.generateLabel}</button>;
    } else if (flow.recipeGenerated) {
      next = <button onClick={flow.onSeePlan} style={nextStyle}>{fr ? 'Voir les ingrédients →' : 'View ingredients →'}</button>;
    }
  } else {
    // Label the step Suivant actually reaches, not the one that happens to sit
    // next in the list: with profile-answered steps skipped, "Suivant :
    // Équipement" was landing on Climat.
    next = <button onClick={() => flow.onNext(id)} style={nextStyle}>
      {fr ? 'Continuer' : 'Continue'}
    </button>;
  }

  // Both pages move together — only the incoming one animating reads as a
  // swap rather than a displacement, which is what loses the eye.
  return (
    <div id={`step-${id}`} key={id} className="bh-step-page" style={{ padding: '8px 2px 4px' }}>
      {/* No step counter here: the summary bar above carries it, and two
          "3 of 9" forty pixels apart is just noise. */}
      <h2 style={{
        fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '30px',
        lineHeight: 1.12, letterSpacing: '-.015em', margin: '0 0 18px', color: 'var(--char)',
      }}>{step.title}</h2>

      {children}

      <div className="bh-step-actions" style={{
        display: 'grid', gridTemplateColumns: '1fr',
        gap: '12px', padding: '8px 0', position:'sticky', bottom:navigationHeight, zIndex:90, background:'var(--warm)',
      }}>

        {nextOverride !== undefined ? nextOverride : next}
      </div>
    </div>
  );
}

// ── Mono label ────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase',
      letterSpacing: '.06em', fontFamily: 'var(--font-ui)', marginBottom: '8px',
    }}>
      {children}
    </div>
  );
}

// ── Oil / Sugar style defaults ────────────────
function oilDefault(sk: string): number {
  return (ALL_STYLES as Record<string, { oil?: number }>)[sk]?.oil ?? 0;
}
function sugarDefault(sk: string): number {
  return (ALL_STYLES as Record<string, { sugar?: number }>)[sk]?.sugar ?? 0;
}

// ── Oil guidance ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function oilGuidance(oil: number, ovenType: string, styleKey: string, tFn: (k: string, v?: any) => string): string {
  const isHighTemp = ovenType === 'pizza_oven' || ovenType === 'electric_pizza';
  const styleName = styleKey === 'neapolitan' ? 'Neapolitan' : 'style';
  if (oil === 0 && isHighTemp) return tFn('dialIn.oil.traditionalHighTemp');
  if (oil === 0 && !isHighTemp) return tFn('dialIn.oil.traditionalHome', { style: styleName });
  if (oil > 0 && isHighTemp) return tFn('dialIn.oil.highTempNote');
  if (oil > 0 && oil <= 2) return tFn('dialIn.oil.home1');
  if (oil > 2 && oil <= 5) return tFn('dialIn.oil.home2');
  if (oil > 5) return tFn('dialIn.oil.high');
  return '';
}

// ── Sugar guidance ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sugarGuidance(sugar: number, ovenType: string, tFn: (k: string, v?: any) => string): { note: string; warn: boolean } {
  const isHighTemp = ovenType === 'pizza_oven' || ovenType === 'electric_pizza';
  if (sugar === 0 && isHighTemp) return { note: tFn('dialIn.sugar.traditionalHighTemp'), warn: false };
  if (sugar === 0 && !isHighTemp) return { note: tFn('dialIn.sugar.traditionalHome'), warn: false };
  if (sugar > 0 && sugar <= 1) return { note: tFn('dialIn.sugar.subtle'), warn: false };
  if (sugar > 1 && sugar <= 2) return { note: tFn('dialIn.sugar.noticeable'), warn: false };
  if (sugar > 2 && sugar <= 4) return { note: tFn('dialIn.sugar.osmotic'), warn: true };
  if (sugar > 4) return { note: tFn('dialIn.sugar.high'), warn: true };
  return { note: '', warn: false };
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════
export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
  const HUMIDITY_LABEL: Record<string, string> = {
    dry:          t('climate.humidityDry'),
    normal:       t('climate.humidityNormal'),
    humid:        t('climate.humidityHumid'),
    'very-humid': t('climate.humidityVeryHumid'),
  };
  const [tab, setTab] = useState<'simple' | 'custom'>('simple');
  const [activeStep, setActiveStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [advancedStep, setAdvancedStep] = useState(1);
  const [advancedHighestStep, setAdvancedHighestStep] = useState(1);
  const [flourBlend, setFlourBlend] = useState<FlourBlend>({ flour1: 'pizza00', flour2: null, ratio1: 100 });

  // Step 1 — bake type
  const [bakeType, setBakeType] = useState<BakeType | null>(null);

  // Step 2 — style + quantity
  const [styleKey, setStyleKey] = useState<StyleKey | null>(null);
  const breadProtocol = styleKey ? getBreadProtocol(styleKey) : undefined;
  const isUnleavened = breadProtocol?.method === 'unleavened';
  const breadSupportsStarter = !breadProtocol || breadProtocol.supportedPreferments.includes('levain');
  const [numItems, setNumItems] = useState(2);
  const [itemWeight, setItemWeight] = useState(270);
  const [pizzaDiameter, setPizzaDiameter] = useState(30);
  const [pizzaCorn, setPizzaCorn] = useState(1);

  // ── Settled, not merely defaulted ─────────────
  // Quantity, Flour and Preferment each hold a hard-coded starting value (2 x
  // 270 g, pizza00, 'none'), and until now the flow adopted it the moment the
  // baker walked past the page: Preferment read "Direct" for someone who never
  // chose Direct, recorded identically to a style they did choose.
  //
  // The rule is: the profile answers the step, or the baker does. Nothing else
  // counts. The state below keeps its default so the engine always has a
  // number to work with, but the step reports no value until one of those two
  // settles it, and Generate waits for all three.
  //
  // Deliberately three booleans rather than a general mechanism. Climate and
  // Fine-tune are NOT in this set and should not be added lightly: Fine-tune's
  // values are derived from the style the baker chose, so they are a
  // recommendation rather than an assumption, and kitchen temperature is a
  // slider with no honest blank state — its provenance belongs with the
  // weather prefill, which can show a source line instead.
  //
  // Only Preferment renders UNSELECTED while unsettled, because a chip list
  // has an honest blank state. A flour blend and a numeric stepper do not:
  // an empty blend is not a thing you can draw, and a stepper showing nothing
  // is a broken control, not an unanswered question. For those two the page
  // keeps showing a working value while the STEP reports none — the door goes
  // gold and names it, and Generate waits. Same reasoning as Climate.
  const [qtyChosen, setQtyChosen] = useState(false);
  const [flourChosen, setFlourChosen] = useState(false);
  const [manualFlourEntry, setManualFlourEntry] = useState(false);
  const [prefermentChosen, setPrefermentChosen] = useState(false);

  // Wrappers for the quantity controls only. Choosing a style also sets a
  // default ball count and weight, and that must not count as the baker
  // answering the question — so those call sites keep the plain setters.
  const chooseNumItems = (v: number | ((n: number) => number)) => {
    setQtyChosen(true);
    setNumItems(v as number);
  };
  const chooseItemWeight = (v: number) => {
    setQtyChosen(true);
    setItemWeight(v);
  };
  const [avpnOpen, setAvpnOpen] = useState(false);

  // Step 3 — oven
  const [ovenType, setOvenType] = useState<AnyOvenType | null>(null);
  const [bakeName, setBakeName] = useState('');
  const [ovenConstruction, setOvenConstruction] = useState<'tabletop'|'masonry'|'home'|'micro'>('tabletop');

  // Step 4 — mixer
  const [mixerType, setMixerType] = useState<MixerType | null>(null);

  // Step 5 — schedule + yeast
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [eatTime, setEatTime] = useState<Date | null>(null);
  const [acceptedScheduleRepair, setAcceptedScheduleRepair] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [yeastType, setYeastType] = useState<YeastType | null>(null);

  // Step 6 — climate
  const [waterSource, setWaterSource] = useState<'room' | 'fridge' | 'tap' | 'measured'>('room');
  const [measuredWaterTemp, setMeasuredWaterTemp] = useState<number | undefined>(undefined);
  const [waterMethod, setWaterMethod] = useState<'premelt' | 'direct'>('premelt');
  const [spiralIceConfirmed, setSpiralIceConfirmed] = useState(false);
  const [mixingBatches, setMixingBatches] = useState<number | undefined>(undefined);
  const [containerCapacityLitres, setContainerCapacityLitres] = useState<number | undefined>(3);
  const [equipmentPanel, setEquipmentPanel] = useState<'oven'|'mixer'>('oven');
  useEffect(() => { if (!isRestoringRef.current) setMixingBatches(undefined); }, [numItems, itemWeight, mixerType, styleKey]);
  const [kitchenTemp, setKitchenTemp] = useState(22);
  const [humidity, setHumidity] = useState('normal');
  const [fridgeTemp, setFridgeTemp] = useState(6);
  const [units, setUnits] = useState<UnitSystem>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bh_units') as UnitSystem) ?? 'metric';
    }
    return 'metric';
  });
  function setUnitsAndPersist(u: UnitSystem) {
    setUnits(u);
    if (typeof window !== 'undefined') localStorage.setItem('bh_units', u);
  }
  const [priorityOverride, setPriorityOverride] = useState<string | null | undefined>(undefined);

  // Modals & results
  const [showResults, setShowResults]         = useState(false);


  // Sourdough feed time + constraint solver outputs
  const [starterEvents, setStarterEvents] = useState<StarterEvent[]>([]);
  const [starterPlanResetKey, setStarterPlanResetKey] = useState(0);
  const [feedTime, setFeedTime]             = useState<Date | null>(null);
  const [feed2Time, setFeed2Time]           = useState<Date | null>(null);
  const [fridgeOutTime, setFridgeOutTime]   = useState<Date | null>(null);
  const [starterFridgeInTime, setStarterFridgeInTime] = useState<Date | null>(null);
  const [starterState, setStarterState]     = useState<'rt_fed' | 'fridge_unfed' | 'fridge_fed'>('rt_fed');
  const [starterLocation, setStarterLocation] = useState<'rt' | 'fridge'>('rt');
  const [planningMode, setPlanningMode]     = useState<'last_fed' | 'know_peak'>('last_fed');
  const [lastFedTime, setLastFedTime]       = useState<Date | null>(null);
  const [knownPeakTime, setKnownPeakTime]   = useState<Date | null>(null);
  const [hasNotFedYet, setHasNotFedYet]     = useState<boolean | null>(null);
  const [lastFedAge, setLastFedAge]         = useState<'today'|'yesterday'|'days23'|'days45'|'week'|null>(null);
  const [lastFeedRatio, setLastFeedRatio]   = useState<1 | 2 | 4 | 5 | 10>(1);
  const [nextFeedRatio, setNextFeedRatio]   = useState<1 | 2 | 4 | 5 | 10>(1);
  const [nextFeedRatioOverride, setNextFeedRatioOverride] = useState<1 | 2 | 4 | 5 | 10 | null>(null);
  const [ratioMode, setRatioMode] = useState<'recommend' | 'keep'>('recommend');
  const [starterPeakTime, setStarterPeakTime] = useState<Date | null>(null);
  const [starterMature, setStarterMature]   = useState(true);
  const [starterHasRye, setStarterHasRye]   = useState(false);
  const [tang, setTang] = useState<'mild' | 'balanced' | 'tangy'>('balanced');
  const [usingPeak2, setUsingPeak2]         = useState(false);

  // Advanced mode manual overrides
  const [prefermentType, setPrefermentType] = useState<PrefermentType>('none');
  const [prefermentValidity, setPrefermentValidity] = useState<{type: PrefermentType; valid: boolean}>({type:'none',valid:false});
  const onPrefermentValidityChange = React.useCallback((valid: boolean) => {
    setPrefermentValidity(previous => previous.type === prefermentType && previous.valid === valid ? previous : {type:prefermentType,valid});
  }, [prefermentType]);
  const commercialPrefermentPlanReady = tab !== 'custom' || yeastType === 'sourdough' || !['poolish','biga'].includes(prefermentType)
    || (prefermentValidity.type === prefermentType && prefermentValidity.valid);

  const [prefermentFlourPct, setPrefermentFlourPct] = useState<number | undefined>(undefined);
  const [prefOffsetH, setPrefOffsetH] = useState<number>(0);
  // Driven by SchedulePicker algo result — single source of truth for fridge/RT decision
  const [prefGoesInFridgeState, setPrefGoesInFridgeState] = useState<boolean>(true);

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);
  const [manualSalt, setManualSalt]           = useState<number | undefined>(undefined);
  const [targetDoughTemp, setTargetDoughTemp] = useState<number | undefined>(undefined);
  const [measuredFlourTemp, setMeasuredFlourTemp] = useState<number | undefined>(undefined);
  const [measuredPrefermentTemp, setMeasuredPrefermentTemp] = useState<number | undefined>(undefined);
  const [flourInFridge, setFlourInFridge]     = useState<boolean>(false);
  const [wastePct, setWastePct]               = useState<number | undefined>(undefined);

  // Dial In tooltip visibility

  // BakeType card hover state
  const [hoveredBakeType, setHoveredBakeType] = useState<BakeType | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  // Distinct from reviewMode. reviewMode means "any step may be edited" and
  // is switched on by session restore and by the scheduler jump too; hanging
  // the overview screen off it would have hidden the step those paths scroll
  // to. This flag means only: show the overview instead of the step pages.
  const [setupOverview, setSetupOverview] = useState(false);
  // Set when the baker taps the "X isn't set" CTA on the last page, so the
  // page they land on can offer the way back instead of stranding them.
  const [gapReturnTo, setGapReturnTo] = useState<number | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [showSignInForSave, setShowSignInForSave] = useState(false);
  // Le listener d'auth est monté une seule fois : sans refs il fermerait sur
  // le tout premier rendu et rejouerait une session vide.
  const saveCurrentSessionRef = useRef<(() => Promise<boolean>) | null>(null);
  const shareCurrentSessionRef = useRef<(() => Promise<void>) | null>(null);
  const [savedToCloudName, setSavedToCloudName] = useState<string | null>(null);
  const [cloudSaveState, setCloudSaveState] = useState<'idle' | 'saving' | 'failed'>('idle');
  // Vrai dès qu'on sait où on en est : session locale réappliquée, ou rien à
  // réappliquer. Un ref, parce que l'effet de rejeu doit le lire avant le
  // prochain rendu ; authTick le réveille, un ref seul ne rend pas.
  const restoreSettledRef = useRef(false);
  const [authTick, setAuthTick] = useState(0);
  // Incremente a chaque restauration : dit au selecteur de pizzas de relire
  // les quantites, que son etat interne ne peut pas deviner tout seul.
  const [partyRestoreToken, setPartyRestoreToken] = useState(0);
  // La liste des 150 pizzas est chargee paresseusement, donc les quantites
  // d'une session reprise arrivent APRES la restauration, souvent bien apres
  // la fenetre de 200 ms. Pendant ce trou, pizzaPartyQtys vaut {} et
  // buildPizzaPartySnapshot renvoie null : l'autosave ecrasait la soiree
  // enregistree — pizzas, courses et preparation — par un null, et seules les
  // quantites revenaient ensuite. C'est ce qui faisait disparaitre les coches.
  const partyHydratingRef = useRef(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [bakeEventId, setBakeEventId] = useState<string | null>(null);
  const [pizzaPartyQtys, setPizzaPartyQtys] = useState<Record<string, number>>({});
  const [sandwichParty, setSandwichParty] = useState<SandwichSnapshot>(() => createSandwichSnapshot());
  // Pain au levain option: seeds with a soaker step (adds a Trempage step to the protocole)
  const [addSeeds, setAddSeeds] = useState(false);
  const [bakedPartyQtys, setBakedPartyQtys] = useState<Record<string, number>>({});
  useEffect(() => {
    if (isRestoringRef.current) return;
    setSessionSaved(false);
  }, [
    styleKey, ovenType, mixerType, yeastType,
    numItems, itemWeight, kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, humidity,
    fridgeTemp, manualHydration, prefermentType,
    prefermentFlourPct, eatTime, pizzaPartyQtys, bakedPartyQtys, sandwichParty,
  ]);
  const [bakePhotoUrl, setBakePhotoUrl] = useState<string | null>(null);
  const [bakedDone, setBakedDone] = useState(false);
  useEffect(() => {
    if (bakedDone) setSessionSaved(false);
  }, [bakedDone]);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);

  const resultsRef           = useRef<HTMLDivElement>(null);
  const modeSelectorRef      = useRef<HTMLDivElement>(null);
  const suppressNextScrollRef = useRef(false);
  const isRestoringRef = useRef(false);
  const pizzaPartyGetQtysRef = useRef<() => Record<string, number>>(() => ({}));

  // P5 — Custom-only state persistence
  const customOnlyStateRef = useRef<{
    flourBlend: FlourBlend;
    hydration: number | undefined;
    oil: number | undefined;
    sugar: number | undefined;
    prefermentType: PrefermentType;
    prefermentFlourPct: number | undefined;
  } | null>(null);

  // P5 — Stale protocol indicator
  const [protocolStale, setProtocolStale] = useState(false);

  // P5/P6 — Recipe generated flag
  const [recipeGenerated, setRecipeGenerated] = useState(false);

  // P6 — Active tab in two-tab layout
  const [activeTab, setActiveTab] = useState<'setup' | 'plan' | 'guide' | 'pizzaparty' | 'sandwiches'>('setup');
  const lastDoughTab = useRef<'setup' | 'plan' | 'guide'>('setup');
  const lastDoughOverview = useRef(false);
  useEffect(() => {
    if (activeTab === 'setup' || activeTab === 'plan' || activeTab === 'guide') lastDoughTab.current = activeTab;
    if (activeTab === 'setup') lastDoughOverview.current = setupOverview;
  }, [activeTab, setupOverview]);
  // The summary bar used to pin at a hardcoded 97px (pizza) / 62px (bread),
  // which is the height the sticky header HAPPENED to be. The header is
  // z-100 and the bar z-25, so any underestimate does not push the bar down,
  // it hides it: the chip rail was rendering underneath the tab strip with
  // its labels sliced off. Measured, so the two can never drift apart again.
  const stickyHeadRef = useRef<HTMLDivElement | null>(null);
  const [stickyHeadH, setStickyHeadH] = useState(97);
  useEffect(() => {
    const el = stickyHeadRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => setStickyHeadH(Math.round(el.getBoundingClientRect().height));
    sync();
    let frame = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, []);

  // The overview is a destination, not a mode: leaving Setup by any route
  // closes it, so the tab strip never drops the baker onto it unannounced.
  useEffect(() => { if (activeTab !== 'setup') setSetupOverview(false); }, [activeTab]);
  const [pizzaPartyTab, setPizzaPartyTab] = useState<'pick' | 'shop' | 'prep' | 'bake'>('pick');
  const [navHidden, setNavHidden] = useState(false);
  const bottomNavCollapsed = navHidden && activeTab !== 'setup';
  // Hide exactly the measured header height; keep the following bar aligned.
  const HEADER_HIDE_PX = stickyHeadH;
  const stickTop = Math.max(0, stickyHeadH - (navHidden ? HEADER_HIDE_PX : 0));
  const lastScrollY = useRef(0);
  useEffect(() => {
    setNavHidden(false);
    window.scrollTo(0, 0);
  }, [activeTab]);
  // Party sub-tabs are four phases swapping content on one screen, so arriving
  // at Shopping halfway down the Pizzas list is the same disorientation the
  // effect above exists to prevent. Instant, per the standing rule against
  // smooth scrolling — it moves targets under fingers.
  //
  // The activeTab guard is load-bearing: setPizzaPartyTab('pick') also fires
  // from the two reset paths while the baker is somewhere else entirely, and
  // without it the page jumps under them.
  useEffect(() => {
    if (activeTab !== 'pizzaparty') return;
    window.scrollTo(0, 0);
    setNavHidden(false);
  }, [pizzaPartyTab, activeTab]);
  useEffect(() => {
    if (activeTab !== 'sandwiches') return;
    setNavHidden(false);window.scrollTo(0, 0);
  }, [sandwichParty.tab, activeTab]);
  useEffect(() => {
    let travel = 0;
    let direction = 0;
    const onScroll = () => {
      const curr = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
      const delta = curr - lastScrollY.current;
      lastScrollY.current = curr;
      if (curr < 24 || curr >= document.documentElement.scrollHeight - window.innerHeight - 24) { setNavHidden(false); travel = 0; return; }
      if (document.querySelector('[role="dialog"][aria-modal="true"]') || document.querySelector('.bh-header-stack :focus-visible, #bh-bottom-nav :focus-visible, .bh-companion-steps :focus-visible')) return;
      if (Math.abs(delta) < 2) return;
      const nextDirection = Math.sign(delta);
      travel = nextDirection === direction ? travel + Math.abs(delta) : Math.abs(delta);
      direction = nextDirection;
      if (direction > 0 && curr > 96 && travel >= 32) setNavHidden(true);
      if (direction < 0 && travel >= 12) setNavHidden(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const pizzaPartyEnabled = bakeType === 'pizza';
  const sandwichEnabled = bakeType === 'bread' && !!styleKey && !!sandwichFamilyForStyle(styleKey);
  useEffect(() => { if (activeTab === 'sandwiches' && !sandwichEnabled) setActiveTab('setup'); }, [activeTab, sandwichEnabled]);
  const [pizzasConfirmed, setPizzasConfirmed] = useState(false);

  // M2 — Mode chosen: false on page load, true after baker selects a mode
  const [modeChosen, setModeChosen] = useState(false);

  // Mode cards — per-card "+ details" expander (visual-first redesign)
  const [modeInfoOpen, setModeInfoOpen] = useState(false);

  // Baker profile — Mon profil sheet + new-session prefill
  const bottomNavH = useBottomNavHeight();
  const keyboardOpen = useMobileKeyboard();
  const [profileOpen, setProfileOpen] = useState(false);
  // Sourdough-vs-Simple nudge — shown when a levain profile taps Simple
  const [sdNudgeOpen, setSdNudgeOpen] = useState(false);
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  // Which steps carry a value the profile supplied rather than one the baker
  // chose in this session. They are marked `prefilled`, which means the page
  // still appears with the value already in place — the baker presses Suivant
  // and moves on — and the summary only fills in once they have passed it.
  const [profileFields, setProfileFields] = useState<Set<string>>(new Set());
  const markProfile = (k: string) => setProfileFields(p => p.has(k) ? p : new Set(p).add(k));
  // Bumped when a cloud profile pull settles — lets a late-arriving profile
  // prefill a bake type the baker already tapped (fresh-device login race).
  const [profilePullTick, setProfilePullTick] = useState(0);
  // Latest cloud session offered as « Reprendre » on a device with no
  // localStorage session (fresh device / cleared storage). Freshness must be
  // captured AT MOUNT: the autosave effect recreates bh_session_v1 within
  // milliseconds, so a later loadSession() check always sees a session.
  const [cloudResume, setCloudResume] = useState<BakeEvent | null>(null);
  const freshDeviceRef = useRef(false);
  const profileBlockersAppliedRef = useRef(false);

  // Custom mode — fermentation plan recommended
  const [scheduleReady, setScheduleReady] = useState(false);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let uid: string | null = null;
    let dirty = false;
    // 10s debounce lets a baker set every preference in one sitting → one
    // write; the visibility/pagehide flush below guarantees nothing is lost
    // when the app is backgrounded or closed before the timer fires.
    const armPush = () => {
      if (!uid) return;
      dirty = true;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => { if (uid) { dirty = false; void pushProfile(uid); } }, 10000);
    };
    const flush = () => {
      if (!uid || !dirty) return;
      if (syncTimer) clearTimeout(syncTimer);
      dirty = false;
      void pushProfile(uid);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      uid = data.user?.id ?? null;
      if (uid) void pullAndMergeProfile(uid).then(() => setProfilePullTick(t => t + 1));
    });
    setProfileListener(armPush);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const newUid = session?.user?.id ?? null;
      if (newUid && newUid !== uid) void pullAndMergeProfile(newUid).then(() => setProfilePullTick(t => t + 1));
      uid = newUid;
      setProtocolStale(false);
    });
    return () => {
      subscription.unsubscribe(); setProfileListener(null);
      if (syncTimer) clearTimeout(syncTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Late profile prefill — on a fresh device the cloud profile can land
  // AFTER the baker already tapped a bake type (selectBakeType read an empty
  // loadProfile() at tap time). Fill only still-missing fields; never
  // overwrite something the baker has since chosen.
  useEffect(() => {
    if (profilePullTick === 0) return;
    if (!modeChosen || !bakeType || profilePrefilled || sessionRestored) return;
    const prof = loadProfile();
    if (!prof) return;
    let applied = false;
    const ovenPool = bakeType === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES;
    const prefOven = (bakeType === 'bread' ? prof.ovenTypeBread : prof.ovenTypePizza) ?? prof.ovenType;
    if (!ovenType && prefOven && prefOven in ovenPool) {
      setOvenType(prefOven as AnyOvenType); applied = true;
    }
    const stylePool = bakeType === 'bread' ? BREAD_STYLES : PIZZA_STYLES;
    const prefStyle = (bakeType === 'bread' ? prof.styleKeyBread : prof.styleKeyPizza) ?? prof.styleKey;
    const sdAllowed = tab === 'custom';
    if (!styleKey && prefStyle && prefStyle in stylePool
        && (sdAllowed || !['pain_levain', 'sourdough'].includes(prefStyle))) {
      setStyleKey(prefStyle as StyleKey); applied = true;
    }
    if (!mixerType && prof.mixerType && prof.mixerType in MIXER_TYPES) {
      setMixerType(prof.mixerType as MixerType); applied = true; markProfile('equip');
    }
    // Sourdough-native styles override the yeast preference (same rule as
    // the tap-time prefill in selectBakeType).
    const effStyle = styleKey ?? ((prefStyle && prefStyle in stylePool) ? prefStyle : null);
    const lateWantsSourdough = ['pain_levain', 'sourdough'].includes(effStyle as string);
    if (!yeastType && lateWantsSourdough && sdAllowed) {
      // A sourdough-native style IS its leavening — not a stored preference,
      // a consequence of the style just chosen. It counts as answered.
      setYeastType('sourdough'); applied = true;
    } else if (!yeastType && prof.yeastType && prof.yeastType in YEAST_TYPES
        && (sdAllowed || prof.yeastType !== 'sourdough')) {
      setYeastType(prof.yeastType as YeastType); applied = true; markProfile('yeast');
    }
    if (applied) setProfilePrefilled(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePullTick]);

  // Cloud « Reprendre » — a fresh device has no localStorage session, but a
  // signed-in baker may have one in the cloud. Offer the latest generated
  // snapshot; hydrate only on tap (never surprise-restore mid-setup).
  useEffect(() => {
    if (!user) { setCloudResume(null); return; }
    if (!freshDeviceRef.current || sessionRestored || modeChosen) return;
    let wbDismissed = false;
    try { wbDismissed = sessionStorage.getItem('bh_wb_answered') === '1'; } catch {}
    if (wbDismissed) return;
    let cancelled = false;
    void (async () => {
      try {
        const { fetchBakeEvents } = await import('../lib/supabase/fetchBakeEvents');
        const events = await fetchBakeEvents();
        const latest = events.find(e => e.dough_snapshot?.recipeGenerated);
        if (!cancelled && latest) setCloudResume(latest);
      } catch { /* offline — no banner, observation only */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // A saved session is OFFERED on mount, never applied silently.
  //
  // It used to rehydrate everything the moment the app opened. Nothing was
  // wrong with the values — ovenType, mixerType and yeastType all start as
  // null, so nothing is pre-set by code — but restored state that appears
  // without explanation is indistinguishable from the app having chosen for
  // you, and that is exactly how it was read on a device: a signed-out baker
  // finding an oven, a mixer and a ticked yeast they had never picked.
  //
  // So the session is held until the baker says which they want. Dismissing
  // without choosing leaves it unapplied, because a fresh start is the safe
  // default and the session is still on disk if they change their mind.
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      // Nothing local at mount — this is the one reliable "fresh device"
      // moment.
      //
      // The old note here said autosave would "write a default session right
      // after". It does not, and has not: useSessionSave returns early until
      // BOTH bakeType and styleKey are set (or a recipe has been generated),
      // so nothing is persisted until the baker has actually chosen something.
      // Checked rather than trusted — that stale claim is what led to reading
      // an absent chosen-flag as settled in the restore below.
      freshDeviceRef.current = true;
      restoreSettledRef.current = true;   // rien à restaurer : c'est réglé
      setAuthTick(t => t + 1);
      return;
    }
    setPendingSession(session);
    // Revenir d'une connexion n'est pas « revenir plus tard ». Le baker était
    // au milieu de quelque chose il y a dix secondes : on le remet où il
    // était au lieu de lui proposer de reprendre ce qu'il n'a jamais quitté.
    if (readAuthIntent() || sessionStorage.getItem('bh_locale_resume')) {
      applySession(session);
      restoreSettledRef.current = true;
      setAuthTick(t => t + 1);
    }
    else setShowWelcomeBack(true);
  }, []);

  // La restauration ne se termine que quand la soiree pizza est arrivee.
  // Rendre la main avant, c'est laisser l'autosave photographier un etat
  // a moitie restaure et l'ecrire par-dessus la vraie session.
  function endRestore() {
    if (partyHydratingRef.current) return;
    isRestoringRef.current = false;
  }

  function applySession(session: SessionData) {
    isRestoringRef.current = true;

    const restoredEatTimeIsPast = session.eatTime
      ? new Date(session.eatTime) < new Date()
      : false;
    if (restoredEatTimeIsPast && !session.recipeGenerated) {
      // Not a generated session — wipe schedule times, keep all other settings
      session.eatTime = null;
      session.startTime = null;
      session.blocks = [];
    }
    // Generated sessions with past bake times are kept as historical record

    setTab(session.tab as 'simple' | 'custom');
    setBakeType(session.bakeType as BakeType | null);
    setBakeName(session.bakeName ?? '');
    setSandwichParty(normalizeSandwichSnapshot(session.sandwichParty));
    setStyleKey(session.styleKey as StyleKey | null);
    setNumItems(session.numItems);
    const wb = getWeightBounds(session.styleKey as string | null, session.bakeType as string | null);
    setItemWeight(Math.max(wb.min, Math.min(wb.max, session.itemWeight)));
    setPizzaDiameter(session.pizzaDiameter);
    setOvenType(session.ovenType as AnyOvenType | null);
    setOvenConstruction(session.ovenConstruction ?? 'tabletop');
    setMixerType(session.mixerType as MixerType | null);
    setYeastType(session.yeastType as YeastType | null);
    setKitchenTemp(session.kitchenTemp);
    setHumidity(session.humidity);
    setFridgeTemp(session.fridgeTemp); setWaterSource(['room','fridge','tap','measured'].includes(session.waterSource ?? '') ? session.waterSource! : 'room'); setMeasuredWaterTemp(session.measuredWaterTemp); setWaterMethod(session.waterMethod ?? 'premelt'); setSpiralIceConfirmed(session.spiralIceConfirmed ?? false); setMixingBatches(normalizeMixingBatches(session.mixingBatches)); setContainerCapacityLitres(session.containerCapacityLitres);
    if (session.flourBlend) setFlourBlend(session.flourBlend as FlourBlend);
    setPrefermentType(session.prefermentType as PrefermentType);
    // Absent means UNSETTLED, not settled. The `?? true` this replaces was
    // written for sessions saved before these flags existed. A session is only
    // ever written once a bake type and style are chosen, so it is a real
    // session — but it carries the untouched code defaults for Quantity,
    // Flour and Preferment alongside them, and the backfill turned those into
    // "the baker chose this" on the next launch. A signed-out baker restarted the app and found Quantity,
    // Flour and Preferment already in the rail reading 4/10 SET, none of which
    // they had ever touched. That is exactly the fabricated history the flags
    // exist to prevent.
    //
    // A preset comes from the profile of a signed-in baker, or from the baker's
    // own tap. Never from storage. Sessions written since the flags landed
    // carry the real value; older ones correct themselves on first touch.
    setQtyChosen(session.qtyChosen ?? false);
    setFlourChosen(session.flourChosen ?? false);
    setPrefermentChosen(session.prefermentChosen ?? false);
    setPrefermentFlourPct(session.prefermentFlourPct);
    setPrefOffsetH(session.prefOffsetH);
    setManualHydration(session.manualHydration);
    setManualOil(session.manualOil);
    setManualSugar(session.manualSugar);
    setManualSalt(session.manualSalt);
    setTargetDoughTemp(session.targetDoughTemp);
    setFlourInFridge(session.flourInFridge);
    setMeasuredFlourTemp(session.measuredFlourTemp); setMeasuredPrefermentTemp(session.measuredPrefermentTemp);
    setAddSeeds(session.addSeeds ?? false);
    setWastePct(session.wastePct);
    setPriorityOverride(session.priorityOverride);
    if (session.eatTime) setEatTime(new Date(session.eatTime));
    if (session.startTime) setStartTime(new Date(session.startTime));
    if (session.blocks && session.blocks.length > 0) {
      setBlocks(session.blocks.map((b: unknown) => {
        const block = b as { label: string; from: number; to: number };
        return { label: block.label, from: new Date(block.from), to: new Date(block.to) };
      }));
    }
    setStarterEvents(restoreStarterEvents(session.starterEvents));
    setRecipeGenerated(session.recipeGenerated);
    setModeChosen(session.modeChosen);

    // Prefer what was stored; fall back to the end for older snapshots that
    // predate the field, because a generated recipe is itself proof that every
    // input had a value — you cannot reach one otherwise.
    const restoredHighest = typeof session.highestStep === 'number'
      ? session.highestStep : (session.recipeGenerated ? 99 : 1);
    const restoredAdvHighest = typeof session.advancedHighestStep === 'number'
      ? session.advancedHighestStep : (session.recipeGenerated ? 99 : 1);
    setHighestStep(restoredHighest);
    setAdvancedHighestStep(restoredAdvHighest);

    if (session.pizzaPartyTab && ['pick', 'shop', 'prep', 'bake'].includes(session.pizzaPartyTab))
      setPizzaPartyTab(session.pizzaPartyTab as 'pick' | 'shop' | 'prep' | 'bake');
    if (session.recipeGenerated) {
      setActiveTab(session.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty' | 'sandwiches');
      if (session.tab === 'custom') {
        setAdvancedStep(99);
      } else {
        setActiveStep(99);
      }
      setShowResults(true);
      setProtocolStale(false);
    } else {
      const companionTab = session.bakeType === 'pizza' ? 'pizzaparty' : 'sandwiches';
      setActiveTab(session.activeTab === companionTab && (session.bakeType === 'pizza' || !!session.styleKey && !!sandwichFamilyForStyle(session.styleKey)) ? companionTab : 'setup');
      if (session.tab === 'custom') {
        setAdvancedStep(session.styleKey ? (session.ovenType ? 3 : 2) : 1);
      } else {
        setActiveStep(session.styleKey ? (session.ovenType ? 3 : 2) : 1);
      }
    }

    if (session.pizzaParty?.shopTicks) {
      try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(session.pizzaParty.shopTicks)); } catch {}
    }
    if (session.pizzaParty?.prepTicks) {
      try { localStorage.setItem('bh_prep_ticks_v1', JSON.stringify(session.pizzaParty.prepTicks)); } catch {}
    }
    if (session.pizzaParty?.qtys) {
      partyHydratingRef.current = true;
      const rawQtys = session.pizzaParty.qtys;
      // Lazy — keeps the 150-pizza database out of the first-load bundle
      void import('../lib/toppingDatabase').then(({ getPizzaById }) => {
        const validQtys: Record<string, number> = {};
        Object.entries(rawQtys).forEach(([id, qty]) => {
          if (getPizzaById(id)) validQtys[id] = qty as number;
        });
        setPizzaPartyQtys(validQtys);
        setPartyRestoreToken(v => v + 1);
        partyHydratingRef.current = false;
        endRestore();
      }).catch(() => { partyHydratingRef.current = false; endRestore(); });
    }
    if (session.bakedDone) setBakedDone(true);
    if (session.starterState) setStarterState(session.starterState as 'rt_fed' | 'fridge_unfed' | 'fridge_fed');
    if (session.starterLocation) setStarterLocation(session.starterLocation as 'rt' | 'fridge');
    if (session.planningMode) setPlanningMode(session.planningMode as 'last_fed' | 'know_peak');
    if (session.lastFedTime) setLastFedTime(new Date(session.lastFedTime));
    if (session.knownPeakTime) setKnownPeakTime(new Date(session.knownPeakTime));
    if (session.hasNotFedYet !== undefined) setHasNotFedYet(session.hasNotFedYet ?? null);
    if (session.lastFedAge !== undefined) setLastFedAge((session.lastFedAge as 'today'|'yesterday'|'days23'|'days45'|'week'|null) ?? null);
    // Stage 1: support both new and legacy key names
    const _lfr = session.lastFeedRatio ?? session.feedRatio;
    if (_lfr) setLastFeedRatio(_lfr as 1 | 2 | 4 | 5 | 10);
    const _nfr = session.nextFeedRatio ?? session.lastFeedRatio ?? session.feedRatio;
    if (_nfr) setNextFeedRatio(_nfr as 1 | 2 | 4 | 5 | 10);
    if (session.nextFeedRatioOverride !== undefined) {
      setNextFeedRatioOverride(session.nextFeedRatioOverride as 1 | 2 | 4 | 5 | 10 | null);
    }
    if (session.ratioMode === 'keep' || session.ratioMode === 'recommend') {
      setRatioMode(session.ratioMode);
    }
    if (session.starterMature !== undefined) setStarterMature(Boolean(session.starterMature));
    if (session.starterHasRye !== undefined) setStarterHasRye(Boolean(session.starterHasRye));
    if (session.tang) setTang(session.tang as 'mild' | 'balanced' | 'tangy');
    if (session.fridgeOutTime) setFridgeOutTime(new Date(session.fridgeOutTime));
    if (session.usingPeak2 !== undefined) setUsingPeak2(Boolean(session.usingPeak2));
    if (session.feed2Time) setFeed2Time(new Date(session.feed2Time));
    if (session.starterFridgeInTime) setStarterFridgeInTime(new Date(session.starterFridgeInTime));
    setProtocolStale(false);
    setSessionRestored(true);
    setReviewMode(true);
    setActiveStep(session.activeStep ?? 99);
    setAdvancedStep(session.advancedStep ?? 99);
    setSetupOverview(session.setupOverview ?? false);
    if (session.activeTab === 'pizzaparty') {
      setActiveTab('pizzaparty');
      if (session.pizzaPartyTab) setPizzaPartyTab(session.pizzaPartyTab as 'pick'|'shop'|'prep'|'bake');
    }
    try {
      const resume = JSON.parse(sessionStorage.getItem('bh_locale_resume') || 'null');
      if (resume) {
        setActiveStep(resume.activeStep);
        setAdvancedStep(resume.advancedStep);
        setSetupOverview(!!resume.setupOverview);
        if (resume.activeTab) setActiveTab(resume.activeTab);
        if (resume.pizzaPartyTab) setPizzaPartyTab(resume.pizzaPartyTab);
        setReviewMode(!!resume.reviewMode);
        sessionStorage.removeItem('bh_locale_resume');
      }
    } catch {}
    // Toast respawned on every reload/locale switch until acted on —
    // once dismissed/answered in this browser session, stay quiet.
    setShowWelcomeBack(false);
    setPendingSession(null);
    setTimeout(endRestore, 200);
  }

  // Any user answer to the welcome-back toast (resume, start fresh, dismiss)
  // silences it for the rest of the browser session.
  function answerWelcomeBack() {
    try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
    setShowWelcomeBack(false);
    // Dropping the offer without taking it leaves the session unapplied. A
    // fresh start is the safe default, and the session is still on disk if the
    // baker changes their mind on the next launch.
    setPendingSession(null);
  }

  // Scroll to results when they appear
  useEffect(() => {
    if (showResults) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [showResults]);

  // Set protocolStale when config changes after recipe generated.
  // Skip the first mount invocation — initial state is not a user change.
  const configMountedRef = useRef(false);
  const justGeneratedRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!configMountedRef.current) { configMountedRef.current = true; return; }
    if (justGeneratedRef.current) { justGeneratedRef.current = false; return; }
    if (isRestoringRef.current) return;
    if (recipeGenerated) {
      setProtocolStale(true);
    }
  }, [bakeType, styleKey, numItems, itemWeight, ovenType, mixerType, yeastType, kitchenTemp, humidity, fridgeTemp, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct]);

  // Pain au levain: sourdough is the only sensible yeast — auto-confirm after
  // a beat instead of demanding a tap; the step summary's Edit is the undo.
  useEffect(() => {
    if (reviewMode || isRestoringRef.current) return;
    if (styleKey === 'pain_levain' && yeastType === 'sourdough' && advancedStep === 7 && prefermentType !== 'levain') {
      // Sourdough forces levain and hides the preferment step; advanceAdv now
      // skips it, so Suivant reaches the plan by itself. The page no longer
      // flips on its own — only the state it depends on is set.
      const tmr = setTimeout(() => setPrefermentType('levain'), 400);
      return () => clearTimeout(tmr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey, yeastType, advancedStep, prefermentType, reviewMode]);

  // Perceived-speed: once a pizza session is underway, warm the party chunk
  // (and its 150-pizza database) during browser idle time — downloaded in the
  // background, instant when the baker opens Ma Pizza Party. Not on boot
  // (too early), not on tab tap (too late).
  useEffect(() => {
    if (bakeType !== 'pizza' || !modeChosen) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const warm = () => { void import('../components/PizzaParty'); };
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(warm);
    else timer = setTimeout(warm, 1500);
    return () => { if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId); if (timer) clearTimeout(timer); };
  }, [bakeType, modeChosen]);

  // Baker profile — standard blockers (sleep / work) applied once per fresh
  // session as soon as a bake time exists. Restored sessions keep their own.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isRestoringRef.current || sessionRestored) return;
    if (!eatTime || profileBlockersAppliedRef.current) return;
    if (blocks.length > 0) { profileBlockersAppliedRef.current = true; return; }
    const bl = loadProfile()?.blockers;
    if (!bl || (!bl.sleep.enabled && !bl.work.enabled)) return;
    profileBlockersAppliedRef.current = true;
    const parse = (s: string) => { const [h, m] = s.split(':').map(Number); return { h: h || 0, m: m || 0 }; };
    const out: AvailabilityBlock[] = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const horizon = new Date(eatTime.getTime() + 24 * 3600 * 1000);
    for (let d = new Date(start); d < horizon; d.setDate(d.getDate() + 1)) {
      (['sleep', 'work'] as const).forEach(key => {
        const b = bl[key];
        if (!b.enabled) return;
        if (key === 'work') { const dow = d.getDay(); if (dow === 0 || dow === 6) return; }
        const f = parse(b.from), tt = parse(b.to);
        const from = new Date(d); from.setHours(f.h, f.m, 0, 0);
        const to = new Date(d); to.setHours(tt.h, tt.m, 0, 0);
        if (to <= from) to.setDate(to.getDate() + 1); // overnight window (sleep)
        if (to < new Date() || from > eatTime) return;
        out.push({
          // Preset-compatible labels — SchedulePicker identifies preset blocks
          // by convention (`Work · <date>` prefix / `<Weekday> night` suffix).
          // Matching them lights the Weekdays/Nights pills and keeps these
          // blocks out of the custom-chip list (was: one chip row per day).
          label: key === 'sleep'
            ? `${from.toLocaleDateString('en-US', { weekday: 'long' })} night`
            : `Work · ${from.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
          from, to,
        });
      });
    }
    if (out.length) setBlocks(out);
  }, [eatTime]);

  // Nav #1 — after an upstream edit (single-tap choices) with a plan already
  // built, re-open + scroll to the baking-plan step so the chart never
  // "disappears" behind a collapsed summary. Normal accordion flow only —
  // in reviewMode every card is already expanded (sticky stale pill covers it).
  const planReturnMountedRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!planReturnMountedRef.current) { planReturnMountedRef.current = true; return; }
    if (isRestoringRef.current || reviewMode || !eatTime || activeTab !== 'setup') return;
    const isCustom = tab === 'custom';
    const planStep = isCustom ? 9 : 7;
    const highest = isCustom ? advancedHighestStep : highestStep;
    const active = isCustom ? advancedStep : activeStep;
    if (highest < planStep || active >= planStep) return;
    // Accordion-era behaviour: reopen the plan card below so its chart never
    // sits stale. With one page per step that same jump would throw the baker
    // off the page they are editing, 650ms after they touched a control — so
    // the simple flow keeps its page and lets the chips show the change.
    if (!isCustom) return;
    const tmr = setTimeout(() => {
      setAdvancedStep(9); setAdvancedHighestStep(p => Math.max(p, 9)); scrollToStepTop();
    }, 650);
    return () => clearTimeout(tmr);
  }, [styleKey, ovenType, mixerType, yeastType, prefermentType]);

  useEffect(() => {
    setScheduleReady(false);
  }, [bakeType, styleKey]);

  // Auto-select sourdough for pain au levain when no yeast type is set yet.
  // Do NOT advance advancedHighestStep here — baker must still navigate
  // through climate, oven, mixer, flour steps. The Max(s, 9) call fires
  // correctly in the YeastHelper onSelect handler after all steps are done.
  useEffect(() => {
    if (tab === 'custom' && styleKey === 'pain_levain' && !yeastType) {
      setYeastType('sourdough');
      setPrefermentType('levain');
    }
  }, [styleKey, tab]);

  useEffect(() => {
    // Only correct the untouched DEFAULT flour when the baker switches bake
    // type — never overwrite a deliberate selection. Every real pick (quick
    // type, database product, scan, custom W) sets brandProduct, so its
    // presence is a reliable "user has chosen" signal. Without this guard,
    // any remount that restores a bread session where the user had picked
    // T80 (whose internal base key is 'pizza00', same as the pizza default)
    // looked identical to the untouched default and got reset to T65.
    if (flourBlend.brandProduct) return;
    if (bakeType === 'bread' && flourBlend.flour1 === 'pizza00') {
      setFlourBlend({ flour1: 'bread', flour2: null, ratio1: 100 });
    }
    if (bakeType === 'pizza' && flourBlend.flour1 === 'bread') {
      setFlourBlend({ flour1: 'pizza00', flour2: null, ratio1: 100 });
    }
  }, [bakeType]);

  useEffect(() => {
    if (!breadProtocol) { if (bakeType === 'bread' && styleKey && ovenType === 'griddle') setOvenType(null); return; }
    if (ovenType && !breadProtocol.equipment.includes(ovenType)) setOvenType(null);
    if (mixerType && !breadProtocol.supportedMixers.includes(mixerType)) setMixerType(null);
    if (isUnleavened) {
      if (yeastType !== 'instant') setYeastType('instant');
      if (prefermentType !== 'none') setPrefermentType('none');
      setPrefermentChosen(true);
      if (activeStep === 6) setActiveStep(7);
      if (advancedStep === 7 || advancedStep === 8) setAdvancedStep(9);
    }
  }, [styleKey, ovenType, mixerType, isUnleavened, yeastType, prefermentType, activeStep, advancedStep]);

  const weightBounds = getWeightBounds(styleKey, bakeType);

  // ── Computed ──────────────────────────────
  const ovenData = ovenType
    ? bakeType === 'bread'
      ? BREAD_OVEN_TYPES[ovenType as BreadOvenType]
      : OVEN_TYPES[ovenType as OvenType]
    : undefined;
  const preheatMin = ovenData?.preheatMin ?? 30;

  const hasNightBlocker = blocks.some(b =>
    b.label.toLowerCase().includes('night') || b.from.getHours() >= 22 || b.to.getHours() <= 7
  );

  const schedule = useMemo(() => {
    if (!eatTime || startTime >= eatTime) return null;
    if (!mixerType) return null;
    // No style, no schedule. This used to fall back to Neapolitan, which built
    // a 26-hour curve underneath a recommender that had fallen back to no cold
    // retard at all — two different doughs on one screen, neither of them the
    // baker's. The recipe already refused without a style; now everything does.
    if (!styleKey) return null;
    return buildSchedule(startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType, styleKey, numItems);
  }, [startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType, styleKey, numItems]);

  // Preferment start time for Timeline step 0 (poolish/biga only)
  const prefStartTime = useMemo(() => {
    if (!prefermentType || prefermentType === 'none' || prefermentType === 'levain') return null;
    if (prefOffsetH <= 0) return null;
    return new Date(startTime.getTime() - prefOffsetH * 3600000);
  }, [startTime, prefOffsetH, prefermentType]);

  // prefGoesInFridge is the algo's decision reported via onPrefGoesInFridgeChange.
  // This planner uses refrigerated biga; poolish supports either storage method.
  // Poolish: algo decides fridge or RT based on dual search result.
  // This single value flows to Timeline, RecipeOutput, and buildComputedRecipe.
  const prefGoesInFridge = !prefermentType || prefermentType === 'none' || prefermentType === 'levain'
    ? false
    : prefermentType === 'biga'
      ? true
      : prefGoesInFridgeState;

  // Explicitly accepted proposals must survive the scheduler's bake-key remount.
  // Any changed recipe input, timestamp or availability invalidates this marker.
  const repairContext = JSON.stringify([kitchenTemp, fridgeTemp, preheatMin, mixerType, styleKey,
    yeastType, prefermentType, prefOffsetH, prefGoesInFridge, tang, starterPlanResetKey]);
  const repairKey = (st: Date, et: Date | null, bl: AvailabilityBlock[]) =>
    JSON.stringify([repairContext, +st, et ? +et : null, bl.map(b => [+b.from, +b.to, b.label])]);
  const confirmedSchedulePlan = acceptedScheduleRepair === repairKey(startTime, eatTime, blocks);
  const handleScheduleChange = (st: Date, et: Date, bl: AvailabilityBlock[], options?: {preservePlan: boolean}) => {
    setAcceptedScheduleRepair(options?.preservePlan ? repairKey(st, et, bl) : null);
    if (sessionRestored && +et !== (eatTime ? +eatTime : null)) setSessionRestored(false);
    setStartTime(st); setEatTime(et); setBlocks(bl);
  };

  const prefRemoveFromFridgeTime = useMemo(() => {
    if (!prefGoesInFridge || !eatTime) return null;
    // Same single source of truth the scheduler uses. Returns 0 for biga and for
    // any fridge poolish whose target dough temperature is reachable on water
    // alone — in that case removal lands exactly at mix time and the Timeline
    // drops the step entirely (the preferment goes into the mix cold).
    const rtWarmupH = requiredPrefWarmupH({
      prefermentType: prefermentType ?? 'none',
      prefInFridge: prefGoesInFridge,
      styleKey: styleKey ?? '',
      kitchenTemp, fridgeTemp,
      mixerType: (mixerType ?? 'hand') as MixerType,
      targetDoughTemp,
    });
    return new Date(startTime.getTime() - rtWarmupH * 3600000);
  }, [prefGoesInFridge, prefermentType, styleKey, kitchenTemp, fridgeTemp, mixerType, targetDoughTemp, eatTime, startTime]);

  const feedToMixH = useMemo(() => {
    if (yeastType !== 'sourdough' || !startTime) return undefined;
    return starterFeedToMixHours(starterEvents, startTime, feedTime ?? lastFedTime);
  }, [yeastType, feedTime, lastFedTime, startTime, starterEvents]);

  const recipe = useMemo(() => {
    if (!styleKey || !schedule || !ovenType || !yeastType) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'simple',
        mixerType as MixerType,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, flourInFridge, undefined, undefined,
        feedToMixH, undefined, measuredFlourTemp, measuredPrefermentTemp,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, humidity, schedule, fridgeTemp, yeastType, mixerType, flourInFridge, measuredFlourTemp, measuredPrefermentTemp, feedToMixH]);

  // Recipe with yeast adjusted by appliedMultiplier (large-batch tuning)
  const displayRecipe = recipe;

  const effPref: PrefermentType = (prefermentType ?? 'none') as PrefermentType;

  // Advanced recipe — includes manual hydration/oil/sugar overrides
  const advancedRecipe = useMemo(() => {
    if (!styleKey || !schedule || !ovenType || !yeastType) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom',
        mixerType as MixerType,
        manualHydration, manualOil, manualSugar, flourBlend, prefermentType, priorityOverride,
        prefermentFlourPct ?? (
          prefermentType === 'levain'
            // Levain/sourdough has its own sane range (15-30%, data.ts) —
            // the poolish/biga timing-based schedule below doesn't apply to
            // it and was pushing short-window plans up to 45% starter.
            ? undefined
            : 20
        ),
        manualSalt,
        targetDoughTemp,
        flourInFridge,
        wastePct,
        prefGoesInFridge,
        feedToMixH,
        prefermentType !== 'none' && prefermentType !== 'levain' && prefOffsetH > 0 ? prefOffsetH : undefined,
        measuredFlourTemp, measuredPrefermentTemp,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, manualSalt, targetDoughTemp, flourInFridge, measuredFlourTemp, measuredPrefermentTemp, wastePct, addSeeds, prefGoesInFridge, feedToMixH]);

  const advancedDisplayRecipe = advancedRecipe;

  // Dough ingredients for the Pizza Party shopping list — the host shops once.
  const doughShoppingItems = useMemo(() => {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return undefined;
    const items: Array<{ name: string; amount: string }> = [
      { name: locale === 'fr' ? 'Farine' : 'Flour', amount: `${Math.round(cr.flour)}g` },
      { name: locale === 'fr' ? 'Sel' : 'Salt', amount: `${Math.round(cr.salt)}g` },
    ];
    const yg = cr.preferment != null ? cr.preferment.prefYeastGrams : cr.yeast?.convertedGrams;
    if (yeastType === 'sourdough') {
      items.push({ name: locale === 'fr' ? 'Levain actif' : 'Active starter', amount: '—' });
    } else if (yg && yg > 0) {
      items.push({ name: locale === 'fr' ? 'Levure' : 'Yeast', amount: `${parseFloat(Number(yg).toFixed(1))}g` });
    }
    if ((cr.oil ?? 0) > 0) items.push({ name: locale === 'fr' ? 'Huile d’olive' : 'Olive oil', amount: `${Math.round(cr.oil ?? 0)}g` });
    return items;
  }, [tab, advancedRecipe, recipe, yeastType, locale]);

  const sandwichDoughIngredients = useMemo(() => {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return undefined;
    const fr = locale === 'fr';
    const rows = [
      ...(cr.flourParts?.length ? cr.flourParts.map(part=>({id:`flour_${part.key}`,name:fr?part.nameFr:part.name,grams:part.grams})) : [{id:'flour', name:fr?'Farine':'Flour', grams:cr.flour}]),
      {id:'water', name:fr?'Eau':'Water', grams:cr.water},
      {id:'salt', name:fr?'Sel':'Salt', grams:cr.salt},
      {id:'olive_oil', name:fr?'Huile':'Oil', grams:cr.oil},
      {id:'sugar', name:fr?'Sucre':'Sugar', grams:cr.sugar},
      {id:'yeast', name:fr?'Levure':'Yeast', grams:cr.preferment?.prefYeastGrams ?? cr.yeast?.convertedGrams ?? 0},
      ...(['milk','eggs','butter'] as const).map(id=>({id,name:({milk:fr?'Lait':'Milk',eggs:fr?'Œufs sans coquille':'Eggs without shells',butter:fr?'Beurre':'Butter'})[id],grams:cr.enrichment?.[id] ?? 0})),
    ];
    return rows.filter(row=>Number.isFinite(row.grams)&&row.grams>0);
  }, [tab, advancedRecipe, recipe, locale]);

  // Builds the computedRecipe payload from the live recipe object — single source of truth
  function buildComputedRecipe(): SessionData['computedRecipe'] {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return null;

    // Serialize timeline steps at generation time — single source of truth.
    // SessionViewer reads these directly; no reconstruction needed.
    const timelineSteps: Array<{ id: string; time: number; label: string }> = [];
    if (schedule && startTime && eatTime) {
      try {
        const steps = buildItems(
          schedule,
          blocks,
          startTime,
          eatTime,
          preheatMin,
          (mixerType ?? 'hand') as import('@/app/data').MixerType,
          numItems,
          feedTime ?? null,
          kitchenTemp,
          yeastType === 'sourdough',
          prefStartTime ?? null,
          prefermentType ?? 'none',
          prefGoesInFridge,
          prefRemoveFromFridgeTime ?? null,
          cr.hydration ?? undefined,
          cr.oil ?? undefined,
          // CRITICAL: without the translator, buildItems falls back to (k) => k
          // and raw i18n keys (timeline.steps.mixing…) get serialized into the
          // session — they then appear verbatim on the share card + caption.
          (key, params) => t(key, params),
          bakeType ?? undefined,
          styleKey ?? undefined,
        );
        for (const step of steps) {
          if (step.kind === 'step') {
            timelineSteps.push({
              id: step.id,
              time: step.time.getTime(),
              label: step.label,
            });
          }
        }
      } catch { /* leave timelineSteps empty */ }
    }

    return {
      flour: cr.flour,
      flourParts: cr.flourParts,
      water: cr.water,
      salt: cr.salt,
      oil: cr.oil ?? 0,
      sugar: cr.sugar ?? 0,
      hydration: cr.hydration ?? Math.round((cr.water / cr.flour) * 100),
      yeastGrams: cr.preferment != null
        ? cr.preferment.prefYeastGrams
        : (cr.yeast?.convertedGrams ?? null),
      coldH: schedule?.totalColdHours ?? 0,
      rtH: schedule?.totalRTHours ?? 0,
      enrichment: cr.enrichment,
      hasPreferment: !!(cr.preferment?.prefYeastGrams),
      totalIngredients: {
        yeast: cr.preferment != null
          ? cr.preferment.prefYeastGrams
          : (cr.yeast?.convertedGrams ?? undefined),
      },
      timelineSteps,
    };
  }

  // Single source of truth for the session snapshot.
  // Used by autosave, the Save button AND handleGenerate — keeping these
  // three in sync is what preserves startTime / schedule / sourdough state
  // when the baker resumes a session (localStorage or DB).
  function buildSessionPayload(overrides?: Partial<Omit<SessionData, 'version' | 'savedAt'>>): Omit<SessionData, 'version' | 'savedAt'> {
    return {
      tab, bakeType, bakeName, styleKey, numItems, itemWeight, pizzaDiameter,
      ovenType, ovenConstruction, mixerType, yeastType,
      kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, containerCapacityLitres, humidity, fridgeTemp,
      flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
      qtyChosen, flourChosen, prefermentChosen,
      manualHydration, manualOil, manualSugar, manualSalt,
      targetDoughTemp, flourInFridge, measuredFlourTemp, measuredPrefermentTemp, wastePct, addSeeds, priorityOverride,
      prefGoesInFridge,
      startTime: startTime?.getTime() ?? null,
      eatTime: eatTime?.getTime() ?? null,
      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
      recipeGenerated, activeTab, pizzaPartyTab, modeChosen,
      // How far the baker got. Without it a resumed session reopened at
      // highestStep 1, so every step carrying a default read as unset —
      // "Quantity not confirmed" beside a finished recipe.
      highestStep, advancedHighestStep, activeStep, advancedStep, setupOverview,
      pizzaParty: buildPizzaPartySnapshot(),
      sandwichParty: bakeType === 'bread' ? sandwichParty : null,
      bakedDone,
      computedRecipe: buildComputedRecipe(),
      starterEvents: serializeStarterEvents(starterEvents),
      starterState, starterLocation, planningMode,
      lastFedTime: lastFedTime?.getTime() ?? null,
      knownPeakTime: knownPeakTime?.getTime() ?? null,
      hasNotFedYet: hasNotFedYet ?? undefined,
      lastFedAge: lastFedAge ?? null,
      lastFeedRatio,
      nextFeedRatio,
      nextFeedRatioOverride,
      ratioMode,
      starterMature, starterHasRye, tang,
      fridgeOutTime: fridgeOutTime?.getTime() ?? null,
      usingPeak2,
      feed2Time: feed2Time?.getTime() ?? null,
      starterFridgeInTime: starterFridgeInTime?.getTime() ?? null,
      ...overrides,
    };
  }

  // Auto-save session to localStorage — placed after computed values to avoid TDZ.
  // isRestoringRef passed as a guard: a save armed while hydration is still in
  // flight must never persist a payload mixing defaults with restored state
  // (observed symptom: tab flipped back to 'simple' on a generated custom session).
  useSessionSave(
    buildSessionPayload(),
    () => {},
    1200,
    isRestoringRef,
  );

  const bakeTimeIsPast = useMemo(() => {
    if (!eatTime) return false;
    return new Date(eatTime) < new Date();
  }, [eatTime]);

  const startTimeInPast = !!(
    sessionRestored &&
    recipeGenerated &&
    startTime &&
    startTime < new Date()
  );

  // ── Handlers ──────────────────────────────
  function selectBakeType(bt: BakeType) {
    setSandwichParty(createSandwichSnapshot());
    // Switching to bread retires any Pizza Party selections + their persisted
    // ticks so a bread bake never carries stale pizza toppings (spec: hide +
    // uncheck Pizza Night silently). Switching to pizza keeps nothing stale
    // because bread has no pizza-party state.
    if (bt === 'bread') {
      setPizzaPartyQtys({});
      setPizzaPartyTab('pick');
      try {
        localStorage.removeItem('bh_shop_ticks_v1');
        localStorage.removeItem('bh_prep_ticks_v1');
      } catch {}
    }
    setBakeType(bt);
    setStyleKey(null);
    setOvenType(null); setOvenConstruction('tabletop');
    setActiveStep(1);
    setHighestStep(1);
    // Custom flow counters must reset too — otherwise a stale high step
    // leaves later steps (Oven, Mixer…) marked completed while their
    // values were just cleared, making them look "skipped".
    setAdvancedStep(1);
    setAdvancedHighestStep(1);
    // Deliberately NOT setModeChosen(true): picking a bake type used to drop
    // the baker straight into setup, because the mode was a permanent bar at
    // the top they could flip at any time. It is a page now, so choosing Pizza
    // has to lead to it rather than past it.

    // ── Baker profile prefill — bakeType-compatible defaults, always overridable ──
    const prof = loadProfile();
    if (prof) {
      let applied = false;
      const ovenPool = bt === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES;
      const prefOven = (bt === 'bread' ? prof.ovenTypeBread : prof.ovenTypePizza) ?? prof.ovenType;
      if (prefOven && prefOven in ovenPool) {
        setOvenType(prefOven as AnyOvenType); applied = true;
      }
      // Style is deliberately NOT prefilled. Oven, mixer and yeast describe the
      // baker's kitchen and are stable between bakes; the style is the one
      // creative decision of THIS bake. Prefilling it meant a returning baker
      // was handed a Neapolitan they never picked — and once Suivant started
      // skipping answered steps, they never even saw the page to change it.
      if (prof.mixerType && prof.mixerType in MIXER_TYPES) {
        setMixerType(prof.mixerType as MixerType); applied = true; markProfile('equip'); markProfile('equip');
      }
      // The style-yields-to-sourdough rule went with the style prefill: with no
      // style applied there is nothing for the yeast preference to yield to.
      // The baker picks a sourdough-native style themselves, and selectStyle
      // already forces levain when they do.
      if (prof.yeastType && prof.yeastType in YEAST_TYPES) {
        setYeastType(prof.yeastType as YeastType); applied = true; markProfile('yeast');
      }
      // Preferment — Custom-mode preference only (Simple has no preferment
      // step to change it in), and never on the sourdough path (levain).
      // Pizza only — biga/poolish preferences are pizza-centric; bread has its
      // own preferment conventions and shouldn't inherit the pizza pick.
      if (bt !== 'bread' && prof.prefermentType && prof.preferredMode === 'custom'
          && prof.yeastType !== 'sourdough'
          && ['none', 'poolish', 'biga'].includes(prof.prefermentType)) {
        // The profile IS an answer — the baker set it, just not in this
        // session. That is the whole point of the rule: profile or baker,
        // never a code default.
        setPrefermentType(prof.prefermentType as PrefermentType); applied = true;
        markProfile('preferment'); setPrefermentChosen(true);
      }
      if (prof.fridgeTemp !== undefined) { setFridgeTemp(prof.fridgeTemp); applied = true; }
      if (prof.preferredMode) { setTab(prof.preferredMode); applied = true; }
      if (prof.starter) {
        setStarterMature(prof.starter.mature);
        setStarterHasRye(prof.starter.hasRye);
        setTang(prof.starter.tang);
      }
      if (applied) setProfilePrefilled(true);
      // The flow always opens on Style now. It is the one page a returning
      // baker still has to answer, and Suivant skips whatever the profile
      // already covered from there.
    }
  }

  // First step whose value is genuinely missing — used when switching
  // Simple ↔ Custom so the baker lands exactly where input is needed,
  // with everything already answered marked complete (no re-clicking).
  // ── Share the CURRENT session — saves (signed-in) then opens the share
  // sheet via Header's openSessionId plumbing. Single source for the party
  // Bake tab, the Recipe-tab PlanNav pill and the Guide-end chip. ──
  // Du travail à l'écran : des pizzas choisies ou cuites comptent autant
  // qu'une recette générée.
  const hasWorkInProgress =
    Object.keys(sandwichParty.qtys).length > 0 ||
    Object.keys(pizzaPartyQtys).length > 0 ||
    Object.keys(bakedPartyQtys).length > 0 ||
    sessionSaved;

  // Une seule construction de l'instantané Pizza Party. Il en existait six,
  // dont cinq perdaient bakedQtys et toutes les six perdaient les cases
  // cochées — alors que SessionData les declare et qu'applySession sait deja
  // les relire. Le type et la lecture les attendaient, rien ne les ecrivait.
  //
  // Les ticks vivent dans localStorage (bh_shop_ticks_v1 / bh_prep_ticks_v1),
  // ecrits par ShoppingList et PrepTab. On les lit ici a l'enregistrement :
  // c'est la meme paire de cles qu'applySession reecrit a la restauration,
  // donc aucune migration Supabase — dough_snapshot est du jsonb.
  function buildPizzaPartySnapshot() {
    if (Object.keys(pizzaPartyQtys).length === 0) return null;
    let shopTicks: Record<string, boolean> | undefined;
    let prepTicks: string[] | undefined;
    try {
      const rawShop = localStorage.getItem('bh_shop_ticks_v1');
      if (rawShop) shopTicks = JSON.parse(rawShop) as Record<string, boolean>;
      const rawPrep = localStorage.getItem('bh_prep_ticks_v1');
      if (rawPrep) prepTicks = JSON.parse(rawPrep) as string[];
    } catch { /* mode prive : la fournee se sauve quand meme */ }
    return {
      qtys: pizzaPartyQtys,
      bakedQtys: Object.keys(bakedPartyQtys).length > 0 ? bakedPartyQtys : undefined,
      shopTicks,
      prepTicks,
    };
  }

  saveCurrentSessionRef.current = () => saveCurrentSession();
  shareCurrentSessionRef.current = () => shareCurrentSession();

  // Le baker avait demandé Sauvegarder ou Partager, on lui a demandé de se
  // connecter : il n'a pas à redemander. Le rejeu vit ici et pas dans
  // onAuthStateChange, qui se déclenche avant que la session locale soit
  // réappliquée — on aurait enregistré une session vide sur le compte.
  const replayedRef = useRef(false);
  useEffect(() => {
    if (!user || replayedRef.current) return;
    const intent = readAuthIntent();
    if (!intent) return;
    if (!restoreSettledRef.current) return;   // restauration en vol
    replayedRef.current = true;
    clearAuthIntent();
    setShowWelcomeBack(false);
    setCloudResume(null);        // rien d'autre ne s'offre à cet instant
    setShowSignInForSave(false);
    void (async () => {
      // Rendu visible : sans ça le baker revient connecté, ne voit rien
      // bouger, et croit devoir réappuyer sur Sauvegarder.
      setCloudSaveState('saving');
      try {
        await saveCurrentSessionRef.current?.();
        setCloudSaveState('idle');
        if (intent === 'share') await shareCurrentSessionRef.current?.();
      } catch (e) {
        console.error('Replay after sign-in failed:', e);
        setCloudSaveState('failed');
      }
    })();
  }, [user, authTick]);

  async function shareCurrentSession() {
    if (!user) {
      stashAuthIntent('share');
      window.dispatchEvent(new Event('bh-open-auth'));
      return;
    }
    // Sharing publishes the current plan, including edits since the last save.
    const { saveNamedSession, updateBakeEvent } = await import('../lib/supabase/saveBakeEvent');
    const snapshot = buildSessionPayload() as SessionData;
    let id = bakeEventId;
    const saved = id ? await updateBakeEvent(id, snapshot) : !!(id = await saveNamedSession(snapshot));
    if (!saved || !id) {
      setSessionSaved(false);
      setCloudSaveState('failed');
      return;
    }
    setBakeEventId(id);
    setSessionSaved(true);
    setCloudSaveState('idle');
    setShareSessionId(id);
  }

  function firstIncompleteStep(isCustom: boolean): number {
    if (!styleKey) return 1;
    // Oven and mixing share the equipment page (3) since A2.
    if (!ovenType || !mixerType) return 3;   // qty (2) + climate (4) have sane defaults
    if (isCustom) {
      if (!flourChosen || archivedFlourNames.length) return 6;
      if (!isUnleavened && !yeastType) return 7;       // flour (6) has a default blend
      return 9;                       // preferment (8) defaults to Direct — scheduler is the goal
    }
    if (!isUnleavened && !yeastType) return 6;
    return 7;                         // scheduler
  }

  // ── Mode choice — shared by the mode cards and the sourdough nudge ──
  // A profile-seeded sourdough (yeast pref, pain au levain or sourdough
  // pizza style) has no Simple path. First tap on Simple asks instead of
  // deciding: continue in Custom (keeps the levain) or stay in Simple
  // (the cleared step re-asks, its greyed option explains why).
  function chooseMode(key: 'simple' | 'custom', force = false) {
    const sdSeeded = yeastType === 'sourdough' || styleKey === 'pain_levain' || styleKey === 'sourdough';
    if (key === 'simple' && sdSeeded && !force) {
      setSdNudgeOpen(true);
      return;
    }
    setSdNudgeOpen(false);
    if (key === 'simple' && tab === 'custom') {
      customOnlyStateRef.current = { flourBlend, hydration: manualHydration, oil: manualOil, sugar: manualSugar, prefermentType, prefermentFlourPct };
      setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    }
    if (key === 'custom' && tab !== 'custom') {
      if (customOnlyStateRef.current) {
        setFlourBlend(customOnlyStateRef.current.flourBlend);
        setManualHydration(customOnlyStateRef.current.hydration);
        setManualOil(customOnlyStateRef.current.oil);
        setManualSugar(customOnlyStateRef.current.sugar);
        setPrefermentType(customOnlyStateRef.current.prefermentType);
        setPrefermentFlourPct(customOnlyStateRef.current.prefermentFlourPct);
      } else if (styleKey) {
        const s = ALL_STYLES[styleKey];
        setManualHydration(s.hydration); setManualOil(s.oil); setManualSugar(s.sugar);
      }
    }
    let clearedStyle = false, clearedYeast = false;
    if (key === 'simple') {
      if (styleKey === 'pain_levain' || styleKey === 'sourdough') { setStyleKey(null); clearedStyle = true; }
      if (yeastType === 'sourdough') { setYeastType(null); clearedYeast = true; }
    }
    setTab(key); setModeChosen(true); setProtocolStale(true); setActiveTab('setup');
    // Land on the first step that actually needs input — completed
    // choices carry over, no re-clicking required.
    const target = clearedStyle ? 1 : clearedYeast ? 6 : firstIncompleteStep(key === 'custom');
    if (key === 'custom') {
      setAdvancedStep(target);
      setAdvancedHighestStep(prev => Math.max(prev, target));
    } else {
      setActiveStep(target);
      setHighestStep(prev => Math.max(prev, target));
    }
    suppressNextScrollRef.current = true;
  }

  function selectStyle(sk: StyleKey) {
    const nextFamily = sandwichFamilyForStyle(sk);
    if (bakeType === 'bread' && sandwichParty.familyId !== nextFamily && Object.values(sandwichParty.qtys).some(q=>q>0)
      && !window.confirm(fr ? 'Changer de pain remplace vos garnitures sélectionnées. Continuer ?' : 'Changing bread replaces your selected fillings. Continue?')) return;
    setStyleKey(sk);
    setSandwichParty(previous => switchSandwichFamily(previous, sandwichFamilyForStyle(sk)));
    if (sk === 'batbout') { setFlourBlend({flour1:'bread',flour2:'semolina',ratio1:67}); setFlourChosen(false); }
    const profile = getBreadProtocol(sk);
    if (isUnleavened && profile?.method !== 'unleavened') { setYeastType(null); setPrefermentChosen(false); }
    if (!profile && ovenType === 'griddle') setOvenType(null);
    if (profile && ovenType && !profile.equipment.includes(ovenType)) setOvenType(null);
    if (profile && mixerType && !profile.supportedMixers.includes(mixerType)) setMixerType(null);
    if (profile && !profile.supportedPreferments.includes(prefermentType)) { setPrefermentType('none'); setPrefermentChosen(false); }
    if (profile && !profile.supportedPreferments.includes('levain') && yeastType === 'sourdough') setYeastType(null);
    if (profile?.method === 'unleavened') { setYeastType('instant'); setPrefermentType('none'); setPrefermentChosen(true); if(eatTime) setStartTime(new Date(+eatTime-45*60000)); }
    setManualHydration(undefined);
    setManualOil(oilDefault(sk));
    setManualSugar(sugarDefault(sk));
    setNumItems(getBreadProtocol(sk)?.portions.count ?? STYLE_BALL_DEFAULTS[sk] ?? (bakeType === 'bread' ? 1 : tab === 'custom' ? 8 : 4));
    if (STYLE_HAS_DIAMETER.includes(sk)) {
      const defaultD = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
      setPizzaDiameter(defaultD);
      setPizzaCorn(1);
      setItemWeight(pizzaWeightFromTable(sk, defaultD, 1));
    } else {
      setItemWeight(ALL_STYLES[sk].ballW);
    }
    // Both flows move on. Simple used to stay put, collapsing the picker to a
    // summary card with a CHANGE link — the reasoning being that a
    // self-flipping page hides the choice just made. The chip rail answers
    // that now: the style is in the bar the moment it is picked, and stays
    // there for the rest of the flow. So the collapsed card was showing the
    // baker a thing they could already see, one tap short of the step they
    // actually wanted.
    // Selection stays visible until the baker chooses Continue.
  }

  // Page mode: every navigation starts the new page at the top. The old
  // accordion scrolled to a step's anchor; there is no anchor to reach now.
  function scrollToStepTop() {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Both advance functions walk the step model rather than raw numbers. That
  // is what makes merging or hiding a step safe: a page that isn't in the list
  // can never be landed on, which is exactly how Suivant used to reach the
  // preferment step on the sourdough path and show a blank screen.
  // Suivant goes to the next step that still needs an answer, not merely the
  // next one in the list. A signed-in baker whose profile already carries oven,
  // mixer, yeast and preferment should not be walked through four pages that
  // only show them what they already told us.
  //
  // "Answered" is the same test the chips and the final CTA use
  // (stepAnswered): a real decision counts, a code default does not until the
  // baker has passed its page. That matters — if Suivant skipped the pages
  // carrying defaults, the last page's CTA would immediately send them back to
  // one, and the two controls would fight each other.
  //
  // Sourdough is the one exception that stays hardcoded: its step carries
  // session-specific starter questions (fed when, where) that no profile can
  // answer, so a stored yeast preference never skips it.
  function nextUnanswered(list: StepDef[], from: number, highest: number): number {
    const i = list.findIndex(s => s.id === from);
    if (i < 0) return list[0].id;
    for (let k = i + 1; k < list.length; k++) {
      if (!stepAnswered(list[k], highest, list)) return list[k].id;
    }
    return list[list.length - 1].id;
  }

  // Visible quantity and preferment defaults can be accepted on Continue.
  // Flour requires an explicit selection through FlourPicker.
  function choosePreferment(pt: PrefermentType) {
    if (pt !== prefermentType) {
      setSessionRestored(false);
      setPrefermentValidity({ type: pt, valid: false });
    }
    setPrefermentChosen(true);
    setPrefermentType(pt);
  }

  function chooseYeast(yt: YeastType) {
    if (yt !== yeastType) {
      setSessionRestored(false);
      setPrefermentValidity({ type: prefermentType, valid: false });
    }
    setYeastType(yt);
  }

  function markStepSettled(id: number) {
    if (id === 2) setQtyChosen(true);
    if (id === 8) setPrefermentChosen(true);
  }

  function advance(from: number) {
    if (from === 1 && !styleKey) return;
    // Same rule as the custom flow — see advanceAdv. Simple has no Flour or
    // Preferment page, so only Quantity can be settled here.
    markStepSettled(from);
    const next = nextUnanswered(SIMPLE_STEPS, from, highestStep);
    setActiveStep(next);
    setHighestStep(p => Math.max(p, next));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  function advanceAdv(from: number) {
    if (from === 1 && !styleKey) return;
    // Flour is settled only by choosing a product or entering a flour type.
    if (from === 6 && (!flourChosen || archivedFlourNames.length)) return;
    markStepSettled(from);
    const next = nextUnanswered(CUSTOM_STEPS, from, advancedHighestStep);
    setAdvancedStep(next);
    setAdvancedHighestStep(p => Math.max(p, next));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  // Start fresh is the only destructive action in the app, so it is the only
  // one that interrupts. An unsaved session gets one question with no silent
  // path out: keep it, drop it, or back out. A saved session just restarts.
  const [confirmNewSession, setConfirmNewSession] = useState(false);

  function requestNewSession() {
    if (bakeType && !(sessionSaved && bakeEventId && user)) { setConfirmNewSession(true); return; }
    startOver();
  }

  async function saveCurrentSession(): Promise<boolean> {
            const sessionPayload = buildSessionPayload();
    const currentQtys = pizzaPartyGetQtysRef.current?.() ?? pizzaPartyQtys;
    const localSaved = saveSession(sessionPayload);
    // Optimistic - local save just succeeded; cloud write continues
    // in the background and reverts the pill on failure.
    setSessionSaved(localSaved);
    if (user) {
      try {
        const { saveNamedSession, savePizzaPartySelections, updateBakeEvent } = await import('../lib/supabase/saveBakeEvent');
        let id = bakeEventId;
        if (!id) {
          id = await saveNamedSession(sessionPayload as SessionData);
          if (id) setBakeEventId(id);
        } else {
          if (!await updateBakeEvent(id, sessionPayload as SessionData)) throw new Error('Session update failed');
        }
        if (id && Object.keys(currentQtys).length > 0 && styleKey) {
          if (!await savePizzaPartySelections(id, currentQtys, styleKey)) throw new Error('Pizza selections update failed');
        }
        if (!id) { setSessionSaved(false); setCloudSaveState('failed'); return false; }
        else {
          setSessionSaved(true); setCloudSaveState('idle');
          const label = sessionLabel();
          setSavedToCloudName(label);
          setTimeout(() => setSavedToCloudName(c => (c === label ? null : c)), 5000);
          return true;
        }
      } catch (e) {
        console.error('Cloud save failed:', e);
        setSessionSaved(false); setCloudSaveState('failed'); return false;
      }
    } else {
      // Le message disait « connectez-vous » sans dire où, et n'ouvrait rien :
      // une impasse. On ouvre le tiroir, et on retient l'intention dans
      // sessionStorage pour qu'elle survive à la redirection Google.
      stashAuthIntent('save');
      window.dispatchEvent(new Event('bh-open-auth'));
      return false;
    }
  }

  // Nomme la fournée. « Session enregistrée » ne disait pas de quoi il
  // s'agissait, d'où le doute : est-ce bien la pizza que je viens de faire ?
  // Même source que bakeEventTitle, pour que le message d'enregistrement et
  // la carte dans « Mes sessions » ne puissent pas se contredire.
  function sessionLabel(): string {
    const style = (ALL_STYLES as Record<string, { name: string }>)[styleKey ?? ''];
    const styleName = style?.name ?? styleKey ?? '';
    const n = numItems ?? 0;
    const noun = bakeType === 'bread'
      ? (locale === 'fr' ? (n === 1 ? 'pain' : 'pains') : (n === 1 ? 'loaf' : 'loaves'))
      : (n === 1 ? 'pizza' : 'pizzas');
    const parts = [styleName, n ? `${n} ${noun}` : ''].filter(Boolean);
    return parts.join(' · ') || (locale === 'fr' ? 'Votre fournée' : 'Your bake');
  }

  function startOver() {
    setSandwichParty(createSandwichSnapshot());
    // Fresh session = fresh chance for profile blockers to apply — without
    // this reset, only the first session per page load ever received them.
    profileBlockersAppliedRef.current = false;
    setEquipmentPanel('oven'); setMixingBatches(undefined); setContainerCapacityLitres(3);
    setBakeType(null); setBakeName(''); setStyleKey(null); setProfileFields(new Set());
    setNumItems(2); setItemWeight(270);
    setOvenType(null); setOvenConstruction('tabletop'); setMixerType(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setEatTime(null);
    setBlocks([]); setYeastType(null);
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(6); setWaterSource('room'); setMeasuredWaterTemp(undefined); setWaterMethod('premelt'); setSpiralIceConfirmed(false);
    setShowResults(false); setActiveStep(1); setHighestStep(1);
    setAdvancedStep(1); setAdvancedHighestStep(1); setFlourBlend({ flour1: bakeType === 'bread' ? 'bread' : 'pizza00', flour2: null, ratio1: 100 }); setPriorityOverride(undefined); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    setManualSalt(undefined); setTargetDoughTemp(undefined); setWastePct(undefined); setFlourInFridge(false); setMeasuredFlourTemp(undefined); setMeasuredPrefermentTemp(undefined); setPrefermentFlourPct(undefined);
    setRecipeGenerated(false); setProtocolStale(false); setActiveTab('setup');
    setReviewMode(false); setSetupOverview(false);
    setModeChosen(false);
    // Restart means restart. Without these the three settled-flags survived the
    // wipe, so Quantity, Flour and Preferment came back reading as the baker's
    // own choices on a flow they had just cleared.
    setQtyChosen(false); setFlourChosen(false); setPrefermentChosen(false);
    setTab('simple'); // full reset — keeping the previous mode made Custom look pre-selected to a fresh user
    setPizzaPartyTab('pick');
    setPizzasConfirmed(false);
    customOnlyStateRef.current = null;
    clearSession();
    // Clear persisted Pizza Party ticks + guide progress — they belong to the old bake
    try {
      localStorage.removeItem('bh_shop_ticks_v1');
      localStorage.removeItem('bh_prep_ticks_v1');
      const legacyProgress = localStorage.getItem('bh_guide_done_v1');
      if (legacyProgress) localStorage.setItem('bh_guide_done_v1_backup', legacyProgress);
      localStorage.removeItem('bh_guide_done_v1');
    } catch {}
    // The welcome-back banner silences itself for the rest of the browser
    // session once answered. On iOS that sessionStorage key survives the app
    // being backgrounded, so a later restored session came back with no prompt
    // at all — a silent rehydration, which is indistinguishable from the app
    // having pre-set everything. Restart clears it too: restart means restart.
    try { sessionStorage.removeItem('bh_wb_answered'); } catch {}
    setSessionSaved(false);
    setSessionRestored(false);
    setReviewMode(false);
    setShowWelcomeBack(false);
    setCloudResume(null);
    setAddSeeds(false);
    setBakeEventId(null);
    setPizzaPartyQtys({});
    setBakePhotoUrl(null);
    setBakedDone(false);
    setStarterEvents([]);
    // Sourdough starter state — full reset
    setLastFedTime(null);
    setKnownPeakTime(null);
    setHasNotFedYet(null);
    setLastFedAge(null);
    setFeed2Time(null);
    setFridgeOutTime(null);
    setStarterFridgeInTime(null);
    setUsingPeak2(false);
    setStarterLocation('rt');
    setPlanningMode('last_fed');
    setStarterMature(true);
    setStarterHasRye(false);
    setTang('balanced');
    setLastFeedRatio(1);
    setNextFeedRatio(1);
    setNextFeedRatioOverride(null);
    setRatioMode('recommend');
    setStarterPeakTime(null);
  }

  function handleGenerate() {
    if (!styleKey) {
      setActiveTab('setup'); setSetupOverview(false);
      if (tab === 'custom') setAdvancedStep(1); else setActiveStep(1);
      scrollToStepTop();
      return;
    }
    if (!commercialPrefermentPlanReady) {
      setActiveTab('setup'); setSetupOverview(false); setAdvancedStep(9); scrollToStepTop();
      return;
    }
    const protocolIssue = (tab === 'custom' ? advancedRecipe : recipe)?.protocolIssue;
    if (protocolIssue) {
      setActiveTab('setup'); setSetupOverview(false);
      const next = protocolIssue === 'equipment' ? 3 : protocolIssue === 'timing' ? (tab === 'custom' ? 9 : 7) : (tab === 'custom' ? 7 : 6);
      if (tab === 'custom') setAdvancedStep(next); else setActiveStep(next);
      scrollToStepTop(); return;
    }
    if (tab === 'custom' && (!flourChosen || archivedFlourNames.length)) {
      setActiveTab('setup'); setSetupOverview(false); setAdvancedStep(6); scrollToStepTop();
      return;
    }
    if (yeastType === 'sourdough' && !recipeGenerated && !starterEvents.length) {
      setActiveTab('setup'); setSetupOverview(false);
      if (tab === 'custom') setAdvancedStep(9); else setActiveStep(7);
      return;
    }
    if (unsupportedEnrichedMethod || (tab === 'custom' && archivedFlourNames.length)) { setActiveTab('setup'); setSetupOverview(true); return; }
    if (recipeGenerated && user) {
      const msg = t('generate.confirmOverwrite');
      if (!window.confirm(msg)) return;
    }
    setSessionSaved(false);
    setSetupOverview(false);
    if (prefermentType !== 'none' && prefermentFlourPct === undefined) {
      const timeDefault = 20;
      setPrefermentFlourPct(timeDefault);
    }
    justGeneratedRef.current = true;
    setReviewMode(false);
    setRecipeGenerated(true);
    setProtocolStale(false);
    setShowResults(true);
    setActiveTab('plan');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    if (user) {
      const sessionPayload = buildSessionPayload({
        bakeType: bakeType ?? '',
        recipeGenerated: true,
        activeTab: 'plan',
      });
      upsertBakeEvent({ session: sessionPayload as SessionData })
        .then(id => { if (id) setBakeEventId(id); });
    }
  }

  function loadRecipe(r: SavedRecipe) {
    setMixingBatches(undefined); setContainerCapacityLitres(3); // Legacy recipes have no saved equipment capacity.
    const isCustom = r.mode === 'custom';

    // Core setup
    setBakeType(r.bake_type as BakeType);
    setStyleKey(r.style_key as StyleKey);
    setSandwichParty(createSandwichSnapshot(sandwichFamilyForStyle(r.style_key)));
    setNumItems(r.num_items);
    setItemWeight(r.item_weight);
    setOvenType(r.oven_type as AnyOvenType);
    setMixerType((r.mixer_type ?? 'hand') as MixerType);
    setYeastType((r.yeast_type ?? 'instant') as YeastType);
    setKitchenTemp(r.kitchen_temp);
    setHumidity(r.humidity ?? 'normal');
    setFridgeTemp(r.fridge_temp ?? 6);
    // A saved recipe is a finished decision on every field it carries.
    setQtyChosen(true);
    setFlourChosen(true);
    setPrefermentChosen(true);

    // Custom mode fields
    if (isCustom) {
      setManualHydration(r.hydration);
      setManualOil(r.manual_oil ?? undefined);
      setManualSugar(r.manual_sugar ?? undefined);
      setManualSalt(r.manual_salt ?? undefined);
      setPrefermentType((r.preferment_type ?? 'none') as PrefermentType);
      setPrefermentFlourPct(r.preferment_flour_pct ?? undefined);
      setTargetDoughTemp(r.target_dough_temp ?? undefined);
      setWastePct(r.waste_pct ?? undefined);
      if (r.flour_blend) {
        try { setFlourBlend(JSON.parse(r.flour_blend)); } catch { /* keep default */ }
      }
    } else {
      // Reset custom fields when loading a simple recipe
      setManualHydration(undefined);
      setManualOil(undefined);
      setManualSugar(undefined);
      setManualSalt(undefined);
      setPrefermentType('none');
      setPrefermentFlourPct(undefined);
    }

    // Set mode and advance to scheduler step
    setTab(isCustom ? 'custom' : 'simple');
    setModeChosen(true);
    setRecipeGenerated(false);
    setShowResults(false);
    setProtocolStale(false);
    setActiveTab('setup');

    // Advance to scheduler step and mark all prior steps as completed.
    // Without highestStep updates, the scheduler page renders as locked
    // → graph doesn't show → user stuck.
    if (isCustom) {
      setAdvancedStep(9);
      setAdvancedHighestStep(prev => Math.max(prev, 9));
    } else {
      setActiveStep(7);
      setHighestStep(prev => Math.max(prev, 7));
    }
    // Enable reviewMode so the baker can freely edit any prior step
    setReviewMode(true);

    // Scroll to scheduler step after state settles
    scrollToStepTop();
  }

  // ── Resume / rebake a saved bake event ──
  // Nav #5 — rebake clones a saved session with every scheduled time shifted
  // to the next matching weekday/time. Sourdough needs a fresh starter plan.
  async function restoreFromBakeEvent(event: BakeEvent, opts?: { rebake?: boolean }) {

    if (!event.dough_snapshot) return;
    isRestoringRef.current = true;
    setShowWelcomeBack(false);
    const snap = event.dough_snapshot;
    const rb = !!opts?.rebake;
    const freshStarterPlan = rb && snap.yeastType === 'sourdough';
    let deltaMs = 0;
    if (rb && snap.eatTime) {
      const oldEat = new Date(snap.eatTime);
      const next = new Date(oldEat.getTime());
      const now = Date.now();
      while (next.getTime() <= now) next.setDate(next.getDate() + 7);
      deltaMs = next.getTime() - oldEat.getTime();
    }
    const shiftD = (d: Date) => rb ? new Date(d.getTime() + deltaMs) : d;
    setTab(snap.tab as 'simple' | 'custom');
    setBakeType(snap.bakeType as BakeType | null);
    setBakeName(snap.bakeName ?? '');
    setStyleKey(snap.styleKey as StyleKey | null);
    setSandwichParty(normalizeSandwichSnapshot(snap.sandwichParty, rb));
    setNumItems(snap.numItems);
    setItemWeight(snap.itemWeight);
    setPizzaDiameter(snap.pizzaDiameter);
    setOvenType(snap.ovenType as AnyOvenType | null);
    setOvenConstruction(snap.ovenConstruction ?? 'tabletop');
    setMixerType(snap.mixerType as MixerType | null);
    setYeastType(snap.yeastType as YeastType | null);
    setKitchenTemp(snap.kitchenTemp);
    setHumidity(snap.humidity);
    setFridgeTemp(snap.fridgeTemp); setWaterSource(['room','fridge','tap','measured'].includes(snap.waterSource ?? '') ? snap.waterSource! : 'room'); setMeasuredWaterTemp(snap.measuredWaterTemp); setWaterMethod(snap.waterMethod ?? 'premelt'); setSpiralIceConfirmed(snap.spiralIceConfirmed ?? false); setMixingBatches(normalizeMixingBatches(snap.mixingBatches)); setContainerCapacityLitres(snap.containerCapacityLitres);
    if (snap.flourBlend) setFlourBlend(snap.flourBlend as FlourBlend);
    setPrefermentType(snap.prefermentType as PrefermentType);
    setQtyChosen(snap.qtyChosen ?? false);
    setFlourChosen(snap.flourChosen ?? false);
    setPrefermentChosen(snap.prefermentChosen ?? false);
    setPrefermentFlourPct(snap.prefermentFlourPct);
    setPrefOffsetH(snap.prefOffsetH);
    setManualHydration(snap.manualHydration);
    setManualOil(snap.manualOil);
    setManualSugar(snap.manualSugar);
    setManualSalt(snap.manualSalt);
    setTargetDoughTemp(snap.targetDoughTemp);
    setFlourInFridge(snap.flourInFridge);
    setMeasuredFlourTemp(snap.measuredFlourTemp); setMeasuredPrefermentTemp(snap.measuredPrefermentTemp);
    setWastePct(snap.wastePct);
    setPriorityOverride(snap.priorityOverride);
    if (snap.eatTime) setEatTime(shiftD(new Date(snap.eatTime)));
    if (snap.startTime) setStartTime(shiftD(new Date(snap.startTime)));
    if (snap.blocks?.length) {
      setBlocks((snap.blocks as unknown[]).map((b) => {
        const bl = b as { label: string; from: number; to: number };
        return { label: bl.label, from: shiftD(new Date(bl.from)), to: shiftD(new Date(bl.to)) };
      }));
    }
    setStarterEvents(restoreStarterEvents(snap.starterEvents).map(event => ({...event, time:shiftD(event.time), bellPeakTime:event.bellPeakTime ? shiftD(event.bellPeakTime) : undefined, bellStartTime:event.bellStartTime ? shiftD(event.bellStartTime) : undefined})));
    setRecipeGenerated(snap.recipeGenerated);
    setModeChosen(snap.modeChosen);
    // Sourdough starter state — snapshots saved after Jul 2026 include these
    if (snap.starterState) setStarterState(snap.starterState as 'rt_fed' | 'fridge_unfed' | 'fridge_fed');
    if (snap.starterLocation) setStarterLocation(snap.starterLocation as 'rt' | 'fridge');
    if (snap.planningMode) setPlanningMode(snap.planningMode as 'last_fed' | 'know_peak');
    if (snap.lastFedTime) setLastFedTime(new Date(snap.lastFedTime));
    if (snap.knownPeakTime) setKnownPeakTime(new Date(snap.knownPeakTime));
    if (snap.lastFedAge !== undefined) setLastFedAge((snap.lastFedAge as 'today'|'yesterday'|'days23'|'days45'|'week'|null) ?? null);
    const _snapLfr = snap.lastFeedRatio ?? snap.feedRatio;
    if (_snapLfr) setLastFeedRatio(_snapLfr as 1 | 2 | 4 | 5 | 10);
    const _snapNfr = snap.nextFeedRatio ?? snap.lastFeedRatio ?? snap.feedRatio;
    if (_snapNfr) setNextFeedRatio(_snapNfr as 1 | 2 | 4 | 5 | 10);
    if (snap.nextFeedRatioOverride !== undefined) setNextFeedRatioOverride(snap.nextFeedRatioOverride as 1 | 2 | 4 | 5 | 10 | null);
    if (snap.ratioMode === 'keep' || snap.ratioMode === 'recommend') setRatioMode(snap.ratioMode);
    if (snap.starterMature !== undefined) setStarterMature(Boolean(snap.starterMature));
    if (snap.starterHasRye !== undefined) setStarterHasRye(Boolean(snap.starterHasRye));
    if (snap.tang) setTang(snap.tang as 'mild' | 'balanced' | 'tangy');
    if (snap.fridgeOutTime) setFridgeOutTime(new Date(snap.fridgeOutTime));
    if (snap.usingPeak2 !== undefined) setUsingPeak2(Boolean(snap.usingPeak2));
    if (snap.feed2Time) setFeed2Time(new Date(snap.feed2Time));
    if (snap.starterFridgeInTime) setStarterFridgeInTime(new Date(snap.starterFridgeInTime));
    if (rb) setBakedDone(false); else if (snap.bakedDone) setBakedDone(true);
    setBakeEventId(rb ? null : event.id);
    if (freshStarterPlan) {
      setStarterPlanResetKey(value => value + 1);
      // Feeding history describes the original bake, not the starter today.
      // Discard both observations and derived actions before solving again.
      setStarterEvents([]);
      setLastFedTime(null);
      setKnownPeakTime(null);
      setHasNotFedYet(null);
      setLastFedAge(null);
      setFeedTime(null);
      setFeed2Time(null);
      setFridgeOutTime(null);
      setStarterFridgeInTime(null);
      setStarterPeakTime(null);
      setUsingPeak2(false);
      setPlanningMode('last_fed');
      setRecipeGenerated(false);
      setShowResults(false);
      setSessionSaved(false);
      setSessionRestored(false);
      setProtocolStale(false);
      setScheduleReady(false);
      setReviewMode(false);
      setSetupOverview(false);
      setActiveTab('setup');
      setActiveStep(snap.tab === 'simple' ? 7 : 1);
      setHighestStep(Math.max(snap.highestStep ?? 1, 7));
      setAdvancedStep(snap.tab === 'custom' ? 9 : 1);
      setAdvancedHighestStep(Math.max(snap.advancedHighestStep ?? 1, 9));
      setTimeout(endRestore, 200);
    } else if (snap.recipeGenerated) {
      setAdvancedStep(snap.tab === 'custom' ? 99 : 1);
      setActiveStep(snap.tab === 'custom' ? 1 : 99);
      setShowResults(true);
      setProtocolStale(false);
      setSessionSaved(!rb);
      setSessionRestored(true);
      setReviewMode(true);
      // Nav #2 — land the baker back on the tab they left (Recipe/Guide),
      // not a review-mode Setup they must decode. Rebakes start on Setup.
      const savedTab = snap.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty' | 'sandwiches';
      if (rb || !savedTab) setActiveTab('setup');
      else if ((savedTab === 'pizzaparty' && snap.bakeType !== 'pizza') || (savedTab === 'sandwiches' && snap.bakeType !== 'bread')) setActiveTab('plan');
      else setActiveTab(savedTab);
      setTimeout(endRestore, 200);
    } else {
      const earlyCompanion = !rb && ((snap.activeTab === 'pizzaparty' && snap.bakeType === 'pizza') || (snap.activeTab === 'sandwiches' && snap.bakeType === 'bread' && !!snap.styleKey && !!sandwichFamilyForStyle(snap.styleKey)));
      setActiveTab(earlyCompanion ? snap.activeTab as 'pizzaparty'|'sandwiches' : 'setup');
      setActiveStep(snap.styleKey ? snap.activeStep ?? snap.highestStep ?? 1 : 1); setHighestStep(snap.highestStep ?? 1);
      setAdvancedStep(snap.styleKey ? snap.advancedStep ?? snap.advancedHighestStep ?? 1 : 1); setAdvancedHighestStep(snap.advancedHighestStep ?? 1);
      setReviewMode(false); setSetupOverview(false); setShowResults(false);
      setSessionSaved(!rb); setSessionRestored(true);
      setTimeout(endRestore, 200);
    }
    // Modern snapshots are authoritative, including an intentionally empty pizza list.
    // Legacy relational slots must not resurrect removed toppings after a partial save.
    if (Object.prototype.hasOwnProperty.call(snap, 'pizzaParty')) {
      const restoredQtys = snap.pizzaParty?.qtys ?? {};
      setPizzaPartyQtys(restoredQtys);
      setBakedPartyQtys(rb ? {} : (snap.pizzaParty?.bakedQtys ?? {}));
      setPizzasConfirmed(Object.values(restoredQtys).some(q => q > 0));
      setPizzaPartyTab(rb ? 'pick' : (['pick','shop','prep','bake'].includes(snap.pizzaPartyTab ?? '') ? snap.pizzaPartyTab as 'pick'|'shop'|'prep'|'bake' : 'pick'));
      setPartyRestoreToken(v => v + 1);
    } else if (event.pizza_party_id) {
      partyHydratingRef.current = true;
      const { fetchPizzaPartySlots } = await import('../lib/supabase/fetchBakeEvents');
      const slotsMap = await fetchPizzaPartySlots([event.id]);
      const slots = slotsMap[event.id] ?? [];
      if (slots.length > 0) {
        const qtys: Record<string, number> = {};
        for (const slot of slots) {
          qtys[slot.preset_id] = (qtys[slot.preset_id] ?? 0) + (slot.qty ?? 1);
        }
        setPizzaPartyQtys(qtys);
        setPartyRestoreToken(v => v + 1);
      }
      partyHydratingRef.current = false;
      endRestore();
    }
    // Ticks travel in the snapshot (manual saves) — hydrate before tabs read
    if (snap.pizzaParty?.shopTicks) {
      try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(snap.pizzaParty.shopTicks)); } catch {}
    }
    if (snap.pizzaParty?.prepTicks) {
      try { localStorage.setItem('bh_prep_ticks_v1', JSON.stringify(snap.pizzaParty.prepTicks)); } catch {}
    }
  }

  // ── Computed: Generate button / progress ──
  // Generate waits for the defaulted steps to be settled by the baker or their
  // profile. Without this the gate never blocked on them: 2 x 270 g, pizza00
  // and 'none' are all truthy from the first render, so a walk-through that
  // never opened those pages still produced a recipe built on three guesses.
  // Preferment and Flour are Custom-only steps; Simple has no page for either.
  const enrichedDirectOnly = styleKey === 'brioche' || styleKey === 'pain_viennois';
  const unsupportedEnrichedMethod = (enrichedDirectOnly && (yeastType === 'sourdough' || prefermentType !== 'none')) || !!(breadProtocol && !isUnleavened && (!breadProtocol.supportedPreferments.includes(prefermentType) || (!breadSupportsStarter && yeastType === 'sourdough')));
  const archivedFlourNames = archivedBlendSelections(flourBlend);
  const simpleRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && qtyChosen);
  const customRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && flourBlend
    && qtyChosen && flourChosen && (yeastType === 'sourdough' || prefermentChosen));
  const starterPlanReady = yeastType !== 'sourdough' || recipeGenerated || starterEvents.length > 0;
  const canGenerate = !(tab === 'custom' ? advancedRecipe : recipe)?.protocolIssue && commercialPrefermentPlanReady && starterPlanReady && !unsupportedEnrichedMethod && !(tab === 'custom' && archivedFlourNames.length) && (tab === 'simple' ? simpleRequiredDone : customRequiredDone);
  const mixerCapacityG = mixerType ? MIXER_TYPES[mixerType]?.maxDoughG ?? 9999 : 9999;
  const suggestedMixingBatches = Math.max(1, Math.ceil(numItems * itemWeight / mixerCapacityG));
  const selectedMixingBatches = mixingBatches ?? suggestedMixingBatches;
  const mixingBatchControl = mixerType ? (
    <div style={{ marginTop: 16, padding: '14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--warm)' }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14, fontWeight: 600 }}>
        {locale === 'fr' ? 'Nombre de pétrissées' : 'Mixing batches'}
        <input type="number" min={1} max={100} step={1} value={selectedMixingBatches} onChange={e => { const value = Number(e.target.value); if (e.target.value !== '' && Number.isInteger(value) && value >= 1 && value <= 100) setMixingBatches(value); }} style={{ width: 72, minHeight: 44, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--cream)', font: 'inherit' }} />
      </label>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--smoke)' }}>{locale === 'fr' ? `${Math.round(numItems * itemWeight / selectedMixingBatches)} g par pétrissée. Capacité estimée : ${mixerCapacityG} g. Vérifiez la limite de votre appareil.` : `${Math.round(numItems * itemWeight / selectedMixingBatches)} g per batch. Estimated capacity: ${mixerCapacityG} g. Check your equipment’s limit.`}</p>
      {numItems * itemWeight / selectedMixingBatches > mixerCapacityG && <p role="alert" style={{ fontSize: 12 }}>{locale === 'fr' ? 'Cette quantité dépasse la capacité indicative. Augmentez le nombre de pétrissées si nécessaire.' : 'This amount exceeds the estimated capacity. Increase the batch count if needed.'}</p>}
      {mixingBatches !== undefined && <button type="button" onClick={() => setMixingBatches(undefined)} style={{ minHeight: 44, padding: '8px 0', border: 0, background: 'transparent', color: 'var(--terra)', cursor: 'pointer', textDecoration: 'underline' }}>{locale === 'fr' ? 'Revenir à la recommandation' : 'Reset to recommendation'}</button>}
    </div>
  ) : null;


  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  // Localized style name — data.ts carries nameFr but several surfaces used .name unconditionally
  const styleDisplayName = (sk: string | null | undefined): string => {
    if (!sk) return '';
    const st = (ALL_STYLES as Record<string, { name?: string; nameFr?: string }>)[sk];
    return (locale === 'fr' ? st?.nameFr : undefined) ?? st?.name ?? sk;
  };
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // The crust segment shown as chosen, or -1 when the weight sits between two
  // crusts — a baker who typed 265g at 30cm is neither Classic nor Generous,
  // and pretending otherwise is how the three controls drift apart.
  const crustActive = (styleKey && crustMatchesWeight(styleKey, pizzaDiameter, pizzaCorn, itemWeight))
    ? pizzaCorn : -1;

  // ── Simple-mode step model (single source of truth) ──
  const localName = (o: unknown): string | null => {
    if (!o) return null;
    const r = o as { name?: string; nameFr?: string };
    return (locale === 'fr' ? r.nameFr : undefined) ?? r.name ?? null;
  };
  const fr = locale === 'fr';
  const ovenDisplayName = ovenType === 'pizza_oven'
    ? (ovenConstruction === 'masonry' ? (fr ? 'Four maçonné' : 'Brick / masonry oven') : (fr ? 'Four à pizza compact' : 'Tabletop pizza oven'))
    : ovenType === 'steam_oven'
      ? (ovenConstruction === 'micro' ? (fr ? 'Four de microboulangerie' : 'Microbakery oven') : (fr ? 'Four vapeur domestique' : 'Home steam oven'))
      : localName(ovenData);
  const SIMPLE_STEPS: StepDef[] = ([
    { id: 1, group: 'making', chip: fr ? 'Style' : 'Style', title: fr ? 'Choisissez votre pâte' : 'Choose your dough',
      value: styleKey ? styleDisplayName(styleKey) : null,
      // "Classic Neapolitan" and "New York Style" carry a qualifier the baker
      // does not need re-read on a summary line.
      short: styleKey ? styleDisplayName(styleKey).replace(/^Classic |^Pizza | Style$/g, '') : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, group: 'making', chip: fr ? 'Quantité' : 'Quantity', title: fr ? 'Quelle quantité de pâte ?' : 'How much dough?',
      value: qtyChosen ? `${numItems} × ${itemWeight} g` : null, prefilled: false,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, group: 'kitchen', chip: fr ? 'Équipement' : 'Equipment', title: fr ? 'Votre équipement' : 'Your equipment',
      value: (ovenType && mixerType)
        ? `${ovenDisplayName} · ${localName(MIXER_TYPES[mixerType])}`
        : null,
      // The oven alone identifies the step; the mixer rarely changes the read.
      short: (ovenType && mixerType) ? ovenDisplayName : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    { id: 4, group: 'kitchen', chip: fr ? 'Cuisine' : 'Kitchen', title: fr ? 'Températures de préparation' : 'Preparation temperatures',
      value: `${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`, prefilled: true,
      gap: fr ? 'Le climat n\u2019est pas renseigné' : 'Climate not set' },
    { id: 6, group: 'dough', chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType && !(enrichedDirectOnly && yeastType === 'sourdough') ? localName(YEAST_TYPES[yeastType]) : null,
      short: yeastType
        ? ({ idy: 'IDY', ady: 'ADY', fresh: fr ? 'Fraîche' : 'Fresh', sourdough: fr ? 'Levain' : 'Sourdough' } as Record<string, string>)[yeastType]
          ?? localName(YEAST_TYPES[yeastType])
        : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    { id: 7, group: 'plan', chip: 'Plan', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? `${formatTime(new Date(Math.round(startTime.getTime() / 900000) * 900000), locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}`
        : null,
      // The chip gets the bake time alone. Start time and busy windows are
      // consequences of it — the baker picks when to eat, everything else is
      // derived — and at full length this one chip was wider than the four
      // beside it put together.
      short: eatTime ? formatTime(eatTime, locale) : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
  ] as StepDef[]).filter(step=>!isUnleavened || step.id!==6);
  const SIMPLE_LAST = SIMPLE_STEPS[SIMPLE_STEPS.length - 1].id;
  // ── Custom-mode step model ──
  // Preferment (8) is absent on the sourdough path, so this list is 10 or 9
  // entries long. Positions are indexes into it; ids never move.
  const flourSummary = (): string => {
    const primary = flourBlend.brandProduct ?? localName(FLOUR_DATA[flourBlend.flour1]) ?? '';
    if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) return `100% ${primary}`;
    const hasThird = !!flourBlend.flour3 && flourBlend.ratio2 !== undefined && 100 - flourBlend.ratio1 - flourBlend.ratio2 > 0;
    const secondRatio = hasThird ? flourBlend.ratio2! : 100 - flourBlend.ratio1;
    const parts = [`${flourBlend.ratio1}% ${primary}`, `${secondRatio}% ${flourBlend.customFlour2Name ?? localName(FLOUR_DATA[flourBlend.flour2])}`];
    if (hasThird) parts.push(`${100 - flourBlend.ratio1 - secondRatio}% ${flourBlend.customFlour3Name ?? localName(FLOUR_DATA[flourBlend.flour3!])}`);
    return parts.join(' + ');
  };
  const reviewTiming = eatTime ? eatTime.toLocaleString(fr ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const reviewKitchen = `${kitchenTemp}°C · ${fr ? 'réfrigérateur' : 'fridge'} ${fridgeTemp}°C`;
  const CUSTOM_STEPS: StepDef[] = ([
    { id: 1, group: 'making', chip: fr ? 'Style' : 'Style', title: fr ? 'Choisissez votre pâte' : 'Choose your dough',
      value: styleKey ? styleDisplayName(styleKey) : null,
      // "Classic Neapolitan" and "New York Style" carry a qualifier the baker
      // does not need re-read on a summary line.
      short: styleKey ? styleDisplayName(styleKey).replace(/^Classic |^Pizza | Style$/g, '') : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, group: 'making', chip: fr ? 'Quantité' : 'Quantity', title: fr ? 'Quelle quantité de pâte ?' : 'How much dough?',
      value: qtyChosen ? `${numItems} × ${itemWeight} g` : null, prefilled: false,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, group: 'kitchen', chip: fr ? 'Équipement' : 'Equipment', title: fr ? 'Votre équipement' : 'Your equipment',
      value: (ovenType && mixerType)
        ? `${ovenDisplayName} · ${localName(MIXER_TYPES[mixerType])}`
        : null,
      // The oven alone identifies the step; the mixer rarely changes the read.
      short: (ovenType && mixerType) ? ovenDisplayName : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    { id: 4, group: 'kitchen', chip: fr ? 'Cuisine' : 'Kitchen', title: fr ? 'Températures de préparation' : 'Preparation temperatures',
      value: `${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`, prefilled: true,
      gap: fr ? 'Le climat n\u2019est pas renseigné' : 'Climate not set' },
    { id: 6, group: 'dough', chip: fr ? 'Farine' : 'Flour', title: t('steps.flour.title'),
      value: flourChosen && !archivedFlourNames.length ? flourSummary() : null, prefilled: false,
      gap: fr ? 'La farine n\u2019est pas confirmée' : 'Flour not confirmed' },
    { id: 7, group: 'dough', chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType && !(enrichedDirectOnly && yeastType === 'sourdough') ? localName(YEAST_TYPES[yeastType]) : null,
      short: yeastType
        ? ({ idy: 'IDY', ady: 'ADY', fresh: fr ? 'Fraîche' : 'Fresh', sourdough: fr ? 'Levain' : 'Sourdough' } as Record<string, string>)[yeastType]
          ?? localName(YEAST_TYPES[yeastType])
        : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    ...(yeastType !== 'sourdough' ? [{
      id: 8, group: 'dough', chip: fr ? 'Préferment' : 'Preferment', title: t('preferment.stepTitle'),
      value: prefermentChosen && !(enrichedDirectOnly && prefermentType !== 'none')
        ? (prefermentType !== 'none' ? localName(PREFERMENT_TYPES[prefermentType]) : t('preferment.direct'))
        : null,
      prefilled: profileFields.has('preferment'),
      gap: fr ? 'Le préferment n\u2019est pas confirmé' : 'Preferment not confirmed',
    } as StepDef] : []),
    { id: 9, group: 'plan', chip: 'Plan', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? `${formatTime(new Date(Math.round(startTime.getTime() / 900000) * 900000), locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}`
        : null,
      // The chip gets the bake time alone. Start time and busy windows are
      // consequences of it — the baker picks when to eat, everything else is
      // derived — and at full length this one chip was wider than the four
      // beside it put together.
      short: eatTime ? formatTime(eatTime, locale) : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
    { id: 10, group: 'making', chip: fr ? 'Peaufiner' : 'Fine-tune', title: t('dialIn.title'),
      value: manualHydration !== undefined
        ? `${manualHydration}% ${t('dialIn.hydrationSuffix')}`
        // The style's BASE hydration is not what the dough is made at — the
        // engine adjusts it for the oven and the climate, and the Fine-tune
        // page shows both ("Adjusted from 62% · oven -2%"). The chip was
        // printing the base, so the rail read 62% while the slider beside it
        // read 60% and the recipe was built at 60%. One fact, three places,
        // and the chip was showing the one number nothing used.
        : advancedRecipe ? `${Math.round(advancedRecipe.hydration * 2) / 2}% ${t('dialIn.hydrationSuffix')}`
        : styleKey ? `${ALL_STYLES[styleKey].hydration}% ${t('dialIn.hydrationSuffix')}` : null,
      prefilled: true,
      gap: fr ? 'La pâte n\u2019est pas confirmée' : 'Dough not confirmed' },
  ] as StepDef[]).filter(step=>!isUnleavened || (step.id!==7 && step.id!==8));
  const CUSTOM_LAST = CUSTOM_STEPS[CUSTOM_STEPS.length - 1].id;

  const customFlow: StepFlow = {
    steps: CUSTOM_STEPS,
    activeId: advancedStep > CUSTOM_LAST ? CUSTOM_LAST : advancedStep,
    highestStep: advancedHighestStep,
    locale,
    onJump: (id) => { setGapReturnTo(null); setAdvancedStep(id); setAdvancedHighestStep(p => Math.max(p, id)); scrollToStepTop(); },
    onGapJump: (id) => { setGapReturnTo(CUSTOM_LAST); setAdvancedStep(id); setAdvancedHighestStep(p => Math.max(p, id)); scrollToStepTop(); },
    onPrev: (id) => {
      const i = CUSTOM_STEPS.findIndex(x => x.id === id);
      setAdvancedStep(CUSTOM_STEPS[Math.max(0, i - 1)].id);
      scrollToStepTop();
    },
    onNext: (id) => advanceAdv(id),
    nextIdFor: (id) => nextUnanswered(CUSTOM_STEPS, id, advancedHighestStep),
    onGenerate: () => { setSetupOverview(true); scrollToStepTop(); },
    showGenerate: canGenerate && !!eatTime && !(sessionRestored && recipeGenerated),
    generateLabel: locale === 'fr' ? 'Vérifier mes choix' : 'Review my choices',
    onSeePlan: () => setActiveTab('plan'),
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    // Coming back from a gap step means the baker has now seen it and kept
    // what was there. A prefilled default only counts as adopted once
    // `highest > id` — "moved past its page" — and a backwards jump never
    // moves past anything, so without this the same step is reported missing
    // for ever and the CTA sends you to the page you just came from.
    onGapReturn: () => {
      if (advancedStep === 1 && !styleKey) return;
      if (advancedStep === 6 && (!flourChosen || archivedFlourNames.length)) return;
      // Leaving a gap step means the baker has seen it and settled it, so it
      // counts as answered from here on. `find` returns the FIRST unanswered
      // step, so everything before it is already answered and raising the
      // ceiling to reach it cannot silently adopt a step nobody looked at.
      const settled = Math.max(advancedHighestStep, advancedStep + 1);
      const found = CUSTOM_STEPS.find(
        st => st.id > advancedStep && !stepAnswered(st, settled, CUSTOM_STEPS));
      // When the next gap IS the last step, that is just going back to the
      // plan — leaving gapReturnTo set there would strand a stale "back to
      // plan" button on any step the baker visits afterwards.
      const nextGap = found && found.id !== CUSTOM_LAST ? found : undefined;
      if (nextGap) {
        setAdvancedHighestStep(Math.max(settled, nextGap.id));
        setAdvancedStep(nextGap.id);   // gapReturnTo stays set: the chain continues
      } else {
        // Raise the ceiling to the page we are landing on, as onJump does.
        // Without it the last step stays unanswered, becomes its own gap, and
        // its CTA offers to jump to the page it is already showing.
        setAdvancedHighestStep(Math.max(settled, CUSTOM_LAST));
        setGapReturnTo(null);
        setAdvancedStep(CUSTOM_LAST);
      }
      scrollToStepTop();
    },
  };



  const simpleFlow: StepFlow = {
    steps: SIMPLE_STEPS,
    // A restored session parks activeStep on the 99 sentinel; in page mode
    // that would render nothing, so it lands on the last step instead.
    activeId: activeStep > SIMPLE_LAST ? SIMPLE_LAST : activeStep,
    highestStep,
    locale,
    onJump: (id) => { setGapReturnTo(null); setActiveStep(id); setHighestStep(p => Math.max(p, id)); scrollToStepTop(); },
    onGapJump: (id) => { setGapReturnTo(SIMPLE_LAST); setActiveStep(id); setHighestStep(p => Math.max(p, id)); scrollToStepTop(); },
    onPrev: (id) => {
      const i = SIMPLE_STEPS.findIndex(x => x.id === id);
      setActiveStep(SIMPLE_STEPS[Math.max(0, i - 1)].id);
      scrollToStepTop();
    },
    onNext: (id) => advance(id),
    nextIdFor: (id) => nextUnanswered(SIMPLE_STEPS, id, highestStep),
    onGenerate: () => { setSetupOverview(true); scrollToStepTop(); },
    showGenerate: canGenerate && !(sessionRestored && recipeGenerated),
    generateLabel: locale === 'fr' ? 'Vérifier mes choix' : 'Review my choices',
    onSeePlan: () => setActiveTab('plan'),
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    onGapReturn: () => {
      if (activeStep === 1 && !styleKey) return;
      const settled = Math.max(highestStep, activeStep + 1);
      const found = SIMPLE_STEPS.find(
        st => st.id > activeStep && !stepAnswered(st, settled, SIMPLE_STEPS));
      const nextGap = found && found.id !== SIMPLE_LAST ? found : undefined;
      if (nextGap) {
        setHighestStep(Math.max(settled, nextGap.id));
        setActiveStep(nextGap.id);
      } else {
        setHighestStep(Math.max(settled, SIMPLE_LAST));
        setGapReturnTo(null);
        setActiveStep(SIMPLE_LAST);
      }
      scrollToStepTop();
    },
  };

  // The scheduler page is excluded: its chart diamonds are dragged sideways,
  // and a 60px drag there must move a feed time, never the page.
  const simpleSwipeRef = useStepSwipe(simpleFlow,
    tab === 'simple' && activeTab === 'setup' && simpleFlow.activeId !== SIMPLE_LAST);
  const customSwipeRef = useStepSwipe(customFlow,
    tab === 'custom' && activeTab === 'setup' && customFlow.activeId !== 9);




  // ── Render ────────────────────────────────
  return (
    <div data-reading={bottomNavCollapsed || undefined} data-keyboard-open={keyboardOpen || undefined} data-mobile-setup={activeTab === 'setup' && !recipeGenerated ? 'true' : undefined} style={{ minHeight: '100vh', background: 'var(--warm)' }}>
      {/* ── Sticky header + journey bar (autohide on scroll down) ── */}
      <div ref={stickyHeadRef} className="bh-header-stack" onFocusCapture={() => setNavHidden(false)} style={{
        position: 'sticky',
        top: navHidden ? `-${HEADER_HIDE_PX}px` : '0',
        zIndex: 100,
        transition: 'top 0.25s ease',
      }}>
        <Header
          units={units}
          onUnitsChange={setUnitsAndPersist}
          onLoadRecipe={loadRecipe}
          recipeGenerated={recipeGenerated}
          sessionSaved={sessionSaved}
          sessionRestored={sessionRestored}
          hideActionBar={false}
          openSessionId={shareSessionId}
          onShareSessionClose={() => setShareSessionId(null)}
          sessionSummary={(() => {
            if (!styleKey || !eatTime) return '';
            const styleName = styleDisplayName(styleKey);
            const dateStr = eatTime.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            // Time only — formatTime() prefixes the weekday, and dateStr
            // already has it ("Sat 18 Jul, Sat 19:00" duplication)
            const timeStr = eatTime.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit' });
            const itemLabel = bakeType === 'bread'
              ? (locale === 'fr' ? (numItems === 1 ? 'pain' : 'pains') : (numItems === 1 ? 'loaf' : 'loaves'))
              : (numItems === 1 ? 'pizza' : 'pizzas');
            return `${styleName} · ${numItems} ${itemLabel} · ${dateStr}, ${timeStr}`;
          })()}
          sessionDoughSpec={tab === 'custom' && manualHydration !== undefined
            ? `${manualHydration}% · ${prefermentType !== 'none' ? prefermentType.charAt(0).toUpperCase() + prefermentType.slice(1) + ' · ' : ''}${locale === 'fr' ? 'Personnalisé' : 'Custom'}`
            : ''}
          onBeforeLocaleChange={() => {
            if (!bakeType) return;
            saveSession(buildSessionPayload());
            try { sessionStorage.setItem('bh_locale_resume', JSON.stringify({activeStep, advancedStep, setupOverview, activeTab, pizzaPartyTab, reviewMode})); } catch {}
          }}
          onSaveSession={saveCurrentSession}
          onReviewPlan={bakeType && modeChosen ? () => { setActiveTab('setup'); setReviewMode(true); setSetupOverview(true); scrollToStepTop(); } : undefined}
          onOpenSandwiches={sandwichEnabled ? () => { setActiveTab('sandwiches'); setNavHidden(false); } : undefined}
          onOpenPizzas={bakeType === 'pizza' ? () => { setActiveTab('pizzaparty'); setNavHidden(false); } : undefined}
          onSharePlan={shareCurrentSession}
          onBack={bakeType ? () => {
            if (activeTab === 'setup') {
              if (tab === 'simple' && activeStep > 1) {
                simpleFlow.onPrev(activeStep);
              } else if (tab === 'custom' && advancedStep > 1) {
                customFlow.onPrev(advancedStep);
              } else if (modeChosen) {
                setModeChosen(false);
              } else {
                setBakeType(null);
              }
              scrollToStepTop();
            } else if (activeTab === 'guide' || activeTab === 'pizzaparty' || activeTab === 'sandwiches') {
              setActiveTab(recipeGenerated ? 'plan' : 'setup');
            } else {
              setActiveTab('setup');
              setReviewMode(true);
              setSetupOverview(true);
            }
          } : undefined}
          // Nothing to start over from on the landing page — the baker is
          // already at the start. It appears the moment they pick a bake type,
          // which is also the moment it becomes useful: it is how they switch
          // Pizza <-> Pain.
          onNewSession={bakeType ? requestNewSession : undefined}
          onResumeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event); }}
          onRebakeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event, { rebake: true }); }}
          onOpenProfile={() => setProfileOpen(true)}
        />

        {profileOpen && (
          <ProfileSheet locale={locale} onClose={() => setProfileOpen(false)} />
        )}

        {confirmNewSession && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(43,33,24,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setConfirmNewSession(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--warm)', borderRadius: '16px', padding: '20px',
                maxWidth: '360px', width: '100%',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}
            >
              <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
                {locale === 'fr' ? 'Ce plan n\u2019est pas enregistr\u00e9' : 'This plan is not saved'}
              </p>
              <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
                {locale === 'fr'
                  ? 'Enregistrez-le dans votre historique avant d\u2019en commencer un nouveau.'
                  : 'Save it to your history before starting a new one.'}
              </p>
              <button
                onClick={async () => { const preserved = await saveCurrentSession(); if (preserved) { setConfirmNewSession(false); startOver(); } }}
                style={{ width: '100%', padding: '14px', minHeight: '44px', background: 'var(--terra)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                {locale === 'fr' ? 'Enregistrer, puis nouveau plan' : 'Save it, then start fresh'}
              </button>
              <button
                onClick={() => { setConfirmNewSession(false); startOver(); }}
                style={{ width: '100%', padding: '12px', minHeight: '44px', background: 'none', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '13px', color: 'var(--char)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                {locale === 'fr' ? 'Abandonner ce plan' : 'Discard this plan'}
              </button>
              <button
                onClick={() => setConfirmNewSession(false)}
                style={{ width: '100%', padding: '12px', minHeight: '44px', background: 'none', border: 'none', borderRadius: '12px', fontSize: '13px', color: 'var(--smoke)', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
              >
                {locale === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
            </div>
          </div>
        )}


      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: `${bakeType ? '0' : 'clamp(1rem, 3vw, 1.5rem)'} clamp(1rem, 3vw, 1.5rem) ${bakeType ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 'clamp(1rem, 3vw, 1.5rem)'}` }}>

        {/* ── Nav #6: welcome-back inline banner (was a fixed toast that
             covered tap targets above the bottom nav) ── */}
        {showWelcomeBack && activeTab === 'setup' && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '8px 8px 8px 14px',
            margin: '0 0 14px',
            minHeight: '56px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(43, 36, 32,0.06))',
          }}>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '13.5px',
              color: 'var(--ash)', flex: '1 1 auto', minWidth: 0, lineHeight: 1.35,
            }}>
              {/* Sentence case, not uppercase with letter-spacing: the tracked
                  caps made the label long enough that the two controls could not
                  sit beside it, so the row wrapped to three and the banner ate
                  200px above the hero.

                  It also names what is waiting. "You have a dough in progress"
                  makes the baker tap Resume to find out whether they want it,
                  which is a decision without information. Style answers what it
                  is and the bake time answers whether it is still any use —
                  those are the two facts that decide it. Progress is left out
                  on purpose; it speaks to sunk cost, not to fit. */}
              {(() => {
                const st = pendingSession?.styleKey
                  ? styleDisplayName(pendingSession.styleKey as StyleKey)
                  : null;
                const when = pendingSession?.eatTime
                  ? formatTime(new Date(pendingSession.eatTime), locale)
                  : null;
                const head = st
                  ? (locale === 'fr' ? `Reprendre votre ${st}` : `Resume your ${st}`)
                  : (locale === 'fr' ? 'Vous avez une pâte en cours' : 'You have a dough in progress');
                return (
                  <>
                    <span style={{ color: 'var(--char)', fontWeight: 600 }}>{head}</span>
                    {when && (
                      <span style={{ color: 'var(--smoke)' }}>
                        {locale === 'fr' ? ` · cuisson ${when}` : ` · bake ${when}`}
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
            <button
              onClick={() => {
                // This is where the session is APPLIED. Nothing was restored on
                // mount — see the comment on pendingSession — so Resume now
                // does the thing it says rather than dismissing a banner over
                // state that had already appeared by itself.
                const s = pendingSession;
                answerWelcomeBack();
                if (!s) return;
                applySession(s);
                if (s.recipeGenerated) setActiveTab('plan');
                else {
                  const isCustom = s.tab === 'custom';
                  const target = firstIncompleteStep(isCustom);
                  if (isCustom) setAdvancedStep(target); else setActiveStep(target);
                  scrollToStepTop();
                }
              }}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                padding: '0 16px', height: '40px', minHeight: '40px',
                borderRadius: '12px', whiteSpace: 'nowrap', flex: '0 0 auto',
              }}
            >
              {pendingSession?.recipeGenerated
                ? (locale === 'fr' ? 'Voir les ingrédients →' : 'View ingredients →')
                : (locale === 'fr' ? 'Reprendre →' : 'Resume →')}
            </button>
            {/* Dismiss as an icon, not a worded button. "Start fresh" was the
                wrong promise — answerWelcomeBack leaves the session on disk and
                only silences the offer for this browser session, so a label
                that sounds like a wipe describes something that does not
                happen. The real wipe is the reset control in the header, and
                two things called "start fresh" meaning two different things
                would surprise someone. 44x44 reach on an 18px glyph. */}
            <button
              onClick={answerWelcomeBack}
              aria-label={locale === 'fr' ? 'Masquer' : 'Dismiss'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--smoke)', width: '44px', height: '44px', flex: '0 0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', lineHeight: 1, fontFamily: 'var(--font-ui)',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Cloud « Reprendre » — same banner, but the session lives only in
            the account (fresh device); hydrates on tap via restoreFromBakeEvent */}
        {/* Rien ne s'offre par-dessus du travail en cours. La garde ne
            regardait que le setup (!modeChosen) ; après une soirée entière,
            « Session trouvée sur votre compte » proposait une AUTRE fournée
            au moment précis où celle-ci venait de finir — et Reprendre
            l'aurait écrasée. */}
        {!showWelcomeBack && cloudResume && !modeChosen && !sessionRestored
          && !recipeGenerated && !hasWorkInProgress && activeTab === 'setup' && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '12px 16px',
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(43, 36, 32,0.06))',
          }}>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--smoke)', textTransform: 'uppercase',
                letterSpacing: '.08em', display: 'block',
              }}>
                {locale === 'fr' ? 'Session trouvée sur votre compte' : 'Session found in your account'}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '12px',
                color: 'var(--char)', display: 'block', marginTop: '2px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {bakeEventTitle(cloudResume)}
              </span>
            </span>
            <button
              onClick={() => {
                const ev = cloudResume;
                setCloudResume(null);
                try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
                if (ev) void restoreFromBakeEvent(ev);
              }}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                padding: '8px 16px', borderRadius: '12px', whiteSpace: 'nowrap',
              }}
            >
              {locale === 'fr' ? 'Reprendre →' : 'Resume →'}
            </button>
          </div>
        )}

        {/* ── Hero + bake type picker ── */}
        {activeTab === 'setup' && (
        <div ref={modeSelectorRef} style={{ textAlign: 'center', marginBottom: '16px' }}>
          {unsupportedEnrichedMethod && <div role="alert" style={{ padding: 14, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left' }}>
            <p>{locale === 'fr' ? 'Cette recette enrichie est actuellement prévue avec de la levure et sans préferment. Votre ancien choix est conservé ; choisissez la méthode prise en charge pour créer une nouvelle recette.' : 'This enriched recipe currently supports commercial yeast and no preferment. Your saved choice is preserved; choose the supported method to create a new recipe.'}</p>
            <button type="button" onClick={() => { choosePreferment('none'); chooseYeast('instant'); setSetupOverview(false); if (tab === 'custom') setAdvancedStep(7); else setActiveStep(6); }} style={NEXT_CTA}>{locale === 'fr' ? 'Utiliser la levure instantanée sans préferment' : 'Use instant yeast without preferment'}</button>
          </div>}
          {tab === 'custom' && archivedFlourNames.length > 0 && <div role="alert" style={{ padding: 14, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left' }}><p>{locale === 'fr' ? 'Ces farines enregistrées ne sont plus proposées dans le catalogue. Choisissez leur remplacement pour créer une nouvelle recette :' : 'These saved flours are no longer selectable. Choose replacements before creating a new recipe:'} {archivedFlourNames.join(' · ')}</p><button type="button" onClick={() => { setSetupOverview(false); setAdvancedStep(6); }} style={NEXT_CTA}>{locale === 'fr' ? 'Revoir mes farines' : 'Review my flours'}</button></div>}

          {!bakeType && (
          <div style={{ minHeight: 'calc(100dvh - 260px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'clamp(1.4rem, 5vw, 2rem)',
            fontWeight: 700,
            color: 'var(--char)',
            lineHeight: 1.2,
            margin: '0 0 20px',
          }}>
            {locale === 'fr' ? 'Que souhaitez-vous préparer ?' : 'What would you like to make?'}
          </h1>

          {/* Pizza / Bread picker — full cards before selection, compact toggle after */}
          <div className="bake-kind-grid" style={{ display: 'grid', gap: '12px', margin: '0 0 16px' }}>
            {([
              { type: 'pizza' as BakeType, image: '/images/approved/opening-v2/pizza.webp', label: t('bakeType.pizza.label'), desc: t('bakeType.pizza.desc'), activeBorder: 'var(--terra)', activeBg: '#FFF8F3' },
              { type: 'bread' as BakeType, image: '/images/approved/opening-v2/bread.webp', label: t('bakeType.bread.label'), desc: t('bakeType.bread.desc'), activeBorder: 'var(--bread)', activeBg: 'var(--bread-l)' },
            ]).map(opt => (
              <div
                key={opt.type}
                role="button"
                tabIndex={0}
                aria-label={opt.label}
                aria-pressed={bakeType === opt.type}
                onClick={() => {
                  selectBakeType(opt.type);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBakeType(opt.type); }
                }}
                onMouseEnter={() => setHoveredBakeType(opt.type)}
                onMouseLeave={() => setHoveredBakeType(null)}
                style={{
                  position: 'relative',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  border: `2px solid ${bakeType === opt.type ? opt.activeBorder : 'var(--border)'}`,
                  boxShadow: hoveredBakeType === opt.type
                    ? 'var(--card-shadow-hover)'
                    : bakeType === opt.type
                      ? `0 0 0 4px ${opt.type === 'bread' ? 'rgba(139,105,20,.1)' : 'rgba(107, 68, 35,.1)'}`
                      : 'var(--card-shadow)',
                  transform: hoveredBakeType === opt.type ? 'translateY(-3px)' : 'none',
                  transition: 'all .2s',
                }}
              >
                {/* Preserve the complete food silhouette on the opening choice. */}
                <img
                  src={opt.image}
                  alt={opt.label}
                  className="bake-kind-image" width={1200} height={800} style={{ width: '100%', objectFit: 'cover', display: 'block', background: '#f3ede3' }}
                />
                {/* Labels stay outside the image so they do not obscure the food. */}
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--card)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--char)', marginBottom: '4px', fontFamily: 'var(--font-ui)' }}>
                    {opt.label}
                  </div>
                </div>
                {/* Selected checkmark */}
                {bakeType === opt.type && (
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: opt.type === 'bread' ? 'var(--bread)' : 'var(--terra)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', color: 'white', fontWeight: 700,
                  }}>✓</div>
                )}
              </div>
            ))}
          </div>
          </div>

          </div>
          )}

        </div>
        )}

{recipeGenerated && <div style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}><strong style={{fontSize:14}}>{bakeName || (bakeType==='bread'?(fr?'Ma fournée de pain':'My bread bake'):(fr?'Ma soirée pizza':'My pizza night'))}</strong><div style={{fontSize:12,color:'var(--smoke)',marginTop:4}}>{numItems} {bakeType==='bread'?(fr?(numItems===1?'pain':'pains'):(numItems===1?'bread':'breads')):'pizzas'} · {styleKey ? styleDisplayName(styleKey) : ''}</div></div>}

{!!bakeType && <div id="bh-top-stepper" onFocusCapture={()=>setNavHidden(false)} style={{
        // THIS is the sticky element, not its children. A sticky box only
        // stays stuck while its parent is in view, and this wrapper was only
        // as tall as the bar inside it — so the bar left the screen with its
        // own container the moment that container scrolled past. No offset
        // could have fixed that; it was never going to stick.
        //
        // Sticky lives here because this div's parent is Main content, which
        // is the height of the page. It also wraps BOTH modules, so dough and
        // party get one sticky element between them rather than one each.
        position: 'sticky', top: `${stickTop}px`, zIndex: 26,
        background: 'var(--warm)',
        boxShadow: '0 6px 10px -10px rgba(26,22,18,0.45)',
        margin: '0 0 4px',
        // Same easing and duration as the header above it. The header glides
        // its 100px over 0.25s; this bar's offset changed by state, so it
        // snapped the same distance instantly and the two came apart mid
        // scroll. They move as one piece now.
        transition: 'top 0.25s ease',
      }}>

        {activeTab === 'setup' && modeChosen && !recipeGenerated && <SummaryBar flow={tab === 'simple' ? simpleFlow : customFlow}
          modeChip={{value: tab === 'simple' ? 'Simple' : (fr ? 'Personnalisé' : 'Custom'), onClick: () => setModeChosen(false)}} />}
        {recipeGenerated && (activeTab === 'setup' || activeTab === 'plan' || activeTab === 'guide') && <CompanionSteps onReveal={navHidden ? ()=>setNavHidden(false) : undefined}
          label={fr ? 'Votre pâte' : 'Your dough'} active={activeTab}
          steps={[{key:'setup',label:'Plan'}, {key:'plan',label:fr?'Recette':'Recipe'}, {key:'guide',label:fr?'Protocole':'Guide'}]}
          onChange={next=>{if(next==='setup'){setReviewMode(true);setSetupOverview(true);}setActiveTab(next);setNavHidden(false);scrollToStepTop();}} />}
        {activeTab === 'pizzaparty' && <CompanionSteps onReveal={navHidden ? ()=>setNavHidden(false) : undefined} label={fr ? 'Étapes des pizzas' : 'Pizza steps'} active={pizzaPartyTab}
          onChange={setPizzaPartyTab} steps={[
            {key:'pick',label:t('tabs.pizzas'),done:pizzasConfirmed && pizzaPartyTab !== 'pick'},
            {key:'shop',label:t('tabs.shopping'),locked:!pizzasConfirmed},
            {key:'prep',label:t('tabs.prep'),locked:!pizzasConfirmed},
            {key:'bake',label:t('tabs.bake'),locked:!pizzasConfirmed,
              done:Object.values(pizzaPartyQtys).some(q=>q>0) && Object.entries(pizzaPartyQtys).every(([id,q])=>(bakedPartyQtys[id]??0)>=q)},
          ]} />}
        {activeTab === 'sandwiches' && sandwichEnabled && <CompanionSteps onReveal={navHidden ? ()=>setNavHidden(false) : undefined} label={fr ? 'Étapes des sandwichs' : 'Sandwich steps'} active={sandwichParty.tab}
          onChange={next=>setSandwichParty(previous=>({...previous,tab:next}))} steps={[
            {key:'pick',label:fr?'Choisir':'Choose'}, {key:'shop',label:fr?'Courses':'Shopping'},
            {key:'prep',label:fr?'Préparer':'Prepare'}, {key:'serve',label:fr?'Servir':'Serve'},
          ]} />}
      </div>}

          {/* Mode + Pizza Party — only shown after bakeType selected.
              No card frame: the toggle sits directly on the page surface. */}
          {bakeType && (
            <div style={{ padding: '2px 0' }}>

              {/* Mode is the first step of setup, not a permanent bar.
                  It was a fourth navigation layer above the content — under the
                  brand header, the journey tabs and the stepper — for a
                  decision taken once per session. Shown here only until it is
                  made; afterwards it lives as a chip in the summary row, which
                  is the same mechanic every other choice uses. */}
              {!modeChosen && activeTab === 'setup' && (
                <div style={{ padding: '4px 0 8px' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800,
                    letterSpacing: '-.022em', lineHeight: 1.13, margin: '8px 0 16px',
                  }}>{locale === 'fr' ? 'À votre façon' : 'Your way'}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      { key: 'simple' as const, title: 'Simple',
                        desc: locale === 'fr'
                          ? 'Des réglages conseillés pour votre style de pâte.'
                          : 'Recommended settings for your dough style.' },
                      { key: 'custom' as const, title: locale === 'fr' ? 'Personnalisé' : 'Custom',
                        desc: locale === 'fr'
                          ? 'Choisissez votre farine, levure ou levain, et votre préferment.'
                          : 'Choose your flour, yeast or sourdough starter, and preferment.' },
                    ]).map(m => (
                      <button
                        key={m.key}
                        onClick={() => chooseMode(m.key)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left',
                          border: '1px solid var(--border)', background: 'var(--warm)',
                          borderRadius: '12px', padding: '14px 16px', minHeight: '44px',
                          cursor: 'pointer', fontFamily: 'var(--font-ui)',
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--char)' }}>{m.title}</span>
                          {loadProfile()?.preferredMode === m.key && (
                            <span style={{
                              marginLeft: '8px', fontSize: '10px', letterSpacing: '.08em',
                              textTransform: 'uppercase', color: '#9C8248', fontWeight: 700,
                            }}>{locale === 'fr' ? 'votre habitude' : 'your usual'}</span>
                          )}
                          <span style={{ display: 'block', fontSize: '14px', color: 'var(--ash)', marginTop: '4px', lineHeight: 1.45 }}>
                            {m.desc}
                          </span>
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9C8248"
                          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                          style={{ marginTop: '3px', flexShrink: 0 }} aria-hidden="true">
                          <line x1="4" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sourdough-vs-Simple nudge — observation with a choice, not an alarm */}
              {sdNudgeOpen && (
                <div style={{
                  background: 'var(--cream)',
                  borderLeft: '4px solid var(--gold)',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  marginTop: '12px',
                  fontFamily: 'var(--font-ui)',
                }}>
                  <div style={{ fontSize: '14px', color: 'var(--ash)', lineHeight: 1.5, marginBottom: '8px' }}>
                    {locale === 'fr'
                      ? 'Pour utiliser votre levain, choisissez le mode personnalisé.'
                      : 'Choose Custom to use your sourdough starter.'}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => chooseMode('custom')}
                      style={{
                        border: 'none', borderRadius: '12px', background: 'var(--terra)',
                        color: '#fff', padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {locale === 'fr' ? 'Continuer en personnalisé →' : 'Continue in Custom →'}
                    </button>
                    <button
                      onClick={() => chooseMode('simple', true)}
                      style={{
                        border: '1.5px solid var(--border)', borderRadius: '12px', background: 'var(--warm)',
                        color: 'var(--ash)', padding: '8px 16px', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {locale === 'fr' ? 'Rester en Simple · levure classique' : 'Stay in Simple · regular yeast'}
                    </button>
                  </div>
                </div>
              )}


            </div>
          )}


        {/* ════════════ GUIDED ════════════ */}
        {tab === 'simple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>

            {/* ── Summary bar: one collapsed line while going forward, a
                   sheet of every step on demand. It lives inside the
                   modeChosen gate, so the opening mode page carries no bar —
                   nothing decided yet, nothing to navigate to, and a progress
                   bar at zero is a discouraging way to greet someone. ── */}
            {/* Back from the recipe lands here, not on whichever step
                was open when they left. "Back" after a recipe exists
                means "what did I choose", not "where was I typing". */}
            {/* Guarded on recipeGenerated, not just the flag. The overview
                answers "what did I choose" — a question that only exists
                after there is something to come back to. Any path that
                left the flag set (a reset, a fresh start after browsing
                the summary) heals itself here instead of dropping a
                first-time baker onto a review screen. */}
            {setupOverview && (
              <SetupReview
                stale={protocolStale}
                nameField={<label style={{display:'block',fontSize:16,fontWeight:600,marginBottom:16}}>{fr?'Nom de la préparation':'Bake name'}
                <input value={bakeName} placeholder={bakeType==='bread'?(fr?'Ma fournée de pain':'My bread bake'):(fr?'Ma soirée pizza':'My pizza night')} maxLength={100} onChange={e=>setBakeName(e.target.value)} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:12,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',fontWeight:400}} />
              </label>}
                flow={simpleFlow}
                reviewValues={{ 4: reviewKitchen, 7: reviewTiming }}
                modeChip={{ value: t('modeCards.simple.title'), onClick: () => { setSetupOverview(false); setModeChosen(false); } }}
                onJump={id => { setSetupOverview(false); simpleFlow.onJump(id); }}
                onBackToRecipe={() => { if (!recipeGenerated || protocolStale) { handleGenerate(); return; } setSetupOverview(false); setActiveTab('plan'); }}
              />
            )}
            <div ref={simpleSwipeRef} style={{ display: setupOverview ? 'none' : undefined }}>

            {/* ─── STEP 1: Style picker ────────────── */}
            <StepPage flow={simpleFlow} id={1}>
              {bakeType && (
                <StylePicker
                  bakeType={bakeType}
                  selected={styleKey}
                  onSelect={selectStyle}
                  disabledIds={bakeType === 'bread' ? ['pain_levain'] : ['sourdough']}
                  disabledNote={bakeType === 'bread'
                    ? (locale === 'fr'
                      ? 'Le Pain au Levain nécessite le mode personnalisé — essayez le Pain de Campagne pour un style similaire'
                      : 'Pain au Levain requires Custom mode — try Pain de Campagne for a similar style')
                    : (locale === 'fr'
                      ? 'La Pizza au levain nécessite le mode personnalisé'
                      : 'Sourdough Pizza requires Custom mode')}
                />
              )}
            </StepPage>

            {/* ─── STEP 3: Quantity ────────────────── */}
            <StepPage flow={simpleFlow} id={2}>
              <PrototypeQuantityPicker bakeType={bakeType ?? 'pizza'} locale={locale} units={units}
                itemLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'plaque':'tray') : (fr?'pièce':'piece')) : undefined}
                countLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Nombre de plaques':'Number of trays') : (fr?'Nombre de pièces':'Number of pieces')) : undefined}
                weightLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Pâte par plaque':'Dough per tray') : (fr?'Pâte par pièce':'Dough per piece')) : undefined}
                roundPizza={bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '')}
                count={numItems} itemWeight={itemWeight} diameter={pizzaDiameter}
                diameterBounds={{ min: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.[0][0] ?? 22, max: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.at(-1)?.[0] ?? 35 }}
                crust={(['thin','classic','generous'] as const)[pizzaCorn] ?? 'classic'}
                weightIsManual={crustActive < 0} weightBounds={weightBounds}
                calculatedWeight={pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn)}
                calculateWeight={(diameter, crust) => pizzaWeightFromTable(styleKey ?? 'neapolitan', diameter, ['thin','classic','generous'].indexOf(crust))}
                onCountChange={value => chooseNumItems(value)} onItemWeightChange={value => chooseItemWeight(value)}
                onDiameterChange={setPizzaDiameter} onCrustChange={crust => setPizzaCorn(['thin','classic','generous'].indexOf(crust))}
                onUseCalculatedWeight={() => chooseItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn))}
              />
            </StepPage>

            {/* ─── STEP 4: Equipment (oven + mixing) ── */}
            <StepPage flow={simpleFlow} id={3} nextOverride={!ovenType || !mixerType ? <button type="button" style={NEXT_CTA} onClick={()=>{setEquipmentPanel(!ovenType?'oven':'mixer');scrollToStepTop();}}>{!ovenType ? (fr?'Choisir le four':'Choose an oven') : (fr?'Choisir le pétrissage':'Choose mixing method')}</button> : undefined}>
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8,marginBottom:20}}>
                {(['oven','mixer'] as const).map(panel => <button key={panel} type="button" onClick={()=>setEquipmentPanel(panel)} aria-pressed={equipmentPanel===panel} style={{width:'100%',minWidth:0,textAlign:'left',padding:12,border:'1px solid '+(equipmentPanel===panel?'var(--terra)':'var(--border)'),borderRadius:12,background:equipmentPanel===panel?'#f0e5d3':'white',color:'var(--char)'}}>
                  <strong style={{display:'block',marginBottom:5}}>{panel==='oven'?(locale==='fr'?'Four':'Oven'):(locale==='fr'?'Pétrissage':'Mixing')}{(panel==='oven'?ovenType:mixerType)?' ✓':''}</strong>
                  <span style={{display:'block',fontSize:12,lineHeight:1.4}}>{panel==='oven'?(ovenType==='pizza_oven'?(ovenConstruction==='masonry'?(locale==='fr'?'Four maçonné':'Brick / masonry oven'):(locale==='fr'?'Four à pizza compact':'Tabletop pizza oven')):ovenType?localName(ovenData):(locale==='fr'?'Non choisi':'Not selected')):mixerType?localName(MIXER_TYPES[mixerType]):(locale==='fr'?'Non choisi':'Not selected')}</span>
                </button>)}
              </div>
              <h2 style={{fontSize:18,margin:'0 0 12px'}}>{equipmentPanel==='oven'?(locale==='fr'?'Choisissez votre mode de cuisson':'Choose your cooking equipment'):(locale==='fr'?'Choisissez une méthode de pétrissage':'Choose a mixing method')}</h2>
              {equipmentPanel==='oven' ? <OvenPicker bakeType={bakeType ?? 'pizza'} styleKey={styleKey} selected={ovenType} construction={ovenConstruction} onConstructionChange={setOvenConstruction} onSelect={setOvenType} /> : <>
                <MixerPicker totalDoughG={numItems * itemWeight} locale={locale} selected={mixerType} onSelect={value=>{setMixerType(value);setSpiralIceConfirmed(false);setWaterMethod('premelt');}} styleKey={styleKey ?? undefined} bakeType={bakeType ?? undefined} kitchenTemp={kitchenTemp} />
                {mixingBatchControl}
              </>}
            </StepPage>

            {/* ─── STEP 5: Climate ─────────────────── */}
            <StepPage flow={simpleFlow} id={4}>
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                units={units}
                flourInFridge={flourInFridge} onFlourInFridgeChange={setFlourInFridge}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              <details style={{marginTop:16}}>
                <summary style={{minHeight:44,fontSize:16,cursor:'pointer'}}>{locale==='fr'?'Préparation de l’eau · facultatif':'Water preparation · optional'}</summary>
                <label style={{display:'block',fontSize:16,margin:'12px 0 6px'}}>{locale==='fr'?'Origine de l’eau':'Water source'}
                  <select value={waterSource==='tap'?'measured':waterSource} onChange={e=>{setWaterSource(e.target.value as 'room'|'fridge'|'measured');setMeasuredWaterTemp(undefined);}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                    <option value="room">{locale==='fr'?'Eau à température ambiante':'Room-temperature water'}</option>
                    <option value="fridge">{locale==='fr'?'Eau du réfrigérateur':'Water from the fridge'}</option>
                    <option value="measured">{locale==='fr'?'Température mesurée':'Measured temperature'}</option>
                  </select>
                </label>
                {(waterSource==='measured'||waterSource==='tap')&&<label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Température de l’eau':'Water temperature'} ({tempUnit(units)})
                  <input type="number" min={cToDisplay(0,units)} max={cToDisplay(60,units)} step="0.1" value={measuredWaterTemp===undefined?'':cToDisplay(measuredWaterTemp,units)} onChange={e=>setMeasuredWaterTemp(e.target.value===''?undefined:inputTempToC(Number(e.target.value),units))} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:12,border:'1px solid var(--border)',borderRadius:9,marginTop:6}} />
                </label>}
                {mixerType==='spiral' ? <label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Si un refroidissement est nécessaire':'When cooling is needed'}
                  <select value={waterMethod==='direct'&&spiralIceConfirmed?'direct':'premelt'} onChange={e=>{setWaterMethod(e.target.value as 'direct'|'premelt');setSpiralIceConfirmed(e.target.value==='direct');}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                    <option value="direct">{locale==='fr'?'Glace pendant le pétrissage':'Ice during mixing'}</option>
                    <option value="premelt">{locale==='fr'?'Faire fondre la glace dans l’eau avant':'Melt ice in the water first'}</option>
                  </select>
                  <small style={{display:'block',fontSize:14,lineHeight:1.5,marginTop:8}}>{locale==='fr'?'Glace au pétrissage uniquement si votre modèle le permet.':'Use ice during mixing only if your mixer permits it.'}</small>
                </label> : <p style={{fontSize:14,color:'var(--smoke)'}}>{locale==='fr'?'Si nécessaire, la glace refroidit l’eau avant le pétrissage. Aucun glaçon dans le robot.':'If cooling is needed, melt the ice in the water before mixing. No solid ice goes into the mixer.'}</p>}
              </details>
            </StepPage>


            {/* ─── STEP 7: Yeast type ──────────────── */}
            <StepPage flow={simpleFlow} id={6}>
              <YeastHelper
                selected={yeastType}
                onSelect={chooseYeast}
                onClose={() => {}}
                disabledIds={['sourdough']}
                disabledNote={locale === 'fr' ? 'Le levain nécessite le mode personnalisé' : 'Sourdough requires Custom mode'}
                styleKey={styleKey}
              />
            </StepPage>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepPage flow={simpleFlow} id={7}>
              {!styleKey ? (
                <NeedsStyleFirst fr={locale === 'fr'} onChoose={() => simpleFlow.onJump(1)} />
              ) : (
              <SchedulePicker
                numItems={numItems}
                key={`${starterPlanResetKey}:${eatTime && !isNaN(eatTime.getTime()) ? eatTime.toISOString() : 'no-bake'}`}
                mode="simple"
                mixerType={mixerType ?? 'hand'}
                confirmedPlan={confirmedSchedulePlan}
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onPrefermentValidityChange={onPrefermentValidityChange}
                savedPrefOffsetHours={prefOffsetH}
                savedPrefGoesInFridge={prefGoesInFridge}
                onFeedTimeChange={setFeedTime}
                onStarterEventsChange={setStarterEvents}
                savedStarterEvents={starterEvents}
                onFeed2TimeChange={setFeed2Time}
                onFridgeOutTimeChange={setFridgeOutTime}
                onUsingPeak2Change={setUsingPeak2}
                onStarterFridgeInTimeChange={setStarterFridgeInTime}
                onStarterStateChange={setStarterState}
                starterLocation={starterLocation}
                planningMode={planningMode}
                lastFedTime={lastFedTime}
                knownPeakTime={knownPeakTime}
                onStarterLocationChange={setStarterLocation}
                onPlanningModeChange={setPlanningMode}
                onLastFedTimeChange={setLastFedTime}
                onKnownPeakTimeChange={setKnownPeakTime}
                hasNotFedYet={hasNotFedYet}
                onHasNotFedYetChange={setHasNotFedYet}
                lastFedAge={lastFedAge}
                onLastFedAgeChange={setLastFedAge}
                lastFeedRatio={lastFeedRatio}
                onLastFeedRatioChange={setLastFeedRatio}
                nextFeedRatio={nextFeedRatio}
                onNextFeedRatioChange={setNextFeedRatio}
                nextFeedRatioOverride={nextFeedRatioOverride}
                onNextFeedRatioOverrideChange={setNextFeedRatioOverride}
                ratioMode={ratioMode}
                onRatioModeChange={setRatioMode}
                onStarterPeakTimeChange={setStarterPeakTime}
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={handleScheduleChange}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={1.0}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
              )}
            </StepPage>

            {/* Generate now lives in the last page's nav bar (StepPage). */}
            </div>{/* end swipe container */}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F0EBE0',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#3D3530',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  <span>{t('generate.staleBanner')}</span>
                  <button
                    onClick={handleGenerate}
                    style={{
                      background: '#6B4423',
                      color: 'white',
                      fontSize: '12px',
                      padding: '12px 16px', minHeight: '44px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '4px',
                    }}
                  >
                    {t('generate.regenerate')}
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!recipeGenerated && (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '32px', color: '#8A7F78' }}>◆</div>
                  <div style={{ fontSize: '14px', color: '#8A7F78', textAlign: 'center', marginTop: '12px' }}>
                    {t('generate.emptyBakePlan')}
                  </div>
                </div>
              )}

              {/* Recipe + Timeline */}
              {recipeGenerated && (
                <div ref={resultsRef} style={{ marginTop: '16px' }}>
                  {(
                    <>
                      {/* Recipe null-guard */}
                      {!recipe ? (
                        <div style={{
                          background: '#FEF4EF', border: '1.5px solid #F5C4B0',
                          borderRadius: '16px', padding: '20px', textAlign: 'center',
                          color: 'var(--terra)', fontSize: '14px',
                        }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                          <RecipeOutput
                            containerCapacityLitres={containerCapacityLitres} onContainerCapacityChange={setContainerCapacityLitres}
                            styleKey={styleKey ?? undefined}
                            waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches}
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); setSetupOverview(true); }}
                            onOpenGuide={() => setActiveTab('guide')}
                            onShare={shareCurrentSession}
                            result={displayRecipe ?? recipe}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={styleDisplayName(styleKey)}
                            mixerType={mixerType!}
                            kitchenTemp={kitchenTemp}
                            fridgeTemp={fridgeTemp}
                            fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                            totalColdHours={schedule ? schedule.totalColdHours : 0}
                            mode={tab}
                            bakeType={bakeType ?? 'pizza'}
                            flourBlend={flourBlend}
                            units={units}
                            feedTime={feedTime}
                            feed2Time={feed2Time}
                            fridgeOutTime={fridgeOutTime}
                            starterPeakTime={starterPeakTime}
                            planningMode={planningMode}
                            usingPeak2={usingPeak2}
                            feedRatio={nextFeedRatio}
                            starterLocation={starterLocation}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>{locale === 'fr' ? 'Comment s’est passée la fournée ?' : 'How did it go?'}</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}></span>}
                      <input id="bake-photo-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { compressImage, uploadPhoto } = await import('../lib/photoUpload');
                          const blob = await compressImage(file);
                          setBakePhotoUrl(URL.createObjectURL(blob));
                          if (user) {
                            let evId = bakeEventId;
                            if (!evId) {
                              const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                              const payload = buildSessionPayload();
                              evId = await upsertBakeEvent({ session: payload as SessionData });
                              if (evId) setBakeEventId(evId);
                            }
                            if (evId) await uploadPhoto(file, user.id, evId, 0);
                          }
                        }}
                      />
                    </label>
                    {!bakedDone ? (
                      <button
                        onClick={async () => {
                          setBakedDone(true);
                          if (user && bakeEventId) {
                            const { markBaked } = await import('../lib/supabase/saveBakeEvent');
                            await markBaked(bakeEventId);
                          }
                        }}
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                      >
                        ✓ {locale === 'fr' ? 'Marquer comme cuite' : 'Mark as baked'}
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ {locale === 'fr' ? 'Cuisson terminée !' : 'Baked!'}</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>
                  <PlanNav
                    variant="cta"
                    onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); setSetupOverview(true); }}
                    onOpenGuide={() => setActiveTab('guide')}
                    onShare={shareCurrentSession}
                  />
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: activeTab === 'guide' ? 'block' : 'none' }}>
              {!recipeGenerated ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>{t('common.generateFirst')}</div>
                </div>
              ) : schedule && recipe && mixerType && (<>
                <BakeGuide
                  starterEvents={starterEvents}
                  ovenConstruction={ovenConstruction}
                  waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches} fridgeTemp={fridgeTemp}
                  schedule={schedule}
                  mixerType={mixerType}
                  styleKey={styleKey ?? 'neapolitan'}
                  kitchenTemp={kitchenTemp}
                  numItems={numItems}
                  prefermentType={prefermentType}
                  oil={recipe.oil}
                  hydration={recipe.hydration}
                  ovenType={ovenType ?? undefined}
                  prefStartTime={prefStartTime}
                  feedTime={planningMode === 'last_fed' ? lastFedTime : null}
                  feed2Time={feed2Time}
                  fridgeOutTime={fridgeOutTime}
                  starterState={starterState}
                  starterMature={starterMature}
                  starterHasRye={starterHasRye}
                  usingPeak2={usingPeak2}
                  planningMode={planningMode}
                  feedRatio={nextFeedRatio}
                  starterLocation={starterLocation}
                  units={units}
                  locale={locale}
                  onNavigateToFillings={sandwichEnabled ? () => { setActiveTab('sandwiches'); setNavHidden(false); } : undefined}
                  onNavigateToPizzaParty={pizzaPartyEnabled ? () => { setPizzaPartyTab(Object.values(pizzaPartyQtys).some(qty => qty > 0) ? 'prep' : 'pick'); setActiveTab('pizzaparty'); } : undefined}
                  recipe={recipe ?? null}
                  simpleMode={tab === 'simple'}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                </>

              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: activeTab === 'pizzaparty' ? 'block' : 'none' }}>
                <PizzaParty
                  locale={locale}
                  bakeTime={eatTime ?? new Date()}
                  numItems={numItems}
                  styleKey={styleKey ?? undefined}
                  t={t}
                  activeTab={pizzaPartyTab}
                  onTabChange={setPizzaPartyTab}
                  doughConfigured={recipeGenerated}
                  onHasSelection={setPizzasConfirmed}
                  bakeEventId={bakeEventId}
                  initialQtys={pizzaPartyQtys}
                  onQtysSnapshot={setPizzaPartyQtys}
                  getQtysRef={pizzaPartyGetQtysRef}
                  onGoToMyDough={() => { setActiveTab('setup'); setNavHidden(false); }}
                  ovenType={ovenType ?? undefined}
                  recipeIngredients={doughShoppingItems}
                  onEnsureBakeEvent={async () => {
                    if (bakeEventId) return bakeEventId;
                    if (!user) return null;
                    const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                    const payload = buildSessionPayload();
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved}
                  onBakedQtysChange={setBakedPartyQtys}
                  bakedQtys={bakedPartyQtys}
                  restoreToken={partyRestoreToken}
                  onShare={shareCurrentSession}
                />
              </div>
            )}

          </div>
        )}

        {/* ════════════ ADVANCED ════════════ */}
        {tab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>

            {/* ── Summary bar: one collapsed line while going forward, a
                   sheet of every step on demand. It lives inside the
                   modeChosen gate, so the opening mode page carries no bar —
                   nothing decided yet, nothing to navigate to, and a progress
                   bar at zero is a discouraging way to greet someone. ── */}
            {/* Back from the recipe lands here, not on whichever step
                was open when they left. "Back" after a recipe exists
                means "what did I choose", not "where was I typing". */}
            {/* Guarded on recipeGenerated, not just the flag. The overview
                answers "what did I choose" — a question that only exists
                after there is something to come back to. Any path that
                left the flag set (a reset, a fresh start after browsing
                the summary) heals itself here instead of dropping a
                first-time baker onto a review screen. */}
            {setupOverview && (
              <SetupReview
                stale={protocolStale}
                nameField={<label style={{display:'block',fontSize:16,fontWeight:600,marginBottom:16}}>{fr?'Nom de la préparation':'Bake name'}
                <input value={bakeName} placeholder={bakeType==='bread'?(fr?'Ma fournée de pain':'My bread bake'):(fr?'Ma soirée pizza':'My pizza night')} maxLength={100} onChange={e=>setBakeName(e.target.value)} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:12,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',fontWeight:400}} />
              </label>}
                flow={customFlow}
                reviewValues={{ 4: reviewKitchen, 8: prefermentChosen ? (prefermentType === 'none' ? t('preferment.direct') : `${localName(PREFERMENT_TYPES[prefermentType])} · ${prefermentFlourPct ?? 20}%`) : null, 9: reviewTiming }}
                modeChip={{ value: t('modeCards.custom.title'), onClick: () => { setSetupOverview(false); setModeChosen(false); } }}
                onJump={id => { setSetupOverview(false); customFlow.onJump(id); }}
                onBackToRecipe={() => { if (!recipeGenerated || protocolStale) { handleGenerate(); return; } setSetupOverview(false); setActiveTab('plan'); }}
              />
            )}
            <div ref={customSwipeRef} style={{ display: setupOverview ? 'none' : undefined }}>

            {/* ─── ADV STEP 1: Style picker ────────── */}
            <StepPage flow={customFlow} id={1}>
              {bakeType && (<>
                <StylePicker
                  bakeType={bakeType}
                  selected={styleKey}
                  onSelect={sk => {
                    setStyleKey(sk);
                    setManualOil(oilDefault(sk));
                    setManualSugar(sugarDefault(sk));
                    setManualHydration(undefined);
                    setNumItems(getBreadProtocol(sk)?.portions.count ?? STYLE_BALL_DEFAULTS[sk] ?? (bakeType === 'bread' ? 1 : 8));
                    if (STYLE_HAS_DIAMETER.includes(sk)) {
                      const defaultD = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
                      setPizzaDiameter(defaultD);
                      setPizzaCorn(1);
                      setItemWeight(pizzaWeightFromTable(sk, defaultD, 1));
                    } else {
                      setItemWeight(ALL_STYLES[sk].ballW);
                    }
                    // Keep the choice visible until Continue is pressed.
                  }}
                />

                {styleKey === 'pain_levain' && (
                  <div style={{
                    marginTop: '12px', padding: '12px 16px',
                    background: 'var(--warm)', border: '1.5px solid var(--border)',
                    borderRadius: '12px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <div
                        onClick={() => setAddSeeds(v => !v)}
                        style={{
                          width: '38px', height: '22px', borderRadius: '16px', flexShrink: 0,
                          background: addSeeds ? 'var(--sage)' : '#D8D0C5',
                          position: 'relative', transition: 'background .15s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: '2px', left: addSeeds ? '18px' : '2px',
                          width: '18px', height: '18px', borderRadius: '50%',
                          background: '#fff', transition: 'left .15s',
                          boxShadow: '0 1px 3px rgba(43,36,32,.2)',
                        }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
                        {locale === 'fr' ? 'Ajouter des graines' : 'Add seeds'}
                      </span>
                    </label>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', lineHeight: 1.5, color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
                      {locale === 'fr'
                        ? 'Une étape Trempage s’ajoute à votre protocole — les graines trempent à l’avance (2h minimum, idéalement la veille) pour ne pas voler l’eau de la pâte.'
                        : 'A Soaker step joins your protocole — the seeds soak ahead (2h minimum, ideally overnight) so they never steal water from the dough.'}
                    </p>
                  </div>
                )}
              </>)}
            </StepPage>

            {/* ─── ADV STEP 3: Quantity ────────────── */}
            <StepPage flow={customFlow} id={2}>
              <PrototypeQuantityPicker bakeType={bakeType ?? 'pizza'} locale={locale} units={units}
                itemLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'plaque':'tray') : (fr?'pièce':'piece')) : undefined}
                countLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Nombre de plaques':'Number of trays') : (fr?'Nombre de pièces':'Number of pieces')) : undefined}
                weightLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Pâte par plaque':'Dough per tray') : (fr?'Pâte par pièce':'Dough per piece')) : undefined}
                roundPizza={bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '')}
                count={numItems} itemWeight={itemWeight} diameter={pizzaDiameter}
                diameterBounds={{ min: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.[0][0] ?? 22, max: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.at(-1)?.[0] ?? 35 }}
                crust={(['thin','classic','generous'] as const)[pizzaCorn] ?? 'classic'}
                weightIsManual={crustActive < 0} weightBounds={weightBounds}
                calculatedWeight={pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn)}
                calculateWeight={(diameter, crust) => pizzaWeightFromTable(styleKey ?? 'neapolitan', diameter, ['thin','classic','generous'].indexOf(crust))}
                onCountChange={value => chooseNumItems(value)} onItemWeightChange={value => chooseItemWeight(value)}
                onDiameterChange={setPizzaDiameter} onCrustChange={crust => setPizzaCorn(['thin','classic','generous'].indexOf(crust))}
                onUseCalculatedWeight={() => chooseItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn))}
              />
            </StepPage>

            {/* ─── ADV STEP 4: Equipment (oven + mixing) ── */}
            <StepPage flow={customFlow} id={3} nextOverride={!ovenType || !mixerType ? <button type="button" style={NEXT_CTA} onClick={()=>{setEquipmentPanel(!ovenType?'oven':'mixer');scrollToStepTop();}}>{!ovenType ? (fr?'Choisir le four':'Choose an oven') : (fr?'Choisir le pétrissage':'Choose mixing method')}</button> : undefined}>
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8,marginBottom:20}}>
                {(['oven','mixer'] as const).map(panel => <button key={panel} type="button" onClick={()=>setEquipmentPanel(panel)} aria-pressed={equipmentPanel===panel} style={{width:'100%',minWidth:0,textAlign:'left',padding:12,border:'1px solid '+(equipmentPanel===panel?'var(--terra)':'var(--border)'),borderRadius:12,background:equipmentPanel===panel?'#f0e5d3':'white',color:'var(--char)'}}>
                  <strong style={{display:'block',marginBottom:5}}>{panel==='oven'?(locale==='fr'?'Four':'Oven'):(locale==='fr'?'Pétrissage':'Mixing')}{(panel==='oven'?ovenType:mixerType)?' ✓':''}</strong>
                  <span style={{display:'block',fontSize:12,lineHeight:1.4}}>{panel==='oven'?(ovenType==='pizza_oven'?(ovenConstruction==='masonry'?(locale==='fr'?'Four maçonné':'Brick / masonry oven'):(locale==='fr'?'Four à pizza compact':'Tabletop pizza oven')):ovenType?localName(ovenData):(locale==='fr'?'Non choisi':'Not selected')):mixerType?localName(MIXER_TYPES[mixerType]):(locale==='fr'?'Non choisi':'Not selected')}</span>
                </button>)}
              </div>
              <h2 style={{fontSize:18,margin:'0 0 12px'}}>{equipmentPanel==='oven'?(locale==='fr'?'Choisissez votre mode de cuisson':'Choose your cooking equipment'):(locale==='fr'?'Choisissez une méthode de pétrissage':'Choose a mixing method')}</h2>
              {equipmentPanel==='oven' ? <OvenPicker bakeType={bakeType ?? 'pizza'} styleKey={styleKey} selected={ovenType} construction={ovenConstruction} onConstructionChange={setOvenConstruction} onSelect={setOvenType} /> : <>
                <MixerPicker totalDoughG={numItems * itemWeight} locale={locale} selected={mixerType} onSelect={value=>{setMixerType(value);setSpiralIceConfirmed(false);setWaterMethod('premelt');}} styleKey={styleKey ?? undefined} bakeType={bakeType ?? undefined} kitchenTemp={kitchenTemp} />
                {mixingBatchControl}
              </>}
            </StepPage>

            {/* ─── ADV STEP 5: Climate ─────────────── */}
            <StepPage flow={customFlow} id={4}>
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                units={units}
                flourInFridge={flourInFridge} onFlourInFridgeChange={setFlourInFridge}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />
              <details style={{marginTop:16}}>
                <summary style={{minHeight:44,fontSize:16,cursor:'pointer'}}>{locale==='fr'?'Préparation de l’eau · facultatif':'Water preparation · optional'}</summary>
                <label style={{display:'block',fontSize:16,margin:'12px 0 6px'}}>{locale==='fr'?'Origine de l’eau':'Water source'}
                  <select value={waterSource==='tap'?'measured':waterSource} onChange={e=>{setWaterSource(e.target.value as 'room'|'fridge'|'measured');setMeasuredWaterTemp(undefined);}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                    <option value="room">{locale==='fr'?'Eau à température ambiante':'Room-temperature water'}</option>
                    <option value="fridge">{locale==='fr'?'Eau du réfrigérateur':'Water from the fridge'}</option>
                    <option value="measured">{locale==='fr'?'Température mesurée':'Measured temperature'}</option>
                  </select>
                </label>
                {(waterSource==='measured'||waterSource==='tap')&&<label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Température de l’eau':'Water temperature'} ({tempUnit(units)})
                  <input type="number" min={cToDisplay(0,units)} max={cToDisplay(60,units)} step="0.1" value={measuredWaterTemp===undefined?'':cToDisplay(measuredWaterTemp,units)} onChange={e=>setMeasuredWaterTemp(e.target.value===''?undefined:inputTempToC(Number(e.target.value),units))} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:12,border:'1px solid var(--border)',borderRadius:9,marginTop:6}} />
                </label>}
                {mixerType==='spiral' ? <label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Si un refroidissement est nécessaire':'When cooling is needed'}
                  <select value={waterMethod==='direct'&&spiralIceConfirmed?'direct':'premelt'} onChange={e=>{setWaterMethod(e.target.value as 'direct'|'premelt');setSpiralIceConfirmed(e.target.value==='direct');}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                    <option value="direct">{locale==='fr'?'Glace pendant le pétrissage':'Ice during mixing'}</option>
                    <option value="premelt">{locale==='fr'?'Faire fondre la glace dans l’eau avant':'Melt ice in the water first'}</option>
                  </select>
                  <small style={{display:'block',fontSize:14,lineHeight:1.5,marginTop:8}}>{locale==='fr'?'Glace au pétrissage uniquement si votre modèle le permet.':'Use ice during mixing only if your mixer permits it.'}</small>
                </label> : <p style={{fontSize:14,color:'var(--smoke)'}}>{locale==='fr'?'Si nécessaire, la glace refroidit l’eau avant le pétrissage. Aucun glaçon dans le robot.':'If cooling is needed, melt the ice in the water before mixing. No solid ice goes into the mixer.'}</p>}
              </details>
            </StepPage>


            {/* ─── ADV STEP 7: Flour ───────────────── */}
            <StepPage flow={customFlow} id={6} nextOverride={manualFlourEntry ? null : !flourChosen || archivedFlourNames.length ? <button type="button" disabled style={{...NEXT_CTA,opacity:0.55,cursor:'default'}}>{fr ? 'Continuer' : 'Continue'}</button> : undefined}>
              <FlourPicker
                onManualEntryChange={setManualFlourEntry}
                blend={flourBlend}
                onBlendChange={b => { setFlourChosen(true); setFlourBlend(b); }}
                bakeType={bakeType ?? 'pizza'}
                mode={tab === 'custom' ? 'custom' : 'simple'}
                styleKey={styleKey}
              />
              {/* The page's own Suivant carries this now — the flour step
                  kept a second Continue when the accordion was retired. */}
            </StepPage>

            {/* ─── ADV STEP 8: Yeast ───────────────── */}
            <StepPage flow={customFlow} id={7}>
              <YeastHelper
                selected={yeastType}
                onSelect={(yt) => {
                  chooseYeast(yt);
                  if (yt === 'sourdough') {
                    setPrefermentType('levain');
                  } else {
                    if (prefermentType === 'levain') setPrefermentType('none');
                    advanceAdv(7);
                  }
                }}
                onClose={() => {}}
                disabledIds={enrichedDirectOnly || !breadSupportsStarter ? ['sourdough'] : []}
                disabledNote={enrichedDirectOnly || !breadSupportsStarter ? (locale === 'fr' ? 'Cette recette est actuellement prévue avec de la levure et sans préferment.' : 'This recipe currently supports commercial yeast and no preferment.') : undefined}
                styleKey={styleKey}
              />
              {styleKey === 'pain_levain' && yeastType === 'sourdough' && advancedStep === 7 && (
                <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '8px', textAlign: 'center' }}>
                  {locale === 'fr' ? 'Levain confirmé automatiquement…' : 'Sourdough confirmed automatically…'}
                </div>
              )}
              {/* The levain confirm button is gone: the page's own Suivant
                  carries it, and advanceAdv skips the hidden preferment step. */}
            </StepPage>

            {/* ─── ADV STEP 9: Preferment (hidden for sourdough) ── */}
            {yeastType !== 'sourdough' && (
              <StepPage flow={customFlow} id={8}>
                <PrefermentPicker
                  selected={prefermentChosen ? prefermentType : null}
                  onSelect={choosePreferment}
                  flourPct={prefermentFlourPct}
                  suggestedFlourPct={20}
                  totalFlourGrams={advancedRecipe?.flour ?? (styleKey ? numItems * itemWeight / (1 + (ALL_STYLES[styleKey].hydration + ALL_STYLES[styleKey].salt + ALL_STYLES[styleKey].oil + ALL_STYLES[styleKey].sugar) / 100) : undefined)}
                  onFlourPctChange={setPrefermentFlourPct}
                  styleKey={styleKey ?? undefined}
                  hideTypes={breadProtocol ? (['none','poolish','biga','levain'] as PrefermentType[]).filter(pt=>pt==='levain'||!breadProtocol.supportedPreferments.includes(pt)) : ['levain']}
                  directOnly={enrichedDirectOnly}
                  kitchenTemp={kitchenTemp}
                />
              </StepPage>
            )}

            {/* ─── ADV STEP 10: Scheduler ──────────── */}
            <StepPage flow={customFlow} id={9}>
              {!styleKey ? (
                <NeedsStyleFirst fr={locale === 'fr'} onChoose={() => customFlow.onJump(1)} />
              ) : (
              <SchedulePicker
                numItems={numItems}
                key={`${starterPlanResetKey}:${eatTime && !isNaN(eatTime.getTime()) ? eatTime.toISOString() : 'no-bake'}`}
                mode="custom"
                mixerType={mixerType ?? 'hand'}
                confirmedPlan={confirmedSchedulePlan}
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onPrefermentValidityChange={onPrefermentValidityChange}
                savedPrefOffsetHours={prefOffsetH}
                savedPrefGoesInFridge={prefGoesInFridge}
                onFeedTimeChange={setFeedTime}
                onStarterEventsChange={setStarterEvents}
                savedStarterEvents={starterEvents}
                onFeed2TimeChange={setFeed2Time}
                onFridgeOutTimeChange={setFridgeOutTime}
                onUsingPeak2Change={setUsingPeak2}
                onStarterFridgeInTimeChange={setStarterFridgeInTime}
                onStarterStateChange={setStarterState}
                starterLocation={starterLocation}
                planningMode={planningMode}
                lastFedTime={lastFedTime}
                knownPeakTime={knownPeakTime}
                onStarterLocationChange={setStarterLocation}
                onPlanningModeChange={setPlanningMode}
                onLastFedTimeChange={setLastFedTime}
                onKnownPeakTimeChange={setKnownPeakTime}
                hasNotFedYet={hasNotFedYet}
                onHasNotFedYetChange={setHasNotFedYet}
                lastFedAge={lastFedAge}
                onLastFedAgeChange={setLastFedAge}
                lastFeedRatio={lastFeedRatio}
                onLastFeedRatioChange={setLastFeedRatio}
                nextFeedRatio={nextFeedRatio}
                onNextFeedRatioChange={setNextFeedRatio}
                nextFeedRatioOverride={nextFeedRatioOverride}
                onNextFeedRatioOverrideChange={setNextFeedRatioOverride}
                ratioMode={ratioMode}
                onRatioModeChange={setRatioMode}
                onStarterPeakTimeChange={setStarterPeakTime}
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={handleScheduleChange}
                onReady={() => {}}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={flourBlend ? (computeBlendProfile(flourBlend).fermToleranceMultiplier ?? 1.0) : 1.0}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
              )}
            </StepPage>

            {/* Prototype: one clear field per dough setting. */}
            <StepPage flow={customFlow} id={10}>
              <p style={{fontSize:14,color:'var(--ash)',marginBottom:18}}>{fr?'Les valeurs conseillées sont déjà renseignées. Modifiez uniquement ce qui vous convient.':'Recommended values are filled in. Adjust only what you need.'}</p>
              {enrichedDirectOnly && <p style={{fontSize:14}}>{fr?'Cette formule enrichie fixe les proportions d’eau, de sel, de matière grasse et de sucre.':'This enriched formula fixes the water, salt, fat and sugar proportions.'}</p>}
              {(() => {
                const style = styleKey ? ALL_STYLES[styleKey] : null;
                const zone = STYLE_HYDRATION_ZONES[styleKey!] ?? (breadProtocol ? {...FALLBACK_ZONE,classicMin:ALL_STYLES[styleKey!].hydration,classicMax:ALL_STYLES[styleKey!].hydration,name:ALL_STYLES[styleKey!].name} : FALLBACK_ZONE);
                const recommendation = styleKey && schedule && ovenType && yeastType ? calculateRecipe(styleKey, ovenType as OvenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom', mixerType as MixerType, undefined, manualOil, manualSugar, flourBlend, prefermentType, priorityOverride, prefermentFlourPct ?? 20, manualSalt, targetDoughTemp, flourInFridge, wastePct, prefGoesInFridge, feedToMixH, prefOffsetH || undefined, measuredFlourTemp, measuredPrefermentTemp) : null;
                const recommendedHyd = recommendation?.hydration ?? style?.hydration ?? 64;
                const defaultTemp = styleKey ? ({neapolitan:23,newyork:24,roman:25,pan:25,sourdough:24,brioche:22,pain_viennois:23,fougasse:25} as Record<string,number>)[styleKey] ?? 24 : 24;
                const fields = [
                  ...(!enrichedDirectOnly ? [
                    {label:fr?'Hydratation (%)':'Hydration (%)',value:manualHydration ?? recommendedHyd,min:zone.min,max:zone.max,step:0.5,set:setManualHydration},
                    {label:fr?'Sel (% de farine)':'Salt (% of flour)',value:manualSalt ?? style?.salt ?? 2.5,min:1.5,max:3.5,step:0.1,set:setManualSalt},
                    {label:fr?'Huile (% de farine)':'Oil (% of flour)',value:manualOil ?? style?.oil ?? 0,min:0,max:10,step:0.5,set:setManualOil},
                    {label:fr?'Sucre (% de farine)':'Sugar (% of flour)',value:manualSugar ?? style?.sugar ?? 0,min:0,max:10,step:0.5,set:setManualSugar},
                  ] : []),
                  {label:fr?'Température de pâte après pétrissage (°C)':'Dough temperature after mixing (°C)',value:targetDoughTemp ?? defaultTemp,min:18,max:28,step:1,set:setTargetDoughTemp},
                  {label:fr?'Marge de pâte supplémentaire (%)':'Extra dough allowance (%)',value:wastePct ?? 1.5,min:0,max:5,step:0.5,set:setWastePct},
                ];
                return <>

                  {fields.map(field=><div key={field.label}><label style={{display:'block',fontSize:16,marginBottom:18}}>{field.label}
                    <input type="number" key={`${field.label}:${field.value}`} defaultValue={Math.round(field.value*100)/100} min={field.min} max={field.max} step={field.step} onBlur={e=>{const n=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(n))field.set(Math.min(field.max,Math.max(field.min,n)));else e.target.value=String(field.value);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} style={{display:'block',width:'100%',minHeight:44,fontSize:16,padding:12,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white'}}/>
                  </label>
                  {field.set===setManualHydration&&<div style={{marginBottom:16,fontSize:14}}><p>{fr?'Hydratation conseillée':'Suggested hydration'} : {recommendedHyd}%</p>{manualHydration!==undefined&&<button type="button" onClick={()=>setManualHydration(undefined)} style={{minHeight:44}}>{fr?'Rétablir l’hydratation conseillée':'Reset suggested hydration'}</button>}<details><summary style={{minHeight:44,cursor:'pointer'}}>{fr?'Pourquoi cette valeur ?':'Why this value?'}</summary><p>{fr?'Base du style':'Style starting point'} : {style?.hydration}%</p><p>{fr?'Four':'Oven'} : {['pan','fougasse','brioche','pain_mie','pain_viennois'].includes(styleKey??'')?Math.round((ovenData?.hydrationDelta??0)/2):(ovenData?.hydrationDelta??0)}%</p><p>{fr?'Conditions de stockage et cuisine':'Storage and kitchen conditions'} : {kitchenTemp>=28||humidity==='very-humid'?-2:kitchenTemp<=18?2:0}%</p><p>{fr?'Farine':'Flour'} : {flourBlend?Math.max(-5,Math.min(8,computeBlendProfile(flourBlend).hydrationDelta)):0}%</p></details></div>}
                  </div>)}
                  <details style={{margin:'12px 0'}}><summary style={{minHeight:44,cursor:'pointer'}}>{fr?'Températures mesurées · facultatif':'Measured temperatures · optional'}</summary>
                    {[{label:fr?'Farine (°C)':'Flour (°C)',value:measuredFlourTemp,set:setMeasuredFlourTemp},...((prefermentType!=='none'||yeastType==='sourdough')?[{label:fr?'Préferment ou levain (°C)':'Preferment or starter (°C)',value:measuredPrefermentTemp,set:setMeasuredPrefermentTemp}]:[])].map(field=><label key={field.label} style={{display:'block',fontSize:16,margin:'12px 0'}}>{field.label}<input type="number" value={field.value??''} min={-5} max={45} step={0.5} placeholder={fr?'Estimation automatique':'Automatic estimate'} onChange={e=>field.set(e.target.value===''?undefined:Number(e.target.value))} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:10,border:'1px solid var(--border)',borderRadius:9}}/></label>)}
                  </details>
                  <details style={{margin:'12px 0'}}><summary style={{minHeight:44,cursor:'pointer'}}>{fr?'Aide pour ajuster':'Help with adjustments'}</summary>
                    {!enrichedDirectOnly&&<><p>{fr?'Hydratation de référence pour ce style':'Reference hydration for this style'} : {zone.classicMin===zone.classicMax ? zone.classicMin : `${zone.classicMin}–${zone.classicMax}`} %. {fr?'Choisissez le bas de la plage pour une pâte plus facile à manipuler.':'Choose the lower end for easier handling.'}</p><p>{oilGuidance(manualOil ?? style?.oil ?? 0,ovenType ?? '',styleKey ?? '',t)}</p><p>{sugarGuidance(manualSugar ?? style?.sugar ?? 0,ovenType ?? '',t).note}</p></>}
                    <p>{fr?'La marge compense la pâte restant dans le bol. 1,5 % convient généralement.':'The allowance covers dough left in the bowl. 1.5% is a practical starting point.'}</p>
                  </details>
                  <button type="button" style={{minHeight:44,padding:'10px 12px',border:'1px solid var(--border)',borderRadius:9}} onClick={()=>{setManualHydration(undefined);setManualSalt(undefined);setManualOil(undefined);setManualSugar(undefined);setTargetDoughTemp(undefined);setWastePct(undefined);}}>{fr?'Rétablir les valeurs conseillées':'Reset recommended values'}</button>
                </>;
              })()}
            </StepPage>

            {/* Precision section removed — merged into the dough step below */}

            {/* Generate now lives in the last page's nav bar (StepPage). */}
            </div>{/* end swipe container */}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F0EBE0',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: '#3D3530',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  <span>{t('generate.staleBanner')}</span>
                  <button
                    onClick={handleGenerate}
                    style={{
                      background: '#6B4423',
                      color: 'white',
                      fontSize: '12px',
                      padding: '12px 16px', minHeight: '44px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      marginLeft: '4px',
                    }}
                  >
                    {t('generate.regenerate')}
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!recipeGenerated && (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '32px', color: '#8A7F78' }}>◆</div>
                  <div style={{ fontSize: '14px', color: '#8A7F78', textAlign: 'center', marginTop: '12px' }}>
                    {t('generate.emptyBakePlan')}
                  </div>
                </div>
              )}

              {/* Recipe + Timeline */}
              {recipeGenerated && (
                <div style={{ marginTop: '16px' }}>
                  {(
                    <>
                      {!advancedRecipe ? (
                        <div style={{ background: '#FEF4EF', border: '1.5px solid #F5C4B0', borderRadius: '16px', padding: '20px', textAlign: 'center', color: 'var(--terra)', fontSize: '14px' }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                          <RecipeOutput
                            containerCapacityLitres={containerCapacityLitres} onContainerCapacityChange={setContainerCapacityLitres}
                            styleKey={styleKey ?? undefined}
                            waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches}
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); setSetupOverview(true); }}
                            onOpenGuide={() => setActiveTab('guide')}
                            onShare={shareCurrentSession}
                            result={advancedDisplayRecipe ?? advancedRecipe}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={styleDisplayName(styleKey)}
                            mixerType={mixerType!}
                            kitchenTemp={kitchenTemp}
                            fridgeTemp={fridgeTemp}
                            fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                            totalColdHours={schedule ? schedule.totalColdHours : 0}
                            mode={tab}
                            bakeType={bakeType ?? 'pizza'}
                            prefermentType={prefermentType}
                            priorityOverride={priorityOverride}
                            onPriorityOverride={v => setPriorityOverride(v)}
                            flourBlend={flourBlend}
                            units={units}
                            wastePct={wastePct}
                            feedTime={feedTime}
                            feed2Time={feed2Time}
                            fridgeOutTime={fridgeOutTime}
                            starterPeakTime={starterPeakTime}
                            planningMode={planningMode}
                            usingPeak2={usingPeak2}
                            feedRatio={nextFeedRatio}
                            starterLocation={starterLocation}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>{locale === 'fr' ? 'Comment s’est passée la fournée ?' : 'How did it go?'}</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}></span>}
                      <input id="bake-photo-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { compressImage, uploadPhoto } = await import('../lib/photoUpload');
                          const blob = await compressImage(file);
                          setBakePhotoUrl(URL.createObjectURL(blob));
                          if (user) {
                            let evId = bakeEventId;
                            if (!evId) {
                              const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                              const payload = buildSessionPayload();
                              evId = await upsertBakeEvent({ session: payload as SessionData });
                              if (evId) setBakeEventId(evId);
                            }
                            if (evId) await uploadPhoto(file, user.id, evId, 0);
                          }
                        }}
                      />
                    </label>
                    {!bakedDone ? (
                      <button
                        onClick={async () => {
                          setBakedDone(true);
                          if (user && bakeEventId) {
                            const { markBaked } = await import('../lib/supabase/saveBakeEvent');
                            await markBaked(bakeEventId);
                          }
                        }}
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                      >
                        ✓ {locale === 'fr' ? 'Marquer comme cuite' : 'Mark as baked'}
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ {locale === 'fr' ? 'Cuisson terminée !' : 'Baked!'}</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>
                  <PlanNav
                    variant="cta"
                    onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); setSetupOverview(true); }}
                    onOpenGuide={() => setActiveTab('guide')}
                    onShare={shareCurrentSession}
                  />
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: activeTab === 'guide' ? 'block' : 'none' }}>
              {!recipeGenerated ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>{t('common.generateFirst')}</div>
                </div>
              ) : schedule && advancedRecipe && mixerType && (<>
                <BakeGuide
                  starterEvents={starterEvents}
                  ovenConstruction={ovenConstruction}
                  waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches} fridgeTemp={fridgeTemp}
                  schedule={schedule}
                  mixerType={mixerType}
                  styleKey={styleKey ?? 'neapolitan'}
                  kitchenTemp={kitchenTemp}
                  numItems={numItems}
                  prefermentType={prefermentType}
                  oil={advancedRecipe.oil}
                  hydration={advancedRecipe.hydration}
                  ovenType={ovenType ?? undefined}
                  prefStartTime={prefStartTime}
                  feedTime={planningMode === 'last_fed' ? lastFedTime : null}
                  feed2Time={feed2Time}
                  fridgeOutTime={fridgeOutTime}
                  starterState={starterState}
                  starterMature={starterMature}
                  starterHasRye={starterHasRye}
                  usingPeak2={usingPeak2}
                  planningMode={planningMode}
                  feedRatio={nextFeedRatio}
                  starterLocation={starterLocation}
                  units={units}
                  locale={locale}
                  onNavigateToFillings={sandwichEnabled ? () => { setActiveTab('sandwiches'); setNavHidden(false); } : undefined}
                  onNavigateToPizzaParty={pizzaPartyEnabled ? () => { setPizzaPartyTab(Object.values(pizzaPartyQtys).some(qty => qty > 0) ? 'prep' : 'pick'); setActiveTab('pizzaparty'); } : undefined}
                  recipe={advancedRecipe ?? null}
                  simpleMode={false}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                </>

              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: activeTab === 'pizzaparty' ? 'block' : 'none' }}>
                <PizzaParty
                  locale={locale}
                  bakeTime={eatTime ?? new Date()}
                  numItems={numItems}
                  styleKey={styleKey ?? undefined}
                  t={t}
                  activeTab={pizzaPartyTab}
                  onTabChange={setPizzaPartyTab}
                  doughConfigured={recipeGenerated}
                  onHasSelection={setPizzasConfirmed}
                  bakeEventId={bakeEventId}
                  initialQtys={pizzaPartyQtys}
                  onQtysSnapshot={setPizzaPartyQtys}
                  getQtysRef={pizzaPartyGetQtysRef}
                  onGoToMyDough={() => { setActiveTab('setup'); setNavHidden(false); }}
                  ovenType={ovenType ?? undefined}
                  recipeIngredients={doughShoppingItems}
                  onEnsureBakeEvent={async () => {
                    if (bakeEventId) return bakeEventId;
                    if (!user) return null;
                    const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                    const payload = buildSessionPayload();
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved}
                  onBakedQtysChange={setBakedPartyQtys}
                  bakedQtys={bakedPartyQtys}
                  restoreToken={partyRestoreToken}
                  onShare={shareCurrentSession}
                />
              </div>
            )}

          </div>
        )}

      {sandwichEnabled && activeTab === 'sandwiches' && <div style={{paddingBottom:80}}>
        <SandwichParty isFr={locale === 'fr'} styleKey={styleKey} snapshot={sandwichParty}
          onChange={setSandwichParty} onRevealNavigation={()=>setNavHidden(false)} hideNavigation doughConfigured={recipeGenerated} breadIngredients={recipeGenerated ? sandwichDoughIngredients : []}
          onAdjustBread={()=>{setActiveTab('setup');setNavHidden(false);if(recipeGenerated){setSetupOverview(false);setReviewMode(true);if(tab==='custom')setAdvancedStep(2);else setActiveStep(2);}scrollToStepTop();}}
          availableDoughWeight={recipeGenerated ? ((tab === 'custom' ? advancedRecipe : recipe)?.totalDough ?? numItems * itemWeight) : undefined}
          numItems={numItems} />
      </div>}
      </div>



      <nav id="bh-bottom-nav" data-collapsed={bottomNavCollapsed || undefined} inert={bottomNavCollapsed} aria-hidden={bottomNavCollapsed || undefined} onFocusCapture={()=>setNavHidden(false)} aria-label={locale === 'fr' ? 'Votre fournée' : 'Current bake'} style={{display:(pizzaPartyEnabled||sandwichEnabled)?'flex':'none',position:'fixed',bottom:0,left:0,right:0,zIndex:110,background:'var(--cream)',borderTop:'1px solid var(--border)',padding:'6px max(12px, calc((100vw - 680px) / 2)) calc(6px + env(safe-area-inset-bottom, 0px))',gap:4}}>
        {([{key:'dough',label:fr?'Ma pâte':'My dough'}, {key:'companion',label:bakeType==='pizza'?'Pizzas':fr?'Garnitures':'Fillings'}] as const).map(item=>{
          const inDough = activeTab==='setup'||activeTab==='plan'||activeTab==='guide';
          const active = item.key==='dough' ? inDough : !inDough;
          return <button key={item.key} type="button" aria-current={active?'page':undefined}
            onClick={()=>{if(active)return;if(item.key==='dough')setSetupOverview(lastDoughOverview.current);setActiveTab(item.key==='dough'?(recipeGenerated?lastDoughTab.current:'setup'):bakeType==='pizza'?'pizzaparty':'sandwiches');setNavHidden(false);scrollToStepTop();}}
            style={{flex:1,minHeight:48,border:0,borderRadius:10,padding:'8px 4px',fontFamily:'var(--font-ui)',fontSize:14,fontWeight:active?700:400,background:active?'#F0E5D3':'transparent',color:'var(--char)',cursor:'pointer'}}>{item.label}</button>;
        })}
      </nav>
      
      {/* ── Sign-in nudge toast ── */}
      {/* Confirmation qui nomme la fournée. Le doute venait d'un message qui
          ne disait pas de quoi il parlait. */}
      {/* Le rejeu est visible pendant qu'il se produit, et son échec est dit.
          Sinon le baker revient connecté, ne voit rien, et réappuie. */}
      {cloudSaveState !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
          zIndex: 999, background: '#2B2420', color: 'var(--cream)',
          fontFamily: 'var(--font-ui)', fontSize: '14px',
          borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', lineHeight: 1.4,
        }}>
          {cloudSaveState === 'saving'
            ? (locale === 'fr' ? 'Enregistrement de votre fournée…' : 'Saving your bake…')
            : (locale === 'fr'
                ? 'L’enregistrement n’est pas passé. Votre fournée est sur cet appareil — réessayez avec Sauvegarder.'
                : 'That didn’t save. Your bake is on this device — try Save again.')}
        </div>
      )}

      {savedToCloudName && (
        <div
          onClick={() => setSavedToCloudName(null)}
          style={{
            position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
            zIndex: 999, background: '#2B2420', color: 'var(--cream)',
            fontFamily: 'var(--font-ui)', fontSize: '14px',
            borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            cursor: 'pointer', animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            <b style={{ fontWeight: 600 }}>{savedToCloudName}</b>
            {locale === 'fr' ? ' enregistrée sur votre compte' : ' saved to your account'}
          </span>
          <span style={{ color: 'var(--smoke)', fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>×</span>
        </div>
      )}

      {showSignInForSave && (
        <div
          onClick={() => setShowSignInForSave(false)}
          style={{
            position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
            zIndex: 999, background: '#2B2420', color: 'var(--cream)',
            fontFamily: 'var(--font-ui)', fontSize: '14px',
            borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            cursor: 'pointer', animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            {locale === 'fr'
              ? 'Connectez-vous pour sauvegarder vos sessions'
              : 'Sign in to save your sessions'}
          </span>
          <span style={{ color: 'var(--smoke)', fontSize: '15px',
            lineHeight: 1, flexShrink: 0 }}>×</span>
        </div>
      )}

      {/* ── Nav #4: sticky Update-plan pill — surfaces regeneration
           whenever the config is stale, so it's never below the fold ── */}
      {protocolStale && recipeGenerated && canGenerate && activeTab === 'setup' && (
        <button
          onClick={handleGenerate}
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: `${bottomNavH + 24}px`,
            zIndex: 9999,
            background: 'var(--terra)',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            padding: '12px 20px', minHeight: '44px',
            fontSize: '13px',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(107, 68, 35,0.35)',
            cursor: 'pointer',
            animation: 'fadeInUp 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {locale === 'fr' ? 'Mettre à jour le plan →' : 'Update plan →'}
        </button>
      )}

    </div>
  );
}
