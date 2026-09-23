'use client';
import type { StarterEvent } from './SchedulePicker';
import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type ScheduleResult, formatTime, hoursLabel } from '../utils';
import { MIXER_TYPES, AUTOLYSE_MIN, autolyseMinFor, type MixerType } from '../data';
import LearnModal from './LearnModal';
import { IconPreferment, IconStarter, IconMix, IconBulk, IconCold, IconDivide, IconProof, IconPreheat, IconBake } from './StepIcons';
import { toggleStepCompletion } from '../utils/guideProgress';
import { mixingBatchPlan } from '../utils/mixingBatches';
import PhaseSummary from './PhaseSummary';
import { useBottomNavHeight } from '../hooks/useBottomNavHeight';
import WaterPreparation, { type WaterSource, type WaterSettingsProps } from './WaterPreparation';
import { type UnitSystem, displayTemp, tempC, tempRange } from '../utils/units';
import { getPrefPeakH_RT, getStarterFridgeWarmupH } from './FermentChart';
import { GUIDE_FAQ } from '../lib/guideFaq';
import { formatPrefermentDose } from '../utils/prefermentDose';
import { getBreadProtocol } from '../utils/breadProfiles';

interface BakeGuideProps extends WaterSettingsProps {
  schedule: ScheduleResult;
  mixerType: MixerType;
  styleKey: string;
  kitchenTemp: number;
  mixingBatches?: number;
  onMixingBatchesChange?: (count: number) => void;
  fridgeTemp?: number;
  waterSource?: WaterSource;
  onWaterSourceChange?: (source: WaterSource) => void;
  numItems: number;
  prefermentType?: string;
  oil: number;
  hydration: number;
  ovenType?: string;
  ovenConstruction?: 'tabletop' | 'masonry' | 'home' | 'micro';
  prefStartTime?: Date | null;
  feedTime?: Date | null;
  starterEvents?: StarterEvent[];
  feed2Time?: Date | null;
  fridgeOutTime?: Date | null;
  starterState?: 'rt_fed' | 'fridge_unfed' | 'fridge_fed';
  starterMature?: boolean;
  starterHasRye?: boolean;
  usingPeak2?: boolean;
  planningMode?: 'last_fed' | 'know_peak';
  feedRatio?: 1 | 2 | 4 | 5 | 10;
  starterLocation?: 'rt' | 'fridge';
  units?: UnitSystem;
  locale?: string;
  onNavigateToPizzaParty?: () => void;
  pizzaActionLabel?: string;
  onNavigateToFillings?: () => void;
  fillingsActionLabel?: string;
  onPrepareFillings?: () => void;
  simpleMode?: boolean;
  addSeeds?: boolean;
  phase?: 'preparation' | 'cooking';
  active?: boolean;
  onNavigateToCooking?: () => void;
  onNavigateToPreparation?: () => void;
  recipe?: import('../utils').RecipeResult | null;
}

// ── Design tokens ────────────────────────────────────
const D = {
  char: '#2B2420', ash: '#3D3530', cream: '#F0EBE0',
  terra: '#6B4423', gold: '#9C8248', sage: '#6B7A5A',
  smoke: '#8A7F78', border: '#E8E0D5', warm: '#FDFBF7',
};

// ── Section sub-component ────────────────────────────
function Section({ icon, title, children }: {
  icon: string | null; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{
        fontSize: '18px', fontWeight: 700, color: D.char,
        fontFamily: 'var(--font-ui)', marginBottom: '8px',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        {icon && <span>{icon}</span>}{title}
      </div>
      <div style={{ fontSize: '15px', color: D.ash, lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
        {children}
      </div>
    </div>
  );
}

// ── Bullet list ──────────────────────────────────────
function Bullets({ items }: { items: (string | React.ReactNode)[] }) {
  const simple = useContext(SimpleModeCtx);
  if (simple) {
    items = items.filter(it => typeof it !== 'string' || !JARGON_RE.test(it));
  }
  if (items.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ color: D.terra, flexShrink: 0, marginTop: '.1rem' }}>·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Numbered steps ───────────────────────────────────

// Simple-mode content gate: Simple bakers asked for "very easy" — the same
// steps, minus technique jargon (windowpane, pumpkin, bassinage, autolyse).
// Context (not a module flag) because Simple and Custom layouts can both
// keep a BakeGuide mounted at once with different modes.
const SimpleModeCtx = createContext(false);
// One autolyse, one number. The schedule reserves AUTOLYSE_MIN between the
// initial and the final mix (see autolyseMinFor), so this copy must read from
// the same constant — it used to say 20 while nothing reserved any time at
// all, which is two encodings of one fact and the plan winning by silence.
const AUTOLYSE_NOTE = {
  en: 'autolyse — gluten forms without kneading',
  fr: 'autolyse — le gluten se forme sans pétrir',
};

const JARGON_RE = /windowpane|membrane|pumpkin|citrouille|bassinage|autolyse|\bFDT\b|\bDDT\b|\bTFP\b/i;
const SIMPLE_HIDDEN_TERMS = new Set(['windowpane', 'pumpkin', 'bassinage', 'autolyse', 'fdt']);
function easyBold(s: string): string {
  return s
    .replace(/Speed 2 until pumpkin shape forms/, 'Speed 2 until the dough gathers into a smooth ball')
    .replace(/Vitesse 2 jusqu\u2019\u00e0 la forme de citrouille/, 'Vitesse 2 jusqu\u2019\u00e0 une boule lisse qui se d\u00e9colle de la cuve')
    .replace(/Once pumpkin is stable \u2014 /, '')
    .replace(/Citrouille stable \u2014 /, '');
}

function Steps({ items }: { items: { bold: string; note: string }[] }) {
  const simple = useContext(SimpleModeCtx);
  items = items.filter(it => it.bold !== '');
  if (simple) {
    items = items.map(it => ({
      bold: easyBold(it.bold),
      note: JARGON_RE.test(it.note) ? '' : it.note,
    }));
  }
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{
            minWidth: '18px', color: D.char, flexShrink: 0,
          }}>{i + 1}.</span>
          <span>
            <strong style={{ color: D.char }}>{item.bold}</strong>
            {item.note && <em style={{ color: D.smoke }}>{' — '}{item.note}</em>}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Pumpkin shape SVG (spiral mixer) ────────────────
function PumpkinSVG() {
  return null;
}

// ── Sparkle SVG — marks AI-powered learn links ───────
function SparkleSVG() {
  return (
    <svg viewBox="0 0 12 12" width={10} height={10} fill="none"
      stroke="currentColor" strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }}>
      <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.4 2.4l1.4 1.4M8.2 8.2l1.4 1.4M2.4 9.6l1.4-1.4M8.2 3.8l1.4-1.4"/>
    </svg>
  );
}

// ── Pill tag ─────────────────────────────────────────
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: color ? `${color}18` : '#F0EBE020',
      border: `1px solid ${color ?? D.border}40`,
      borderRadius: '20px',
      padding: '.15rem 8px',
      fontSize: '11px',
      fontFamily: 'var(--font-ui)',
      color: color ?? D.smoke,
      marginLeft: '.5rem',
    }}>{label}</span>
  );
}

// ── Step card ────────────────────────────────────────
function StepCard({
  number, displayNumber = number, icon, title, time, duration, open, done, overview = false, totalSteps = 0, onToggle, onDone, children, divRef, final = false, completeLabel, batchCompletion = false, preview = false, onReturnCurrent, onPrevious, onNext, hidden = false, stepPhase = 'preparation', previousLabel, nextLabel,
}: {
  number: number; displayNumber?: number; icon: React.ReactNode; title: string; overview?: boolean; totalSteps?: number;
  hidden?: boolean; stepPhase?: 'preparation' | 'cooking'; previousLabel?: string; nextLabel?: string;
  time?: Date; duration?: number | null; accent?: string;
  onPrevious?: () => void; onNext?: () => void; preview?: boolean; onReturnCurrent?: () => void; completeLabel?: string; batchCompletion?: boolean; final?: boolean; open: boolean; done: boolean; onToggle: () => void; onDone: () => void;
  children: React.ReactNode; divRef?: React.RefCallback<HTMLDivElement>;
}) {
  const locale = useLocale();
  const fr = locale === 'fr';
  const navigationHeight = useBottomNavHeight(64);
  return (
    <section ref={divRef} data-guide-phase={stepPhase} data-guide-title={title} hidden={hidden} tabIndex={-1} aria-label={`${title} · ${fr ? 'Étape' : 'Step'} ${displayNumber}`} style={{ display: !hidden && (open || overview) ? undefined : 'none', background: D.warm, borderRadius: overview ? 12 : 0,
      border: overview ? `1px solid ${done ? D.sage + '60' : D.border}` : 'none', scrollMarginTop: 140 }}>
      <button type="button" onClick={overview ? onToggle : undefined} aria-expanded={open}
        aria-controls={`bake-step-${number}`} style={{ width: '100%', display: 'flex', gap: 12,
          alignItems: 'center', padding: overview ? 16 : '0 0 16px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: D.char }}>
        <span aria-hidden="true" style={{ display: overview ? undefined : 'none', color: done ? D.sage : D.terra, minWidth: 18, textAlign: 'center' }}>{done ? '✓' : displayNumber}</span>
        <span aria-hidden="true" style={{ color: done ? D.sage : D.terra, width: 22, height: 22, display: overview ? 'inline-flex' : 'none', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: overview ? 15 : 30, fontFamily: overview ? 'inherit' : 'Georgia, serif', lineHeight:1.15 }}>{title}</strong>
          {!overview && <span style={{display:'block',fontSize:14,color:D.smoke,marginTop:12}}>{fr ? 'Étape' : 'Step'} {displayNumber}{totalSteps > 0 ? ` / ${totalSteps}` : ''}</span>}
          {time && <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: D.smoke }}>
            {formatTime(time, locale)}{duration ? ` · ${duration < 1 ? `${Math.round(duration * 60)} min` : hoursLabel(duration)}` : ''}
          </span>}
          {done && <span style={{ fontSize: 12, color: D.sage }}>{fr ? 'Terminé' : 'Completed'}</span>}
        </span>
        {overview && <span aria-hidden="true">{open ? '−' : '+'}</span>}
      </button>
      {open && <div id={`bake-step-${number}`} style={{ padding: overview ? '0 20px 20px' : '0 0 20px' }}>
        {preview && <p style={{color:D.smoke,fontSize:12}}>{fr ? 'Aperçu — votre progression ne change pas.' : 'Preview — your progress stays unchanged.'}</p>}
        {children}
        <div style={{position:'sticky',bottom:navigationHeight,background:D.warm,paddingTop:12,paddingBottom:'max(8px, env(safe-area-inset-bottom))',zIndex:2}}>
        {preview ? <button type="button" onClick={onReturnCurrent} style={{minHeight:44}}>{fr ? 'Revenir à l’étape en cours' : 'Back to current step'}</button>
          : batchCompletion && !done ? <button type="button" onClick={onDone} style={{minHeight:44,padding:'8px 12px',marginBottom:8,border:`1px solid ${D.terra}`,borderRadius:10,background:D.terra,color:'white',cursor:'pointer'}}>{completeLabel}</button>
          : <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:14,minHeight:44,margin:'0 0 4px',cursor:'pointer'}}>
              <input type="checkbox" checked={done} onChange={onDone} title={done ? (fr ? 'Annuler cette étape' : 'Undo this step') : (fr ? 'Marquer comme terminée' : 'Mark as completed')} style={{width:18,height:18,margin:0,accentColor:D.terra}}/>
              {fr ? 'Étape faite' : 'Step done'}
            </label>}
        <nav aria-label={fr ? 'Navigation entre les étapes' : 'Step navigation'} className="bh-guide-step-nav" style={{display:'flex',gap:8}}>
          <button type="button" onClick={onPrevious} disabled={!onPrevious} style={{flex:1,minHeight:44}}>{previousLabel ?? (fr ? 'Étape précédente' : 'Previous step')}</button>
          {!final && <button type="button" className="bh-guide-next" onClick={onNext} style={{flex:1,minHeight:48,border:0,borderRadius:10,padding:'10px 14px',background:D.terra,color:'white',fontWeight:600}}>{nextLabel ?? (fr ? 'Étape suivante' : 'Next step')} →</button>}
        </nav>
        </div>
      </div>}
    </section>
  );
}

// ── Learn link ───────────────────────────────────────
function LearnLink({ term, label, onOpen, showSparkle = false }: {
  term: string; label: string; onOpen: (t: string) => void; showSparkle?: boolean;
}) {
  const simple = useContext(SimpleModeCtx);
  if (simple && SIMPLE_HIDDEN_TERMS.has(term)) return null;
  return (
    <button
      onClick={() => onOpen(term)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: D.terra, fontSize: '12px',
        fontFamily: 'var(--font-ui)',
        textDecoration: 'underline', textUnderlineOffset: '2px',
        padding: 0, display: 'inline-flex', alignItems: 'center',
      }}
    >
      {showSparkle && <SparkleSVG />}
      {label}
    </button>
  );
}

// ── Coach button ─────────────────────────────────────
const COACH_STEPS = new Set(['poolish','biga','starter','mix','bulk','shape','proof','bake','open','score','pizza_maestro']);
const GATE_STEPS  = new Set(['poolish','biga','starter','proof']);

const MAESTRO_CONTENT: Record<string, {
  question: { en: string; fr: string };
  instruction?: { en: string; fr: string };
}> = {
  poolish: {
    question: { en: 'Does my poolish look ready?', fr: 'Mon poolish est-il prêt ?' },
    instruction: { en: 'Photo the surface of your container', fr: 'Photographiez la surface de votre récipient' },
  },
  biga: {
    question: { en: 'Does my biga look ready?', fr: 'Ma biga est-elle prête ?' },
    instruction: { en: 'Photo the surface of your container', fr: 'Photographiez la surface de votre récipient' },
  },
  starter: {
    question: { en: 'Does my starter look ready?', fr: 'Mon levain est-il prêt ?' },
    instruction: { en: 'Photo the surface of your container', fr: 'Photographiez la surface de votre récipient' },
  },
  mix: {
    question: { en: 'Is my gluten well developed?', fr: 'Mon gluten est-il bien développé ?' },
    instruction: { en: 'Stretch a small piece thin and photograph it', fr: 'Étirez un petit morceau fin et photographiez-le' },
  },
  shape: {
    question: { en: 'Is my shaping correct?', fr: 'Mon façonnage est-il correct ?' },
    instruction: { en: 'Photo the top of your shaped ball', fr: 'Photographiez le dessus de votre boule façonnée' },
  },
  proof: {
    question: { en: 'Is my dough properly proofed?', fr: 'Ma pâte est-elle correctement levée ?' },
    instruction: { en: 'Press gently with a floured finger, then photograph', fr: 'Appuyez doucement avec un doigt fariné, puis photographiez' },
  },
  score: {
    question: { en: 'Are my scores clean and deep enough?', fr: 'Mes grignes sont-elles nettes et assez profondes ?' },
    instruction: { en: 'Photo top-down before loading the oven', fr: "Photo de dessus avant d'enfourner" },
  },
  bake: {
    question: { en: 'How did my bake turn out?', fr: 'Comment s\'est passée ma cuisson ?' },
    instruction: { en: 'Photo your loaf fresh from the oven', fr: 'Photographiez votre pain à la sortie du four' },
  },
  open: {
    question: { en: 'Is the base evenly stretched with a good cornicione?', fr: 'La base est-elle bien étalée avec une bonne corniche ?' },
  },
  pizza_maestro: {
    question: { en: 'What does Maestro think?', fr: 'Que pense le Maestro ?' },
    instruction: { en: 'Show the base, topped pizza, or fresh from the oven', fr: 'Montrez la base, la pizza garnie, ou à la sortie du four' },
  },
};

