'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type RecipeResult, type YeastResult, type YeastWarningKey } from '../utils';
import { YEAST_TYPES, PREFERMENT_TYPES, MIXER_TYPES, FLOUR_DATA, type PrefermentType, type FlourBlend } from '../data';
import { type UnitSystem, displayWeight, displayTemp } from '../utils/units';
import PlanNav from './PlanNav';

interface RecipeOutputProps {
  result: RecipeResult;
  numItems: number;
  itemWeight: number;
  styleName: string;
  mixerType: string;
  kitchenTemp: number;
  fridgeTemp?: number;
  fermEquivHours: number;
  totalColdHours?: number;
  mode?: 'simple' | 'custom';
  bakeType?: 'pizza' | 'bread';
  ovenType?: string | null;
  prefermentType?: PrefermentType;
  priorityOverride?: string | null;
  onPriorityOverride?: (p: string | null) => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onSave?: () => void;
  wastePct?: number;
  flourBlend?: FlourBlend;
  units?: UnitSystem;
  feedTime?: Date | null;
  feed2Time?: Date | null;
  fridgeOutTime?: Date | null;
  starterPeakTime?: Date | null;
  planningMode?: 'last_fed' | 'know_peak';
  usingPeak2?: boolean;
  feedRatio?: 1 | 2 | 4 | 5 | 10;
  starterLocation?: 'rt' | 'fridge';
  onEditSetup?: () => void;
  onOpenGuide?: () => void;
  onShare?: () => void;
}

// ── Helpers ──────────────────────────────────
// A percentage must not claim more precision than the weight it comes from.
// Yeast shows as 0.7 g — two significant figures — so 0.107% was inventing a
// third. Two significant figures below 1%, one decimal above.
function pctStr(n: number): string {
  if (n <= 0) return '0%';
  if (n >= 1) return `${parseFloat(n.toFixed(1))}%`;
  const decimals = Math.max(2, 1 - Math.floor(Math.log10(n)));
  return `${parseFloat(n.toFixed(decimals))}%`;
}

function wStr(n: number): string {
  if (n <= 0) return '0 g';
  if (n < 1) return `${Math.max(0.1, parseFloat(n.toFixed(1)))} g`;
  // Keep one decimal below 10g — rounding 4.7g yeast to "5 g" here while the
  // mixing order says "4.7g" made the two cards disagree.
  if (n < 10) return `${parseFloat(n.toFixed(1))} g`;
  const rounded = Math.round(n);
  return `${rounded >= 1000 ? rounded.toLocaleString() : rounded} g`;
}

// ── Theme tokens for dark card ────────────────
const D = {
  line:   'rgba(156, 130, 72,0.16)',   // gold-tinted dividers — warm, not cold
  muted:  'rgba(240, 235, 224,0.60)',  // readable ingredient labels
  sub:    'rgba(240, 235, 224,0.38)',  // secondary / column headers
};

// The yeast and flour info dots lived here. Flour's guidance is actionable
// ("using plain flour? switch to Custom") and now shows as the row's own
// caption. Yeast's was a principle rather than a fact about that number —
// "less yeast, more time" — repeated on two rows of a table you cook from. It
// belongs with the protocol, not in the ingredient list.

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
      gap: '0 24px',
      alignItems: 'center',
      padding: '8px .1rem',
      borderBottom: `1px solid ${D.line}`,
    }}>
      <div>
        <div style={{
          fontSize: '13px',
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'var(--cream)' : D.muted,
          letterSpacing: '.02em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,.7)',
            fontFamily: 'var(--font-ui)',
            marginTop: '.1rem',
            lineHeight: 1.5,
          }}>
            {sub}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: range ? '.82rem' : '1rem',
        fontWeight: 700,
        color: highlight ? 'var(--cream)' : 'rgba(240, 235, 224,0.88)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {grams}
      </div>

      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
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
      borderRadius: '16px',
      padding: '12px 16px',
      background: th.bg,
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: th.titleColor }}>{title}</span>
      </div>
      <div style={{ fontSize: '12px', color: th.bodyColor, lineHeight: 1.6, paddingLeft: '24px' }}>
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
  isFr = false,
): WaterInfo {
  // Physics-based ice split.
  //
  //   ice·(L + c·T)            = (W − ice)·c·(amb − T)
  //   ice·(L/c + T)            = (W − ice)·(amb − T)
  //   ice·(L/c + T + amb − T)  = W·(amb − T)
  //   ice                      = W·(amb − T) / (L/c + amb)
  //
  // The T cancels. The denominator is L/c + ambient, NOT 80 + target, which is
  // what stood here and over-prescribed ice by ~20%, worsening with ambient:
  // at 30 °C targeting 10 °C it asked for 111 g where 91 g is right and landed
  // the water at 5.6 °C, and at 34 °C targeting 6 °C it asked for more ice than
  // could melt — the baker strains out the remainder and gets both the wrong
  // temperature and less water than the hydration calls for.
  const ICE_LATENT_OVER_CP = 79.8;   // L/c = 334 J/g ÷ 4.186 J/g·K
  const rawIce = waterGrams * (ambientTemp - targetTemp) / (ICE_LATENT_OVER_CP + ambientTemp);
  const iceGrams = Math.max(0, Math.round(rawIce));
  const tapGrams = waterGrams - iceGrams;
  const tempDiff = ambientTemp - targetTemp;

  // Ice protocol: full mixing instructions when ≥50g needed
  const needsIce = iceGrams >= 50;

  let iceGuidance = '';
  let tempGuidance: string;

  if (needsIce) {
    // Full ice protocol
    tempGuidance = isFr ? 'ajoutez de la glace — voir la ligne eau ci-dessous' : 'add ice — see water row below';
    iceGuidance = isSpiral
      ? (isFr ? `${iceGrams}g de glace + ${tapGrams}g d'eau — glace directement dans la cuve` : `${iceGrams}g ice + ${tapGrams}g water — add ice directly to bowl`)
      : (isFr ? `mélangez ${iceGrams}g de glace + ${tapGrams}g d'eau, remuez 1 min, filtrez avant usage` : `mix ${iceGrams}g ice + ${tapGrams}g water, stir 1 min, strain before using`);
  } else if (tempDiff <= -8) {
    // Target ABOVE ambient. Only reachable with a cold preferment in the mix —
    // it is 25–55% of the dough mass, so the water has to carry the difference.
    // Every branch below assumes target < ambient and would have silently told
    // the baker "at room temperature", which is the opposite of what is needed.
    tempGuidance = isFr ? 'eau chaude — au-dessus de la température de la pièce' : 'warm water — above room temperature';
  } else if (tempDiff <= -3) {
    tempGuidance = isFr ? 'eau tiède — légèrement au-dessus de la température de la pièce' : 'lukewarm water — slightly above room temperature';
  } else if (iceGrams >= 20 && tempDiff >= 3) {
    // Ice helpful but not critical — suggest as an easy option
    tempGuidance = isFr ? `eau bien froide, ou ${iceGrams}g de glace dans ${tapGrams}g d'eau` : `chilled water, or add ${iceGrams}g ice to ${tapGrams}g water`;
  } else if (tempDiff >= 12) {
    tempGuidance = isFr ? 'eau très froide' : 'very cold water';
  } else if (tempDiff >= 5) {
    tempGuidance = isFr ? 'eau bien froide' : 'chilled water';
  } else if (tempDiff >= 2) {
    tempGuidance = isFr ? 'légèrement plus fraîche que la pièce' : 'slightly below room temperature';
  } else {
    tempGuidance = isFr ? 'à température ambiante' : 'at room temperature';
  }

  return { targetTemp, needsIce, iceGrams, tapGrams, iceGuidance, tempGuidance };
}

