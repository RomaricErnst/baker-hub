'use client';
import { useState } from 'react';
import { type RecipeResult, type YeastResult } from '../utils';
import { YEAST_TYPES, PREFERMENT_TYPES, type PrefermentType } from '../data';

interface RecipeOutputProps {
  result: RecipeResult;
  numItems: number;
  itemWeight: number;
  styleName: string;
  mixerType: string;
  kitchenTemp: number;
  fermEquivHours: number;
  totalColdHours?: number;
  mode?: 'simple' | 'custom';
  bakeType?: 'pizza' | 'bread';
  prefermentType?: PrefermentType;
  priorityOverride?: string | null;
  onPriorityOverride?: (p: string | null) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onSave?: () => void;
}

// ── Helpers ──────────────────────────────────
function pctStr(n: number): string {
  return n < 1
    ? `${parseFloat(n.toFixed(3))}%`
    : `${parseFloat(n.toFixed(1))}%`;
}

function gStr(n: number): string {
  return n < 1
    ? `${parseFloat(n.toFixed(2))} g`
    : `${Math.round(n)} g`;
}

// ── Theme tokens for dark card ────────────────
const D = {
  line:   'rgba(212,168,83,0.16)',   // gold-tinted dividers — warm, not cold
  muted:  'rgba(245,240,232,0.60)',  // readable ingredient labels
  sub:    'rgba(245,240,232,0.38)',  // secondary / column headers
};

// ── Ingredient row ────────────────────────────
function IngRow({
  label, sub, grams, pct = '', highlight = false, range = false, advancedPct, noPct = false,
}: {
  label: string;
  sub?: React.ReactNode;
  grams: string;
  pct?: string;
  highlight?: boolean;
  range?: boolean;
  advancedPct?: string;
  noPct?: boolean;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: noPct ? '1fr auto' : '1fr auto auto',
      gap: '0 1.5rem',
      alignItems: 'center',
      padding: '.6rem .1rem',
      borderBottom: `1px solid ${D.line}`,
    }}>
      <div>
        <div style={{
          fontSize: '.82rem',
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'var(--cream)' : D.muted,
          letterSpacing: '.02em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '.78rem',
            color: 'rgba(255,255,255,.7)',
            fontFamily: 'var(--font-dm-mono)',
            marginTop: '.1rem',
            lineHeight: 1.5,
          }}>
            {sub}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-dm-mono)',
        fontSize: range ? '.82rem' : '1rem',
        fontWeight: 700,
        color: highlight ? 'var(--cream)' : 'rgba(245,240,232,0.88)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {grams}
        {advancedPct && (
          <span style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginLeft: '.35rem' }}>
            · {advancedPct}
          </span>
        )}
      </div>

      {!noPct && (
        <div style={{
          fontFamily: 'var(--font-dm-mono)',
          fontSize: '.72rem',
          color: 'var(--gold)',
          textAlign: 'right',
          minWidth: '4rem',
          whiteSpace: 'nowrap',
        }}>
          {pct}
        </div>
      )}
    </div>
  );
}

