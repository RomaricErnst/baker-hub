'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import dynamic from 'next/dynamic';
const ProfileSheet = dynamic(() => import('../components/ProfileSheet'), { ssr: false });
import { loadProfile, setProfileListener } from '../lib/profile';
import { pushProfile, pullAndMergeProfile } from '../lib/supabase/profileSync';
import StylePicker from '../components/StylePicker';
import OvenPicker from '../components/OvenPicker';
import MixerPicker from '../components/MixerPicker';
const SchedulePicker = dynamic(() => import('../components/SchedulePicker'), { ssr: false });
import ClimatePicker from '../components/ClimatePicker';
const RecipeOutput = dynamic(() => import('../components/RecipeOutput'), { ssr: false });
import Timeline from '../components/Timeline';
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

// ── Step jump chips (review mode) ─────────────
// The filled setup accordion is ~6 screens tall on mobile; this compact
// sticky row lets a returning baker jump straight to any step.
function StepJumpChips({ steps, idPrefix, topOffset = 62, raised = false, onBeforeJump }: { steps: { n: number; label: string }[]; idPrefix: string; topOffset?: number; raised?: boolean; onBeforeJump?: (n: number) => void }) {
  return (
    <div style={{
      position: 'sticky', top: raised ? '0px' : `${topOffset}px`, zIndex: 30,
      transition: 'top 0.25s ease',
      display: 'flex', gap: '6px', overflowX: 'auto',
      padding: '8px 4px', margin: '0 -4px 4px',
      background: 'var(--cream)',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {steps.map(s => (
        <button
          key={s.n}
          onClick={() => {
            onBeforeJump?.(s.n);
            const el = document.getElementById(`${idPrefix}-${s.n}`);
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY - (topOffset + 52);
              window.scrollTo({ top, behavior: 'auto' });
            }
          }}
          style={{
            flex: '0 0 auto',
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '6px 12px',
            fontSize: '11px',
            fontFamily: 'var(--font-dm-mono)',
            color: 'var(--ash)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ── Step card ────────────────────────────────
function StepCard({
  num, title, activeStep, highestStep, summary, onEdit, children, idPrefix = 'step', reviewMode = false, canComplete = true,
}: {
  num: number;
  title: string;
  activeStep: number;
  highestStep: number;
  summary?: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
  idPrefix?: string;
  reviewMode?: boolean;
  canComplete?: boolean;
}) {
  const isActive    = activeStep === num || reviewMode;
  const isCompleted = highestStep >= num && activeStep !== num && !reviewMode && canComplete;
  const isLocked    = highestStep < num && !reviewMode;

  return (
    <div id={`${idPrefix}-${num}`} className={isActive ? 'step-card-active' : undefined} style={{
      border: `2px solid ${isActive ? 'var(--terra)' : isCompleted ? 'rgba(107,122,90,0.25)' : 'var(--border)'}`,
      borderRadius: '18px',
      background: isActive ? '#FDFBF7' : isCompleted ? '#F9FAF7' : 'var(--warm)',
      marginBottom: '1rem',
      opacity: isLocked ? 0.4 : 1,
      transition: 'all .25s',
      boxShadow: isActive
        ? '0 0 0 3px rgba(196,82,42,0.08), 0 2px 16px rgba(26,22,18,0.08)'
        : '0 2px 12px rgba(26,22,18,0.06)',
    }}>
      {/* Header */}
      <div
        onClick={isCompleted ? onEdit : undefined}
        style={{
          padding: '1.1rem 1.4rem',
          display: 'flex', alignItems: 'center', gap: '.9rem',
          cursor: isCompleted ? 'pointer' : 'default',
        }}
      >
        {/* Title + summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-playfair)',
            fontWeight: 700, fontSize: '1.1rem',
            color: isLocked ? 'var(--smoke)' : 'var(--char)',
          }}>
            {title}
          </div>
          {isCompleted && summary && (
            <div style={{ fontSize: '.77rem', color: 'var(--smoke)', marginTop: '.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-dm-mono)' }}>
              {summary}
            </div>
          )}
        </div>

        {isCompleted && (
          <span style={{ fontSize: '.72rem', color: 'var(--sage)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>
            Edit
          </span>
        )}
      </div>

      {/* Expanded content */}
      {isActive && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1.5rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Stepper button ────────────────────────────
function ContinueBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  const _locale = useLocale();
  const lbl = label ?? (_locale === 'fr' ? 'Continuer →' : 'Continue →');
  return (
    <button
      onClick={onClick}
      className="btn"
      style={{
        marginTop: '1.25rem', width: '100%', padding: '.9rem 1.25rem',
        border: 'none', borderRadius: '12px',
        background: 'var(--terra)', color: '#fff',
        fontFamily: 'var(--font-playfair)', fontSize: '1.05rem', fontWeight: 700,
        cursor: 'pointer', transition: 'opacity .15s',
        boxShadow: '0 2px 8px rgba(196,82,42,0.22)',
      }}
    >
      {lbl}
    </button>
  );
}

// ── Mono label ────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase',
      letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.4rem',
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
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [showSignInForSave, setShowSignInForSave] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [bakeEventId, setBakeEventId] = useState<string | null>(null);
  const [pizzaPartyQtys, setPizzaPartyQtys] = useState<Record<string, number>>({});
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
  const [modeDetailsOpen, setModeDetailsOpen] = useState<{ simple: boolean; custom: boolean }>({ simple: false, custom: false });

  // Baker profile — ☰ Mon profil sheet + new-session prefill
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePrefilled, setProfilePrefilled] = useState(false);
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
    if (!styleKey && prefStyle && prefStyle in stylePool) {
      setStyleKey(prefStyle as StyleKey); applied = true;
    }
    if (!mixerType && prof.mixerType && prof.mixerType in MIXER_TYPES) {
      setMixerType(prof.mixerType as MixerType); applied = true;
    }
    // Sourdough-native styles override the yeast preference (same rule as
    // the tap-time prefill in selectBakeType).
    const effStyle = styleKey ?? ((prefStyle && prefStyle in stylePool) ? prefStyle : null);
    const lateWantsSourdough = ['pain_levain', 'sourdough'].includes(effStyle as string);
    if (!yeastType && lateWantsSourdough) {
      setYeastType('sourdough'); applied = true;
    } else if (!yeastType && prof.yeastType && prof.yeastType in YEAST_TYPES) {
      setYeastType(prof.yeastType as YeastType); applied = true;
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
      const tmr = setTimeout(() => {
        setPrefermentType('levain');
        setAdvancedStep(9);
        setAdvancedHighestStep(sv => Math.max(sv, 9));
        const el = document.getElementById('adv-step-9');
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'auto' });
      }, 400);
      return () => clearTimeout(tmr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey, yeastType, advancedStep, prefermentType, reviewMode]);

  // Perceived-speed: once a pizza session is underway, warm the party chunk
  // (and its 150-pizza database) during browser idle time — downloaded in the
  // background, instant when the baker opens Ma Soirée Pizza. Not on boot
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
    const tmr = setTimeout(() => {
      if (isCustom) { setAdvancedStep(9); setAdvancedHighestStep(p => Math.max(p, 9)); }
      else { setActiveStep(7); setHighestStep(p => Math.max(p, 7)); }
      const el = document.getElementById(isCustom ? 'adv-step-9' : 'step-7');
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: 'auto' });
      }
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
          prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20
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
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, manualSalt, targetDoughTemp, flourInFridge, wastePct, prefGoesInFridge, feedToMixH]);

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
      targetDoughTemp, flourInFridge, wastePct, priorityOverride,
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
    setModeChosen(true);

    // ── Baker profile prefill — bakeType-compatible defaults, always overridable ──
    const prof = loadProfile();
    if (prof) {
      let applied = false;
      const ovenPool = bt === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES;
      const prefOven = (bt === 'bread' ? prof.ovenTypeBread : prof.ovenTypePizza) ?? prof.ovenType;
      if (prefOven && prefOven in ovenPool) {
        setOvenType(prefOven as AnyOvenType); applied = true;
      }
      const stylePool = bt === 'bread' ? BREAD_STYLES : PIZZA_STYLES;
      const prefStyle = (bt === 'bread' ? prof.styleKeyBread : prof.styleKeyPizza) ?? prof.styleKey;
      let appliedStyle = false;
      if (prefStyle && prefStyle in stylePool) {
        setStyleKey(prefStyle as StyleKey); applied = true; appliedStyle = true;
        // Same per-style defaults a manual pick applies via selectStyle —
        // a prefilled Neapolitan must weigh like a Neapolitan.
        const sk = prefStyle as StyleKey;
        setManualHydration(undefined);
        setManualOil(oilDefault(sk));
        setManualSugar(sugarDefault(sk));
        setNumItems(STYLE_BALL_DEFAULTS[sk] ?? (bt === 'bread' ? 1 : 4));
        if (STYLE_HAS_DIAMETER.includes(sk)) {
          const d = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
          setPizzaDiameter(d);
          setPizzaCorn(1);
          setItemWeight(pizzaWeightFromTable(sk, d, 1));
        } else {
          setItemWeight(ALL_STYLES[sk].ballW);
        }
      }
      if (prof.mixerType && prof.mixerType in MIXER_TYPES) {
        setMixerType(prof.mixerType as MixerType); applied = true;
      }
      // Sourdough-native styles (pain au levain, pizza au levain) are
      // sourdough by definition — the yeast preference yields to the style.
      const styleWantsSourdough = ['pain_levain', 'sourdough'].includes(prefStyle as string);
      if (styleWantsSourdough && appliedStyle) {
        setYeastType('sourdough'); applied = true;
      } else if (prof.yeastType && prof.yeastType in YEAST_TYPES) {
        setYeastType(prof.yeastType as YeastType); applied = true;
      }
      // Preferment — Custom-mode preference only (Simple has no preferment
      // step to change it in), and never on the sourdough path (levain).
      // Pizza only — biga/poolish preferences are pizza-centric; bread has its
      // own preferment conventions and shouldn't inherit the pizza pick.
      if (bt !== 'bread' && prof.prefermentType && prof.preferredMode === 'custom'
          && prof.yeastType !== 'sourdough' && !(styleWantsSourdough && appliedStyle)
          && ['none', 'poolish', 'biga'].includes(prof.prefermentType)) {
        setPrefermentType(prof.prefermentType as PrefermentType); applied = true;
      }
      if (prof.fridgeTemp !== undefined) { setFridgeTemp(prof.fridgeTemp); applied = true; }
      if (prof.preferredMode) { setTab(prof.preferredMode); applied = true; }
      if (prof.starter) {
        setStarterMature(prof.starter.mature);
        setStarterHasRye(prof.starter.hasRye);
        setTang(prof.starter.tang);
      }
      if (applied) setProfilePrefilled(true);
      // Style already answered by the profile — open on Quantity & Size
      // instead of asking to re-confirm a choice the baker already made.
      // The style card stays visible as a collapsed summary (Change).
      if (appliedStyle) {
        setActiveStep(2); setHighestStep(2);
        setAdvancedStep(2); setAdvancedHighestStep(2);
      }
    }
  }

  // First step whose value is genuinely missing — used when switching
  // Simple ↔ Custom so the baker lands exactly where input is needed,
  // with everything already answered marked complete (no re-clicking).
  function firstIncompleteStep(isCustom: boolean): number {
    if (!styleKey) return 1;
    if (!ovenType) return 3;          // qty (2) + climate (4) have sane defaults
    if (!mixerType) return 5;
    if (isCustom) {
      if (!yeastType) return 7;       // flour (6) has a default blend
      return 9;                       // preferment (8) defaults to Direct — scheduler is the goal
    }
    if (!yeastType) return 6;
    return 7;                         // scheduler
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
    if (tab === 'custom') {
      advanceAdv(1);
    } else {
      advance(1);
    }
  }

  function advance(from: number) {
    // Steps already answered (profile prefill) don't need re-validating —
    // hop past them to the next one that still needs input. Only the
    // value-backed steps are skippable: 3 oven, 5 mixer, 6 yeast. Quantity
    // (2), climate (4) and the scheduler (7) always deserve a stop, and
    // every skipped step stays editable as a collapsed summary.
    let next = from + 1;
    while (
      (next === 3 && ovenType != null) ||
      (next === 5 && mixerType != null) ||
      // Sourdough never skips — its step carries session-specific starter
      // questions (fed when, where) that no profile can answer.
      (next === 6 && yeastType != null && yeastType !== 'sourdough')
    ) next++;
    const target = next > highestStep ? next : highestStep;
    setHighestStep(target);
    setActiveStep(target);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      // Scroll to the NEXT section, not `target`: in a generated session
      // highestStep is 99, step-99 doesn't exist and the baker saw nothing
      // happen after picking a value. `next` is always a real section.
      const el = document.getElementById(`step-${next}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        // Instant scroll — smooth scrolling kept options moving under the
        // baker's finger during step transitions, causing mis-taps.
        window.scrollTo({ top, behavior: 'auto' });
      }
    }, 150);
  }

  function advanceAdv(from: number) {
    // Mirror of advance(): hop past steps already answered by the profile.
    // Custom map — 3 oven, 5 mixer, 7 yeast; 8 preferment only when the
    // profile carries a preference. Flour (6) and climate (4) always stop,
    // and sourdough never skips its step (session-specific starter state).
    let next = from + 1;
    const profPref = loadProfile()?.prefermentType;
    while (
      (next === 3 && ovenType != null) ||
      (next === 5 && mixerType != null) ||
      (next === 7 && yeastType != null && yeastType !== 'sourdough') ||
      (next === 8 && profPref != null && yeastType !== 'sourdough')
    ) next++;
    const target = next > advancedHighestStep ? next : advancedHighestStep;
    setAdvancedHighestStep(target);
    setAdvancedStep(target);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      // Scroll to the NEXT section, not `target`: in a generated session
      // highestStep is 99, step-99 doesn't exist and the baker saw nothing
      // happen after picking a value. `next` is always a real section.
      const el = document.getElementById(`adv-step-${next}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        // Instant scroll — smooth scrolling kept options moving under the
        // baker's finger during step transitions, causing mis-taps.
        window.scrollTo({ top, behavior: 'auto' });
      }
    }, 150);
  }

  function startOver() {
    // Fresh session = fresh chance for profile blockers to apply — without
    // this reset, only the first session per page load ever received them.
    profileBlockersAppliedRef.current = false;
    setBakeType(null); setStyleKey(null);
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
    // Without highestStep updates, the scheduler StepCard renders as locked
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
    setTimeout(() => {
      const stepId = isCustom ? 'adv-step-9' : 'step-7';
      const el = document.getElementById(stepId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
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
          onNewSession={startOver}
          onResumeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event); }}
          onRebakeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event, { rebake: true }); }}
          onOpenProfile={() => setProfileOpen(true)}
        />

        {profileOpen && (
          <ProfileSheet locale={locale} onClose={() => setProfileOpen(false)} />
        )}


        {bakeType && bakeType !== 'bread' && (
          <div style={{
            background: '#1A1612',
            borderBottom: '1px solid #2D2824',
          }}>
            {/* ── Journey bar ── */}
            <div style={{ display: 'flex' }}>
              <button
                onClick={() => { setActiveTab(recipeGenerated ? 'plan' : 'setup'); setNavHidden(false); }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 8px',
                  fontSize: '13px',
                  fontWeight: activeTab !== 'pizzaparty' ? 600 : 400,
                  color: activeTab !== 'pizzaparty' ? '#C4522A' : '#8A7F78',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab !== 'pizzaparty' ? '2px solid #C4522A' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {t('tabs.myDough')}
              </button>

              {pizzaPartyEnabled && (
                <button
                  onClick={() => { setActiveTab('pizzaparty'); setNavHidden(false); }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontSize: '13px',
                    fontWeight: activeTab === 'pizzaparty' ? 600 : 400,
                    color: activeTab === 'pizzaparty' ? '#B8903A' : '#8A7F78',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'pizzaparty' ? '2px solid #B8903A' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {t('tabs.myPizzaParty')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.5rem) calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── Nav #6: welcome-back inline banner (was a fixed toast that
             covered tap targets above the bottom nav) ── */}
        {showWelcomeBack && activeTab === 'setup' && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '12px 14px',
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(26,22,18,0.06))',
          }}>
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--smoke)', textTransform: 'uppercase',
              letterSpacing: '.08em', flex: '1 1 auto',
            }}>
              {locale === 'fr' ? 'Session précédente trouvée' : 'Previous session found'}
            </span>
            <button
              onClick={answerWelcomeBack}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
                padding: '8px 14px', borderRadius: '8px', whiteSpace: 'nowrap',
              }}
            >
              {locale === 'fr' ? 'Reprendre →' : 'Resume →'}
            </button>
            <button
              onClick={() => { startOver(); answerWelcomeBack(); }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--smoke)', cursor: 'pointer',
                fontSize: '11px', fontFamily: 'var(--font-dm-mono)',
                padding: '4px 0', whiteSpace: 'nowrap',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              {locale === 'fr' ? 'Recommencer' : 'Start fresh'}
            </button>
          </div>
        )}

        {/* Cloud « Reprendre » — same banner, but the session lives only in
            the account (fresh device); hydrates on tap via restoreFromBakeEvent */}
        {!showWelcomeBack && cloudResume && !modeChosen && !sessionRestored && activeTab === 'setup' && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '12px 14px',
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(26,22,18,0.06))',
          }}>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
                color: 'var(--smoke)', textTransform: 'uppercase',
                letterSpacing: '.08em', display: 'block',
              }}>
                {locale === 'fr' ? 'Session trouvée sur votre compte' : 'Session found in your account'}
              </span>
              <span style={{
                fontFamily: 'var(--font-dm-sans)', fontSize: '12px',
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
                fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
                padding: '8px 14px', borderRadius: '8px', whiteSpace: 'nowrap',
              }}
            >
              {locale === 'fr' ? 'Reprendre →' : 'Resume →'}
            </button>
            <button
              onClick={() => {
                setCloudResume(null);
                try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
              }}
              style={{
                background: 'none', border: 'none',
                color: 'var(--smoke)', cursor: 'pointer',
                fontSize: '11px', fontFamily: 'var(--font-dm-mono)',
                padding: '4px 0', whiteSpace: 'nowrap',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              {locale === 'fr' ? 'Recommencer' : 'Start fresh'}
            </button>
          </div>
        )}

        {/* ── Hero + bake type picker ── */}
        {activeTab === 'setup' && (
        <div ref={modeSelectorRef} style={{ textAlign: 'center', marginBottom: '16px' }}>
          {!bakeType && (
          <h1 style={{
            fontFamily: 'var(--font-playfair)',
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
          )}
          {!bakeType && (
            <p style={{
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 'clamp(0.85rem, 3vw, 0.95rem)',
              color: 'var(--smoke)',
              lineHeight: 1.5,
              margin: '-8px auto 20px',
              maxWidth: '30rem',
            }}>
              {t('hero.subtitle')}
              <span style={{
                display: 'block', marginTop: '6px',
                fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)',
                color: 'var(--gold)', letterSpacing: '.03em',
              }}>
                {locale === 'fr' ? '≈ 2 minutes jusqu’à votre plan complet' : '≈ 2 minutes to your full plan'}
              </span>
            </p>
          )}

          {/* Pizza / Bread picker — full cards before selection, compact toggle after */}
          {!bakeType && (
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
                  borderRadius: '18px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  border: `2px solid ${bakeType === opt.type ? opt.activeBorder : 'var(--border)'}`,
                  boxShadow: hoveredBakeType === opt.type
                    ? 'var(--card-shadow-hover)'
                    : bakeType === opt.type
                      ? `0 0 0 4px ${opt.type === 'bread' ? 'rgba(139,105,20,.1)' : 'rgba(196,82,42,.1)'}`
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
                  padding: '2rem 1.25rem 1.25rem',
                  background: 'linear-gradient(to top, rgba(26,22,18,0.82) 0%, rgba(26,22,18,0.0) 100%)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'white', marginBottom: '.3rem', fontFamily: 'var(--font-playfair)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
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
          )}

          {/* Mode + Pizza Party card — only shown after bakeType selected */}
          {bakeType && (
            <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '14px', padding: '12px' }}>

              {/* Simple / Custom toggle */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: bakeType === 'pizza' ? '12px' : '0' }}>
                {([
                  { key: 'simple' as const, title: t('modeCards.simple.title'), subtitle: t('modeCards.simple.subtitle'), collapsed: t('modeCards.simple.collapsed') },
                  { key: 'custom' as const, title: t('modeCards.custom.title'), subtitle: t('modeCards.custom.subtitle'), collapsed: t('modeCards.custom.collapsed') },
                ]).map(m => (
                  <div
                    key={m.key}
                    role="button"
                    tabIndex={0}
                    aria-label={m.title}
                    aria-pressed={tab === m.key}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLDivElement).click(); }
                    }}
                    onClick={() => {
                      if (m.key === 'simple' && tab === 'custom') {
                        customOnlyStateRef.current = { flourBlend, hydration: manualHydration, oil: manualOil, sugar: manualSugar, prefermentType, prefermentFlourPct };
                        setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
                      }
                      if (m.key === 'custom' && tab !== 'custom') {
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
                      setTab(m.key); setModeChosen(true); setProtocolStale(true); setActiveTab('setup');
                      // Land on the first step that actually needs input —
                      // completed choices carry over, no re-clicking required.
                      const _target = firstIncompleteStep(m.key === 'custom');
                      if (m.key === 'custom') {
                        setAdvancedStep(_target);
                        setAdvancedHighestStep(prev => Math.max(prev, _target));
                      } else {
                        setActiveStep(_target);
                        setHighestStep(prev => Math.max(prev, _target));
                      }
                      suppressNextScrollRef.current = true;
                    }}
                    style={{
                      flex: 1,
                      // Cards must be allowed to shrink below their
                      // content's min width — nowrap pill/subtitle rows
                      // otherwise push the whole page wider than the
                      // viewport on phones (their rows clip instead).
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      border: tab === m.key ? '2px solid var(--terra)' : '0.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      background: tab === m.key ? 'white' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '14px', fontWeight: 700, color: 'var(--char)' }}>
                        {m.title}
                      </span>
                      </div>
                    {/* Personality subtitle */}
                    <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '9.5px', fontStyle: 'italic', color: 'var(--smoke)', margin: '1px 0 8px', whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '-0.01em' }}>
                      {m.subtitle}
                    </div>
                    {/* Mode signature visual — the instrument you'll meet inside */}
                    {m.key === 'simple' ? (
                      <div>
                        {/* 7 guided steps — same dot rhythm as the journey bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '34px' }}>
                          {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <span key={i} style={{
                              width: i === 6 ? '10px' : '7px', height: i === 6 ? '10px' : '7px',
                              borderRadius: '50%', flexShrink: 0,
                              background: i < 3 ? '#8BA888' : i < 6 ? '#A8B8D0' : '#D4A853',
                            }} />
                          ))}
                          <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                        </div>
                        {/* Value pills — same visual language as the Avancé card */}
                        <div style={{ display: 'flex', gap: '3px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {t('modeCards.simple.pills').split('|').map((c, i) => (
                            <span key={i} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '8.5px', color: 'var(--ash)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 6px', background: 'rgba(26,22,18,0.03)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {c.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <svg viewBox="0 0 130 42" style={{ width: '100%', height: '34px', display: 'block' }} preserveAspectRatio="none" aria-hidden="true">
                          <line x1="4" y1="34" x2="126" y2="34" stroke="#E8E0D5" strokeWidth="1.5" />
                          <path d="M6 34 C24 34 28 8 40 8 C52 8 56 34 74 34" fill="none" stroke="#A8B8D0" strokeWidth="2" strokeLinecap="round" />
                          <path d="M52 34 C72 34 76 12 88 12 C100 12 104 34 122 34" fill="none" stroke="#8BA888" strokeWidth="2" strokeLinecap="round" />
                          {/* Diamond on the baseline — the draggable time marker, as in the real chart */}
                          <polygon points="52,29.5 56.5,34 52,38.5 47.5,34" fill="#D4A853" stroke="#FDFBF7" strokeWidth="1" />
                        </svg>
                        <div style={{ display: 'flex', gap: '3px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {t('modeCards.custom.chips').split('|').map((c, i) => (
                            <span key={i} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '8.5px', color: 'var(--ash)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 6px', background: 'rgba(26,22,18,0.03)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {c.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Expandable details — the previous bullets */}
                    {modeDetailsOpen[m.key] && (
                      <div style={{ fontSize: '11px', color: 'var(--smoke)', lineHeight: 1.7, marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '7px' }}>
                        {m.collapsed.split('|').map((line, i) => (
                          <div key={i}>{line.trim()}</div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setModeDetailsOpen(prev => ({ ...prev, [m.key]: !prev[m.key] }));
                      }}
                      onKeyDown={e => e.stopPropagation()}
                      style={{ marginTop: 'auto', paddingTop: '7px', alignSelf: 'flex-start', background: 'none', border: 'none', paddingBottom: 0, paddingLeft: 0, paddingRight: 0, cursor: 'pointer', fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--terra)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                    >
                      {modeDetailsOpen[m.key] ? t('modeCards.hide') : t('modeCards.details')}
                    </button>
                  </div>
                ))}
              </div>

              {/* Gentle discovery — profile-less bakers learn preferences exist */}
              {!profilePrefilled && !recipeGenerated && !loadProfile() && (
                <div style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                  color: 'var(--smoke)', letterSpacing: '.05em', margin: '10px 2px 0',
                }}>
                  {locale === 'fr'
                    ? 'Astuce : ☰ Mes préférences préremplit four, pétrin & style à chaque session'
                    : 'Tip: ☰ My preferences prefills oven, mixer & style every session'}
                </div>
              )}

              {/* Baker-profile prefill hint — observation, not an alarm */}
              {profilePrefilled && !recipeGenerated && (
                <div style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                  color: 'var(--smoke)', letterSpacing: '.05em', margin: '10px 2px 0',
                }}>
                  {locale === 'fr'
                    ? '✓ Préréglé depuis votre profil — modifiable à chaque étape'
                    : '✓ Prefilled from your profile — adjustable at every step'}
                </div>
              )}

            </div>
          )}
        </div>
        )}

        {/* ════════════ GUIDED ════════════ */}
        {tab === 'simple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Review mode banner ── */}
            {reviewMode && (
              <div style={{
                background: 'rgba(212,168,83,0.1)',
                border: '1px solid rgba(212,168,83,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '12px',
                color: 'var(--gold)',
                marginBottom: '4px',
              }}>
                ↩ {locale === 'fr' ? 'Session précédente chargée — vérifiez vos réglages ci-dessous' : 'Previous session loaded — review your settings below'}
              </div>
            )}

            {/* ── Nav #3: step jump chips (review mode) ── */}
            {reviewMode && (
              <StepJumpChips
                raised={navHidden}
                topOffset={bakeType === 'pizza' ? 97 : 62}
                onBeforeJump={n2 => { setActiveStep(n2); setHighestStep(p2 => Math.max(p2, n2)); setReviewMode(true); }}
                idPrefix="step"
                steps={[
                  { n: 1, label: locale === 'fr' ? 'Style' : 'Style' },
                  { n: 2, label: locale === 'fr' ? 'Quantité' : 'Quantity' },
                  { n: 3, label: locale === 'fr' ? 'Four' : 'Oven' },
                  { n: 4, label: locale === 'fr' ? 'Climat' : 'Climate' },
                  { n: 5, label: locale === 'fr' ? 'Pétrin' : 'Mixer' },
                  { n: 6, label: locale === 'fr' ? 'Levure' : 'Yeast' },
                  { n: 7, label: locale === 'fr' ? 'Plan' : 'Plan' },
                ]}
              />
            )}

            {/* ─── STEP 1: Style picker ────────────── */}
            <StepCard
              num={1} title={t('steps.2.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={styleKey ? (locale === 'fr' && (ALL_STYLES[styleKey] as { nameFr?: string }).nameFr ? (ALL_STYLES[styleKey] as { nameFr: string }).nameFr : ALL_STYLES[styleKey].name) : undefined}
              onEdit={() => setActiveStep(1)}
            >
              {bakeType && (
                <StylePicker
                  bakeType={bakeType}
                  selected={styleKey}
                  onSelect={selectStyle}
                  disabledIds={bakeType === 'bread' ? ['pain_levain'] : []}
                  disabledNote={locale === 'fr'
                    ? 'Le Pain au Levain nécessite le mode Avancé — essayez le Pain de Campagne pour un style similaire'
                    : 'Pain au Levain requires Custom mode — try Pain de Campagne for a similar style'}
                />
              )}
            </StepCard>

            {/* ─── STEP 3: Quantity ────────────────── */}
            <StepCard
              num={2} title={t('steps.3.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={styleKey ? `${numItems} × ${itemWeight} g` : undefined}
              onEdit={() => setActiveStep(2)}
            >
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = styleKey === 'neapolitan' && itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ── ROW 1: Quantity — centred, large, primary ── */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                        {isBread ? t('quantity.loaves') : t('quantity.howMany')}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '52px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '2rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--ash)', fontFamily: 'DM Sans, sans-serif' }}>{isBread ? (numItems === 1 ? 'loaf' : 'loaves') : (numItems === 1 ? 'pizza' : 'pizzas')}</span>
                        </div>
                        <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>

                    {/* ── ROW 2: Cornicione — compact, secondary ── */}
                    {showDiam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>{t('quantity.corniceLabel')}</span>
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
                                flex: 1, padding: '5px 0', borderRadius: '8px',
                                border: pizzaCorn === opt.value ? '2px solid #C4522A' : '1px solid #E8E0D5',
                                background: pizzaCorn === opt.value ? 'white' : 'transparent',
                                color: pizzaCorn === opt.value ? '#1A1612' : '#8A7F78',
                                fontSize: '12px', fontWeight: pizzaCorn === opt.value ? 600 : 400,
                                fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {showDiam && (
                      <div style={{
                        fontSize: '11px', color: '#8A7F78',
                        fontFamily: 'DM Sans, sans-serif',
                        textAlign: 'left',
                        marginBottom: '8px', marginTop: '10px',
                        fontStyle: 'italic',
                      }}>
                        {locale === 'fr'
                          ? "Diamètre et poids sont liés — modifiez l'un ou l'autre."
                          : 'Diameter and weight are linked — set either one.'}
                      </div>
                    )}

                    {/* ── ROW 3: Diameter + Weight — two equal tiles ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: showDiam ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '20px' }}>

                      {/* Diameter tile — stepper replaces slider */}
                      {showDiam && (
                        <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 10px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>◎ {locale === 'fr' ? 'Diamètre' : 'Diameter'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <button onClick={() => { const d = Math.max(22, pizzaDiameter - 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', minWidth: '48px', textAlign: 'center' }}>{pizzaDiameter}<span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)', marginLeft: '2px' }}>cm</span></span>
                            <button onClick={() => { const d = Math.min(35, pizzaDiameter + 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          </div>
                        </div>
                      )}

                      {/* Weight tile */}
                      <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 10px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>⚖ {isBread ? t('quantity.weightPerLoafLabel') : t('quantity.weightPerBallLabel')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => { const w = Math.max(weightBounds.min, itemWeight - weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: itemWeight >= 1000 ? '80px' : '64px', justifyContent: 'center' }}>
                            <input type="number" min={weightBounds.min} max={weightBounds.max} step={weightBounds.step} value={itemWeight}
                              onChange={e => { const w = Math.max(weightBounds.min, Math.min(weightBounds.max, Math.round(+e.target.value / weightBounds.step) * weightBounds.step)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: itemWeight >= 1000 ? '62px' : '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(weightBounds.max, itemWeight + weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    </div>
                    {/* AVPN note */}
                    {isAtMax && (
                      <div style={{ marginTop: '10px', padding: '7px 10px', background: '#FEF9F0', borderRadius: '8px', border: '0.5px solid #F0D9A0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>{t('avpn.atLimit')}</strong> — {t('avpn.limitDesc')}</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem .5rem', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>🤔 {t('avpn.learnMore')}</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--cream)', borderRadius: '8px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        {t('avpn.body')}
                      </div>
                    )}
                  </div>
                );
              })()}
              {!reviewMode && <ContinueBtn onClick={() => advance(2)} />}
            </StepCard>

            {/* ─── STEP 4: Oven ────────────────────── */}
            <StepCard
              num={3} title={t('steps.4.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={ovenData
                ? (locale === 'fr' && (ovenData as { nameFr?: string }).nameFr ? (ovenData as { nameFr: string }).nameFr : ovenData.name)
                : <span style={{ color: 'var(--smoke)', opacity: 0.6 }}>{locale === 'fr' ? 'Choisir votre four' : 'Choose your oven'}</span>}
              canComplete={!!ovenType}
              onEdit={() => setActiveStep(3)}
            >
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                styleKey={styleKey}
                selected={ovenType}
                onSelect={ot => { setOvenType(ot); advance(3); }}
                onPreselect={setOvenType}
              />
              {!reviewMode && ovenType && <ContinueBtn onClick={() => advance(3)} />}
            </StepCard>

            {/* ─── STEP 5: Climate ─────────────────── */}
            <StepCard
              num={4} title={t('steps.5.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setActiveStep(4)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              {!reviewMode && <ContinueBtn onClick={() => advance(4)} />}
            </StepCard>

            {/* ─── STEP 6: Mixer ───────────────────── */}
            <StepCard
              num={5} title={t('steps.6.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={mixerType
                ? (locale === 'fr' && (MIXER_TYPES[mixerType] as { nameFr?: string }).nameFr ? (MIXER_TYPES[mixerType] as { nameFr: string }).nameFr : MIXER_TYPES[mixerType].name)
                : <span style={{ color: 'var(--smoke)', opacity: 0.6 }}>{locale === 'fr' ? 'Choisir votre pétrissage' : 'Choose your mixer'}</span>}
              canComplete={!!mixerType}
              onEdit={() => setActiveStep(5)}
            >
              <MixerPicker
                            totalDoughG={numItems * itemWeight}
                            locale={locale}
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advance(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
              {!reviewMode && mixerType && <ContinueBtn onClick={() => advance(5)} />}
            </StepCard>

            {/* ─── STEP 7: Yeast type ──────────────── */}
            <StepCard
              num={6} title={t('steps.7.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={yeastType ? (locale === 'fr' && (YEAST_TYPES[yeastType] as { nameFr?: string }).nameFr ? (YEAST_TYPES[yeastType] as { nameFr: string }).nameFr : YEAST_TYPES[yeastType].name) : undefined}
              onEdit={() => setActiveStep(6)}
            >
              <YeastHelper
                selected={yeastType}
                onSelect={(yt) => { setYeastType(yt); advance(6); }}
                onClose={() => {}}
                disabledIds={['sourdough']}
                disabledNote={locale === 'fr' ? 'Le levain nécessite le mode Avancé' : 'Sourdough requires Custom mode'}
                styleKey={styleKey}
              />
              {!reviewMode && yeastType && yeastType !== 'sourdough' && <ContinueBtn onClick={() => advance(6)} />}
            </StepCard>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepCard
              num={7} title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={eatTime ? `${formatTime(startTime, locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}` : undefined}
              onEdit={() => setActiveStep(7)}
            >
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
            </StepCard>

            {/* ── Generate button (setup tab) ── */}
            {canGenerate && !(sessionRestored && recipeGenerated) && (
              <div style={{ margin: '8px 0 0' }}>
                <button
                  onClick={handleGenerate}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: '#C4522A',
                    color: 'white',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-dm-sans)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(196,82,42,0.3)',
                  }}
                >
                  {t('generate.generateBtn')}
                </button>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10.5px', color: 'var(--smoke)', textAlign: 'center', marginTop: '8px', letterSpacing: '.03em' }}>
                  {t('generate.nextHint')}
                </div>
              </div>
            )}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F5F0E8',
                  borderRadius: '10px',
                  padding: '10px 14px',
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
                      background: '#C4522A',
                      color: 'white',
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '8px',
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
                <div ref={resultsRef} style={{ marginTop: '1rem' }}>
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
                          borderRadius: '12px', padding: '1.25rem', textAlign: 'center',
                          color: 'var(--terra)', fontSize: '.88rem',
                        }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                          <RecipeOutput
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
                            onOpenGuide={() => setActiveTab('guide')}
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

                          {schedule && (
                            <Timeline
                              schedule={schedule}
                              blocks={blocks}
                              preheatMin={preheatMin}
                              startTime={startTime}
                              eatTime={eatTime!}
                              mixerType={mixerType!}
                              styleKey={styleKey ?? ''}
                              oil={recipe?.oil ?? 0}
                              hydration={recipe?.hydration ?? 0}
                              numItems={numItems}
                              feedTime={feedTime}
                              kitchenTemp={kitchenTemp}
                              prefStartTime={prefStartTime}
                              prefermentType={prefermentType}
                              prefGoesInFridge={prefGoesInFridge}
                              prefRemoveFromFridgeTime={prefRemoveFromFridgeTime}
                              onStartBaking={() => setActiveTab('guide')}
                              bakeType={bakeType ?? undefined}
                              recipe={recipe ?? null}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {!(bakeTimeIsPast && sessionRestored) && eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', background: 'var(--warm)', padding: '14px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>How did it go?</p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '10px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}>📷</span>}
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
                                flourInFridge, wastePct, priorityOverride,
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
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)' }}
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
                  />
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: activeTab === 'guide' ? 'block' : 'none' }}>
              {!recipeGenerated ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>{t('common.generateFirst')}</div>
                </div>
              ) : schedule && recipe && mixerType && (
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
                />
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
                      flourInFridge, wastePct, priorityOverride,
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
                  onShare={async () => {
                    let id = bakeEventId;
                    if (!id && user) {
                      const { saveNamedSession } = await import('../lib/supabase/saveBakeEvent');
                      id = await saveNamedSession({
                        tab, bakeType: bakeType ?? '', styleKey, numItems, itemWeight,
                        pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                        fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                        manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                        flourInFridge, wastePct, priorityOverride,
                        eatTime: eatTime?.getTime() ?? null,
                        blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                        pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys, bakedQtys: Object.keys(bakedPartyQtys).length > 0 ? bakedPartyQtys : undefined } : null,
                        bakedDone,
                        computedRecipe: buildComputedRecipe(),
                      } as SessionData);
                      if (id) { setBakeEventId(id); setSessionSaved(true); }
                    }
                    if (id) setShareSessionId(id);
                  }}
                />
              </div>
            )}

          </div>
        )}

        {/* ════════════ ADVANCED ════════════ */}
        {tab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Review mode banner ── */}
            {reviewMode && (
              <div style={{
                background: 'rgba(212,168,83,0.1)',
                border: '1px solid rgba(212,168,83,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '12px',
                color: 'var(--gold)',
                marginBottom: '4px',
              }}>
                ↩ {locale === 'fr' ? 'Session précédente chargée — vérifiez vos réglages ci-dessous' : 'Previous session loaded — review your settings below'}
              </div>
            )}

            {/* ── Nav #3: step jump chips (review mode) ── */}
            {reviewMode && (
              <StepJumpChips
                raised={navHidden}
                topOffset={bakeType === 'pizza' ? 97 : 62}
                onBeforeJump={n2 => { setAdvancedStep(n2); setAdvancedHighestStep(p2 => Math.max(p2, n2)); setReviewMode(true); }}
                idPrefix="adv-step"
                steps={[
                  { n: 1, label: locale === 'fr' ? 'Style' : 'Style' },
                  { n: 2, label: locale === 'fr' ? 'Quantité' : 'Quantity' },
                  { n: 3, label: locale === 'fr' ? 'Four' : 'Oven' },
                  { n: 4, label: locale === 'fr' ? 'Climat' : 'Climate' },
                  { n: 5, label: locale === 'fr' ? 'Pétrin' : 'Mixer' },
                  { n: 6, label: locale === 'fr' ? 'Farine' : 'Flour' },
                  { n: 7, label: locale === 'fr' ? 'Levure' : 'Yeast' },
                  { n: 8, label: locale === 'fr' ? 'Préferment' : 'Preferment' },
                  { n: 9, label: locale === 'fr' ? 'Plan' : 'Plan' },
                  { n: 10, label: locale === 'fr' ? 'Pâte' : 'Dough' },
                ]}
              />
            )}

            {/* ─── ADV STEP 1: Style picker ────────── */}
            <StepCard
              idPrefix="adv-step"
              num={1} title={t('steps.2.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={styleKey ? (locale === 'fr' && (ALL_STYLES[styleKey] as { nameFr?: string }).nameFr ? (ALL_STYLES[styleKey] as { nameFr: string }).nameFr : ALL_STYLES[styleKey].name) : undefined}
              onEdit={() => setAdvancedStep(1)}
            >
              {bakeType && (
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
              )}
            </StepCard>

            {/* ─── ADV STEP 3: Quantity ────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={2} title={t('steps.3.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={styleKey ? `${numItems} × ${itemWeight} g` : undefined}
              onEdit={() => setAdvancedStep(2)}
            >
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = styleKey === 'neapolitan' && itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ROW 1: Quantity — centred, large, primary */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                        {isBread ? t('quantity.loaves') : t('quantity.howMany')}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '52px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '2rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--ash)', fontFamily: 'DM Sans, sans-serif' }}>{isBread ? (numItems === 1 ? 'loaf' : 'loaves') : (numItems === 1 ? 'pizza' : 'pizzas')}</span>
                        </div>
                        <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                      </div>
                    </div>

                    {/* ROW 2: Cornicione */}
                    {showDiam && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>{t('quantity.corniceLabel')}</span>
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
                                flex: 1, padding: '5px 0', borderRadius: '8px',
                                border: pizzaCorn === opt.value ? '2px solid #C4522A' : '1px solid #E8E0D5',
                                background: pizzaCorn === opt.value ? 'white' : 'transparent',
                                color: pizzaCorn === opt.value ? '#1A1612' : '#8A7F78',
                                fontSize: '12px', fontWeight: pizzaCorn === opt.value ? 600 : 400,
                                fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {showDiam && (
                      <div style={{
                        fontSize: '11px', color: '#8A7F78',
                        fontFamily: 'DM Sans, sans-serif',
                        textAlign: 'left',
                        marginBottom: '8px', marginTop: '10px',
                        fontStyle: 'italic',
                      }}>
                        {locale === 'fr'
                          ? "Diamètre et poids sont liés — modifiez l'un ou l'autre."
                          : 'Diameter and weight are linked — set either one.'}
                      </div>
                    )}

                    {/* ROW 3: Diameter + Weight tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: showDiam ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '20px' }}>

                      {showDiam && (
                        <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 10px', overflow: 'hidden' }}>
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>◎ {locale === 'fr' ? 'Diamètre' : 'Diameter'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            <button onClick={() => { const d = Math.max(22, pizzaDiameter - 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', minWidth: '48px', textAlign: 'center' }}>{pizzaDiameter}<span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)', marginLeft: '2px' }}>cm</span></span>
                            <button onClick={() => { const d = Math.min(35, pizzaDiameter + 1); setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          </div>
                        </div>
                      )}

                      <div style={{ background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 10px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>⚖ {isBread ? t('quantity.weightPerLoafLabel') : t('quantity.weightPerBallLabel')}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                          <button onClick={() => { const w = Math.max(weightBounds.min, itemWeight - weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: itemWeight >= 1000 ? '80px' : '64px', justifyContent: 'center' }}>
                            <input type="number" min={weightBounds.min} max={weightBounds.max} step={weightBounds.step} value={itemWeight}
                              onChange={e => { const w = Math.max(weightBounds.min, Math.min(weightBounds.max, Math.round(+e.target.value / weightBounds.step) * weightBounds.step)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: itemWeight >= 1000 ? '62px' : '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(weightBounds.max, itemWeight + weightBounds.step); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                    </div>

                    {/* AVPN note */}
                    {isAtMax && (
                      <div style={{ marginTop: '10px', padding: '7px 10px', background: '#FEF9F0', borderRadius: '8px', border: '0.5px solid #F0D9A0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>{t('avpn.atLimit')}</strong> — {t('avpn.limitDesc')}</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem .5rem', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>🤌 {t('avpn.learnMore')}</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--cream)', borderRadius: '8px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        {t('avpn.body')}
                      </div>
                    )}
                  </div>
                );
              })()}
              {!reviewMode && <ContinueBtn onClick={() => advanceAdv(2)} />}
            </StepCard>

            {/* ─── ADV STEP 4: Oven ────────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={3} title={t('steps.4.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={ovenData
                ? (locale === 'fr' && (ovenData as { nameFr?: string }).nameFr ? (ovenData as { nameFr: string }).nameFr : ovenData.name)
                : <span style={{ color: 'var(--smoke)', opacity: 0.6 }}>{locale === 'fr' ? 'Choisir votre four' : 'Choose your oven'}</span>}
              canComplete={!!ovenType}
              onEdit={() => setAdvancedStep(3)}
            >
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                styleKey={styleKey}
                selected={ovenType}
                onSelect={ot => { setOvenType(ot); advanceAdv(3); }}
                onPreselect={setOvenType}
              />
              {!reviewMode && ovenType && <ContinueBtn onClick={() => advanceAdv(3)} />}
            </StepCard>

            {/* ─── ADV STEP 5: Climate ─────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={4}
              title={t('steps.5.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setAdvancedStep(4)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />
              {!reviewMode && <ContinueBtn onClick={() => advanceAdv(4)} />}
            </StepCard>

            {/* ─── ADV STEP 6: Mixer ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={5} title={t('steps.6.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={mixerType
                ? (locale === 'fr' && (MIXER_TYPES[mixerType] as { nameFr?: string }).nameFr ? (MIXER_TYPES[mixerType] as { nameFr: string }).nameFr : MIXER_TYPES[mixerType].name)
                : <span style={{ color: 'var(--smoke)', opacity: 0.6 }}>{locale === 'fr' ? 'Choisir votre pétrissage' : 'Choose your mixer'}</span>}
              canComplete={!!mixerType}
              onEdit={() => setAdvancedStep(5)}
            >
              <MixerPicker
                            totalDoughG={numItems * itemWeight}
                            locale={locale}
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advanceAdv(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
              {!reviewMode && mixerType && <ContinueBtn onClick={() => advanceAdv(5)} />}
            </StepCard>

            {/* ─── ADV STEP 7: Flour ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={6} title={t('steps.flour.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={(() => {
                if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                  // brandProduct holds the actual selected flour name (e.g. "Auchan Farine T55")
                  // fall back to generic tile name only when no specific flour was selected
                  return flourBlend.brandProduct ?? computeBlendProfile(flourBlend).displayName;
                }
                const ratio2 = 100 - flourBlend.ratio1;
                const flour1Name = flourBlend.brandProduct ?? computeBlendProfile({ ...flourBlend, flour2: null, ratio1: 100 }).displayName;
                const flour2NameRaw = flourBlend.customFlour2Name ?? computeBlendProfile(flourBlend).displayName.split('+')[1]?.trim() ?? '';
                const flour2Name = flour2NameRaw.replace(/^\d+%\s*/, '');
                return `${flourBlend.ratio1}% ${flour1Name} + ${flour2Name}`;
              })()}
              onEdit={() => setAdvancedStep(6)}
            >
              <FlourPicker
                blend={flourBlend}
                onBlendChange={b => setFlourBlend(b)}
                bakeType={bakeType ?? 'pizza'}
                mode={tab === 'custom' ? 'custom' : 'simple'}
                styleKey={styleKey}
              />
              <div style={{ marginTop: '.85rem' }}>
                <button
                  onClick={() => advanceAdv(6)}
                  className="btn"
                  style={{
                    width: '100%', padding: '.9rem 1.25rem',
                    border: 'none', borderRadius: '12px',
                    background: 'var(--terra)', color: '#fff',
                    fontFamily: 'var(--font-playfair)', fontSize: '1.05rem', fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(196,82,42,0.22)',
                  }}
                >
                  {t('common.continueBtn')}
                </button>
              </div>
            </StepCard>

            {/* ─── ADV STEP 8: Yeast ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={7} title={t('steps.7.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={yeastType ? <>{locale === 'fr' && (YEAST_TYPES[yeastType] as { nameFr?: string }).nameFr ? (YEAST_TYPES[yeastType] as { nameFr: string }).nameFr : YEAST_TYPES[yeastType].name} · <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', fontSize: '.85em' }}>{locale === 'fr' && (YEAST_TYPES[yeastType] as { shortNameFr?: string }).shortNameFr ? (YEAST_TYPES[yeastType] as { shortNameFr: string }).shortNameFr : YEAST_TYPES[yeastType].shortName}</span></> : undefined}
              onEdit={() => setAdvancedStep(7)}
            >
              <YeastHelper
                selected={yeastType}
                onSelect={(yt) => {
                  setYeastType(yt);
                  if (yt === 'sourdough') {
                    setPrefermentType('levain');
                    setAdvancedStep(9);
                    setAdvancedHighestStep(s => Math.max(s, 9));
                    setTimeout(() => {
                      const el = document.getElementById('adv-step-9');
                      if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 70;
                        // Instant scroll — smooth scrolling kept options moving under the
        // baker's finger during step transitions, causing mis-taps.
        window.scrollTo({ top, behavior: 'auto' });
                      }
                    }, 150);
                  } else {
                    if (prefermentType === 'levain') setPrefermentType('none');
                    advanceAdv(7);
                  }
                }}
                onClose={() => {}}
                styleKey={styleKey}
              />
              {!reviewMode && yeastType && yeastType !== 'sourdough' && <ContinueBtn onClick={() => advanceAdv(7)} />}
              {styleKey === 'pain_levain' && yeastType === 'sourdough' && advancedStep === 7 && (
                <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.5rem', textAlign: 'center' }}>
                  {locale === 'fr' ? 'Levain confirmé automatiquement…' : 'Sourdough confirmed automatically…'}
                </div>
              )}
              {yeastType === 'sourdough' && advancedStep === 7 && styleKey === 'pain_levain' && !reviewMode && (
                <div style={{ marginTop: '.75rem' }}>
                  <button
                    onClick={() => {
                      setPrefermentType('levain');
                      setAdvancedStep(9);
                      setAdvancedHighestStep(s => Math.max(s, 9));
                      setTimeout(() => {
                        const el = document.getElementById('adv-step-9');
                        if (el) {
                          const top = el.getBoundingClientRect().top + window.scrollY - 70;
                          // Instant scroll — smooth scrolling kept options moving under the
        // baker's finger during step transitions, causing mis-taps.
        window.scrollTo({ top, behavior: 'auto' });
                        }
                      }, 150);
                    }}
                    style={{
                      width: '100%', padding: '.9rem 1.25rem',
                      border: 'none', borderRadius: '12px',
                      background: 'var(--terra)', color: '#fff',
                      fontFamily: 'var(--font-playfair)',
                      fontSize: '1.05rem', fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(196,82,42,0.22)',
                    }}
                  >
                    {locale === 'fr' ? 'Continuer →' : 'Continue →'}
                  </button>
                </div>
              )}
            </StepCard>

            {/* ─── ADV STEP 9: Preferment (hidden for sourdough) ── */}
            {yeastType !== 'sourdough' && (
              <StepCard
                idPrefix="adv-step"
                num={8} title={t('preferment.stepTitle')}
                activeStep={advancedStep}
                highestStep={advancedHighestStep}
                reviewMode={reviewMode}
                summary={prefermentType !== 'none' ? (locale === 'fr' && (PREFERMENT_TYPES[prefermentType] as { nameFr?: string }).nameFr ? (PREFERMENT_TYPES[prefermentType] as { nameFr: string }).nameFr : PREFERMENT_TYPES[prefermentType].name) : t('preferment.direct')}
                onEdit={() => setAdvancedStep(8)}
              >
                <PrefermentPicker
                  selected={prefermentType}
                  onSelect={pt => {
                    setPrefermentType(pt);
                    advanceAdv(8);
                  }}
                  flourPct={prefermentFlourPct}
                  onFlourPctChange={setPrefermentFlourPct}
                  styleKey={styleKey ?? undefined}
                  hideTypes={['levain']}
                  kitchenTemp={kitchenTemp}
                />
              </StepCard>
            )}

            {/* ─── ADV STEP 10: Scheduler ──────────── */}
            <StepCard
              idPrefix="adv-step"
              num={9}
              title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={eatTime ? `${formatTime(startTime, locale)} → ${formatTime(eatTime, locale)}${blocks.length > 0 ? ` · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : ''}` : undefined}
              onEdit={() => setAdvancedStep(9)}
            >
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
              {eatTime && !reviewMode && <ContinueBtn onClick={() => { setPrefermentFlourPct(undefined); advanceAdv(9); }} />}
            </StepCard>

            {/* ─── ADV STEP 11: Dial your dough ────── */}
            <StepCard
              idPrefix="adv-step"
              num={10}
              title={t('dialIn.title')}
              activeStep={advancedStep}
              highestStep={advancedHighestStep}
              reviewMode={reviewMode}
              summary={manualHydration !== undefined ? `${manualHydration}% ${t('dialIn.hydrationSuffix')}` : styleKey ? `${ALL_STYLES[styleKey].hydration}% ${t('dialIn.hydrationSuffix')}` : undefined}
              onEdit={() => setAdvancedStep(10)}
            >
              <div>
                <div style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', marginBottom: '1rem', lineHeight: 1.5 }}>
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
                    <div style={{ marginBottom: '1.1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
                        <label style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                          Flour in {pData.name}
                        </label>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--char)' }}>
                          {currentPct}%
                        </span>
                      </div>
                      {/* Integrated colour bar slider — same pattern as Hydration */}
                      <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px',
                          background: 'linear-gradient(to right, #A8B8D0 0%, #A8B8D0 20%, #8BA888 20%, #8BA888 55%, #D4A853 55%, #D4A853 100%)',
                        }} />
                        <input
                          type="range"
                          min={10} max={60} step={5}
                          value={currentPct}
                          onChange={e => setPrefermentFlourPct(Number(e.target.value))}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', appearance: 'none', background: 'transparent', cursor: 'pointer', height: '36px', margin: 0, accentColor: 'var(--terra)' }}
                        />
                      </div>
                      <div style={{ position: 'relative', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem', marginBottom: '.5rem', height: '1rem' }}>
                        <span style={{ position: 'absolute', left: 0 }}>{t('prefermentSlider.longAhead')}</span>
                        <span style={{ position: 'absolute', left: '37.5%', transform: 'translateX(-50%)', color: 'var(--sage)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('prefermentSlider.nightBefore')}</span>
                        <span style={{ position: 'absolute', right: 0 }}>{t('prefermentSlider.sameDay')}</span>
                      </div>
                      {prefOffsetH > 0 && currentPct !== timeDefault && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '.1rem' }}>
                          <div style={{ fontSize: '.72rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                            For your {Math.round(prefOffsetH)}h window, {timeDefault}% of total flour is typical.
                          </div>
                          <button
                            onClick={() => setPrefermentFlourPct(undefined)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '.7rem', color: 'var(--smoke)',
                              fontFamily: 'var(--font-dm-sans)',
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
                    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
                        <label style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                          Dough Hydration
                        </label>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', fontWeight: 700, color: hZone.color }}>
                          {currentHyd}%
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px',
                          background: `linear-gradient(to right, #A8B8D0 0%, #A8B8D0 ${lowPct}%, #8BA888 ${lowPct}%, #8BA888 ${classicMaxPct}%, #D4A853 ${classicMaxPct}%, #D4A853 ${advancedMaxPct}%, #E8A898 ${advancedMaxPct}%, #E8A898 100%)`,
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
                          <div style={{ position: 'relative', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem', marginBottom: '.5rem', height: '1rem' }}>
                            <span style={{ position: 'absolute', left: 0 }}>{sliderMin}%</span>
                            <span style={{ position: 'absolute', left: `${greenCentrePct}%`, transform: 'translateX(-50%)', color: 'var(--sage)', fontWeight: 600, whiteSpace: 'nowrap' }}>{zone.classicMin}–{zone.classicMax}% classic</span>
                            <span style={{ position: 'absolute', right: 0 }}>{sliderMax}%</span>
                          </div>
                        );
                      })()}
                      {manualHydration === undefined && Math.abs(hydDiff) >= 0.5 && (
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--smoke)', marginTop: '4px', lineHeight: 1.4, marginBottom: '.5rem' }}>
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
                                >Use {styleBaseHyd}% ↩</span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {/* Zone pill + note: only shown when baker set value manually,
                          or when no engine adjustment is explaining the current value */}
                      {(manualHydration !== undefined || !hydAdjustNote) && (<>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem', marginBottom: '.25rem' }}>
                        <span style={{
                          fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)', fontWeight: 600,
                          color: hZone.color, flexShrink: 0,
                          background: hZone.color === 'var(--sage)' ? 'rgba(139,168,136,0.12)' :
                                      hZone.color === 'var(--gold)' ? 'rgba(212,168,83,0.12)' :
                                      hZone.color === '#C4624A' ? 'rgba(196,98,74,0.1)' : 'rgba(90,122,152,0.1)',
                          borderRadius: '20px', padding: '.2rem .6rem',
                        }}>
                          {hZone.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '.75rem' }}>
                        {hZone.note}
                      </div>
                      </>)}
                    </div>
                  );
                })()}

                {/* Salt · Oil · Sugar — one row, wraps on mobile */}
                <div style={{ paddingTop: '.25rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Salt stepper — first, most important */}
                  {(() => {
                    const styleSalt = styleKey ? (ALL_STYLES[styleKey]?.salt ?? 2.5) : 2.5;
                    const v = manualSalt ?? styleSalt;
                    const STEP = 0.1;
                    const isDefault = manualSalt === undefined || manualSalt === styleSalt;
                    return (
                      <div style={{ flex: 1, minWidth: '80px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                          <FieldLabel>{t('dialIn.saltPct')}</FieldLabel>
                          {!isDefault && (
                            <button
                              onClick={() => setManualSalt(undefined)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.65rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'underline', padding: 0 }}
                            >↺ {styleSalt}%</button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                          <button
                            onClick={() => setManualSalt(Math.max(1.5, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', color: 'var(--char)' }}>{v}%</span>
                          <button
                            onClick={() => setManualSalt(Math.min(3.5, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
                          >+</button>
                        </div>
                        <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4, marginTop: '.35rem' }}>
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
                      <div style={{ flex: 1 }}>
                        <div style={{ position: 'relative', marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>{t('dialIn.oilPct')}</span>
                          <button
                            onMouseEnter={() => setOilTip(true)} onMouseLeave={() => setOilTip(false)}
                            onClick={() => setOilTip(p => !p)}
                            style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}
                          >i</button>
                          {oilTip && (
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: v > 0 && isHighTemp ? 'var(--terra)' : '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(26,22,18,0.08)' }}>
                              {oilGuideText}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                          <button
                            onClick={() => setManualOil(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', color: 'var(--char)' }}>
                            {v === 0 ? 'None' : `${v}%`}
                          </span>
                          <button
                            onClick={() => setManualOil(Math.min(10, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
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
                      <div style={{ flex: 1 }}>
                        <div style={{ position: 'relative', marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>{t('dialIn.sugarPct')}</span>
                          <button
                            onMouseEnter={() => setSugarTip(true)} onMouseLeave={() => setSugarTip(false)}
                            onClick={() => setSugarTip(p => !p)}
                            style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}
                          >i</button>
                          {sugarTip && (
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: sg.warn ? 'var(--terra)' : '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(26,22,18,0.08)' }}>
                              {sg.note}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                          <button
                            onClick={() => setManualSugar(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
                          >−</button>
                          <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', color: 'var(--char)' }}>
                            {v === 0 ? 'None' : `${v}%`}
                          </span>
                          <button
                            onClick={() => setManualSugar(Math.min(10, Math.round((v + STEP) * 10) / 10))}
                            style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}
                          >+</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </div>
                {/* Precision — 4th sub-section inside Dial In */}
                <div style={{ marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem' }}>
                    Precision
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* DDT stepper */}
                    {(() => {
                      const styleFDT = styleKey ? ({ neapolitan:23, newyork:24, roman:25, pan:25, sourdough:24, pain_campagne:24, pain_levain:24, baguette:24, pain_complet:24, pain_seigle:24, fougasse:25, brioche:22, pain_mie:24, pain_viennois:23 } as Record<string,number>)[styleKey] ?? 24 : 24;
                      const v = targetDoughTemp ?? styleFDT;
                      const mixerFriction = mixerType ? ({ stand:5, hand:1, no_knead:0, spiral:8 } as Record<string,number>)[mixerType] ?? 3 : 3;
                      const isDefaultDDT = targetDoughTemp === undefined || targetDoughTemp === styleFDT;
                      return (
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>{t('dialIn.doughTemp')}</span>
                              <button
                                onMouseEnter={() => setDdtTip(true)} onMouseLeave={() => setDdtTip(false)}
                                onClick={() => setDdtTip(p => !p)}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}
                              >i</button>
                              {ddtTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(26,22,18,0.08)' }}>
                                  +{mixerFriction}°C friction from {mixerType === 'spiral' ? 'spiral' : mixerType === 'stand' ? 'stand' : 'hand'} mixer. Flour from fridge removes ~8°C.
                                </div>
                              )}
                            </div>
                            {!isDefaultDDT && (
                              <button onClick={() => setTargetDoughTemp(undefined)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.65rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'underline', padding: 0 }}>
                                ↺ {styleFDT}°C
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', marginBottom: '.4rem' }}>
                            <button onClick={() => setTargetDoughTemp(Math.max(18, v - 1))}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>−</button>
                            <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', color: 'var(--char)' }}>{v}°C</span>
                            <button onClick={() => setTargetDoughTemp(Math.min(28, v + 1))}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>+</button>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={flourInFridge} onChange={e => setFlourInFridge(e.target.checked)}
                              style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: 'var(--terra)', flexShrink: 0 }} />
                            <span style={{ fontSize: '.72rem', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>{t('dialIn.flourInFridge')}</span>
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                              <button
                                onMouseEnter={() => setFlourFridgeTip(true)} onMouseLeave={() => setFlourFridgeTip(false)}
                                onClick={e => { e.preventDefault(); setFlourFridgeTip(p => !p); }}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}
                              >i</button>
                              {flourFridgeTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(26,22,18,0.08)', whiteSpace: 'normal' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>{t('dialIn.mixingLoss')}</span>
                              <button
                                onMouseEnter={() => setMixLossTip(true)} onMouseLeave={() => setMixLossTip(false)}
                                onClick={() => setMixLossTip(p => !p)}
                                style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1px solid rgba(138,127,120,0.4)', background: 'none', cursor: 'pointer', fontSize: '9px', color: 'var(--smoke)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}
                              >i</button>
                              {mixLossTip && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#3D3530', lineHeight: 1.5, zIndex: 10, minWidth: '180px', maxWidth: '220px', fontFamily: 'DM Sans, sans-serif', boxShadow: '0 2px 8px rgba(26,22,18,0.08)' }}>
                                  Buffer for bowl residue and transfer losses. Schedule is unchanged — only ingredient quantities scale up.
                                </div>
                              )}
                            </div>
                            {wastePct !== undefined && wastePct !== 1.5 && (
                              <button onClick={() => setWastePct(undefined)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.65rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'underline', padding: 0 }}>
                                ↺ 1.5%
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                            <button onClick={() => setWastePct(Math.max(0, Math.round((v - STEP) * 10) / 10))}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>−</button>
                            <span style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', color: 'var(--char)' }}>
                              {wastePct === 0 ? 'None' : `${v}%`}
                            </span>
                            <button onClick={() => setWastePct(Math.min(5, Math.round((v + STEP) * 10) / 10))}
                              style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--cream)', fontSize: '.85rem', cursor: 'pointer', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>+</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </StepCard>

            {/* Precision section removed — merged into StepCard below */}

            {/* ── Generate button (setup tab) ── */}
            {canGenerate && eatTime && advancedStep > 9 && !(sessionRestored && recipeGenerated) && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={handleGenerate}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: '#C4522A',
                    color: 'white',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-dm-sans)',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(196,82,42,0.3)',
                  }}
                >
                  {t('generate.generateBtn')}
                </button>
              </div>
            )}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F5F0E8',
                  borderRadius: '10px',
                  padding: '10px 14px',
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
                      background: '#C4522A',
                      color: 'white',
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '8px',
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
                <div style={{ marginTop: '1rem' }}>
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
                        <div style={{ background: '#FEF4EF', border: '1.5px solid #F5C4B0', borderRadius: '12px', padding: '1.25rem', textAlign: 'center', color: 'var(--terra)', fontSize: '.88rem' }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                          <RecipeOutput
                            ovenType={ovenType}
                            onEditSetup={() => { setActiveTab('setup'); setReviewMode(true); }}
                            onOpenGuide={() => setActiveTab('guide')}
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
                          {schedule && (
                            <Timeline
                              schedule={schedule}
                              blocks={blocks}
                              preheatMin={preheatMin}
                              startTime={startTime}
                              eatTime={eatTime!}
                              mixerType={mixerType!}
                              styleKey={styleKey ?? ''}
                              oil={advancedRecipe?.oil ?? 0}
                              hydration={advancedRecipe?.hydration ?? 0}
                              numItems={numItems}
                              feedTime={feedTime}
                              kitchenTemp={kitchenTemp}
                              prefStartTime={prefStartTime}
                              prefermentType={prefermentType}
                              prefGoesInFridge={prefGoesInFridge}
                              prefRemoveFromFridgeTime={prefRemoveFromFridgeTime}
                              onStartBaking={() => setActiveTab('guide')}
                              bakeType={bakeType ?? undefined}
                              recipe={advancedRecipe ?? null}
                            />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {!(bakeTimeIsPast && sessionRestored) && eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '14px', background: 'var(--warm)', padding: '14px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>How did it go?</p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '10px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}>📷</span>}
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
                                flourInFridge, wastePct, priorityOverride,
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
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '10px', padding: '10px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)' }}
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
                  />
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: activeTab === 'guide' ? 'block' : 'none' }}>
              {!recipeGenerated ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>{t('common.generateFirst')}</div>
                </div>
              ) : schedule && advancedRecipe && mixerType && (
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
                />
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
                      flourInFridge, wastePct, priorityOverride,
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
                  onShare={async () => {
                    let id = bakeEventId;
                    if (!id && user) {
                      const { saveNamedSession } = await import('../lib/supabase/saveBakeEvent');
                      id = await saveNamedSession({
                        tab, bakeType: bakeType ?? '', styleKey, numItems, itemWeight,
                        pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
                        fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
                        manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
                        flourInFridge, wastePct, priorityOverride,
                        eatTime: eatTime?.getTime() ?? null,
                        blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
                        pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys, bakedQtys: Object.keys(bakedPartyQtys).length > 0 ? bakedPartyQtys : undefined } : null,
                        bakedDone,
                        computedRecipe: buildComputedRecipe(),
                      } as SessionData);
                      if (id) { setBakeEventId(id); setSessionSaved(true); }
                    }
                    if (id) setShareSessionId(id);
                  }}
                />
              </div>
            )}

          </div>
        )}

      </div>

      {/* ── Bottom nav ── */}
      {!!bakeType && <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#FDFBF7',
        borderTop: '1px solid #E0D8CF',
        display: 'flex',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {activeTab !== 'pizzaparty' ? (
          ([
            {
              key: 'setup' as const,
              label: t('tabs.setup'),
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 17V7" stroke={color} strokeWidth="1.4"/>
                  <path d="M4 5.5c2-.7 4-.7 6 1 2-1.7 4-1.7 6-1v11c-2-.7-4-.7-6 1-2-1.7-4-1.7-6-1V5.5z"
                    stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              ),
              locked: !recipeGenerated,
              done: false,
            },
          ] as const).map(({ key: tabKey, label, icon, locked, done }) => {
            const isActive = activeTab === tabKey;
            const activeColor = '#C4522A';
            const doneColor = '#6B7A5A';
            const lockedColor = '#C8C0B8';
            const color = locked ? lockedColor : isActive ? activeColor : done ? doneColor : '#8A7F78';
            return (
              <button
                key={tabKey}
                onClick={() => !locked && setActiveTab(tabKey)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 4px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: locked ? 'default' : 'pointer',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  background: isActive ? '#C4522A1A' : done ? '#6B7A5A14' : 'transparent',
                }}>
                  {icon(color)}
                  {done && (
                    <div style={{
                      position: 'absolute',
                      top: '1px',
                      right: '1px',
                      width: '11px',
                      height: '11px',
                      borderRadius: '50%',
                      background: '#6B7A5A',
                      border: '1.5px solid #FDFBF7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1.5 3.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '10px',
                  lineHeight: 1,
                  color,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {label}
                </span>
              </button>
            );
          })
        ) : (
          ([
            {
              key: 'pick' as const,
              label: t('tabs.pizzas'),
              unlocked: true,
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
              unlocked: pizzasConfirmed,
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
              unlocked: pizzasConfirmed,
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
              unlocked: pizzasConfirmed,
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                  stroke={color} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8.5" y="2" width="3" height="4" rx=".5" fill={color} stroke="none"/>
                  <path d="M2 17V11a8 4.5 0 0116 0v6" strokeWidth="1.4"/>
                  <line x1="1.5" y1="17" x2="18.5" y2="17" strokeWidth="1.4"/>
                  <path d="M6 17v-4.5a4 2.5 0 018 0V17" fill={color} fillOpacity="0.18" stroke="none"/>
                </svg>
              ),
            },
          ] as const).map(({ key: tabKey, label, icon, unlocked }) => {
            const isActive = pizzaPartyTab === tabKey;
            const activeColor = '#B8903A';
            const color = isActive ? activeColor : unlocked ? '#8A7F78' : '#C8C0B8';
            const opacity = isActive ? 1 : unlocked ? 1 : 0.4;
            return (
              <button
                key={tabKey}
                onClick={() => unlocked && setPizzaPartyTab(tabKey)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 4px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: unlocked ? 'pointer' : 'default',
                  opacity,
                }}
              >
                <div style={{
                  width: '40px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? '#B8903A1A' : 'transparent',
                }}>
                  {icon(color)}
                </div>
                <span style={{
                  fontSize: '10px',
                  lineHeight: 1,
                  color,
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'DM Sans, sans-serif',
                }}>
                  {label}
                </span>
              </button>
            );
          })
        )}
      </div>}

      {/* ── Sign-in nudge toast ── */}
      {showSignInForSave && (
        <div
          onClick={() => setShowSignInForSave(false)}
          style={{
            position: 'fixed', bottom: '24px', right: '16px',
            zIndex: 999, background: '#1A1612', color: 'var(--cream)',
            fontFamily: 'var(--font-dm-sans)', fontSize: '14px',
            borderRadius: '12px', padding: '12px 16px', maxWidth: '280px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            cursor: 'pointer', animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            {locale === 'fr'
              ? 'Connectez-vous pour sauvegarder vos sessions'
              : 'Sign in to save your sessions'}
          </span>
          <span style={{ color: 'var(--smoke)', fontSize: '16px',
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
            bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            zIndex: 9999,
            background: 'var(--terra)',
            color: 'white',
            border: 'none',
            borderRadius: '22px',
            padding: '11px 20px',
            fontSize: '13px',
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(196,82,42,0.35)',
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
          fontFamily: 'var(--font-playfair)', fontSize: '24px',
          fontWeight: 700, color: 'var(--char)', margin: '0 0 4px',
          lineHeight: 1.2,
        }}>
          {styleName}
        </p>
        <p style={{
          fontFamily: 'var(--font-dm-mono)', fontSize: '12px',
          color: 'var(--smoke)', margin: 0,
        }}>
          {dateStr}
        </p>
      </div>

      <p style={{
        fontFamily: 'var(--font-dm-sans)', fontSize: '18px',
        fontWeight: 600, color: 'var(--char)',
        margin: '16px 0 8px',
      }}>
        {l === 'fr' ? 'Cette fournée a-t-elle eu lieu ?' : 'Did this bake happen?'}
      </p>

      <button
        onClick={handleYes}
        disabled={saving}
        style={{
          width: '100%', padding: '15px',
          background: saving ? 'var(--smoke)' : 'var(--terra)',
          color: 'white', border: 'none', borderRadius: '12px',
          fontFamily: 'var(--font-dm-sans)', fontSize: '16px',
          fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          boxShadow: '0 2px 8px rgba(196,82,42,0.2)',
        }}
      >
        {saving ? '...' : (l === 'fr' ? 'Oui, je l\'ai fait ✓' : 'Yes, I baked it ✓')}
      </button>

      <button
        onClick={onNo}
        style={{
          width: '100%', padding: '13px',
          background: 'none', border: '1px solid var(--border)',
          borderRadius: '12px', cursor: 'pointer',
          fontFamily: 'var(--font-dm-mono)', fontSize: '13px',
          color: 'var(--smoke)',
        }}
      >
        {l === 'fr' ? '← Nouvelle fournée' : '← Start a new bake'}
      </button>
    </div>
  );
}
