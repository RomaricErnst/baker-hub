'use client';
import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type ScheduleResult, formatTime, hoursLabel } from '../utils';
import { MIXER_TYPES, type MixerType } from '../data';
import LearnModal from './LearnModal';
import { IconPreferment, IconStarter, IconMix, IconBulk, IconCold, IconDivide, IconProof, IconPreheat, IconBake } from './StepIcons';
import { type UnitSystem, displayTemp, tempC, tempRange } from '../utils/units';
import { getPrefPeakH_RT, getStarterFridgeWarmupH } from './FermentChart';
import { GUIDE_FAQ } from '../lib/guideFaq';

interface BakeGuideProps {
  schedule: ScheduleResult;
  mixerType: MixerType;
  styleKey: string;
  kitchenTemp: number;
  numItems: number;
  prefermentType?: string;
  oil: number;
  hydration: number;
  ovenType?: string;
  prefStartTime?: Date | null;
  feedTime?: Date | null;
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
  recipe?: import('../utils').RecipeResult | null;
}

// ── Design tokens ────────────────────────────────────
const D = {
  char: '#1A1612', ash: '#3D3530', cream: '#F5F0E8',
  terra: '#C4522A', gold: '#D4A853', sage: '#6B7A5A',
  smoke: '#8A7F78', border: '#E8E0D5', warm: '#FDFBF7',
};

// ── Section sub-component ────────────────────────────
function Section({ icon, title, children }: {
  icon: string | null; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{
        fontSize: '.68rem', fontWeight: 600, color: D.smoke,
        textTransform: 'uppercase', letterSpacing: '.07em',
        fontFamily: 'var(--font-dm-mono)', marginBottom: '.5rem',
        display: 'flex', alignItems: 'center', gap: '.35rem',
      }}>
        {icon && <span>{icon}</span>}{title}
      </div>
      <div style={{ fontSize: '.82rem', color: D.ash, lineHeight: 1.65, fontFamily: 'var(--font-dm-sans)' }}>
        {children}
      </div>
    </div>
  );
}

// ── Bullet list ──────────────────────────────────────
function Bullets({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start' }}>
          <span style={{ color: D.terra, flexShrink: 0, marginTop: '.1rem' }}>·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Numbered steps ───────────────────────────────────
function Steps({ items }: { items: { bold: string; note: string }[] }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '.55rem', alignItems: 'flex-start' }}>
          <span style={{
            fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
            color: D.smoke, flexShrink: 0, minWidth: '16px', marginTop: '.15rem',
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
      background: color ? `${color}18` : '#F5F0E820',
      border: `1px solid ${color ?? D.border}40`,
      borderRadius: '20px',
      padding: '.15rem .6rem',
      fontSize: '.7rem',
      fontFamily: 'var(--font-dm-mono)',
      color: color ?? D.smoke,
      marginLeft: '.5rem',
    }}>{label}</span>
  );
}

