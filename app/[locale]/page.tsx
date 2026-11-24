'use client';
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import {usePageTop} from '../hooks/usePageTop';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import type { User } from '@supabase/supabase-js';
import StarterFeedStatus from '../components/StarterFeedStatus';
import BakeStartStatus from '../components/BakeStartStatus';
import {normalizeMixExecution, type MixExecution, type AcceptedPlan, normalizeAcceptedPlan, acceptedPlanMove, promptedPreparationAt, normalizeBakeExecution, normalizeStarterFeedRecords, overdueStarterFeed, shiftStarterPlanAfterFeed, recordedOnPlan, type StarterFeedRecord, type BakeExecution} from '../utils/bakeExecution';
import Header from '../components/Header';
import dynamic from 'next/dynamic';
const ProfileSheet = dynamic(() => import('../components/ProfileSheet'), { ssr: false });
import { DEFAULT_BLOCKERS, loadProfile, updateProfile, setProfileListener, loadLastEquipment, rememberLastEquipment } from '../lib/profile';
import { useBottomNavHeight } from '../hooks/useBottomNavHeight';
import { pushProfile, pullAndMergeProfile } from '../lib/supabase/profileSync';
import OpeningChoices from '../components/OpeningChoices';
import StylePicker, { StylePhotoPreload } from '../components/StylePicker';
import BakeNavigator, {DestinationIcon, type BakeStepLink} from '../components/BakeNavigator';
import { bakeHeadline, recipeSummaryLine } from '../utils/bakeHeadline';
import BakeTypeChooser from '../components/BakeTypeChooser';
import {getServingTimeEstimate, breadCoolingRange} from '../utils/servingTime';
import {getPizzaById} from '../lib/toppingDatabase';
import { BackLabel } from '../components/BackLabel';
import BottomActions from '../components/BottomActions';
import FillingsInvitation from '../components/FillingsInvitation';
import {destinationForRoute,routeForDestination,restoredBakeRoute,normalizeNavigation,type BakeRoute,type BakeDestination,type BatchView,type BakeNavigationMemory} from '../lib/bakeNavigation';
import { useMobileKeyboard } from '../hooks/useMobileKeyboard';
import { NEXT_CTA, BACK_CTA, SECONDARY_CTA, oneLineCta } from '../lib/navButtons';
import { getSetupBlocker, type SetupBlocker } from '../lib/setupBlocker';
import OvenPicker from '../components/OvenPicker';
import PrototypeQuantityPicker from '../components/PrototypeQuantityPicker';
import MixerPicker from '../components/MixerPicker';
import MixingBatchControl from '../components/MixingBatchControl';
const SchedulePicker = dynamic(() => import('../components/SchedulePicker'), { ssr: false });
import { starterFeedToMixHours } from '../lib/starterTiming';
import { mixerDoughCapacity, suggestedMixingBatchCount } from '../utils/mixingBatches';
import { doughShoppingItems as buildDoughShoppingItems, yeastShoppingName, yeastBuyingHint, breadFinishShopping } from '../lib/doughShopping';
import { isPanPizzaStyle } from '../utils/panPizza';
import { buildPlanCalendar, calendarBakeId, downloadPlanCalendar, exportedSteps, hasExportedPlan, keyPlanEvents, readExportedSteps, writeExportedSteps, type PlanCalendarEvent } from '../utils/planCalendar';
import { leanBreadPreheatMin, leanBreadBake } from '../utils/leanBreadBake';
import { sharedOvenFor, ovenBackTitle } from '../utils/sharedOven';
import { sharedStarterFeedFor, sharedFeedLine, starterEventsWithSharedFeed, savedStarterUse, carriedJarRecords, starterStepShownTime, withStarterTakeOut, type StarterUse } from '../utils/sharedStarter';
import { scalePicks, allPicksBaked } from '../utils/pizzaPicks';
import { bakeTitleName } from '../utils/bakeTitle';
import { journalTitle } from '../components/BakeJournal';
import {commercialPrefermentWindow, commercialPrefermentPlanValid, commercialReadinessWindow, automaticCommercialPlan, earliestPrefermentBake, validateConfirmedBake, STYLE_FERM_DEFAULTS, type StarterEvent } from '../components/SchedulePicker';
import { prefermentConditioningAction } from '../utils/scheduleEdit';
import { findAvailabilityConflicts, planActions, isTimeBlocked, normalizeCoveredActions, normalizeFridgeRemoval, selectedAvailabilityCount, profileBlocksForBake, nightHandsOn, blocksForLaterBake } from '../utils/scheduleAvailability';
import { retainCurrentFridgeRemoval } from '../utils/fridgeRemovalSession';
import { normalizeTimingOverrides, type TimingOverrides } from '../utils/timingOverrides';
import ClimatePicker from '../components/ClimatePicker';
import SimpleMixerPicker from '../components/SimpleMixerPicker';
// The ingredients load as their own chunk. A placeholder of their height keeps the plan
// below them from showing first and jumping down once they arrive.
const loadRecipeOutput = () => import('../components/RecipeOutput');
const RecipeOutput = dynamic(loadRecipeOutput, { ssr: false, loading: () => <div aria-hidden="true" style={{ minHeight: '70vh' }} /> });
const BakeGuide = dynamic(() => import('../components/BakeGuide'), { ssr: false });
import { getPrefPeakH_RT, getPrefOptH, getStarterFridgeWarmupH } from '../components/FermentChart';
import StarterStrip, { starterStripModel } from '../components/StarterStrip';
import { peakClock } from '../utils/peakTime';
import { isKeyPlanRow } from '../utils/planKeySteps';
import YeastHelper from '../components/YeastHelper';
const PizzaParty = dynamic(() => import('../components/PizzaParty'), { ssr: false });
const SandwichParty = dynamic(() => import('../components/SandwichParty'), { ssr: false });
import { createSandwichSnapshot, normalizeSandwichSnapshot, switchSandwichFamily, sandwichFamilyForStyle, type SandwichSnapshot } from '../lib/sandwich';
import FlourPicker from '../components/FlourPicker';
import PrefermentPicker from '../components/PrefermentPicker';
import { createClient } from '../lib/supabase/client';
import type { SavedRecipe } from '../lib/supabase/fetchRecipes';
import { archivedBlendSelections } from '../lib/flourRecovery';
import { flourShoppingName } from '../lib/flourGuidance';
import { clockMark } from '../utils/guideProgress';
import { ovenBusyMinutes, bakeEndAt, ovenClash, nextFreeOvenShift, ovenBusyClause, ovenUseEnd, ovenFreeAt, ovenTakenAt, type OvenUse } from '../utils/ovenWindow';
import { recordGeneratedBake, refreshCurrentJournalSnapshot, forgetCurrentJournalBake, setCurrentJournalId, currentJournalId, getJournalEntry, dueJournalEntry, liveJournalBakes, mergeSharedJarRows, guidePlanSnapshot, journalDueStep, type JournalEntry, type LiveJournalBake } from '../lib/localJournal';
import { deleteJournalPhotos } from '../lib/journalPhotos';
import { archiveLocalBake, preservePreviousBake, acceptCurrentSessionStorage, clearSession, loadSession, saveSession, serializeStarterEvents, restoreStarterEvents, normalizeMixingBatches, normalizeFlourTarget, stashAuthIntent, readAuthIntent, clearAuthIntent, type SessionData } from '../lib/session';
import { upsertBakeEvent } from '../lib/supabase/saveBakeEvent';
import { bakeEventTitle, type BakeEvent } from '../lib/supabase/fetchBakeEvents';
import { useSessionSave } from '../hooks/useSessionSave';
import { formatYeastDose, recipeYeastTotal } from '../utils/prefermentDose';
import { soonStartLabel } from '../utils/startNotice';
import { nightStepsLine } from '../utils/nightSteps';
import { checkYeastEntry, entryPlan, entryTiming, type EntryPlan, entryPlanShape, entryPlanSearch, isNightBlock, nearestFittingShownPct, bakerHours, bakerPct, parseDecimal, formatDecimal, normalizeEntryNightKept, nightFreeShownPct, uncovered, type YeastEntryCheck, type YeastEntryInput, type PrefermentPlanOption } from '../utils/yeastEntry';
import { starterActionLabelFor, starterBuild } from '../utils/starterBuild';
import { type UnitSystem, cToDisplay, inputTempToC, tempUnit, formatClock, formatPlanClock, clockRange, roundToQuarter, formatBakeDateTime, displayWeight, formatPercent } from '../utils/units';
import { formatDuration } from '../utils/duration';
import {
  ALL_STYLES, OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PREFERMENT_TYPES,
  PIZZA_STYLES, BREAD_STYLES, FLOUR_DATA,
  isLevainStyle, STYLE_DEFAULT_BLENDS, isStyleDefaultBlend, recipeFlourStrength, recipeFlourBlend, bigaCoolOffered, BIGA_WINDOWS, type BigaStorage,
  type BakeType, type StyleKey, type OvenType, type BreadOvenType, type AnyOvenType, type MixerType, type YeastType, type FlourBlend, type PrefermentType,
} from '../data';
import {
  buildSchedule, type PlanLadder, calculateRecipe, recommendedHydration, formatTime, requiredPrefWarmupH, requiredPrefCooldownH,
  type AvailabilityBlock, type EnteredYeastTiming, type ScheduleResult,
  starterBulkFactor, raisedLevainFits, referenceStarterPct, prefTempAfterWarmup, sourdoughBulkH, hasCoherentScheduleShape, withLongerPreheat,
} from '../utils';
import { exitLeadFor, normalizeExitLead, planExitLead, type ExitLead } from '../utils/exitLead';
import { DEFAULT_WASTE_PCT, effectiveWastePct, restoredWastePct } from '../utils/doughAllowance';
import { getBreadProtocol } from '../utils/breadProfiles';
import { breadNoun, bakeSubject } from '../utils/breadNames';
import { twinBakeWhen, jarRowName } from '../utils/twinBakes';
import { buildItems } from '@/app/components/Timeline';
import UnitInput from '@/app/components/UnitInput';
import { yeastRowLabel, autoPctPlaceholder, roundShownPct } from '../utils/yeastRow';
import { choosePrefermentYeastTiming, prefermentYeastTiming, prefermentWindowMiss, normalizePrefYeastOverride, prefermentYeastStorages, prefermentMassG, prefermentYeastBounds, PREF_YEAST_MIN_PCT, PREF_YEAST_MAX_PCT, type FlourPreferment } from '../utils/prefermentYeast';


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
// Size choices under Adjust on Quantity.
// Pizza (cm): AVPN allows 22–35 cm for Neapolitan, with 280 g balls at 28–35 cm; home
// Neapolitan is usually 30–33 cm, so Large is 33. New York is 14–16 in at home (35–40 cm).
const PIZZA_SIZE_CHOICES: Record<string, number[]> = {
  neapolitan: [26, 30, 33], sourdough: [26, 30, 33], pizza_romana: [26, 30, 33], newyork: [30, 35, 40],
};
// Bread (dough per piece). The middle choice is the style's default weight. A baguette
// bakes to about 250 g (France.fr), from about 320 g of dough; a ficelle is about half.
// A 9 × 4 × 4 in Pullman tin takes about 800 g (The Perfect Loaf, pain de mie).
const BREAD_SIZE_CHOICES: Record<string, { grams: number; en: string; fr: string }[]> = {
  baguette: [{grams:160,en:'Ficelle',fr:'Ficelle'},{grams:320,en:'Baguette',fr:'Baguette'},{grams:450,en:'Bâtard',fr:'Bâtard'}],
  pain_campagne: [{grams:500,en:'Small loaf',fr:'Petit pain'},{grams:800,en:'Family loaf',fr:'Pain familial'},{grams:1200,en:'Large loaf',fr:'Grosse miche'}],
  pain_levain: [{grams:500,en:'Small loaf',fr:'Petit pain'},{grams:900,en:'Family loaf',fr:'Pain familial'},{grams:1200,en:'Large loaf',fr:'Grosse miche'}],
  pain_complet: [{grams:500,en:'Small loaf',fr:'Petit pain'},{grams:750,en:'Family loaf',fr:'Pain familial'},{grams:1200,en:'Large loaf',fr:'Grosse miche'}],
  pain_seigle: [{grams:500,en:'Small loaf',fr:'Petit pain'},{grams:700,en:'Family loaf',fr:'Pain familial'},{grams:1000,en:'Large loaf',fr:'Grand pain'}],
  pain_au_seigle: [{grams:500,en:'Small loaf',fr:'Petit pain'},{grams:800,en:'Family loaf',fr:'Pain familial'},{grams:1200,en:'Large loaf',fr:'Grosse miche'}],
  brioche: [{grams:300,en:'Small loaf',fr:'Petite brioche'},{grams:500,en:'Loaf tin',fr:'Brioche moule'},{grams:800,en:'Large loaf',fr:'Grande brioche'}],
  pain_mie: [{grams:450,en:'Small tin',fr:'Petit moule'},{grams:600,en:'Loaf tin',fr:'Moule à cake'},{grams:800,en:'Pullman 9×4×4 in',fr:'Pullman 23 cm'}],
  pain_viennois: [{grams:80,en:'Rolls',fr:'Petits pains'},{grams:200,en:'Viennoise',fr:'Baguette viennoise'},{grams:300,en:'Large',fr:'Grande'}],
  fougasse: [{grams:250,en:'Small',fr:'Petite'},{grams:400,en:'Classic',fr:'Classique'},{grams:600,en:'Large',fr:'Grande'}],
};
const STYLE_BALL_DEFAULTS: Record<string, number> = {
  neapolitan: 4, newyork: 4, pizza_romana: 4, roman: 2, pan: 2, sourdough: 4,
  pain_campagne: 1, pain_levain: 1, baguette: 4, pain_complet: 1,
  pain_seigle: 1, pain_au_seigle: 1, fougasse: 2, brioche: 6, pain_mie: 1, pain_viennois: 4,
};
const CORN_LABELS = ['Thin', 'Classic', 'Generous'];
const CORN_LABELS_FR = ['Fine', 'Classique', 'Généreuse'];

// ── Percentage stepper — salt · oil · sugar ─────────────────
// One definition. These were three near-copies that drifted apart: salt had
// no info dot and its own header layout, sugar's "+" had a 8px radius against
// everyone else's 12px, and only salt showed an inline note.
//
// No info dot, and no paragraph either. The guidance is a zone word in the
// same blue/sage/gold/coral semantics the sliders above already use, so the
// steppers read the way the rest of the screen does. A full sentence appears
// only where the value earns one — sugar past 2%, oil in a pizza oven. Both
// rows keep a reserved height so one column cannot shove its neighbours.
function PctStepper({
  label, display, onDec, onInc, reset, zone, note, children,
}: {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  reset?: { onReset: () => void; label: string };
  /** One or two words naming where this value sits, in the same colour
   *  semantics as the sliders above. Always shown. */
  zone?: { word: string; color: string };
  /** The exception, not the rule: a sentence only where the value earns one. */
  note?: string;
  children?: React.ReactNode;
}) {
  const btn: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '14px', flexShrink: 0,
    border: '1.5px solid var(--border)', background: 'var(--cream)',
    fontSize: '15px', cursor: 'pointer', color: 'var(--char)',
    fontFamily: 'var(--font-ui)', lineHeight: 1, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: '4px',
        minHeight: '20px', marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase',
          letterSpacing: '.06em', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
        }}>{label}</span>
        {reset && (
          <button
            onClick={reset.onReset}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
              textDecoration: 'underline', padding: 0, whiteSpace: 'nowrap',
            }}
          >↺ {reset.label}</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button onClick={onDec} style={btn} aria-label="−">−</button>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)',
          fontSize: '13px', color: 'var(--char)', fontVariantNumeric: 'tabular-nums',
        }}>{display}</span>
        <button onClick={onInc} style={btn} aria-label="+">+</button>
      </div>
      <div style={{
        fontSize: '11px', lineHeight: 1.3, marginTop: '5px', minHeight: '15px',
        color: zone?.color ?? 'var(--smoke)', fontFamily: 'var(--font-ui)',
        textAlign: 'center',
      }}>{zone?.word ?? ''}</div>
      {note && (
        <div style={{
          fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic',
          lineHeight: 1.4, marginTop: '3px',
        }}>{note}</div>
      )}
      {children}
    </div>
  );
}

function pizzaWeightFromTable(sk: string, d: number, corn: number): number {
  const table = PIZZA_WEIGHT_TABLE[sk];
  if (!table) return 270;
  d = Math.max(table[0][0], Math.min(table[table.length - 1][0], d));
  for (let i = 0; i < table.length - 1; i++) {
    if (d >= table[i][0] && d <= table[i + 1][0]) {
      const r = (d - table[i][0]) / (table[i + 1][0] - table[i][0]);
      const w = table[i][corn + 1] + r * (table[i + 1][corn + 1] - table[i][corn + 1]);
      return Math.round(w / 5) * 5;
    }
  }
  return Math.round(table[table.length - 1][corn + 1] / 5) * 5;
}

// Diameter, crust and weight are three controls over two degrees of freedom:
// weight is what the table gives for a diameter and a crust. So editing weight
// has to move one of the other two, and which one is a real decision.
//
// It used to move the DIAMETER: asking for 270g at 30cm quietly made the pizza
// 33cm. But diameter is an intent — "I want 30cm pizzas" — and it should not
// drift because the baker wanted more dough. Crust is a description of how much
// dough sits on that area, which is exactly what weight expresses.
function cornFromWeight(sk: string, d: number, w: number): number {
  let best = 1, bestDiff = Infinity;
  for (let c = 0; c <= 2; c++) {
    const diff = Math.abs(pizzaWeightFromTable(sk, d, c) - w);
    if (diff < bestDiff) { bestDiff = diff; best = c; }
  }
  return best;
}

// True when the weight is exactly what the chosen crust gives at this
// diameter. When it is not, no crust segment is highlighted — the label would
// otherwise claim a precision the number does not have.
function crustMatchesWeight(sk: string, d: number, corn: number, w: number): boolean {
  return pizzaWeightFromTable(sk, d, corn) === w;
}

function getWeightBounds(sk: string | null, bt: string | null): { min: number; max: number; step: number } {
  if (bt !== 'bread' || !sk) return { min: 150, max: 500, step: 5 };
  const profile = getBreadProtocol(sk);
  if (profile) return {min: Math.max(40, Math.floor(profile.portions.weight / 2 / 5) * 5), max: Math.max(400, profile.portions.weight * 3), step: 5};
  switch (sk) {
    case 'baguette':      return { min: 150, max: 450,  step: 10 };
    case 'pain_viennois': return { min: 50,  max: 300,  step: 10 };
    case 'brioche':       return { min: 150, max: 900,  step: 25 };
    case 'pain_mie':      return { min: 300, max: 1200, step: 25 };
    case 'pain_levain':
    case 'pain_campagne':
    case 'pain_complet':
    case 'pain_seigle':
    case 'pain_au_seigle': return { min: 300, max: 1500, step: 25 };
    default:              return { min: 200, max: 1200, step: 25 };
  }
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
  pain_au_seigle: { min: 62, classicMin: 68, classicMax: 75, advancedMax: 80, max: 85, name: 'Pain au Seigle' },
  fougasse:      { min: 65, classicMin: 70, classicMax: 78, advancedMax: 83, max: 88, name: 'Fougasse' },
  brioche:       { min: 45, classicMin: 50, classicMax: 58, advancedMax: 65, max: 72, name: 'Brioche' },
  pain_mie:      { min: 55, classicMin: 60, classicMax: 65, advancedMax: 70, max: 75, name: 'Pain de Mie' },
  pain_viennois: { min: 52, classicMin: 58, classicMax: 65, advancedMax: 70, max: 75, name: 'Pain Viennois' },
};
const FALLBACK_ZONE = { min: 50, classicMin: 60, classicMax: 70, advancedMax: 78, max: 85, name: 'Custom' };

// ── Step flow model ──────────────────────────
// One derived list per mode is the single source of truth for: the chip
// carousel, the "Étape N sur X" counter, Prev/Next targets and the
// missing-field CTA. Step `id`s stay the historical numbers so the existing
// advance()/restore/skip logic keeps working; the displayed position is the
// index in this list, so merging or hiding a step never means renumbering.
type StepDef = {
  id: number;
  chip: string;          // short label carried by the chip
  title: string;         // page title
  value: string | null;  // summary, null when the step has no answer
  // Short form for the summary bar when the full values no longer fit one
  // line. Only steps whose value is long need one; the rest fall back.
  short?: string | null;
  prefilled?: boolean;   // value is a code default, not a baker's decision
  gap: string;           // sentence used by the missing-field CTA
  // Which of the review page's four questions this step answers. Display
  // only — the flow, the ids and their order are untouched by it.
  group?: 'making' | 'kitchen' | 'dough' | 'plan';
};

type StepFlow = {
  steps: StepDef[];
  activeId: number;
  highestStep: number;
  locale: string;
  onJump: (id: number) => void;
  onGapJump: (id: number) => void;
  onPrev: (id: number) => void;
  onNext: (id: number) => void;
  nextIdFor: (id: number) => number;
  onGenerate: () => void;
  onReview?: () => void;
  editReturn?: { label: string; onReturn: () => void };
  showGenerate: boolean;
  generationBlocker?: SetupBlocker;
  generateLabel: string;
  onSeePlan: () => void;
  recipeGenerated: boolean;
  gapReturn: boolean;
  onGapReturn: () => void;
};

// ── Swipe between step pages ──────────────────
// Secondary to the buttons, never the only way anywhere: iOS Safari owns the
// first ~24px of the left edge for its own back gesture, so a swipe-back
// started there never reaches us.
function useStepSwipe(flow: StepFlow, enabled: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let sx = 0, sy = 0, live = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as HTMLElement | null;
      // Anything that drags or scrolls horizontally keeps its gesture:
      // range inputs, the chart's draggable diamonds, chip rows, carousels.
      // Any control keeps its own gesture. A tap that drifts sideways on a
      // button — the filter toggle, a chip, a stepper — could turn the page
      // under the baker's finger.
      if (target?.closest('button, a, input, select, textarea, svg, [role="button"], [data-noswipe]')) { live = false; return; }
      let n: HTMLElement | null = target;
      while (n && n !== el) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) { live = false; return; }
        n = n.parentElement;
      }
      if (t.clientX < 24 || t.clientX > window.innerWidth - 8) { live = false; return; }
      live = true; sx = t.clientX; sy = t.clientY;
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.58) return;
      const i = flow.steps.findIndex(x => x.id === flow.activeId);
      if (i < 0) return;
      if (dx < 0) { if (i < flow.steps.length - 1) flow.onNext(flow.activeId); }
      else        { if (i > 0) flow.onPrev(flow.activeId); }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchend', end);
    };
  }, [flow, enabled]);
  return ref;
}

// A code default is a suggestion until the baker has moved past its page:
// passing through with Suivant counts as adopting it, which is exactly what
// highestStep already records.
function stepAnswered(s: StepDef, highest: number, list?: StepDef[]): boolean {
  if (s.value == null) return false;
  if (!s.prefilled) return true;
  // A default counts as adopted once the baker has moved past its page — but
  // there is no past the last page. Without this the final step's own CTA read
  // "Dough not confirmed" forever and jumped to the page it was already on.
  const isLast = list != null && list.length > 0 && list[list.length - 1].id === s.id;
  return isLast ? highest >= s.id : highest > s.id;
}

// ── My bake's answers, as the "Your bake" sheet lists them (BakeNavigator) ──
type BakeLink = {label:string; value?:string|null; disabled?:boolean; group?:'basics'|'custom'; onChoose:()=>void};
const sheetHeadStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '.06em',
  textTransform: 'uppercase', color: 'var(--smoke)', padding: '14px 2px 4px',
};

// A populated step summary does not imply a valid baking protocol.
// Keep an actionable correction at the end of setup and on its review.
function SetupBlockerAction({flow,onJump}: {flow:StepFlow;onJump?:(id:number)=>void}) {
  const fr=flow.locale==='fr';
  const gap=flow.steps.find(step=>!stepAnswered(step,flow.highestStep,flow.steps));
  const blocker=flow.generationBlocker;
  // Style and quantity live outside the compact Organisation step list.
  // Keep the blocker's route even when its step is not displayed in this list.
  const targetId=gap?.id ?? blocker?.stepId ?? flow.steps.find(step=>step.group==='plan')?.id ?? flow.steps[0]?.id;
  if(targetId===undefined) return null;
  const reason=gap?.gap ?? blocker?.reason ?? (fr?'Vérifiez le planning avant de créer la recette.':'Review the schedule before creating the recipe.');
  const action=gap?.chip ?? blocker?.action ?? (fr?'Revoir le plan':'Review the plan');
  return <div style={{width:'100%'}}>
    <p role="status" style={{fontSize:13,color:'var(--ash)',margin:'0 0 8px'}}>{reason}</p>
    <button type="button" onClick={()=> (onJump??flow.onJump)(targetId)} style={{...NEXT_CTA,background:'var(--warm)',color:'#6B4423',border:'1.5px solid #6B4423',boxShadow:'none'}}>{action} →</button>
  </div>;
}

// ── Setup review ──────────────────────────────
function SetupReview({ flow, modeChip, onJump, onBackToRecipe, forward, busyRow, nameField, stale = false, reviewValues = {}, returnLabel, kitchenRow, starterRow, suggestedRows = {}, hideSuggested = false }: {
  /** Simple: rows the baker never chose stay out of the summary. */
  hideSuggested?: boolean;
  /** The busy times the plan avoids, under the bake time; only when there are some. */
  busyRow?: { value: string; onClick: () => void };
  /** With a current recipe: back to it on the left, on to the next section on the right. */
  forward?: { label: string; onClick: () => void };
  /** Once there is a recipe, My bake opens on the plan. */
  returnLabel?: string;
  /** One sentence naming the values Baker Hub proposed and the baker has not chosen. */
  /** Rows whose value the baker has not chosen yet: a small "suggested" tag on the row. */
  suggestedRows?: Record<string, boolean>;
  /** The kitchen temperature has its own screen; the review lists it as its own row. */
  kitchenRow?: { value: string; onClick: () => void };
  /** Simple sourdough: the "Your starter" answer, listed after the kitchen. */
  starterRow?: { value: string; onClick: () => void };
  nameField?: React.ReactNode;
  flow: StepFlow;
  modeChip?: { value: string; onClick: () => void };
  onJump: (id: number) => void;
  onBackToRecipe: () => void;
  stale?: boolean;
  reviewValues?: Record<number, string | null | undefined>;
}) {
  const fr = flow.locale === 'fr';
  // Rows in the order the baker answered them: what, how much, the kitchen, when (and the busy
  // times), then what Custom adds (14 Nov 2026 audit).
  const steps = [...flow.steps.filter(s => s.group === 'making'), ...flow.steps.filter(s => s.group === 'plan'), ...flow.steps.filter(s => s.group !== 'making' && s.group !== 'plan')];
  const rows = [
    ...steps.flatMap(step => [
      ...(kitchenRow && step.group === 'plan' ? [{ key: 'kitchen-temperature', label: fr ? 'Température de la cuisine' : 'Kitchen temperature', value: kitchenRow.value, onClick: kitchenRow.onClick }] : []),
      ...(starterRow && step.group === 'plan' ? [{ key: 'starter', label: fr ? 'Votre levain' : 'Your starter', value: starterRow.value, onClick: starterRow.onClick }] : []),
      { key: String(step.id), label: step.id===3 ? step.title : step.id===10 ? (fr ? 'Pâte' : 'Dough') : step.chip, value: reviewValues[step.id] ?? step.value ?? step.gap, onClick: () => onJump(step.id) },
      ...(busyRow && step.group === 'plan' ? [{ key: 'busy', label: fr ? 'Moments occupés' : 'Busy times', value: busyRow.value, onClick: busyRow.onClick }] : []),
    ]),
  // Only what the baker chose: assumed values are not listed in Simple.
  ].filter(row => !(hideSuggested && flow.recipeGenerated && suggestedRows[row.key]));
  return (
    <div>
      <h1 className="bh-page-title">{fr ? 'Revoir mes choix' : 'Review my choices'}</h1>
      {nameField}
      <div>
        {rows.map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--smoke)', marginBottom: '5px' }}>{row.label}</span>
              <strong style={{ fontSize: '14px', lineHeight: 1.5, fontWeight: 600 }}>{row.value}</strong>
            </div>
            <button onClick={row.onClick} aria-label={`${fr ? 'Modifier' : 'Edit'} : ${row.label}`} style={{ minWidth:44, minHeight: '44px', border: 'none', background: 'none', color: 'var(--terra)', font: 'inherit', fontSize: '13px', cursor: 'pointer', padding: '8px 0 8px 8px' }}>{fr ? 'Modifier' : 'Edit'}</button>
          </div>
        ))}
      </div>
      {/* Customizing is the optional next step, not a mode to review: one quiet link. */}
      {modeChip && <button type="button" data-mode-switch className="bh-back-action" style={{ minHeight: 44, marginTop: 12, paddingLeft: 0 }} onClick={modeChip.onClick}>{modeChip.value === 'simple' ? (fr ? 'Personnaliser ma fournée' : 'Customize my bake') : (fr ? 'Revenir aux réglages conseillés' : 'Use the recommended settings')}</button>}
      <BottomActions>{forward && flow.recipeGenerated && !stale ? <>
        <button type="button" className="bh-back-action" onClick={onBackToRecipe}>{fr ? 'Retour à la recette' : 'Back to Recipe'}</button>
        <button type="button" data-review-forward style={NEXT_CTA} onClick={forward.onClick}>{forward.label}</button>
      </> : (flow.recipeGenerated || flow.showGenerate) ? (
        <button onClick={onBackToRecipe} style={{ ...NEXT_CTA, marginTop: '22px' }}>
          {returnLabel && flow.recipeGenerated ? returnLabel : !flow.recipeGenerated ? (fr ? 'Créer ma recette' : 'Create my recipe') : stale ? (fr ? 'Mettre à jour la recette' : 'Update recipe') : (fr ? 'Retour à la recette' : 'Back to Recipe')}
        </button>
      ) : <div style={{marginTop:22}}><SetupBlockerAction flow={flow} onJump={onJump} /></div>}</BottomActions>
    </div>
  );
}

// Compact row for the progress sheet.
function SetupRow({ step, ok, onClick, inset, last }: {
  step: StepDef; ok: boolean; onClick: () => void;
  inset?: boolean; last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
        padding: inset ? '13px 15px' : '14px 2px',
        background: 'none', border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',

        cursor: 'pointer', fontFamily: 'var(--font-ui)', minHeight: '44px',
        textAlign: 'left',
      }}
    >
      <span style={{ ...sheetKeyStyle, width: inset ? '84px' : '96px' }}>{step.chip}</span>
      <span style={{ flex: 1, fontSize: '14.5px', textAlign: 'left', lineHeight: 1.35 }}>
        {ok ? (
          <span style={{ fontWeight: 600, color: 'var(--char)' }}>
            {step.value}
          </span>
        ) : (
          <span style={{ color: '#9C8248', fontWeight: 400 }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px',
              borderRadius: '50%', background: 'var(--gold)',
              marginRight: '6px', verticalAlign: '1px',
            }} />
            {step.gap}
          </span>
        )}
      </span>
      <SheetChevron />
    </button>
  );
}

const sheetRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
  padding: '14px 2px', background: 'none', border: 0, borderBottom: '1px solid var(--border)',
  cursor: 'pointer', fontFamily: 'var(--font-ui)', minHeight: '44px',
};
const sheetKeyStyle: React.CSSProperties = {
  fontSize: '12px', letterSpacing: '.06em', textTransform: 'uppercase',
  color: 'var(--smoke)', width: '104px', flexShrink: 0, textAlign: 'left',
};
function SheetChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B0A69B"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// Every forward move in the journey wears the same button: Suivant between
// step pages, Generer ma recette at the end of setup, Planifier ma Pizza Party
// at the end of the protocol. They were three different shapes for one idea.
// NEXT_CTA and BACK_CTA now live in app/lib/navButtons so Pizza Party can
// use the same objects. #6B4423 became var(--terra), which is that exact
// value — the token was already the crust brown.

// ── One step = one page ───────────────────────

// ── Style is not an optional input ───────────────────────────
// It IS the fermentation biology: Neapolitan is 24h cold + 2h room, Roman is
// 6h at room temperature and never sees a fridge. Without it there is no
// dough to schedule, so a plan is not a degraded answer, it is a fabricated
// one — and it silently rewrites itself the moment a style is picked.
//
// Three engines used to disagree about an unset style. The recommender fell
// back to no cold retard at all, buildSchedule fell back to Neapolitan, and
// the recipe refused outright. That is how a 4-hour plan appeared under a
// 26-hour curve. All three now agree: no style, no plan.
//
// This is not a new gate. Style is already step 1; the only way to reach the
// plan without it is jumping backwards. This just makes the plan step honour
// an order the flow already asserts.
function NeedsStyleFirst({ fr, onChoose }: { fr: boolean; onChoose: () => void }) {
  return (
    <div style={{ padding: '8px 0 4px' }}>
      <p style={{
        fontSize: '13px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
        lineHeight: 1.55, margin: '0 0 16px',
      }}>
        {fr
          ? 'Choisissez un style pour adapter les ingrédients et le planning.'
          : 'Choose a style to tailor the ingredients and schedule.'}
      </p>
      <button
        onClick={onChoose}
        style={{
          ...NEXT_CTA,
          background: 'var(--warm)', color: '#6B4423',
          border: '1.5px solid #6B4423', boxShadow: 'none',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
        }}
      >
        {fr ? 'Choisir le style →' : 'Choose your style →'}
      </button>
    </div>
  );
}

function SessionReplacementNotice({ fr, localOnly }: { fr: boolean; localOnly: boolean }) {
  return <>
    <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
      {localOnly ? (fr ? 'Cette fournée est conservée sur cet appareil' : 'This bake is saved on this device') : (fr ? 'Conserver cette version avant de recommencer ?' : 'Keep this version before starting again?')}
    </p>
    <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
      {fr ? 'Une nouvelle fournée remplacera la reprise sur cet appareil. Pour conserver cette version dans votre historique, enregistrez-la dans votre compte.' : 'A new bake will replace the resume saved on this device. Save this version to your account to keep it in your history.'}
    </p>
  </>;
}

function eggShoppingLabel(grams: number, fr: boolean): string {
  const count = Math.ceil(grams / 50);
  return fr ? `Œufs sans coquille — environ ${count} œuf${count > 1 ? 's' : ''} de 50 g sans coquille ; peser, les tailles varient` : `Eggs without shells — about ${count} egg${count > 1 ? 's' : ''} at 50 g without shell each; weigh, sizes vary`;
}

function bakeQuantityLabel(count: number, bakeType: string | null, styleKey: string | null, fr: boolean): string {
  const noun = bakeType === 'bread'
    ? styleKey === 'piadina' ? (count === 1 ? 'piadina' : 'piadinas')
      : breadNoun(styleKey, count, fr)
    : count === 1 ? 'pizza' : 'pizzas';
  return `${count} ${noun}`;
}

/** The bake's title until the baker names it: what is made, when it is eaten, the day.
 *  "Pizza night · Sun 15 Nov", "Pizza lunch · Sat 14 Nov", "Baguettes · Sat 14 Nov". */
function autoBakeTitle(bakeType: string | null, styleKey: string | null, count: number, bakeAt: Date | null, fr: boolean, styleName: string, bakeHour?: number): string {
  const what = bakeTitleName(bakeType, styleKey, count, bakeAt ? bakeAt.getHours() : bakeHour, fr, styleName);
  if (!bakeAt || !Number.isFinite(+bakeAt)) return what;
  const day = new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(bakeAt);
  return `${what} · ${day}`;
}

/** The title on the recipe, renamed in place. Until the baker types a name it shows the
 *  automatic one; clearing it, or leaving it unchanged, keeps the automatic one. */
function BakeTitleField({ value, auto, fr, onCommit }: { value: string; auto: string; fr: boolean; onCommit: (name: string) => void }) {
  // The bake's name is the Recipe's heading; tapping it (or the pencil) renames it in place.
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editing = draft !== null;
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const start = () => setDraft(value || auto);
  const commit = () => { const name = (draft ?? '').trim(); onCommit(name && name !== auto ? name : ''); setDraft(null); };
  // The page-title style used across the site (.bh-page-title), so the input matches the heading.
  const font = { fontFamily: 'var(--font-display, Georgia, serif)', fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.015em', color: 'var(--char)' } as const;
  return <div data-bake-title-field style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44 }}>
    {editing
      ? <input ref={input} data-bake-title-input aria-label={fr ? 'Nom de la fournée' : 'Bake name'} value={draft} maxLength={100} enterKeyHint="done"
          onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }}
          style={{ ...font, flex: 1, minWidth: 0, border: 0, borderRadius: 6, padding: '4px 6px', margin: '0 -6px', background: 'var(--warm)' }} />
      : <h1 className="bh-page-title" data-bake-title onClick={start}
          style={{ ...font, flex: '0 1 auto', minWidth: 0, margin: 0, padding: '4px 0', borderBottom: '1px dashed var(--border)', cursor: 'text' }}>{value || auto}</h1>}
    {!editing && <button type="button" data-bake-rename aria-label={fr ? 'Renommer la fournée' : 'Rename this bake'} onClick={start}
      style={{ width: 44, height: 44, flex: '0 0 44px', display: 'grid', placeItems: 'center', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>
    </button>}
  </div>;
}

function StepActions({ children }: { children: React.ReactNode }) {
  return <BottomActions>{children}</BottomActions>;
}

function StepPage({ flow, id, children, nextOverride, backOverride }: { flow: StepFlow; id: number; children: React.ReactNode; nextOverride?: React.ReactNode; backOverride?: React.ReactNode }) {
  if (flow.activeId !== id) return null;
  const idx  = flow.steps.findIndex(s => s.id === id);
  const step = flow.steps[idx];
  if (!step) return null;
  const fr     = flow.locale === 'fr';
  const isLast = idx === flow.steps.length - 1;
  const gap    = flow.steps.find(s => !stepAnswered(s, flow.highestStep, flow.steps));

  const nextStyle = NEXT_CTA;  // A dead button is a dead end: the CTA stays live and names what's missing.
  const missingStyle: React.CSSProperties = {
    ...nextStyle,
    background: 'var(--warm)', color: '#6B4423',
    border: '1.5px solid #6B4423', boxShadow: 'none',
    fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
  };

  let next: React.ReactNode = null;
  if (id === 1 && !step.value) {
    next = <div style={{ width: '100%' }}>
      <p className="bh-visually-hidden">{fr ? 'Sélectionnez un style pour continuer.' : 'Select a style to continue.'}</p>
      <button disabled style={{ ...nextStyle, opacity: 0.5, cursor: 'not-allowed' }}>{fr ? 'Continuer' : 'Continue'}</button>
    </div>;
  } else if (flow.gapReturn && !isLast) {
    // Filling one gap should hand the baker straight to the next one. Bouncing
    // back to the last step to be told what is still missing makes them walk
    // the same loop once per gap. This step counts as settled the moment they
    // leave it, so it is excluded when looking for what is next.
    // FORWARD ONLY. Searching for any unanswered step and merely excluding
    // this one lets two genuinely-empty steps hand the baker back and forth
    // for ever — Style → Yeast → Style. Only ever looking at steps after this
    // one makes the chain monotonic, so it has to end at the plan.
    const lastId = flow.steps[flow.steps.length - 1].id;
    const found = flow.steps.slice(idx + 1).find(s => !stepAnswered(s, flow.highestStep, flow.steps));
    const nextGap = found && found.id !== lastId ? found : undefined;
    // Name where the button GOES, never what is absent. A step that is not
    // set yet is the normal state of almost every step for almost all of the
    // journey; saying so on every screen turns a guided flow into a list of
    // failures. The gap sentences still exist on the review page and in the
    // sheet, where they describe a state rather than block a baker who is
    // simply walking forward.
    next = nextGap
      ? <button onClick={flow.onGapReturn} style={nextStyle}>
          {nextGap.chip} →
        </button>
      : <button onClick={flow.onGapReturn} style={nextStyle}>
          {flow.steps.at(-1)?.chip} →
        </button>;
  } else if (isLast) {
    if (gap?.id === id) {
      // The missing field is already on this page: never link back to itself.
      next = <div style={{ width: '100%' }}>
        <p style={{ fontSize: '14px', color: 'var(--smoke)', margin: '0 0 8px' }}>{step.group === 'plan' ? (fr ? 'Choisissez un horaire de cuisson ci-dessus.' : 'Choose a cooking time above.') : step.gap}</p>
        <button disabled style={{ ...nextStyle, opacity: 0.5, cursor: 'not-allowed' }}>{fr ? 'Continuer' : 'Continue'}</button>
      </div>;
    } else if (gap) {
      // Outlined here, because on the final step an unfilled one really is
      // what stands between the baker and a recipe — but named, not accused.
      next = <button onClick={() => flow.onGapJump(gap.id)} style={missingStyle}>
        {gap.chip} →
      </button>;
    } else if (flow.showGenerate) {
      next = <button onClick={flow.onGenerate} style={nextStyle}>{flow.generateLabel}</button>;
    } else if (flow.recipeGenerated) {
      next = <button onClick={flow.onSeePlan} style={nextStyle}>{fr ? 'Voir les ingrédients →' : 'View ingredients →'}</button>;
    } else {
      next = <SetupBlockerAction flow={flow} />;
    }
  } else {
    // Label the step Suivant actually reaches, not the one that happens to sit
    // next in the list: with profile-answered steps skipped, "Suivant :
    // Équipement" was landing on Climat.
    const destination = flow.steps.find(s => s.id === flow.nextIdFor(id));
    next = <button data-bh-forward type="button" onClick={() => flow.onNext(id)} style={nextStyle}>
      {destination?.chip ?? (fr ? 'Mes choix' : 'My choices')} →
    </button>;
  }

  // Both pages move together — only the incoming one animating reads as a
  // swap rather than a displacement, which is what loses the eye.
  return (
    <div id={`step-${id}`} key={id} className="bh-step-page">
      {/* No step counter here: the summary bar above carries it, and two
          "3 of 9" forty pixels apart is just noise. */}
      <h1 className="bh-page-title">{step.title}</h1>

      {children}

      {isLast && !flow.editReturn && nextOverride === undefined && flow.onReview && <button type="button" className="bh-back-action" onClick={flow.onReview}>{fr ? 'Revoir mes choix' : 'Review my choices'}</button>}

      {nextOverride !== null && <StepActions>
        {backOverride ?? <button type="button" className="bh-back-action" onClick={()=>flow.editReturn ? flow.onReview?.() : flow.onPrev(id)}><BackLabel text={flow.editReturn ? (fr?'Retour à mes choix':'Back to my choices') : (fr?'Étape précédente':'Previous step')}/></button>}
        {nextOverride !== undefined ? nextOverride : flow.editReturn ? <button type="button" style={nextStyle} onClick={flow.editReturn.onReturn}>{flow.editReturn.label}</button> : next}
      </StepActions>}
    </div>
  );
}

// ── Preparation timing summary ────────────────
// Timing lives in Preparation, not on the recipe: the first action, the bake,
// and — in Simple, where it was assumed rather than asked — the kitchen
// temperature the times depend on.
function PreparationTimingSummary({fr,locale,startAt,startLabel,bakeAt,helperAt,assumedKitchen,calendarOutdated,clash,nightLine,onAdjustTiming,onAddToCalendar}:{calendarOutdated?:boolean;clash?:boolean;nightLine?:React.ReactNode;fr:boolean;locale:string;startAt:Date;startLabel?:string;bakeAt:Date;helperAt?:Date;assumedKitchen?:React.ReactNode;onAdjustTiming:()=>void;onAddToCalendar?:()=>void}){
  // The start and bake times are the page's line under its title; this keeps what acts on them.
  void startLabel; void startAt; void bakeAt;
  return <section data-preparation-timing aria-label={fr?'Horaires':'Timing'} style={{margin:'0 0 8px'}}>
    {helperAt&&<p data-helper-step style={{margin:'0 0 4px',fontSize:15,color:'var(--char)'}}>{fr?'Vous, ou quelqu’un d’autre, sortez la pâte du réfrigérateur':'You or someone else takes the dough out of the fridge'} · {formatBakeDateTime(helperAt,locale)}</p>}
    {assumedKitchen}
    {/* A recorded step (mixed early, poolish late) that leaves the rest of the plan unworkable: said here, where
        the baker is, with Adjust timing beside it; the bake-day guide stays open (17 Nov 2026 retention round 2). */}
    {clash && <p data-plan-clash role="status" style={{margin:'0 0 4px',fontSize:15,color:'var(--char)'}}>{fr?'La suite du plan demande de nouveaux horaires.':'The rest of the plan needs new times.'}</p>}
    {nightLine}
    {calendarOutdated && <p data-calendar-outdated style={{margin:'8px 0 0',fontSize:14,lineHeight:1.45,color:'var(--ash)'}}>{fr?'Les étapes ont changé depuis votre ajout à l’agenda. Ajoutez le plan à nouveau pour le mettre à jour.':'The steps have changed since you added this plan to your calendar. Add it again to update it.'}</p>}
    <span style={{display:'flex',flexWrap:'wrap',gap:'0 18px'}}>
      <button type="button" className="bh-section-back" style={{minHeight:44}} onClick={onAdjustTiming}>{fr?'Ajuster les horaires':'Adjust timing'}</button>
      {onAddToCalendar&&<button type="button" data-add-calendar className="bh-section-back" style={{minHeight:44}} onClick={onAddToCalendar}>{calendarOutdated?(fr?'Mettre à jour mon agenda':'Update my calendar'):(fr?'Ajouter à mon agenda':'Add to my calendar')}</button>}
    </span>
  </section>;
}

// The Preheat time on the plan, earlier only (a longer preheat); applied with the plan's own "Update recipe".
function PreheatTimeEditor({fr,at,bakeAt,baseMin,onApply}:{fr:boolean;at:Date;bakeAt:Date;baseMin:number;onApply:(minutes:number)=>void}){
  const hm=(d:Date)=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const [value,setValue]=React.useState(hm(at));
  const [h,m]=value.split(':').map(Number);
  const chosen=new Date(bakeAt);chosen.setHours(h||0,m||0,0,0);if(+chosen>=+bakeAt)chosen.setDate(chosen.getDate()-1);
  const minutes=Math.round((+bakeAt-+chosen)/60000);
  const valid=Number.isFinite(minutes)&&minutes>=baseMin&&minutes<=baseMin+120;
  return <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',padding:'4px 0 10px'}}>
    <input type="time" step={900} aria-label={fr?'Préchauffer le four':'Preheat the oven'} value={value} onChange={e=>setValue(e.target.value)} style={{minHeight:44,padding:'0 8px',border:'1px solid var(--border)',borderRadius:8}}/>
    <button type="button" disabled={!valid} style={{...SECONDARY_CTA,width:'auto',minHeight:44,padding:'8px 14px'}} onClick={()=>onApply(minutes)}>{fr?'Mettre à jour la recette':'Update recipe'}</button>
  </div>;
}

// Several pizzas baked one at a time: the bake row reads from the first in to the last out ("7:30–9:00pm").

// The recipe opens on the answer to "when do I start?"; the steps and the
// calendar file are one tap away.
// The recipe says what goes in; below it, the plan says when: the key steps with
// their times only. How to do each step lives in Preparation.
function RecipePlanCard({fr,locale,startAt,startLabel,startKey,bakeAt,bakeEnd,steps,editable=[],editing=null,onEditTime,editor,notice,notes,beforeRow,startIsKey,moreLabel,onMore}:{fr:boolean;locale:string;startAt:Date;startLabel?:string;startKey?:string|null;bakeAt:Date;bakeEnd?:Date|null;steps:{key:string;at:Date;label:string;busy?:boolean}[];editable?:string[];editing?:string|null;onEditTime?:(key:string)=>void;editor?:React.ReactNode;notice?:{key:string;node:React.ReactNode}|null;notes?:Record<string,string>;beforeRow?:{key:string;node:React.ReactNode}|null;
  /** Key stages only (round 7): the plan's first action is one of them; omitted shows every step. */
  startIsKey?:boolean;moreLabel?:string|null;onMore?:()=>void}){
  const [allSteps,setAllSteps]=useState(false);
  // The times the baker chooses (Start Dough; the preferment in Custom) are changed here,
  // (the button's 44px reach overflows the row by negative margins, so the row keeps its height)
  // in place: the time is a button, its editor opens under the row, and applying it
  // updates the recipe. The other steps follow from those and stay plain text.
  const timeButton=(key:string,label:string,text:string)=><button type="button" data-plan-edit={key} aria-expanded={editing===key} aria-label={(fr?'Modifier l’heure : ':'Change time: ')+label}
    onClick={()=>onEditTime?.(key)} style={{font:'inherit',color:'var(--terra)',background:'none',border:0,padding:'12px 8px',margin:'-12px -8px',textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer',whiteSpace:'nowrap'}}>{text}<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',marginLeft:5,verticalAlign:'-1px'}}><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button>;
  const row={display:'flex',gap:12,padding:'7px 0',borderTop:'1px solid var(--border)',fontSize:15,lineHeight:1.4,color:'var(--char)'} as const;
  return <section data-recipe-plan aria-labelledby="bh-recipe-plan-title" style={{margin:'0 0 4px'}}>
    <h2 id="bh-recipe-plan-title" className="bh-section-title" style={{margin:'0 0 12px'}}>{fr?'Votre plan':'Your plan'}</h2>
    {/* Grouped by day; steps at the same shown time share a row; times read to 15 min
        (the calendar keeps the exact ones). */}
    {(()=>{
      const round5=(d:Date)=>new Date(Math.round(+d/900000)*900000);
      // The first step is a row like the others, under its day; the baker's own times are the tappable ones.
      const all=[{key:startKey??'start',at:round5(startAt),label:startLabel ?? (fr?'Commencer':'Start'),bake:false,own:true},...steps.map(step=>({key:step.key,at:round5(step.at),label:step.label,bake:false,own:false,busy:!!step.busy})),{key:'bake',at:round5(bakeAt),label:fr?'Enfourner':'Bake',bake:true,own:false}].sort((a,b)=>+a.at-+b.at||(a.own?-1:b.own?1:0));
      const rows:{key:string;keys:string[];at:Date;labels:string[];bake:boolean;own:boolean;busy?:boolean}[]=[];
      for(const item of all){const last=rows[rows.length-1];const busy='busy' in item&&!!item.busy;if(last&&+last.at===+item.at&&!item.bake&&!last.bake&&!item.own&&!last.own&&!editable.includes(item.key)&&!editable.includes(last.key)){last.labels.push(item.label);last.keys.push(item.key);last.busy=last.busy||busy;}else rows.push({key:item.key,keys:[item.key],at:item.at,labels:[item.label],bake:item.bake,own:item.own,busy});}
      // The key stages only (round 7, owner): the preferment or the levain build, the mix, the bake, and any
      // row the baker acts on from here (a time to change, a busy step, an open editor or note); All steps opens the rest.
      const keyRows=startIsKey===undefined?rows:rows.filter(r=>isKeyPlanRow(r,{startIsKey,editable,pinned:[editing,notice?.key,beforeRow?.key]}));
      const hidden=rows.length-keyRows.length;
      const shown=allSteps?rows:keyRows;
      const days:{day:string;rows:typeof rows}[]=[];
      for(const r of shown){const day=r.at.toLocaleDateString(fr?'fr-FR':'en-GB',{weekday:'long',day:'numeric',month:'short'});const last=days[days.length-1];if(last&&last.day===day)last.rows.push(r);else days.push({day,rows:[r]});}
      // Room for a pencil when a time is editable, so every label starts on the same line.
      const time={flex:'0 0 auto',minWidth:editable.length?'6em':'4.5em',color:'var(--ash)',fontVariantNumeric:'tabular-nums'} as const;
      return <><div data-recipe-plan-steps data-plan-key-only={!allSteps&&hidden>0?'':undefined}>{days.map(d=><div key={d.day} style={{marginTop:10}}>
        <p style={{margin:'0 0 2px',fontSize:14,fontWeight:700,color:'var(--char)'}}>{d.day.charAt(0).toUpperCase()+d.day.slice(1)}</p>
        <ol style={{listStyle:'none',margin:0,padding:0}}>{d.rows.map(r=><React.Fragment key={r.key}>{beforeRow&&r.keys.includes(beforeRow.key)&&<li data-plan-strip style={{listStyle:'none',borderTop:'1px solid var(--border)',padding:'6px 0 2px'}}>{beforeRow.node}</li>}<li data-plan-bake={r.bake||undefined} data-plan-start={r.own||undefined} style={{...row,fontWeight:r.bake?600:400,alignItems:'baseline'}}><span style={{...time,...(r.bake?{color:'var(--char)'}:{}),whiteSpace:'nowrap'}}>{editable.includes(r.key)?timeButton(r.key,r.labels[0],formatClock(r.at,locale)):r.bake&&bakeEnd?clockRange(r.at,bakeEnd,locale):formatClock(r.at,locale)}</span><span>{r.labels.join(' · ')}{notes?.[r.key]&&<span data-plan-row-note style={{color:'var(--smoke)'}}> · {notes[r.key]}</span>}{r.busy&&<span data-plan-busy style={{color:'var(--ash)'}}> · {fr?'pendant un moment occupé':'during a busy time'}</span>}{r.own&&(()=>{const soon=soonStartLabel(startAt,Date.now(),locale);return soon?<span data-plan-soon style={{color:'var(--ash)'}}> · {soon.split(' · ').pop()}</span>:null;})()}</span></li>{editing===r.key&&<li data-plan-editor style={{listStyle:'none'}}>{editor}</li>}{editing!==r.key&&notice?.key===r.key&&<li style={{listStyle:'none'}}>{notice.node}</li>}</React.Fragment>)}</ol>
      </div>)}</div>
      {hidden>0&&<button type="button" data-plan-all-steps aria-expanded={allSteps} onClick={()=>setAllSteps(v=>!v)} style={{display:'flex',alignItems:'center',minHeight:44,marginTop:4,padding:0,border:0,background:'none',font:'inherit',fontSize:15,color:'var(--terra)',cursor:'pointer'}}>
        {allSteps?(fr?'Étapes clés seulement':'Key steps only'):(fr?`Toutes les étapes (${rows.length})`:`All steps (${rows.length})`)}<span aria-hidden="true" style={{marginLeft:6}}>{allSteps?'▴':'▾'}</span></button>}</>;
    })()}
    {/* No fermentation curve (20 Nov 2026 chart review, owner): a commercial dough's one fact only the
        curve carried, the preferment's storage, is a note on its row (notes); a sourdough plan shows the
        starter strip before Start Dough (beforeRow) and keeps the full editor (Change times). */}
    {moreLabel&&onMore&&<button type="button" data-change-times className="bh-section-back" style={{minHeight:44,marginTop:8}} onClick={onMore}>{moreLabel}</button>}
  </section>;
}

// ── Mono label ────────────────────────────────
// Asked once per bake, on its own screen before the bake time, for Simple and
// Custom alike: kitchens change with the season, so nothing is remembered.
// Zones follow the slider colour semantics (blue slow → coral challenging).
const KITCHEN_ZONES=[
  {id:'cool',from:15,to:19,en:'Cool',fr:'Frais',color:'#A8B8D0'},
  {id:'mild',from:20,to:24,en:'Mild',fr:'Tempéré',color:'#8BA888'},
  {id:'warm',from:25,to:29,en:'Warm',fr:'Assez chaud',color:'#D4A853'},
  // Coral is kept for hydration; heat deepens the gold (14 Nov 2026 audit).
  {id:'hot',from:30,to:32,en:'Hot',fr:'Chaud',color:'#C49A45'},
  {id:'veryhot',from:33,to:38,en:'Very hot',fr:'Très chaud',color:'#A88038',
    hint:'A tropical kitchen without air conditioning',hintFr:'Cuisine tropicale sans climatisation'},
] as const;
const KITCHEN_MIN=15,KITCHEN_MAX=38;
function kitchenZone(t:number){return KITCHEN_ZONES.find(z=>t<=z.to)??KITCHEN_ZONES[KITCHEN_ZONES.length-1];}
function KitchenSlider({value,units,fr,onChange}:{value:number;units:UnitSystem;fr:boolean;onChange:(c:number)=>void}){
  const t=Math.round(Math.min(KITCHEN_MAX,Math.max(KITCHEN_MIN,value)));
  const zone=kitchenZone(t);
  const span=KITCHEN_MAX-KITCHEN_MIN;
  const pct=(c:number)=>((c-KITCHEN_MIN)/span)*100;
  const stops=KITCHEN_ZONES.map(z=>`${z.color} ${pct(z.from-0.5)}% ${pct(z.to+0.5)}%`).join(',');
  const hint='hint' in zone?(fr?zone.hintFr:zone.hint):null;
  return <div data-kitchen-slider data-kitchen-zone={zone.id}>
    <p style={{margin:'0 0 4px',fontSize:40,fontWeight:700,lineHeight:1.1,color:'var(--char)'}} aria-hidden="true">{cToDisplay(t,units)}{tempUnit(units)}</p>
    {/* The zone is named once, in bold under the slider; this line carries only a hint. */}
    <p style={{margin:hint?'0 0 16px':'0 0 8px',fontSize:16,color:'var(--ash)',minHeight:hint?undefined:0}} aria-live="polite"><span className="bh-visually-hidden">{fr?zone.fr:zone.en}{hint?' · ':''}</span>{hint??''}</p>
    <div style={{position:'relative',height:44,margin:'8px 0'}}>
    <div aria-hidden="true" style={{position:'absolute',left:0,right:0,top:16,height:12,borderRadius:6,background:`linear-gradient(to right,${stops})`}}/>
    <input type="range" min={KITCHEN_MIN} max={KITCHEN_MAX} step={1} value={t}
      aria-label={fr?'Température là où la pâte repose':'Temperature where the dough rests'}
      aria-valuetext={`${cToDisplay(t,units)}${tempUnit(units)} · ${fr?zone.fr:zone.en}`}
      onChange={e=>onChange(Number(e.currentTarget.value))}
      className="bh-kitchen-range" style={{position:'absolute',inset:0,width:'100%',height:44,margin:0,background:'transparent'}}/>
    </div>
    <div aria-hidden="true" style={{position:'relative',height:20,fontSize:12,color:'var(--smoke)',marginTop:4}}>
      {KITCHEN_ZONES.map(z=><span key={z.id} style={{position:'absolute',left:`${pct((z.from+z.to)/2)}%`,transform:'translateX(-50%)',whiteSpace:'nowrap',fontWeight:z.id===zone.id?700:400,color:z.id===zone.id?'var(--char)':undefined}}>{fr?z.fr:z.en}</span>)}
    </div>
  </div>;
}

function KitchenReading({value,units,fr,confirmed,onConfirm}:{value:number;units:UnitSystem;fr:boolean;confirmed:boolean;onConfirm:(v:number)=>void}){
  const [draft,setDraft]=useState<string|null>(null);
  const commit=()=>{
    if(draft===null)return;
    if(draft.trim()!==''&&Number.isFinite(Number(draft)))onConfirm(Math.min(38,Math.max(15,inputTempToC(Number(draft),units))));
    setDraft(null);
  };
  return <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14}}>
    <label style={{display:'inline-flex',alignItems:'center',gap:8}}>{fr?'Température de la cuisine':'Kitchen temperature'}
      <input aria-label={fr?'Température de la cuisine':'Kitchen temperature'} type="number" inputMode="decimal" min={cToDisplay(15,units)} max={cToDisplay(38,units)} step="any" style={{width:70,minHeight:44}} value={draft??cToDisplay(value,units)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>{tempUnit(units)}
    </label>
    {!confirmed && <button type="button" className="bh-section-back" onClick={()=>onConfirm(value)}>{fr?'Confirmer cette valeur proposée':'Confirm this suggested value'}</button>}
  </div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '12px', color: 'var(--smoke)', textTransform: 'uppercase',
      letterSpacing: '.06em', fontFamily: 'var(--font-ui)', marginBottom: '8px',
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
  const [highestStep, setHighestStep] = useState(1);
  const [advancedStep, setAdvancedStep] = useState(1);
  const [advancedHighestStep, setAdvancedHighestStep] = useState(1);
  const [flourBlend, setFlourBlend] = useState<FlourBlend>({ flour1: 'pizza00', flour2: null, ratio1: 100 });

  // Step 1 — bake type
  const [showBakeTypeChooser,setShowBakeTypeChooser]=useState(false);
  const [bakeType, setBakeType] = useState<BakeType | null>(null);

  // Step 2 — style + quantity
  const [styleKey, setStyleKey] = useState<StyleKey | null>(null);
  const breadProtocol = styleKey ? getBreadProtocol(styleKey) : undefined;
  const isUnleavened = breadProtocol?.method === 'unleavened';
  const compactPiadina = styleKey === 'piadina' && tab === 'simple';
  // Published (or owner-set) enriched formulas: milk, eggs and butter are fixed.
  const enrichedDirectOnly = styleKey === 'brioche' || styleKey === 'pain_viennois' || styleKey === 'pain_mie';
  const directMethodOnly = enrichedDirectOnly || !!(breadProtocol && breadProtocol.supportedPreferments.length === 1 && breadProtocol.supportedPreferments[0] === 'none');
  const breadSupportsStarter = !breadProtocol || breadProtocol.supportedPreferments.includes('levain');
  const [numItems, setNumItems] = useState(2);
  const [itemWeight, setItemWeight] = useState(270);
  const [totalFlourTarget, setTotalFlourTarget] = useState<number | undefined>();
  const [pizzaDiameter, setPizzaDiameter] = useState(30);
  const [pizzaCorn, setPizzaCorn] = useState(1);

  // ── Settled, not merely defaulted ─────────────
  // Quantity, Flour and Preferment each hold a hard-coded starting value (2 x
  // 270 g, pizza00, 'none'), and until now the flow adopted it the moment the
  // baker walked past the page: Preferment read "Direct" for someone who never
  // chose Direct, recorded identically to a style they did choose.
  //
  // The rule is: the profile answers the step, or the baker does. Nothing else
  // counts. The state below keeps its default so the engine always has a
  // number to work with, but the step reports no value until one of those two
  // settles it, and Generate waits for all three.
  //
  // Deliberately three booleans rather than a general mechanism. Climate and
  // Fine-tune are NOT in this set and should not be added lightly: Fine-tune's
  // values are derived from the style the baker chose, so they are a
  // recommendation rather than an assumption, and kitchen temperature is a
  // slider with no honest blank state — its provenance belongs with the
  // weather prefill, which can show a source line instead.
  //
  // Only Preferment renders UNSELECTED while unsettled, because a chip list
  // has an honest blank state. A flour blend and a numeric stepper do not:
  // an empty blend is not a thing you can draw, and a stepper showing nothing
  // is a broken control, not an unanswered question. For those two the page
  // keeps showing a working value while the STEP reports none — the door goes
  // gold and names it, and Generate waits. Same reasoning as Climate.
  const [qtyChosen, setQtyChosen] = useState(false);
  const [flourChosen, setFlourChosen] = useState(false);
  const [manualFlourEntry, setManualFlourEntry] = useState(false);
  const [prefermentChosen, setPrefermentChosen] = useState(false);

  // Wrappers for the quantity controls only. Choosing a style also sets a
  // default ball count and weight, and that must not count as the baker
  // answering the question — so those call sites keep the plain setters.
  const chooseNumItems = (v: number | ((n: number) => number)) => {
    setQtyChosen(true);
    setNumItems(v as number);
  };
  const chooseItemWeight = (v: number) => {
    setQtyChosen(true);
    setItemWeight(v);
  };
  const [avpnOpen, setAvpnOpen] = useState(false);

  // Step 3 — oven
  const [ovenType, setOvenType] = useState<AnyOvenType | null>(null);
  const [bakeName, setBakeName] = useState('');
  const [ovenConstruction, setOvenConstruction] = useState<'tabletop'|'masonry'|'home'|'micro'>('tabletop');

  // Step 4 — mixer
  const [mixerType, setMixerType] = useState<MixerType | null>(null);

  // Step 5 — schedule + yeast
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); return d;
  });
  const [eatTime, setEatTime] = useState<Date | null>(null);
  const [acceptedScheduleRepair, setAcceptedScheduleRepair] = useState<string | null>(null);
  const [starterFeedRecords,setStarterFeedRecords]=useState<StarterFeedRecord[]>([]);
  const [starterRecoveryPending,setStarterRecoveryPending]=useState(false);
  const [mixExecution,setMixExecution]=useState<MixExecution|undefined>();
  const [execution,setExecution]=useState<BakeExecution|undefined>();
  const [replanRequested,setReplanRequested]=useState(false);
  const [executionClock,setExecutionClock]=useState(()=>Date.now());
  useEffect(()=>{const refresh=()=>setExecutionClock(Date.now());const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
  const [timingOverrides, setTimingOverrides] = useState<TimingOverrides>({});
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [yeastType, setYeastType] = useState<YeastType | null>(null);

  // Step 6 — climate
  const [waterSource, setWaterSource] = useState<'room' | 'fridge' | 'tap' | 'measured'>('room');
  const [measuredWaterTemp, setMeasuredWaterTemp] = useState<number | undefined>(undefined);
  const [waterMethod, setWaterMethod] = useState<'premelt' | 'direct'>('premelt');
  const [spiralIceConfirmed, setSpiralIceConfirmed] = useState(false);
  const [mixingBatches, setMixingBatches] = useState<number | undefined>(undefined);
  const [customMixerCapacityG, setCustomMixerCapacityG] = useState<number | undefined>(undefined);
  const [resultNotes, setResultNotes] = useState('');
  const [containerCapacityLitres, setContainerCapacityLitres] = useState<number | undefined>(3);
  const [equipmentPanel, setEquipmentPanel] = useState<'oven'|'mixer'>('oven');
  useEffect(() => { if (!isRestoringRef.current) setMixingBatches(undefined); }, [numItems, itemWeight, mixerType, styleKey]);
  const [kitchenTemp, setKitchenTemp] = useState(22);
  const [customKitchenConfirmed, setCustomKitchenConfirmed] = useState(false);
  const [humidity, setHumidity] = useState('normal');
  const [fridgeTemp, setFridgeTemp] = useState(6);
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
  const [showResults, setShowResults]         = useState(false);


  // Sourdough feed time + constraint solver outputs
  const [starterEvents, setStarterEvents] = useState<StarterEvent[]>([]);
  const [starterPlanResetKey, setStarterPlanResetKey] = useState(0);
  const [feedTime, setFeedTime]             = useState<Date | null>(null);
  const [feed2Time, setFeed2Time]           = useState<Date | null>(null);
  const [fridgeOutTime, setFridgeOutTime]   = useState<Date | null>(null);
  const [starterFridgeInTime, setStarterFridgeInTime] = useState<Date | null>(null);
  const [starterState, setStarterState]     = useState<'rt_fed' | 'fridge_unfed' | 'fridge_fed'>('rt_fed');
  const [starterLocation, setStarterLocation] = useState<'rt' | 'fridge'>('rt');
  const [planningMode, setPlanningMode]     = useState<'last_fed' | 'know_peak'>('last_fed');
  const [lastFedTime, setLastFedTime]       = useState<Date | null>(null);
  const [knownPeakTime, setKnownPeakTime]   = useState<Date | null>(null);
  const [hasNotFedYet, setHasNotFedYet]     = useState<boolean | null>(null);
  const [lastFedAge, setLastFedAge]         = useState<'today'|'yesterday'|'days23'|'days45'|'week'|null>(null);
  // Simple sourdough asks one question on its own screen; the answer belongs to this bake.
  const [simpleStarterAnswer, setSimpleStarterAnswer] = useState<'counter'|'fridge'|'ready'|null>(null);
  const [lastFeedRatio, setLastFeedRatio]   = useState<1 | 2 | 4 | 5 | 10>(1);
  const [nextFeedRatio, setNextFeedRatio]   = useState<1 | 2 | 4 | 5 | 10>(1);
  const [nextFeedRatioOverride, setNextFeedRatioOverride] = useState<1 | 2 | 4 | 5 | 10 | null>(null);
  const [ratioMode, setRatioMode] = useState<'recommend' | 'keep'>('recommend');
  const [starterPeakTime, setStarterPeakTime] = useState<Date | null>(null);
  const [starterTimingValid, setStarterTimingValid] = useState(true);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleCandidateValid, setScheduleCandidateValid] = useState(true);
  // Simple's timing step: a single decision card is waiting for the baker.
  const [simpleDecisionPending, setSimpleDecisionPending] = useState(false);
  // Custom: the clash card is waiting for a choice (same card as Simple's).
  const [customDecisionPending, setCustomDecisionPending] = useState(false);
  const [starterMature, setStarterMature]   = useState(true);
  const [starterHasRye, setStarterHasRye]   = useState(false);
  const [tang, setTang] = useState<'mild' | 'balanced' | 'tangy'>('balanced');
  const [usingPeak2, setUsingPeak2]         = useState(false);

  // Advanced mode manual overrides
  const [prefermentType, setPrefermentType] = useState<PrefermentType>('none');
  const [prefermentValidity, setPrefermentValidity] = useState<{type: PrefermentType; valid: boolean}>({type:'none',valid:false});
  const onPrefermentValidityChange = React.useCallback((valid: boolean) => {
    setPrefermentValidity(previous => previous.type === prefermentType && previous.valid === valid ? previous : {type:prefermentType,valid});
  }, [prefermentType]);
  const commercialPrefermentPlanReady = yeastType === 'sourdough' || !['poolish','biga'].includes(prefermentType)
    || (prefermentValidity.type === prefermentType && prefermentValidity.valid);

  const [prefermentFlourPct, setPrefermentFlourPct] = useState<number | undefined>(undefined);
  const [prefOffsetH, setPrefOffsetH] = useState<number>(0);
  // Driven by SchedulePicker algo result — single source of truth for fridge/RT decision
  const [prefGoesInFridgeState, setPrefGoesInFridgeState] = useState<boolean>(true);
  const [poolishStorage, setPoolishStorage] = useState<'auto'|'fridge'|'room'>('auto');
  // Biga storage (D1, 21 Nov 2026): 'auto' keeps the fridge, a cool spot only when no fridge plan fits (kitchen ≤ 20 °C).
  const [bigaStorage, setBigaStorage] = useState<BigaStorage>('auto');

  const [manualHydration, setManualHydration] = useState<number | undefined>(undefined);
  const [manualOil, setManualOil]             = useState<number | undefined>(undefined);
  const [manualSugar, setManualSugar]         = useState<number | undefined>(undefined);
  const [manualSalt, setManualSalt]           = useState<number | undefined>(undefined);
  // Custom, direct dough: the baker's yeast amount as IDY % of flour. The plan is re-timed to it.
  const [yeastPctOverride, setYeastPctOverride] = useState<number | undefined>(undefined);
  // Round 9 (bug B): a preferment amount the baker entered and that no longer applies (another storage, or a
  // change that leaves it no window) is cleared, and said once where the baker sees the field.
  const [prefYeastCleared, setPrefYeastCleared] = useState<{type:FlourPreferment;idyPct:number} | null>(null);
  // Round 9 (owner, 22 Nov 2026): the amounts whose night steps the baker chose to keep (the line is not shown again).
  const [entryNightKept, setEntryNightKept] = useState<{yeast?:number;pref?:{type:FlourPreferment;pct:number}} | undefined>(undefined);
  // Fine-tune: a typed yeast amount too slow for the time before the bake. It is not applied.
  // The plan in the last generated recipe: when its dough starts and its first preparation begins.
  // "Have you mixed?" is asked about this plan, never about an unaccepted edit.
  const [acceptedPlan, setAcceptedPlan] = useState<AcceptedPlan | undefined>(undefined);
  const [yeastEntryIssue, setYeastEntryIssue] = useState<{shownPct:number;bakeAt:number;check:YeastEntryCheck;clampedFrom?:number} | null>(null);
  // Custom, poolish/biga (round 7): the baker's preferment yeast, IDY % of the preferment flour, for that preferment only.
  const [prefYeastOverride, setPrefYeastOverride] = useState<{type:FlourPreferment;pct:number} | undefined>(undefined);
  // A typed preferment amount whose window does not fit: kept unapplied, said once (shown in the baker's yeast).
  const [prefYeastIssue, setPrefYeastIssue] = useState<{type:FlourPreferment;shownPct:number;reason:'fast'|'slow'|'time'|'busy'|'plan'|'max';hours:number;inFridge:boolean;suggestedShownPct:number|null;clampedFrom?:number} | null>(null);
  // Custom, levain: the baker's starter % of flour; the levain bulk is re-timed to it.
  const [starterPctOverride, setStarterPctOverride] = useState<number | undefined>(undefined);
  // Levain without a baker-entered %: the % the planner raised the inoculation to so the
  // warm bulk fits the baker's free time (SchedulePicker); undefined is the default amount.
  const [autoStarterPct, setAutoStarterPct] = useState<number | undefined>(undefined);
  // Set by explicit plan-input edits (yeast amount, starter %, poolish storage); the scheduler clears it after replanning.
  const [planReplanPending, setPlanReplanPending] = useState(false);
  // A plan-input edit made after generation: the plan step mounts the scheduler, it replans,
  // then the recipe is regenerated and the baker is told what moved.
  const [replanReturn, setReplanReturn] = useState<{from:number;settled:boolean}|null>(null);
  // Times are changed from the plan: "Change times" on the Recipe (or Adjust timing in
  // Preparation) opens the full plan editor. The Bake time row in My bake asks only
  // for the bake time and busy times.
  const [bakeTimeQuestion, setBakeTimeQuestion] = useState(false);
  // Custom's bake-time step asks the same single question as Simple before the recipe;
  // "See the plan" opens the full editor only when the question alone cannot settle it.
  const [planDetail, setPlanDetail] = useState(false);
  const [customBakeQuestion, setCustomBakeQuestion] = useState(false);
  // Bake again of a Customized bake: the bake time (and a sourdough starter's state), then the recipe (round 6).
  const [quickRebake, setQuickRebake] = useState(false);
  // A clash is asked once: in a sheet when the baker creates the recipe (or returns from an
  // edit of the bake time), never inline on the bake-time question and never twice.
  const [decisionSheet, setDecisionSheet] = useState<null|'generate'|'return'>(null);
  // Two bakes needing the oven at once: offered once, at generate, in the "Before your recipe" sheet.
  const [ovenOffer, setOvenOffer] = useState<{other:OvenUse;shift:number}|null>(null);
  const ovenKept = useRef<number|null>(null);
  const ovenSlotPending = useRef<number|null>(null);
  // A step moved from the Recipe's plan: Start Dough ('mix') or the preferment ('pref').
  const [planEdit, setPlanEdit] = useState<null|'mix'|'pref'>(null);
  const [planMoved, setPlanMoved] = useState<{from:number;to:number;bakeFrom?:number;prepFrom?:number;prepTo?:number;yeastFrom?:number;yeastTo?:number;yeastTypeChanged?:boolean;flourFrom?:number;flourTo?:number}|null>(null);
  // The amounts of the last generated recipe, so an update can say what changed.
  const acceptedAmountsRef = useRef<{yeast?:number;flour?:number;yeastType?:string|null}|null>(null);
  // "Update my recipe" from a section's stale card brings the baker back to that section.
  const stayAfterUpdateRef = useRef<BakeDestination|null>(null);
  const [journalRequest, setJournalRequest] = useState(0);
  const [journalEntryRequest, setJournalEntryRequest] = useState<{ id: string; n: number } | null>(null);
  // Bumped after a calendar export so the plan card re-reads what was exported.
  const [calendarExports, setCalendarExports] = useState(0);
  // The timing card belongs to Preparation's summary; inside a step it repeats.
  const [prepOverview, setPrepOverview] = useState(true);
  const [targetDoughTemp, setTargetDoughTemp] = useState<number | undefined>(undefined);
  const [measuredFlourTemp, setMeasuredFlourTemp] = useState<number | undefined>(undefined);
  const [measuredPrefermentTemp, setMeasuredPrefermentTemp] = useState<number | undefined>(undefined);
  const [flourInFridge, setFlourInFridge]     = useState<boolean>(false);
  const [wastePct, setWastePct]               = useState<number | undefined>(undefined);
  // Extra for bowl loss: the baker's value, else 1.5 % for every bake (20 Nov 2026 round 7).
  const wasteAllowance = effectiveWastePct(wastePct);

  // Dial In tooltip visibility

  // BakeType card hover state

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  // Distinct from reviewMode. reviewMode means "any step may be edited" and
  // is switched on by session restore and by the scheduler jump too; hanging
  // the overview screen off it would have hidden the step those paths scroll
  // to. This flag means only: show the overview instead of the step pages.
  const [setupOverview, setSetupOverview] = useState(false);
  // Set when the baker taps the "X isn't set" CTA on the last page, so the
  // page they land on can offer the way back instead of stranding them.
  const [gapReturnTo, setGapReturnTo] = useState<number | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [showSignInForSave, setShowSignInForSave] = useState(false);
  // Le listener d'auth est monté une seule fois : sans refs il fermerait sur
  // le tout premier rendu et rejouerait une session vide.
  const saveCurrentSessionRef = useRef<(() => Promise<boolean>) | null>(null);
  const shareCurrentSessionRef = useRef<(() => Promise<void>) | null>(null);
  const [savedToCloudName, setSavedToCloudName] = useState<string | null>(null);
  const cloudSaveInFlight = useRef(false);
  const savedCloudIdRef = useRef<string | null>(null);
  const latestSessionPayloadRef = useRef('');
  const [cloudSaveState, setCloudSaveState] = useState<'idle' | 'saving' | 'failed'>('idle');
  // Vrai dès qu'on sait où on en est : session locale réappliquée, ou rien à
  // réappliquer. Un ref, parce que l'effet de rejeu doit le lire avant le
  // prochain rendu ; authTick le réveille, un ref seul ne rend pas.
  const restoreSettledRef = useRef(false);
  const [authTick, setAuthTick] = useState(0);
  // Incremente a chaque restauration : dit au selecteur de pizzas de relire
  // les quantites, que son etat interne ne peut pas deviner tout seul.
  const [partyRestoreToken, setPartyRestoreToken] = useState(0);
  // La liste des 150 pizzas est chargee paresseusement, donc les quantites
  // d'une session reprise arrivent APRES la restauration, souvent bien apres
  // la fenetre de 200 ms. Pendant ce trou, pizzaPartyQtys vaut {} et
  // buildPizzaPartySnapshot renvoie null : l'autosave ecrasait la soiree
  // enregistree — pizzas, courses et preparation — par un null, et seules les
  // quantites revenaient ensuite. C'est ce qui faisait disparaitre les coches.
  const partyHydratingRef = useRef(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [bakeEventId, setBakeEventId] = useState<string | null>(null);
  const [pizzaPartyQtys, setPizzaPartyQtys] = useState<Record<string, number>>({});
  const [sandwichParty, setSandwichParty] = useState<SandwichSnapshot>(() => createSandwichSnapshot());
  // Pain au levain option: seeds with a soaker step (adds a Trempage step to the protocole)
  const [addSeeds, setAddSeeds] = useState(false);
  const [bakedPartyQtys, setBakedPartyQtys] = useState<Record<string, number>>({});
  // Picks carried by Bake again, until the new recipe exists: a smaller quantity scales them (scalePicks).
  const [carriedPicks, setCarriedPicks] = useState(false);
  useEffect(() => {
    if (isRestoringRef.current) return;
    setSessionSaved(false);
  }, [
    styleKey, ovenType, mixerType, yeastType, resultNotes,
    numItems, itemWeight, totalFlourTarget, kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, customMixerCapacityG, humidity,
    fridgeTemp, manualHydration, prefermentType,
    prefermentFlourPct, eatTime, pizzaPartyQtys, bakedPartyQtys, sandwichParty,
  ]);
  const [bakePhotoUrl, setBakePhotoUrl] = useState<string | null>(null);
  const [bakedDone, setBakedDone] = useState(false);
  const [guideClock, setGuideClock] = useState<{kind:'now'|'next';title:string;at:number;cooking?:boolean}|null>(null);
  // The journal entry the bake on screen belongs to, set in the same update as the bake's own state, so
  // its guide ticks and snapshot never land on another bake while switching (17 Nov 2026 retention round 2).
  const [journalId, setJournalId] = useState<string | null>(null);
  // A recorded mix or preferment left the rest of the plan without workable times (see markMixMade).
  const [executionClash, setExecutionClash] = useState(false);
  // Resume mid-bake opens the guide, where the due step is, not the page last viewed (16 Nov retention review).
  const resumeToNow = useRef(false);
  // Bake again: what the baker wrote last time, shown once on the new recipe (16 Nov retention review).
  const [previousNote, setPreviousNote] = useState('');
  const [preheatExtraMin, setPreheatExtraMin] = useState(0);
  // Bake again keeps the time the dough spent out of the fridge last time (exitLead.ts).
  const [exitLead, setExitLead] = useState<ExitLead | undefined>(undefined);
  const [preheatEdit, setPreheatEdit] = useState(false);
  const pendingPreviousNote = useRef('');
  useEffect(() => {
    if (!isRestoringRef.current) setSessionSaved(false);
  }, [bakedDone]);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);

  const resultsRef           = useRef<HTMLDivElement>(null);
  const modeSelectorRef      = useRef<HTMLDivElement>(null);
  const suppressNextScrollRef = useRef(false);
  const isRestoringRef = useRef(false);
  const [scheduleRestoreRevision, setScheduleRestoreRevision] = useState(0);
  const pizzaPartyGetQtysRef = useRef<() => Record<string, number>>(() => ({}));

  // P5 — Stale protocol indicator
  const [protocolStale, setProtocolStale] = useState(false);

  // P5/P6 — Recipe generated flag
  const [recipeGenerated, setRecipeGenerated] = useState(false);

  // One persisted destination plus independent remembered local views.
  const [activeTab, setActiveTab] = useState<BakeRoute>('batch');
  const [batchView,setBatchView]=useState<BatchView>('style');
  const [protocolView,setProtocolView]=useState<'dough'|'fillings'>('dough');
  const [serviceView,setServiceView]=useState<'dough'|'fillings'>('dough');
  const [fillingsProgress,setFillingsProgress]=useState({done:0,total:0});
  const [shoppingReturnToFillings,setShoppingReturnToFillings]=useState(false);
  const [prepReturnToService,setPrepReturnToService]=useState<BakeNavigationMemory['prepReturnToService']>(null);
  const [fillingsReturn,setFillingsReturn]=useState<BakeNavigationMemory['returnTo']>(null);
  // The summary bar used to pin at a hardcoded 97px (pizza) / 62px (bread),
  // which is the height the sticky header HAPPENED to be. The header is
  // z-100 and the bar z-25, so any underestimate does not push the bar down,
  // it hides it: the chip rail was rendering underneath the tab strip with
  // its labels sliced off. Measured, so the two can never drift apart again.
  const stickyHeadRef = useRef<HTMLDivElement | null>(null);
  const [stickyHeadH, setStickyHeadH] = useState(97);
  useLayoutEffect(() => {
    const el = stickyHeadRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => setStickyHeadH(Math.round(el.getBoundingClientRect().height));
    sync();
    let frame = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); });
    ro.observe(el);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, []);

  const [pizzaPartyTab, setPizzaPartyTab] = useState<'pick' | 'shop' | 'prep' | 'bake'>('pick');
  const destination=destinationForRoute(activeTab,pizzaPartyTab,sandwichParty.tab);
  const browsingFillings=destination==='batch'&&(batchView==='fillings'||activeTab==='pizzaparty'||activeTab==='sandwiches');
  const hasPizzaFillings=Object.values(pizzaPartyQtys).some(q=>q>0);
  const hasBreadFillings=!!styleKey&&!!sandwichFamilyForStyle(styleKey)&&(sandwichParty.familyId===sandwichFamilyForStyle(styleKey)||(styleKey==='pain_mie'&&sandwichParty.familyId==='tartine'))&&Object.values(sandwichParty.qtys).some(q=>q>0);
  const hasFillings=bakeType==='pizza'?hasPizzaFillings:hasBreadFillings;
  const firstSelectedPizza=Object.entries(pizzaPartyQtys).find(([,qty])=>qty>0)?.[0];
  const readyTimeEstimate=getServingTimeEstimate({bakeType:bakeType??'pizza',styleKey:styleKey??'',numItems,itemWeight,ovenType:ovenType??'',hasFillings,pizzaOvenTemp:firstSelectedPizza?getPizzaById(firstSelectedPizza)?.ovenTemp:undefined});
  const companionVisible=browsingFillings||destination==='shopping'||destination==='protocol'&&protocolView==='fillings'||destination==='service'&&serviceView==='fillings';
  const companionPhase=destination==='shopping'?'shop':destination==='protocol'?'prep':destination==='service'?'bake':'pick';
  const prepContinueLabel=prepReturnToService==null?undefined:prepReturnToService==='fillings'&&bakeType==='bread'?(locale==='fr'?'Revenir à l’assemblage':'Return to assembly'):(locale==='fr'?'Retour à Cuisson & service':'Back to Baking & serving');
  // Nothing chosen on the way through: the forward button says so (16 Nov 2026 review).
  const fillingsSkipLabel=fillingsReturn?.forward?(bakeType==='pizza'?(locale==='fr'?'Pâte seule ? Passer à la liste de courses':'Dough only? Skip to shopping list'):(locale==='fr'?'Pain seul ? Passer à la liste de courses':'Bread only? Skip to shopping list')):undefined;
  const fillingsDoneLabel=fillingsReturn?.forward?(hasFillings?(locale==='fr'?'Liste de courses →':'Shopping list →'):bakeType==='pizza'?(locale==='fr'?'Liste de courses · pâte seule →':'Shopping list · dough only →'):(locale==='fr'?'Liste de courses · pain seul →':'Shopping list · bread only →')):fillingsReturn?(fillingsReturn.destination==='recipe'?(locale==='fr'?'Retour à la recette':'Back to Recipe'):fillingsReturn.destination==='shopping'?(locale==='fr'?'Retour aux courses':'Back to Shopping list'):fillingsReturn.destination==='service'?(locale==='fr'?'Retour à Cuisson & service':'Back to Baking & serving'):(locale==='fr'?'Retour à la préparation':'Back to Preparation')):(locale==='fr'?'Définir ma recette':'Set up my recipe');
  // Late toppings from Preparation or Baking & serving: the normal pair, the return on the left
  // ("‹ Preparation") and the shopping list on the right (16 Nov 2026 design review).
  const fillingsForward=recipeGenerated&&fillingsReturn&&!fillingsReturn.forward&&(fillingsReturn.destination==='protocol'||fillingsReturn.destination==='service')?{
    label:hasFillings?(locale==='fr'?'Liste de courses →':'Shopping list →'):bakeType==='pizza'?(locale==='fr'?'Liste de courses · pâte seule →':'Shopping list · dough only →'):(locale==='fr'?'Liste de courses · pain seul →':'Shopping list · bread only →'),
    onClick:()=>{setFillingsReturn(null);openDestination('shopping');}}:undefined;
  const setupReturnLabel=protocolStale?(locale==='fr'?'Mettre à jour la recette':'Update recipe'):fillingsReturn?fillingsDoneLabel:(locale==='fr'?'Retour à la recette':'Back to Recipe');
  const bottomNavCollapsed = false;
  const stickTop = stickyHeadH;
  const pizzaPartyEnabled = bakeType === 'pizza';
  const sandwichEnabled = bakeType === 'bread' && !!styleKey && !!sandwichFamilyForStyle(styleKey);
  useEffect(() => { if (activeTab === 'sandwiches' && !sandwichEnabled) setActiveTab('setup'); }, [activeTab, sandwichEnabled]);
  const [pizzasConfirmed, setPizzasConfirmed] = useState(false);

  // M2 — Mode chosen: false on page load, true after baker selects a mode
  const [modeChosen, setModeChosen] = useState(false);
  const [awaitingRecipeChoice, setAwaitingRecipeChoice] = useState(true);

  // Mode cards — per-card "+ details" expander (visual-first redesign)
  const [modeInfoOpen, setModeInfoOpen] = useState(false);

  // Baker profile — Mon profil sheet + new-session prefill
  const bottomNavH = useBottomNavHeight();
  const keyboardOpen = useMobileKeyboard();
  const [guideProgressTarget,setGuideProgressTarget] = useState<HTMLDivElement|null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // Simple begins with a compact equipment confirmation.
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  // Which steps carry a value the profile supplied rather than one the baker
  // chose in this session. They are marked `prefilled`, which means the page
  // still appears with the value already in place — the baker presses Suivant
  // and moves on — and the summary only fills in once they have passed it.
  const [confirmedSettings,setConfirmedSettings]=useState<string[]>([]);
  function confirmSetting(field:string,value:string|number){
    const key=field+'='+value;
    setConfirmedSettings(previous=>previous.includes(key)?previous:[...previous.filter(item=>!item.startsWith(field+'=')),key]);
  }
  function confirmed(field:string,value:string|number|null){return confirmedSettings.includes(field+'='+value);}
  const [profileFields, setProfileFields] = useState<Set<string>>(new Set());
  const markProfile = (k: string) => setProfileFields(p => p.has(k) ? p : new Set(p).add(k));
  // Bumped when a cloud profile pull settles — lets a late-arriving profile
  // prefill a bake type the baker already tapped (fresh-device login race).
  const [profilePullTick, setProfilePullTick] = useState(0);
  // Latest cloud session offered as « Reprendre » on a device with no
  // localStorage session (fresh device / cleared storage). Freshness must be
  // captured AT MOUNT: the autosave effect recreates bh_session_v1 within
  // milliseconds, so a later loadSession() check always sees a session.
  const [cloudResume, setCloudResume] = useState<BakeEvent | null>(null);
  const freshDeviceRef = useRef(false);
  const profileBlockersAppliedRef = useRef(false);

  // Custom mode — fermentation plan recommended
  const [scheduleReady, setScheduleReady] = useState(false);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Auth state
  useEffect(() => {
    const supabase = createClient();
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let uid: string | null = null;
    let dirty = false;
    // 10s debounce lets a baker set every preference in one sitting → one
    // write; the visibility/pagehide flush below guarantees nothing is lost
    // when the app is backgrounded or closed before the timer fires.
    const armPush = () => {
      if (!uid) return;
      dirty = true;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => { if (uid) { dirty = false; void pushProfile(uid); } }, 10000);
    };
    const flush = () => {
      if (!uid || !dirty) return;
      if (syncTimer) clearTimeout(syncTimer);
      dirty = false;
      void pushProfile(uid);
    };
    const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      uid = data.user?.id ?? null;
      if (uid) void pullAndMergeProfile(uid).then(() => setProfilePullTick(t => t + 1));
    });
    setProfileListener(armPush);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const newUid = session?.user?.id ?? null;
      if (newUid && newUid !== uid) void pullAndMergeProfile(newUid).then(() => setProfilePullTick(t => t + 1));
      uid = newUid;
      setProtocolStale(false);
    });
    return () => {
      subscription.unsubscribe(); setProfileListener(null);
      if (syncTimer) clearTimeout(syncTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Late profile prefill — on a fresh device the cloud profile can land
  // AFTER the baker already tapped a bake type (selectBakeType read an empty
  // loadProfile() at tap time). Fill only still-missing fields; never
  // overwrite something the baker has since chosen.
  useEffect(() => {
    if (profilePullTick === 0) return;
    if (!modeChosen || !bakeType || profilePrefilled || sessionRestored) return;
    const prof = loadProfile();
    if (!prof) return;
    let applied = false;
    const ovenPool = bakeType === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES;
    const prefOven = (bakeType === 'bread' ? prof.ovenTypeBread : prof.ovenTypePizza) ?? prof.ovenType;
    if (!ovenType && prefOven && prefOven in ovenPool) {
      setOvenType(prefOven as AnyOvenType); confirmSetting('oven',prefOven); markProfile('oven'); applied = true;
    }
    const stylePool = bakeType === 'bread' ? BREAD_STYLES : PIZZA_STYLES;
    const prefStyle = (bakeType === 'bread' ? prof.styleKeyBread : prof.styleKeyPizza) ?? prof.styleKey;
    const sdAllowed = tab === 'custom';
    if (!styleKey && prefStyle && prefStyle in stylePool
        && (sdAllowed || !isLevainStyle(prefStyle))) {
      setStyleKey(prefStyle as StyleKey); applied = true;
    }
    if (!mixerType && prof.mixerType && prof.mixerType in MIXER_TYPES) {
      setMixerType(prof.mixerType as MixerType); setWaterMethod(prof.mixerType==='spiral'?'direct':'premelt'); applied = true; markProfile('equip'); confirmSetting('mixer',prof.mixerType);
    }
    // Sourdough-native styles override the yeast preference (same rule as
    // the tap-time prefill in selectBakeType).
    const effStyle = styleKey ?? ((prefStyle && prefStyle in stylePool) ? prefStyle : null);
    const lateWantsSourdough = isLevainStyle(effStyle as string | null);
    if (!yeastType && lateWantsSourdough && sdAllowed) {
      // A sourdough-native style IS its leavening — not a stored preference,
      // a consequence of the style just chosen. It counts as answered.
      setYeastType('sourdough'); applied = true;
    } else if (!yeastType && prof.yeastType && prof.yeastType in YEAST_TYPES
        && (sdAllowed || prof.yeastType !== 'sourdough')) {
      setYeastType(prof.yeastType as YeastType); applied = true; markProfile('yeast'); confirmSetting('yeast',prof.yeastType);
    }
    if (applied) setProfilePrefilled(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePullTick]);

  // Cloud « Reprendre » — a fresh device has no localStorage session, but a
  // signed-in baker may have one in the cloud. Offer the latest generated
  // snapshot; hydrate only on tap (never surprise-restore mid-setup).
  useEffect(() => {
    if (!user) { setCloudResume(null); return; }
    if (!freshDeviceRef.current || sessionRestored || modeChosen || bakeType) return;
    let wbDismissed = false;
    try { wbDismissed = sessionStorage.getItem('bh_wb_answered') === '1'; } catch {}
    if (wbDismissed) return;
    let cancelled = false;
    void (async () => {
      try {
        const { fetchBakeEvents } = await import('../lib/supabase/fetchBakeEvents');
        const events = await fetchBakeEvents();
        const latest = events.find(e => e.dough_snapshot?.recipeGenerated);
        if (!cancelled && freshDeviceRef.current && latest) setCloudResume(latest);
      } catch { /* offline — no banner, observation only */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bakeType, modeChosen, sessionRestored]);

  // A saved session is OFFERED on mount, never applied silently.
  //
  // It used to rehydrate everything the moment the app opened. Nothing was
  // wrong with the values — ovenType, mixerType and yeastType all start as
  // null, so nothing is pre-set by code — but restored state that appears
  // without explanation is indistinguishable from the app having chosen for
  // you, and that is exactly how it was read on a device: a signed-out baker
  // finding an oven, a mixer and a ticked yeast they had never picked.
  //
  // Hold the session until the baker resumes it or starts a recoverable new bake.
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);
  const [dueEntry, setDueEntry] = useState<JournalEntry | null>(null);
  // Home: one row per bake under way, the most pressing first (17 Nov 2026 retention round 2).
  const [liveBakes, setLiveBakes] = useState<LiveJournalBake[]>([]);
  // Rows only with two or more bakes under way: one bake keeps the single Resume card, so the app looks exactly
  // as a single-bake app for a baker who never runs two (18 Nov 2026 retention round 3, owner's rule B).
  const showLiveRows = liveBakes.length > 0;
  // A setup not finished yet sits under the bakes under way, so it is not lost behind them.
  const pendingSetupRow = showLiveRows && !!pendingSession && !pendingSession.recipeGenerated && !!pendingSession.styleKey;
  // A bake that is over (baked, or three hours past its time) is offered again, not resumed.
  const pendingOver = !!pendingSession?.recipeGenerated && (!!pendingSession.bakedDone || (!!pendingSession.eatTime && +new Date(pendingSession.eatTime) + 3 * 3600000 < Date.now()));
  const pendingFinished = !dueEntry && pendingOver;
  const [localSaveConflict, setLocalSaveConflict] = useState(false);
  useEffect(() => {
    const conflict = () => setLocalSaveConflict(true);
    window.addEventListener('bh-session-conflict', conflict);
    return () => window.removeEventListener('bh-session-conflict', conflict);
  }, []);


  useEffect(() => {
    const session = loadSession();
    const entryUrl = new URL(location.href);
    if(entryUrl.searchParams.get('make')==='pizza'){
      entryUrl.searchParams.delete('make');
      history.replaceState(history.state,'',entryUrl);
      if(session?.bakeType==='pizza' && !session.recipeGenerated && !session.execution && !session.mixExecution){
        applySession(session);
        setActiveTab('batch');setBatchView('style');
      }else{
        void selectBakeType('pizza');
      }
      restoreSettledRef.current=true;
      setAuthTick(t=>t+1);
      return;
    }
    if (!session) {
      // Nothing local at mount — this is the one reliable "fresh device"
      // moment.
      //
      // The old note here said autosave would "write a default session right
      // after". It does not, and has not: useSessionSave returns early until
      // BOTH bakeType and styleKey are set (or a recipe has been generated),
      // so nothing is persisted until the baker has actually chosen something.
      // Checked rather than trusted — that stale claim is what led to reading
      // an absent chosen-flag as settled in the restore below.
      freshDeviceRef.current = true;
      restoreSettledRef.current = true;   // rien à restaurer : c'est réglé
      setAuthTick(t => t + 1);
      return;
    }
    setPendingSession(session);
    // Another bake has the step that is due: the banner offers that one (17 Nov retention review).
    try { const due = dueJournalEntry(); setDueEntry(due && due.id !== currentJournalId() ? due : null); } catch {}
    // After the bake: reopening within the evening goes straight to "How did it turn out?"; once the bake
    // is half a day past it is over, and home offers it again rather than reopening its last screen.
    const now = Date.now(), eatAt = session.eatTime ? +new Date(session.eatTime) : null;
    const ownEntry = (() => { try { const id = currentJournalId(); return id ? getJournalEntry(id) : null; } catch { return null; } })();
    const bakeOver = !!session.recipeGenerated && eatAt != null && (eatAt + 12 * 3600000 <= now || (!!ownEntry?.rating && eatAt <= now));
    const rateNow = !bakeOver && !!session.recipeGenerated && eatAt != null && eatAt + 2 * 3600000 <= now && !!ownEntry && !ownEntry.rating;
    // A reload in the middle of a generated bake is not "coming back later"
    // either. The offer-on-mount rule (above) exists so values never appear
    // that the baker did not see being chosen; here they were on screen a
    // second ago. The history entry still carries the destination the reload
    // happened on (it survives a reload; a new visit or a tap on the home
    // screen has none, or marks it as home), so the bake reopens there and
    // Back keeps replaying the earlier entries. Arrivals at the landing keep
    // the Resume card.
    const reloadedOn = (history.state as {bakerNavigation?: {home?: boolean; family?: string | null; route?: string; view?: string; simpleStep?: number; customStep?: number; overview?: boolean}} | null)?.bakerNavigation;
    const reloadedMidBake = !bakeOver && !!session.recipeGenerated && !!reloadedOn && !reloadedOn.home && reloadedOn.family === session.bakeType;
    if (rateNow && !readAuthIntent()) {
      acceptCurrentSessionStorage(); answerWelcomeBack();
      applySession(session);
      setServiceView('dough'); openDestination('service');
      setJournalRequest(v => v + 1);
      restoreSettledRef.current = true;
      setAuthTick(t => t + 1);
      return;
    }
    // Revenir d'une connexion n'est pas « revenir plus tard ». Le baker était
    // au milieu de quelque chose il y a dix secondes : on le remet où il
    // était au lieu de lui proposer de reprendre ce qu'il n'a jamais quitté.
    if (readAuthIntent() || sessionStorage.getItem('bh_locale_resume') || reloadedMidBake) {
      if (reloadedMidBake) { acceptCurrentSessionStorage(); answerWelcomeBack(); }
      applySession(session);
      if (reloadedMidBake && reloadedOn) {
        if (reloadedOn.route) setActiveTab(reloadedOn.route as typeof activeTab);
        if (reloadedOn.view) setBatchView(reloadedOn.view as typeof batchView);
        if (typeof reloadedOn.simpleStep === 'number') setActiveStep(reloadedOn.simpleStep);
        if (typeof reloadedOn.customStep === 'number') setAdvancedStep(reloadedOn.customStep);
        setSetupOverview(!!reloadedOn.overview);
        // A tab reopened the next day keeps its history entry and reads as a reload: once the session is more than
        // 30 minutes old it is a return, and the bake opens at its due step as Resume does (20 Nov 2026 retention
        // round 5, Maya: Friday's mix time reopened on Thursday's Shopping list under a "Time to mix" card).
        if (now - (session.savedAt ?? now) > 30 * 60000) resumeToNow.current = true;
      }
      restoreSettledRef.current = true;
      setAuthTick(t => t + 1);
    }
    else setShowWelcomeBack(true);
  }, []);

  // La restauration ne se termine que quand la soiree pizza est arrivee.
  // Rendre la main avant, c'est laisser l'autosave photographier un etat
  // a moitie restaure et l'ecrire par-dessus la vraie session.
  function endRestore() {
    if (partyHydratingRef.current) return;
    if (!isRestoringRef.current) return;
    isRestoringRef.current = false;
    if (restoredInputsPending.current) { restoredInputsPending.current = false; generatedRecipeInputKey.current = previousRecipeInputKey.current; }
    setScheduleRestoreRevision(value => value + 1);
  }

  function applySession(session: SessionData) {
    isRestoringRef.current = true;
    try { setJournalId(session.recipeGenerated ? currentJournalId() : null); } catch {}
    // The restored bake's own inputs are its generated recipe: a later edit is compared with them, never
    // with the bake that was on screen before (a confirmation read as "You changed your choices").
    generatedRecipeInputKey.current = null; restoredInputsPending.current = true;
    setScheduleCandidateValid(true);

    const restoredEatTimeIsPast = session.eatTime
      ? new Date(session.eatTime) < new Date()
      : false;
    if (restoredEatTimeIsPast && !session.recipeGenerated) {
      // Not a generated session — wipe schedule times, keep all other settings
      session.eatTime = null;
      session.startTime = null;
      session.timingOverrides = {};
      session.blocks = [];
    }
    // Generated sessions with past bake times are kept as historical record

    setConfirmedSettings((session.confirmedSettings ?? []).filter(item=>typeof item==='string'));
    setTab(session.tab as 'simple' | 'custom');
    setBakeType(session.bakeType as BakeType | null);
    setBakeName(session.bakeName ?? '');
    setSandwichParty(normalizeSandwichSnapshot(session.sandwichParty));
    setStyleKey(session.styleKey as StyleKey | null);
    setNumItems(session.numItems);
    const wb = getWeightBounds(session.styleKey as string | null, session.bakeType as string | null);
    setItemWeight(session.bakeType==='bread'&&normalizeFlourTarget(session.totalFlourTarget)!==undefined ? session.itemWeight : Math.max(wb.min, Math.min(wb.max, session.itemWeight)));
    setTotalFlourTarget(session.bakeType==='bread' ? normalizeFlourTarget(session.totalFlourTarget) : undefined);
    setPizzaDiameter(session.pizzaDiameter);
    setOvenType(session.ovenType as AnyOvenType | null);
    setOvenConstruction(session.ovenConstruction ?? 'tabletop');
    setMixerType(session.mixerType as MixerType | null);
    setYeastType(session.yeastType as YeastType | null);
    setKitchenTemp(session.kitchenTemp);
    setCustomKitchenConfirmed(session.customKitchenConfirmed ?? true);
    setHumidity(session.humidity);
    setFridgeTemp(session.fridgeTemp); setWaterSource(['room','fridge','tap','measured'].includes(session.waterSource ?? '') ? session.waterSource! : 'room'); setMeasuredWaterTemp(session.measuredWaterTemp); setWaterMethod(session.waterMethod ?? (session.mixerType==='spiral'?'direct':'premelt')); setSpiralIceConfirmed(session.spiralIceConfirmed ?? false); setMixingBatches(normalizeMixingBatches(session.mixingBatches)); setCustomMixerCapacityG(session.mixerCapacityG); setResultNotes((session.resultNotes ?? '')); setPreviousNote(session.previousNote ?? ''); setPreheatExtraMin(Math.max(0, Math.min(120, session.preheatExtraMin ?? 0))); setExitLead(normalizeExitLead(session.exitLead)); setContainerCapacityLitres(session.containerCapacityLitres);
    if (session.flourBlend) setFlourBlend(session.flourBlend as FlourBlend);
    setPrefermentType(session.prefermentType as PrefermentType);
    // Absent means UNSETTLED, not settled. The `?? true` this replaces was
    // written for sessions saved before these flags existed. A session is only
    // ever written once a bake type and style are chosen, so it is a real
    // session — but it carries the untouched code defaults for Quantity,
    // Flour and Preferment alongside them, and the backfill turned those into
    // "the baker chose this" on the next launch. A signed-out baker restarted the app and found Quantity,
    // Flour and Preferment already in the rail reading 4/10 SET, none of which
    // they had ever touched. That is exactly the fabricated history the flags
    // exist to prevent.
    //
    // A preset comes from the profile of a signed-in baker, or from the baker's
    // own tap. Never from storage. Sessions written since the flags landed
    // carry the real value; older ones correct themselves on first touch.
    setQtyChosen(session.qtyChosen ?? false);
    setFlourChosen(session.flourChosen ?? false);
    setPrefermentChosen(session.prefermentChosen ?? false);
    setPrefermentFlourPct(session.prefermentFlourPct);
    setPrefOffsetH(session.prefOffsetH);
    setPrefGoesInFridgeState(session.prefGoesInFridge ?? true);
    setPoolishStorage(session.poolishStorage ?? 'auto');
    setBigaStorage(session.bigaStorage ?? 'auto');
    setTimingOverrides(normalizeTimingOverrides(session.timingOverrides));
    setStarterRecoveryPending(session.starterRecoveryPending===true);setStarterFeedRecords(normalizeStarterFeedRecords(session.starterFeedRecords));setExecution(normalizeBakeExecution(session.execution));setMixExecution(normalizeMixExecution(session.mixExecution));setReplanRequested(false);
    setManualHydration(session.manualHydration);
    setManualOil(session.manualOil);
    setManualSugar(session.manualSugar);
    setManualSalt(session.manualSalt);
    setYeastPctOverride(session.yeastPctOverride);
    setPrefYeastOverride(normalizePrefYeastOverride(session.prefYeastOverride));setPrefYeastIssue(null);
    setEntryNightKept(normalizeEntryNightKept(session.entryNightKept));
    setAcceptedPlan(normalizeAcceptedPlan(session.acceptedStartTime, session.acceptedPreparationAt, session.acceptedEatTime));
    setStarterPctOverride(session.starterPctOverride);
    setAutoStarterPct(session.autoStarterPct);
    setTargetDoughTemp(session.targetDoughTemp);
    setFlourInFridge(session.flourInFridge);
    setMeasuredFlourTemp(session.measuredFlourTemp); setMeasuredPrefermentTemp(session.measuredPrefermentTemp);
    setAddSeeds(session.addSeeds ?? false);
    setWastePct(restoredWastePct(session.wastePct));
    setPriorityOverride(session.priorityOverride);
    if (session.eatTime) setEatTime(new Date(session.eatTime));
    if (session.startTime) setStartTime(new Date(session.startTime));
    if (session.blocks && session.blocks.length > 0) {
      setBlocks(session.blocks.map((b: unknown) => {
        const block = b as { label: string; from: number; to: number; fridgeRemoval?: unknown; coveredActions?: unknown; bakeFromFridge?: unknown; shortWarmup?: unknown };
        return { label: block.label, from: new Date(block.from), to: new Date(block.to), coveredActions:normalizeCoveredActions(block.coveredActions), fridgeRemoval: normalizeFridgeRemoval(block.fridgeRemoval), ...(typeof block.bakeFromFridge==='number'&&Number.isFinite(block.bakeFromFridge)?{bakeFromFridge:block.bakeFromFridge}:{}), ...(typeof block.shortWarmup==='number'&&Number.isFinite(block.shortWarmup)?{shortWarmup:block.shortWarmup}:{}) };
      }));
    }
    setStarterEvents(restoreStarterEvents(session.starterEvents));
    setRecipeGenerated(session.recipeGenerated);
    setProtocolStale(session.protocolStale === true);
    setExecutionClash(session.executionClash === true);
    setModeChosen(session.modeChosen);
    setAwaitingRecipeChoice(session.awaitingRecipeChoice ?? !session.modeChosen);
    setCustomBakeQuestion(session.customBakeQuestion === true);

    // Prefer what was stored; fall back to the end for older snapshots that
    // predate the field, because a generated recipe is itself proof that every
    // input had a value — you cannot reach one otherwise.
    const restoredHighest = typeof session.highestStep === 'number'
      ? session.highestStep : (session.recipeGenerated ? 99 : 1);
    const restoredAdvHighest = typeof session.advancedHighestStep === 'number'
      ? session.advancedHighestStep : (session.recipeGenerated ? 99 : 1);
    setHighestStep(restoredHighest);
    setAdvancedHighestStep(restoredAdvHighest);

    if (session.pizzaPartyTab && ['pick', 'shop', 'prep', 'bake'].includes(session.pizzaPartyTab))
      setPizzaPartyTab(session.pizzaPartyTab as 'pick' | 'shop' | 'prep' | 'bake');
    if (session.recipeGenerated) {
      setActiveTab(session.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty' | 'sandwiches');
      if (session.tab === 'custom') {
        setAdvancedStep(99);
      } else {
        setActiveStep(99);
      }
      setShowResults(true);
    } else {
      const companionTab = session.bakeType === 'pizza' ? 'pizzaparty' : 'sandwiches';
      setActiveTab(session.activeTab === companionTab && (session.bakeType === 'pizza' || !!session.styleKey && !!sandwichFamilyForStyle(session.styleKey)) ? companionTab : 'setup');
      if (session.tab === 'custom') {
        setAdvancedStep(session.styleKey ? (session.ovenType ? 3 : 2) : 1);
      } else {
        setActiveStep(session.styleKey ? (session.ovenType ? 3 : 2) : 1);
      }
    }

    if (session.pizzaParty?.shopTicks) {
      try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(session.pizzaParty.shopTicks)); } catch {}
    }
    if (session.pizzaParty?.prepTicks) {
      try { localStorage.setItem('bh_prep_ticks_v1', JSON.stringify(session.pizzaParty.prepTicks)); } catch {}
    }
    if (session.pizzaParty?.qtys) {
      partyHydratingRef.current = true;
      const rawQtys = session.pizzaParty.qtys;
      // Lazy — keeps the 150-pizza database out of the first-load bundle
      void import('../lib/toppingDatabase').then(({ getPizzaById }) => {
        const validQtys: Record<string, number> = {};
        Object.entries(rawQtys).forEach(([id, qty]) => {
          if (getPizzaById(id)) validQtys[id] = qty as number;
        });
        setPizzaPartyQtys(validQtys);
        setPartyRestoreToken(v => v + 1);
        partyHydratingRef.current = false;
        endRestore();
      }).catch(() => { partyHydratingRef.current = false; endRestore(); });
    }
    if (session.bakedDone) setBakedDone(true);
    if (session.starterState) setStarterState(session.starterState as 'rt_fed' | 'fridge_unfed' | 'fridge_fed');
    if (session.starterLocation) setStarterLocation(session.starterLocation as 'rt' | 'fridge');
    setStarterTimingValid(session.starterTimingValid !== false);
    if (session.planningMode) setPlanningMode(session.planningMode as 'last_fed' | 'know_peak');
    if (session.lastFedTime) setLastFedTime(new Date(session.lastFedTime));
    if (session.knownPeakTime) setKnownPeakTime(new Date(session.knownPeakTime));
    if (session.hasNotFedYet !== undefined) setHasNotFedYet(session.hasNotFedYet ?? null);
    if (session.simpleStarterAnswer !== undefined) setSimpleStarterAnswer(session.simpleStarterAnswer ?? null);
    if (session.lastFedAge !== undefined) setLastFedAge((session.lastFedAge as 'today'|'yesterday'|'days23'|'days45'|'week'|null) ?? null);
    // Stage 1: support both new and legacy key names
    const _lfr = session.lastFeedRatio ?? session.feedRatio;
    if (_lfr) setLastFeedRatio(_lfr as 1 | 2 | 4 | 5 | 10);
    const _nfr = session.nextFeedRatio ?? session.lastFeedRatio ?? session.feedRatio;
    if (_nfr) setNextFeedRatio(_nfr as 1 | 2 | 4 | 5 | 10);
    if (session.nextFeedRatioOverride !== undefined) {
      setNextFeedRatioOverride(session.nextFeedRatioOverride as 1 | 2 | 4 | 5 | 10 | null);
    }
    if (session.ratioMode === 'keep' || session.ratioMode === 'recommend') {
      setRatioMode(session.ratioMode);
    }
    if (session.starterMature !== undefined) setStarterMature(Boolean(session.starterMature));
    if (session.starterHasRye !== undefined) setStarterHasRye(Boolean(session.starterHasRye));
    if (session.tang) setTang(session.tang as 'mild' | 'balanced' | 'tangy');
    if (session.fridgeOutTime) setFridgeOutTime(new Date(session.fridgeOutTime));
    if (session.usingPeak2 !== undefined) setUsingPeak2(Boolean(session.usingPeak2));
    if (session.feed2Time) setFeed2Time(new Date(session.feed2Time));
    if (session.starterFridgeInTime) setStarterFridgeInTime(new Date(session.starterFridgeInTime));
    setSessionRestored(true);
    setReviewMode(true);
    setActiveStep(session.activeStep ?? 99);
    setAdvancedStep(session.advancedStep ?? 99);
    setSetupOverview(session.setupOverview ?? false);
    if (session.activeTab === 'pizzaparty') {
      setActiveTab('pizzaparty');
      if (session.pizzaPartyTab) setPizzaPartyTab(session.pizzaPartyTab as 'pick'|'shop'|'prep'|'bake');
    }
    restoreNavigation(session);
    try {
      const resume = JSON.parse(sessionStorage.getItem('bh_locale_resume') || 'null');
      if (resume) {
        setActiveStep(resume.activeStep);
        setAdvancedStep(resume.advancedStep);
        setSetupOverview(!!resume.setupOverview);
        if (resume.activeTab) {const route=restoredBakeRoute({...session,...resume},session.bakeType==='pizza'||!!session.styleKey&&!!sandwichFamilyForStyle(session.styleKey));setActiveTab(route.route);setBatchView(route.memory.batchView??'style');setProtocolView(route.memory.protocolView??'dough');setServiceView(route.memory.serviceView??'dough');setFillingsReturn(route.memory.returnTo??null);setPrepReturnToService(route.memory.prepReturnToService??null);setShoppingReturnToFillings(route.memory.shoppingReturnToFillings??false);}
        if (resume.pizzaPartyTab) setPizzaPartyTab(resume.pizzaPartyTab);
        setReviewMode(!!resume.reviewMode);
        sessionStorage.removeItem('bh_locale_resume');
      }
    } catch {}
    // Toast respawned on every reload/locale switch until acted on —
    // once dismissed/answered in this browser session, stay quiet.
    setShowWelcomeBack(false);
    setPendingSession(null);
    setTimeout(endRestore, 200);
  }

  // Bake again with fewer pizzas: the carried picks follow the new quantity (20 Nov 2026 round 6, Maya).
  useEffect(() => {
    if (isRestoringRef.current || !carriedPicks || recipeGenerated || bakeType !== 'pizza') return;
    const scaled = scalePicks(pizzaPartyQtys, numItems);
    if (scaled !== pizzaPartyQtys) { setPizzaPartyQtys(scaled); setPartyRestoreToken(v => v + 1); }
  }, [numItems, recipeGenerated, carriedPicks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (recipeGenerated) setCarriedPicks(false); }, [recipeGenerated]);
  useEffect(() => { if (recipeGenerated) setQuickRebake(false); }, [recipeGenerated]); // eslint-disable-line react-hooks/exhaustive-deps
  // Every chosen pizza baked is the bake done: the bar leaves "Now: Bake the pizzas" (20 Nov 2026 round 6, Wei Ling).
  useEffect(() => {
    if (isRestoringRef.current || bakedDone || !recipeGenerated) return;
    if (allPicksBaked(pizzaPartyQtys, bakedPartyQtys)) setBakedDone(true);
  }, [bakedPartyQtys]); // eslint-disable-line react-hooks/exhaustive-deps
  // Past bake: home offers it again rather than resuming a finished night (retention review).
  function bakePendingAgain() {
    const s = loadSession();
    acceptCurrentSessionStorage();
    answerWelcomeBack();
    if (!s) return;
    try { const id = currentJournalId(); pendingPreviousNote.current = (id && getJournalEntry(id)?.note.trim()) || ''; } catch {}
    void restoreFromBakeEvent({ id: '', dough_snapshot: s, pizza_party_id: null }, { rebake: true }).then(ok => { if (ok) { try { forgetCurrentJournalBake(); } catch {} } });
  }
  // Resume closes the offer and silences account suggestions for this visit.
  function answerWelcomeBack() {
    try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
    setShowWelcomeBack(false);
    setPendingSession(null);
  }

  // Set protocolStale when config changes after recipe generated.
  // Skip the first mount invocation — initial state is not a user change.
  // Starter choices below come from user controls. Do not include solver outputs
  // (nextFeedRatio, events, peak or validity): planner initialization can refresh
  // those without changing a restored, already validated recipe.
  const recipeInputKey = JSON.stringify([bakeType,styleKey,numItems,itemWeight,totalFlourTarget,ovenType,ovenConstruction,mixerType,customMixerCapacityG,mixingBatches,yeastType,kitchenTemp,humidity,fridgeTemp,manualHydration,manualOil,manualSugar,manualSalt,flourChosen?flourBlend:null,prefermentType,prefermentType!=='none'?(prefermentFlourPct??20):prefermentFlourPct,targetDoughTemp,flourInFridge,measuredFlourTemp,measuredPrefermentTemp,wasteAllowance,addSeeds,priorityOverride,yeastPctOverride,prefYeastOverride,starterPctOverride,autoStarterPct,starterState,starterLocation,planningMode,lastFedTime?.getTime()??null,knownPeakTime?.getTime()??null,hasNotFedYet,lastFedAge,lastFeedRatio,nextFeedRatioOverride,ratioMode,tang,
    // Round 9 (bug B): where the poolish or biga ripens changes the recipe; appended so the stale card's indices hold.
    prefermentType==='poolish'?poolishStorage:null,prefermentType==='biga'?bigaStorage:null]);
  const previousRecipeInputKey = useRef(recipeInputKey);
  const generatedRecipeInputKey = useRef<string | null>(null);
  const confirmationAt = useRef(0);
  const restoredInputsPending = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const changed = previousRecipeInputKey.current !== recipeInputKey;
    previousRecipeInputKey.current = recipeInputKey;
    if (isRestoringRef.current) return;
    if (recipeGenerated && generatedRecipeInputKey.current === null) generatedRecipeInputKey.current = previousRecipeInputKey.current;
    // Confirming what happened (mixed, fed, made the poolish) is not a change of choices:
    // the recipe follows it without a "You changed your choices" card (17 Nov retention review).
    if (changed && recipeGenerated && (()=>{try{return Date.now()-confirmationAt.current<3000;}catch{return false;}})()) { generatedRecipeInputKey.current = recipeInputKey; return; }
    if (changed && recipeGenerated) {
      setProtocolStale(generatedRecipeInputKey.current !== recipeInputKey);
    }
  }, [recipeInputKey, recipeGenerated]);

  // Pain au levain: sourdough is the only sensible yeast — auto-confirm after
  // a beat instead of demanding a tap; the step summary's Edit is the undo.
  useEffect(() => {
    if (reviewMode || isRestoringRef.current) return;
    if ((styleKey === 'pain_levain' || styleKey === 'pain_seigle') && yeastType === 'sourdough' && advancedStep === 7 && prefermentType !== 'levain') {
      // Sourdough forces levain and hides the preferment step; advanceAdv now
      // skips it, so Suivant reaches the plan by itself. The page no longer
      // flips on its own — only the state it depends on is set.
      const tmr = setTimeout(() => setPrefermentType('levain'), 400);
      return () => clearTimeout(tmr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey, yeastType, advancedStep, prefermentType, reviewMode]);

  // Perceived-speed: once a pizza session is underway, warm the party chunk
  // (and its 150-pizza database) during browser idle time — downloaded in the
  // background, instant when the baker opens Ma Pizza Party. Not on boot
  // (too early), not on tab tap (too late).
  useEffect(() => {
    if (bakeType !== 'pizza' || !modeChosen) return;
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;
    const warm = () => {
      // Optional preload may be interrupted by navigation/reload. The real
      // screen loader still owns reporting errors when it is opened.
      void import('../components/PizzaParty').catch(() => {});
    };
    if (w.requestIdleCallback) idleId = w.requestIdleCallback(warm);
    else timer = setTimeout(warm, 1500);
    return () => { if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId); if (timer) clearTimeout(timer); };
  }, [bakeType, modeChosen]);

  // Baker profile — standard blockers (sleep / work) applied once per fresh
  // session as soon as a bake time exists. Restored sessions keep their own.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isRestoringRef.current || sessionRestored) return;
    if (!eatTime || profileBlockersAppliedRef.current) return;
    if (blocks.length > 0) { profileBlockersAppliedRef.current = true; return; }
    const bl = loadProfile()?.blockers ?? DEFAULT_BLOCKERS;
    if (!bl || (!bl.sleep.enabled && !bl.work.enabled)) return;
    profileBlockersAppliedRef.current = true;
    const out = profileBlocksForBake(new Date(),eatTime,bl);
    if (out.length) setBlocks(out);
  }, [eatTime]);

  // Nav #1 — after an upstream edit (single-tap choices) with a plan already
  // Changing a setting keeps the baker on the current step.
  useEffect(() => {
    setScheduleReady(false);
  }, [bakeType, styleKey]);

  // Auto-select sourdough for pain au levain when no yeast type is set yet.
  // Do NOT advance advancedHighestStep here — baker must still navigate
  // through climate, oven, mixer, flour steps. The Max(s, 9) call fires
  // correctly in the YeastHelper onSelect handler after all steps are done.
  useEffect(() => {
    if (tab !== 'custom' || !isLevainStyle(styleKey) || execution || mixExecution) return;
    if (yeastType !== 'sourdough') setYeastType('sourdough');
    if (prefermentType !== 'levain') setPrefermentType('levain');
    if (!prefermentChosen) setPrefermentChosen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey, tab]);

  useEffect(() => {
    // Only correct the untouched DEFAULT flour when the baker switches bake
    // type — never overwrite a deliberate selection. The saved chosen flag
    // also covers unbranded flour types; brandProduct protects older saves.
    // Without this guard,
    // any remount that restores a bread session where the user had picked
    // T80 (whose internal base key is 'pizza00', same as the pizza default)
    // looked identical to the untouched default and got reset to T65.
    if (flourChosen || flourBlend.brandProduct) return;
    if (bakeType === 'bread' && flourBlend.flour1 === 'pizza00') {
      setFlourBlend({ flour1: 'bread', flour2: null, ratio1: 100 });
    }
    if (bakeType === 'pizza' && flourBlend.flour1 === 'bread') {
      setFlourBlend({ flour1: 'pizza00', flour2: null, ratio1: 100 });
    }
  }, [bakeType]);

  useEffect(() => {
    if (!breadProtocol) { if (bakeType === 'bread' && styleKey && ovenType === 'griddle') setOvenType(null); return; }
    if (ovenType && !breadProtocol.equipment.includes(ovenType)) setOvenType(null);
    if (mixerType && !breadProtocol.supportedMixers.includes(mixerType)) setMixerType(null);
    if (isUnleavened) {
      if (yeastType !== 'instant') setYeastType('instant');
      if (prefermentType !== 'none') setPrefermentType('none');
      setPrefermentChosen(true);
      if (activeStep === 6) setActiveStep(7);
      if (advancedStep === 7 || advancedStep === 8) setAdvancedStep(9);
    }
  }, [styleKey, ovenType, mixerType, isUnleavened, yeastType, prefermentType, activeStep, advancedStep]);

  useEffect(() => {
    // Old saved climate/yeast pages now belong to the compact kitchen page.
    if (tab === 'simple' && (activeStep === 4 || activeStep === 6)) setActiveStep(3);
  }, [tab, activeStep]);

  // A fixed direct method is part of the formula, not a question for the baker.
  // Also normalise restored sessions and upstream style changes so a hidden
  // preferment cannot keep an old poolish/biga or block recipe generation.
  useEffect(() => {
    if (!directMethodOnly) return;
    if (prefermentType !== 'none') setPrefermentType('none');
    if (!prefermentChosen) setPrefermentChosen(true);
    if (prefOffsetH !== 0) setPrefOffsetH(0);
    if (advancedStep === 8) setAdvancedStep(9);
  }, [directMethodOnly, prefermentType, prefermentChosen, prefOffsetH, advancedStep]);

  // The recipe was made with this preferment and this yeast, defaulted or chosen: after Customize in place
  // the Preferment and Yeast steps show them selected, and their buttons are never disabled for a choice the
  // recipe already has (22 Nov 2026 round 9 E, owner decision 5). Unanswered, Update recipe walked the bake
  // time and then "Which preferment?" with nothing selected. A bake restored in that state heals here.
  function adoptRecipeMethod() {
    if (!recipeGenerated) return;
    if (!prefermentChosen) setPrefermentChosen(true);
    if (yeastType && yeastType !== 'sourdough') confirmSetting('yeast', yeastType);
  }
  useEffect(() => {
    if (tab !== 'custom' || !recipeGenerated || execution || mixExecution) return;
    if (!prefermentChosen || (yeastType && yeastType !== 'sourdough' && !confirmedSettings.some(item => item.startsWith('yeast=')))) adoptRecipeMethod();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, recipeGenerated, prefermentChosen, yeastType, confirmedSettings]);

  const weightBounds = getWeightBounds(styleKey, bakeType);

  // ── Computed ──────────────────────────────
  const ovenData = ovenType
    ? bakeType === 'bread'
      ? BREAD_OVEN_TYPES[ovenType as BreadOvenType]
      : OVEN_TYPES[ovenType as OvenType]
    : undefined;
  const basePreheatMin = bakeType === 'bread' ? leanBreadPreheatMin(styleKey ?? undefined, ovenType ?? undefined, ovenData?.preheatMin ?? 30) : ovenData?.preheatMin ?? 30;
  // A longer preheat the baker chose on the plan (after "more preheat" last time): only ever longer.
  // It moves the Preheat step alone: the dough's times are planned with the oven's own preheat
  // (planPreheatMin), so a longer preheat never lengthens the final rise (18 Nov 2026 retention
  // round 4, Maya: preheat 7:00 → 6:30 moved the take-out 5:30 → 5:00 at 30 °C).
  const preheatMin = basePreheatMin + preheatExtraMin;
  const planPreheatMin = basePreheatMin;
  // Bake again's fridge-exit lead; `exitLeadMin` below is what every schedule is built with (an entered yeast's fit wins).
  const exitLeadOnly = exitLeadFor(exitLead, kitchenTemp, styleKey);
  // One trip to the fridge (buildSchedule planLadder): every kitchen in Simple, hot kitchens in Custom (owner,
  // 21 Nov 2026), none for a bake under way kept as it was made (hotPlanRules.ts). Every planner gets the same.
  const planLadder: PlanLadder = tab === 'simple' ? 'all' : 'hot';

  const hasNightBlocker = blocks.some(b =>
    b.label.toLowerCase().includes('night') || b.from.getHours() >= 22 || b.to.getHours() <= 7
  );

  const feedToMixH = useMemo(() => {
    if (yeastType !== 'sourdough' || !startTime) return undefined;
    return starterFeedToMixHours(starterEvents, startTime, feedTime ?? lastFedTime);
  }, [yeastType, feedTime, lastFedTime, startTime, starterEvents]);

  // Starter temperature at mixing, for the water calculation. A starter that comes out of
  // the fridge and goes into the dough without another feed has only warmed for the time
  // between its removal and mixing; a fed starter is at room temperature. A temperature
  // the baker measured always wins (Fine-tune).
  const prefTempForBalance = useMemo(() => {
    if (typeof measuredPrefermentTemp === 'number' && Number.isFinite(measuredPrefermentTemp)) return measuredPrefermentTemp;
    if (yeastType !== 'sourdough' || starterLocation !== 'fridge') return undefined;
    const mix = +startTime;
    const last = [...starterEvents].filter(e => +new Date(e.time) <= mix + 60000)
      .sort((a, b) => +new Date(a.time) - +new Date(b.time))
      .filter(e => ['fridge_out','fridge_in','refresh','intermediate_refresh','pre_mix','last_fed'].includes(e.kind)).at(-1);
    if (last?.kind !== 'fridge_out') return undefined;
    const outH = Math.max(0, (mix - +new Date(last.time)) / 3600000);
    // About a fifth of the dough's flour as starter; the warm-up curve is not sensitive to the exact mass.
    const starterMassG = Math.max(50, numItems * itemWeight * 0.11);
    return Math.round(prefTempAfterWarmup(starterMassG, 100, fridgeTemp, kitchenTemp, outH) * 10) / 10;
  }, [measuredPrefermentTemp, yeastType, starterLocation, startTime, starterEvents, numItems, itemWeight, fridgeTemp, kitchenTemp]);

  // One recipe for both views: the override applies wherever the recipe is shown.
  // With a poolish or biga it is the final dough's own yeast (round 7).
  const yeastEntryMethod = prefermentType === 'none' || prefermentType === 'poolish' || prefermentType === 'biga';
  const effectiveYeastOverride = !!yeastType && yeastType !== 'sourdough' && yeastEntryMethod ? yeastPctOverride : undefined;
  // The preferment's own yeast (round 7): the entered amount for this preferment, applied only while a
  // window holds it (prefermentYeast.ts), so no plan is ever timed for another amount than the one shown.
  const prefYeastCtx = (type: FlourPreferment, inFridge: boolean) => {
    const thermal = { prefermentType: type, prefInFridge: inFridge, styleKey: styleKey ?? 'neapolitan', kitchenTemp, fridgeTemp, mixerType: (mixerType ?? 'hand') as MixerType, targetDoughTemp,
      prefermentFlourPct: prefermentFlourPct ?? 20, doughMassG: numItems * itemWeight, hydrationPct: manualHydration ?? (styleKey ? ALL_STYLES[styleKey].hydration : undefined),
      flourTempC: measuredFlourTemp ?? (flourInFridge ? fridgeTemp : kitchenTemp) };
    return { kitchenTemp, fridgeTemp, massG: prefermentMassG(type, thermal.doughMassG, thermal.hydrationPct, thermal.prefermentFlourPct),
      warmupH: requiredPrefWarmupH(thermal), cooldownH: requiredPrefCooldownH(thermal) };
  };
  const prefYeastFit = (type: FlourPreferment, pct: number, availableH = Infinity) => {
    // prefGoesInFridge is declared further down (a TDZ here): its own rule, from the same state.
    const storages = prefermentYeastStorages(type, type === 'poolish' ? poolishStorage : bigaStorage === 'cool' ? 'room' : bigaStorage, type === 'biga' || prefGoesInFridgeState, bigaCoolOffered(bigaStorage, kitchenTemp));
    // Each storage reads its own path (warm-up after the fridge, or a chill before the mix).
    for (const inFridge of storages) { const fit = choosePrefermentYeastTiming(type, pct, [inFridge], prefYeastCtx(type, inFridge), availableH); if (fit.fits) return fit; }
    return choosePrefermentYeastTiming(type, pct, storages, prefYeastCtx(type, storages[0]), availableH);
  };
  const enteredPrefYeast = !!yeastType && yeastType !== 'sourdough' && prefYeastOverride && prefYeastOverride.type === prefermentType ? prefYeastOverride : undefined;
  const effectivePrefYeastOverride = enteredPrefYeast && prefYeastFit(enteredPrefYeast.type, enteredPrefYeast.pct).fits ? enteredPrefYeast.pct : undefined;
  // Never an entered amount shown beside a recipe that uses another (round 9, bug B): one that no longer has a window
  // is cleared, visibly. A made preferment keeps what was weighed.
  const prefYeastStale = !!enteredPrefYeast && effectivePrefYeastOverride === undefined && !execution && !mixExecution;
  useEffect(() => {
    if (!prefYeastStale || isRestoringRef.current || !enteredPrefYeast) return;
    setPrefYeastCleared({type: enteredPrefYeast.type, idyPct: enteredPrefYeast.pct});setPrefYeastOverride(undefined);setPrefYeastIssue(null);setPlanReplanPending(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefYeastStale]);
  // A typed amount that was not applied keeps Fine-tune from moving on as if it had been.
  const yeastEntryBlocked = (!!yeastEntryIssue && !!eatTime && yeastEntryIssue.bakeAt === +eatTime && !!yeastType && yeastType !== 'sourdough' && yeastEntryMethod)
    || (!!prefYeastIssue && prefYeastIssue.type === prefermentType);
  // The levain % every consumer uses: the baker's, else the planner's raise, else the default.
  const effectiveStarterOverride = yeastType === 'sourdough' ? starterPctOverride ?? autoStarterPct : undefined;
  // One multiplier, used by every schedule build and the sourdough solver alike.
  // The blend the recipe uses (a blend style's own flours until the baker chooses one).
  // Customize after a Simple recipe keeps the flour that recipe was made with (the style's
  // default, unnamed) as the answer: Update recipe does not send the baker to Flour, and the
  // recipe keeps its numbers (18 Nov 2026 retention round 4: 77 % → 78 % water, starter
  // 110 → 100 g once a flour was asked for). Choosing a flour still changes them, by choice.
  const flourAnswered = flourChosen || confirmed('flour','recipe');
  const flourStrength = recipeFlourStrength(styleKey ?? '', 'custom', flourChosen ? flourBlend : undefined);
  const levainBulkFactor = starterBulkFactor(effectiveStarterOverride, kitchenTemp);
  const handleAutoStarterPct = React.useCallback((pct: number | null) => setAutoStarterPct(pct ?? undefined), []);
  /** `auto`: the calculated recipe for that plan (no entered amount; the preferment's hours given), round 15 (O2). */
  const recipeForSchedule = (schedule: ReturnType<typeof buildSchedule>, auto?: {prefHours: number}) => {
    if(!styleKey || !yeastType)throw new Error("Recipe setup incomplete");
    return calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom',
        mixerType as MixerType,
        manualHydration, manualOil, manualSugar, flourChosen ? flourBlend : undefined, prefermentType, priorityOverride,
        prefermentFlourPct ?? (
          prefermentType === 'levain'
            // Levain/sourdough has its own sane range (15-30%, data.ts) —
            // the poolish/biga timing-based schedule below doesn't apply to
            // it and was pushing short-window plans up to 45% starter.
            ? undefined
            : 20
        ),
        manualSalt,
        targetDoughTemp,
        flourInFridge,
        wasteAllowance,
        prefGoesInFridge,
        feedToMixH,
        prefermentType !== 'none' && prefermentType !== 'levain' && (auto ? auto.prefHours : prefOffsetH) > 0 ? (auto ? auto.prefHours : prefOffsetH) : undefined,
        measuredFlourTemp, prefTempForBalance, totalFlourTarget, auto ? undefined : effectiveYeastOverride, effectiveStarterOverride, auto ? undefined : effectivePrefYeastOverride,
      );
  };
  // The planner's poolish levers judge a candidate by the recipe it would show: true when that
  // recipe's poolish is near its peak at the mix (data.ts poolishPeakAtMix, `pastPeak` unset).
  const poolishPeakAtMix = React.useMemo(() => prefermentType === 'poolish' && yeastType && yeastType !== 'sourdough' && styleKey && ovenType && mixerType
    ? (plan: ReturnType<typeof buildSchedule>, prefHours: number, inFridge: boolean) => {
      try {
        const r = calculateRecipe(styleKey, ovenType as OvenType, numItems, itemWeight, kitchenTemp, humidity, plan, fridgeTemp, yeastType, 'custom',
          mixerType as MixerType, manualHydration, manualOil, manualSugar, flourChosen ? flourBlend : undefined, 'poolish', priorityOverride,
          prefermentFlourPct ?? 20, manualSalt, targetDoughTemp, flourInFridge, wasteAllowance, inFridge, feedToMixH, prefHours > 0 ? prefHours : undefined,
          measuredFlourTemp, prefTempForBalance, totalFlourTarget);
        return !r.preferment?.pastPeak;
      } catch { return true; }
    } : undefined,
  [prefermentType, yeastType, styleKey, ovenType, mixerType, numItems, itemWeight, kitchenTemp, humidity, fridgeTemp, manualHydration, manualOil, manualSugar, flourChosen, flourBlend, priorityOverride, prefermentFlourPct, manualSalt, targetDoughTemp, flourInFridge, wasteAllowance, feedToMixH, measuredFlourTemp, prefTempForBalance, totalFlourTarget]);
  const mixerCapacityG = mixerDoughCapacity(mixerType ?? 'hand', customMixerCapacityG);
  const plannedDoughG = (() => {
    // Flour-target recipes need the same formula mass as the generated recipe.
    if(totalFlourTarget!==undefined && styleKey && ovenType && yeastType && mixerType && eatTime && startTime<eatTime){
      try { return recipeForSchedule(buildSchedule(startTime,eatTime,blocks,kitchenTemp,planPreheatMin,mixerType,styleKey,numItems,1,yeastType==='sourdough',levainBulkFactor,exitLeadOnly,planLadder)).totalDough; } catch { /* Quantity estimate until setup is complete. */ }
    }
    return Math.round(numItems * itemWeight * (totalFlourTarget === undefined && wasteAllowance > 0 ? 1 + wasteAllowance / 100 : 1));
  })();
  const suggestedMixingBatches = suggestedMixingBatchCount(plannedDoughG, mixerType ?? 'hand', customMixerCapacityG);
  const selectedMixingBatches = mixingBatches ?? suggestedMixingBatches;

  const poolishInputs = {
    prefermentFlourPct: prefermentFlourPct ?? 20,
    doughMassG: numItems * itemWeight,
    hydrationPct: manualHydration ?? (styleKey ? ALL_STYLES[styleKey].hydration : undefined),
    flourTempC: measuredFlourTemp ?? (flourInFridge ? fridgeTemp : kitchenTemp),
    targetDoughTemp,
  };
  // Round 8 (owner D2): a baker-entered dough yeast keeps the knead near the calculated plan's and the fridge absorbs
  // the difference: its fit (PlanShape) is solved once here and every schedule of the plan is built with it, the
  // picker's included (exitLeadMin prop).
  // Round 15 (owner O2): the calculated plan is the one for the CURRENT inputs, derived each time (`autoPlan`: the
  // picker's automatic plan with no entered amount), never remembered: same inputs, same plan, whatever the route.
  /** The planner's storages for a poolish or biga, each with the window it may take: an entered amount's readiness
   * band (the planner's prefWindow), else the planner's own window (commercialCandidateInput), aimed at the storage's
   * target hours (stable: the plan on screen never seeds the next one). */
  const prefPlanOptions = (type: FlourPreferment, enteredPct: number | undefined): PrefermentPlanOption[] => {
    // The storages the planner may give it, a cool-spot biga included (round 8 biga, as prefYeastFit reads them).
    const storages = prefermentYeastStorages(type, type === 'poolish' ? poolishStorage : bigaStorage === 'cool' ? 'room' : bigaStorage, type === 'biga' || prefGoesInFridgeState, bigaCoolOffered(bigaStorage, kitchenTemp));
    return storages.flatMap(inFridge => {
      const ctx = prefYeastCtx(type, inFridge);
      const entered = enteredPct !== undefined ? prefermentYeastTiming(type, enteredPct, inFridge, ctx) : null;
      if (enteredPct !== undefined && !entered) return [];
      const window = entered ? { min: entered.min, max: entered.max } : commercialPrefermentWindow(type, inFridge, kitchenTemp, styleKey ?? 'neapolitan', fridgeTemp);
      if (!window) return [];
      return [{ inFridge, prefWindow: window, prefHours: entered?.hours ?? getPrefOptH(type, kitchenTemp, inFridge, styleKey ?? 'neapolitan', fridgeTemp), warmupH: ctx.warmupH ?? 0, cooldownH: ctx.cooldownH ?? 0 }];
    });
  };
  const entryPref = (prefermentType === 'poolish' || prefermentType === 'biga') ? prefermentType as FlourPreferment : null;
  const entryStyle = styleKey ? STYLE_FERM_DEFAULTS[styleKey] : undefined;
  const entryDefaultWindow = entryStyle ? (bake: Date) => commercialReadinessWindow({ ...entryStyle, flourStrength, kitchenTemp, preheatMin: planPreheatMin, totalWindowH: (+bake - Date.now()) / 3600000 }) : undefined;
  const entryPrefOptions = (prefPct: number | undefined, planBlocks: AvailabilityBlock[]) => entryPref ? { options: prefPlanOptions(entryPref, prefPct),
    valid: (times: {start: Date; bake: Date; prefHours: number}, inFridge: boolean) => commercialPrefermentPlanValid({ type: entryPref, inFridge, mixTime: times.start, bakeTime: times.bake, offsetHours: times.prefHours, blocks: planBlocks, now: new Date() }) } : undefined;
  const yeastEntryRaw = useMemo(() => eatTime && styleKey && mixerType ? {
    bake: eatTime, now: 0, blocks, kitchenTemp, preheatMin: planPreheatMin, exitLeadMin: exitLeadOnly, planLadder, mixerType: mixerType as MixerType, styleKey,
    numItems, itemWeight, mixingBatches: selectedMixingBatches, fridgeTemp, hydration: poolishInputs.hydrationPct ?? 65, doughTempC: targetDoughTemp,
    conversion: 1,
    // The storage's target hours (stable while the plan moves, so the shape the page builds is the one the plan was found with).
    prefStartH: prefermentType === 'poolish' || prefermentType === 'biga' ? getPrefOptH(prefermentType, kitchenTemp, prefGoesInFridgeState, styleKey, fridgeTemp) : undefined,
  } : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [eatTime ? +eatTime : null, styleKey, mixerType, blocks, kitchenTemp, planPreheatMin, exitLeadOnly, planLadder, numItems, itemWeight, selectedMixingBatches, fridgeTemp, poolishInputs.hydrationPct, targetDoughTemp, prefermentType, prefGoesInFridgeState]);
  const entryInForce = yeastPctOverride !== undefined || !!prefYeastOverride;
  // The calculated plan for the current inputs (O2), in Custom with a commercial yeast (where amounts are entered): the
  // anchor of an entered amount's plan and what suggestions move towards. Round 15: the picker's own automatic plan
  // (`automaticCommercialPlan`, the one function the picker applies), never a reconstruction and never remembered;
  // when it finds no plan, the knead it falls back to. Busy times without an earlier plan's covers.
  const automaticAnchor = (busy: AvailabilityBlock[], bake: Date | null) => {
    if (tab !== 'custom' || !yeastEntryRaw || !yeastType || yeastType === 'sourdough' || !bake || !styleKey || !mixerType) return null;
    const now = Date.now(), planBlocks = uncovered(busy), eatTime = bake;
    try {
      const plan = automaticCommercialPlan({ now, styleKey, kitchenTemp, fridgeTemp, flourStrength, tang, preheatMin: planPreheatMin, preheatExtraMin, exitLeadMin: exitLeadOnly, planLadder,
        mixerType: mixerType as MixerType, numItems, mixingBatches: selectedMixingBatches, prefermentType: prefermentType ?? 'none',
        poolishStorage: prefermentType === 'poolish' ? poolishStorage : 'auto', bigaStorage, prefOffsetH: 0, prefInFridge: prefGoesInFridgeState, poolishPeakAtMix,
        execution, completedMixAt: mixExecution?.actualAt, formulaValid: (candidate, times) => !execution || madeFormulaMatches(execution, candidate, times), ...poolishInputs },
        planBlocks, eatTime, timingOverrides);
      if (!plan.times) return null;
      const times = { start: plan.times.start, bake: eatTime, prefHours: plan.times.prefHours };
      return { times, anchorH: (+eatTime - +times.start) / 3600000 };
    } catch { return null; }
  };
  const autoPlan = useMemo(() => automaticAnchor(blocks, eatTime),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [tab, yeastEntryRaw, yeastType, flourStrength, poolishStorage, bigaStorage, tang, preheatExtraMin, prefGoesInFridgeState, poolishPeakAtMix, execution, mixExecution, poolishInputs.prefermentFlourPct, poolishInputs.doughMassG, poolishInputs.flourTempC, timingOverrides]);
  const entryAnchor = autoPlan?.anchorH;
  const yeastEntryBase = useMemo(() => yeastEntryRaw ? { ...yeastEntryRaw, anchorH: entryAnchor } : null, [yeastEntryRaw, entryAnchor]);
  // Round 17 (finding 1): the shape every schedule is built with is the shape of the plan `entryPlan` builds for these
  // inputs (the picker applies that plan), so the page's schedule, the line and the editor are one plan.
  const entryPlanCache = useRef(new Map<string, EntryPlan | null>());
  const cachedEntryPlan = (idy: number | undefined, o: YeastEntryInput): EntryPlan | null => {
    const key = JSON.stringify([idy, { ...o, now: Math.floor(o.now / 900000), defaultWindow: undefined, preferment: o.preferment?.options }, flourStrength]);
    const cache = entryPlanCache.current;
    if (!cache.has(key)) {
      let plan: EntryPlan | null = null;
      try { plan = entryPlan(idy, o); } catch { plan = null; }
      if (cache.size > 40) cache.delete(cache.keys().next().value as string);
      cache.set(key, plan);
    }
    return cache.get(key) ?? null;
  };
  const exitLeadMin = useMemo(() => {
    if (effectiveYeastOverride === undefined || !yeastEntryBase) return exitLeadOnly;
    const o: YeastEntryInput = { ...yeastEntryBase, now: Date.now(), defaultWindow: entryDefaultWindow, preferment: entryPrefOptions(effectivePrefYeastOverride, blocks) };
    const plan = cachedEntryPlan(effectiveYeastOverride, o);
    return plan ? plan.shape : entryPlanShape(effectiveYeastOverride, o);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYeastOverride, effectivePrefYeastOverride, yeastEntryBase, exitLeadOnly, poolishStorage, bigaStorage]);
  const schedule = useMemo(() => {
    if (!eatTime || startTime >= eatTime) return null;
    if (!mixerType) return null;
    // No style, no schedule. This used to fall back to Neapolitan, which built
    // a 26-hour curve underneath a recommender that had fallen back to no cold
    // retard at all — two different doughs on one screen, neither of them the
    // baker's. The recipe already refused without a style; now everything does.
    if (!styleKey) return null;
    const plan = buildSchedule(startTime, eatTime, blocks, kitchenTemp, planPreheatMin, mixerType, styleKey, numItems, selectedMixingBatches, (yeastType==='sourdough'||prefermentType==='levain'), levainBulkFactor, exitLeadMin, planLadder);
    const cooldown = requiredPrefCooldownH({...poolishInputs, prefermentType:prefermentType ?? 'none',
      prefInFridge:prefGoesInFridgeState, styleKey, kitchenTemp, fridgeTemp, mixerType});
    const action = prefermentConditioningAction({prefWarmupHours:0, prefCooldownHours:cooldown},startTime);
    if (action && cooldown <= prefOffsetH && +action.at >= Date.now() && !findAvailabilityConflicts([action],blocks).length) {
      plan.prefermentCooldownHours = cooldown;
      plan.availabilityActions = [...(plan.availabilityActions ?? []), action].sort((a,b)=>+a.at-+b.at);
    }
    return withLongerPreheat(plan, eatTime, preheatExtraMin, blocks);
  }, [startTime, eatTime, blocks, kitchenTemp, planPreheatMin, preheatExtraMin, exitLeadMin, planLadder, mixerType, styleKey, numItems, selectedMixingBatches, yeastType, prefermentType, prefermentFlourPct, itemWeight, manualHydration, measuredFlourTemp, flourInFridge, targetDoughTemp, fridgeTemp, prefGoesInFridgeState, prefOffsetH, levainBulkFactor]);

  // Confirmation belongs to this exact committed action, never to a work preset.
  useEffect(() => {
    if (isRestoringRef.current) return;
    setBlocks(current => retainCurrentFridgeRemoval(current, schedule?.availabilityActions ?? []));
  }, [schedule, scheduleRestoreRevision]);

  // Preferment start time for Timeline step 0 (poolish/biga only)
  const prefStartTime = useMemo(() => {
    if (!prefermentType || prefermentType === 'none' || prefermentType === 'levain') return null;
    if (prefOffsetH <= 0) return null;
    return new Date(startTime.getTime() - prefOffsetH * 3600000);
  }, [startTime, prefOffsetH, prefermentType]);

  // prefGoesInFridge is the algo's decision reported via onPrefGoesInFridgeChange.
  // This planner uses refrigerated biga; poolish supports either storage method.
  // Poolish: algo decides fridge or RT based on dual search result.
  // This single value flows to Timeline, RecipeOutput, and buildComputedRecipe.
  const prefGoesInFridge = !prefermentType || prefermentType === 'none' || prefermentType === 'levain'
    ? false
    : prefermentType === 'biga'
      // The fridge unless the baker chose the cool spot or the plan put it there (D1).
      ? bigaStorage === 'cool' ? false : bigaStorage === 'fridge' ? true : prefGoesInFridgeState
      : prefGoesInFridgeState;

  // Explicitly accepted proposals must survive the scheduler's bake-key remount.
  // Any changed recipe input, timestamp or availability invalidates this marker.
  const repairKey = (st: Date, et: Date | null, bl: AvailabilityBlock[], offset = prefOffsetH, storage = prefGoesInFridge, resetKey = starterPlanResetKey) =>
    JSON.stringify([[kitchenTemp, fridgeTemp, planPreheatMin, exitLeadMin, planLadder, mixerType, styleKey,
      yeastType, prefermentType, offset, storage, tang, resetKey],
      +st, et ? +et : null, bl.map(b => [+b.from, +b.to, b.label, b.fridgeRemoval,b.coveredActions,b.bakeFromFridge,b.shortWarmup])]);
  const confirmedSchedulePlan = acceptedScheduleRepair === repairKey(startTime, eatTime, blocks);
  const handleScheduleChange = (st: Date, et: Date, bl: AvailabilityBlock[], options?: {preservePlan: boolean; timingOverrides?: TimingOverrides; prefOffsetHours?: number; prefInFridge?: boolean; starterRecoveryResolved?:boolean; starterPlan?: {events:StarterEvent[];fridgeOutTime:Date|null;usingPeak2:boolean;feed2Time:Date|null;starterFridgeInTime:Date|null}}) => {
    if(mixExecution&&+st!==mixExecution.actualAt)return;
    if(execution){
      if(options?.prefInFridge!==undefined&&options.prefInFridge!==execution.inFridge)return;
      const offset=options?.prefOffsetHours??prefOffsetH;
      if(execution.method==='none'?+st!==execution.actualAt:Math.abs(+st-offset*3600000-execution.actualAt)>1)return;
      if((+st!==+startTime||+et!==+(eatTime??0)||offset!==prefOffsetH)&&!madeFormulaMatches(execution,buildSchedule(st,et,bl,kitchenTemp,planPreheatMin,mixerType??'hand',styleKey??'',numItems,selectedMixingBatches,yeastType==='sourdough',levainBulkFactor,exitLeadMin,planLadder),{prefHours:offset}))return;
    }
    if (eatTime && +et!==+eatTime && bl.some(block=>block.coveredActions?.length)) {
      bl=bl.map(({coveredActions,...block})=>block);
    }
    const changedPlan = recipeGenerated && destination==='organisation' && !isRestoringRef.current && (+st !== +startTime || +et !== (eatTime ? +eatTime : null) || JSON.stringify(bl) !== JSON.stringify(blocks) || (options?.prefInFridge !== undefined && options.prefInFridge !== prefGoesInFridge) || (options?.prefOffsetHours !== undefined && options.prefOffsetHours !== prefOffsetH));
    if (changedPlan) setProtocolStale(true);
    setAcceptedScheduleRepair(options?.preservePlan ? repairKey(st, et, bl, options.prefOffsetHours, options.prefInFridge) : null);
    if (sessionRestored && +et !== (eatTime ? +eatTime : null)) setSessionRestored(false);
    setStartTime(st); setEatTime(et); setBlocks(bl);
    if (options?.prefOffsetHours !== undefined) setPrefOffsetH(options.prefOffsetHours);
    if (options?.prefInFridge !== undefined) setPrefGoesInFridgeState(options.prefInFridge);
    if (options?.timingOverrides !== undefined) setTimingOverrides(normalizeTimingOverrides(options.timingOverrides));
    if(options?.starterRecoveryResolved&&options.starterPlan)setStarterRecoveryPending(false);
    if(options?.starterPlan){setStarterEvents(options.starterPlan.events);setFridgeOutTime(options.starterPlan.fridgeOutTime);setUsingPeak2(options.starterPlan.usingPeak2);setFeed2Time(options.starterPlan.feed2Time);setStarterFridgeInTime(options.starterPlan.starterFridgeInTime);}
    // Applying is durable immediately; the general autosave is deliberately debounced.
    if(options?.preservePlan || options?.timingOverrides !== undefined)saveSession(buildSessionPayload({...(options?.starterRecoveryResolved&&options.starterPlan?{starterRecoveryPending:false}:{}),protocolStale:protocolStale||changedPlan,...(options?.prefInFridge!==undefined?{prefGoesInFridge:options.prefInFridge}:{}),...(options?.timingOverrides !== undefined ? {timingOverrides:normalizeTimingOverrides(options.timingOverrides)} : {}),...(options.starterPlan?{starterEvents:serializeStarterEvents(options.starterPlan.events),fridgeOutTime:options.starterPlan.fridgeOutTime?.getTime()??null,usingPeak2:options.starterPlan.usingPeak2,feed2Time:options.starterPlan.feed2Time?.getTime()??null,starterFridgeInTime:options.starterPlan.starterFridgeInTime?.getTime()??null}:{}),...(options.prefOffsetHours!==undefined?{prefOffsetH:options.prefOffsetHours}:{}),startTime:+st,eatTime:+et,blocks:bl.map(b=>({label:b.label,from:+b.from,to:+b.to,...(b.coveredActions?.length?{coveredActions:b.coveredActions}:{}),...(b.fridgeRemoval?{fridgeRemoval:b.fridgeRemoval}:{})}))}));
  };


  const prefRemoveFromFridgeTime = useMemo(() => {
    if (!prefGoesInFridge || !eatTime) return null;
    // Same single source of truth the scheduler uses. Returns 0 for biga and for
    // any fridge poolish whose target dough temperature is reachable on water
    // alone — in that case removal lands exactly at mix time and the Timeline
    // drops the step entirely (the preferment goes into the mix cold).
    const rtWarmupH = requiredPrefWarmupH({
      prefermentType: prefermentType ?? 'none',
      prefInFridge: prefGoesInFridge,
      prefermentFlourPct: prefermentFlourPct ?? 20, doughMassG:numItems*itemWeight,
      hydrationPct:manualHydration ?? (styleKey ? ALL_STYLES[styleKey].hydration : undefined),
      flourTempC:measuredFlourTemp ?? (flourInFridge ? fridgeTemp : kitchenTemp),
      styleKey: styleKey ?? '',
      kitchenTemp, fridgeTemp,
      mixerType: (mixerType ?? 'hand') as MixerType,
      targetDoughTemp,
    });
    return new Date(startTime.getTime() - rtWarmupH * 3600000);
  }, [prefGoesInFridge, prefermentType, styleKey, kitchenTemp, fridgeTemp, mixerType, targetDoughTemp, eatTime, startTime, prefermentFlourPct, numItems, itemWeight, manualHydration, measuredFlourTemp, flourInFridge]);



  const effPref: PrefermentType = (prefermentType ?? 'none') as PrefermentType;

  // Both views edit one persisted recipe. The custom-capable engine respects
  // explicit choices; absent overrides retain the recommended baseline.
  const recipe = useMemo(() => {
    if(mixExecution)return mixExecution.recipe;
    if(execution?.method==='none')return execution.recipe;
    if (!styleKey || !schedule || !ovenType || !yeastType) return null;
    try {
      const calculated=calculateRecipe(
        styleKey, ovenType as OvenType, numItems, itemWeight,
        kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom',
        mixerType as MixerType,
        manualHydration, manualOil, manualSugar, flourChosen ? flourBlend : undefined, prefermentType, priorityOverride,
        prefermentFlourPct ?? (
          prefermentType === 'levain'
            // Levain/sourdough has its own sane range (15-30%, data.ts) —
            // the poolish/biga timing-based schedule below doesn't apply to
            // it and was pushing short-window plans up to 45% starter.
            ? undefined
            : 20
        ),
        manualSalt,
        targetDoughTemp,
        flourInFridge,
        wasteAllowance,
        prefGoesInFridge,
        feedToMixH,
        prefermentType !== 'none' && prefermentType !== 'levain' && prefOffsetH > 0 ? prefOffsetH : undefined,
        measuredFlourTemp, prefTempForBalance, totalFlourTarget,
        effectiveYeastOverride,
        effectiveStarterOverride,
        effectivePrefYeastOverride,
      );
      if(execution){
        const used=execution.recipe.preferment,next=calculated.preferment;
        // Preserve what was weighed; only the unmade final dough can update.
        if(!used||!next||Math.abs(used.prefYeastGrams-next.prefYeastGrams)>=0.0005||used.prefFlour!==next.prefFlour||used.prefWater!==next.prefWater)return execution.recipe;
      }
      return calculated;
    } catch {
      return null;
    }
  }, [mixExecution, execution, styleKey, ovenType, numItems, itemWeight, totalFlourTarget, kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, customMixerCapacityG, humidity, schedule, fridgeTemp, yeastType, mixerType, priorityOverride, manualHydration, manualOil, manualSugar, flourChosen, flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, manualSalt, targetDoughTemp, flourInFridge, measuredFlourTemp, prefTempForBalance, wasteAllowance, addSeeds, prefGoesInFridge, feedToMixH, yeastPctOverride, effectiveYeastOverride, effectivePrefYeastOverride, effectiveStarterOverride]);

  // ── Baker-entered yeast, checked on the plan's own paths (round 8: bugs 3, 6, 7; M2) ──────────────
  // The calculated dough yeast (IDY %) of the plan before the baker typed: what a suggestion moves towards.
  // Round 15 (O2): derived from the current inputs, never remembered: the recipe on screen while it is the calculated
  // one (no amount entered, no replan waiting), else the recipe of the calculated plan (`autoPlan`) for these inputs.
  const calcYeast = useMemo((): {idyPct?: number; pref?: {type: string; pct: number}} | null => {
    const read = (r: ReturnType<typeof recipeForSchedule> | null | undefined) => r ? {
      idyPct: r.yeast && Number.isFinite(r.yeast.pct) ? r.yeast.pct : undefined,
      pref: r.preferment && r.preferment.prefFlour > 0 && (prefermentType === 'poolish' || prefermentType === 'biga') ? { type: prefermentType, pct: r.preferment.prefYeastGramsIDY / r.preferment.prefFlour * 100 } : undefined } : null;
    if (!entryInForce && !planReplanPending) return read(recipe);
    if (!autoPlan || !eatTime || !styleKey || !mixerType) return null;
    try {
      return read(recipeForSchedule(buildSchedule(autoPlan.times.start, eatTime, uncovered(blocks), kitchenTemp, planPreheatMin, mixerType, styleKey, numItems, selectedMixingBatches, false, 1, exitLeadOnly, planLadder), { prefHours: autoPlan.times.prefHours }));
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryInForce, planReplanPending, recipe, autoPlan, eatTime ? +eatTime : null, blocks, exitLeadOnly, planLadder]);
  /** Everything the entry checks need, in the planner's terms. `prefPct` replaces the preferment's entered amount. */
  const yeastEntryInput = (conversion: number, prefPct: number | undefined = effectivePrefYeastOverride, at?: {blocks: AvailabilityBlock[]; bake: Date}): YeastEntryInput | null => {
    if (!yeastEntryBase || !styleKey) return null;
    const planBlocks = at?.blocks ?? blocks;
    // O2: the night rule reads the hands-on steps between 22:00 and 07:00 not declared free beyond the calculated plan's
    // (derived for these inputs).
    // Other busy times or another bake (the picker's replan): the calculated plan for those inputs, derived afresh.
    const busyKey = (list: AvailabilityBlock[]) => JSON.stringify(uncovered(list).map(b => [+b.from, +b.to, b.label ?? '']));
    const fresh = at && (+at.bake !== +(eatTime ?? 0) || busyKey(at.blocks) !== busyKey(blocks)) ? automaticAnchor(at.blocks, at.bake) : autoPlan;
    return { ...yeastEntryBase, ...(at ?? {}), anchorH: fresh?.anchorH, now: Date.now(), conversion, calculatedIdyPct: calcYeast?.idyPct,
      defaultWindow: entryDefaultWindow, preferment: entryPrefOptions(prefPct, planBlocks) };
  };
  /** Round 11: the entered dough yeast's timing for the picker, the one `entryPlan` searches in (time left first). */
  const entryTimingFor = (planBlocks: AvailabilityBlock[], bake: Date): EnteredYeastTiming | null => {
    if (effectiveYeastOverride === undefined || !yeastType || yeastType === 'sourdough') return null;
    const o = yeastEntryInput(YEAST_TYPES[yeastType]?.conversion ?? 1, effectivePrefYeastOverride, {blocks: planBlocks, bake});
    if (!o) return null;
    // The timing of the plan the picker applies (entryPlan), else the amount's own.
    try { return cachedEntryPlan(effectiveYeastOverride, o)?.timing ?? entryTiming(effectiveYeastOverride, o, Math.max(0, (+bake - o.now) / 3600000)) ?? entryTiming(effectiveYeastOverride, o); } catch { return null; }
  };
  /** Round 11: the plan an entered amount gets, for the picker (one builder with the night line: yeastEntry `entryPlan`). */
  const planEntryFor = (planBlocks: AvailabilityBlock[], bake: Date): EntryPlan | null => {
    if (!entryInForce || !yeastType || yeastType === 'sourdough') return null;
    const o = yeastEntryInput(YEAST_TYPES[yeastType]?.conversion ?? 1, effectivePrefYeastOverride, {blocks: planBlocks, bake});
    return o ? cachedEntryPlan(effectiveYeastOverride, o) : null;
  };

  // The planner may raise the levain % only without a baker-entered one, and only when
  // every planned feed can build the larger amount (raisedLevainFits).
  const levainFlourG = recipe?.flour;
  const canRaiseStarterPct = React.useMemo(() => yeastType === 'sourdough' && starterPctOverride === undefined && levainFlourG
    ? (pct: number, feedRatios: number[]) => raisedLevainFits(levainFlourG, kitchenTemp, feedToMixH, pct, feedRatios)
    : undefined, [yeastType, starterPctOverride, levainFlourG, kitchenTemp, feedToMixH]);
  // A restored, up-to-date recipe is the baseline the next update compares amounts with.
  useEffect(() => {
    if (!recipeGenerated || protocolStale || acceptedAmountsRef.current || !recipe) return;
    acceptedAmountsRef.current = {yeast: recipeYeastTotal(recipe), flour: recipe.flour, yeastType};
  }, [recipeGenerated, protocolStale, recipe]);


  const displayRecipe = recipe;
  const advancedRecipe = recipe;
  const advancedDisplayRecipe = advancedRecipe;
  // One jar, two bakes (20 Nov 2026 round 7, B5, Priya): when another live sourdough bake feeds the jar for its levain
  // close enough that one feed is ready for both mixes, both build their levain from that feed, said once with both
  // amounts; the later bake's starter steps follow the earlier one's (sharedStarterFeedFor). Nothing with one bake
  // (owner's rule B: no other bake, no other use; the events below are then the plan's own array).
  // Round 8 (S6): computed before the recipe's starter card, the shopping list and the feed question, which all
  // read it; the bake that follows shows the jar's own steps (its fridge dates, its feeds) up to the shared feed, and
  // a feed recorded in either bake is done in both. `fr` is declared further down: the locale is read here.
  const sharedStarterPair = (()=>{
    if(!recipeGenerated||yeastType!=='sourdough'||!eatTime)return null;
    const others=otherStarterUses();if(!others.length)return null;
    const need=currentLevainNeed();
    const isFr=locale==='fr';
    const feeds=starterEvents.filter(e=>e.kind==='pre_mix'&&e.bellPeakTime&&+e.time<+startTime).sort((a,b)=>+a.time-+b.time);
    const feed=feeds.find(e=>+e.time>Date.now())??feeds.at(-1);
    if(!need||!feed)return null;
    const subject=bakeSubject(styleKey,numItems,isFr,bakeType);
    const name=subject?subject.text.charAt(0).toLowerCase()+subject.text.slice(1):bakeName||jarStyleName(styleKey);
    const ownId=journalId??currentJournalId()??'current';
    const createdAt=(()=>{try{return getJournalEntry(ownId)?.createdAt;}catch{return undefined;}})();
    const feedList=starterEvents.filter(e=>['refresh','intermediate_refresh','pre_mix'].includes(e.kind)&&+e.time<+startTime).map(e=>({at:+e.time,ratio:e.feedingRatio??nextFeedRatio}));
    const shared=sharedStarterFeedFor({id:ownId,name,feedAt:+feed.time,peakAt:+feed.bellPeakTime!,mixAt:+startTime,ratio:feed.feedingRatio??nextFeedRatio,need,createdAt,bakeAt:+eatTime,feeds:feedList},others,Date.now());
    return shared?{shared,other:others.find(o=>o.id===shared.otherId)}:null;
  })();
  const sharedStarter = sharedStarterPair?.shared ?? null;
  // A starter in the fridge always shows its take-out step before its first feed (round 11, withStarterTakeOut).
  const shownStarterEvents = withStarterTakeOut(starterEvents, yeastType==='sourdough'&&starterLocation==='fridge', getStarterFridgeWarmupH(kitchenTemp), Date.now(), locale==='fr');
  const guideStarterEvents = starterEventsWithSharedFeed(shownStarterEvents, sharedStarter, Date.now(), sharedStarterPair?.other?.events as StarterEvent[]|undefined);
  // The other bake's recorded feeds of the jar's steps count here too (a tick in one bake is done in the other).
  const jarRecords = carriedJarRecords(sharedStarter, sharedStarterPair?.other) as StarterFeedRecord[];
  const sharedFeedNote = sharedStarter ? {at:sharedStarter.at,line:sharedFeedLine(sharedStarter,locale==='fr',g=>displayWeight(g,units,locale),(own,other)=>twinBakeWhen(own,[other],locale)),seed:sharedStarter.build.seed,flour:sharedStarter.build.flour,water:sharedStarter.build.water,ratio:sharedStarter.ratio,keep:sharedStarter.keep} : null;
  // Flour is authoritative in this mode. Keep equipment and portion displays
  // aligned with the canonical formula, including enriched ingredients/yeast.
  const flourModeRecipe = tab==='custom' ? advancedRecipe : recipe;
  useEffect(() => {
    if (bakeType!=='bread'||totalFlourTarget===undefined||!flourModeRecipe||isRestoringRef.current) return;
    const weight=flourModeRecipe.totalDough/Math.max(1,numItems);
    if(Math.abs(weight-itemWeight)>0.01)setItemWeight(weight);
  }, [bakeType,totalFlourTarget,flourModeRecipe?.totalDough,numItems,tab,wastePct,itemWeight]);

  // The flour the plan's starter feeds take, as each feed card measures it (starterBuild at the feed's ratio): the
  // list buys it too (20 Nov 2026 round 6, Priya: the feeds' flour was missing from the shopping list).
  const starterFeedFlour = useMemo(() => {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (yeastType !== 'sourdough' || !cr?.sourdough) return 0;
    const mid = cr.sourdough.starterGramsMid, max = cr.sourdough.starterGramsMax ?? mid;
    // One jar, two bakes (round 8, S6): the feeds this bake shows. The jar's earlier steps, which the bake that leads
    // plans and buys for, are not counted again; the shared feed is this dough's share of it, at the shared ratio.
    return guideStarterEvents.filter(event => !event.isPast && !(event as {jar?:boolean}).jar && ['refresh','intermediate_refresh','pre_mix'].includes(event.kind))
      .reduce((sum, event) => sum + starterBuild(mid, max, (sharedStarter&&+event.time===sharedStarter.at?sharedStarter.ratio:undefined) ?? event.feedingRatio ?? nextFeedRatio).flour, 0);
  }, [tab, advancedRecipe, recipe, yeastType, guideStarterEvents, sharedStarter, nextFeedRatio]);
  const starterFeedFlourName = locale === 'fr' ? 'Farine pour les rafraîchis du levain' : 'Flour for the starter feeds';
  // Dough ingredients for the Pizza Party shopping list — the host shops once.
  const doughShoppingItems = useMemo(() => {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return undefined;
    // Yeast named by type, sugar and oil listed, quantities in the selected units.
    const items = buildDoughShoppingItems({ recipe: cr, yeastType: yeastType ?? 'instant', locale, units, flourName: flourShoppingName(styleKey ?? '', locale, flourChosen ? 'custom' : 'simple', flourBlend, !cr.preferment && !cr.sourdough) });
    if (starterFeedFlour > 0) items.push({ tickKey: 'dough_starter_feeds', name: starterFeedFlourName, amount: displayWeight(Math.round(starterFeedFlour), units, locale) });
    return items;
  }, [tab, advancedRecipe, recipe, yeastType, locale, units, styleKey, flourChosen, flourBlend, starterFeedFlour, starterFeedFlourName]);

  const sandwichDoughIngredients = useMemo(() => {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return undefined;
    const fr = locale === 'fr';
    const rows = [
      ...(cr.flourParts?.length ? cr.flourParts.map(part=>({id:`flour_${part.key}`,name:fr?part.nameFr:part.name,grams:part.grams})) : [{id:'flour', name:flourShoppingName(styleKey ?? '', locale, flourChosen ? 'custom' : 'simple', flourBlend, !cr.preferment && !cr.sourdough), grams:cr.flour}]),
      {id:'water', name:fr?'Eau':'Water', grams:cr.water},
      {id:'salt', name:fr?'Sel':'Salt', grams:cr.salt},
      {id:'olive_oil', name:fr?'Huile d’olive':'Olive oil', grams:cr.oil},
      {id:'sugar', name:fr?'Sucre':'Sugar', grams:cr.sugar},
      {id:'yeast', name:(()=>{const grams=recipeYeastTotal(cr) ?? 0, hint=yeastBuyingHint(grams, yeastType ?? 'instant', locale, units);return yeastShoppingName(yeastType ?? 'instant', locale)+(hint?` · ${hint}`:'');})(), grams:recipeYeastTotal(cr) ?? 0},
      ...(['milk','eggs','butter'] as const).map(id=>({id,name:({milk:fr?'Lait':'Milk',eggs:eggShoppingLabel(cr.enrichment?.eggs ?? 0,fr),butter:fr?'Beurre':'Butter'})[id],grams:cr.enrichment?.[id] ?? 0})),
    ];
    if (starterFeedFlour > 0) rows.splice(cr.flourParts?.length ?? 1, 0, {id:'starter_feed_flour', name:starterFeedFlourName, grams:Math.round(starterFeedFlour)});
    // What the steps ask for besides the dough (finish, dusting, egg wash).
    rows.push(...breadFinishShopping(styleKey ?? '', numItems, locale));
    return rows.filter(row=>Number.isFinite(row.grams)&&row.grams>0);
  }, [tab, advancedRecipe, recipe, locale, styleKey, flourChosen, flourBlend, numItems, units, yeastType, starterFeedFlour, starterFeedFlourName]);

  // Builds the computedRecipe payload from the live recipe object — single source of truth
  function buildComputedRecipe(): SessionData['computedRecipe'] {
    const cr = tab === 'custom' ? advancedRecipe : recipe;
    if (!cr) return null;

    // Serialize timeline steps at generation time — single source of truth.
    // SessionViewer reads these directly; no reconstruction needed.
    const timelineSteps: Array<{ id: string; time: number; label: string }> = [];
    if (schedule && startTime && eatTime) {
      try {
        const steps = buildItems(
          schedule,
          blocks,
          startTime,
          eatTime,
          preheatMin,
          (mixerType ?? 'hand') as import('@/app/data').MixerType,
          numItems,
          feedTime ?? null,
          kitchenTemp,
          yeastType === 'sourdough',
          prefStartTime ?? null,
          prefermentType ?? 'none',
          prefGoesInFridge,
          prefRemoveFromFridgeTime ?? null,
          cr.hydration ?? undefined,
          cr.oil ?? undefined,
          // CRITICAL: without the translator, buildItems falls back to (k) => k
          // and raw i18n keys (timeline.steps.mixing…) get serialized into the
          // session — they then appear verbatim on the share card + caption.
          (key, params) => t(key, params),
          bakeType ?? undefined,
          styleKey ?? undefined,
        );
        for (const step of steps) {
          if (step.kind === 'step') {
            timelineSteps.push({
              id: step.id,
              time: step.time.getTime(),
              label: step.label,
            });
          }
        }
      } catch { /* leave timelineSteps empty */ }
    }

    return {
      flour: cr.flour,
      flourParts: cr.flourParts,
      water: cr.water,
      salt: cr.salt,
      oil: cr.oil ?? 0,
      sugar: cr.sugar ?? 0,
      hydration: cr.hydration ?? Math.round((cr.water / cr.flour) * 100),
      yeastGrams: recipeYeastTotal(cr) ?? null,
      coldH: schedule?.totalColdHours ?? 0,
      rtH: schedule?.totalRTHours ?? 0,
      enrichment: cr.enrichment,
      hasPreferment: !!(cr.preferment?.prefYeastGrams),
      totalIngredients: {
        yeast: recipeYeastTotal(cr),
      },
      timelineSteps,
    };
  }

  // Single source of truth for the session snapshot.
  // Used by autosave, the Save button AND handleGenerate — keeping these
  // three in sync is what preserves startTime / schedule / sourdough state
  // when the baker resumes a session (localStorage or DB).
  // This bake's oven time, from the preheat to the last piece out (18 Nov 2026 retention round 3).
  function currentOvenUse(){
    if(!eatTime||!schedule)return null;
    const from=ovenTakenAt(Math.min(+(schedule.preheatStart??eatTime),+eatTime));
    return {from,to:ovenUseEnd(+eatTime,ovenBusyMinutes(bakeType,styleKey,numItems,ovenType)),ovenType:ovenType??null};
  }
  // The levain this dough takes, saved with the bake for another live bake sharing the jar (round 7, B5).
  function currentLevainNeed(){
    const cr=tab==='custom'?advancedRecipe:recipe;
    if(yeastType!=='sourdough'||!cr?.sourdough)return undefined;
    return {mid:cr.sourdough.starterGramsMid,max:cr.sourdough.starterGramsMax??cr.sourdough.starterGramsMid};
  }
  // Other sourdough bakes under way on this device with a levain build still to feed: compared only when there are
  // any, as the oven is (owner's rule B).
  // The style's name, as styleDisplayName (declared further down) gives it: read before it during the render.
  function jarStyleName(sk:string|null|undefined):string{
    if(!sk)return '';
    const st=(ALL_STYLES as Record<string,{name?:string;nameFr?:string}>)[sk];
    return (locale==='fr'?st?.nameFr:undefined)??st?.name??sk;
  }
  function otherStarterUses():StarterUse[]{
    const own=journalId??currentJournalId();
    const isFr=locale==='fr';
    const uses:StarterUse[]=[];
    try{for(const row of liveJournalBakes()){
      const other=row.entry;if(row.rate||other.id===own||other.eatTime==null)continue;
      const subject=bakeSubject(other.styleKey,other.numItems,isFr,other.bakeType);
      const name=subject?subject.text.charAt(0).toLowerCase()+subject.text.slice(1):other.bakeName||jarStyleName(other.styleKey);
      const use=savedStarterUse(other,name,isFr);
      if(use)uses.push(use);
    }}catch{}
    return uses;
  }
  // Other bakes under way on this device that use the oven: compared only when there are any, so a baker with one
  // bake never sees anything of it (owner's rule B).
  function otherOvenUses():OvenUse[]{
    const own=journalId??currentJournalId();
    const uses:OvenUse[]=[];
    try{for(const row of liveJournalBakes()){
      const other=row.entry;if(row.rate||other.id===own||other.eatTime==null)continue;
      const ses=other.session;
      const to=ses.ovenTo!=null?ovenFreeAt(ses.ovenTo):ovenUseEnd(other.eatTime,ovenBusyMinutes(other.bakeType,other.styleKey,other.numItems,ses.ovenType));
      const subject=other.bakeName?null:bakeSubject(other.styleKey,other.numItems,fr,other.bakeType);
      uses.push({id:other.id,from:ovenTakenAt(ses.ovenFrom??other.eatTime-30*60000),to,ovenType:ses.ovenType??null,name:other.bakeName||styleDisplayName(other.styleKey),...(subject?{subject:subject.text,plural:subject.plural}:{})});
    }}catch{}
    return uses;
  }
  // A function, so it reads the render's values when called (declared above them).
  function renderOvenOfferSheet(){
          if(!ovenOffer||!eatTime)return null;
          // The same "Before your recipe" sheet as a clash (SchedulePicker's), here for the one fact the planner
          // cannot see: another bake under way in the same oven (18 Nov 2026 retention round 3, item 13).
          const optionCard:React.CSSProperties={display:'block',width:'100%',minHeight:56,marginTop:8,padding:'12px 14px',border:'1.5px solid var(--border)',borderRadius:12,background:'var(--card, #fff)',color:'var(--char)',textAlign:'left',whiteSpace:'normal',fontSize:15,lineHeight:1.4,cursor:'pointer'};
          const at=(ms:number)=>new Date(ms).toDateString()===eatTime.toDateString()?formatClock(new Date(ms),locale):formatBakeDateTime(new Date(ms),locale);
          const slot=+eatTime+ovenOffer.shift, other=ovenOffer.other;
          const close=()=>setOvenOffer(null);
          return <div className="bh-decision-sheet" data-decision-sheet data-oven-sheet style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(43,36,32,0.42)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
            <div role="dialog" aria-modal="true" aria-labelledby="bh-oven-sheet-title" style={{width:'100%',maxWidth:560,maxHeight:'85vh',overflowY:'auto',background:'var(--cream)',borderRadius:'18px 18px 0 0',padding:'18px 16px calc(18px + env(safe-area-inset-bottom, 0px))',boxShadow:'0 -4px 24px rgba(43,36,32,0.18)'}}>
              <h2 id="bh-oven-sheet-title" style={{margin:'0 0 4px',fontSize:19,fontWeight:700,color:'var(--char)'}}>{fr?'Avant votre recette':'Before your recipe'}</h2>
              <div className="bh-simple-decision" role="status" style={{border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',margin:'12px 0',background:'var(--warm)'}}>
                <p style={{margin:'0 0 12px',fontSize:15,lineHeight:1.5,color:'var(--char)'}}>{ovenBusyClause(other,fr,at)}.</p>
                {ovenOffer.shift>0&&<button type="button" className="bh-plan-option" data-oven-slot style={optionCard} onClick={()=>{ovenSlotPending.current=slot;setOvenOffer(null);setEatTime(new Date(slot));}}>
                  <strong style={{display:'block'}}>{fr?`Enfourner à ${at(slot)}`:`Bake at ${at(slot)}`}</strong>
                </button>}
                <button type="button" className="bh-plan-option" data-oven-keep style={optionCard} onClick={()=>{ovenKept.current=+eatTime;setOvenOffer(null);handleGenerate();}}>
                  <strong style={{display:'block'}}>{fr?`Garder ${at(+eatTime)}`:`Keep ${at(+eatTime)}`}</strong>
                </button>
              </div>
              <button type="button" className="bh-back-action" style={{minHeight:44}} onClick={backToBakeTime}>{fr?'Revenir à l’heure de cuisson':'Back to the bake time'}</button>
            </div>
          </div>;
  }
  function buildSessionPayload(overrides?: Partial<Omit<SessionData, 'version' | 'savedAt'>>): Omit<SessionData, 'version' | 'savedAt'> {
    return {
      tab, bakeType, bakeName, styleKey, numItems, itemWeight, totalFlourTarget, pizzaDiameter,
      ovenType, ovenConstruction, mixerType, yeastType,
      kitchenTemp, waterSource, measuredWaterTemp, waterMethod, spiralIceConfirmed, mixingBatches, mixerCapacityG: customMixerCapacityG, resultNotes, previousNote, preheatExtraMin, exitLead, planExitLead: planExitLead(schedule, kitchenTemp, styleKey), containerCapacityLitres, humidity, fridgeTemp,
      flourBlend, prefermentType, prefermentFlourPct, prefOffsetH, timingOverrides, execution, mixExecution, starterFeedRecords, starterRecoveryPending,
      qtyChosen, flourChosen, prefermentChosen, customKitchenConfirmed, confirmedSettings,
      manualHydration, manualOil, manualSugar, manualSalt, yeastPctOverride, prefYeastOverride, entryNightKept: yeastPctOverride !== undefined || prefYeastOverride ? entryNightKept : undefined, starterPctOverride, autoStarterPct,
      targetDoughTemp, flourInFridge, measuredFlourTemp, measuredPrefermentTemp, wastePct: wasteAllowance, addSeeds, priorityOverride,
      prefGoesInFridge, poolishStorage, bigaStorage,
      startTime: startTime?.getTime() ?? null,
      eatTime: eatTime?.getTime() ?? null,
      blocks: blocks.map(b => ({ label: b.label, from: b.from.getTime(), to: b.to.getTime(), ...(b.coveredActions?.length?{coveredActions:b.coveredActions}:{}), ...(b.fridgeRemoval ? {fridgeRemoval:b.fridgeRemoval} : {}), ...(b.bakeFromFridge ? {bakeFromFridge:b.bakeFromFridge} : {}), ...(b.shortWarmup ? {shortWarmup:b.shortWarmup} : {}) })),
      recipeGenerated, protocolStale, executionClash, activeTab, pizzaPartyTab, modeChosen, awaitingRecipeChoice, customBakeQuestion,
      acceptedStartTime: acceptedPlan?.startTime, acceptedPreparationAt: acceptedPlan?.preparationAt, acceptedEatTime: acceptedPlan?.bakeAt,
      ovenFrom: currentOvenUse()?.from, ovenTo: currentOvenUse()?.to,
      levainNeed: currentLevainNeed(),
      navigation:{batchView,protocolView,serviceView,returnTo:fillingsReturn,prepReturnToService,shoppingReturnToFillings},
      // How far the baker got. Without it a resumed session reopened at
      // highestStep 1, so every step carrying a default read as unset —
      // "Quantity not confirmed" beside a finished recipe.
      highestStep, advancedHighestStep, activeStep, advancedStep, setupOverview,
      pizzaParty: buildPizzaPartySnapshot(),
      sandwichParty: bakeType === 'bread' ? sandwichParty : null,
      bakedDone,
      computedRecipe: buildComputedRecipe(),
      starterEvents: serializeStarterEvents(starterEvents),
      starterState, starterLocation, planningMode,
      lastFedTime: lastFedTime?.getTime() ?? null,
      knownPeakTime: knownPeakTime?.getTime() ?? null,
      hasNotFedYet: hasNotFedYet ?? undefined,
      lastFedAge: lastFedAge ?? null,
      simpleStarterAnswer,
      lastFeedRatio,
      nextFeedRatio,
      nextFeedRatioOverride,
      ratioMode,
      starterTimingValid, starterMature, starterHasRye, tang,
      fridgeOutTime: fridgeOutTime?.getTime() ?? null,
      usingPeak2,
      feed2Time: feed2Time?.getTime() ?? null,
      starterFridgeInTime: starterFridgeInTime?.getTime() ?? null,
      ...overrides,
    };
  }

  useEffect(() => { latestSessionPayloadRef.current = JSON.stringify(buildSessionPayload()); });

  // Auto-save session to localStorage — placed after computed values to avoid TDZ.
  // isRestoringRef passed as a guard: a save armed while hydration is still in
  // flight must never persist a payload mixing defaults with restored state
  // (observed symptom: tab flipped back to 'simple' on a generated custom session).
  useSessionSave(
    buildSessionPayload(),
    () => {},
    1200,
    isRestoringRef,
  );

  // Keep the journal entry of the current bake in step with its progress.
  useEffect(() => {
    if (!recipeGenerated || isRestoringRef.current) return;
    const id = journalId;
    const timer = window.setTimeout(() => { try { if (id && id === currentJournalId()) refreshCurrentJournalSnapshot(buildSessionPayload()); } catch {} }, 1500);
    return () => window.clearTimeout(timer);
  });

  const bakeTimeIsPast = useMemo(() => {
    if (!eatTime) return false;
    return new Date(eatTime) < new Date();
  }, [eatTime]);

  const startTimeInPast = !!mixExecution || !!execution && execution.method==='none';
  // A feed of the shared jar recorded in the other bake counts here too (round 8, S6); with one bake, none.
  const shownFeedRecords=jarRecords.length?[...starterFeedRecords,...jarRecords]:starterFeedRecords;
  const starterFedTimes=useMemo(()=>shownFeedRecords.flatMap(record=>[record.plannedAt,record.actualAt]),[shownFeedRecords]);
  // Feeds recorded on the generated plan: the plan is kept as recorded and every re-plan keeps the levain %
  // it was built for (18 Nov 2026 retention, Priya's late feed).
  const starterFactsKept=yeastType==='sourdough'&&!!recipeGenerated&&starterFeedRecords.length>0&&!starterRecoveryPending&&!mixExecution;
  const missedStarterFeed=yeastType==='sourdough'&&recipeGenerated&&!mixExecution&&!starterRecoveryPending?overdueStarterFeed(guideStarterEvents,shownFeedRecords,executionClock,+startTime):undefined;
  // A replan after recorded feeds starts from the latest one (the plan itself is kept while feeds are
  // confirmed, so the starter answers still describe the starter before the first of them). Where the
  // kept plan has put it in the fridge since, it is planned from the fridge.
  function recordedFeedAnchor(records:StarterFeedRecord[]) {
    // A feed ticked ahead of its time is not a fed starter yet.
    const latest=[...records].filter(record=>record.actualAt<=Date.now()).sort((a,b)=>a.actualAt-b.actualAt).at(-1);
    if(!latest||lastFedTime&&+lastFedTime>=latest.actualAt)return null;
    const now=Date.now(),passed=starterEvents.filter(e=>+e.time>latest.actualAt&&+e.time<=now&&(e.kind==='fridge_in'||e.kind==='fridge_out')).sort((a,b)=>+a.time-+b.time);
    const fridge=passed.at(-1)?.kind==='fridge_in';
    const ageH=(now-latest.actualAt)/3600000;
    const age:'today'|'yesterday'|'days23'|'days45'|'week'=ageH<24?'today':ageH<48?'yesterday':ageH<96?'days23':ageH<144?'days45':'week';
    return {lastFedTime:latest.actualAt,lastFeedRatio:latest.ratio as 1|2|4|5|10,planningMode:'last_fed' as const,lastFedAge:age,knownPeakTime:null,hasNotFedYet:false,
      starterLocation:(fridge?'fridge':'rt') as 'rt'|'fridge',starterState:(fridge?'fridge_fed':'rt_fed') as 'rt_fed'|'fridge_fed'};
  }
  function applyFeedAnchor(a:NonNullable<ReturnType<typeof recordedFeedAnchor>>) {
    setSimpleStarterAnswer(null);setLastFedTime(new Date(a.lastFedTime));setLastFeedRatio(a.lastFeedRatio);setPlanningMode('last_fed');setLastFedAge(a.lastFedAge);setKnownPeakTime(null);setHasNotFedYet(false);setStarterLocation(a.starterLocation);setStarterState(a.starterState);
  }
  function requestSourdoughMixReplan() {
    // A planned mixing time passing says nothing about whether dough exists.
    // Preserve observed feeds; regenerate only the unconfirmed future chain.
    const anchor=recordedFeedAnchor(starterFeedRecords);if(anchor)applyFeedAnchor(anchor);
    const history=anchor?[]:starterEvents.filter(event=>event.kind==='last_fed'||event.kind==='known_peak');
    setStarterRecoveryPending(true);setStarterEvents(history);setTimingOverrides({});
    setFeedTime(null);setFeed2Time(null);setUsingPeak2(false);setFridgeOutTime(null);setStarterFridgeInTime(null);
    setAcceptedScheduleRepair(null);setSessionRestored(false);setProtocolStale(true);setStarterTimingValid(false);setStarterPlanResetKey(k=>k+1);
    setSetupOverview(false);setActiveStep(7);setAdvancedStep(9);openDestination('organisation');
    saveSession(buildSessionPayload({starterRecoveryPending:true,starterEvents:serializeStarterEvents(history),timingOverrides:{},protocolStale:true,starterTimingValid:false,feed2Time:null,usingPeak2:false,fridgeOutTime:null,starterFridgeInTime:null,...(anchor?{...anchor,simpleStarterAnswer:null}:{})}));
  }
  // A levain dough already mixed: whether its remaining steps still fit before the fixed bake.
  function sourdoughDoughFitsFrom(mix:Date) {
    if(!eatTime||!styleKey||!mixerType||+mix>=+eatTime)return false;
    const plan=buildSchedule(mix,eatTime,blocks,kitchenTemp,planPreheatMin,mixerType,styleKey,numItems,selectedMixingBatches,true,levainBulkFactor,exitLeadMin,planLadder);
    // Its hands-on steps from now on must stay out of the busy times (a midnight shaping is a clash).
    return +plan.bakeStart===+eatTime&&hasCoherentScheduleShape(plan,mix)&&!plan.bulkConflict
      &&!findAvailabilityConflicts(planActions(plan.availabilityActions??[],[],+mix),blocks,Date.now()).length;
  }
  // Whether the dough still fits before the fixed bake when a late or early feed moves the mix.
  function sourdoughMixFits(mix:Date) {
    if(!eatTime||!styleKey||!mixerType||+mix<=Date.now()||+mix>=+eatTime)return false;
    const minH=Math.max(1,(STYLE_FERM_DEFAULTS[styleKey]?.minTotalFermH??4)+sourdoughBulkH(styleKey,kitchenTemp)*(levainBulkFactor-1));
    if(+eatTime-+mix<minH*3600000)return false;
    const plan=buildSchedule(mix,eatTime,blocks,kitchenTemp,planPreheatMin,mixerType,styleKey,numItems,selectedMixingBatches,true,levainBulkFactor,exitLeadMin,planLadder);
    return +plan.bakeStart===+eatTime&&hasCoherentScheduleShape(plan,mix)&&!plan.preparationInvalid&&!plan.bulkConflict;
  }
  // "Step done" on a feed: the plan's own time, nothing re-timed, no time shown; the plan assumes the feed was done
  // as planned (18 Nov 2026 retention round 4, owner's design). Only a typed time ("Different time?") moves the plan.
  function tickStarterFeed(feedEvent:StarterEvent,done:boolean) {
    const plannedAt=+feedEvent.time;
    if(!['refresh','intermediate_refresh','pre_mix'].includes(feedEvent.kind))return;
    const records=done
      ?(starterFeedRecords.some(record=>record.plannedAt===plannedAt||record.actualAt===plannedAt)?starterFeedRecords:[...starterFeedRecords,{kind:feedEvent.kind as StarterFeedRecord['kind'],plannedAt,actualAt:plannedAt,recordedAt:Math.max(Date.now(),plannedAt),ratio:feedEvent.feedingRatio??nextFeedRatio,stated:false}])
      :starterFeedRecords.filter(record=>record.stated||record.plannedAt!==plannedAt);
    if(records===starterFeedRecords||records.length===starterFeedRecords.length&&!done)return;
    setStarterFeedRecords(records);
    saveSession(buildSessionPayload({starterFeedRecords:records}));
  }
  function updateStarterAfterMissedFeed(actualAt?:number,feedEvent:StarterEvent|undefined=missedStarterFeed) {
    if(actualAt!==undefined)try{confirmationAt.current=Date.now();}catch{}
    if(!feedEvent||!['refresh','intermediate_refresh','pre_mix'].includes(feedEvent.kind)||actualAt!==undefined&&(!Number.isFinite(actualAt)||actualAt>Date.now()))return;
    // A feed of the jar the other bake plans (one jar, two bakes; round 8, S6): recorded here as a fact, so both
    // bakes show it done; the plan that owns it is the other bake's, so nothing is re-planned from this one.
    if(!starterEvents.includes(feedEvent)){
      if(actualAt===undefined)return;
      const records=[...starterFeedRecords,{kind:feedEvent.kind as StarterFeedRecord['kind'],plannedAt:+feedEvent.time,actualAt,recordedAt:Date.now(),ratio:feedEvent.feedingRatio??nextFeedRatio,stated:actualAt!==+feedEvent.time}];
      setStarterFeedRecords(records);saveSession(buildSessionPayload({starterFeedRecords:records}));
      return;
    }
    const observations=starterEvents.filter(event=>event.kind==='last_fed'||event.kind==='known_peak');
    const usedRatio=feedEvent.feedingRatio??nextFeedRatio;
    const records=actualAt===undefined?starterFeedRecords:[...starterFeedRecords,{kind:feedEvent.kind as StarterFeedRecord['kind'],plannedAt:+feedEvent.time,actualAt,recordedAt:Date.now(),ratio:usedRatio,stated:actualAt!==+feedEvent.time,previousFedAt:lastFedTime?+lastFedTime:undefined,previousPeakAt:knownPeakTime?+knownPeakTime:undefined}];
    // A generated plan keeps its times: a feed done records the fact and moves only the steps that
    // depend on it (shiftStarterPlanAfterFeed). The baker stays where she is; nothing is re-solved
    // unless the dough no longer fits before the bake (17 Nov 2026 retention review).
    if(actualAt!==undefined&&recipeGenerated&&!starterRecoveryPending&&eatTime){
      // Only what the feed's rise affects moves, into free time where there is some (shiftStarterPlanAfterFeed).
      const shifted=shiftStarterPlanAfterFeed(starterEvents,feedEvent,actualAt,+startTime,d=>peakClock(d,fr),{
        now:Date.now(),busy:ms=>isTimeBlocked(ms,blocks),
        mixFits:ms=>!sourdoughMixFits(new Date(ms))?false:sourdoughDoughFitsFrom(new Date(ms))?'free':'busy'});
      const nextStart=new Date(+startTime+shifted.mixShiftMs);
      if(shifted.fits){
        const remap=(d:Date|null)=>d&&shifted.moved.has(+d)?new Date(shifted.moved.get(+d)!):d;
        const overrides:TimingOverrides={...timingOverrides};
        for(const key of ['feed','refresh'] as const){const at=overrides[key];if(at!==undefined&&shifted.moved.has(at))overrides[key]=shifted.moved.get(at);}
        if(overrides.mix!==undefined)overrides.mix+=shifted.mixShiftMs;
        const nextKey=starterPlanResetKey+1;
        const fridgeOut=remap(fridgeOutTime),fridgeIn=remap(starterFridgeInTime),feed2=remap(feed2Time);
        // The fed starter is the planner's starting point from now on: a later re-plan (Find compatible
        // times, Fine-tune, a reload) starts from this feed, never from the starter answers before it.
        setSimpleStarterAnswer(null);setLastFedTime(new Date(actualAt));setLastFeedRatio(usedRatio);setPlanningMode('last_fed');setLastFedAge('today');setKnownPeakTime(null);setHasNotFedYet(false);setStarterLocation('rt');setStarterState('rt_fed');
        setStarterFeedRecords(records);setStarterEvents(shifted.events);setTimingOverrides(overrides);
        setFeedTime(remap(feedTime));setFeed2Time(feed2);setFridgeOutTime(fridgeOut);setStarterFridgeInTime(fridgeIn);
        // Remount the hidden planner frozen on the kept plan, so it shows it rather than re-solving it.
        setSessionRestored(true);setStarterPlanResetKey(nextKey);
        setAcceptedScheduleRepair(confirmedSchedulePlan?repairKey(nextStart,eatTime,blocks,prefOffsetH,prefGoesInFridge,nextKey):null);
        const accepted=acceptedPlan&&shifted.mixShiftMs?{...acceptedPlan,startTime:+nextStart,preparationAt:+nextStart}:acceptedPlan;
        if(shifted.mixShiftMs){setStartTime(nextStart);setAcceptedPlan(accepted);setPlanMoved({from:+startTime,to:+nextStart});}
        // No free option: the plan keeps the fed chain and Preparation says once that the rest needs new times.
        setExecutionClash(shifted.busy);
        saveSession(buildSessionPayload({starterFeedRecords:records,starterEvents:serializeStarterEvents(shifted.events),timingOverrides:overrides,startTime:+nextStart,executionClash:shifted.busy,
          simpleStarterAnswer:null,lastFedTime:actualAt,lastFeedRatio:usedRatio,planningMode:'last_fed',lastFedAge:'today',knownPeakTime:null,hasNotFedYet:false,starterLocation:'rt',starterState:'rt_fed',
          fridgeOutTime:fridgeOut?+fridgeOut:null,feed2Time:feed2?+feed2:null,starterFridgeInTime:fridgeIn?+fridgeIn:null,
          acceptedStartTime:accepted?.startTime,acceptedPreparationAt:accepted?.preparationAt}));
        return;
      }
    }
    // Earlier observations stay archived in the feed record; only the latest
    // observed feed is the active solver anchor after a new feeding.
    const anchor=actualAt===undefined?recordedFeedAnchor(records):null;if(anchor)applyFeedAnchor(anchor);
    const history=actualAt===undefined&&!anchor?observations:[];
    setStarterRecoveryPending(true);setStarterFeedRecords(records);setStarterEvents(history);setTimingOverrides({});
    if(actualAt!==undefined){setSimpleStarterAnswer(null);setLastFedTime(new Date(actualAt));setLastFeedRatio(usedRatio);setPlanningMode('last_fed');setLastFedAge('today');setKnownPeakTime(null);setHasNotFedYet(false);setStarterLocation('rt');setStarterState('rt_fed');}
    setFeedTime(null);setFeed2Time(null);setUsingPeak2(false);setFridgeOutTime(null);setStarterFridgeInTime(null);
    setAcceptedScheduleRepair(null);setSessionRestored(false);setProtocolStale(true);setStarterTimingValid(false);setStarterPlanResetKey(k=>k+1);
    setSetupOverview(false);setActiveStep(7);setAdvancedStep(9);openDestination('organisation');
    saveSession(buildSessionPayload({starterRecoveryPending:true,starterFeedRecords:records,starterEvents:serializeStarterEvents(history),timingOverrides:{},protocolStale:true,starterTimingValid:false,feed2Time:null,usingPeak2:false,fridgeOutTime:null,starterFridgeInTime:null,...(anchor?{...anchor,simpleStarterAnswer:null}:{}),...(actualAt!==undefined?{lastFedTime:actualAt,lastFeedRatio:usedRatio,planningMode:'last_fed',lastFedAge:'today',knownPeakTime:null,hasNotFedYet:false,starterLocation:'rt',starterState:'rt_fed'}:{})}));
  }
  const commercialMethod=prefermentType==='none'||prefermentType==='poolish'||prefermentType==='biga'?prefermentType:null;
  const plannedPreparationAt=+startTime-(commercialMethod&&commercialMethod!=='none'?prefOffsetH*3600000:0);
  // What the "made?" questions ask about: the accepted plan while an edit is pending.
  const promptedPrepAt=promptedPreparationAt(plannedPreparationAt,acceptedPlan?.preparationAt,protocolStale);
  const promptedMixAt=promptedPreparationAt(+startTime,execution?undefined:acceptedPlan?.startTime,protocolStale);
  function madeFormulaMatches(fact:BakeExecution,candidateSchedule:ScheduleResult,times:{prefHours:number},mixedRecipe?:NonNullable<typeof recipe>) {
    if(!styleKey||!ovenType||!yeastType)return false;
    const calculated=calculateRecipe(styleKey,ovenType as OvenType,numItems,itemWeight,kitchenTemp,humidity,candidateSchedule,fridgeTemp,yeastType,'custom',mixerType??'hand',manualHydration,manualOil,manualSugar,flourChosen?flourBlend:undefined,fact.method,priorityOverride,prefermentFlourPct??20,manualSalt,targetDoughTemp,flourInFridge,wasteAllowance,fact.inFridge,feedToMixH,fact.method!=='none'?times.prefHours:undefined,measuredFlourTemp,prefTempForBalance,totalFlourTarget);
    if(calculated.protocolIssue)return false;
    const same=(a:number|undefined,b:number|undefined)=>a!==undefined&&b!==undefined&&Math.abs(a-b)<0.0005;
    if(fact.method!=='none'&&!mixExecution&&!mixedRecipe)return !!calculated.preferment&&!!fact.recipe.preferment
      &&same(calculated.preferment.prefFlour,fact.recipe.preferment.prefFlour)
      &&same(calculated.preferment.prefWater,fact.recipe.preferment.prefWater)
      &&same(calculated.preferment.prefYeastGrams,fact.recipe.preferment.prefYeastGrams);
    const used=mixedRecipe??mixExecution?.recipe??fact.recipe;
    return ['flour','water','salt','oil','sugar'].every(key=>same(calculated[key as 'flour'],used[key as 'flour']))
      &&same(calculated.yeast?.convertedGrams,used.yeast?.convertedGrams);
  }
  // A tap ("Step done", "Yes, at …", "Already done") records the plan's time and states none; only a time the
  // baker gives ("Different time?") is shown and moves the plan (18 Nov 2026 retention round 4, owner's design).
  function markPreparationMade(at:number,tap=false) {
    try{confirmationAt.current=Date.now();}catch{}
    if(tap)at=plannedPreparationAt;
    if(!recipe||!commercialMethod||!Number.isFinite(at)||(!tap&&at>Date.now()))return;
    const recordedAt=Math.max(Date.now(),at),stated=!tap&&at!==plannedPreparationAt;
    const actual:BakeExecution=execution?{...execution,actualAt:at,recordedAt,stated}:{method:commercialMethod,actualAt:at,recordedAt,stated,inFridge:prefGoesInFridge,prefHours:prefOffsetH,prefWindow:commercialPrefermentWindow(commercialMethod,prefGoesInFridge,kitchenTemp,styleKey??'',fridgeTemp),recipe};
    const mix=commercialMethod==='none'?new Date(at):startTime;
    const nextOffset=commercialMethod==='none'?0:(+mix-at)/3600000;
    // Recorded within the plan's 15 minutes (round 11, Maya: mixed 1 min early): the dough in the bowl is the plan's,
    // so the remaining plan is judged on its times and busy periods only, never on the dose that minute would call for.
    const onPlan=recordedOnPlan(at,plannedPreparationAt);
    const remainingValid=!!eatTime&&validateConfirmedBake({...poolishInputs,execution:actual,start:mix,bake:eatTime,blocks,kitchenTemp,fridgeTemp,styleKey:styleKey??'',flourStrength,preheatMin:planPreheatMin,exitLeadMin,planLadder,mixerType:mixerType??'hand',numItems,mixingBatches:selectedMixingBatches,formulaValid:onPlan?undefined:(candidate,times)=>madeFormulaMatches(actual,candidate,times)}).valid;
    // A recorded fact is not a change of choices: no "You changed your choices" card and no trip to setup.
    // A remaining plan that no longer works is said in Preparation, by Adjust timing (17 Nov 2026 retention round 2).
    setExecution(actual);setReplanRequested(false);setStartTime(mix);setPrefOffsetH(nextOffset);setTimingOverrides({});setSessionRestored(true);setScheduleCandidateValid(remainingValid);setExecutionClash(!remainingValid);
    saveSession(buildSessionPayload({execution:actual,startTime:+mix,prefOffsetH:nextOffset,timingOverrides:{},executionClash:!remainingValid}));
    if(destination!=='protocol'&&destination!=='service')openDestination('recipe');
  }
  function markMixMade(at:number,prepared=execution,tap=false) {
    try{confirmationAt.current=Date.now();}catch{}
    if(tap)at=+startTime;
    if(!recipe||!eatTime||!Number.isFinite(at)||(!tap&&at>Date.now()))return;
    // The dough cannot be mixed before its preferment: a preferment recorded later than the planned mix (it was
    // confirmed late) moves the mix to it rather than leaving "Yes, at …" without effect (17 Nov 2026 retention round 2).
    if(prepared&&at<prepared.actualAt){if(prepared.actualAt>Date.now())return;at=prepared.actualAt;}
    const actual:MixExecution={actualAt:at,recordedAt:Math.max(Date.now(),at),recipe:mixExecution?.recipe??recipe,stated:!tap&&at!==+startTime};
    const mix=new Date(at),offset=prepared?(at-prepared.actualAt)/3600000:prefOffsetH;
    // Mixed within half an hour of the plan: the plan holds; a few minutes are not a new plan (17 Nov review).
    const onTime=Math.abs(at-+startTime)<=30*60_000&&!!scheduleCandidateValid;
    const valid=onTime||(prepared?validateConfirmedBake({...poolishInputs,completedMixAt:at,execution:prepared,start:mix,bake:eatTime,blocks,kitchenTemp,fridgeTemp,styleKey:styleKey??'',flourStrength,preheatMin:planPreheatMin,exitLeadMin,planLadder,mixerType:mixerType??'hand',numItems,mixingBatches:selectedMixingBatches,formulaValid:(candidate,times)=>madeFormulaMatches(prepared,candidate,times,actual.recipe)}).valid:yeastType==='sourdough'?sourdoughDoughFitsFrom(mix):at===+startTime&&starterTimingValid&&scheduleCandidateValid);
    if(prepared)setExecution(prepared);
    // Recording the mix never routes into setup and never gates the guide: the dough exists, the steps that
    // follow are what the baker needs. A plan that no longer fits is said in Preparation (17 Nov 2026 retention round 2).
    setStarterRecoveryPending(false);setMixExecution(actual);setStartTime(mix);setPrefOffsetH(offset);setTimingOverrides({});setSessionRestored(true);setScheduleCandidateValid(valid);setExecutionClash(!valid);
    saveSession(buildSessionPayload({execution:prepared,starterRecoveryPending:false,mixExecution:actual,startTime:at,prefOffsetH:offset,timingOverrides:{},executionClash:!valid}));
    // Confirmed from Preparation or Baking & serving: stay there; elsewhere the recipe, whose plan says it too.
    if(destination!=='protocol'&&destination!=='service')openDestination('recipe');
  }
  function requestRemainingMixPlan() {
    if(mixExecution)return;
    if(yeastType==='sourdough'){requestSourdoughMixReplan();return;}
    // "Not yet" re-times through Adjust timing, with its way back (18 Nov 2026 retention round 3).
    setReplanRequested(true);editRecipeTiming();
  }
  const needsMixCheck=!!mixExecution||((yeastType==='sourdough'||!!execution&&execution.method!=='none')&&!missedStarterFeed&&(promptedMixAt<=executionClock||destination==='protocol'));
  function recordGuideMix(done:boolean) {
    if(!done){
      if(mixExecution){setMixExecution(undefined);setExecutionClash(false);saveSession(buildSessionPayload({mixExecution:undefined,executionClash:false}));}
      else if(execution?.method==='none'){setExecution(undefined);saveSession(buildSessionPayload({execution:undefined}));}
    }else if(!mixExecution&&execution?.method!=='none'){
      // A tick is the plan's time, never the minute of the tap (18 Nov 2026 retention round 4).
      const at=+startTime;
      if(yeastType==='sourdough'||execution)markMixMade(at,execution,true);
      else if(commercialMethod&&commercialMethod!=='none'&&recipe){
        // Done confirms the planned sequence when the preferment checkbox was
        // skipped; never mistake the mixing time for preferment preparation.
        if(plannedPreparationAt>Math.max(at,Date.now()))return;
        markMixMade(at,{method:commercialMethod,actualAt:plannedPreparationAt,recordedAt:Math.max(Date.now(),plannedPreparationAt),stated:false,inFridge:prefGoesInFridge,prefHours:prefOffsetH,prefWindow:commercialPrefermentWindow(commercialMethod,prefGoesInFridge,kitchenTemp,styleKey??'',fridgeTemp),recipe},true);
      }else markPreparationMade(at,true);
    }
  }
  function requestFreshPlan() {
    if(execution||mixExecution)return;
    setReplanRequested(true);editRecipeTiming();
  }
  useEffect(()=>{if(destination!=='organisation')setReplanRequested(false);},[destination]);
  useEffect(()=>{if(!recipeGenerated)setGuideClock(null);},[recipeGenerated]);
  // A resumed bake opens on the section of the step the bar names (header and page agree: a take-out at the
  // preheat is a Preparation step), once the guide has said which step that is (18 Nov 2026 retention round 4).
  const resumeSectionPending=useRef(false);
  useEffect(()=>{
    if(!resumeSectionPending.current||!guideClock||guideClock.kind!=='now')return;
    resumeSectionPending.current=false;
    if(destination==='service'&&!guideClock.cooking){setProtocolView('dough');openDestination('protocol');}
    else if(destination==='protocol'&&guideClock.cooking){setServiceView('dough');openDestination('service');}
  },[guideClock]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!resumeToNow.current||!recipeGenerated)return;
    resumeToNow.current=false;
    const now=Date.now();
    // Under way once anything of the plan is due: a preferment or a starter feed counts, not only the mix.
    const firstDue=Math.min(+startTime,plannedPreparationAt,...starterEvents.filter(event=>event.kind!=='last_fed'&&event.kind!=='known_peak').map(event=>+event.time));
    // Within half a day of the first step, the bake reopens where its Now/Next step is, not on the section it
    // was left on while planning (18 Nov 2026 retention round 4: Baking & serving while "Next: Start Dough").
    if(bakedDone||!(execution||mixExecution||firstDue<=now+12*3600_000))return;
    // The section of the step the bar names (the guide's own snapshot), so header and page agree (a take-out at
    // the preheat is a Preparation step); without one, the oven from 90 minutes before the bake.
    const plan=(()=>{try{const id=journalId??currentJournalId();return id?guidePlanSnapshot(id):null;}catch{return null;}})();
    const mark=plan?clockMark(plan.steps,now):null;
    const markedPhase=mark?plan!.steps.find(step=>step.step===mark.step)?.phase:undefined;
    const oven=markedPhase?markedPhase==='cooking':!!eatTime&&+eatTime-90*60_000<=now;
    // Without a saved snapshot the guide's first report settles it (below).
    if(!markedPhase){resumeSectionPending.current=true;window.setTimeout(()=>{resumeSectionPending.current=false;},4000);}
    if(destination===(oven?'service':'protocol'))return;
    if(oven){setServiceView('dough');openDestination('service');}
    else{setProtocolView('dough');openDestination('protocol');}
  },[recipeGenerated,destination]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!execution&&!mixExecution)return;if(destination==='organisation'){setActiveStep(7);setAdvancedStep(9);setSetupOverview(false);}else if(destination==='batch'&&batchView!=='fillings')openDestination('recipe');},[execution,mixExecution,destination,batchView,activeStep,advancedStep,setupOverview]);
  function acceptFreshPlan(method:'none'|'poolish'|'biga',mix:Date,bake:Date,hours:number,inFridge:boolean,newBlocks:AvailabilityBlock[]) {
    if(execution||mixExecution)return;
    setPrefermentType(method);setPrefermentChosen(true);setPrefOffsetH(hours);setPrefGoesInFridgeState(inFridge);
    // A preferment plan replaces a direct-dough yeast amount; the offer said so before this tap.
    const replacesYeast=method!=='none'&&yeastPctOverride!==undefined;
    if(replacesYeast)setYeastPctOverride(undefined);
    setStartTime(mix);setEatTime(bake);setBlocks(newBlocks);setTimingOverrides({});setReplanRequested(false);
    setSessionRestored(true);setProtocolStale(false);setScheduleCandidateValid(true);setPrefermentValidity({type:method,valid:true});
    setAcceptedScheduleRepair(null);setStarterPlanResetKey(k=>k+1);
    const accepted={startTime:+mix,preparationAt:+mix-(method!=='none'?hours*3600000:0),bakeAt:+bake};setAcceptedPlan(accepted);
    saveSession(buildSessionPayload({...(replacesYeast?{yeastPctOverride:undefined}:{}),acceptedStartTime:accepted.startTime,acceptedPreparationAt:accepted.preparationAt,acceptedEatTime:accepted.bakeAt,prefermentType:method,prefermentChosen:true,prefOffsetH:hours,prefGoesInFridge:inFridge,startTime:+mix,eatTime:+bake,timingOverrides:{},protocolStale:false,computedRecipe:null,blocks:newBlocks.map(b=>({...b,from:+b.from,to:+b.to}))}));
    openDestination('recipe');
  }

  // ── Handlers ──────────────────────────────
  const [showProductHome,setShowProductHome]=useState(false);
  // Every bake under way stays on home, whatever the draft holds (18 Nov 2026 retention round 4: a tap on a family
  // card, or rating one bake, hid the others, even after a reload). The rows come from the journal each time home
  // shows; one bake that is the draft keeps the single Resume card (owner's rule B).
  const homeShown = showWelcomeBack || !bakeType || showProductHome;
  useEffect(() => {
    if (!homeShown) return;
    try {
      const rows = liveJournalBakes(Date.now(), locale);
      const draftShown = !!pendingSession?.recipeGenerated || (!!bakeType && recipeGenerated);
      // Two bakes on one jar: one row for the jar's step (round 8, S6); with one bake the rows are unchanged.
      setLiveBakes(rows.length === 1 && rows[0].entry.id === currentJournalId() && draftShown ? [] : mergeSharedJarRows(rows, Date.now(), locale));
    } catch {}
  }, [homeShown, locale, pendingSession, bakeType, recipeGenerated, journalId]);
  const navigationHistory=useRef<string|null>(null);
  const replayingNavigation=useRef(false);
  const bakeTypeRef=useRef(bakeType);bakeTypeRef.current=bakeType;
  useEffect(()=>{
    const pop=(event:PopStateEvent)=>{
      const saved=event.state?.bakerNavigation;
      if(!saved)return;
      if(!bakeTypeRef.current){
        // After a reload the bake waits behind "Resume": Back has no bake to replay
        // a route onto, so stay on the home screen with the Resume card.
        setShowProductHome(true);setActiveTab('batch');setBatchView('style');
        setActiveStep(1);setAdvancedStep(1);setSetupOverview(false);
        return;
      }
      replayingNavigation.current=true;
      setShowProductHome(saved.home||(!saved.family));
      setActiveTab(saved.route);setBatchView(saved.view);
      setActiveStep(saved.simpleStep);setAdvancedStep(saved.customStep);
      setSetupOverview(saved.overview);
    };
    window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
  },[]);
  useEffect(()=>{
    if(isRestoringRef.current)return;
    const value={home:showProductHome||!bakeType,family:bakeType,route:activeTab,view:batchView,simpleStep:activeStep,customStep:advancedStep,overview:setupOverview};
    const encoded=JSON.stringify(value);
    if(encoded===navigationHistory.current)return;
    if(navigationHistory.current===null||replayingNavigation.current){
      history.replaceState({...history.state,bakerNavigation:value},'');
    }else history.pushState({...history.state,bakerNavigation:value},'');
    navigationHistory.current=encoded;replayingNavigation.current=false;
  // scheduleRestoreRevision: a restored bake records its entry once restoring ends,
  // so a reload before any further navigation still knows which destination it was on.
  },[showProductHome,bakeType,activeTab,batchView,activeStep,advancedStep,setupOverview,sessionRestored,scheduleRestoreRevision]);
  function backToProducts(){setShowProductHome(true);setActiveTab('batch');scrollToStepTop();}
  async function selectBakeType(bt: BakeType) {
    // Choosing a family preserves the unapplied draft before starting fresh.
    if (!bakeType) {
      if (!startRecoverableBake()) return;
      setPendingSession(null); setShowWelcomeBack(false);
    }
    if(bakeType===bt){setShowProductHome(false);setActiveTab('batch');setBatchView('style');return;}
    if(bakeType&&(styleKey||hasWorkInProgress)&&!window.confirm(fr?'Changer de famille réinitialise les choix de cette fournée. Continuer ?':'Changing product family resets this bake’s choices. Continue?'))return;
    setShowProductHome(false);
    setActiveTab('batch');setBatchView('style');setFillingsReturn(null);setPrepReturnToService(null);setShoppingReturnToFillings(false);
    setSandwichParty(createSandwichSnapshot());
    // Switching to bread retires any Pizza Party selections + their persisted
    // ticks so a bread bake never carries stale pizza toppings (spec: hide +
    // uncheck Pizza Night silently). Switching to pizza keeps nothing stale
    // because bread has no pizza-party state.
    if (bt === 'bread') {
      setPizzaPartyQtys({});
      setPizzaPartyTab('pick');
      try {
        localStorage.removeItem('bh_shop_ticks_v1');
        localStorage.removeItem('bh_prep_ticks_v1');
      } catch {}
    }
    setConfirmedSettings([]);
    setBakeType(bt);
    setTotalFlourTarget(undefined);
    setStyleKey(null);
    setOvenType(null); setOvenConstruction('tabletop');
    setActiveStep(1);
    setHighestStep(1);
    // Custom flow counters must reset too — otherwise a stale high step
    // leaves later steps (Oven, Mixer…) marked completed while their
    // values were just cleared, making them look "skipped".
    setAdvancedStep(1);
    setAdvancedHighestStep(1);
    // Deliberately NOT setModeChosen(true): picking a bake type used to drop
    // the baker straight into setup, because the mode was a permanent bar at
    // the top they could flip at any time. It is a page now, so choosing Pizza
    // has to lead to it rather than past it.

    // ── Last bake's equipment (oven by family, kneading, commercial yeast), under the profile ──
    const last = loadLastEquipment();
    const lastOven = bt === 'bread' ? last.ovenBread : last.ovenPizza;
    // No oven of this family yet: the other family's oven maps across (18 Nov 2026 retention round 3: bread → pizza lost it).
    const crossOven = bt === 'bread'
      ? ({home_oven_steel:'home_oven_stone_bread',home_oven_standard:'standard_bread',pizza_oven:'wood_fired'} as Record<string,string>)[last.ovenPizza ?? '']
      : ({home_oven_stone_bread:'home_oven_steel',dutch_oven:'home_oven_standard',standard_bread:'home_oven_standard',steam_oven:'home_oven_standard',wood_fired:'pizza_oven'} as Record<string,string>)[last.ovenBread ?? ''];
    const ovenChoice = lastOven ?? crossOven;
    const keptOven = ovenChoice && ovenChoice in (bt === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES) ? ovenChoice as AnyOvenType : null;
    const keptMixer = last.mixer && last.mixer in MIXER_TYPES ? last.mixer as MixerType : null;
    const keptYeast = last.yeast && last.yeast in YEAST_TYPES && last.yeast !== 'sourdough' ? last.yeast as YeastType : null;
    if (keptOven) { setOvenType(keptOven); confirmSetting('oven',keptOven); markProfile('last'); }
    if (keptMixer) { setMixerType(keptMixer); setWaterMethod(keptMixer==='spiral'?'direct':'premelt'); confirmSetting('mixer',keptMixer); markProfile('last'); }
    if (keptYeast) { setYeastType(keptYeast); confirmSetting('yeast',keptYeast); markProfile('last'); }
    // The kitchen and the flour of the last recipe carry over like the oven (18 Nov 2026 retention round 4:
    // a new bake from scratch was back at 22 °C and the generic flour). The profile's fridge still wins below.
    if (typeof last.kitchenTemp === 'number' && last.kitchenTemp >= 10 && last.kitchenTemp <= 40) {
      setKitchenTemp(last.kitchenTemp); confirmSetting('climate',last.kitchenTemp); setCustomKitchenConfirmed(true);
      if (typeof last.fridgeTemp === 'number' && last.fridgeTemp >= 0 && last.fridgeTemp <= 12) setFridgeTemp(last.fridgeTemp);
    }
    const lastFlour = bt === 'bread' ? last.flourBread : last.flourPizza;
    const knownFlour = (key: unknown) => typeof key === 'string' && key in FLOUR_DATA;
    if (lastFlour && knownFlour(lastFlour.flour1) && (!lastFlour.flour2 || knownFlour(lastFlour.flour2)) && (!lastFlour.flour3 || knownFlour(lastFlour.flour3)) && !archivedBlendSelections(lastFlour).length) { setFlourBlend({...lastFlour}); setFlourChosen(true); }
    // ── Baker profile prefill — bakeType-compatible defaults, always overridable ──
    const prof = loadProfile();
    if (prof) {
      let applied = false;
      const ovenPool = bt === 'bread' ? BREAD_OVEN_TYPES : OVEN_TYPES;
      const prefOven = (bt === 'bread' ? prof.ovenTypeBread : prof.ovenTypePizza) ?? prof.ovenType;
      if (prefOven && prefOven in ovenPool) {
        setOvenType(prefOven as AnyOvenType); confirmSetting('oven',prefOven); markProfile('oven'); applied = true;
      }
      // Style is deliberately NOT prefilled. Oven, mixer and yeast describe the
      // baker's kitchen and are stable between bakes; the style is the one
      // creative decision of THIS bake. Prefilling it meant a returning baker
      // was handed a Neapolitan they never picked — and once Suivant started
      // skipping answered steps, they never even saw the page to change it.
      if (prof.mixerType && prof.mixerType in MIXER_TYPES) {
        setMixerType(prof.mixerType as MixerType); setWaterMethod(prof.mixerType==='spiral'?'direct':'premelt'); applied = true; markProfile('equip'); confirmSetting('mixer',prof.mixerType);
      }
      // The style-yields-to-sourdough rule went with the style prefill: with no
      // style applied there is nothing for the yeast preference to yield to.
      // The baker picks a sourdough-native style themselves, and selectStyle
      // already forces levain when they do.
      if (prof.yeastType && prof.yeastType in YEAST_TYPES) {
        setYeastType(prof.yeastType as YeastType); applied = true; markProfile('yeast'); confirmSetting('yeast',prof.yeastType);
      }
      // Preferment — Custom-mode preference only (Simple has no preferment
      // step to change it in), and never on the sourdough path (levain).
      // Pizza only — biga/poolish preferences are pizza-centric; bread has its
      // own preferment conventions and shouldn't inherit the pizza pick.
      if (bt !== 'bread' && prof.prefermentType && prof.preferredMode === 'custom'
          && prof.yeastType !== 'sourdough'
          && ['none', 'poolish', 'biga'].includes(prof.prefermentType)) {
        // The profile IS an answer — the baker set it, just not in this
        // session. That is the whole point of the rule: profile or baker,
        // never a code default.
        setPrefermentType(prof.prefermentType as PrefermentType); applied = true;
        markProfile('preferment'); confirmSetting('method',prof.prefermentType); setPrefermentChosen(true);
      }
      if (prof.fridgeTemp !== undefined) { setFridgeTemp(prof.fridgeTemp); applied = true; }
      if (prof.preferredMode) { setTab(prof.preferredMode); applied = true; }
      if (prof.starter) {
        setStarterMature(prof.starter.mature);
        setStarterHasRye(prof.starter.hasRye);
        setTang(prof.starter.tang);
      }
      if (applied) setProfilePrefilled(true);
      // The flow always opens on Style now. It is the one page a returning
      // baker still has to answer, and Suivant skips whatever the profile
      // already covered from there.
    }
  }

  // First step whose value is genuinely missing — used when switching
  // Simple ↔ Custom so the baker lands exactly where input is needed,
  // with everything already answered marked complete (no re-clicking).
  // ── Share the CURRENT session — saves (signed-in) then opens the share
  // sheet via Header's openSessionId plumbing. Single source for the party
  // Bake tab, the Recipe-tab PlanNav pill and the Guide-end chip. ──
  // Du travail à l'écran : des pizzas choisies ou cuites comptent autant
  // qu'une recette générée.
  const hasWorkInProgress =
    Object.keys(sandwichParty.qtys).length > 0 ||
    Object.keys(pizzaPartyQtys).length > 0 ||
    Object.keys(bakedPartyQtys).length > 0 ||
    sessionSaved;

  // Une seule construction de l'instantané Pizza Party. Il en existait six,
  // dont cinq perdaient bakedQtys et toutes les six perdaient les cases
  // cochées — alors que SessionData les declare et qu'applySession sait deja
  // les relire. Le type et la lecture les attendaient, rien ne les ecrivait.
  //
  // Les ticks vivent dans localStorage (bh_shop_ticks_v1 / bh_prep_ticks_v1),
  // ecrits par ShoppingList et PrepTab. On les lit ici a l'enregistrement :
  // c'est la meme paire de cles qu'applySession reecrit a la restauration,
  // donc aucune migration Supabase — dough_snapshot est du jsonb.
  function buildPizzaPartySnapshot() {
    if (Object.keys(pizzaPartyQtys).length === 0) return null;
    let shopTicks: Record<string, boolean> | undefined;
    let prepTicks: string[] | undefined;
    try {
      const rawShop = localStorage.getItem('bh_shop_ticks_v1');
      if (rawShop) shopTicks = JSON.parse(rawShop) as Record<string, boolean>;
      const rawPrep = localStorage.getItem('bh_prep_ticks_v1');
      if (rawPrep) prepTicks = JSON.parse(rawPrep) as string[];
    } catch { /* mode prive : la fournee se sauve quand meme */ }
    return {
      qtys: pizzaPartyQtys,
      bakedQtys: Object.keys(bakedPartyQtys).length > 0 ? bakedPartyQtys : undefined,
      shopTicks,
      prepTicks,
    };
  }

  saveCurrentSessionRef.current = () => saveCurrentSession();
  shareCurrentSessionRef.current = () => shareCurrentSession();

  // Le baker avait demandé Sauvegarder ou Partager, on lui a demandé de se
  // connecter : il n'a pas à redemander. Le rejeu vit ici et pas dans
  // onAuthStateChange, qui se déclenche avant que la session locale soit
  // réappliquée — on aurait enregistré une session vide sur le compte.
  const replayedRef = useRef(false);
  useEffect(() => {
    if (!user || replayedRef.current) return;
    const intent = readAuthIntent();
    if (!intent) return;
    if (!restoreSettledRef.current) return;   // restauration en vol
    replayedRef.current = true;
    clearAuthIntent();
    setShowWelcomeBack(false);
    setCloudResume(null);        // rien d'autre ne s'offre à cet instant
    setShowSignInForSave(false);
    void (async () => {
      // Rendu visible : sans ça le baker revient connecté, ne voit rien
      // bouger, et croit devoir réappuyer sur Sauvegarder.
      setCloudSaveState('saving');
      try {
        // Sharing already saves once. Each handler owns its success/failure state.
        if (intent === 'share') await shareCurrentSessionRef.current?.();
        else await saveCurrentSessionRef.current?.();
      } catch (e) {
        console.error('Replay after sign-in failed:', e);
        setCloudSaveState('failed');
      }
    })();
  }, [user, authTick]);

  async function shareCurrentSession() {
    if (!user) {
      stashAuthIntent('share');
      window.dispatchEvent(new Event('bh-open-auth'));
      return;
    }
    if (await saveCurrentSession()) setShareSessionId(savedCloudIdRef.current);
  }

  function firstIncompleteStep(isCustom: boolean): number {
    if (!styleKey) return 1;
    if (isCustom && !customKitchenConfirmed) return 3;
    // Oven and mixing share the equipment page (3) since A2.
    if (!ovenType || !mixerType) return 3;   // qty (2) + climate (4) have sane defaults
    if (isCustom) {
      if (!flourAnswered || archivedFlourNames.length) return 6;
      if (showPrefermentChoice && !prefermentChosen) return 8;
      if (!isUnleavened && !yeastType) return 7;       // flour (6) has a default blend
      return 9;                       // preferment (8) defaults to Direct — scheduler is the goal
    }
    if (!isUnleavened && !yeastType) return 6;
    return 7;                         // scheduler
  }

  // Guidance level never changes the selected dough or leavening.
  const collectingBakeTime=awaitingRecipeChoice && tab==='simple' && !recipeGenerated;
  // The cooling note is said once on this device, before the first bake time is picked
  // (17 Nov 2026 retention: it repeated on every bake-time screen of every bake).
  const [coolingNoteSeen]=useState(()=>{try{return localStorage.getItem('bh_cooling_note_v1')==='1';}catch{return false;}});
  const showCoolingNote=!!styleKey&&collectingBakeTime&&!eatTime&&!coolingNoteSeen&&bakeType==='bread'&&!isUnleavened&&breadProtocol?.cooking!=='griddle'&&!['focaccia','fougasse'].includes(styleKey);
  useEffect(()=>{if(showCoolingNote)try{localStorage.setItem('bh_cooling_note_v1','1');}catch{}},[showCoolingNote]);
  const bakeTimeOnly=recipeGenerated && bakeTimeQuestion && !replanReturn;
  const customQuestionOnly=customBakeQuestion && !recipeGenerated && !planDetail;
  // The question-only view ends once the baker leaves the timing screen.
  useEffect(()=>{if(bakeTimeQuestion&&(destination!=='organisation'||setupOverview))setBakeTimeQuestion(false);},[bakeTimeQuestion,destination,setupOverview]);
  useEffect(()=>{if(planDetail&&(destination!=='organisation'||setupOverview||recipeGenerated))setPlanDetail(false);},[planDetail,destination,setupOverview,recipeGenerated]);
  useEffect(()=>{if(decisionSheet&&destination!=='organisation')setDecisionSheet(null);},[decisionSheet,destination]);
  const sheetDecisionPending = tab==='custom' ? customDecisionPending : simpleDecisionPending;
  // After a step moved in place on the Recipe's plan, the recipe follows the new times.
  const planEditFrom = useRef<string|null>(null);
  // The scheduler re-reports its validity after the inline editor closes; regenerate once it has.
  const planRegenPending = useRef(false);
  // After an inline edit, a short line under the moved row replaces the "Plan updated" note.
  const [planNote, setPlanNote] = useState<{key:string;yeast:{from:number;to:number}|null}|null>(null);
  const planNoteKey = useRef<string|null>(null);
  const planYeastFrom = useRef<number|undefined>(undefined);
  const planYeastAwait = useRef(false);
  const doseOf = (r: typeof recipe) => recipeYeastTotal(r);
  useEffect(()=>{
    if(!planRegenPending.current||planEdit||!recipeGenerated||!canGenerate)return;
    planRegenPending.current=false;planYeastAwait.current=true;handleGenerate(true);
    // The line under the moved row replaces the "Plan updated" box handleGenerate would show.
    setPlanMoved(null);
    const from=planYeastFrom.current,to=doseOf(recipe);
    setPlanNote({key:planNoteKey.current??'mix',yeast:from!==undefined&&to!==undefined&&Math.abs(from-to)>=0.001?{from,to}:null});
  });
    useEffect(()=>{
    if(!planYeastAwait.current)return;
    planYeastAwait.current=false;
    // If the recipe settles only after the regeneration, the yeast is measured again.
    const from=planYeastFrom.current,to=doseOf(recipe);
    setPlanMoved(null);
    setPlanNote(note=>note&&{...note,yeast:from!==undefined&&to!==undefined&&Math.abs(from-to)>=0.001?{from,to}:null});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[recipe]);
  useEffect(()=>{
    const times=`${+startTime}|${prefStartTime?+prefStartTime:''}`;
    if(planEdit){if(planEditFrom.current===null){planEditFrom.current=times;planYeastFrom.current=doseOf(recipe);planNoteKey.current=planEdit==='pref'?'preferment':'mix';setPlanNote(null);}return;}
    if(planEditFrom.current===null)return;
    const moved=planEditFrom.current!==times;
    planEditFrom.current=null;
    // Regenerating records the new plan and shows "Plan updated" with what changed.
    if(moved&&recipeGenerated)planRegenPending.current=true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planEdit]);
  useEffect(()=>{if(planEdit&&destination!=='recipe')setPlanEdit(null);},[planEdit,destination]);
  useEffect(()=>{if(planNote&&destination!=='recipe')setPlanNote(null);},[planNote,destination]);
  // After an inline change the page stays on the row that moved, where its note is (14 Nov 2026 audit).
  useEffect(()=>{
    if(!planNote)return;
    const id=window.setTimeout(()=>{const el=document.querySelector('[data-plan-note]');if(el)(el as HTMLElement).scrollIntoView({block:'center',behavior:'instant' as ScrollBehavior});},60);
    return()=>window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planNote]);
  // The free oven slot was chosen: once the plan has settled on the new bake time, create the recipe as the sheet does.
  useEffect(()=>{
    const target=ovenSlotPending.current;
    if(!target||!eatTime||+eatTime!==target)return;
    const id=window.setTimeout(()=>{if(ovenSlotPending.current!==target)return;ovenSlotPending.current=null;ovenKept.current=target;setDecisionSheet('generate');},400);
    return()=>window.clearTimeout(id);
  },[eatTime,startTime,scheduleCandidateValid]);
  useEffect(()=>{
    if(!decisionSheet||sheetDecisionPending||!scheduleCandidateValid)return;
    const next=decisionSheet;setDecisionSheet(null);
    if(next==='return'){finishSetupEdit();return;}
    if(tab==='simple')setAwaitingRecipeChoice(false);
    if(canGenerate)handleGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[decisionSheet,sheetDecisionPending,scheduleCandidateValid]);
  // Fetch the recipe chunk while the baker is still setting up, so Generate opens it at once.
  useEffect(()=>{if(bakeType)void loadRecipeOutput();},[bakeType]);
  // There is no mode screen. A route that lands on setup before a mode exists goes to
  // the bake time (style first, if none), where customizing is offered as a link.
  useEffect(()=>{
    if(destination!=='organisation'||modeChosen||!bakeType)return;
    if(styleKey)openBakeTimeInputs();else{setBatchView('style');setActiveTab('batch');}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[destination,modeChosen,bakeType,styleKey]);
  function openBakeTimeInputs(){
    chooseMode('simple');setSetupOverview(false);setAwaitingRecipeChoice(true);scrollToStepTop();
  }
  // Simple sourdough: "Where is your starter now?" becomes the starter state the
  // solver already plans from. The feed times are safe assumptions, not facts:
  //  · counter — fed within the last day. We assume a full day ago (the oldest
  //    case), so it is past its peak and the plan always opens with a refresh
  //    feed; assuming a fresher feed could time the mix on a peak already gone.
  //  · fridge — about a week since the last feed, the "A week+" age Custom uses
  //    (196 h), so the plan includes the revival refreshes the solver models.
  //  · bubbly now — an observed peak, exactly as Custom's "ready now" path; a far
  //    bake turns it into one more refresh inside the solver.
  function applySimpleStarterAnswer(answer:'counter'|'fridge'|'ready'){
    const now=Date.now(), quarter=15*60000;
    setSimpleStarterAnswer(answer);
    setHasNotFedYet(false);setFridgeOutTime(null);setFeedTime(null);setFeed2Time(null);setUsingPeak2(false);
    setStarterFridgeInTime(null);setStarterPeakTime(null);setStarterEvents([]);setStarterTimingValid(false);
    if(answer==='ready'){
      setPlanningMode('know_peak');setKnownPeakTime(new Date(now));setStarterLocation('rt');
      setLastFedTime(null);setLastFedAge(null);setStarterState('rt_fed');
    }else{
      const fedAt=new Date(Math.floor((now-(answer==='counter'?24:196)*3600000)/quarter)*quarter);
      setPlanningMode('last_fed');setKnownPeakTime(null);setLastFedTime(fedAt);
      setLastFedAge(answer==='counter'?'yesterday':'week');
      setStarterLocation(answer==='counter'?'rt':'fridge');setStarterState(answer==='counter'?'rt_fed':'fridge_unfed');
    }
    setStarterPlanResetKey(k=>k+1);
  }
  function chooseMode(key: 'simple' | 'custom') {
    const profile = styleKey ? getBreadProtocol(styleKey) : undefined;
    const ordinaryOven = bakeType === 'bread' ? 'standard_bread' : 'home_oven_standard';
    if (!ovenType || (profile && !profile.equipment.includes(ovenType))) {
      setOvenType(profile && !profile.equipment.includes(ordinaryOven) ? profile.equipment[0] as AnyOvenType : ordinaryOven);
    }
    if (!mixerType || (profile && !profile.supportedMixers.includes(mixerType))) {
      const savedMixer = loadProfile()?.mixerType;
      const preferredMixer: MixerType = savedMixer && savedMixer in MIXER_TYPES ? savedMixer as MixerType : 'hand';
      setMixerType(profile && !profile.supportedMixers.includes(preferredMixer) ? profile.supportedMixers[0] : preferredMixer);
    }
    if (key === 'custom' && simpleStarterAnswer) {
      // The Simple answer only implied a last feed; Custom's Starter step asks for the real one.
      // Where it is was a real answer, so Customize keeps it (16 Nov 2026 review: asked twice).
      confirmSetting('starterLocation',starterLocation);
      setSimpleStarterAnswer(null);setPlanningMode('last_fed');setKnownPeakTime(null);setLastFedTime(null);setLastFedAge(null);
      setStarterEvents([]);setStarterPlanResetKey(k=>k+1);
    }
    if (key === 'simple' && !yeastType) {
      chooseYeast(isLevainStyle(styleKey)?'sourdough':'instant');
    }
    setTab(key); setModeChosen(true); setActiveTab('setup');
    // Land on the first step that actually needs input — completed
    // choices carry over, no re-clicking required.
    const target = !styleKey ? 1 : key === 'simple' ? 7 : !customKitchenConfirmed ? 3 : firstIncompleteStep(true);
    if(target<=2){setBatchView(target===1?'style':'quantity');setActiveTab('batch');}
    if (key === 'custom') {
      setAdvancedStep(target);
      setAdvancedHighestStep(prev => Math.max(prev, target));
    } else {
      setActiveStep(target);
      setHighestStep(prev => Math.max(prev, target));
    }
    suppressNextScrollRef.current = true;
  }

  function selectStyle(sk: StyleKey) {
    const nextFamily = sandwichFamilyForStyle(sk);
    if (bakeType === 'bread' && sandwichParty.familyId !== nextFamily && Object.values(sandwichParty.qtys).some(q=>q>0)
      && !window.confirm(fr ? 'Changer de pain remplace vos garnitures sélectionnées. Continuer ?' : 'Changing bread replaces your selected fillings. Continue?')) return;
    setStyleKey(sk);
    if (sk !== styleKey) setConfirmedSettings(previous => previous.filter(item => item !== 'flour=recipe'));
    setSandwichParty(previous => switchSandwichFamily(previous, sandwichFamilyForStyle(sk)));
    // A blend style starts on its own flours; leaving one drops its untouched blend.
    const styleBlend = STYLE_DEFAULT_BLENDS[sk];
    if (styleBlend) { setFlourBlend({...styleBlend}); setFlourChosen(false); }
    else if (!flourChosen && isStyleDefaultBlend(flourBlend)) setFlourBlend({ flour1: bakeType === 'pizza' ? 'pizza00' : 'bread', flour2: null, ratio1: 100 });
    const profile = getBreadProtocol(sk);
    if (isUnleavened && profile?.method !== 'unleavened') { setYeastType(null); setPrefermentChosen(false); }
    if (!profile && ovenType === 'griddle') setOvenType(null);
    if (profile && ovenType && !profile.equipment.includes(ovenType)) setOvenType(null);
    if (profile && mixerType && !profile.supportedMixers.includes(mixerType)) setMixerType(null);
    if (profile && !profile.supportedPreferments.includes(prefermentType)) { setPrefermentType('none'); setPrefermentChosen(false); }
    if (profile && !profile.supportedPreferments.includes('levain') && yeastType === 'sourdough') setYeastType(null);
    if (profile?.method === 'unleavened') { setYeastType('instant'); setPrefermentType('none'); setPrefermentChosen(true); if(eatTime) setStartTime(new Date(+eatTime-45*60000)); }
    setManualHydration(undefined);
    setManualOil(oilDefault(sk));
    setManualSugar(sugarDefault(sk));
    // A pizza count the baker chose survives a change of pizza style; only the ball weight follows the style.
    if (!(qtyChosen && bakeType === 'pizza')) setNumItems(getBreadProtocol(sk)?.portions.count ?? STYLE_BALL_DEFAULTS[sk] ?? (bakeType === 'bread' ? 1 : tab === 'custom' ? 8 : 4));
    if (STYLE_HAS_DIAMETER.includes(sk)) {
      const defaultD = STYLE_DEFAULT_DIAMETER[sk] ?? 30;
      setPizzaDiameter(defaultD);
      setPizzaCorn(1);
      setItemWeight(pizzaWeightFromTable(sk, defaultD, 1));
    } else {
      setItemWeight(ALL_STYLES[sk].ballW);
    }
    // Stay on the chooser until the baker confirms with Continue.
  }

  // Reset after React has committed the destination, including changes that
  // stay on the same route (quantity, mode, equipment and individual steps).
  // A value edit or opening/closing a detail sheet must not reset reading.
  const visiblePageKey = showProductHome || !bakeType ? 'home'
    : destination === 'organisation'
      ? `organisation:${modeChosen}:${tab}:${setupOverview}:${tab === 'simple' ? activeStep : advancedStep}:${equipmentPanel}`
      : `${destination}:${destination === 'batch' ? batchView : destination === 'protocol' ? protocolView : destination === 'service' ? serviceView : ''}:${companionVisible ? companionPhase : ''}`;
  usePageTop(visiblePageKey);

  function scrollToStepTop() {

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openDestination(next:BakeDestination) {
    setFillingsReturn(null);
    setPrepReturnToService(null);setShoppingReturnToFillings(false);
    if(next==='batch'&&batchView==='fillings')setBatchView(styleKey?'quantity':'style');
    if(next==='organisation'&&!styleKey){setActiveTab('batch');setBatchView('style');}
    else {
      if(next==='organisation'){
        if(activeStep<3)setActiveStep(3);
        if(advancedStep<3)setAdvancedStep(3);
      }
      if(next==='protocol'&&!hasFillings)setProtocolView('dough');
      if(next==='service'&&!hasFillings)setServiceView('dough');
      setActiveTab(routeForDestination(next));
    }
    scrollToStepTop();
  }
  // "Back to the bake time" opens the bake time (round 9 S5): from Fine-tune, My choices or a hidden replan the
  // sheet sat over another screen and only closed. On the bake-time question itself it just closes.
  function backToBakeTime() {
    setDecisionSheet(null);setOvenOffer(null);
    const planStep=tab==='custom'?9:7;
    const onIt=activeTab==='setup'&&!setupOverview&&(tab==='custom'?customOrganisationFlow.activeId:simpleFlow.activeId)===planStep;
    if(onIt)return;
    if(recipeGenerated)captureEditReturn();
    setBakeTimeQuestion(true);openSetupStep(planStep);
  }
  function openSetupStep(id:number,custom=tab==='custom') {
    if(execution||mixExecution)id=custom?9:7;
    if (!custom && (id === 4 || id === 6)) id = 3;
    setSetupOverview(false);setGapReturnTo(null);
    if(id===3)setEquipmentPanel('oven');
    if(custom){setAdvancedStep(id);setAdvancedHighestStep(value=>Math.max(value,id));}
    else {setActiveStep(id);setHighestStep(value=>Math.max(value,id));}
    if(id<=2){setBatchView(id===1?'style':'quantity');setActiveTab('batch');}
    else setActiveTab('setup');
    scrollToStepTop();
  }
  function openCompanionPhase(phase:'pick'|'shop'|'prep'|'bake'|'serve') {
    if(bakeType==='pizza')setPizzaPartyTab(phase==='serve'?'bake':phase);
    else setSandwichParty(previous=>({...previous,tab:phase==='bake'?'serve':phase}));
    if(phase==='pick'){captureEditReturn();setBatchView('fillings');setActiveTab('batch');}
    else if(phase==='shop'){setShoppingReturnToFillings(destination==='protocol'&&protocolView==='fillings');setActiveTab('shopping');}
    else if(phase==='prep'){
      if(destination==='shopping'&&!recipeGenerated){openDestination('organisation');return;}
      setProtocolView(destination==='shopping'&&!shoppingReturnToFillings?'dough':hasFillings?'fillings':'dough');setShoppingReturnToFillings(false);setActiveTab('guide');
    }
    else {setServiceView(prepReturnToService??'dough');setPrepReturnToService(null);setShoppingReturnToFillings(false);setActiveTab('service');}
    scrollToStepTop();
  }
  function prepareFillingsFromService() {
    openDestination('protocol');
    setProtocolView('fillings');
    setPrepReturnToService(serviceView);
  }
  function captureEditReturn() {
    if(destination==='protocol'||destination==='service'||destination==='recipe'||destination==='shopping')setFillingsReturn({destination,view:destination==='protocol'?protocolView:destination==='service'?serviceView:'dough'});
  }
  function openSetupReview() {
    rememberGoodPlan();
    if(execution||mixExecution){openSetupStep(tab==='custom'?9:7);return;}
    captureEditReturn();setActiveTab('setup');setReviewMode(true);setSetupOverview(true);scrollToStepTop();
  }
  function backToSetupChoices() {
    setSetupOverview(true);setActiveTab('setup');scrollToStepTop();
  }
  // The plan the recipe was made with, kept while its times are edited: the way back when an edit
  // leaves a clash (18 Nov 2026 retention: no Back to Recipe until "Keep…").
  const lastGoodPlanRef = useRef<SessionData | null>(null);
  function rememberGoodPlan() {
    lastGoodPlanRef.current = recipeGenerated && !protocolStale && scheduleCandidateValid ? {...buildSessionPayload(), version: 1, savedAt: Date.now()} as SessionData : null;
  }
  function backToLastGoodPlan() {
    const good = lastGoodPlanRef.current;
    lastGoodPlanRef.current = null;
    if (good && JSON.stringify({...buildSessionPayload(), savedAt: 0}) !== JSON.stringify({...good, version: undefined, savedAt: 0})) {
      applySession({...good, activeTab: 'plan'});
      saveSession(good);
      // A fresh planner over the restored plan: the edited one must not write its draft back.
      setStarterPlanResetKey(k => k + 1);
    }
    setReplanReturn(null); setPlanReplanPending(false);
    openDestination('recipe');
  }
  function editRecipeTiming() {
    // A planned start that has passed with nothing recorded: Adjust timing is where "Not yet" goes — it offers the
    // updated plan (the question itself goes once the clock is on a later step; 18 Nov 2026 retention round 3).
    if(!execution&&!mixExecution&&commercialMethod&&yeastType!=='sourdough'&&plannedPreparationAt<=Date.now())setReplanRequested(true);
    setBakeTimeQuestion(false);
    rememberGoodPlan();
    captureEditReturn();
    openSetupStep(tab==='custom'?9:7);
  }
  function openQuantityEdit() {
    captureEditReturn();setBatchView('quantity');setActiveTab('batch');scrollToStepTop();
  }
  function finishSetupEdit() {
    // A clean flag is not proof of current validity. Only an explicit return
    // attempt marks an invalid clean plan pending; never do this merely because
    // a restored planner is still initializing its readiness callbacks.
    if(recipeGenerated&&tab==='custom'&&customStarterStepId!==null&&!starterStateDescribed){openSetupStep(customStarterStepId);return;}
    if(recipeGenerated&&planReplanPending&&tab==='custom'&&!replanReturn){
      // The plan is re-derived where the baker is (the step's own planner, or a hidden one: customReplanHost),
      // then the recipe opens. Update recipe never walks the bake time (22 Nov 2026 round 9 E); a plan that
      // no longer fits opens where it can be settled (the settle effect hands it to handleGenerate).
      setReplanReturn({from:+startTime,settled:false});
      return;
    }
    if(recipeGenerated&&!canGenerate){setProtocolStale(true);handleGenerate(true);return;}
    if(!recipeGenerated||protocolStale||previousRecipeInputKey.current!==recipeInputKey){handleGenerate(true);return;}
    setSetupOverview(false);
    if(fillingsReturn)finishFillings();else openDestination('recipe');
  }
  function openLateFillings() {
    captureEditReturn();
    setBatchView('fillings');setActiveTab('batch');scrollToStepTop();
  }
  function backFromFillings() {
    if(fillingsReturn?.forward){setFillingsReturn(null);openDestination('recipe');return;}
    if(fillingsReturn)finishFillings();else {setBatchView(styleKey?'quantity':'style');setActiveTab('batch');scrollToStepTop();}
  }
  function finishFillings() {
    if(fillingsReturn){
      if(fillingsReturn.destination==='protocol')setProtocolView(hasFillings?fillingsReturn.view:'dough');else if(fillingsReturn.destination==='service')setServiceView(hasFillings?fillingsReturn.view:'dough');
      if(!hasFillings){setPrepReturnToService(null);setShoppingReturnToFillings(false);}
      setActiveTab(routeForDestination(fillingsReturn.destination));setFillingsReturn(null);scrollToStepTop();
    }else if(!styleKey){setBatchView('style');setActiveTab('batch');scrollToStepTop();}else openDestination('organisation');
  }
  function restoreNavigation(source:SessionData) {
    const restored=restoredBakeRoute(source,source.bakeType==='pizza'||!!source.styleKey&&!!sandwichFamilyForStyle(source.styleKey));
    setActiveTab(restored.route);setBatchView(restored.memory.batchView??'style');setProtocolView(restored.memory.protocolView??'dough');setServiceView(restored.memory.serviceView??'dough');setFillingsReturn(restored.memory.returnTo??null);setPrepReturnToService(restored.memory.prepReturnToService??null);setShoppingReturnToFillings(restored.memory.shoppingReturnToFillings??false);
  }

  // Both advance functions walk the step model rather than raw numbers. That
  // is what makes merging or hiding a step safe: a page that isn't in the list
  // can never be landed on, which is exactly how Suivant used to reach the
  // preferment step on the sourdough path and show a blank screen.
  // Suivant goes to the next step that still needs an answer, not merely the
  // next one in the list. A signed-in baker whose profile already carries oven,
  // mixer, yeast and preferment should not be walked through four pages that
  // only show them what they already told us.
  //
  // "Answered" is the same test the chips and the final CTA use
  // (stepAnswered): a real decision counts, a code default does not until the
  // baker has passed its page. That matters — if Suivant skipped the pages
  // carrying defaults, the last page's CTA would immediately send them back to
  // one, and the two controls would fight each other.
  //
  // Sourdough is the one exception that stays hardcoded: its step carries
  // session-specific starter questions (fed when, where) that no profile can
  // answer, so a stored yeast preference never skips it.
  function nextUnanswered(list: StepDef[], from: number, highest: number): number {
    const i = list.findIndex(s => s.id === from);
    if (i < 0) return list[0].id;
    for (let k = i + 1; k < list.length; k++) {
      if (!stepAnswered(list[k], highest, list)) return list[k].id;
    }
    return list[list.length - 1].id;
  }

  // Visible quantity and preferment defaults can be accepted on Continue.
  // Flour requires an explicit selection through FlourPicker.
  function choosePreferment(pt: PrefermentType) {
    if(execution||mixExecution)return;
    if (pt !== prefermentType) {
      setSessionRestored(false);
      setPrefermentValidity({ type: pt, valid: false });
      // A share chosen for one preferment is not the other's: a biga starts from its own default.
      setPrefermentFlourPct(undefined);
      // An amount entered for one method's dough is not the other's (round 7: the final dough of a
      // poolish or biga takes an entered amount too); the preferment's own is kept per preferment.
      setYeastPctOverride(undefined);setYeastEntryIssue(null);setPrefYeastIssue(null);
      // Round 13 (item 5): a yeast dough's new method is re-planned on the way back (Update recipe lands on the
      // Recipe, as after a yeast-type change); a plan that no longer fits still opens where it can be settled.
      if (recipeGenerated && pt !== 'levain' && prefermentType !== 'levain' && yeastType !== 'sourdough') setPlanReplanPending(true);
    }
    setPrefermentChosen(true);
    // A biga starts in the fridge (or the cool spot the baker chose), never in a poolish's room storage.
    if (pt === 'biga' && pt !== prefermentType) setPrefGoesInFridgeState(bigaStorage !== 'cool');
    setPrefermentType(pt);
  }

  // Round 9 (bug B): a preferment amount is entered for one storage. Another storage ripens it at another time, so
  // keeping it would change what the baker meant without a word; it is cleared (the calculated amount applies) and
  // the line below says so, as an amount entered for one method's dough is not the other's (choosePreferment).
  function clearPrefYeastForStorage(type: FlourPreferment) {
    if (execution || mixExecution || prefYeastOverride?.type !== type) return;
    setPrefYeastCleared({type, idyPct: prefYeastOverride.pct});setPrefYeastOverride(undefined);setPrefYeastIssue(null);
  }
  // The line belongs to the change it reported: a recipe made since (a new accepted plan) ends it (round 11, item 8).
  useEffect(() => { setPrefYeastCleared(null); }, [acceptedPlan]);
  function prefYeastClearedLine(type: FlourPreferment) {
    if (!prefYeastCleared || prefYeastCleared.type !== type || prefYeastOverride || !yeastType || yeastType === 'sourdough') return null;
    const isFr = locale === 'fr', pct = bakerPct(roundShownPct(prefYeastCleared.idyPct * (YEAST_TYPES[yeastType]?.conversion ?? 1)), isFr);
    return <p data-pref-yeast-cleared style={{margin:'8px 0 0',fontSize:14,lineHeight:1.45,color:'var(--ash)'}}>{isFr
      ? `${type==='biga'?'La biga':'Le poolish'} reprend la quantité de levure calculée (vous aviez saisi ${pct}).`
      : `The ${type} is back to the calculated yeast (you had entered ${pct}).`}</p>;
  }

  // Whether the chosen poolish or biga can still be ready before the bake (see the Preferment step).
  // The storages a preferment may use here: a poolish either (as before); a biga its fridge, and its cool spot per D1.
  const prefStoragesFor=(type:'biga'|'poolish'):boolean[]=>type==='biga'
    ?(bigaStorage==='cool'?[false]:bigaStorage==='fridge'||!bigaCoolOffered(bigaStorage,kitchenTemp)?[true]:[true,false])
    :[true,false];
  // Round 11 (item 2): the hours alone said a biga fitted when only its storage's shortest window did (a cool spot's
  // 12 h with Thomas's baguette needing 8 h after it): whether the planner has a complete plan at this bake decides,
  // in setup and when the preferment is changed from My choices alike. Time only: night steps allowed and busy times
  // set aside (a busy-time clash is asked once, in the sheet, when the recipe is made).
  const prefAtBakeKey=eatTime&&!execution&&!mixExecution&&styleKey&&(prefermentType==='biga'||prefermentType==='poolish')
    ?JSON.stringify([prefermentType,+eatTime,kitchenTemp,fridgeTemp,styleKey,planPreheatMin,exitLeadMin,mixerType,numItems,selectedMixingBatches,bigaStorage,flourStrength,prefermentFlourPct,Math.floor(Date.now()/900000)]):null;
  const prefPlanAtBake=React.useMemo(()=>{
    if(!prefAtBakeKey||!eatTime||!styleKey||(prefermentType!=='biga'&&prefermentType!=='poolish'))return true;
    try{
      const found=earliestPrefermentBake({...poolishInputs,now:Date.now(),blocks:[],kitchenTemp,fridgeTemp,styleKey,flourStrength,preheatMin:planPreheatMin,exitLeadMin,
        mixerType:(mixerType??'hand') as MixerType,numItems,mixingBatches:selectedMixingBatches,allowNight:true,type:prefermentType,storages:prefStoragesFor(prefermentType),from:eatTime,maxDays:0});
      return !!found&&+found.bake===+eatTime;
    }catch{return true;}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[prefAtBakeKey]);
  const prefermentTooCloseBase=(()=>{
    if(!eatTime||execution||mixExecution||(prefermentType!=='biga'&&prefermentType!=='poolish'))return null;
    const finalLeadH=(kitchenTemp>=28?0.5:1.5)+1+planPreheatMin/60;
    const needH=(type:'biga'|'poolish')=>Math.min(...prefStoragesFor(type).map(f=>commercialPrefermentWindow(type,f,kitchenTemp,styleKey??'',fridgeTemp)?.min??Infinity))+finalLeadH;
    const leftH=(+eatTime-Date.now())/3600000;
    if(leftH>=needH(prefermentType)&&prefPlanAtBake)return null;
    // A later bake is searched from the bake itself when the hours alone fitted.
    return {needH,leftH,naiveH:Math.max(needH(prefermentType),leftH+0.25)};
  })();
  // The later bake offered with "Keep the biga and bake …" is one the planner finds a complete plan for
  // (bug 4, round 8: now + window minimum + a nominal final rise was offered, and its plan did not exist).
  const tooCloseKey=prefermentTooCloseBase?JSON.stringify([prefermentType,Math.round(prefermentTooCloseBase.naiveH*4),kitchenTemp,fridgeTemp,styleKey,planPreheatMin,exitLeadMin,mixerType,numItems,selectedMixingBatches,bigaStorage,blocks.map(b=>[+b.from,+b.to]),flourStrength,prefermentFlourPct,Math.floor(Date.now()/900000)]):null;
  const tooCloseLater=React.useMemo(()=>{
    if(!prefermentTooCloseBase||!styleKey||(prefermentType!=='biga'&&prefermentType!=='poolish'))return null;
    const now=Date.now();
    // A later bake is planned with the baker's recurring nights and work carried to it, and adds no night step (bug G).
    const presets=loadProfile()?.blockers??DEFAULT_BLOCKERS;
    const common={...poolishInputs,now,blocks,blocksFor:(bake:Date)=>blocksForLaterBake(blocks,new Date(now),bake,presets),kitchenTemp,fridgeTemp,styleKey,flourStrength,
      preheatMin:planPreheatMin,exitLeadMin,mixerType:(mixerType??'hand') as MixerType,numItems,mixingBatches:selectedMixingBatches};
    // Round 9 (owner, 22 Nov 2026): the earliest bake with a plan, night steps allowed (the baker's own choice, named
    // on the sheet), and when it has some, the earliest without them.
    const later=earliestPrefermentBake({...common,allowNight:true,type:prefermentType,storages:prefStoragesFor(prefermentType),from:new Date(now+prefermentTooCloseBase.naiveH*3600000)});
    const laterDay=later&&later.nightSteps.length?earliestPrefermentBake({...common,type:prefermentType,storages:prefStoragesFor(prefermentType),from:new Date(+later.bake+900000)}):null;
    // Owner decision 1 (22 Nov 2026): a biga that does not fit is offered its cool spot (16–18 °C, 12–20 h) only when a
    // complete plan exists with it at this bake; never chosen for the baker.
    const coolAtBake=prefermentType==='biga'&&!prefStoragesFor('biga').includes(false)&&!!eatTime
      &&+(earliestPrefermentBake({...common,type:'biga',storages:[false],from:eatTime,maxDays:0})?.bake??NaN)===+eatTime;
    return {later,laterDay,coolAtBake};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tooCloseKey]);
  function prefermentTooClose(){
    if(!prefermentTooCloseBase)return null;
    const {needH,leftH}=prefermentTooCloseBase;
    const poolishFits=prefermentType==='biga'&&leftH>=needH('poolish')&&!(breadProtocol&&!breadProtocol.supportedPreferments.includes('poolish'));
    const later=tooCloseLater?.later?.bake??null;
    // The hours stated are the ones the plan needs when a later bake is found.
    const shownH=(type:'biga'|'poolish')=>type===prefermentType&&later?(+later-Date.now())/3600000:needH(type);
    return {needH:shownH,leftH,poolishFits,later,laterNight:tooCloseLater?.later?.nightSteps??[],laterDay:tooCloseLater?.laterDay?.bake??null,coolFits:!!tooCloseLater?.coolAtBake};
  }

  function chooseYeast(yt: YeastType) {
    if(execution||mixExecution)return;
    if (yt !== yeastType) {
      setSessionRestored(false);
      setPrefermentValidity({ type: prefermentType, valid: false });
      // Round 11 (item 7): the plan is re-derived on the way back (Update recipe lands on the Recipe), as for an amount.
      if (recipeGenerated) setPlanReplanPending(true);
    }
    setYeastType(yt);
  }

  function markStepSettled(id: number) {
    if (id === 2) setQtyChosen(true);
    // Method is confirmed only by a selection in PrefermentPicker.
  }

  function advance(from: number) {
    if (from === 1 && !styleKey) return;
    // Same rule as the custom flow — see advanceAdv. Simple has no Flour or
    // Preferment page, so only Quantity can be settled here.
    markStepSettled(from);
    const next = nextUnanswered(SIMPLE_STEPS.filter(step=>step.id>=3), from, highestStep);
    setActiveStep(next);
    setHighestStep(p => Math.max(p, next));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  function nextCustomStep(from:number) {
    if(from>=6){const index=CUSTOM_STEPS.findIndex(step=>step.id===from);return CUSTOM_STEPS[index+1]?.id ?? 9;}
    return nextUnanswered(CUSTOM_STEPS.filter(step=>step.id>=3),from,advancedHighestStep);
  }
  function advanceAdv(from: number) {
    if (from === 1 && !styleKey) return;
    if (from === 8 && !prefermentChosen) return;
    if (from === 3) setCustomKitchenConfirmed(true);
    // Flour is settled only by choosing a product or entering a flour type.
    if (from === 6 && (!flourAnswered || archivedFlourNames.length)) return;
    markStepSettled(from);
    const next = nextCustomStep(from);
    setAdvancedStep(next);
    setAdvancedHighestStep(p => Math.max(p, next, from + 1));
    if (suppressNextScrollRef.current) { suppressNextScrollRef.current = false; return; }
    scrollToStepTop();
  }

  // Starting a new bake needs no confirmation and shows no undo (13 Nov 2026): a bake with a
  // recipe stays in Menu → My bakes, and an unfinished setup is quick to redo.
  const [restartFailed, setRestartFailed] = useState(false);
  function startRecoverableBake(): boolean {
    setPreviousNote('');setPreheatExtraMin(0);setExitLead(undefined);
    // Flush live edits before snapshotting; never accept a conflicting tab's draft.
    try { if (bakeType) refreshCurrentJournalSnapshot(buildSessionPayload()); } catch {}
    if ((bakeType && !saveSession(buildSessionPayload())) || !preservePreviousBake()) {
      setRestartFailed(true); return false;
    }
    if (!startOver()) { setRestartFailed(true); return false; }
    try { forgetCurrentJournalBake(); } catch {}
    setJournalId(null);
    // A late account lookup must not offer another bake after this decision.
    freshDeviceRef.current = false;
    try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
    setRestartFailed(false);
    scrollToStepTop();
    return true;
  }

  async function confirmLocalReplacement(_rebake = false): Promise<boolean> {
    // The bake on screen keeps every confirmation and tick made in the last seconds: its journal entry is
    // written now, not after the 1.5 s debounce (17 Nov 2026 retention round 2: switching lost them).
    try { if (bakeType && recipeGenerated && journalId && journalId === currentJournalId()) refreshCurrentJournalSnapshot(buildSessionPayload()); } catch {}
    // Preserve live edits before switching, including when another tab owns the draft.
    const current = bakeType ? {...buildSessionPayload(),version:1 as const,savedAt:Date.now()} : loadSession();
    if (current && !archiveLocalBake(current)) { setRestartFailed(true); return false; }
    const stored = loadSession();
    if (stored && !archiveLocalBake(stored)) { setRestartFailed(true); return false; }
    acceptCurrentSessionStorage(); setLocalSaveConflict(false);
    setPendingSession(null); setShowWelcomeBack(false); setShowProductHome(false);
    return true;
  }

  async function openLocalBake(session: SessionData) {
    if (!await confirmLocalReplacement()) return;
    try {
      localStorage.setItem('bh_shop_ticks_v1',JSON.stringify(session.pizzaParty?.shopTicks ?? {}));
      localStorage.setItem('bh_prep_ticks_v1',JSON.stringify(session.pizzaParty?.prepTicks ?? []));
    } catch { setRestartFailed(true); return; }
    try { forgetCurrentJournalBake(); } catch {}
    applySession(session);
    scrollToStepTop();
  }

  function requestNewSession() {
    startRecoverableBake();
  }

  async function saveCurrentSession(): Promise<boolean> {
    if (cloudSaveInFlight.current) return false;
    const sessionPayload = buildSessionPayload();
    const savingPayload = JSON.stringify(sessionPayload);
    const currentQtys = pizzaPartyGetQtysRef.current?.() ?? pizzaPartyQtys;
    const localSaved = saveSession(sessionPayload);
    // Local persistence is not a confirmation of account persistence.
    setSessionSaved(user ? false : localSaved);
    if (user) setCloudSaveState('saving');
    if (user) {
      cloudSaveInFlight.current = true;
      try {
        const { saveNamedSession, savePizzaPartySelections, updateBakeEvent } = await import('../lib/supabase/saveBakeEvent');
        let id = bakeEventId;
        if (!id) {
          id = await saveNamedSession(sessionPayload as SessionData);
          if (id) setBakeEventId(id);
        } else {
          if (!await updateBakeEvent(id, sessionPayload as SessionData)) throw new Error('Session update failed');
        }
        if (id && Object.keys(currentQtys).length > 0 && styleKey) {
          if (!await savePizzaPartySelections(id, currentQtys, styleKey)) throw new Error('Pizza selections update failed');
        }
        if (!id) { setSessionSaved(false); setCloudSaveState('failed'); return false; }
        else {
          savedCloudIdRef.current = id;
          const unchanged = latestSessionPayloadRef.current === savingPayload;
          setSessionSaved(unchanged); setCloudSaveState('idle');
          if (!unchanged) return false; // Do not share/repeat an older snapshot over newer edits.
          const label = sessionLabel();
          setSavedToCloudName(label);
          setTimeout(() => setSavedToCloudName(c => (c === label ? null : c)), 5000);
          return true;
        }
      } catch (e) {
        console.error('Cloud save failed:', e);
        setSessionSaved(false); setCloudSaveState('failed'); return false;
      } finally { cloudSaveInFlight.current = false; }
    } else {
      // Le message disait « connectez-vous » sans dire où, et n'ouvrait rien :
      // une impasse. On ouvre le tiroir, et on retient l'intention dans
      // sessionStorage pour qu'elle survive à la redirection Google.
      stashAuthIntent('save');
      window.dispatchEvent(new Event('bh-open-auth'));
      return false;
    }
  }

  // Nomme la fournée. « Session enregistrée » ne disait pas de quoi il
  // s'agissait, d'où le doute : est-ce bien la pizza que je viens de faire ?
  // Même source que bakeEventTitle, pour que le message d'enregistrement et
  // la carte dans « Mes sessions » ne puissent pas se contredire.
  function sessionLabel(): string {
    const style = (ALL_STYLES as Record<string, { name: string }>)[styleKey ?? ''];
    const styleName = style?.name ?? styleKey ?? '';
    const n = numItems ?? 0;
    const parts = [styleName, n ? bakeQuantityLabel(n,bakeType,styleKey,locale === 'fr') : ''].filter(Boolean);
    return parts.join(' · ') || (locale === 'fr' ? 'Votre fournée' : 'Your bake');
  }

  function startOver() {
    // Refuse to clear a draft another tab has changed since our last write.
    if (!clearSession()) return false;
    // The oven, kneading and commercial yeast the baker chose carry to the next bake, like the
    // kitchen and fridge (17 Nov 2026 retention): applied by family when nothing in the profile says otherwise.
    rememberLastEquipment({bakeType,oven:confirmed('oven',ovenType)?ovenType:null,mixer:confirmed('mixer',mixerType)?mixerType:null,
      yeast:yeastType&&yeastType!=='sourdough'&&confirmed('yeast',yeastType)?yeastType:null});
    setAutoStarterPct(undefined);
    setPendingSession(null);
    setScheduleCandidateValid(true);
    setBatchView('style');setProtocolView('dough');setServiceView('dough');setFillingsReturn(null);setPrepReturnToService(null);setShoppingReturnToFillings(false);
    setSandwichParty(createSandwichSnapshot());
    // Fresh session = fresh chance for profile blockers to apply — without
    // this reset, only the first session per page load ever received them.
    profileBlockersAppliedRef.current = false;
    setEquipmentPanel('oven'); setMixingBatches(undefined); setContainerCapacityLitres(3);
    setShowProductHome(false);setBakeType(null); setBakeName(''); setStyleKey(null); setProfileFields(new Set());setConfirmedSettings([]);
    setNumItems(2); setItemWeight(270); setTotalFlourTarget(undefined);
    setOvenType(null); setOvenConstruction('tabletop'); setMixerType(null);
    const now = new Date(); now.setMinutes(0, 0, 0);
    setStartTime(now);
    setTimingOverrides({});setStarterRecoveryPending(false);setStarterFeedRecords([]);setExecution(undefined);setMixExecution(undefined);setReplanRequested(false);
    setEatTime(null);
    setBlocks([]); setYeastType(null);
    setStarterTimingValid(true);
    setResultNotes('');setCustomMixerCapacityG(undefined);setMixingBatches(undefined);
    setCustomKitchenConfirmed(false);
    // Same kitchen, same fridge: the next bake starts from them, not from 22 °C (17 Nov retention review).
    setHumidity('normal'); setWaterSource('room'); setMeasuredWaterTemp(undefined); setWaterMethod('premelt'); setSpiralIceConfirmed(false);
    setShowResults(false); setActiveStep(1); setHighestStep(1);
    setAdvancedStep(1); setAdvancedHighestStep(1); setFlourBlend({ flour1: bakeType === 'bread' ? 'bread' : 'pizza00', flour2: null, ratio1: 100 }); setPriorityOverride(undefined); setPrefermentType('none');
    setManualHydration(undefined); setManualOil(undefined); setManualSugar(undefined);
    setManualSalt(undefined); setTargetDoughTemp(undefined); setWastePct(undefined); setFlourInFridge(false); setPoolishStorage('auto'); setBigaStorage('auto'); setYeastPctOverride(undefined); setStarterPctOverride(undefined); setMeasuredFlourTemp(undefined); setMeasuredPrefermentTemp(undefined); setPrefermentFlourPct(undefined);
    setRecipeGenerated(false); setProtocolStale(false); setActiveTab('batch'); setAcceptedPlan(undefined); setCustomPlanSeen(false);
    setReviewMode(false); setSetupOverview(false);
    setModeChosen(false);
    // Restart means restart. Without these the three settled-flags survived the
    // wipe, so Quantity, Flour and Preferment came back reading as the baker's
    // own choices on a flow they had just cleared.
    setQtyChosen(false); setFlourChosen(false); setPrefermentChosen(false);
    setTab('simple'); // full reset — keeping the previous mode made Custom look pre-selected to a fresh user
    setPizzaPartyTab('pick');
    setPizzasConfirmed(false);
    // Clear persisted Pizza Party ticks + guide progress — they belong to the old bake
    try {
      localStorage.removeItem('bh_shop_ticks_v1');
      localStorage.removeItem('bh_prep_ticks_v1');
      const legacyProgress = localStorage.getItem('bh_guide_done_v1');
      if (legacyProgress) localStorage.setItem('bh_guide_done_v1_backup', legacyProgress);
      localStorage.removeItem('bh_guide_done_v1');
    } catch {}
    // The welcome-back banner silences itself for the rest of the browser
    // session once answered. On iOS that sessionStorage key survives the app
    // being backgrounded, so a later restored session came back with no prompt
    // at all — a silent rehydration, which is indistinguishable from the app
    // having pre-set everything. Restart clears it too: restart means restart.
    try { sessionStorage.removeItem('bh_wb_answered'); } catch {}
    setSessionSaved(false);
    setSessionRestored(false);
    setReviewMode(false);
    setShowWelcomeBack(false);
    setCloudResume(null);
    setAddSeeds(false);
    setBakeEventId(null);
    setPizzaPartyQtys({});
    setBakePhotoUrl(null);
    setBakedDone(false);
    setStarterEvents([]);
    // Sourdough starter state — full reset
    setLastFedTime(null);
    setKnownPeakTime(null);
    setHasNotFedYet(null);
    setLastFedAge(null);
    setSimpleStarterAnswer(null);
    setFeed2Time(null);
    setFridgeOutTime(null);
    setStarterFridgeInTime(null);
    setUsingPeak2(false);
    setStarterLocation('rt');
    setPlanningMode('last_fed');
    setStarterMature(true);
    setStarterHasRye(false);
    setTang('balanced');
    setLastFeedRatio(1);
    setNextFeedRatio(1);
    setNextFeedRatioOverride(null);
    setRatioMode('recommend');
    setStarterPeakTime(null);
    return true;
  }

  function handleGenerate(acceptedUpdate = false) {
    if (!styleKey) {
      setActiveTab('batch');setBatchView('style'); setSetupOverview(false);
      if (tab === 'custom') setAdvancedStep(1); else setActiveStep(1);
      scrollToStepTop();
      return;
    }
    if (!canGenerate) {
      // An unanswered Starter question goes to that question, never to a plan computed without it.
      openSetupStep(tab === 'custom' && customStarterStepId !== null && !starterStateDescribed
        ? customStarterStepId : generationBlocker?.stepId ?? (tab === 'custom' ? 9 : 7));
      return;
    }
    if (!scheduleCandidateValid || scheduleEditing || schedule?.preparationInvalid) {
      setActiveTab('setup'); setSetupOverview(false);
      if (tab === 'custom') setAdvancedStep(9); else setActiveStep(7);
      scrollToStepTop(); return;
    }
    if (!commercialPrefermentPlanReady) {
      setActiveTab('setup'); setSetupOverview(false); setAdvancedStep(9); scrollToStepTop();
      return;
    }
    const protocolIssue = (tab === 'custom' ? advancedRecipe : recipe)?.protocolIssue;
    if (protocolIssue) {
      setActiveTab('setup'); setSetupOverview(false);
      const next = protocolIssue === 'equipment' ? 3 : protocolIssue === 'timing' ? (tab === 'custom' ? 9 : 7) : (tab === 'custom' ? 7 : 6);
      if (tab === 'custom') setAdvancedStep(next); else setActiveStep(next);
      scrollToStepTop(); return;
    }
    if ((tab === 'custom' && !flourAnswered) || (flourChosen && archivedFlourNames.length)) {
      setActiveTab('setup'); setSetupOverview(false); setTab('custom'); setAdvancedStep(6); scrollToStepTop();
      return;
    }
    if (yeastType === 'sourdough' && (!starterTimingValid || (!recipeGenerated && !starterEvents.length))) {
      setActiveTab('setup'); setSetupOverview(false);
      if (tab === 'custom') setAdvancedStep(9); else setActiveStep(7);
      return;
    }
    if (unsupportedEnrichedMethod || (flourChosen && archivedFlourNames.length)) { setActiveTab('setup'); setSetupOverview(true); return; }
    // Another bake under way needs the oven at the same time: offer the next free slot, once (Keep is remembered).
    if (!acceptedUpdate && eatTime && ovenKept.current !== +eatTime) {
      const use = currentOvenUse(), others = use ? otherOvenUses() : [];
      const other = use && others.length ? ovenClash(use, others) : null;
      if (use && other) { setOvenOffer({other, shift: nextFreeOvenShift(use, others)}); return; }
    }
    if (recipeGenerated && user && !acceptedUpdate) {
      const msg = t('generate.confirmOverwrite');
      if (!window.confirm(msg)) return;
    }
    setSessionSaved(false);
    setSetupOverview(false);
    if (prefermentType !== 'none' && prefermentFlourPct === undefined) {
      const timeDefault = 20;
      setPrefermentFlourPct(timeDefault);
    }
    previousRecipeInputKey.current = recipeInputKey;
    generatedRecipeInputKey.current = recipeInputKey;
    setReviewMode(false);
    // Creating a recipe always opens the Recipe; a pending resume-to-Now is for a bake already generated.
    resumeToNow.current = false;
    setRecipeGenerated(true);
    setProtocolStale(false);setExecutionClash(false);
    // A recipe generated from a valid plan settles any pending starter recovery: one message, not two.
    setStarterRecoveryPending(false);
    const accepted:AcceptedPlan = {startTime:+startTime, preparationAt:plannedPreparationAt, ...(eatTime?{bakeAt:+eatTime}:{})};
    // Regenerating after an edit says what moved since the plan the baker had.
    // Regenerating after an edit lists every key time that moved and the amounts that changed.
    {
      const amounts = {yeast: recipeYeastTotal(recipe), flour: recipe?.flour, yeastType};
      const before = acceptedAmountsRef.current;
      acceptedAmountsRef.current = amounts;
      if (recipeGenerated) {
        const moved = acceptedPlanMove(acceptedPlan, +startTime, eatTime ? +eatTime : undefined);
        const prepMoved = acceptedPlan && acceptedPlan.preparationAt !== acceptedPlan.startTime && plannedPreparationAt !== +startTime && acceptedPlan.preparationAt !== plannedPreparationAt ? {prepFrom: acceptedPlan.preparationAt, prepTo: plannedPreparationAt} : {};
        const yeastMoved = before?.yeast !== undefined && amounts.yeast !== undefined && Math.abs(before.yeast - amounts.yeast) >= 0.01 ? {yeastFrom: before.yeast, yeastTo: amounts.yeast, ...(before.yeastType && before.yeastType !== yeastType ? {yeastTypeChanged: true} : {})} : {};
        const flourMoved = before?.flour !== undefined && amounts.flour !== undefined && Math.round(before.flour) !== Math.round(amounts.flour) ? {flourFrom: before.flour, flourTo: amounts.flour} : {};
        const bakeFrom = acceptedPlan?.bakeAt !== undefined && eatTime && acceptedPlan.bakeAt !== +eatTime ? {bakeFrom: acceptedPlan.bakeAt} : {};
        if (moved || Object.keys(prepMoved).length || Object.keys(yeastMoved).length || Object.keys(flourMoved).length || Object.keys(bakeFrom).length)
          setPlanMoved({...(moved ?? {from: +startTime, to: +startTime}), ...bakeFrom, ...prepMoved, ...yeastMoved, ...flourMoved});
      }
    }
    setAcceptedPlan(accepted);
    // Bake journal on this device: same entry across regenerations. Never blocks generation.
    try { const {dropped,entry}=recordGeneratedBake(buildSessionPayload({bakeType:bakeType ?? '',recipeGenerated:true,protocolStale:false,executionClash:false,starterRecoveryPending:false,activeTab:'plan',acceptedStartTime:accepted.startTime,acceptedPreparationAt:accepted.preparationAt,acceptedEatTime:accepted.bakeAt})); setJournalId(entry?.id ?? currentJournalId()); if(dropped.length) void deleteJournalPhotos(dropped.flatMap(row=>row.photoIds)); } catch {}
    setShowResults(true);
    const stay = stayAfterUpdateRef.current; stayAfterUpdateRef.current = null;
    if(fillingsReturn)finishFillings();else if(stay)openDestination(stay);else setActiveTab('plan');
    scrollToStepTop();
    if (user) {
      const sessionPayload = buildSessionPayload({
        bakeType: bakeType ?? '',
        recipeGenerated: true,
        protocolStale: false,
        activeTab: 'plan',
        starterRecoveryPending: false,
        acceptedStartTime: accepted.startTime,
        acceptedPreparationAt: accepted.preparationAt,
        acceptedEatTime: accepted.bakeAt,
      });
      upsertBakeEvent({ session: sessionPayload as SessionData })
        .then(id => { if (id) setBakeEventId(id); });
    }
  }

  // Wait for the scheduler's replan to land in page state before regenerating.
  useEffect(()=>{
    if(!replanReturn||replanReturn.settled||planReplanPending)return;
    const timer=setTimeout(()=>setReplanReturn(current=>current&&{...current,settled:true}),350);
    return()=>clearTimeout(timer);
  },[replanReturn,planReplanPending]);
  useEffect(()=>{
    if(!replanReturn?.settled)return;
    const from=replanReturn.from;
    setReplanReturn(null);
    // An invalid plan opens where the baker can see and resolve it (handleGenerate routes it: the plan step,
    // or the question still unanswered).
    if(canGenerate&&+startTime!==from)setPlanMoved({from,to:+startTime});
    handleGenerate(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[replanReturn?.settled]);

  async function loadRecipe(r: SavedRecipe) {
    if (!await confirmLocalReplacement()) return;
    setMixingBatches(undefined); setContainerCapacityLitres(3); // Legacy recipes have no saved equipment capacity.
    const isCustom = r.mode === 'custom';

    // Core setup
    setBakeType(r.bake_type as BakeType);
    setStyleKey(r.style_key as StyleKey);
    setSandwichParty(createSandwichSnapshot(sandwichFamilyForStyle(r.style_key)));
    setNumItems(r.num_items);
    setItemWeight(r.item_weight);
    setTotalFlourTarget(undefined);
    setConfirmedSettings([]);
    setOvenType(r.oven_type as AnyOvenType);
    setMixerType((r.mixer_type ?? 'hand') as MixerType);
    setWaterMethod(r.mixer_type==='spiral'?'direct':'premelt'); setSpiralIceConfirmed(false);
    setYeastType((r.yeast_type ?? 'instant') as YeastType);
    setKitchenTemp(r.kitchen_temp);
    setHumidity(r.humidity ?? 'normal');
    setFridgeTemp(r.fridge_temp ?? 6);
    // A saved recipe is a finished decision on every field it carries.
    setQtyChosen(true);
    setFlourChosen(!!r.flour_blend);
    setPrefermentChosen(true);

    // Older records store only a computed hydration for Simple; do not turn
    // that estimate into a manual override. Explicit technical fields remain
    // effective regardless of the saved presentation mode.
      setManualHydration(isCustom ? r.hydration : undefined);
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

    // Set mode and advance to scheduler step
    setTab(isCustom ? 'custom' : 'simple');
    setModeChosen(true);
    setRecipeGenerated(false);
    setShowResults(false);
    setProtocolStale(false);
    setActiveTab('setup');

    // Advance to scheduler step and mark all prior steps as completed.
    // Without highestStep updates, the scheduler page renders as locked
    // → graph doesn't show → user stuck.
    if (isCustom) {
      setAdvancedStep(9);
      setAdvancedHighestStep(prev => Math.max(prev, 9));
    } else {
      setActiveStep(7);
      setHighestStep(prev => Math.max(prev, 7));
    }
    // Enable reviewMode so the baker can freely edit any prior step
    setReviewMode(true);

    // Scroll to scheduler step after state settles
    scrollToStepTop();
  }

  // ── Resume / rebake a saved bake event ──
  // Nav #5 — rebake clones a saved session with every scheduled time shifted
  // to the next matching weekday/time. Sourdough needs a fresh starter plan.
  async function restoreFromBakeEvent(event: Pick<BakeEvent, 'id' | 'dough_snapshot' | 'pizza_party_id'>, opts?: { rebake?: boolean; journalId?: string | null }) {

    if (!event.dough_snapshot) return false;
    if (!await confirmLocalReplacement(!!opts?.rebake)) return false;
    isRestoringRef.current = true;
    // The bake being opened owns the journal entry from this very update (see journalId).
    { const id = opts?.rebake ? null : opts?.journalId ?? null; try { setCurrentJournalId(id); } catch {} setJournalId(id); }
    generatedRecipeInputKey.current = null; restoredInputsPending.current = true;
    setScheduleCandidateValid(true);
    setShowWelcomeBack(false);
    const snap = event.dough_snapshot;
    const rb = !!opts?.rebake;
    // Unit tests run this function alone; the note is a nicety, never a reason to fail a restore.
    // The note travels in the session (previousNote): Bake again, close the app, Resume, Generate
    // still shows "Last time: …" (16 Nov 2026 design review: it was React state only and was lost).
    try{const snapNote=(event.dough_snapshot as {resultNotes?:string}|null)?.resultNotes?.trim()??'';setPreviousNote(rb?(pendingPreviousNote.current||snapNote):(snap.previousNote??''));pendingPreviousNote.current='';}catch{}
    const freshStarterPlan = rb && snap.yeastType === 'sourdough';
    let deltaMs = 0;
    if (rb && snap.eatTime) {
      const oldEat = new Date(snap.eatTime);
      const next = new Date(oldEat.getTime());
      next.setDate(next.getDate() + 7);
      const now = Date.now();
      while (next.getTime() <= now) next.setDate(next.getDate() + 7);
      deltaMs = next.getTime() - oldEat.getTime();
    }
    const shiftD = (d: Date) => rb ? new Date(d.getTime() + deltaMs) : d;
    // The scheduler keeps its own draft of the times; remount it so it starts from
    // the restored (for a rebake, shifted) bake rather than the previous one.
    setStarterPlanResetKey(value => value + 1);
    setConfirmedSettings((snap.confirmedSettings ?? []).filter(item=>typeof item==='string'));
    setTab(snap.tab as 'simple' | 'custom');
    setBakeType(snap.bakeType as BakeType | null);
    setBakeName(snap.bakeName ?? '');
    setStyleKey(snap.styleKey as StyleKey | null);
    setSandwichParty(normalizeSandwichSnapshot(snap.sandwichParty, rb));
    setNumItems(snap.numItems);
    setItemWeight(snap.itemWeight);
    setTotalFlourTarget(snap.bakeType==='bread' ? normalizeFlourTarget(snap.totalFlourTarget) : undefined);
    setPizzaDiameter(snap.pizzaDiameter);
    setOvenType(snap.ovenType as AnyOvenType | null);
    setOvenConstruction(snap.ovenConstruction ?? 'tabletop');
    setMixerType(snap.mixerType as MixerType | null);
    setYeastType(snap.yeastType as YeastType | null);
    setKitchenTemp(snap.kitchenTemp);
    setCustomKitchenConfirmed(snap.customKitchenConfirmed ?? true);
    setHumidity(snap.humidity);
    setFridgeTemp(snap.fridgeTemp); setWaterSource(['room','fridge','tap','measured'].includes(snap.waterSource ?? '') ? snap.waterSource! : 'room'); setMeasuredWaterTemp(snap.measuredWaterTemp); setWaterMethod(snap.waterMethod ?? (snap.mixerType==='spiral'?'direct':'premelt')); setSpiralIceConfirmed(snap.spiralIceConfirmed ?? false); setMixingBatches(normalizeMixingBatches(snap.mixingBatches)); setCustomMixerCapacityG(snap.mixerCapacityG); setResultNotes(snap.resultNotes ?? ''); setContainerCapacityLitres(snap.containerCapacityLitres);
    if (snap.flourBlend) setFlourBlend(snap.flourBlend as FlourBlend);
    setPrefermentType(snap.prefermentType as PrefermentType);
    setQtyChosen(snap.qtyChosen ?? false);
    setFlourChosen(snap.flourChosen ?? false);
    setPrefermentChosen(snap.prefermentChosen ?? false);
    setPrefermentFlourPct(snap.prefermentFlourPct);
    setPrefOffsetH(snap.prefOffsetH);
    setTimingOverrides(rb ? {} : normalizeTimingOverrides(snap.timingOverrides));
    // Bake again keeps the time the dough spent out of the fridge last time (when that exit is free).
    setExitLead(rb ? normalizeExitLead(snap.planExitLead) ?? normalizeExitLead(snap.exitLead) : normalizeExitLead(snap.exitLead));
    setStarterRecoveryPending(!rb&&snap.starterRecoveryPending===true);setStarterFeedRecords(rb?[]:normalizeStarterFeedRecords(snap.starterFeedRecords));setExecution(rb?undefined:normalizeBakeExecution(snap.execution));setMixExecution(rb?undefined:normalizeMixExecution(snap.mixExecution));setReplanRequested(false);
    setManualHydration(snap.manualHydration);
    setManualOil(snap.manualOil);
    setManualSugar(snap.manualSugar);
    setManualSalt(snap.manualSalt);
    setYeastPctOverride(snap.yeastPctOverride);
    setPrefYeastOverride(normalizePrefYeastOverride(snap.prefYeastOverride));setPrefYeastIssue(null);
    setEntryNightKept(normalizeEntryNightKept(snap.entryNightKept));
    setAcceptedPlan(rb ? undefined : normalizeAcceptedPlan(snap.acceptedStartTime, snap.acceptedPreparationAt, snap.acceptedEatTime));
    setStarterPctOverride(snap.starterPctOverride);
    setAutoStarterPct(snap.autoStarterPct);
    setTargetDoughTemp(snap.targetDoughTemp);
    setFlourInFridge(snap.flourInFridge ?? false);
    setAddSeeds(snap.addSeeds ?? false);
    setPrefGoesInFridgeState(snap.prefGoesInFridge ?? true);
    setPoolishStorage(snap.poolishStorage ?? 'auto');
    setBigaStorage(snap.bigaStorage ?? 'auto');
    setMeasuredFlourTemp(snap.measuredFlourTemp); setMeasuredPrefermentTemp(snap.measuredPrefermentTemp);
    // Bake again: the saved allowance, else 1.5 %; resuming a bake whose dough is recorded keeps what was weighed.
    setWastePct(restoredWastePct(snap.wastePct));
    setPriorityOverride(snap.priorityOverride);
    if (snap.eatTime) setEatTime(shiftD(new Date(snap.eatTime)));
    if (snap.startTime) setStartTime(shiftD(new Date(snap.startTime)));
    {
      setBlocks(((snap.blocks ?? []) as unknown[]).map((b) => {
        const bl = b as { label: string; from: number; to: number; fridgeRemoval?: unknown; coveredActions?: unknown; bakeFromFridge?: unknown; shortWarmup?: unknown };
        return { label: bl.label, from: shiftD(new Date(bl.from)), to: shiftD(new Date(bl.to)), coveredActions:rb?undefined:normalizeCoveredActions(bl.coveredActions), fridgeRemoval: rb ? undefined : normalizeFridgeRemoval(bl.fridgeRemoval), ...(!rb&&typeof bl.bakeFromFridge==='number'&&Number.isFinite(bl.bakeFromFridge)?{bakeFromFridge:bl.bakeFromFridge}:{}), ...(!rb&&typeof bl.shortWarmup==='number'&&Number.isFinite(bl.shortWarmup)?{shortWarmup:bl.shortWarmup}:{}) };
      }));
    }
    setStarterEvents(restoreStarterEvents(snap.starterEvents).map(event => ({...event, time:shiftD(event.time), bellPeakTime:event.bellPeakTime ? shiftD(event.bellPeakTime) : undefined, bellStartTime:event.bellStartTime ? shiftD(event.bellStartTime) : undefined})));
    setRecipeGenerated(snap.recipeGenerated);
    setProtocolStale(!rb && snap.protocolStale === true);
    setExecutionClash(!rb && snap.executionClash === true);
    setModeChosen(snap.modeChosen);
    setAwaitingRecipeChoice(snap.awaitingRecipeChoice ?? !snap.modeChosen);
    setCustomBakeQuestion(snap.customBakeQuestion === true);
    // Sourdough starter state — snapshots saved after Jul 2026 include these
    setStarterState((snap.starterState ?? 'rt_fed') as 'rt_fed' | 'fridge_unfed' | 'fridge_fed');
    setStarterLocation((snap.starterLocation ?? 'rt') as 'rt' | 'fridge');
    setStarterTimingValid(snap.starterTimingValid !== false);
    setPlanningMode((snap.planningMode ?? 'last_fed') as 'last_fed' | 'know_peak');
    setLastFedTime(snap.lastFedTime ? new Date(snap.lastFedTime) : null);
    setKnownPeakTime(snap.knownPeakTime ? new Date(snap.knownPeakTime) : null);
    setLastFedAge((snap.lastFedAge as 'today'|'yesterday'|'days23'|'days45'|'week'|null) ?? null);
    setSimpleStarterAnswer(snap.simpleStarterAnswer ?? null);
    setHasNotFedYet(snap.hasNotFedYet ?? null);
    setFeedTime(null);setStarterPeakTime(null);
    const _snapLfr = snap.lastFeedRatio ?? snap.feedRatio ?? 1;
    setLastFeedRatio(_snapLfr as 1 | 2 | 4 | 5 | 10);
    const _snapNfr = snap.nextFeedRatio ?? snap.lastFeedRatio ?? snap.feedRatio ?? 1;
    setNextFeedRatio(_snapNfr as 1 | 2 | 4 | 5 | 10);
    setNextFeedRatioOverride((snap.nextFeedRatioOverride ?? null) as 1 | 2 | 4 | 5 | 10 | null);
    setRatioMode(snap.ratioMode === 'keep' ? 'keep' : 'recommend');
    setStarterMature(snap.starterMature !== false);
    setStarterHasRye(!!snap.starterHasRye);
    setTang((snap.tang ?? 'balanced') as 'mild' | 'balanced' | 'tangy');
    setFridgeOutTime(snap.fridgeOutTime ? new Date(snap.fridgeOutTime) : null);
    setUsingPeak2(!!snap.usingPeak2);
    setFeed2Time(snap.feed2Time ? new Date(snap.feed2Time) : null);
    setStarterFridgeInTime(snap.starterFridgeInTime ? new Date(snap.starterFridgeInTime) : null);
    setBakedDone(!rb && !!snap.bakedDone);
    setBakeEventId(rb ? null : event.id);
    if (freshStarterPlan) {
      // Feeding history describes the original bake, not the starter today.
      // Discard both observations and derived actions before solving again.
      setStarterEvents([]);
      setLastFedTime(null);
      setKnownPeakTime(null);
      setHasNotFedYet(null);
      setLastFedAge(null);
      setSimpleStarterAnswer(null);
      setFeedTime(null);
      setFeed2Time(null);
      setFridgeOutTime(null);
      setStarterFridgeInTime(null);
      setStarterPeakTime(null);
      setUsingPeak2(false);
      setPlanningMode('last_fed');
      setRecipeGenerated(false);
      setShowResults(false);
      setSessionSaved(false);
      setSessionRestored(false);
      setProtocolStale(false);
      setScheduleReady(false);
      setReviewMode(false);
      setSetupOverview(false);
      setActiveTab('setup');
      setActiveStep(snap.tab === 'simple' ? 7 : 1);
      setHighestStep(Math.max(snap.highestStep ?? 1, 7));
      setAdvancedStep(snap.tab === 'custom' ? 9 : 1);
      setAdvancedHighestStep(Math.max(snap.advancedHighestStep ?? 1, 9));
      setTimeout(endRestore, 200);
    } else if (snap.recipeGenerated) {
      setAdvancedStep(snap.tab === 'custom' ? 99 : 1);
      setActiveStep(snap.tab === 'custom' ? 1 : 99);
      setShowResults(true);
      setProtocolStale(false);
      setSessionSaved(!rb);
      setSessionRestored(true);
      setReviewMode(true);
      // Nav #2 — land the baker back on the tab they left (Recipe/Guide),
      // not a review-mode Setup they must decode. Rebakes start on Setup.
      const savedTab = snap.activeTab as 'setup' | 'plan' | 'guide' | 'pizzaparty' | 'sandwiches';
      if (rb || !savedTab) setActiveTab('setup');
      else if ((savedTab === 'pizzaparty' && snap.bakeType !== 'pizza') || (savedTab === 'sandwiches' && snap.bakeType !== 'bread')) setActiveTab('plan');
      else setActiveTab(savedTab);
      setTimeout(endRestore, 200);
    } else {
      const earlyCompanion = !rb && ((snap.activeTab === 'pizzaparty' && snap.bakeType === 'pizza') || (snap.activeTab === 'sandwiches' && snap.bakeType === 'bread' && !!snap.styleKey && !!sandwichFamilyForStyle(snap.styleKey)));
      setActiveTab(earlyCompanion ? snap.activeTab as 'pizzaparty'|'sandwiches' : 'setup');
      setActiveStep(snap.styleKey ? snap.activeStep ?? snap.highestStep ?? 1 : 1); setHighestStep(snap.highestStep ?? 1);
      setAdvancedStep(snap.styleKey ? snap.advancedStep ?? snap.advancedHighestStep ?? 1 : 1); setAdvancedHighestStep(snap.advancedHighestStep ?? 1);
      setReviewMode(false); setSetupOverview(false); setShowResults(false);
      setSessionSaved(!rb); setSessionRestored(true);
      setTimeout(endRestore, 200);
    }
    if(!rb)restoreNavigation(snap);
    else {
      setFillingsReturn(null);setPrepReturnToService(null);setShoppingReturnToFillings(false);setProtocolView('dough');setServiceView('dough');setActiveTab(snap.styleKey?'setup':'batch');
    }
    // Modern snapshots are authoritative, including an intentionally empty pizza list.
    // Legacy relational slots must not resurrect removed toppings after a partial save.
    if (Object.prototype.hasOwnProperty.call(snap, 'pizzaParty')) {
      const restoredQtys = snap.pizzaParty?.qtys ?? {};
      setCarriedPicks(rb && Object.values(restoredQtys).some(q => q > 0));
      setPizzaPartyQtys(restoredQtys);
      setBakedPartyQtys(rb ? {} : (snap.pizzaParty?.bakedQtys ?? {}));
      setPizzasConfirmed(Object.values(restoredQtys).some(q => q > 0));
      setPizzaPartyTab(rb ? 'pick' : (['pick','shop','prep','bake'].includes(snap.pizzaPartyTab ?? '') ? snap.pizzaPartyTab as 'pick'|'shop'|'prep'|'bake' : 'pick'));
      setPartyRestoreToken(v => v + 1);
    } else if (event.pizza_party_id) {
      partyHydratingRef.current = true;
      const { fetchPizzaPartySlots } = await import('../lib/supabase/fetchBakeEvents');
      const slotsMap = await fetchPizzaPartySlots([event.id]);
      const slots = slotsMap[event.id] ?? [];
      if (slots.length > 0) {
        const qtys: Record<string, number> = {};
        for (const slot of slots) {
          qtys[slot.preset_id] = (qtys[slot.preset_id] ?? 0) + (slot.qty ?? 1);
        }
        setPizzaPartyQtys(qtys);
        setPartyRestoreToken(v => v + 1);
      }
      partyHydratingRef.current = false;
      endRestore();
    }
    // Ticks travel in the snapshot (manual saves) — hydrate before tabs read
    if (rb || Object.prototype.hasOwnProperty.call(snap, 'pizzaParty')) {
      try { localStorage.setItem('bh_shop_ticks_v1', JSON.stringify(rb ? {} : snap.pizzaParty?.shopTicks ?? {})); } catch {}
    }
    if (rb || Object.prototype.hasOwnProperty.call(snap, 'pizzaParty')) {
      try { localStorage.setItem('bh_prep_ticks_v1', JSON.stringify(rb ? [] : snap.pizzaParty?.prepTicks ?? [])); } catch {}
    }
    if (rb) {
      setRecipeGenerated(false);setShowResults(false);setScheduleCandidateValid(false);setScheduleReady(false);setSetupOverview(false);
      setReviewMode(false);setProtocolStale(false);
      // Bake again opens on how much (18 Nov 2026 retention round 3: it opened on the kitchen); the kitchen and
      // the bake time, already a week later, follow.
      setActiveStep(snap.tab==='simple'?7:1);setAdvancedStep(snap.tab==='custom'?9:1);
      // A Customized bake opens on its bake time, then the recipe: its choices stand, and Quantity → Bake time
      // switched it to Simple (20 Nov 2026 round 6, Priya). A Simple bake opens on how much, as before.
      if (snap.styleKey && snap.tab==='custom') { setCustomBakeQuestion(true); setQuickRebake(true); setAdvancedHighestStep(value=>Math.max(value,snap.advancedHighestStep??10,10)); setSetupOverview(false); setActiveTab('setup'); scrollToStepTop(); }
      else if (snap.styleKey) { openDestination('batch'); setBatchView('quantity'); }
    }
    return true;
  }

  // Journal entries kept on this device: resume reopens that bake (and keeps
  // its entry), bake again is the existing rebake path with a new entry.
  async function openJournalEntry(entry: JournalEntry, rebake: boolean) {
    if (!rebake && bakeType && currentJournalId() === entry.id) { setShowProductHome(false); setShowWelcomeBack(false); return; }
    if (rebake) pendingPreviousNote.current = entry.note.trim();
    // Switching to a bake under way opens it at its due step, as resuming does.
    const resumeBefore = resumeToNow.current;
    if (!rebake) resumeToNow.current = true;
    const restored = await restoreFromBakeEvent({id:rebake ? '' : entry.accountEventId ?? '',dough_snapshot:entry.session,pizza_party_id:null},{rebake,journalId:rebake ? null : entry.id});
    if (!restored) { resumeToNow.current = resumeBefore; return; }
    scrollToStepTop();
  }

  async function repeatCurrentRecipe() {
    // Save the finished bake first for account users; a failure keeps it open.
    if (user && !await saveCurrentSession()) return;
    const snapshot = {...buildSessionPayload(),version:1 as const,savedAt:Date.now()};
    try { refreshCurrentJournalSnapshot(buildSessionPayload()); } catch {}
    try { const id=currentJournalId(); pendingPreviousNote.current=(id&&getJournalEntry(id)?.note.trim())||''; } catch {}
    if (await restoreFromBakeEvent({id:bakeEventId ?? '',dough_snapshot:snapshot,pizza_party_id:null},{rebake:true})) { try { forgetCurrentJournalBake(); } catch {} }
  }

  // ── Computed: Generate button / progress ──
  // Generate waits for the defaulted steps to be settled by the baker or their
  // profile. Without this the gate never blocked on them: 2 x 270 g, pizza00
  // and 'none' are all truthy from the first render, so a walk-through that
  // never opened those pages still produced a recipe built on three guesses.
  // Preferment and Flour are Custom-only steps; Simple has no page for either.
  // Levain styles have one leavening, so a one-option step would be a tap with
  // no choice. Their starter questions live with the bake time, where the feed is timed.
  const showPrefermentChoice = !isUnleavened && !directMethodOnly && !isLevainStyle(styleKey);
  const unsupportedEnrichedMethod = (enrichedDirectOnly && (yeastType === 'sourdough' || prefermentType !== 'none')) || !!(breadProtocol && !isUnleavened && (!breadProtocol.supportedPreferments.includes(prefermentType) || (!breadSupportsStarter && yeastType === 'sourdough')));
  const archivedFlourNames = archivedBlendSelections(flourBlend);
  const simpleRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && qtyChosen);
  const customRequiredDone = !!(bakeType && styleKey && numItems && itemWeight && ovenType && mixerType && yeastType && eatTime && flourBlend
    && qtyChosen && flourAnswered && (!showPrefermentChoice || prefermentChosen));
  // A sourdough plan needs its starter described (Customize clears the feed Simple implied):
  // without it no recipe is made or updated (round 6, Priya: Update recipe made one with no starter steps).
  const starterPlanReady = yeastType !== 'sourdough' || ((planningMode === 'know_peak' ? !!knownPeakTime : lastFedAge !== null && !!lastFedTime)
    && starterTimingValid && (recipeGenerated || starterEvents.length > 0));
  const canGenerate = !schedule?.preparationInvalid && scheduleCandidateValid && !scheduleEditing && !(tab === 'custom' ? advancedRecipe : recipe)?.protocolIssue && commercialPrefermentPlanReady && starterPlanReady && !unsupportedEnrichedMethod && !(flourChosen && archivedFlourNames.length) && (tab === 'simple' ? simpleRequiredDone : customRequiredDone);
  const missingRequiredStep = !bakeType || !styleKey ? 1
    : !numItems || !itemWeight || !qtyChosen ? 2
    : !ovenType || !mixerType ? 3
    : tab==='custom' && (!flourBlend || !flourAnswered) ? 6
    : !yeastType ? (tab==='custom'?7:6)
    : tab==='custom' && showPrefermentChoice && !prefermentChosen ? 8
    : !eatTime ? (tab==='custom'?9:7) : undefined;
  const generationBlocker = !canGenerate ? getSetupBlocker({
    custom:tab==='custom',fr:locale==='fr',
    batchTimingConflict:!!schedule?.batchTimingConflict,
    protocolIssue:(tab==='custom'?advancedRecipe:recipe)?.protocolIssue,
    unsupportedMixer:!!(breadProtocol&&mixerType&&!breadProtocol.supportedMixers.includes(mixerType)),
    unsupportedMethod:unsupportedEnrichedMethod,sourdough:yeastType==='sourdough',hasPreferment:prefermentType!=='none',
    prefermentPlanReady:commercialPrefermentPlanReady,starterPlanReady,schedulePlanReady:!schedule?.preparationInvalid && scheduleCandidateValid && !scheduleEditing,
    archivedFlour:flourChosen&&archivedFlourNames.length>0,
    requirementsComplete:tab==='simple'?simpleRequiredDone:customRequiredDone,missingRequiredStep,
  }) : undefined;
  const manualMixing = mixerType === 'hand' || mixerType === 'no_knead';
  // One batch that fits with room to spare needs no card: it shows once the dough nears the mixer's
  // capacity, needs splitting, or the baker has set a count or a capacity (14 Nov 2026).
  const batchComfortable = !manualMixing && suggestedMixingBatches===1 && mixingBatches===undefined && customMixerCapacityG===undefined && plannedDoughG <= mixerCapacityG; // shown only when the dough needs splitting (14 Nov 2026 audit)
  const mixerCapacityField = !manualMixing ? <><label style={{display:'flex',alignItems:'center',gap:12}}>{locale==='fr'?'Poids de pâte maximal (g)':'Maximum dough weight (g)'}<input type="number" min={100} max={1000000} step={100} value={customMixerCapacityG ?? ''} placeholder={String(mixerCapacityG)} onChange={e=>{const value=Number(e.target.value);if(!e.target.value)setCustomMixerCapacityG(undefined);else if(Number.isFinite(value)&&value>=100&&value<=1000000)setCustomMixerCapacityG(value);}} style={{width:110,minHeight:44}}/></label><p style={{margin:'6px 0 0',fontSize:14,color:'var(--smoke)'}}>{locale==='fr'?'Utilisez la limite de pâte indiquée par le fabricant.':'Use the dough capacity stated by the manufacturer.'}</p></> : undefined;
  const mixingBatchControl = mixerType && !batchComfortable && (!manualMixing || suggestedMixingBatches > 1 || mixingBatches !== undefined) ? <MixingBatchControl capacityField={mixerCapacityField} total={plannedDoughG} capacity={mixerCapacityG} count={selectedMixingBatches} recommended={suggestedMixingBatches} manual={manualMixing} knownCapacity={customMixerCapacityG!==undefined} override={mixingBatches!==undefined} fr={locale==='fr'} onChange={setMixingBatches}/> : null;


  // ── Styles ────────────────────────────────
  const isBread = bakeType === 'bread';
  // Localized style name — data.ts carries nameFr but several surfaces used .name unconditionally
  const styleDisplayName = (sk: string | null | undefined): string => {
    if (!sk) return '';
    const st = (ALL_STYLES as Record<string, { name?: string; nameFr?: string }>)[sk];
    return (locale === 'fr' ? st?.nameFr : undefined) ?? st?.name ?? sk;
  };
  const accentColor = isBread ? 'var(--bread)' : 'var(--terra)';

  // The crust segment shown as chosen, or -1 when the weight sits between two
  // crusts — a baker who typed 265g at 30cm is neither Classic nor Generous,
  // and pretending otherwise is how the three controls drift apart.
  const crustActive = (styleKey && crustMatchesWeight(styleKey, pizzaDiameter, pizzaCorn, itemWeight))
    ? pizzaCorn : -1;

  // ── Simple-mode step model (single source of truth) ──
  const localName = (o: unknown): string | null => {
    if (!o) return null;
    const r = o as { name?: string; nameFr?: string };
    return (locale === 'fr' ? r.nameFr : undefined) ?? r.name ?? null;
  };
  const fr = locale === 'fr';
  // With the day for the calendar and saved bakes; on screen the title is the name alone and the
  // day leads the summary line, so the title fits one line on a phone.
  const bakeAutoTitle = autoBakeTitle(bakeType, styleKey, numItems, eatTime ?? null, fr, styleKey ? styleDisplayName(styleKey) : '');
  const bakeAutoName = autoBakeTitle(bakeType, styleKey, numItems, null, fr, styleKey ? styleDisplayName(styleKey) : '', eatTime ? eatTime.getHours() : undefined);
  const ovenDisplayName = ovenType === 'pizza_oven'
    ? (ovenConstruction === 'masonry' ? (fr ? 'Four à pizza traditionnel' : 'Traditional pizza oven') : (fr ? 'Four à pizza compact' : 'Tabletop pizza oven'))
    : ovenType === 'steam_oven'
      ? (ovenConstruction === 'micro' ? (fr ? 'Four de microboulangerie' : 'Microbakery oven') : (fr ? 'Four vapeur domestique' : 'Home steam oven'))
      : localName(ovenData);
  const SIMPLE_STEPS: StepDef[] = ([
    { id: 1, group: 'making', chip: fr ? 'Style' : 'Style', title: bakeType==='bread'?(fr?'Choisissez votre pain':'Choose your bread'):(fr?'Quel style de pizza ?':'Which pizza style?'),
      value: styleKey ? styleDisplayName(styleKey) : null,
      // "Classic Neapolitan" and "New York pizza" carry a qualifier the baker
      // does not need re-read on a summary line.
      short: styleKey ? styleDisplayName(styleKey).replace(/^Classic | pizza$/g, '') : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, group: 'making', chip: fr ? 'Quantité' : 'Quantity', title: fr ? 'Quelle quantité de pâte ?' : 'How much dough?',
      value: qtyChosen ? (totalFlourTarget!==undefined&&bakeType==='bread'?`${displayWeight(totalFlourTarget,units,locale)} ${fr?'de farine':'flour'} · ${numItems} ${fr?'pièces':'pieces'}`:`${numItems} × ${displayWeight(Math.round(itemWeight),units,locale)}`) : null, prefilled: false,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, group: 'kitchen', chip: fr ? 'Cuisine' : 'Kitchen', title: fr ? 'Équipement et cuisine' : 'Equipment and kitchen',
      value: (ovenType && mixerType && (isUnleavened || yeastType))
        ? `${ovenDisplayName} · ${localName(MIXER_TYPES[mixerType])} · ${kitchenTemp}°C${!isUnleavened && yeastType ? ` · ${localName(YEAST_TYPES[yeastType])}` : ''}`
        : null,
      // The oven alone identifies the step; the mixer rarely changes the read.
      short: (ovenType && mixerType) ? ovenDisplayName : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    { id: 4, group: 'kitchen', chip: fr ? 'Frigo et eau' : 'Fridge & water', title: fr ? 'Dans votre cuisine' : 'In your kitchen',
      // This step sets the fridge; the kitchen temperature has its own screen.
      value: `${fr ? 'Frigo' : 'Fridge'} ${cToDisplay(fridgeTemp,units)}${tempUnit(units)}`, prefilled: true,
      gap: fr ? 'Le climat n\u2019est pas renseigné' : 'Climate not set' },
    { id: 6, group: 'dough', chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType && !(enrichedDirectOnly && yeastType === 'sourdough') ? localName(YEAST_TYPES[yeastType]) : null,
      short: yeastType
        ? ({ idy: 'IDY', ady: 'ADY', fresh: fr ? 'Fraîche' : 'Fresh', sourdough: fr ? 'Levain' : 'Sourdough' } as Record<string, string>)[yeastType]
          ?? localName(YEAST_TYPES[yeastType])
        : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    { id: 7, group: 'plan', chip: fr ? 'Heure de cuisson' : 'Bake time', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? formatBakeDateTime(eatTime, locale) // one line; busy times have their own review row (14 Nov 2026)
        : null,
      // The chip gets the bake time alone. Start time and busy windows are
      // consequences of it — the baker picks when to eat, everything else is
      // derived — and at full length this one chip was wider than the four
      // beside it put together.
      short: eatTime ? formatTime(eatTime, locale) : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
  ] as StepDef[]).filter(step => step.id !== 4 && step.id !== 6);
  const SIMPLE_LAST = SIMPLE_STEPS[SIMPLE_STEPS.length - 1].id;
  // ── Custom-mode step model ──
  // Preferment (8) is absent on the sourdough path, so this list is 10 or 9
  // entries long. Positions are indexes into it; ids never move.
  const flourSummary = (): string => {
    const primary = flourBlend.brandProduct ?? localName(FLOUR_DATA[flourBlend.flour1]) ?? '';
    if (!flourBlend.flour2 || flourBlend.ratio1 >= 100) return `100% ${primary}`;
    const hasThird = !!flourBlend.flour3 && flourBlend.ratio2 !== undefined && 100 - flourBlend.ratio1 - flourBlend.ratio2 > 0;
    const secondRatio = hasThird ? flourBlend.ratio2! : 100 - flourBlend.ratio1;
    const parts = [`${flourBlend.ratio1}% ${primary}`, `${secondRatio}% ${flourBlend.customFlour2Name ?? localName(FLOUR_DATA[flourBlend.flour2])}`];
    if (hasThird) parts.push(`${100 - flourBlend.ratio1 - secondRatio}% ${flourBlend.customFlour3Name ?? localName(FLOUR_DATA[flourBlend.flour3!])}`);
    return parts.join(' + ');
  };
  const kitchenAnswered = confirmed('climate',kitchenTemp);
  const kitchenPending = !isUnleavened && !kitchenAnswered;
  const reviewTiming = eatTime ? formatBakeDateTime(eatTime,locale) : null;
  // The busy times by name ("Nights, Lunch out"): presets by their chip name, the baker's own by theirs.
  const reviewBusy = (()=>{
    const names:string[]=[];
    for(const b of blocks){const n=b.label.endsWith(' night')?(fr?'Nuits':'Nights'):b.label.startsWith('Work · ')?(fr?'Semaine':'Weekdays'):b.label;if(n&&!names.includes(n))names.push(n);}
    return names.length?names.join(', '):null;
  })();
  const reviewDough = (()=>{
    const h=advancedRecipe?advancedRecipe.hydration:(manualHydration ?? (styleKey?ALL_STYLES[styleKey]?.hydration:undefined));
    const salt=advancedRecipe?.saltPct;
    if(h==null)return null;
    const pct=(v:number)=>formatPercent(Math.round(v*10)/10,locale);
    return fr?`${pct(h)} d’eau${salt!=null?` · ${pct(salt)} de sel`:''}`:`${pct(h)} water${salt!=null?` · ${pct(salt)} salt`:''}`;
  })();
  const reviewKitchen = `${fr ? 'Réfrigérateur' : 'Fridge'} ${cToDisplay(fridgeTemp,units)}${tempUnit(units)}`;
  const levainStyle = isLevainStyle(styleKey);
  const levainCustom = levainStyle && tab === 'custom' && yeastType === 'sourdough';
  // Simple sourdough: one "Your starter" screen between Kitchen and Bake time.
  // Custom keeps its detailed Starter step instead.
  const simpleStarterScreen = !isUnleavened && !!styleKey && (levainStyle || yeastType === 'sourdough') && !(tab === 'custom' && modeChosen);
  const starterStateDescribed = planningMode === 'know_peak' ? !!knownPeakTime : lastFedAge !== null && !!lastFedTime;
  // The starter's place and activity are asked, not assumed (14 Nov 2026): shown unanswered until
  // the baker taps one, and remembered through reloads with the other confirmed settings.
  const starterLocationAnswered = confirmed('starterLocation',starterLocation) || !!simpleStarterAnswer;
  const starterMatureAnswered = confirmed('starterMature',String(starterMature));
  const simpleStarterPending = simpleStarterScreen && !simpleStarterAnswer && !starterStateDescribed;
  // Custom with a levain preferment (pizza, or a bread whose method is chosen):
  // the same Starter step as the levain breads, just before Bake time.
  const levainPrefCustom = !levainStyle && tab === 'custom' && yeastType === 'sourdough' && prefermentType === 'levain';
  const customStarterStepId = levainCustom ? 8 : levainPrefCustom ? 11 : null;
  const starterStepValue = planningMode === 'know_peak' ? (knownPeakTime ? `${fr?'Pic':'Peak'} · ${formatTime(knownPeakTime,locale)}` : null)
        : lastFedAge ? `${starterLocation === 'fridge' ? (fr?'Frigo':'Fridge') : (fr?'Ambiante':'Room temperature')} · ${({today:['rafraîchi aujourd’hui','fed today'],yesterday:['rafraîchi hier','fed yesterday'],days23:['il y a 2–3 jours','fed 2–3 days ago'],days45:['il y a 4–5 jours','fed 4–5 days ago'],week:['une semaine+','fed a week+ ago']} as Record<string,[string,string]>)[lastFedAge][fr?0:1]}` : null;
  const simpleStarterLabel = simpleStarterAnswer === 'counter' ? (fr ? 'Sur le plan de travail' : 'On the counter')
    : simpleStarterAnswer === 'fridge' ? (fr ? 'Au réfrigérateur' : 'In the fridge')
    : simpleStarterAnswer === 'ready' ? (fr ? 'Bien monté et bullé' : 'Bubbly and risen') : null;
  const openSimpleStarter = () => { openDestination('batch'); setBatchView('starter'); scrollToStepTop(); };
  const CUSTOM_STEPS: StepDef[] = ([
    { id: 1, group: 'making', chip: fr ? 'Style' : 'Style', title: bakeType==='bread'?(fr?'Choisissez votre pain':'Choose your bread'):(fr?'Quel style de pizza ?':'Which pizza style?'),
      value: styleKey ? styleDisplayName(styleKey) : null,
      // "Classic Neapolitan" and "New York pizza" carry a qualifier the baker
      // does not need re-read on a summary line.
      short: styleKey ? styleDisplayName(styleKey).replace(/^Classic | pizza$/g, '') : null,
      gap: fr ? 'Le style n\u2019est pas choisi' : 'No style chosen yet' },
    { id: 2, group: 'making', chip: fr ? 'Quantité' : 'Quantity', title: fr ? 'Quelle quantité de pâte ?' : 'How much dough?',
      value: qtyChosen ? (totalFlourTarget!==undefined&&bakeType==='bread'?`${displayWeight(totalFlourTarget,units,locale)} ${fr?'de farine':'flour'} · ${numItems} ${fr?'pièces':'pieces'}`:`${numItems} × ${displayWeight(Math.round(itemWeight),units,locale)}`) : null, prefilled: false,
      gap: fr ? 'La quantité n\u2019est pas confirmée' : 'Quantity not confirmed' },
    // Oven and mixing are one page: same nature (your kitchen, not your
    // dough), both single-choice, both remembered by the profile.
    { id: 3, group: 'kitchen', chip: fr ? 'Équipement' : 'Equipment', title: fr ? 'Votre équipement' : 'Your equipment',
      value: (ovenType && mixerType)
        ? `${ovenDisplayName} · ${localName(MIXER_TYPES[mixerType])}`
        : null,
      // The oven alone identifies the step; the mixer rarely changes the read.
      short: (ovenType && mixerType) ? ovenDisplayName : null,
      prefilled: profileFields.has('equip'),
      gap: fr ? 'L\u2019équipement n\u2019est pas renseigné' : 'Equipment not set' },
    // Fridge & water moved into Fine-tune (14 Nov 2026): one number with a good default and the water source.
    { id: 6, group: 'dough', chip: fr ? 'Farine' : 'Flour', title: t('steps.flour.title'),
      // Once a recipe exists, the flour it was made with is shown (switching to Custom after the recipe).
      value: (flourChosen || recipeGenerated) && !archivedFlourNames.length ? flourSummary() : null, prefilled: false,
      gap: fr ? 'La farine n\u2019est pas confirmée' : 'Flour not confirmed' },
    ...(levainCustom ? [{
      // Levain breads: the starter's own questions, answered before the bake time.
      id: 8, group: 'dough', chip: fr ? 'Levain' : 'Starter', title: fr ? 'Votre levain' : 'Your starter',
      value: starterStepValue,
      gap: fr ? 'Le levain n’est pas renseigné' : 'Starter not set',
    } as StepDef] : []),
    ...(showPrefermentChoice ? [{
      // Levain styles start from a starter; the others choose a preferment.
      id: 8, group: 'dough', chip: levainStyle ? (fr ? 'Levain' : 'Starter') : (fr ? 'Préferment' : 'Preferment'),
      title: levainStyle ? (fr?'Votre levain':'Your starter') : (fr?'Quel préferment ?':'Which preferment?'),
      value: prefermentChosen && !(enrichedDirectOnly && prefermentType !== 'none')
        ? (prefermentType !== 'none' ? localName(PREFERMENT_TYPES[prefermentType]) : t('preferment.direct'))
        : null,
      prefilled: profileFields.has('preferment'),
      gap: fr ? 'Le préferment n\u2019est pas confirmé' : 'Preferment not confirmed',
    } as StepDef] : []),
    { id: 7, group: 'dough', chip: fr ? 'Levure' : 'Yeast', title: t('steps.7.title'),
      value: yeastType && !(enrichedDirectOnly && yeastType === 'sourdough') ? localName(YEAST_TYPES[yeastType]) : null,
      short: yeastType
        ? ({ idy: 'IDY', ady: 'ADY', fresh: fr ? 'Fraîche' : 'Fresh', sourdough: fr ? 'Levain' : 'Sourdough' } as Record<string, string>)[yeastType]
          ?? localName(YEAST_TYPES[yeastType])
        : null,
      prefilled: profileFields.has('yeast'),
      gap: fr ? 'La levure n\u2019est pas choisie' : 'No yeast chosen yet' },
    { id: 10, group: 'dough', chip: fr ? 'Peaufiner' : 'Fine-tune', title: t('dialIn.title'),
      value: manualHydration !== undefined
        ? `${manualHydration}% ${t('dialIn.hydrationSuffix')}`
        // The style's BASE hydration is not what the dough is made at — the
        // engine adjusts it for the oven and the climate, and the Fine-tune
        // page shows both ("Adjusted from 62% · oven -2%"). The chip was
        // printing the base, so the rail read 62% while the slider beside it
        // read 60% and the recipe was built at 60%. One fact, three places,
        // and the chip was showing the one number nothing used.
        : advancedRecipe ? `${Math.round(advancedRecipe.hydration * 2) / 2}% ${t('dialIn.hydrationSuffix')}`
        : styleKey ? `${ALL_STYLES[styleKey].hydration}% ${t('dialIn.hydrationSuffix')}` : null,
      prefilled: true,
      gap: fr ? 'La pâte n\u2019est pas confirmée' : 'Dough not confirmed' },
    ...(levainPrefCustom ? [{
      // Levain preferment: the starter's questions, answered before the bake time.
      id: 11, group: 'dough', chip: fr ? 'Levain' : 'Starter', title: fr ? 'Votre levain' : 'Your starter',
      value: starterStepValue,
      gap: fr ? 'Le levain n’est pas renseigné' : 'Starter not set',
    } as StepDef] : []),
    { id: 9, group: 'plan', chip: fr ? 'Heure de cuisson' : 'Bake time', title: bakeType === 'bread' ? t('steps.8bread.title') : t('steps.8pizza.title'),
      value: eatTime
        ? formatBakeDateTime(eatTime, locale) // one line; busy times have their own review row (14 Nov 2026)
        : null,
      // The chip gets the bake time alone. Start time and busy windows are
      // consequences of it — the baker picks when to eat, everything else is
      // derived — and at full length this one chip was wider than the four
      // beside it put together.
      short: eatTime ? formatTime(eatTime, locale) : null,
      gap: fr ? 'L\u2019heure de cuisson n\u2019est pas choisie' : 'No bake time chosen yet' },
  ] as StepDef[]).filter(step=>step.id!==7 || (!isUnleavened && prefermentType!=='levain'));
  const CUSTOM_LAST = CUSTOM_STEPS[CUSTOM_STEPS.length - 1].id;
  // Step IDs are stored in existing drafts. A change of method can remove a
  // page (for example, commercial yeast after selecting levain).
  const visibleCustomStep = CUSTOM_STEPS.some(step => step.id === advancedStep)
    ? advancedStep
    : advancedStep === 99 ? CUSTOM_LAST
    : showPrefermentChoice && !prefermentChosen ? 8
    : !flourAnswered ? 6 : 10;
  useEffect(() => {
    if (tab === 'custom' && activeTab === 'setup' && modeChosen && advancedStep !== 99 && advancedStep !== visibleCustomStep)
      setAdvancedStep(visibleCustomStep);
  }, [tab, activeTab, modeChosen, advancedStep, visibleCustomStep]);
  // Fine-tune comes before Custom's bake-time step: until that step has planned
  // the dough, the yeast amount there would be read from another plan.
  const [customPlanSeen, setCustomPlanSeen] = useState(false);
  useEffect(() => { if (tab === 'custom' && activeTab === 'setup' && visibleCustomStep === 9) setCustomPlanSeen(true); }, [tab, activeTab, visibleCustomStep]);
  // Round 15 (owner O2): one Use/Keep line wherever an entered amount's plan can be saved or seen — Fine-tune, the time
  // editor, the Recipe and Preparation. Its steps: the plan `entryPlan` builds while that plan waits to be derived (an
  // amount just typed), else the plan on screen; every hands-on step between 22:00 and 07:00 not declared free. Keep is
  // remembered as "keep the night steps for this amount" (`entryNightKept`), never as a plan.
  const entryNightKeptNow = !!entryNightKept && entryNightKept.yeast === yeastPctOverride
    && (entryNightKept.pref?.type ?? null) === (prefYeastOverride?.type ?? null) && entryNightKept.pref?.pct === prefYeastOverride?.pct;
  const entryNightPref = prefermentType === 'poolish' || prefermentType === 'biga' ? prefermentType as FlourPreferment : null;
  // Round 17 (findings 1, 5): the line names every night step of the plan on screen (nightHandsOn, one definition).
  const screenNightSteps = useMemo(() => schedule ? nightHandsOn([...(schedule.availabilityActions ?? []),
    ...(prefStartTime && entryNightPref ? [{id:'preferment', at:prefStartTime}] : [])], blocks).filter(a => +a.at > Date.now()) : [],
  [schedule, prefStartTime, entryNightPref, blocks]);
  const entryNightKey = entryInForce && tab === 'custom' && (recipeGenerated || customPlanSeen) && eatTime && yeastType && yeastType !== 'sourdough'
    ? JSON.stringify([effectiveYeastOverride, effectivePrefYeastOverride, prefermentType, +eatTime, blocks.map(b => [+b.from, +b.to]), kitchenTemp, styleKey, poolishStorage, bigaStorage,
      planReplanPending ? null : screenNightSteps.map(a => a.id + '@' + +a.at), entryNightKeptNow, Math.floor(Date.now() / 900000)]) : null;
  const entryNight = useMemo(() => {
    if (!entryNightKey || !eatTime || !styleKey || !mixerType || !yeastType) return null;
    const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
    const o = yeastEntryInput(conversion);
    if (!o) return null;
    try {
      const steps = planReplanPending ? cachedEntryPlan(effectiveYeastOverride, o)?.nightSteps ?? [] : screenNightSteps;
      if (!steps.length) return null;
      const pref = entryNightPref;
      if (entryNightKeptNow) return {steps, pref, offer: null, kept: true};
      // The amount to offer: the final dough's when entered, else the preferment's.
      let offer: {shown:number; idy:number; pref:boolean} | null = null;
      // Round 13 (item 4): an offer weighing what the calculated amount weighs is the calculated amount, which has its own button.
      const weighs = (pct: number, flourG?: number) => flourG && flourG > 0 ? formatYeastDose(flourG * pct / 100) : String(Math.round(pct * 100));
      const calcIdy = calcYeast?.idyPct, calcPref = calcYeast?.pref;
      const calcDough = calcIdy !== undefined ? calcIdy * conversion : null;
      if (effectiveYeastOverride !== undefined) {
        const found = nightFreeShownPct(effectiveYeastOverride, o);
        const shown = found !== null && calcDough !== null && weighs(found, recipe?.flour) === weighs(calcDough, recipe?.flour) ? null : found;
        if (shown !== null) offer = {shown, idy: Math.round(shown / conversion * 10000) / 10000, pref: false};
      } else if (pref && effectivePrefYeastOverride !== undefined && calcPref?.type === pref) {
        const entered = Math.round(effectivePrefYeastOverride * conversion * 1000) / 1000, calc = Math.round(calcPref.pct * conversion * 1000) / 1000;
        const found = Math.abs(calc - entered) < 0.0005 ? null : nearestFittingShownPct(entered, calc, v => {
          const p = Math.round(v / conversion * 10000) / 10000;
          if (!prefYeastFit(pref, p).fits) return false;
          const e = yeastEntryInput(conversion, p);
          return !!e && !!entryPlanSearch(effectiveYeastOverride, e);
        });
        const shown = found !== null && weighs(found, recipe?.preferment?.prefFlour) === weighs(calc, recipe?.preferment?.prefFlour) ? null : found;
        if (shown !== null) offer = {shown, idy: Math.round(shown / conversion * 10000) / 10000, pref: true};
      }
      return {steps, pref, offer, kept: false};
    } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryNightKey]);
  /** The line itself, the same everywhere: the steps, then (until Keep) the nearest amount without them and Keep, both
   * plain buttons (the screen's one filled button stays its own). Outside Fine-tune a new amount re-derives the plan and
   * the recipe at once, as Update recipe does after a plan-input edit (`replanReturn`). */
  const entryNightView = (where: 'finetune' | 'editor' | 'recipe' | 'preparation') => {
    if (!entryNight || (where !== 'finetune' && where !== 'editor' && protocolStale)) return null;
    const conversion = yeastType ? YEAST_TYPES[yeastType]?.conversion ?? 1 : 1;
    const pctText = (value: number) => bakerPct(value, fr);
    // Round 17 (finding 6): Keep names the amount as the recipe rounds it ("Keep 0.15%", not 0.151%).
    const recipeRound = (v: number) => v < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10;
    const keptShown = yeastPctOverride !== undefined ? recipeRound(yeastPctOverride * conversion) : prefYeastOverride ? recipeRound(prefYeastOverride.pct * conversion) : null;
    const button: React.CSSProperties = {minHeight:44,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:9,background:'var(--paper)',color:'var(--char)',fontSize:16,cursor:'pointer'};
    const rederive = () => { setPlanReplanPending(true); if (where !== 'finetune' && recipeGenerated && !replanReturn) setReplanReturn({from:+startTime,settled:false}); };
    const offer = entryNight.offer;
    return <div data-entry-night data-entry-night-where={where} {...(entryNight.kept ? {'data-kept-night': ''} : {})} style={{margin: where === 'finetune' ? '8px 0 0' : '0 0 8px'}}>
      <p style={{margin:'0 0 8px',fontSize:14,lineHeight:1.45,color:'var(--ash)'}}>{nightStepsLine(entryNight.steps,fr,entryNight.pref)}</p>
      {!entryNight.kept && <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        {offer && <button type="button" data-entry-night-avoid style={button} onClick={() => { if (offer.pref && entryNightPref) setPrefYeastOverride({type: entryNightPref, pct: offer.idy}); else setYeastPctOverride(offer.idy); rederive(); }}>{fr?`Utiliser ${pctText(offer.shown)} (sans étape de nuit)`:`Use ${pctText(offer.shown)} (no night steps)`}</button>}
        {keptShown !== null && <button type="button" data-entry-night-keep style={button} onClick={() => setEntryNightKept({...(yeastPctOverride!==undefined?{yeast:yeastPctOverride}:{}),...(prefYeastOverride?{pref:prefYeastOverride}:{})})}>{fr?`Garder ${pctText(keptShown)}`:`Keep ${pctText(keptShown)}`}</button>}
      </div>}
    </div>;
  };

  const customFlow: StepFlow = {
    editReturn: recipeGenerated ? {label:setupReturnLabel,onReturn:finishSetupEdit} : undefined,
    steps: CUSTOM_STEPS,
    activeId: visibleCustomStep,
    highestStep: advancedHighestStep,
    locale,
    onJump: (id) => openSetupStep(id,true),
    onGapJump: (id) => {openSetupStep(id,true);setGapReturnTo(CUSTOM_LAST);},
    onPrev: (id) => {
      // Equipment is Custom's first page: before a recipe exists, back returns
      // to the bake time chosen before the Simple/Custom decision.
      if(id===3){if(equipmentPanel==='mixer')setEquipmentPanel('oven');else if(!recipeGenerated){openBakeTimeInputs();return;}else setSetupOverview(true);scrollToStepTop();return;}
      const i = CUSTOM_STEPS.findIndex(x => x.id === id);
      openSetupStep(CUSTOM_STEPS[Math.max(0, i - 1)].id,true);
    },
    onNext: (id) => {if(fillingsReturn&&recipeGenerated){setSetupOverview(true);scrollToStepTop();}else advanceAdv(id);},
    nextIdFor: nextCustomStep,
    onGenerate: handleGenerate,
    onReview: () => { setSetupOverview(true); scrollToStepTop(); },
    showGenerate: canGenerate && !!eatTime && !(sessionRestored && recipeGenerated),
    generationBlocker,
    generateLabel: recipeGenerated ? (fr ? 'Mettre à jour ma recette' : 'Update my recipe') : (fr ? 'Créer ma recette' : 'Create my recipe'),
    onSeePlan: finishSetupEdit,
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    // Coming back from a gap step means the baker has now seen it and kept
    // what was there. A prefilled default only counts as adopted once
    // `highest > id` — "moved past its page" — and a backwards jump never
    // moves past anything, so without this the same step is reported missing
    // for ever and the CTA sends you to the page you just came from.
    onGapReturn: () => {
      if (advancedStep === 1 && !styleKey) return;
      if (advancedStep === 6 && (!flourAnswered || archivedFlourNames.length)) return;
      if (advancedStep === 8 && !prefermentChosen) return;
      // Leaving a gap step means the baker has seen it and settled it, so it
      // counts as answered from here on. `find` returns the FIRST unanswered
      // step, so everything before it is already answered and raising the
      // ceiling to reach it cannot silently adopt a step nobody looked at.
      const settled = Math.max(advancedHighestStep, advancedStep + 1);
      const found = CUSTOM_STEPS.slice(CUSTOM_STEPS.findIndex(step=>step.id===advancedStep)+1).find(
        st => !stepAnswered(st, settled, CUSTOM_STEPS));
      // When the next gap IS the last step, that is just going back to the
      // plan — leaving gapReturnTo set there would strand a stale "back to
      // plan" button on any step the baker visits afterwards.
      const nextGap = found && found.id !== CUSTOM_LAST ? found : undefined;
      if (nextGap) {
        setAdvancedHighestStep(Math.max(settled, nextGap.id));
        setAdvancedStep(nextGap.id);   // gapReturnTo stays set: the chain continues
      } else {
        // Raise the ceiling to the page we are landing on, as onJump does.
        // Without it the last step stays unanswered, becomes its own gap, and
        // its CTA offers to jump to the page it is already showing.
        setAdvancedHighestStep(Math.max(settled, CUSTOM_LAST));
        setGapReturnTo(null);
        setAdvancedStep(CUSTOM_LAST);
      }
      scrollToStepTop();
    },
  };



  const simpleFlow: StepFlow = {
    editReturn: recipeGenerated ? {label:setupReturnLabel,onReturn:finishSetupEdit} : undefined,
    steps: SIMPLE_STEPS,
    // A restored session parks activeStep on the 99 sentinel; in page mode
    // that would render nothing, so it lands on the last step instead.
    activeId: SIMPLE_STEPS.some(step=>step.id===activeStep) ? activeStep : (activeStep===4 || activeStep===6) ? 3 : SIMPLE_LAST,
    highestStep,
    locale,
    onJump: (id) => openSetupStep(id,false),
    onGapJump: (id) => {openSetupStep(id,false);setGapReturnTo(SIMPLE_LAST);},
    onPrev: (id) => {
      if(id===3){openSetupStep(7,false);return;}
      if(id===7&&!recipeGenerated){if(collectingBakeTime){openSetupStep(2,false);if(!isUnleavened)setBatchView(simpleStarterScreen?'starter':'kitchen');}else openBakeTimeInputs();return;}
      const i = SIMPLE_STEPS.findIndex(x => x.id === id);
      openSetupStep(SIMPLE_STEPS[Math.max(0, i - 1)].id,false);
    },
    onNext: (id) => {if(fillingsReturn&&recipeGenerated){setSetupOverview(true);scrollToStepTop();}else advance(id);},
    nextIdFor: (id) => nextUnanswered(SIMPLE_STEPS, id, highestStep),
    onGenerate: handleGenerate,
    onReview: () => { setSetupOverview(true); scrollToStepTop(); },
    showGenerate: canGenerate && !(sessionRestored && recipeGenerated),
    generationBlocker,
    generateLabel: recipeGenerated ? (fr ? 'Mettre à jour ma recette' : 'Update my recipe') : (fr ? 'Créer ma recette' : 'Create my recipe'),
    onSeePlan: finishSetupEdit,
    recipeGenerated,
    gapReturn: gapReturnTo != null,
    onGapReturn: () => {
      if (activeStep === 1 && !styleKey) return;
      const settled = Math.max(highestStep, activeStep + 1);
      const found = SIMPLE_STEPS.find(
        st => st.id > activeStep && !stepAnswered(st, settled, SIMPLE_STEPS));
      const nextGap = found && found.id !== SIMPLE_LAST ? found : undefined;
      if (nextGap) {
        setHighestStep(Math.max(settled, nextGap.id));
        setActiveStep(nextGap.id);
      } else {
        setHighestStep(Math.max(settled, SIMPLE_LAST));
        setGapReturnTo(null);
        setActiveStep(SIMPLE_LAST);
      }
      scrollToStepTop();
    },
  };

  // The scheduler page is excluded: its chart diamonds are dragged sideways,
  // and a 60px drag there must move a feed time, never the page.
  const simpleOrganisationFlow:StepFlow={...simpleFlow,steps:SIMPLE_STEPS.filter(step=>step.id>=3),activeId:Math.max(3,simpleFlow.activeId)};
  const customOrganisationFlow:StepFlow={...customFlow,steps:CUSTOM_STEPS.filter(step=>step.id>=3),activeId:customFlow.activeId<=2 ? 3 : customFlow.activeId};
  // The bake time was answered before "Customize my bake": Fine-tune creates the recipe instead
  // of walking back to that question. Its planner is mounted here showing only the
  // "Before your recipe" sheet, so a clash is still asked once.
  const fineTuneFinishes = tab==='custom' && customQuestionOnly && !!eatTime && advancedStep===10 && nextCustomStep(10)===9
    && (customStarterStepId===null || starterStateDescribed)
    && customOrganisationFlow.steps.every(step=>step.id===9||step.id===10||stepAnswered(step,customOrganisationFlow.highestStep,customOrganisationFlow.steps));
  // While Update recipe re-derives the plan (replanReturn), a step without its own planner hosts a hidden one,
  // so the bake time is not walked (round 9 E). Never a second instance: only when no step planner is mounted.
  const customStepPlannerMounted = !!styleKey && !planEdit && (customOrganisationFlow.activeId===9
    || (customStarterStepId!==null && customOrganisationFlow.activeId===customStarterStepId) || (customOrganisationFlow.activeId===10 && fineTuneFinishes));
  const customReplanHost = tab==='custom' && !!replanReturn && !replanReturn.settled && !planEdit && !customStepPlannerMounted;
  // Bake again of a Customized bake: once the bake time (and a sourdough starter) is answered, Create my recipe.
  const rebakeFinishes = quickRebake && tab==='custom' && !recipeGenerated && !!eatTime && customQuestionOnly
    && (customStarterStepId===null || (starterStateDescribed && starterLocationAnswered && starterMatureAnswered))
    && customOrganisationFlow.steps.every(step=>step.id===9||step.id===10||step.id===customStarterStepId||stepAnswered(step,customOrganisationFlow.highestStep,customOrganisationFlow.steps));
  const rebakeCreateButton = <button data-bh-forward data-rebake-generate type="button" style={NEXT_CTA} onClick={()=>{if(advancedStep!==9&&customDecisionPending)openSetupStep(9,true);
    // The new week's plan may still be validating: the sheet's effect creates the recipe once it is (or asks the clash).
    if(!customDecisionPending&&!scheduleCandidateValid){setDecisionSheet('generate');return;}finishFromFineTune();}}>{customOrganisationFlow.generateLabel}</button>;
  // A clash opens the sheet; a plan the sheet cannot settle opens the full planner; otherwise the sheet's effect creates the recipe.
  const finishFromFineTune = () => {
    if(!customDecisionPending&&!scheduleCandidateValid){openSetupStep(9,true);setPlanDetail(true);return;}
    setDecisionSheet('generate');
  };
  const simpleSwipeRef = useStepSwipe(simpleOrganisationFlow,
    tab === 'simple' && activeTab === 'setup' && simpleFlow.activeId !== SIMPLE_LAST && simpleFlow.activeId !== 3);
  const customSwipeRef = useStepSwipe(customOrganisationFlow,
    tab === 'custom' && activeTab === 'setup' && customFlow.activeId !== 9 && customFlow.activeId !== 3);




  // Custom shows only what the baker (or their profile) chose: Simple's silent home oven and hand
  // kneading are working assumptions, not answers (14 Nov 2026).
  const ovenPicked = !!ovenType && (tab!=='custom' || confirmed('oven',ovenType));
  const mixerPicked = !!mixerType && (tab!=='custom' || confirmed('mixer',mixerType));
  // The same for the leavening: Simple never asks it. A sourdough style's starter is the style's own answer.
  const yeastPicked = !!yeastType && (tab!=='custom' || confirmed('yeast',yeastType) || yeastType==='sourdough');
  // A generated recipe's equipment is the "last bake" the next one starts from (see rememberLastEquipment).
  useEffect(() => {
    if (!recipeGenerated || !bakeType) return;
    rememberLastEquipment({bakeType,oven:ovenPicked&&confirmed('oven',ovenType)?ovenType:null,mixer:mixerPicked&&confirmed('mixer',mixerType)?mixerType:null,
      yeast:yeastType&&yeastType!=='sourdough'&&confirmed('yeast',yeastType)?yeastType:null,
      kitchenTemp:kitchenAnswered?kitchenTemp:null,fridgeTemp,flour:flourChosen&&!archivedFlourNames.length&&!(styleKey&&STYLE_DEFAULT_BLENDS[styleKey])?flourBlend:null});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeGenerated, bakeType, ovenType, mixerType, yeastType, confirmedSettings, kitchenTemp, fridgeTemp, flourChosen, flourBlend]);
  const equipmentFromProfile = (profileFields.has('oven') && ovenPicked) || (profileFields.has('equip') && mixerPicked);
  const equipmentChoices = <>
    {!compactPiadina && equipmentPanel==='mixer' && ovenPicked && <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:12,fontSize:14}}>
      <span>{ovenDisplayName}</span><button type="button" onClick={()=>{setEquipmentPanel('oven');scrollToStepTop();}} style={{minHeight:44,border:0,background:'transparent',color:'var(--terra)',textDecoration:'underline'}}>{fr?'Modifier le four':'Change oven'}</button>
    </div>}
    <h3 className="bh-section-title">{compactPiadina?(fr?'Cuisson à la poêle':'Pan cooking'):equipmentPanel==='oven'?(fr?'Four':'Oven'):(fr?'Pétrissage':'Kneading')}</h3>
    {(equipmentPanel==='oven'||compactPiadina) && <OvenPicker bakeType={bakeType ?? 'pizza'} styleKey={styleKey} selected={ovenPicked ? ovenType : null} construction={ovenConstruction} onConstructionChange={setOvenConstruction} onSelect={value=>{setOvenType(value);confirmSetting('oven',value);}} />}
    {(equipmentPanel==='mixer'||compactPiadina) && <>
      {compactPiadina&&<h3 className="bh-section-title">{fr?'Pétrissage':'Kneading'}</h3>}
      {tab==='simple' ? <SimpleMixerPicker locale={locale} selected={mixerType} onSelect={value=>{if(value!==mixerType){setWaterMethod(value==='spiral'?'direct':'premelt');setSpiralIceConfirmed(false);}setCustomMixerCapacityG(undefined);setMixerType(value);confirmSetting('mixer',value);}} styleKey={styleKey ?? undefined} /> : <MixerPicker totalDoughG={numItems * itemWeight} locale={locale} selected={mixerPicked ? mixerType : null} onSelect={value=>{if(value!==mixerType){setWaterMethod(value==='spiral'?'direct':'premelt');setSpiralIceConfirmed(false);}setCustomMixerCapacityG(undefined);setMixerType(value);confirmSetting('mixer',value);}} styleKey={styleKey ?? undefined} bakeType={bakeType ?? undefined} kitchenTemp={kitchenTemp} />}
      {mixingBatchControl}
    </>}
  </>;

  // Pizza bakers choose whole pizzas, so the section is "Pizzas"; bread keeps its fillings.
  const mealNoun=bakeType==='pizza'?'Pizzas':fr?'Garnitures':'Fillings';
  // Values the baker has not chosen are named once, in a note under the summary
  // title, instead of a "suggested" tag repeated on every row.
  // Catalogue names are title-cased ("Levure Sèche Instantanée"); summaries read in sentence case.
  const sentenceCase = (value:string|null) => value ? value.replace(/(\s)(\p{Lu})(?=\p{Ll})/gu,(_m,space:string,letter:string)=>space+letter.toLowerCase()) : value;
  const reviewEquipment = [ovenType && sentenceCase(ovenDisplayName ?? ''),mixerType && sentenceCase(localName(MIXER_TYPES[mixerType]))].filter(Boolean).join(' · ');
  const reviewAmbient = reviewKitchen;
  const reviewLeavening = yeastType && !isUnleavened ? sentenceCase(localName(YEAST_TYPES[yeastType])) : null;
  const methodPicked = confirmed('method',prefermentType) || (prefermentType==='levain' && starterStateDescribed);
  const yeastOpen = !!yeastType && !isUnleavened && !(tab==='custom' && prefermentType==='levain') && !confirmed('yeast',yeastType);
  const equipmentOpen = (!!ovenType && !confirmed('oven',ovenType)) || (!!mixerType && !confirmed('mixer',mixerType));
  // Simple shows equipment, kitchen and leavening on one row (3).
  // What the stale card names: the one setting that changed, and a way to keep the old value.
  const staleChange = (()=>{
    const generic = {sentence: fr ? 'Vous avez modifié vos choix.' : 'You changed your choices.', undo: undefined as undefined | {label:string; run:()=>void}};
    if (!protocolStale || !generatedRecipeInputKey.current) return generic;
    let before: unknown[], now: unknown[];
    try { before = JSON.parse(generatedRecipeInputKey.current); now = JSON.parse(recipeInputKey); } catch { return generic; }
    const changed = now.map((v,i)=>JSON.stringify(v)!==JSON.stringify(before[i])?i:-1).filter(i=>i>=0);
    if (changed.length !== 1) return generic;
    const i = changed[0], old = before[i];
    const temp = (c:number) => `${cToDisplay(c,units)}${tempUnit(units)}`;
    const named: Record<number, {what:(v:unknown)=>string; keep?:(v:unknown)=>{label:string; run:()=>void}}> = {
      2: {what: v => fr ? `la quantité : ${bakeQuantityLabel(Number(v),bakeType,styleKey,fr)}` : `the quantity to ${bakeQuantityLabel(Number(v),bakeType,styleKey,fr)}`,
          keep: v => ({label: fr ? `Garder ${bakeQuantityLabel(Number(v),bakeType,styleKey,fr)}` : `Keep ${bakeQuantityLabel(Number(v),bakeType,styleKey,fr)}`, run: () => setNumItems(Number(v))})},
      3: {what: v => fr ? `le poids par pièce : ${displayWeight(Math.round(Number(v)),units,locale)}` : `the weight per piece to ${displayWeight(Math.round(Number(v)),units,locale)}`,
          keep: v => ({label: fr ? `Garder ${displayWeight(Math.round(Number(v)),units,locale)}` : `Keep ${displayWeight(Math.round(Number(v)),units,locale)}`, run: () => setItemWeight(Number(v))})},
      5: {what: () => fr ? 'le four' : 'the oven'},
      7: {what: () => fr ? 'la méthode de pétrissage' : 'the mixing method'},
      10: {what: () => fr ? 'la levure' : 'the yeast'},
      11: {what: v => fr ? `la cuisine à ${temp(Number(v))}` : `the kitchen to ${temp(Number(v))}`,
          keep: v => ({label: fr ? `Garder ${temp(Number(v))}` : `Keep ${temp(Number(v))}`, run: () => setKitchenTemp(Number(v))})},
      13: {what: v => fr ? `le réfrigérateur à ${temp(Number(v))}` : `the fridge to ${temp(Number(v))}`,
          keep: v => ({label: fr ? `Garder ${temp(Number(v))}` : `Keep ${temp(Number(v))}`, run: () => setFridgeTemp(Number(v))})},
      19: {what: () => fr ? 'le préferment' : 'the preferment'},
    };
    // The two storages close the key (round 9, bug B).
    if (i >= now.length - 2) return {sentence: fr ? `Vous avez modifié l’endroit où ${prefermentType==='biga'?'la biga':'le poolish'} fermente.` : `You changed where the ${prefermentType==='biga'?'biga':'poolish'} ferments.`, undo: undefined};
    const entry = named[i];
    if (!entry) return generic;
    return {sentence: fr ? `Vous avez modifié ${entry.what(now[i])}.` : `You changed ${entry.what(now[i])}.`, undo: entry.keep && old !== null && old !== undefined ? entry.keep(old) : undefined};
  })();
  const simpleSuggestedRows = { '3': equipmentOpen || yeastOpen };
  const simpleKitchenSummary = [reviewEquipment,reviewAmbient,reviewLeavening].filter(Boolean).join(' · ');
  const firstRecipeAction = new Date(Math.min(
    +startTime,
    ...(schedule?.availabilityActions ?? []).map(action=>+action.at),
    ...(prefStartTime ? [+prefStartTime] : []),
    // The starter's take-out step (round 13, item 7: Priya's pizza began its plan and Preparation at the refresh, 9:45pm,
    // after the 8:15pm take-out the guide shows first).
    ...(yeastType==='sourdough' ? shownStarterEvents.filter(e=>!e.isPast && e.kind!=='last_fed' && e.kind!=='known_peak').map(e=>+e.time) : []),
  ));
  const firstStarterAction = yeastType==='sourdough' ? shownStarterEvents.find(e=>!e.isPast && +e.time===+firstRecipeAction && e.kind!=='last_fed' && e.kind!=='known_peak') : undefined;
  const firstRecipeActionLabel = (firstStarterAction ? starterActionLabelFor(firstStarterAction,shownStarterEvents,fr) : undefined) ?? (prefStartTime && +prefStartTime===+firstRecipeAction
    ? (prefermentType==='biga'?(fr?'Préparer la biga':'Make Biga'):(fr?'Préparer le poolish':'Make Poolish'))
    : (schedule?.availabilityActions ?? []).some(action=>action.id==='autolyse'&&+action.at===+firstRecipeAction) ? (fr?'Autolyse puis pétrissage':'Autolyse, then mixing')
    : +firstRecipeAction < +startTime ? (yeastType==='sourdough'?(fr?'Préparer le levain':'Build the levain'):(fr?'Préparer le préferment':'Make the preferment')) : (fr?'Pétrir la pâte':'Start Dough'));
  // A fridge removal the baker arranged for someone at home, for the Preparation summary.
  const coveredFridgeRemovalAt = (()=>{const at=blocks.find(block=>block.fridgeRemoval&&eatTime&&block.fridgeRemoval.bake===+eatTime)?.fridgeRemoval?.at;return at?new Date(at):undefined;})();
  // Another live bake in the same oven until after this one's preheat would start: the oven is already hot, so the
  // preheat is "Bring the oven back to 250 °C after the campagne" at the time it comes out, in the guide, the plan and
  // the calendar (20 Nov 2026 round 6, Thomas). Nothing with one bake (owner's rule B: no other bake, no other use).
  const sharedOven = (()=>{
    if(!recipeGenerated||!eatTime||!schedule)return null;
    const others=otherOvenUses();if(!others.length)return null;
    const shared=sharedOvenFor({preheatAt:+(schedule.preheatStart??eatTime),bakeAt:+eatTime,ovenType},others,fr);
    if(!shared)return null;
    const celsius=bakeType==='bread'&&styleKey?leanBreadBake(styleKey,itemWeight,ovenType??undefined,numItems)?.tempStaticC:undefined;
    return {...shared,title:ovenBackTitle(fr,shared.after,{celsius,max:bakeType==='pizza'&&(ovenType??'').startsWith('home_oven')},units)};
  })();
  // Every remaining hands-on step, as calendar events with an alert at their time.
  function planCalendarEvents(from:number):PlanCalendarEvent[] {
    const singleLoaf=bakeType==='bread'&&numItems===1;
    const panStyle=!!styleKey&&isPanPizzaStyle(styleKey);
    // Only key steps, one alert each (see planCalendar.ts).
    const events:PlanCalendarEvent[]=keyPlanEvents(schedule?.availabilityActions??[],fr,{singleLoaf,panStyle,from})
      .map(event=>sharedOven&&event.key==='preheat'?{...event,at:new Date(sharedOven.at),label:sharedOven.title}:event).filter(event=>+event.at>=from);
    if(prefStartTime&&+prefStartTime>=from&&yeastType!=='sourdough')events.push({key:'preferment',at:prefStartTime,label:prefermentType==='biga'?(fr?'Préparer la biga':'Make Biga'):(fr?'Préparer le poolish':'Make Poolish')});
    if(yeastType==='sourdough'){
      const counts:Record<string,number>={};
      for(const event of guideStarterEvents){
        if(event.isPast||event.kind==='last_fed'||event.kind==='known_peak'||+event.time<from)continue;
        const label=starterActionLabelFor(event,guideStarterEvents,fr);
        if(!label)continue;
        counts[event.kind]=(counts[event.kind]??0)+1;
        events.push({key:`starter-${event.kind}-${counts[event.kind]}`,at:starterStepShownTime(event),label,alertBeforeMin:event.kind==='fridge_out'?10:0});
      }
    }
    return events;
  }
  // The journal entry is the bake's identity; it survives the bake time moving.
  const planCalendarId = eatTime ? (currentJournalId() ?? calendarBakeId(styleKey,eatTime)) : null;
  const bakeCalendarLabel = fr?'Enfourner':'Bake';
  function addPlanToCalendar() {
    if(!eatTime||!planCalendarId)return;
    const events=planCalendarEvents(Date.now()-60000);
    const title=bakeName||bakeAutoTitle;
    const previous=readExportedSteps(planCalendarId);
    downloadPlanCalendar(buildPlanCalendar({title,events,bakeAt:eatTime,bakeLabel:bakeCalendarLabel,bakeId:planCalendarId,previous}),'baker-hub-plan.ics');
    writeExportedSteps(planCalendarId,exportedSteps(events,eatTime,bakeCalendarLabel));
    setCalendarExports(v=>v+1);
  }
  // Key steps after the first one, for the recipe's plan (the calendar's list).
  // Several pizzas one at a time keep the oven busy: the plan's last line says until when (18 Nov 2026 retention round 3).
  const recipeBakeEnd = (()=>{if(!eatTime||bakeType!=='pizza')return null;const end=bakeEndAt(+eatTime,ovenBusyMinutes(bakeType,styleKey,numItems,ovenType));return end?new Date(end):null;})();
  const coveredAt=new Set(blocks.flatMap(block=>[...(block.coveredActions??[]).map(action=>action.at),...(block.fridgeRemoval?[block.fridgeRemoval.at]:[])]));
  const recipePlanSteps = (()=>{
    if(!recipeGenerated||!eatTime||!schedule)return [];
    // A feed whose time has come stays on the plan until the next step, as the starter card keeps it
    // (18 Nov 2026 retention round 4: the pre-mix feed vanished from Your plan at 8:31).
    const dueFeed=yeastType==='sourdough'?overdueStarterFeed(starterEvents,[],Date.now(),+startTime):undefined;
    const from=Math.min(Date.now(),dueFeed?+dueFeed.time:Infinity)-60000;
    const steps=planCalendarEvents(from).filter(e=>+e.at>+firstRecipeAction&&+e.at<+eatTime).sort((a,b)=>+a.at-+b.at).map(e=>({key:e.key??String(+e.at),at:new Date(e.at),label:e.label,busy:blocks.some(block=>+e.at>+block.from&&+e.at<+block.to)&&!(entryNight&&coveredAt.has(+e.at)&&blocks.some(block=>isNightBlock(block)&&+e.at>+block.from&&+e.at<+block.to))}));
    // Round 13 (item 7): a night step is named once, in the night line (entryNightView), not again on its row.
    return steps;
  })();
  // Preparation runs the Recipe's busy check (recipePlanSteps' "during a busy time") once a recorded fact
  // (a feed, the preferment, the mix) has moved the plan without the clash sheet: a step still to come in a
  // busy period the baker has not agreed to cover is the one clash line (18 Nov 2026 retention).
  const preparationBusy=(starterFeedRecords.length>0||!!execution||!!mixExecution)&&recipePlanSteps.some(step=>step.busy&&+step.at>Date.now()&&!coveredAt.has(+step.at));
  // A plan already in the calendar whose steps have since moved (any step, not only
  // Start Dough or the bake): the card says so once, where the button is.
  const calendarOutdated = (()=>{
    void calendarExports;
    if(!recipeGenerated||!eatTime||!planCalendarId||!hasExportedPlan(planCalendarId))return false;
    const now=Date.now();
    const sent=readExportedSteps(planCalendarId);
    const current=exportedSteps(planCalendarEvents(now-60000),eatTime,bakeCalendarLabel);
    for(const [key,step] of Object.entries(current)) if(sent[key]?.at!==step.at) return true;
    for(const [key,step] of Object.entries(sent)) if(!current[key]&&step.at>now) return true;
    return false;
  })();
  // Yeast is named only when it changes by a tenth or more: a few hundredths of a gram
  // are inside what a kitchen scale reads and what the dough notices.
  const yeastChangeMatters=(from:number,to:number)=>from>0&&Math.abs(to-from)/from>=0.1;
  // Grams of two yeast types are never compared (round 8, S7): after a yeast change the line names the new yeast and its amount.
  // With a poolish or biga the amount is all the yeast weighed, the preferment's and the final dough's
  // (recipeYeastTotal): said as the total (round 9, bug C: it was called the preferment's).
  const yeastChangeLine=(from:number,to:number,typeChanged=false)=>{const inPref=prefermentType==='poolish'||prefermentType==='biga';
    if(typeChanged){const name=(localName(YEAST_TYPES[yeastType ?? 'instant'])??'').toLowerCase();return fr?`Levure${inPref?' au total':''} : ${formatYeastDose(to,locale)} de ${name}.`:`${inPref?'Total yeast':'Yeast'} now ${formatYeastDose(to,locale)} ${name}.`;}
    return fr?`Levure${inPref?' au total':''} : ${formatYeastDose(to,locale)} (au lieu de ${formatYeastDose(from,locale)}).`:`${inPref?'Total yeast':'Yeast'} now ${formatYeastDose(to,locale)} (was ${formatYeastDose(from,locale)}).`;};
  // Only a plan already sent to the calendar needs sending again.
  const planCalendarLine=<span data-plan-calendar style={{display:'flex',flexWrap:'wrap',alignItems:'center',columnGap:12,color:'var(--ash)'}}>{fr?'Votre agenda a les anciens horaires.':'Your calendar has the old times.'}<button type="button" className="bh-back-action" style={{minHeight:44}} onClick={addPlanToCalendar}>{fr?'Mettre à jour l’agenda':'Update calendar'}</button></span>;
  const planInlineNote = planNote ? <span role="status" data-plan-note style={{display:'block',padding:'2px 0 8px',fontSize:14,lineHeight:1.5,color:'var(--ash)'}}>
    <span style={{color:'var(--sage)',fontWeight:600}}>{fr?'Recette mise à jour.':'Recipe updated.'}</span>
    {planNote.yeast&&yeastChangeMatters(planNote.yeast.from,planNote.yeast.to)&&<>{' '}{yeastChangeLine(planNote.yeast.from,planNote.yeast.to)}</>}
    {calendarOutdated&&planCalendarLine}
  </span> : null;
  const setupSteps = tab==='custom' ? CUSTOM_STEPS : SIMPLE_STEPS.filter(step=>step.id!==3);
  // Equipment and yeast read in sentence case, as the summary does ("By hand", "Levure sèche
  // instantanée"), and French style names too; English style and flour brand names keep their capitals.
  const stepLink = (step:StepDef):BakeLink => ({label:step.chip,value:step.id===2&&!qtyChosen?null:((step.id===1&&fr)||step.id===3||step.id===(tab==='custom'?7:6)?(step.value ? step.value.split(' · ').map(part=>sentenceCase(part)).join(' · ') : step.value):step.value),disabled:step.id>1&&!styleKey,onChoose:()=>openSetupStep(step.id)});
  const bakeLinks:BakeLink[] = [
    {label:fr?'Fournée':'Bake',value:bakeType==='bread'?(fr?'Pain':'Bread'):'Pizza',onChoose:backToProducts},
    ...setupSteps.filter(step=>step.id<=2).map(stepLink),
    ...(!isUnleavened&&styleKey?[{label:fr?'Cuisine':'Kitchen',value:kitchenAnswered?`${cToDisplay(kitchenTemp,units)}${tempUnit(units)}`:null,onChoose:()=>{openDestination('batch');setBatchView('kitchen');scrollToStepTop();}}]:[]),
    ...(simpleStarterScreen?[{label:fr?'Levain':'Starter',value:simpleStarterLabel,onChoose:openSimpleStarter}]:[]),
    ...(collectingBakeTime ? [{label:fr?'Heure de cuisson':'Bake time',value:eatTime?formatTime(eatTime,locale):null,disabled:!styleKey||!qtyChosen,onChoose:openBakeTimeInputs}] : modeChosen?setupSteps.filter(step=>step.id>2).map(step=>({...stepLink(step),group:tab==='custom'&&step.group!=='plan'?'custom' as const:'basics' as const})):[]),
  ];
  const currentSubsection = destination==='batch' ? (batchView==='quantity'?(fr?'Quantité':'Quantity'):batchView==='kitchen'?(fr?'Cuisine':'Kitchen'):batchView==='starter'?(fr?'Levain':'Starter'):'Style') : !modeChosen ? 'Mode' : (tab==='simple'&&activeStep===7 ? (fr?'Heure de cuisson':'Bake time') : setupSteps.find(step=>step.id===(tab==='custom'?advancedStep:activeStep))?.chip ?? (fr?'Ma fournée':'My bake'));
  const renderQuantity = (roundView:'count'|'size') => (<PrototypeQuantityPicker roundView={roundView} bakeType={bakeType ?? 'pizza'} locale={locale} units={units} styleKey={styleKey ?? undefined}
                totalFlourTarget={bakeType==='bread'?totalFlourTarget:undefined}
                onFlourTargetChange={value=>{setTotalFlourTarget(value);setQtyChosen(true);if(value!==undefined){setWastePct(undefined);setItemWeight(value*1.8/Math.max(1,numItems));}else setItemWeight(Math.max(weightBounds.min,Math.min(weightBounds.max,Math.round(itemWeight))));}}
                itemLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'plaque':'tray') : (fr?'pièce':'piece')) : undefined}
                countLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Nombre de plaques':'Number of trays') : (fr?'Nombre de pièces':'Number of pieces')) : bakeType==='bread' ? `${fr?'Nombre de':'Number of'} ${breadNoun(styleKey,2,fr)}` : undefined}
                weightLabel={breadProtocol ? (styleKey==='focaccia' ? (fr?'Pâte par plaque':'Dough per tray') : (fr?'Pâte par pièce':'Dough per piece')) : undefined}
                roundPizza={bakeType === 'pizza' && STYLE_HAS_DIAMETER.includes(styleKey ?? '')}
                count={numItems} itemWeight={itemWeight} diameter={pizzaDiameter}
                pizzaSizes={PIZZA_SIZE_CHOICES[styleKey ?? '']}
                breadSizes={bakeType==='bread'&&!breadProtocol&&totalFlourTarget===undefined?BREAD_SIZE_CHOICES[styleKey ?? '']:undefined}
                sizeNote={bakeType!=='bread'?undefined:totalFlourTarget===undefined?`${bakeQuantityLabel(numItems,bakeType,styleKey,fr)} ${fr?'de':'of'} ${displayWeight(Math.round(itemWeight),units,locale)}`:`${bakeQuantityLabel(numItems,bakeType,styleKey,fr)} · ${fr?'à partir de':'from'} ${displayWeight(totalFlourTarget,units,locale)} ${fr?'de farine':'of flour'}`}
                diameterBounds={{ min: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.[0][0] ?? 22, max: PIZZA_WEIGHT_TABLE[styleKey ?? '']?.at(-1)?.[0] ?? 35 }}
                crust={(['thin','classic','generous'] as const)[pizzaCorn] ?? 'classic'}
                weightIsManual={crustActive < 0} weightBounds={weightBounds}
                calculatedWeight={pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn)}
                calculateWeight={(diameter, crust) => pizzaWeightFromTable(styleKey ?? 'neapolitan', diameter, ['thin','classic','generous'].indexOf(crust))}
                onCountChange={value => chooseNumItems(value)} onItemWeightChange={value => chooseItemWeight(value)}
                onDiameterChange={setPizzaDiameter} onCrustChange={crust => setPizzaCorn(['thin','classic','generous'].indexOf(crust))}
                onUseCalculatedWeight={() => chooseItemWeight(pizzaWeightFromTable(styleKey ?? 'neapolitan', pizzaDiameter, pizzaCorn))}
              />);
  // Recipe and My bake name the bake in full; elsewhere the section bar carries it.
  const compactBakeContext = recipeGenerated && !browsingFillings && ['shopping','protocol','service'].includes(destination);
  // "Your bake" lists My bake's answers; in Custom, The basics before Customize (16 Nov 2026).
  const showStepInBar = !execution&&!mixExecution&&!browsingFillings&&!setupOverview&&['batch','organisation'].includes(destination);
  const journeySteps:BakeStepLink[] = [...bakeLinks.filter(link=>link.group!=='custom'),...bakeLinks.filter(link=>link.group==='custom')]
    .map(link=>({...link,current:showStepInBar&&link.label===currentSubsection}));
  // The bar after the recipe says what comes next in the plan, not the page's own title (16 Nov 2026 review).
  const journeyNext = (()=>{
    if(!recipeGenerated||!eatTime||!schedule)return undefined;
    const now=Date.now();
    // The same 15-minute grid as the step list (FR showed 18h40 here and 18h45 on the step).
    const whenOf=(exact:Date)=>{const at=roundToQuarter(exact);return at.toDateString()===new Date(now).toDateString()?formatClock(at,locale):`${at.toLocaleDateString(fr?'fr-FR':'en-GB',{weekday:'short'})} ${formatClock(at,locale)}`;};
    // Preparation's own step, as the guide marks it: a due step reads "Now" (16 Nov retention review).
    if(guideClock&&!bakedDone){
      if(guideClock.kind==='now'||guideClock.at<=now)return fr?`Maintenant : ${guideClock.title}`:`Now: ${guideClock.title}`;
      return fr?`Ensuite : ${guideClock.title}, ${whenOf(new Date(guideClock.at))}`:`Next: ${guideClock.title}, ${whenOf(new Date(guideClock.at))}`;
    }
    const next=[...planCalendarEvents(now),{key:'bake',at:eatTime,label:bakeCalendarLabel}].filter(e=>+e.at>now).sort((a,b)=>+a.at-+b.at)[0];
    if(!next)return undefined;
    const when=whenOf(new Date(next.at));
    return fr?`Ensuite : ${next.label}, ${when}`:`Next: ${next.label}, ${when}`;
  })();
  const journeySummary = recipeGenerated&&eatTime ? `${bakeQuantityLabel(numItems,bakeType,styleKey,fr)} · ${formatBakeDateTime(eatTime,locale)}` : undefined;
  const bakeNavigator = bakeType && !showProductHome ? <BakeNavigator active={browsingFillings?'recipe':destination} fr={fr} onChange={next=>{if(next==='batch'){if(recipeGenerated)openSetupReview();else if(styleKey&&qtyChosen)openDestination('organisation');else openDestination('batch');}else openDestination(next);}} top={stickTop}
    recipeMeal={pizzaPartyEnabled||(styleKey&&sandwichEnabled)?{label:mealNoun,selected:hasFillings,active:browsingFillings,onChoose:()=>{
      // From Preparation or Baking & serving, late toppings return to the exact step the baker was on.
      // Elsewhere one Pizzas bar however you arrive (16 Nov 2026 review): after the recipe it is the
      // journey step (‹ Recipe · Shopping list →); before it, back to My bake and on to the recipe.
      if(styleKey&&(destination==='protocol'||destination==='service')){captureEditReturn();setBatchView('fillings');setActiveTab('batch');scrollToStepTop();return;}
      if(recipeGenerated){openToppingsStep();return;}
      setFillingsReturn(null);setBatchView('fillings');setActiveTab('batch');scrollToStepTop();}}:undefined}
    contextLabel={compactBakeContext?bakeQuantityLabel(numItems,bakeType,styleKey,fr):undefined}
    stepLabel={showStepInBar?currentSubsection:undefined} steps={journeySteps} recipeReady={!!recipeGenerated} summary={journeySummary} nextStep={journeyNext}
    headline={styleKey?(qtyChosen?bakeHeadline(bakeType,styleKey,numItems,eatTime,locale):styleDisplayName(styleKey)):undefined} bakeTimeSet={!!eatTime} /> : null;

  // Toppings are planned with the dough, before buying: Recipe → Toppings → Shopping list.
  // A plain loaf (tartine family) goes on to the Shopping list; its tartines stay optional in Your bake
  // (17 Nov 2026 retention: "Fillings →" on a pain de campagne read as a step every loaf needs).
  const fillingsStep = !!recipeGenerated && (pizzaPartyEnabled||sandwichEnabled&&sandwichFamilyForStyle(styleKey??'')!=='tartine');
  const fillingsStepLabel = bakeType==='pizza' ? 'Pizzas' : (fr?'Garnitures':'Fillings');
  function openToppingsStep(){setFillingsReturn({destination:'shopping',view:'dough',forward:true});setBatchView('fillings');setActiveTab('batch');scrollToStepTop();}

  // A clash on a generated plan's times: the choice is in the card above; the bar is the way back to the
  // plan the recipe was made with (backToLastGoodPlan), never a disabled button (18 Nov 2026 retention).
  // Going back restores the recipe as it was made: when that drops a preferment chosen since, the label says so (bug 4, round 8).
  const goodPlanMethod = lastGoodPlanRef.current?.prefermentType;
  const backDropsMethod = !!goodPlanMethod && goodPlanMethod !== prefermentType && (prefermentType==='biga'||prefermentType==='poolish');
  const goodMethodName = goodPlanMethod==='biga'?(fr?'à la biga':'biga'):goodPlanMethod==='poolish'?(fr?'au poolish':'poolish'):goodPlanMethod==='levain'?(fr?'au levain':'levain'):(fr?'en pâte directe':'direct-dough');
  const backToGoodPlanLabel = backDropsMethod?(fr?`Retour à la recette ${goodMethodName}`:`Back to the ${goodMethodName} recipe`):(fr?'Retour à la recette':'Back to Recipe');
  const backToGoodPlanButton = <button data-bh-forward data-back-to-good-plan type="button" style={{...SECONDARY_CTA,width:'100%'}} onClick={backToLastGoodPlan}>{backToGoodPlanLabel}</button>;
  // While a clash card asks its question (round 9, bug G footnote), the card holds the one forward action: the way
  // back to the recipe as it was made is the bar's back control ("‹ Recipe"), and the forward slot stays empty, so
  // no button reads "Back to Recipe" where the baker reads forward.
  const backToGoodPlanBack = <button type="button" className="bh-back-action" data-back-to-good-plan onClick={backToLastGoodPlan}><BackLabel text={backToGoodPlanLabel}/></button>;
  // The bars below reach backToGoodPlanButton only on a generated recipe whose plan clashes (the full editor).
  const simpleClashCardBar = recipeGenerated && simpleDecisionPending && !collectingBakeTime && !(bakeTimeOnly && eatTime) && !scheduleEditing && !!eatTime && !scheduleCandidateValid;
  const customClashCardBar = recipeGenerated && customDecisionPending && !rebakeFinishes && !(bakeTimeOnly && eatTime && (customStarterStepId === null || starterStateDescribed)) && !(customStarterStepId !== null && !starterStateDescribed) && !scheduleEditing && !customQuestionOnly && !scheduleCandidateValid;
  // ── Render ────────────────────────────────
  // One scheduler element: Custom levain shows its starter questions on the
  // Starter step and the plan on Bake time. Only one step is mounted at a time.
  // One simple scheduler element, rendered on the bake-time step or, for a step moved from
  // the Recipe's plan, inline there (never both: planEdit unmounts the step's copy).
  // Another live bake in the same oven: the planner's "Before your recipe" sheet says it with any clash, once.
  const ovenOthers = eatTime && styleKey ? otherOvenUses() : [];
  const ovenShare = ovenOthers.length ? {others:ovenOthers, leadMin:preheatMin, busyMin:ovenBusyMinutes(bakeType,styleKey,numItems,ovenType), ovenType:ovenType ?? null} : undefined;
  const keepOvenAt = (bakeMs:number) => { ovenKept.current = bakeMs; };
  const renderSimpleScheduler = (extra?: {planInline?: {focus:'mix'|'pref';applyLabel:string;onClose:()=>void}}) => (
              <SchedulePicker {...extra} bigaStorage={bigaStorage} inputsOnly={!extra?.planInline&&(collectingBakeTime||bakeTimeOnly)} simpleStarterAnswer={simpleStarterAnswer} yeastPctOverride={effectiveYeastOverride} prefYeastPctOverride={effectivePrefYeastOverride} entryNightNode={entryNightView('editor')} planEntry={planEntryFor} entryTimingFor={entryTimingFor} replanPending={planReplanPending} onReplanHandled={()=>setPlanReplanPending(false)} starterBulkFactor={levainBulkFactor} autoStarterPct={yeastType==='sourdough'&&starterPctOverride===undefined?autoStarterPct??null:null} onAutoStarterPctChange={handleAutoStarterPct} canRaiseStarterPct={canRaiseStarterPct} keptStarterPlan={starterFactsKept} holdStarterPct={starterFactsKept&&starterPctOverride===undefined&&autoStarterPct!=null}
                {...poolishInputs} poolishPeakAtMix={poolishPeakAtMix}
                mixerCapacityG={mixerCapacityG} itemWeight={itemWeight} wastePct={totalFlourTarget===undefined?wasteAllowance:0}
                onEditQuantity={() => {setBatchView('quantity'); openDestination('batch'); scrollToStepTop();}}
                mixingBatches={selectedMixingBatches}
                onEditingChange={setScheduleEditing}
                readyTimeOffsetMinutes={readyTimeEstimate?Math.ceil(readyTimeEstimate.minutes):undefined}
                readyTimeLabel={readyTimeEstimate?.[fr?'labelFr':'labelEn']}
                readyTimeNote={readyTimeEstimate?.[fr?'noteFr':'noteEn']}
                numItems={numItems}
                key={starterPlanResetKey}
                mode="simple"
                onSimpleDecisionChange={setSimpleDecisionPending}
                decisionSheet={decisionSheet!==null&&tab==='simple'}
                onDecisionSheetClose={()=>setDecisionSheet(null)} onDecisionSheetBack={backToBakeTime}
                mixerType={mixerType ?? 'hand'}
                confirmedPlan={confirmedSchedulePlan}
                timingOverrides={timingOverrides}
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={planPreheatMin} preheatExtraMin={preheatExtraMin} exitLeadMin={exitLeadMin} planLadder={planLadder} ovenShare={ovenShare} onOvenKept={keepOvenAt}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onPrefermentValidityChange={onPrefermentValidityChange}
                onScheduleValidityChange={setScheduleCandidateValid}
                savedPrefOffsetHours={prefOffsetH}
                savedPrefGoesInFridge={prefGoesInFridge}
                onFeedTimeChange={setFeedTime}
                onStarterEventsChange={setStarterEvents}
                savedStarterEvents={starterEvents}
                onFeed2TimeChange={setFeed2Time}
                onFridgeOutTimeChange={setFridgeOutTime}
                onUsingPeak2Change={setUsingPeak2}
                onStarterFridgeInTimeChange={setStarterFridgeInTime}
                onStarterStateChange={setStarterState}
                starterLocation={starterLocation}
                planningMode={planningMode}
                lastFedTime={lastFedTime}
                knownPeakTime={knownPeakTime}
                onStarterLocationChange={loc=>{setStarterLocation(loc);confirmSetting('starterLocation',loc);}} starterLocationAnswered={starterLocationAnswered} starterMatureAnswered={starterMatureAnswered}
                onPlanningModeChange={setPlanningMode}
                onLastFedTimeChange={setLastFedTime}
                onKnownPeakTimeChange={setKnownPeakTime}
                hasNotFedYet={hasNotFedYet}
                onHasNotFedYetChange={setHasNotFedYet}
                lastFedAge={lastFedAge}
                onLastFedAgeChange={setLastFedAge}
                starterMature={starterMature} starterHasRye={starterHasRye} onStarterMatureChange={value=>{setStarterMature(value);confirmSetting('starterMature',String(value));}} onStarterHasRyeChange={setStarterHasRye}
                lastFeedRatio={lastFeedRatio}
                onLastFeedRatioChange={setLastFeedRatio}
                nextFeedRatio={nextFeedRatio}
                onNextFeedRatioChange={setNextFeedRatio}
                nextFeedRatioOverride={nextFeedRatioOverride}
                onNextFeedRatioOverrideChange={setNextFeedRatioOverride}
                ratioMode={ratioMode}
                onRatioModeChange={setRatioMode}
                onStarterPeakTimeChange={setStarterPeakTime}
                starterTimingValid={starterTimingValid}
                onStarterTimingValidityChange={setStarterTimingValid}
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={handleScheduleChange}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={flourStrength}
                completedMixAt={mixExecution?.actualAt} execution={execution} validateMadeFormula={(candidate,times)=>!execution||madeFormulaMatches(execution,candidate,times)} replanRequested={replanRequested||(yeastType==='sourdough'&&starterRecoveryPending)} onCancelReplan={()=>{setReplanRequested(false);openDestination('recipe');}} onAcceptReplan={acceptFreshPlan}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
  );
  const renderCustomScheduler = (section:'all'|'starter'|'plan', extra?: {planInline?: {focus:'mix'|'pref';applyLabel:string;onClose:()=>void}}) => (
              <SchedulePicker
                {...extra}
                {...poolishInputs} poolishPeakAtMix={poolishPeakAtMix}
                inputsOnly={!extra?.planInline&&(bakeTimeOnly||customQuestionOnly)&&section!=='starter'}
                schedulerSection={section}
                onUseCalculatedYeast={()=>{setYeastPctOverride(undefined);setPlanReplanPending(true);}}
                onSimpleDecisionChange={setCustomDecisionPending}
                decisionSheet={decisionSheet!==null&&tab==='custom'}
                onDecisionSheetClose={()=>setDecisionSheet(null)} onDecisionSheetBack={backToBakeTime}
                enteredYeastShownPct={effectiveYeastOverride!==undefined&&yeastType?Math.round(effectiveYeastOverride*(YEAST_TYPES[yeastType]?.conversion??1)*1000)/1000:undefined}
                poolishStorage={prefermentType==='poolish'?poolishStorage:'auto'} bigaStorage={bigaStorage}
                yeastPctOverride={effectiveYeastOverride} prefYeastPctOverride={effectivePrefYeastOverride} entryNightNode={entryNightView('editor')} planEntry={planEntryFor} entryTimingFor={entryTimingFor}
                replanPending={planReplanPending} onReplanHandled={()=>setPlanReplanPending(false)} starterBulkFactor={levainBulkFactor} autoStarterPct={yeastType==='sourdough'&&starterPctOverride===undefined?autoStarterPct??null:null} onAutoStarterPctChange={handleAutoStarterPct} canRaiseStarterPct={canRaiseStarterPct} keptStarterPlan={starterFactsKept} holdStarterPct={starterFactsKept&&starterPctOverride===undefined&&autoStarterPct!=null}
                mixerCapacityG={mixerCapacityG} itemWeight={itemWeight} wastePct={totalFlourTarget===undefined?wasteAllowance:0}
                onEditQuantity={() => {setBatchView('quantity'); openDestination('batch'); scrollToStepTop();}}
                mixingBatches={selectedMixingBatches}
                onEditingChange={setScheduleEditing}
                readyTimeOffsetMinutes={readyTimeEstimate?Math.ceil(readyTimeEstimate.minutes):undefined}
                readyTimeLabel={readyTimeEstimate?.[fr?'labelFr':'labelEn']}
                readyTimeNote={readyTimeEstimate?.[fr?'noteFr':'noteEn']}
                numItems={numItems}
                key={starterPlanResetKey}
                mode="custom"
                mixerType={mixerType ?? 'hand'}
                confirmedPlan={confirmedSchedulePlan}
                timingOverrides={timingOverrides}
                startTime={startTime} eatTime={eatTime} blocks={blocks}
                preheatMin={planPreheatMin} preheatExtraMin={preheatExtraMin} exitLeadMin={exitLeadMin} planLadder={planLadder} ovenShare={ovenShare} onOvenKept={keepOvenAt}
                styleKey={styleKey ?? ''}
                kitchenTemp={kitchenTemp}
                fridgeTemp={fridgeTemp}
                schedule={schedule}
                bakeType={bakeType ?? 'pizza'}
                isSourdough={yeastType === 'sourdough'}
                prefermentType={prefermentType ?? 'none'}
                onPrefermentValidityChange={onPrefermentValidityChange}
                onScheduleValidityChange={setScheduleCandidateValid}
                savedPrefOffsetHours={prefOffsetH}
                savedPrefGoesInFridge={prefGoesInFridge}
                onFeedTimeChange={setFeedTime}
                onStarterEventsChange={setStarterEvents}
                savedStarterEvents={starterEvents}
                onFeed2TimeChange={setFeed2Time}
                onFridgeOutTimeChange={setFridgeOutTime}
                onUsingPeak2Change={setUsingPeak2}
                onStarterFridgeInTimeChange={setStarterFridgeInTime}
                onStarterStateChange={setStarterState}
                starterLocation={starterLocation}
                planningMode={planningMode}
                lastFedTime={lastFedTime}
                knownPeakTime={knownPeakTime}
                onStarterLocationChange={loc=>{setStarterLocation(loc);confirmSetting('starterLocation',loc);}} starterLocationAnswered={starterLocationAnswered} starterMatureAnswered={starterMatureAnswered}
                onPlanningModeChange={setPlanningMode}
                onLastFedTimeChange={setLastFedTime}
                onKnownPeakTimeChange={setKnownPeakTime}
                hasNotFedYet={hasNotFedYet}
                onHasNotFedYetChange={setHasNotFedYet}
                lastFedAge={lastFedAge}
                onLastFedAgeChange={setLastFedAge}
                starterMature={starterMature} starterHasRye={starterHasRye} onStarterMatureChange={value=>{setStarterMature(value);confirmSetting('starterMature',String(value));}} onStarterHasRyeChange={setStarterHasRye}
                lastFeedRatio={lastFeedRatio}
                onLastFeedRatioChange={setLastFeedRatio}
                nextFeedRatio={nextFeedRatio}
                onNextFeedRatioChange={setNextFeedRatio}
                nextFeedRatioOverride={nextFeedRatioOverride}
                onNextFeedRatioOverrideChange={setNextFeedRatioOverride}
                ratioMode={ratioMode}
                onRatioModeChange={setRatioMode}
                onStarterPeakTimeChange={setStarterPeakTime}
                starterTimingValid={starterTimingValid}
                onStarterTimingValidityChange={setStarterTimingValid}
                onPrefOffsetChange={setPrefOffsetH}
                onPrefGoesInFridgeChange={setPrefGoesInFridgeState}
                onChange={handleScheduleChange}
                onReady={() => {}}
                sessionRestored={sessionRestored}
                recipeGenerated={recipeGenerated}
                flourStrength={flourStrength}
                completedMixAt={mixExecution?.actualAt} execution={execution} validateMadeFormula={(candidate,times)=>!execution||madeFormulaMatches(execution,candidate,times)} replanRequested={replanRequested||(yeastType==='sourdough'&&starterRecoveryPending)} onCancelReplan={()=>{setReplanRequested(false);openDestination('recipe');}} onAcceptReplan={acceptFreshPlan}
                startTimeInPast={startTimeInPast}
                tang={tang}
                onTangChange={setTang}
              />
  );
  // Moving Start Dough (or, in Custom, the preferment) from the Recipe's plan: the
  // scheduler opens under that row with only that step's editor; applying it updates the
  // recipe in place (the "Plan updated" note lists what changed).
  const recipeStartKey = prefStartTime && +prefStartTime===+firstRecipeAction ? 'preferment' : +startTime===+firstRecipeAction ? 'mix' : null;
  // Last time said the oven needed more preheat: the Preheat time is tappable like Start Dough (18 Nov 2026
  // retention round 3), and only then — no new text.
  const preheatEditable = /preheat|pr[ée]chauff/i.test(previousNote) && !!schedule?.preheatStart && +schedule.preheatStart>Date.now();
  const planEditable = [...(yeastType==='sourdough' || execution || mixExecution ? [] : [
    ...(+startTime>Date.now() ? ['mix'] : []),
    ...(tab==='custom' && prefStartTime && +prefStartTime>Date.now() ? ['preferment'] : []),
  ]), ...(preheatEditable ? ['preheat'] : [])];
  const preheatEditor = preheatEdit && eatTime && schedule?.preheatStart ? <PreheatTimeEditor fr={fr} at={schedule.preheatStart} bakeAt={eatTime} baseMin={basePreheatMin}
    onApply={minutes=>{const extra=Math.max(0,Math.min(120,minutes-basePreheatMin));setPreheatExtraMin(extra);setPreheatEdit(false);saveSession(buildSessionPayload({preheatExtraMin:extra}));}}/> : null;
  const planInline = planEdit ? {focus:planEdit, applyLabel:fr?'Mettre à jour la recette':'Update recipe', onClose:()=>setPlanEdit(null)} : undefined;
  const planEditor = planInline ? (tab==='custom' ? renderCustomScheduler(customStarterStepId !== null?'plan':'all',{planInline}) : renderSimpleScheduler({planInline})) : null;
  // Sourdough keeps the full planner (the starter has its own scheduling).
  const planMoreLabel = yeastType==='sourdough' ? (fr?'Modifier les horaires':'Change times') : null;
  // No fermentation curve (20 Nov 2026 chart review, owner): the one fact only it carried for a commercial
  // preferment, where the poolish/biga waits until Start Dough, is a note on its row. Its fridge steps
  // ("Preferment into the fridge", "Take the preferment out…") are rows already, so the note points at them.
  const planRowNotes = (()=>{
    if(yeastType==='sourdough'||!prefStartTime||(prefermentType!=='poolish'&&prefermentType!=='biga'))return undefined;
    const coldIn=recipePlanSteps.find(step=>step.key==='preferment-cold-in');
    const coldOut=recipePlanSteps.some(step=>step.key==='preferment-cold-out');
    const note=prefGoesInFridge
      ? (coldOut?(fr?'directement au réfrigérateur':'straight into the fridge'):(fr?'au réfrigérateur jusqu’au pétrissage':'keep it in the fridge until Start Dough'))
      : prefermentType==='biga'?(fr?'dans un endroit frais (16–18 °C) jusqu’au pétrissage':'in a cool spot (16–18 °C) until Start Dough')
      : coldIn?(fr?`à température ambiante jusqu’à ${formatPlanClock(coldIn.at,locale)}`:`at room temperature until ${formatPlanClock(coldIn.at,locale)}`)
      : (fr?'à température ambiante jusqu’au pétrissage':'at room temperature until Start Dough');
    return {preferment:note};
  })();
  // Key stages (round 7): the first action is one unless it is a starter feed before the levain build
  // (a revival or refresh days ahead), which the full list keeps.
  const planStartIsKey = !firstStarterAction || firstStarterAction.kind==='pre_mix';
  // Custom sourdough: the starter readiness strip sits before Start Dough (it replaces the multi-day chart).
  // The feeds the bake shows: with one jar for two bakes, the jar's and the shared feed (round 8, S6); else its own.
  const planStrip = tab==='custom' && yeastType==='sourdough' && recipeGenerated && +startTime>Date.now() && starterStripModel(guideStarterEvents,startTime)
    ? {key:'mix',node:<StarterStrip events={guideStarterEvents} mixAt={startTime} blocks={blocks} fr={fr}/>} : null;
  return (
    <div data-navigation-page={visiblePageKey} data-reading={bottomNavCollapsed || undefined} data-keyboard-open={keyboardOpen || undefined} data-mobile-setup={(destination==='organisation'||destination==='batch')&&!recipeGenerated?'true':undefined} style={{ minHeight: '100vh', background: 'var(--warm)' }}>
      {/* ── Sticky header + journey bar (autohide on scroll down) ── */}
      <div ref={stickyHeadRef} className="bh-header-stack" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'top 0.25s ease',
      }}>
        <Header
          units={units}
          onUnitsChange={setUnitsAndPersist}
          onLoadRecipe={loadRecipe}
          recipeGenerated={recipeGenerated}
          sessionSaved={sessionSaved}
          saving={cloudSaveState === 'saving'}
          sessionRestored={sessionRestored}
          hideActionBar={false}
          openSessionId={shareSessionId}
          onShareSessionClose={() => setShareSessionId(null)}
          sessionSummary={(() => {
            if (!styleKey || !eatTime) return '';
            const styleName = styleDisplayName(styleKey);
            const dateStr = eatTime.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            // Time only — formatTime() prefixes the weekday, and dateStr
            // already has it ("Sat 18 Jul, Sat 19:00" duplication)
            const timeStr = formatClock(eatTime, locale);
            const itemLabel = bakeType === 'bread'
              ? breadNoun(styleKey, numItems, locale === 'fr')
              : (numItems === 1 ? 'pizza' : 'pizzas');
            return `${styleName} · ${numItems} ${itemLabel} · ${dateStr}, ${timeStr}`;
          })()}
          sessionDoughSpec={tab === 'custom' && manualHydration !== undefined
            ? `${manualHydration}% ${locale === 'fr' ? 'd’hydratation' : 'hydration'}${prefermentType !== 'none' ? ' · ' + prefermentType.charAt(0).toUpperCase() + prefermentType.slice(1) : ''}`
            : ''}
          onBeforeLocaleChange={() => {
            if (!bakeType) return;
            saveSession(buildSessionPayload());
            try { sessionStorage.setItem('bh_locale_resume', JSON.stringify({activeStep, advancedStep, setupOverview, activeTab, pizzaPartyTab, reviewMode,navigation:{batchView,protocolView,serviceView,returnTo:fillingsReturn,prepReturnToService,shoppingReturnToFillings}})); } catch {}
          }}
          onSaveSession={saveCurrentSession}
          onReviewPlan={bakeType && modeChosen ? openSetupReview : undefined}
          onOpenSandwiches={sandwichEnabled ? openLateFillings : undefined}
          onOpenPizzas={bakeType === 'pizza' ? openLateFillings : undefined}
          onSharePlan={shareCurrentSession}
          onBack={undefined}
          // Nothing to start over from on the landing page — the baker is
          // already at the start. It appears the moment they pick a bake type,
          // which is also the moment it becomes useful: it is how they switch
          // Pizza <-> Pain.
          onNewSession={bakeType ? requestNewSession : undefined}
          onContinueBake={() => { setShowProductHome(false); setShowWelcomeBack(false); if(pendingSession) { applySession(pendingSession); setPendingSession(null); } }}
          hasCurrentBake={!!bakeType || !!pendingSession}
          onOpenLocalBake={openLocalBake}
          onResumeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event).then(ok => { if (ok) forgetCurrentJournalBake(); }); }}
          onRebakeBakeEvent={(event: BakeEvent) => { void restoreFromBakeEvent(event, { rebake: true }).then(ok => { if (ok) forgetCurrentJournalBake(); }); }}
          onResumeJournalEntry={entry => { void openJournalEntry(entry, false); }}
          onRebakeJournalEntry={entry => { void openJournalEntry(entry, true); }}
          openCurrentJournalRequest={journalRequest}
          openJournalEntryRequest={journalEntryRequest}
          currentBakeActive={!!bakeType}
          onOpenProfile={() => setProfileOpen(true)}
        />

        {localSaveConflict && <div role="alert" style={{padding:16,background:'var(--warm)',color:'var(--char)'}}>
          <p>{fr ? 'Cette fournée a été modifiée dans un autre onglet.' : 'This bake was updated in another tab.'}</p>
          <button type="button" style={{minHeight:44}} onClick={() => { if(archiveLocalBake({...buildSessionPayload(),version:1,savedAt:Date.now()})) window.location.reload(); else setRestartFailed(true); }}>{fr ? 'Ouvrir la dernière version' : 'Open latest version'}</button>
        </div>}
        {profileOpen && (
          <ProfileSheet locale={locale} onClose={() => setProfileOpen(false)} />
        )}


        {restartFailed && <p role="alert">{fr ? 'Impossible de conserver ou reprendre la fournée. Vos choix restent protégés. Réessayez.' : 'Unable to preserve or restore the bake. Your choices remain protected. Please try again.'}</p>}


      </div>

      {/* ── Main content ───────────────────── */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: `${bakeType ? '0' : 'clamp(1rem, 3vw, 1.5rem)'} clamp(1rem, 3vw, 1.5rem) ${bakeType ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 'clamp(1rem, 3vw, 1.5rem)'}` }}>

        {bakeNavigator}
        {renderOvenOfferSheet()}
        {starterRecoveryPending&&yeastType==='sourdough'&&!showProductHome&&!showWelcomeBack&&!bakedDone&&destination!=='organisation'&&<section className="bh-start-status" role="status">
          <p>{fr?'Votre plan de levain doit être actualisé.':'Your starter plan needs updating.'}</p>
          <button type="button" className="bh-start-primary" onClick={()=>{setSetupOverview(false);setActiveStep(7);setAdvancedStep(9);openDestination('organisation');}}>{fr?'Voir les horaires':'Review timing'}</button>
        </section>}
        {missedStarterFeed&&!showProductHome&&!showWelcomeBack&&!bakedDone&&<StarterFeedStatus key={`${missedStarterFeed.kind}:${+missedStarterFeed.time}`} fr={fr} plannedAt={+missedStarterFeed.time} onFed={updateStarterAfterMissedFeed} onNotYet={()=>updateStarterAfterMissedFeed()}/>}
        {!bakedDone&&!bakeTimeIsPast&&!needsMixCheck&&recipeGenerated&&commercialMethod&&yeastType!=='sourdough'&&!showProductHome&&!showWelcomeBack&&!isUnleavened&&!replanRequested&&<BakeStartStatus
          fr={fr} method={commercialMethod} plannedAt={promptedPrepAt} now={executionClock} execution={execution}
          superseded={!!guideClock&&guideClock.kind==='now'&&guideClock.at>(execution?execution.actualAt:promptedPrepAt+60_000)}
          preparing={destination==='protocol'&&protocolView==='dough'} onMade={markPreparationMade} onNotYet={requestFreshPlan}
          onRecipe={()=>openDestination('recipe')} onNext={()=>{setProtocolView('dough');openDestination('protocol');}}
          onUndo={()=>{setExecution(undefined);saveSession(buildSessionPayload({execution:undefined}));}}
        />}

        {!bakedDone&&!bakeTimeIsPast&&recipeGenerated&&needsMixCheck&&!starterRecoveryPending&&!showProductHome&&!showWelcomeBack&&!isUnleavened&&!replanRequested&&<BakeStartStatus
          key="mix" fr={fr} method="none" plannedAt={promptedMixAt} now={executionClock}
          execution={mixExecution?{...mixExecution,method:'none',inFridge:false,prefHours:0}:undefined}
          superseded={!!guideClock&&guideClock.kind==='now'&&guideClock.at>(mixExecution?mixExecution.actualAt:promptedMixAt+60_000)}
          preparing={destination==='protocol'&&protocolView==='dough'} onMade={markMixMade} onNotYet={requestRemainingMixPlan}
          onRecipe={()=>openDestination('recipe')} onNext={()=>{setProtocolView('dough');openDestination('protocol');}}
          onUndo={()=>{setMixExecution(undefined);setExecutionClash(false);saveSession(buildSessionPayload({mixExecution:undefined,executionClash:false}));}}
        />}

        {/* ── Nav #6: welcome-back inline banner (was a fixed toast that
             covered tap targets above the bottom nav) ── */}
        {/* Several bakes under way: one compact row each, the most pressing first, each opening its bake at the
            step that is due (17 Nov 2026 retention round 2: one card offered only the bake already baked). */}
        {homeShown && destination === 'batch' && showLiveRows && <nav data-live-bakes aria-label={fr ? 'Fournées en cours' : 'Bakes under way'} style={{display:'flex',flexDirection:'column',gap:8,margin:'0 0 14px'}}>
          {liveBakes.map((row, index) => {
            // One name per bake: the Recipe's title ("Pizza night", "Baguettes"), as the rating sheet (20 Nov 2026 round 6).
            const nameOf = (entry: JournalEntry) => journalTitle(entry, locale);
            // A row for the shared jar names both bakes (round 8, S6); two of the same name read once, "· both bakes" (round 9, N).
            const jarEntries = [row.entry, ...(row.jarWith ?? [])];
            const name = jarRowName(jarEntries.map(nameOf), locale);
            // Two bakes of the same name: the bake day tells them apart ("Sam. · Baguette · …", 18 Nov 2026 retention round 4),
            // and the bake time too when they bake the same day ("Sat 8:30pm · Pizza night · …", round 9, S7). Every
            // bake on home counts, those named inside a jar row included.
            const homeEntries = liveBakes.flatMap(other => [other.entry, ...(other.jarWith ?? [])]);
            const day = jarEntries.length > 1 ? '' : twinBakeWhen(row.entry.eatTime, homeEntries.filter(other => other.id !== row.entry.id && nameOf(other) === nameOf(row.entry)).map(other => other.eatTime), locale);
            const at = new Date(roundToQuarter(new Date(row.at)));
            // The step's own time beside its name (18 Nov 2026 retention round 3).
            const when = row.rate ? '' : !row.label || +at - Date.now() > 6 * 86400000 ? formatTime(at, locale) : at.toDateString() === new Date().toDateString() ? formatClock(at, locale) : `${at.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { weekday: 'short' })} ${formatClock(at, locale)}`;
            // Baked and not rated: the row's action is the rating (20 Nov 2026 round 6, Thomas).
            const text = [day && day[0].toUpperCase() + day.slice(1), name, row.rate ? (fr ? 'Noter' : 'Rate') : row.label].filter(Boolean).join(' · ');
            // The name and step may shorten; the time never does (320–390 px, 18 Nov 2026 retention round 4).
            return <button key={row.entry.id} type="button" data-live-bake={row.entry.id} data-live-jar={row.jarWith?.length ? row.jarWith.map(entry => entry.id).join(' ') : undefined} aria-label={`${text} ${when} →`}
              style={index === 0 ? {...NEXT_CTA, minHeight: 48, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', minWidth: 0, textAlign: 'left'} : {...SECONDARY_CTA, minHeight: 48, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', minWidth: 0, textAlign: 'left'}}
              data-live-rate={row.rate ? true : undefined}
              onClick={() => {
                if (row.rate) { setJournalEntryRequest({ id: row.entry.id, n: Date.now() }); return; }
                answerWelcomeBack(); resumeToNow.current = true;
                // The bake already in this browser's draft resumes from it (it may be a second ahead of its entry).
                if (row.entry.id === currentJournalId() && pendingSession?.recipeGenerated) { const own = loadSession(); acceptCurrentSessionStorage(); if (own) { applySession(own); return; } }
                void openJournalEntry(row.entry, false);
              }}><span style={{minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis'}}>{text}</span>{when && <>{' '}<span data-live-time style={{flexShrink: 0}}>{when}</span></>}<span aria-hidden="true" style={{flexShrink: 0, marginLeft: 'auto'}}>→</span></button>;
          })}
          {pendingOver && pendingSession?.styleKey && (() => { const cta = oneLineCta(`${pendingSession.bakeName || bakeTitleName(pendingSession.bakeType ?? null, pendingSession.styleKey ?? null, pendingSession.numItems, pendingSession.eatTime ? new Date(pendingSession.eatTime).getHours() : undefined, fr, styleDisplayName(pendingSession.styleKey as StyleKey))} · ${fr ? 'Refaire' : 'Bake again'}`); return <button type="button" data-live-again className={cta.className} aria-label={cta['aria-label']} style={{...SECONDARY_CTA, minHeight: 48, justifyContent: 'space-between', textAlign: 'left'}} onClick={bakePendingAgain}>{cta.children}</button>; })()}
          {pendingSetupRow && (() => { const cta = oneLineCta(`${styleDisplayName(pendingSession!.styleKey as StyleKey)} · ${fr ? 'à compléter' : 'unfinished'}`); return <button type="button" data-live-setup className={cta.className} aria-label={cta['aria-label']} style={{...SECONDARY_CTA, minHeight: 48, justifyContent: 'space-between', textAlign: 'left'}}
            onClick={() => { const own = loadSession(); acceptCurrentSessionStorage(); answerWelcomeBack(); if (own) { applySession(own); scrollToStepTop(); } }}>{cta.children}</button>; })()}
          <button type="button" onClick={() => { startRecoverableBake(); }} style={{...SECONDARY_CTA, minHeight: 44}}>{fr ? 'Nouvelle fournée' : 'Start a new bake'}</button>
        </nav>}
        {showWelcomeBack && destination === 'batch' && !showLiveRows && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '8px 8px 8px 14px',
            margin: '0 0 14px',
            minHeight: '56px',
            // 16 px labels never wrap inside a button: side by side when they fit, stacked when not (16 Nov 2026 design review).
            display: 'flex', flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(43, 36, 32,0.06))',
          }}>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '13.5px',
              color: 'var(--ash)', flexBasis: '100%', minWidth: 0, lineHeight: 1.35,
            }}>
              {/* Sentence case, not uppercase with letter-spacing: the tracked
                  caps made the label long enough that the two controls could not
                  sit beside it, so the row wrapped to three and the banner ate
                  200px above the hero.

                  It also names what is waiting. "You have a dough in progress"
                  makes the baker tap Resume to find out whether they want it,
                  which is a decision without information. Style answers what it
                  is and the bake time answers whether it is still any use —
                  those are the two facts that decide it. Progress is left out
                  on purpose; it speaks to sunk cost, not to fit. */}
              {(() => {
                const shown = dueEntry?.session ?? pendingSession;
                // One name per bake: the Recipe's title, "Pizza night" (20 Nov 2026 round 6).
                const st = shown?.styleKey
                  ? (shown.bakeName || bakeTitleName(shown.bakeType ?? null, shown.styleKey ?? null, shown.numItems, shown.eatTime ? new Date(shown.eatTime).getHours() : undefined, fr, styleDisplayName(shown.styleKey as StyleKey)))
                  : null;
                // With the date (20 Nov 2026 retention round 5, Maya): on a Wednesday "bake Sat 7:30pm" could be last
                // week's bake or this week's, and read the same before and after Bake again.
                const when = shown?.eatTime
                  ? formatBakeDateTime(new Date(shown.eatTime), locale)
                  : null;
                // Under way, the card says what is due, as the bar will (owner's decision D1, 20 Nov 2026 round 6):
                // "Now: Start Dough · since 6:00pm" / "Next: Take the dough out of the fridge · 5:15pm".
                const due = (() => {
                  if (pendingFinished || !shown?.recipeGenerated) return null;
                  try { const id = dueEntry?.id ?? currentJournalId(); return id ? journalDueStep(id, locale, shown.eatTime ? +new Date(shown.eatTime) : null) : null; } catch { return null; }
                })();
                const dueText = due ? (() => {
                  const at = new Date(roundToQuarter(new Date(due.at)));
                  const time = at.toDateString() === new Date().toDateString() ? formatClock(at, locale) : `${at.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { weekday: 'short' })} ${formatClock(at, locale)}`;
                  return due.kind === 'now' && due.at <= Date.now()
                    ? (fr ? `Maintenant : ${due.title} · depuis ${time}` : `Now: ${due.title} · since ${time}`)
                    : (fr ? `Ensuite : ${due.title} · ${time}` : `Next: ${due.title} · ${time}`);
                })() : null;
                const head = st ?? (locale === 'fr' ? 'Vous avez une pâte en cours' : 'You have a dough in progress');
                return (
                  <>
                    <span style={{ color: 'var(--char)', fontWeight: 600 }}>{head}</span>
                    {dueText ? <span data-home-due style={{ color: 'var(--smoke)' }}>{` · ${dueText}`}</span> : when && (
                      <span style={{ color: 'var(--smoke)' }}>
                        {/* The day and time travel together: FR never leaves "19h30" alone on a line. */}
                        {locale === 'fr' ? ` · ${pendingFinished ? 'cuisson du' : 'cuisson'}\u00a0${when.replace(/ /g, '\u00a0')}` : ` · ${pendingFinished ? 'baked' : 'bake'}\u00a0${when.replace(/ /g, '\u00a0')}`}
                      </span>
                    )}
                  </>
                );
              })()}
            </span>
            <button
              onClick={() => {
                // This is where the session is APPLIED. Nothing was restored on
                // mount — see the comment on pendingSession — so Resume now
                // does the thing it says rather than dismissing a banner over
                // state that had already appeared by itself.
                if (dueEntry) { const entry = dueEntry; setDueEntry(null); answerWelcomeBack(); resumeToNow.current = true; void openJournalEntry(entry, false); return; }
                if (pendingFinished) { bakePendingAgain(); return; }
                const s = loadSession();
                acceptCurrentSessionStorage();
                answerWelcomeBack();
                if (!s) return;
                applySession(s);
                resumeToNow.current = true;
                if (s.recipeGenerated && !s.navigation) setActiveTab('plan');
                else if (!s.recipeGenerated) scrollToStepTop();
              }}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '16px',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                padding: '10px 14px', minHeight: '44px',
                borderRadius: '12px', flex: '1 1 auto', whiteSpace: 'nowrap',
              }}
            >
              {pendingFinished
                ? (locale === 'fr' ? 'Refaire →' : 'Bake again →')
                : pendingSession?.recipeGenerated && !pendingSession.navigation
                ? (locale === 'fr' ? 'Voir les ingrédients →' : 'View ingredients →')
                : (locale === 'fr' ? 'Reprendre →' : 'Resume →')}
            </button>
            <button
              onClick={() => { startRecoverableBake(); }}
              style={{ flex: '1 1 auto', whiteSpace: 'nowrap', background: 'none', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--char)', fontFamily: 'var(--font-ui)', fontSize: 16, padding: '10px 14px', minHeight: 44, cursor: 'pointer' }}
            >
              {fr ? 'Nouvelle fournée' : 'Start a new bake'}
            </button>
          </div>
        )}

        {/* Cloud « Reprendre » — same banner, but the session lives only in
            the account (fresh device); hydrates on tap via restoreFromBakeEvent */}
        {/* Rien ne s'offre par-dessus du travail en cours. La garde ne
            regardait que le setup (!modeChosen) ; après une soirée entière,
            « Session trouvée sur votre compte » proposait une AUTRE fournée
            au moment précis où celle-ci venait de finir — et Reprendre
            l'aurait écrasée. */}
        {!showWelcomeBack && cloudResume && !bakeType && !modeChosen && !sessionRestored
          && !recipeGenerated && !hasWorkInProgress && destination === 'batch' && (
          <div style={{
            background: 'var(--warm)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '12px 16px',
            margin: '0 0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            boxShadow: 'var(--card-shadow, 0 2px 12px rgba(43, 36, 32,0.06))',
          }}>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--smoke)', textTransform: 'uppercase',
                letterSpacing: '.08em', display: 'block',
              }}>
                {locale === 'fr' ? 'Session trouvée sur votre compte' : 'Session found in your account'}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '12px',
                color: 'var(--char)', display: 'block', marginTop: '2px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {bakeEventTitle(cloudResume)}
              </span>
            </span>
            <button
              onClick={() => {
                const ev = cloudResume;
                setCloudResume(null);
                try { sessionStorage.setItem('bh_wb_answered', '1'); } catch {}
                if (ev) void restoreFromBakeEvent(ev);
              }}
              style={{
                background: 'var(--terra)', border: 'none',
                color: 'white', cursor: 'pointer', fontSize: '16px',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
                padding: '8px 16px', minHeight: 44, borderRadius: '12px', whiteSpace: 'nowrap',
              }}
            >
              {locale === 'fr' ? 'Reprendre →' : 'Resume →'}
            </button>
            <button type="button" onClick={() => { startRecoverableBake(); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--char)', font: 'inherit', padding: '8px 16px', minHeight: 44, cursor: 'pointer' }}>
              {fr ? 'Nouvelle fournée' : 'Start a new bake'}
            </button>
          </div>
        )}

        {/* ── Hero + bake type picker ── */}
        {destination === 'batch' && (
        <div ref={modeSelectorRef} style={{ textAlign: 'center', marginBottom: '16px' }}>
          {unsupportedEnrichedMethod && <div role="alert" style={{ padding: 14, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left' }}>
            <p>{locale === 'fr' ? 'Cette recette enrichie est actuellement prévue avec de la levure et sans préferment. Votre ancien choix est conservé ; choisissez la méthode prise en charge pour créer une nouvelle recette.' : 'This enriched recipe currently supports commercial yeast and no preferment. Your saved choice is preserved; choose the supported method to create a new recipe.'}</p>
            <button type="button" onClick={() => { choosePreferment('none'); chooseYeast('instant'); setSetupOverview(false); if (tab === 'custom') setAdvancedStep(7); else setActiveStep(6); }} style={NEXT_CTA}>{locale === 'fr' ? 'Utiliser la levure instantanée sans préferment' : 'Use instant yeast without preferment'}</button>
          </div>}
          {tab === 'custom' && archivedFlourNames.length > 0 && <div role="alert" style={{ padding: 14, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 12, textAlign: 'left' }}><p>{locale === 'fr' ? 'Ces farines enregistrées ne sont plus proposées dans le catalogue. Choisissez leur remplacement pour créer une nouvelle recette :' : 'These saved flours are no longer selectable. Choose replacements before creating a new recipe:'} {archivedFlourNames.join(' · ')}</p><button type="button" onClick={() => { setSetupOverview(false); setAdvancedStep(6); }} style={NEXT_CTA}>{locale === 'fr' ? 'Revoir mes farines' : 'Review my flours'}</button></div>}

          {(!bakeType||showProductHome) && (
          <div style={{ minHeight: 'calc(100dvh - 260px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{
            // The display serif, like every other page title (16 Nov 2026 design review).
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.6rem, 6vw, 2rem)',
            fontWeight: 700,
            color: 'var(--char)',
            lineHeight: 1.2,
            margin: '0 0 8px',
          }}>
            {locale === 'fr' ? 'Que souhaitez-vous préparer ?' : 'What would you like to make?'}
          </h1>
          <p data-home-promise style={{margin:'0 auto 20px',maxWidth:'34ch',fontSize:15,lineHeight:1.45,color:'var(--smoke)',textAlign:'center'}}>
            {locale === 'fr' ? 'On planifie à rebours de l’heure du repas.' : 'We plan back from when you want to eat.'}
          </p>
          <StylePhotoPreload />

          <OpeningChoices fr={fr} onSelect={selectBakeType}/>
          </div>

          </div>
          )}

        </div>
        )}

{/* Preparation and Baking & serving open on their own title and one line with the times
    (14 Nov 2026 audit: a small "Overview" label was all they had). */}
{recipeGenerated && compactBakeContext && (destination==='protocol'||destination==='service') && eatTime && <div data-section-title style={{margin:'4px 0 8px'}}>
  <h1 className="bh-page-title" style={{margin:'0 0 2px'}}>{destination==='protocol'?(fr?'Préparation':'Preparation'):(fr?'Cuisson & service':'Baking & serving')}</h1>
  <p data-section-times style={{margin:0,fontSize:14,color:'var(--ash)'}}>{destination==='protocol'?`${formatBakeDateTime(roundToQuarter(firstRecipeAction),locale)} → ${formatBakeDateTime(eatTime,locale)}`:formatBakeDateTime(eatTime,locale)}</p>
</div>}
{recipeGenerated && compactBakeContext && destination==='shopping' && bakeType!=='pizza' && <h1 className="bh-page-title bh-bake-title bh-visually-hidden">{bakeName || bakeAutoTitle}</h1>}
{/* The Pizzas page opens on its own question; the bake's name and day add nothing to choosing (13 Nov 2026). */}
{/* The bake's name and summary head the Recipe only: My choices lists the same facts in its rows,
    and Fillings has its own question (14 Nov 2026 audit). */}
{recipeGenerated && destination==='recipe' && !browsingFillings && <div className="bh-bake-context" style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>{(()=>{
  const title=bakeName || bakeAutoName;
  // The bake title is the page heading wherever the view has none of its own:
  // setup steps, the pizza lists and the pizza shopping list carry their own H1.
  // On the Recipe it is renamed in place.
  void title;
  return <BakeTitleField value={bakeName} auto={bakeAutoName} fr={fr} onCommit={setBakeName}/>;
})()}<p data-bake-summary style={{margin:'2px 0 0',fontSize:14,color:'var(--ash)'}}>{(()=>{
  // One line led by the day: "Sun 22 Nov · 7:00pm · 4 × 260 g Neapolitan" (round 7: the Make Poolish / Bake
  // card is gone; the plan below carries the times).
  const each=bakeType==='pizza'&&styleKey?displayWeight(Math.round(itemWeight),units,locale):null;
  return recipeSummaryLine(bakeType,styleKey,numItems,eatTime,locale,each);
})()}</p>
{previousNote&&<p data-previous-note style={{margin:'8px 0 0',fontSize:15,color:'var(--ash)'}}><strong>{fr?'La dernière fois : ':'Last time: '}</strong>{previousNote}</p>}
</div>}
{/* Round 17 (finding 7): not in Preparation, whose heading already gives the plan's new times (one note at most
    above its steps besides the night line). */}
{recipeGenerated && planMoved && destination!=='batch' && destination!=='organisation' && destination!=='protocol' && eatTime && (()=>{
  // Only what moved, and an amount only when it changes what the baker weighs.
  const at=(t:number)=>formatBakeDateTime(new Date(t),locale);
  const prepName=prefermentType==='biga'?(fr?'Préparer la biga':'Make Biga'):prefermentType==='poolish'?(fr?'Préparer le poolish':'Make Poolish'):(fr?'La préparation':'The preparation');
  const parts:string[]=[];
  if(planMoved.prepFrom!==undefined&&planMoved.prepTo!==undefined)parts.push(`${prepName} ${at(planMoved.prepTo)}`);
  if(planMoved.from!==planMoved.to)parts.push(`${fr?'Pétrir la pâte':'Start Dough'} ${at(planMoved.to)}`);
  if(planMoved.bakeFrom!==undefined)parts.push(`${fr?'Enfourner':'Bake'} ${at(+eatTime)}`);
  // The ingredients below already show new amounts. Yeast is named only when its share of the flour
  // changed (a new timing), not when it simply follows the quantity; flour never (14 Nov 2026 audit).
  const flourRatio=planMoved.flourFrom&&planMoved.flourTo?planMoved.flourTo/planMoved.flourFrom:1;
  const yeast=planMoved.yeastFrom!==undefined&&planMoved.yeastTo!==undefined&&(planMoved.yeastTypeChanged||yeastChangeMatters(planMoved.yeastFrom*flourRatio,planMoved.yeastTo))?yeastChangeLine(planMoved.yeastFrom,planMoved.yeastTo,!!planMoved.yeastTypeChanged):null;
  const flour=null;
  if(!parts.length&&!yeast&&!flour&&!calendarOutdated)return null;
  return <div data-plan-moved role="status" style={{margin:'12px 0 0',padding:'10px 14px',border:'1px solid var(--border)',borderRadius:14,fontSize:14,lineHeight:1.5,background:'var(--warm)',display:'flex',gap:12,alignItems:'flex-start'}}>
    <span style={{flex:1}}>
      <strong>{fr?'Plan mis à jour':'Plan updated'}</strong>{parts.length>0&&<>{' · '}{parts.join(' · ')}</>}
      {(yeast||flour)&&<span data-plan-amounts style={{display:'block'}}>{[yeast,flour].filter(Boolean).join(' ')}</span>}
      {calendarOutdated&&planCalendarLine}
    </span>
    <button type="button" className="bh-back-action" style={{minHeight:44,flex:'0 0 auto'}} onClick={()=>setPlanMoved(null)}>OK</button>
  </div>;
})()}



{showBakeTypeChooser&&bakeType&&<BakeTypeChooser fr={fr} current={bakeType} onChoose={selectBakeType} onClose={()=>setShowBakeTypeChooser(false)}/>}
{recipeGenerated && protocolStale && ['recipe','shopping','protocol','service'].includes(destination) && <section role="status" data-stale-card className="bh-stale-card" style={{border:'1px solid var(--gold)',borderRadius:14,padding:'14px 16px',margin:'12px 0',background:'var(--warm)'}}>
  <p style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'var(--char)'}}>{staleChange.sentence}</p>
  <p style={{margin:'0 0 10px',fontSize:14,color:'var(--ash)'}}>{fr?'Les quantités et les horaires suivront après la mise à jour.':'Your amounts and times will follow once you update.'}</p>
  <span style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 18px'}}>
    <button type="button" style={{...NEXT_CTA,width:'auto',flex:'0 1 auto',padding:'0 18px'}} onClick={()=>{if(canGenerate)stayAfterUpdateRef.current=destination;finishSetupEdit();}}>{canGenerate?(fr?'Mettre à jour ma recette':'Update my recipe'):(generationBlocker?.action??(fr?'Ajuster la recette':'Adjust recipe'))}</button>
    {staleChange.undo&&<button type="button" data-stale-keep className="bh-back-action" style={{minHeight:44}} onClick={staleChange.undo.run}>{staleChange.undo.label}</button>}
  </span>
</section>}
{/* The section stays readable underneath, dimmed and inactive, until the recipe is updated. */}
<div inert={recipeGenerated && protocolStale && ['recipe','shopping','protocol','service'].includes(destination)} style={recipeGenerated && protocolStale && ['recipe','shopping','protocol','service'].includes(destination)?{opacity:.45}:undefined}>



          {bakeType && !showProductHome && destination==='batch' && !browsingFillings && <section className="bh-batch-content">
            {batchView==='style' ? <>
              <h1 className="bh-page-title">{bakeType==='bread'?(fr?'Choisissez votre pain':'Choose your bread'):(fr?'Quel style de pizza ?':'Which pizza style?')}</h1>
              <a href={`/${locale}/with-my-base?family=${bakeType}`} style={{display:'inline-flex',alignItems:'center',minHeight:44,marginBottom:12,color:'var(--terra)',fontSize:16}}>{bakeType==='bread'?(fr?'J’ai déjà une pâte ou du pain →':'I already have dough or bread →'):(fr?'J’ai déjà ma pâte →':'I already have my dough →')}</a>
                {!styleKey&&<p id="bh-style-choice-hint" className="bh-visually-hidden">{fr?(bakeType==='bread'?'Choisissez un pain pour continuer.':'Choisissez un style de pizza pour continuer.'):(bakeType==='bread'?'Choose a bread to continue.':'Choose a pizza style to continue.')}</p>}
              <StylePicker bakeType={bakeType} selected={styleKey} onSelect={selectStyle} />
              <BottomActions className="bh-batch-actions bh-style-confirm">
                <button type="button" className="bh-back-action" onClick={backToProducts}><BackLabel text={fr?'Étape précédente':'Previous step'}/></button>
                <button data-bh-forward type="button" disabled={!styleKey} aria-describedby={!styleKey?'bh-style-choice-hint':undefined} style={{...NEXT_CTA,opacity:styleKey?1:0.5,cursor:styleKey?'pointer':'not-allowed'}} onClick={()=>{if(!styleKey)return;setBatchView('quantity');setActiveStep(2);setAdvancedStep(2);scrollToStepTop();}}>{/* Name where the button goes; the card already says what is selected. */}{fr?'Quantité':'Quantity'} →</button>
              </BottomActions>
            </> : batchView==='kitchen' ? <>
              <h1 className="bh-page-title">{fr?'Quelle température là où la pâte repose ?':'How warm is it where the dough rests?'}</h1>
              <KitchenSlider value={kitchenTemp} units={units} fr={fr} onChange={c=>{setKitchenTemp(c);if(kitchenAnswered||recipeGenerated)confirmSetting('climate',c);}}/>
              <BottomActions className="bh-batch-actions bh-batch-actions-navigation">
                <button type="button" className="bh-back-action" onClick={()=>{setBatchView('quantity');scrollToStepTop();}}><BackLabel text={fr?'Étape précédente':'Previous step'}/></button>
                <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>{const changed=!kitchenAnswered||recipeGenerated;confirmSetting('climate',kitchenTemp);if(recipeGenerated){setPlanReplanPending(true);finishSetupEdit();}else{if(changed)setPlanReplanPending(true);if(simpleStarterScreen){setBatchView('starter');scrollToStepTop();}else openBakeTimeInputs();}}}>{recipeGenerated?setupReturnLabel:simpleStarterScreen?(fr?'Votre levain →':'Your starter →'):(fr?'Heure de cuisson →':'Bake time →')}</button></BottomActions>
            </> : batchView==='starter' ? <>
              <h1 className="bh-page-title">{fr?'Où est votre levain en ce moment ?':'Where is your starter now?'}</h1>
              <div role="group" aria-label={fr?'Où est votre levain en ce moment ?':'Where is your starter now?'} data-simple-starter style={{display:'grid',gap:12,marginTop:8}}>
                {([['counter',fr?'Sur le plan de travail':'On the counter'],['fridge',fr?'Au réfrigérateur':'In the fridge']] as const).map(([answer,label])=>(
                  <button key={answer} type="button" aria-pressed={simpleStarterAnswer===answer} onClick={()=>applySimpleStarterAnswer(answer)}
                    style={{textAlign:'left',padding:'18px 20px',minHeight:64,border:`1.5px solid ${simpleStarterAnswer===answer?'var(--terra)':'var(--border)'}`,borderRadius:18,background:simpleStarterAnswer===answer?'var(--cream)':'var(--card)',color:'var(--char)',fontFamily:'var(--font-ui)',fontSize:17,fontWeight:700,cursor:'pointer',boxShadow:'0 2px 12px rgba(43,36,32,.06)'}}>{label}</button>
                ))}
                <button type="button" className="bh-back-action" aria-pressed={simpleStarterAnswer==='ready'} onClick={()=>applySimpleStarterAnswer('ready')}
                  style={{justifySelf:'start',minHeight:44,fontWeight:simpleStarterAnswer==='ready'?700:undefined,textAlign:'left'}}>{fr?'Il est bien monté et bullé en ce moment':'It’s bubbly and risen right now'}</button>
              </div>
              {!simpleStarterAnswer&&<p id="bh-starter-choice-hint" className="bh-visually-hidden">{fr?'Choisissez une réponse pour continuer.':'Choose an answer to continue.'}</p>}
              <BottomActions className="bh-batch-actions bh-batch-actions-navigation">
                <button type="button" className="bh-back-action" onClick={()=>{setBatchView('kitchen');scrollToStepTop();}}><BackLabel text={fr?'Étape précédente':'Previous step'}/></button>
                <button data-bh-forward type="button" disabled={!simpleStarterAnswer} aria-describedby={!simpleStarterAnswer?'bh-starter-choice-hint':undefined} style={{...NEXT_CTA,opacity:simpleStarterAnswer?1:0.5,cursor:simpleStarterAnswer?'pointer':'not-allowed'}} onClick={()=>{if(!simpleStarterAnswer)return;if(recipeGenerated){setPlanReplanPending(true);finishSetupEdit();}else{setPlanReplanPending(true);openBakeTimeInputs();}}}>{recipeGenerated?setupReturnLabel:(fr?'Heure de cuisson →':'Bake time →')}</button></BottomActions>
            </> : <>
              <h1 className="bh-page-title">{fr?'Quelle quantité de pâte ?':'How much dough?'}</h1>

                            {renderQuantity('count')}
              {styleKey==='pain_levain'&&<div style={{marginTop:16}}><label className="bh-seed-toggle"><input type="checkbox" checked={addSeeds} onChange={event=>setAddSeeds(event.target.checked)} /> {fr?'Ajouter des graines':'Add seeds'}</label>{addSeeds && <p>{fr?'Les graines trempent à l’avance : 2 h minimum, idéalement la veille.':'Soak the seeds ahead: at least 2 hours, ideally overnight.'}</p>}</div>}
              <BottomActions className="bh-batch-actions bh-batch-actions-navigation">
                <button type="button" className="bh-back-action" onClick={()=>{if(recipeGenerated)backToSetupChoices();else {setBatchView('style');scrollToStepTop();}}}>{recipeGenerated?(fr?'Retour à mes choix':'Back to my choices'):(fr?'Étape précédente':'Previous step')}</button>
                <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>{setQtyChosen(true);setHighestStep(value=>Math.max(value,3));setAdvancedHighestStep(value=>Math.max(value,3));if(recipeGenerated)finishSetupEdit();else if(kitchenAnswered&&simpleStarterPending){setBatchView('starter');scrollToStepTop();}else if(isUnleavened||kitchenAnswered)openBakeTimeInputs();else{setBatchView('kitchen');scrollToStepTop();}}}>{recipeGenerated?setupReturnLabel:kitchenAnswered&&simpleStarterPending?(fr?'Votre levain →':'Your starter →'):isUnleavened||kitchenAnswered?(fr?'Heure de cuisson →':'Bake time →'):(fr?'Cuisine →':'Kitchen →')}</button></BottomActions>
            </>}
          </section>}

          {hasFillings&&destination==='recipe'&&!recipeGenerated&&(pizzaPartyEnabled||sandwichEnabled)&&<FillingsInvitation compact fr={fr} pizza={bakeType==='pizza'} styleKey={styleKey??''} count={numItems}
            selectedCount={Object.values(bakeType==='pizza'?pizzaPartyQtys:sandwichParty.qtys).reduce((sum,qty)=>sum+qty,0)} onChoose={openLateFillings} />}


          {destination==='service'&&bakeType==='pizza'&&serviceView==='fillings'&&<button type="button" className="bh-section-back" onClick={()=>{setServiceView('dough');scrollToStepTop();}}>{fr?'← Four et conseils de cuisson':'← Oven and cooking advice'}</button>}

          {hasFillings&&(destination==='protocol'||(destination==='service'&&bakeType!=='pizza'))&&<section className={`bh-section-choices${destination==='protocol'?' bh-preparation-tabs':''}`} aria-label={fr?'À préparer':'What to prepare'}>
            <button type="button" aria-pressed={(destination==='protocol'?protocolView:serviceView)==='dough'} onClick={()=>{if(destination==='protocol')setProtocolView('dough');else setServiceView('dough');}}>{destination==='protocol'?(fr?'Pâte':'Dough'):bakeType==='bread'?(fr?'Guide de cuisson':'Baking guide'):(fr?'Guide de cuisson':'Cooking guide')}</button>
            {hasFillings&&<button type="button" aria-pressed={(destination==='protocol'?protocolView:serviceView)==='fillings'} onClick={()=>{if(destination==='protocol')setProtocolView('fillings');else setServiceView('fillings');}}>{destination==='protocol'?(fr?'Garnitures':'Fillings'):(bakeType==='pizza'?(fr?'Cuire les pizzas':'Cook the pizzas'):(fr?'Assembler et servir':'Assemble and serve'))}</button>}
          </section>}
          {/* Bread: from the assembly view only; the baking guide does not repeat it (14 Nov 2026 audit). */}
          {destination==='service'&&hasFillings&&(bakeType==='pizza'||serviceView==='fillings')&&<button type="button" className="bh-section-back" onClick={prepareFillingsFromService}>{fillingsProgress.total>0&&fillingsProgress.done>=fillingsProgress.total?(fr?'Revoir la préparation des garnitures':'Review filling preparation'):(fr?'Préparer les garnitures':'Prepare toppings and fillings')}</button>}
          {recipeGenerated&&((destination==='protocol'&&protocolView==='dough')||(destination==='service'&&serviceView==='dough'))&&<div className="bh-local-progress" ref={setGuideProgressTarget}/>}
          {destination==='shopping'&&bakeType==='pizza'&&!recipeGenerated&&<div className="bh-section-empty"><p>{fr?'Terminez vos choix pour ajouter les ingrédients de votre pâte.':'Finish your choices to add your dough ingredients.'}</p><button type="button" style={NEXT_CTA} onClick={()=>openDestination('organisation')}>{fr?'Terminer mes choix':'Finish my choices'}</button></div>}
          {(destination==='protocol'||destination==='service')&&!recipeGenerated&&(destination==='protocol'?protocolView:serviceView)==='dough'&&<div className="bh-section-empty"><p>{fr?'Terminez vos choix pour obtenir vos étapes de préparation.':'Finish your choices to get the dough instructions.'}</p><button type="button" style={NEXT_CTA} onClick={()=>openDestination('organisation')}>{fr?'Terminer mes choix':'Finish my choices'}</button></div>}

          {/* Mode + Pizza Party — only shown after bakeType selected.
              No card frame: the toggle sits directly on the page surface. */}
          {bakeType && (
            <div style={{ padding: '2px 0' }}>

              {/* There is no mode screen: setup leads to the bake time, and customizing
                  continues from there or from My bake (see the redirect effect). */}



            </div>
          )}


        {/* ════════════ GUIDED ════════════ */}
        {tab === 'simple' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── Setup tab content ── */}
            <div style={{ display: destination === 'organisation' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>

            {/* ── Summary bar: one collapsed line while going forward, a
                   sheet of every step on demand. It lives inside the
                   modeChosen gate, so the opening mode page carries no bar —
                   nothing decided yet, nothing to navigate to, and a progress
                   bar at zero is a discouraging way to greet someone. ── */}
            {/* Back from the recipe lands here, not on whichever step
                was open when they left. "Back" after a recipe exists
                means "what did I choose", not "where was I typing". */}
            {/* Guarded on recipeGenerated, not just the flag. The overview
                answers "what did I choose" — a question that only exists
                after there is something to come back to. Any path that
                left the flag set (a reset, a fresh start after browsing
                the summary) heals itself here instead of dropping a
                first-time baker onto a review screen. */}
            {setupOverview && (
              <SetupReview
                kitchenRow={!isUnleavened&&kitchenAnswered?{value:`${cToDisplay(kitchenTemp,units)}${tempUnit(units)}`,onClick:()=>{captureEditReturn();openDestination('batch');setBatchView('kitchen');scrollToStepTop();}}:undefined}
                starterRow={simpleStarterScreen&&simpleStarterLabel?{value:simpleStarterLabel,onClick:()=>{captureEditReturn();openSimpleStarter();}}:undefined}
                stale={protocolStale}
                flow={simpleFlow}
                reviewValues={{ 3: simpleKitchenSummary, 7: reviewTiming }}
                busyRow={reviewBusy?{value:reviewBusy,onClick:()=>{setSetupOverview(false);setBakeTimeQuestion(true);simpleFlow.onJump(7);}}:undefined}
                suggestedRows={simpleSuggestedRows}
                modeChip={{ value: 'simple', onClick: () => { chooseMode('custom'); if(recipeGenerated){
                  // The recipe was made with this oven and kneading: the Equipment step shows them chosen,
                  // as its row does (18 Nov 2026 retention: "Standard home oven" in the row, nothing selected on the step).
                  if(ovenType)confirmSetting('oven',ovenType);if(mixerType)confirmSetting('mixer',mixerType);if(!flourChosen)confirmSetting('flour','recipe');adoptRecipeMethod();setAdvancedHighestStep(h=>Math.max(h,CUSTOM_LAST)); setSetupOverview(true);} else {setCustomBakeQuestion(true); setSetupOverview(false);} scrollToStepTop(); } }}
                hideSuggested
                onJump={id => { setSetupOverview(false); if(id===7)setBakeTimeQuestion(true); simpleFlow.onJump(id); }}
                returnLabel={recipeGenerated?setupReturnLabel:undefined}
                forward={recipeGenerated&&!protocolStale&&(!fillingsReturn||(fillingsReturn.destination==='recipe'&&!fillingsReturn.forward))?(fillingsStep?{label:`${fillingsStepLabel} →`,onClick:()=>{setFillingsReturn(null);openToppingsStep();}}:{label:fr?'Liste de courses →':'Shopping list →',onClick:()=>{setFillingsReturn(null);openDestination('shopping');}}):undefined}
                onBackToRecipe={finishSetupEdit}
              />
            )}
            <div ref={simpleSwipeRef} style={{ display: setupOverview ? 'none' : undefined }}>

            {/* Simple confirms practical context once; editors remain optional. */}
            <StepPage flow={simpleOrganisationFlow} id={3} nextOverride={
              <button data-bh-forward type="button" disabled={!ovenType || !mixerType || (!isUnleavened && !yeastType)} style={{...NEXT_CTA,opacity:(!ovenType || !mixerType || (!isUnleavened && !yeastType)) ? 0.5 : 1}} onClick={()=>simpleFlow.onNext(3)}>{fr?'Heure de cuisson →':'Bake time →'}</button>
            }>
              <button type="button" className="bh-section-back" onClick={()=>{setAwaitingRecipeChoice(false);chooseMode('custom');openSetupStep(3,true);}}>{fr?'Personnaliser mon matériel →':'Customize my equipment →'}</button>
              <ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="simple" hideKitchen
                showFridge={!isUnleavened && (!!schedule?.totalColdHours || prefGoesInFridge || yeastType==='sourdough')}
                units={units}
                flourInFridge={flourInFridge} onFlourInFridgeChange={setFlourInFridge}
                onChange={(t, h, f) => { if(t!==kitchenTemp)confirmSetting('climate',t); setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              />


              {!isUnleavened && <details open={!yeastType ? true : undefined} style={{marginTop:20}}>
                <summary className="bh-chevron" style={{minHeight:44,cursor:'pointer',padding:'10px 0'}}>{fr?'Ma levure':'My yeast'} · {yeastType ? localName(YEAST_TYPES[yeastType]) : (fr?'Choisir':'Choose')} <span style={{color:'var(--terra)'}}>— {fr?'Modifier':'Change'}</span></summary>
              <YeastHelper
                selected={yeastType}
                onSelect={value=>{chooseYeast(value);confirmSetting('yeast',value);}}
                onClose={() => {}}
                disabledIds={enrichedDirectOnly || (breadProtocol && !breadProtocol.supportedPreferments.includes('levain')) ? ['sourdough'] : undefined}
                disabledNote={fr ? 'Ce pain utilise de la levure classique.' : 'This bread uses regular yeast.'}
                styleKey={styleKey}
              />
              </details>}
              {prefermentType !== 'none' && <p style={{fontSize:14,color:'var(--smoke)',marginTop:16}}>{fr?'Méthode conservée':'Retained method'} · {prefermentType === 'levain' ? (fr?'Levain':'Sourdough') : prefermentType}</p>}
            </StepPage>

            {/* ─── STEP 8: Scheduler ───────────────── */}
            <StepPage flow={simpleOrganisationFlow} id={7} backOverride={simpleClashCardBar ? backToGoodPlanBack : undefined} nextOverride={collectingBakeTime ? <></> : bakeTimeOnly && eatTime ? (simpleDecisionPending ? <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setDecisionSheet('return')}>{setupReturnLabel}</button> : !scheduleCandidateValid ? <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setBakeTimeQuestion(false)}>{fr?'Voir le planning':'See the plan'} →</button> : undefined) : scheduleEditing ? null : !eatTime ?
              <button type="button" disabled style={{...NEXT_CTA,opacity:0.5}}>{fr?'Choisissez une date de cuisson':'Choose a bake date'}</button>
              : !scheduleCandidateValid
                // As in Custom: the normal next step waits for the plan, with the reason; it never only
                // scrolls (17 Nov 2026 retention: "Review affected times" did nothing).
                ? recipeGenerated ? (simpleClashCardBar ? <></> : backToGoodPlanButton) : <div style={{width:'100%'}}>
                    <p id="bh-plan-choice-hint" style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{simpleDecisionPending?(fr?'Choisissez une des options ci-dessus.':'Choose one of the options above.'):(fr?'Ajustez le planning ci-dessus pour continuer.':'Adjust the plan above to continue.')}</p>
                    <button data-bh-forward type="button" disabled aria-describedby="bh-plan-choice-hint" style={{...NEXT_CTA,opacity:0.55}}>{simpleOrganisationFlow.generateLabel}</button>
                  </div>
              : undefined}>
              {/* Simple assumes the kitchen temperature (shown with the plan in
                  Preparation); Custom asks for it on its own Kitchen step. */}
              {!styleKey ? (
                <NeedsStyleFirst fr={locale === 'fr'} onChoose={() => simpleFlow.onJump(1)} />
              ) : (
              planEdit?null:renderSimpleScheduler()
              )}
              {/* The bake time is when it goes in the oven; a loaf then needs time to cool (16 Nov 2026:
                  a baker entered lunch time). Not for flatbreads or breads served warm. */}
              {showCoolingNote &&
                <p data-cooling-note style={{fontSize:14,lineHeight:1.5,color:'var(--ash)',margin:'12px 0 0'}}>{(()=>{const range=breadCoolingRange(styleKey??'',itemWeight);return fr?`Comptez ${range} de refroidissement avant de trancher : pour un repas, enfournez plus tôt.`:`Allow ${range} for the bread to cool before slicing: for a meal, bake earlier.`;})()}</p>}

              {/* One way forward. A pending decision carries its own buttons, so
                  Create waits for it; Custom stays reachable as an optional
                  detour, not a second equal choice. */}
              {/* Two equal ways forward: Simple generates the recipe from the
                  style's defaults; Custom is a real choice, described by what the
                  baker will set. A pending decision holds back Generate only. */}
              {collectingBakeTime && eatTime && +eatTime>Date.now() && (()=>{
                if(kitchenPending)return <div data-recipe-choice style={{marginTop:16}}><button type="button" style={NEXT_CTA} onClick={()=>{openDestination('batch');setBatchView('kitchen');scrollToStepTop();}}>{fr?'Température de la cuisine →':'Kitchen temperature →'}</button></div>;
                if(simpleStarterPending)return <div data-recipe-choice style={{marginTop:16}}><button type="button" style={NEXT_CTA} onClick={openSimpleStarter}>{fr?'Votre levain →':'Your starter →'}</button></div>;
                // 14 Nov 2026 (Romaric): the one fork in setup reads as a choice. Generate is the filled
                // button, Customize the outlined one with three words naming what a serious baker changes.
                const leaven=(yeastType==='sourdough'||isLevainStyle(styleKey))?(fr?'levain':'starter'):(fr?'préferment':'preferment');
                const customDesc=directMethodOnly?(fr?'farine, hydratation':'flour, hydration'):(fr?`farine, ${leaven}, hydratation`:`flour, ${leaven}, hydration`);
                const outlined:React.CSSProperties={...NEXT_CTA,display:'grid',gap:2,placeItems:'center',background:'transparent',color:'var(--terra)',border:'1.5px solid var(--terra)',boxShadow:'none',minHeight:56,padding:'8px 16px'};
                // A start within the next two hours is said on this screen, before the recipe exists.
                const soon=!simpleDecisionPending&&scheduleCandidateValid&&!isUnleavened?soonStartLabel(firstRecipeAction,Date.now(),locale):null;
                return <div data-recipe-choice style={{display:'grid',gap:12,marginTop:16}}>
                  {soon&&<p data-start-soon role="status" style={{margin:0,fontSize:15,fontWeight:600,color:'var(--char)'}}>{firstRecipeActionLabel} · {soon}</p>}
                  {/* A clash is asked here once, in a sheet, when the baker generates. Customizing
                      first defers it to the end of the customize steps, so it is never asked twice. */}
                  <button type="button" data-generate-recipe style={{...NEXT_CTA,minHeight:56}} onClick={()=>{if(simpleDecisionPending){setDecisionSheet('generate');return;}setAwaitingRecipeChoice(false);if(canGenerate)handleGenerate();}}>{fr?'Générer ma recette':'Generate my recipe'} <span aria-hidden="true">→</span></button>
                  <button type="button" data-customize-link style={outlined} onClick={()=>{setAwaitingRecipeChoice(false);setCustomBakeQuestion(true);chooseMode('custom');}}>
                    <span style={{fontWeight:700}}>{fr?'Personnaliser ma fournée':'Customize my bake'}</span>
                    <span style={{fontSize:13,fontWeight:400,color:'var(--ash)'}}>{customDesc}</span>
                  </button>
                </div>;
              })()}
            </StepPage>

            {/* Generate now lives in the last page's nav bar (StepPage). */}
            </div>{/* end swipe container */}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F0EBE0',
                  borderRadius: '16px',
                  padding: '12px 16px',
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
                    onClick={()=>handleGenerate()}
                    style={{
                      background: '#6B4423',
                      color: 'white',
                      fontSize: '12px',
                      padding: '12px 16px', minHeight: '44px',
                      borderRadius: '12px',
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
                  <button type="button" style={{...NEXT_CTA,marginTop:16}} onClick={()=>openDestination('organisation')}>{fr?'Terminer mes choix':'Finish my choices'}</button>
                </div>
              )}

              {/* Recipe + Timeline */}
              {recipeGenerated && (
                <div ref={resultsRef} style={{ marginTop: '16px' }}>
                  {(
                    <>
                      {/* Recipe null-guard */}
                      {!recipe ? (
                        <div style={{
                          background: 'var(--warm)', border: '1.5px solid var(--gold)',
                          borderRadius: '16px', padding: '20px', textAlign: 'center',
                          color: 'var(--terra)', fontSize: '14px',
                        }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                          <RecipeOutput
                            mixerConfirmed={confirmed('mixer',mixerType)}
                            starterEvents={guideStarterEvents} sharedStarterFeed={sharedFeedNote} mixingTime={startTime}
                            
                            styleKey={styleKey ?? undefined}
                            waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixerCapacityG={customMixerCapacityG} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches}
                            ovenType={ovenType}
                            onEditSetup={openSetupReview}
                            
                            onShare={shareCurrentSession}
                            result={displayRecipe ?? recipe}
                            prefermentType={prefermentType}
                            explicitFlour={flourChosen}
                            wastePct={totalFlourTarget===undefined?wasteAllowance:0}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={styleDisplayName(styleKey)}
                            mixerType={mixerType!}
                            kitchenTemp={kitchenTemp}
                            fridgeTemp={fridgeTemp}
                            fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                            totalColdHours={schedule ? schedule.totalColdHours : 0}
                            mode={tab}
                            bakeType={bakeType ?? 'pizza'}
                            flourBlend={flourBlend}
                            units={units}
                            feedTime={feedTime}
                            feed2Time={feed2Time}
                            fridgeOutTime={fridgeOutTime}
                            starterPeakTime={starterPeakTime}
                            planningMode={planningMode}
                            usingPeak2={usingPeak2}
                            feedRatio={nextFeedRatio}
                            starterLocation={starterLocation}
                          />
                          {executionClash && <p data-plan-clash role="status" style={{margin:'0 0 8px',fontSize:15,color:'var(--char)'}}>{fr?'La suite du plan demande de nouveaux horaires.':'The rest of the plan needs new times.'}</p>}
                          {entryNightView('recipe')}
                          {eatTime && (schedule || planEdit) && !isUnleavened && <RecipePlanCard fr={fr} locale={locale} startAt={firstRecipeAction} startLabel={firstRecipeActionLabel} bakeAt={eatTime} bakeEnd={recipeBakeEnd} steps={recipePlanSteps} startKey={recipeStartKey} editable={planEditable} editing={preheatEdit?'preheat':planEdit==='pref'?'preferment':planEdit} onEditTime={key=>{if(key==='preheat'){setPlanEdit(null);setPreheatEdit(v=>!v);return;}setPreheatEdit(false);setPlanEdit(current=>{const next=key==='preferment'?'pref':'mix';return current===next?null:next;});}} editor={preheatEdit?preheatEditor:planEditor} notice={planNote?{key:planNote.key,node:planInlineNote}:null} notes={planRowNotes} beforeRow={planStrip} startIsKey={planStartIsKey} moreLabel={planMoreLabel} onMore={editRecipeTiming}/>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>{locale === 'fr' ? 'Comment s’est passée la fournée ?' : 'How did it go?'}</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}></span>}
                      <input id="bake-photo-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { compressImage, uploadPhoto } = await import('../lib/photoUpload');
                          const blob = await compressImage(file);
                          setBakePhotoUrl(URL.createObjectURL(blob));
                          if (user) {
                            let evId = bakeEventId;
                            if (!evId) {
                              const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                              const payload = buildSessionPayload();
                              evId = await upsertBakeEvent({ session: payload as SessionData });
                              if (evId) setBakeEventId(evId);
                            }
                            if (evId) await uploadPhoto(file, user.id, evId, 0);
                          }
                        }}
                      />
                    </label>
                    {!bakedDone ? (
                      <button
                        onClick={async () => {
                          setBakedDone(true);
                          if (user && bakeEventId) {
                            const { markBaked } = await import('../lib/supabase/saveBakeEvent');
                            await markBaked(bakeEventId);
                          }
                        }}
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                      >
                        ✓ {locale === 'fr' ? 'Marquer comme cuite' : 'Mark as baked'}
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ {locale === 'fr' ? 'Cuisson terminée !' : 'Baked!'}</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>

                  {activeTab==='plan'&&<BottomActions className="bh-recipe-next">
                    <button type="button" className="bh-back-action" onClick={openSetupReview}><span style={{whiteSpace:'nowrap'}}><span aria-hidden="true">‹ </span>{fr?'Mes choix':'My choices'}</span></button>
                    {fillingsStep?<button type="button" data-toppings-step style={NEXT_CTA} onClick={openToppingsStep}>{fillingsStepLabel} →</button>:<button type="button" style={NEXT_CTA} onClick={()=>openDestination('shopping')}><DestinationIcon destination="shopping"/> {fr?'Liste de courses':'Shopping list'} →</button>}

                  </BottomActions>}
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: (destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough') ? 'block' : 'none' }}>
              {!recipeGenerated ? null : schedule && recipe && mixerType && (<>
                {destination==='protocol'&&eatTime&&prepOverview&&<PreparationTimingSummary calendarOutdated={calendarOutdated} clash={executionClash||preparationBusy} nightLine={entryNightView('preparation')} fr={fr} locale={locale} startAt={firstRecipeAction} startLabel={firstRecipeActionLabel} bakeAt={eatTime} helperAt={coveredFridgeRemovalAt} onAdjustTiming={editRecipeTiming} onAddToCalendar={addPlanToCalendar}/>}
                <BakeGuide
                  pizzaDiameterCm={bakeType==='pizza'?pizzaDiameter:undefined}
                  onStarterFed={event=>tickStarterFeed(event,true)} onStarterUnfed={event=>tickStarterFeed(event,false)} starterFedTimes={starterFedTimes}
                  preparationMade={!!execution} mixingMade={!!mixExecution||execution?.method==='none'} onMixComplete={!isUnleavened?recordGuideMix:undefined} onPreparationComplete={!isUnleavened&&yeastType!=='sourdough'&&prefermentType!=='none'?done=>{if(done)markPreparationMade(plannedPreparationAt,true);else if(!mixExecution){setExecution(undefined);saveSession(buildSessionPayload({execution:undefined}));}}:undefined}
                  onBackToRecipe={()=>openDestination('recipe')}
                  backSection={destination==='service'?{label:fr?'Retour à la préparation':'Back to Preparation',onClick:()=>{setProtocolView('dough');openDestination('protocol');}}:{label:fr?'Retour aux courses':'Back to Shopping list',onClick:()=>openDestination('shopping')}}
                  onOverviewChange={setPrepOverview}
                  onRepeat={repeatCurrentRecipe} resultNotes={resultNotes} onResultNotesChange={setResultNotes} onSave={saveCurrentSession} onShare={shareCurrentSession} sessionSaved={sessionSaved && !!user} onBakedChange={setBakedDone} completionEnabled={!hasFillings} sharedOven={sharedOven}
                  progressScope={journalId} mixDoneAt={mixExecution?.actualAt??(execution?.method==='none'?execution.actualAt:null)} prefDoneAt={execution&&execution.method!=='none'?execution.actualAt:null} mixDoneStated={!!(mixExecution?.stated??(execution?.method==='none'&&execution.stated))} prefDoneStated={!!(execution&&execution.method!=='none'&&execution.stated)} bakeEnd={recipeBakeEnd}
                  onMixTimeChange={at=>{if(mixExecution||execution?.method!=='none')markMixMade(at);else markPreparationMade(at);}} onPrefTimeChange={markPreparationMade} previousNote={previousNote}
                  progressTarget={(destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough')?guideProgressTarget:null} onClockStep={setGuideClock}
                  phase={destination==='service'?'cooking':'preparation'}
                  active={destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough'}
                  onNavigateToCooking={()=>{setServiceView('dough');openDestination('service');}}
                  onPrepareFillings={hasFillings?()=>{setProtocolView('fillings');openDestination('protocol');}:undefined}
                  onNavigateToPreparation={()=>openDestination('protocol')}
                  starterEvents={guideStarterEvents} sharedStarterFeed={sharedFeedNote}
                  ovenConstruction={ovenConstruction}
                  waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixerCapacityG={customMixerCapacityG} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches} fridgeTemp={fridgeTemp}
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
                  feedTime={planningMode === 'last_fed' ? lastFedTime : null}
                  feed2Time={feed2Time}
                  fridgeOutTime={fridgeOutTime}
                  starterState={starterState}
                  starterMature={starterMature}
                  starterHasRye={starterHasRye}
                  usingPeak2={usingPeak2}
                  planningMode={planningMode}
                  feedRatio={nextFeedRatio}
                  starterLocation={starterLocation}
                  units={units}
                  locale={locale}
                  onNavigateToFillings={hasBreadFillings?()=>{setServiceView('fillings');openDestination('service');}:undefined}
                  fillingsActionLabel={sandwichFamilyForStyle(styleKey??'')==='tartine'?(fr?'Assembler mes tartines':'Assemble my toasts'):(fr?'Assembler mes sandwichs':'Assemble my sandwiches')}
                  pizzaActionLabel={hasFillings?(fr?'Commencer la cuisson des pizzas':'Start cooking the pizzas'):(fr?'Choisir mes pizzas':'Choose my pizzas')}
                  pizzasChosen={hasFillings}
                  onNavigateToPizzaParty={pizzaPartyEnabled ? ()=>{if(hasFillings){setServiceView('fillings');openDestination('service');}else openLateFillings();} : undefined}
                  recipe={recipe ?? null}
                  simpleMode={tab === 'simple'}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                </>

              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: companionVisible ? 'block' : 'none' }}>
                <PizzaParty
                  locale={locale}
                  countKnown={qtyChosen||!!recipeGenerated}
                  bakeTime={eatTime ?? new Date()}
                  numItems={numItems}
                  styleKey={styleKey ?? undefined}
                  t={t}
                  activeTab={companionPhase}
                  onTabChange={openCompanionPhase}
                  onBackToRecipe={fillingsStep?openToppingsStep:()=>openDestination('recipe')}
                  shoppingBackLabel={fillingsStep?(fr?'Retour aux pizzas':'Back to Pizzas'):undefined}
                  onSelectionBack={backFromFillings} onSelectionDone={finishFillings}
                  selectionDoneLabel={fillingsDoneLabel} skipLabel={fillingsSkipLabel} selectionForward={fillingsForward} selectionBackLabel={fillingsReturn?.forward?(fr?'Retour à la recette':'Back to Recipe'):undefined}
                  directSelectionReturn={!!fillingsReturn}
                  onPrepProgress={setFillingsProgress} prepContinueLabel={prepContinueLabel}
                  active={companionVisible}
                  doughConfigured={recipeGenerated}
                  onHasSelection={setPizzasConfirmed}
                  bakeEventId={bakeEventId}
                  initialQtys={pizzaPartyQtys}
                  onQtysSnapshot={setPizzaPartyQtys}
                  getQtysRef={pizzaPartyGetQtysRef}
                  onGoToMyDough={openQuantityEdit}
                  ovenType={ovenType ?? undefined}
                  recipeIngredients={doughShoppingItems}
                  onRepeat={repeatCurrentRecipe} resultNotes={resultNotes} onResultNotesChange={setResultNotes} onSave={saveCurrentSession}
                  onEnsureBakeEvent={async () => {
                    if (bakeEventId) return bakeEventId;
                    if (!user) return null;
                    const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                    const payload = buildSessionPayload();
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved && !!user}
                  onBakedQtysChange={setBakedPartyQtys}
                  bakedQtys={bakedPartyQtys}
                  restoreToken={partyRestoreToken}
                  onShare={shareCurrentSession}
                />
              </div>
            )}

          </div>
        )}

        {/* ════════════ ADVANCED ════════════ */}
        {tab === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {customReplanHost && <div className="bh-plan-sheet-only" data-replan-host>{renderCustomScheduler(customStarterStepId !== null?'plan':'all')}</div>}
            {/* ── Setup tab content ── */}
            <div style={{ display: destination === 'organisation' && !!bakeType && modeChosen ? 'flex' : 'none', flexDirection: 'column', gap: '16px' }}>

            {/* ── Summary bar: one collapsed line while going forward, a
                   sheet of every step on demand. It lives inside the
                   modeChosen gate, so the opening mode page carries no bar —
                   nothing decided yet, nothing to navigate to, and a progress
                   bar at zero is a discouraging way to greet someone. ── */}
            {/* Back from the recipe lands here, not on whichever step
                was open when they left. "Back" after a recipe exists
                means "what did I choose", not "where was I typing". */}
            {/* Guarded on recipeGenerated, not just the flag. The overview
                answers "what did I choose" — a question that only exists
                after there is something to come back to. Any path that
                left the flag set (a reset, a fresh start after browsing
                the summary) heals itself here instead of dropping a
                first-time baker onto a review screen. */}
            {setupOverview && (
              <SetupReview
                kitchenRow={!isUnleavened&&kitchenAnswered?{value:`${cToDisplay(kitchenTemp,units)}${tempUnit(units)}`,onClick:()=>{captureEditReturn();openDestination('batch');setBatchView('kitchen');scrollToStepTop();}}:undefined}
                stale={protocolStale}
                flow={customFlow}
                reviewValues={{3:reviewEquipment, 4:reviewAmbient, 7:reviewLeavening, ...(levainCustom ? (starterStepValue===null&&starterLocationAnswered?{8:starterLocation==='fridge'?(fr?'Frigo':'Fridge'):(fr?'Ambiante':'Room temperature')}:{}) : {8: prefermentType==='none'?t('preferment.direct'):localName(PREFERMENT_TYPES[prefermentType])}), 10:reviewDough, 9:reviewTiming}}
                busyRow={reviewBusy?{value:reviewBusy,onClick:()=>{setSetupOverview(false);setBakeTimeQuestion(true);customFlow.onJump(9);}}:undefined}
                suggestedRows={{ '3': equipmentOpen, '7': yeastOpen, '8': showPrefermentChoice && !levainCustom && !methodPicked, '10': manualHydration===undefined }}
                modeChip={{ value: 'custom', onClick: () => { chooseMode('simple'); setSetupOverview(recipeGenerated); scrollToStepTop(); } }}
                onJump={id => { setSetupOverview(false); if(id===9)setBakeTimeQuestion(true); customFlow.onJump(id); }}
                returnLabel={recipeGenerated?setupReturnLabel:undefined}
                forward={recipeGenerated&&!protocolStale&&(!fillingsReturn||(fillingsReturn.destination==='recipe'&&!fillingsReturn.forward))?(fillingsStep?{label:`${fillingsStepLabel} →`,onClick:()=>{setFillingsReturn(null);openToppingsStep();}}:{label:fr?'Liste de courses →':'Shopping list →',onClick:()=>{setFillingsReturn(null);openDestination('shopping');}}):undefined}
                onBackToRecipe={finishSetupEdit}
              />
            )}
            <div ref={customSwipeRef} style={{ display: setupOverview ? 'none' : undefined }}>

            {/* ─── ADV STEP 1: Style picker ────────── */}
            {/* ─── ADV STEP 4: Equipment (oven + mixing) ── */}
            <StepPage flow={customOrganisationFlow} id={3} nextOverride={equipmentPanel==='oven' ? <div style={{width:'100%'}}>{!ovenPicked&&<p style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{fr?'Choisissez votre four.':'Choose your oven.'}</p>}<button type="button" disabled={!ovenPicked} style={{...NEXT_CTA,opacity:!ovenPicked?.5:1}} onClick={()=>{setEquipmentPanel('mixer');scrollToStepTop();}} data-bh-forward>{fr?'Pétrissage →':'Kneading →'}</button></div>
              : !mixerPicked ? <div style={{width:'100%'}}><p style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{fr?'Choisissez comment vous pétrissez.':'Choose how you knead.'}</p><button type="button" disabled style={{...NEXT_CTA,opacity:.5}} data-bh-forward>{recipeGenerated ? setupReturnLabel : `${CUSTOM_STEPS.find(step=>step.id===nextCustomStep(3))?.chip ?? (fr?'Suivant':'Next')} →`}</button></div> : undefined}>
              {/* Said only when the selection really comes from the baker's profile. */}
              {equipmentFromProfile ? <p data-equipment-profile>{fr?'D’après votre profil — vérifiez-le pour cette fournée.':'From your profile — check it for this bake.'}</p>
                : profileFields.has('last') && (equipmentPanel==='oven' ? ovenPicked : mixerPicked) && <p data-equipment-profile>{fr?'Comme la dernière fois — vérifiez-le pour cette fournée.':'As last time — check it for this bake.'}</p>}
              {equipmentChoices}
            </StepPage>

            {/* ─── ADV STEP 5: Climate ─────────────── */}


            {/* ─── ADV STEP 7: Flour ───────────────── */}
            <StepPage flow={customOrganisationFlow} id={6} nextOverride={manualFlourEntry ? null : !flourAnswered || archivedFlourNames.length ? <><p data-flour-hint className={archivedFlourNames.length?undefined:'bh-visually-hidden'} style={{gridColumn:'1/-1',order:-1,margin:0,fontSize:14,color:'var(--smoke)',textAlign:'center'}}>{archivedFlourNames.length?(fr?'Remplacez la farine qui n’est plus proposée pour continuer.':'Replace the flour that is no longer listed to continue.'):(fr?'Choisissez une farine pour continuer.':'Choose a flour to continue.')}</p><button data-bh-forward type="button" disabled style={{...NEXT_CTA,opacity:0.55,cursor:'default'}}>{(CUSTOM_STEPS.find(step=>step.id===nextCustomStep(6))?.chip ?? (fr ? 'Suivant' : 'Next'))} →</button></> : undefined}>
              <FlourPicker
                onManualEntryChange={setManualFlourEntry}
                blend={flourBlend}
                onBlendChange={b => {
                  // A flour that holds a different length of fermentation (its tolerance) re-times a yeast plan:
                  // the planner is unmounted on this step, so the flag carries the change (round 9, J).
                  // A levain plan does not follow the flour (round 8): it is left as it is.
                  if (yeastType !== 'sourdough' && recipeFlourStrength(styleKey ?? '', 'custom', b) !== flourStrength) setPlanReplanPending(true);
                  setFlourChosen(true); setFlourBlend(b);
                }}
                bakeType={bakeType ?? 'pizza'}
                mode={tab === 'custom' ? 'custom' : 'simple'}
                styleKey={styleKey}
              />
              {/* Storage belongs with the flour, not the kitchen temperatures. */}
              {flourChosen && <div style={{marginTop:20}}><ClimatePicker
                kitchenTemp={kitchenTemp} humidity={humidity}
                fridgeTemp={fridgeTemp} mode="custom" part="flourStorage"
                units={units}
                flourInFridge={flourInFridge} onFlourInFridgeChange={setFlourInFridge}
                onChange={(t, h, f) => { setKitchenTemp(t); setHumidity(h); setFridgeTemp(f); }}
              /></div>}
              {/* The page's own Suivant carries this now — the flour step
                  kept a second Continue when the accordion was retired. */}
            </StepPage>

            {/* ─── ADV STEP 8: Yeast ───────────────── */}
            <StepPage flow={customOrganisationFlow} id={7} nextOverride={!yeastPicked ? <button data-bh-forward type="button" disabled style={{...NEXT_CTA,opacity:.5}}>{recipeGenerated ? setupReturnLabel : `${CUSTOM_STEPS.find(step=>step.id===nextCustomStep(7))?.chip ?? (fr?'Suivant':'Next')} →`}</button> : undefined}>
              <YeastHelper
                selected={yeastPicked ? yeastType : null}
                onSelect={(yt) => {
                  chooseYeast(yt);confirmSetting('yeast',yt);
                  if (yt === 'sourdough') {
                    setPrefermentType('levain');
                  } else {
                    if (prefermentType === 'levain') setPrefermentType('none');
                  }
                }}
                onClose={() => {}}
                disabledIds={['sourdough']}
                disabledNote={enrichedDirectOnly || !breadSupportsStarter ? (locale === 'fr' ? 'Cette recette est actuellement prévue avec de la levure et sans préferment.' : 'This recipe currently supports commercial yeast and no preferment.') : !yeastPicked ? (locale === 'fr' ? 'Choisissez votre levure.' : 'Choose your yeast.') : undefined}
                styleKey={styleKey}
              />
              {(styleKey === 'pain_levain' || styleKey === 'pain_seigle') && yeastType === 'sourdough' && advancedStep === 7 && (
                <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', marginTop: '8px', textAlign: 'center' }}>
                  {locale === 'fr' ? 'Levain confirmé automatiquement…' : 'Sourdough confirmed automatically…'}
                </div>
              )}
              {/* The levain confirm button is gone: the page's own Suivant
                  carries it, and advanceAdv skips the hidden preferment step. */}
            </StepPage>

            {/* ─── ADV STEP 9: Preferment (hidden for sourdough) ── */}
            {showPrefermentChoice && (
              <StepPage flow={customOrganisationFlow} id={8} nextOverride={!prefermentChosen||prefermentTooClose() ? <button data-bh-forward type="button" disabled style={{...NEXT_CTA,opacity:0.55}}>{(CUSTOM_STEPS.find(step=>step.id===nextCustomStep(8))?.chip ?? (fr?'Suivant':'Next'))} →</button> : undefined}>
                <PrefermentPicker
                  selected={prefermentChosen ? prefermentType : null}
                  chooseMethod
                  onSelect={method=>{choosePreferment(method);confirmSetting('method',method);if(method==='levain')chooseYeast('sourdough');else if(yeastType==='sourdough'||!yeastType)chooseYeast('instant');}}
                  flourPct={prefermentFlourPct}
                  suggestedFlourPct={20}
                  totalFlourGrams={advancedRecipe?.flour ?? (styleKey ? numItems * itemWeight / (1 + (ALL_STYLES[styleKey].hydration + ALL_STYLES[styleKey].salt + ALL_STYLES[styleKey].oil + ALL_STYLES[styleKey].sugar) / 100) : undefined)}
                  onFlourPctChange={setPrefermentFlourPct}
                  styleKey={styleKey ?? undefined}
                  hideTypes={levainStyle ? (['none','poolish','biga'] as PrefermentType[]) : breadProtocol ? (['none','poolish','biga','levain'] as PrefermentType[]).filter(pt=>!breadProtocol.supportedPreferments.includes(pt)) : []}
                  directOnly={enrichedDirectOnly}
                  kitchenTemp={kitchenTemp}
                  selectedExtra={{poolish:<fieldset data-poolish-storage style={{border:0,padding:0,margin:'16px 0 0'}}>
                  <legend style={{fontSize:16,fontWeight:650,marginBottom:8}}>{fr?'Où le poolish fermente':'Where the poolish ferments'}</legend>
                  <div style={{display:'grid',gap:7}}>
                    {([['auto',fr?'Au mieux pour mon planning':'Best for my timing',''],['fridge',fr?'Au réfrigérateur':'In the fridge',fr?'Plus long et plus souple, 12 à 24 h.':'Longer and more forgiving, 12 to 24 h.'],['room',fr?'À température ambiante':'At room temperature',fr?'Plus court, 6 à 14 h.':'Shorter, 6 to 14 h.']] as const).map(([value,label,note])=>{
                      const active=poolishStorage===value;
                      return <button key={value} type="button" aria-pressed={active} onClick={()=>{if(value!==poolishStorage){clearPrefYeastForStorage('poolish');setPoolishStorage(value);setPlanReplanPending(true);}}} style={{minHeight:44,padding:'9px 12px',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:2,textAlign:'left',border:`1.5px solid ${active?'var(--terra)':'var(--border)'}`,borderRadius:9,background:active?'var(--warm)':'var(--paper)',color:'var(--char)',fontFamily:'var(--font-ui)',fontSize:16,cursor:'pointer'}}><span>{label}</span>{note&&<span style={{fontSize:14,color:'var(--smoke)'}}>{note}</span>}</button>;
                    })}
                  </div>
                  {prefYeastClearedLine('poolish')}
                </fieldset>,biga:<fieldset data-biga-storage style={{border:0,padding:0,margin:'16px 0 0'}}>
                  <legend style={{fontSize:16,fontWeight:650,marginBottom:8}}>{fr?'Où la biga fermente':'Where the biga ferments'}</legend>
                  <div style={{display:'grid',gap:7}}>
                    {/* D1 (21 Nov 2026): the fridge biga, or Giorilli's classic biga in a cool spot. One window per storage (data.ts BIGA_WINDOWS). */}
                    {([['auto',fr?'Au mieux pour mon planning':'Best for my timing',''],['fridge',fr?'Au réfrigérateur':'In the fridge',fr?`Plus longue, ${BIGA_WINDOWS.fridge.min} à ${BIGA_WINDOWS.fridge.max} h.`:`Longer, ${BIGA_WINDOWS.fridge.min} to ${BIGA_WINDOWS.fridge.max} h.`],['cool',fr?'Dans un endroit frais, 16–18 °C':'In a cool spot, 16–18 °C',fr?`La biga italienne classique, ${BIGA_WINDOWS.cool.min} à ${BIGA_WINDOWS.cool.max} h.`:`The classic Italian biga, ${BIGA_WINDOWS.cool.min} to ${BIGA_WINDOWS.cool.max} h.`]] as const).map(([value,label,note])=>{
                      const active=bigaStorage===value;
                      return <button key={value} type="button" data-biga-storage-option={value} aria-pressed={active} onClick={()=>{if(value!==bigaStorage){clearPrefYeastForStorage('biga');setBigaStorage(value);setPrefGoesInFridgeState(value!=='cool');setPlanReplanPending(true);}}} style={{minHeight:44,padding:'9px 12px',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:2,textAlign:'left',border:`1.5px solid ${active?'var(--terra)':'var(--border)'}`,borderRadius:9,background:active?'var(--warm)':'var(--paper)',color:'var(--char)',fontFamily:'var(--font-ui)',fontSize:16,cursor:'pointer'}}><span>{label}</span>{note&&<span style={{fontSize:14,color:'var(--smoke)'}}>{note}</span>}</button>;
                    })}
                  </div>
                  {prefYeastClearedLine('biga')}
                </fieldset>}}
                />
                {prefermentChosen&&(()=>{
                  // 14 Nov 2026: a preferment chosen for a bake that is too close (from My choices,
                  // or after the bake time) left the baker on a plan starting in the past. Say so
                  // here and offer what fits: the poolish, then direct dough, or a later bake.
                  const close=prefermentTooClose();if(!close||prefermentType==='none'||prefermentType==='levain')return null;
                  const {needH,leftH,poolishFits,later,laterNight,laterDay,coolFits}=close;
                  const name=prefermentType==='biga'?'biga':'poolish';
                  const hours=(h:number)=>formatDuration(Math.max(1,Math.round(h)),locale);
                  const choose=(pt:PrefermentType)=>{choosePreferment(pt);confirmSetting('method',pt);setPlanReplanPending(true);};
                  const btn={minHeight:44,padding:'10px 14px',border:'1px solid var(--border)',borderRadius:10,background:'var(--warm)',color:'var(--char)',fontSize:15,cursor:'pointer',textAlign:'left'} as const;
                  return <div data-preferment-too-close role="status" style={{marginTop:16,padding:'14px 16px',borderRadius:12,background:'var(--cream)',display:'grid',gap:10}}>
                    <p style={{margin:0,fontSize:15,lineHeight:1.5}}>{fr?`${prefermentType==='biga'?'Une biga':'Un poolish'}${coolFits?' au frigo':''} demande environ ${hours(needH(prefermentType))} avant la cuisson ; il en reste ${hours(Math.max(0,leftH))}.`:`A ${name}${coolFits?' in the fridge':''} needs about ${hours(needH(prefermentType))} before baking; your bake is in ${hours(Math.max(0,leftH))}.`}</p>
                    {coolFits&&<button type="button" data-preferment-fallback="cool" style={btn} onClick={()=>{setBigaStorage('cool');setPrefGoesInFridgeState(false);confirmSetting('method','biga');setPlanReplanPending(true);}}>{fr?'Garder la biga, dans un endroit frais à 16–18 °C':'Keep the biga, in a cool spot at 16–18 °C'}</button>}
                    {poolishFits&&<button type="button" data-preferment-fallback="poolish" style={btn} onClick={()=>choose('poolish')}>{fr?'Faire un poolish':'Make a poolish instead'}</button>}
                    <button type="button" data-preferment-fallback="none" style={btn} onClick={()=>choose('none')}>{fr?'Pâte directe, sans préferment':'Direct dough, no preferment'}</button>
                    {later&&laterNight.length>0&&laterDay&&<button type="button" data-preferment-fallback="later-day" style={btn} onClick={()=>{setEatTime(laterDay);setPlanReplanPending(true);}}>{fr?`Cuire ${formatBakeDateTime(laterDay,locale)} (sans étape de nuit)`:`Bake ${formatBakeDateTime(laterDay,locale)} (no night steps)`}</button>}
                    {later&&laterNight.length>0&&<p data-later-night style={{margin:0,fontSize:14,lineHeight:1.45,color:'var(--ash)'}}>{nightStepsLine(laterNight,fr,prefermentType==='biga'?'biga':'poolish')}</p>}
                    {later&&<button type="button" data-preferment-fallback="later" style={btn} onClick={()=>{setEatTime(later);setPlanReplanPending(true);}}>{fr?`Garder ${prefermentType==='biga'?'la biga':'le poolish'} et cuire ${formatBakeDateTime(later,locale)}`:`Keep the ${name} and bake ${formatBakeDateTime(later,locale)}`}</button>}
                  </div>;
                })()}
              </StepPage>
            )}

            {customStarterStepId !== null && (
              <StepPage flow={customOrganisationFlow} id={customStarterStepId} nextOverride={rebakeFinishes ? rebakeCreateButton : !starterStateDescribed||!starterLocationAnswered||!starterMatureAnswered ? <div style={{width:'100%'}}>
                <p id="bh-starter-fed-hint" style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{!starterLocationAnswered?(fr?'Indiquez où votre levain a été gardé.':'Tell us where your starter has been.'):!starterStateDescribed?(fr?'Indiquez quand votre levain a été rafraîchi pour la dernière fois.':'Tell us when your starter was last fed.'):(fr?'Indiquez comment est votre levain.':'Tell us how active your starter is.')}</p>
                <button data-bh-forward type="button" disabled aria-describedby="bh-starter-fed-hint" style={{...NEXT_CTA,opacity:0.55}}>{(CUSTOM_STEPS.find(step=>step.id===nextCustomStep(customStarterStepId))?.chip ?? (fr?'Suivant':'Next'))} →</button>
              </div> : undefined}>
                {planEdit?null:renderCustomScheduler('starter')}
              </StepPage>
            )}

            {/* ─── ADV STEP 10: Scheduler ──────────── */}
            <StepPage flow={customOrganisationFlow} id={9} backOverride={customClashCardBar ? backToGoodPlanBack : undefined} nextOverride={rebakeFinishes ? rebakeCreateButton : bakeTimeOnly && eatTime && (customStarterStepId === null || starterStateDescribed) ? (customDecisionPending ? <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setDecisionSheet('return')}>{setupReturnLabel}</button> : !scheduleCandidateValid ? <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setBakeTimeQuestion(false)}>{fr?'Voir le planning':'See the plan'} →</button> : undefined) : customStarterStepId !== null && !starterStateDescribed ? <div style={{width:'100%'}}>
                <p style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{fr?'Indiquez quand votre levain a été rafraîchi pour la dernière fois.':'Tell us when your starter was last fed.'}</p>
                <button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>openSetupStep(customStarterStepId,true)}>{fr?'Votre levain →':'Your starter →'}</button>
              </div> : scheduleEditing ? null : customQuestionOnly && customDecisionPending && customOrganisationFlow.steps.some(step=>step.id!==9&&!stepAnswered(step,customOrganisationFlow.highestStep,customOrganisationFlow.steps)) ? undefined : !scheduleCandidateValid && recipeGenerated && !customQuestionOnly ? (customClashCardBar ? <></> : backToGoodPlanButton) : !scheduleCandidateValid ? <div style={{width:'100%'}}>
                {/* The way forward is never a button that only scrolls: the next step waits for a choice above. */}
                {customQuestionOnly?(customDecisionPending?<button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setDecisionSheet('generate')}>{customOrganisationFlow.generateLabel}</button>:<button data-bh-forward type="button" style={NEXT_CTA} onClick={()=>setPlanDetail(true)}>{fr?'Voir le planning':'See the plan'} →</button>):<p id="bh-plan-choice-hint" style={{fontSize:14,color:'var(--ash)',margin:'0 0 8px'}}>{customDecisionPending?(fr?'Choisissez une des options ci-dessus.':'Choose one of the options above.'):(fr?'Ajustez le planning ci-dessus pour continuer.':'Adjust the plan above to continue.')}</p>}
                {customQuestionOnly?null:<button data-bh-forward type="button" disabled aria-describedby="bh-plan-choice-hint" style={{...NEXT_CTA,opacity:0.55}}>{recipeGenerated?setupReturnLabel:customOrganisationFlow.steps.at(-1)?.id===9?customOrganisationFlow.generateLabel:`${customOrganisationFlow.steps.find(step=>step.id===nextCustomStep(9))?.chip ?? (fr?'Suivant':'Next')} →`}</button>}
              </div> : undefined}>
              {!styleKey ? (
                <NeedsStyleFirst fr={locale === 'fr'} onChoose={() => customFlow.onJump(1)} />
              ) : (
              planEdit?null:renderCustomScheduler(customStarterStepId !== null?'plan':'all')
              )}
            </StepPage>

            {/* Prototype: one clear field per dough setting. */}
            <StepPage flow={customOrganisationFlow} id={10} nextOverride={yeastEntryBlocked ? <button data-bh-forward type="button" disabled aria-describedby="bh-yeast-entry-note" style={{...NEXT_CTA,opacity:0.55}}>{recipeGenerated ? setupReturnLabel : fineTuneFinishes ? customOrganisationFlow.generateLabel : `${CUSTOM_STEPS.find(step=>step.id===nextCustomStep(10))?.chip ?? (fr?'Suivant':'Next')} →`}</button>
              : fineTuneFinishes ? <button data-bh-forward data-finetune-generate type="button" style={NEXT_CTA} onClick={finishFromFineTune}>{customOrganisationFlow.generateLabel}</button>
              : undefined}>
              {fineTuneFinishes && !planEdit && <div className="bh-plan-sheet-only">{renderCustomScheduler(customStarterStepId !== null?'plan':'all')}</div>}
              {/* Size, weight and the bread's flour basis are all set on Quantity, behind Adjust (14 Nov 2026). */}
              {/* Oven and mixing are asked once, on Equipment. */}
              {(() => {
                const style = styleKey ? ALL_STYLES[styleKey] : null;
                const zone = STYLE_HYDRATION_ZONES[styleKey!] ?? (breadProtocol ? {...FALLBACK_ZONE,classicMin:ALL_STYLES[styleKey!].hydration,classicMax:ALL_STYLES[styleKey!].hydration,name:ALL_STYLES[styleKey!].name} : FALLBACK_ZONE);
                const recommendation = styleKey && schedule && ovenType && yeastType ? calculateRecipe(styleKey, ovenType as OvenType, numItems, itemWeight, kitchenTemp, humidity, schedule, fridgeTemp, yeastType, 'custom', mixerType as MixerType, undefined, manualOil, manualSugar, flourChosen ? flourBlend : undefined, prefermentType, priorityOverride, prefermentFlourPct ?? 20, manualSalt, targetDoughTemp, flourInFridge, wasteAllowance, prefGoesInFridge, feedToMixH, prefOffsetH || undefined, measuredFlourTemp, prefTempForBalance) : null;
                const recommendedHyd = recommendation?.hydration ?? style?.hydration ?? 64;
                // The suggested sum, with the flour the recipe uses (round 9 A): the hint and "Why this value?" read it.
                const hydSum = recommendedHydration(styleKey??'',ovenType as OvenType,kitchenTemp,humidity,recipeFlourBlend(styleKey??'','custom',flourChosen?flourBlend:undefined));
                const defaultTemp = styleKey ? ({neapolitan:23,newyork:24,roman:25,pan:25,sourdough:24,brioche:22,pain_viennois:23,fougasse:25} as Record<string,number>)[styleKey] ?? 24 : 24;
                // Lean breads (no oil or sugar in the formula) don't offer them unless already set.
                const leanBread = bakeType==='bread' && !!style && (style.oil ?? 0)===0 && (style.sugar ?? 0)===0;
                const fields = [
                  ...(!enrichedDirectOnly ? [
                    {group:'ingredient',label:fr?'Hydratation':'Hydration',aria:fr?'Hydratation, % de farine':'Hydration, % of flour',unit:'%',value:manualHydration ?? recommendedHyd,rec:recommendedHyd,min:zone.min,max:zone.max,step:0.5,set:setManualHydration,
                      // The one fact worth having beside the number: the style's classic range, and why the app moved off it.
                      hint:(()=>{const range=zone.classicMin===zone.classicMax?`${zone.classicMin}`:`${zone.classicMin}–${zone.classicMax}`;const outside=recommendedHyd>zone.classicMax+0.05||recommendedHyd<zone.classicMin-0.05;
                        // Name only what moved it (round 9 A: "…and your flour" with no flour in the sum).
                        const why=[hydSum.oven?(fr?'votre four':'your oven'):null,hydSum.kitchen?(fr?'votre cuisine':'your kitchen'):null,hydSum.flour?(fr?'votre farine':'your flour'):null].filter(Boolean) as string[];
                        const list=why.length>1?`${why.slice(0,-1).join(', ')} ${fr?'et':'and'} ${why.at(-1)}`:why[0];
                        return fr?`Classique pour ce style : ${range} %.${outside&&list?` ${formatPercent(recommendedHyd,locale)} ici pour ${list}.`:''}`:`Classic for this style: ${range}%.${outside&&list?` ${formatPercent(recommendedHyd,locale)} here for ${list}.`:''}`;})()},
                    {group:'ingredient',label:fr?'Sel':'Salt',aria:fr?'Sel, % de farine':'Salt, % of flour',unit:'%',value:manualSalt ?? style?.salt ?? 2.5,rec:style?.salt ?? 2.5,min:1.5,max:3.5,step:0.1,set:setManualSalt},
                    ...(leanBread && manualOil===undefined ? [] : [{group:'ingredient',label:fr?'Huile':'Oil',aria:fr?'Huile, % de farine':'Oil, % of flour',unit:'%',value:manualOil ?? style?.oil ?? 0,rec:style?.oil ?? 0,min:0,max:10,step:0.5,set:setManualOil,
                      // Nothing to say about none; an amount gets what it does (and burning in a very hot oven).
                      hint:(manualOil ?? style?.oil ?? 0)>0?oilGuidance(manualOil ?? style?.oil ?? 0,ovenType ?? '',styleKey ?? '',t):undefined}]),
                    ...(leanBread && manualSugar===undefined ? [] : [{group:'ingredient',label:fr?'Sucre':'Sugar',aria:fr?'Sucre, % de farine':'Sugar, % of flour',unit:'%',value:manualSugar ?? style?.sugar ?? 0,rec:style?.sugar ?? 0,min:0,max:10,step:0.5,set:setManualSugar,
                      hint:(manualSugar ?? style?.sugar ?? 0)>0?sugarGuidance(manualSugar ?? style?.sugar ?? 0,ovenType ?? '',t).note:undefined}]),
                  ] : []),
                  {group:'process',label:fr?'Pâte après pétrissage':'Dough after mixing',aria:fr?`Température de la pâte après pétrissage, ${tempUnit(units)}`:`Dough temperature after mixing, ${tempUnit(units)}`,unit:tempUnit(units),temp:true,value:targetDoughTemp ?? defaultTemp,rec:defaultTemp,min:18,max:28,step:1,set:setTargetDoughTemp},
                  ...(totalFlourTarget===undefined?[{group:'process',label:fr?'Marge pour les pertes':'Extra for bowl loss',aria:fr?'Marge pour les pertes au pétrissage, % de la pâte':'Extra dough for bowl loss, % of the dough',unit:'%',value:wasteAllowance,rec:DEFAULT_WASTE_PCT,min:0,max:5,step:0.5,set:setWastePct}]:[]),
                ];
                const renderField = (field:typeof fields[number])=>{
                  // A temperature row shows and takes the baker's unit; the value is kept in °C.
                  const temp='temp' in field&&field.temp;
                  const shown=(c:number)=>temp?cToDisplay(c,units):Math.round(c*100)/100;
                  const stored=(n:number)=>temp?inputTempToC(n,units):n;
                  return <div key={field.aria}><label data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16,marginBottom:'hint' in field&&field.hint?6:14}}><span data-finetune-label style={{minWidth:0}}>{field.label}</span>
                    {/* A decimal box in the locale's separator: « 2,2 % » in French, typed either way (round 9 S3). */}
                    <UnitInput decimal suffix={field.unit} label={field.aria} key={`${field.aria}:${field.value}:${units}`} defaultValue={formatDecimal(shown(field.value),fr)} onBlur={e=>{const n=parseDecimal(e.target.value);const next=Math.min(field.max,Math.max(field.min,stored(n)));if(e.target.value!==''&&Number.isFinite(n)&&Math.abs(shown(next)-shown(field.value))>1e-9)field.set(temp?Math.round(next*10)/10:next);else e.target.value=formatDecimal(shown(field.value),fr);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>
                  </label>
                  {'hint' in field&&field.hint&&<p data-field-hint style={{margin:'0 0 16px',fontSize:14,lineHeight:1.45,color:'var(--smoke)'}}>{field.hint}</p>}
                  {field.set===setManualHydration&&<div style={{marginBottom:16,fontSize:14}}>{manualHydration!==undefined&&Math.abs(manualHydration-recommendedHyd)>0.005&&<button type="button" onClick={()=>setManualHydration(undefined)} style={{minHeight:44}}>{fr?'Rétablir l’hydratation conseillée':'Reset suggested hydration'}</button>}<details><summary className="bh-chevron" style={{minHeight:44,cursor:'pointer'}}>{fr?'Pourquoi cette valeur ?':'Why this value?'}</summary>{(()=>{
                    // One line, as a sum: "Style 62% · oven +3 · flour +2 = 67%" (14 Nov 2026 audit), from the sum the recipe
                    // uses, with the flour the recipe uses (round 9 A: an unchosen flour added "+1" the recipe did not).
                    const sum=hydSum;const {oven,kitchen,flour}=sum;
                    const sign=(n:number)=>`${n>0?'+':'−'}${String(Math.abs(n)).replace('.',fr?',':'.')}`;
                    const parts=[`Style ${formatPercent(sum.style,locale)}`,...(oven?[`${fr?'four':'oven'} ${sign(oven)}`]:[]),...(kitchen?[`${fr?'cuisine':'kitchen'} ${sign(kitchen)}`]:[]),...(flour?[`${fr?'type de farine':'flour type'} ${sign(flour)}`]:[])];
                    // W sets fermentation time, not water (21 Nov 2026): say so where the sum is read.
                    return <><p style={{margin:'4px 0 0'}}>{parts.join(' · ')} → {formatPercent(recommendedHyd,locale)}</p>
                      {flourChosen&&<p data-hydration-w-note style={{margin:'4px 0 0',color:'var(--smoke)'}}>{fr?'Le W de la farine fixe la durée de fermentation, pas l’eau.':'The flour’s W sets how long it can ferment, not the water.'}</p>}</>;
                  })()}</details></div>}
                  </div>;};
                return <>

                  <h3 data-finetune-group="ingredients" style={{margin:'8px 0 12px',fontSize:13,fontWeight:650,letterSpacing:'.06em',textTransform:'uppercase' as const,color:'var(--smoke)'}}>{fr?'Ingrédients':'Ingredients'}</h3>
                  {fields.filter(field=>field.group==='ingredient').map(renderField)}
                  {yeastType==='sourdough' && (()=>{
                    // Starter % re-times the levain room-temperature bulk (Craig's curve);
                    // the fridge retard is not used to absorb it.
                    const flourG = recipe?.flour;
                    const recommendedPct = recipe?.sourdough && flourG ? Math.round(recipe.sourdough.starterGramsMid / flourG * 1000) / 10 : referenceStarterPct(kitchenTemp);
                    // The plan's value: the planner's raise as stored, not re-derived from rounded grams (18 Nov 2026 retention: 29.9 for 30).
                    const shownPct = starterPctOverride ?? autoStarterPct ?? recommendedPct;
                    return <div data-starter-override style={{marginBottom:18}}>
                      <label data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16}}><span data-finetune-label style={{minWidth:0}}>{fr?'Levain':'Starter'}</span>
                        <UnitInput suffix="%" label={fr?'Levain, % de farine':'Starter, % of flour'} key={`starter:${starterPctOverride ?? 'auto'}:${shownPct}`} defaultValue={shownPct} min={5} max={30} step={1}
                          onBlur={e=>{const n=Number(e.target.value);if(e.target.value===''||!Number.isFinite(n))return;const pct=Math.min(30,Math.max(5,Math.round(n*2)/2));if(starterPctOverride===undefined&&Math.abs(pct-shownPct)<0.25)return;setStarterPctOverride(pct);setPlanReplanPending(true);}}/>
                      </label>
                      <p style={{margin:'6px 0 0',fontSize:14,color:'var(--smoke)',lineHeight:1.45}}>{starterPctOverride!==undefined
                        ? (fr?'Le pointage suit cette quantité : moins de levain, pointage plus long.':'The rise follows this amount: less starter, longer rise.')
                        : autoStarterPct!==undefined
                        ? (fr?'Augmenté pour que le pointage tienne dans votre temps libre.':'Raised so the rise fits your free time.')
                        : (fr?'Calculé pour votre cuisine. Modifiez-le, le pointage suit.':'Set for your kitchen. Change it and the rise follows.')}</p>
                      {starterPctOverride!==undefined&&<button type="button" onClick={()=>{setStarterPctOverride(undefined);setPlanReplanPending(true);}} style={{minHeight:44,marginTop:6,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:9,background:'var(--paper)',color:'var(--char)',fontSize:16,cursor:'pointer'}}>{fr?'Revenir à la quantité calculée':'Use the calculated amount'}</button>}
                    </div>;
                  })()}
                  {yeastType && yeastType!=='sourdough' && yeastEntryMethod && (()=>{
                    // Entered in the baker's own yeast; stored as IDY so a yeast change keeps the timing.
                    const conversion = YEAST_TYPES[yeastType]?.conversion ?? 1;
                    // Until the Custom plan exists the amount is "Set after timing", never another plan's.
                    const planReady = recipeGenerated || customPlanSeen;
                    // A poolish or biga (round 7): its own yeast (% of its flour) and the final dough's, each
                    // "Auto" until the baker types; under one "Yeast · instant dry" line so each label stays short.
                    const pref = prefermentType==='poolish'||prefermentType==='biga' ? prefermentType as FlourPreferment : null;
                    const prefName = pref==='biga' ? 'biga' : 'poolish';
                    const prefEntered = pref && prefYeastOverride?.type===pref ? prefYeastOverride.pct : undefined;
                    const prefAutoPct = pref && planReady && prefEntered===undefined && recipe?.preferment && recipe.preferment.prefFlour>0
                      ? recipe.preferment.prefYeastGramsIDY/recipe.preferment.prefFlour*100*conversion : undefined;
                    const prefIssue = pref && prefYeastIssue?.type===pref ? prefYeastIssue : null;
                    // Round 8 (S2): percentages with the locale's separator, durations in baker time (« 11 h 45 »).
                    const pctText=(value:number)=>bakerPct(value,fr);
                    // Round 13 (item 4): an offer that weighs what the calculated amount weighs (at the grams the recipe shows) is not offered.
                    const sameGrams=(a:number,b:number|null,flourG:number|undefined)=>b!==null&&(flourG&&flourG>0?formatYeastDose(flourG*a/100)===formatYeastDose(flourG*b/100):Math.abs(a-b)<0.005);
                    const secondaryButton:React.CSSProperties={minHeight:44,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:9,background:'var(--paper)',color:'var(--char)',fontSize:16,cursor:'pointer'};
                    const clearPrefYeast=()=>{setPrefYeastIssue(null);if(prefYeastOverride!==undefined){setPrefYeastOverride(undefined);setPlanReplanPending(true);}};
                    const prefRow = pref && <div data-pref-yeast-override>
                      <p data-finetune-label data-yeast-heading style={{margin:'0 0 8px',fontSize:16}}>{yeastRowLabel(yeastType,fr)}</p>
                      <label data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16,marginBottom:10}}><span data-finetune-label style={{minWidth:0}}>{fr?(pref==='biga'?'Dans la biga':'Dans le poolish'):`In the ${prefName}`}</span>
                        <UnitInput decimal suffix="%" width={120} label={fr?`Levure ${pref==='biga'?'de la biga':'du poolish'}, % de la farine ${pref==='biga'?'de la biga':'du poolish'}, ${(localName(YEAST_TYPES[yeastType]) ?? yeastType).toLowerCase()}`:`${pref==='biga'?'Biga':'Poolish'} yeast, % of the ${prefName} flour, ${(localName(YEAST_TYPES[yeastType]) ?? yeastType).toLowerCase()}`}
                          key={`pref-yeast:${pref}:${prefEntered ?? 'auto'}:${prefAutoPct ?? ''}:${prefIssue?`issue${prefIssue.shownPct}`:''}:${locale}`} defaultValue={prefIssue?formatDecimal(prefIssue.shownPct,fr):prefEntered!==undefined?formatDecimal(roundShownPct(prefEntered*conversion),fr):''} placeholder={autoPctPlaceholder(prefAutoPct,fr)}
                          aria-describedby={prefIssue?'bh-pref-yeast-note':undefined}
                          onBlur={e=>{
                            // An empty box is the calculated amount again (round 8, bug 1).
                            if(e.target.value.trim()===''){clearPrefYeast();return;}
                            const n=parseDecimal(e.target.value);if(!Number.isFinite(n))return;
                            const idy=Math.min(PREF_YEAST_MAX_PCT,Math.max(PREF_YEAST_MIN_PCT,n/conversion));
                            // Round 15 (item 3): a clamp is said, never silent (3 % in a biga: the field takes 2 % at most).
                            const clampedFrom=Math.abs(idy-n/conversion)>1e-9?Math.round(n*1000)/1000:undefined;
                            if(prefEntered===undefined&&recipe?.preferment&&recipe.preferment.prefFlour>0&&Math.abs(idy-recipe.preferment.prefYeastGramsIDY/recipe.preferment.prefFlour*100)<0.0005){setPrefYeastIssue(null);return;}
                            const pct=Math.round(idy*10000)/10000;
                            // A window the amount cannot take (or no time left before the mix) is not applied: said here, before any plan moves.
                            const availableH=planReady&&+startTime>Date.now()?(+startTime-Date.now())/3600000:Infinity;
                            const fit=prefYeastFit(pref,pct,availableH);
                            const shown=roundShownPct(idy*conversion);
                            // The nearest amount towards the calculated one that fits a window and gives a plan (round 9, S2: offered
                            // for every statement, as for the dough's own amount).
                            const calc=calcYeast?.pref?.type===pref?calcYeast?.pref.pct:undefined;
                            // Round 13 (item 6): a suggestion passes the same window check as an entry (prefYeastFit), so a cool-spot biga's
                            // "fits" and the amounts it accepts never contradict (1 % fresh accepted at 16 h, 1.5 % told "0.7 % fits").
                            // Round 15 (item 3): one window check per storage. A statement speaks of the storage the plan is on, and a
                            // suggestion is an amount that storage's window holds (planned there), never another storage's hours.
                            const storageNow=prefermentYeastStorages(pref,pref==='poolish'?poolishStorage:bigaStorage==='cool'?'room':bigaStorage,prefGoesInFridge,bigaCoolOffered(bigaStorage,kitchenTemp));
                            const stated=storageNow.includes(prefGoesInFridge)?prefGoesInFridge:storageNow[0];
                            const fitsShown=(v:number)=>{const p=Math.round(v/conversion*10000)/10000;const t=prefermentYeastTiming(pref,p,stated,prefYeastCtx(pref,stated));if(!t||t.min>availableH+1e-9)return false;const e=planReady?yeastEntryInput(conversion,p):null;return !e||!!entryPlanSearch(effectiveYeastOverride,e,undefined,{softNights:true});};
                            const nearest=()=>{
                              if(calc===undefined||Math.abs(calc*conversion-shown)<0.0005)return null;
                              const ref=Math.round(calc*conversion*1000)/1000;
                              const towards=nearestFittingShownPct(shown,ref,fitsShown);if(towards!==null)return towards;
                              // The calculated amount itself may be timed into the night as an entry (its window is narrower than the
                              // planner's): the typing steps between the typed amount and twice past the calculated one, nearest first.
                              // Round 17 (finding 3): every typing step from a quarter of the smaller to four times the larger, so a far
                              // amount (1.5 % or 0.1 % in a biga) still hears of the nearest one that fits.
                              const steps:number[]=[];const lo=Math.max(0.01,Math.min(shown,ref)/4),hi=Math.max(shown,ref)*4;
                              for(let v=lo;v<=hi&&steps.length<120;v*=1.06)steps.push(v<1?Math.round(v*100)/100:Math.round(v*10)/10);
                              return [...new Set(steps)].filter(v=>Math.abs(v-shown)>=0.0005&&v<=PREF_YEAST_MAX_PCT*conversion+1e-9).sort((a,b)=>Math.abs(Math.log(a/shown))-Math.abs(Math.log(b/shown))).find(fitsShown)??null;
                            };
                            if(!fit.fits){
                              // Round 17 (finding 3): the statement speaks of the storage the plan uses (`stated`), never of another
                              // storage's hours: its window's miss, else (its window holds the amount) the time it needs before the mix.
                              const miss=prefermentWindowMiss(pref,pct,stated,prefYeastCtx(pref,stated));
                              const there=miss?null:prefermentYeastTiming(pref,pct,stated,prefYeastCtx(pref,stated));
                              setPrefYeastIssue({type:pref,shownPct:shown,reason:miss?(miss.fast?'fast':'slow'):there?'time':'slow',hours:miss?miss.hours:there?there.min:fit.hours,inFridge:stated,suggestedShownPct:nearest(),clampedFrom});return;}
                            // Round 8 (bug 6): the planner's own search with this preferment window (and the final dough's
                            // amount), so a fresh or active-dry amount that would leave no plan is said here, not on the plan.
                            const entry=planReady?yeastEntryInput(conversion,pct):null;
                            // Night steps never refuse an amount (owner, 22 Nov 2026): the search that judges it lifts the night rule.
                            if(entry&&!entryPlanSearch(effectiveYeastOverride,entry,undefined,{softNights:true})&&entryPlanSearch(effectiveYeastOverride,yeastEntryInput(conversion,undefined)!,undefined,{softNights:true})){
                              // Busy times are named only when there are some and they are the reason (round 9, bug D).
                              const reason=entry.blocks.length&&entryPlanSearch(effectiveYeastOverride,entry,undefined,{ignoreBlocks:true,softNights:true})?'busy':'plan';
                              setPrefYeastIssue({type:pref,shownPct:shown,reason,hours:fit.timing.hours,inFridge:fit.timing.inFridge,suggestedShownPct:nearest(),clampedFrom});return;
                            }
                            if(clampedFrom!==undefined){setPrefYeastIssue({type:pref,shownPct:shown,reason:'max',hours:fit.timing.hours,inFridge:fit.timing.inFridge,suggestedShownPct:shown,clampedFrom});return;}
                            setPrefYeastIssue(null);setPrefYeastOverride({type:pref,pct});setPlanReplanPending(true);}}/>
                      </label>
                      {prefIssue&&(()=>{
                        const inPref=fr?(pref==='biga'?'dans la biga':'dans le poolish'):`in the ${prefName}`;
                        // Round 15 (item 3): one storage per statement, the one its hours were read for (the plan's), and its window only.
                        const place=prefIssue.inFridge?(fr?'au frigo':'in the fridge'):pref==='biga'?(fr?'dans un endroit frais':'in a cool spot'):(fr?'à température ambiante':'at room temperature');
                        const bounds=prefermentYeastBounds(pref,prefIssue.inFridge);
                        const takes=fr?`${pref==='biga'?'une biga':'un poolish'} y demande ${bounds.min} à ${bounds.max} h`:`a ${prefName} takes ${bounds.min}–${bounds.max} h there`;
                        const needs=Number.isFinite(prefIssue.hours)?(fr?`demande environ ${bakerHours(prefIssue.hours)} ${place}`:`needs about ${bakerHours(prefIssue.hours)} ${place}`):(fr?`demande plus de 72 h ${place}`:`needs more than 72 h ${place}`);
                        const past=fr?`est ${pref==='biga'?'passée':'passé'} après environ ${bakerHours(prefIssue.hours)} ${place}`:`is past its best after about ${bakerHours(prefIssue.hours)} ${place}`;
                        const clampLine=prefIssue.clampedFrom!==undefined?(fr?`${pctText(prefIssue.clampedFrom)} dépasse ce que ce champ accepte (${pctText(roundShownPct(PREF_YEAST_MAX_PCT*conversion))} au plus). `:`${pctText(prefIssue.clampedFrom)} is more than this field takes (${pctText(roundShownPct(PREF_YEAST_MAX_PCT*conversion))} at most). `):'';
                        // The calculated amount has its own button: never offered twice (round 11, item 8).
                        const calcShown=calcYeast?.pref?.type===pref?roundShownPct(calcYeast?.pref.pct*conversion):null;
                        const suggested=prefIssue.suggestedShownPct!==null&&sameGrams(prefIssue.suggestedShownPct,calcShown,recipe?.preferment?.prefFlour)?null:prefIssue.suggestedShownPct;
                        const fitsLine=suggested!==null?(fr?` ${pctText(suggested)} convient.`:` ${pctText(suggested)} fits.`):'';
                        const text=clampLine+(prefIssue.reason==='max'
                          ?(fr?`${pctText(prefIssue.shownPct)} ${inPref} convient.`:`${pctText(prefIssue.shownPct)} ${inPref} fits.`)
                          :prefIssue.reason==='fast'||prefIssue.reason==='slow'
                          ?(fr?`${pctText(prefIssue.shownPct)} ${inPref} ${prefIssue.reason==='fast'?past:needs} ; ${takes}.${fitsLine}`:`${pctText(prefIssue.shownPct)} ${inPref} ${prefIssue.reason==='fast'?past:needs}; ${takes}.${fitsLine}`)
                          :prefIssue.reason==='busy'
                          ?(fr?`Avec ${pctText(prefIssue.shownPct)} ${inPref}, chaque planning empiète sur vos moments occupés.${fitsLine}`:`With ${pctText(prefIssue.shownPct)} ${inPref}, every plan runs into your busy times.${fitsLine}`)
                          :prefIssue.reason==='plan'
                          ?(fr?`Avec ${pctText(prefIssue.shownPct)} ${inPref}, aucun planning ne tient avant votre cuisson.${fitsLine}`:`With ${pctText(prefIssue.shownPct)} ${inPref}, no plan fits before your bake.${fitsLine}`)
                          :(fr?`${pctText(prefIssue.shownPct)} ${inPref} demande environ ${bakerHours(prefIssue.hours)} ${place} avant le pétrissage ; votre pétrissage est dans ${bakerHours((+startTime-Date.now())/3600000)}.${fitsLine}`:`${pctText(prefIssue.shownPct)} ${inPref} needs about ${bakerHours(prefIssue.hours)} ${place} before the mix; your mix is in ${bakerHours((+startTime-Date.now())/3600000)}.${fitsLine}`));
                        return <div id="bh-pref-yeast-note" data-pref-yeast-issue role="status" className="bh-plan-notice" style={{margin:'0 0 10px'}}>
                          <p style={{margin:'0 0 10px',fontSize:15,lineHeight:1.5}}>{text}</p>
                          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                            {suggested!==null&&<button type="button" data-use-suggested-pref-yeast style={secondaryButton} onClick={()=>{setPrefYeastIssue(null);setPrefYeastOverride({type:pref,pct:Math.round(suggested/conversion*10000)/10000});setPlanReplanPending(true);}}>{fr?`Utiliser ${pctText(suggested)}`:`Use ${pctText(suggested)}`}</button>}
                            <button type="button" data-use-calculated-pref-yeast style={secondaryButton} onClick={clearPrefYeast}>{fr?'Utiliser la quantité calculée':'Use the calculated amount'}</button>
                          </div>
                        </div>;
                      })()}
                      {!prefIssue&&prefYeastClearedLine(pref)}
                    </div>;
                    const shownPct = yeastPctOverride!==undefined ? yeastPctOverride*conversion : planReady ? recipe?.yeast?.convertedPct : undefined;
                    const yeastName = (localName(YEAST_TYPES[yeastType]) ?? yeastType).toLowerCase();
                    const entryIssue = yeastEntryIssue && eatTime && yeastEntryIssue.bakeAt===+eatTime ? yeastEntryIssue : null;
                    // Round 7 (owner): the box is empty until the baker types; it reads "Auto", or the
                    // plan's amount greyed ("0.18 · auto"), so the calculation is visibly the app's.
                    // Round 11 (item 8): the amount the recipe will use: while the plan waits to be re-derived (an amount just cleared),
                    // the calculated amount of the plan before it, not the one the waiting plan's times give.
                    const autoPct = yeastPctOverride===undefined && shownPct!==undefined ? (planReplanPending && calcYeast?.idyPct!==undefined ? calcYeast?.idyPct*conversion : shownPct) : undefined;
                    const clearYeast=()=>{setYeastEntryIssue(null);if(yeastPctOverride!==undefined){setYeastPctOverride(undefined);setPlanReplanPending(true);}};
                    // Round 15 (O2): the amount alone; its plan is derived from the current inputs (no knead remembered with it).
                    const applyYeast=(idy:number)=>{setYeastEntryIssue(null);setYeastPctOverride(idy);setPlanReplanPending(true);};
                    // One helper line, none while a statement shows (round 8, S3).
                    // Round 13 (item 7): "less yeast, longer rise" only when less than the calculated amount was entered.
                    const lessDough = yeastPctOverride!==undefined&&calcYeast?.idyPct!==undefined&&yeastPctOverride<calcYeast?.idyPct-1e-9;
                    // Round 17 (finding 6): "a longer biga" only when the plan's preferment is longer than the calculated plan's
                    // (a biga held at its storage's shortest window stays 24 h whatever the amount).
                    const lessPref = prefEntered!==undefined&&calcYeast?.pref?.type===pref&&prefEntered<calcYeast?.pref.pct-1e-9&&(!autoPlan||prefOffsetH>autoPlan.times.prefHours+0.01);
                    // Round 17 (finding 6): no "use the calculated amount" for an amount that weighs what the calculated one weighs.
                    // (The amount as typed and shown, to the thousandth: an amount the timing reads differently keeps its way back.)
                    const doughIsCalc = yeastPctOverride!==undefined&&calcYeast?.idyPct!==undefined&&Math.round(yeastPctOverride*conversion*1000)===Math.round(calcYeast.idyPct*conversion*1000);
                    const prefIsCalc = prefEntered!==undefined&&calcYeast?.pref?.type===pref&&Math.round(prefEntered*conversion*1000)===Math.round(calcYeast.pref.pct*conversion*1000);
                    const helper = entryIssue||prefIssue||entryNight||(pref&&prefYeastClearedLine(pref)) ? null : pref
                      ? (prefEntered!==undefined&&yeastPctOverride!==undefined
                        ? (lessDough&&lessPref?(fr?'Chacun suit sa quantité : moins de levure, pousse plus longue.':'Each follows its amount: less yeast, a longer rise.'):(fr?'Chacun suit sa quantité.':'Each follows its amount.'))
                        : prefEntered!==undefined
                        ? (lessPref?(fr?`${pref==='biga'?'La biga suit':'Le poolish suit'} sa quantité : moins de levure, ${pref==='biga'?'biga':'poolish'} plus long${pref==='biga'?'ue':''}.`:`The ${prefName} follows its amount: less yeast, a longer ${prefName}.`):(fr?`${pref==='biga'?'La biga suit':'Le poolish suit'} sa quantité.`:`The ${prefName} follows its amount.`))
                        : yeastPctOverride!==undefined
                        ? (lessDough?(fr?'La pâte finale suit sa quantité : moins de levure, pousse plus longue.':'The final dough follows its amount: less yeast, longer rise.'):(fr?'La pâte finale suit sa quantité.':'The final dough follows its amount.'))
                        : (fr?`Nous les calculons pour votre planning. Saisissez les vôtres, les horaires suivent ; ${pref==='biga'?'celle de la biga':'celle du poolish'} est en % de sa propre farine.`:`We calculate both for your plan. Enter your own and the timing follows; the ${prefName} amount is a % of its own flour.`))
                      : yeastPctOverride!==undefined
                      ? (lessDough?(fr?'Les horaires suivent cette quantité : moins de levure, pousse plus longue.':'Your timing follows this amount: less yeast, longer rise.'):(fr?'Les horaires suivent cette quantité.':'Your timing follows this amount.'))
                      : (fr?'Nous la calculons pour votre planning. Saisissez la vôtre, les horaires suivent.':'We calculate it for your plan. Enter your own and the timing follows.');
                    return <div style={{marginBottom:18}}>{prefRow}<div data-yeast-override>
                      <label data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16}}><span data-finetune-label style={{minWidth:0}}>{pref?(fr?'Dans la pâte finale':'In the final dough'):yeastRowLabel(yeastType,fr)}</span>
                        <UnitInput decimal suffix="%" width={120} label={pref?(fr?`Levure de la pâte finale, % de farine, ${yeastName}`:`Final dough yeast, % of flour, ${yeastName}`):fr?`Levure, % de farine, ${yeastName}`:`Yeast, % of flour, ${yeastName}`} key={`yeast:${yeastPctOverride ?? 'auto'}:${shownPct ?? ''}:${entryIssue?`issue${entryIssue.shownPct}`:''}:${locale}`} defaultValue={entryIssue?formatDecimal(entryIssue.shownPct,fr):yeastPctOverride!==undefined&&shownPct!==undefined?formatDecimal(Math.round(shownPct*1000)/1000,fr):''} placeholder={autoPctPlaceholder(autoPct,fr)}
                          aria-describedby={entryIssue?'bh-yeast-entry-note':undefined}
                          onBlur={e=>{
                            // An empty box is the calculated amount again: the statement goes, the recipe follows (round 8, bug 1).
                            if(e.target.value.trim()===''){clearYeast();return;}
                            const n=parseDecimal(e.target.value);if(!Number.isFinite(n))return;
                            const idy=Math.min(2,Math.max(0.02,n/conversion));
                            // Round 15 (item 3): a clamp is said, never silent.
                            const clampedFrom=Math.abs(idy-n/conversion)>1e-9?Math.round(n*1000)/1000:undefined;
                            if(clampedFrom===undefined&&recipe?.yeast&&yeastPctOverride===undefined&&Math.abs(idy-recipe.yeast.pct)<0.0005){setYeastEntryIssue(null);return;}
                            // An amount that gives no plan is not applied: say so here, before any plan moves. The check runs the
                            // plan's own timing and search (round 8, M2/bugs 3, 6, 7), for the final dough of a poolish or biga too.
                            const entry=eatTime&&+eatTime>Date.now()?yeastEntryInput(conversion):null;
                            const check=entry?checkYeastEntry(Math.round(idy*10000)/10000,entry):null;
                            if(check&&!check.fits){setYeastEntryIssue({shownPct:Math.round(idy*conversion*1000)/1000,bakeAt:+eatTime!,check,clampedFrom});return;}
                            if(check&&clampedFrom!==undefined){const shownIdy=Math.round(idy*conversion*1000)/1000;setYeastEntryIssue({shownPct:shownIdy,bakeAt:+eatTime!,check:{...check,fits:false,reason:'max',suggestedShownPct:shownIdy},clampedFrom});return;}
                            applyYeast(Math.round(idy*10000)/10000);}}/>
                      </label>
                      {entryIssue&&(()=>{
                        const {check}=entryIssue;
                        // Beside "Use the calculated amount", the calculated amount is not offered again (round 11, item 8).
                        const calcShown=calcYeast?.idyPct!==undefined?Math.round(calcYeast?.idyPct*conversion*1000)/1000:null;
                        const suggested=check.reason!=='time'&&check.suggestedShownPct!==null&&sameGrams(check.suggestedShownPct,calcShown,recipe?.flour)?null:check.suggestedShownPct;
                        const lim=entryIssue.clampedFrom!==undefined?Math.round((entryIssue.clampedFrom>entryIssue.shownPct?2:0.02)*conversion*1000)/1000:null;
                        const clampLine=lim!==null&&entryIssue.clampedFrom!==undefined?(fr?`${pctText(entryIssue.clampedFrom)} ${entryIssue.clampedFrom>entryIssue.shownPct?'dépasse':'est sous'} ce que ce champ accepte (${pctText(lim)} au ${entryIssue.clampedFrom>entryIssue.shownPct?'plus':'moins'}). `:`${pctText(entryIssue.clampedFrom)} is ${entryIssue.clampedFrom>entryIssue.shownPct?'more':'less'} than this field takes (${pctText(lim)} at ${entryIssue.clampedFrom>entryIssue.shownPct?'most':'least'}). `):'';
                        const text=clampLine+(check.reason==='max'?(fr?`${pctText(entryIssue.shownPct)} convient.`:`${pctText(entryIssue.shownPct)} fits.`):'')+(check.reason==='max'?'':check.reason==='time'
                          ?(fr?`${pctText(entryIssue.shownPct)} ${check.neededH===null?'demande plus de 96 h':`demande environ ${bakerHours(check.neededH)}`} ; votre cuisson est dans ${bakerHours(check.availableH)}.${suggested!==null?` ${pctText(suggested)} convient.`:''}`
                            :`${pctText(entryIssue.shownPct)} ${check.neededH===null?'needs more than 96 h':`needs about ${bakerHours(check.neededH)}`}; your bake is in ${bakerHours(check.availableH)}.${suggested!==null?` ${pctText(suggested)} fits.`:''}`)
                          // Round 9 (bug D): busy times are named only when the baker has some and they are the reason.
                          :`${check.reason==='busy'
                            ?(fr?`Avec ${pctText(entryIssue.shownPct)}, chaque planning empiète sur vos moments occupés.`:`With ${pctText(entryIssue.shownPct)}, every plan runs into your busy times.`)
                            :check.reason==='fast'
                            ?(fr?`Avec ${pctText(entryIssue.shownPct)}, la pâte lève trop vite pour ses étapes.`:`With ${pctText(entryIssue.shownPct)}, the dough rises too fast for its steps.`)
                            :(fr?`Avec ${pctText(entryIssue.shownPct)}, aucun planning ne tient avant votre cuisson.`:`With ${pctText(entryIssue.shownPct)}, no plan fits before your bake.`)}${suggested!==null?(fr?` ${pctText(suggested)} convient.`:` ${pctText(suggested)} fits.`):''}`);
                        return <div id="bh-yeast-entry-note" data-yeast-entry-issue data-reason={check.reason ?? undefined} role="status" className="bh-plan-notice" style={{margin:'8px 0 0'}}>
                          <p style={{margin:'0 0 10px',fontSize:15,lineHeight:1.5}}>{text}</p>
                          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                            {suggested!==null&&<button type="button" data-use-minimum-yeast style={secondaryButton} onClick={()=>applyYeast(Math.round(suggested/conversion*10000)/10000)}>{fr?`Utiliser ${pctText(suggested)}`:`Use ${pctText(suggested)}`}</button>}
                            {/* The amount's own problem gets the amount's answers; a later bake only when time is short (bug 6). */}
                            {check.reason==='time'
                              ?<button type="button" data-yeast-change-bake style={secondaryButton} onClick={()=>{setYeastEntryIssue(null);openSetupStep(9,true);}}>{fr?'Changer l’heure de cuisson':'Change bake time'}</button>
                              :<button type="button" data-ft-use-calculated-yeast style={secondaryButton} onClick={clearYeast}>{fr?'Utiliser la quantité calculée':'Use the calculated amount'}</button>}
                          </div>
                        </div>;
                      })()}
                      {/* Round 15 (O2): the same Use/Keep line as the editor, the Recipe and Preparation; kept, it still names the steps. */}
                      {!entryIssue&&!prefIssue&&entryNightView('finetune')}
                      {helper&&<p data-yeast-helper style={{margin:'6px 0 0',fontSize:14,color:'var(--smoke)',lineHeight:1.45}}>{helper}</p>}
                      {/* One "calculated amount" per field (round 8, S3): none beside a statement that already offers it. */}
                      {pref&&prefEntered!==undefined&&!prefIssue&&!prefIsCalc&&<button type="button" data-pref-yeast-reset onClick={clearPrefYeast} style={{...secondaryButton,marginTop:6,marginRight:8}}>{fr?(pref==='biga'?'Biga : quantité calculée':'Poolish : quantité calculée'):`${pref==='biga'?'Biga':'Poolish'}: use the calculated amount`}</button>}
                      {yeastPctOverride!==undefined&&!entryIssue&&!doughIsCalc&&<button type="button" data-ft-use-calculated-yeast onClick={clearYeast} style={{...secondaryButton,marginTop:6}}>{pref?(fr?'Pâte finale : quantité calculée':'Final dough: use the calculated amount'):fr?'Revenir à la quantité calculée':'Use the calculated amount'}</button>}
                    </div></div>;
                  })()}
                  <h3 data-finetune-group="process" style={{margin:'8px 0 12px',fontSize:13,fontWeight:650,letterSpacing:'.06em',textTransform:'uppercase' as const,color:'var(--smoke)'}}>{fr?'Pétrissage et pâte':'Mixing and dough'}</h3>
                  {fields.filter(field=>field.group==='process').map(renderField)}
                  {/* Fridge & water (a step of its own until 14 Nov 2026): the fridge as a number like the
                      fields above, the water source in one line, the ice method only with a spiral mixer. */}
                  <h3 data-finetune-group="kitchen" style={{margin:'8px 0 12px',fontSize:13,fontWeight:650,letterSpacing:'.06em',textTransform:'uppercase' as const,color:'var(--smoke)'}}>{fr?'Frigo et eau':'Fridge & water'}</h3>
                  {!kitchenAnswered && <KitchenSlider value={kitchenTemp} units={units} fr={fr} onChange={c=>{setKitchenTemp(c);confirmSetting('climate',c);setPlanReplanPending(true);}}/>}
                  {/* "Inside the fridge" says where it is read (was a helper line, 20 Nov 2026 round 7). */}
                  <label data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16,marginBottom:14}}><span data-finetune-label style={{minWidth:0}}>{fr?'Dans le frigo':'Inside the fridge'}</span>
                    <UnitInput data-fridge-temp suffix={tempUnit(units)} label={fr?`Température dans le frigo, près de la pâte, ${tempUnit(units)}`:`Temperature inside the fridge, near the dough, ${tempUnit(units)}`} key={`fridge:${fridgeTemp}:${units}`} decimal defaultValue={formatDecimal(Math.round(cToDisplay(fridgeTemp,units)*10)/10,fr)} onBlur={e=>{const n=parseDecimal(e.target.value);if(e.target.value===''||!Number.isFinite(n))return;const c=Math.min(15,Math.max(1,inputTempToC(n,units)));if(Math.abs(c-fridgeTemp)>0.01){setFridgeTemp(c);setPlanReplanPending(true);}}}/>
                  </label>
                  <label style={{display:'block',fontSize:16,margin:'12px 0 6px'}}>{locale==='fr'?'Origine de l’eau':'Water source'}
                    <select value={waterSource==='tap'?'measured':waterSource} onChange={e=>{setWaterSource(e.target.value as 'room'|'fridge'|'measured');setMeasuredWaterTemp(undefined);}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                      <option value="room">{locale==='fr'?'Eau à température ambiante':'Room-temperature water'}</option>
                      <option value="fridge">{locale==='fr'?'Eau du réfrigérateur':'Water from the fridge'}</option>
                      <option value="measured">{locale==='fr'?'Température mesurée':'Measured temperature'}</option>
                    </select>
                  </label>
                  {(waterSource==='measured'||waterSource==='tap')&&<label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Température de l’eau':'Water temperature'} ({tempUnit(units)})
                    <input type="number" min={cToDisplay(0,units)} max={cToDisplay(60,units)} step="0.1" value={measuredWaterTemp===undefined?'':cToDisplay(measuredWaterTemp,units)} onChange={e=>setMeasuredWaterTemp(e.target.value===''?undefined:inputTempToC(Number(e.target.value),units))} style={{display:'block',width:'100%',fontSize:16,minHeight:44,padding:12,border:'1px solid var(--border)',borderRadius:9,marginTop:6}} />
                  </label>}
                  {mixerType==='spiral' && <label style={{display:'block',fontSize:16,margin:'12px 0'}}>{locale==='fr'?'Si un refroidissement est nécessaire':'When cooling is needed'}
                    <select value={waterMethod} onChange={e=>{setWaterMethod(e.target.value as 'direct'|'premelt');setSpiralIceConfirmed(false);}} style={{display:'block',width:'100%',fontSize:16,padding:12,minHeight:44,marginTop:6,border:'1px solid var(--border)',borderRadius:9,background:'white',color:'var(--char)'}}>
                      <option value="direct">{locale==='fr'?'Glace pendant le pétrissage':'Ice during mixing'}</option>
                      <option value="premelt">{locale==='fr'?'Faire fondre la glace dans l’eau avant':'Melt ice in the water first'}</option>
                    </select>
                    <small style={{display:'block',fontSize:14,lineHeight:1.5,marginTop:8}}>{locale==='fr'?'Vérifiez que votre pétrin accepte la glace.':'Check that your mixer allows ice.'}</small>
                  </label>}
                  <details style={{margin:'12px 0'}}><summary className="bh-chevron" style={{minHeight:44,cursor:'pointer'}}>{fr?'Températures mesurées · facultatif':'Measured temperatures · optional'}</summary><p id="measured-temp-hint" style={{margin:'4px 0 0',fontSize:14,lineHeight:1.45,color:'var(--smoke)'}}>{fr?'Laissez vide pour une estimation automatique.':'Leave blank for an automatic estimate.'}</p>
                    {[{label:fr?'Farine':'Flour',value:measuredFlourTemp,set:setMeasuredFlourTemp},...((prefermentType!=='none'||yeastType==='sourdough')?[{label:yeastType==='sourdough'||prefermentType==='levain'?(fr?'Levain':'Starter'):prefermentType==='biga'?'Biga':'Poolish',value:measuredPrefermentTemp,set:setMeasuredPrefermentTemp}]:[])].map(field=><label key={field.label} data-finetune-row style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontSize:16,margin:'12px 0'}}><span data-finetune-label style={{minWidth:0}}>{field.label}</span><UnitInput suffix="°C" label={fr?`${field.label}, température mesurée, °C`:`${field.label}, measured temperature, °C`} value={field.value??''} min={-5} max={45} step={0.5} placeholder="Auto" aria-describedby="measured-temp-hint" onChange={e=>field.set(e.target.value===''?undefined:Number(e.target.value))}/></label>)}
                  </details>
                  {/* Only a value that differs from its recommendation calls for a reset (a tap through a field changes nothing). */}
                  {(fields.some(field=>Math.abs(field.value-field.rec)>1e-6)||yeastPctOverride!=null||prefYeastOverride!=null||starterPctOverride!=null)&&<button type="button" data-reset-finetune style={{minHeight:44,padding:'10px 12px',border:'1px solid var(--border)',borderRadius:9}} onClick={()=>{setManualHydration(undefined);if(yeastPctOverride!==undefined){setYeastPctOverride(undefined);setPlanReplanPending(true);}if(prefYeastOverride!==undefined){setPrefYeastOverride(undefined);setPrefYeastIssue(null);setPlanReplanPending(true);}if(starterPctOverride!==undefined){setStarterPctOverride(undefined);setPlanReplanPending(true);}setManualSalt(undefined);setManualOil(undefined);setManualSugar(undefined);setTargetDoughTemp(undefined);setWastePct(undefined);}}>{fr?'Rétablir les valeurs conseillées':'Reset recommended values'}</button>}
                </>;
              })()}
            </StepPage>

            {/* Precision section removed — merged into the dough step below */}

            {/* Generate now lives in the last page's nav bar (StepPage). */}
            </div>{/* end swipe container */}

            </div>{/* end setup tab */}

            {/* ── Bake plan tab content ── */}
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>

              {/* Stale banner */}
              {protocolStale && recipeGenerated && (
                <div style={{
                  background: '#F0EBE0',
                  borderRadius: '16px',
                  padding: '12px 16px',
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
                    onClick={()=>handleGenerate()}
                    style={{
                      background: '#6B4423',
                      color: 'white',
                      fontSize: '12px',
                      padding: '12px 16px', minHeight: '44px',
                      borderRadius: '12px',
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
                  <button type="button" style={{...NEXT_CTA,marginTop:16}} onClick={()=>openDestination('organisation')}>{fr?'Terminer mes choix':'Finish my choices'}</button>
                </div>
              )}

              {/* Recipe + Timeline */}
              {recipeGenerated && (
                <div style={{ marginTop: '16px' }}>
                  {(
                    <>
                      {!advancedRecipe ? (
                        <div style={{ background: 'var(--warm)', border: '1.5px solid var(--gold)', borderRadius: '16px', padding: '20px', textAlign: 'center', color: 'var(--terra)', fontSize: '14px' }}>
                          {t('results.computeError')}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                          <RecipeOutput
                            mixerConfirmed={confirmed('mixer',mixerType)}
                            starterEvents={guideStarterEvents} sharedStarterFeed={sharedFeedNote} mixingTime={startTime}
                            
                            styleKey={styleKey ?? undefined}
                            waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixerCapacityG={customMixerCapacityG} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches}
                            ovenType={ovenType}
                            onEditSetup={openSetupReview}
                            
                            onShare={shareCurrentSession}
                            result={advancedDisplayRecipe ?? advancedRecipe}
                            numItems={numItems}
                            itemWeight={itemWeight}
                            styleName={styleDisplayName(styleKey)}
                            mixerType={mixerType!}
                            kitchenTemp={kitchenTemp}
                            fridgeTemp={fridgeTemp}
                            fermEquivHours={schedule ? schedule.totalRTHours + schedule.totalColdHours * 0.18 : 0}
                            totalColdHours={schedule ? schedule.totalColdHours : 0}
                            mode={tab}
                            bakeType={bakeType ?? 'pizza'}
                            prefermentType={prefermentType}
                            priorityOverride={priorityOverride}
                            onPriorityOverride={v => setPriorityOverride(v)}
                            flourBlend={flourBlend}
                            units={units}
                            wastePct={totalFlourTarget===undefined?wasteAllowance:0}
                            feedTime={feedTime}
                            feed2Time={feed2Time}
                            fridgeOutTime={fridgeOutTime}
                            starterPeakTime={starterPeakTime}
                            planningMode={planningMode}
                            usingPeak2={usingPeak2}
                            feedRatio={nextFeedRatio}
                            starterLocation={starterLocation}
                          />
                          {executionClash && <p data-plan-clash role="status" style={{margin:'0 0 8px',fontSize:15,color:'var(--char)'}}>{fr?'La suite du plan demande de nouveaux horaires.':'The rest of the plan needs new times.'}</p>}
                          {entryNightView('recipe')}
                          {eatTime && (schedule || planEdit) && !isUnleavened && <RecipePlanCard fr={fr} locale={locale} startAt={firstRecipeAction} startLabel={firstRecipeActionLabel} bakeAt={eatTime} bakeEnd={recipeBakeEnd} steps={recipePlanSteps} startKey={recipeStartKey} editable={planEditable} editing={preheatEdit?'preheat':planEdit==='pref'?'preferment':planEdit} onEditTime={key=>{if(key==='preheat'){setPlanEdit(null);setPreheatEdit(v=>!v);return;}setPreheatEdit(false);setPlanEdit(current=>{const next=key==='preferment'?'pref':'mix';return current===next?null:next;});}} editor={preheatEdit?preheatEditor:planEditor} notice={planNote?{key:planNote.key,node:planInlineNote}:null} notes={planRowNotes} beforeRow={planStrip} startIsKey={planStartIsKey} moreLabel={planMoreLabel} onMore={editRecipeTiming}/>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* How did it go? card */}
              {eatTime && new Date() > eatTime && (
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '16px', background: 'var(--warm)', padding: '16px 16px', marginTop: '16px', marginBottom: '4px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>{locale === 'fr' ? 'Comment s’est passée la fournée ?' : 'How did it go?'}</p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label htmlFor="bake-photo-input" style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1.5px dashed var(--border)', background: bakePhotoUrl ? 'none' : 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                      {bakePhotoUrl
                        ? <img src={bakePhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px' }}></span>}
                      <input id="bake-photo-input" type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { compressImage, uploadPhoto } = await import('../lib/photoUpload');
                          const blob = await compressImage(file);
                          setBakePhotoUrl(URL.createObjectURL(blob));
                          if (user) {
                            let evId = bakeEventId;
                            if (!evId) {
                              const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                              const payload = buildSessionPayload();
                              evId = await upsertBakeEvent({ session: payload as SessionData });
                              if (evId) setBakeEventId(evId);
                            }
                            if (evId) await uploadPhoto(file, user.id, evId, 0);
                          }
                        }}
                      />
                    </label>
                    {!bakedDone ? (
                      <button
                        onClick={async () => {
                          setBakedDone(true);
                          if (user && bakeEventId) {
                            const { markBaked } = await import('../lib/supabase/saveBakeEvent');
                            await markBaked(bakeEventId);
                          }
                        }}
                        style={{ flex: 1, background: 'var(--sage)', border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 0', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                      >
                        ✓ {locale === 'fr' ? 'Marquer comme cuite' : 'Mark as baked'}
                      </button>
                    ) : (
                      <p style={{ flex: 1, fontSize: '13px', color: 'var(--sage)', fontWeight: 600, margin: 0 }}>✓ {locale === 'fr' ? 'Cuisson terminée !' : 'Baked!'}</p>
                    )}
                  </div>
                </div>
              )}

              {!bakeTimeIsPast && (
                <div style={{ marginTop: '12px' }}>

                  {activeTab==='plan'&&<BottomActions className="bh-recipe-next">
                    <button type="button" className="bh-back-action" onClick={openSetupReview}><span style={{whiteSpace:'nowrap'}}><span aria-hidden="true">‹ </span>{fr?'Mes choix':'My choices'}</span></button>
                    {fillingsStep?<button type="button" data-toppings-step style={NEXT_CTA} onClick={openToppingsStep}>{fillingsStepLabel} →</button>:<button type="button" style={NEXT_CTA} onClick={()=>openDestination('shopping')}><DestinationIcon destination="shopping"/> {fr?'Liste de courses':'Shopping list'} →</button>}

                  </BottomActions>}
                </div>
              )}

            </div>{/* end plan tab */}

            {/* ── Bake guide tab content ── */}
            <div style={{ display: (destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough') ? 'block' : 'none' }}>
              {!recipeGenerated ? null : schedule && advancedRecipe && mixerType && (<>
                {destination==='protocol'&&eatTime&&prepOverview&&<PreparationTimingSummary calendarOutdated={calendarOutdated} clash={executionClash||preparationBusy} nightLine={entryNightView('preparation')} fr={fr} locale={locale} startAt={firstRecipeAction} startLabel={firstRecipeActionLabel} bakeAt={eatTime} helperAt={coveredFridgeRemovalAt} onAdjustTiming={editRecipeTiming} onAddToCalendar={addPlanToCalendar}/>}
                <BakeGuide
                  pizzaDiameterCm={bakeType==='pizza'?pizzaDiameter:undefined}
                  onStarterFed={event=>tickStarterFeed(event,true)} onStarterUnfed={event=>tickStarterFeed(event,false)} starterFedTimes={starterFedTimes}
                  preparationMade={!!execution} mixingMade={!!mixExecution||execution?.method==='none'} onMixComplete={!isUnleavened?recordGuideMix:undefined} onPreparationComplete={!isUnleavened&&yeastType!=='sourdough'&&prefermentType!=='none'?done=>{if(done)markPreparationMade(plannedPreparationAt,true);else if(!mixExecution){setExecution(undefined);saveSession(buildSessionPayload({execution:undefined}));}}:undefined}
                  onBackToRecipe={()=>openDestination('recipe')}
                  backSection={destination==='service'?{label:fr?'Retour à la préparation':'Back to Preparation',onClick:()=>{setProtocolView('dough');openDestination('protocol');}}:{label:fr?'Retour aux courses':'Back to Shopping list',onClick:()=>openDestination('shopping')}}
                  onOverviewChange={setPrepOverview}
                  onRepeat={repeatCurrentRecipe} resultNotes={resultNotes} onResultNotesChange={setResultNotes} onSave={saveCurrentSession} onShare={shareCurrentSession} sessionSaved={sessionSaved && !!user} onBakedChange={setBakedDone} completionEnabled={!hasFillings} sharedOven={sharedOven}
                  progressScope={journalId} mixDoneAt={mixExecution?.actualAt??(execution?.method==='none'?execution.actualAt:null)} prefDoneAt={execution&&execution.method!=='none'?execution.actualAt:null} mixDoneStated={!!(mixExecution?.stated??(execution?.method==='none'&&execution.stated))} prefDoneStated={!!(execution&&execution.method!=='none'&&execution.stated)} bakeEnd={recipeBakeEnd}
                  onMixTimeChange={at=>{if(mixExecution||execution?.method!=='none')markMixMade(at);else markPreparationMade(at);}} onPrefTimeChange={markPreparationMade} previousNote={previousNote}
                  progressTarget={(destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough')?guideProgressTarget:null} onClockStep={setGuideClock}
                  phase={destination==='service'?'cooking':'preparation'}
                  active={destination==='protocol'&&protocolView==='dough'||destination==='service'&&serviceView==='dough'}
                  onNavigateToCooking={()=>{setServiceView('dough');openDestination('service');}}
                  onPrepareFillings={hasFillings?()=>{setProtocolView('fillings');openDestination('protocol');}:undefined}
                  onNavigateToPreparation={()=>openDestination('protocol')}
                  starterEvents={guideStarterEvents} sharedStarterFeed={sharedFeedNote}
                  ovenConstruction={ovenConstruction}
                  waterSource={waterSource} onWaterSourceChange={value=>{setWaterSource(value);setMeasuredWaterTemp(undefined);}} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={setMeasuredWaterTemp} waterMethod={waterMethod} onWaterMethodChange={setWaterMethod} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={setSpiralIceConfirmed} mixerCapacityG={customMixerCapacityG} mixingBatches={mixingBatches} onMixingBatchesChange={setMixingBatches} fridgeTemp={fridgeTemp}
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
                  feedTime={planningMode === 'last_fed' ? lastFedTime : null}
                  feed2Time={feed2Time}
                  fridgeOutTime={fridgeOutTime}
                  starterState={starterState}
                  starterMature={starterMature}
                  starterHasRye={starterHasRye}
                  usingPeak2={usingPeak2}
                  planningMode={planningMode}
                  feedRatio={nextFeedRatio}
                  starterLocation={starterLocation}
                  units={units}
                  locale={locale}
                  onNavigateToFillings={hasBreadFillings?()=>{setServiceView('fillings');openDestination('service');}:undefined}
                  fillingsActionLabel={sandwichFamilyForStyle(styleKey??'')==='tartine'?(fr?'Assembler mes tartines':'Assemble my toasts'):(fr?'Assembler mes sandwichs':'Assemble my sandwiches')}
                  pizzaActionLabel={hasFillings?(fr?'Commencer la cuisson des pizzas':'Start cooking the pizzas'):(fr?'Choisir mes pizzas':'Choose my pizzas')}
                  pizzasChosen={hasFillings}
                  onNavigateToPizzaParty={pizzaPartyEnabled ? ()=>{if(hasFillings){setServiceView('fillings');openDestination('service');}else openLateFillings();} : undefined}
                  recipe={advancedRecipe ?? null}
                  simpleMode={false}
                  addSeeds={addSeeds && styleKey === 'pain_levain'}
                />
                </>

              )}
            </div>{/* end guide tab */}

            {/* ── Pizza Party tab content ── */}
            {pizzaPartyEnabled && (
              <div style={{ display: companionVisible ? 'block' : 'none' }}>
                <PizzaParty
                  locale={locale}
                  countKnown={qtyChosen||!!recipeGenerated}
                  bakeTime={eatTime ?? new Date()}
                  numItems={numItems}
                  styleKey={styleKey ?? undefined}
                  t={t}
                  activeTab={companionPhase}
                  onTabChange={openCompanionPhase}
                  onBackToRecipe={fillingsStep?openToppingsStep:()=>openDestination('recipe')}
                  shoppingBackLabel={fillingsStep?(fr?'Retour aux pizzas':'Back to Pizzas'):undefined}
                  onSelectionBack={backFromFillings} onSelectionDone={finishFillings}
                  selectionDoneLabel={fillingsDoneLabel} skipLabel={fillingsSkipLabel} selectionForward={fillingsForward} selectionBackLabel={fillingsReturn?.forward?(fr?'Retour à la recette':'Back to Recipe'):undefined}
                  directSelectionReturn={!!fillingsReturn}
                  onPrepProgress={setFillingsProgress} prepContinueLabel={prepContinueLabel}
                  active={companionVisible}
                  doughConfigured={recipeGenerated}
                  onHasSelection={setPizzasConfirmed}
                  bakeEventId={bakeEventId}
                  initialQtys={pizzaPartyQtys}
                  onQtysSnapshot={setPizzaPartyQtys}
                  getQtysRef={pizzaPartyGetQtysRef}
                  onGoToMyDough={openQuantityEdit}
                  ovenType={ovenType ?? undefined}
                  recipeIngredients={doughShoppingItems}
                  onRepeat={repeatCurrentRecipe} resultNotes={resultNotes} onResultNotesChange={setResultNotes} onSave={saveCurrentSession}
                  onEnsureBakeEvent={async () => {
                    if (bakeEventId) return bakeEventId;
                    if (!user) return null;
                    const { upsertBakeEvent } = await import('../lib/supabase/saveBakeEvent');
                    const payload = buildSessionPayload();
                    const id = await upsertBakeEvent({ session: payload as SessionData });
                    if (id) setBakeEventId(id);
                    return id;
                  }}
                  sessionSaved={sessionSaved && !!user}
                  onBakedQtysChange={setBakedPartyQtys}
                  bakedQtys={bakedPartyQtys}
                  restoreToken={partyRestoreToken}
                  onShare={shareCurrentSession}
                />
              </div>
            )}

          </div>
        )}

      {bakeType==='bread' && (sandwichEnabled||destination==='shopping') && <div style={{display:companionVisible?'block':'none',paddingBottom:24}}>
        <SandwichParty onRepeat={repeatCurrentRecipe} resultNotes={resultNotes} onResultNotesChange={setResultNotes} onSave={saveCurrentSession} onShare={shareCurrentSession} sessionSaved={sessionSaved && !!user} isFr={locale === 'fr'} styleKey={styleKey} snapshot={sandwichParty}
          onBackToRecipe={fillingsStep&&sandwichEnabled?openToppingsStep:()=>openDestination('recipe')}
          backLabel={fillingsStep&&sandwichEnabled?(fr?'Retour aux garnitures':'Back to Fillings'):undefined}
          onChange={setSandwichParty} phase={companionPhase==='bake'?'serve':companionPhase} onPhaseChange={openCompanionPhase} onSelectionBack={backFromFillings} onSelectionDone={finishFillings} selectionDoneLabel={fillingsDoneLabel} skipLabel={fillingsSkipLabel} selectionForward={fillingsForward} selectionBackLabel={fillingsReturn?.forward?(fr?'Retour à la recette':'Back to Recipe'):undefined} directSelectionReturn={!!fillingsReturn} onPrepProgress={setFillingsProgress} prepContinueLabel={prepContinueLabel} active={companionVisible} hideNavigation doughConfigured={recipeGenerated} breadIngredients={recipeGenerated ? sandwichDoughIngredients : []}
          onAdjustBread={openQuantityEdit} onMatchBreadCount={count=>{setNumItems(count);setQtyChosen(true);if(recipeGenerated)openQuantityEdit();}}
          availableDoughWeight={recipeGenerated ? ((tab === 'custom' ? advancedRecipe : recipe)?.totalDough ?? numItems * itemWeight) : undefined}
          numItems={numItems} />
      </div>}
      </div>{/* end validated task content */}
      </div>



      {/* ── Sign-in nudge toast ── */}
      {/* Confirmation qui nomme la fournée. Le doute venait d'un message qui
          ne disait pas de quoi il parlait. */}
      {/* Le rejeu est visible pendant qu'il se produit, et son échec est dit.
          Sinon le baker revient connecté, ne voit rien, et réappuie. */}
      {cloudSaveState !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
          zIndex: 999, background: '#2B2420', color: 'var(--cream)',
          fontFamily: 'var(--font-ui)', fontSize: '14px',
          borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', lineHeight: 1.4,
        }}>
          {cloudSaveState === 'saving'
            ? (locale === 'fr' ? 'Enregistrement de votre fournée…' : 'Saving your bake…')
            : (locale === 'fr'
                ? 'L’enregistrement n’est pas passé. Votre fournée est sur cet appareil — réessayez avec Enregistrer.'
                : 'That didn’t save. Your bake is on this device — try Save again.')}
        </div>
      )}

      {savedToCloudName && (
        <div
          onClick={() => setSavedToCloudName(null)}
          style={{
            position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
            zIndex: 999, background: '#2B2420', color: 'var(--cream)',
            fontFamily: 'var(--font-ui)', fontSize: '14px',
            borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            cursor: 'pointer', animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            <b style={{ fontWeight: 600 }}>{savedToCloudName}</b>
            {locale === 'fr' ? ' enregistrée sur votre compte' : ' saved to your account'}
          </span>
          <span style={{ color: 'var(--smoke)', fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>×</span>
        </div>
      )}

      {showSignInForSave && (
        <div
          onClick={() => setShowSignInForSave(false)}
          style={{
            position: 'fixed', bottom: `${bottomNavH + 12}px`, right: '16px',
            zIndex: 999, background: '#2B2420', color: 'var(--cream)',
            fontFamily: 'var(--font-ui)', fontSize: '14px',
            borderRadius: '16px', padding: '12px 16px', maxWidth: '280px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            cursor: 'pointer', animation: 'fadeInUp 0.3s ease',
          }}
        >
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            {locale === 'fr'
              ? 'Connectez-vous pour sauvegarder vos sessions'
              : 'Sign in to save your sessions'}
          </span>
          <span style={{ color: 'var(--smoke)', fontSize: '15px',
            lineHeight: 1, flexShrink: 0 }}>×</span>
        </div>
      )}



    </div>
  );
}
