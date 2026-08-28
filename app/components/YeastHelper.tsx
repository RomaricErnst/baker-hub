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
    name: fr ? 'Instantanée' : 'Instant dry',
    dose: '×1',
    use: fr ? 'Le choix par défaut, et le seul qui pardonne six mois oubliés dans un placard.'
            : 'The default choice, and the only one that forgives six months forgotten in a cupboard.',
    look: fr ? 'Granules très fins, presque une poudre, beige clair'
             : 'Very fine granules, almost a powder, pale beige',
    label: fr ? '« Instantanée », « Instant », « Rapid Rise », « Fast Action », « Briochin »'
              : '"Instant", "Rapid Rise", "Fast Action", "Easy Bake", "Quick"',
    pro: fr ? 'Se verse directement dans la farine, sans réveil. La plus concentrée, et la plus stable au fil des mois.'
            : 'Goes straight into the flour, no waking needed. The most concentrated, and the most stable over months.',
    con: fr ? 'Se dose en très petites quantités — sous 1 g, une balance au dixième devient utile.'
            : 'Used in very small amounts — below 1g a 0.01g scale starts to matter.',
  },
  {
    id: 'active_dry' as YeastType,
    name: fr ? 'Active' : 'Active dry',
    dose: '×1,33',
    use: fr ? 'Quand c\u2019est ce que vend votre supermarché — elle fait le même pain, avec une étape de plus.'
            : 'When it is what your supermarket sells — same bread, one more step.',
    look: fr ? 'Granules plus gros, bruns, visibles à l\u2019œil nu'
             : 'Larger granules, brown, clearly visible',
    label: fr ? '« Active », « Traditionnelle », « Boulangère », « Active Dry »'
              : '"Active Dry", "Traditional", "Original"',
    pro: fr ? 'La plus répandue en grande surface, et la moins chère.'
            : 'The most widely stocked, and the cheapest.',
    con: fr ? 'Doit être réveillée dans l\u2019eau tiède avant le pétrissage — versée sèche dans la farine, une partie ne repart jamais. Il en faut un tiers de plus.'
            : 'Must be woken in warm water before mixing — added dry to the flour, part of it never restarts. Needs a third more.',
  },
  {
    id: 'fresh' as YeastType,
    name: fr ? 'Fraîche' : 'Fresh',
    dose: '×3',
    use: fr ? 'Quand vous boulangez dans la semaine qui suit l\u2019achat. Au-delà, elle se perd.'
            : 'When you bake within a week of buying it. Beyond that, it goes to waste.',
    look: fr ? 'Un bloc mou beige-gris qui s\u2019émiette, au rayon frais'
             : 'A soft beige-grey block that crumbles, sold refrigerated',
    label: fr ? '« Fraîche », « Levure de boulanger fraîche », « Cube »'
              : '"Fresh", "Cake yeast", "Compressed"',
    pro: fr ? 'Le goût le plus rond, et le démarrage le plus franc. Le choix des professionnels.'
            : 'The roundest flavour and the most decisive start. What professionals use.',
    con: fr ? 'Périssable — deux semaines au frais, et elle meurt sans prévenir. Il en faut trois fois plus.'
            : 'Perishable — two weeks refrigerated, and it dies without warning. Needs three times as much.',
  },
  {
    id: 'sourdough' as YeastType,
    name: fr ? 'Levain' : 'Sourdough',
    dose: '—',
    use: fr ? 'Quand le pain est le sujet, pas le support. Demande d\u2019en avoir un vivant.'
            : 'When the bread is the subject, not the base. Requires keeping one alive.',
    look: fr ? 'Un bocal de pâte vivante que vous nourrissez vous-même'
             : 'A jar of living culture you feed yourself',
    label: fr ? '« Levain », « Sourdough starter », « Lievito madre »'
              : '"Sourdough starter", "Levain", "Lievito madre"',
    pro: fr ? 'Le goût, la conservation, la digestibilité. Rien d\u2019autre ne le remplace.'
            : 'Flavour, keeping quality, digestibility. Nothing else replaces it.',
    con: fr ? 'Sa force dépend de sa santé et de sa dernière rafraîchi — le plan suit la pâte, pas l\u2019horloge.'
            : 'Its strength depends on its health and last feed — the plan follows the dough, not the clock.',
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
            <span style={{ color: '#6B7A5A', fontWeight: 700 }}>+ </span>{y.pro}
          </div>
          <div><span style={{ color: '#9C8248', fontWeight: 700 }}>− </span>{y.con}</div>
        </div>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ash)', fontStyle: 'italic', margin: '12px 0 0', lineHeight: 1.5 }}>
          {y.use}
        </p>
        {/* The dose is relative to instant, which is the engine's reference —
            and the plan converts it, so this is context, not a task. */}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)', margin: '12px 0 0', lineHeight: 1.5 }}>
          {y.id === 'sourdough'
            ? (fr ? 'Le plan suit la pâte plutôt que l\u2019horloge — la quantité dépend de votre levain.'
                  : 'The plan follows the dough rather than the clock — the amount depends on your starter.')
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
        >{fr ? 'C\u2019est celle-là' : 'That\u2019s the one'}</button>
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
    { id: 'instant',    image: '/yeast_instant.webp',   title: t('idy.title'),       tagline: t('idy.tagline') },
    { id: 'active_dry', image: '/yeast_active.webp',    title: t('ady.title'),       tagline: t('ady.tagline') },
    { id: 'fresh',      image: '/yeast_fresh.webp',     title: t('fresh.title'),     tagline: t('fresh.tagline') },
    { id: 'sourdough',  image: '/yeast_sourdough.webp', title: t('sourdough.title'), tagline: t('sourdough.tagline') },
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
          <DecisionList
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
