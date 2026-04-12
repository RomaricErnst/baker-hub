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
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import { saveRecipe } from '../lib/supabase/saveRecipe';
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
const HUMIDITY_LABEL: Record<string, string> = {
  dry: 'Dry', normal: 'Normal', humid: 'Humid', 'very-humid': 'Very Humid',
};

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
};
const STYLE_HAS_DIAMETER = ['neapolitan', 'newyork', 'sourdough'];
const STYLE_DEFAULT_DIAMETER: Record<string, number> = { neapolitan: 30, newyork: 35, sourdough: 30 };
const STYLE_BALL_DEFAULTS: Record<string, number> = {
  neapolitan: 4, newyork: 4, roman: 2, pan: 2, sourdough: 4,
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
function oilGuidance(oil: number, ovenType: string, styleKey: string): string {
  const isHighTemp = ovenType === 'pizza_oven' || ovenType === 'electric_pizza';
  if (oil === 0 && isHighTemp) return 'Traditional — no oil. Works beautifully at high-temp (450°C+).';
  if (oil === 0 && !isHighTemp) return `Classic ${styleKey === 'neapolitan' ? 'Neapolitan' : 'style'} uses no oil, but 1–2% can help browning in a home oven below 300°C.`;
  if (oil > 0 && isHighTemp) return 'For best results in a high-temp oven, keeping oil at 0% works beautifully — oil can char at 450°C+.';
  if (oil > 0 && oil <= 2) return 'Helps browning and tenderness at home oven temps. Classic choice for home bakers.';
  if (oil > 2 && oil <= 5) return 'Pan pizza range — creates a crispy, almost-fried base. Right at home in Detroit and focaccia.';
  if (oil > 5) return 'Entering enriched dough territory — high oil softens gluten development. An osmotolerant yeast like SAF Gold works well here.';
  return '';
}

// ── Sugar guidance ────────────────────────────
function sugarGuidance(sugar: number, ovenType: string): { note: string; warn: boolean } {
  const isHighTemp = ovenType === 'pizza_oven' || ovenType === 'electric_pizza';
  if (sugar === 0 && isHighTemp) return { note: 'Traditional — no sugar. Works beautifully at high-temp.', warn: false };
  if (sugar === 0 && !isHighTemp) return { note: 'Classic. Add 0.5% to help caramelisation in a home oven below 280°C.', warn: false };
  if (sugar > 0 && sugar <= 1) return { note: 'Subtle colour boost. Good for home oven baking below 280°C.', warn: false };
  if (sugar > 1 && sugar <= 2) return { note: 'Noticeable sweetness and good browning. Works well for enriched styles.', warn: false };
  if (sugar > 2 && sugar <= 4) return { note: 'Above 2%, sugar adds osmotic stress on yeast — fermentation slows a little. An osmotolerant yeast like SAF Gold works well here.', warn: true };
  if (sugar > 4) return { note: 'High sugar territory (brioche level) — standard yeast may struggle. SAF Gold or fresh yeast is a great choice here.', warn: true };
  return { note: '', warn: false };
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════
export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
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
  const [activeTab, setActiveTab] = useState<'setup' | 'plan' | 'guide'>('setup');

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!configMountedRef.current) { configMountedRef.current = true; return; }
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
    setActiveStep(2);
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
    setRecipeGenerated(true);
    setProtocolStale(false);
    setShowResults(true);
    setActiveTab('plan');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  async function handleSaveRecipe(mode: 'simple' | 'custom') {
    if (!styleKey || !schedule || !ovenType || !mixerType || !yeastType) return;
    const activeRecipe = mode === 'custom' ? (advancedDisplayRecipe ?? advancedRecipe) : (displayRecipe ?? recipe);
    if (!activeRecipe) return;
    setSaveStatus('saving');
    const result = await saveRecipe({
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
    });
    setSaveStatus(result.success ? 'saved' : 'error');
    if (result.success) setTimeout(() => setSaveStatus('idle'), 3000);
  }

  // ── Computed: Generate button / progress ──
  const simpleRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime);
  const customRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && flourBlend);
  const canGenerate = tab === 'simple' ? simpleRequiredDone : customRequiredDone;

  const simpleStepsCompleted = [
    !!bakeType,
    !!styleKey,
    !!(numItems && itemWeight),
    !!ovenType,
    kitchenTemp > 0,
    !!mixerType,
    !!yeastType,
    !!eatTime,
  ].filter(Boolean).length;
  const simpleStepsTotal = 8;
  const customStepsCompleted = [
    !!bakeType,
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
  const customStepsTotal = 11;
  const progressFraction = tab === 'simple'
    ? (simpleRequiredDone ? 1 : (activeStep - 1) / simpleStepsTotal)
    : (customRequiredDone ? 1 : (advancedStep - 1) / customStepsTotal);

  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // ── Render ────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Header />

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 1.5rem)' }}>

        {/* ── Mode selector ──────────────────────── */}
        <div ref={modeSelectorRef}>

          {/* Hero headline — always visible */}
          <div style={{ textAlign: 'center', marginBottom: '16px', padding: '0 8px' }}>
            <h1 style={{
              fontFamily: 'var(--font-playfair)',
              fontSize: 'clamp(1.4rem, 5vw, 2rem)',
              fontWeight: 700,
              color: 'var(--char)',
              lineHeight: 1.2,
              margin: 0,
            }}>
              {t('hero.headline')}{' '}
              <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>
                {t('hero.headlineEm')}
              </em>
            </h1>
          </div>

          {/* Mode cards — always rendered, shrink in place when mode chosen */}
          <div style={{ display: 'flex', gap: '10px', maxWidth: '480px', margin: '0 auto 12px' }}>

            {/* Simple card */}
            <div
              onClick={() => {
                if (tab === 'custom') {
                  customOnlyStateRef.current = { flourBlend, hydration: manualHydration, oil: manualOil, sugar: manualSugar, prefermentType, prefermentFlourPct };
                  setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
                }
                setTab('simple'); setModeChosen(true); setProtocolStale(true); setActiveTab('setup');
                suppressNextScrollRef.current = true;
              }}
              style={{
                flex: 1,
                minWidth: '160px',
                maxWidth: '220px',
                border: tab === 'simple' ? '2px solid var(--terra)' : '0.5px solid var(--border)',
                borderRadius: '14px',
                padding: modeChosen ? '10px 12px' : '14px 12px',
                background: tab === 'simple' ? 'white' : 'var(--warm)',
                cursor: 'pointer',
                transition: 'padding 0.25s',
              }}
            >
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '15px', fontWeight: 700, color: 'var(--char)', marginBottom: modeChosen ? '3px' : '10px', transition: 'margin-bottom 0.25s' }}>
                Simple
              </div>
              {/* Bullets collapse smoothly when mode is chosen */}
              <div style={{ overflow: 'hidden', maxHeight: modeChosen ? '0' : '160px', transition: 'max-height 0.3s ease', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  t('modeCards.simple.bullet1'),
                  t('modeCards.simple.bullet2'),
                  t('modeCards.simple.bullet3'),
                  t('modeCards.simple.bullet4'),
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--sage)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span style={{ fontSize: '11px', color: 'var(--ash)', lineHeight: 1.3 }}>{b}</span>
                  </div>
                ))}
              </div>
              {/* Subtitle appears when collapsed */}
              <div style={{ overflow: 'hidden', maxHeight: modeChosen ? '40px' : '0', transition: 'max-height 0.3s ease', fontSize: '11px', color: 'var(--smoke)' }}>
                {t('modeCards.simple.collapsed')}
              </div>
            </div>

            {/* Custom card */}
            <div
              onClick={() => {
                if (tab !== 'custom') {
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
                setTab('custom'); setModeChosen(true); setProtocolStale(true); setActiveTab('setup');
                suppressNextScrollRef.current = true;
              }}
              style={{
                flex: 1,
                minWidth: '160px',
                maxWidth: '220px',
                border: tab === 'custom' ? '2px solid var(--terra)' : '0.5px solid var(--border)',
                borderRadius: '14px',
                padding: modeChosen ? '10px 12px' : '14px 12px',
                background: tab === 'custom' ? 'white' : 'var(--warm)',
                cursor: 'pointer',
                transition: 'padding 0.25s',
              }}
            >
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '15px', fontWeight: 700, color: 'var(--char)', marginBottom: modeChosen ? '3px' : '10px', transition: 'margin-bottom 0.25s' }}>
                Custom
              </div>
              <div style={{ overflow: 'hidden', maxHeight: modeChosen ? '0' : '160px', transition: 'max-height 0.3s ease', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {[
                  t('modeCards.custom.bullet1'),
                  t('modeCards.custom.bullet2'),
                  t('modeCards.custom.bullet3'),
                  t('modeCards.custom.bullet4'),
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--sage)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    <span style={{ fontSize: '11px', color: 'var(--ash)', lineHeight: 1.3 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ overflow: 'hidden', maxHeight: modeChosen ? '40px' : '0', transition: 'max-height 0.3s ease', fontSize: '11px', color: 'var(--smoke)' }}>
                {t('modeCards.custom.collapsed')}
              </div>
            </div>

          </div>
        </div>

        {/* ── Segmented control (Dough setup / Bake plan / Bake guide) ── */}
        <div style={{
          background: '#F5F0E8',
          borderRadius: '12px',
          padding: '3px',
          display: 'flex',
          marginBottom: '12px',
          border: '1.5px solid #E8E0D5',
        }}>
          {([
            { key: 'setup' as const, label: t('tabs.setup'), locked: false },
            { key: 'plan'  as const, label: t('tabs.plan'),  locked: !recipeGenerated },
            { key: 'guide' as const, label: t('tabs.guide'), locked: !recipeGenerated },
          ]).map(({ key: segKey, label, locked: isLocked }) => {
            const isActive = activeTab === segKey;
            return (
              <button
                key={segKey}
                onClick={() => !isLocked && setActiveTab(segKey)}
                style={isLocked ? {
                  background: 'transparent',
                  color: '#C8C0B8',
                  borderRadius: '10px',
                  border: 'none',
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '13px',
                  fontFamily: 'DM Sans, sans-serif',
                  cursor: 'default',
                  pointerEvents: 'none',
                } : isActive ? {
                  background: 'white',
                  color: '#1A1612',
                  boxShadow: '0 1px 4px rgba(26,22,18,0.10)',
                  borderRadius: '10px',
                  border: 'none',
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'DM Sans, sans-serif',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                } : {
                  background: 'transparent',
                  color: '#8A7F78',
                  borderRadius: '10px',
                  border: 'none',
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'DM Sans, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

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
            <div style={{ display: activeTab === 'setup' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>

            {/* ─── STEP 1: Bake type ───────────────── */}
            <StepCard
              num={1} title={t('steps.1.title')}
              activeStep={activeStep}
              summary={bakeType === 'pizza' ? '🍕 Pizza' : bakeType === 'bread' ? '🍞 Bread' : undefined}
              onEdit={() => setActiveStep(1)}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  { type: 'pizza' as BakeType, emoji: '🍕', image: '/bake_pizza.png', label: t('bakeType.pizza.label'),
                    desc: t('bakeType.pizza.desc'),
                    active_bg: '#FFF8F3', active_border: 'var(--terra)' },
                  { type: 'bread' as BakeType, emoji: '🍞', image: '/bake_bread.png', label: t('bakeType.bread.label'),
                    desc: t('bakeType.bread.desc'),
                    active_bg: 'var(--bread-l)', active_border: 'var(--bread)' },
                ]).map(opt => (
                  <div
                    key={opt.type}
                    onClick={() => selectBakeType(opt.type)}
                    onMouseEnter={() => setHoveredBakeType(opt.type)}
                    onMouseLeave={() => setHoveredBakeType(null)}
                    style={{
                      padding: '2rem 1rem 1.75rem',
                      textAlign: 'center', borderRadius: '18px', cursor: 'pointer',
                      border: `2px solid ${bakeType === opt.type ? opt.active_border : 'var(--border)'}`,
                      background: bakeType === opt.type ? opt.active_bg : 'var(--card)',
                      boxShadow: hoveredBakeType === opt.type
                        ? 'var(--card-shadow-hover)'
                        : bakeType === opt.type
                          ? `0 0 0 4px ${opt.type === 'bread' ? 'rgba(139,105,20,.1)' : 'rgba(196,82,42,.1)'}`
                          : 'var(--card-shadow)',
                      transform: hoveredBakeType === opt.type ? 'translateY(-3px)' : 'none',
                      transition: 'all .2s',
                    }}
                  >
                    <img src={opt.image} alt={opt.label} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', marginBottom: '.75rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '.3rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </StepCard>

            {/* ─── STEP 2: Style picker ────────────── */}
            <StepCard
              num={2} title={t('steps.2.title')}
              activeStep={activeStep}
              summary={styleKey ? `${ALL_STYLES[styleKey].emoji} ${ALL_STYLES[styleKey].name}` : undefined}
              onEdit={() => setActiveStep(2)}
            >
              {bakeType && (
                <StylePicker bakeType={bakeType} selected={styleKey} onSelect={selectStyle} />
              )}
            </StepCard>

            {/* ─── STEP 3: Quantity ────────────────── */}
            <StepCard
              num={3} title={t('steps.3.title')}
              activeStep={activeStep}
              summary={styleKey ? `${numItems} × ${itemWeight} g` : undefined}
              onEdit={() => setActiveStep(3)}
            >
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ── ROW 1: Quantity — centred, large, primary ── */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                        {isBread ? 'Loaves' : 'How many?'}
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
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>⚖ {isBread ? 'Weight / loaf' : 'Weight / ball'}</div>
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
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>Cornicione</span>
                        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                          {([
                            { value: 0, label: locale === 'fr' ? 'Fine'      : 'Thin'      },
                            { value: 1, label: locale === 'fr' ? 'Classique' : 'Classic'   },
                            { value: 2, label: locale === 'fr' ? 'Généreuse' : 'Generous'  },
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
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>At the AVPN limit</strong> — 280g max for Neapolitan.</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem .5rem', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>🤔 What is AVPN?</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--cream)', borderRadius: '8px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        <strong>Associazione Verace Pizza Napoletana</strong> — the official body that defines authentic Neapolitan pizza standards since 1984. They specify dough balls between 200g and 280g for a pizza 22–35 cm in diameter.
                      </div>
                    )}
                  </div>
                );
              })()}
              <ContinueBtn onClick={() => advance(3)} />
            </StepCard>

            {/* ─── STEP 4: Oven ────────────────────── */}
            <StepCard
              num={4} title={t('steps.4.title')}
              activeStep={activeStep}
              summary={ovenData ? `${ovenData.emoji} ${ovenData.name}` : ''}
              onEdit={() => setActiveStep(4)}
            >
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                selected={ovenType}
                onSelect={ot => { setOvenType(ot); advance(4); }}
              />
            </StepCard>

            {/* ─── STEP 5: Climate ─────────────────── */}
            <StepCard
              num={5} title={t('steps.5.title')}
              activeStep={activeStep}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setActiveStep(5)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              <ContinueBtn onClick={() => advance(5)} />
            </StepCard>

            {/* ─── STEP 6: Mixer ───────────────────── */}
            <StepCard
              num={6} title={t('steps.6.title')}
              activeStep={activeStep}
              summary={mixerType ? `${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}` : undefined}
              onEdit={() => setActiveStep(6)}
            >
              <MixerPicker
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advance(6); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
            </StepCard>

            {/* ─── STEP 7: Yeast type ──────────────── */}
            <StepCard
              num={7} title={t('steps.7.title')}
              activeStep={activeStep}
              summary={yeastType ? <>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name}</> : undefined}
              onEdit={() => setActiveStep(7)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.65rem' }}>
                  {(Object.entries(YEAST_TYPES) as [YeastType, typeof YEAST_TYPES[YeastType]][]).map(([yt, y]) => {
                    const active = yeastType === yt;
                    const yImg = (y as { image?: string }).image;
                    const guidedDesc: Record<string, string> = {
                      instant: 'Fine powder sachet. Most reliable, longest shelf life.',
                      active_dry: 'Brown granules. Widely available. Dissolve in warm water first.',
                      fresh: 'Soft beige block. Slightly richer flavour. Use within 2 weeks.',
                      sourdough: 'Wild fermentation. Deeper flavour, better digestibility. Needs an active starter.',
                    };
                    return (
                      <div
                        key={yt}
                        onClick={() => { setYeastType(yt); advance(7); }}
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
                            {y.name}
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
                  🤔 Not sure?
                </button>
              </div>
            </StepCard>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepCard
              num={8} title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={activeStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}` : undefined}
              onEdit={() => setActiveStep(8)}
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
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Generate your recipe first</div>
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
                  prefStartTime={prefStartTime}
                  feedTime={feedTime}
                />
              )}
            </div>{/* end guide tab */}

          </div>
        )}

        {/* ════════════ ADVANCED ════════════ */}
        {tab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: activeTab === 'setup' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>

            {/* ─── ADV STEP 1: Bake type ───────────── */}
            <StepCard
              idPrefix="adv-step"
              num={1} title={t('steps.1.title')}
              activeStep={advancedStep}
              summary={bakeType === 'pizza' ? '🍕 Pizza' : bakeType === 'bread' ? '🍞 Bread' : undefined}
              onEdit={() => setAdvancedStep(1)}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  { type: 'pizza' as BakeType, emoji: '🍕', image: '/bake_pizza.png', label: t('bakeType.pizza.label'),
                    desc: t('bakeType.pizza.desc'),
                    active_bg: '#FFF8F3', active_border: 'var(--terra)' },
                  { type: 'bread' as BakeType, emoji: '🍞', image: '/bake_bread.png', label: t('bakeType.bread.label'),
                    desc: t('bakeType.bread.desc'),
                    active_bg: 'var(--bread-l)', active_border: 'var(--bread)' },
                ]).map(opt => (
                  <div
                    key={opt.type}
                    onClick={() => { setBakeType(opt.type); setStyleKey(null); setAdvancedStep(2); }}
                    style={{
                      padding: '2rem 1rem 1.75rem',
                      textAlign: 'center', borderRadius: '18px', cursor: 'pointer',
                      border: `2px solid ${bakeType === opt.type ? opt.active_border : 'var(--border)'}`,
                      background: bakeType === opt.type ? opt.active_bg : 'var(--card)',
                      boxShadow: bakeType === opt.type
                        ? `0 0 0 4px ${opt.type === 'bread' ? 'rgba(139,105,20,.1)' : 'rgba(196,82,42,.1)'}`
                        : 'var(--card-shadow)',
                      transition: 'all .2s',
                    }}
                  >
                    <img src={opt.image} alt={opt.label} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', marginBottom: '.75rem' }} />
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '.3rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </StepCard>

            {/* ─── ADV STEP 2: Style picker ────────── */}
            <StepCard
              idPrefix="adv-step"
              num={2} title={t('steps.2.title')}
              activeStep={advancedStep}
              summary={styleKey ? `${ALL_STYLES[styleKey].emoji} ${ALL_STYLES[styleKey].name}` : undefined}
              onEdit={() => setAdvancedStep(2)}
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
                    setAdvancedStep(3);
                  }}
                />
              )}
            </StepCard>

            {/* ─── ADV STEP 3: Quantity ────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={3} title={t('steps.3.title')}
              activeStep={advancedStep}
              summary={styleKey ? `${numItems} × ${itemWeight} g` : undefined}
              onEdit={() => setAdvancedStep(3)}
            >
              {(() => {
                const showDiam = bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '');
                const isAtMax = itemWeight >= 278;
                return (
                  <div style={{ padding: '0 .1rem' }}>

                    {/* ROW 1: Quantity — centred, large, primary */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                        {isBread ? 'Loaves' : 'How many?'}
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
                        <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px', textAlign: 'center' }}>⚖ {isBread ? 'Weight / loaf' : 'Weight / ball'}</div>
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
                        <span style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>Cornicione</span>
                        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                          {([
                            { value: 0, label: locale === 'fr' ? 'Fine'      : 'Thin'      },
                            { value: 1, label: locale === 'fr' ? 'Classique' : 'Classic'   },
                            { value: 2, label: locale === 'fr' ? 'Généreuse' : 'Generous'  },
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
                        <span style={{ fontSize: '11px', color: '#7A5A10', lineHeight: 1.4, flex: 1 }}><strong>At the AVPN limit</strong> — 280g max for Neapolitan.</span>
                        <button onClick={() => setAvpnOpen(o => !o)} style={{ padding: '.2rem .5rem', borderRadius: '20px', border: '1.5px solid var(--border)', background: 'var(--warm)', color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>🤌 What is AVPN?</button>
                      </div>
                    )}
                    {isAtMax && avpnOpen && (
                      <div style={{ marginTop: '6px', padding: '8px 10px', background: 'var(--cream)', borderRadius: '8px', fontSize: '11px', color: 'var(--ash)', lineHeight: 1.5 }}>
                        <strong>Associazione Verace Pizza Napoletana</strong> — the official body that defines authentic Neapolitan pizza standards since 1984. They specify dough balls between 200g and 280g for a pizza 22–35 cm in diameter.
                      </div>
                    )}
                  </div>
                );
              })()}
              <ContinueBtn onClick={() => advanceAdv(3)} />
            </StepCard>

            {/* ─── ADV STEP 4: Oven ────────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={4} title={t('steps.4.title')}
              activeStep={advancedStep}
              summary={ovenData ? `${ovenData.emoji} ${ovenData.name}` : ''}
              onEdit={() => setAdvancedStep(4)}
            >
              <OvenPicker
                bakeType={bakeType ?? 'pizza'}
                selected={ovenType}
                onSelect={ot => { setOvenType(ot); advanceAdv(4); }}
              />
            </StepCard>

            {/* ─── ADV STEP 5: Climate ─────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={5}
              title={t('steps.5.title')}
              activeStep={advancedStep}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setAdvancedStep(5)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />
              <ContinueBtn onClick={() => advanceAdv(5)} />
            </StepCard>

            {/* ─── ADV STEP 6: Mixer ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={6} title={t('steps.6.title')}
              activeStep={advancedStep}
              summary={mixerType ? `${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}` : undefined}
              onEdit={() => setAdvancedStep(6)}
            >
              <MixerPicker
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advanceAdv(6); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
                kitchenTemp={kitchenTemp}
              />
            </StepCard>

            {/* ─── ADV STEP 7: Flour ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={7} title={t('steps.flour.title')}
              activeStep={advancedStep}
              summary={(() => {
                if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                  return computeBlendProfile(flourBlend).displayName;
                }
                const ratio2 = 100 - flourBlend.ratio1;
                const flour1Name = computeBlendProfile({ ...flourBlend, flour2: null, ratio1: 100 }).displayName;
                const flour2Name = flourBlend.customFlour2Name ?? computeBlendProfile(flourBlend).displayName.split('+')[1]?.trim() ?? '';
                return `${flourBlend.ratio1}% ${flour1Name} · ${ratio2}% ${flour2Name}`;
              })()}
              onEdit={() => setAdvancedStep(7)}
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
                  onClick={() => advanceAdv(7)}
                  className="btn"
                  style={{
                    width: '100%', padding: '.9rem 1.25rem',
                    border: 'none', borderRadius: '12px',
                    background: 'var(--terra)', color: '#fff',
                    fontFamily: 'var(--font-playfair)', fontSize: '1.05rem', fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(196,82,42,0.22)',
                  }}
                >
                  Continue →
                </button>
              </div>
            </StepCard>

            {/* ─── ADV STEP 8: Yeast ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={8} title={t('steps.7.title')}
              activeStep={advancedStep}
              summary={yeastType ? <>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name} · <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', fontSize: '.85em' }}>{YEAST_TYPES[yeastType].shortName}</span></> : undefined}
              onEdit={() => setAdvancedStep(8)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.65rem' }}>
                  {(Object.entries(YEAST_TYPES) as [YeastType, typeof YEAST_TYPES[YeastType]][]).map(([yt, y]) => {
                    const active = yeastType === yt;
                    const yImg = (y as { image?: string }).image;
                    const advDesc: Record<string, string> = {
                      instant: 'Fine powder · ×1.0 reference · most precise',
                      active_dry: 'Brown granules · ×1.33 vs IDY · proof in 38°C water',
                      fresh: 'Soft block · ×3.0 vs IDY · keep refrigerated',
                      sourdough: 'Wild yeast · replaces formula · needs active starter at peak',
                    };
                    return (
                      <div
                        key={yt}
                        onClick={() => {
                          setYeastType(yt);
                          if (yt === 'sourdough') {
                            setPrefermentType('levain');
                            setAdvancedStep(10);
                            setTimeout(() => {
                              const el = document.getElementById('adv-step-10');
                              if (el) {
                                const top = el.getBoundingClientRect().top + window.scrollY - 70;
                                window.scrollTo({ top, behavior: 'smooth' });
                              }
                            }, 150);
                          } else {
                            // switching away from sourdough: reset levain preferment
                            if (prefermentType === 'levain') setPrefermentType('none');
                            advanceAdv(8);
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
                            {y.name}
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
                  🤔 Not sure?
                </button>
              </div>
            </StepCard>

            {/* ─── ADV STEP 9: Preferment (hidden for sourdough) ── */}
            {yeastType !== 'sourdough' && (
              <StepCard
                idPrefix="adv-step"
                num={9} title="Preferment method"
                activeStep={advancedStep}
                summary={prefermentType !== 'none' ? `${PREFERMENT_TYPES[prefermentType].emoji} ${PREFERMENT_TYPES[prefermentType].name}` : '⚡ Direct'}
                onEdit={() => setAdvancedStep(9)}
              >
                <PrefermentPicker
                  selected={prefermentType}
                  onSelect={pt => {
                    setPrefermentType(pt);
                    advanceAdv(9);
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
              num={10}
              title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={advancedStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}` : undefined}
              onEdit={() => setAdvancedStep(10)}
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
              {eatTime && <ContinueBtn onClick={() => { setPrefermentFlourPct(undefined); advanceAdv(10); }} />}
            </StepCard>

            {/* ─── ADV STEP 11: Dial your dough ────── */}
            <StepCard
              idPrefix="adv-step"
              num={11}
              title="Dial in your dough"
              activeStep={advancedStep}
              summary={manualHydration !== undefined ? `${manualHydration}% hydration` : styleKey ? `${ALL_STYLES[styleKey].hydration}% hydration` : undefined}
              onEdit={() => setAdvancedStep(11)}
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
                        <span style={{ position: 'absolute', left: 0 }}>16h+ ahead</span>
                        <span style={{ position: 'absolute', left: '37.5%', transform: 'translateX(-50%)', color: 'var(--sage)', fontWeight: 600, whiteSpace: 'nowrap' }}>Night before</span>
                        <span style={{ position: 'absolute', right: 0 }}>Same day</span>
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
                      label: 'Below classic range',
                      color: '#5A7A98',
                      note: h < zone.min + 3
                        ? 'Dough will be quite stiff — a little more water may help with stretching.'
                        : `Below the ${zone.name} classic range. Dough will be firmer and a bit denser.`,
                    };
                    if (h <= zone.classicMax) return {
                      label: '✓ Classic range',
                      color: 'var(--sage)',
                      note: `Authentic ${zone.name} range. Great handling and traditional texture.`,
                    };
                    if (h <= zone.advancedMax) return {
                      label: '✦ Extended range',
                      color: 'var(--gold)',
                      note: 'More open crumb and airiness. Requires confident shaping technique.',
                    };
                    return {
                      label: '⚡ Advanced technique',
                      color: '#C4624A',
                      note: h >= zone.max - 2
                        ? 'Extreme hydration. Expect very sticky dough — wet hands, bench scraper essential.'
                        : 'High hydration territory. Excellent open crumb but challenging to handle.',
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
                          <FieldLabel>Salt %</FieldLabel>
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
                          {v < 2 ? 'Very low — may taste flat.' :
                           v <= 2.5 ? 'Bread range — mild.' :
                           v <= 3 ? 'Classic pizza range.' :
                           v <= 3.2 ? 'Full-flavoured.' :
                           'High — slows yeast slightly.'}
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
                        <FieldLabel>Oil %</FieldLabel>
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
                          {oilGuidance(v, ovenType ?? '', styleKey ?? '')}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Sugar stepper */}
                  {(() => {
                    const v = manualSugar ?? 0;
                    const sg = sugarGuidance(v, ovenType ?? '');
                    const STEP = 0.5;
                    return (
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Sugar %</FieldLabel>
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
                            <FieldLabel>Dough temp</FieldLabel>
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
                            <span style={{ fontSize: '.72rem', color: 'var(--char)', fontFamily: 'var(--font-dm-sans)' }}>Flour in fridge</span>
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
                            <FieldLabel>Mixing loss</FieldLabel>
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
            {canGenerate && eatTime && advancedStep > 10 && (
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
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Generate your recipe first</div>
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
                  prefStartTime={prefStartTime}
                  feedTime={feedTime}
                />
              )}
            </div>{/* end guide tab */}

          </div>
        )}
      </div>

      {/* ── Yeast Helper modal ──────────────── */}
      {showYeastHelper && (
        <YeastHelper
          onSelect={yt => { setYeastType(yt); setShowYeastHelper(false); advance(7); }}
          onClose={() => setShowYeastHelper(false)}
        />
      )}
    </div>
  );
}
