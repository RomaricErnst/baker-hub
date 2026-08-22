'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import dynamic from 'next/dynamic';
const ProfileSheet = dynamic(() => import('../components/ProfileSheet'), { ssr: false });
import { loadProfile, setProfileListener } from '../lib/profile';
import { useBottomNavHeight } from '../hooks/useBottomNavHeight';
import { pushProfile, pullAndMergeProfile } from '../lib/supabase/profileSync';
import StylePicker from '../components/StylePicker';
import OvenPicker from '../components/OvenPicker';
import MixerPicker from '../components/MixerPicker';
const SchedulePicker = dynamic(() => import('../components/SchedulePicker'), { ssr: false });
import ClimatePicker from '../components/ClimatePicker';
const RecipeOutput = dynamic(() => import('../components/RecipeOutput'), { ssr: false });
import PlanNav from '../components/PlanNav';
const BakeGuide = dynamic(() => import('../components/BakeGuide'), { ssr: false });
import { getPrefPeakH_RT, getPrefRTWarmupH } from '../components/FermentChart';
import YeastHelper from '../components/YeastHelper';
const PizzaParty = dynamic(() => import('../components/PizzaParty'), { ssr: false });
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import type { SavedRecipe } from '../lib/supabase/fetchRecipes';
import { clearSession, loadSession, saveSession, type SessionData } from '../lib/session';
import { upsertBakeEvent } from '../lib/supabase/saveBakeEvent';
import { bakeEventTitle, type BakeEvent } from '../lib/supabase/fetchBakeEvents';
import { useSessionSave } from '../hooks/useSessionSave';
import { type UnitSystem } from '../utils/units';
import {
  ALL_STYLES, OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PREFERMENT_TYPES,
  PIZZA_STYLES, BREAD_STYLES,
  computeBlendProfile,
  type BakeType, type StyleKey, type OvenType, type BreadOvenType, type AnyOvenType, type MixerType, type YeastType, type FlourBlend, type PrefermentType,
} from '../data';
import {
  buildSchedule, calculateRecipe, formatTime,
  type AvailabilityBlock,
} from '../utils';
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

function pizzaWeightFromTable(sk: string, d: number, corn: number): number {
  const table = PIZZA_WEIGHT_TABLE[sk];
  if (!table) return 270;
  d = Math.max(table[0][0], Math.min(table[table.length - 1][0], d));
  for (let i = 0; i < table.length - 1; i++) {
    if (d >= table[i][0] && d <= table[i + 1][0]) {
      const r = (d - table[i][0]) / (table[i + 1][0] - table[i][0]);
      const w = table[i][corn + 1] + r * (table[i + 1][corn + 1] - table[i][corn + 1]);
      return Math.min(280, Math.max(200, Math.round(w / 5) * 5));
    }
  }
  return Math.round(table[table.length - 1][corn + 1] / 5) * 5;
}

function diameterFromWeight(w: number, sk: string, corn: number): number {
  const table = PIZZA_WEIGHT_TABLE[sk];
  if (!table) return STYLE_DEFAULT_DIAMETER[sk] ?? 30;
  let best = table[0][0], bestDiff = 999;
  for (let d = table[0][0]; d <= table[table.length - 1][0]; d++) {
    const diff = Math.abs(pizzaWeightFromTable(sk, d, corn) - w);
    if (diff < bestDiff) { bestDiff = diff; best = d; }
  }
  return best;
}

