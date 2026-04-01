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
  const [ovenType, setOvenType] = useState<AnyOvenType>('home_oven_steel');

  // Step 4 — mixer
  const [mixerType, setMixerType] = useState<MixerType>('hand');

  // Step 5 — schedule + yeast
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [eatTime, setEatTime] = useState<Date | null>(null);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [yeastType, setYeastType] = useState<YeastType>('instant');

  // Step 6 — climate
  const [kitchenTemp, setKitchenTemp] = useState(22);
  const [humidity, setHumidity] = useState('normal');
  const [fridgeTemp, setFridgeTemp] = useState(4);
  const [priorityOverride, setPriorityOverride] = useState<string | null | undefined>(undefined);

  // Modals & results
  const [showYeastHelper, setShowYeastHelper] = useState(false);
  const [showResults, setShowResults]         = useState(false);

  // Large-batch yeast adjustment
  const [yeastMultiplier, setYeastMultiplier]   = useState(1.0); // live stepper value
  const [appliedMultiplier, setAppliedMultiplier] = useState(1.0); // applied to RecipeOutput

  // Sourdough feed time
  const [feedTime, setFeedTime] = useState<Date | null>(null);

  // Advanced mode manual overrides
  const [prefermentType, setPrefermentType] = useState<PrefermentType | null>('none');
  const [prefermentFlourPct, setPrefermentFlourPct] = useState<number | undefined>(undefined);
  const [prefOffsetH, setPrefOffsetH] = useState<number>(0);

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);

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

  // Set protocolStale when config changes after recipe generated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (recipeGenerated) {
      setProtocolStale(true);
    }
  }, [bakeType, styleKey, numItems, itemWeight, ovenType, mixerType, yeastType, kitchenTemp, humidity, fridgeTemp, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct]);

  useEffect(() => {
    setScheduleReady(false);
  }, [bakeType, styleKey]);

  // ── Computed ──────────────────────────────
  const ovenData = bakeType === 'bread'
    ? BREAD_OVEN_TYPES[ovenType as BreadOvenType]
    : OVEN_TYPES[ovenType as OvenType];
  const preheatMin = ovenData?.preheatMin ?? 30;

  const hasNightBlocker = blocks.some(b =>
    b.label.toLowerCase().includes('night') || b.from.getHours() >= 22 || b.to.getHours() <= 7
  );

  const schedule = useMemo(() => {
    if (!eatTime || startTime >= eatTime) return null;
    return buildSchedule(startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType, styleKey ?? 'neapolitan');
  }, [startTime, eatTime, blocks, kitchenTemp, preheatMin]);

  // Preferment start time for Timeline step 0 (poolish/biga only)
  const prefStartTime = useMemo(() => {
    if (!prefermentType || prefermentType === 'none' || prefermentType === 'levain') return null;
    if (prefOffsetH <= 0) return null;
    return new Date(startTime.getTime() - prefOffsetH * 3600000);
  }, [startTime, prefOffsetH, prefermentType]);

  const recipe = useMemo(() => {
    if (!styleKey || !schedule) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'simple',
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType]);

  // Recipe with yeast adjusted by appliedMultiplier (large-batch tuning)
  const displayRecipe = useMemo(() => {
    if (!recipe || !recipe.yeast || appliedMultiplier === 1.0) return recipe;
    const y = recipe.yeast;
    return {
      ...recipe,
      yeast: {
        ...y,
        pct:            Math.round(y.pct            * appliedMultiplier * 10000) / 10000,
        grams:          Math.round(y.grams          * appliedMultiplier * 1000)  / 1000,
        convertedPct:   Math.round(y.convertedPct   * appliedMultiplier * 10000) / 10000,
        convertedGrams: Math.round(y.convertedGrams * appliedMultiplier * 1000)  / 1000,
      },
    };
  }, [recipe, appliedMultiplier]);

  // Advanced recipe — includes manual hydration/oil/sugar overrides
  const advancedRecipe = useMemo(() => {
    if (!styleKey || !schedule) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom',
        manualHydration, manualOil, manualSugar, flourBlend, effPref, priorityOverride,
        prefermentFlourPct,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priorityOverride, manualHydration, manualOil, manualSugar, flourBlend, prefermentType, prefermentFlourPct]);

  // Advanced recipe with yeast multiplier applied
  const advancedDisplayRecipe = useMemo(() => {
    if (!advancedRecipe || !advancedRecipe.yeast || appliedMultiplier === 1.0) return advancedRecipe;
    const y = advancedRecipe.yeast;
    return {
      ...advancedRecipe,
      yeast: {
        ...y,
        pct:            Math.round(y.pct            * appliedMultiplier * 10000) / 10000,
        grams:          Math.round(y.grams          * appliedMultiplier * 1000)  / 1000,
        convertedPct:   Math.round(y.convertedPct   * appliedMultiplier * 10000) / 10000,
        convertedGrams: Math.round(y.convertedGrams * appliedMultiplier * 1000)  / 1000,
      },
    };
  }, [advancedRecipe, appliedMultiplier]);

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
    setOvenType('home_oven_steel'); setMixerType('hand');
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setEatTime(null);
    setBlocks([]); setYeastType('instant');
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(4);
    setShowResults(false); setActiveStep(1);
    setYeastMultiplier(1.0); setAppliedMultiplier(1.0);
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
    setRecipeGenerated(true);
    setProtocolStale(false);
    setShowResults(true);
    setActiveTab('plan');
  }

  async function handleSaveRecipe(mode: 'simple' | 'custom') {
    if (!styleKey || !schedule) return;
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
  const effPref: PrefermentType = prefermentType ?? 'none';

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
                  customOnlyStateRef.current = { flourBlend, hydration: manualHydration, oil: manualOil, sugar: manualSugar, prefermentType: effPref, prefermentFlourPct };
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
                  } else {
                    // First time entering Custom — no pre-selection for preferment
                    setPrefermentType(null as any);
                    if (styleKey) {
                      const s = ALL_STYLES[styleKey];
                      setManualHydration(s.hydration); setManualOil(s.oil); setManualSugar(s.sugar);
                    }
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
                const sliders = showDiam && (
                  <>
                    {/* Diameter slider */}
                    <div style={{ display: 'grid', gridTemplateColumns: '64px 52px 16px 1fr', alignItems: 'center', marginTop: '20px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, whiteSpace: 'nowrap' }}>Diameter</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--char)', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', textAlign: 'right' }}>{pizzaDiameter} cm</span>
                      <span />
                      <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: '6px', background: 'var(--border)', borderRadius: '3px' }} />
                        <div style={{ position: 'absolute', left: 0, height: '6px', background: 'var(--terra)', borderRadius: '3px', width: `${((pizzaDiameter - 22) / (35 - 22)) * 100}%` }} />
                        <div style={{ position: 'absolute', left: `${((pizzaDiameter - 22) / (35 - 22)) * 100}%`, width: '20px', height: '20px', borderRadius: '50%', background: 'white', border: '2.5px solid var(--terra)', transform: 'translateX(-50%)', top: '50%', marginTop: '-10px', pointerEvents: 'none' }} />
                        <input type="range" min={22} max={35} step={1} value={pizzaDiameter}
                          onChange={e => { const d = +e.target.value; setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, height: '24px', cursor: 'pointer', margin: 0 }} />
                      </div>
                    </div>
                    {/* Cornicione segmented control */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, flexShrink: 0, marginRight: '10px' }}>Cornicione</span>
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
                  </>
                );
                return (
                  <div style={{ padding: '0 .1rem' }}>
                    {/* Ball count + weight — labels above, one row */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', marginBottom: '20px' }}>
                      {/* Ball count — left */}
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
                          {isBread ? 'Loaves' : 'Pizzas'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '48px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '16px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                      {/* Weight per ball — right */}
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
                          {isBread ? 'Weight per loaf' : 'Weight per ball'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => { const w = Math.max(150, itemWeight - 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <input type="number" min={150} max={500} step={5} value={itemWeight}
                            onChange={e => { const w = Math.max(150, Math.min(500, Math.round(+e.target.value / 5) * 5)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                            style={{ width: '56px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '16px', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <button onClick={() => { const w = Math.min(500, itemWeight + 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>g</span>
                        </div>
                      </div>
                    </div>
                    {/* Sliders */}
                    {sliders}
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
              summary={`${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}`}
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
              summary={<>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name}</>}
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

                  {/* Results header */}
                  <div style={{
                    background: 'var(--char)', borderRadius: '18px',
                    border: '1px solid rgba(212,168,83,0.15)',
                    padding: '1.3rem 1.6rem', marginBottom: '2rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: '.75rem',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
                        {t('results.ready')}
                      </div>
                      {styleKey && (
                        <div style={{ fontSize: '.78rem', color: 'rgba(245,240,232,.55)', marginTop: '.2rem', fontFamily: 'var(--font-dm-mono)' }}>
                          {ALL_STYLES[styleKey].name} · {numItems} × {itemWeight} g · {ovenData?.name ?? ''}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                      {user && (
                        <button
                          onClick={() => handleSaveRecipe('simple')}
                          disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                          className="btn"
                          style={{
                            padding: '.5rem 1rem', borderRadius: '8px',
                            border: `1.5px solid ${saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'rgba(212,168,83,0.4)'}`,
                            background: saveStatus === 'saved' ? 'rgba(107,122,90,0.15)' : 'transparent',
                            color: saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--gold)',
                            fontSize: '.8rem', cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
                            transition: 'all .15s',
                          }}
                        >
                          {saveStatus === 'saving' ? t('results.saving') : saveStatus === 'saved' ? t('results.saved') : saveStatus === 'error' ? t('results.saveFailed') : t('results.saveRecipe')}
                        </button>
                      )}
                      <button
                        onClick={startOver}
                        className="btn"
                        style={{
                          padding: '.5rem 1rem', borderRadius: '8px',
                          border: '1.5px solid rgba(245,240,232,.2)',
                          background: 'transparent', color: 'rgba(245,240,232,.7)',
                          fontSize: '.8rem', cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        {t('results.startNew')}
                      </button>
                    </div>
                  </div>

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
                        styleEmoji={ALL_STYLES[styleKey!].emoji}
                        mixerType={mixerType}
                        kitchenTemp={kitchenTemp}
                        fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                        totalColdHours={schedule ? schedule.totalColdHours : 0}
                        mode={tab}
                        bakeType={bakeType ?? 'pizza'}
                      />

                      {/* ── Large-batch yeast adjustment ── */}
                      {numItems > 12 && recipe?.yeast && (() => {
                        const base = recipe.yeast!;
                        const adjPct   = Math.round(base.convertedPct   * yeastMultiplier * 1000) / 1000;
                        const adjGrams = Math.round(base.convertedGrams * yeastMultiplier * 100)  / 100;

                        return (
                          <div style={{
                            border: '1.5px solid #E8D890',
                            borderRadius: '16px',
                            padding: '1.25rem 1.4rem',
                            background: '#FDFBF2',
                          }}>
                            <div style={{ marginBottom: '1rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#6A5000', marginBottom: '.3rem' }}>
                                {t('results.largeBatchTitle')}
                              </div>
                              <div style={{ fontSize: '.78rem', color: '#7A6010', lineHeight: 1.55 }}>
                                {t('results.largeBatchDesc')}
                              </div>
                            </div>
                            <div style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '.5rem .75rem',
                              background: 'rgba(255,255,255,.6)', borderRadius: '8px',
                              marginBottom: '.65rem',
                              fontSize: '.78rem',
                            }}>
                              <span style={{ color: 'var(--smoke)' }}>Recommended</span>
                              <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--ash)', fontWeight: 500 }}>
                                {base.convertedPct}% · {base.convertedGrams} g
                              </span>
                            </div>
                            <div style={{ marginBottom: '.65rem' }}>
                              <div style={{
                                fontSize: '.7rem', color: '#7A6010', textTransform: 'uppercase',
                                letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.45rem',
                              }}>
                                Adjustment multiplier
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                                <button
                                  onClick={() => setYeastMultiplier(m => Math.max(0.5, Math.round((m - 0.05) * 100) / 100))}
                                  disabled={yeastMultiplier <= 0.5}
                                  className="btn"
                                  style={{
                                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                    border: 'none',
                                    background: yeastMultiplier <= 0.5 ? 'var(--border)' : 'var(--char)',
                                    color: yeastMultiplier <= 0.5 ? 'var(--smoke)' : '#fff',
                                    cursor: yeastMultiplier <= 0.5 ? 'default' : 'pointer',
                                    fontSize: '1.1rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >−</button>
                                <div style={{
                                  fontFamily: 'var(--font-dm-mono)', fontSize: '1.2rem', fontWeight: 700,
                                  color: 'var(--gold)', minWidth: '52px', textAlign: 'center',
                                }}>
                                  {yeastMultiplier.toFixed(2)}×
                                </div>
                                <button
                                  onClick={() => setYeastMultiplier(m => Math.min(1.5, Math.round((m + 0.05) * 100) / 100))}
                                  disabled={yeastMultiplier >= 1.5}
                                  className="btn"
                                  style={{
                                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                                    border: 'none',
                                    background: yeastMultiplier >= 1.5 ? 'var(--border)' : 'var(--terra)',
                                    color: yeastMultiplier >= 1.5 ? 'var(--smoke)' : '#fff',
                                    cursor: yeastMultiplier >= 1.5 ? 'default' : 'pointer',
                                    fontSize: '1.1rem', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >+</button>
                                <div style={{
                                  marginLeft: '.25rem',
                                  fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)',
                                  color: 'var(--gold)', fontWeight: 600,
                                }}>
                                  → {adjPct}% · {adjGrams} g
                                </div>
                              </div>
                            </div>
                            {appliedMultiplier !== 1.0 && (
                              <div style={{
                                fontSize: '.72rem', color: '#7A6010',
                                fontFamily: 'var(--font-dm-mono)',
                                marginBottom: '.65rem',
                              }}>
                                ✓ Applied: {appliedMultiplier.toFixed(2)}× — recipe above reflects this adjustment.
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '.6rem' }}>
                              <button
                                onClick={() => setAppliedMultiplier(yeastMultiplier)}
                                className="btn"
                                style={{
                                  flex: 2, padding: '.65rem',
                                  border: 'none', borderRadius: '12px',
                                  background: 'var(--gold)', color: '#fff',
                                  fontSize: '.84rem', fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                Apply adjustment
                              </button>
                              <button
                                onClick={() => { setYeastMultiplier(1.0); setAppliedMultiplier(1.0); }}
                                className="btn"
                                style={{
                                  flex: 1, padding: '.65rem',
                                  border: '1.5px solid #E8D890', borderRadius: '12px',
                                  background: 'transparent', color: '#7A6010',
                                  fontSize: '.84rem', cursor: 'pointer',
                                }}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {schedule && (
                        <Timeline
                          schedule={schedule}
                          blocks={blocks}
                          preheatMin={preheatMin}
                          startTime={startTime}
                          eatTime={eatTime!}
                          mixerType={mixerType}
                          styleKey={styleKey ?? ''}
                          oil={recipe?.oil ?? 0}
                          hydration={recipe?.hydration ?? 0}
                          numItems={numItems}
                          feedTime={feedTime}
                          kitchenTemp={kitchenTemp}
                          prefStartTime={prefStartTime}
                          prefermentType={effPref}
                          onStartBaking={() => { /* Baking mode — future feature */ }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

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
                  marginTop: '16px',
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
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>◆</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Generate your recipe first</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', color: 'var(--char)', marginBottom: '12px' }}>Bake guide</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Your step-by-step guide will appear here.</div>
                </div>
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
                const sliders = showDiam && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '64px 52px 16px 1fr', alignItems: 'center', marginTop: '20px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, whiteSpace: 'nowrap' }}>Diameter</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--char)', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', textAlign: 'right' }}>{pizzaDiameter} cm</span>
                      <span />
                      <div style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', left: 0, right: 0, height: '6px', background: 'var(--border)', borderRadius: '3px' }} />
                        <div style={{ position: 'absolute', left: 0, height: '6px', background: 'var(--terra)', borderRadius: '3px', width: `${((pizzaDiameter - 22) / (35 - 22)) * 100}%` }} />
                        <div style={{ position: 'absolute', left: `${((pizzaDiameter - 22) / (35 - 22)) * 100}%`, width: '20px', height: '20px', borderRadius: '50%', background: 'white', border: '2.5px solid var(--terra)', transform: 'translateX(-50%)', top: '50%', marginTop: '-10px', pointerEvents: 'none' }} />
                        <input type="range" min={22} max={35} step={1} value={pizzaDiameter}
                          onChange={e => { const d = +e.target.value; setPizzaDiameter(d); setItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', d, pizzaCorn)); }}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, height: '24px', cursor: 'pointer', margin: 0 }} />
                      </div>
                    </div>
                    {/* Cornicione segmented control */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', fontWeight: 400, flexShrink: 0, marginRight: '10px' }}>Cornicione</span>
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
                  </>
                );
                return (
                  <div style={{ padding: '0 .1rem' }}>
                    {/* Ball count + weight — labels above, one row */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', marginBottom: '20px' }}>
                      {/* Ball count — left */}
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
                          {isBread ? 'Loaves' : 'Pizzas'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => setNumItems(n => Math.max(1, n - 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <input type="number" min={1} max={24} step={1} value={numItems}
                            onChange={e => setNumItems(Math.max(1, Math.min(24, Math.round(+e.target.value))))}
                            style={{ width: '48px', border: 'none', borderBottom: '2px solid var(--char)', background: 'transparent', fontSize: '16px', fontWeight: 700, color: 'var(--char)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <button onClick={() => setNumItems(n => Math.min(24, n + 1))} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                        </div>
                      </div>
                      {/* Weight per ball — right */}
                      <div>
                        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif', marginBottom: '8px' }}>
                          {isBread ? 'Weight per loaf' : 'Weight per ball'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => { const w = Math.max(150, itemWeight - 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--cream)', color: 'var(--char)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                          <input type="number" min={150} max={500} step={5} value={itemWeight}
                            onChange={e => { const w = Math.max(150, Math.min(500, Math.round(+e.target.value / 5) * 5)); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }}
                            style={{ width: '56px', border: 'none', borderBottom: '2px solid var(--terra)', background: 'transparent', fontSize: '16px', fontWeight: 700, color: 'var(--terra)', fontFamily: 'var(--font-dm-mono)', textAlign: 'center', outline: 'none', MozAppearance: 'textfield' } as React.CSSProperties} />
                          <button onClick={() => { const w = Math.min(500, itemWeight + 5); setItemWeight(w); if (showDiam) setPizzaDiameter(diameterFromWeight(w, styleKey ?? 'neapolitan', pizzaCorn)); }} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                          <span style={{ fontSize: '13px', color: '#8A7F78', fontFamily: 'DM Sans, sans-serif' }}>g</span>
                        </div>
                      </div>
                    </div>
                    {sliders}
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
              summary={`${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}`}
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
              summary={<>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name} · <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', fontSize: '.85em' }}>{YEAST_TYPES[yeastType].shortName}</span></>}
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
                summary={effPref !== 'none' ? `${PREFERMENT_TYPES[effPref].emoji} ${PREFERMENT_TYPES[effPref].name}` : '⚡ Direct'}
                onEdit={() => setAdvancedStep(9)}
              >
                <PrefermentPicker
                  selected={effPref}
                  onSelect={pt => {
                    setPrefermentType(pt);
                    if (pt === 'none') advanceAdv(9);
                    // poolish, biga: stay on step so baker sees the flour % slider
                  }}
                  flourPct={prefermentFlourPct}
                  onFlourPctChange={setPrefermentFlourPct}
                  styleKey={styleKey ?? undefined}
                  hideTypes={['levain']}
                  kitchenTemp={kitchenTemp}
                />
                {prefermentType !== 'none' && <ContinueBtn onClick={() => advanceAdv(9)} />}
              </StepCard>
            )}

            {/* ─── ADV STEP 10: Dial your dough ────── */}
            <StepCard
              idPrefix="adv-step"
              num={10}
              title="Dial in your dough"
              activeStep={advancedStep}
              summary={manualHydration !== undefined ? `${manualHydration}% hydration` : styleKey ? `${ALL_STYLES[styleKey].hydration}% hydration` : undefined}
              onEdit={() => setAdvancedStep(10)}
            >
              <div>
                <div style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Defaults are set for your style — adjust if you know what you&apos;re doing.
                </div>
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
                  const currentHyd = manualHydration ?? defaultHyd;

                  function hydrationZoneLabel(h: number): { label: string; color: string; note: string } {
                    if (h < zone.classicMin) return {
                      label: 'Below classic range',
                      color: '#7A5A10',
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
                      color: 'var(--terra)',
                      note: h >= zone.max - 2
                        ? 'Extreme hydration. Expect very sticky dough — wet hands, bench scraper essential.'
                        : 'High hydration territory. Excellent open crumb but challenging to handle.',
                    };
                  }

                  const hZone = hydrationZoneLabel(currentHyd);
                  return (
                    <div style={{ marginBottom: '.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
                        <label style={{ fontSize: '.72rem', color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                          Hydration
                        </label>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', fontWeight: 700, color: hZone.color }}>
                          {currentHyd}%
                        </span>
                      </div>
                      <div style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '8px', borderRadius: '4px',
                          background: `linear-gradient(to right, #E8D080 0%, #E8D080 ${lowPct}%, #B8D4A8 ${lowPct}%, #B8D4A8 ${classicMaxPct}%, #E8D890 ${classicMaxPct}%, #E8D890 ${advancedMaxPct}%, #F5C4B0 ${advancedMaxPct}%, #F5C4B0 100%)`,
                        }} />
                        <input
                          type="range"
                          min={sliderMin} max={sliderMax} step={1}
                          value={currentHyd}
                          onChange={e => setManualHydration(Number(e.target.value))}
                          style={{ position: 'absolute', left: 0, right: 0, width: '100%', appearance: 'none', background: 'transparent', cursor: 'pointer', height: '36px', margin: 0, accentColor: 'var(--terra)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem', marginBottom: '.5rem' }}>
                        <span>{sliderMin}%</span>
                        <span style={{ color: 'var(--sage)', fontWeight: 600 }}>{zone.classicMin}–{zone.classicMax}% classic</span>
                        <span>{sliderMax}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.5rem', marginBottom: '.25rem' }}>
                        <span style={{
                          fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)', fontWeight: 600,
                          color: hZone.color, flexShrink: 0,
                          background: hZone.color === 'var(--sage)' ? 'rgba(107,122,90,0.1)' :
                                      hZone.color === 'var(--gold)' ? 'rgba(212,168,83,0.12)' :
                                      hZone.color === 'var(--terra)' ? 'rgba(196,82,42,0.1)' : 'rgba(122,90,16,0.1)',
                          borderRadius: '20px', padding: '.2rem .6rem',
                        }}>
                          {hZone.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '.75rem' }}>
                        {hZone.note}
                      </div>
                    </div>
                  );
                })()}

                {/* Oil + Sugar side by side */}
                <div style={{ display: 'flex', gap: '1.25rem' }}>
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
                          {oilGuidance(v, ovenType, styleKey ?? '')}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Sugar stepper */}
                  {(() => {
                    const v = manualSugar ?? 0;
                    const sg = sugarGuidance(v, ovenType);
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
                <ContinueBtn onClick={() => advanceAdv(10)} />
              </div>
            </StepCard>

            {/* ─── ADV STEP 11: Scheduler ──────────── */}
            <StepCard
              idPrefix="adv-step"
              num={11}
              title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={advancedStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}` : undefined}
              onEdit={() => setAdvancedStep(11)}
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
            </StepCard>

            {/* ── Generate button (setup tab) ── */}
            {canGenerate && eatTime && (
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

                  {/* ── Results header ── */}
                  <div style={{
                    background: 'var(--char)', borderRadius: '18px',
                    border: '1px solid rgba(212,168,83,0.15)',
                    padding: '1.3rem 1.6rem', marginBottom: '2rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexWrap: 'wrap', gap: '.75rem',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
                        {t('results.ready')}
                      </div>
                      {styleKey && (
                        <div style={{ fontSize: '.78rem', color: 'rgba(245,240,232,.55)', marginTop: '.2rem', fontFamily: 'var(--font-dm-mono)' }}>
                          {ALL_STYLES[styleKey].name} · {numItems} × {itemWeight} g · {ovenData?.name ?? ''} · {computeBlendProfile(flourBlend).displayName}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                      {user && (
                        <button
                          onClick={() => handleSaveRecipe('custom')}
                          disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                          className="btn"
                          style={{
                            padding: '.5rem 1rem', borderRadius: '8px',
                            border: `1.5px solid ${saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'rgba(212,168,83,0.4)'}`,
                            background: saveStatus === 'saved' ? 'rgba(107,122,90,0.15)' : 'transparent',
                            color: saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--gold)',
                            fontSize: '.8rem', cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
                            transition: 'all .15s',
                          }}
                        >
                          {saveStatus === 'saving' ? t('results.saving') : saveStatus === 'saved' ? t('results.saved') : saveStatus === 'error' ? t('results.saveFailed') : t('results.saveRecipe')}
                        </button>
                      )}
                      <button
                        onClick={startOver}
                        className="btn"
                        style={{ padding: '.5rem 1rem', borderRadius: '8px', border: '1.5px solid rgba(245,240,232,.2)', background: 'transparent', color: 'rgba(245,240,232,.7)', fontSize: '.8rem', cursor: 'pointer', transition: 'all .15s' }}
                      >
                        {t('results.startNew')}
                      </button>
                    </div>
                  </div>

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
                        styleEmoji={ALL_STYLES[styleKey!].emoji}
                        mixerType={mixerType}
                        kitchenTemp={kitchenTemp}
                        fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                        totalColdHours={schedule ? schedule.totalColdHours : 0}
                        mode={tab}
                        bakeType={bakeType ?? 'pizza'}
                        prefermentType={effPref}
                        priorityOverride={priorityOverride}
                        onPriorityOverride={v => setPriorityOverride(v)}
                      />
                      {schedule && (
                        <Timeline
                          schedule={schedule}
                          blocks={blocks}
                          preheatMin={preheatMin}
                          startTime={startTime}
                          eatTime={eatTime!}
                          mixerType={mixerType}
                          styleKey={styleKey ?? ''}
                          oil={advancedRecipe?.oil ?? 0}
                          hydration={advancedRecipe?.hydration ?? 0}
                          numItems={numItems}
                          feedTime={feedTime}
                          kitchenTemp={kitchenTemp}
                          prefStartTime={prefStartTime}
                          prefermentType={effPref}
                          onStartBaking={() => { /* Baking mode — future feature */ }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

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
                  marginTop: '16px',
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
                  <div style={{ fontSize: '24px', marginBottom: '12px' }}>◆</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Generate your recipe first</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', color: 'var(--char)', marginBottom: '12px' }}>Bake guide</div>
                  <div style={{ fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-sans)' }}>Your step-by-step guide will appear here.</div>
                </div>
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
