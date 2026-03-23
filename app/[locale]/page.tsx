'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
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

// ── Step card ────────────────────────────────
function StepCard({
  num, badge, title, activeStep, summary, onEdit, children, idPrefix = 'step',
}: {
  num: number;
  badge?: number;
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
        {/* Step number / checkmark */}
        <div
          className={isActive ? 'step-pulse' : undefined}
          style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '.82rem',
            fontFamily: 'var(--font-dm-mono)',
            ...(isActive
              ? { background: 'var(--terra)', color: '#fff' }
              : isCompleted
                ? { background: 'rgba(212,168,83,0.15)', color: 'var(--gold)' }
                : { background: 'var(--border)', color: 'var(--smoke)' }),
          }}
        >
          {isCompleted ? '✓' : (badge ?? num)}
        </div>

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
      fontSize: '.7rem', color: 'var(--smoke)', textTransform: 'uppercase',
      letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.4rem',
    }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════
export default function Home() {
  const t = useTranslations();
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
  const [priority, setPriority] = useState<string | null>(null);

  // Modals & results
  const [showYeastHelper, setShowYeastHelper] = useState(false);
  const [showResults, setShowResults]         = useState(false);

  // Large-batch yeast adjustment
  const [yeastMultiplier, setYeastMultiplier]   = useState(1.0); // live stepper value
  const [appliedMultiplier, setAppliedMultiplier] = useState(1.0); // applied to RecipeOutput

  // Advanced mode manual overrides
  const [prefermentType, setPrefermentType] = useState<PrefermentType>('none');

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);

  // BakeType card hover state
  const [hoveredBakeType, setHoveredBakeType] = useState<BakeType | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const resultsRef = useRef<HTMLDivElement>(null);

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

  // ── Computed ──────────────────────────────
  const ovenData = bakeType === 'bread'
    ? BREAD_OVEN_TYPES[ovenType as BreadOvenType]
    : OVEN_TYPES[ovenType as OvenType];
  const preheatMin = ovenData?.preheatMin ?? 30;

  const schedule = useMemo(() => {
    if (!eatTime || startTime >= eatTime) return null;
    return buildSchedule(startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType);
  }, [startTime, eatTime, blocks, kitchenTemp, preheatMin]);

  const recipe = useMemo(() => {
    if (!styleKey || !schedule) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, null, 'simple',
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
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priority, 'custom',
        manualHydration, manualOil, manualSugar, flourBlend, prefermentType,
      );
    } catch {
      return null;
    }
  }, [styleKey, ovenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, priority, manualHydration, manualOil, manualSugar, flourBlend, prefermentType]);

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
    setShowResults(false);
    setOvenType(bt === 'bread' ? 'dutch_oven' : 'home_oven_steel');
    setActiveStep(2);
  }

  function selectStyle(sk: StyleKey) {
    setStyleKey(sk);
    setItemWeight(ALL_STYLES[sk].ballW);
    setNumItems(bakeType === 'bread' ? 1 : 2);
    setManualHydration(undefined);
    setManualOil(undefined);
    setManualSugar(undefined);
    advance(2);
  }

  function advance(from: number) {
    setActiveStep(from + 1);
    if (from === 8) setShowResults(true);
    else setShowResults(false);
    setTimeout(() => {
      const el = document.getElementById(`step-${from + 1}`);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 150);
  }

  function advanceAdv(from: number) {
    setAdvancedStep(from + 1);
    if (from === 10) setShowResults(true);
    else setShowResults(false);
    setTimeout(() => {
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
    setAdvancedStep(1); setFlourBlend({ flour1: 'pizza00', flour2: null, ratio1: 100 }); setPriority(null); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // ── Render ────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Header />

      {/* ── Tab navigation ─────────────────── */}
      <div style={{ background: 'var(--warm)', borderBottom: '1px solid var(--border)', position: 'sticky', top: '60px', zIndex: 90 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 1.25rem', display: 'flex' }}>
          {(['simple', 'custom'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => {
                setTab(tabKey);
                if (tabKey === 'custom' && styleKey) {
                  const s = ALL_STYLES[styleKey];
                  setManualHydration(s.hydration);
                  setManualOil(s.oil);
                  setManualSugar(s.sugar);
                } else if (tabKey === 'simple') {
                  setManualHydration(undefined);
                  setManualOil(undefined);
                  setManualSugar(undefined);
                }
              }}
              style={{
                padding: '.55rem 1.25rem',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === tabKey ? 'var(--terra)' : 'transparent'}`,
                color: tab === tabKey ? 'var(--terra)' : 'var(--smoke)',
                fontSize: '.88rem', fontWeight: tab === tabKey ? 600 : 400,
                cursor: 'pointer', marginBottom: '-1px',
                transition: 'color .15s',
              }}
            >
              {tabKey === 'simple' ? t('tabs.guided') : t('tabs.advanced')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 1.5rem)' }}>

        {/* ════════════ GUIDED ════════════ */}
        {tab === 'simple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Hero intro (only before step 1 done) ── */}
            {!bakeType && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0 2rem' }}>
                <h1 style={{
                  fontFamily: 'var(--font-playfair)', fontSize: 'clamp(2rem, 5vw, 3rem)',
                  fontWeight: 900, lineHeight: 1.2, marginBottom: '.75rem',
                }}>
                  {t('hero.headline')}{' '}
                  <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>{t('hero.headlineEm')}</em>
                </h1>
                <p style={{ color: 'var(--smoke)', fontSize: '.95rem', fontWeight: 300 }}>
                  {t('hero.sub')}
                </p>
              </div>
            )}

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
              <div style={{
                display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap',
                background: 'var(--cream)', borderRadius: '12px',
                padding: '1rem 1.15rem',
              }}>
                {/* Num items */}
                <div>
                  <FieldLabel>{t('common.quantity')}</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <button
                      onClick={() => setNumItems(n => Math.max(1, n - 1))}
                      className="btn"
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        border: 'none', background: 'var(--char)', color: '#fff',
                        cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      value={numItems}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1) setNumItems(v);
                      }}
                      style={{
                        width: '64px', textAlign: 'center',
                        padding: '.4rem .25rem',
                        border: '1.5px solid var(--border)', borderRadius: '8px',
                        fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', fontWeight: 700,
                        color: 'var(--char)', background: 'var(--warm)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => setNumItems(n => n + 1)}
                      className="btn"
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        border: 'none', background: 'var(--terra)', color: '#fff',
                        cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >+</button>
                  </div>
                  {numItems > 12 && (
                    <div style={{
                      marginTop: '.55rem',
                      fontSize: '.72rem', color: 'var(--smoke)',
                      lineHeight: 1.5, maxWidth: '180px',
                    }}>
                      🍕 {t('quantity.largeBatchNote')}
                    </div>
                  )}
                </div>

                {/* Item weight */}
                <div>
                  <FieldLabel>{isBread ? t('quantity.weightPerLoaf') : t('quantity.weightPerBall')}</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <input
                      type="number" min={100} max={1500} step={10}
                      value={itemWeight}
                      onChange={e => setItemWeight(Math.max(100, Number(e.target.value)))}
                      style={{
                        width: '80px', padding: '.42rem .65rem',
                        border: '1.5px solid var(--border)', borderRadius: '8px',
                        fontFamily: 'var(--font-dm-mono)', fontSize: '.95rem',
                        background: 'var(--warm)', color: 'var(--char)', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '.82rem', color: 'var(--smoke)' }}>g</span>
                  </div>
                </div>

                {/* Total */}
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <FieldLabel>Total dough</FieldLabel>
                  <span style={{
                    fontFamily: 'var(--font-dm-mono)', fontSize: '1.3rem',
                    fontWeight: 700, color: accentColor,
                  }}>
                    {numItems * itemWeight} g
                  </span>
                </div>
              </div>

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

            {/* ─── STEP 5: Mixer ───────────────────── */}
            <StepCard
              num={5} title={t('steps.5.title')}
              activeStep={activeStep}
              summary={`${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}`}
              onEdit={() => setActiveStep(5)}
            >
              <MixerPicker
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advance(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
              />
            </StepCard>

            {/* ─── STEP 6: Yeast type ──────────────── */}
            <StepCard
              num={6} title={t('steps.6.title')}
              activeStep={activeStep}
              summary={<>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name}</>}
              onEdit={() => setActiveStep(6)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', marginBottom: '.65rem' }}>
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
                        onClick={() => { setYeastType(yt); advance(6); }}
                        style={{
                          border: `2px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                          borderRadius: '14px', padding: '.75rem .6rem',
                          cursor: 'pointer', background: active ? '#FEF4EF' : 'var(--warm)',
                          transition: 'all .15s', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                        }}
                      >
                        {yImg ? (
                          <img src={yImg} alt={y.name}
                            style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', marginBottom: '.4rem' }} />
                        ) : (
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.4rem' }}>{y.emoji}</span>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--char)', marginBottom: '.2rem' }}>
                          {y.name}
                        </div>
                        <span style={{
                          fontSize: '.65rem', fontFamily: 'var(--font-dm-sans)',
                          color: 'var(--smoke)', textAlign: 'center', lineHeight: 1.45,
                          maxWidth: '140px', display: 'block', marginTop: '.1rem',
                        }}>
                          {guidedDesc[yt]}
                        </span>
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

            {/* ─── STEP 7: Climate ─────────────────── */}
            <StepCard
              num={7} title={t('steps.7.title')}
              activeStep={activeStep}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setActiveStep(7)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple"
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              <ContinueBtn onClick={() => advance(7)} />
            </StepCard>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepCard
              num={8} title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={activeStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}` : undefined}
              onEdit={() => setActiveStep(8)}
            >
              <SchedulePicker
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onConfirm={() => advance(8)}
              />
            </StepCard>

            {/* ─── RESULTS ───────────────────────────── */}
            {showResults && (
              <div ref={resultsRef} style={{ marginTop: '2rem' }}>

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
                          {/* Header */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#6A5000', marginBottom: '.3rem' }}>
                              {t('results.largeBatchTitle')}
                            </div>
                            <div style={{ fontSize: '.78rem', color: '#7A6010', lineHeight: 1.55 }}>
                              {t('results.largeBatchDesc')}
                            </div>
                          </div>

                          {/* Recommended row */}
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

                          {/* Multiplier stepper */}
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

                          {/* Applied indicator */}
                          {appliedMultiplier !== 1.0 && (
                            <div style={{
                              fontSize: '.72rem', color: '#7A6010',
                              fontFamily: 'var(--font-dm-mono)',
                              marginBottom: '.65rem',
                            }}>
                              ✓ Applied: {appliedMultiplier.toFixed(2)}× — recipe above reflects this adjustment.
                            </div>
                          )}

                          {/* Action buttons */}
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
                        onStartBaking={() => { /* Baking mode — future feature */ }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════ ADVANCED ════════════ */}
        {tab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

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
                    onClick={() => { setBakeType(opt.type); setStyleKey(null); setShowResults(false); setAdvancedStep(2); }}
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
                  onSelect={sk => { setStyleKey(sk); setItemWeight(ALL_STYLES[sk].ballW); setNumItems(bakeType === 'bread' ? 1 : 2); setAdvancedStep(3); }}
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
              <div style={{
                display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap',
                background: 'var(--cream)', borderRadius: '12px',
                padding: '1rem 1.15rem',
              }}>
                <div>
                  <FieldLabel>{t('common.quantity')}</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <button
                      onClick={() => setNumItems(n => Math.max(1, n - 1))}
                      className="btn"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, border: 'none', background: 'var(--char)', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >−</button>
                    <input
                      type="number" min={1} value={numItems}
                      onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setNumItems(v); }}
                      style={{ width: '64px', textAlign: 'center', padding: '.4rem .25rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--char)', background: 'var(--warm)', outline: 'none' }}
                    />
                    <button
                      onClick={() => setNumItems(n => n + 1)}
                      className="btn"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, border: 'none', background: 'var(--terra)', color: '#fff', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  </div>
                </div>
                <div>
                  <FieldLabel>{isBread ? t('quantity.weightPerLoaf') : t('quantity.weightPerBall')}</FieldLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <input
                      type="number" min={100} max={1500} step={10}
                      value={itemWeight}
                      onChange={e => setItemWeight(Math.max(100, Number(e.target.value)))}
                      style={{ width: '80px', padding: '.42rem .65rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-dm-mono)', fontSize: '.95rem', background: 'var(--warm)', color: 'var(--char)', outline: 'none' }}
                    />
                    <span style={{ fontSize: '.82rem', color: 'var(--smoke)' }}>g</span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <FieldLabel>Total dough</FieldLabel>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.3rem', fontWeight: 700, color: accentColor }}>
                    {numItems * itemWeight} g
                  </span>
                </div>
              </div>
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

            {/* ─── ADV STEP 5: Mixer ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={5} title={t('steps.5.title')}
              activeStep={advancedStep}
              summary={`${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}`}
              onEdit={() => setAdvancedStep(5)}
            >
              <MixerPicker
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advanceAdv(5); }}
                styleKey={styleKey ?? undefined}
                bakeType={bakeType ?? undefined}
              />
            </StepCard>

            {/* ─── ADV STEP 6: Flour ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={6} title={t('steps.flour.title')}
              activeStep={advancedStep}
              summary={computeBlendProfile(flourBlend).displayName}
              onEdit={() => setAdvancedStep(6)}
            >
              <FlourPicker
                blend={flourBlend}
                onBlendChange={b => setFlourBlend(b)}
                bakeType={bakeType ?? 'pizza'}
                mode={tab === 'custom' ? 'custom' : 'simple'}
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
                  Continue →
                </button>
              </div>
            </StepCard>

            {/* ─── ADV STEP 7: Yeast ───────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={7} title={t('steps.6.title')}
              activeStep={advancedStep}
              summary={<>{YEAST_TYPES[yeastType].emoji} {YEAST_TYPES[yeastType].name} · <span style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', fontSize: '.85em' }}>{YEAST_TYPES[yeastType].shortName}</span></>}
              onEdit={() => setAdvancedStep(7)}
            >
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.65rem', marginBottom: '.65rem' }}>
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
                            setAdvancedStep(9);
                            setTimeout(() => {
                              const el = document.getElementById('adv-step-9');
                              if (el) {
                                const top = el.getBoundingClientRect().top + window.scrollY - 70;
                                window.scrollTo({ top, behavior: 'smooth' });
                              }
                            }, 150);
                          } else {
                            advanceAdv(7);
                          }
                        }}
                        style={{
                          border: `2px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                          borderRadius: '14px', padding: '.75rem .6rem',
                          cursor: 'pointer', background: active ? '#FEF4EF' : 'var(--warm)',
                          transition: 'all .15s', textAlign: 'center',
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                        }}
                      >
                        {yImg ? (
                          <img src={yImg} alt={y.name}
                            style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '10px', marginBottom: '.4rem' }} />
                        ) : (
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.4rem' }}>{y.emoji}</span>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '.82rem', color: 'var(--char)', marginBottom: '.2rem' }}>
                          {y.name}
                        </div>
                        <span style={{
                          fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                          color: 'var(--smoke)', textAlign: 'center', lineHeight: 1.45,
                          maxWidth: '140px', display: 'block', marginTop: '.1rem',
                        }}>
                          {advDesc[yt]}
                        </span>
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

            {/* ─── ADV STEP 8: Preferment (hidden for sourdough) ── */}
            {yeastType !== 'sourdough' && (
              <StepCard
                idPrefix="adv-step"
                num={8} title="Preferment method"
                activeStep={advancedStep}
                summary={prefermentType !== 'none' ? `${PREFERMENT_TYPES[prefermentType].emoji} ${PREFERMENT_TYPES[prefermentType].name}` : '⚡ Direct'}
                onEdit={() => setAdvancedStep(8)}
              >
                <PrefermentPicker
                  selected={prefermentType}
                  onSelect={pt => { setPrefermentType(pt); advanceAdv(8); }}
                  styleKey={styleKey ?? undefined}
                />
              </StepCard>
            )}

            {/* ─── ADV STEP 9: Climate ─────────────── */}
            <StepCard
              idPrefix="adv-step"
              num={9} badge={yeastType === 'sourdough' ? 8 : 9}
              title={t('steps.7.title')}
              activeStep={advancedStep}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setAdvancedStep(9)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom"
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
                priority={priority}
                onPriorityChange={setPriority}
              />
              <ContinueBtn onClick={() => advanceAdv(9)} />
            </StepCard>

            {/* ─── ADV STEP 10: Scheduler ──────────── */}
            <StepCard
              idPrefix="adv-step"
              num={10} badge={yeastType === 'sourdough' ? 9 : 10}
              title={bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title')}
              activeStep={advancedStep}
              summary={eatTime ? `${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}` : undefined}
              onEdit={() => setAdvancedStep(10)}
            >
              <SchedulePicker
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onConfirm={() => advanceAdv(10)}
              />
            </StepCard>

            {/* ─── RESULTS (Advanced) ───────────────── */}
            {showResults && (
              <div ref={resultsRef} style={{ marginTop: '2rem' }}>

                {/* ── Manual adjustments — BEFORE results header ── */}
                {advancedRecipe && (
                  <div style={{
                    background: 'var(--warm)', border: '1.5px solid var(--border)',
                    borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
                  }}>
                    {/* Hydration slider */}
                    <div style={{ marginBottom: '.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.4rem' }}>
                        <FieldLabel>Hydration</FieldLabel>
                        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.82rem', fontWeight: 700, color: 'var(--terra)' }}>
                          {manualHydration ?? advancedRecipe.hydration}%
                        </span>
                      </div>
                      <input
                        type="range" min={50} max={85} step={1}
                        value={manualHydration ?? advancedRecipe.hydration}
                        onChange={e => setManualHydration(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.62rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem' }}>
                        <span>50%</span><span>85%</span>
                      </div>
                      {/* Difficulty pill + fold guidance */}
                      {(() => {
                        const hyd = manualHydration ?? advancedRecipe.hydration;
                        let diffLabel: string, diffBg: string, diffColor: string;
                        if (mixerType === 'hand') {
                          if (hyd <= 65)      { diffLabel = 'Easy';        diffBg = 'var(--sage)';  diffColor = '#fff'; }
                          else if (hyd <= 70) { diffLabel = 'Standard';    diffBg = 'var(--gold)';  diffColor = '#fff'; }
                          else if (hyd <= 75) { diffLabel = 'Challenging'; diffBg = 'var(--terra)'; diffColor = '#fff'; }
                          else                { diffLabel = 'Expert';      diffBg = 'var(--char)';  diffColor = 'var(--cream)'; }
                        } else if (mixerType === 'stand') {
                          if (hyd <= 68)      { diffLabel = 'Easy';        diffBg = 'var(--sage)';  diffColor = '#fff'; }
                          else if (hyd <= 73) { diffLabel = 'Standard';    diffBg = 'var(--gold)';  diffColor = '#fff'; }
                          else if (hyd <= 78) { diffLabel = 'Challenging'; diffBg = 'var(--terra)'; diffColor = '#fff'; }
                          else                { diffLabel = 'Expert';      diffBg = 'var(--char)';  diffColor = 'var(--cream)'; }
                        } else {
                          if (hyd <= 72)      { diffLabel = 'Easy';        diffBg = 'var(--sage)';  diffColor = '#fff'; }
                          else if (hyd <= 78) { diffLabel = 'Standard';    diffBg = 'var(--gold)';  diffColor = '#fff'; }
                          else if (hyd <= 85) { diffLabel = 'Challenging'; diffBg = 'var(--terra)'; diffColor = '#fff'; }
                          else                { diffLabel = 'Expert';      diffBg = 'var(--char)';  diffColor = 'var(--cream)'; }
                        }
                        const foldGuide = hyd <= 65
                          ? 'No folds needed — dough is stiff enough to hold structure.'
                          : hyd <= 72 ? '3–4 stretch & fold sets every 30 min.'
                          : hyd <= 78 ? '4–6 sets + coil folds recommended.'
                          : 'Lamination + coil folds — advanced technique.';
                        return (
                          <div style={{ marginTop: '.5rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                            <span style={{
                              display: 'inline-block', alignSelf: 'flex-start',
                              fontSize: '.7rem', fontFamily: 'var(--font-dm-mono)',
                              padding: '.15rem .55rem', borderRadius: '20px',
                              background: diffBg, color: diffColor,
                            }}>
                              {diffLabel}
                            </span>
                            <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic' }}>
                              {foldGuide}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Oil + Sugar side by side */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Oil %</FieldLabel>
                        <input
                          type="number" min={0} max={10} step={0.5}
                          value={manualOil ?? advancedRecipe.oil / (advancedRecipe.flour > 0 ? advancedRecipe.flour / 100 : 1)}
                          onChange={e => setManualOil(Number(e.target.value))}
                          style={{
                            width: '100%', padding: '.45rem .6rem', borderRadius: '8px',
                            border: '1.5px solid var(--border)', background: 'var(--cream)',
                            fontFamily: 'var(--font-dm-mono)', fontSize: '.88rem',
                            color: 'var(--char)', outline: 'none',
                          }}
                        />
                        {(() => {
                          const v = manualOil ?? advancedRecipe.oil / (advancedRecipe.flour > 0 ? advancedRecipe.flour / 100 : 1);
                          const g = v === 0 ? 'Traditional — no oil. Best for high-temp ovens.'
                            : v <= 3  ? 'Adds tenderness and slight browning.'
                            : v <= 6  ? 'Pan pizza range — creates crispy base.'
                            : 'Enriched dough territory. Consider osmotolerant yeast.';
                          return <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', marginTop: '.3rem' }}>{g}</div>;
                        })()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <FieldLabel>Sugar %</FieldLabel>
                        <input
                          type="number" min={0} max={10} step={0.5}
                          value={manualSugar ?? advancedRecipe.sugar / (advancedRecipe.flour > 0 ? advancedRecipe.flour / 100 : 1)}
                          onChange={e => setManualSugar(Number(e.target.value))}
                          style={{
                            width: '100%', padding: '.45rem .6rem', borderRadius: '8px',
                            border: '1.5px solid var(--border)', background: 'var(--cream)',
                            fontFamily: 'var(--font-dm-mono)', fontSize: '.88rem',
                            color: 'var(--char)', outline: 'none',
                          }}
                        />
                        {(() => {
                          const v = manualSugar ?? advancedRecipe.sugar / (advancedRecipe.flour > 0 ? advancedRecipe.flour / 100 : 1);
                          const g = v === 0 ? 'No sugar — traditional.'
                            : v <= 1  ? 'Slight colour boost at lower oven temps.'
                            : v <= 4  ? 'Noticeable sweetness, good browning.'
                            : 'Enriched range — use osmotolerant yeast (SAF Gold).';
                          return <div style={{ fontSize: '.72rem', color: 'var(--smoke)', fontStyle: 'italic', marginTop: '.3rem' }}>{g}</div>;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

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
                      prefermentType={prefermentType}
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
                        onStartBaking={() => { /* Baking mode — future feature */ }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
