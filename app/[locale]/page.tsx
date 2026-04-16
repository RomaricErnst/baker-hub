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
import ToppingSelector from '../components/ToppingSelector';
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import { saveRecipe } from '../lib/supabase/saveRecipe';
import type { SavedRecipe } from '../lib/supabase/fetchRecipes';
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
  num, title, activeStep, summary, onEdit, children, idPrefix = 'step',
}: {
  num: number;
  title: string;
  activeStep: number;
  summary?: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
  idPrefix?: string;
}) {
  const isActive    = activeStep === num;
  const isCompleted = activeStep > num;
  const isLocked    = activeStep < num;

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
  const [advancedStep, setAdvancedStep] = useState(1);
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
  const [fridgeTemp, setFridgeTemp] = useState(4);
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
  const [showYeastHelper, setShowYeastHelper] = useState(false);
  const [showResults, setShowResults]         = useState(false);


  // Sourdough feed time
  const [feedTime, setFeedTime] = useState<Date | null>(null);

  // Advanced mode manual overrides
  const [prefermentType, setPrefermentType] = useState<PrefermentType>('none');
  const [prefermentFlourPct, setPrefermentFlourPct] = useState<number | undefined>(undefined);
  const [prefOffsetH, setPrefOffsetH] = useState<number>(0);

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);
  const [manualSalt, setManualSalt]           = useState<number | undefined>(undefined);
  const [targetDoughTemp, setTargetDoughTemp] = useState<number | undefined>(undefined);
  const [flourInFridge, setFlourInFridge]     = useState<boolean>(false);
  const [wastePct, setWastePct]               = useState<number | undefined>(undefined);

  // BakeType card hover state
  const [hoveredBakeType, setHoveredBakeType] = useState<BakeType | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const resultsRef           = useRef<HTMLDivElement>(null);
  const modeSelectorRef      = useRef<HTMLDivElement>(null);
  const suppressNextScrollRef = useRef(false);

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
  const [pizzaPartyEnabled, setPizzaPartyEnabled] = useState(false);
  const [pizzaPartyPill, setPizzaPartyPill] = useState<'pizzas' | 'shopping' | 'party'>('pizzas');

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
    });
    return () => subscription.unsubscribe();
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

  // Two-temperature poolish protocol — fridge flag and remove-from-fridge time
  const prefGoesInFridge = useMemo(() => {
    if (!prefermentType || prefermentType === 'none' || prefermentType === 'levain') return false;
    const rtPeakH = getPrefPeakH_RT(prefermentType, kitchenTemp, styleKey ?? 'neapolitan');
    return prefermentType === 'biga' || prefOffsetH > rtPeakH;
  }, [prefermentType, kitchenTemp, styleKey, prefOffsetH]);

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
        prefermentFlourPct,
        manualSalt,
        targetDoughTemp,
        flourInFridge,
        wastePct,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct, manualSalt, targetDoughTemp, flourInFridge, wastePct]);

  const advancedDisplayRecipe = advancedRecipe;

  // ── Handlers ──────────────────────────────
  function selectBakeType(bt: BakeType) {
    setBakeType(bt);
    setStyleKey(null);
    setOvenType(bt === 'bread' ? 'dutch_oven' : 'home_oven_steel');
    setActiveStep(1);
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
    advance(2);
  }

  function advance(from: number) {
    setActiveStep(from + 1);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      const el = document.getElementById(`step-${from + 1}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 150);
  }

  function advanceAdv(from: number) {
    setAdvancedStep(from + 1);
    setTimeout(() => {
      if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
      const el = document.getElementById(`adv-step-${from + 1}`);
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
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(4);
    setShowResults(false); setActiveStep(1);
    setAdvancedStep(1); setFlourBlend({ flour1: 'pizza00', flour2: null, ratio1: 100 }); setPriorityOverride(undefined); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    setRecipeGenerated(false); setProtocolStale(false); setActiveTab('setup');
    setModeChosen(false);
    customOnlyStateRef.current = null;
  }

  function handleGenerate() {
    if (recipeGenerated && user) {
      const msg = t('generate.confirmOverwrite');
      if (!window.confirm(msg)) return;
    }
    if (prefermentType !== 'none' && prefermentFlourPct === undefined) {
      const timeDefault = prefOffsetH <= 4 ? 45 : prefOffsetH <= 7 ? 40 : prefOffsetH <= 12 ? 30 : 20;
      setPrefermentFlourPct(timeDefault);
    }
    justGeneratedRef.current = true;
    setRecipeGenerated(true);
    setProtocolStale(false);
    setShowResults(true);
    setActiveTab('plan');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  async function handleSaveRecipe(recipeMode: 'simple' | 'custom') {
    if (!styleKey || !schedule || !ovenType || !mixerType || !yeastType) return;
    const activeRecipe = recipeMode === 'custom' ? (advancedDisplayRecipe ?? advancedRecipe) : (displayRecipe ?? recipe);
    if (!activeRecipe) return;
    setSaveStatus('saving');
    const result = await saveRecipe({
      mode: recipeMode,
      styleKey,
      bakeType: bakeType ?? 'pizza',
      numItems,
      itemWeight,
      ovenType: ovenType as OvenType,
      mixerType,
      yeastType,
      kitchenTemp,
      humidity,
      fridgeTemp,
      startTime,
      eatTime,
      flour: activeRecipe.flour,
      water: activeRecipe.water,
      salt: activeRecipe.salt,
      yeastGrams: activeRecipe.yeast?.convertedGrams ?? null,
      hydration: activeRecipe.hydration,
      totalColdHours: schedule.totalColdHours,
      totalRTHours: schedule.totalRTHours,
      prefermentType: prefermentType !== 'none' ? prefermentType : undefined,
      prefermentFlourPct: prefermentFlourPct,
      manualOil: manualOil,
      manualSugar: manualSugar,
      manualSalt: manualSalt,
      flourBlend: flourBlend,
      targetDoughTemp: targetDoughTemp,
      wastePct: wastePct,
    });
    setSaveStatus(result.success ? 'saved' : 'error');
    if (result.success) setTimeout(() => setSaveStatus('idle'), 3000);
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
    setFridgeTemp(r.fridge_temp ?? 4);

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

  const simpleStepsCompleted = [
    !!styleKey,
    !!(numItems && itemWeight),
    !!ovenType,
    kitchenTemp > 0,
    !!mixerType,
    !!yeastType,
    !!eatTime,
  ].filter(Boolean).length;
  const simpleStepsTotal = 7;
  const customStepsCompleted = [
    !!styleKey,
    !!(numItems && itemWeight),
    !!ovenType,
    kitchenTemp > 0,
    !!mixerType,
    !!(flourBlend?.flour1),
    !!yeastType,
    true,
    (manualHydration ?? 0) > 0,
    !!eatTime,
  ].filter(Boolean).length;
  const customStepsTotal = 10;
  const progressFraction = tab === 'simple'
    ? (simpleRequiredDone ? 1 : (activeStep - 1) / simpleStepsTotal)
    : (customRequiredDone ? 1 : (advancedStep - 1) / customStepsTotal);

  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // ── Render ────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Header units={units} onUnitsChange={setUnitsAndPersist} onLoadRecipe={loadRecipe} />

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.5rem) 80px' }}>

        {/* ── Hero + bake type picker ── */}
        {activeTab === 'setup' && (
        <div ref={modeSelectorRef} style={{ textAlign: 'center', marginBottom: '16px' }}>
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

          {/* Pizza / Bread picker — full cards before selection, compact toggle after */}
          {!bakeType ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', margin: '0 0 16px' }}>
            {([
              { type: 'pizza' as BakeType, image: '/bake_pizza.png', label: t('bakeType.pizza.label'), desc: t('bakeType.pizza.desc'), activeBorder: 'var(--terra)', activeBg: '#FFF8F3' },
              { type: 'bread' as BakeType, image: '/bake_bread.png', label: t('bakeType.bread.label'), desc: t('bakeType.bread.desc'), activeBorder: 'var(--bread)', activeBg: 'var(--bread-l)' },
            ]).map(opt => (
              <div
                key={opt.type}
                onClick={() => {
                  selectBakeType(opt.type);
                  if (opt.type === 'bread') setPizzaPartyEnabled(false);
                }}
                onMouseEnter={() => setHoveredBakeType(opt.type)}
                onMouseLeave={() => setHoveredBakeType(null)}
                style={{
                  padding: '1.5rem 1rem 1.25rem',
                  textAlign: 'center',
                  borderRadius: '18px',
                  cursor: 'pointer',
                  border: `2px solid ${bakeType === opt.type ? opt.activeBorder : 'var(--border)'}`,
                  background: bakeType === opt.type ? opt.activeBg : 'var(--card)',
                  boxShadow: hoveredBakeType === opt.type
                    ? 'var(--card-shadow-hover)'
                    : bakeType === opt.type
                      ? `0 0 0 4px ${opt.type === 'bread' ? 'rgba(139,105,20,.1)' : 'rgba(196,82,42,.1)'}`
                      : 'var(--card-shadow)',
                  transform: hoveredBakeType === opt.type ? 'translateY(-3px)' : 'none',
                  transition: 'all .2s',
                }}
              >
                <img src={opt.image} alt={opt.label} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '.75rem' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '.25rem' }}>{opt.label}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.5 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
          ) : (
          <div style={{ display: 'flex', gap: '8px', margin: '0 0 12px' }}>
            {([
              { type: 'pizza' as BakeType, image: '/bake_pizza.png', label: t('bakeType.pizza.label') },
              { type: 'bread' as BakeType, image: '/bake_bread.png', label: t('bakeType.bread.label') },
            ]).map(opt => (
              <div
                key={opt.type}
                onClick={() => {
                  selectBakeType(opt.type);
                  if (opt.type === 'bread') setPizzaPartyEnabled(false);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: `2px solid ${bakeType === opt.type
                    ? (opt.type === 'pizza' ? 'var(--terra)' : 'var(--bread)')
                    : 'var(--border)'}`,
                  background: bakeType === opt.type
                    ? (opt.type === 'pizza' ? '#FFF8F3' : 'var(--bread-l)')
                    : 'var(--card)',
                  transition: 'all 0.15s',
                }}
              >
                <img
                  src={opt.image}
                  alt={opt.label}
                  style={{
                    width: '32px',
                    height: '32px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontSize: '13px',
                  fontWeight: bakeType === opt.type ? 600 : 400,
                  color: bakeType === opt.type
                    ? (opt.type === 'pizza' ? 'var(--terra)' : 'var(--bread)')
                    : 'var(--smoke)',
                }}>
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
          )}

          {/* Mode + Pizza Night card — only shown after bakeType selected */}
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
                    <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '14px', fontWeight: 700, color: 'var(--char)', marginBottom: '2px' }}>
                      {m.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--smoke)' }}>
                      {m.collapsed}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pizza Night checkbox — pizza only */}
              {bakeType === 'pizza' && (
                <div
                  onClick={() => { setPizzaPartyEnabled(v => !v); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: pizzaPartyEnabled ? '1.5px solid #D4A853' : '1px dashed #D4A853',
                    background: pizzaPartyEnabled ? '#FFF9EE' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                    border: pizzaPartyEnabled ? 'none' : '1.5px solid #D4A853',
                    background: pizzaPartyEnabled ? '#D4A853' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pizzaPartyEnabled && (
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1612', marginBottom: '1px' }}>
                      {t('pizzaParty.checkboxTitle')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8A7F78' }}>
                      {t('pizzaParty.checkboxSub')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── Progress bar ── */}
        <div style={{
          position: 'sticky',
          top: '62px',
          zIndex: 10,
          background: 'var(--warm)',
          paddingBottom: '8px',
          marginBottom: '4px',
        }}>
          <div style={{
            height: '2px',
            background: '#E8E0D5',
            borderRadius: '1px',
            margin: '8px 0 0',
          }}>
            <div style={{
              height: '2px',
              background: '#C4522A',
              borderRadius: '1px',
              width: `${progressFraction * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        {/* ════════════ GUIDED ════════════ */}
        {tab === 'simple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>

            {/* ─── STEP 1: Style picker ────────────── */}
            <StepCard
              num={1} title={t('steps.2.title')}
              activeStep={activeStep}
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

                    {/* ── ROW 2: Diameter + Weight — two equal tiles ── */}
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

                    {/* ── ROW 3: Cornicione — compact, secondary ── */}
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
              <ContinueBtn onClick={() => advance(2)} />
            </StepCard>

            {/* ─── STEP 4: Oven ────────────────────── */}
            <StepCard
              num={3} title={t('steps.4.title')}
              activeStep={activeStep}
              summary={ovenData ? (locale === 'fr' && (ovenData as { nameFr?: string }).nameFr ? (ovenData as { nameFr: string }).nameFr : ovenData.name) : ''}
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
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setActiveStep(4)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              <ContinueBtn onClick={() => advance(4)} />
            </StepCard>

            {/* ─── STEP 6: Mixer ───────────────────── */}
            <StepCard
              num={5} title={t('steps.6.title')}
              activeStep={activeStep}
              summary={mixerType ? (locale === 'fr' && (MIXER_TYPES[mixerType] as { nameFr?: string }).nameFr ? (MIXER_TYPES[mixerType] as { nameFr: string }).nameFr : MIXER_TYPES[mixerType].name) : undefined}
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
              summary={yeastType ? (locale === 'fr' && (YEAST_TYPES[yeastType] as { nameFr?: string }).nameFr ? (YEAST_TYPES[yeastType] as { nameFr: string }).nameFr : YEAST_TYPES[yeastType].name) : undefined}
              onEdit={() => setActiveStep(6)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.65rem' }}>
                  {(Object.entries(YEAST_TYPES) as [YeastType, typeof YEAST_TYPES[YeastType]][]).filter(([yt]) => yt !== 'sourdough').map(([yt, y]) => {
                    const active = yeastType === yt;
                    const yImg = (y as { image?: string }).image;
                    const guidedDesc: Record<string, string> = {
                      instant:    t('yeastDesc.simple.instant'),
                      active_dry: t('yeastDesc.simple.active_dry'),
                      fresh:      t('yeastDesc.simple.fresh'),
                      sourdough:  t('yeastDesc.simple.sourdough'),
                    };
                    return (
                      <div
                        key={yt}
                        onClick={() => { setYeastType(yt); advance(6); }}
                        style={{
                          border: `2px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                          borderRadius: '14px', padding: '.75rem .75rem',
                          cursor: 'pointer', background: active ? '#FEF4EF' : 'var(--warm)',
                          transition: 'all .15s', textAlign: 'left',
                          display: 'flex', flexDirection: 'row', alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        {yImg ? (
                          <img src={yImg} alt={y.name}
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: '1.5rem', display: 'block', flexShrink: 0, width: '48px', textAlign: 'center' }}>{y.emoji}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--char)', marginBottom: '.2rem' }}>
                            {locale === 'fr' && (y as { nameFr?: string }).nameFr ? (y as { nameFr: string }).nameFr : y.name}
                          </div>
                          <span style={{
                            fontSize: '.65rem', fontFamily: 'var(--font-dm-sans)',
                            color: 'var(--smoke)', lineHeight: 1.45,
                            display: 'block',
                          }}>
                            {guidedDesc[yt]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowYeastHelper(true)}
                  className="btn"
                  style={{
                    padding: '.38rem .75rem', borderRadius: '20px',
                    border: '1.5px solid var(--border)', background: 'var(--warm)',
                    color: 'var(--smoke)', fontSize: '.75rem', cursor: 'pointer',
                  }}
                >
                  {t('common.notSure')}
                </button>
              </div>
            </StepCard>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepCard
              num={7} title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={activeStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : undefined}
              onEdit={() => setActiveStep(7)}
            >
              <SchedulePicker
                mode="simple"
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onFeedTimeChange={setFeedTime}
                onPrefOffsetChange={setPrefOffsetH}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
              />
            </StepCard>

            {/* ── Generate button (setup tab) ── */}
            {canGenerate && (
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
                  {pizzaPartyEnabled ? t('pizzaParty.generateBtn') : t('generate.generateBtn')}
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

                  {/* Results header now lives inside RecipeOutput */}

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
                        fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                        totalColdHours={schedule ? schedule.totalColdHours : 0}
                        mode={tab}
                        bakeType={bakeType ?? 'pizza'}
                        flourBlend={flourBlend}
                        units={units}
                        saveStatus={user ? saveStatus : undefined}
                        onSave={user ? () => handleSaveRecipe('simple') : undefined}
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
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Start Bake Guide CTA */}
              <button
                onClick={() => setActiveTab('guide')}
                style={{
                  background: 'var(--terra)',
                  border: 'none',
                  color: 'var(--cream)',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  width: '100%',
                  marginTop: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                ▶ Start Bake Guide
              </button>

              {/* Edit setup button */}
              <button
                onClick={() => setActiveTab('setup')}
                style={{
                  background: 'transparent',
                  border: '1px solid #C4522A',
                  color: '#C4522A',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  width: '100%',
                  marginTop: '8px',
                  cursor: 'pointer',
                }}
              >
                {t('generate.editSetup')}
              </button>

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
                />
              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: activeTab === 'pizzaparty' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
                <ToppingSelector
                  locale={locale}
                  numItems={numItems}
                  activePill={pizzaPartyPill}
                  onPillChange={setPizzaPartyPill}
                  t={t}
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

            {/* ─── ADV STEP 1: Style picker ────────── */}
            <StepCard
              idPrefix="adv-step"
              num={1} title={t('steps.2.title')}
              activeStep={advancedStep}
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

                    {/* ROW 2: Diameter + Weight tiles */}
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

                    {/* ROW 3: Cornicione */}
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
              <ContinueBtn onClick={() => advanceAdv(2)} />
            </StepCard>

            {/* ─── ADV STEP 4: Oven ────────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={3} title={t('steps.4.title')}
              activeStep={advancedStep}
              summary={ovenData ? (locale === 'fr' && (ovenData as { nameFr?: string }).nameFr ? (ovenData as { nameFr: string }).nameFr : ovenData.name) : ''}
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
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setAdvancedStep(4)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                units={units}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />
              <ContinueBtn onClick={() => advanceAdv(4)} />
            </StepCard>

            {/* ─── ADV STEP 6: Mixer ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={5} title={t('steps.6.title')}
              activeStep={advancedStep}
              summary={mixerType ? (locale === 'fr' && (MIXER_TYPES[mixerType] as { nameFr?: string }).nameFr ? (MIXER_TYPES[mixerType] as { nameFr: string }).nameFr : MIXER_TYPES[mixerType].name) : undefined}
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
              summary={(() => {
                if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                  // brandProduct holds the actual selected flour name (e.g. "Auchan Farine T55")
                  // fall back to generic tile name only when no specific flour was selected
                  return flourBlend.brandProduct ?? computeBlendProfile(flourBlend).displayName;
                }
                const ratio2 = 100 - flourBlend.ratio1;
                const flour1Name = flourBlend.brandProduct ?? computeBlendProfile({ ...flourBlend, flour2: null, ratio1: 100 }).displayName;
                const flour2Name = flourBlend.customFlour2Name ?? computeBlendProfile(flourBlend).displayName.split('+')[1]?.trim() ?? '';
                return `${flourBlend.ratio1}% ${flour1Name} · ${ratio2}% ${flour2Name}`;
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
              summary={yeastType ? <>{locale === 'fr' && (YEAST_TYPES[yeastType] as { nameFr?: string }).nameFr ? (YEAST_TYPES[yeastType] as { nameFr: string }).nameFr : YEAST_TYPES[yeastType].name} · <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', fontSize: '.85em' }}>{locale === 'fr' && (YEAST_TYPES[yeastType] as { shortNameFr?: string }).shortNameFr ? (YEAST_TYPES[yeastType] as { shortNameFr: string }).shortNameFr : YEAST_TYPES[yeastType].shortName}</span></> : undefined}
              onEdit={() => setAdvancedStep(7)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.65rem' }}>
                  {(Object.entries(YEAST_TYPES) as [YeastType, typeof YEAST_TYPES[YeastType]][]).map(([yt, y]) => {
                    const active = yeastType === yt;
                    const yImg = (y as { image?: string }).image;
                    const advDesc: Record<string, string> = {
                      instant:    t('yeastDesc.custom.instant'),
                      active_dry: t('yeastDesc.custom.active_dry'),
                      fresh:      t('yeastDesc.custom.fresh'),
                      sourdough:  t('yeastDesc.custom.sourdough'),
                    };
                    return (
                      <div
                        key={yt}
                        onClick={() => {
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
                            // switching away from sourdough: reset levain preferment
                            if (prefermentType === 'levain') setPrefermentType('none');
                            advanceAdv(7);
                          }
                        }}
                        style={{
                          border: `2px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                          borderRadius: '14px', padding: '.75rem .75rem',
                          cursor: 'pointer', background: active ? '#FEF4EF' : 'var(--warm)',
                          transition: 'all .15s', textAlign: 'left',
                          display: 'flex', flexDirection: 'row', alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        {yImg ? (
                          <img src={yImg} alt={y.name}
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: '1.5rem', display: 'block', flexShrink: 0, width: '48px', textAlign: 'center' }}>{y.emoji}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--char)', marginBottom: '.2rem' }}>
                            {locale === 'fr' && (y as { nameFr?: string }).nameFr ? (y as { nameFr: string }).nameFr : y.name}
                          </div>
                          <span style={{
                            fontSize: '.65rem', fontFamily: 'var(--font-dm-sans)',
                            color: 'var(--smoke)', lineHeight: 1.45,
                            display: 'block',
                          }}>
                            {advDesc[yt]}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowYeastHelper(true)}
                  className="btn"
                  style={{ padding: '.38rem .75rem', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '.75rem', cursor: 'pointer' }}
                >
                  {t('common.notSure')}
                </button>
              </div>
            </StepCard>

            {/* ─── ADV STEP 9: Preferment (hidden for sourdough) ── */}
            {yeastType !== 'sourdough' && (
              <StepCard
                idPrefix="adv-step"
                num={8} title={t('preferment.stepTitle')}
                activeStep={advancedStep}
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
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} ${blocks.length === 1 ? t('scheduler.summaryFridgeBlock') : t('scheduler.summaryFridgeBlocks')}` : undefined}
              onEdit={() => setAdvancedStep(9)}
            >
              <SchedulePicker
                mode="custom"
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onFeedTimeChange={setFeedTime}
                onPrefOffsetChange={setPrefOffsetH}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onReady={() => {}}
              />
              {eatTime && <ContinueBtn onClick={() => { setPrefermentFlourPct(undefined); advanceAdv(9); }} />}
            </StepCard>

            {/* ─── ADV STEP 11: Dial your dough ────── */}
            <StepCard
              idPrefix="adv-step"
              num={10}
              title={t('dialIn.title')}
              activeStep={advancedStep}
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
                      {hydAdjustNote && (
                        <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '.5rem' }}>
                          {hydAdjustNote}{' '}
                          <button
                            onClick={() => setManualHydration(styleBaseHyd)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--smoke)', fontSize: '.72rem', fontFamily: 'var(--font-dm-sans)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                          >
                            Use {styleBaseHyd}% instead ↩
                          </button>
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
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
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
                    return (
                      <div style={{ flex: 1 }}>
                        <FieldLabel>{t('dialIn.oilPct')}</FieldLabel>
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
                        <div style={{ fontSize: '.72rem', color: v > 0 && isHighTemp ? 'var(--terra)' : 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4, marginTop: '.35rem' }}>
                          {oilGuidance(v, ovenType ?? '', styleKey ?? '', t)}
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
                        <FieldLabel>{t('dialIn.sugarPct')}</FieldLabel>
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
                        <div style={{ fontSize: '.72rem', color: sg.warn ? 'var(--terra)' : 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4, marginTop: '.35rem' }}>
                          {sg.note}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </div>
                {/* Precision — 4th sub-section inside Dial In */}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '1rem' }}>
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
                            <FieldLabel>{t('dialIn.doughTemp')}</FieldLabel>
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
                          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', cursor: 'pointer', marginBottom: '.3rem' }}>
                            <input type="checkbox" checked={flourInFridge} onChange={e => setFlourInFridge(e.target.checked)}
                              style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: 'var(--terra)', flexShrink: 0 }} />
                            <span style={{ fontSize: '.72rem', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>{t('dialIn.flourInFridge')}</span>
                          </label>
                          <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4 }}>
                            +{mixerFriction}°C from {mixerType === 'spiral' ? 'spiral' : mixerType === 'stand' ? 'stand' : 'hand'} mixer.
                          </div>
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
                            <FieldLabel>{t('dialIn.mixingLoss')}</FieldLabel>
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
                          <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.4, marginTop: '.35rem' }}>
                            Buffer for bowl residue. Schedule unchanged.
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
            {canGenerate && eatTime && advancedStep > 9 && (
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
                  {pizzaPartyEnabled ? t('pizzaParty.generateBtn') : t('generate.generateBtn')}
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

                  {/* Results header now lives inside RecipeOutput */}

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
                        fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                        totalColdHours={schedule ? schedule.totalColdHours : 0}
                        mode={tab}
                        bakeType={bakeType ?? 'pizza'}
                        prefermentType={prefermentType}
                        priorityOverride={priorityOverride}
                        onPriorityOverride={v => setPriorityOverride(v)}
                        flourBlend={flourBlend}
                        units={units}
                        saveStatus={user ? saveStatus : undefined}
                        onSave={user ? () => handleSaveRecipe('custom') : undefined}
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
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Start Bake Guide CTA */}
              <button
                onClick={() => setActiveTab('guide')}
                style={{
                  background: 'var(--terra)',
                  border: 'none',
                  color: 'var(--cream)',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  width: '100%',
                  marginTop: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                ▶ Start Bake Guide
              </button>

              {/* Edit setup button */}
              <button
                onClick={() => setActiveTab('setup')}
                style={{
                  background: 'transparent',
                  border: '1px solid #C4522A',
                  color: '#C4522A',
                  borderRadius: '12px',
                  padding: '12px 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  width: '100%',
                  marginTop: '8px',
                  cursor: 'pointer',
                }}
              >
                {t('generate.editSetup')}
              </button>

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
                />
              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: activeTab === 'pizzaparty' ? 'flex' : 'none', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
                <ToppingSelector
                  locale={locale}
                  numItems={numItems}
                  activePill={pizzaPartyPill}
                  onPillChange={setPizzaPartyPill}
                  t={t}
                />
              </div>
            )}

          </div>
        )}

        {/* ── Bottom nav ── */}
        <div style={{
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
          {([
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
                  <path d="M4 5.5c2-.7 4-.7 6 1 2-1.7 4-1.7 6-1v11c-2-.7-4-.7-6 1-2-1.7-4-1.7-6-1V5.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              ),
              locked: !recipeGenerated,
              done: false,
            },
            ...(pizzaPartyEnabled ? [{
              key: 'pizzaparty' as const,
              label: t('tabs.pizzaparty'),
              icon: (color: string) => (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2.5L3 17.5h14L10 2.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M4.5 17Q10 13.5 15.5 17" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
                  <circle cx="10" cy="11" r="1" fill={color}/>
                  <circle cx="7.5" cy="14" r="0.8" fill={color}/>
                  <circle cx="12.5" cy="14" r="0.8" fill={color}/>
                </svg>
              ),
              locked: false,
              done: false,
            }] : []),
          ]).map(({ key: tabKey, label, icon, locked, done }) => {
            const isActive = activeTab === tabKey;
            const isPizza = tabKey === 'pizzaparty';
            const activeColor = isPizza ? '#B8903A' : '#C4522A';
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
                  background: isActive
                    ? isPizza ? '#D4A85320' : '#C4522A1A'
                    : done ? '#6B7A5A14'
                    : 'transparent',
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
                        <path d="M1.5 3.5l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
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
          })}
        </div>
      </div>

      {/* ── Yeast Helper modal ──────────────── */}
      {showYeastHelper && (
        <YeastHelper
          onSelect={yt => { setYeastType(yt); setShowYeastHelper(false); advance(6); }}
          onClose={() => setShowYeastHelper(false)}
        />
      )}
    </div>
  );
}