// ── Step card ────────────────────────────────────────
function StepCard({
  number, icon, title, time, duration, accent = D.terra,
  open, done, onToggle, onDone, children, divRef,
}: {
  number: number; icon: React.ReactNode; title: string;
  time?: Date; duration?: number | null;
  accent?: string; open: boolean; done: boolean;
  onToggle: () => void; onDone: () => void;
  children: React.ReactNode;
  divRef?: React.RefCallback<HTMLDivElement>;
}) {
  const ea = done ? D.sage : accent;
  const _fmtLocale = useLocale();
  return (
    <div ref={divRef} style={{
      background: D.warm, borderRadius: '18px',
      border: `1px solid ${done ? D.sage + '60' : D.border}`,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(26,22,18,0.06)',
    }}>
      {/* Card header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '.75rem',
          padding: '.8rem 1.1rem', cursor: 'pointer',
          borderLeft: `4px solid ${ea}`,
        }}
      >
        {/* Circle toggle — tap to mark done/undo, independent of accordion */}
        <div
          onClick={e => { e.stopPropagation(); onDone(); }}
          style={{
            width: '24px', height: '24px', borderRadius: '50%',
            flexShrink: 0, cursor: 'pointer',
            border: done ? '2px solid #6B7A5A' : '2px solid #C8C0B8',
            background: done ? '#6B7A5A' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          {done && (
            <svg viewBox="0 0 12 12" width={12} height={12} fill="none"
              stroke="white" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5"/>
            </svg>
          )}
        </div>
        <span style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: `${ea}18`, border: `1.5px solid ${ea}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '.75rem', fontFamily: 'var(--font-dm-mono)',
          color: ea, fontWeight: 700, flexShrink: 0,
        }}>{number}</span>
        <span style={{ width: '22px', height: '22px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: ea }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1rem',
            fontWeight: 700, color: done ? D.smoke : D.char,
            textDecoration: done ? 'line-through' : 'none',
          }}>{title}</div>
          {time && (
            <div style={{ fontSize: '.72rem', color: D.smoke, fontFamily: 'var(--font-dm-mono)', marginTop: '.1rem' }}>
              {formatTime(time, _fmtLocale)}
              {duration ? ` · ${hoursLabel(duration)}` : ''}
            </div>
          )}
        </div>
        <span style={{
          color: D.smoke, fontSize: '.8rem', flexShrink: 0,
          display: 'inline-block', transition: 'transform .2s',
          transform: open ? 'rotate(180deg)' : 'none',
        }}>
          ▾
        </span>
      </div>
      {/* Card body */}
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: `1px solid ${D.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Learn link ───────────────────────────────────────
function LearnLink({ term, label, onOpen, showSparkle = false }: {
  term: string; label: string; onOpen: (t: string) => void; showSparkle?: boolean;
}) {
  return (
    <button
      onClick={() => onOpen(term)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: D.terra, fontSize: '.78rem',
        fontFamily: 'var(--font-dm-sans)',
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
    <div style={{ marginTop: '14px' }}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFile}
      />

      {MAESTRO_CONTENT[stepId]?.question && (
        <div style={{
          fontFamily: 'var(--font-dm-sans)', fontSize: '13px',
          color: 'var(--char)', fontWeight: 500, marginBottom: '4px',
        }}>
          {MAESTRO_CONTENT[stepId].question[l]}
        </div>
      )}

      {MAESTRO_CONTENT[stepId]?.instruction && (
        <div style={{
          fontFamily: 'var(--font-dm-sans)', fontSize: '11px',
          color: 'var(--smoke)', fontStyle: 'italic', marginBottom: '8px',
        }}>
          {MAESTRO_CONTENT[stepId].instruction![l]}
        </div>
      )}

      {feedback && (
        <div style={{
          background: '#1A1612',
          borderLeft: '3px solid #C4522A',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '10px',
          position: 'relative',
        }}>
          <div style={{ color: '#F5F0E8', fontSize: '13px', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {feedback}
          </div>
          <button
            onClick={() => { setFeedback(null); setError(false); }}
            style={{
              position: 'absolute', bottom: '8px', right: '12px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8A7F78', fontSize: '11px',
              fontFamily: 'var(--font-dm-mono)',
              textDecoration: 'underline', padding: 0,
            }}
          >
            {l === 'fr' ? 'Reprendre' : 'Retake'}
          </button>
        </div>
      )}

      {error && !feedback && (
        <div style={{ fontSize: '12px', color: '#8A7F78', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', marginBottom: '8px' }}>
          {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
        </div>
      )}

      {!feedback && (
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: '#1A1612',
              border: isGate ? '1px solid rgba(212,168,83,0.5)' : '1px solid rgba(245,240,232,0.15)',
              borderRadius: '20px', padding: '4px 12px', cursor: loading ? 'default' : 'pointer',
              height: '28px', opacity: loading ? 0.7 : 1, transition: 'opacity .15s',
            }}
          >
            {loading ? (
              <span style={{
                display: 'inline-block', width: '12px', height: '12px',
                border: '1.5px solid rgba(245,240,232,0.3)',
                borderTop: '1.5px solid #F5F0E8',
                borderRadius: '50%',
                animation: 'bh-spin 0.7s linear infinite',
                flexShrink: 0,
              }} />
            ) : (
              <svg viewBox="0 0 16 16" width={14} height={14} fill="none"
                stroke="#F5F0E8" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12"/>
              </svg>
            )}
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: loading ? 'rgba(245,240,232,0.6)' : '#F5F0E8',
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

// ── Ask Maestro — free-text question about the current step ──────
function AskMaestro({ stepId, stepTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType }: {
  stepId: string; stepTitle: string; styleKey: string; kitchenTemp: number;
  prefermentType?: string; locale: string; ovenType?: string;
}) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const l = locale === 'fr' ? 'fr' : 'en';

  async function ask() {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true); setError(false); setAnswer(null);
    try {
      const res = await fetch('/api/bake-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, stepId, stepTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType }),
      });
      const data = await res.json();
      if (data.feedback) setAnswer(data.feedback); else setError(true);
    } catch { setError(true); } finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(); }}
          placeholder={l === 'fr' ? 'Posez une question sur cette étape…' : 'Ask a question about this step…'}
          style={{
            flex: 1, border: `1px solid ${D.border}`, borderRadius: '8px',
            padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-dm-sans)',
            color: D.char, background: '#fff', outline: 'none',
          }}
        />
        <button
          onClick={ask}
          disabled={loading || !q.trim()}
          style={{
            background: '#1A1612', color: '#F5F0E8', border: 'none',
            borderRadius: '8px', padding: '8px 14px', fontSize: '12px',
            fontFamily: 'var(--font-dm-mono)', cursor: loading || !q.trim() ? 'default' : 'pointer',
            opacity: loading || !q.trim() ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {loading ? (l === 'fr' ? '…' : '…') : (l === 'fr' ? 'Demander' : 'Ask')}
        </button>
      </div>
      {answer && (
        <div style={{
          background: '#1A1612', borderLeft: '3px solid #C4522A', borderRadius: '10px',
          padding: '12px 14px', marginTop: '8px',
          color: '#F5F0E8', fontSize: '13px', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.6, whiteSpace: 'pre-line',
        }}>
          {answer}
          <div>
            <button
              onClick={() => { setAnswer(null); setQ(''); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8A7F78', fontSize: '11px', fontFamily: 'var(--font-dm-mono)',
                textDecoration: 'underline', padding: 0, marginTop: '6px',
              }}
            >
              {l === 'fr' ? 'Autre question' : 'Ask another'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <div style={{ fontSize: '12px', color: D.smoke, fontStyle: 'italic', marginTop: '6px', fontFamily: 'var(--font-dm-sans)' }}>
          {l === 'fr' ? 'Maestro indisponible. Réessayez.' : 'Maestro unavailable. Please try again.'}
        </div>
      )}
    </div>
  );
}

// ── Step extras — Tips & tricks / FAQ / Maestro tabs ─────────────
// Keeps the timeline clean: the step card shows only "what to do";
// everything secondary lives behind these three pills, closed by default.
function StepExtras({ tips, faqKey, coachStepId, coachTitle, styleKey, kitchenTemp, prefermentType, locale, ovenType }: {
  tips: React.ReactNode;
  faqKey?: string;
  coachStepId?: string;
  coachTitle: string;
  styleKey: string;
  kitchenTemp: number;
  prefermentType?: string;
  locale: string;
  ovenType?: string;
}) {
  const [tab, setTab] = useState<'tips' | 'faq' | 'coach' | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const l = locale === 'fr' ? 'fr' : 'en';
  const faq = faqKey ? (GUIDE_FAQ[faqKey] ?? []) : [];

  const pills: Array<{ id: 'tips' | 'faq' | 'coach'; label: string }> = [
    { id: 'tips', label: l === 'fr' ? '💡 Astuces' : '💡 Tips & tricks' },
    ...(faq.length > 0 ? [{ id: 'faq' as const, label: 'FAQ' }] : []),
    { id: 'coach', label: l === 'fr' ? '✨ Maestro' : '✨ Maestro' },
  ];

  return (
    <div style={{ marginTop: '1rem', borderTop: `1px solid ${D.border}`, paddingTop: '.85rem' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {pills.map(p => (
          <button
            key={p.id}
            onClick={() => setTab(prev => prev === p.id ? null : p.id)}
            style={{
              border: tab === p.id ? `1.5px solid ${D.terra}` : `1px solid ${D.border}`,
              background: tab === p.id ? '#fff' : 'transparent',
              color: tab === p.id ? D.terra : D.smoke,
              borderRadius: '20px', padding: '5px 12px',
              fontSize: '12px', fontFamily: 'var(--font-dm-mono)',
              cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === 'tips' && <div style={{ marginTop: '.25rem' }}>{tips}</div>}

      {tab === 'faq' && (
        <div style={{ marginTop: '.75rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          {faq.map((f, i) => (
            <div key={i} style={{ border: `1px solid ${D.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              <button
                onClick={() => setOpenFaq(prev => prev === i ? null : i)}
                style={{
                  width: '100%', textAlign: 'left', background: openFaq === i ? '#fff' : 'transparent',
                  border: 'none', cursor: 'pointer', padding: '.6rem .75rem',
                  fontSize: '.8rem', fontWeight: 600, color: D.char,
                  fontFamily: 'var(--font-dm-sans)',
                  display: 'flex', justifyContent: 'space-between', gap: '.5rem',
                }}
              >
                <span>{f.q[l]}</span>
                <span style={{ color: D.smoke, flexShrink: 0 }}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 .75rem .65rem', fontSize: '.78rem', color: D.ash, lineHeight: 1.6, fontFamily: 'var(--font-dm-sans)' }}>
                  {f.a[l]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'coach' && (
        <div style={{ marginTop: '.25rem' }}>
          {coachStepId && (
            <CoachButton
              stepId={coachStepId}
              styleKey={styleKey}
              kitchenTemp={kitchenTemp}
              prefermentType={prefermentType}
              locale={locale}
              ovenType={ovenType}
            />
          )}
          <AskMaestro
            stepId={coachStepId ?? faqKey ?? 'mix'}
            stepTitle={coachTitle}
            styleKey={styleKey}
            kitchenTemp={kitchenTemp}
            prefermentType={prefermentType}
            locale={locale}
            ovenType={ovenType}
          />
        </div>
      )}
    </div>
  );
}

// ── External link ────────────────────────────────────
function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{
      color: D.terra, fontSize: '.78rem',
      fontFamily: 'var(--font-dm-sans)',
      textDecoration: 'underline', textUnderlineOffset: '2px',
    }}>{label} →</a>
  );
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
  schedule, mixerType, styleKey, kitchenTemp, numItems,
  prefermentType, oil, hydration, ovenType, prefStartTime, feedTime,
  feed2Time = null, fridgeOutTime = null,
  starterState = 'rt_fed', starterMature = true, starterHasRye = false,
  usingPeak2 = false, planningMode = 'last_fed',
  feedRatio = 1, starterLocation = 'rt',
  units, locale,
  onNavigateToPizzaParty, recipe,
}: BakeGuideProps) {
  const u = units ?? 'metric';
  const l = locale === 'fr' ? 'fr' : 'en';
  const [learnTerm, setLearnTerm] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const t = useTranslations('bakeGuide');
  const _fmtLocale = useLocale();
  const _isFr = _fmtLocale === 'fr';
  // Persist ticked steps so reopening the app mid-bake keeps progress
  const doneHydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bh_guide_done_v1');
      if (raw) {
        const arr = JSON.parse(raw) as number[];
        if (arr.length > 0) {
          setDoneSteps(new Set(arr));
          setCurrentStep(Math.max(...arr) + 1);
        }
      }
    } catch {}
    doneHydrated.current = true;
  }, []);
  useEffect(() => {
    if (!doneHydrated.current) return;
    try { localStorage.setItem('bh_guide_done_v1', JSON.stringify([...doneSteps])); } catch {}
  }, [doneSteps]);

  useEffect(() => {
    if (currentStep > 0) {
      stepRefs.current[currentStep]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentStep]);

  const isSourdough   = styleKey === 'sourdough' || styleKey === 'pain_levain';
  const isBread       = ['pain_campagne','pain_levain','baguette','pain_complet','pain_seigle','fougasse','brioche','pain_mie','pain_viennois','sourdough'].includes(styleKey);
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
  const isSpiral      = mixerType === 'spiral';
  const hasPref       = !!prefermentType && prefermentType !== 'none';
  const isPoolish     = prefermentType === 'poolish';
  const isBiga        = prefermentType === 'biga';
  const isTwoPhase    = schedule.coldRetard2Start !== null;
  const hasCold       = (schedule.coldRetardHours ?? 0) > 0;
  const extraBalls    = Math.max(0, numItems - 4);
  const divideMin     = 15 + 2 * extraBalls;

  // Recipe quantity helpers — used in mixing order steps
  const bgMainFlour = recipe ? Math.round(recipe.preferment ? recipe.preferment.finalFlour : recipe.flour) : null;
  const bgMainWater = recipe ? Math.round(recipe.preferment ? recipe.preferment.finalWater : recipe.water) : null;
  const bgWater90   = bgMainWater ? Math.round(bgMainWater * 0.9) : null;
  const bgWater10   = bgMainWater ? bgMainWater - (bgWater90 ?? 0) : null;
  const bgSaltG     = recipe ? Math.round(recipe.salt) : null;
  // convertedGrams, NOT grams — grams is the IDY-equivalent (see Timeline)
  const bgYeastG    = recipe?.yeast?.convertedGrams ? String(parseFloat(recipe.yeast.convertedGrams.toFixed(1))) : null;
  // Mix STARTS before bulk fermentation — header and Mix step previously used
  // bulkFermStart, so the Guide disagreed with the Recipe timeline by the
  // mixing duration (16:15 vs 16:00 / 25h45 vs 26h).
  const bgMixStart  = (() => {
    const raw = new Date(schedule.bulkFermStart.getTime() - (schedule.mixingDurationH ?? 0.25) * 3600000);
    // Snap down to the quarter-hour grid — 19:46 is engine precision, not baker time
    raw.setMinutes(Math.floor(raw.getMinutes() / 15) * 15, 0, 0);
    return raw;
  })();
  const bgPoolishG  = recipe?.preferment
    ? Math.round((recipe.preferment.prefFlour ?? 0) + (recipe.preferment.prefWater ?? 0) + (recipe.preferment.prefYeastGrams ?? 0))
    : null;
  const bgFlour90Label = bgMainFlour && bgWater90 ? `${bgMainFlour}g flour + ${bgWater90}g water (90%)` : 'Flour + 90% of your water';
  const bgSaltLabel    = bgSaltG ? `Add salt (${bgSaltG}g)` : 'Add salt';
  const bgYeastLabel   = bgYeastG ? `Add yeast (${bgYeastG}g)` : 'Add yeast';
  const bgWater10Label = bgWater10 ? `Add remaining water (${bgWater10}g)` : 'Add remaining 10% water';
  const bgPoolishLabel = bgPoolishG ? `Add your ${prefermentType} (${bgPoolishG}g total)` : `Add your ${prefermentType} (all of it)`;

  let stepNum = 0;
  let lastStep = 0;
  const n = () => { stepNum++; lastStep = stepNum; return stepNum; };
  const sc = () => {
    const s = lastStep;
    return {
      open: currentStep === s,
      done: doneSteps.has(s),
      onToggle: () => setCurrentStep(prev => prev === s ? 0 : s),
      onDone: () => {
        setDoneSteps(prev => {
          const next = new Set(prev);
          if (next.has(s)) {
            // Cascade: untick this step and all later steps
            for (let i = s; i <= 20; i++) next.delete(i);
            return next;
          } else {
            next.add(s);
            setCurrentStep(s + 1);
            return next;
          }
        });
      },
      divRef: (el: HTMLDivElement | null) => { stepRefs.current[s] = el; },
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div style={{ marginBottom: '.25rem' }}>
        <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '1.2rem', fontWeight: 700, color: D.char }}>
          {_isFr ? 'Guide de cuisson pas à pas' : 'Step-by-step bake guide'}
        </div>
        <div style={{ fontSize: '.75rem', color: D.smoke, fontFamily: 'var(--font-dm-mono)', marginTop: '.2rem' }}>
          {(() => {
            const rangeStart = hasPref && prefStartTime && prefStartTime < bgMixStart ? prefStartTime : bgMixStart;
            return <>{formatTime(rangeStart, _fmtLocale)} → {formatTime(schedule.bakeStart, _fmtLocale)} · {hoursLabel((schedule.bakeStart.getTime() - rangeStart.getTime()) / 3600000)} {_isFr ? 'au total' : 'total'}</>;
          })()}
        </div>
      </div>

      {/* ── STEP: Make Poolish / Biga ───────────────── */}
      {hasPref && prefStartTime && (
        <StepCard number={n()} {...sc()} icon={<IconPreferment />}
          title={isPoolish ? t('stepTitles.makePoolish') : t('stepTitles.makeBiga')}
          time={prefStartTime} accent={D.gold}>

          {recipe?.preferment && (() => {
            const { prefFlour, prefWater, prefYeastGrams } = recipe.preferment!;
            const parts = [
              `${Math.round(prefFlour)}g flour`,
              `${Math.round(prefWater)}g water`,
              prefYeastGrams > 0 ? `${prefYeastGrams.toFixed(1)}g ${prefermentType ?? 'yeast'}` : null,
            ].filter(Boolean).join(' · ');
            return (
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: D.smoke, marginBottom: '.5rem' }}>
                {parts}
              </div>
            );
          })()}

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            {isPoolish ? (
              <Steps items={t.raw(kitchenTemp >= 26 ? 'poolish.stepsFridge' : 'poolish.stepsRT') as { bold: string; note: string }[]} />
            ) : (
              <Steps items={t.raw('biga.steps') as { bold: string; note: string }[]} />
            )}
          </Section>

          <StepExtras
            tips={<>
              <Section icon="👁️" title={t('sectionTitles.watchForReady')}>
                <Bullets items={t.raw(isPoolish ? 'poolish.readyWhen' : 'biga.readyWhen') as string[]} />
              </Section>
              <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
                <Bullets items={t.raw(isPoolish ? 'poolish.pitfalls' : 'biga.pitfalls') as string[]} />
              </Section>
              <div style={{ marginTop: '.5rem' }}>
                <LearnLink term="preferment_ready" label={l === 'fr' ? 'Est-il prêt ?' : 'Is it ready?'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            </>}
            faqKey={isPoolish ? 'poolish' : 'biga'}
            coachStepId={isPoolish ? 'poolish' : 'biga'}
            coachTitle={isPoolish ? t('stepTitles.makePoolish') : t('stepTitles.makeBiga')}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
        </StepCard>
      )}

      {/* ── STEP: Feed Starter (sourdough) ──────────── */}
      {isSourdough && feedTime && (
        <>
          {/* Feed 1 */}
          <StepCard
            number={n()} {...sc()} icon={<IconStarter />}
            title={usingPeak2 ? 'Feed your starter — first feed' : 'Feed your starter'}
            time={feedTime}
            accent="#6A7FA8"
          >
            <Section icon={null} title={t('sectionTitles.whatToDo')}>
              <Steps items={[
                { bold: 'Equal parts starter, flour, water by weight',
                  note: '1:1:1 ratio — e.g. 50g starter + 50g flour + 50g water' },
                { bold: 'Mix until no dry flour remains',
                  note: 'cover loosely — starter needs airflow' },
                ...(starterState === 'fridge_fed'
                  ? [{ bold: 'Return to fridge once mixed',
                       note: 'slows the peak — gives you control over when it is ready' }]
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
                <div style={{ marginTop: '.5rem' }}>
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
              styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
            />
          </StepCard>

          {/* Put starter in fridge — fridge_fed state only */}
          {starterState === 'fridge_fed' && (
            <StepCard
              number={n()} {...sc()} icon={<IconCold />}
              title="Put starter in fridge"
              time={feedTime}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: 'Place fed starter in fridge straight away',
                    note: 'cold slows fermentation and holds the peak for longer' },
                  { bold: fridgeOutTime
                      ? `Take out at ${fridgeOutTime.toLocaleTimeString(
                          l === 'fr' ? 'fr-FR' : 'en-US',
                          { hour: 'numeric', minute: '2-digit', hour12: l !== 'fr' }
                        )}`
                      : 'Take out when ready to mix',
                    note: 'allow time to come to room temperature before mixing' },
                ]} />
              </Section>
            </StepCard>
          )}

          {/* Remove from fridge — fridge_fed state with fridgeOutTime */}
          {starterState === 'fridge_fed' && fridgeOutTime && (
            <StepCard
              number={n()} {...sc()} icon={<IconStarter />}
              title="Remove starter from fridge"
              time={fridgeOutTime}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: 'Take out of fridge and leave at room temperature',
                    note: `at ${displayTemp(kitchenTemp, u)} allow around ${
                      Math.round(getStarterFridgeWarmupH(kitchenTemp) * 60)
                    } min to reach peak activity` },
                  { bold: 'Look for dome and active bubbles at the sides',
                    note: 'mix when the starter is at its highest point' },
                ]} />
              </Section>
            </StepCard>
          )}

          {/* Feed 2 — Peak 2 scenario only */}
          {usingPeak2 && feed2Time && (
            <StepCard
              number={n()} {...sc()} icon={<IconStarter />}
              title="Feed your starter — second feed"
              time={feed2Time}
              accent="#6A7FA8"
            >
              <Section icon={null} title={t('sectionTitles.whatToDo')}>
                <Steps items={[
                  { bold: 'Starter will look deflated and smell quite sour',
                    note: 'this is exactly right — it is depleted and ready for its second feed' },
                  { bold: 'Equal parts starter, flour, water by weight',
                    note: 'same 1:1:1 ratio as the first feed' },
                  { bold: 'Mix thoroughly and cover loosely',
                    note: 'the second peak builds more acidity — expect a stronger, more complex flavour' },
                ]} />
              </Section>
              <StepExtras
                tips={
                  <Section icon={null} title={t('sectionTitles.readyWhen')}>
                    <Bullets items={[
                      'Same signs as the first feed — dome, doubled, bubbles at the sides',
                      'Flavour will be slightly more sour than the first peak',
                      'Mix at the dome — do not wait for it to collapse',
                    ]} />
                  </Section>
                }
                faqKey="starter"
                coachStepId="starter"
                coachTitle="Feed your starter — second feed"
                styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
              />
            </StepCard>
          )}
        </>
      )}

      {/* ── STEP: Mix Dough ─────────────────────────── */}
      <StepCard number={n()} {...sc()} icon={<IconMix />} title={t('stepTitles.mixDough')}
        time={bgMixStart} duration={schedule.mixingDurationH} accent={D.ash}>

        <Section icon="🥄" title={t('sectionTitles.mixingOrder')}>
          {mixerType === 'hand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: autolyse, then yeast+salt, brief knead, then bassinage, then full knead
              { bold: bgFlour90Label, note: 'mix until no dry flour — ~2 min' },
              { bold: 'Cover and rest 20 min', note: 'autolyse — gluten forms without kneading' },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: 'mix to combine — 2 min' }] : []),
              { bold: bgSaltLabel, note: 'mix until absorbed — 2 min' },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: 'mix until fully incorporated' }] : []),
              { bold: 'Knead 5 min to build base structure', note: 'dough should feel cohesive before adding remaining water' },
              { bold: bgWater10 ? `Add remaining water (${bgWater10}g) gradually` : 'Add remaining 10% water gradually', note: 'bassinage — small splash at a time, knead until absorbed, repeat' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'mix 1 min — oil added late preserves gluten' }] : []),
              { bold: 'Continue kneading until smooth and elastic', note: 'windowpane test — typically 5–8 min more' },
            ] : [
              // ≤70%: autolyse, yeast, salt, remaining water, then full knead
              { bold: bgFlour90Label, note: 'mix until no dry flour — ~2 min' },
              { bold: 'Cover and rest 20 min', note: 'autolyse — gluten forms without kneading' },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: 'mix to combine — 2 min' }] : []),
              { bold: bgSaltLabel, note: 'mix until absorbed — 2 min' },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: 'mix until fully incorporated' }] : []),
              { bold: bgWater10Label, note: 'mix until absorbed — ~1 min' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'mix 1 min — oil added late preserves gluten' }] : []),
              { bold: 'Knead 8–12 min until smooth and elastic', note: 'windowpane test' },
            ]} />
          )}
          {mixerType === 'stand' && !isSourdough && (
            <Steps items={hydration > 70 ? [
              // >70%: build structure first, then bassinage, then final Speed 2
              { bold: bgFlour90Label, note: 'Speed 1, 2 min to combine' },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: 'Speed 1, 2 min' }] : []),
              { bold: bgSaltLabel, note: 'Speed 1, 2 min until absorbed' },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: 'Speed 1, mix until incorporated' }] : []),
              { bold: 'Speed 2 — 4–5 min', note: 'build gluten structure before adding remaining water' },
              { bold: bgWater10 ? `Add remaining water (${bgWater10}g) gradually at Speed 2` : 'Add remaining 10% water gradually at Speed 2', note: 'bassinage — small additions, wait for absorption between each' },
              { bold: 'Continue Speed 2', note: 'until dough clears the bowl — windowpane test' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
            ] : [
              // ≤70%: remaining water before Speed 2
              { bold: bgFlour90Label, note: 'Speed 1, 2 min to combine' },
              ...(!hasPref ? [{ bold: bgYeastLabel, note: 'Speed 1, 2 min' }] : []),
              { bold: bgSaltLabel, note: 'Speed 1, 2 min until absorbed' },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: 'Speed 1, mix until incorporated' }] : []),
              { bold: bgWater10Label, note: 'Speed 1, mix until absorbed — ~1 min' },
              { bold: 'Speed 2 — 6–10 min', note: 'until dough clears the bowl — windowpane test' },
              ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
            ]} />
          )}
          {mixerType === 'spiral' && !isSourdough && (
            <>
              <Steps items={hydration > 70 ? [
                // >70%: pumpkin first, bassinage after
                { bold: bgMainFlour && bgWater90 ? `${bgMainFlour}g flour + ${bgWater90}g water (90%)${!isSourdough && !hasPref ? ' + yeast' : ''}` : 'Flour + 90% of your water', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: bgPoolishLabel, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: bgSaltLabel, note: 'Speed 1, 2 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                { bold: bgWater10 ? `Once pumpkin is stable — add remaining water (${bgWater10}g) gradually` : 'Once pumpkin is stable — add remaining 10% water gradually', note: 'bassinage — small additions, wait for pumpkin to reform each time' },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ] : [
                // ≤70%: remaining water before Speed 2
                { bold: bgMainFlour && bgWater90 ? `${bgMainFlour}g flour + ${bgWater90}g water (90%)${!isSourdough && !hasPref ? ' + yeast' : ''}` : 'Flour + 90% of your water', note: 'Speed 1, 3 min to combine' },
                ...(hasPref ? [{ bold: bgPoolishLabel, note: 'Speed 1, mix until incorporated' }] : []),
                { bold: bgSaltLabel, note: 'Speed 1, 2 min' },
                { bold: bgWater10Label, note: 'Speed 1, mix until absorbed — ~1 min' },
                { bold: 'Speed 2 until pumpkin shape forms', note: `typically 10–15 min — stop if FDT exceeds ${tempC(28, u)}` },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'Speed 1, 1 min' }] : []),
              ]} />
              <div style={{ marginTop: '.75rem' }}>
                <ExtLink href="https://www.theperfectloaf.com/how-to-mix-bread-and-pizza-dough-with-a-ooni-halo-pro-spiral-mixer/" label="See pumpkin shape photos →" />
              </div>
            </>
          )}
          {mixerType === 'no_knead' && (
            <Steps items={[
              { bold: 'Combine all ingredients including salt', note: 'mix just until no dry flour remains — ~2 min' },
              ...(hasPref ? [{ bold: bgPoolishLabel, note: 'mix until incorporated' }] : []),
              { bold: 'Cover and rest', note: 'stretch & folds every 30 min for the first 2 hours' },
            ]} />
          )}
          {isSourdough && (
            <>
              <Steps items={[
                { bold: bgFlour90Label, note: 'mix 2 min until no dry flour' },
                { bold: 'Add your starter at peak',
                  note: usingPeak2
                    ? 'second peak — the dough will have a slightly more complex flavour'
                    : 'use at the dome, do not wait for collapse' },
                { bold: bgSaltG && bgWater10 ? `Add salt (${bgSaltG}g) + remaining water (${bgWater10}g)` : 'Add salt + remaining 10% water', note: 'mix until fully absorbed' },
                ...(oil > 0 ? [{ bold: 'Add oil last', note: 'preserves gluten structure' }] : []),
              ]} />
              {planningMode === 'know_peak' && (
                <div style={{ marginTop: '.6rem', fontSize: '.75rem', color: D.smoke, fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic' }}>
                  Mix time is set to your stated peak — adjust if your starter peaks earlier or later than expected.
                </div>
              )}
              <div style={{
                fontSize: '.78rem',
                color: D.smoke,
                fontFamily: 'var(--font-dm-sans)',
                lineHeight: 1.55,
                marginTop: '.5rem',
                paddingTop: '.5rem',
                borderTop: `1px solid ${D.border}`,
              }}>
                {l === 'fr'
                  ? 'Après avoir prélevé votre levain, nourrissez le reste et remettez-le au frigo.'
                  : 'After taking your starter for this bake, feed what remains and return it to the fridge.'}
              </div>
            </>
          )}
        </Section>

        <Section icon="🌡️" title={t('sectionTitles.waterTemp')}>
          <Bullets items={[
            ...(recipe?.waterTemp != null ? [`Water temperature: ${Math.round(recipe.waterTemp)}°C`] : []),
            `Target Final Dough Temperature (FDT): ${isNeapolitan ? tempC(23, u) : tempC(24, u)}`,
          ]} />
        </Section>

        <StepExtras
          tips={<>
            <Section icon="🌡️" title={t('sectionTitles.waterTemp')}>
              <Bullets items={[
                ...(t.raw('mix.waterTempBullets') as string[]),
                `FDT above ${tempC(28, u)}: refrigerate dough for 15 min before bulk fermentation`,
              ]} />
              <div style={{ marginTop: '.5rem' }}>
                <LearnLink term="fdt" label="What is FDT?" onOpen={setLearnTerm} />
              </div>
            </Section>
            <Section icon="👁️" title={t('sectionTitles.watchFor')}>
              <Bullets items={[
                mixerType === 'spiral'
                  ? t('mix.watchForPumpkin')
                  : t('mix.watchForSmooth'),
                ...(t.raw('mix.watchForAll') as string[]),
              ]} />
              <div style={{ marginTop: '.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <LearnLink term="windowpane" label="Windowpane test" onOpen={setLearnTerm} showSparkle={true} />
                {mixerType === 'hand' && !isSourdough && <LearnLink term="autolyse" label="Autolyse" onOpen={setLearnTerm} />}
                {isSpiral && <LearnLink term="pumpkin" label="Pumpkin shape" onOpen={setLearnTerm} />}
                {hydration > 70 && <LearnLink term="bassinage" label="Bassinage" onOpen={setLearnTerm} />}
              </div>
            </Section>
            <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
              <Bullets items={[
                ...(t.raw('mix.pitfalls') as string[]).slice(0, 2),
                isSpiral ? `Ignoring FDT — spiral mixers generate heat, dough can exceed ${tempC(28, u)} without noticing` : '',
                (t.raw('mix.pitfalls') as string[])[2],
              ].filter(Boolean)} />
            </Section>
          </>}
          faqKey="mix"
          coachStepId="mix"
          coachTitle={t('stepTitles.mixDough')}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />
      </StepCard>

      {/* ── STEP: Bulk Fermentation ──────────────────── */}
      <StepCard number={n()} {...sc()} icon={<IconBulk />} title={t('stepTitles.bulkFerm')}
        time={schedule.bulkFermStart} duration={schedule.bulkFermHours} accent={D.terra}>

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          <Steps items={[
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
          ]} />
        </Section>

        <StepExtras
          tips={<>
            <Section icon="👁️" title="Watch for — bulk is done when">
              <Bullets items={t.raw('bulk.watchFor') as string[]} />
              <div style={{ marginTop: '.5rem' }}>
                <LearnLink term="bulk_fermentation" label="Bulk fermentation guide" onOpen={setLearnTerm} showSparkle={true} />
              </div>
            </Section>
            <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
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
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />
      </StepCard>

      {/* ── STEP: Cold Retard 1 ──────────────────────── */}
      {hasCold && schedule.coldRetard1Start && schedule.coldRetard1End && (
        <StepCard number={n()} {...sc()} icon={<IconCold />}
          title={isTwoPhase ? t('stepTitles.coldRetardWhole') : t('stepTitles.coldRetard')}
          time={schedule.coldRetard1Start}
          duration={(schedule.coldRetard1End.getTime() - schedule.coldRetard1Start.getTime()) / 3600000}
          accent="#6A7FA8">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(t.raw('coldRetard.steps') as { bold: string; note: string }[]).slice(0, 2),
              { bold: _isFr ? 'Réglez une alarme pour la division & le boulage' : 'Set your alarm for Divide & Ball time', note: formatTime(schedule.divideBallTime ?? schedule.coldRetard1End, _fmtLocale) },
              (t.raw('coldRetard.steps') as { bold: string; note: string }[])[2],
            ]} />
          </Section>

          <StepExtras
            tips={<>
              <Section icon="👁️" title={t('sectionTitles.whatToExpect')}>
                <Bullets items={t.raw('coldRetard.watchFor') as string[]} />
              </Section>
              <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
                <Bullets items={[
                  (t.raw('coldRetard.pitfalls') as string[])[0],
                  `Fridge temperature above ${tempC(8, u)}: dough over-ferments during retard — check your fridge`,
                  (t.raw('coldRetard.pitfalls') as string[])[1],
                ]} />
              </Section>
            </>}
            faqKey="cold"
            coachTitle={isTwoPhase ? t('stepTitles.coldRetardWhole') : t('stepTitles.coldRetard')}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
        </StepCard>
      )}

      {/* ── STEP: Divide & Shape (bread) / Divide & Ball (pizza) ── */}
      {schedule.divideBallTime && (
        <StepCard number={n()} {...sc()} icon={<IconDivide />}
          title={isBread ? t('stepTitles.divideShape') : t('stepTitles.divideBall')}
          time={schedule.divideBallTime} duration={divideMin / 60} accent="#8A6A4A">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            {isBread ? (
              <Steps items={isFougasse ? [
                { bold: `Divide into ${numItems} equal ${breadPiecePlural}`, note: (t.raw('divide.fougasse.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.fougasse.steps') as { bold: string; note: string }[]).slice(1),
              ] : isBaguette ? [
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.baguette.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.baguette.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : isLoafTin ? [
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.loafTin.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.loafTin.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ] : [
                // Boule / pain campagne / pain levain / sourdough
                { bold: `Divide into ${numItems} equal pieces`, note: (t.raw('divide.boule.steps') as { bold: string; note: string }[])[0].note },
                ...(t.raw('divide.boule.steps') as { bold: string; note: string }[]).slice(1),
                ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
              ]} />
            ) : (
              <>
                <Steps items={[
                  { bold: `Weigh dough and divide into ${numItems} equal pieces`, note: (t.raw('divide.pizza.steps') as { bold: string; note: string }[])[0].note },
                  ...(t.raw('divide.pizza.steps') as { bold: string; note: string }[]).slice(1),
                  ...(isTwoPhase ? [t.raw('divide.coverCold') as { bold: string; note: string }] : [t.raw('divide.coverRT') as { bold: string; note: string }]),
                ]} />
                {isPan && (
                  <div style={{
                    fontSize: '.75rem', color: 'var(--smoke)', fontStyle: 'italic',
                    fontFamily: 'var(--font-dm-sans)', marginTop: '6px',
                  }}>
                    Pan pizza: press dough directly into your oiled pan rather than
                    forming a round ball. Let it relax 10 min then stretch to the edges.
                  </div>
                )}
              </>
            )}
          </Section>

          <StepExtras
            tips={<>
              <Section icon="👁️" title={isBread ? t('sectionTitles.watchFor') : t('sectionTitles.watchForBall')}>
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
                    `At ${displayTemp(kitchenTemp, u)}, work within ${kitchenTemp >= 30 ? '15 min' : kitchenTemp >= 26 ? '20 min' : '30 min'} — warm kitchens make balls proof quickly`,
                  ]
                } />
              </Section>
              <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
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
                    `Hot kitchen (${kitchenTemp >= 30 ? 'like yours at ' + displayTemp(kitchenTemp, u) : '≥' + tempC(30, u)}): get balls into their boxes fast — they proof very quickly at warm temps`,
                  ]
                } />
              </Section>
              <div style={{ marginTop: '.5rem' }}>
                <LearnLink term="shape_check" label={l === 'fr' ? 'Vérifier ma forme' : 'Check your shape'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            </>}
            faqKey="divide"
            coachStepId="shape"
            coachTitle={isBread ? t('stepTitles.divideShape') : t('stepTitles.divideBall')}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
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

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(t.raw('coldBalls.steps') as { bold: string; note: string }[]),
              { bold: _isFr ? 'Réglez une alarme pour la remise à température' : 'Set your alarm for warmup time', note: schedule.rtWarmupStart ? formatTime(schedule.rtWarmupStart, _fmtLocale) : (_isFr ? 'voir le planning' : 'see schedule') },
            ]} />
          </Section>

          <StepExtras
            tips={<>
              <Section icon="👁️" title={t('sectionTitles.whatToExpect')}>
                <Bullets items={t.raw('coldBalls.watchFor') as string[]} />
              </Section>
              <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
                <Bullets items={t.raw('coldBalls.pitfalls') as string[]} />
              </Section>
            </>}
            faqKey="cold"
            coachTitle={isBread ? t('stepTitles.coldProof') : t('stepTitles.coldRetardBalls')}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
        </StepCard>
      )}

      {/* ── STEP: Final Proof (merged warmup + proof for cold-retard styles) */}
      {(schedule.finalProofHours > 0 || schedule.restRtHours > 0 || schedule.rtWarmupStart) && (
        <StepCard number={n()} {...sc()} icon={<IconProof />} title={t('stepTitles.finalProof')}
          time={schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart}
          duration={(() => {
            const proofEnd = schedule.bakeStart;
            const proofStart = schedule.rtWarmupStart ?? schedule.coldRetardEnd ?? schedule.finalProofStart;
            if (!proofStart || !proofEnd) return schedule.finalProofHours;
            return Math.max(0, (proofEnd.getTime() - proofStart.getTime()) / 3600000);
          })()}
          accent="#7A8C6E">

          <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
            <Steps items={[
              ...(hasCold ? [
                t.raw('finalProof.removeFridge') as { bold: string; note: string },
                { bold: `Rest ${kitchenTemp >= 30 ? '20–30' : kitchenTemp >= 26 ? '30–45' : '45–60'} min at room temperature`, note: 'warmup only — proofing begins naturally as dough relaxes' },
              ] : [
                ...(!isTwoPhase ? [t.raw('finalProof.shapeBalls') as { bold: string; note: string }] : [
                  t.raw('finalProof.alreadyShaped') as { bold: string; note: string },
                ]),
              ]),
              t.raw('finalProof.keepCovered') as { bold: string; note: string },
              t.raw('finalProof.pokeTest') as { bold: string; note: string },
              { bold: `Start preheating your oven ${hoursLabel(schedule.preheatStart ? (schedule.bakeStart.getTime() - schedule.preheatStart.getTime()) / 3600000 : 0.75)} before bake time`, note: 'oven heats while dough finishes proofing — they finish together' },
            ]} />
          </Section>

          <StepExtras
            tips={<>
              <Section icon="👁️" title={t('sectionTitles.pokeTest')}>
                <Bullets items={t.raw('finalProof.pokeResponses') as string[]} />
                <div style={{ marginTop: '.5rem' }}>
                  <LearnLink term="poke_test" label="Full poke test guide" onOpen={setLearnTerm} showSparkle={true} />
                </div>
              </Section>
              <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
                <Bullets items={[
                  (t.raw('finalProof.pitfalls') as string[])[0],
                  (t.raw('finalProof.pitfalls') as string[])[1],
                  `Warm kitchen (${displayTemp(kitchenTemp, u)}): proof can complete in ${kitchenTemp >= 30 ? '15–25 min' : kitchenTemp >= 26 ? '20–35 min' : '30–60 min'} after warmup — check early`,
                  (t.raw('finalProof.pitfalls') as string[])[2],
                ]} />
              </Section>
            </>}
            faqKey="proof"
            coachStepId="proof"
            coachTitle={t('stepTitles.finalProof')}
            styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
          />
        </StepCard>
      )}

      {/* ── STEP: Preheat Oven ───────────────────────── */}
      <StepCard number={n()} {...sc()} icon={<IconPreheat />} title={t('stepTitles.preheatOven')}
        time={schedule.preheatStart} accent={D.gold}>

        <div style={{ fontSize: '.75rem', color: D.smoke, fontStyle: 'italic',
          fontFamily: 'var(--font-dm-sans)', padding: '.75rem 0 0' }}>
          {t('preheatNote')}
        </div>

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          {isBread ? (
            <Steps items={(t.raw(
              ovenType === 'dutch_oven' ? 'preheat.dutch.steps' :
              ovenType === 'home_oven_stone_bread' ? 'preheat.stoneBread.steps' :
              ovenType === 'steam_oven' ? 'preheat.steam.steps' :
              ovenType === 'wood_fired' ? 'preheat.woodBread.steps' :
              'preheat.standardBread.steps'
            ) as { bold: string; note: string }[])} />
          ) : ovenType === 'pizza_oven' ? (
            <Steps items={t.raw('preheat.pizzaOven.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'electric_pizza' ? (
            <Steps items={t.raw('preheat.electricPizza.steps') as { bold: string; note: string }[]} />
          ) : ovenType === 'home_oven_steel' ? (
            <Steps items={t.raw('preheat.homeSteel.steps') as { bold: string; note: string }[]} />
          ) : (
            <Steps items={t.raw('preheat.homeStandard.steps') as { bold: string; note: string }[]} />
          )}
        </Section>

        <StepExtras
          tips={
            <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
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
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />
      </StepCard>

      {/* ── STEP: Bake & Eat ─────────────────────────── */}
      <StepCard number={n()} {...sc()} icon={<IconBake />} title={t('stepTitles.bakeEat')} time={schedule.bakeStart} accent="#5A9A50">

        <Section icon="🥄" title={t('sectionTitles.whatToDo')}>
          {isPan && (
            <div style={{
              background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)',
              borderRadius: '10px', padding: '10px 12px', marginBottom: '12px',
              fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)', color: 'var(--char)',
              lineHeight: 1.5,
            }}>
              <strong>Pan / Detroit / Deep Dish</strong> — dough bakes IN the oiled pan.
              No launching needed.{' '}
              <strong>Detroit style:</strong> push cheese all the way to the edges for
              caramelised crusts. Add sauce after baking.{' '}
              <strong>Deep Dish:</strong> press dough up the sides, add cheese directly
              on the dough, then toppings, then sauce on top — reverse order.
            </div>
          )}
          {isBread ? (
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

        <StepExtras
          tips={<>
            <Section icon="👁️" title={t('sectionTitles.watchFor')}>
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
            <Section icon="⚠️" title={t('sectionTitles.pitfalls')}>
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
              <Section icon="🎓" title={t('sectionTitles.learnMore')}>
                <ExtLink href="https://www.theperfectloaf.com/guides/how-to-score-bread-dough/" label={t('bake.learnMoreScoring')} />
                <div style={{ marginTop: '.5rem' }}>
                  <LearnLink term="score_technique" label={l === 'fr' ? 'Technique de grignage' : 'Scoring technique'} onOpen={setLearnTerm} showSparkle={true} />
                </div>
              </Section>
            )}
            {!isBread && (
              <div style={{ marginTop: '.5rem' }}>
                <LearnLink term="stretch_bake" label={l === 'fr' ? 'Étirer et cuire' : 'Stretch & bake tips'} onOpen={setLearnTerm} showSparkle={true} />
              </div>
            )}
          </>}
          faqKey="bake"
          coachStepId={isBread ? 'bake' : 'pizza_maestro'}
          coachTitle={t('stepTitles.bakeEat')}
          styleKey={styleKey} kitchenTemp={kitchenTemp} prefermentType={prefermentType} locale={locale ?? 'en'} ovenType={ovenType}
        />
        {!isBread && onNavigateToPizzaParty && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
            <button
              onClick={onNavigateToPizzaParty}
              style={{
                background: 'none', border: 'none',
                color: D.terra, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
                fontSize: '13px', fontWeight: 500,
                textDecoration: 'underline', padding: 0,
              }}
            >
              {l === 'fr' ? 'Planifier votre Pizza Party →' : 'Plan your Pizza Party →'}
            </button>
          </div>
        )}
      </StepCard>

      {learnTerm && (
        <LearnModal
          term={learnTerm}
          onClose={() => setLearnTerm(null)}
          footer={TERM_TO_STEPID[learnTerm] ? (
            <div style={{ borderTop: `1px solid ${D.border}`, marginTop: 16, paddingTop: 12 }}>
              <CoachButton
                stepId={TERM_TO_STEPID[learnTerm]}
                styleKey={styleKey}
                kitchenTemp={kitchenTemp}
                prefermentType={prefermentType}
                locale={locale ?? 'en'}
                ovenType={ovenType}
              />
            </div>
          ) : undefined}
        />
      )}
    </div>
  );
}