function CoachButton({
  stepId, styleKey, kitchenTemp, prefermentType, locale, ovenType, pizzaName,
}: {
  stepId: string;
  styleKey: string;
  kitchenTemp: number;
  prefermentType?: string;
  locale: string;
  ovenType?: string;
  pizzaName?: string;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const isGate                  = GATE_STEPS.has(stepId);
  const l = locale === 'fr' ? 'fr' : 'en';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ALLOWED = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
    if (!ALLOWED.includes(file.type)) return;

    setLoading(true);
    setFeedback(null);
    setError(false);

    try {
      // Resize to max 1024px before encoding — keeps payload
      // under Vercel's 4.5MB limit regardless of photo size
      const resized = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 1024;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas unavailable')); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = objectUrl;
      });

      const base64 = resized.split(',')[1];
      const mimeType = 'image/jpeg';

      const res = await fetch('/api/bake-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          stepId,
          styleKey,
          kitchenTemp,
          prefermentType,
          locale,
          ovenType,
          pizzaName,
        }),
      });

      const data = await res.json();
      if (data.feedback) {
        setFeedback(data.feedback);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!COACH_STEPS.has(stepId)) return null;

  return (
    <div style={{ marginTop: '16px' }}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFile}
      />

      {MAESTRO_CONTENT[stepId]?.question && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          color: 'var(--char)', fontWeight: 500, marginBottom: '4px',
        }}>
          {MAESTRO_CONTENT[stepId].question[l]}
        </div>
      )}

      {MAESTRO_CONTENT[stepId]?.instruction && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px',
          color: 'var(--smoke)', fontStyle: 'italic', marginBottom: '8px',
        }}>
          {MAESTRO_CONTENT[stepId].instruction![l]}
        </div>
      )}

      {feedback && (
        <div style={{
          background: '#2B2420',
          borderLeft: '3px solid #6B4423',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '12px',
          position: 'relative',
        }}>
          <div style={{ color: '#F0EBE0', fontSize: '13px', fontFamily: 'var(--font-ui)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {feedback}
          </div>
          <button
            onClick={() => { setFeedback(null); setError(false); }}
            style={{
              position: 'absolute', bottom: '8px', right: '12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A7F78', fontSize: '11px',
              fontFamily: 'var(--font-ui)',
              textDecoration: 'underline', padding: 0,
            }}
          >
            {l === 'fr' ? 'Reprendre' : 'Retake'}
          </button>
        </div>
      )}

      {error && !feedback && (
        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-ui)', fontStyle: 'italic', marginBottom: '8px' }}>
          {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
        </div>
      )}

      {!feedback && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: '#2B2420',
              border: isGate ? '1px solid rgba(156, 130, 72,0.5)' : '1px solid rgba(240, 235, 224,0.15)',
              borderRadius: '20px', padding: '4px 12px', cursor: loading ? 'default' : 'pointer',
              height: '28px', opacity: loading ? 0.7 : 1, transition: 'opacity .15s',
            }}
          >
            {loading ? (
              <span style={{
                display: 'inline-block', width: '12px', height: '12px',
                border: '1.5px solid rgba(240, 235, 224,0.3)',
                borderTop: '1.5px solid #F0EBE0',
                borderRadius: '50%',
                animation: 'bh-spin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            ) : (
              <svg viewBox="0 0 16 16" width={14} height={14} fill="none"
                stroke="#F0EBE0" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12"/>
              </svg>
            )}
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: loading ? 'rgba(240, 235, 224,0.6)' : '#F0EBE0',
              whiteSpace: 'nowrap',
            }}>
              {loading
                ? (l === 'fr' ? 'Le Maestro regarde...' : 'Maestro is looking...')
                : (l === 'fr' ? 'Demander au Maestro' : 'Ask Maestro')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Ask Maestro — unified: text question, photo, or both ─────────
export function AskMaestro({ stepId, stepTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType, recipeContext }: {
  stepId: string; stepTitle: string; styleKey: string; kitchenTemp: number;
  prefermentType?: string; locale: string; ovenType?: string; recipeContext?: string;
}) {
  const [q, setQ] = useState('');
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const l = locale === 'fr' ? 'fr' : 'en';

  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const b64 = await new Promise<string | null>((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        const sc = Math.min(1, MAX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
    if (b64) { setPhotoB64(b64); setAnswer(null); } else setError(true);
  }

  async function ask() {
    const question = q.trim();
    if ((!question && !photoB64) || loading) return;
    setLoading(true); setError(false); setAnswer(null);
    try {
      const res = await fetch('/api/bake-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question || undefined,
          imageBase64: photoB64 ?? undefined,
          mimeType: photoB64 ? 'image/jpeg' : undefined,
          stepId, stepTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType, recipeContext,
        }),
      });
      const data = await res.json();
      if (res.ok && typeof data.feedback === 'string' && data.feedback.trim()) setAnswer(data.feedback); else setError(true);
    } catch { setError(true); } finally { setLoading(false); }
  }

  const canAsk = !loading && (q.trim().length > 0 || photoB64 !== null);

  return (
    <div style={{ marginTop: '12px' }}>
      {MAESTRO_CONTENT[stepId]?.question && !answer && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: D.char, fontWeight: 500, marginBottom: '8px' }}>
          {MAESTRO_CONTENT[stepId].question[l]}
        </div>
      )}
      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} ref={fileRef} onChange={attach} />
      {photoB64 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <img src={`data:image/jpeg;base64,${photoB64}`} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '12px', border: `1px solid ${D.border}` }} />
          <button onClick={() => setPhotoB64(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.smoke, fontSize: '11px', fontFamily: 'var(--font-ui)', textDecoration: 'underline', padding: 0 }}>
            {l === 'fr' ? 'Retirer la photo' : 'Remove photo'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => fileRef.current?.click()}
          title={l === 'fr' ? 'Joindre une photo' : 'Attach a photo'}
          style={{
            width: '38px', flexShrink: 0, border: `1px solid ${photoB64 ? '#6B7A5A' : D.border}`,
            borderRadius: '12px', background: photoB64 ? 'rgba(107,122,90,0.08)' : '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 20 20" width={17} height={17} fill="none" stroke={photoB64 ? '#6B7A5A' : '#8A7F78'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 7.5A1.5 1.5 0 012.5 6h.879a2 2 0 001.664-.89l.812-1.22A2 2 0 017.519 3h4.962a2 2 0 011.664.89l.812 1.22A2 2 0 0016.62 6H17.5A1.5 1.5 0 0119 7.5v8A1.5 1.5 0 0117.5 17h-15A1.5 1.5 0 011 15.5v-8z"/>
            <circle cx="10" cy="11" r="3"/>
          </svg>
        </button>
        <input
          maxLength={500}
          aria-label={l === 'fr' ? 'Votre question' : 'Your question'}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(); }}
          placeholder={l === 'fr' ? 'Question, photo, ou les deux…' : 'Question, photo, or both…'}
          style={{
            flex: 1, border: `1px solid ${D.border}`, borderRadius: '8px',
            padding: '8px 12px', fontSize: '13px', fontFamily: 'var(--font-ui)',
            color: D.char, background: '#fff', outline: 'none', minWidth: 0,
          }}
        />
        <button
          onClick={ask}
          disabled={!canAsk}
          style={{
            background: '#2B2420', color: '#F0EBE0', border: 'none',
            borderRadius: '12px', padding: '12px 16px', minHeight: '44px', fontSize: '13px',
            fontFamily: 'var(--font-ui)', cursor: canAsk ? 'pointer' : 'default',
            opacity: canAsk ? 1 : 0.6, whiteSpace: 'nowrap',
          }}
        >
          {loading ? '…' : (l === 'fr' ? 'Demander' : 'Ask')}
        </button>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: D.smoke, fontStyle: 'italic', marginTop: '4px' }}>
        {l === 'fr' ? 'Une question sur cette étape ? Photo facultative.' : 'Ask about this step. Photo optional.'}
      </div>
      {answer && (
        <div style={{
          background: '#2B2420', borderLeft: '3px solid #6B4423', borderRadius: '12px',
          padding: '12px 16px', marginTop: '8px',
          color: '#F0EBE0', fontSize: '13px', fontFamily: 'var(--font-ui)', lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>
          {answer}
          <div>
            <button
              onClick={() => { setAnswer(null); setQ(''); setPhotoB64(null); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8A7F78', fontSize: '11px', fontFamily: 'var(--font-ui)',
                textDecoration: 'underline', padding: 0, marginTop: '8px',
              }}
            >
              {l === 'fr' ? 'Autre question' : 'Ask another'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div style={{ fontSize: '12px', color: D.smoke, fontStyle: 'italic', marginTop: '8px', fontFamily: 'var(--font-ui)' }}>
          {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
        </div>
      )}
    </div>
  );
}

// ── Step extras — Tips & tricks / FAQ / Maestro tabs ─────────────
// Keeps the timeline clean: the step card shows only "what to do";
// Secondary guidance is grouped under one help disclosure for every step.
function StepExtras({ tips, faqKey, faqOverride, coachStepId, coachTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType, recipeContext }: {
  tips: React.ReactNode;
  faqKey?: string;
  faqOverride?: (typeof GUIDE_FAQ)[string];
  coachStepId?: string;
  coachTitle: string;
  styleKey: string;
  kitchenTemp: number;
  prefermentType?: string;
  locale: string;
  ovenType?: string;
  recipeContext?: string;
}) {
  const [tab, setTab] = useState<'tips' | 'faq' | 'coach' | null>('tips');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const l = locale === 'fr' ? 'fr' : 'en';
  const simpleFaq = useContext(SimpleModeCtx);
  const faq = (faqOverride ?? (faqKey ? (GUIDE_FAQ[faqKey] ?? []) : [])).filter(e =>
    !simpleFaq || !(JARGON_RE.test(e.q.en + ' ' + e.q.fr + ' ' + e.a.en + ' ' + e.a.fr)));

  const pills: Array<{ id: 'tips' | 'faq' | 'coach'; label: string }> = [
    { id: 'tips', label: l === 'fr' ? 'Astuces' : 'Tips & tricks' },
    ...(faq.length > 0 ? [{ id: 'faq' as const, label: 'FAQ' }] : []),
    { id: 'coach', label: l === 'fr' ? 'Maestro' : 'Maestro' },
  ];

  return (
    <details style={{ marginTop: '16px', borderTop: `1px solid ${D.border}`, paddingTop: '12px' }}>
      <summary style={{minHeight:44,padding:'10px 0',cursor:'pointer',fontSize:16}}>{l === 'fr' ? 'Aide pour cette étape' : 'Help with this step'}</summary>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {pills.map(p => (
          <button
            key={p.id}
            aria-expanded={tab === p.id}
            onClick={() => setTab(prev => prev === p.id ? null : p.id)}
            style={{
              border: tab === p.id ? `1.5px solid ${D.terra}` : `1px solid ${D.border}`,
              background: tab === p.id ? '#fff' : 'transparent',
              color: tab === p.id ? D.terra : D.smoke,
              minHeight:44, borderRadius: '20px', padding: '8px 12px',
              fontSize: '14px', fontFamily: 'var(--font-ui)',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === 'tips' && <div style={{ marginTop: '4px' }}>{tips}</div>}

      {tab === 'faq' && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {faq.map((f, i) => (
            <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <button
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(prev => prev === i ? null : i)}
                style={{
                  minHeight:44, width: '100%', textAlign: 'left', background: openFaq === i ? '#fff' : 'transparent',
                  border: 'none', cursor: 'pointer', padding: '8px 12px',
                  fontSize: '14px', fontWeight: 600, color: D.char,
                  fontFamily: 'var(--font-ui)',
                  display: 'flex', justifyContent: 'space-between', gap: '8px',
                }}
              >
                <span>{f.q[l]}</span>
                <span style={{ color: D.smoke, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 12px 12px', fontSize: '14px', color: D.ash, lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
                  {f.a[l]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'coach' && (
        <div style={{ marginTop: '4px' }}>
          <AskMaestro
            stepId={coachStepId ?? faqKey ?? 'mix'}
            stepTitle={coachTitle}
            styleKey={styleKey}
            kitchenTemp={kitchenTemp}
            prefermentType={prefermentType}
            locale={locale}
            ovenType={ovenType}
            recipeContext={recipeContext}
          />
        </div>
      )}
    </details>
  );
}

// ── External link ────────────────────────────────────
function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      color: D.terra, fontSize: '12px',
      fontFamily: 'var(--font-ui)',
      textDecoration: 'underline', textUnderlineOffset: '2px',
    }}>{label} →</a>
  );
}

function StepVisual({ kind, includeSpiral = false, locale }: { includeSpiral?: boolean; kind: 'mix' | 'spiral' | 'fold' | 'poolish' | 'biga' | 'starter'; locale: string }) {
  const fr = locale === 'fr';
  const figures: Record<string, [string, string, string][]> = {
    starter: [['/images/approved/leavening-v2/starter.webp', 'Look for a clear rise, bubbles and a rounded top before it collapses.', 'Observez une nette montée, des bulles et un dessus bombé avant qu’il ne retombe.']],
    mix: [['/step-visuals/windowpane-v1.webp', 'Wheat dough: gently stretch a small piece. Look for a thin membrane rather than immediate tearing. Let tight dough rest before testing again.', 'Pâte de blé : étirez doucement un petit morceau. Il doit former une membrane fine plutôt que se déchirer aussitôt. Si la pâte résiste, laissez-la reposer avant de réessayer.']],
    spiral: [['/step-visuals/spiral-pumpkin-wide-v1.webp', 'Spiral mixer: the dough gathers into a rounded “pumpkin” shape. This is a development cue, not a precise endpoint; also check stretch and temperature.', 'Pétrin à spirale : la pâte se rassemble en forme de « citrouille ». C’est un indice de développement ; vérifiez aussi son élasticité et sa température.']],
    fold: [['/step-visuals/bowl-fold-v1.webp', 'Bowl fold: lift one edge gently, then fold it over the middle. Turn the bowl and repeat without tearing.', 'Rabat en cuve : étirez doucement un bord, puis repliez-le au centre. Tournez le bol et répétez sans déchirer.'], ['/step-visuals/coil-fold-v2.webp', 'Coil fold: support the middle from underneath with both hands. Lift gently, then lower so the ends tuck under. Turn the container for the next side.', 'Rabat en bobine : soutenez le milieu par dessous avec les deux mains. Soulevez doucement, puis reposez pour replier les extrémités dessous. Tournez le bac pour le côté suivant.']],
    poolish: [['/preferment-photos/poolish-v1.webp', 'Poolish is loose and bubbly as it matures. Judge its rise and surface as well as the schedule.', 'La poolish est souple et bulleuse à maturité. Observez sa montée et sa surface, en complément du planning.']],
    biga: [['/preferment-photos/biga-v1.webp', 'Biga starts rough, not smooth. When mature, break a piece open to check for aeration inside.', 'La biga commence en morceaux irréguliers. À maturité, ouvrez un morceau pour observer les alvéoles à l’intérieur.']],
  };
  return <details style={{ margin: '14px 0' }}><summary style={{minHeight:44,padding:'10px 0',fontSize:16,cursor:'pointer'}}>{fr ? 'Voir les signes à observer' : 'See what to look for'}</summary>
    {[...figures[kind], ...(includeSpiral ? figures.spiral : [])].map(([src,en,french]) => <figure key={src} style={{margin:'12px 0'}}><img src={src} alt={fr ? french : en} loading="lazy" style={{display:'block',width:'100%',maxHeight:280,objectFit:'contain',borderRadius:12}}/><figcaption style={{fontSize:14,lineHeight:1.45,marginTop:8}}>{fr ? french : en}</figcaption></figure>)}
  </details>;
}

export function breadCoolingRange(style: string, weight: number): string {
  return style === 'pain_seigle' ? '12–24 h' : ['baguette','fougasse','pain_viennois'].includes(style) && weight <= 400 ? '30–60 min' : weight <= 400 ? '1–2 h' : weight <= 1000 ? '2–3 h' : '3–4 h';
}

// ── Main component ───────────────────────────────────
const TERM_TO_STEPID: Record<string, string> = {
  windowpane:        'mix',
  bulk_fermentation: 'bulk',
  poke_test:         'proof',
  preferment_ready:  'poolish',
  shape_check:       'shape',
  score_technique:   'score',
  stretch_bake:      'open',
};

export default function BakeGuide({
  schedule, mixerType, styleKey, kitchenTemp, fridgeTemp = 4, measuredWaterTemp, onMeasuredWaterTempChange, waterMethod, onWaterMethodChange, spiralIceConfirmed, onSpiralIceConfirmedChange, mixingBatches, onMixingBatchesChange, waterSource = 'room', onWaterSourceChange, numItems,
  prefermentType, oil, hydration, ovenType, ovenConstruction, prefStartTime, feedTime, starterEvents,
  feed2Time = null, fridgeOutTime = null,
  starterState = 'rt_fed', starterMature = true, starterHasRye = false,
  usingPeak2 = false, planningMode = 'last_fed',
  feedRatio = 1, starterLocation = 'rt',
  units, locale,
  onNavigateToPizzaParty, pizzaActionLabel, onNavigateToFillings, fillingsActionLabel, onPrepareFillings, recipe, simpleMode, addSeeds,
  phase, active = true, onNavigateToCooking, onNavigateToPreparation,
}: BakeGuideProps) {
  const u = units ?? 'metric';
  const l = locale === 'fr' ? 'fr' : 'en';
  const enriched = !!recipe?.enrichment;
  const [learnTerm, setLearnTerm] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(0);
  useEffect(() => { if (totalSteps > 0 && currentStep > totalSteps) setCurrentStep(totalSteps); }, [totalSteps, currentStep]);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [activeBatch, setActiveBatch] = useState(0);
  const batch = recipe ? mixingBatchPlan(recipe, mixerType, mixingBatches, activeBatch) : null;
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const focusRequestedStep = useRef<number | null>(null);
  const viewedPhase = useRef<'preparation' | 'cooking' | undefined>(undefined);
  const phasePositions = useRef<Partial<Record<'preparation' | 'cooking', number>>>({});
  function navigateGuideStep(step: number) {
    const targetPhase = stepRefs.current[step]?.dataset.guidePhase;
    if (phase && targetPhase !== phase) {
      if (targetPhase === 'cooking') onNavigateToCooking?.();
      if (targetPhase === 'preparation') onNavigateToPreparation?.();
    }
    focusRequestedStep.current = step;
    setCurrentStep(step);
  }
  useEffect(() => { setTotalSteps(stepRefs.current.filter(Boolean).length); });
  const t = useTranslations('bakeGuide');
  const rootT = useTranslations();
  const _fmtLocale = useLocale();
  const _isFr = _fmtLocale === 'fr';
  // A changed recipe/schedule must never inherit another bake's completion.
  const progressKey = 'bh_guide_done_v2:' + JSON.stringify({
    styleKey, mixerType, numItems, prefermentType, oil, hydration, ovenType,
    schedule, prefStartTime, feedTime, feed2Time, starterEvents: starterEvents?.map(event => ({kind:event.kind,time:event.time})), recipe, mixingBatches,
  });
  useEffect(() => {
    focusRequestedStep.current = null;
    viewedPhase.current = undefined;
    phasePositions.current = {};
    let completed: number[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(progressKey) ?? '[]');
      if (Array.isArray(stored)) completed = stored.filter((value): value is number =>
        typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 30);
    } catch {}
    setDoneSteps(new Set(completed));
    try { setActiveBatch(Math.max(0, Number(localStorage.getItem(progressKey + ':batch')) || 0)); } catch { setActiveBatch(0); }
    let firstUndone = 1;
    while (completed.includes(firstUndone)) firstUndone++;
    setCurrentStep(firstUndone);
  }, [progressKey]);

  // Browsing and completion are independent. Each destination resumes its last
  // viewed step (including overview=0); explicit Previous/Next takes precedence.
  useEffect(() => {
    if (!active || !phase) return;
    const changedPhase = viewedPhase.current !== phase;
    viewedPhase.current = phase;
    const belongsToPhase = currentStep === 0 || stepRefs.current[currentStep]?.dataset.guidePhase === phase;
    const explicitNavigation = focusRequestedStep.current === currentStep && currentStep > 0;
    if (belongsToPhase && (!changedPhase || explicitNavigation)) {
      phasePositions.current[phase] = currentStep;
      return;
    }
    const candidates = stepRefs.current.flatMap((el, index) => el?.dataset.guidePhase === phase ? [index] : []);
    const remembered = phasePositions.current[phase];
    const target = remembered === 0 || (remembered !== undefined && candidates.includes(remembered))
      ? remembered
      : belongsToPhase ? currentStep : candidates.find(index => !doneSteps.has(index)) ?? candidates[0];
    if (target !== undefined) {
      phasePositions.current[phase] = target;
      setCurrentStep(target);
    }
  }, [active, phase, currentStep, doneSteps, totalSteps]);

  useEffect(() => {
    if (active && currentStep > 0) {
      const el = stepRefs.current[currentStep];
      if (el && !el.hidden) {
        if (focusRequestedStep.current === currentStep) {
          focusRequestedStep.current = null;
          el.focus({ preventScroll: true });
        }
        const r = el.getBoundingClientRect();
        const headerH = 120; // sticky header + journey bar
        // Scroll only when the next step isn't comfortably visible —
        // instant, landing just under the header (no smooth: targets
        // must not move under fingers).
        if (r.top < headerH || r.top > window.innerHeight * 0.6) {
          window.scrollTo({ top: r.top + window.scrollY - headerH, behavior: 'smooth' });
        }
      }
    }
  }, [currentStep, active, phase]);

  const isSourdough = recipe ? !!recipe.sourdough : styleKey === 'sourdough' || styleKey === 'pain_levain';
  const breadProtocol = getBreadProtocol(styleKey);
  const hasPoachStep = breadProtocol?.cooking === 'boil-bake' && !!schedule.poachStart;
  const profileSteps = (lines: readonly string[]) => lines.map(line => ({ bold: line.replace(/(\d+)\s?°C/g, (_, degrees) => displayTemp(Number(degrees), u)).replaceAll('{count}', String(numItems)).replaceAll('{weight}', String(Math.round((recipe?.totalDough ?? numItems * (breadProtocol?.portions.weight ?? 100)) / Math.max(1,numItems)))), note: '' }));
  const fillingsAction = onNavigateToFillings && <button type="button" onClick={onNavigateToFillings} style={{width:'100%',minHeight:48,margin:'14px 0',border:0,borderRadius:10,background:D.terra,color:'white'}}>{fillingsActionLabel ?? (l === 'fr' ? 'Sandwiches et garnitures' : 'Sandwiches & fillings')} →</button>;
  const isBread       = !!breadProtocol || ['pain_campagne','pain_levain','baguette','pain_complet','pain_seigle','fougasse','brioche','pain_mie','pain_viennois'].includes(styleKey);
  const isNeapolitan  = styleKey === 'neapolitan';
  const isFougasse    = styleKey === 'fougasse';
  const isBaguette    = styleKey === 'baguette';
  const isLoafTin     = ['brioche','pain_mie','pain_viennois','pain_seigle'].includes(styleKey);
  const isBoule       = ['pain_campagne','pain_levain','sourdough','pain_complet'].includes(styleKey);
  const isPan         = styleKey === 'pan';
  const isRoman       = styleKey === 'roman';
  // Shaping label: what we call the shaped piece
  const breadPieceLabel = isFougasse ? 'piece' : isBaguette ? 'baguette' : isLoafTin ? 'loaf' : 'loaf';
  const breadPiecePlural = numItems === 1 ? breadPieceLabel : (isBaguette ? 'baguettes' : isLoafTin ? 'loaves' : 'loaves');
  const breadPiecePluralFr = isFougasse ? 'pâtons de fougasse' : isBaguette ? 'baguettes' : isLoafTin ? 'pains' : 'pâtons';
  const isSpiral      = mixerType === 'spiral';
  const hasPref       = !!prefermentType && prefermentType !== 'none';
  const isPoolish     = prefermentType === 'poolish';
  const isBiga        = prefermentType === 'biga';
  const isTwoPhase    = schedule.coldRetard2Start !== null;
  const hasCold       = (schedule.coldRetardHours ?? 0) > 0;
  const extraBalls    = Math.max(0, numItems - 4);
  const divideMin     = 15 + 2 * extraBalls;

  // Recipe quantity helpers — used in mixing order steps.
  // Sourdough (no preferment object): half the starter is flour, half water —
  // subtract so mixing amounts match the Recipe card's tallying totals.
  const bgSdMid  = recipe?.sourdough ? recipe.sourdough.starterGramsMid : 0;
  const bgSdHalf = recipe?.sourdough && !recipe?.preferment ? Math.round(bgSdMid / 2) : 0;
  const bgMainFlour = batch?.portion.flour ?? null;
  const bgMainWater = batch?.portion.water ?? null;
  // Feed-step amounts: at ratio 1:R:R, a seed of S grams yields S×(1+2R) of
  // ripe starter. Size the parts so the build covers the recipe's
  // recommended starter (bgSdMid) with ~10g to spare, rounded to 5g.
  const feedR = feedRatio ?? 1;
  const feedSeed = bgSdMid > 0
    ? Math.max(5, Math.ceil((bgSdMid + 10) / (1 + 2 * feedR) / 5) * 5)
    : 50;
  const feedPart = Math.max(5, Math.round(feedSeed * feedR / 5) * 5);
  const feedTotal = feedSeed + 2 * feedPart;
  const bgWater90   = bgMainWater ? Math.round(bgMainWater * 0.9) : null;
  const bgWater10   = bgMainWater ? bgMainWater - (bgWater90 ?? 0) : null;
  const bgSaltG = batch?.portion.salt ?? null;
  // convertedGrams, NOT grams — grams is the IDY-equivalent (see Timeline)
  const bgYeastG = batch?.portion.yeast ? String(batch.portion.yeast) : null;
  // Mix STARTS before bulk fermentation — header and Mix step previously used
  // bulkFermStart, so the Guide disagreed with the Recipe timeline by the
  // mixing duration (16:15 vs 16:00 / 25h45 vs 26h).
  const bgMixStart  = (() => {
    const raw = new Date(schedule.bulkFermStart.getTime() - (schedule.mixingDurationH ?? 0.25) * 3600000);
    // Use the nearest quarter-hour for the displayed start — 19:46 is engine precision, not baker time
    raw.setMinutes(Math.round(raw.getMinutes() / 15) * 15, 0, 0);
    return raw;
  })();
  const bgPoolishG = batch?.portion.preferment || null;
  // Compact recipe facts for Maestro — so it explains the plan's own numbers
  // (e.g. "0.3g IDY is correct for a 31h cold ferment") instead of guessing
  // and contradicting the app. Only real, computed values.
  const maestroRecipeContext = (() => {
    if (!recipe) return undefined;
    const totalFlour = Math.round(recipe.flour);
    const coldH = Math.round(schedule.totalColdHours ?? 0);
    const rtH = Math.round((schedule.totalRTHours ?? 0));

    // ── The dough ──
    const dough: string[] = [];
    dough.push(`style ${styleKey}`);
    dough.push(`${numItems} × ${Math.round((recipe.totalDough ?? 0) / Math.max(1, numItems))}g pieces`);
    dough.push(`total flour ${totalFlour}g`);
    dough.push(`hydration ${Math.round(hydration)}%`);
    if (recipe.salt != null) dough.push(`salt ${Math.round(recipe.salt)}g (${(recipe.salt / totalFlour * 100).toFixed(1)}%)`);
    if (recipe.oil && recipe.oil > 0) dough.push(`oil ${Math.round(recipe.oil)}g`);
    if (recipe.sugar && recipe.sugar > 0) dough.push(`sugar ${Math.round(recipe.sugar)}g`);
    if (recipe.enrichment) for (const key of ['milk','eggs','butter'] as const) if (recipe.enrichment[key] > 0) dough.push(`${key} ${recipe.enrichment[key]}g`);
    if (recipe.blendProfile?.displayName) dough.push(`flour: ${recipe.blendProfile.displayName}`);

    // ── The schedule ──
    const sched: string[] = [];
    if (coldH > 0) sched.push(`${coldH}h cold (fridge${recipe.preferment?.cold ? '' : ''}) ferment`);
    if (rtH > 0) sched.push(`${rtH}h room-temp ferment`);
    sched.push(`kitchen ${Math.round(kitchenTemp)}°C`);
    if (recipe.waterTemp != null) sched.push(`target water temp ${Math.round(recipe.waterTemp)}°C`);

    // ── Leavening ──
    const leaven: string[] = [];
    if (recipe.sourdough) {
      leaven.push('leavened with a sourdough starter (levain), no commercial yeast');
    } else if (recipe.yeast) {
      const yg = parseFloat(recipe.yeast.convertedGrams.toFixed(2));
      // Same precision rule as the recipe card: two significant figures below
      // 1%. This string goes to Maestro, so a fabricated third digit would be
      // repeated back to the baker as fact.
      const ypRaw = recipe.yeast.convertedGrams / totalFlour * 100;
      const yp = ypRaw >= 1
        ? ypRaw.toFixed(1)
        : ypRaw.toFixed(Math.max(2, 1 - Math.floor(Math.log10(ypRaw))));
      const yt = recipe.yeast.yeastType ?? 'IDY';
      leaven.push(`final-dough yeast ${yg}g ${yt} (${yp}% of total flour)`);
    }
    if (recipe.preferment && prefermentType && prefermentType !== 'none') {
      const p = recipe.preferment;
      const pf = Math.round((p.prefFlour / totalFlour) * 100);
      leaven.push(`${prefermentType}: ${pf}% of the flour (${Math.round(p.prefFlour)}g flour + ${Math.round(p.prefWater)}g water), ${p.prefYeastGrams}g yeast, ferments ${p.fermentHoursMin}-${p.fermentHoursMax}h${p.cold ? ' in the fridge' : ' at room temp'}`);
    }

    return `Computed recipe estimates and settings, not measurements or proof of correctness.
DOUGH: ${dough.join('; ')}.
SCHEDULE: ${sched.join('; ')}.
LEAVENING: ${leaven.join('; ')}.
Actual dough condition and equipment may differ from these estimates.`;
  })();

  const bgFlour90Label = bgMainFlour && bgWater90 ? (l === 'fr' ? `${bgMainFlour}g de farine + ${bgWater90}g d’eau (90%)` : `${bgMainFlour}g flour + ${bgWater90}g water (90%)`) : (l === 'fr' ? 'Farine + 90% de votre eau' : 'Flour + 90% of your water');
  const bgSaltLabel    = bgSaltG ? (l === 'fr' ? `Ajoutez le sel (${bgSaltG}g)` : `Add salt (${bgSaltG}g)`) : (l === 'fr' ? 'Ajoutez le sel' : 'Add salt');
  const bgYeastLabel   = bgYeastG ? (l === 'fr' ? `Ajoutez la levure (${bgYeastG}g)` : `Add yeast (${bgYeastG}g)`) : (l === 'fr' ? 'Ajoutez la levure' : 'Add yeast');
  const bgWater10Label = bgWater10 ? (l === 'fr' ? `Ajoutez l’eau restante (${bgWater10}g)` : `Add remaining water (${bgWater10}g)`) : (l === 'fr' ? 'Ajoutez les 10% d’eau restants' : 'Add remaining 10% water');
  const bgPoolishLabel = bgPoolishG ? (l === 'fr' ? `Ajoutez votre ${prefermentType} (${bgPoolishG}g au total)` : `Add your ${prefermentType} (${bgPoolishG}g total)`) : (l === 'fr' ? `Ajoutez votre ${prefermentType} (en entier)` : `Add your ${prefermentType} (all of it)`);


  let stepNum = 0;
  let lastStep = 0;
  let cookingStepNumber = 0;
  const cookingStepTotal = breadProtocol?.method === 'unleavened' ? 2 : isBread ? 3 + (hasPoachStep ? 1 : 0) : 2;
  const n = () => { stepNum++; lastStep = stepNum; return stepNum; };
  const sc = (mixing = false, stepPhase: 'preparation' | 'cooking' = 'preparation') => {
    const s = lastStep;
    if (stepPhase === 'cooking') cookingStepNumber++;
    return {
      displayNumber: phase === 'cooking' && stepPhase === 'cooking' ? cookingStepNumber : s,
      stepPhase,
      hidden: !!phase && phase !== stepPhase,
      previousLabel: phase && stepRefs.current[s - 1]?.dataset.guidePhase === 'preparation' && stepPhase === 'cooking' ? (l === 'fr' ? 'Retour à la préparation' : 'Back to preparation') : undefined,
      nextLabel: phase && stepRefs.current[s + 1]?.dataset.guidePhase === 'cooking' && stepPhase === 'preparation' ? (onPrepareFillings?(l === 'fr' ? 'Préparer les garnitures' : 'Prepare toppings and fillings'):(l === 'fr' ? 'Cuisson & service' : 'Cooking & serving')) : stepRefs.current[s+1]?.dataset.guideTitle ? `${l==='fr'?'Suivante':'Next'} : ${stepRefs.current[s+1]?.dataset.guideTitle}` : undefined,
      overview: currentStep === 0, totalSteps: phase === 'cooking' ? cookingStepTotal : phase === 'preparation' ? Math.max(0,totalSteps-cookingStepTotal) : totalSteps,
      onPrevious: s > 1 ? () => navigateGuideStep(s - 1) : undefined,
      onNext: () => { const next = stepRefs.current.findIndex((el, i) => i > s && el !== null); if (next > s) {if(phase==='preparation'&&stepRefs.current[next]?.dataset.guidePhase==='cooking'&&onPrepareFillings)onPrepareFillings();else navigateGuideStep(next);} },
      batchCompletion: mixing && !!batch && batch.count > 1,
      completeLabel: mixing && batch && batch.count > 1 ? (l === 'fr' ? `Terminer la pétrissée ${batch.active + 1} sur ${batch.count}` : `Complete batch ${batch.active + 1} of ${batch.count}`) : undefined,
      open: currentStep === s,
      done: doneSteps.has(s),
      onToggle: () => setCurrentStep(prev => prev === s ? 0 : s),
      onDone: () => {
        if (mixing && batch && !doneSteps.has(s) && batch.active + 1 < batch.count) {
          setActiveBatch(batch.active + 1);
          try { localStorage.setItem(progressKey + ':batch', String(batch.active + 1)); } catch {}
          return;
        }
        const next = toggleStepCompletion(s, doneSteps);
        if (doneSteps.has(s) && mixing) {
          setActiveBatch(0);
          try { localStorage.setItem(progressKey + ':batch', '0'); } catch {}
        }
        setDoneSteps(next);
        try { localStorage.setItem(progressKey, JSON.stringify([...next])); } catch {}
      },
      divRef: (el: HTMLDivElement | null) => { stepRefs.current[s] = el; },
    };
  };

  const overviewLabel = phase === 'preparation'
    ? (l === 'fr' ? 'Étapes de préparation' : 'Preparation steps')
    : phase === 'cooking'
      ? (l === 'fr' ? 'Étapes de cuisson' : 'Cooking steps')
      : (l === 'fr' ? 'Toutes les étapes' : 'All steps');

  if (recipe?.protocolIssue) return <section role="alert"><h2>{l === 'fr' ? 'Ajustez ce pain avant de commencer' : 'Adjust this bread before starting'}</h2><p>{recipe.protocolIssue === 'equipment' ? (l === 'fr' ? 'Choisissez un matériel de cuisson compatible dans les réglages.' : 'Choose compatible cooking equipment in setup.') : recipe.protocolIssue === 'timing' ? (l === 'fr' ? 'Laissez assez de temps pour mélanger, reposer et abaisser la pâte avant cuisson.' : 'Allow enough time to mix, rest and roll the dough before cooking.') : (l === 'fr' ? 'Choisissez la méthode de levée prise en charge dans les réglages.' : 'Choose the supported leavening method in setup.')}</p></section>;

  if (recipe?.enrichment?.unsupportedMethod) return <p role="alert">{l === 'fr' ? 'Modifiez le choix de levure dans les réglages et recalculez cette formule enrichie avant de suivre les étapes.' : 'Update the leavening choice in setup and recalculate this enriched formula before following the steps.'}</p>;

  if (breadProtocol?.method === 'unleavened') return <SimpleModeCtx.Provider value={!!simpleMode}>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <button type="button" onClick={() => setCurrentStep(0)} style={{minHeight:44,padding:'8px 16px',border:`1px solid ${D.border}`,borderRadius:10,background:D.warm}}>{overviewLabel}</button>
      <StepCard number={n()} {...sc(true)} icon={<IconMix />} title={l === 'fr' ? 'Mélanger la pâte' : 'Mix the dough'} time={bgMixStart} duration={schedule.mixingDurationH}>
        <Section icon="" title={l === 'fr' ? 'À mélanger' : 'Use now'}>
          {batch && Object.entries(batch.portion).filter(([,grams]) => grams > 0).map(([key,grams]) => <p key={key}>{({flour:l === 'fr' ? 'Farine' : 'Flour',water:l === 'fr' ? 'Eau' : 'Water',salt:l === 'fr' ? 'Sel' : 'Salt',oil:l === 'fr' ? 'Huile' : 'Oil',sugar:l === 'fr' ? 'Sucre' : 'Sugar'} as Record<string,string>)[key] ?? key} · {Math.round(grams)} g</p>)}
          <Steps items={[{bold:l === 'fr' ? 'Mélangez la farine, le sel, l’eau et la matière grasse mesurés. Pétrissez jusqu’à obtenir une pâte lisse et souple.' : 'Combine the measured flour, salt, water and fat. Knead until smooth and pliable.',note:''}]} />
        </Section>
      </StepCard>
      <StepCard number={n()} {...sc()} icon={<IconProof />} title={l === 'fr' ? 'Laisser reposer, couvert' : 'Rest, covered'} time={schedule.bulkFermStart} duration={breadProtocol.restMinutes ? breadProtocol.restMinutes / 60 : undefined}>
        <Steps items={profileSteps(breadProtocol.proof[l])} />
        <p>{l === 'fr' ? 'Cette pâte sans levure se détend ; elle n’a pas besoin de lever.' : 'This unleavened dough relaxes; it does not need to rise.'}</p>
      </StepCard>
      <StepCard number={n()} {...sc()} icon={<IconDivide />} title={l === 'fr' ? 'Diviser et abaisser' : 'Divide and roll'} time={schedule.divideBallTime ?? undefined}>
        <Steps items={profileSteps(breadProtocol.shaping[l])} />
      </StepCard>
<StepCard number={n()} {...sc(false, 'cooking')} icon={<IconPreheat />} title={l === 'fr' ? 'Chauffer la poêle' : 'Heat the griddle'} time={schedule.preheatStart}>
        <Steps items={profileSteps(breadProtocol.preheat[l])} />
      </StepCard>
      <StepCard final number={n()} {...sc(false, 'cooking')} icon={<IconBake />} title={l === 'fr' ? 'Cuire et garnir' : 'Cook and fill'} time={schedule.bakeStart} duration={schedule.activeCookMinutes ? schedule.activeCookMinutes / 60 : undefined}>
        <Steps items={profileSteps(breadProtocol.cookingSteps[l])} />
        <Steps items={profileSteps(breadProtocol.cooling[l])} />
        {fillingsAction}
      </StepCard>
    </div>
  </SimpleModeCtx.Provider>;

  return (
    <SimpleModeCtx.Provider value={!!simpleMode}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: '4px', display: currentStep === 0 && !phase ? undefined : 'none' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '20px', fontWeight: 700, color: D.char }}>
          {_isFr ? 'Guide de cuisson pas à pas' : 'Step-by-step bake guide'}
        </div>
        <div style={{ fontSize: '12px', color: D.smoke, fontFamily: 'var(--font-ui)', marginTop: '.2rem' }}>
          {(() => {
            const rangeStart = hasPref && prefStartTime && prefStartTime < bgMixStart ? prefStartTime : bgMixStart;
            return <>{formatTime(rangeStart, _fmtLocale)} → {formatTime(schedule.bakeStart, _fmtLocale)} · {hoursLabel((schedule.bakeStart.getTime() - rangeStart.getTime()) / 3600000)} {_isFr ? 'au total' : 'total'}</>;
          })()}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setCurrentStep(0)} style={{ minHeight: 44, padding: '8px 16px', border: `1px solid ${D.border}`, borderRadius: 10, background: D.warm }}>
          {overviewLabel}
        </button>
        <button type="button" onClick={() => {
          let next = 1;
          while (doneSteps.has(next) && stepRefs.current[next + 1]) next++;
          if (phase) {
            const candidates = stepRefs.current.flatMap((el, index) => el?.dataset.guidePhase === phase ? [index] : []);
            next = candidates.find(index => !doneSteps.has(index)) ?? candidates[0] ?? next;
          }
          setCurrentStep(next);
        }} style={{ minHeight: 44, padding: '8px 16px', border: `1px solid ${D.border}`, borderRadius: 10, background: D.warm }}>
          {_isFr ? 'Reprendre' : 'Current step'}
        </button>
      </div>
            {/* Executive summary — phase strip from the old protocole */}
      {currentStep === 0 && !phase && <PhaseSummary schedule={schedule} numItems={numItems} />}

      {/* ── STEP: Make Poolish / Biga ───────────────── */}
      {hasPref && prefStartTime && (
        <StepCard number={n()} {...sc()} icon={<IconPreferment />}
          title={isPoolish ? t('stepTitles.makePoolish') : t('stepTitles.makeBiga')}
          time={prefStartTime} accent={D.gold}>

          {recipe?.preferment && (() => {
            const { prefFlour, prefWater, prefYeastGrams } = recipe.preferment!;
            const parts = [
              `${Math.round(prefFlour)}g ${l === 'fr' ? 'de farine' : 'flour'}`,
              `${Math.round(prefWater)}g ${l === 'fr' ? 'd’eau' : 'water'}`,
              prefYeastGrams > 0 ? `${formatPrefermentDose(prefYeastGrams)} ${l === 'fr' ? 'de levure' : 'yeast'}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: D.smoke, marginBottom: '8px' }}>
                {parts}
              </div>
            );
          })()}

        <Section icon="" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              {bold:l === 'fr' ? 'Pesez la farine, l’eau et la levure indiquées ci-dessus.' : 'Weigh the flour, water and yeast listed above.',
                note:recipe?.preferment ? (l === 'fr' ? `Utilisez ${formatPrefermentDose(recipe.preferment.prefYeastGrams)} de ${rootT(`recipe.yeastNames.${recipe.preferment.prefYeastType ?? 'instant'}`)}.` : `Use ${formatPrefermentDose(recipe.preferment.prefYeastGrams)} ${rootT(`recipe.yeastNames.${recipe.preferment.prefYeastType ?? 'instant'}`)}.`) : ''},
              {bold:isPoolish ? (l === 'fr' ? 'Mélangez jusqu’à disparition de la farine sèche.' : 'Stir until no dry flour remains.') : (l === 'fr' ? 'Mélangez pour humidifier toute la farine ; gardez une texture grumeleuse.' : 'Mix to moisten all the flour; keep a rough, lumpy texture.'),note:''},
              {bold:l === 'fr' ? 'Couvrez le récipient et laissez de la place pour la levée.' : 'Cover the container and leave room for expansion.',note:''},
              {bold:recipe?.preferment?.cold ? (l === 'fr' ? 'Placez au réfrigérateur selon ce planning.' : 'Refrigerate according to this plan.') : (l === 'fr' ? 'Laissez à température ambiante selon ce planning.' : 'Leave at room temperature according to this plan.'),
                note:l === 'fr' ? `Mélange final prévu : ${formatTime(bgMixStart, _fmtLocale)}. Vérifiez la maturité avant utilisation.` : `Main mix planned: ${formatTime(bgMixStart, _fmtLocale)}. Check maturity before use.`},
            ]} />
          </Section>

          <p style={{fontSize:16,lineHeight:1.5}}><strong>{l==='fr'?'Prêt quand : ':'Ready when: '}</strong>{isPoolish ? (l==='fr'?'La surface est bulleuse et commence à s’aplanir après la levée.':'The surface is bubbly and beginning to flatten after rising.') : (l==='fr'?'La biga a gonflé ; un morceau ouvert montre des alvéoles à l’intérieur.':'The biga has expanded; a broken-open piece shows aeration inside.')}</p>
          <StepVisual kind={isPoolish ? 'poolish' : 'biga'} locale={l} />
          <StepExtras
            tips={<p>{l === 'fr' ? 'Fiez-vous aux quantités et à l’emplacement de cette recette. Si la maturité ne correspond pas au planning, revoyez le planning avant de poursuivre.' : 'Use this recipe’s quantities and planned location. If maturity does not match the schedule, review the plan before continuing.'}</p>}
            faqOverride={[
              {q:{en:'Should I change the yeast dose?',fr:'Faut-il changer la dose de levure ?'},a:{en:'Use the measured dose shown for this preferment and the selected yeast type. Do not replace it with a generic pinch or percentage.',fr:'Utilisez la dose indiquée pour ce préferment et le type de levure choisi. Ne la remplacez pas par une pincée ou un pourcentage générique.'}},
              {q:{en:'What should I check before mixing?',fr:'Que vérifier avant le mélange final ?'},a:{en:isPoolish?'Check for bubbles and a risen surface beginning to flatten; use the visual guide below.':'Break a piece open and look for internal aeration; use the visual guide below.',fr:isPoolish?'Observez les bulles et une surface levée qui commence à s’aplanir ; consultez les signes illustrés.':'Ouvrez un morceau et observez les alvéoles à l’intérieur ; consultez les signes illustrés.'}},
            ]}
            coachStepId={isPoolish ? 'poolish' : 'biga'}
            coachTitle={isPoolish ? t('stepTitles.makePoolish') : t('stepTitles.makeBiga')}
            recipeContext={maestroRecipeContext}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
        </StepCard>
      )}

      {isSourdough && starterEvents?.filter(event => !event.isPast && !['last_fed', 'known_peak'].includes(event.kind)).map((event, index) => {
        const feeding = ['refresh', 'intermediate_refresh', 'pre_mix'].includes(event.kind);
        const title = feeding ? (l === 'fr' ? 'Rafraîchir le levain' : 'Feed your starter') : event.kind === 'fridge_in' ? (l === 'fr' ? 'Réfrigérer le levain' : 'Refrigerate your starter') : (l === 'fr' ? 'Sortir le levain du réfrigérateur' : 'Take starter out of the fridge');
        return <StepCard key={`${event.kind}-${index}`} number={n()} {...sc()} icon={<IconStarter />} title={title} time={new Date(Math.round(event.time.getTime() / 900000) * 900000)} accent="#6A7FA8">
          <Section icon="" title={t('sectionTitles.whatToDo')}>
            <Steps items={feeding ? [
              {bold: l === 'fr' ? `Mélangez ${feedSeed} g de levain, ${feedPart} g de farine et ${feedPart} g d’eau.` : `Mix ${feedSeed} g starter, ${feedPart} g flour and ${feedPart} g water.`, note: `1:${feedR}:${feedR}`},
              {bold: l === 'fr' ? 'Couvrez le récipient et marquez le niveau.' : 'Cover the container and mark the level.', note: l === 'fr' ? `Laissez à ${displayTemp(kitchenTemp, u)}.` : `Keep at ${displayTemp(kitchenTemp, u)}.`},
              {bold: l === 'fr' ? 'Attendez une nette montée, des bulles et un dessus encore bombé avant utilisation.' : 'Wait for a clear rise, bubbles and a still-domed top before use.', note: l === 'fr' ? 'Le créneau suivant reste indicatif : vérifiez le levain.' : 'The next time is a guide: check the starter.'},
            ] : [{bold: event.kind === 'fridge_in' ? (l === 'fr' ? 'Couvrez le récipient et placez le levain au réfrigérateur.' : 'Cover the container and put the starter in the fridge.') : (l === 'fr' ? 'Sortez le récipient et laissez-le couvert à température ambiante.' : 'Take the container out and leave covered at room temperature.'), note: event.kind === 'fridge_in' ? displayTemp(fridgeTemp, u) : displayTemp(kitchenTemp, u)}]} />
          </Section>
          {feeding && <StepVisual kind="starter" locale={l} />}
          <StepExtras tips={<p>{l === 'fr' ? 'S’il s’est affaissé, rafraîchissez à nouveau et ajustez le planning.' : 'If it has collapsed, feed again and adjust the schedule.'}</p>} faqKey="starter" coachStepId="starter" coachTitle={title} recipeContext={maestroRecipeContext} styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType} />
        </StepCard>;
      })}

      {/* ── STEP: Feed Starter (sourdough) ──────────── */}
      {isSourdough && !starterEvents?.length && feedTime && (
        <>
          {/* Feed 1 */}
          <StepCard
            number={n()} {...sc()} icon={<IconStarter />}
            title={l === 'fr' ? (usingPeak2 ? 'Rafraîchir le levain — premier repas' : 'Rafraîchir le levain') : (usingPeak2 ? 'Feed your starter — first feed' : 'Feed your starter')}
            time={feedTime}
            accent="#6A7FA8"
          >
            <Section icon={null} title={t('sectionTitles.whatToDo')}>
              <Steps items={[
                { bold: feedR === 1
                    ? (l === 'fr' ? 'Levain, farine et eau à parts égales (au poids)' : 'Equal parts starter, flour, water by weight')
                    : (l === 'fr' ? `Rafraîchissez au ratio recommandé 1:${feedR}:${feedR}` : `Feed at the recommended 1:${feedR}:${feedR} ratio`),
                  note: (l === 'fr'
                    ? `ratio 1:${feedR}:${feedR} — ${feedSeed}g de levain + ${feedPart}g de farine + ${feedPart}g d’eau (≈${feedTotal}g${bgSdMid > 0 ? `, la recette en demande ${bgSdMid}g` : ''})`
                    : `1:${feedR}:${feedR} ratio — ${feedSeed}g starter + ${feedPart}g flour + ${feedPart}g water (≈${feedTotal}g${bgSdMid > 0 ? `, the recipe calls for ${bgSdMid}g` : ''})`) },
                { bold: (l === 'fr' ? 'Mélangez jusqu’à ce qu’il ne reste plus de farine sèche' : 'Mix until no dry flour remains'),
                  note: (l === 'fr' ? 'couvrez sans fermer — le levain a besoin d’air' : 'cover loosely — starter needs airflow') },
                ...(starterState === 'fridge_fed'
                  ? [{ bold: (l === 'fr' ? 'Remettez au frigo une fois mélangé' : 'Return to fridge once mixed'),
                       note: (l === 'fr' ? 'ralentit le pic — vous contrôlez le moment où il sera prêt' : 'slows the peak — gives you control over when it is ready') }]
                  : []),
              ]} />
            </Section>
            <StepExtras
              tips={<>
                <Section icon={null} title={t('sectionTitles.readyWhen')}>
                  <Bullets items={[
                    `At ${displayTemp(kitchenTemp, u)}: peaks in ${(() => {
                      const peakH = getPrefPeakH_RT(
                        'sourdough', kitchenTemp, styleKey ?? 'neapolitan'
                      );
                      const ratioMult = 1 + 0.5 * Math.log(feedRatio);
                      const adj = peakH
                        * (starterMature ? 1.0 : 1.2)
                        * (starterHasRye ? 0.8 : 1.0)
                        * ratioMult;
                      return `${Math.round(adj * 0.8)}–${Math.round(adj * 1.2)}h`;
                    })()}`,
                    'Doubled or more in volume',
                    'Dome-shaped surface, not yet collapsed',
                    'Bubbles visible through the sides of the jar',
                    'Smells pleasantly sour, not alcoholic',
                  ]} />
                </Section>
                <Section icon={null} title={t('sectionTitles.pitfalls')}>
                  <Bullets items={t.raw('starter.pitfalls') as string[]} />
                </Section>
                <div style={{ marginTop: '8px' }}>
                  <LearnLink
                    term="preferment_ready"
                    label={l === 'fr' ? 'Est-il prêt ?' : 'Is it ready?'}
                    onOpen={setLearnTerm}
                    showSparkle={true}
                  />
                </div>
              </>}
              faqKey="starter"
              coachStepId="starter"
              coachTitle={usingPeak2 ? 'Feed your starter — first feed' : 'Feed your starter'}
              recipeContext={maestroRecipeContext}
              styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
            />
          </StepCard>

          {/* Put starter in fridge — fridge_fed state only */}
          {starterState === 'fridge_fed' && (
            <StepCard
              number={n()} {...sc()} icon={<IconCold />}
              title={l === 'fr' ? 'Mettre le levain au frigo' : 'Put starter in fridge'}
              time={feedTime}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: (l === 'fr' ? 'Placez le levain rafraîchi au frigo immédiatement' : 'Place fed starter in fridge straight away'),
                    note: (l === 'fr' ? 'le froid ralentit la fermentation et prolonge le pic' : 'cold slows fermentation and holds the peak for longer') },
                  { bold: fridgeOutTime
                      ? `Take out at ${fridgeOutTime.toLocaleTimeString(
                          l === 'fr' ? 'fr-FR' : 'en-US',
                          { hour: 'numeric', minute: '2-digit', hour12: l !== 'fr' }
                        )}`
                      : 'Take out when ready to mix',
                    note: (l === 'fr' ? 'laissez-le revenir à température ambiante avant le pétrissage' : 'allow time to come to room temperature before mixing') },
                ]} />
              </Section>
            </StepCard>
          )}

          {/* Remove from fridge — fridge_fed state with fridgeOutTime */}
          {starterState === 'fridge_fed' && fridgeOutTime && (
            <StepCard
              number={n()} {...sc()} icon={<IconStarter />}
              title={l === 'fr' ? 'Sortir le levain du frigo' : 'Remove starter from fridge'}
              time={fridgeOutTime}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: (l === 'fr' ? 'Sortez du frigo et laissez à température ambiante' : 'Take out of fridge and leave at room temperature'),
                    note: l === 'fr'
                      ? `à ${displayTemp(kitchenTemp, u)}, comptez environ ${Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60)} min pour retrouver son activité maximale`
                      : `at ${displayTemp(kitchenTemp, u)} allow around ${Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60)} min to reach peak activity` },
                  { bold: (l === 'fr' ? 'Cherchez le dôme et des bulles actives sur les côtés' : 'Look for dome and active bubbles at the sides'),
                    note: (l === 'fr' ? 'pétrissez quand le levain est à son point le plus haut' : 'mix when the starter is at its highest point') },
                ]} />
              </Section>
            </StepCard>
          )}

          {/* Feed 2 — Peak 2 scenario only */}
          {usingPeak2 && feed2Time && (
            <StepCard
              number={n()} {...sc()} icon={<IconStarter />}
              title={l === 'fr' ? 'Rafraîchir le levain — deuxième repas' : 'Feed your starter — second feed'}
              time={feed2Time}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: (l === 'fr' ? 'Le levain semblera retombé et sentira assez acide' : 'Starter will look deflated and smell quite sour'),
                    note: (l === 'fr' ? 'c’est exactement ça — il est épuisé et prêt pour son second rafraîchi' : 'this is exactly right — it is depleted and ready for its second feed') },
                  { bold: feedR === 1
                    ? (l === 'fr' ? 'Levain, farine et eau à parts égales (au poids)' : 'Equal parts starter, flour, water by weight')
                    : (l === 'fr' ? `Rafraîchissez au ratio recommandé 1:${feedR}:${feedR}` : `Feed at the recommended 1:${feedR}:${feedR} ratio`),
                    note: (l === 'fr' ? `même ratio 1:${feedR}:${feedR} que le premier rafraîchi — mêmes quantités` : `same 1:${feedR}:${feedR} ratio as the first feed — same amounts`) },
                  { bold: (l === 'fr' ? 'Mélangez bien et couvrez sans fermer' : 'Mix thoroughly and cover loosely'),
                    note: (l === 'fr' ? 'le second pic développe plus d’acidité — goût plus marqué et complexe' : 'the second peak builds more acidity — expect a stronger, more complex flavour') },
                ]} />
              </Section>
              <StepExtras
                tips={
                  <Section icon={null} title={t('sectionTitles.readyWhen')}>
                    <Bullets items={[
                      l === 'fr' ? 'Mêmes signes qu’au premier repas : dôme, volume doublé, bulles sur les côtés' : 'Same signs as the first feed — dome, doubled, bubbles at the sides',
                      l === 'fr' ? 'Le goût sera légèrement plus acide qu’au premier pic' : 'Flavour will be slightly more sour than the first peak',
                      l === 'fr' ? 'Mélangez au dôme — n’attendez pas qu’il retombe' : 'Mix at the dome — do not wait for it to collapse',
                    ]} />
                  </Section>
                }
                faqKey="starter"
                coachStepId="starter"
                coachTitle="Feed your starter — second feed"
                recipeContext={maestroRecipeContext}
                styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
              />
            </StepCard>
          )}
        </>
      )}

      {/* ── STEP: Soak the seeds (pain aux graines only) ── */}
      {addSeeds && (
      <StepCard number={n()} {...sc()} icon={<IconPreferment />}
        title={l === 'fr' ? 'Tremper les graines' : 'Soak the seeds'}
        time={new Date(bgMixStart.getTime() - 8 * 3600000)} duration={null} accent={D.gold}>
        <Section icon="" title={t('sectionTitles.whatToDo')}>
          <Steps items={[
            { bold: l === 'fr'
                ? `Pesez ${recipe ? Math.round((recipe.preferment ? recipe.preferment.finalFlour : recipe.flour) * 0.18) + 'g' : '15–20% du poids de farine'} de graines (lin, tournesol, sésame, courge…)`
                : `Weigh ${recipe ? Math.round((recipe.preferment ? recipe.preferment.finalFlour : recipe.flour) * 0.18) + 'g' : '15–20% of flour weight'} of seeds (flax, sunflower, sesame, pumpkin seed…)`,
              note: l === 'fr' ? 'toastez-les légèrement à sec pour plus de goût (facultatif)' : 'lightly dry-toast for more flavour (optional)' },
            { bold: l === 'fr'
                ? 'Couvrez-les d’eau à poids égal — le trempage'
                : 'Cover with an equal weight of water — the soaker',
              note: l === 'fr'
                ? 'des graines sèches boiraient l’eau de la pâte et donneraient une mie sèche — trempées, elles arrivent déjà gorgées'
                : 'dry seeds would drink water out of the dough and dry the crumb — soaked, they arrive already saturated' },
            { bold: l === 'fr' ? 'Laissez tremper 2h minimum — idéalement la veille' : 'Soak 2h minimum — ideally overnight',
              note: l === 'fr' ? 'couvert, à température ambiante' : 'covered, at room temperature' },
            { bold: l === 'fr' ? 'Égouttez l’excédent avant le pétrissage' : 'Drain any excess before mixing',
              note: l === 'fr' ? 'les graines doivent être humides, pas ruisselantes' : 'seeds should be moist, not dripping' },
          ]} />
          <div style={{ fontSize: '12px', color: D.smoke, fontFamily: 'var(--font-ui)', lineHeight: 1.55, marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${D.border}` }}>
            {l === 'fr'
              ? 'Au pétrissage : incorporez les graines égouttées en toute fin, à petite vitesse ou à la main, juste assez pour les répartir.'
              : 'At mix time: fold the drained seeds in at the very end, low speed or by hand, just enough to distribute them.'}
          </div>
        </Section>
      </StepCard>
      )}

      {/* ── STEP: Mix Dough ─────────────────────────── */}
      <StepCard number={n()} {...sc(true)} icon={<IconMix />} title={t('stepTitles.mixDough')}
        time={bgMixStart} duration={schedule.mixingDurationH} accent={D.ash}>

        {batch && <Section icon="" title={batch.count > 1 ? (l === 'fr' ? `Pétrissée ${batch.active + 1} sur ${batch.count}` : `Batch ${batch.active + 1} of ${batch.count}`) : (l === 'fr' ? 'À mélanger' : 'Use now')}>
          {Object.entries(batch.portion).filter(([key,grams]) => grams > 0 && !(key === 'flour' && recipe?.flourParts?.length)).map(([key,grams]) => <div key={key} style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{({milk:l==='fr'?'Lait':'Milk',eggs:l==='fr'?'Œufs sans coquille':'Eggs, without shells',butter:l==='fr'?'Beurre':'Butter',flour:l==='fr'?'Farine':'Flour',water:l==='fr'?'Eau':'Water',salt:l==='fr'?'Sel':'Salt',oil:l==='fr'?'Huile':'Oil',sugar:l==='fr'?'Sucre':'Sugar',yeast:l==='fr'?'Levure':'Yeast',starter:l==='fr'?'Levain':'Starter',preferment:prefermentType ?? 'Preferment'} as Record<string,string>)[key]}</span><strong>{grams} g</strong></div>)}
          {!!recipe?.flourParts?.length && (() => {
            let remainder = batch.portion.flour;
            return recipe.flourParts.map((part,index) => {
              const grams = index === recipe.flourParts!.length - 1 ? remainder : Math.round(batch.portion.flour * part.pct / 100);
              remainder -= grams;
              return <div key={part.key} style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{l === 'fr' ? part.nameFr : part.name}</span><strong>{grams} g</strong></div>;
            });
          })()}
          {batch.overCapacity && <p role="alert">{l === 'fr' ? 'Cette quantité dépasse la capacité indiquée du pétrin. Augmentez le nombre de pétrissées dans les réglages du matériel.' : 'This batch exceeds the stated mixer capacity. Increase batches in equipment settings.'}</p>}
          {batch.count > 1 && <p>{l === 'fr' ? (hasPref ? 'Préparez le préferment une seule fois. Chaque pétrissée utilise sa part indiquée.' : 'Répétez ce mélange pour chaque pétrissée.') : hasPref ? 'Prepare the preferment once. Add only the portion listed for this batch.' : 'Repeat this mix for each batch.'}</p>}
        </Section>}
          {!enriched && !(simpleMode && recipe?.waterTemp == null) && (
        <Section icon="" title={t('sectionTitles.waterTemp')}>
          {recipe?.waterTemp != null && bgMainWater != null && <WaterPreparation readOnly
            waterGrams={bgMainWater} targetTemp={recipe.waterTemp} kitchenTemp={kitchenTemp}
            fridgeTemp={fridgeTemp} locale={l} units={u} source={waterSource} onSourceChange={onWaterSourceChange} measuredWaterTemp={measuredWaterTemp} onMeasuredWaterTempChange={onMeasuredWaterTempChange} waterMethod={waterMethod} onWaterMethodChange={onWaterMethodChange} spiralIceConfirmed={spiralIceConfirmed} onSpiralIceConfirmedChange={onSpiralIceConfirmedChange} targetDoughTemp={recipe.thermal?.targetDoughTemp} achievedDoughTempC={recipe.thermal?.doughTempC} waterWasClamped={recipe.thermal?.waterWasClamped} idealWaterTemp={recipe.thermal?.idealWaterTemp} directIceSupported={mixerType === 'spiral' && recipe.oil === 0 && recipe.sugar === 0 && !['brioche','pain_mie','pain_viennois'].includes(styleKey)} />}
        </Section>
        )}

        <Section icon="" title={t('sectionTitles.whatToDo')}>
          <Steps items={enriched ? [
            {bold:l==='fr'?'Pesez tous les ingrédients indiqués.':'Weigh all the listed ingredients.',note:l==='fr'?'Pesez les œufs sans coquille.':'Weigh eggs without shells.'},
            {bold:l==='fr'?'Mélangez sans le beurre jusqu’à ce que la pâte gagne en tenue.':'Mix without the butter until the dough begins to gain strength.',note:''},
            {bold:l==='fr'?'Ajoutez le beurre souple progressivement ; laissez chaque ajout s’incorporer.':'Add softened butter gradually; let each addition incorporate.',note:''},
          ] : [
            {bold:l==='fr'?'Pesez les ingrédients de cette pétrissée indiqués ci-dessus.':'Weigh this batch’s ingredients shown above.',note:recipe?.yeast?.yeastType==='active_dry'?(l==='fr'?'Réactivez la levure selon le sachet avec une partie de l’eau mesurée.':'Activate the yeast as directed on its packet using part of the measured water.'):''},
            {bold:hydration>70&&mixerType!=='no_knead'&&styleKey!=='pain_seigle'
              ?(waterMethod==='direct'&&spiralIceConfirmed&&mixerType==='spiral'?(l==='fr'?'Mélangez la farine avec 90 % de l’eau liquide prévue ; réservez le reste. Ajoutez la glace mesurée au pétrissage si elle est indiquée ci-dessus.':'Combine flour with 90% of the planned liquid water; reserve the rest. Add the measured ice during mixing if shown above.'):(l==='fr'?'Mélangez la farine avec 90 % de l’eau préparée ; réservez le reste.':'Combine flour with 90% of the prepared water; reserve the rest.'))
              :(l==='fr'?'Mélangez la farine avec l’eau préparée ci-dessus.':'Combine flour with the water preparation shown above.'),note:''},
            ...(!isSourdough && autolyseMinFor(mixerType, styleKey) > 0 ? [{bold:l==='fr'?`Couvrez et laissez reposer ${autolyseMinFor(mixerType, styleKey)} min, comme prévu au planning.`:`Cover and rest ${autolyseMinFor(mixerType, styleKey)} min, as scheduled.`,note:''}] : []),
            {bold:isSourdough?(l==='fr'?'Incorporez le levain mûr et le sel.':'Incorporate the ripe starter and salt.'):hasPref?(l==='fr'?`Incorporez votre ${prefermentType} préparé, puis le sel.`:`Incorporate the prepared ${prefermentType}, then the salt.`):(l==='fr'?'Incorporez la levure et le sel.':'Incorporate the yeast and salt.'),note:''},
            ...(hydration>70&&mixerType!=='no_knead'&&styleKey!=='pain_seigle'?[{bold:l==='fr'?'Quand la pâte se tient, ajoutez progressivement l’eau réservée ; laissez chaque ajout s’incorporer.':'Once the dough holds together, add the reserved water gradually; let each addition absorb.',note:''}]:[]),
            {bold:mixerType==='no_knead'?(l==='fr'?'Arrêtez une fois homogène. Couvrez ; les repos et rabats prévus développeront la pâte.':'Stop once combined. Cover; scheduled rests and folds develop the dough.'):styleKey==='pain_seigle'?(l==='fr'?'Mélangez jusqu’à homogénéité ; le seigle reste collant.':'Mix until evenly combined; rye dough remains sticky.'):mixerType==='hand'?(l==='fr'?'Pétrissez à la main jusqu’à une pâte homogène et élastique.':'Knead by hand until cohesive and elastic.'):(l==='fr'?'Pétrissez jusqu’à une pâte homogène et élastique, aux vitesses autorisées par votre pétrin.':'Knead until cohesive and elastic, using only your mixer’s permitted dough speeds.'),note:''},
            ...(recipe && recipe.sugar > 0 ? [{bold:l==='fr'?'Incorporez le sucre mesuré pendant le mélange.':'Incorporate the measured sugar during mixing.',note:''}] : []),
            ...(oil>0?[{bold:l==='fr'?'Ajoutez l’huile mesurée en dernier et mélangez jusqu’à absorption.':'Add the measured oil last and mix until absorbed.',note:''}]:[]),
          ]}/>
        </Section>
        <p style={{fontSize:16,lineHeight:1.5,margin:'16px 0'}}><strong>{l==='fr'?'Prêt quand : ':'Ready when: '}</strong>{mixerType==='no_knead'?(l==='fr'?'Il ne reste aucune farine sèche ; couvrez et poursuivez le repos prévu.':'No dry flour remains; cover and continue the planned rest.'):styleKey==='pain_seigle'?(l==='fr'?'La pâte est homogène, sans farine sèche ; elle peut rester collante.':'Evenly combined, without dry flour; it may stay sticky.'):(l==='fr'?'Il ne reste aucune farine sèche. Vérifiez le développement et la température de la pâte ; toute glace ajoutée doit avoir fondu.':'No dry flour remains. Check dough development and temperature; any added ice must have melted.')}</p>
        {recipe?.blendProfile?.displayName?.includes(' + ') && <p style={{fontSize:15,lineHeight:1.5}}>{l === 'fr'
          ? 'Pesez chaque farine selon les quantités indiquées et mélangez-les pour bien les répartir.'
          : 'Weigh each flour according to the listed amounts, then mix them to distribute evenly.'}</p>}

        <StepExtras
          tips={<>
        <details><summary style={{minHeight:44,padding:'10px 0',cursor:'pointer'}}>{l==='fr'?'Technique de pétrissage · aide':'Mixing technique · help'}</summary>
        <Section icon="" title={t('sectionTitles.mixingOrder')}>
          {enriched && <Steps items={[
            {bold:l === 'fr' ? 'Pesez tous les ingrédients indiqués' : 'Weigh all the listed ingredients',note:l === 'fr' ? 'Pesez les œufs sans coquille. Le lait et les œufs sont des ingrédients distincts de l’eau.' : 'Weigh eggs without shells. Milk and eggs are separate ingredients from plain water.'},
            {bold:l === 'fr' ? 'Mélangez sans le beurre' : 'Mix without the butter',note:l === 'fr' ? 'Incorporez la farine, les liquides, la levure ou le levain, le sel et le sucre. Pétrissez jusqu’à ce que la pâte gagne en tenue.' : 'Combine flour, liquids, yeast or starter, salt and sugar. Mix until the dough begins to gain strength.'},
            {bold:l === 'fr' ? 'Ajoutez le beurre souple progressivement' : 'Add softened butter gradually',note:l === 'fr' ? 'Attendez l’incorporation de chaque ajout. Arrêtez quand la pâte est homogène et élastique ; surveillez son échauffement.' : 'Let each addition incorporate. Stop when the dough is smooth and elastic; monitor warming.'},
          ]} />}
          {!enriched && styleKey === 'pain_seigle' && <p>{l === 'fr' ? 'Mélangez tous les ingrédients indiqués jusqu’à homogénéité, sans farine sèche. Le seigle peut rester collant ; ne recherchez pas une membrane de gluten.' : 'Combine all listed ingredients until even, without dry flour. Rye may remain sticky; do not aim for a gluten windowpane.'}</p>}
          {!enriched && styleKey !== 'pain_seigle' && <>

          {mixerType === 'hand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: autolyse, then yeast+salt, brief knead, then bassinage, then full knead
              { bold: bgFlour90Label, note: (l === 'fr' ? 'mélangez jusqu’à absorption de la farine — ~2 min' : 'mix until no dry flour — ~2 min') },
              { bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: (l === 'fr' ? 'mélangez pour incorporer — 2 min' : 'mix to combine — 2 min') }] : []),
              { bold: bgSaltLabel, note: (l === 'fr' ? 'mélangez jusqu’à absorption — 2 min' : 'mix until absorbed — 2 min') },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'mélangez jusqu’à incorporation complète' : 'mix until fully incorporated') }] : []),
              { bold: (l === 'fr' ? 'Pétrissez 5 min pour bâtir la structure de base' : 'Knead 5 min to build base structure'), note: (l === 'fr' ? 'la pâte doit être cohésive avant d’ajouter le reste de l’eau' : 'dough should feel cohesive before adding remaining water') },
              { bold: bgWater10 ? (l === 'fr' ? `Ajoutez l’eau restante (${bgWater10}g) progressivement` : `Add remaining water (${bgWater10}g) gradually`) : (l === 'fr' ? 'Ajoutez les 10% d’eau restants progressivement' : 'Add remaining 10% water gradually'), note: (l === 'fr' ? 'bassinage — petit filet à la fois, pétrissez jusqu’à absorption, répétez' : 'bassinage — small splash at a time, knead until absorbed, repeat') },
              ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'mélangez 1 min — l’huile ajoutée tard préserve le gluten' : 'mix 1 min — oil added late preserves gluten') }] : []),
              { bold: (l === 'fr' ? 'Continuez à pétrir jusqu’à une pâte lisse et élastique' : 'Continue kneading until smooth and elastic'), note: (l === 'fr' ? 'test de la membrane — en général 5–8 min de plus' : 'windowpane test — typically 5–8 min more') },
            ] : [
              // ≤70%: autolyse, yeast, salt, remaining water, then full knead
              { bold: bgFlour90Label, note: (l === 'fr' ? 'mélangez jusqu’à absorption de la farine — ~2 min' : 'mix until no dry flour — ~2 min') },
              { bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: (l === 'fr' ? 'mélangez pour incorporer — 2 min' : 'mix to combine — 2 min') }] : []),
              { bold: bgSaltLabel, note: (l === 'fr' ? 'mélangez jusqu’à absorption — 2 min' : 'mix until absorbed — 2 min') },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'mélangez jusqu’à incorporation complète' : 'mix until fully incorporated') }] : []),
              { bold: bgWater10Label, note: (l === 'fr' ? 'mélangez jusqu’à absorption — ~1 min' : 'mix until absorbed — ~1 min') },
              ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'mélangez 1 min — l’huile ajoutée tard préserve le gluten' : 'mix 1 min — oil added late preserves gluten') }] : []),
              { bold: (l === 'fr' ? 'Pétrissez 8–12 min jusqu’à une pâte lisse et élastique' : 'Knead 8–12 min until smooth and elastic'), note: (l === 'fr' ? 'test de la membrane' : 'windowpane test') },
            ]} />
          )}
          {mixerType === 'stand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: build structure first, then bassinage, then final Speed 2
              { bold: bgFlour90Label, note: (l === 'fr' ? 'Vitesse 1, 2 min pour incorporer' : 'Speed 1, 2 min to combine') },
              ...(autolyseMinFor(mixerType, styleKey) > 0 ? [{ bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] }] : []),
              ...(!hasPref ? [{ bold: bgYeastLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min' : 'Speed 1, 2 min') }] : []),
              { bold: bgSaltLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min jusqu’à absorption' : 'Speed 1, 2 min until absorbed') },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'Vitesse 1, mélangez jusqu’à incorporation' : 'Speed 1, mix until incorporated') }] : []),
              { bold: (l === 'fr' ? 'Vitesse 2 — 4–5 min' : 'Speed 2 — 4–5 min'), note: (l === 'fr' ? 'bâtit le gluten avant l’ajout du reste de l’eau' : 'build gluten structure before adding remaining water') },
              { bold: bgWater10 ? (l === 'fr' ? `Ajoutez l’eau restante (${bgWater10}g) progressivement à Vitesse 2` : `Add remaining water (${bgWater10}g) gradually at Speed 2`) : (l === 'fr' ? 'Ajoutez les 10% d’eau restants progressivement à Vitesse 2' : 'Add remaining 10% water gradually at Speed 2'), note: (l === 'fr' ? 'bassinage — petits ajouts, attendez l’absorption entre chaque' : 'bassinage — small additions, wait for absorption between each') },
              { bold: (l === 'fr' ? 'Continuez à Vitesse 2' : 'Continue Speed 2'), note: (l === 'fr' ? 'jusqu’à ce que la pâte se décolle du bol — test de la membrane' : 'until dough clears the bowl — windowpane test') },
              ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'Vitesse 1, 1 min' : 'Speed 1, 1 min') }] : []),
            ] : [
              // ≤70%: remaining water before Speed 2
              { bold: bgFlour90Label, note: (l === 'fr' ? 'Vitesse 1, 2 min pour incorporer' : 'Speed 1, 2 min to combine') },
              ...(autolyseMinFor(mixerType, styleKey) > 0 ? [{ bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] }] : []),
              ...(!hasPref ? [{ bold: bgYeastLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min' : 'Speed 1, 2 min') }] : []),
              { bold: bgSaltLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min jusqu’à absorption' : 'Speed 1, 2 min until absorbed') },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'Vitesse 1, mélangez jusqu’à incorporation' : 'Speed 1, mix until incorporated') }] : []),
              { bold: bgWater10Label, note: l === 'fr' ? 'Vitesse 1, jusqu’à absorption — environ 1 min' : 'Speed 1, mix until absorbed — about 1 min' },
              { bold: l === 'fr' ? 'Vitesse 2 — 6–10 min' : 'Speed 2 — 6–10 min', note: (l === 'fr' ? 'jusqu’à ce que la pâte se décolle du bol — test de la membrane' : 'until dough clears the bowl — windowpane test') },
              ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'Vitesse 1, 1 min' : 'Speed 1, 1 min') }] : []),
            ]} />
          )}
          {mixerType === 'spiral' && !isSourdough && (
            <>
              <Steps items={hydration > 70 ? [
                // >70%: pumpkin first, bassinage after
                { bold: bgMainFlour && bgWater90 ? (l === 'fr' ? `${bgMainFlour}g de farine + ${bgWater90}g d’eau (90%)${!isSourdough && !hasPref ? ' + levure' : ''}` : `${bgMainFlour}g flour + ${bgWater90}g water (90%)${!isSourdough && !hasPref ? ' + yeast' : ''}`) : (l === 'fr' ? 'Farine + 90% de votre eau' : 'Flour + 90% of your water'), note: (l === 'fr' ? 'Vitesse 1, 3 min pour incorporer' : 'Speed 1, 3 min to combine') },
                ...(autolyseMinFor(mixerType, styleKey) > 0 ? [{ bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] }] : []),
                ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'Vitesse 1, mélangez jusqu’à incorporation' : 'Speed 1, mix until incorporated') }] : []),
                { bold: bgSaltLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min' : 'Speed 1, 2 min') },
                { bold: (l === 'fr' ? 'Vitesse 2 jusqu’à la forme de citrouille' : 'Speed 2 until pumpkin shape forms'), note: l === 'fr' ? `en général 10–15 min — arrêtez si la FDT dépasse ${tempC(28, u)}` : `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                { bold: bgWater10 ? (l === 'fr' ? `Citrouille stable — ajoutez l’eau restante (${bgWater10}g) progressivement` : `Once pumpkin is stable — add remaining water (${bgWater10}g) gradually`) : (l === 'fr' ? 'Citrouille stable — ajoutez les 10% d’eau restants progressivement' : 'Once pumpkin is stable — add remaining 10% water gradually'), note: (l === 'fr' ? 'bassinage — petits ajouts, attendez que la citrouille se reforme à chaque fois' : 'bassinage — small additions, wait for pumpkin to reform each time') },
                ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'Vitesse 1, 1 min' : 'Speed 1, 1 min') }] : []),
              ] : [
                // ≤70%: remaining water before Speed 2
                { bold: bgMainFlour && bgWater90 ? (l === 'fr' ? `${bgMainFlour}g de farine + ${bgWater90}g d’eau (90%)${!isSourdough && !hasPref ? ' + levure' : ''}` : `${bgMainFlour}g flour + ${bgWater90}g water (90%)${!isSourdough && !hasPref ? ' + yeast' : ''}`) : (l === 'fr' ? 'Farine + 90% de votre eau' : 'Flour + 90% of your water'), note: (l === 'fr' ? 'Vitesse 1, 3 min pour incorporer' : 'Speed 1, 3 min to combine') },
                ...(autolyseMinFor(mixerType, styleKey) > 0 ? [{ bold: (l === 'fr' ? `Couvrez et laissez reposer ${AUTOLYSE_MIN} min` : `Cover and rest ${AUTOLYSE_MIN} min`), note: AUTOLYSE_NOTE[l] }] : []),
                ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'Vitesse 1, mélangez jusqu’à incorporation' : 'Speed 1, mix until incorporated') }] : []),
                { bold: bgSaltLabel, note: (l === 'fr' ? 'Vitesse 1, 2 min' : 'Speed 1, 2 min') },
                { bold: bgWater10Label, note: l === 'fr' ? 'Vitesse 1, jusqu’à absorption — environ 1 min' : 'Speed 1, mix until absorbed — about 1 min' },
                { bold: (l === 'fr' ? 'Vitesse 2 jusqu’à la forme de citrouille' : 'Speed 2 until pumpkin shape forms'), note: l === 'fr' ? `en général 10–15 min — arrêtez si la FDT dépasse ${tempC(28, u)}` : `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'Vitesse 1, 1 min' : 'Speed 1, 1 min') }] : []),
              ]} />

            </>
          )}
          {mixerType === 'no_knead' && (
            <Steps items={[
              { bold: (l === 'fr' ? 'Mélangez tous les ingrédients, sel compris' : 'Combine all ingredients including salt'), note: (l === 'fr' ? 'mélangez juste jusqu’à absorption de la farine — ~2 min' : 'mix just until no dry flour remains — ~2 min') },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: (l === 'fr' ? 'mélangez jusqu’à incorporation' : 'mix until incorporated') }] : []),
              { bold: (l === 'fr' ? 'Couvrez et laissez reposer' : 'Cover and rest'), note: (l === 'fr' ? 'rabats toutes les 30 min pendant les 2 premières heures' : 'stretch & folds every 30 min for the first 2 hours') },
            ]} />
          )}
          {isSourdough && (
            <>
              <Steps items={[
                { bold: bgFlour90Label, note: (l === 'fr' ? 'mélangez 2 min jusqu’à absorption' : 'mix 2 min until no dry flour') },
                { bold: (l === 'fr' ? 'Ajoutez votre levain au pic' : 'Add your starter at peak'),
                  note: usingPeak2
                    ? (l === 'fr' ? 'second pic — la pâte aura un goût un peu plus complexe' : 'second peak — the dough will have a slightly more complex flavour')
                    : (l === 'fr' ? 'utilisez au dôme, n’attendez pas la retombée' : 'use at the dome, do not wait for collapse') },
                { bold: bgSaltG && bgWater10 ? (l === 'fr' ? `Ajoutez le sel (${bgSaltG}g) + l’eau restante (${bgWater10}g)` : `Add salt (${bgSaltG}g) + remaining water (${bgWater10}g)`) : (l === 'fr' ? 'Ajoutez le sel + les 10% d’eau restants' : 'Add salt + remaining 10% water'), note: (l === 'fr' ? 'mélangez jusqu’à absorption complète' : 'mix until fully absorbed') },
                ...(oil > 0 ? [{ bold: (l === 'fr' ? 'Ajoutez l’huile en dernier' : 'Add oil last'), note: (l === 'fr' ? 'préserve la structure du gluten' : 'preserves gluten structure') }] : []),
              ]} />
              {planningMode === 'know_peak' && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: D.smoke, fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                  {l === 'fr' ? 'L’heure de pétrissage est calée sur le pic indiqué — ajustez si votre levain pique plus tôt ou plus tard que prévu.' : 'Mix time is set to your stated peak — adjust if your starter peaks earlier or later than expected.'}
                </div>
              )}
              <div style={{
                fontSize: '12px',
                color: D.smoke,
                fontFamily: 'var(--font-ui)',
                lineHeight: 1.55,
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: `1px solid ${D.border}`,
              }}>
                {l === 'fr'
                  ? 'Après avoir prélevé votre levain, rafraîchissez le reste et remettez-le au frigo.'
                  : 'After taking your starter for this bake, feed what remains and return it to the fridge.'}
              </div>
            </>
          )}
          </>}
        </Section>

        </details>


            {(() => {
              const parts = recipe?.blendProfile?.displayName?.split(' + ') ?? [];
              if (parts.length < 2) return null;
              return (
                <Section icon={null} title={l === 'fr' ? 'Questions sur le mélange' : 'About blending'}>
                  <Bullets items={l === 'fr' ? [
                    'Suivez les quantités de chaque farine indiquées dans la recette, y compris pour le préferment.',
                    'Si vous changez de farine, mettez à jour vos choix et recalculez la recette.',
                  ] : [
                    'Follow the listed amounts for each flour, including in the preferment.',
                    'If you change a flour, update your choices and recalculate the recipe.',
                  ]} />
                </Section>
              );
            })()}
            {!simpleMode && (
            <Section icon="" title={t('sectionTitles.waterTemp')}>
              <Bullets items={[
                ...(t.raw('mix.waterTempBullets') as string[]),
                (l === 'fr' ? 'Comparez la température mesurée à la cible de cette recette et réévaluez le planning si la pâte est plus chaude ; un bref passage au froid ne refroidit pas immédiatement son centre.' : 'Compare measured dough temperature with this recipe’s target and reassess timing if warmer; a brief chill does not immediately cool its centre.'),
              ]} />
              <div style={{ marginTop: '8px' }}>
                <LearnLink term="fdt" label={l === 'fr' ? 'Qu’est-ce que la FDT ?' : 'What is FDT?'} onOpen={setLearnTerm} />
              </div>
            </Section>
            )}
            <Section icon="" title={t('sectionTitles.watchFor')}>
              <Bullets items={[
                mixerType === 'spiral'
                  ? t('mix.watchForPumpkin')
                  : t('mix.watchForSmooth'),
                ...(t.raw('mix.watchForAll') as string[]),
              ]} />
              <div style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <LearnLink term="windowpane" label={l === 'fr' ? 'Test de la membrane' : 'Windowpane test'} onOpen={setLearnTerm} showSparkle={true} />
                {mixerType === 'hand' && !isSourdough && <LearnLink term="autolyse" label="Autolyse" onOpen={setLearnTerm} />}
                {isSpiral && <LearnLink term="pumpkin" label={l === 'fr' ? 'Forme citrouille' : 'Pumpkin shape'} onOpen={setLearnTerm} />}
                {hydration > 70 && <LearnLink term="bassinage" label="Bassinage" onOpen={setLearnTerm} />}
              </div>
            </Section>
            <Section icon={null} title={t('sectionTitles.pitfalls')}>
              <Bullets items={[
                ...(t.raw('mix.pitfalls') as string[]).slice(0, 2),
                isSpiral ? (l === 'fr' ? `FDT ignorée — les pétrins à spirale chauffent, la pâte peut dépasser ${tempC(28, u)} sans qu’on s’en aperçoive` : `Ignoring FDT — spiral mixers generate heat, dough can exceed ${tempC(28, u)} without noticing`) : '',
                (t.raw('mix.pitfalls') as string[])[2],
              ].filter(Boolean)} />
            </Section>
          </>}
          faqKey="mix"
          coachStepId="mix"
          coachTitle={t('stepTitles.mixDough')}
          recipeContext={maestroRecipeContext}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />
        {styleKey !== 'pain_seigle' && mixerType !== 'no_knead' && <StepVisual kind="mix" includeSpiral={mixerType === 'spiral'} locale={l} />}

      </StepCard>

      {/* ── STEP: Bulk Fermentation ──────────────────── */}
      <StepCard number={n()} {...sc()} icon={<IconBulk />} title={t('stepTitles.bulkFerm')}
        time={schedule.bulkFermStart} duration={schedule.bulkFermHours} accent={D.terra}>

        <Section icon="" title={t('sectionTitles.whatToDo')}>
          {breadProtocol ? <Steps items={[
            {bold:l === 'fr' ? 'Gardez la pâte couverte pendant le pointage prévu. Observez son gonflement : la chaleur accélère la pousse.' : 'Keep the dough covered during the planned bulk rise. Watch its expansion; a warmer kitchen speeds the rise.',note:''},
            ...(['ciabatta','focaccia'].includes(styleKey) ? [{bold:l === 'fr' ? 'Si la pâte s’étale, effectuez des rabats doux au début du pointage pour lui donner de la tenue. Préservez les bulles qui se forment ensuite.' : 'If the dough spreads, give it gentle folds early in bulk to build strength. Preserve bubbles as they develop.',note:''}] : []),
          ]} /> : <Steps items={[
            ...(t.raw('bulk.stepsBase') as { bold: string; note: string }[]),
            ...(schedule.bulkFermHours >= 1.5 ? [
              t.raw('bulk.set1') as { bold: string; note: string },
              t.raw('bulk.set2') as { bold: string; note: string },
              ...(schedule.bulkFermHours >= 2 ? [
                t.raw('bulk.set3') as { bold: string; note: string },
                t.raw('bulk.set4') as { bold: string; note: string },
              ] : []),
            ] : schedule.bulkFermHours >= 0.5 ? [
              t.raw('bulk.setShort') as { bold: string; note: string },
            ] : [
              t.raw('bulk.setVeryShort') as { bold: string; note: string },
            ]),
          ]} />}
        </Section>

        <p style={{fontSize:16,lineHeight:1.5}}><strong>{l==='fr'?'Prêt quand : ':'Ready when: '}</strong>{l==='fr'?'La pâte est aérée et a gagné en tenue ; jugez-la avec le planning.':'The dough is aerated and has gained strength; judge it alongside the schedule.'}</p>

        {!breadProtocol && <StepExtras
          tips={<>
            <Section icon="" title={l === 'fr' ? 'Le pointage est terminé quand' : 'Watch for — bulk is done when'}>
              <Bullets items={t.raw('bulk.watchFor') as string[]} />
              <div style={{ marginTop: '8px' }}>
                <LearnLink term="bulk_fermentation" label={l === 'fr' ? 'Guide du pointage' : 'Bulk fermentation guide'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            </Section>
            <Section icon={null} title={t('sectionTitles.pitfalls')}>
              <Bullets items={[
                ...(hydration >= 70 ? [
                  oil > 0
                    ? `Enriched dough at ${hydration}%: use lightly oiled hands for stretch & folds — fat in the dough means oil is a better barrier than water`
                    : hydration >= 75
                    ? `At ${hydration}% hydration, sticky is expected — keep a bowl of water nearby and wet your hands before every fold. Never add flour to the bench. Quick, confident movements stick less than slow hesitant ones.`
                    : `Wet hands for stretch & folds — dip your hands in water before each set. Avoids sticking without altering hydration like bench flour would.`,
                ] : []),
                `Bulk in a warm spot above ${tempC(26, u)} — dough ferments too fast, less flavour`,
                ...(t.raw('bulk.pitfallsBase') as string[]),
              ]} />
            </Section>
          </>}
          faqKey="bulk"
          coachStepId="bulk"
          coachTitle={t('stepTitles.bulkFerm')}
          recipeContext={maestroRecipeContext}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />}
        {styleKey !== 'pain_seigle' && (hydration > 70 || mixerType === 'no_knead') && <StepVisual kind="fold" locale={l} />}
      </StepCard>

      {/* ── STEP: Cold Retard 1 ──────────────────────── */}
      {hasCold && schedule.coldRetard1Start && schedule.coldRetard1End && (
        <StepCard number={n()} {...sc()} icon={<IconCold />}
          title={isTwoPhase ? t('stepTitles.coldRetardWhole') : t('stepTitles.coldRetard')}
          time={schedule.coldRetard1Start}
          duration={(schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="" title={t('sectionTitles.whatToDo')}>
            {breadProtocol ? <Steps items={[
              {bold:l === 'fr' ? 'Couvrez le récipient en laissant de la place à la pâte pour gonfler, puis placez-le au réfrigérateur.' : 'Cover the container, leaving room for expansion, then refrigerate.',note:''},
              {bold:l === 'fr' ? 'Suivez l’horaire prévu et vérifiez la pâte avant de la façonner.' : 'Follow the planned time and check the dough before shaping.',note:formatTime(schedule.divideBallTime ?? schedule.coldRetard1End, _fmtLocale)},
            ]} /> : <Steps items={[
              ...(t.raw('coldRetard.steps') as { bold: string; note: string }[]).slice(0, 2),
              { bold: isBread
                  ? (_isFr ? 'Réglez une alarme pour la division & le façonnage' : 'Set your alarm for Divide & Shape time')
                  : (_isFr ? 'Réglez une alarme pour la division & le boulage' : 'Set your alarm for Divide & Ball time'),
                note: formatTime(schedule.divideBallTime ?? schedule.coldRetard1End, _fmtLocale) },
              (t.raw('coldRetard.steps') as { bold: string; note: string }[])[2],
            ]} />}
          </Section>

          {!breadProtocol && <StepExtras
            tips={<>
              <Section icon="" title={t('sectionTitles.whatToExpect')}>
                <Bullets items={t.raw('coldRetard.watchFor') as string[]} />
              </Section>
              <Section icon={null} title={t('sectionTitles.pitfalls')}>
                <Bullets items={[
                  (t.raw('coldRetard.pitfalls') as string[])[0],
                  l === 'fr'
                    ? `Frigo au-dessus de ${tempC(8, u)} : la pâte fermente trop pendant le repos — vérifiez sa température`
                    : `Fridge temperature above ${tempC(8, u)}: dough over-ferments during retard — check your fridge`,
                  (t.raw('coldRetard.pitfalls') as string[])[1],
                ]} />
              </Section>
            </>}
            faqKey="cold"
            coachTitle={isTwoPhase ? t('stepTitles.coldRetardWhole') : t('stepTitles.coldRetard')}
            recipeContext={maestroRecipeContext}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />}
        </StepCard>
      )}

      {/* ── STEP: Divide & Shape (bread) / Divide & Ball (pizza) ── */}
      {schedule.divideBallTime && (
        <StepCard number={n()} {...sc()} icon={<IconDivide />}
          title={isBread ? t('stepTitles.divideShape') : t('stepTitles.divideBall')}
          time={schedule.divideBallTime} duration={divideMin / 60} accent="#8A6A4A">

          <Section icon="" title={t('sectionTitles.whatToDo')}>
            {breadProtocol ? <Steps items={profileSteps(breadProtocol.shaping[l])} /> : isBread ? (
              <Steps items={isFougasse ? [
                { bold: l === 'fr' ? `Divisez en ${numItems} ${breadPiecePluralFr} de même poids` : `Divide into ${numItems} equal ${breadPiecePlural}`, note: (t.raw('divide.fougasse.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.fougasse.steps') as { bold: string; note: string }[]).slice(1),
              ] : isBaguette ? [
                { bold: l === 'fr' ? `Divisez en ${numItems} morceaux de même poids` : `Divide into ${numItems} equal pieces`, note: (t.raw('divide.baguette.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.baguette.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : isLoafTin ? [
                { bold: l === 'fr' ? `Divisez en ${numItems} morceaux de même poids` : `Divide into ${numItems} equal pieces`, note: (t.raw('divide.loafTin.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.loafTin.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : [
                // Boule / pain campagne / pain levain / sourdough
                { bold: l === 'fr' ? `Divisez en ${numItems} ${breadPiecePluralFr} de même poids` : `Divide into ${numItems} equal pieces`, note: (t.raw('divide.boule.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.boule.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ]} />
            ) : (
              <>
                <Steps items={[
                  { bold: l === 'fr' ? `Pesez la pâte puis divisez-la en ${numItems} pâtons de même poids` : `Weigh dough and divide into ${numItems} equal pieces`, note: (t.raw('divide.pizza.steps') as { bold: string; note: string }[])[0].note },
                  ...(t.raw('divide.pizza.steps') as { bold: string; note: string }[]).slice(1),
                  ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
                ]} />
                {isPan && (
                  <div style={{
                    fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic',
                    fontFamily: 'var(--font-ui)', marginTop: '8px',
                  }}>
                    {l === 'fr'
                      ? 'Pizza sur plaque : déposez la pâte directement dans le moule huilé au lieu de former une boule. Laissez-la détendre 10 min, puis étirez-la jusqu’aux bords.'
                      : 'Pan pizza: press dough directly into your oiled pan rather than forming a round ball. Let it relax 10 min then stretch to the edges.'}
                  </div>
                )}
              </>
            )}
          </Section>

          {!breadProtocol && <StepExtras
            tips={<>
              <Section icon="" title={isBread ? t('sectionTitles.watchFor') : t('sectionTitles.watchForBall')}>
                <Bullets items={isFougasse
                  ? (t.raw('divide.fougasse.watchFor') as string[])
                  : isBaguette
                  ? (t.raw('divide.baguette.watchFor') as string[])
                  : isLoafTin
                  ? (t.raw('divide.loafTin.watchFor') as string[])
                  : isBread
                  ? (t.raw('divide.boule.watchFor') as string[])
                  : [
                    ...(t.raw('divide.pizza.watchFor') as string[]),
                    l === 'fr'
                      ? `À ${displayTemp(kitchenTemp, u)}, travaillez dans les ${kitchenTemp >= 30 ? '15 min' : kitchenTemp >= 26 ? '20 min' : '30 min'} : une cuisine chaude fait lever les pâtons rapidement`
                      : `At ${displayTemp(kitchenTemp, u)}, work within ${kitchenTemp >= 30 ? '15 min' : kitchenTemp >= 26 ? '20 min' : '30 min'} — warm kitchens make balls proof quickly`,
                  ]
                } />
              </Section>
              <Section icon={null} title={t('sectionTitles.pitfalls')}>
                <Bullets items={isFougasse
                  ? (t.raw('divide.fougasse.pitfalls') as string[])
                  : isBaguette
                  ? (t.raw('divide.baguette.pitfalls') as string[])
                  : isLoafTin
                  ? (t.raw('divide.loafTin.pitfalls') as string[])
                  : isBread ? [
                    ...(hydration >= 70 ? [
                      oil > 0
                        ? `Enriched dough at ${hydration}%: use lightly oiled hands for shaping — fat in the dough means oil is a better barrier than water`
                        : hydration >= 75
                        ? `At ${hydration}% hydration, sticky is normal. Keep a bowl of water nearby and wet your hands before handling — never use bench flour. Use a bench scraper to lift pieces. Move quickly and with confidence.`
                        : `Wet hands prevent sticking at this hydration. Keep a small bowl of water nearby and dip your hands before each touch. Avoid bench flour — it hydrates instantly and makes things worse.`,
                    ] : []),
                    ...(t.raw('divide.boule.pitfalls') as string[]),
                  ] : [
                    ...(t.raw('divide.pizza.pitfalls') as string[]),
                    l === 'fr'
                      ? `Cuisine chaude (${kitchenTemp >= 30 ? 'la vôtre est à ' + displayTemp(kitchenTemp, u) : '≥' + tempC(30, u)}) : mettez vite les pâtons en bac, ils lèvent très rapidement`
                      : `Hot kitchen (${kitchenTemp >= 30 ? 'like yours at ' + displayTemp(kitchenTemp, u) : '≥' + tempC(30, u)}): get balls into their boxes fast — they proof very quickly at warm temps`,
                  ]
                } />
              </Section>
              <div style={{ marginTop: '8px' }}>
                <LearnLink term="shape_check" label={l === 'fr' ? 'Vérifier ma forme' : 'Check your shape'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            </>}
            faqKey="divide"
            coachStepId="shape"
            coachTitle={isBread ? t('stepTitles.divideShape') : t('stepTitles.divideBall')}
            recipeContext={maestroRecipeContext}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />}
        </StepCard>
      )}

      {/* ── STEP: Cold Retard 2 (two-phase) ─────────── */}
      {isTwoPhase && schedule.coldRetard2Start && schedule.coldRetard2End &&
        (schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) > 0 && (
        <StepCard number={n()} {...sc()} icon={<IconCold />}
          title={isBread ? t('stepTitles.coldProof') : t('stepTitles.coldRetardBalls')}
          time={schedule.coldRetard2Start}
          duration={(schedule.coldRetard2End.getTime() - schedule.coldRetard2Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(breadProtocol ? [{bold:l === 'fr' ? 'Couvrez la pâte façonnée sans l’écraser et placez-la au réfrigérateur sur son support.' : 'Cover the shaped dough without pressing it down and refrigerate on its support.',note:''}] : t.raw('coldBalls.steps') as { bold: string; note: string }[]),
              { bold: _isFr ? 'Réglez une alarme pour la remise à température' : 'Set your alarm for warmup time', note: schedule.rtWarmupStart ? formatTime(schedule.rtWarmupStart, _fmtLocale) : (_isFr ? 'voir le planning' : 'see schedule') },
            ]} />
          </Section>

          {!breadProtocol && <StepExtras
            tips={<>
              <Section icon="" title={t('sectionTitles.whatToExpect')}>
                <Bullets items={t.raw('coldBalls.watchFor') as string[]} />
              </Section>
              <Section icon={null} title={t('sectionTitles.pitfalls')}>
                <Bullets items={t.raw('coldBalls.pitfalls') as string[]} />
              </Section>
            </>}
            faqKey="cold"
            coachTitle={isBread ? t('stepTitles.coldProof') : t('stepTitles.coldRetardBalls')}
            recipeContext={maestroRecipeContext}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />}
        </StepCard>
      )}

      {/* ── STEP: Final Proof (merged warmup + proof for cold-retard styles) */}
      {(schedule.finalProofHours > 0 || schedule.restRtHours > 0 || schedule.rtWarmupStart) && (
        <StepCard number={n()} {...sc()} icon={<IconProof />} title={t('stepTitles.finalProof')}
          time={schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart}
          duration={(() => {
            const proofEnd = schedule.poachStart ?? schedule.bakeStart;
            const proofStart = schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart;
            if (!proofStart || !proofEnd) return schedule.finalProofHours;
            return Math.max(0, (proofEnd.getTime() - proofStart.getTime()) / 3600000);
          })()}
          accent="#7A8C6E">

          <Section icon="" title={t('sectionTitles.whatToDo')}>
            {breadProtocol ? <Steps items={profileSteps(breadProtocol.proof[l])} /> : <Steps items={[
              ...(isTwoPhase ? [t.raw('finalProof.removeFridge') as { bold: string; note: string }] : []),
              { bold: l === 'fr' ? 'Laissez les pâtons se détendre, couverts' : 'Let the shaped dough relax, covered',
                note: l === 'fr' ? 'À température ambiante, jusqu’à ce que la pâte soit souple et aérée.' : 'At room temperature, until relaxed and airy.' },
              t.raw('finalProof.pokeTest') as { bold: string; note: string },
              { bold: l === 'fr' ? `Lancez le préchauffage du four ${hoursLabel(schedule.preheatStart ? (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000 : 0.75)} avant la cuisson` : `Start preheating your oven ${hoursLabel(schedule.preheatStart ? (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000 : 0.75)} before bake time`, note: (l === 'fr' ? 'préchauffez pendant l’apprêt ; vérifiez que le four et la pâte sont prêts' : 'preheat overlaps proofing; check both are ready') },
            ]} />}
          </Section>

          {!breadProtocol && <StepExtras
            tips={<>
              <Section icon="" title={t('sectionTitles.pokeTest')}>
                <Bullets items={t.raw('finalProof.pokeResponses') as string[]} />
                <div style={{ marginTop: '8px' }}>
                  <LearnLink term="poke_test" label={l === 'fr' ? 'Guide du test du doigt' : 'Full poke test guide'} onOpen={setLearnTerm} showSparkle={true} />
                </div>
              </Section>
              <Section icon={null} title={t('sectionTitles.pitfalls')}>
                <Bullets items={[
                  (t.raw('finalProof.pitfalls') as string[])[0],
                  (t.raw('finalProof.pitfalls') as string[])[1],
                  l === 'fr'
                    ? `Cuisine à ${displayTemp(kitchenTemp, u)} : l’apprêt peut finir en ${kitchenTemp >= 30 ? '15–25 min' : kitchenTemp >= 26 ? '20–35 min' : '30–60 min'} après la remise à température — vérifiez tôt`
                    : `Warm kitchen (${displayTemp(kitchenTemp, u)}): proof can complete in ${kitchenTemp >= 30 ? '15–25 min' : kitchenTemp >= 26 ? '20–35 min' : '30–60 min'} after warmup — check early`,
                  (t.raw('finalProof.pitfalls') as string[])[2],
                ]} />
              </Section>
            </>}
            faqKey="proof"
            coachStepId="proof"
            coachTitle={t('stepTitles.finalProof')}
            recipeContext={maestroRecipeContext}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />}
        </StepCard>
      )}

      {/* ── STEP: Preheat Oven ───────────────────────── */}
      <StepCard number={n()} {...sc(false, 'cooking')} icon={<IconPreheat />} title={breadProtocol?.cooking === 'griddle' ? (l === 'fr' ? 'Chauffer la poêle' : 'Heat the griddle') : t('stepTitles.preheatOven')}
        time={schedule.preheatStart} accent={D.gold}>

        <div style={{ fontSize: '12px', color: D.smoke, fontStyle: 'italic',
          fontFamily: 'var(--font-ui)', padding: '12px 0 0' }}>
          {t('preheatNote')}
        </div>

        <Section icon="" title={t('sectionTitles.whatToDo')}>
          {breadProtocol ? <Steps items={profileSteps(breadProtocol.preheat[l])} /> : isBread ? (
            <Steps items={(t.raw(
              ovenType === 'dutch_oven' ? 'preheat.dutch.steps' :
              ovenType === 'home_oven_stone_bread' ? 'preheat.stoneBread.steps' :
              ovenType === 'steam_oven' ? 'preheat.steam.steps' :
              ovenType === 'wood_fired' ? 'preheat.woodBread.steps' :
              'preheat.standardBread.steps'
            ) as { bold: string; note: string }[])} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={ovenConstruction === 'masonry' ? [
              { bold: l === 'fr' ? 'Chauffez la sole et la voûte à cœur.' : 'Heat the floor and dome thoroughly.', note: l === 'fr' ? 'Suivez le temps de chauffe de votre four maçonné.' : 'Follow your masonry oven’s heat-up instructions.' },
              { bold: l === 'fr' ? 'Contrôlez la température de la sole avant d’enfourner.' : 'Check the floor temperature before launching.', note: l === 'fr' ? 'Laissez-la remonter entre deux pizzas.' : 'Let it recover between pizzas.' },
            ] : t.raw('preheat.pizzaOven.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={t.raw('preheat.electricPizza.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={t.raw('preheat.homeSteel.steps') as { bold: string; note: string }[]} />
          ) : (
            <Steps items={t.raw('preheat.homeStandard.steps') as { bold: string; note: string }[]} />
          )}
        </Section>

        {!breadProtocol && <p style={{fontSize:16,lineHeight:1.5}}><strong>{l==='fr'?'Prêt quand : ':'Ready when: '}</strong>{l==='fr'?'Le four et la surface de cuisson sont chauds, et la pâte est prête.':'The oven and baking surface are heated, and the dough is ready.'}</p>}

        {!breadProtocol && <StepExtras
          tips={
            <Section icon={null} title={t('sectionTitles.pitfalls')}>
              <Bullets items={isBread
                ? (t.raw(
                    ovenType === 'dutch_oven' ? 'preheat.dutch.pitfalls' :
                    ovenType === 'home_oven_stone_bread' ? 'preheat.stoneBread.pitfalls' :
                    ovenType === 'steam_oven' ? 'preheat.steam.pitfalls' :
                    ovenType === 'wood_fired' ? 'preheat.woodBread.pitfalls' :
                    'preheat.standardBread.pitfalls'
                  ) as string[])
                : (t.raw(
                    ovenType === 'pizza_oven' ? 'preheat.pizzaOven.pitfalls' :
                    ovenType === 'electric_pizza' ? 'preheat.electricPizza.pitfalls' :
                    ovenType === 'home_oven_steel' ? 'preheat.homeSteel.pitfalls' :
                    'preheat.homeStandard.pitfalls'
                  ) as string[])
              } />
            </Section>
          }
          faqKey="preheat"
          coachTitle={t('stepTitles.preheatOven')}
          recipeContext={maestroRecipeContext}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />}
      </StepCard>

      {hasPoachStep && <StepCard number={n()} {...sc(false, 'cooking')} icon={<IconPreheat />} title={l === 'fr' ? 'Pocher les bagels' : 'Poach the bagels'} time={schedule.poachStart} duration={(schedule.poachMinutes ?? 0) / 60}>
        <Steps items={profileSteps(breadProtocol!.cookingSteps[l].slice(0,1))} />
        <p>{l === 'fr' ? 'Ce créneau comprend le pochage et la manipulation de toute la fournée. Gardez la plaque prête pour l’enfournement prévu.' : 'This window includes poaching and handling the whole batch. Have the tray ready for the planned oven time.'}</p>
      </StepCard>}

      {/* ── STEP: Bake & Eat ─────────────────────────── */}
      <StepCard final={!isBread} number={n()} {...sc(false, 'cooking')} icon={<IconBake />} title={breadProtocol?.cooking === 'boil-bake' ? (hasPoachStep ? (l === 'fr' ? 'Cuire les bagels au four' : 'Bake the bagels') : (l === 'fr' ? 'Pocher puis cuire au four' : 'Poach, then bake')) : breadProtocol?.cooking === 'griddle' ? (l === 'fr' ? 'Cuire à la poêle' : 'Cook on the griddle') : isBread ? (l === 'fr' ? 'Cuire le pain' : 'Bake the bread') : (l === 'fr' ? 'Cuire les pizzas' : 'Bake the pizzas')} time={schedule.bakeStart} duration={schedule.activeCookMinutes ? schedule.activeCookMinutes / 60 : undefined} accent="#5A9A50">
        <Section icon="" title={t('sectionTitles.whatToDo')}>
          {isPan && (
            <div style={{
              background: 'rgba(156, 130, 72,0.08)', border: '1px solid rgba(156, 130, 72,0.2)',
              borderRadius: '16px', padding: '12px 12px', marginBottom: '12px',
              fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--char)',
              lineHeight: 1.5,
            }}>
              {l === 'fr' ? 'Pan / Detroit / Deep Dish : la pâte cuit dans le moule huilé, sans enfournement à la pelle. Pour une Detroit, poussez le fromage jusqu’aux bords pour les caraméliser, puis ajoutez la sauce après cuisson. Pour une Deep Dish, faites remonter la pâte sur les parois et ajoutez le fromage, la garniture puis la sauce.' : 'Pan / Detroit / Deep Dish: dough bakes in the oiled pan; no launching needed. For Detroit, push cheese to the edges for caramelised crusts and add sauce after baking. For Deep Dish, press dough up the sides, then add cheese, toppings and sauce in that order.'}
            </div>
          )}
          {breadProtocol ? <Steps items={profileSteps(hasPoachStep ? breadProtocol.cookingSteps[l].slice(1) : breadProtocol.cookingSteps[l])} /> : isBread ? (
            <Steps items={(t.raw(
              ovenType === 'dutch_oven' ? 'bake.dutch.steps' :
              ovenType === 'home_oven_stone_bread' ? 'bake.stoneBread.steps' :
              ovenType === 'steam_oven' ? 'bake.steam.steps' :
              ovenType === 'wood_fired' ? 'bake.woodBread.steps' :
              'bake.standardBread.steps'
            ) as { bold: string; note: string }[])} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={t.raw('bake.pizzaOven.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={t.raw('bake.electricPizza.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={t.raw('bake.homeSteel.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_standard' ? (
            <Steps items={t.raw('bake.homeStandard.steps') as { bold: string; note: string }[]} />
          ) : (
            <Steps items={t.raw('bake.default.steps') as { bold: string; note: string }[]} />
          )}
        </Section>

        {isBread && !breadProtocol && <p style={{fontSize:16,lineHeight:1.5}}><strong>{l==='fr'?'Prêt quand : ':'Ready when: '}</strong>{l==='fr'?'Le pain est cuit à cœur ; posez-le sur la grille de refroidissement.':'The bread is baked through; move it to the cooling rack.'}</p>}
        {!breadProtocol && <StepExtras
          tips={<>
            <Section icon="" title={t('sectionTitles.watchFor')}>
              {isBread ? (
                <Bullets items={t.raw('bake.dutch.watchFor') as string[]} />
              ) : ovenType === 'pizza_oven' ? (
                <Bullets items={t.raw('bake.pizzaOven.watchFor') as string[]} />
              ) : ovenType === 'electric_pizza' ? (
                <Bullets items={t.raw('bake.electricPizza.watchFor') as string[]} />
              ) : ovenType === 'home_oven_steel' ? (
                <Bullets items={t.raw('bake.homeSteel.watchFor') as string[]} />
              ) : (
                <Bullets items={t.raw('bake.homeStandard.watchFor') as string[]} />
              )}
            </Section>
            <Section icon={null} title={t('sectionTitles.pitfalls')}>
              <Bullets items={isBread
                ? (t.raw(
                    ovenType === 'dutch_oven' ? 'bake.dutch.pitfalls' :
                    ovenType === 'home_oven_stone_bread' ? 'bake.stoneBread.pitfalls' :
                    ovenType === 'steam_oven' ? 'bake.steam.pitfalls' :
                    ovenType === 'wood_fired' ? 'bake.woodBread.pitfalls' :
                    'bake.standardBread.pitfalls'
                  ) as string[])
                : (t.raw(
                    ovenType === 'pizza_oven' ? 'bake.pizzaOven.pitfalls' :
                    ovenType === 'electric_pizza' ? 'bake.electricPizza.pitfalls' :
                    ovenType === 'home_oven_steel' ? 'bake.homeSteel.pitfalls' :
                    'bake.homeStandard.pitfalls'
                  ) as string[])
              } />
            </Section>
            {isBread && (
              <Section icon="" title={t('sectionTitles.learnMore')}>
                <ExtLink href="https://www.theperfectloaf.com/guides/how-to-score-bread-dough/" label={t('bake.learnMoreScoring')} />
                <div style={{ marginTop: '8px' }}>
                  <LearnLink term="score_technique" label={l === 'fr' ? 'Technique de grignage' : 'Scoring technique'} onOpen={setLearnTerm} showSparkle={true} />
                </div>
              </Section>
            )}
            {!isBread && (
              <div style={{ marginTop: '8px' }}>
                <LearnLink term="stretch_bake" label={l === 'fr' ? 'Étirer et cuire' : 'Stretch & bake tips'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            )}
          </>}
          faqKey="bake"
          coachStepId={isBread ? 'bake' : 'pizza_maestro'}
          coachTitle={t('stepTitles.bakeEat')}
          recipeContext={maestroRecipeContext}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />}
        {!isBread && onNavigateToPizzaParty && <button type="button" onClick={onNavigateToPizzaParty} style={{width:'100%',minHeight:48,margin:'14px 0',border:0,borderRadius:10,background:D.terra,color:'white'}}>{pizzaActionLabel ?? (l === 'fr' ? 'Commencer la cuisson des pizzas' : 'Start baking the pizzas')} →</button>}
      </StepCard>

      {isBread && <StepCard final number={n()} {...sc(false, 'cooking')} icon={<IconBake />} title={breadProtocol?.cooking === 'griddle' ? (l === 'fr' ? 'Garder les pains souples' : 'Keep the breads soft') : (l === 'fr' ? 'Laisser refroidir le pain' : 'Cool the bread')}>
        {breadProtocol ? <Steps items={profileSteps(breadProtocol.cooling[l])} /> : (() => {
          const weight = (recipe?.totalDough ?? numItems * 750) / Math.max(1,numItems);
          const range = breadCoolingRange(styleKey, weight);
          return <><Section icon="" title={t('sectionTitles.whatToDo')}><Steps items={[
            {bold:l === 'fr' ? 'Sortez le pain du moule ou de la cocotte et posez-le à découvert sur une grille.' : 'Remove the bread from its tin or pot and place it uncovered on a rack.',note:''},
            {bold:l === 'fr' ? `Comptez environ ${range} avant de trancher.` : `Allow about ${range} before slicing.`,note:''},
          ]}/></Section><p style={{marginTop:16}}><strong>{l === 'fr' ? 'Prêt quand : ' : 'Ready when: '}</strong>{styleKey === 'pain_seigle' ? (l === 'fr' ? 'Attendez le lendemain pour trancher ; une fois refroidi, emballez-le pour éviter qu’il sèche.' : 'Wait until tomorrow to slice; once cool, wrap it to keep it from drying out.') : (l === 'fr' ? 'Le dessous du pain n’est plus chaud au toucher. Encore chaud ? Vérifiez dans 30 min.' : 'The loaf no longer feels warm underneath. Still warm? Check again in 30 min.')}</p></>;
        })()}
        {!breadProtocol && <StepExtras tips={<p>{l === 'fr' ? 'Laissez-le découvert pendant le refroidissement. Rangez-le une fois refroidi.' : 'Leave it uncovered while cooling. Store it once cool.'}</p>} faqKey="cool" coachStepId="cool" coachTitle={l === 'fr' ? 'Refroidissement' : 'Cooling'} recipeContext={maestroRecipeContext} styleKey={styleKey} kitchenTemp={kitchenTemp} locale={l} ovenType={ovenType} />}
        {fillingsAction}
      </StepCard>}

      {learnTerm && (
        <LearnModal
          term={learnTerm}
          onClose={() => setLearnTerm(null)}
        />
      )}
    </div>
    </SimpleModeCtx.Provider>
  );
}
