'use client';
import { useState } from 'react';
import { type RecipeResult, type YeastResult } from '../utils';
import { YEAST_TYPES, PREFERMENT_TYPES, MIXER_TYPES, FLOUR_DATA, type PrefermentType, type FlourBlend } from '../data';
import { type UnitSystem, displayWeight, displayTemp } from '../utils/units';

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
  wastePct?: number;
  flourBlend?: FlourBlend;
  units?: UnitSystem;
}

// ── Helpers ──────────────────────────────────
function pctStr(n: number): string {
  return n < 1
    ? `${parseFloat(n.toFixed(3))}%`
    : `${parseFloat(n.toFixed(1))}%`;
}

function wStr(n: number): string {
  if (n <= 0) return '0 g';
  if (n < 1) return `${Math.max(0.1, parseFloat(n.toFixed(1)))} g`;
  const rounded = Math.round(n);
  return `${rounded >= 1000 ? rounded.toLocaleString() : rounded} g`;
}

// ── Theme tokens for dark card ────────────────
const D = {
  line:   'rgba(212,168,83,0.16)',   // gold-tinted dividers — warm, not cold
  muted:  'rgba(245,240,232,0.60)',  // readable ingredient labels
  sub:    'rgba(245,240,232,0.38)',  // secondary / column headers
};

// ── Yeast tooltip ─────────────────────────────
function YeastTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '13px', height: '13px', borderRadius: '50%',
          border: '1px solid rgba(138,127,120,0.6)',
          color: 'rgba(138,127,120,0.8)',
          fontSize: '.58rem', cursor: 'pointer', flexShrink: 0,
          fontFamily: 'var(--font-dm-sans)', lineHeight: 1,
          userSelect: 'none',
        }}
      >i</span>
      {open && (
        <span style={{
          position: 'absolute', bottom: '120%', right: 0,
          background: 'var(--ash)', color: 'var(--cream)',
          fontSize: '.72rem', fontFamily: 'var(--font-dm-sans)',
          padding: '.4rem .65rem', borderRadius: '8px',
          width: '220px', zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          lineHeight: 1.5,
        }}>
          Less yeast, more time — longer fermentation builds deeper flavour.
        </span>
      )}
    </span>
  );
}

// ── Flour tooltip (Simple mode) ────────────────
function FlourTooltip({ bakeType }: { bakeType?: string }) {
  const [open, setOpen] = useState(false);
  const msg = bakeType === 'bread'
    ? 'Strong bread flour works best — T65 or W200+. Plain flour works for short ferments.'
    : 'Italian 00 or T45 forte gives the best results. Using plain flour or T55? Switch to Custom mode to adapt your recipe.';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '13px', height: '13px', borderRadius: '50%',
          border: '1px solid rgba(138,127,120,0.6)',
          color: 'rgba(138,127,120,0.8)',
          fontSize: '.58rem', cursor: 'pointer', flexShrink: 0,
          fontFamily: 'var(--font-dm-sans)', lineHeight: 1,
          userSelect: 'none', marginLeft: '.35rem',
        }}
      >i</span>
      {open && (
        <span style={{
          position: 'absolute', bottom: '120%', right: 0,
          background: 'var(--ash)', color: 'var(--cream)',
          fontSize: '.72rem', fontFamily: 'var(--font-dm-sans)',
          lineHeight: 1.5,
          padding: '.5rem .7rem', borderRadius: '8px',
          width: '210px', zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}>
          {msg}
        </span>
      )}
    </span>
  );
}

