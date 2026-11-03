'use client';
import { poolishCoolingAt } from '../utils/poolishCoolingAt';
import { starterBuild, starterFeedRoleLabel } from '../utils/starterBuild';
import type { StarterEvent } from './SchedulePicker';
import { recommendedFlourName, flourProductName } from '../lib/flourGuidance';
import { mixingWaterCaption, mixingBatchPlan } from '../utils/mixingBatches';
import { useState, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { commercialDilution, type RecipeResult, type YeastResult, type YeastWarningKey } from '../utils';
import { YEAST_TYPES, PREFERMENT_TYPES, MIXER_TYPES, FLOUR_DATA, type PrefermentType, type FlourBlend } from '../data';
import { type UnitSystem, displayWeight, displayTemp, formatPercent, formatBakeDateTime } from '../utils/units';
import PlanNav from './PlanNav';
import WaterPreparation, { waterSplit, type WaterSource, type WaterSettingsProps } from './WaterPreparation';
import { formatPrefermentDose, formatYeastDose, dryYeastSpoonHint, prefermentDilution } from '../utils/prefermentDose';
import { getBreadProtocol } from '../utils/breadProfiles';

interface RecipeOutputProps extends WaterSettingsProps {
  afterIngredients?: ReactNode;
  onMixerChange?: (value: 'hand' | 'stand') => void;
  mixerConfirmed?: boolean;
  containerCapacityLitres?: number;
  onContainerCapacityChange?: (litres: number | undefined) => void;
  mixingBatches?: number;
  mixerCapacityG?: number;
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
  /** Preserve the selected flour identity independently of presentation mode. */
  explicitFlour?: boolean;
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
  starterEvents?: StarterEvent[];
  mixingTime?: Date;
  feedTime?: Date | null;
  feed2Time?: Date | null;
  fridgeOutTime?: Date | null;
  starterPeakTime?: Date | null;
  planningMode?: 'last_fed' | 'know_peak';
  usingPeak2?: boolean;
  feedRatio?: 1 | 2 | 4 | 5 | 10;
  starterLocation?: 'rt' | 'fridge';
  onEditSetup?: () => void;
  onShare?: () => void;
}

// ── Helpers ──────────────────────────────────
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
    warn:    { bg: 'var(--warm)', border: 'var(--gold)', titleColor: 'var(--char)', bodyColor: 'var(--ash)' },
    alert:   { bg: 'var(--warm)', border: 'var(--gold)', titleColor: 'var(--terra)', bodyColor: 'var(--ash)' },
    good:    { bg: 'var(--warm)', border: 'var(--sage)', titleColor: 'var(--sage)', bodyColor: 'var(--ash)' },
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
  sourdough, feedTime, feed2Time, fridgeOutTime, starterEvents = [], mixingTime,
  starterPeakTime, planningMode, usingPeak2,
  feedRatio, starterLocation, locale,
}: {
  sourdough: { starterGramsMid: number; starterGramsMin: number; starterGramsMax: number } | null;
  starterEvents?: StarterEvent[];
  mixingTime?: Date;
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
  const fmtFull = (d: Date) => d.toLocaleDateString(
    isFr ? 'fr-FR' : 'en-US',
    { weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: !isFr }
  );
  // Canonical saved solver events survive reload and pair each feed with its own peak.
  // Independent legacy scalar props are only a fallback for older sessions.
  const events = starterEvents.filter(event => event.kind !== 'last_fed' || event.isActive).slice().sort((a,b) => +a.time-+b.time);
  const hasSchedule = !!(events.length || feedTime || starterPeakTime);
  const finalCycle = events.filter(event=>event.kind==='pre_mix' || event.kind==='refresh' || event.kind==='known_peak' || event.kind==='last_fed').at(-1);
  const predictedPeak = finalCycle?.bellPeakTime ?? (finalCycle?.kind==='known_peak' ? finalCycle.time : starterPeakTime);
  const peakGapMinutes = mixingTime && predictedPeak ? Math.round((+mixingTime - +predictedPeak) / 60000) : null;
  const build = starterBuild(sourdough.starterGramsMid, sourdough.starterGramsMax, feedRatio ?? 1);
  function describeFeed(ratio = feedRatio ?? 1) {
    const {seed, flour, water, total} = starterBuild(sourdough!.starterGramsMid, sourdough!.starterGramsMax, ratio);
    return isFr ? `1:${ratio}:${ratio} · ${seed} g de levain + ${flour} g de farine + ${water} g d’eau = ${total} g`
      : `1:${ratio}:${ratio} · ${seed} g starter + ${flour} g flour + ${water} g water = ${total} g`;
  }
  const eventLabels: Record<string,string> = isFr
    ? {last_fed:'Dernier rafraîchi',refresh:'Rafraîchir',intermediate_refresh:'Rafraîchi intermédiaire',pre_mix:'Rafraîchi final',fridge_in:'Mettre au frigo',fridge_out:'Sortir du frigo',known_peak:'Pic observé / renseigné'}
    : {last_fed:'Last feed',refresh:'Feed',intermediate_refresh:'Intermediate feed',pre_mix:'Final feed',fridge_in:'Refrigerate',fridge_out:'Remove from fridge',known_peak:'Observed / stated peak'};
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
          {events.length > 0 && events.map((event,index) => <div style={rowStyle} key={`${event.kind}:${index}`}>
            <div style={labelStyle}>{starterFeedRoleLabel(event.kind, isFr) ?? eventLabels[event.kind]}</div>
            <div style={valueStyle}>{fmtFull(event.time)}</div>
            {['refresh','intermediate_refresh','pre_mix'].includes(event.kind) && <div style={noteStyle}>{describeFeed(event.feedingRatio)}</div>}
            {event.bellPeakTime && event.kind !== 'known_peak' && <div style={noteStyle}>{isFr ? 'Pic estimé de ce rafraîchi : ' : 'Estimated peak of this feed: '}{fmtFull(event.bellPeakTime)}</div>}
            {['fridge_in','fridge_out'].includes(event.kind) && event.cardNote && <div style={noteStyle}>{event.cardNote}</div>}
          </div>)}
          {!events.length && feedTime && planningMode !== 'know_peak' && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {usingPeak2
                  ? (isFr ? 'Premier rafraîchi' : 'Feed 1')
                  : (isFr ? 'Rafraîchir' : 'Feed')}
              </div>
              <div style={valueStyle}>{fmtFull(feedTime)}</div>
              <div style={noteStyle}>
                {describeFeed()}
              </div>
            </div>
          )}
          {!events.length && fridgeOutTime && starterLocation === 'fridge' && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Sortir du frigo' : 'Remove from fridge'}
              </div>
              <div style={valueStyle}>{fmtFull(fridgeOutTime)}</div>
            </div>
          )}
          {!events.length && usingPeak2 && feed2Time && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Deuxième rafraîchi' : 'Feed 2'}
              </div>
              <div style={valueStyle}>{fmtFull(feed2Time)}</div>
              <div style={noteStyle}>
                {isFr
                  ? 'Rafraîchi destiné à cette fournée'
                  : 'Active feed for this bake'}
              </div>
            </div>
          )}
          {!events.length && starterPeakTime && (
            <div style={rowStyle}>
              <div style={labelStyle}>
                {isFr ? 'Pic' : 'Peak'}
              </div>
              <div style={valueStyle}>{fmtFull(starterPeakTime)}</div>
            </div>
          )}
          {mixingTime && <div style={rowStyle}><div style={labelStyle}>{isFr ? 'Incorporer au pétrissage' : 'Use when mixing'}</div><div style={valueStyle}>{fmtFull(mixingTime)}</div><div style={noteStyle}>{peakGapMinutes !== null && Math.abs(peakGapMinutes)>1 && predictedPeak && <>{isFr
            ? `Pétrissage ${Math.abs(peakGapMinutes)} min ${peakGapMinutes<0?'avant':'après'} le pic estimé (${fmtFull(predictedPeak)}). `
            : `Mixing is ${Math.abs(peakGapMinutes)} min ${peakGapMinutes<0?'before':'after'} the estimated peak (${fmtFull(predictedPeak)}). `}</>}{isFr ? 'Le pic est estimé : vérifiez un levain actif, gonflé et non retombé avant de pétrir.'  : 'The peak is estimated: check for an active, risen starter that has not collapsed before mixing.'}</div></div>}
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
            ? `Utilisez ${sourdough.starterGramsMid} g pour la pâte et conservez ${build.keep} g pour votre prochaine fournée. Le rafraîchi inclut une marge pour les pertes dans le bocal.`
            : `Use ${sourdough.starterGramsMid} g in the dough and keep ${build.keep} g for your next bake. Feed quantities include an allowance for jar losses.`}
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
          ? 'Après avoir prélevé votre levain, rafraîchissez le reste et remettez-le au frigo.'
          : 'After taking your starter, feed what remains and return it to the fridge.'}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────