// ── Info cards (light) ────────────────────────
function InfoCard({
  icon, title, body, level = 'info',
}: {
  icon: string;
  title: string;
  body: React.ReactNode;
  level?: 'info' | 'warn' | 'alert' | 'good' | 'poolish';
}) {
  const THEMES = {
    info:    { bg: '#EEF2FA', border: '#C4CDE0', titleColor: '#3A4A6A', bodyColor: 'var(--ash)' },
    warn:    { bg: '#FFF8E8', border: '#E8D080', titleColor: '#7A5A10', bodyColor: '#5A4010' },
    alert:   { bg: '#FEF4EF', border: '#F5C4B0', titleColor: 'var(--terra)', bodyColor: 'var(--ash)' },
    good:    { bg: '#F2FAF0', border: '#B8D8B0', titleColor: '#3A6A30', bodyColor: '#2A4A22' },
    poolish: { bg: '#FDFBF2', border: '#E8D890', titleColor: '#6A5A10', bodyColor: '#4A3A10' },
  };
  const th = THEMES[level];
  return (
    <div style={{
      border: `1.5px solid ${th.border}`,
      borderRadius: '12px',
      padding: '.85rem 1rem',
      background: th.bg,
    }}>
      <div style={{ display: 'flex', gap: '.55rem', alignItems: 'center', marginBottom: '.35rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontSize: '.82rem', fontWeight: 600, color: th.titleColor }}>{title}</span>
      </div>
      <div style={{ fontSize: '.78rem', color: th.bodyColor, lineHeight: 1.6, paddingLeft: '1.55rem' }}>
        {body}
      </div>
    </div>
  );
}

// ── Water info ────────────────────────────────
interface WaterInfo {
  targetTemp: number;
  needsIce: boolean;
  iceGrams: number;
  tapGrams: number;
  iceGuidance: string;   // ice protocol text (only when needsIce)
  tempGuidance: string;  // short guidance for the ingredient sub-line
}

function computeWaterInfo(
  targetTemp: number,
  waterGrams: number,
  ambientTemp: number,
  isSpiral: boolean,
): WaterInfo {
  // Physics-based ice split: iceWeight × 80 + iceWeight × target = tapWater × (ambient - target)
  // → iceWeight = waterGrams × (ambient - target) / (target + 80)
  const rawIce = waterGrams * (ambientTemp - targetTemp) / (targetTemp + 80);
  const iceGrams = Math.max(0, Math.round(rawIce));
  const tapGrams = waterGrams - iceGrams;
  const needsIce = iceGrams > 0;

  let iceGuidance = '';
  let tempGuidance: string;

  if (needsIce) {
    tempGuidance = 'ice water — see protocol below';
    iceGuidance = isSpiral
      ? `${iceGrams}g ice + ${tapGrams}g tap water — add ice directly to mixing bowl`
      : `fill jug with ${iceGrams}g ice + ${tapGrams}g water, stir 1 min, strain`;
  } else if (targetTemp <= 13) {
    tempGuidance = 'very cold fridge water — chill 2h before mixing';
  } else if (targetTemp <= 19) {
    tempGuidance = 'cold fridge water';
  } else {
    tempGuidance = 'room temperature tap water';
  }

  return { targetTemp, needsIce, iceGrams, tapGrams, iceGuidance, tempGuidance };
}

// ── Starter prep card ─────────────────────────
function StarterPrepCard({ sourdough }: { sourdough: { starterGramsMin: number; starterGramsMax: number } | null }) {
  const [discardOpen, setDiscardOpen] = useState(false);
  if (!sourdough) return null;

  const targetGrams = sourdough.starterGramsMax;
  const feedFlour   = Math.round(targetGrams / 2);
  const feedWater   = Math.round(targetGrams / 2);
  const discardKeep = Math.round(targetGrams / 2);

  const M = { fontSize: '.82rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--terra)', fontWeight: 600 };

  const readyChecks = [
    'Doubled in size ✓',
    'Domed top, slightly bubbly ✓',
    'Float test: drop a piece in water → floats ✓',
    'Smells tangy, not alcoholic ✓',
  ];

  return (
    <div style={{
      background: 'var(--warm)',
      border: '1.5px solid var(--border)',
      borderRadius: '13px',
      padding: '1rem 1.2rem',
      marginTop: '.75rem',
    }}>
      <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '.82rem', fontWeight: 600, color: 'var(--char)', marginBottom: '.75rem' }}>
        🫙 Preparing your starter
      </div>

      {/* Section A — How much to prepare */}
      <div style={{ marginBottom: '.75rem' }}>
        {[
          <>Keep <span style={M}>{discardKeep}g</span> of your current starter</>,
          <>Add <span style={M}>{feedFlour}g</span> flour + <span style={M}>{feedWater}g</span> water</>,
          <>You&apos;ll have ~<span style={M}>{targetGrams}g</span> ready to use</>,
        ].map((line, i) => (
          <div key={i} style={{ fontSize: '.78rem', color: 'var(--ash)', lineHeight: 1.7 }}>{line}</div>
        ))}
      </div>

      {/* Section B — Discard note (collapsible) */}
      <div style={{ marginBottom: '.75rem' }}>
        <button
          onClick={() => setDiscardOpen(o => !o)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: '.76rem', color: 'var(--smoke)', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '.25rem',
          }}
        >
          What to do with the discard? {discardOpen ? '▴' : '▾'}
        </button>
        {discardOpen && (
          <div style={{ marginTop: '.45rem', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            <div style={{ fontSize: '.76rem', color: 'var(--ash)', lineHeight: 1.55 }}>
              Discard the rest before feeding — or use it for pancakes, crackers or flatbread 🥞
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--ash)', lineHeight: 1.55 }}>
              Never throw all your starter away — always keep at least 20–30g.
            </div>
          </div>
        )}
      </div>

      {/* Section C — Ready check */}
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: '.6rem',
      }}>
        <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--smoke)', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.45rem' }}>
          Your starter is ready when:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
          {readyChecks.map((cue, i) => (
            <div key={i} style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start' }}>
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%',
                border: '1.5px solid var(--border)',
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                marginTop: '.05rem',
              }}>{i + 1}</span>
              <span style={{ fontSize: '.78rem', color: 'var(--ash)', lineHeight: 1.55 }}>{cue}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────
export default function RecipeOutput({
  result, numItems, itemWeight, styleName, mixerType, kitchenTemp, fermEquivHours, totalColdHours = 0, mode = 'simple', bakeType = 'pizza', prefermentType,
  priorityOverride, onPriorityOverride, saveStatus, onSave,
}: RecipeOutputProps) {
  const [showPriorityOverride, setShowPriorityOverride] = useState(false);
  const { flour, water, salt, yeast, sourdough, oil, sugar, waterTemp, hydration, totalDough } = result;

  const yeastInfo = yeast as YeastResult | null;
  const yeastTypeName = yeastInfo ? YEAST_TYPES[yeastInfo.yeastType]?.name ?? yeastInfo.yeastType : '';

  // Baker's percentages (relative to flour)
  const waterPct  = Math.round(water  / flour * 1000) / 10;
  const saltPct   = Math.round(salt   / flour * 1000) / 10;
  const oilPct    = oil   > 0 ? Math.round(oil   / flour * 1000) / 10 : 0;
  const sugarPct  = sugar > 0 ? Math.round(sugar / flour * 1000) / 10 : 0;

  // Computed ingredient total (excl. starter)
  const ingredientTotal = flour + water + salt
    + (yeastInfo ? yeastInfo.convertedGrams : 0)
    + oil + sugar;

  const itemLabel = numItems === 1 ? 'ball / loaf' : numItems <= 4 ? 'balls' : 'pieces';

  const isSpiral = mixerType === 'spiral';
  const waterInfo = computeWaterInfo(waterTemp, water, kitchenTemp, isSpiral);

  // Water temp colour: terra when ice-cold, gold when cool, plain when normal
  const waterTempColor = waterTemp < 10 ? 'var(--terra)' : waterTemp <= 18 ? 'var(--gold)' : undefined;

  // Water row sub-line: bold temperature as a precision signal
  const waterSubNode: React.ReactNode = (
    <>
      {'💧 Use at '}
      <span style={{ fontWeight: 700, fontFamily: 'var(--font-dm-mono)', fontSize: '.9rem', color: waterTempColor }}>{waterInfo.targetTemp}°C</span>
      {` · ${waterInfo.tempGuidance}`}
      {waterInfo.targetTemp <= 15 && (
        <span style={{ display: 'block', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '.1rem' }}>
          Keeps dough at target temperature despite mixer friction
        </span>
      )}
    </>
  );

  // Yeast sub-line: IDY conversion only (precision scale moved to its own callout)
  const needsPrecision = yeastInfo ? yeastInfo.convertedGrams < 0.5 : false;
  const yeastSub = yeastInfo
    ? (() => {
        const isInstant = yeastInfo.yeastType === 'instant';
        const idyPart = !isInstant ? `= ${gStr(yeastInfo.grams)} IDY` : null;
        return idyPart || undefined;
      })()
    : undefined;

  // Sachet dilution note: when convertedGrams < 1g
  // X = needed_grams × 10 (ml of solution to use from a 70ml batch)
  const sachetDilutionNote = yeastInfo && yeastInfo.convertedGrams < 1
    ? `Can't measure this precisely? Dissolve your full yeast sachet in 10× its weight in water. Use ${Math.round(yeastInfo.convertedGrams * 10 * 10) / 10}ml of that solution.`
    : null;

  // Allowlist approach: only keep warnings about structural issues, never temperature context
  const WARN_ALLOWLIST = ['precision scale', 'poolish', 'not recommended', 'dilution'];
  function isAllowedWarning(w: string): boolean {
    const lw = w.toLowerCase();
    return WARN_ALLOWLIST.some(term => lw.includes(term));
  }

  const filteredWarnings = yeastInfo
    ? yeastInfo.warnings
        .filter(isAllowedWarning)
        .filter(w => !yeastInfo.notRecommended || !w.toLowerCase().includes('not recommended'))
    : [];

  // Suppress explanation if it's purely temperature context
  const EXPLANATION_BLOCKLIST = [
    'kitchen', 'warm', 'hot', 'cool', 'cold', '°c', 'reduced',
    'yeast activity', 'temperature', 'ferment faster', 'ferment more',
  ];
  const showExplanation = yeastInfo
    ? !EXPLANATION_BLOCKLIST.some(term => yeastInfo.explanation.toLowerCase().includes(term))
    : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Combined header card ─────────────────── */}
      <div style={{
        background: 'var(--char)', borderRadius: '18px',
        border: '1px solid rgba(212,168,83,0.15)',
        padding: '1.3rem 1.6rem',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '.75rem',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1.3rem',
            fontWeight: 700, color: 'var(--gold)', marginBottom: '.3rem',
          }}>
            Your recipe is ready
          </div>
          <div style={{
            fontSize: '.78rem', color: 'rgba(245,240,232,.6)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {styleName}
            {' · '}
            <span style={{ color: 'rgba(245,240,232,.9)', fontWeight: 600 }}>
              {numItems} × {itemWeight}g
            </span>
            {' · '}
            <span style={{ color: 'rgba(245,240,232,.9)', fontWeight: 600 }}>
              {hydration}% hydration
            </span>
          </div>
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            style={{
              padding: '.45rem .9rem', borderRadius: '8px',
              border: `1.5px solid ${saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'rgba(212,168,83,0.4)'}`,
              background: 'transparent',
              color: saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--gold)',
              fontSize: '.78rem', cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error' : 'Save recipe'}
          </button>
        )}
      </div>

      {/* ── Ingredients / Preferment cards ──────── */}
      {result.preferment && prefermentType && prefermentType !== 'none' ? (() => {
        const pf = result.preferment!;
        const pd = PREFERMENT_TYPES[prefermentType];
        const prefTotal = Math.round(pf.prefFlour + pf.prefWater + pf.prefYeastGrams);

        return (
          <>
            {/* CARD 1: Make your preferment */}
            <div style={{ background: 'var(--char)', borderRadius: '18px', padding: '1.5rem 1.6rem', border: '1px solid rgba(212,168,83,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--cream)', marginBottom: '.3rem' }}>
                {pd.emoji} Make your {pd.name}
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'var(--gold)', marginBottom: '1rem' }}>
                {pf.schedule}
              </div>
              <IngRow label="Flour" grams={gStr(pf.prefFlour)} noPct highlight />
              <IngRow label="Water" grams={gStr(pf.prefWater)} noPct />
              {pf.prefYeastGrams > 0 && (
                <IngRow label="Yeast (IDY)" grams={gStr(pf.prefYeastGrams)} noPct />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                  {pd.name} total
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ~{prefTotal} g
                </div>
              </div>
            </div>

            {/* CARD 2: Final dough */}
            <div style={{ background: 'var(--char)', borderRadius: '18px', padding: '1.5rem 1.6rem', border: '1px solid rgba(212,168,83,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--cream)', marginBottom: '.3rem' }}>
                Final dough
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: D.muted, marginBottom: '1rem' }}>
                Add your {pd.name} to the remaining ingredients
              </div>
              <IngRow label={`Your ${pd.name} (all of it)`} grams={gStr(prefTotal)} noPct highlight />
              <IngRow label="Remaining flour" grams={gStr(pf.finalFlour)} noPct />
              <IngRow label="Remaining water" grams={gStr(pf.finalWater)} noPct sub={waterSubNode} />
              <IngRow label="Salt" grams={gStr(salt)} noPct />
              {oil > 0 && <IngRow label="Olive Oil" grams={gStr(oil)} noPct />}
              {sugar > 0 && <IngRow label="Sugar" grams={gStr(sugar)} noPct />}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                  Total Dough
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {numItems * itemWeight} g
                </div>
              </div>
            </div>
          </>
        );
      })() : (
        /* SCENARIO A: Single ingredients card */
        <div style={{ background: 'var(--char)', borderRadius: '18px', padding: '1.5rem 1.6rem', border: '1px solid rgba(212,168,83,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--cream)' }}>
              Ingredients
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1.5rem', width: '100%', maxWidth: '75%' }}>
              <span />
              <span style={{ fontSize: '.65rem', color: D.sub, fontFamily: 'var(--font-dm-mono)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em' }}>Weight</span>
              <span style={{ fontSize: '.65rem', color: D.sub, fontFamily: 'var(--font-dm-mono)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '4rem' }}>Baker&apos;s %</span>
            </div>
          </div>

          <IngRow label="Flour" grams={gStr(flour)} pct="100%" highlight advancedPct={mode === 'custom' ? '100%' : undefined} />
          <IngRow label="Water" grams={gStr(water)} pct={pctStr(waterPct)} sub={waterSubNode} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />
          <IngRow label="Salt"  grams={gStr(salt)}  pct={pctStr(saltPct)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />

          {yeastInfo && (
            <IngRow
              label={yeastTypeName}
              sub={yeastSub}
              grams={gStr(yeastInfo.convertedGrams)}
              pct={pctStr(yeastInfo.convertedPct)}
              advancedPct={mode === 'custom' ? pctStr(yeastInfo.convertedPct) : undefined}
            />
          )}

          {yeastInfo && (() => {
            const priorityLabel = ({
              'flavor': { emoji: '🐢', text: 'Flavour-first yeast — you have plenty of time', color: 'var(--sage)' },
              'speed':  { emoji: '⚡', text: 'Speed-adjusted yeast — your window is tight',   color: 'var(--gold)' },
            } as Record<string, { emoji: string; text: string; color: string }>)[result.autoPriority ?? ''] ?? { emoji: '⚖️', text: 'Balanced yeast for your schedule', color: 'var(--smoke)' };
            return (
              <>
                <div style={{
                  fontSize: '.72rem', color: priorityLabel.color,
                  fontStyle: 'italic', fontFamily: 'var(--font-dm-sans)',
                  padding: '.2rem .1rem .4rem',
                  display: 'flex', alignItems: 'center', gap: '.35rem',
                  justifyContent: 'space-between',
                }}>
                  <span>{priorityLabel.emoji} {priorityLabel.text}</span>
                  {mode === 'custom' && (
                    <button
                      onClick={() => setShowPriorityOverride(v => !v)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(245,240,232,0.45)', fontSize: '.68rem',
                        fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline',
                        textUnderlineOffset: '2px', padding: 0, flexShrink: 0,
                      }}
                    >
                      {showPriorityOverride ? 'Reset ✕' : 'Adjust →'}
                    </button>
                  )}
                </div>
                {showPriorityOverride && mode === 'custom' && (
                  <div style={{ display: 'flex', gap: '.4rem', padding: '.35rem .1rem .5rem', borderBottom: `1px solid rgba(212,168,83,0.16)` }}>
                    {([
                      { value: 'flavor', label: '🐢 Flavour', desc: 'Less yeast, more time' },
                      { value: null,     label: '⚖️ Balanced', desc: 'Standard' },
                      { value: 'speed',  label: '⚡ Speed',    desc: 'More yeast, faster' },
                    ] as { value: string | null; label: string; desc: string }[]).map(opt => {
                      const effective = priorityOverride !== undefined ? priorityOverride : result.autoPriority;
                      const isActive = effective === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          onClick={() => onPriorityOverride?.(opt.value)}
                          style={{
                            padding: '.3rem .65rem', borderRadius: '20px', cursor: 'pointer',
                            border: `1.5px solid ${isActive ? 'var(--gold)' : 'rgba(212,168,83,0.2)'}`,
                            background: isActive ? 'rgba(212,168,83,0.15)' : 'transparent',
                            color: isActive ? 'var(--gold)' : 'rgba(245,240,232,0.5)',
                            fontSize: '.7rem', fontFamily: 'var(--font-dm-sans)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.1rem',
                          }}
                        >
                          <span style={{ fontWeight: isActive ? 600 : 400 }}>{opt.label}</span>
                          <span style={{ fontSize: '.6rem', opacity: .7 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}

          {yeastInfo && yeastInfo.convertedGrams < 2 && totalColdHours >= 24 && (
            <span style={{ fontSize: '.72rem', color: 'rgba(245,240,232,0.50)', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', marginTop: '.25rem', display: 'block', padding: '0 .1rem' }}>
              Yes, that&apos;s intentional — less yeast, more time = deeper flavour. Trust the process. 🍕
            </span>
          )}

          {sachetDilutionNote && (
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.73rem', color: 'rgba(245,240,232,0.50)', padding: '.4rem .1rem .35rem', lineHeight: 1.55, borderBottom: `1px solid ${D.line}` }}>
              {sachetDilutionNote}
            </div>
          )}

          {sourdough && (
            <IngRow
              label="Sourdough Starter"
              sub="add to flour + water"
              grams={`${sourdough.starterGramsMin}–${sourdough.starterGramsMax} g`}
              pct={`${sourdough.starterPctMin}–${sourdough.starterPctMax}%`}
              range
            />
          )}

          {oil > 0 && (
            <IngRow label="Olive Oil" grams={gStr(oil)} pct={pctStr(oilPct)} advancedPct={mode === 'custom' ? pctStr(oilPct) : undefined} />
          )}

          {sugar > 0 && (
            <IngRow label="Sugar" grams={gStr(sugar)} pct={pctStr(sugarPct)} advancedPct={mode === 'custom' ? pctStr(sugarPct) : undefined} />
          )}

          {/* TOTAL DOUGH row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
            <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
              Total Dough
            </div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {numItems * itemWeight} g
            </div>
            <div style={{ minWidth: '4rem' }} />
          </div>
        </div>
      )}

      {/* ── Flour note (Simple mode only) ───────── */}
      {mode === 'simple' && (() => {
        let main: string;
        if (bakeType === 'bread') {
          if (fermEquivHours < 8) {
            main = 'Bread flour works well for this plan.';
          } else if (fermEquivHours < 24) {
            main = 'Strong bread flour recommended — T65 or bread flour W200+ 🌾';
          } else {
            main = 'High-protein flour essential — T65 forte or bread flour W260+ 🌾';
          }
        } else {
          if (fermEquivHours < 8) {
            main = 'Pizza or bread flour works well for this plan.';
          } else if (fermEquivHours < 24) {
            main = 'Pizza flour gives the best results — Italian 00 is ideal. French T45 forte works too 🌾';
          } else {
            main = 'Strong pizza flour recommended — Italian 00 W270+. French alternative: T45 forte W260+ 🌾';
          }
        }
        return (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--sage)',
            borderRadius: '10px',
            padding: '.75rem 1rem',
          }}>
            <div style={{ fontSize: '.8rem', fontFamily: 'var(--font-dm-sans)', color: 'var(--char)', lineHeight: 1.55 }}>
              {main}
            </div>
            <div style={{ fontSize: '.72rem', fontFamily: 'var(--font-dm-mono)', color: 'var(--smoke)', textDecoration: 'underline', cursor: 'pointer', marginTop: '.35rem', display: 'block' }}>
              Using plain flour or T55? Tap to adapt →
            </div>
          </div>
        );
      })()}

      {/* ── Ice water protocol ───────────────────── */}
      {waterTemp < 15 && (
        <div style={{
          background: '#EEF6FF',
          border: '1.5px solid #B0CDE8',
          borderRadius: '10px',
          padding: '.75rem 1rem',
        }}>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.4rem' }}>
            <span style={{ fontSize: '1rem' }}>🧊</span>
            <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#1E4A6A' }}>Ice water protocol</span>
          </div>
          <div style={{ fontSize: '.78rem', color: '#2A5070', lineHeight: 1.6 }}>
            {'Your dough needs very cold water. Mix '}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 700 }}>{Math.round(water * 0.3)}g</span>
            {' of ice with '}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 700 }}>{water - Math.round(water * 0.3)}g</span>
            {' of cold water. Remove ice just before adding to flour — you want water at '}
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 700 }}>{waterInfo.targetTemp}°C</span>
            {'.'}
          </div>
        </div>
      )}

      {/* ── Yeast details ─────────────────────────── */}
      {yeastInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>

          {/* Min floor callout — shown when 0.5g IDY floor was applied */}
          {yeastInfo.hitMinFloor && (
            <div style={{
              background: '#FFFBEE',
              border: '1.5px solid #D4A853',
              borderRadius: '12px',
              padding: '.85rem 1rem',
            }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#7A5A10' }}>
                  Precision scale recommended — this is a very small amount of yeast.
                </span>
              </div>
            </div>
          )}

          {/* Precision scale callout */}
          {needsPrecision && (
            <div style={{
              background: '#FFFBEE',
              border: '1.5px solid #D4A853',
              borderRadius: '12px',
              padding: '.85rem 1rem',
            }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.3rem' }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#7A5A10' }}>
                  Precision scale required
                </span>
              </div>
              <div style={{ fontSize: '.78rem', color: '#5A4010', lineHeight: 1.6, paddingLeft: '1.5rem' }}>
                {'Your yeast amount is '}
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 700, color: '#7A5A10' }}>
                  {gStr(yeastInfo.convertedGrams)}
                </span>
                {' — too small for a standard kitchen scale. Use a precision scale accurate to 0.1g, or use the dilution method.'}
              </div>
            </div>
          )}

          {/* Explanation */}
          {showExplanation && (
            <div style={{
              fontSize: '.8rem', color: 'var(--smoke)',
              background: 'var(--warm)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '.65rem .9rem',
              fontFamily: 'var(--font-dm-mono)', lineHeight: 1.55,
            }}>
              {yeastInfo.explanation}
            </div>
          )}

          {/* Dilution tip */}
          {yeastInfo.dilutionTip && (
            <InfoCard
              icon="🧪"
              level="info"
              title="Dilution required — amount too small to weigh directly"
              body={yeastInfo.dilutionTip}
            />
          )}

          {/* Poolish recommendation */}
          {yeastInfo.recommendPoolish && (
            <InfoCard
              icon="🏺"
              level="poolish"
              title="Poolish preferment recommended"
              body={
                <>
                  Long room-temperature fermentation is hard to control. A poolish gives you better
                  flavour and more predictable timing. Mix 50% of your flour with an equal weight of water
                  and a pinch of yeast 8–16h before baking.
                </>
              }
            />
          )}

          {/* Not recommended warning */}
          {yeastInfo.notRecommended && (
            <InfoCard
              icon="⚠️"
              level="alert"
              title="This fermentation schedule is not recommended"
              body="The combination of time and temperature will likely cause over-fermentation. Add a cold retard phase or shorten room-temperature time."
            />
          )}

          {/* Filtered warnings */}
          {filteredWarnings.map((w, i) => (
            <InfoCard key={i} icon="⚠️" level="warn" title="Watch out" body={w} />
          ))}
        </div>
      )}

      {/* ── Sourdough guidance ────────────────────── */}
      {sourdough && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>

          {/* Starter range */}
          <div style={{
            background: 'var(--char)',
            borderRadius: '18px',
            padding: '1.2rem 1.4rem',
            border: '1px solid rgba(212,168,83,0.12)',
          }}>
            <div style={{ fontSize: '.7rem', color: D.sub, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem' }}>
              Sourdough Starter 🫙
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>
                {sourdough.starterGramsMin}–{sourdough.starterGramsMax} g
              </span>
              <span style={{ fontSize: '.8rem', color: D.muted, fontFamily: 'var(--font-dm-mono)' }}>
                ({sourdough.starterPctMin}–{sourdough.starterPctMax}% of flour)
              </span>
            </div>
            <div style={{ fontSize: '.75rem', color: D.sub, marginTop: '.4rem', lineHeight: 1.5 }}>
              Feed your starter 4–12h before mixing. Use it at peak activity — doubled in size, domed on top.
            </div>
          </div>


          {/* Bulk fermentation cues */}
          <div style={{
            border: '1.5px solid var(--border)',
            borderRadius: '13px',
            padding: '1rem 1.2rem',
            background: 'var(--warm)',
          }}>
            <div style={{
              fontSize: '.72rem', color: 'var(--smoke)',
              textTransform: 'uppercase', letterSpacing: '.06em',
              fontFamily: 'var(--font-dm-mono)', marginBottom: '.7rem',
            }}>
              Bulk fermentation is ready when…
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
              {sourdough.bulkCues.map((cue, i) => (
                <div key={i} style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '1.5px solid var(--border)',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.6rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                    marginTop: '.05rem',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '.8rem', color: 'var(--ash)', lineHeight: 1.55 }}>{cue}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Starter preparation card ──────────── */}
          <StarterPrepCard sourdough={sourdough} />

        </div>
      )}

    </div>
  );
}