// ── Ingredient row ─────────────────────────────
function IngRow({
  label, sub, grams, pct = '', highlight = false, range = false, advancedPct, noPct = false,
}: {
  label: React.ReactNode;
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
      gridTemplateColumns: '1fr auto auto',
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
      </div>

      <div style={{
        fontFamily: 'var(--font-dm-mono)',
        fontSize: '.72rem',
        color: 'var(--gold)',
        textAlign: 'right',
        minWidth: '4rem',
        whiteSpace: 'nowrap',
      }}>
        {noPct ? (advancedPct ?? '') : (advancedPct ?? pct)}
      </div>
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
  // Physics-based ice split
  const rawIce = waterGrams * (ambientTemp - targetTemp) / (targetTemp + 80);
  const iceGrams = Math.max(0, Math.round(rawIce));
  const tapGrams = waterGrams - iceGrams;
  const tempDiff = ambientTemp - targetTemp;

  // Ice protocol: full mixing instructions when ≥50g needed
  const needsIce = iceGrams >= 50;

  let iceGuidance = '';
  let tempGuidance: string;

  if (needsIce) {
    // Full ice protocol
    tempGuidance = 'add ice — see water row below';
    iceGuidance = isSpiral
      ? `${iceGrams}g ice + ${tapGrams}g water — add ice directly to bowl`
      : `mix ${iceGrams}g ice + ${tapGrams}g water, stir 1 min, strain before using`;
  } else if (iceGrams >= 20 && tempDiff >= 3) {
    // Ice helpful but not critical — suggest as an easy option
    tempGuidance = `chilled water, or add ${iceGrams}g ice to ${tapGrams}g water`;
  } else if (tempDiff >= 12) {
    tempGuidance = 'very cold water';
  } else if (tempDiff >= 5) {
    tempGuidance = 'chilled water';
  } else if (tempDiff >= 2) {
    tempGuidance = 'slightly below room temperature';
  } else {
    tempGuidance = 'at room temperature';
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
  priorityOverride, onPriorityOverride, saveStatus, onSave, wastePct, flourBlend, units,
}: RecipeOutputProps) {
  const u = units ?? 'metric';
  const wStr = (g: number) => displayWeight(g, u);
  const [showPriorityOverride, setShowPriorityOverride] = useState(false);
  const [showTotals, setShowTotals] = useState(false);
  const [showDilution, setShowDilution] = useState(false);

  // Batch splitting — auto-triggered when total dough exceeds mixer default capacity
  const mixerMaxG   = (MIXER_TYPES as Record<string, { maxDoughG?: number }>)[mixerType]?.maxDoughG ?? 9999;
  const totalDoughG = numItems * itemWeight;
  const minBatches  = Math.ceil(totalDoughG / mixerMaxG);
  const needsBatches = minBatches > 1;
  const [numBatches, setNumBatches] = useState(minBatches);
  // effectiveBatches can be 1 if baker overrides — no Math.max constraint
  const effectiveBatches = numBatches >= 1 ? numBatches : minBatches;

  const { flour, water, salt, yeast, sourdough, oil, sugar, waterTemp, hydration, totalDough } = result;

  // Per-batch: final dough ingredients only.
  // When preferment active: poolish/biga added whole, yeast excluded (already in preferment).
  const hasPref = result.preferment != null;
  const pf = result.preferment;
  const poolishTotalG = hasPref
    ? Math.round((pf?.prefFlour ?? 0) + (pf?.prefWater ?? 0) + (pf?.prefYeastGrams ?? 0))
    : 0;
  const batchFlour = hasPref ? (pf?.finalFlour ?? flour) : flour;
  const batchWater = hasPref ? (pf?.finalWater ?? water) : water;
  const flourPerBatch   = Math.round(batchFlour / effectiveBatches);
  const waterPerBatch   = Math.round(batchWater / effectiveBatches);
  const saltPerBatch    = Math.round(salt / effectiveBatches);
  const poolishPerBatch = hasPref ? Math.round(poolishTotalG / effectiveBatches) : null;
  const yeastGramsTotal = (yeast as YeastResult | null)?.convertedGrams ?? 0;
  const yeastPerBatch   = !hasPref && yeastGramsTotal > 0
    ? Math.round(yeastGramsTotal / effectiveBatches * 10) / 10
    : null;
  const batchDoughG = batchFlour + batchWater + salt + poolishTotalG
    + (!hasPref && yeastGramsTotal > 0 ? yeastGramsTotal : 0);

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
  // For preferment mode: ice protocol applies to final dough water only
  // Preferment water is mixed by hand at RT — no DDT adjustment needed
  const finalDoughWaterInfo = result.preferment
    ? computeWaterInfo(waterTemp, result.preferment.finalWater, kitchenTemp, isSpiral)
    : null;

  // Water row sub-line: source-agnostic temperature guidance
  function makeWaterSubNode(info: WaterInfo, kitchenT: number): React.ReactNode {
    if (info.iceGrams >= 50) {
      return (
        <>
          {'Target: '}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-dm-mono)', color: 'var(--terra)' }}>{displayTemp(info.targetTemp, u)}</span>
          {' · '}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-dm-mono)' }}>{info.iceGrams}g</span>
          {' ice + '}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-dm-mono)' }}>{info.tapGrams}g</span>
          {' cold water'}
        </>
      );
    }
    const tempDiff = kitchenT - info.targetTemp;
    const tempColor = tempDiff >= 14 ? 'var(--terra)' : tempDiff >= 8 ? 'var(--gold)' : undefined;
    return (
      <>
        {'Use at '}
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-dm-mono)', fontSize: '.9rem', color: tempColor }}>{displayTemp(info.targetTemp, u)}</span>
        {` · ${info.tempGuidance}`}
        {tempDiff >= 8 && (
          <span style={{ display: 'block', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '.1rem' }}>
            Keeps dough at target temperature despite mixer friction
          </span>
        )}
      </>
    );
  }
  const waterSubNode = makeWaterSubNode(waterInfo, kitchenTemp);
  const finalDoughWaterSubNode = finalDoughWaterInfo
    ? makeWaterSubNode(finalDoughWaterInfo, kitchenTemp)
    : waterSubNode;

  // Yeast sub-line: IDY conversion only (precision scale moved to its own callout)
  const needsPrecision = yeastInfo ? yeastInfo.convertedGrams < 0.5 : false;
  const yeastSub = yeastInfo
    ? (() => {
        const isInstant = yeastInfo.yeastType === 'instant';
        const idyPart = !isInstant ? `= ${wStr(yeastInfo.grams)} IDY` : null;
        return idyPart || undefined;
      })()
    : undefined;

  const sachetDilutionNote = null;

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

      {/* ── Compact header row ───────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '.25rem .1rem .5rem',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1.3rem',
            fontWeight: 700, color: 'var(--char)', marginBottom: '.2rem',
          }}>
            Your recipe is ready
          </div>
          <div style={{
            fontSize: '.78rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)',
          }}>
            {styleName}
            {' · '}
            <span style={{ color: 'var(--ash)', fontWeight: 600 }}>
              {numItems} × {itemWeight}g
            </span>
            {' · '}
            <span style={{ color: 'var(--ash)', fontWeight: 600 }}>
              {hydration}% hydration
            </span>
          </div>
          {wastePct !== undefined && wastePct > 0 && (
            <div style={{ fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', marginTop: '.2rem' }}>
              Includes {wastePct}% mixing buffer
            </div>
          )}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            style={{
              padding: '.45rem .9rem', borderRadius: '8px', flexShrink: 0, marginLeft: '1rem',
              border: `1.5px solid ${saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--border)'}`,
              background: 'transparent',
              color: saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--smoke)',
              fontSize: '.78rem', cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
              fontFamily: 'var(--font-dm-mono)',
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error' : 'Save recipe'}
          </button>
        )}
        {/* Total ingredients accordion now lives in the Final Dough card */}
        {false && (
          <div>
            <button
              onClick={() => setShowTotals(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: '.4rem',
                fontSize: '.72rem', color: 'rgba(212,168,83,0.7)',
                fontFamily: 'var(--font-dm-mono)',
              }}
            >
              <span>Total ingredients</span>
              <span style={{ fontSize: '.6rem', transition: 'transform .2s', transform: showTotals ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {showTotals && (() => {
              const pf = result.preferment!;
              const totalFlour = flour;
              const totalWater = water;
              const totalSalt  = salt;
              const totalYeast = pf.prefYeastGrams;
              return (
                <div style={{ marginTop: '.6rem' }}>
                  {[
                    { label: 'Flour', pct: '100%', value: `${Math.round(totalFlour).toLocaleString()}g` },
                    { label: 'Water', pct: `${Math.round(totalWater / totalFlour * 1000) / 10}%`, value: `${Math.round(totalWater).toLocaleString()}g` },
                    { label: 'Salt',  pct: `${Math.round(totalSalt  / totalFlour * 1000) / 10}%`, value: `${Math.round(totalSalt).toLocaleString()}g` },
                    ...(totalYeast > 0 ? [{ label: 'Yeast (IDY)', pct: `${Math.round(totalYeast / totalFlour * 1000) / 10}%`, value: `${totalYeast}g` }] : []),
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: '0 1.5rem',
                      alignItems: 'center',
                      padding: '.6rem .1rem',
                      borderBottom: `1px solid ${D.line}`,
                      fontSize: '.75rem', fontFamily: 'var(--font-dm-mono)',
                    }}>
                      <span style={{ color: D.muted }}>{row.label}</span>
                      <span style={{ color: 'rgba(245,240,232,0.9)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.value}</span>
                      <span style={{ color: 'var(--gold)', fontSize: '.72rem', textAlign: 'right', minWidth: '4rem', whiteSpace: 'nowrap' }}>{row.pct}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
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
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--cream)', marginBottom: '1rem' }}>
                Make your {pd.name}
              </div>
              <IngRow
                label="Flour"
                grams={wStr(pf.prefFlour)}
                noPct
                highlight
                sub={mode === 'custom' && flourBlend ? (() => {
                  const f1 = FLOUR_DATA[flourBlend.flour1];
                  const f1DisplayName = flourBlend.brandProduct ?? f1.name;
                  if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                    return <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)' }}>{f1DisplayName}</span>;
                  }
                  return <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)' }}>Use your primary flour ({f1DisplayName})</span>;
                })() : undefined}
              />
              <IngRow label="Water" grams={wStr(pf.prefWater)} noPct
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefWater / pf.prefFlour * 1000) / 10) : undefined}
                sub="At room temperature" />
              {pf.prefYeastGrams > 0 && (
                <IngRow
                  label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>Yeast (IDY)<YeastTooltip /></span>}
                  grams={wStr(pf.prefYeastGrams)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefYeastGrams / pf.prefFlour * 1000) / 10) : undefined} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                  {pd.name} total
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ~{prefTotal} g
                </div>
                <div style={{ minWidth: '4rem' }} />
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
              <IngRow label={`Your ${pd.name} (all of it)`} grams={wStr(prefTotal)} noPct highlight />
              {mode === 'custom' && flourBlend && flourBlend.flour2 && flourBlend.ratio1 < 100 ? (() => {
                const f1 = FLOUR_DATA[flourBlend.flour1];
                const f2 = FLOUR_DATA[flourBlend.flour2];
                const f1Weight = Math.round(pf.finalFlour * flourBlend.ratio1 / 100);
                const f2Weight = pf.finalFlour - f1Weight;
                const f1Pct = Math.round(f1Weight / flour * 1000) / 10;
                const f2Pct = Math.round(f2Weight / flour * 1000) / 10;
                return (
                  <>
                    <IngRow label={f1.name} grams={wStr(f1Weight)} noPct advancedPct={pctStr(f1Pct)} />
                    <IngRow label={flourBlend.customFlour2Name ?? f2.name} grams={wStr(f2Weight)} noPct advancedPct={pctStr(f2Pct)} />
                  </>
                );
              })() : (
                <IngRow
                  label={mode === 'custom' && flourBlend && (!flourBlend.flour2 || flourBlend.ratio1 >= 100)
                    ? (flourBlend.brandProduct ?? FLOUR_DATA[flourBlend.flour1].name)
                    : 'Remaining flour'}
                  grams={wStr(pf.finalFlour)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalFlour / flour * 1000) / 10) : undefined} />
              )}
              <IngRow label="Remaining water" grams={wStr(pf.finalWater)} noPct sub={finalDoughWaterSubNode}
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalWater / flour * 1000) / 10) : undefined} />
              <IngRow label="Salt" grams={wStr(salt)} noPct
                advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />
              {oil > 0 && <IngRow label="Olive Oil" grams={wStr(oil)} noPct />}
              {sugar > 0 && <IngRow label="Sugar" grams={wStr(sugar)} noPct />}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
                  Total Dough
                </div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {(numItems * itemWeight).toLocaleString('en')} g
                </div>
                <div style={{ minWidth: '4rem' }} />
              </div>
              {/* Total ingredients accordion — preferment mode */}
              <div style={{ marginTop: '1rem', borderTop: `1px solid ${D.line}`, paddingTop: '.75rem' }}>
                <button
                  onClick={() => setShowTotals(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: '.4rem',
                    fontSize: '.72rem', color: 'rgba(212,168,83,0.7)',
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                >
                  <span>Total ingredients</span>
                  <span style={{ fontSize: '.6rem', transition: 'transform .2s', transform: showTotals ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>
                {showTotals && (() => {
                  const pf = result.preferment!;
                  const totalFlour = flour;
                  const totalWater = water;
                  const totalSalt  = salt;
                  const totalYeast = pf.prefYeastGrams;
                  return (
                    <div style={{ marginTop: '.6rem' }}>
                      {[
                        { label: 'Flour', pct: '100%', value: `${Math.round(totalFlour).toLocaleString('en')}g` },
                        { label: 'Water', pct: `${Math.round(totalWater / totalFlour * 1000) / 10}%`, value: `${Math.round(totalWater).toLocaleString('en')}g` },
                        { label: 'Salt',  pct: `${Math.round(totalSalt  / totalFlour * 1000) / 10}%`, value: `${Math.round(totalSalt).toLocaleString('en')}g` },
                        ...(totalYeast > 0 ? [{ label: 'Yeast (IDY)', pct: `${Math.round(totalYeast / totalFlour * 1000) / 10}%`, value: `${totalYeast}g` }] : []),
                      ].map((row, i) => (
                        <div key={i} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: '0 1.5rem',
                          alignItems: 'center',
                          padding: '.6rem .1rem',
                          borderBottom: `1px solid ${D.line}`,
                          fontSize: '.75rem', fontFamily: 'var(--font-dm-mono)',
                        }}>
                          <span style={{ color: D.muted }}>{row.label}</span>
                          <span style={{ color: 'rgba(245,240,232,0.9)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.value}</span>
                          <span style={{ color: 'var(--gold)', fontSize: '.72rem', textAlign: 'right', minWidth: '4rem', whiteSpace: 'nowrap' }}>{row.pct}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

          <IngRow
            label={mode === 'simple'
              ? <span style={{ display: 'inline-flex', alignItems: 'center' }}>Flour<FlourTooltip bakeType={bakeType} /></span>
              : 'Flour'
            }
            grams={wStr(flour)}
            pct="100%"
            highlight
            advancedPct={mode === 'custom' ? '100%' : undefined}
            sub={mode === 'custom' && flourBlend ? (() => {
              const f1 = FLOUR_DATA[flourBlend.flour1];
              const f1DisplayName = flourBlend.brandProduct ?? f1.name;
              const f1Weight = Math.round(flour * flourBlend.ratio1 / 100);
              if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                return <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)' }}>{f1DisplayName}</span>;
              }
              const f2 = FLOUR_DATA[flourBlend.flour2];
              const f2Weight = flour - f1Weight;
              return (
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', color: 'rgba(255,255,255,0.5)' }}>
                  {flourBlend.ratio1}% {f1DisplayName} ({f1Weight.toLocaleString('en')}g)
                  {' · '}
                  {100 - flourBlend.ratio1}% {flourBlend.customFlour2Name ?? f2.name} ({f2Weight.toLocaleString('en')}g)
                </span>
              );
            })() : undefined}
          />
          <IngRow label="Water" grams={wStr(water)} pct={pctStr(waterPct)} sub={waterSubNode} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />
          <IngRow label="Salt"  grams={wStr(salt)}  pct={pctStr(saltPct)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />

          {yeastInfo && (
            <IngRow
              label={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                  {yeastTypeName}
                  <YeastTooltip />
                </span>
              }
              sub={yeastSub}
              grams={wStr(yeastInfo.convertedGrams)}
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
                {mode === 'custom' && (
                  <div style={{
                    fontSize: '.72rem',
                    fontStyle: 'italic', fontFamily: 'var(--font-dm-sans)',
                    padding: '.2rem .1rem .4rem',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={() => setShowPriorityOverride(v => !v)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(245,240,232,0.45)', fontSize: '.68rem',
                        fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline',
                        textUnderlineOffset: '2px', padding: 0,
                      }}
                    >
                      {showPriorityOverride ? 'Reset ✕' : 'Adjust →'}
                    </button>
                  </div>
                )}
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


          {sachetDilutionNote && (
            <div style={{ padding: '.2rem .1rem .35rem', borderBottom: `1px solid ${D.line}` }}>
              <button
                onClick={() => setShowDilution(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '.72rem', color: 'rgba(245,240,232,0.40)',
                  fontFamily: 'var(--font-dm-mono)', textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                {showDilution ? 'Hide measuring tip ↑' : 'Can\'t measure this precisely? →'}
              </button>
              {showDilution && (
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '.73rem', color: 'rgba(245,240,232,0.50)', marginTop: '.35rem', lineHeight: 1.55 }}>
                  {sachetDilutionNote}
                </div>
              )}
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
            <IngRow label="Olive Oil" grams={wStr(oil)} pct={pctStr(oilPct)} advancedPct={mode === 'custom' ? pctStr(oilPct) : undefined} />
          )}

          {sugar > 0 && (
            <IngRow label="Sugar" grams={wStr(sugar)} pct={pctStr(sugarPct)} advancedPct={mode === 'custom' ? pctStr(sugarPct) : undefined} />
          )}

          {/* TOTAL DOUGH row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 1.5rem', alignItems: 'center', padding: '.65rem .1rem 0', marginTop: '.1rem' }}>
            <div style={{ fontSize: '.75rem', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-dm-mono)' }}>
              Total Dough
            </div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {(numItems * itemWeight).toLocaleString('en')} g
            </div>
            <div style={{ minWidth: '4rem' }} />
          </div>
        </div>
      )}


      {/* ── Batch splitting callout ──────────────────────────────── */}
      {needsBatches && (
        <div style={{
          background: '#F5F0E8',
          border: '1.5px solid #D4A853',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.4rem' }}>
            <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#7A5A10', fontFamily: 'var(--font-dm-sans)' }}>
              Large batch — mix in stages
            </span>
          </div>
          {/* Explanation */}
          <div style={{ fontSize: '.78rem', color: '#5A4A10', lineHeight: 1.65, fontFamily: 'var(--font-dm-sans)', marginBottom: '.9rem' }}>
            {hasPref
              ? <>Your final dough is <strong>~{Math.round(batchDoughG)}g</strong> — more than your {(MIXER_TYPES as Record<string, { name: string }>)[mixerType]?.name ?? 'mixer'} handles in one go. The {prefermentType === 'biga' ? 'biga' : 'poolish'} is made separately in one go. How many batches for the final dough?</>
              : <>Your total dough is <strong>{totalDoughG}g</strong> — more than your {(MIXER_TYPES as Record<string, { name: string }>)[mixerType]?.name ?? 'mixer'} handles in one go. How many batches would you like to mix?</>
            }
          </div>
          {/* Batch count selector: ×1, ×2, ×3 pills + free input */}
          <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setNumBatches(n)}
                style={{
                  padding: '.3rem .8rem',
                  borderRadius: '20px',
                  border: `1.5px solid ${effectiveBatches === n ? '#D4A853' : '#C4B898'}`,
                  background: effectiveBatches === n ? '#D4A85320' : 'white',
                  color: effectiveBatches === n ? '#7A5A10' : '#8A7F78',
                  fontSize: '.8rem',
                  fontFamily: 'var(--font-dm-mono)',
                  fontWeight: effectiveBatches === n ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {n}×
              </button>
            ))}
            <input
              type="number"
              min={1}
              placeholder="other"
              value={effectiveBatches > 3 ? effectiveBatches : ''}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 1) setNumBatches(v); }}
              style={{
                width: '80px',
                padding: '.3rem .5rem',
                borderRadius: '20px',
                border: `1.5px solid ${effectiveBatches > 3 ? '#D4A853' : '#C4B898'}`,
                background: effectiveBatches > 3 ? '#D4A85320' : 'white',
                color: effectiveBatches > 3 ? '#7A5A10' : '#8A7F78',
                fontSize: '.8rem',
                fontFamily: 'var(--font-dm-mono)',
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>
          {/* Per-batch breakdown */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '.65rem .9rem', border: '1px solid #E8D890', marginBottom: '.65rem' }}>
            <div style={{ fontSize: '.65rem', fontWeight: 600, color: '#8A7F78', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--font-dm-mono)', marginBottom: '.45rem' }}>
              {hasPref ? `Final dough per batch (${effectiveBatches} × ~${Math.round(batchDoughG / effectiveBatches)}g)` : `Per batch (${effectiveBatches} × ~${Math.round(totalDoughG / effectiveBatches)}g)`}
            </div>
            {[
              ...(poolishPerBatch !== null ? [{
                label: prefermentType === 'biga' ? 'Biga' : 'Poolish',
                value: `${poolishPerBatch}g`,
                highlight: false,
                isTotal: false,
              }] : []),
              { label: hasPref ? 'Flour (final dough)' : 'Flour', value: `${flourPerBatch.toLocaleString('en')}g`, highlight: false, isTotal: false },
              { label: hasPref ? 'Water (final dough)' : 'Water', value: `${waterPerBatch.toLocaleString('en')}g`, highlight: false, isTotal: false },
              { label: 'Salt', value: `${saltPerBatch.toLocaleString('en')}g`, highlight: false, isTotal: false },
              ...(yeastPerBatch !== null ? [{
                label: `Yeast (${(yeast as YeastResult | null)?.yeastType ?? 'IDY'})`,
                value: `${yeastPerBatch}g`,
                highlight: false,
                isTotal: false,
              }] : []),
              { label: 'Batch total', value: `${(flourPerBatch + waterPerBatch + saltPerBatch + (poolishPerBatch ?? 0) + (yeastPerBatch !== null ? Math.round(yeastPerBatch) : 0)).toLocaleString('en')}g`, highlight: true, isTotal: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '.78rem', fontFamily: 'var(--font-dm-mono)',
                color: row.isTotal ? '#3D3530' : '#3D3530',
                padding: '.12rem 0',
                borderTop: row.isTotal ? '1px solid #E8D890' : 'none',
                paddingTop: row.isTotal ? '.4rem' : '.12rem',
                marginTop: row.isTotal ? '.2rem' : 0,
              }}>
                <span style={{ fontWeight: row.isTotal ? 600 : 400 }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>
          {/* Footer note */}
          <div style={{ fontSize: '.71rem', color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic' }}>
            Combine all batches into one container immediately after mixing. Bulk fermentation and schedule are unchanged.
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
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#7A5A10' }}>
                  Precision scale required
                </span>
              </div>
              <div style={{ fontSize: '.78rem', color: '#5A4010', lineHeight: 1.6, paddingLeft: '1.5rem' }}>
                {'Your yeast amount is '}
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 700, color: '#7A5A10' }}>
                  {wStr(yeastInfo.convertedGrams)}
                </span>
                {' — too small for a standard kitchen scale. Use a precision scale accurate to 0.1g, or use the dilution method.'}
              </div>
            </div>
          )}


          {/* Dilution tip */}
          {yeastInfo.dilutionTip && (
            <InfoCard
              icon=""
              level="info"
              title="Dilution required — amount too small to weigh directly"
              body={yeastInfo.dilutionTip}
            />
          )}

          {/* Poolish recommendation */}
          {yeastInfo.recommendPoolish && (
            <InfoCard
              icon=""
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
              icon=""
              level="alert"
              title="This fermentation schedule is not recommended"
              body="The combination of time and temperature will likely cause over-fermentation. Add a cold retard phase or shorten room-temperature time."
            />
          )}

          {/* Filtered warnings */}
          {filteredWarnings.map((w, i) => (
            <InfoCard key={i} icon="" level="warn" title="Watch out" body={w} />
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
              Sourdough Starter
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