export default function RecipeOutput({
  containerCapacityLitres, onContainerCapacityChange, result, numItems, itemWeight, styleName, styleKey, mixerType, kitchenTemp, fridgeTemp = 6, fermEquivHours, totalColdHours = 0, mode = 'simple', bakeType = 'pizza', ovenType = null, prefermentType,
  priorityOverride, onPriorityOverride, saveStatus, onSave, wastePct, flourBlend, explicitFlour = false, units,
  starterEvents, mixingTime, feedTime, feed2Time, fridgeOutTime, starterPeakTime, planningMode, usingPeak2, feedRatio, starterLocation,
  afterIngredients, onMixerChange, mixerConfirmed=false, onEditSetup, onShare, measuredWaterTemp, onMeasuredWaterTempChange, waterMethod, onWaterMethodChange, spiralIceConfirmed, onSpiralIceConfirmedChange, mixerCapacityG, mixingBatches, onMixingBatchesChange, waterSource, onWaterSourceChange,
}: RecipeOutputProps) {
  const t = useTranslations();
  const locale = useLocale();
  const u = units ?? 'metric';
  const wStr = (g: number) => displayWeight(g, u, locale);
  const formatTimeLabel = (date: Date) => formatBakeDateTime(date,locale);
  const pctStr = (n:number) => n>0&&n<1
    ? n.toLocaleString(locale,{maximumSignificantDigits:2})+(locale==='fr'?' %':'%')
    : formatPercent(n,locale);
  const [showPriorityOverride, setShowPriorityOverride] = useState(false);

  const [showDilution, setShowDilution] = useState(false);

  // Batch splitting — auto-triggered when total dough exceeds mixer default capacity
  const mixerMaxG   = (MIXER_TYPES as Record<string, { maxDoughG?: number }>)[mixerType]?.maxDoughG ?? 9999;
  const totalDoughG = result.totalDough;
  const minBatches  = Math.ceil(totalDoughG / mixerMaxG);
  const needsBatches = minBatches > 1;
  const [batchIndex, setBatchIndex] = useState(0);
  const batchPlan = mixingBatchPlan(result, mixerType, mixingBatches, batchIndex, mixerCapacityG);
  // effectiveBatches can be 1 if baker overrides — no Math.max constraint
  const effectiveBatches = batchPlan.count;

  const { flour, water, salt, yeast, sourdough, oil, sugar, waterTemp, hydration, totalDough } = result;
  const enrichment = result.enrichment;
  const breadProtocol = getBreadProtocol(styleKey ?? '');
  const enrichmentRows = enrichment ? (['milk','eggs','butter'] as const).filter(key => enrichment[key] > 0).map(key => <IngRow key={key} label={({milk:locale === 'fr' ? 'Lait' : 'Milk',eggs:locale === 'fr' ? 'Œufs sans coquille' : 'Eggs, without shells',butter:locale === 'fr' ? 'Beurre' : 'Butter'})[key]} grams={wStr(enrichment[key])} advancedPct={mode === 'custom' ? pctStr(enrichment[key] / flour * 100) : undefined} />) : null;
  // Sourdough starter accounting: half the starter is flour, half water
  // (100% hydration). Subtract from the main-dough amounts so the card's
  // total actually tallies. Preferment mode has its own accounting already.
  const sdMid  = sourdough ? sourdough.starterGramsMid : 0;
  const sdHalf = sourdough ? Math.round(sdMid / 2) : 0;
  const sdActive = !!sourdough && result.preferment == null;
  const flourMain = sdActive ? flour - sdHalf : flour;
  const waterMain = sdActive ? water - sdHalf : water;
  // Keep the buying identity beside its ingredient, not in a distant footer.
  // Only the optional explanation is collapsed; stage/starter quantities below
  // retain their existing accounting and custom blends keep their own names.
  const strength = result.blendProfile?.fermToleranceMultiplier ?? 1;
  const cueGroup = strength < 0.85 ? 'weak' : strength > 1.15 ? 'strong' : 'standard';
  const showSelectedFlour = mode === 'custom' || explicitFlour;
  const guidedFlourGuidance = !showSelectedFlour && styleKey
    ? <span>{recommendedFlourName(styleKey, locale)}</span> : undefined;

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
  const saltPct = result.saltPct ?? Math.round(salt / flour * 1000) / 10;
  const oilPct    = oil   > 0 ? Math.round(oil   / flour * 1000) / 10 : 0;
  const sugarPct  = sugar > 0 ? Math.round(sugar / flour * 1000) / 10 : 0;

  // Computed ingredient total (excl. starter)
  const ingredientTotal = flour + water + salt
    + (yeastInfo ? yeastInfo.convertedGrams : 0)
    + oil + sugar + (enrichment ? enrichment.milk + enrichment.eggs + enrichment.butter : 0);

  const itemLabel = numItems === 1 ? 'ball / loaf' : numItems <= 4 ? 'balls' : 'pieces';

  const isSpiral = mixerType === 'spiral';
  const waterAssumption = mode==='simple' ? <p>{mixingWaterCaption(mixerType,locale)}
    {onMixerChange && <button type="button" className="bh-section-back" style={{minHeight:44}} onClick={()=>onMixerChange(mixerType==='hand'?'stand':'hand')}>{mixerType==='hand'?(locale==='fr'?'Utiliser un robot':'Use a mixer'):(locale==='fr'?'Pétrir à la main':'Knead by hand')}</button>}
  </p>:null;
  const waterSubNode = <WaterPreparation readOnly waterGrams={waterMain} targetTemp={waterTemp} kitchenTemp={kitchenTemp} fridgeTemp={fridgeTemp} locale={locale} units={u} source={waterSource} onSourceChange={onWaterSourceChange} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={onMeasuredWaterTempChange} waterMethod={waterMethod} onWaterMethodChange={onWaterMethodChange} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={onSpiralIceConfirmedChange} targetDoughTemp={result.thermal?.targetDoughTemp} achievedDoughTempC={result.thermal?.doughTempC} waterWasClamped={result.thermal?.waterWasClamped} idealWaterTemp={result.thermal?.idealWaterTemp} directIceSupported={mixerType === 'spiral' && oil === 0 && sugar === 0 && !!styleKey && !['brioche','pain_mie','pain_viennois'].includes(styleKey)} />;
  const finalDoughWaterSubNode = <WaterPreparation readOnly waterGrams={result.preferment?.finalWater ?? waterMain} targetTemp={waterTemp} kitchenTemp={kitchenTemp} fridgeTemp={fridgeTemp} locale={locale} units={u} source={waterSource} onSourceChange={onWaterSourceChange} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={onMeasuredWaterTempChange} waterMethod={waterMethod} onWaterMethodChange={onWaterMethodChange} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={onSpiralIceConfirmedChange} targetDoughTemp={result.thermal?.targetDoughTemp} achievedDoughTempC={result.thermal?.doughTempC} waterWasClamped={result.thermal?.waterWasClamped} idealWaterTemp={result.thermal?.idealWaterTemp} directIceSupported={mixerType === 'spiral' && oil === 0 && sugar === 0 && !!styleKey && !['brioche','pain_mie','pain_viennois'].includes(styleKey)} />;

  const spoonFor = (dose:number,type:string) => dryYeastSpoonHint(dose,type,locale);
  const yeastSpoon = yeastInfo && spoonFor(yeastInfo.convertedGrams,yeastInfo.yeastType);
  const needsPrecision = !!yeastInfo && yeastInfo.convertedGrams<1 && !yeastSpoon;
  const dilutionTip = yeastInfo && needsPrecision ? commercialDilution(yeastInfo.convertedGrams,waterMain,1) : yeastInfo?.dilutionTip;
  // The dilution water comes out of the LIQUID water; ice on the water line stays as it is.
  const mainIceG = waterSplit({waterGrams:waterMain,targetTemp:waterTemp,kitchenTemp,fridgeTemp,source:waterSource,measuredWaterTemp,waterMethod,idealWaterTemp:result.thermal?.idealWaterTemp,
    directIceSupported:mixerType === 'spiral' && oil === 0 && sugar === 0 && !!styleKey && !['brioche','pain_mie','pain_viennois'].includes(styleKey)})?.ice ?? 0;
  const prefermentSpoon = pf && spoonFor(pf.prefYeastGrams,pf.prefYeastType ?? 'instant');
  const prefermentDoseDilution = pf && !prefermentSpoon ? prefermentDilution(pf.prefYeastGrams,pf.prefWater,1) : null;
  function measureHint(spoon:string|null|undefined,dilution:boolean) {
    if (spoon) return spoon;
    return dilution ? t('recipeOutput.weighOrDilute') : t('recipeOutput.weighDose');
  }
  const yeastSub = yeastInfo
    ? (() => {
        const isInstant = yeastInfo.yeastType === 'instant';
        const idyPart = !isInstant ? `= ${formatYeastDose(yeastInfo.grams, locale)} IDY` : null;
        const alternatives = mode==='simple' && isInstant ? (locale==='fr' ? `Levure fraîche : ${formatYeastDose(yeastInfo.grams*3,locale)} · sèche active : ${formatYeastDose(yeastInfo.grams*1.33,locale)}` : `Fresh yeast: ${formatYeastDose(yeastInfo.grams*3,locale)} · active dry: ${formatYeastDose(yeastInfo.grams*1.33,locale)}`) : null;
        return [alternatives, measureHint(yeastSpoon,!!dilutionTip), idyPart].filter(Boolean).join(' · ') || undefined;
      })()
    : undefined;

  const sachetDilutionNote = null;
  const kitchenGrams = (grams: number) => grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10;

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
    'poolishSuggestion', 'hotClimateRT', 'doseFloorRT', 'fridgeWarm', 'fermentationBudget', 'osmoticStress',
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

  if (result.protocolIssue) return <section role="alert"><h2>{locale === 'fr' ? 'Réglages à ajuster' : 'Adjust these settings'}</h2><p>{result.protocolIssue === 'equipment' ? (locale === 'fr' ? 'Choisissez un matériel adapté à ce pain.' : 'Choose suitable equipment for this bread.') : result.protocolIssue === 'timing' ? (locale === 'fr' ? 'Prévoyez le temps de mélange, de repos et de façonnage avant cuisson.' : 'Allow time for mixing, resting and shaping before cooking.') : (locale === 'fr' ? 'Cette méthode de levée n’est pas prise en charge pour ce pain.' : 'This leavening method is not supported for this bread.')}</p>{onEditSetup && <button type="button" onClick={onEditSetup} style={{minHeight:44}}>{locale === 'fr' ? 'Modifier les réglages' : 'Edit setup'}</button>}</section>;

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
          {/* The recipe is the recipe: timing lives in Preparation. */}
          {wastePct !== undefined && wastePct > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '.2rem' }}>
              {t('recipeOutput.mixingBuffer', { pct: wastePct })}
            </div>
          )}
        </div>
      </div>

      {breadProtocol && <p style={{fontSize:15,lineHeight:1.5,margin:0}}>{breadProtocol.method === 'unleavened'
        ? (locale === 'fr' ? 'Sans levure : un repos couvert détend la pâte avant de l’abaisser.' : 'Unleavened: a covered rest relaxes the dough before rolling.')
        : breadProtocol.cooking === 'boil-bake'
          ? (locale === 'fr' ? 'Prévoyez une casserole pour le pochage, puis une plaque pour la cuisson au four.' : 'Have a pan ready for poaching, then a baking tray for the oven.')
          : breadProtocol.cooking === 'griddle'
            ? (locale === 'fr' ? 'Cuisson à la poêle ou sur une plaque : gardez les pains cuits couverts pour qu’ils restent souples.' : 'Cook on a skillet or griddle; keep cooked breads covered to stay soft.')
            : (locale === 'fr' ? 'Suivez le façonnage et la cuisson propres à ce pain dans le guide.' : 'Follow this bread’s shaping and baking steps in the guide.')}</p>}

      {mode === 'custom' && <div style={{textAlign:'right',fontSize:12,color:'var(--smoke)'}}>{locale === 'fr' ? '% de farine · Poids' : '% of flour · Weight'}</div>}

      {/* ── Ingredients / Preferment cards ──────── */}
      {result.preferment && prefermentType && prefermentType !== 'none' ? (() => {
        const pf = result.preferment!;
        const pd = PREFERMENT_TYPES[prefermentType];
        const prefTotal = Math.round(pf.prefFlour + pf.prefWater + pf.prefYeastGrams);
        const chillAt = mixingTime ? poolishCoolingAt(mixingTime,result) : null;

        return (
          <details open>
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
                sub={!showSelectedFlour
              ? (styleKey ? recommendedFlourName(styleKey, locale) : undefined)
              : showSelectedFlour && flourBlend ? (() => {
                  const f1 = FLOUR_DATA[flourBlend.flour1];
                  const f1DisplayName = (flourBlend.brandProduct ? flourProductName(flourBlend.brandProduct,locale) : undefined) ?? (locale === 'fr' ? f1.nameFr : f1.name);
                  if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) {
                    return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>{f1DisplayName}</span>;
                  }
                  return <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>{locale === 'fr' ? `Utilisez votre farine principale (${f1DisplayName})` : `Use your primary flour (${f1DisplayName})`}</span>;
                })() : undefined}
              />
              <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(pf.prefWater)} noPct
                advancedPct={mode === 'custom' ? pctStr(Math.round(pf.prefWater / pf.prefFlour * 1000) / 10) : undefined}
                sub={t('recipeOutput.atRoomTemp')} />
              {chillAt && <p>{t('recipeOutput.chillPoolishAt',{time:formatTimeLabel(chillAt)})}</p>}
              {pf.prefYeastGrams > 0 && (
                <IngRow
                  label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t('recipeOutput.ingredientYeast', {
                    type: pf.prefYeastType ? ((YEAST_TYPES as Record<string, { shortName: string }>)[pf.prefYeastType]?.shortName ?? 'IDY') : 'IDY'
                  })}</span>}
                  grams={formatPrefermentDose(pf.prefYeastGrams,locale)} sub={measureHint(prefermentSpoon,!!prefermentDoseDilution)} noPct
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
              {showSelectedFlour && flourBlend && flourBlend.flour2 && flourBlend.ratio1 < 100 ? (() => {
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
                const pctOf = (w: number) => mode === 'custom' ? pctStr(Math.round(w / flour * 1000) / 10) : undefined;
                return (
                  <>
                    <IngRow label={(flourBlend.brandProduct ? flourProductName(flourBlend.brandProduct,locale) : undefined) ?? (locale === 'fr' ? f1.nameFr : f1.name)} grams={wStr(f1Weight)} noPct advancedPct={pctOf(f1Weight)} />
                    <IngRow label={flourBlend.customFlour2Name ?? (locale === 'fr' ? f2.nameFr : f2.name)} grams={wStr(f2Weight)} noPct advancedPct={pctOf(f2Weight)} />
                    {hasF3 && f3 && (
                      <IngRow label={flourBlend.customFlour3Name ?? (locale === 'fr' ? f3.nameFr : f3.name)} grams={wStr(f3Weight)} noPct advancedPct={pctOf(f3Weight)} />
                    )}
                  </>
                );
              })() : (
                <IngRow
                  label={showSelectedFlour && flourBlend && (!flourBlend.flour2 || flourBlend.ratio1 >= 100)
                    ? ((flourBlend.brandProduct ? flourProductName(flourBlend.brandProduct,locale) : undefined) ?? (locale === 'fr' ? FLOUR_DATA[flourBlend.flour1].nameFr : FLOUR_DATA[flourBlend.flour1].name))
                    : t('recipeOutput.remainingFlour')}
                  grams={wStr(pf.finalFlour)} noPct
                  advancedPct={mode === 'custom' ? pctStr(Math.round(pf.finalFlour / flour * 1000) / 10) : undefined} />
              )}
              <IngRow label={t('recipeOutput.remainingWater')} grams={wStr(pf.finalWater)} noPct sub={<details><summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Préparer l’eau' : 'Prepare the water'}</summary>{waterAssumption}{finalDoughWaterSubNode}</details>}
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

          {result.flourParts?.length ? result.flourParts.map((part, index) => { const grams = part.grams - (sdActive && index === 0 ? sdHalf : 0); return <IngRow key={`${part.key}-${index}`} label={flourProductName(locale === 'fr' ? part.nameFr : part.name,locale)} grams={wStr(grams)} noPct={sdActive} pct={pctStr(grams / flour * 100)} highlight advancedPct={mode === 'custom' && !sdActive ? pctStr(grams / flour * 100) : undefined} />; }) : <IngRow
            label={t('recipeOutput.ingredientFlour')}
            grams={wStr(flourMain)}
            noPct={sdActive}
            pct="100%"
            highlight
            advancedPct={mode === 'custom' ? '100%' : undefined}
            sub={showSelectedFlour && flourBlend ? (() => {
              const f1 = FLOUR_DATA[flourBlend.flour1];
              const f1DisplayName = (flourBlend.brandProduct ? flourProductName(flourBlend.brandProduct,locale) : undefined) ?? (locale === 'fr' ? f1.nameFr : f1.name);
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
                  {p2}% {flourBlend.customFlour2Name ?? (locale === 'fr' ? f2.nameFr : f2.name)} ({f2Weight.toLocaleString('en')}g)
                  {hasF3 && f3 && <>{' · '}{p3}% {flourBlend.customFlour3Name ?? (locale === 'fr' ? f3.nameFr : f3.name)} ({f3Weight.toLocaleString('en')}g)</>}
                </span>
              );
            })() : <>
              {guidedFlourGuidance}
              {sdActive && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>
                {locale === 'fr' ? `+ ${sdHalf}g via le levain = ${flour}g au total` : `+ ${sdHalf}g via the starter = ${flour}g total`}
              </span>
              )}
            </>}
          />}
          {water > 0 && <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(sdActive ? waterMain : water)} noPct={sdActive} pct={pctStr(waterPct)} sub={
            !enrichment ? <details><summary style={{minHeight:44,cursor:'pointer'}}>{locale === 'fr' ? 'Préparer l’eau' : 'Prepare the water'}</summary>
              {sdActive && <p>{locale === 'fr' ? `${wStr(sdHalf)} d’eau sont déjà dans le levain indiqué ci-dessous.` : `${wStr(sdHalf)} water is already in the starter shown below.`}</p>}
              {waterAssumption}{waterSubNode}
            </details> : undefined} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />}
          {mode==='custom' && flourBlend?.flour2 && <p className="bh-key-detail">{[flourBlend.flour1,flourBlend.flour2,flourBlend.flour3].filter(Boolean).map((key,index)=>{
            const ratio=index===0?flourBlend.ratio1:index===1?(flourBlend.flour3?flourBlend.ratio2??0:100-flourBlend.ratio1):100-flourBlend.ratio1-(flourBlend.ratio2??0);
            const flourType=FLOUR_DATA[key as keyof typeof FLOUR_DATA];
            return ratio>0 ? `${locale==='fr'?flourType.nameFr:flourType.name} ${formatPercent(ratio,locale)}` : null;
          }).filter(Boolean).join(' · ')} ({locale==='fr'?'farine ajoutée au pétrissage':'flour added at mixing'})</p>}
          {enrichmentRows}
          <IngRow label={t('recipeOutput.ingredientSalt')}  grams={wStr(salt)}  pct={pctStr(saltPct)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />

          {yeastInfo && (
            <IngRow
              label={
                yeastTypeName
              }
              sub={yeastSub}
              grams={formatYeastDose(yeastInfo.convertedGrams, locale)}
              pct={pctStr(yeastInfo.convertedPct)}
              advancedPct={mode === 'custom' ? pctStr(yeastInfo.convertedPct) : undefined}
            />
          )}

          {yeastInfo && (() => {
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
                      {showPriorityOverride ? (locale==='fr'?'Fermer':'Close') : (locale==='fr'?'Ajuster le dosage de levure':'Adjust yeast dose')}
                    </button>
                  </div>
                )}
                {showPriorityOverride && mode === 'custom' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '4px .1rem 8px', borderBottom: `1px solid rgba(156, 130, 72,0.16)` }}>
                    {([
                      {value:null,label:locale==='fr'?'Automatique':'Automatic',desc:locale==='fr'?'Selon le planning':'From the schedule'},
                      {value:'flavor',label:t('recipeOutput.priorityFlavour'),desc:locale==='fr'?'Réduire la dose':'Lower the dose'},
                      {value:'speed',label:t('recipeOutput.prioritySpeed'),desc:locale==='fr'?'Augmenter la dose':'Increase the dose'},
                    ] as { value: string | null; label: string; desc: string }[]).map(opt => {
                      const effective = priorityOverride ?? null;
                      const isActive = effective === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          aria-pressed={isActive} onClick={() => onPriorityOverride?.(opt.value)}
                          style={{
                            minHeight:44, padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
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
              sub={locale === 'fr' ? 'Levain liquide · 100 % d’hydratation' : 'Liquid starter · 100% hydration'}
              grams={wStr(sdMid)}
              // Same weight styling as every other ingredient; the % sits beside it in Custom.
              advancedPct={mode === 'custom' ? (sourdough.starterPctMin === sourdough.starterPctMax ? `${sourdough.starterPctMin}%` : `${sourdough.starterPctMin}–${sourdough.starterPctMax}%`) : undefined}
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


      {(hasPref || sdActive) && <section aria-label={locale==='fr'?'Quantités totales':'Total ingredients'}>
        <details>
          <summary style={{minHeight:44,cursor:'pointer',alignContent:'center'}}>
            {locale==='fr'?'Farine totale':'Total flour'} {wStr(flour)}{mode==='custom' && <> · {pctStr(hydration)} {locale==='fr'?'d’hydratation':'hydration'}</>}
          </summary>
        {showSelectedFlour && result.flourParts?.length ? result.flourParts.map((part, index) => <IngRow key={`${part.key}-${index}`} label={flourProductName(locale === 'fr' ? part.nameFr : part.name,locale)} grams={wStr(part.grams)} advancedPct={mode === 'custom' ? pctStr(part.pct) : undefined} />) : <IngRow label={t('recipeOutput.ingredientFlour')} grams={wStr(flour)} advancedPct={mode === 'custom' ? '100%' : undefined} sub={guidedFlourGuidance} />}
        <IngRow label={t('recipeOutput.ingredientWater')} grams={wStr(water)} advancedPct={mode === 'custom' ? pctStr(waterPct) : undefined} />
        <IngRow label={t('recipeOutput.ingredientSalt')} grams={wStr(salt)} advancedPct={mode === 'custom' ? pctStr(saltPct) : undefined} />
        {pf && pf.prefYeastGrams > 0 && <IngRow label={t(`recipe.yeastNames.${pf.prefYeastType ?? 'instant'}`)} grams={formatPrefermentDose(pf.prefYeastGrams,locale)} advancedPct={mode === 'custom' ? pctStr(pf.prefYeastGrams / flour * 100) : undefined} />}
        {oil > 0 && <IngRow label={t('recipeOutput.ingredientOil')} grams={wStr(oil)} advancedPct={mode === 'custom' ? pctStr(oilPct) : undefined} />}
        {sugar > 0 && <IngRow label={t('recipeOutput.ingredientSugar')} grams={wStr(sugar)} advancedPct={mode === 'custom' ? pctStr(sugarPct) : undefined} />}
        {mode === 'custom' && <IngRow label={locale === 'fr' ? 'Dont farine préfermentée' : 'Of which prefermented flour'} grams={wStr(pf ? pf.prefFlour : sdHalf)} advancedPct={pctStr((pf ? pf.prefFlour : sdHalf) / flour * 100)} sub={locale === 'fr' ? 'Déjà comprise dans la farine totale.' : 'Already included in total flour.'} />}
          {mode==='custom' && flourBlend?.flour2 && <p className="bh-key-detail">{locale==='fr'?'Le mélange choisi concerne la farine ajoutée au pétrissage. Pour les totaux, la farine du levain ou du préferment est comptée dans la première farine.':'The selected blend applies to flour added at mixing. The totals count starter or preferment flour with the first flour.'}</p>}
        </details>
      </section>}
      {afterIngredients}

      {mode !== 'simple' && onContainerCapacityChange && breadProtocol?.method !== 'unleavened' && <details className="bh-disclosure">
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
                value: wStr(Math.round(poolishPerBatch)),
                highlight: false,
                isTotal: false,
              }] : []),
              { label: hasPref ? t('recipeOutput.flourFinalDough') : t('recipe.flour'), value: wStr(Math.round(flourPerBatch)), highlight: false, isTotal: false },
              { label: hasPref ? t('recipeOutput.waterFinalDough') : t('recipe.water'), value: wStr(Math.round(waterPerBatch)), highlight: false, isTotal: false },
              { label: t('recipe.salt'), value: wStr(Math.round(saltPerBatch)), highlight: false, isTotal: false },
              ...(yeastPerBatch !== null ? [{
                label: yeastTypeName || (locale === 'fr' ? 'Levure' : 'Yeast'),
                value: formatYeastDose(yeastPerBatch,locale),
                highlight: false,
                isTotal: false,
              }] : []),
              ...(['starter','oil','sugar','milk','eggs','butter'] as const).filter(key=>batchPlan.portion[key]>0).map(key=>({label:({milk:locale==='fr'?'Lait':'Milk',eggs:locale==='fr'?'Œufs sans coquille':'Eggs, without shells',butter:locale==='fr'?'Beurre':'Butter',starter:locale==='fr'?'Levain':'Starter',oil:locale==='fr'?'Huile':'Oil',sugar:locale==='fr'?'Sucre':'Sugar'})[key],value:wStr(Math.round(batchPlan.portion[key])),highlight:false,isTotal:false})),
              { label: t('recipeOutput.batchTotal'), value: wStr(Math.round(batchPlan.total)), highlight: true, isTotal: true },
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
            {locale === 'fr' ? 'Vérifiez le planning si le pétrissage prend plus de temps.' : 'Review the schedule if mixing takes longer.'}
          </div>
        </div>
      )}



      {/* ── Yeast details ───────────────────────────
          Hidden in preferment mode: all commercial yeast lives in the
          poolish/biga there, so callouts based on the main-dough yeast
          amount would contradict the preferment card. */}
      {yeastInfo && hasPref && result.preferment && result.preferment.prefYeastGrams > 0 && result.preferment.prefYeastGrams < 1 && !prefermentSpoon && (
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
            {t('recipeOutput.precisionScaleBody', { amount: formatPrefermentDose(result.preferment.prefYeastGrams,locale) })}
            {(() => {
              const pf = result.preferment!;
              const dilution = prefermentDoseDilution;
              if (!dilution) return null;
              const yeastName = (YEAST_TYPES as Record<string, { shortName: string }>)[pf.prefYeastType]?.shortName ?? 'IDY';
              const f = (g:number)=>formatPrefermentDose(g,locale);
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

          {(yeastInfo.hitMinFloor || needsPrecision || dilutionTip) && <details className="bh-disclosure">
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
                {t('recipeOutput.precisionScaleBody', { amount: formatYeastDose(yeastInfo.convertedGrams, locale) })}
              </div>
            </div>
          )}


          {/* Dilution tip */}
          {dilutionTip && (
            <InfoCard
              icon=""
              level="info"
              title={t('recipeOutput.dilutionTitle')}
              body={t('recipeOutput.dilutionBody', {
                waterG: dilutionTip.waterG,
                // Kitchen-scale precision: whole grams from 10 g, one decimal below.
                solutionG: kitchenGrams(dilutionTip.solutionG),
                waterInSolutionG: kitchenGrams(dilutionTip.waterInSolutionGrams ?? dilutionTip.solutionG * 100 / 101),
                remainingWaterG: kitchenGrams((dilutionTip.remainingWaterGrams ?? waterMain - dilutionTip.solutionG * 100 / 101) - mainIceG),
              })+(mainIceG>0?' '+t('recipeOutput.dilutionIce',{iceG:mainIceG}):'')}
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
              {(t.raw(`recipeOutput.bulkCues.${cueGroup}`) as string[]).map((cue, i) => (
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
            starterEvents={starterEvents}
            mixingTime={mixingTime}
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
