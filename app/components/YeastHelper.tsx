'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations, useLocale } from 'next-intl';
import { type YeastType } from '../data';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface CalcData {
  rtHours: number;
  coldHours: number;
  kitchenTemp: number;
  fridgeTemp: number;
  idyPct: number;
  idyGrams: number;
}

interface YeastHelperProps {
  onSelect: (yeastType: YeastType) => void;
  onClose: () => void;
  selected?: YeastType | null;
  calcData?: CalcData;
  disabledIds?: string[];
  disabledNote?: string;
  styleKey?: string | null;
}


// ── "Which one do I have?" ────────────────────
// Specified in March and never built. The names are the whole problem: Active
// Dry sounds ready to use but must be woken in warm water first, and Instant
// sounds like a shortcut when it is in fact the stronger, more concentrated
// one. A baker holding a sachet cannot tell them apart from the selector
// alone, so they guess — and the yeast weight is the one number in the recipe
// where a wrong guess shows up in the rise.
const IDENTIFY = (fr: boolean) => [
  {
    id: 'instant' as YeastType,
    name: fr ? 'Instantanée' : 'Instant dry', dose: '×1',
    look: fr ? 'Granules fins, beige clair' : 'Fine, pale beige granules',
    label: fr ? '« Instantanée », « Instant », « Fast Action »' : '“Instant”, “Rapid Rise”, “Fast Action”',
    pro: fr ? 'Mélangez directement à la farine.' : 'Mix directly into the flour.',
    con: fr ? 'Pour une dose inférieure à 1 g, utilisez une balance de précision ou l’aide au dosage.' : 'Below 1 g, use a precision scale or the small-dose helper.',
  },
  {
    id: 'active_dry' as YeastType,
    name: fr ? 'Sèche active' : 'Active dry', dose: '×1,33',
    look: fr ? 'Granules plus gros que l’instantanée' : 'Larger granules than instant yeast',
    label: fr ? '« Sèche active », « Active Dry » ; vérifiez le mode d’emploi' : '“Active Dry”; check the instructions',
    pro: fr ? 'Réhydratez si le sachet le demande, à la température indiquée.' : 'Rehydrate if the packet requires it, at the stated temperature.',
    con: fr ? 'Prélevez cette eau sur la quantité de la recette.' : 'Take that water from the recipe’s allowance.',
  },
  {
    id: 'fresh' as YeastType,
    name: fr ? 'Fraîche' : 'Fresh', dose: '×3',
    look: fr ? 'Bloc beige qui s’émiette, vendu au frais' : 'A crumbly beige block, sold refrigerated',
    label: fr ? '« Levure de boulanger fraîche »' : '“Fresh”, “Cake yeast”, “Compressed”',
    pro: fr ? 'Émiettez-la pour bien la répartir au mélange.' : 'Crumble it to distribute evenly during mixing.',
    con: fr ? 'Conservez au réfrigérateur et respectez la date sur l’emballage.' : 'Keep refrigerated and follow the date on the pack.',
  },
  {
    id: 'sourdough' as YeastType,
    name: fr ? 'Levain' : 'Sourdough', dose: '—',
    look: fr ? 'Culture de farine et d’eau entretenue par des rafraîchis' : 'A flour-and-water culture maintained with feeds',
    label: fr ? '« Levain actif », « Sourdough starter »' : '“Active starter”, “Sourdough starter”, “Levain”',
    pro: fr ? 'Prévoyez le rafraîchi pour que le levain soit prêt au mélange.' : 'Time the feed so your starter is ready for mixing.',
    con: fr ? 'Vérifiez sa montée et ses bulles ; le temps seul ne suffit pas.' : 'Check its rise and bubbles; time alone is not enough.',
  },
];

