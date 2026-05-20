'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import Header from '../components/Header';
import StylePicker from '../components/StylePicker';
import OvenPicker from '../components/OvenPicker';
import MixerPicker from '../components/MixerPicker';
import SchedulePicker from '../components/SchedulePicker';
import ClimatePicker from '../components/ClimatePicker';
import RecipeOutput from '../components/RecipeOutput';
import Timeline from '../components/Timeline';
import BakeGuide from '../components/BakeGuide';
import { getPrefPeakH_RT, getPrefRTWarmupH } from '../components/FermentChart';
import YeastHelper from '../components/YeastHelper';
import PizzaParty from '../components/PizzaParty';
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import type { SavedRecipe } from '../lib/supabase/fetchRecipes';
import { clearSession, loadSession, saveSession, type SessionData } from '../lib/session';
import { upsertBakeEvent } from '../lib/supabase/saveBakeEvent';
import type { BakeEvent } from '../lib/supabase/fetchBakeEvents';
import { useSessionSave } from '../hooks/useSessionSave';
import { type UnitSystem } from '../utils/units';
import {
  ALL_STYLES, OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PREFERMENT_TYPES,
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
function ContinueBtn({ onClick, label = 'Continue →' }: { onClick: () => void; label?: string }) {
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
      {label}
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


  // Sourdough feed time
  const [feedTime, setFeedTime] = useState<Date | null>(null);

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

  // Custom mode — fermentation plan recommended
  const [scheduleReady, setScheduleReady] = useState(false);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setProtocolStale(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Welcome back — hydrate full wizard state from localStorage on mount
  useEffect(() => {
    isRestoringRef.current = true;
    const session = loadSession();
    if (!session) {
      isRestoringRef.current = false;
      return;
    }

    // Discard expired sessions immediately — don't restore stale state
    const restoredEatTimeIsPast = session.eatTime
      ? new Date(session.eatTime) < new Date()
      : false;
    if (restoredEatTimeIsPast) {
      clearSession();
      isRestoringRef.current = false;
      return;
    }

    setTab(session.tab as 'simple' | 'custom');
    setBakeType(session.bakeType as BakeType | null);
    setStyleKey(session.styleKey as StyleKey | null);
    setNumItems(session.numItems);
    setItemWeight(session.itemWeight);
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

    if (session.pizzaParty?.qtys) setPizzaPartyQtys(session.pizzaParty.qtys);
    if (session.bakedDone) setBakedDone(true);
    setProtocolStale(false);
    setSessionRestored(true);
    setReviewMode(true);
    setActiveStep(99);
    setAdvancedStep(99);
    setShowWelcomeBack(true);
    setTimeout(() => { isRestoringRef.current = false; }, 200);
  }, []);

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

  useEffect(() => {
    setScheduleReady(false);
  }, [bakeType, styleKey]);

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

  const recipe = useMemo(() => {
    if (!styleKey || !schedule || !ovenType || !yeastType) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'simple',
        mixerType as MixerType,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType]);

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
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, manualSalt, targetDoughTemp, flourInFridge, wastePct, prefGoesInFridge]);

  const advancedDisplayRecipe = advancedRecipe;

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

  // Auto-save session to localStorage — placed after computed values to avoid TDZ
  useSessionSave(
    {
      tab, bakeType, styleKey, numItems, itemWeight, pizzaDiameter,
      ovenType, mixerType, yeastType,
      kitchenTemp, humidity, fridgeTemp,
      flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
      manualHydration, manualOil, manualSugar, manualSalt,
      targetDoughTemp, flourInFridge, wastePct, priorityOverride,
      startTime: startTime?.getTime() ?? null,
      eatTime: eatTime?.getTime() ?? null,
      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
      recipeGenerated, activeTab, modeChosen,
      pizzaParty: Object.keys(pizzaPartyQtys).length > 0 ? { qtys: pizzaPartyQtys } : null,
      bakedDone,
      computedRecipe: buildComputedRecipe(),
    },
    () => {},
  );

  const bakeTimeIsPast = useMemo(() => {
    if (!eatTime) return false;
    return new Date(eatTime) < new Date();
  }, [eatTime]);

  // ── Handlers ──────────────────────────────
  function selectBakeType(bt: BakeType) {
    setBakeType(bt);
    setStyleKey(null);
    setOvenType(null);
    setActiveStep(1);
    setHighestStep(1);
    setModeChosen(true);
  }

  function selectStyle(sk: StyleKey) {
    setStyleKey(sk);
    setManualHydration(undefined);
    setManualOil(oilDefault(sk));
    setManualSugar(sugarDefault(sk));
    // Smart oven default for bread styles
    if (bakeType === 'bread') {
      if (['brioche','pain_mie','pain_viennois','pain_seigle'].includes(sk)) {
        setOvenType('standard_bread');
      } else if (['baguette','fougasse'].includes(sk)) {
        setOvenType('home_oven_stone_bread');
      } else {
        setOvenType('dutch_oven');
      }
    }
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
    const next = from + 1;
    const target = next > highestStep ? next : highestStep;
    setHighestStep(target);
    setActiveStep(target);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      const el = document.getElementById(`step-${target}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 150);
  }

  function advanceAdv(from: number) {
    const next = from + 1;
    const target = next > advancedHighestStep ? next : advancedHighestStep;
    setAdvancedHighestStep(target);
    setAdvancedStep(target);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      const el = document.getElementById(`adv-step-${target}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 150);
  }

  function startOver() {
    setBakeType(null); setStyleKey(null);
    setNumItems(2); setItemWeight(270);
    setOvenType(null); setMixerType(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setEatTime(null);
    setBlocks([]); setYeastType(null);
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(6);
    setShowResults(false); setActiveStep(1); setHighestStep(1);
    setAdvancedStep(1); setAdvancedHighestStep(1); setFlourBlend({ flour1: 'pizza00', flour2: null, ratio1: 100 }); setPriorityOverride(undefined); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    setRecipeGenerated(false); setProtocolStale(false); setActiveTab('setup');
    setModeChosen(false);
    setPizzaPartyTab('pick');
    setPizzasConfirmed(false);
    customOnlyStateRef.current = null;
    clearSession();
    setSessionSaved(false);
    setSessionRestored(false);
    setReviewMode(false);
    setShowWelcomeBack(false);
    setBakeEventId(null);
    setPizzaPartyQtys({});
    setBakePhotoUrl(null);
    setBakedDone(false);
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
    console.log('GENERATE_PCT: prefermentFlourPct=' + prefermentFlourPct + ' timeDefault=' + (prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20) + ' effective=' + (prefermentFlourPct ?? (prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20)));
    justGeneratedRef.current = true;
    setReviewMode(false);
    setRecipeGenerated(true);
    setProtocolStale(false);
    setShowResults(true);
    setActiveTab('plan');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    if (user) {
      const sessionPayload = {
        tab, bakeType: bakeType ?? '', styleKey, numItems, itemWeight,
        pizzaDiameter, ovenType, mixerType, yeastType, kitchenTemp, humidity,
        fridgeTemp, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH,
        manualHydration, manualOil, manualSugar, manualSalt, targetDoughTemp,
        flourInFridge, wastePct, priorityOverride, prefGoesInFridge,
        eatTime: eatTime?.getTime() ?? null,
        blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime() })),
        recipeGenerated: true, activeTab: 'plan' as const, modeChosen,
        computedRecipe: buildComputedRecipe(),
      };
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

    // Advance to scheduler step (step 8 simple, step 10 custom)
    // All prior steps are marked completed
    if (isCustom) {
      setAdvancedStep(9);
    } else {
      setActiveStep(7);
    }

    // Scroll to scheduler step after state settles
    setTimeout(() => {
      const stepId = isCustom ? 'adv-step-9' : 'step-7';
      const el = document.getElementById(stepId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  // ── Computed: Generate button / progress ──
  const simpleRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime);
  const customRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && flourBlend);
  const canGenerate = tab === 'simple' ? simpleRequiredDone : customRequiredDone;

  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // ── Render ────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* ── Sticky header + journey bar (autohide on scroll down) ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transform: navHidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.25s ease',
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
            const styleName = (ALL_STYLES as Record<string, { name?: string }>)[styleKey]?.name ?? styleKey;
            const dateStr = eatTime.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = formatTime(eatTime);
            const itemLabel = bakeType === 'bread'
              ? (numItems === 1 ? 'loaf' : 'loaves')
              : (numItems === 1 ? 'pizza' : 'pizzas');
            return `${styleName} · ${numItems} ${itemLabel} · ${dateStr}, ${timeStr}`;
          })()}
          sessionDoughSpec={tab === 'custom' && manualHydration !== undefined
            ? `${manualHydration}% · ${prefermentType !== 'none' ? prefermentType.charAt(0).toUpperCase() + prefermentType.slice(1) + ' · ' : ''}Custom`
            : ''}
          onSaveSession={async () => {
            const sessionPayload = {
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
              computedRecipe: buildComputedRecipe(),
            };
            const currentQtys = pizzaPartyGetQtysRef.current?.() ?? pizzaPartyQtys;
            saveSession(sessionPayload);
            if (user) {
              const { saveNamedSession, savePizzaPartySelections, updateBakeEvent } = await import('../lib/supabase/saveBakeEvent');
              let id = bakeEventId;
              if (!id) {
                id = await saveNamedSession(sessionPayload as SessionData);
                if (id) setBakeEventId(id);
              } else {
                await updateBakeEvent(id, sessionPayload as SessionData);
              }
              if (id) {
                if (Object.keys(currentQtys).length > 0 && styleKey) {
                  await savePizzaPartySelections(id, currentQtys, styleKey);
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
                setSessionSaved(true);
              }
            } else {
              setShowSignInForSave(true);
              setTimeout(() => setShowSignInForSave(false), 4000);
              setSessionSaved(true);
            }
          }}
          onNewSession={startOver}
          onResumeBakeEvent={async (event: BakeEvent) => {
            if (!event.dough_snapshot) return;
            isRestoringRef.current = true;
            const snap = event.dough_snapshot;
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
            if (snap.eatTime) setEatTime(new Date(snap.eatTime));
            if (snap.startTime) setStartTime(new Date(snap.startTime));
            if (snap.blocks?.length) {
              setBlocks((snap.blocks as unknown[]).map((b) => {
                const bl = b as { label: string; from: number; to: number };
                return { label: bl.label, from: new Date(bl.from), to: new Date(bl.to) };
              }));
            }
            setRecipeGenerated(snap.recipeGenerated);
            setModeChosen(snap.modeChosen);
            setBakeEventId(event.id);
            if (snap.recipeGenerated) {
              setActiveTab(snap.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty');
              setAdvancedStep(snap.tab === 'custom' ? 99 : 1);
              setActiveStep(snap.tab === 'custom' ? 1 : 99);
              setShowResults(true);
              setProtocolStale(false);
              setSessionSaved(true);
              setSessionRestored(true);
              setReviewMode(true);
              setActiveTab('setup');
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
          }}
        />


        {bakeType && (
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

          {/* Pizza / Bread picker — full cards before selection, compact toggle after */}
          {!bakeType && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', margin: '0 0 16px' }}>
            {([
              { type: 'pizza' as BakeType, image: '/pizzas/margherita.webp', label: t('bakeType.pizza.label'), desc: t('bakeType.pizza.desc'), activeBorder: 'var(--terra)', activeBg: '#FFF8F3' },
              { type: 'bread' as BakeType, image: '/pain_campagne.webp', label: t('bakeType.bread.label'), desc: t('bakeType.bread.desc'), activeBorder: 'var(--bread)', activeBg: 'var(--bread-l)' },
            ]).map(opt => (
              <div
                key={opt.type}
                onClick={() => {
                  selectBakeType(opt.type);
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
                {/* Full-bleed image */}
                <img
                  src={opt.image}
                  alt={opt.label}
                  style={{ width: '100%', height: '38vh', objectFit: 'cover', display: 'block' }}
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
              <div style={{ display: 'flex', gap: '8px', marginBottom: bakeType === 'pizza' ? '12px' : '0' }}>
                {([
                  { key: 'simple' as const, title: t('modeCards.simple.title'), collapsed: t('modeCards.simple.collapsed') },
                  { key: 'custom' as const, title: t('modeCards.custom.title'), collapsed: t('modeCards.custom.collapsed') },
                ]).map(m => (
                  <div
                    key={m.key}
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
                      suppressNextScrollRef.current = true;
                    }}
                    style={{
                      flex: 1,
                      border: tab === m.key ? '2px solid var(--terra)' : '0.5px solid var(--border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      background: tab === m.key ? 'white' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '14px', fontWeight: 700, color: 'var(--char)' }}>
                        {m.title}
                      </span>
                      </div>
                    <div style={{ fontSize: '11px', color: 'var(--smoke)', lineHeight: 1.7 }}>
                      {m.collapsed.split('|').map((line, i) => (
                        <div key={i}>{line.trim()}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

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
                ↩ Previous session loaded — review your settings below
              </div>
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
                <StylePicker bakeType={bakeType} selected={styleKey} onSelect={selectStyle} />
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
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>◎ Diameter</div>
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
                          <button onClick={() => { const w = Math.max(150, itemWeight - 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: '64px', justifyContent: 'center' }}>
                            <input type="number" min={150} max={500} step={5} value={itemWeight}
                              onChange={e => { const w = Math.max(150, Math.min(500, Math.round(+e.target.value / 5) * 5)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(500, itemWeight + 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
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
              />
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
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advance(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
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
              />
            </StepCard>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepCard
              num={7} title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={activeStep}
              highestStep={highestStep}
              reviewMode={reviewMode}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : undefined}
              onEdit={() => setActiveStep(7)}
            >
              <SchedulePicker
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
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                sessionRestored={sessionRestored}
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
                      styleName={ALL_STYLES[styleKey as StyleKey]?.name ?? styleKey ?? ''}
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
                            result={displayRecipe ?? recipe}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={ALL_STYLES[styleKey!].name}
                            mixerType={mixerType!}
                            kitchenTemp={kitchenTemp}
                            fridgeTemp={fridgeTemp}
                            fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                            totalColdHours={schedule ? schedule.totalColdHours : 0}
                            mode={tab}
                            bakeType={bakeType ?? 'pizza'}
                            flourBlend={flourBlend}
                            units={units}
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
                <>
                  {/* Start Bake Guide CTA */}
                  <button
                    onClick={() => setActiveTab('guide')}
                    style={{
                      background: 'var(--terra)',
                      border: 'none',
                      color: 'var(--cream)',
                      borderRadius: '12px',
                      padding: '10px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      width: '100%',
                      marginTop: '12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans)',
                      letterSpacing: '.01em',
                    }}
                  >
                    {t('tabs.guide')} →
                  </button>

                  {/* Edit setup button */}
                  <button
                    onClick={() => { setActiveTab('setup'); setReviewMode(true); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--smoke)',
                      fontSize: '14px',
                      fontWeight: 500,
                      width: '100%',
                      marginTop: '10px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '4px 0',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {t('generate.editSetup')}
                  </button>
                </>
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
                  feedTime={feedTime}
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
                ↩ Previous session loaded — review your settings below
              </div>
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
                          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>◎ Diameter</div>
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
                          <button onClick={() => { const w = Math.max(150, itemWeight - 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', minWidth: '64px', justifyContent: 'center' }}>
                            <input type="number" min={150} max={500} step={5} value={itemWeight}
                              onChange={e => { const w = Math.max(150, Math.min(500, Math.round(+e.target.value / 5) * 5)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                              style={{ width: '48px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '1.1rem', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                            <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--smoke)' }}>g</span>
                          </div>
                          <button onClick={() => { const w = Math.min(500, itemWeight + 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
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
              />
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
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advanceAdv(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
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
                    setTimeout(() => {
                      const el = document.getElementById('adv-step-9');
                      if (el) {
                        const top = el.getBoundingClientRect().top + window.scrollY - 70;
                        window.scrollTo({ top, behavior: 'smooth' });
                      }
                    }, 150);
                  } else {
                    if (prefermentType === 'levain') setPrefermentType('none');
                    advanceAdv(7);
                  }
                }}
                onClose={() => {}}
              />
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
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : undefined}
              onEdit={() => setAdvancedStep(9)}
            >
              <SchedulePicker
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
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onReady={() => {}}
                sessionRestored={sessionRestored}
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
                  Defaults are set for your style — adjust if you know what you&apos;re doing.
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
                      styleName={ALL_STYLES[styleKey as StyleKey]?.name ?? styleKey ?? ''}
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
                            result={advancedDisplayRecipe ?? advancedRecipe}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={ALL_STYLES[styleKey!].name}
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
                <>
                  {/* Start Bake Guide CTA */}
                  <button
                    onClick={() => setActiveTab('guide')}
                    style={{
                      background: 'var(--terra)',
                      border: 'none',
                      color: 'var(--cream)',
                      borderRadius: '12px',
                      padding: '10px 0',
                      fontSize: '14px',
                      fontWeight: 600,
                      width: '100%',
                      marginTop: '12px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans)',
                      letterSpacing: '.01em',
                    }}
                  >
                    {t('tabs.guide')} →
                  </button>

                  {/* Edit setup button */}
                  <button
                    onClick={() => { setActiveTab('setup'); setReviewMode(true); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--smoke)',
                      fontSize: '14px',
                      fontWeight: 500,
                      width: '100%',
                      marginTop: '10px',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: '4px 0',
                      fontFamily: 'var(--font-dm-sans)',
                    }}
                  >
                    {t('generate.editSetup')}
                  </button>
                </>
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
                  feedTime={feedTime}
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

      {/* ── Welcome back toast ── */}
      {showWelcomeBack && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--char)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeInUp 0.3s ease',
          minWidth: 260,
          maxWidth: 320,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
              letterSpacing: '.08em',
            }}>
              {locale === 'fr' ? 'Session précédente trouvée' : 'Previous session found'}
            </span>
            <button
              onClick={() => setShowWelcomeBack(false)}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                fontSize: '14px', padding: '0 0 0 8px', lineHeight: 1,
              }}
            >✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowWelcomeBack(false)}
              style={{
                flex: 1, background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '13px',
                fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
                padding: '8px 14px', borderRadius: '8px', whiteSpace: 'nowrap',
              }}
            >
              {locale === 'fr' ? 'Reprendre →' : 'Resume →'}
            </button>
            <button
              onClick={() => { startOver(); setShowWelcomeBack(false); }}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                fontSize: '11px', fontFamily: 'var(--font-dm-mono)',
                padding: '4px 0', whiteSpace: 'nowrap',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              {locale === 'fr' ? 'Nouveau bake' : 'Start fresh'}
            </button>
          </div>
        </div>
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
        {l === 'fr' ? 'Ce bake a-t-il eu lieu ?' : 'Did this bake happen?'}
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