// ── Starter prep card ─────────────────────────
function StarterPrepCard({
  sourdough, feedTime, feed2Time, fridgeOutTime,
  starterPeakTime, planningMode, usingPeak2,
  feedRatio, starterLocation, locale,
}: {
  sourdough: { starterGramsMin: number; starterGramsMax: number } | null;
  feedTime?: Date | null;
  feed2Time?: Date | null;
  fridgeOutTime?: Date | null;
  starterPeakTime?: Date | null;
  planningMode?: 'last_fed' | 'know_peak';
  usingPeak2?: boolean;
  feedRatio?: number;
  starterLocation?: string;
  locale: string;
}) {
  if (!sourdough) return null;
  const isFr = locale === 'fr';
  const fmt = (d: Date) => d.toLocaleTimeString(
    isFr ? 'fr-FR' : 'en-US',
    { hour: 'numeric', minute: '2-digit', hour12: !isFr }
  );
  const fmtFull = (d: Date) => d.toLocaleDateString(
    isFr ? 'fr-FR' : 'en-US',
    { weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: !isFr }
  );
  const hasSchedule = !!(feedTime || starterPeakTime);
  const discardKeep = Math.round(sourdough.starterGramsMax * 0.2);
  const ratioLabel = feedRatio && feedRatio > 1
    ? `1:${feedRatio}:${feedRatio}` : '1:1:1';

  const rowStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '.15rem',
  };
  const labelStyle = {
    fontSize: '11px',
    fontFamily: 'var(--font-ui)',
    color: 'var(--smoke)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.04em',
  };
  const valueStyle = {
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'var(--font-ui)',
    color: 'var(--char)',
  };
  const noteStyle = {
    fontSize: '12px',
    color: 'var(--smoke)',
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div style={{
      background: 'var(--cream)',
      borderRadius: '16px',
      border: '1.5px solid var(--border)',
      padding: '16px 20px',
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={labelStyle}>
        {isFr ? 'Préparer votre levain' : 'Preparing your starter'}
      </div>

      {/* Scheduled timeline */}
      {hasSchedule && (
        <div style={{ display:'flex', flexDirection:'column', gap: '8px' }}>
          {feedTime && planningMode !== 'know_peak' && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {usingPeak2
                  ? (isFr ? 'Repas 1' : 'Feed 1')
                  : (isFr ? 'Rafraîchir' : 'Feed')}
              </div>
              <div style={valueStyle}>{fmtFull(feedTime)}</div>
              <div style={noteStyle}>
                {ratioLabel} — {isFr
                  ? 'parts égales levain, farine, eau'
                  : 'equal parts starter, flour, water'}
              </div>
            </div>
          )}
          {fridgeOutTime && starterLocation === 'fridge' && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Sortir du frigo' : 'Remove from fridge'}
              </div>
              <div style={valueStyle}>{fmt(fridgeOutTime)}</div>
            </div>
          )}
          {usingPeak2 && feed2Time && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Repas 2' : 'Feed 2'}
              </div>
              <div style={valueStyle}>{fmtFull(feed2Time)}</div>
              <div style={noteStyle}>
                {isFr
                  ? 'Repas actif pour cette cuisson'
                  : 'Active feed for this bake'}
              </div>
            </div>
          )}
          {starterPeakTime && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Pic' : 'Peak'}
              </div>
              <div style={valueStyle}>{fmt(starterPeakTime)}</div>
            </div>
          )}
        </div>
      )}

      {/* Amount */}
      <div style={rowStyle}>
        <div style={labelStyle}>
          {isFr ? 'Quantité' : 'Amount'}
        </div>
        <div style={valueStyle}>
          {sourdough.starterGramsMin}–{sourdough.starterGramsMax} g
        </div>
        <div style={noteStyle}>
          {isFr
            ? `Gardez ${discardKeep}g pour votre prochaine fournée`
            : `Keep ${discardKeep}g for your next bake`}
        </div>
      </div>

      {/* Readiness cues */}
      <div style={rowStyle}>
        <div style={labelStyle}>
          {isFr ? 'Prêt quand' : 'Ready when'}
        </div>
        {[
          isFr ? 'Doublé ou plus en volume'
               : 'Doubled or more in volume',
          isFr ? 'Surface en dôme, pas encore effondrée'
               : 'Dome-shaped, not yet collapsed',
          isFr ? 'Bulles visibles sur les côtés du bocal'
               : 'Bubbles visible through the sides of the jar',
          isFr ? 'Odeur acidulée, pas alcoolisée'
               : 'Smells pleasantly sour, not alcoholic',
        ].map((cue, i) => (
          <div key={i} style={noteStyle}>{cue}</div>
        ))}
      </div>

      {/* Post-mix maintenance */}
      <div style={{
        ...noteStyle,
        paddingTop: '8px',
        borderTop: '1px solid var(--border)',
        lineHeight: 1.5,
      }}>
        {isFr
          ? 'Après avoir prélevé votre levain, nourrissez le reste et remettez-le au frigo.'
          : 'After taking your starter, feed what remains and return it to the fridge.'}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────