function YeastInfoSheet({ id, onPick, onClose, fr }: {
  id: YeastType; onPick: (y: YeastType) => void; onClose: () => void; fr: boolean;
}) {
  // Rendered into <body>. A position:fixed element is anchored to the nearest
  // ancestor carrying a transform, and this sits inside the step page, which
  // animates in on translateX — so "fixed" meant fixed to the page, and the
  // sheet painted underneath the summary bar.
  const y = IDENTIFY(fr).find(v => v.id === id);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (typeof document === 'undefined') return null;
  if (!y) return null;
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.5)', zIndex: 300 }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 301,
        background: 'var(--warm)', borderRadius: '20px 20px 0 0',
        padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* The handle closes too — it looks draggable, so a tap on it should
            do the obvious thing rather than nothing. */}
        <button
          onClick={onClose}
          aria-label={fr ? 'Fermer' : 'Close'}
          style={{
            display: 'block', width: '100%', minHeight: '20px', padding: '4px 0 12px',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', width: '38px', height: '4px', borderRadius: '2px', background: '#E0D8CC', margin: '0 auto' }} />
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '2px' }}>
          <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700, margin: 0 }}>{y.name}</h3>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: '#9C8248' }}>{y.dose}</span>
          {/* This sheet is reached from the info dot, so most bakers who open
              it are reading, not choosing. Without a visible way out, the only
              exit was to pick the yeast they came to read about. */}
          <button
            onClick={onClose}
            aria-label={fr ? 'Fermer' : 'Close'}
            style={{
              marginLeft: 'auto', width: '44px', height: '44px', flexShrink: 0,
              margin: '-11px -11px -11px auto', alignSelf: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--smoke)', fontSize: '17px', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12.5px', color: 'var(--smoke)', margin: '0 0 14px', lineHeight: 1.5 }}>
          {y.look}<br />
          {fr ? 'Sur l\u2019étiquette : ' : 'On the label: '}{y.label}
        </p>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ash)', lineHeight: 1.55 }}>
          <div style={{ marginBottom: '5px' }}>
            {y.pro}
          </div>
          <div>{y.con}</div>
        </div>
        {/* The dose is relative to instant, which is the engine's reference —
            and the plan converts it, so this is context, not a task. */}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)', margin: '12px 0 0', lineHeight: 1.5 }}>
          {y.id === 'sourdough'
            ? (fr ? 'Renseignez vos rafraîchis à l’étape du planning.'
                  : 'Enter your starter feeds in the planning step.')
            : (fr ? `Dose ${y.dose} par rapport à l\u2019instantanée. Le plan la convertit pour vous.`
                  : `Dose ${y.dose} against instant. The plan converts it for you.`)}
        </p>
        <button
          onClick={() => { onPick(y.id); onClose(); }}
          style={{
            marginTop: '16px', width: '100%', minHeight: '44px',
            border: '1px solid #6B4423', background: 'transparent', borderRadius: '12px',
            color: '#6B4423', fontFamily: 'var(--font-ui)', fontSize: '14px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >{y.id === 'sourdough' ? (fr ? 'Utiliser ce levain' : 'Use this starter') : (fr ? 'Utiliser cette levure' : 'Use this yeast')}</button>
      </div>
    </>,
    document.body,
  );
}