function getWeightBounds(sk: string | null, bt: string | null): { min: number; max: number; step: number } {
  if (bt !== 'bread' || !sk) return { min: 150, max: 500, step: 5 };
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
  prefilled?: boolean;   // value is a code default, not a baker's decision
  gap: string;           // sentence used by the missing-field CTA
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
function SummaryBar({ flow, topOffset = 62, raised = false, modeChip }:
  { flow: StepFlow; topOffset?: number; raised?: boolean;
    modeChip?: { value: string; onClick: () => void } }) {
  const [open, setOpen] = React.useState(false);
  const fr = flow.locale === 'fr';
  const answered = flow.steps.filter(s => stepAnswered(s, flow.highestStep, flow.steps));

  // The mode is a decision but not one of the numbered steps, so it leads the
  // summary and the sheet without counting toward the total.
  const all = [
    ...(modeChip ? [modeChip.value] : []),
    ...answered.map(s => s.value as string),
  ];
  // Ellipsis cuts from the right, which would keep the oldest decisions and
  // drop the ones just made. Show the three most recent, in order, and mark
  // that there are earlier ones — the sheet holds the full list anyway.
  const parts = all.length > 3 ? ['…', ...all.slice(-3)] : all;
  // Position, not tally. Counting answered steps made "2/10" appear on the
  // third page — true, but read as "you are on step 2", because a number at
  // the head of a line naming the current page is read as a position.
  //
  // Counting answers was the right call when Suivant skipped profile-answered
  // steps and the position jumped 1, 2, 4, 7. Nothing is skipped any more —
  // the profile prefills the page instead — so position is contiguous again
  // and the reason for the tally has gone. The bar fills by position too, so
  // the two can never disagree.
  const total = flow.steps.length + (modeChip ? 1 : 0);
  const count = flow.steps.findIndex(s => s.id === flow.activeId) + 1 + (modeChip ? 1 : 0);
  const pct = Math.round((count / Math.max(1, total)) * 100);

  return (
    <>
      <div style={{
        position: 'sticky', top: raised ? '0px' : `${topOffset}px`,
        transition: 'top 0.25s ease', zIndex: 25,
        background: 'var(--cream)', padding: '8px 0 10px',
        boxShadow: '0 6px 10px -10px rgba(26,22,18,0.45)',
      }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            border: '1px solid var(--border)', background: 'var(--warm)',
            borderRadius: '20px', padding: '9px 13px', minHeight: '44px',
            cursor: 'pointer', fontFamily: 'var(--font-ui)', textAlign: 'left',
          }}
        >
          {/* Answered out of total, not page position. The number sits beside
              a progress bar, so it has to count the same thing the bar fills
              — "1/6" next to a third-full bar was two different denominators
              in one control. */}
          <span style={{
            fontSize: '10px', letterSpacing: '.09em', color: '#9C8248',
            fontWeight: 700, flexShrink: 0,
          }}>{count}/{total}</span>
          {/* Running text, not chips: the row never scrolls sideways, so
              nothing is ever half-cut at the screen edge. */}
          <span style={{
            flex: 1, minWidth: 0, fontSize: '12.5px', color: 'var(--smoke)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{parts.length ? parts.join(' · ') : (fr ? 'Rien de choisi pour l\u2019instant' : 'Nothing chosen yet')}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A7F78"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }} aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div style={{ height: '2px', background: '#E2DACD', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#9C8248', transition: 'width .3s ease' }} />
        </div>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.45)', zIndex: 150,
          }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151,
            background: 'var(--warm)', borderRadius: '20px 20px 0 0',
            padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
            maxHeight: '74vh', overflowY: 'auto',
          }}>
            <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: '#E0D8CC', margin: '0 auto 10px' }} />
            <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, margin: '2px 0 12px' }}>
              {fr ? 'Où vous en êtes' : 'Where you are'}
            </h3>
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
            {flow.steps.map(st => {
              const ok = stepAnswered(st, flow.highestStep, flow.steps);
              return (
                <button key={st.id} onClick={() => { setOpen(false); flow.onJump(st.id); }} style={sheetRowStyle}>
                  <span style={sheetKeyStyle}>{st.chip}</span>
                  <span style={{
                    flex: 1, fontSize: '14.5px', textAlign: 'left',
                    fontWeight: ok ? 600 : 400,
                    color: ok ? 'var(--char)' : '#B0A69B',
                    fontStyle: ok ? 'normal' : 'italic',
                  }}>{ok ? st.value : (fr ? 'à choisir' : 'not chosen')}</span>
                  <SheetChevron />
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
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
const NEXT_CTA: React.CSSProperties = {
  border: 'none', borderRadius: '12px', padding: '15px 18px',
  background: '#6B4423', color: '#fff',
  fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700,
  cursor: 'pointer', boxShadow: '0 2px 9px rgba(107,68,35,0.22)',
  lineHeight: 1.2, width: '100%', minHeight: '44px',
};

// ── One step = one page ───────────────────────
function StepPage({ flow, id, children }: { flow: StepFlow; id: number; children: React.ReactNode }) {
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
  if (flow.gapReturn && !isLast) {
    next = <button onClick={flow.onGapReturn} style={nextStyle}>{fr ? 'Retour au plan →' : 'Back to plan →'}</button>;
  } else if (isLast) {
    if (gap) {
      next = <button onClick={() => flow.onGapJump(gap.id)} style={missingStyle}>{gap.gap} →</button>;
    } else if (flow.showGenerate) {
      next = <button onClick={flow.onGenerate} style={nextStyle}>{flow.generateLabel}</button>;
    } else if (flow.recipeGenerated) {
      next = <button onClick={flow.onSeePlan} style={nextStyle}>{fr ? 'Voir ma recette →' : 'See my recipe →'}</button>;
    }
  } else {
    // Label the step Suivant actually reaches, not the one that happens to sit
    // next in the list: with profile-answered steps skipped, "Suivant :
    // Équipement" was landing on Climat.
    const nx = flow.steps.find(x => x.id === flow.nextIdFor(id)) ?? flow.steps[idx + 1];
    next = <button onClick={() => flow.onNext(id)} style={nextStyle}>
      {fr ? 'Suivant : ' : 'Next: '}{nx.chip} →
    </button>;
  }

  // Both pages move together — only the incoming one animating reads as a
  // swap rather than a displacement, which is what loses the eye.
  return (
    <div id={`step-${id}`} key={id} className="bh-step-page" style={{ padding: '16px 2px 4px' }}>
      {/* No step counter here: the summary bar above carries it, and two
          "3 of 9" forty pixels apart is just noise. */}
      <h2 style={{
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: '29px',
        lineHeight: 1.12, letterSpacing: '-.015em', margin: '0 0 18px', color: 'var(--char)',
      }}>{step.title}</h2>

      {children}

      <div style={{
        display: 'grid', gridTemplateColumns: idx > 0 ? 'auto 1fr' : '1fr',
        gap: '12px', padding: '24px 0 32px',
      }}>
        {idx > 0 && (
          <button onClick={() => flow.onPrev(id)} style={{
            border: '1px solid var(--border)', background: 'transparent', borderRadius: '12px',
            padding: '16px 20px', fontFamily: 'var(--font-ui)', fontSize: '14px',
            color: 'var(--ash)', cursor: 'pointer',
          }}>{fr ? '← Précédent' : '← Back'}</button>
        )}
        {next}
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
  const [numItems, setNumItems] = useState(2);
  const [itemWeight, setItemWeight] = useState(270);
  const [pizzaDiameter, setPizzaDiameter] = useState(30);
  const [pizzaCorn, setPizzaCorn] = useState(1);
  const [avpnOpen, setAvpnOpen] = useState(false);

  // Step 3 — oven
  const [ovenType, setOvenType] = useState<AnyOvenType | null>(null);

  // Step 4 — mixer
  const [mixerType, setMixerType] = useState<MixerType | null>(null);

  // Step 5 — schedule + yeast
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [eatTime, setEatTime] = useState<Date | null>(null);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [yeastType, setYeastType] = useState<YeastType | null>(null);

  // Step 6 — climate
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
  const [prefermentFlourPct, setPrefermentFlourPct] = useState<number | undefined>(undefined);
  const [prefOffsetH, setPrefOffsetH] = useState<number>(0);
  // Driven by SchedulePicker algo result — single source of truth for fridge/RT decision
  const [prefGoesInFridgeState, setPrefGoesInFridgeState] = useState<boolean>(true);

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);
  const [manualSalt, setManualSalt]           = useState<number | undefined>(undefined);
  const [targetDoughTemp, setTargetDoughTemp] = useState<number | undefined>(undefined);
  const [flourInFridge, setFlourInFridge]     = useState<boolean>(false);
  const [wastePct, setWastePct]               = useState<number | undefined>(undefined);

  // Dial In tooltip visibility
  const [oilTip, setOilTip]               = useState(false);
  const [sugarTip, setSugarTip]           = useState(false);
  const [ddtTip, setDdtTip]               = useState(false);
  const [mixLossTip, setMixLossTip]       = useState(false);
  const [flourFridgeTip, setFlourFridgeTip] = useState(false);

  // BakeType card hover state
  const [hoveredBakeType, setHoveredBakeType] = useState<BakeType | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  // Set when the baker taps the "X isn't set" CTA on the last page, so the
  // page they land on can offer the way back instead of stranding them.
  const [gapReturnTo, setGapReturnTo] = useState<number | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [showSignInForSave, setShowSignInForSave] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [bakeEventId, setBakeEventId] = useState<string | null>(null);
  const [pizzaPartyQtys, setPizzaPartyQtys] = useState<Record<string, number>>({});
  // Pain au levain option: seeds with a soaker step (adds a Trempage step to the protocole)
  const [addSeeds, setAddSeeds] = useState(false);
  const [bakedPartyQtys, setBakedPartyQtys] = useState<Record<string, number>>({});
  useEffect(() => {
    if (isRestoringRef.current) return;
    setSessionSaved(false);
  }, [
    styleKey, ovenType, mixerType, yeastType,
    numItems, itemWeight, kitchenTemp, humidity,
    fridgeTemp, manualHydration, prefermentType,
    prefermentFlourPct, eatTime, pizzaPartyQtys, bakedPartyQtys,
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
  const [activeTab, setActiveTab] = useState<'setup' | 'plan' | 'guide' | 'pizzaparty'>('setup');
  const [pizzaPartyTab, setPizzaPartyTab] = useState<'pick' | 'shop' | 'prep' | 'bake'>('pick');
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  useEffect(() => {
    const el = document.documentElement;
    const onScroll = () => {
      const curr = el.scrollTop || document.body.scrollTop;
      if (curr > lastScrollY.current && curr > 40) {
        setNavHidden(true);
      } else if (curr < lastScrollY.current) {
        setNavHidden(false);
      }
      lastScrollY.current = curr;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const pizzaPartyEnabled = bakeType === 'pizza';
  const [pizzasConfirmed, setPizzasConfirmed] = useState(false);

  // M2 — Mode chosen: false on page load, true after baker selects a mode
  const [modeChosen, setModeChosen] = useState(false);

  // Mode cards — per-card "+ details" expander (visual-first redesign)
  const [modeInfoOpen, setModeInfoOpen] = useState(false);

  // Baker profile — Mon profil sheet + new-session prefill
  const bottomNavH = useBottomNavHeight();
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

  // Welcome back — hydrate full wizard state from localStorage on mount
  useEffect(() => {
    isRestoringRef.current = true;
    const session = loadSession();
    if (!session) {
      // Nothing local at mount — this is the one reliable "fresh device"
      // moment (autosave will write a default session right after).
      freshDeviceRef.current = true;
      isRestoringRef.current = false;
      return;
    }

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
    setStyleKey(session.styleKey as StyleKey | null);
    setNumItems(session.numItems);
    const wb = getWeightBounds(session.styleKey as string | null, session.bakeType as string | null);
    setItemWeight(Math.max(wb.min, Math.min(wb.max, session.itemWeight)));
    setPizzaDiameter(session.pizzaDiameter);
    setOvenType(session.ovenType as AnyOvenType | null);
    setMixerType(session.mixerType as MixerType | null);
    setYeastType(session.yeastType as YeastType | null);
    setKitchenTemp(session.kitchenTemp);
    setHumidity(session.humidity);
    setFridgeTemp(session.fridgeTemp);
    if (session.flourBlend) setFlourBlend(session.flourBlend as FlourBlend);
    setPrefermentType(session.prefermentType as PrefermentType);
    setPrefermentFlourPct(session.prefermentFlourPct);
    setPrefOffsetH(session.prefOffsetH);
    setManualHydration(session.manualHydration);
    setManualOil(session.manualOil);
    setManualSugar(session.manualSugar);
    setManualSalt(session.manualSalt);
    setTargetDoughTemp(session.targetDoughTemp);
    setFlourInFridge(session.flourInFridge);
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
    setRecipeGenerated(session.recipeGenerated);
    setModeChosen(session.modeChosen);

    if (session.recipeGenerated) {
      setActiveTab(session.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty');
      if (session.tab === 'custom') {
        setAdvancedStep(99);
      } else {
        setActiveStep(99);
      }
      setShowResults(true);
      setProtocolStale(false);
    } else {
      if (session.tab === 'custom') {
        setAdvancedStep(session.ovenType ? 3 : 2);
      } else {
        setActiveStep(session.ovenType ? 3 : 2);
      }
    }

    if (session.pizzaParty?.shopTicks) {
      try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(session.pizzaParty.shopTicks)); } catch {}
    }
    if (session.pizzaParty?.prepTicks) {
      try { localStorage.setItem('bh_prep_ticks_v1', JSON.stringify(session.pizzaParty.prepTicks)); } catch {}
    }
    if (session.pizzaParty?.qtys) {
      const rawQtys = session.pizzaParty.qtys;
      // Lazy — keeps the 150-pizza database out of the first-load bundle
      void import('../lib/toppingDatabase').then(({ getPizzaById }) => {
        const validQtys: Record<string, number> = {};
        Object.entries(rawQtys).forEach(([id, qty]) => {
          if (getPizzaById(id)) validQtys[id] = qty as number;
        });
        setPizzaPartyQtys(validQtys);
      });
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
    setActiveStep(99);
    setAdvancedStep(99);
    // Toast respawned on every reload/locale switch until acted on —
    // once dismissed/answered in this browser session, stay quiet.
    let wbDismissed = false;
    try { wbDismissed = sessionStorage.getItem('bh_wb_answered') === '1'; } catch {}
    setShowWelcomeBack(!wbDismissed);
    setTimeout(() => { isRestoringRef.current = false; }, 200);
  }, []);

  // Any user answer to the welcome-back toast (resume, start fresh, dismiss)
  // silences it for the rest of the browser session.
  function answerWelcomeBack() {
    try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
    setShowWelcomeBack(false);
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
    return buildSchedule(startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType, styleKey ?? 'neapolitan');
  }, [startTime, eatTime, blocks, kitchenTemp, preheatMin]);

  // Preferment start time for Timeline step 0 (poolish/biga only)
  const prefStartTime = useMemo(() => {
    if (!prefermentType || prefermentType === 'none' || prefermentType === 'levain') return null;
    if (prefOffsetH <= 0) return null;
    return new Date(startTime.getTime() - prefOffsetH * 3600000);
  }, [startTime, prefOffsetH, prefermentType]);

  // prefGoesInFridge is the algo's decision reported via onPrefGoesInFridgeChange.
  // Biga always fridge (scientifically correct — no RT biga).
  // Poolish: algo decides fridge or RT based on dual search result.
  // This single value flows to Timeline, RecipeOutput, and buildComputedRecipe.
  const prefGoesInFridge = !prefermentType || prefermentType === 'none' || prefermentType === 'levain'
    ? false
    : prefermentType === 'biga'
      ? true
      : prefGoesInFridgeState;

  const prefRemoveFromFridgeTime = useMemo(() => {
    if (!prefGoesInFridge || !eatTime) return null;
    const rtWarmupH = getPrefRTWarmupH(kitchenTemp);
    const mixHBF = schedule ? (eatTime.getTime() - schedule.bulkFermStart.getTime()) / 3600000 : 0;
    const removeHBF = mixHBF + rtWarmupH;
    return new Date(eatTime.getTime() - removeHBF * 3600000);
  }, [prefGoesInFridge, kitchenTemp, eatTime, schedule]);

  const feedToMixH = useMemo(() => {
    if (yeastType !== 'sourdough' || !feedTime || !startTime) return undefined;
    const h = (startTime.getTime() - feedTime.getTime()) / 3600000;
    return h > 0 ? h : undefined;
  }, [yeastType, feedTime, startTime]);

  const recipe = useMemo(() => {
    if (!styleKey || !schedule || !ovenType || !yeastType) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'simple',
        mixerType as MixerType,
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined,
        feedToMixH,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, feedToMixH]);

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
            : prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20
        ),
        manualSalt,
        targetDoughTemp,
        flourInFridge,
        wastePct,
        prefGoesInFridge,
        feedToMixH,
        prefermentType !== 'none' && prefermentType !== 'levain' && prefOffsetH > 0 ? prefOffsetH : undefined,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, manualSalt, targetDoughTemp, flourInFridge, wastePct, addSeeds, prefGoesInFridge, feedToMixH]);

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
      tab, bakeType, styleKey, numItems, itemWeight, pizzaDiameter,
      ovenType, mixerType, yeastType,
      kitchenTemp, humidity, fridgeTemp,
      flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
      manualHydration, manualOil, manualSugar, manualSalt,
      targetDoughTemp, flourInFridge, wastePct, addSeeds, priorityOverride,
      prefGoesInFridge,
      startTime: startTime?.getTime() ?? null,
      eatTime: eatTime?.getTime() ?? null,
      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
      recipeGenerated, activeTab, modeChosen,
      pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? {
        qtys: pizzaPartyQtys,
        // Bought / prepped ticks ride along in the snapshot — session-scoped
        // like the party itself, synced to bake_events on save.
        shopTicks: (() => { try { return JSON.parse(localStorage.getItem('bh_shop_ticks_v1') ?? '{}'); } catch { return {}; } })(),
        prepTicks: (() => { try { return JSON.parse(localStorage.getItem('bh_prep_ticks_v1') ?? '[]'); } catch { return []; } })(),
      } : null,
      bakedDone,
      computedRecipe: buildComputedRecipe(),
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
    setOvenType(null);
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
        setPrefermentType(prof.prefermentType as PrefermentType); applied = true; markProfile('preferment');
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
  async function shareCurrentSession() {
    let id = bakeEventId;
    if (!id && user) {
      const { saveNamedSession } = await import('../lib/supabase/saveBakeEvent');
      id = await saveNamedSession({
        tab, bakeType: bakeType ?? '', styleKey, numItems, itemWeight,
        pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
        fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
        manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
        flourInFridge, wastePct, addSeeds, priorityOverride,
        eatTime: eatTime?.getTime() ?? null,
        blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
        pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys, bakedQtys: Object.keys(bakedPartyQtys).length > 0 ? bakedPartyQtys : undefined } : null,
        bakedDone,
        computedRecipe: buildComputedRecipe(),
      } as SessionData);
      if (id) { setBakeEventId(id); setSessionSaved(true); }
    }
    if (id) { setShareSessionId(id); return; }
    // Anonymous and unsaved — invite sign-in (the drawer hosts it) instead
    // of a tap that silently does nothing.
    if (!user) window.dispatchEvent(new Event('bh-open-auth'));
  }

  function firstIncompleteStep(isCustom: boolean): number {
    if (!styleKey) return 1;
    // Oven and mixing share the equipment page (3) since A2.
    if (!ovenType || !mixerType) return 3;   // qty (2) + climate (4) have sane defaults
    if (isCustom) {
      if (!yeastType) return 7;       // flour (6) has a default blend
      return 9;                       // preferment (8) defaults to Direct — scheduler is the goal
    }
    if (!yeastType) return 6;
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
    setStyleKey(sk);
    setManualHydration(undefined);
    setManualOil(oilDefault(sk));
    setManualSugar(sugarDefault(sk));
    setNumItems(STYLE_BALL_DEFAULTS[sk] ?? (bakeType === 'bread' ? 1 : tab === 'custom' ? 8 : 4));
    if (STYLE_HAS_DIAMETER.includes(sk)) {
      const defaultD = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
      setPizzaDiameter(defaultD);
      setPizzaCorn(1);
      setItemWeight(pizzaWeightFromTable(sk, defaultD, 1));
    } else {
      setItemWeight(ALL_STYLES[sk].ballW);
    }
    // Custom keeps its accordion behaviour until phase A3; the simple flow is
    // page-based now, where a self-flipping page hides the choice just made.
    if (tab === 'custom') advanceAdv(1);
    else setHighestStep(prev => Math.max(prev, 1));
  }

  // Page mode: every navigation starts the new page at the top. The old
  // accordion scrolled to a step's anchor; there is no anchor to reach now.
  function scrollToStepTop() {
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 30);
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

  function advance(from: number) {
    const next = nextUnanswered(SIMPLE_STEPS, from, highestStep);
    setActiveStep(next);
    setHighestStep(p => Math.max(p, next));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  function advanceAdv(from: number) {
    const next = nextUnanswered(CUSTOM_STEPS, from, advancedHighestStep);
    setAdvancedStep(next);
    setAdvancedHighestStep(p => Math.max(p, next));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  function startOver() {
    // Fresh session = fresh chance for profile blockers to apply — without
    // this reset, only the first session per page load ever received them.
    profileBlockersAppliedRef.current = false;
    setBakeType(null); setStyleKey(null); setProfileFields(new Set());
    setNumItems(2); setItemWeight(270);
    setOvenType(null); setMixerType(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setEatTime(null);
    setBlocks([]); setYeastType(null);
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(6);
    setShowResults(false); setActiveStep(1); setHighestStep(1);
    setAdvancedStep(1); setAdvancedHighestStep(1); setFlourBlend({ flour1: bakeType === 'bread' ? 'bread' : 'pizza00', flour2: null, ratio1: 100 }); setPriorityOverride(undefined); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    setRecipeGenerated(false); setProtocolStale(false); setActiveTab('setup');
    setModeChosen(false);
    setTab('simple'); // full reset — keeping the previous mode made Custom look pre-selected to a fresh user
    setPizzaPartyTab('pick');
    setPizzasConfirmed(false);
    customOnlyStateRef.current = null;
    clearSession();
    // Clear persisted Pizza Party ticks + guide progress — they belong to the old bake
    try {
      localStorage.removeItem('bh_shop_ticks_v1');
      localStorage.removeItem('bh_prep_ticks_v1');
      localStorage.removeItem('bh_guide_done_v1');
    } catch {}
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
    setSessionSaved(false);
    if (recipeGenerated && user) {
      const msg = t('generate.confirmOverwrite');
      if (!window.confirm(msg)) return;
    }
    if (prefermentType !== 'none' && prefermentFlourPct === undefined) {
      const timeDefault = prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20;
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
    const isCustom = r.mode === 'custom';

    // Core setup
    setBakeType(r.bake_type as BakeType);
    setStyleKey(r.style_key as StyleKey);
    setNumItems(r.num_items);
    setItemWeight(r.item_weight);
    setOvenType(r.oven_type as AnyOvenType);
    setMixerType((r.mixer_type ?? 'hand') as MixerType);
    setYeastType((r.yeast_type ?? 'instant') as YeastType);
    setKitchenTemp(r.kitchen_temp);
    setHumidity(r.humidity ?? 'normal');
    setFridgeTemp(r.fridge_temp ?? 6);

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
  // rigidly to the next matching weekday/time, as a fresh unsaved session.
  async function restoreFromBakeEvent(event: BakeEvent, opts?: { rebake?: boolean }) {

    if (!event.dough_snapshot) return;
    isRestoringRef.current = true;
    setShowWelcomeBack(false);
    const snap = event.dough_snapshot;
    const rb = !!opts?.rebake;
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
    setStyleKey(snap.styleKey as StyleKey | null);
    setNumItems(snap.numItems);
    setItemWeight(snap.itemWeight);
    setPizzaDiameter(snap.pizzaDiameter);
    setOvenType(snap.ovenType as AnyOvenType | null);
    setMixerType(snap.mixerType as MixerType | null);
    setYeastType(snap.yeastType as YeastType | null);
    setKitchenTemp(snap.kitchenTemp);
    setHumidity(snap.humidity);
    setFridgeTemp(snap.fridgeTemp);
    if (snap.flourBlend) setFlourBlend(snap.flourBlend as FlourBlend);
    setPrefermentType(snap.prefermentType as PrefermentType);
    setPrefermentFlourPct(snap.prefermentFlourPct);
    setPrefOffsetH(snap.prefOffsetH);
    setManualHydration(snap.manualHydration);
    setManualOil(snap.manualOil);
    setManualSugar(snap.manualSugar);
    setManualSalt(snap.manualSalt);
    setTargetDoughTemp(snap.targetDoughTemp);
    setFlourInFridge(snap.flourInFridge);
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
    if (snap.recipeGenerated) {
      setAdvancedStep(snap.tab === 'custom' ? 99 : 1);
      setActiveStep(snap.tab === 'custom' ? 1 : 99);
      setShowResults(true);
      setProtocolStale(false);
      setSessionSaved(!rb);
      setSessionRestored(true);
      setReviewMode(true);
      // Nav #2 — land the baker back on the tab they left (Recipe/Guide),
      // not a review-mode Setup they must decode. Rebakes start on Setup.
      const savedTab = snap.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty';
      if (rb || !savedTab) setActiveTab('setup');
      else if (savedTab === 'pizzaparty' && snap.bakeType !== 'pizza') setActiveTab('plan');
      else setActiveTab(savedTab);
      setTimeout(() => { isRestoringRef.current = false; }, 200);
    }
    // Restore pizza selections from DB if available
    if (event.pizza_party_id) {
      const { fetchPizzaPartySlots } = await import('../lib/supabase/fetchBakeEvents');
      const slotsMap = await fetchPizzaPartySlots([event.id]);
      const slots = slotsMap[event.id] ?? [];
      if (slots.length > 0) {
        const qtys: Record<string, number> = {};
        for (const slot of slots) {
          qtys[slot.preset_id] = (qtys[slot.preset_id] ?? 0) + (slot.qty ?? 1);
        }
        setPizzaPartyQtys(qtys);
      }
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
  const simpleRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime);
  const customRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && flourBlend);
  const canGenerate = tab === 'simple' ? simpleRequiredDone : customRequiredDone;

  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  // Localized style name — data.ts carries nameFr but several surfaces used .name unconditionally
  const styleDisplayName = (sk: string | null | undefined): string => {
    if (!sk) return '';
    const st = (ALL_STYLES as Record<string, { name?: string; nameFr?: string }>)[sk];
    return (locale === 'fr' ? st?.nameFr : undefined) ?? st?.name ?? sk;
  };
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // ── Simple-mode step model (single source of truth) ──
  const localName = (o: unknown): string | null => {
    if (!o) return null;
    const r = o as { name?: string; nameFr?: string };
    return (locale === 'fr' ? r.nameFr : undefined) ?? r.name ?? null;
  };
  const fr = locale === 'fr';
  const SIMPLE_STEPS: StepDef[] = [
    { id: 1, chip: fr ? 'Style' : 'Style', title: t('steps.2.title'),
      value: styleKey ? styleDisplayName(styleKey) : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, chip: fr ? 'Quantité' : 'Quantity', title: t('steps.3.title'),
      value: `${numItems} × ${itemWeight} g`, prefilled: true,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, chip: fr ? 'Équipement' : 'Equipment', title: fr ? 'Votre matériel' : 'Your equipment',
      value: (ovenType && mixerType)
        ? `${localName(ovenData)} · ${localName(MIXER_TYPES[mixerType])}`
        : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    { id: 4, chip: fr ? 'Climat' : 'Climate', title: t('steps.5.title'),
      value: `${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`, prefilled: true,
      gap: fr ? 'Le climat n\u2019est pas renseigné' : 'Climate not set' },
    { id: 6, chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType ? localName(YEAST_TYPES[yeastType]) : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    { id: 7, chip: 'Plan', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? `${formatTime(startTime, locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}`
        : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
  ];
  const SIMPLE_LAST = SIMPLE_STEPS[SIMPLE_STEPS.length - 1].id;
  // ── Custom-mode step model ──
  // Preferment (8) is absent on the sourdough path, so this list is 10 or 9
  // entries long. Positions are indexes into it; ids never move.
  const flourSummary = (): string => {
    if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
      return flourBlend.brandProduct ?? computeBlendProfile(flourBlend).displayName;
    }
    const f1 = flourBlend.brandProduct ?? computeBlendProfile({ ...flourBlend, flour2: null, ratio1: 100 }).displayName;
    const f2raw = flourBlend.customFlour2Name ?? computeBlendProfile(flourBlend).displayName.split('+')[1]?.trim() ?? '';
    return `${flourBlend.ratio1}% ${f1} + ${f2raw.replace(/^\d+%\s*/, '')}`;
  };
  const CUSTOM_STEPS: StepDef[] = ([
    { id: 1, chip: fr ? 'Style' : 'Style', title: t('steps.2.title'),
      value: styleKey ? styleDisplayName(styleKey) : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, chip: fr ? 'Quantité' : 'Quantity', title: t('steps.3.title'),
      value: `${numItems} × ${itemWeight} g`, prefilled: true,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, chip: fr ? 'Équipement' : 'Equipment', title: fr ? 'Votre matériel' : 'Your equipment',
      value: (ovenType && mixerType)
        ? `${localName(ovenData)} · ${localName(MIXER_TYPES[mixerType])}`
        : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    { id: 4, chip: fr ? 'Climat' : 'Climate', title: t('steps.5.title'),
      value: `${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`, prefilled: true,
      gap: fr ? 'Le climat n\u2019est pas renseigné' : 'Climate not set' },
    { id: 6, chip: fr ? 'Farine' : 'Flour', title: t('steps.flour.title'),
      value: flourSummary(), prefilled: true,
      gap: fr ? 'La farine n\u2019est pas confirmée' : 'Flour not confirmed' },
    { id: 7, chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType ? localName(YEAST_TYPES[yeastType]) : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    ...(yeastType !== 'sourdough' ? [{
      id: 8, chip: fr ? 'Préferment' : 'Preferment', title: t('preferment.stepTitle'),
      value: prefermentType !== 'none' ? localName(PREFERMENT_TYPES[prefermentType]) : t('preferment.direct'),
      prefilled: true,
      gap: fr ? 'Le préferment n\u2019est pas confirmé' : 'Preferment not confirmed',
    } as StepDef] : []),
    { id: 9, chip: 'Plan', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? `${formatTime(startTime, locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}`
        : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
    { id: 10, chip: fr ? 'Pâte' : 'Dough', title: t('dialIn.title'),
      value: manualHydration !== undefined
        ? `${manualHydration}% ${t('dialIn.hydrationSuffix')}`
        : styleKey ? `${ALL_STYLES[styleKey].hydration}% ${t('dialIn.hydrationSuffix')}` : null,
      prefilled: true,
      gap: fr ? 'La pâte n\u2019est pas confirmée' : 'Dough not confirmed' },
  ] as StepDef[]);
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
    onGenerate: handleGenerate,
    showGenerate: canGenerate && !!eatTime && !(sessionRestored && recipeGenerated),
    generateLabel: t('generate.generateBtn'),
    onSeePlan: () => setActiveTab('plan'),
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    onGapReturn: () => { setGapReturnTo(null); setAdvancedStep(CUSTOM_LAST); scrollToStepTop(); },
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
    onGenerate: handleGenerate,
    showGenerate: canGenerate && !(sessionRestored && recipeGenerated),
    generateLabel: t('generate.generateBtn'),
    onSeePlan: () => setActiveTab('plan'),
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    onGapReturn: () => { setGapReturnTo(null); setActiveStep(SIMPLE_LAST); scrollToStepTop(); },
  };

  // The scheduler page is excluded: its chart diamonds are dragged sideways,
  // and a 60px drag there must move a feed time, never the page.
  const simpleSwipeRef = useStepSwipe(simpleFlow,
    tab === 'simple' && activeTab === 'setup' && simpleFlow.activeId !== SIMPLE_LAST);
  const customSwipeRef = useStepSwipe(customFlow,
    tab === 'custom' && activeTab === 'setup' && customFlow.activeId !== 9);




  // ── Render ────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Sticky header + journey bar (autohide on scroll down) ── */}
      <div style={{
        position: 'sticky',
        top: navHidden ? '-100px' : '0',
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
          hideActionBar={bakeTimeIsPast && sessionRestored}
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
              ? (numItems === 1 ? 'loaf' : 'loaves')
              : (numItems === 1 ? 'pizza' : 'pizzas');
            return `${styleName} · ${numItems} ${itemLabel} · ${dateStr}, ${timeStr}`;
          })()}
          sessionDoughSpec={tab === 'custom' && manualHydration !== undefined
            ? `${manualHydration}% · ${prefermentType !== 'none' ? prefermentType.charAt(0).toUpperCase() + prefermentType.slice(1) + ' · ' : ''}Custom`
            : ''}
          onSaveSession={async () => {
            const sessionPayload = buildSessionPayload();
            const currentQtys = pizzaPartyGetQtysRef.current?.() ?? pizzaPartyQtys;
            saveSession(sessionPayload);
            // Optimistic - local save just succeeded; cloud write continues
            // in the background and reverts the pill on failure.
            setSessionSaved(true);
            if (user) {
              try {
                const { saveNamedSession, savePizzaPartySelections, updateBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                let id = bakeEventId;
                if (!id) {
                  id = await saveNamedSession(sessionPayload as SessionData);
                  if (id) setBakeEventId(id);
                } else {
                  await updateBakeEvent(id, sessionPayload as SessionData);
                }
                if (id && Object.keys(currentQtys).length > 0 && styleKey) {
                  await savePizzaPartySelections(id, currentQtys, styleKey);
                }
                if (!id) setSessionSaved(false);
              } catch (e) {
                console.error('Cloud save failed:', e);
                setSessionSaved(false);
              }
            } else {
              setShowSignInForSave(true);
              setTimeout(() => setShowSignInForSave(false), 4000);
            }
          }}
          // Nothing to start over from on the landing page — the baker is
          // already at the start. It appears the moment they pick a bake type,
          // which is also the moment it becomes useful: it is how they switch
          // Pizza <-> Pain.
          onNewSession={bakeType ? startOver : undefined}
          onResumeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event); }}
          onRebakeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event, { rebake: true }); }}
          onOpenProfile={() => setProfileOpen(true)}
        />

        {profileOpen && (
          <ProfileSheet locale={locale} onClose={() => setProfileOpen(false)} />
        )}


        {bakeType && bakeType !== 'bread' && (
          <div style={{
            // Flo: no line under Ma Pâte. It was #2D2824 on a #2B2420 ground —
            // all but invisible, which is why it survived the first pass, but
            // it was still there.
            background: '#2B2420',
          }}>
            {/* ── Journey bar ── */}
            <div style={{ display: 'flex', gap: '8px', padding: '8px 12px 0' }}>
              <button
                onClick={() => { setActiveTab(recipeGenerated ? 'plan' : 'setup'); setNavHidden(false); }}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  textAlign: 'center',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontWeight: activeTab !== 'pizzaparty' ? 600 : 400,
                  color: activeTab !== 'pizzaparty' ? '#2B2420' : '#C4BBAE',
                  background: activeTab !== 'pizzaparty' ? '#F0EBE0' : '#1A1612',
                  border: activeTab !== 'pizzaparty' ? '1.5px solid transparent' : '1.5px solid #6D6054',
                  borderBottom: 'none',
                  borderRadius: '16px 16px 0 0',
                  marginTop: activeTab !== 'pizzaparty' ? 0 : '6px',
                  alignSelf: 'stretch',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  position: 'relative',
                }}
              >
                {/* Echoes Setup's own icon — the first step inside this tab */}
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <line x1="2" y1="5" x2="18" y2="5" stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="5" r="2" fill={activeTab !== 'pizzaparty' ? '#F0EBE0' : '#2B2420'} stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4"/>
                  <line x1="2" y1="10" x2="18" y2="10" stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="13" cy="10" r="2" fill={activeTab !== 'pizzaparty' ? '#F0EBE0' : '#2B2420'} stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4"/>
                  <line x1="2" y1="15" x2="18" y2="15" stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="9" cy="15" r="2" fill={activeTab !== 'pizzaparty' ? '#F0EBE0' : '#2B2420'} stroke={activeTab !== 'pizzaparty' ? '#6B4423' : '#B5AC9E'} strokeWidth="1.4"/>
                </svg>
                {t('tabs.myDough')}
                {activeTab === 'pizzaparty' && recipeGenerated && (
                  <span style={{
                    position: 'absolute', top: '3px', right: '8px',
                    width: '11px', height: '11px', borderRadius: '50%',
                    background: '#8BA888', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                      <path d="M1.5 3.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </button>

              {pizzaPartyEnabled && (() => {
                const totalPizzaCount = Object.values(pizzaPartyQtys).reduce((a, b) => a + b, 0);
                return (
                  <button
                    onClick={() => { setActiveTab('pizzaparty'); setNavHidden(false); }}
                    style={{
                      flex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      textAlign: 'center',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: activeTab === 'pizzaparty' ? 600 : 400,
                      color: activeTab === 'pizzaparty' ? '#2B2420' : '#C4BBAE',
                      background: activeTab === 'pizzaparty' ? '#F0EBE0' : '#1A1612',
                      border: activeTab === 'pizzaparty' ? '1.5px solid transparent' : '1.5px solid #6D6054',
                      borderBottom: 'none',
                      borderRadius: '16px 16px 0 0',
                      marginTop: activeTab === 'pizzaparty' ? 0 : '6px',
                      alignSelf: 'stretch',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                      position: 'relative',
                    }}
                  >
                    {/* Echoes Pick's own icon — the first step inside this tab */}
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2.5L3 17.5h14L10 2.5z" stroke={activeTab === 'pizzaparty' ? '#C88A52' : '#B5AC9E'} strokeWidth="1.4" strokeLinejoin="round"/>
                      <path d="M4.5 17Q10 13.5 15.5 17" stroke={activeTab === 'pizzaparty' ? '#C88A52' : '#B5AC9E'} strokeWidth="1.2" strokeLinecap="round"/>
                      <circle cx="10" cy="11" r="1" fill={activeTab === 'pizzaparty' ? '#C88A52' : '#B5AC9E'}/>
                      <circle cx="7.5" cy="14" r="0.8" fill={activeTab === 'pizzaparty' ? '#C88A52' : '#B5AC9E'}/>
                      <circle cx="12.5" cy="14" r="0.8" fill={activeTab === 'pizzaparty' ? '#C88A52' : '#B5AC9E'}/>
                    </svg>
                    {t('tabs.myPizzaParty')}
                    {activeTab !== 'pizzaparty' && totalPizzaCount > 0 && (
                      <span style={{
                        position: 'absolute', top: '3px', right: '8px',
                        background: '#C88A52', color: '#2B2420',
                        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
                        width: '15px', height: '15px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {totalPizzaCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: `clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.5rem) ${bakeType ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 'clamp(1rem, 3vw, 1.5rem)'}` }}>

        {/* ── Nav #6: welcome-back inline banner (was a fixed toast that
             covered tap targets above the bottom nav) ── */}
        {showWelcomeBack && activeTab === 'setup' && (
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
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--smoke)', textTransform: 'uppercase',
              letterSpacing: '.08em', flex: '1 1 auto',
            }}>
              {locale === 'fr' ? 'Session précédente chargée' : 'Previous session loaded'}
            </span>
            <button
              onClick={() => {
                // "Resume" used to only dismiss the banner: the session is
                // already restored on mount, so it promised an action that had
                // happened. It now takes the baker where they left off.
                answerWelcomeBack();
                if (recipeGenerated) setActiveTab('plan');
                else {
                  const target = firstIncompleteStep(tab === 'custom');
                  if (tab === 'custom') setAdvancedStep(target); else setActiveStep(target);
                  scrollToStepTop();
                }
              }}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                padding: '12px 16px', minHeight: '44px', borderRadius: '12px', whiteSpace: 'nowrap',
              }}
            >
              {recipeGenerated
                ? (locale === 'fr' ? 'Voir ma recette →' : 'See my recipe →')
                : (locale === 'fr' ? 'Reprendre →' : 'Resume →')}
            </button>
          </div>
        )}

        {/* Cloud « Reprendre » — same banner, but the session lives only in
            the account (fresh device); hydrates on tap via restoreFromBakeEvent */}
        {!showWelcomeBack && cloudResume && !modeChosen && !sessionRestored && activeTab === 'setup' && (
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
            {t('hero.headline')}{' '}
            <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>
              {t('hero.headlineEm')}
            </em>
          </h1>

          {/* Pizza / Bread picker — full cards before selection, compact toggle after */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', margin: '0 0 16px' }}>
            {([
              { type: 'pizza' as BakeType, image: '/pizzas/margherita.webp', label: t('bakeType.pizza.label'), desc: t('bakeType.pizza.desc'), activeBorder: 'var(--terra)', activeBg: '#FFF8F3' },
              { type: 'bread' as BakeType, image: '/pain_campagne.webp', label: t('bakeType.bread.label'), desc: t('bakeType.bread.desc'), activeBorder: 'var(--bread)', activeBg: 'var(--bread-l)' },
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
                {/* Full-bleed image — clamped: at 38vh the Bread card sat
                    fully below the fold on phones and could be missed */}
                <img
                  src={opt.image}
                  alt={opt.label}
                  style={{ width: '100%', height: 'clamp(180px, 30vh, 340px)', objectFit: 'cover', display: 'block' }}
                />
                {/* Gradient overlay with text */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '32px 20px 20px',
                  background: 'linear-gradient(to top, rgba(43, 36, 32,0.82) 0%, rgba(43, 36, 32,0.0) 100%)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '20px', color: 'white', marginBottom: '4px', fontFamily: 'var(--font-ui)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {opt.desc}
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

{!!bakeType && <div id="bh-top-stepper" style={{
        background: 'transparent',
        margin: '10px 0 4px',
      }}>
        {activeTab !== 'pizzaparty' ? (() => {
          const steps = [
            {
              key: 'setup' as const,
              label: t('tabs.setup'),
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <line x1="2" y1="5" x2="18" y2="5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="5" r="2" fill="#FDFBF7" stroke={color} strokeWidth="1.4"/>
                  <line x1="2" y1="10" x2="18" y2="10" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="13" cy="10" r="2" fill="#FDFBF7" stroke={color} strokeWidth="1.4"/>
                  <line x1="2" y1="15" x2="18" y2="15" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="9" cy="15" r="2" fill="#FDFBF7" stroke={color} strokeWidth="1.4"/>
                </svg>
              ),
              locked: false,
              done: recipeGenerated && activeTab !== 'setup',
            },
            {
              key: 'plan' as const,
              label: t('tabs.plan'),
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="2" width="12" height="16" rx="2" stroke={color} strokeWidth="1.4"/>
                  <line x1="7" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="7" y1="10" x2="13" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="7" y1="13" x2="11" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              ),
              locked: !recipeGenerated,
              done: recipeGenerated && activeTab !== 'plan' && activeTab !== 'setup',
            },
            {
              key: 'guide' as const,
              label: t('tabs.guide'),
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M10 17V7" stroke={color} strokeWidth="1.4"/>
                  <path d="M4 5.5c2-.7 4-.7 6 1 2-1.7 4-1.7 6-1v11c-2-.7-4-.7-6 1-2-1.7-4-1.7-6-1V5.5z"
                    stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              ),
              locked: !recipeGenerated,
              done: false,
            },
          ];
          const doneCount = steps.filter(s => s.done).length;
          const fillPct = (doneCount / (steps.length - 1)) * 100;
          return (
            <div style={{ position: 'relative', padding: '16px 24px 12px' }}>
              <div style={{ position: 'absolute', top: '34px', left: '44px', right: '44px', height: '2px', background: '#E0D8CC' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${fillPct}%`, background: '#8BA888', transition: 'width .2s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {steps.map(s => {
                  const isActive = activeTab === s.key;
                  const nodeBg = s.done ? '#8BA888' : isActive ? '#6B4423' : '#FDFBF7';
                  const nodeBorder = s.done ? '#8BA888' : isActive ? '#6B4423' : s.locked ? '#E0D8CC' : '#C9BEA9';
                  const iconColor = (s.done || isActive) ? '#fff' : s.locked ? '#C9BEA9' : '#8C8580';
                  const labelColor = s.done ? '#6B7A5A' : isActive ? '#6B4423' : s.locked ? '#B5AC9E' : '#8C8580';
                  return (
                    <button
                      key={s.key}
                      onClick={() => !s.locked && setActiveTab(s.key)}
                      style={{
                        background: 'none', border: 'none', cursor: s.locked ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '56px',
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        border: `2px solid ${nodeBorder}`, background: nodeBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      }}>
                        {/* A completed node behind the current one is not a
                            trophy, it is the way back — show the direction of
                            travel rather than a tick the baker cannot act on. */}
                        {s.done ? (
                          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <line x1="16" y1="10" x2="5" y2="10" stroke="white" strokeWidth="1.7" strokeLinecap="round"/>
                            <polyline points="9,5 4,10 9,15" stroke="white" strokeWidth="1.7"
                              strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        ) : s.icon(iconColor)}
                        {s.locked && (
                          <span style={{
                            position: 'absolute', bottom: '-2px', right: '-2px',
                            width: '13px', height: '13px', borderRadius: '50%',
                            background: '#B5AC9E', border: '1.5px solid #FDFBF7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <rect x="2" y="4.5" width="6" height="4.5" rx="1" stroke="#fff" strokeWidth="1.1"/>
                              <path d="M3.2 4.5V3a1.8 1.8 0 013.6 0v1.5" stroke="#fff" strokeWidth="1.1" fill="none"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', lineHeight: 1, color: labelColor, fontWeight: isActive ? 600 : 400, fontFamily: 'var(--font-ui)' }}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })() : (() => {
          // Shop/Prep/Bake all share ONE gate (pizzasConfirmed) — none of them
          // individually require the others to be visited or "done". A baker
          // who's picked their pizzas can jump straight to Bake without ever
          // opening Shop or Prep. Only lock what's actually not usable yet.
          const steps = [
            {
              key: 'pick' as const,
              label: t('tabs.pizzas'),
              locked: false,
              done: pizzasConfirmed && pizzaPartyTab !== 'pick',
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2.5L3 17.5h14L10 2.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M4.5 17Q10 13.5 15.5 17" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="10" cy="11" r="1" fill={color}/>
                  <circle cx="7.5" cy="14" r="0.8" fill={color}/>
                  <circle cx="12.5" cy="14" r="0.8" fill={color}/>
                </svg>
              ),
            },
            {
              key: 'shop' as const,
              label: t('tabs.shopping'),
              locked: !pizzasConfirmed,
              done: false,
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M4 7h12l-1 9H5L4 7z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M7 7V5.5a3 3 0 0 1 6 0V7" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="8" y1="11" x2="8" y2="13" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1="12" y1="11" x2="12" y2="13" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              key: 'prep' as const,
              label: t('tabs.prep'),
              locked: !pizzasConfirmed,
              done: false,
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <line x1="0" y1="16" x2="20" y2="16" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <path d="M2 10h6c0 3.5-1.3 6-3 6S2 13.5 2 10z"
                    stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="1.5" y1="10" x2="8.5" y2="10" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
                  <rect x="11" y="9" width="7" height="7" rx="1.2" stroke={color} strokeWidth="1.4"/>
                  <path d="M12 9V7.5h5V9" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1="11" y1="12" x2="18" y2="12" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              ),
            },
            {
              key: 'bake' as const,
              label: t('tabs.bake'),
              locked: !pizzasConfirmed,
              done: false,
              icon: (color: string) => (
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"
                  stroke={color} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8.5" y="2" width="3" height="4" rx=".5" fill={color} stroke="none"/>
                  <path d="M2 17V11a8 4.5 0 0116 0v6" strokeWidth="1.4"/>
                  <line x1="1.5" y1="17" x2="18.5" y2="17" strokeWidth="1.4"/>
                  <path d="M6 17v-4.5a4 2.5 0 018 0V17" fill={color} fillOpacity="0.18" stroke="none"/>
                </svg>
              ),
            },
          ];
          const doneCount = steps.filter(s => s.done).length;
          const fillPct = (doneCount / (steps.length - 1)) * 100;
          return (
            <div style={{ position: 'relative', padding: '16px 24px 12px' }}>
              <div style={{ position: 'absolute', top: '34px', left: '44px', right: '44px', height: '2px', background: '#E0D8CC' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${fillPct}%`, background: '#8BA888', transition: 'width .2s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                {steps.map(s => {
                  const isActive = pizzaPartyTab === s.key;
                  const nodeBg = s.done ? '#8BA888' : isActive ? '#C88A52' : '#FDFBF7';
                  const nodeBorder = s.done ? '#8BA888' : isActive ? '#C88A52' : s.locked ? '#E0D8CC' : '#C9BEA9';
                  const iconColor = (s.done || isActive) ? '#fff' : s.locked ? '#C9BEA9' : '#8C8580';
                  const labelColor = s.done ? '#6B7A5A' : isActive ? '#C88A52' : s.locked ? '#B5AC9E' : '#8C8580';
                  return (
                    <button
                      key={s.key}
                      onClick={() => !s.locked && setPizzaPartyTab(s.key)}
                      style={{
                        background: 'none', border: 'none', cursor: s.locked ? 'default' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '52px',
                      }}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        border: `2px solid ${nodeBorder}`, background: nodeBg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                      }}>
                        {s.done ? (
                          <svg width="9" height="9" viewBox="0 0 7 7" fill="none">
                            <path d="M1.5 3.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : s.icon(iconColor)}
                        {s.locked && (
                          <span style={{
                            position: 'absolute', bottom: '-2px', right: '-2px',
                            width: '13px', height: '13px', borderRadius: '50%',
                            background: '#B5AC9E', border: '1.5px solid #FDFBF7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <rect x="2" y="4.5" width="6" height="4.5" rx="1" stroke="#fff" strokeWidth="1.1"/>
                              <path d="M3.2 4.5V3a1.8 1.8 0 013.6 0v1.5" stroke="#fff" strokeWidth="1.1" fill="none"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', lineHeight: 1, color: labelColor, fontWeight: isActive ? 600 : 400, fontFamily: 'var(--font-ui)' }}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
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
              {!modeChosen && (
                <div style={{ padding: '4px 0 8px' }}>
                  {/* Mode is the first step of setup, so it says so. Without a
                      number here it read as a step zero sitting outside the
                      count, which is exactly what it is not. */}
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '.12em',
                    textTransform: 'uppercase', color: '#9C8248', fontWeight: 600,
                  }}>{locale === 'fr'
                    ? `Étape 1 sur ${(tab === 'custom' ? CUSTOM_STEPS.length : SIMPLE_STEPS.length) + 1}`
                    : `Step 1 of ${(tab === 'custom' ? CUSTOM_STEPS.length : SIMPLE_STEPS.length) + 1}`}</div>
                  <h2 style={{
                    fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800,
                    letterSpacing: '-.022em', lineHeight: 1.13, margin: '8px 0 16px',
                  }}>{locale === 'fr' ? 'Comment voulez-vous procéder ?' : 'How would you like to work?'}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      // Same frame both sides: who it is for, then what you get.
                      //
                      // No numeral: the card is drawn before the yeast is
                      // chosen and the sourdough path drops a step, so any
                      // figure here can become false.
                      //
                      // Simple names no technical term — preferment and
                      // hydration are the words a beginner picks Simple to
                      // avoid — and refers to nothing they have not met yet.
                      // "Your style" failed on that count: the style step comes
                      // after this page.
                      { key: 'simple' as const, title: t('modeCards.simple.title'),
                        lead: locale === 'fr' ? 'Pour commencer' : 'To get started',
                        desc: locale === 'fr'
                          ? 'votre pâte en quelques touches'
                          : 'your dough in a few taps' },
                      { key: 'custom' as const, title: t('modeCards.custom.title'),
                        lead: locale === 'fr' ? 'Pour aller plus loin' : 'To go further',
                        desc: locale === 'fr'
                          ? 'farine, préferment, hydratation'
                          : 'flour, preferment, hydration' },
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
                          <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--smoke)', marginTop: '3px', lineHeight: 1.45 }}>
                            {m.lead}{' · '}
                            <span style={{ color: 'var(--ash)', fontWeight: 700 }}>{m.desc}</span>
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
                      ? 'Votre profil est au levain — le levain vit en mode Avancé.'
                      : 'Your profile bakes sourdough — sourdough lives in Custom mode.'}
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
                      {locale === 'fr' ? 'Continuer en Avancé →' : 'Continue in Custom →'}
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

              {/* Gentle discovery — profile-less bakers learn preferences exist */}
              {!profilePrefilled && !recipeGenerated && !loadProfile() && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '11px',
                  color: 'var(--smoke)', letterSpacing: '.05em', margin: '10px 2px 0',
                }}>
                  {locale === 'fr'
                    ? 'Astuce : Mes préférences retient votre four et votre pétrin d\u2019une fournée à l\u2019autre'
                    : 'Tip: My preferences remembers your oven and mixer between bakes'}
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
            <SummaryBar flow={simpleFlow} raised={navHidden} topOffset={bakeType === 'pizza' ? 97 : 62}
              modeChip={{ value: t('modeCards.simple.title'), onClick: () => setModeChosen(false) }} />
            <div ref={simpleSwipeRef}>

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
                      ? 'Le Pain au Levain nécessite le mode Avancé — essayez le Pain de Campagne pour un style similaire'
                      : 'Pain au Levain requires Custom mode — try Pain de Campagne for a similar style')
                    : (locale === 'fr'
                      ? 'La Pizza au levain nécessite le mode Avancé'
                      : 'Sourdough Pizza requires Custom mode')}
                />
              )}
            </StepPage>

            {/* ─── STEP 3: Quantity ────────────────── */}
            <StepPage flow={simpleFlow} id={2}>
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = styleKey === 'neapolitan' && itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ── ROW 1: Quantity — centred, large, primary ── */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
                        {isBread ? t('quantity.loaves') : t('quantity.howMany')}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '52px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '32px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-ui)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ash)', fontFamily: 'var(--font-ui)' }}>{isBread ? (numItems === 1 ? 'loaf' : 'loaves') : (numItems === 1 ? 'pizza' : 'pizzas')}</span>
                        </div>
                        <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>

                    {/* ── ROW 2: Cornicione — compact, secondary ── */}
                    {showDiam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>{t('quantity.corniceLabel')}</span>
                        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                          {([
                            { value: 0, label: t('quantity.corniceThin')      },
                            { value: 1, label: t('quantity.corniceClassic')   },
                            { value: 2, label: t('quantity.corniceGenerous')  },
                          ] as { value: number; label: string }[]).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setPizzaCorn(opt.value); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, opt.value)); }}
                              style={{
                                flex: 1, padding: '4px 4px', borderRadius: '12px', whiteSpace: 'nowrap',
                                border: pizzaCorn === opt.value ? '2px solid #6B4423' : '1px solid #E8E0D5',
                                background: pizzaCorn === opt.value ? 'white' : 'transparent',
                                color: pizzaCorn === opt.value ? '#2B2420' : '#8A7F78',
                                fontSize: '12px', fontWeight: pizzaCorn === opt.value ? 600 : 400,
                                fontFamily: 'var(--font-ui)', cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* ── ROW 3: Diameter + Weight — two equal tiles ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: showDiam ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '20px' }}>

                      {/* Diameter tile — stepper replaces slider */}
                      {showDiam && (
                        <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 12px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', textAlign: 'center' }}>◎ {locale === 'fr' ? 'Diamètre' : 'Diameter'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { const d = Math.max(22, pizzaDiameter - 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-ui)', minWidth: '48px', textAlign: 'center' }}>{pizzaDiameter}<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--smoke)', marginLeft: '2px' }}>cm</span></span>
                            <button onClick={() => { const d = Math.min(35, pizzaDiameter + 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          </div>
                        </div>
                      )}

                      {/* Weight tile */}
                      <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 12px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', textAlign: 'center' }}>{isBread ? t('quantity.weightPerLoafLabel') : t('quantity.weightPerBallLabel')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => { const w = Math.max(weightBounds.min, itemWeight - weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: itemWeight >= 1000 ? '80px' : '64px', justifyContent: 'center' }}>
                            <input type="number" min={weightBounds.min} max={weightBounds.max} step={weightBounds.step} value={itemWeight}
                              onChange={e => { const w = Math.max(weightBounds.min, Math.min(weightBounds.max, Math.round(+e.target.value / weightBounds.step) * weightBounds.step)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: itemWeight >= 1000 ? '62px' : '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '17px', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-ui)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(weightBounds.max, itemWeight + weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    </div>
                    {/* AVPN note */}
                    {isAtMax && (
                      <div style={{ marginTop: '12px', padding: '8px 12px', background: '#FEF9F0', borderRadius: '8px', border: '0.5px solid #F0D9A0', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>{t('avpn.atLimit')}</strong> — {t('avpn.limitDesc')}</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem 8px', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>{t('avpn.learnMore')}</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--cream)', borderRadius: '16px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        {t('avpn.body')}
                      </div>
                    )}
                  </div>
                );
              })()}
            </StepPage>

            {/* ─── STEP 4: Equipment (oven + mixing) ── */}
            <StepPage flow={simpleFlow} id={3}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '.11em',
                textTransform: 'uppercase', color: 'var(--smoke)', margin: '0 0 10px',
              }}>{locale === 'fr' ? 'Four' : 'Oven'}</div>
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                styleKey={styleKey}
                selected={ovenType}
                onSelect={setOvenType}
                onPreselect={setOvenType}
              />
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '.11em',
                textTransform: 'uppercase', color: 'var(--smoke)', margin: '28px 0 10px',
              }}>{locale === 'fr' ? 'Pétrissage' : 'Mixing'}</div>
              <MixerPicker
                totalDoughG={numItems * itemWeight}
                locale={locale}
                selected={mixerType}
                onSelect={setMixerType}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
            </StepPage>

            {/* ─── STEP 5: Climate ─────────────────── */}
            <StepPage flow={simpleFlow} id={4}>
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

            </StepPage>


            {/* ─── STEP 7: Yeast type ──────────────── */}
            <StepPage flow={simpleFlow} id={6}>
              <YeastHelper
                selected={yeastType}
                onSelect={(yt) => setYeastType(yt)}
                onClose={() => {}}
                disabledIds={['sourdough']}
                disabledNote={locale === 'fr' ? 'Le levain nécessite le mode Avancé' : 'Sourdough requires Custom mode'}
                styleKey={styleKey}
              />
            </StepPage>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepPage flow={simpleFlow} id={7}>
              <SchedulePicker
                key={eatTime && !isNaN(eatTime.getTime()) ? eatTime.toISOString() : 'no-bake'}
                mode="simple"
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onFeedTimeChange={setFeedTime}
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
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={1.0}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
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
                  {bakeTimeIsPast && sessionRestored ? (
                    <PostBakeLanding
                      styleName={styleDisplayName(styleKey)}
                      eatTime={eatTime}
                      bakeEventId={bakeEventId}
                      onYes={() => {
                        if (bakeEventId) {
                          setSessionRestored(false);
                        } else {
                          startOver();
                        }
                      }}
                      onNo={() => {
                        startOver();
                      }}
                      locale={locale}
                    />
                  ) : (
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
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
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
              {!(bakeTimeIsPast && sessionRestored) && eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>How did it go?</p>
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
                              const payload = {
                                tab, bakeType, styleKey, numItems, itemWeight,
                                pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                                fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                                manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                                flourInFridge, wastePct, addSeeds, priorityOverride,
                                eatTime: eatTime?.getTime() ?? null,
                                blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                                recipeGenerated, activeTab, modeChosen,
                                pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys } : null,
                                bakedDone,
                              };
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
                        ✓ Mark as baked
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ Baked!</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>
                  <PlanNav
                    variant="cta"
                    onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
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
                  onNavigateToPizzaParty={pizzaPartyEnabled ? () => setActiveTab('pizzaparty') : undefined}
                  recipe={recipe ?? null}
                  simpleMode={tab === 'simple'}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                {/* Share + party — end of the journey. Quiet chips while
                    baking, gold celebration once marked baked. Anonymous
                    tap opens the sign-in drawer. */}
                {(
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {pizzaPartyEnabled && (
                      <button
                        onClick={() => setActiveTab('pizzaparty')}
                        style={{ ...NEXT_CTA, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {locale === 'fr' ? 'Planifier ma Pizza Party →' : 'Plan my Pizza Party →'}
                      </button>
                    )}
                    <button
                      onClick={shareCurrentSession}
                      style={bakedDone ? {
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 0', minHeight: '44px', border: 'none', borderRadius: '12px',
                        background: 'var(--gold)', color: 'var(--char)',
                        fontSize: '13px', fontWeight: 600,
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      } : {
                        alignSelf: 'flex-start',
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', border: '1.5px solid var(--border)',
                        borderRadius: '20px', background: 'var(--warm)',
                        color: 'var(--ash)', fontSize: '12px',
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={bakedDone ? 'var(--char)' : 'var(--terra)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
                        <line x1="8.7" y1="10.7" x2="15.3" y2="7.3" /><line x1="8.7" y1="13.3" x2="15.3" y2="16.7" />
                      </svg>
                      {t('planNav.share')}
                    </button>
                  </div>
                )}
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
                  doughConfigured={!!styleKey}
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
                    const payload = {
                      tab, bakeType, styleKey, numItems, itemWeight,
                      pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                      fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                      manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                      flourInFridge, wastePct, addSeeds, priorityOverride,
                      eatTime: eatTime?.getTime() ?? null,
                      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                      recipeGenerated, activeTab, modeChosen,
                      pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys } : null,
                      bakedDone,
                    };
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved}
                  onBakedQtysChange={setBakedPartyQtys}
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
            <SummaryBar flow={customFlow} raised={navHidden} topOffset={bakeType === 'pizza' ? 97 : 62}
              modeChip={{ value: t('modeCards.custom.title'), onClick: () => setModeChosen(false) }} />
            <div ref={customSwipeRef}>

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
                    setNumItems(STYLE_BALL_DEFAULTS[sk] ?? (bakeType === 'bread' ? 1 : 8));
                    if (STYLE_HAS_DIAMETER.includes(sk)) {
                      const defaultD = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
                      setPizzaDiameter(defaultD);
                      setPizzaCorn(1);
                      setItemWeight(pizzaWeightFromTable(sk, defaultD, 1));
                    } else {
                      setItemWeight(ALL_STYLES[sk].ballW);
                    }
                    setAdvancedHighestStep(s => Math.max(s, 2));
                    setAdvancedStep(2);
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
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = styleKey === 'neapolitan' && itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ROW 1: Quantity — centred, large, primary */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
                        {isBread ? t('quantity.loaves') : t('quantity.howMany')}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '52px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '32px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-ui)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ash)', fontFamily: 'var(--font-ui)' }}>{isBread ? (numItems === 1 ? 'loaf' : 'loaves') : (numItems === 1 ? 'pizza' : 'pizzas')}</span>
                        </div>
                        <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>

                    {/* ROW 2: Cornicione */}
                    {showDiam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', flexShrink: 0 }}>{t('quantity.corniceLabel')}</span>
                        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                          {([
                            { value: 0, label: t('quantity.corniceThin')      },
                            { value: 1, label: t('quantity.corniceClassic')   },
                            { value: 2, label: t('quantity.corniceGenerous')  },
                          ] as { value: number; label: string }[]).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => { setPizzaCorn(opt.value); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, opt.value)); }}
                              style={{
                                flex: 1, padding: '4px 4px', borderRadius: '12px', whiteSpace: 'nowrap',
                                border: pizzaCorn === opt.value ? '2px solid #6B4423' : '1px solid #E8E0D5',
                                background: pizzaCorn === opt.value ? 'white' : 'transparent',
                                color: pizzaCorn === opt.value ? '#2B2420' : '#8A7F78',
                                fontSize: '12px', fontWeight: pizzaCorn === opt.value ? 600 : 400,
                                fontFamily: 'var(--font-ui)', cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* ROW 3: Diameter + Weight tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: showDiam ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '20px' }}>

                      {showDiam && (
                        <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 12px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', textAlign: 'center' }}>◎ {locale === 'fr' ? 'Diamètre' : 'Diameter'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { const d = Math.max(22, pizzaDiameter - 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-ui)', minWidth: '48px', textAlign: 'center' }}>{pizzaDiameter}<span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--smoke)', marginLeft: '2px' }}>cm</span></span>
                            <button onClick={() => { const d = Math.min(35, pizzaDiameter + 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          </div>
                        </div>
                      )}

                      <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '12px 12px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '12px', textAlign: 'center' }}>{isBread ? t('quantity.weightPerLoafLabel') : t('quantity.weightPerBallLabel')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => { const w = Math.max(weightBounds.min, itemWeight - weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: itemWeight >= 1000 ? '80px' : '64px', justifyContent: 'center' }}>
                            <input type="number" min={weightBounds.min} max={weightBounds.max} step={weightBounds.step} value={itemWeight}
                              onChange={e => { const w = Math.max(weightBounds.min, Math.min(weightBounds.max, Math.round(+e.target.value / weightBounds.step) * weightBounds.step)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: itemWeight >= 1000 ? '62px' : '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '17px', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-ui)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(weightBounds.max, itemWeight + weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    </div>

                    {/* AVPN note */}
                    {isAtMax && (
                      <div style={{ marginTop: '12px', padding: '8px 12px', background: '#FEF9F0', borderRadius: '8px', border: '0.5px solid #F0D9A0', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>{t('avpn.atLimit')}</strong> — {t('avpn.limitDesc')}</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem 8px', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>{t('avpn.learnMore')}</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--cream)', borderRadius: '16px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        {t('avpn.body')}
                      </div>
                    )}
                  </div>
                );
              })()}
            </StepPage>

            {/* ─── ADV STEP 4: Equipment (oven + mixing) ── */}
            <StepPage flow={customFlow} id={3}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '.11em',
                textTransform: 'uppercase', color: 'var(--smoke)', margin: '0 0 10px',
              }}>{locale === 'fr' ? 'Four' : 'Oven'}</div>
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                styleKey={styleKey}
                selected={ovenType}
                onSelect={setOvenType}
                onPreselect={setOvenType}
              />
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '.11em',
                textTransform: 'uppercase', color: 'var(--smoke)', margin: '28px 0 10px',
              }}>{locale === 'fr' ? 'Pétrissage' : 'Mixing'}</div>
              <MixerPicker
                totalDoughG={numItems * itemWeight}
                locale={locale}
                selected={mixerType}
                onSelect={setMixerType}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
            </StepPage>

            {/* ─── ADV STEP 5: Climate ─────────────── */}
            <StepPage flow={customFlow} id={4}>
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />
            </StepPage>


            {/* ─── ADV STEP 7: Flour ───────────────── */}
            <StepPage flow={customFlow} id={6}>
              <FlourPicker
                blend={flourBlend}
                onBlendChange={b => setFlourBlend(b)}
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
                  setYeastType(yt);
                  if (yt === 'sourdough') {
                    setPrefermentType('levain');
                  } else {
                    if (prefermentType === 'levain') setPrefermentType('none');
                    advanceAdv(7);
                  }
                }}
                onClose={() => {}}
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
                  selected={prefermentType}
                  onSelect={setPrefermentType}
                  flourPct={prefermentFlourPct}
                  onFlourPctChange={setPrefermentFlourPct}
                  styleKey={styleKey ?? undefined}
                  hideTypes={['levain']}
                  kitchenTemp={kitchenTemp}
                />
              </StepPage>
            )}

            {/* ─── ADV STEP 10: Scheduler ──────────── */}
            <StepPage flow={customFlow} id={9}>
              <SchedulePicker
                key={eatTime && !isNaN(eatTime.getTime()) ? eatTime.toISOString() : 'no-bake'}
                mode="custom"
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onFeedTimeChange={setFeedTime}
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
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onReady={() => {}}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={flourBlend ? (computeBlendProfile(flourBlend).fermToleranceMultiplier ?? 1.0) : 1.0}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
            </StepPage>

            {/* ─── ADV STEP 11: Dial your dough ────── */}
            <StepPage flow={customFlow} id={10}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginBottom: '16px', lineHeight: 1.5 }}>
                  {locale === 'fr' ? 'Les valeurs par défaut correspondent à votre style — ajustez si vous savez ce que vous faites.' : <>Defaults are set for your style — adjust if you know what you&apos;re doing.</>}
                </div>

                {/* Preferment flour % slider */}
                {prefermentType !== 'none' && prefermentType !== 'levain' && (() => {
                  const pData = PREFERMENT_TYPES[prefermentType] as {
                    name: string; flourPct?: number; flourPctMin?: number; flourPctMax?: number; flourPctStep?: number; hydration?: number;
                  };
                  const minPct = pData.flourPctMin ?? 10;
                  const maxPct = pData.flourPctMax ?? 80;
                  const step = pData.flourPctStep ?? 5;
                  // Time-sensitive default: 3-4h→45%, 5-7h→40%, 8-12h→30%, 13h+→20%
                  const timeDefault = prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20;
                  const currentPct = prefermentFlourPct ?? timeDefault;
                  const prefHydration = pData.hydration ?? 100;
                  const prefWaterPct = currentPct * (prefHydration / 100);
                  return (
                    <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                          Flour in {pData.name}
                        </label>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--char)' }}>
                          {currentPct}%
                        </span>
                      </div>
                      {/* Integrated colour bar slider — same pattern as Hydration */}
                      <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px',
                          background: 'linear-gradient(to right, #A8B8D0 0%, #A8B8D0 20%, #8BA888 20%, #8BA888 55%, #9C8248 55%, #9C8248 100%)',
                        }} />
                        <input
                          type="range"
                          min={10} max={60} step={5}
                          value={currentPct}
                          onChange={e => setPrefermentFlourPct(Number(e.target.value))}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', appearance: 'none', background: 'transparent', cursor: 'pointer', height: '36px', margin: 0, accentColor: 'var(--terra)' }}
                        />
                      </div>
                      <div style={{ position: 'relative', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '.15rem', marginBottom: '8px', height: '1rem' }}>
                        <span style={{ position: 'absolute', left: 0 }}>{t('prefermentSlider.longAhead')}</span>
                        <span style={{ position: 'absolute', left: '37.5%', transform: 'translateX(-50%)', color: 'var(--sage)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('prefermentSlider.nightBefore')}</span>
                        <span style={{ position: 'absolute', right: 0 }}>{t('prefermentSlider.sameDay')}</span>
                      </div>
                      {prefOffsetH > 0 && currentPct !== timeDefault && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '.1rem' }}>
                          <div style={{ fontSize: '12px', color: 'var(--gold)', fontStyle: 'italic' }}>
                            For your {Math.round(prefOffsetH)}h window, {timeDefault}% of total flour is typical.
                          </div>
                          <button
                            onClick={() => setPrefermentFlourPct(undefined)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '11px', color: 'var(--smoke)',
                              fontFamily: 'var(--font-ui)',
                              textDecoration: 'underline', textUnderlineOffset: '2px',
                              padding: 0, flexShrink: 0,
                            }}
                          >
                            Reset to recommendation
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Hydration slider */}
                {(() => {
                  const zone = STYLE_HYDRATION_ZONES[styleKey!] ?? FALLBACK_ZONE;
                  const sliderMin = zone.min;
                  const sliderMax = zone.max;
                  const totalRange = sliderMax - sliderMin;
                  const lowPct         = ((zone.classicMin - sliderMin) / totalRange) * 100;
                  const classicMaxPct  = ((zone.classicMax - sliderMin) / totalRange) * 100;
                  const advancedMaxPct = ((zone.advancedMax - sliderMin) / totalRange) * 100;
                  const defaultHyd = Math.round((zone.classicMin + zone.classicMax) / 2);
                  // Engine recommendation rounded to 0.5% — used as slider default
                  const engineHyd = advancedRecipe
                    ? Math.round(advancedRecipe.hydration * 2) / 2
                    : defaultHyd;
                  const currentHyd = manualHydration ?? engineHyd;
                  // Adjustment note: only when engine rec differs from style baseline
                  // and baker has not manually set a value
                  const styleBaseHyd = styleKey ? ALL_STYLES[styleKey].hydration : defaultHyd;
                  const hydDiff = Math.round((engineHyd - styleBaseHyd) * 2) / 2;
                  const hydAdjustNote: string | null = (manualHydration === undefined && Math.abs(hydDiff) >= 0.5)
                    ? (() => {
                        const reasons: string[] = [];
                        const bp = flourBlend ? computeBlendProfile(flourBlend) : null;
                        const blendDelta   = bp ? Math.round(bp.hydrationDelta * 2) / 2 : 0;
                        const climateDelta = (kitchenTemp >= 28 || humidity === 'very-humid') ? -2
                                           : kitchenTemp <= 18 ? 2 : 0;
                        const ovenDelta    = Math.round((hydDiff - blendDelta - climateDelta) * 2) / 2;
                        if (Math.abs(blendDelta)   >= 0.5) reasons.push(`your flour blend (${blendDelta > 0 ? '+' : ''}${blendDelta}%)`);
                        if (Math.abs(climateDelta) >= 0.5) reasons.push(
                          climateDelta < 0 ? 'your warm kitchen (−2%)' : 'your cool kitchen (+2%)'
                        );
                        if (Math.abs(ovenDelta)    >= 0.5) reasons.push(`your oven (${ovenDelta > 0 ? '+' : ''}${ovenDelta}%)`);
                        if (reasons.length === 0) return null;
                        return `${zone.name} calls for ${styleBaseHyd}% — adjusted to ${engineHyd}% for ${reasons.join(' and ')}.`;
                      })()
                    : null;

                  function hydrationZoneLabel(h: number): { label: string; color: string; note: string } {
                    if (h < zone.classicMin) return {
                      label: t('dialIn.hydration.belowClassic'),
                      color: '#5A7A98',
                      note: h < zone.min + 3
                        ? t('dialIn.hydration.noteStiff')
                        : t('dialIn.hydration.noteBelowClassic', { name: zone.name }),
                    };
                    if (h <= zone.classicMax) return {
                      label: t('dialIn.hydration.classic'),
                      color: 'var(--sage)',
                      note: t('dialIn.hydration.noteClassic', { name: zone.name }),
                    };
                    if (h <= zone.advancedMax) return {
                      label: t('dialIn.hydration.extended'),
                      color: 'var(--gold)',
                      note: t('dialIn.hydration.noteExtended'),
                    };
                    return {
                      label: t('dialIn.hydration.advanced'),
                      color: '#C4624A',
                      note: h >= zone.max - 2
                        ? t('dialIn.hydration.noteExtreme')
                        : t('dialIn.hydration.noteHigh'),
                    };
                  }

                  const hZone = hydrationZoneLabel(currentHyd);
                  return (
                    <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                          Dough Hydration
                        </label>
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: hZone.color }}>
                          {currentHyd}%
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px',
                          background: `linear-gradient(to right, #A8B8D0 0%, #A8B8D0 ${lowPct}%, #8BA888 ${lowPct}%, #8BA888 ${classicMaxPct}%, #9C8248 ${classicMaxPct}%, #9C8248 ${advancedMaxPct}%, #E8A898 ${advancedMaxPct}%, #E8A898 100%)`,
                        }} />
                        <input
                          type="range"
                          min={sliderMin} max={sliderMax} step={1}
                          value={currentHyd}
                          onChange={e => setManualHydration(Number(e.target.value))}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', appearance: 'none', background: 'transparent', cursor: 'pointer', height: '36px', margin: 0, accentColor: 'var(--terra)' }}
                        />
                      </div>
                      {(() => {
                        const greenCentrePct = (lowPct + classicMaxPct) / 2;
                        return (
                          <div style={{ position: 'relative', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '.15rem', marginBottom: '8px', height: '1rem' }}>
                            <span style={{ position: 'absolute', left: 0 }}>{sliderMin}%</span>
                            <span style={{ position: 'absolute', left: `${greenCentrePct}%`, transform: 'translateX(-50%)', color: 'var(--sage)', fontWeight: 600, whiteSpace: 'nowrap' }}>{zone.classicMin}–{zone.classicMax}% classic</span>
                            <span style={{ position: 'absolute', right: 0 }}>{sliderMax}%</span>
                          </div>
                        );
                      })()}
                      {manualHydration === undefined && Math.abs(hydDiff) >= 0.5 && (
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', marginTop: '4px', lineHeight: 1.4, marginBottom: '8px' }}>
                          {(() => {
                            const parts: string[] = [];
                            const bp = flourBlend ? computeBlendProfile(flourBlend) : null;
                            if (bp?.hydrationDelta) parts.push(`blend ${bp.hydrationDelta > 0 ? '+' : ''}${bp.hydrationDelta}%`);
                            if (ovenData?.hydrationDelta) parts.push(`oven ${ovenData.hydrationDelta > 0 ? '+' : ''}${ovenData.hydrationDelta}%`);
                            if (kitchenTemp >= 28 || humidity === 'very-humid') parts.push('climate −2%');
                            else if (kitchenTemp <= 18) parts.push('climate +2%');
                            if (parts.length === 0) return null;
                            return (
                              <>
                                Adjusted from {styleBaseHyd}% · {parts.join(' · ')}{' · '}
                                <span
                                  onClick={() => setManualHydration(styleBaseHyd)}
                                  style={{ color: 'var(--terra)', cursor: 'pointer', textDecoration: 'underline' }}
                                >Use {styleBaseHyd}%</span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {/* Zone pill + note: only shown when baker set value manually,
                          or when no engine adjustment is explaining the current value */}
                      {(manualHydration !== undefined || !hydAdjustNote) && (<>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: 600,
                          color: hZone.color, flexShrink: 0,
                          background: hZone.color === 'var(--sage)' ? 'rgba(139,168,136,0.12)' :
                                      hZone.color === 'var(--gold)' ? 'rgba(156, 130, 72,0.12)' :
                                      hZone.color === '#C4624A' ? 'rgba(196,98,74,0.1)' : 'rgba(90,122,152,0.1)',
                          borderRadius: '20px', padding: '.2rem 8px',
                        }}>
                          {hZone.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '12px' }}>
                        {hZone.note}
                      </div>
                      </>)}
                    </div>
                  );
                })()}

                {/* Salt · Oil · Sugar — one row, wraps on mobile */}
                <div style={{ paddingTop: '4px' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
                  alignItems: 'start',
                }}>
                  {/* Salt stepper — first, most important */}
                  {(() => {
                    const styleSalt = styleKey ? (ALL_STYLES[styleKey]?.salt ?? 2.5) : 2.5;
                    const v = manualSalt ?? styleSalt;
                    const STEP = 0.1;
                    const isDefault = manualSalt === undefined || manualSalt === styleSalt;
                    return (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', minHeight: '17px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>{t('dialIn.saltPct')}</span>
                          {!isDefault && (
                            <button
                              onClick={() => setManualSalt(undefined)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textDecoration: 'underline', padding: 0 }}
                            >↺ {styleSalt}%</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setManualSalt(Math.max(1.5, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--char)' }}>{v}%</span>
                          <button
                            onClick={() => setManualSalt(Math.min(3.5, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >+</button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4, marginTop: '4px' }}>
                          {v < 2 ? t('dialIn.salt.veryLow') :
                           v <= 2.5 ? t('dialIn.salt.breadRange') :
                           v <= 3 ? t('dialIn.salt.classicPizza') :
                           v <= 3.2 ? t('dialIn.salt.fullFlavour') :
                           t('dialIn.salt.high')}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Oil stepper */}
                  {(() => {
                    const v = manualOil ?? 0;
                    const isHighTemp = ovenType === 'pizza_oven' || ovenType === 'electric_pizza';
                    const STEP = 0.5;
                    const oilGuideText = oilGuidance(v, ovenType ?? '', styleKey ?? '', t);
                    return (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ position: 'relative', marginBottom: '8px', minHeight: '17px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>{t('dialIn.oilPct')}</span>
                          <button
                            onMouseEnter={() => setOilTip(true)} onMouseLeave={() => setOilTip(false)}
                            onClick={() => setOilTip(p => !p)}
                            style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                          >i</button>
                          {oilTip && (
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 12px', fontSize: '12px', color: v > 0 && isHighTemp ? 'var(--terra)' : '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)' }}>
                              {oilGuideText}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setManualOil(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--char)' }}>
                            {v === 0 ? 'None' : `${v}%`}
                          </span>
                          <button
                            onClick={() => setManualOil(Math.min(10, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >+</button>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Sugar stepper */}
                  {(() => {
                    const v = manualSugar ?? 0;
                    const sg = sugarGuidance(v, ovenType ?? '', t);
                    const STEP = 0.5;
                    return (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ position: 'relative', marginBottom: '8px', minHeight: '17px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>{t('dialIn.sugarPct')}</span>
                          <button
                            onMouseEnter={() => setSugarTip(true)} onMouseLeave={() => setSugarTip(false)}
                            onClick={() => setSugarTip(p => !p)}
                            style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                          >i</button>
                          {sugarTip && (
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 12px', fontSize: '12px', color: sg.warn ? 'var(--terra)' : '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)' }}>
                              {sg.note}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setManualSugar(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--char)' }}>
                            {v === 0 ? 'None' : `${v}%`}
                          </span>
                          <button
                            onClick={() => setManualSugar(Math.min(10, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}
                          >+</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </div>
                {/* Precision — 4th sub-section inside Dial In */}
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
                    Precision
                  </div>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* DDT stepper */}
                    {(() => {
                      const styleFDT = styleKey ? ({ neapolitan:23, newyork:24, roman:25, pan:25, sourdough:24, pain_campagne:24, pain_levain:24, baguette:24, pain_complet:24, pain_seigle:24, fougasse:25, brioche:22, pain_mie:24, pain_viennois:23 } as Record<string,number>)[styleKey] ?? 24 : 24;
                      const v = targetDoughTemp ?? styleFDT;
                      const mixerFriction = mixerType ? ({ stand:5, hand:1, no_knead:0, spiral:8 } as Record<string,number>)[mixerType] ?? 3 : 3;
                      const isDefaultDDT = targetDoughTemp === undefined || targetDoughTemp === styleFDT;
                      return (
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>{t('dialIn.doughTemp')}</span>
                              <button
                                onMouseEnter={() => setDdtTip(true)} onMouseLeave={() => setDdtTip(false)}
                                onClick={() => setDdtTip(p => !p)}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                              >i</button>
                              {ddtTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 12px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)' }}>
                                  +{mixerFriction}°C friction from {mixerType === 'spiral' ? 'spiral' : mixerType === 'stand' ? 'stand' : 'hand'} mixer. Flour from fridge removes ~8°C.
                                </div>
                              )}
                            </div>
                            {!isDefaultDDT && (
                              <button onClick={() => setTargetDoughTemp(undefined)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textDecoration: 'underline', padding: 0 }}>
                                ↺ {styleFDT}°C
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                            <button onClick={() => setTargetDoughTemp(Math.max(18, v - 1))}
                              style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>−</button>
                            <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--char)' }}>{v}°C</span>
                            <button onClick={() => setTargetDoughTemp(Math.min(28, v + 1))}
                              style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>+</button>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={flourInFridge} onChange={e => setFlourInFridge(e.target.checked)}
                              style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: 'var(--terra)', flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>{t('dialIn.flourInFridge')}</span>
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                              <button
                                onMouseEnter={() => setFlourFridgeTip(true)} onMouseLeave={() => setFlourFridgeTip(false)}
                                onClick={e => { e.preventDefault(); setFlourFridgeTip(p => !p); }}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                              >i</button>
                              {flourFridgeTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 12px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)', whiteSpace: 'normal' }}>
                                  Cold flour lowers FDT. Removes ~8°C, offset automatically in the water temp calculation.
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })()}
                    {/* Mixing loss stepper */}
                    {(() => {
                      const v = wastePct ?? 1.5;
                      const STEP = 0.5;
                      return (
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>{t('dialIn.mixingLoss')}</span>
                              <button
                                onMouseEnter={() => setMixLossTip(true)} onMouseLeave={() => setMixLossTip(false)}
                                onClick={() => setMixLossTip(p => !p)}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-ui)', flexShrink: 0 }}
                              >i</button>
                              {mixLossTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px', padding: '8px 12px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px rgba(43, 36, 32,0.08)' }}>
                                  Buffer for bowl residue and transfer losses. Schedule is unchanged — only ingredient quantities scale up.
                                </div>
                              )}
                            </div>
                            {wastePct !== undefined && wastePct !== 1.5 && (
                              <button onClick={() => setWastePct(undefined)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', textDecoration: 'underline', padding: 0 }}>
                                ↺ 1.5%
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button onClick={() => setWastePct(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                              style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>−</button>
                            <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--char)' }}>
                              {wastePct === 0 ? 'None' : `${v}%`}
                            </span>
                            <button onClick={() => setWastePct(Math.min(5, Math.round((v + STEP) * 10) / 10))}
                              style={{ width: '24px', height: '24px', borderRadius: '12px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '14px', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>+</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
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
                  {bakeTimeIsPast && sessionRestored ? (
                    <PostBakeLanding
                      styleName={styleDisplayName(styleKey)}
                      eatTime={eatTime}
                      bakeEventId={bakeEventId}
                      onYes={() => {
                        if (bakeEventId) {
                          setSessionRestored(false);
                        } else {
                          startOver();
                        }
                      }}
                      onNo={() => {
                        startOver();
                      }}
                      locale={locale}
                    />
                  ) : (
                    <>
                      {!advancedRecipe ? (
                        <div style={{ background: '#FEF4EF', border: '1.5px solid #F5C4B0', borderRadius: '16px', padding: '20px', textAlign: 'center', color: 'var(--terra)', fontSize: '14px' }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                          <RecipeOutput
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
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
              {!(bakeTimeIsPast && sessionRestored) && eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>How did it go?</p>
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
                              const payload = {
                                tab, bakeType, styleKey, numItems, itemWeight,
                                pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                                fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                                manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                                flourInFridge, wastePct, addSeeds, priorityOverride,
                                eatTime: eatTime?.getTime() ?? null,
                                blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                                recipeGenerated, activeTab, modeChosen,
                                pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys } : null,
                                bakedDone,
                              };
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
                        ✓ Mark as baked
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ Baked!</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>
                  <PlanNav
                    variant="cta"
                    onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
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
                  onNavigateToPizzaParty={pizzaPartyEnabled ? () => setActiveTab('pizzaparty') : undefined}
                  recipe={advancedRecipe ?? null}
                  simpleMode={false}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                {/* Share + party — end of the journey. Quiet chips while
                    baking, gold celebration once marked baked. Anonymous
                    tap opens the sign-in drawer. */}
                {(
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {pizzaPartyEnabled && (
                      <button
                        onClick={() => setActiveTab('pizzaparty')}
                        style={{ ...NEXT_CTA, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {locale === 'fr' ? 'Planifier ma Pizza Party →' : 'Plan my Pizza Party →'}
                      </button>
                    )}
                    <button
                      onClick={shareCurrentSession}
                      style={bakedDone ? {
                        width: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 0', minHeight: '44px', border: 'none', borderRadius: '12px',
                        background: 'var(--gold)', color: 'var(--char)',
                        fontSize: '13px', fontWeight: 600,
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      } : {
                        alignSelf: 'flex-start',
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '8px 16px', border: '1.5px solid var(--border)',
                        borderRadius: '20px', background: 'var(--warm)',
                        color: 'var(--ash)', fontSize: '12px',
                        fontFamily: 'var(--font-ui)', cursor: 'pointer',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={bakedDone ? 'var(--char)' : 'var(--terra)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="6" cy="12" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="18" cy="18" r="3" />
                        <line x1="8.7" y1="10.7" x2="15.3" y2="7.3" /><line x1="8.7" y1="13.3" x2="15.3" y2="16.7" />
                      </svg>
                      {t('planNav.share')}
                    </button>
                  </div>
                )}
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
                  doughConfigured={!!styleKey}
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
                    const payload = {
                      tab, bakeType, styleKey, numItems, itemWeight,
                      pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                      fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                      manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                      flourInFridge, wastePct, addSeeds, priorityOverride,
                      eatTime: eatTime?.getTime() ?? null,
                      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                      recipeGenerated, activeTab, modeChosen,
                      pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys } : null,
                      bakedDone,
                    };
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved}
                  onBakedQtysChange={setBakedPartyQtys}
                  onShare={shareCurrentSession}
                />
              </div>
            )}

          </div>
        )}

      </div>

      {/* ── Bottom nav ── */}
      
      {/* ── Sign-in nudge toast ── */}
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

function PostBakeLanding({
  styleName, eatTime, bakeEventId, onYes, onNo, locale,
}: {
  styleName: string;
  eatTime: Date | null;
  bakeEventId: string | null;
  onYes: () => void;
  onNo: () => void;
  locale: string;
}) {
  const l = locale === 'fr' ? 'fr' : 'en';
  const [saving, setSaving] = useState(false);

  const dateStr = eatTime
    ? eatTime.toLocaleDateString(
        l === 'fr' ? 'fr-FR' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long' },
      )
    : '';

  async function handleYes() {
    setSaving(true);
    if (bakeEventId) {
      const { saveBakedStatus } = await import('../lib/supabase/saveBakeEvent');
      await saveBakedStatus(bakeEventId);
    }
    setSaving(false);
    onYes();
  }

  return (
    <div style={{
      padding: '32px 20px',
      display: 'flex', flexDirection: 'column', gap: '12px',
      maxWidth: '480px', margin: '0 auto',
    }}>
      <div>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '24px',
          fontWeight: 700, color: 'var(--char)', margin: '0 0 4px',
          lineHeight: 1.2,
        }}>
          {styleName}
        </p>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px',
          color: 'var(--smoke)', margin: 0,
        }}>
          {dateStr}
        </p>
      </div>

      <p style={{
        fontFamily: 'var(--font-ui)', fontSize: '17px',
        fontWeight: 600, color: 'var(--char)',
        margin: '16px 0 8px',
      }}>
        {l === 'fr' ? 'Cette fournée a-t-elle eu lieu ?' : 'Did this bake happen?'}
      </p>

      <button
        onClick={handleYes}
        disabled={saving}
        style={{
          width: '100%', padding: '16px',
          background: saving ? 'var(--smoke)' : 'var(--terra)',
          color: 'white', border: 'none', borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '15px',
          fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          boxShadow: '0 2px 8px rgba(107, 68, 35,0.2)',
        }}
      >
        {saving ? '...' : (l === 'fr' ? 'Oui, je l\'ai fait ✓' : 'Yes, I baked it ✓')}
      </button>

      <button
        onClick={onNo}
        style={{
          width: '100%', padding: '12px', minHeight: '44px',
          background: 'none', border: '1px solid var(--border)',
          borderRadius: '12px', cursor: 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          color: 'var(--smoke)',
        }}
      >
        {l === 'fr' ? '← Nouvelle fournée' : '← Start a new bake'}
      </button>
    </div>
  );
}
