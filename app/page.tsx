'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Header from './components/Header';
import StylePicker from './components/StylePicker';
import OvenPicker from './components/OvenPicker';
import MixerPicker from './components/MixerPicker';
import SchedulePicker from './components/SchedulePicker';
import ClimatePicker from './components/ClimatePicker';
import RecipeOutput from './components/RecipeOutput';
import Timeline from './components/Timeline';
import YeastHelper from './components/YeastHelper';
import {
  ALL_STYLES, OVEN_TYPES, MIXER_TYPES, YEAST_TYPES,
  type BakeType, type StyleKey, type OvenType, type MixerType, type YeastType,
} from './data';
import {
  buildSchedule, calculateRecipe, formatTime,
  type AvailabilityBlock,
} from './utils';

// ── Constants ────────────────────────────────
const HUMIDITY_LABEL: Record<string, string> = {
  dry: 'Dry', normal: 'Normal', humid: 'Humid', 'very-humid': 'Very Humid',
};

// ── Step card ────────────────────────────────
function StepCard({
  num, title, activeStep, summary, onEdit, children,
}: {
  num: number;
  title: string;
  activeStep: number;
  summary?: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const isActive    = activeStep === num;
  const isCompleted = activeStep > num;
  const isLocked    = activeStep < num;

  return (
    <div id={`step-${num}`} style={{
      border: `2px solid ${isActive ? 'var(--terra)' : 'var(--border)'}`,
      borderRadius: '18px',
      background: isActive ? '#FDFAF7' : 'var(--warm)',
      marginBottom: '1rem',
      opacity: isLocked ? 0.5 : 1,
      transition: 'border-color .2s, opacity .2s',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* Header */}
      <div
        onClick={isCompleted ? onEdit : undefined}
        style={{
          padding: '1rem 1.3rem',
          display: 'flex', alignItems: 'center', gap: '.85rem',
          cursor: isCompleted ? 'pointer' : 'default',
        }}
      >
        {/* Step number / checkmark */}
        <div
          className={isActive ? 'step-pulse' : undefined}
          style={{
            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '.8rem',
            fontFamily: isActive ? 'var(--font-dm-mono)' : undefined,
            ...(isActive
              ? { background: 'var(--terra)', color: '#fff' }
              : isCompleted
                ? { background: 'var(--sage)', color: '#fff' }
                : { background: 'var(--border)', color: 'var(--smoke)' }),
          }}
        >
          {isCompleted ? '✓' : num}
        </div>

        {/* Title + summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: '1.1rem',
            color: isLocked ? 'var(--smoke)' : 'var(--char)',
          }}>
            {title}
          </div>
          {isCompleted && summary && (
            <div style={{ fontSize: '.77rem', color: 'var(--smoke)', marginTop: '.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {summary}
            </div>
          )}
        </div>

        {isCompleted && (
          <span style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', flexShrink: 0 }}>
            Edit
          </span>
        )}
      </div>

      {/* Expanded content */}
      {isActive && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.3rem' }}>
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
        marginTop: '1.1rem', width: '100%', padding: '.85rem',
        border: 'none', borderRadius: '12px',
        background: 'var(--terra)', color: '#fff',
        fontFamily: 'var(--font-playfair)', fontSize: '1rem', fontWeight: 700,
        cursor: 'pointer', transition: 'opacity .15s',
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
  const [tab, setTab] = useState<'guided' | 'advanced'>('guided');
  const [activeStep, setActiveStep] = useState(1);

  // Step 1 — bake type
  const [bakeType, setBakeType] = useState<BakeType | null>(null);

  // Step 2 — style + quantity
  const [styleKey, setStyleKey] = useState<StyleKey | null>(null);
  const [numItems, setNumItems] = useState(2);
  const [itemWeight, setItemWeight] = useState(270);

  // Step 3 — oven
  const [ovenType, setOvenType] = useState<OvenType>('home_oven_steel');

  // Step 4 — mixer
  const [mixerType, setMixerType] = useState<MixerType>('hand');

  // Step 5 — schedule + yeast
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [eatTime, setEatTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0);
    d.setTime(d.getTime() + 24 * 3600000); return d;
  });
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [yeastType, setYeastType] = useState<YeastType>('instant');

  // Step 6 — climate
  const [kitchenTemp, setKitchenTemp] = useState(22);
  const [humidity, setHumidity] = useState('normal');
  const [fridgeTemp, setFridgeTemp] = useState(4);

  // Modals & results
  const [showYeastHelper, setShowYeastHelper] = useState(false);
  const [showResults, setShowResults]         = useState(false);

  // Large-batch yeast adjustment
  const [yeastMultiplier, setYeastMultiplier]   = useState(1.0); // live stepper value
  const [appliedMultiplier, setAppliedMultiplier] = useState(1.0); // applied to RecipeOutput

  // BakeType card hover state
  const [hoveredBakeType, setHoveredBakeType] = useState<BakeType | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Scroll to results when they appear
  useEffect(() => {
    if (showResults) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [showResults]);

  // ── Computed ──────────────────────────────
  const preheatMin = OVEN_TYPES[ovenType].preheatMin;

  const schedule = useMemo(() => {
    if (startTime >= eatTime) return null;
    return buildSchedule(startTime, eatTime, blocks, kitchenTemp, preheatMin, mixerType);
  }, [startTime, eatTime, blocks, kitchenTemp, preheatMin]);

  const recipe = useMemo(() => {
    if (!styleKey || !schedule) return null;
    try {
      return calculateRecipe(
        styleKey, ovenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, null, 'guided',
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

  // ── Handlers ──────────────────────────────
  function selectBakeType(bt: BakeType) {
    setBakeType(bt);
    setStyleKey(null);
    setShowResults(false);
    setActiveStep(2);
  }

  function selectStyle(sk: StyleKey) {
    setStyleKey(sk);
    setItemWeight(ALL_STYLES[sk].ballW);
    setNumItems(bakeType === 'bread' ? 1 : 2);
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

  function startOver() {
    setBakeType(null); setStyleKey(null);
    setNumItems(2); setItemWeight(270);
    setOvenType('home_oven_steel'); setMixerType('hand');
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setEatTime(new Date(now.getTime() + 24 * 3600000));
    setBlocks([]); setYeastType('instant');
    setKitchenTemp(22); setHumidity('normal'); setFridgeTemp(4);
    setShowResults(false); setActiveStep(1);
    setYeastMultiplier(1.0); setAppliedMultiplier(1.0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1.25rem', display: 'flex' }}>
          {(['guided', 'advanced'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '.55rem 1.25rem',
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t ? 'var(--terra)' : 'transparent'}`,
                color: tab === t ? 'var(--terra)' : 'var(--smoke)',
                fontSize: '.88rem', fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer', marginBottom: '-1px',
                transition: 'color .15s',
              }}
            >
              {t === 'guided' ? '🧭 Guided' : '⚙️ Advanced'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(1rem, 3vw, 2rem)' }}>

        {/* ════════════ GUIDED ════════════ */}
        {tab === 'guided' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>

            {/* ── Hero intro (only before step 1 done) ── */}
            {!bakeType && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0 2rem' }}>
                <h1 style={{
                  fontFamily: 'var(--font-playfair)', fontSize: 'clamp(2rem, 5vw, 3rem)',
                  fontWeight: 900, lineHeight: 1.2, marginBottom: '.75rem',
                }}>
                  Craft your dough{' '}
                  <em style={{ color: 'var(--terra)', fontStyle: 'italic' }}>with confidence.</em>
                </h1>
                <p style={{ color: 'var(--smoke)', fontSize: '.95rem', fontWeight: 300 }}>
                  Choose your dough style. We&apos;ll shape the plan.
                </p>
              </div>
            )}

            {/* ─── STEP 1: Bake type ───────────────── */}
            <StepCard
              num={1} title="What are you crafting today?"
              activeStep={activeStep}
              summary={bakeType === 'pizza' ? '🍕 Pizza' : bakeType === 'bread' ? '🍞 Bread' : undefined}
              onEdit={() => setActiveStep(1)}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  { type: 'pizza' as BakeType, emoji: '🍕', label: 'Pizza',
                    desc: 'Neapolitan, New York, Roman, Detroit & Sourdough',
                    active_bg: '#FFF8F3', active_border: 'var(--terra)' },
                  { type: 'bread' as BakeType, emoji: '🍞', label: 'Bread',
                    desc: 'Sourdough, Baguette, Focaccia, Ciabatta & Brioche',
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
                    <div style={{ fontSize: '3rem', marginBottom: '.6rem' }}>{opt.emoji}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '.3rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--smoke)', lineHeight: 1.5 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </StepCard>

            {/* ─── STEP 2: Style picker ────────────── */}
            <StepCard
              num={2} title="Choose your dough style"
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
              num={3} title="How many and how big?"
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
                  <FieldLabel>Quantity</FieldLabel>
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
                        border: '1.5px solid var(--border)', borderRadius: '9px',
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
                      🍕 Large batch detected. See recipe output for yeast adjustment.
                    </div>
                  )}
                </div>

                {/* Item weight */}
                <div>
                  <FieldLabel>Weight per {isBread ? 'loaf' : 'ball'}</FieldLabel>
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
              num={4} title="Your baking setup"
              activeStep={activeStep}
              summary={`${OVEN_TYPES[ovenType].emoji} ${OVEN_TYPES[ovenType].name}`}
              onEdit={() => setActiveStep(4)}
            >
              <OvenPicker
                selected={ovenType}
                onSelect={ot => { setOvenType(ot); advance(4); }}
              />
            </StepCard>

            {/* ─── STEP 5: Mixer ───────────────────── */}
            <StepCard
              num={5} title="Your mixing method"
              activeStep={activeStep}
              summary={`${MIXER_TYPES[mixerType].emoji} ${MIXER_TYPES[mixerType].name}`}
              onEdit={() => setActiveStep(5)}
            >
              <MixerPicker
                selected={mixerType}
                onSelect={mt => { setMixerType(mt); advance(5); }}
              />
            </StepCard>

            {/* ─── STEP 6: Yeast type ──────────────── */}
            <StepCard
              num={6} title="What yeast are you using?"
              activeStep={activeStep}
              summary={`${YEAST_TYPES[yeastType].emoji} ${YEAST_TYPES[yeastType].shortName}`}
              onEdit={() => setActiveStep(6)}
            >
              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(Object.keys(YEAST_TYPES) as YeastType[]).map(yt => {
                  const active = yeastType === yt;
                  return (
                    <button
                      key={yt}
                      onClick={() => { setYeastType(yt); advance(6); }}
                      className="btn"
                      style={{
                        padding: '.38rem .85rem', borderRadius: '20px',
                        border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                        background: active ? '#FEF4EF' : 'var(--warm)',
                        color: active ? 'var(--terra)' : 'var(--smoke)',
                        fontSize: '.78rem', fontWeight: active ? 500 : 400,
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >
                      {YEAST_TYPES[yt].emoji} {YEAST_TYPES[yt].name}
                    </button>
                  );
                })}
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

            {/* ─── STEP 7: Scheduler ───────────────── */}
            <StepCard
              num={7} title="When does the pizza go in the oven?"
              activeStep={activeStep}
              summary={`${formatTime(startTime)} → ${formatTime(eatTime)} · ${blocks.length} fridge ${blocks.length === 1 ? 'block' : 'blocks'}`}
              onEdit={() => setActiveStep(7)}
            >
              <SchedulePicker
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={preheatMin}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                onChange={(st, et, bl) => { setStartTime(st); setEatTime(et); setBlocks(bl); }}
                onConfirm={() => advance(7)}
              />
            </StepCard>

            {/* ─── STEP 8: Climate ─────────────────── */}
            <StepCard
              num={8} title="Your kitchen climate"
              activeStep={activeStep}
              summary={`${kitchenTemp}°C · ${HUMIDITY_LABEL[humidity]}`}
              onEdit={() => setActiveStep(8)}
            >
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="guided"
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />

              <button
                onClick={() => advance(8)}
                className="btn"
                style={{
                  marginTop: '1.25rem', width: '100%', padding: '.9rem',
                  border: 'none', borderRadius: '12px',
                  background: 'var(--char)', color: 'var(--cream)',
                  fontFamily: 'var(--font-playfair)', fontSize: '1rem', fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '.02em',
                }}
              >
                ✦ Craft My Baking Plan
              </button>
            </StepCard>

            {/* ─── RESULTS ───────────────────────────── */}
            {showResults && (
              <div ref={resultsRef} style={{ marginTop: '2rem' }}>

                {/* Results header */}
                <div style={{
                  background: 'var(--char)', borderRadius: '16px',
                  padding: '1.25rem 1.5rem', marginBottom: '1.75rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '.75rem',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--cream)' }}>
                      Your recipe is ready 🎯
                    </div>
                    {styleKey && (
                      <div style={{ fontSize: '.78rem', color: 'rgba(245,240,232,.55)', marginTop: '.2rem', fontFamily: 'var(--font-dm-mono)' }}>
                        {ALL_STYLES[styleKey].name} · {numItems} × {itemWeight} g · {OVEN_TYPES[ovenType].name}
                      </div>
                    )}
                  </div>
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
                    ↑ Start a new recipe
                  </button>
                </div>

                {/* Recipe null-guard */}
                {!recipe ? (
                  <div style={{
                    background: '#FEF4EF', border: '1.5px solid #F5C4B0',
                    borderRadius: '12px', padding: '1.25rem', textAlign: 'center',
                    color: 'var(--terra)', fontSize: '.88rem',
                  }}>
                    Could not compute recipe — please check your style selection and schedule times.
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
                              ⚖️ Large batch yeast adjustment
                            </div>
                            <div style={{ fontSize: '.78rem', color: '#7A6010', lineHeight: 1.55 }}>
                              Large dough mass retains heat longer — fermentation may be faster than calculated. Fine-tune if needed.
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
                                color: '#C4A030', minWidth: '52px', textAlign: 'center',
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
                                color: '#C4A030', fontWeight: 600,
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
                                border: 'none', borderRadius: '10px',
                                background: '#C4A030', color: '#fff',
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
                                border: '1.5px solid #E8D890', borderRadius: '10px',
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
                        eatTime={eatTime}
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
        {tab === 'advanced' && (
          <div style={{
            textAlign: 'center', padding: '5rem 2rem',
            background: 'var(--warm)', border: '1.5px solid var(--border)',
            borderRadius: '16px',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
            <div style={{
              fontFamily: 'var(--font-playfair)', fontSize: '1.5rem',
              fontWeight: 700, marginBottom: '.75rem',
            }}>
              Advanced Mode
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--smoke)', lineHeight: 1.7, maxWidth: '380px', margin: '0 auto' }}>
              Full control over hydration, oil, sugar, fridge temperature, and fermentation parameters.
              <br /><br />
              <span style={{ color: 'var(--gold)', fontWeight: 500 }}>Coming soon.</span>
            </div>
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