export default function YeastHelper({ onSelect, onClose, selected, calcData, disabledIds, disabledNote, styleKey }: YeastHelperProps) {
  const t = useTranslations('yeast');
  const locale = useLocale();
  const [showCalc, setShowCalc] = useState(false);
  const [identify, setIdentify] = useState<YeastType | null>(null);

  // Option IDs use YEAST_TYPES keys; i18n keys use simplified aliases (idy/ady)
  const options = [
    { id: 'instant',    image: '/images/approved/leavening-v2/instant.webp',   title: t('idy.title'),       tagline: t('idy.tagline') },
    { id: 'active_dry', image: '/images/approved/leavening-v2/active-dry.webp',    title: t('ady.title'),       tagline: t('ady.tagline') },
    { id: 'fresh',      image: '/images/approved/leavening-v2/fresh.webp',     title: t('fresh.title'),     tagline: t('fresh.tagline') },
    { id: 'sourdough',  image: '/images/approved/leavening-v2/starter.webp', title: t('sourdough.title'), tagline: t('sourdough.tagline') },
  ];

  const sourdoughRecommended = ['pain_levain', 'pain_campagne', 'sourdough'].includes(styleKey ?? '');
  const sourdoughTraditional = styleKey === 'pain_levain';

  const orderedOptions = sourdoughRecommended
    ? [
        options.find(o => o.id === 'sourdough')!,
        ...options.filter(o => o.id !== 'sourdough'),
      ]
    : options;

  const selectedOpt = options.find(o => o.id === selected);

  return (
    <div>
      {/* Single-picker page: no collapse. Folding the list into a summary
          hides the alternatives behind a CHANGE link and turns one tap into
          three. Oven and mixer still fold, because they share one page and
          folding the first is what reveals the second. */}
      <div>
          {/* "How you'll leaven the dough" only restated the title, and the
              line it cost was the difference between this page fitting on one
              screen and not. Each option already carries its own tagline. */}
          <DecisionList layout="lateral"
            options={orderedOptions.map(opt => ({
              ...opt,
              tagline: opt.id === 'sourdough' && sourdoughRecommended
                ? (locale === 'fr'
                    ? `${opt.tagline} · Recommandé pour ce pain`
                    : `${opt.tagline} · Recommended for this style`)
                : opt.id !== 'sourdough' && sourdoughTraditional
                ? (locale === 'fr'
                    ? `${opt.tagline} · Non traditionnel pour le pain au levain`
                    : `${opt.tagline} · Non-traditional for pain au levain`)
                : opt.tagline,
            }))}
            selectedId={selected ?? ''}
            onSelect={(id) => onSelect(id as YeastType)}
            disabledIds={disabledIds}
            onInfo={(id) => setIdentify(id as YeastType)}
            infoLabel={locale === 'fr' ? 'En savoir plus' : 'Learn more'}
          />
          {disabledNote && disabledIds && disabledIds.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', margin: '8px 0 0' }}>
              {disabledNote}
            </p>
          )}

          {/* No line explaining the i. A circled i is one of the few marks
              nobody needs taught, and the sentence cost more attention than
              the sign it described. */}

          {identify && (
            <YeastInfoSheet
              id={identify}
              fr={locale === 'fr'}
              onClose={() => setIdentify(null)}
              onPick={(y) => onSelect(y)}
            />
          )}
      </div>

      {/* Transparency panel — always visible when calcData is present */}
      {calcData && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={() => setShowCalc(v => !v)}
            style={{
              fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
              cursor: 'pointer', textDecoration: 'underline', background: 'none',
              border: 'none', padding: 0,
            }}
          >
            {showCalc ? (locale === 'fr' ? 'Masquer le calcul ↑' : 'Hide calculation ↑') : (locale === 'fr' ? 'Comment est-ce calculé ? ↓' : 'How was this calculated? ↓')}
          </button>

          {showCalc && (
            <div style={{
              background: 'var(--cream)', border: '1.5px solid var(--border)',
              borderRadius: '16px', padding: '12px 16px', marginTop: '8px',
              fontSize: '12px', color: 'var(--ash)', lineHeight: 1.7,
            }}>
              <div>{locale === 'fr' ? 'Modèle : formule par phase de Craig v1.1' : "Model: Craig's per-stage formula v1.1"}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                RT phases: IDY% = 9.5 / (hours^1.65 × 2.5^((temp−25)/10))
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)' }}>
                Cold phase: IDY% = 7.5 / hours^1.313
              </div>
              {calcData.kitchenTemp >= 30 && (
                <div>
                  Tropical correction applied:{' '}
                  <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                    ÷{calcData.kitchenTemp <= 32 ? '1.15' : '1.25'} at {calcData.kitchenTemp <= 32 ? '30–32°C' : '33–35°C'}
                  </span>
                </div>
              )}
              <div style={{ marginTop: '4px' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  RT hours: {calcData.rtHours}h
                  {' · '}Cold hours: {calcData.coldHours}h
                  {' · '}Kitchen: {calcData.kitchenTemp}°C
                  {' · '}Fridge: {calcData.fridgeTemp}°C
                </span>
              </div>
              <div>
                Result:{' '}
                <span style={{ fontFamily: 'var(--font-dm-mono)' }}>
                  IDY: {calcData.idyPct}% → {calcData.idyGrams}g
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