export default function RecipeOutput({
  result, numItems, itemWeight, styleName, mixerType, kitchenTemp, fridgeTemp = 6, fermEquivHours, totalColdHours = 0, mode = 'simple', bakeType = 'pizza', ovenType = null, prefermentType,
  priorityOverride, onPriorityOverride, saveStatus, onSave, wastePct, flourBlend, units,
  feedTime, feed2Time, fridgeOutTime, starterPeakTime, planningMode, usingPeak2, feedRatio, starterLocation,
  onEditSetup, onOpenGuide, onShare,
}: RecipeOutputProps) {
  const t = useTranslations();
  const locale = useLocale();
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
  // Sourdough starter accounting: half the starter is flour, half water
  // (100% hydration). Subtract from the main-dough amounts so the card's
  // total actually tallies. Preferment mode has its own accounting already.
  const sdMid  = sourdough ? sourdough.starterGramsMid : 0;
  const sdHalf = sourdough ? Math.round(sdMid / 2) : 0;
  const sdActive = !!sourdough && result.preferment == null;
  const flourMain = sdActive ? flour - sdHalf : flour;
  const waterMain = sdActive ? water - sdHalf : water;


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
  // Translated yeast name — data.ts names are English-only ("Fresh Yeast"
  // showed untranslated on the FR recipe card)
  const yeastTypeName = yeastInfo
    ? (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (t as any)(`recipe.yeastNames.${yeastInfo.yeastType}`) as string;
        } catch {
          return YEAST_TYPES[yeastInfo.yeastType]?.name ?? yeastInfo.yeastType;
        }
      })()
    : '';

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
  const waterInfo = computeWaterInfo(waterTemp, water, kitchenTemp, isSpiral, locale === 'fr');
  // For preferment mode: ice protocol applies to final dough water only
  // Preferment water is mixed by hand at RT — no DDT adjustment needed
  const finalDoughWaterInfo = result.preferment
    ? computeWaterInfo(waterTemp, result.preferment.finalWater, kitchenTemp, isSpiral, locale === 'fr')
    : null;

  // Water row sub-line: source-agnostic temperature guidance
  function makeWaterSubNode(info: WaterInfo, kitchenT: number): React.ReactNode {
    if (info.iceGrams >= 50) {
      return (
        <>
          {t('recipeOutput.waterTarget') + ' '}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--terra)' }}>{displayTemp(info.targetTemp, u)}</span>
          {' · '}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-ui)' }}>{info.iceGrams}g</span>
          {' ' + (locale === 'fr' ? 'glaçons + ' : 'ice + ')}
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-ui)' }}>{info.tapGrams}g</span>
          {' ' + (locale === 'fr' ? 'eau froide' : 'cold water')}
        </>
      );
    }
    const tempDiff = kitchenT - info.targetTemp;
    const tempColor = tempDiff >= 14 ? 'var(--terra)' : tempDiff >= 8 ? 'var(--gold)' : undefined;
    // Instructions only. The temperature and the ice split are things the
    // baker acts on; why the number is what it is belongs in Protocol, not
    // on a card someone is reading with wet hands.
    return (
      <>
        {t('recipeOutput.waterUseAt') + ' '}
        <span style={{ fontWeight: 700, fontFamily: 'var(--font-ui)', fontSize: '14px', color: tempColor }}>{displayTemp(info.targetTemp, u)}</span>
        {` · ${info.tempGuidance}`}
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
  // Which warnings earn a card here. This was a substring allowlist over the
  // warning's English text — 'precision scale', 'poolish', 'not recommended',
  // 'dilution' — and three of those four terms no longer matched anything
  // any warning said, so display depended on wording rather than intent.
  //
  // Behaviour is unchanged: the same two warnings render as before.
  // 'overFermentRT' stays out because the notRecommended card already says it,
  // and 'fridgeWarm' stays out as it did. Both are now deliberate rather than
  // an accident of phrasing.
  const WARN_SHOWN: YeastWarningKey[] = ['poolishSuggestion', 'hotClimateRT', 'doseFloorRT'];

  const filteredWarnings = yeastInfo
    ? yeastInfo.warnings.filter(w => WARN_SHOWN.includes(w.key))
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Compact header row ───────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '4px .1rem 8px',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '20px',
            fontWeight: 700, color: 'var(--char)', marginBottom: '.2rem',
          }}>
            {t('recipeOutput.recipeReady')}
          </div>
          <div style={{
            fontSize: '12px', color: 'var(--smoke)',
            fontFamily: 'var(--font-ui)',
          }}>
            {styleName}
            {' · '}
            <span style={{ color: 'var(--ash)', fontWeight: 600 }}>
              {numItems} × {itemWeight}g
            </span>
            {' · '}
            <span style={{ color: 'var(--ash)', fontWeight: 600 }}>
              {hydration}% {t('recipeOutput.hydrationLabel')}
            </span>
          </div>
          {wastePct !== undefined && wastePct > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '.2rem' }}>
              {t('recipeOutput.mixingBuffer', { pct: wastePct })}
            </div>
          )}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
            style={{
              padding: '8px 16px', minHeight: '44px', borderRadius: '12px', flexShrink: 0, marginLeft: '1rem',
              border: `1.5px solid ${saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--border)'}`,
              background: 'transparent',
              color: saveStatus === 'saved' ? 'var(--sage)' : saveStatus === 'error' ? 'var(--terra)' : 'var(--smoke)',
              fontSize: '12px', cursor: saveStatus === 'saving' || saveStatus === 'saved' ? 'default' : 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {saveStatus === 'saving' ? t('recipeOutput.savingRecipe') : saveStatus === 'saved' ? t('recipeOutput.savedRecipe') : saveStatus === 'error' ? t('recipeOutput.saveError') : t('recipeOutput.saveRecipe')}
          </button>
        )}
        {/* Total ingredients accordion now lives in the Final Dough card */}
        {false && (
          <div>
            <button
              onClick={() => setShowTotals(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '12px', color: 'rgba(156, 130, 72,0.7)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <span>{t('recipeOutput.totalIngredients')}</span>
              <span style={{ fontSize: '11px', transition: 'transform .2s', transform: showTotals ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {showTotals && (() => {
              const pf = result.preferment!;
              const totalFlour = flour;
              const totalWater = water;
              const totalSalt  = salt;
              const totalYeast = pf.prefYeastGrams;
              const yeastLabel = pf.prefYeastType
                ? `Yeast (${(YEAST_TYPES as Record<string,{shortName:string}>)[pf.prefYeastType]?.shortName ?? 'IDY'})`
                : 'Yeast (IDY)';
              return (
                <div style={{ marginTop: '8px' }}>
                  {[
                    { label: 'Flour', pct: '100%', value: u === 'imperial' ? wStr(totalFlour) : `${Math.round(totalFlour).toLocaleString()}g` },
                    { label: 'Water', pct: `${Math.round(totalWater / totalFlour * 1000) / 10}%`, value: u === 'imperial' ? wStr(totalWater) : `${Math.round(totalWater).toLocaleString()}g` },
                    { label: 'Salt',  pct: `${Math.round(totalSalt  / totalFlour * 1000) / 10}%`, value: u === 'imperial' ? wStr(totalSalt) : `${Math.round(totalSalt).toLocaleString()}g` },
                    ...(totalYeast > 0 ? [{ label: yeastLabel, pct: (() => { const r = totalYeast / totalFlour * 100; return r < 0.1 ? '<0.1%' : `${Math.round(r * 10) / 10}%`; })(), value: `${totalYeast}g` }] : []),
                  ].map((row, i) => (
                    <div key={i} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: '0 24px',
                      alignItems: 'center',
                      padding: '8px .1rem',
                      borderBottom: `1px solid ${D.line}`,
                      fontSize: '12px', fontFamily: 'var(--font-ui)',
                    }}>
                      <span style={{ color: D.muted }}>{row.label}</span>
                      <span style={{ color: 'rgba(240, 235, 224,0.9)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.value}</span>
                      <span style={{ color: 'var(--gold)', fontSize: '12px', textAlign: 'right', minWidth: '4rem', whiteSpace: 'nowrap' }}>{row.pct}</span>
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
            <div style={{ background: 'var(--char)', borderRadius: '16px', padding: '24px 24px', border: '1px solid rgba(156, 130, 72,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--cream)', marginBottom: '16px' }}>
                {t('recipeOutput.makeYourPref', { name: pd.name })}
              </div>
              <IngRow
                label={t('recipeOutput.ingredientFlour')}
                grams={wStr(pf.prefFlour)}
                noPct
                highlight
                sub={mode === 'simple'
              ? (bakeType === 'bread'
                  ? t('recipeOutput.flourTooltipBread')
                  : t('recipeOutput.flourTooltipPizza'))
              : mode === 'custom' && flourBlend ? (() => {
                  const f1 = FLOUR_DATA[flourBlend.flour1];
                  const f1DisplayName = flourBlend.brandProduct ?? f1.name;
                  if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                    return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{f1DisplayName}</span>;
                  }
                  return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Use your primary flour ({f1DisplayName})</span>;
                })() : undefined}
              />
              <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(pf.prefWater)} noPct
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefWater / pf.prefFlour * 1000) / 10) : undefined}
                sub={t('recipeOutput.atRoomTemp')} />
              {pf.prefYeastGrams > 0 && (
                <IngRow
                  label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t('recipeOutput.ingredientYeast', {
                    type: pf.prefYeastType ? ((YEAST_TYPES as Record<string, { shortName: string }>)[pf.prefYeastType]?.shortName ?? 'IDY') : 'IDY'
                  })}</span>}
                  grams={wStr(pf.prefYeastGrams)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefYeastGrams / pf.prefFlour * 1000) / 10) : undefined} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                  {t('recipeOutput.prefTotalRow', { name: pd.name })}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ~{wStr(prefTotal)}
                </div>
                <div style={{ minWidth: '4rem' }} />
              </div>
            </div>

            {/* CARD 2: Final dough */}
            <div style={{ background: 'var(--char)', borderRadius: '16px', padding: '24px 24px', border: '1px solid rgba(156, 130, 72,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--cream)', marginBottom: '4px' }}>
                {t('recipeOutput.finalDoughTitle')}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: D.muted, marginBottom: '16px' }}>
                {t('recipeOutput.addPrefToRest', { name: pd.name })}
              </div>
              <IngRow label={t('recipeOutput.yourPrefAll', { name: pd.name })} grams={wStr(prefTotal)} noPct highlight />
              {mode === 'custom' && flourBlend && flourBlend.flour2 && flourBlend.ratio1 < 100 ? (() => {
                // The final dough split only ever listed two flours: flour 2
                // took "everything that is not flour 1", so with a preferment a
                // three-flour blend lost its third flour — its weight silently
                // folded into the second. The direct-dough breakdown already
                // handled three; this one did not.
                const f1 = FLOUR_DATA[flourBlend.flour1];
                const f2 = FLOUR_DATA[flourBlend.flour2];
                const hasF3 = !!flourBlend.flour3 && flourBlend.ratio2 !== undefined
                  && (100 - flourBlend.ratio1 - flourBlend.ratio2) > 0;
                const f3 = hasF3 ? FLOUR_DATA[flourBlend.flour3!] : null;
                const p2 = hasF3 ? flourBlend.ratio2! : 100 - flourBlend.ratio1;
                const f1Weight = Math.round(pf.finalFlour * flourBlend.ratio1 / 100);
                const f2Weight = hasF3
                  ? Math.round(pf.finalFlour * p2 / 100)
                  : pf.finalFlour - f1Weight;
                // The last flour absorbs the rounding, so the parts always sum
                // to the flour the recipe actually calls for.
                const f3Weight = hasF3 ? pf.finalFlour - f1Weight - f2Weight : 0;
                const pctOf = (w: number) => pctStr(Math.round(w / flour * 1000) / 10);
                return (
                  <>
                    <IngRow label={flourBlend.brandProduct ?? f1.name} grams={wStr(f1Weight)} noPct advancedPct={pctOf(f1Weight)} />
                    <IngRow label={flourBlend.customFlour2Name ?? f2.name} grams={wStr(f2Weight)} noPct advancedPct={pctOf(f2Weight)} />
                    {hasF3 && f3 && (
                      <IngRow label={flourBlend.customFlour3Name ?? f3.name} grams={wStr(f3Weight)} noPct advancedPct={pctOf(f3Weight)} />
                    )}
                  </>
                );
              })() : (
                <IngRow
                  label={mode === 'custom' && flourBlend && (!flourBlend.flour2 || flourBlend.ratio1 >= 100)
                    ? (flourBlend.brandProduct ?? FLOUR_DATA[flourBlend.flour1].name)
                    : t('recipeOutput.remainingFlour')}
                  grams={wStr(pf.finalFlour)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalFlour / flour * 1000) / 10) : undefined} />
              )}
              <IngRow label={t('recipeOutput.remainingWater')} grams={wStr(pf.finalWater)} noPct sub={finalDoughWaterSubNode}
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalWater / flour * 1000) / 10) : undefined} />
              <IngRow label={t('recipeOutput.ingredientSalt')} grams={wStr(salt)} noPct
                advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />
              {oil > 0 && <IngRow label={t('recipeOutput.ingredientOil')} grams={wStr(oil)} noPct />}
              {sugar > 0 && <IngRow label={t('recipeOutput.ingredientSugar')} grams={wStr(sugar)} noPct />}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                  {t('recipeOutput.totalDough')}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u === 'imperial' ? wStr(numItems * itemWeight) : `${(numItems * itemWeight).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} g`}
                </div>
                <div style={{ minWidth: '4rem' }} />
              </div>
              {/* Total ingredients accordion — preferment mode */}
              <div style={{ marginTop: '16px', borderTop: `1px solid ${D.line}`, paddingTop: '12px' }}>
                <button
                  onClick={() => setShowTotals(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '12px', color: 'rgba(156, 130, 72,0.7)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <span>{t('recipeOutput.totalIngredients')}</span>
                  <span style={{ fontSize: '11px', transition: 'transform .2s', transform: showTotals ? 'rotate(180deg)' : 'none' }}>▾</span>
                </button>
                {showTotals && (() => {
                  const pf = result.preferment!;
                  const totalFlour = flour;
                  const totalWater = water;
                  const totalSalt  = salt;
                  const totalYeast = pf.prefYeastGrams;
                  const yeastLabel = pf.prefYeastType
                    ? `Yeast (${(YEAST_TYPES as Record<string,{shortName:string}>)[pf.prefYeastType]?.shortName ?? 'IDY'})`
                    : t('recipeOutput.yeastIDY');
                  return (
                    <div style={{ marginTop: '8px' }}>
                      {[
                        { label: t('recipe.flour'), pct: '100%', value: u === 'imperial' ? wStr(totalFlour) : `${Math.round(totalFlour).toLocaleString()}g` },
                        { label: t('recipe.water'), pct: `${Math.round(totalWater / totalFlour * 1000) / 10}%`, value: u === 'imperial' ? wStr(totalWater) : `${Math.round(totalWater).toLocaleString()}g` },
                        { label: t('recipe.salt'),  pct: `${Math.round(totalSalt  / totalFlour * 1000) / 10}%`, value: u === 'imperial' ? wStr(totalSalt) : `${Math.round(totalSalt).toLocaleString()}g` },
                        ...(totalYeast > 0 ? [{ label: yeastLabel, pct: (() => { const r = totalYeast / totalFlour * 100; return r < 0.1 ? '<0.1%' : `${Math.round(r * 10) / 10}%`; })(), value: `${totalYeast}g` }] : []),
                      ].map((row, i) => (
                        <div key={i} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: '0 24px',
                          alignItems: 'center',
                          padding: '8px .1rem',
                          borderBottom: `1px solid ${D.line}`,
                          fontSize: '12px', fontFamily: 'var(--font-ui)',
                        }}>
                          <span style={{ color: D.muted }}>{row.label}</span>
                          <span style={{ color: 'rgba(240, 235, 224,0.9)', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.value}</span>
                          <span style={{ color: 'var(--gold)', fontSize: '12px', textAlign: 'right', minWidth: '4rem', whiteSpace: 'nowrap' }}>{row.pct}</span>
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
        <div style={{ background: 'var(--char)', borderRadius: '16px', padding: '24px 24px', border: '1px solid rgba(156, 130, 72,0.12)', boxShadow: '0 4px 20px rgba(0,0,0,0.14)' }}>
          {/* Card header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--cream)' }}>
              {t('recipe.ingredients')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 24px', width: '100%', maxWidth: '75%' }}>
              <span />
              <span style={{ fontSize: '11px', color: D.sub, fontFamily: 'var(--font-ui)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('recipe.weight')}</span>
              <span style={{ fontSize: '11px', color: D.sub, fontFamily: 'var(--font-ui)', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.06em', minWidth: '4rem' }}>{t('recipe.bakersPercent')}</span>
            </div>
          </div>

          <IngRow
            label={t('recipeOutput.ingredientFlour')}
            grams={wStr(flourMain)}
            pct="100%"
            highlight
            advancedPct={mode === 'custom' ? '100%' : undefined}
            sub={mode === 'custom' && flourBlend ? (() => {
              const f1 = FLOUR_DATA[flourBlend.flour1];
              const f1DisplayName = flourBlend.brandProduct ?? f1.name;
              const f1Weight = Math.round(flour * flourBlend.ratio1 / 100);
              if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{f1DisplayName}</span>;
              }
              const f2 = FLOUR_DATA[flourBlend.flour2];
              const hasF3 = !!flourBlend.flour3 && flourBlend.ratio2 !== undefined && (100 - flourBlend.ratio1 - flourBlend.ratio2) > 0;
              const p2 = hasF3 ? flourBlend.ratio2! : 100 - flourBlend.ratio1;
              const p3 = hasF3 ? 100 - flourBlend.ratio1 - p2 : 0;
              const f2Weight = Math.round(flour * p2 / 100);
              const f3Weight = hasF3 ? flour - f1Weight - f2Weight : 0;
              const f3 = hasF3 ? FLOUR_DATA[flourBlend.flour3!] : null;
              return (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  {flourBlend.ratio1}% {f1DisplayName} ({f1Weight.toLocaleString('en')}g)
                  {' · '}
                  {p2}% {flourBlend.customFlour2Name ?? f2.name} ({f2Weight.toLocaleString('en')}g)
                  {hasF3 && f3 && <>{' · '}{p3}% {flourBlend.customFlour3Name ?? f3.name} ({f3Weight.toLocaleString('en')}g)</>}
                </span>
              );
            })() : sdActive ? (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {locale === 'fr' ? `+ ${sdHalf}g via le levain = ${flour}g au total` : `+ ${sdHalf}g via the starter = ${flour}g total`}
              </span>
            ) : undefined}
          />
          <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(waterMain)} pct={pctStr(waterPct)} sub={sdActive ? (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                {locale === 'fr' ? `+ ${sdHalf}g via le levain = ${water}g au total` : `+ ${sdHalf}g via the starter = ${water}g total`}
              </span>
            ) : waterSubNode} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />
          <IngRow label={t('recipeOutput.ingredientSalt')}  grams={wStr(salt)}  pct={pctStr(saltPct)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />

          {yeastInfo && (
            <IngRow
              label={
                yeastTypeName
              }
              sub={yeastSub}
              grams={wStr(yeastInfo.convertedGrams)}
              pct={pctStr(yeastInfo.convertedPct)}
              advancedPct={mode === 'custom' ? pctStr(yeastInfo.convertedPct) : undefined}
            />
          )}

          {yeastInfo && (() => {
            const priorityLabel = ({
              'flavor': { text: t('recipeOutput.priorityFlavourNote'), color: 'var(--sage)' },
              'speed':  { text: t('recipeOutput.prioritySpeedNote'),   color: 'var(--gold)' },
            } as Record<string, { text: string; color: string }>)[result.autoPriority ?? ''] ?? { text: 'Balanced yeast for your schedule', color: 'var(--smoke)' };
            return (
              <>
                {mode === 'custom' && (
                  <div style={{
                    fontSize: '12px',
                    fontStyle: 'italic', fontFamily: 'var(--font-ui)',
                    padding: '.2rem .1rem 8px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}>
                    <button
                      onClick={() => setShowPriorityOverride(v => !v)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(240, 235, 224,0.45)', fontSize: '11px',
                        fontFamily: 'var(--font-ui)', textDecoration: 'underline',
                        textUnderlineOffset: '2px', padding: 0,
                      }}
                    >
                      {showPriorityOverride ? t('recipeOutput.priorityReset') : t('recipeOutput.priorityAdjust')}
                    </button>
                  </div>
                )}
                {showPriorityOverride && mode === 'custom' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '4px .1rem 8px', borderBottom: `1px solid rgba(156, 130, 72,0.16)` }}>
                    {([
                      { value: 'flavor', label: t('recipeOutput.priorityFlavour'), desc: t('recipeOutput.priorityFlavourDesc') },
                      { value: null,     label: t('recipeOutput.priorityBalanced'), desc: t('recipeOutput.priorityBalancedDesc') },
                      { value: 'speed',  label: t('recipeOutput.prioritySpeed'),   desc: t('recipeOutput.prioritySpeedDesc') },
                    ] as { value: string | null; label: string; desc: string }[]).map(opt => {
                      const effective = priorityOverride !== undefined ? priorityOverride : result.autoPriority;
                      const isActive = effective === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          onClick={() => onPriorityOverride?.(opt.value)}
                          style={{
                            padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                            border: `1.5px solid ${isActive ? 'var(--gold)' : 'rgba(156, 130, 72,0.2)'}`,
                            background: isActive ? 'rgba(156, 130, 72,0.15)' : 'transparent',
                            color: isActive ? 'var(--gold)' : 'rgba(240, 235, 224,0.5)',
                            fontSize: '11px', fontFamily: 'var(--font-ui)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.1rem',
                          }}
                        >
                          <span style={{ fontWeight: isActive ? 600 : 400 }}>{opt.label}</span>
                          <span style={{ fontSize: '11px', opacity: .7 }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}


          {sachetDilutionNote && (
            <div style={{ padding: '.2rem .1rem 4px', borderBottom: `1px solid ${D.line}` }}>
              <button
                onClick={() => setShowDilution(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '12px', color: 'rgba(240, 235, 224,0.40)',
                  fontFamily: 'var(--font-ui)', textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                {showDilution ? t('recipeOutput.dilutionHide') : t('recipeOutput.dilutionShow')}
              </button>
              {showDilution && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'rgba(240, 235, 224,0.50)', marginTop: '4px', lineHeight: 1.55 }}>
                  {sachetDilutionNote}
                </div>
              )}
            </div>
          )}

          {sourdough && (
            <IngRow
              label={t('recipeOutput.starterLabel')}
              sub={t('recipeOutput.starterSub')}
              grams={`${sourdough.starterGramsMin}–${sourdough.starterGramsMax} g`}
              pct={`${sourdough.starterPctMin}–${sourdough.starterPctMax}%`}
              range
            />
          )}

          {oil > 0 && (
            <IngRow label={t('recipeOutput.ingredientOil')} grams={wStr(oil)} pct={pctStr(oilPct)} advancedPct={mode === 'custom' ? pctStr(oilPct) : undefined} />
          )}

          {sugar > 0 && (
            <IngRow label={t('recipeOutput.ingredientSugar')} grams={wStr(sugar)} pct={pctStr(sugarPct)} advancedPct={mode === 'custom' ? pctStr(sugarPct) : undefined} />
          )}

          {/* TOTAL DOUGH row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
            <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
              {t('recipeOutput.totalDough')}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {u === 'imperial' ? wStr(numItems * itemWeight) : `${(numItems * itemWeight).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} g`}
            </div>
            <div style={{ minWidth: '4rem' }} />
          </div>
        </div>
      )}


      {/* ── Batch splitting callout ──────────────────────────────── */}
      {needsBatches && (
        <div style={{
          background: '#F0EBE0',
          border: '1.5px solid #9C8248',
          borderRadius: '16px',
          padding: '16px 20px',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#7A5A10', fontFamily: 'var(--font-ui)' }}>
              {t('recipeOutput.largeBatchTitle')}
            </span>
          </div>
          {/* Explanation */}
          <div style={{ fontSize: '12px', color: '#5A4A10', lineHeight: 1.65, fontFamily: 'var(--font-ui)', marginBottom: '16px' }}>
            {hasPref
              ? <>{t('recipeOutput.largeBatchFinalDough', { grams: Math.round(batchDoughG), mixer: (MIXER_TYPES as Record<string, { name: string }>)[mixerType]?.name ?? 'mixer', n: effectiveBatches })}</>
              : <>{t('recipeOutput.largeBatchTotal', { grams: totalDoughG, mixer: (MIXER_TYPES as Record<string, { name: string }>)[mixerType]?.name ?? 'mixer', n: effectiveBatches })}</>
            }
          </div>
          {/* Batch count selector: ×1, ×2, ×3 pills + free input */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => setNumBatches(n)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: `1.5px solid ${effectiveBatches === n ? '#9C8248' : '#C4B898'}`,
                  background: effectiveBatches === n ? '#9C824820' : 'white',
                  color: effectiveBatches === n ? '#7A5A10' : '#8A7F78',
                  fontSize: '13px',
                  fontFamily: 'var(--font-ui)',
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
                padding: '4px 8px',
                borderRadius: '20px',
                border: `1.5px solid ${effectiveBatches > 3 ? '#9C8248' : '#C4B898'}`,
                background: effectiveBatches > 3 ? '#9C824820' : 'white',
                color: effectiveBatches > 3 ? '#7A5A10' : '#8A7F78',
                fontSize: '13px',
                fontFamily: 'var(--font-ui)',
                textAlign: 'center',
                outline: 'none',
              }}
            />
          </div>
          {/* Per-batch breakdown */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '12px 16px', border: '1px solid #E8D890', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A7F78', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
              {hasPref ? t('recipeOutput.batchHeader', { n: effectiveBatches, grams: Math.round(batchDoughG / effectiveBatches) }) : t('recipeOutput.batchHeaderSimple', { n: effectiveBatches, grams: Math.round(totalDoughG / effectiveBatches) })}
            </div>
            {[
              ...(poolishPerBatch !== null ? [{
                label: prefermentType === 'biga' ? t('recipeOutput.ingredientBiga') : t('recipeOutput.ingredientPoolish'),
                value: `${poolishPerBatch}g`,
                highlight: false,
                isTotal: false,
              }] : []),
              { label: hasPref ? t('recipeOutput.flourFinalDough') : t('recipe.flour'), value: `${flourPerBatch.toLocaleString()}g`, highlight: false, isTotal: false },
              { label: hasPref ? t('recipeOutput.waterFinalDough') : t('recipe.water'), value: `${waterPerBatch.toLocaleString()}g`, highlight: false, isTotal: false },
              { label: t('recipe.salt'), value: `${saltPerBatch.toLocaleString()}g`, highlight: false, isTotal: false },
              ...(yeastPerBatch !== null ? [{
                label: `Yeast (${(yeast as YeastResult | null)?.yeastType ?? 'IDY'})`,
                value: `${yeastPerBatch}g`,
                highlight: false,
                isTotal: false,
              }] : []),
              { label: t('recipeOutput.batchTotal'), value: `${(flourPerBatch + waterPerBatch + saltPerBatch + (poolishPerBatch ?? 0) + (yeastPerBatch !== null ? Math.round(yeastPerBatch) : 0)).toLocaleString()}g`, highlight: true, isTotal: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '12px', fontFamily: 'var(--font-ui)',
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
          <div style={{ fontSize: '11px', color: '#8A7F78', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
            Combine all batches into one container immediately after mixing. Bulk fermentation and schedule are unchanged.
          </div>
        </div>
      )}



      {/* ── Yeast details ───────────────────────────
          Hidden in preferment mode: all commercial yeast lives in the
          poolish/biga there, so callouts based on the main-dough yeast
          amount would contradict the preferment card. */}
      {yeastInfo && hasPref && result.preferment && result.preferment.prefYeastGrams > 0 && result.preferment.prefYeastGrams < 0.5 && (
        <div style={{
          background: '#FFFBEE',
          border: '1.5px solid #9C8248',
          borderRadius: '16px',
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7A5A10' }}>
              {t('recipeOutput.precisionScaleTitle')}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#5A4010', lineHeight: 1.6, paddingLeft: '24px' }}>
            {t('recipeOutput.precisionScaleBody', { amount: wStr(result.preferment.prefYeastGrams) })}
          </div>
        </div>
      )}
      {yeastInfo && !hasPref && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Min floor callout — shown when 0.5g IDY floor was applied */}
          {yeastInfo.hitMinFloor && (
            <div style={{
              background: '#FFFBEE',
              border: '1.5px solid #9C8248',
              borderRadius: '16px',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#7A5A10' }}>
                  {t('recipeOutput.precisionScaleMin')}
                </span>
              </div>
            </div>
          )}

          {/* Precision scale callout */}
          {needsPrecision && (
            <div style={{
              background: '#FFFBEE',
              border: '1.5px solid #9C8248',
              borderRadius: '16px',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#7A5A10' }}>
                  {t('recipeOutput.precisionScaleTitle')}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#5A4010', lineHeight: 1.6, paddingLeft: '24px' }}>
                {t('recipeOutput.precisionScaleBody', { amount: wStr(yeastInfo.convertedGrams) })}
              </div>
            </div>
          )}


          {/* Dilution tip */}
          {yeastInfo.dilutionTip && (
            <InfoCard
              icon=""
              level="info"
              title={t('recipeOutput.dilutionTitle')}
              body={t('recipeOutput.dilutionBody', {
                waterG: yeastInfo.dilutionTip.waterG,
                solutionG: yeastInfo.dilutionTip.solutionG,
              })}
            />
          )}

          {/* Poolish recommendation */}
          {yeastInfo.recommendPoolish && (
            <InfoCard
              icon=""
              level="poolish"
              title={t('recipeOutput.poolishTitle')}
              body={t('recipeOutput.poolishBody')}
            />
          )}

          {/* Not recommended warning */}
          {yeastInfo.notRecommended && (
            <InfoCard
              icon=""
              level="alert"
              title={t('recipeOutput.notRecommendedTitle')}
              body={t('recipeOutput.notRecommendedBody')}
            />
          )}

          {/* Filtered warnings */}
          {filteredWarnings.map((w, i) => (
            <InfoCard key={i} icon="" level="warn" title={t('recipeOutput.watchOut')}
              body={t(`yeastWarnings.${w.key}`, w.params)} />
          ))}
        </div>
      )}

      {/* ── Sourdough guidance ────────────────────── */}
      {sourdough && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Starter range */}
          <div style={{
            background: 'var(--char)',
            borderRadius: '16px',
            padding: '20px 24px',
            border: '1px solid rgba(156, 130, 72,0.12)',
          }}>
            <div style={{ fontSize: '11px', color: D.sub, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)', marginBottom: '8px' }}>
              {t('recipeOutput.starterLabel')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '24px', fontWeight: 700, color: 'var(--gold)' }}>
                {sourdough.starterGramsMin}–{sourdough.starterGramsMax} g
              </span>
              <span style={{ fontSize: '13px', color: D.muted, fontFamily: 'var(--font-ui)' }}>
                ({sourdough.starterPctMin}–{sourdough.starterPctMax}% of flour)
              </span>
            </div>
            <div style={{ fontSize: '12px', color: D.sub, marginTop: '8px', lineHeight: 1.5 }}>
              {t('recipeOutput.starterFeedNote')}
            </div>
          </div>


          {/* Bulk fermentation cues */}
          <div style={{
            border: '1.5px solid var(--border)',
            borderRadius: '16px',
            padding: '16px 20px',
            background: 'var(--warm)',
          }}>
            <div style={{
              fontSize: '12px', color: 'var(--smoke)',
              textTransform: 'uppercase', letterSpacing: '.06em',
              fontFamily: 'var(--font-ui)', marginBottom: '12px',
            }}>
              {t('recipeOutput.bulkReadyWhen')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sourdough.bulkCues.map((cue, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: '1.5px solid var(--border)',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
                    marginTop: '.05rem',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--ash)', lineHeight: 1.55 }}>{cue}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Starter preparation card ──────────── */}
          <StarterPrepCard
            sourdough={sourdough}
            feedTime={feedTime}
            feed2Time={feed2Time}
            fridgeOutTime={fridgeOutTime}
            starterPeakTime={starterPeakTime}
            planningMode={planningMode}
            usingPeak2={usingPeak2}
            feedRatio={feedRatio}
            starterLocation={starterLocation}
            locale={locale}
          />

        </div>
      )}

      {/* PlanNav used to render here (quiet variant, above the protocol
          timeline). Since the protocol moved to its own tab, page.tsx's
          cta variant right below would duplicate it — removed. */}

    </div>
  );
}
