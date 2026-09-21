'use client';
import { mixingBatchPlan } from '../utils/mixingBatches';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type RecipeResult, type YeastResult, type YeastWarningKey } from '../utils';
import { YEAST_TYPES, PREFERMENT_TYPES, MIXER_TYPES, FLOUR_DATA, type PrefermentType, type FlourBlend } from '../data';
import { type UnitSystem, displayWeight, displayTemp } from '../utils/units';
import PlanNav from './PlanNav';
import WaterPreparation, { type WaterSource, type WaterSettingsProps } from './WaterPreparation';
import { formatPrefermentDose, prefermentDilution } from '../utils/prefermentDose';

interface RecipeOutputProps extends WaterSettingsProps {
  containerCapacityLitres?: number;
  onContainerCapacityChange?: (litres: number | undefined) => void;
  mixingBatches?: number;
  onMixingBatchesChange?: (count: number) => void;
  waterSource?: WaterSource;
  onWaterSourceChange?: (source: WaterSource) => void;
  result: RecipeResult;
  numItems: number;
  itemWeight: number;
  styleName: string;
  styleKey?: string;
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
  muted:  'var(--char)',  // readable ingredient labels
  sub:    'var(--char)',  // secondary / column headers
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
      gridTemplateColumns: '1fr auto',
      gap: '0 24px',
      alignItems: 'center',
      padding: '12px .1rem',
      borderBottom: `1px solid ${D.line}`,
    }}>
      <div>
        <div style={{
          fontSize: '15px',
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'var(--char)' : D.muted,
          letterSpacing: '.02em',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: '12px',
            color: 'var(--smoke)',
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
        color: highlight ? 'var(--char)' : 'var(--char)',
        textAlign: 'right',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12,
      }}>
        {!noPct && advancedPct && <span style={{fontSize:14,fontWeight:400,color:"var(--smoke)"}}>{advancedPct}</span>}
        <span>{grams}</span>
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
  containerCapacityLitres, onContainerCapacityChange, result, numItems, itemWeight, styleName, styleKey, mixerType, kitchenTemp, fridgeTemp = 6, fermEquivHours, totalColdHours = 0, mode = 'simple', bakeType = 'pizza', ovenType = null, prefermentType,
  priorityOverride, onPriorityOverride, saveStatus, onSave, wastePct, flourBlend, units,
  feedTime, feed2Time, fridgeOutTime, starterPeakTime, planningMode, usingPeak2, feedRatio, starterLocation,
  onEditSetup, onOpenGuide, onShare, measuredWaterTemp, onMeasuredWaterTempChange, waterMethod, onWaterMethodChange, spiralIceConfirmed, onSpiralIceConfirmedChange, mixingBatches, onMixingBatchesChange, waterSource, onWaterSourceChange,
}: RecipeOutputProps) {
  const t = useTranslations();
  const locale = useLocale();
  const u = units ?? 'metric';
  const wStr = (g: number) => displayWeight(g, u);
  const [showPriorityOverride, setShowPriorityOverride] = useState(false);

  const [showDilution, setShowDilution] = useState(false);

  // Batch splitting — auto-triggered when total dough exceeds mixer default capacity
  const mixerMaxG   = (MIXER_TYPES as Record<string, { maxDoughG?: number }>)[mixerType]?.maxDoughG ?? 9999;
  const totalDoughG = result.totalDough;
  const minBatches  = Math.ceil(totalDoughG / mixerMaxG);
  const needsBatches = minBatches > 1;
  const [batchIndex, setBatchIndex] = useState(0);
  const batchPlan = mixingBatchPlan(result, mixerType, mixingBatches, batchIndex);
  // effectiveBatches can be 1 if baker overrides — no Math.max constraint
  const effectiveBatches = batchPlan.count;

  const { flour, water, salt, yeast, sourdough, oil, sugar, waterTemp, hydration, totalDough } = result;
  const enrichment = result.enrichment;
  const enrichmentRows = enrichment ? (['milk','eggs','butter'] as const).filter(key => enrichment[key] > 0).map(key => <IngRow key={key} label={({milk:locale === 'fr' ? 'Lait' : 'Milk',eggs:locale === 'fr' ? 'Œufs sans coquille' : 'Eggs, without shells',butter:locale === 'fr' ? 'Beurre' : 'Butter'})[key]} grams={wStr(enrichment[key])} advancedPct={mode === 'custom' ? pctStr(enrichment[key] / flour * 100) : undefined} />) : null;
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
  const flourPerBatch = batchPlan.portion.flour;
  const waterPerBatch = batchPlan.portion.water;
  const saltPerBatch = batchPlan.portion.salt;
  const poolishPerBatch = hasPref ? batchPlan.portion.preferment : null;
  const yeastPerBatch = batchPlan.portion.yeast || null;
  const batchDoughG = result.totalDough;

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
    + oil + sugar + (enrichment ? enrichment.milk + enrichment.eggs + enrichment.butter : 0);

  const itemLabel = numItems === 1 ? 'ball / loaf' : numItems <= 4 ? 'balls' : 'pieces';

  const isSpiral = mixerType === 'spiral';
  const waterSubNode = <WaterPreparation readOnly waterGrams={waterMain} targetTemp={waterTemp} kitchenTemp={kitchenTemp} fridgeTemp={fridgeTemp} locale={locale} units={u} source={waterSource} onSourceChange={onWaterSourceChange} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={onMeasuredWaterTempChange} waterMethod={waterMethod} onWaterMethodChange={onWaterMethodChange} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={onSpiralIceConfirmedChange} targetDoughTemp={result.thermal?.targetDoughTemp} achievedDoughTempC={result.thermal?.doughTempC} waterWasClamped={result.thermal?.waterWasClamped} idealWaterTemp={result.thermal?.idealWaterTemp} directIceSupported={mixerType === 'spiral' && oil === 0 && sugar === 0 && !!styleKey && !['brioche','pain_mie','pain_viennois'].includes(styleKey)} />;
  const finalDoughWaterSubNode = <WaterPreparation readOnly waterGrams={result.preferment?.finalWater ?? waterMain} targetTemp={waterTemp} kitchenTemp={kitchenTemp} fridgeTemp={fridgeTemp} locale={locale} units={u} source={waterSource} onSourceChange={onWaterSourceChange} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={onMeasuredWaterTempChange} waterMethod={waterMethod} onWaterMethodChange={onWaterMethodChange} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={onSpiralIceConfirmedChange} targetDoughTemp={result.thermal?.targetDoughTemp} achievedDoughTempC={result.thermal?.doughTempC} waterWasClamped={result.thermal?.waterWasClamped} idealWaterTemp={result.thermal?.idealWaterTemp} directIceSupported={mixerType === 'spiral' && oil === 0 && sugar === 0 && !!styleKey && !['brioche','pain_mie','pain_viennois'].includes(styleKey)} />;

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
  // 'overFermentRT' stays out because the notRecommended card already says it.
  //
  // 'fridgeWarm' is IN as of this change. It had been dark for months, not by
  // decision but because the old substring allowlist never matched its
  // wording. It fires only above 8 C, so it cannot nag the 6 C default, and
  // above 8 C cold fermentation genuinely becomes unpredictable — the baker
  // typed that number themselves, so it is their data and it is actionable.
  const WARN_SHOWN: YeastWarningKey[] = [
    'poolishSuggestion', 'hotClimateRT', 'doseFloorRT', 'fridgeWarm',
  ];

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

  if (enrichment?.unsupportedMethod) return <section role="alert"><h2>{locale === 'fr' ? 'Méthode non prise en charge' : 'Unsupported method'}</h2><p>{locale === 'fr' ? 'Cette formule enrichie nécessite une levure commerciale, sans préferment. Modifiez le choix de levure dans les réglages puis recalculez.' : 'This enriched formula requires commercial yeast without preferment. Update the leavening choice in setup and recalculate.'}</p>{onEditSetup && <button type="button" onClick={onEditSetup}>{locale === 'fr' ? 'Modifier les réglages' : 'Edit setup'}</button>}</section>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Compact header row ───────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '4px .1rem 8px',
      }}>
        <div>
          <div style={{
            fontFamily: 'Georgia, serif', fontSize: '30px',
            fontWeight: 700, color: 'var(--char)', marginBottom: '.2rem',
          }}>
            {locale === 'fr' ? 'Ingrédients de la pâte' : 'Dough ingredients'}
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
              {hydration}% {enrichment ? (locale === 'fr' ? 'eau équivalente estimée' : 'estimated water equivalent') : t('recipeOutput.hydrationLabel')}
            </span>
          </div>
          {wastePct !== undefined && wastePct > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '.2rem' }}>
              {t('recipeOutput.mixingBuffer', { pct: wastePct })}
            </div>
          )}
        </div>
      </div>

      {(hasPref || (sdActive && mode === 'custom')) && <section aria-label={locale === 'fr' ? 'Quantités totales' : 'Total ingredients'}>
        <h3 style={{fontSize:17}}>{locale === 'fr' ? 'Quantités totales de la recette' : 'Total recipe ingredients'}</h3>
        {mode === 'custom' && <p style={{fontSize:14}}>{locale === 'fr' ? 'Pourcentages sur toute la farine, préferment ou levain inclus.' : 'Percentages use all flour, including flour in preferment or starter.'}</p>}
        <IngRow label={t('recipeOutput.ingredientFlour')} grams={wStr(flour)} advancedPct={mode === 'custom' ? '100%' : undefined} />
        <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(water)} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />
        <IngRow label={t('recipeOutput.ingredientSalt')} grams={wStr(salt)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />
        {pf && pf.prefYeastGrams > 0 && <IngRow label={t(`recipe.yeastNames.${pf.prefYeastType ?? 'instant'}`)} grams={formatPrefermentDose(pf.prefYeastGrams)} advancedPct={mode === 'custom' ? pctStr(pf.prefYeastGrams / flour * 100) : undefined} />}
        {oil > 0 && <IngRow label={t('recipeOutput.ingredientOil')} grams={wStr(oil)} advancedPct={mode === 'custom' ? pctStr(oilPct) : undefined} />}
        {sugar > 0 && <IngRow label={t('recipeOutput.ingredientSugar')} grams={wStr(sugar)} advancedPct={mode === 'custom' ? pctStr(sugarPct) : undefined} />}
        {mode === 'custom' && <IngRow label={locale === 'fr' ? 'Dont farine préfermentée' : 'Of which prefermented flour'} grams={wStr(pf ? pf.prefFlour : sdHalf)} advancedPct={pctStr((pf ? pf.prefFlour : sdHalf) / flour * 100)} sub={locale === 'fr' ? 'Déjà comprise dans la farine totale.' : 'Already included in total flour.'} />}
      </section>}
      {/* ── Ingredients / Preferment cards ──────── */}
      {result.preferment && prefermentType && prefermentType !== 'none' ? (() => {
        const pf = result.preferment!;
        const pd = PREFERMENT_TYPES[prefermentType];
        const prefTotal = Math.round(pf.prefFlour + pf.prefWater + pf.prefYeastGrams);

        return (
          <details>
            <summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Ingrédients par étape' : 'Ingredients by stage'}</summary>
            {/* CARD 1: Make your preferment */}
            <div style={{ background: 'var(--warm)', borderRadius: '16px', padding: '24px 24px', border: '1px solid rgba(156, 130, 72,0.12)', boxShadow: 'none' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--char)', marginBottom: '16px' }}>
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
                    return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>{f1DisplayName}</span>;
                  }
                  return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>{locale === 'fr' ? `Utilisez votre farine principale (${f1DisplayName})` : `Use your primary flour (${f1DisplayName})`}</span>;
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
                  grams={formatPrefermentDose(pf.prefYeastGrams)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefYeastGrams / pf.prefFlour * 1000) / 10) : undefined} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                  {t('recipeOutput.prefTotalRow', { name: pd.name })}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  ~{wStr(prefTotal)}
                </div>

              </div>
            </div>

            {/* CARD 2: Final dough */}
            <div style={{ background: 'var(--warm)', borderRadius: '16px', padding: '24px 24px', border: '1px solid rgba(156, 130, 72,0.12)', boxShadow: 'none' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--char)', marginBottom: '4px' }}>
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
              <IngRow label={t('recipeOutput.remainingWater')} grams={wStr(pf.finalWater)} noPct sub={<details><summary>{locale === 'fr' ? 'Eau du mélange final' : 'Main-mix water'}</summary>{finalDoughWaterSubNode}</details>}
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalWater / flour * 1000) / 10) : undefined} />
              <IngRow label={t('recipeOutput.ingredientSalt')} grams={wStr(salt)} noPct
                advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />
              {oil > 0 && <IngRow label={t('recipeOutput.ingredientOil')} grams={wStr(oil)} noPct />}
              {sugar > 0 && <IngRow label={t('recipeOutput.ingredientSugar')} grams={wStr(sugar)} noPct />}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
                <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
                  {t('recipeOutput.totalDough')}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {u === 'imperial' ? wStr(totalDough) : `${totalDough.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} g`}
                </div>

              </div>
            </div>
          </details>
        );
      })() : (
        /* Direct dough additions */
        <div>

          <IngRow
            label={t('recipeOutput.ingredientFlour')}
            grams={wStr(flourMain)}
            noPct={sdActive}
            pct="100%"
            highlight
            advancedPct={mode === 'custom' ? '100%' : undefined}
            sub={mode === 'custom' && flourBlend ? (() => {
              const f1 = FLOUR_DATA[flourBlend.flour1];
              const f1DisplayName = flourBlend.brandProduct ?? f1.name;
              const f1Weight = Math.round(flourMain * flourBlend.ratio1 / 100);
              if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>{f1DisplayName}</span>;
              }
              const f2 = FLOUR_DATA[flourBlend.flour2];
              const hasF3 = !!flourBlend.flour3 && flourBlend.ratio2 !== undefined && (100 - flourBlend.ratio1 - flourBlend.ratio2) > 0;
              const p2 = hasF3 ? flourBlend.ratio2! : 100 - flourBlend.ratio1;
              const p3 = hasF3 ? 100 - flourBlend.ratio1 - p2 : 0;
              const f2Weight = hasF3 ? Math.round(flourMain * p2 / 100) : flourMain - f1Weight;
              const f3Weight = hasF3 ? flourMain - f1Weight - f2Weight : 0;
              const f3 = hasF3 ? FLOUR_DATA[flourBlend.flour3!] : null;
              return (
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>
                  {flourBlend.ratio1}% {f1DisplayName} ({f1Weight.toLocaleString('en')}g)
                  {' · '}
                  {p2}% {flourBlend.customFlour2Name ?? f2.name} ({f2Weight.toLocaleString('en')}g)
                  {hasF3 && f3 && <>{' · '}{p3}% {flourBlend.customFlour3Name ?? f3.name} ({f3Weight.toLocaleString('en')}g)</>}
                </span>
              );
            })() : sdActive ? (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>
                {locale === 'fr' ? `+ ${sdHalf}g via le levain = ${flour}g au total` : `+ ${sdHalf}g via the starter = ${flour}g total`}
              </span>
            ) : undefined}
          />
          {water > 0 && <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(sdActive ? waterMain : water)} noPct={sdActive} pct={pctStr(waterPct)} sub={
            !enrichment ? <details><summary>{locale === 'fr' ? 'Eau du mélange final' : 'Main-mix water'}</summary>
              {sdActive && <p>{locale === 'fr' ? `${wStr(sdHalf)} d’eau sont déjà dans le levain indiqué ci-dessous.` : `${wStr(sdHalf)} water is already in the starter shown below.`}</p>}
              {waterSubNode}
            </details> : undefined} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />}
          {enrichmentRows}
          {enrichment && <p style={{fontSize:12}}>{enrichment.note[locale === 'fr' ? 'fr' : 'en']} <a href={enrichment.sourceUrl} target="_blank" rel="noopener noreferrer">{locale === 'fr' ? 'Source de la formule' : 'Formula source'}</a></p>}
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
                        color: 'var(--char)', fontSize: '11px',
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
                            color: isActive ? 'var(--gold)' : 'var(--char)',
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
                  fontSize: '12px', color: 'var(--char)',
                  fontFamily: 'var(--font-ui)', textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                {showDilution ? t('recipeOutput.dilutionHide') : t('recipeOutput.dilutionShow')}
              </button>
              {showDilution && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--char)', marginTop: '4px', lineHeight: 1.55 }}>
                  {sachetDilutionNote}
                </div>
              )}
            </div>
          )}

          {sourdough && (
            <IngRow
              label={t('recipeOutput.starterLabel')}
              sub={t('recipeOutput.starterSub')}
              grams={wStr(sdMid)}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 24px', alignItems: 'center', padding: '12px .1rem 0', marginTop: '.1rem' }}>
            <div style={{ fontSize: '12px', color: D.muted, textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: 'var(--font-ui)' }}>
              {t('recipeOutput.totalDough')}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {u === 'imperial' ? wStr(totalDough) : `${totalDough.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')} g`}
            </div>

          </div>
        </div>
      )}


      {onContainerCapacityChange && <details className="bh-disclosure">
        <summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Récipient de fermentation' : 'Fermentation container'}</summary>
        <label style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',fontSize:14}}>
          {locale === 'fr' ? 'Capacité du récipient (litres)' : 'Container capacity (litres)'}
          <input type="number" min={0.5} step={0.5} defaultValue={containerCapacityLitres ?? 3} key={containerCapacityLitres ?? 'default'}
            onBlur={e => { const value = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(value) && value >= 0.5) onContainerCapacityChange(value); else { e.target.value = String(containerCapacityLitres ?? 3); } }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{width:90,minHeight:44,padding:8,border:'1px solid var(--border)',borderRadius:8}} />
        </label>
        <p style={{fontSize:13}}>{locale === 'fr' ? 'Prévoyez de la place pour que la pâte gonfle.' : 'Allow room for the dough to expand.'}</p>
      </details>}

      {/* ── Batch splitting callout ──────────────────────────────── */}
      {(needsBatches || effectiveBatches > 1) && (
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
          <p>{locale === 'fr' ? `${effectiveBatches} pétrissée${effectiveBatches > 1 ? 's' : ''}` : `${effectiveBatches} mixing batch${effectiveBatches > 1 ? 'es' : ''}`}</p>
          {batchPlan.overCapacity && <p role="alert">{locale === 'fr' ? 'Cette pétrissée dépasse la capacité indiquée du pétrin.' : 'This batch exceeds the stated mixer capacity.'}</p>}
          {effectiveBatches > 1 && <label>{locale === 'fr' ? 'Afficher la pétrissée' : 'Show batch'} <select value={batchPlan.active} onChange={e=>setBatchIndex(Number(e.target.value))}>{Array.from({length:effectiveBatches},(_,i)=><option key={i} value={i}>{i+1} / {effectiveBatches}</option>)}</select></label>}
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
                label: yeastTypeName || (locale === 'fr' ? 'Levure' : 'Yeast'),
                value: `${yeastPerBatch}g`,
                highlight: false,
                isTotal: false,
              }] : []),
              ...(['starter','oil','sugar','milk','eggs','butter'] as const).filter(key=>batchPlan.portion[key]>0).map(key=>({label:({milk:locale==='fr'?'Lait':'Milk',eggs:locale==='fr'?'Œufs sans coquille':'Eggs, without shells',butter:locale==='fr'?'Beurre':'Butter',starter:locale==='fr'?'Levain':'Starter',oil:locale==='fr'?'Huile':'Oil',sugar:locale==='fr'?'Sucre':'Sugar'})[key],value:`${batchPlan.portion[key]}g`,highlight:false,isTotal:false})),
              { label: t('recipeOutput.batchTotal'), value: `${batchPlan.total.toLocaleString()}g`, highlight: true, isTotal: true },
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
            {locale === 'fr' ? 'La dernière pétrissée reçoit les écarts d’arrondi. Vérifiez le planning si le pétrissage prend plus de temps.' : 'The last batch takes rounding remainders. Review the schedule if mixing takes longer.'}
          </div>
        </div>
      )}



      {/* ── Yeast details ───────────────────────────
          Hidden in preferment mode: all commercial yeast lives in the
          poolish/biga there, so callouts based on the main-dough yeast
          amount would contradict the preferment card. */}
      {yeastInfo && hasPref && result.preferment && result.preferment.prefYeastGrams > 0 && result.preferment.prefYeastGrams < 0.5 && (
        <details className="bh-disclosure">
          <summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Petite dose de levure' : 'Small yeast dose'}</summary>
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
            {t('recipeOutput.precisionScaleBody', { amount: formatPrefermentDose(result.preferment.prefYeastGrams) })}
            {(() => {
              const pf = result.preferment!;
              const dilution = prefermentDilution(pf.prefYeastGrams, pf.prefWater);
              if (!dilution) return null;
              const yeastName = (YEAST_TYPES as Record<string, { shortName: string }>)[pf.prefYeastType]?.shortName ?? 'IDY';
              const f = formatPrefermentDose;
              return <p style={{ margin: '8px 0 0' }}>{locale === 'fr'
                ? `Ou mélangez 1 g de levure ${yeastName} avec 99 g d’eau. Remuez juste avant de prélever ${f(dilution.solutionGrams)} de ce mélange pour le préferment. Cette portion contient ${f(pf.prefYeastGrams)} de levure et ${f(dilution.waterInSolutionGrams)} d’eau : ajoutez seulement ${f(dilution.remainingWaterGrams)} d’eau supplémentaire au préferment. Jetez le reste du mélange. L’eau de la pâte finale ne change pas.`
                : `Or mix 1 g of ${yeastName} yeast with 99 g water. Stir just before taking ${f(dilution.solutionGrams)} of this mixture for the preferment. This portion contains ${f(pf.prefYeastGrams)} yeast and ${f(dilution.waterInSolutionGrams)} water: add only ${f(dilution.remainingWaterGrams)} more water to the preferment. Discard the leftover mixture. Final-dough water stays unchanged.`}</p>;
            })()}
          </div>
        </div>
        </details>
      )}
      {yeastInfo && !hasPref && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {(yeastInfo.hitMinFloor || needsPrecision || yeastInfo.dilutionTip) && <details className="bh-disclosure">
            <summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Petite dose de levure' : 'Small yeast dose'}</summary>
          {/* Min floor callout — shown when 0.5g IDY floor was applied */}
          {yeastInfo.hitMinFloor && !needsPrecision && (
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
                solutionG: Number(yeastInfo.dilutionTip.solutionG.toFixed(3)),
                waterInSolutionG: Number((yeastInfo.dilutionTip.waterInSolutionGrams ?? yeastInfo.dilutionTip.solutionG * 100 / 101).toFixed(3)),
                remainingWaterG: Number((yeastInfo.dilutionTip.remainingWaterGrams ?? waterMain - yeastInfo.dilutionTip.solutionG * 100 / 101).toFixed(3)),
              })}
            />
          )}

          </details>}

          {/* Poolish recommendation */}
          {yeastInfo.recommendPoolish && (
            <details className="bh-disclosure"><summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Autre méthode pour ce planning' : 'Alternative method for this schedule'}</summary><InfoCard
              icon=""
              level="poolish"
              title={t('recipeOutput.poolishTitle')}
              body={t('recipeOutput.poolishBody')}
            /></details>
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
        <details className="bh-disclosure"><summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Préparer le levain' : 'Prepare the starter'}</summary>

          {/* Starter range */}
          <div style={{
            background: 'var(--warm)',
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
                ({sourdough.starterPctMin}–{sourdough.starterPctMax}% {locale === 'fr' ? 'de la farine' : 'of flour'})
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

        </details>
      )}

      {/* PlanNav used to render here (quiet variant, above the protocol
          timeline). Since the protocol moved to its own tab, page.tsx's
          cta variant right below would duplicate it — removed. */}

    </div>
  );
}
