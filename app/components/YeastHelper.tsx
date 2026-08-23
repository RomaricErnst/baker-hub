'use client';
import { useState } from 'react';
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

function IdentifySheet({ onPick, onClose, fr }: {
  onPick: (y: YeastType) => void; onClose: () => void; fr: boolean;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.45)', zIndex: 150 }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 151,
        background: 'var(--warm)', borderRadius: '20px 20px 0 0',
        padding: '14px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ width: '38px', height: '4px', borderRadius: '2px', background: '#E0D8CC', margin: '0 auto 12px' }} />
        <h3 style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, margin: '0 0 4px' }}>
          {fr ? 'Laquelle avez-vous ?' : 'Which one do you have?'}
        </h3>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12.5px', color: 'var(--smoke)', margin: '0 0 14px', lineHeight: 1.45 }}>
          {fr ? 'Regardez le sachet : l\u2019aspect suffit presque toujours.'
              : 'Look at the packet — the appearance is almost always enough.'}
        </p>
        {IDENTIFY(fr).map(y => (
          <div key={y.id} style={{
            border: '1px solid var(--border)', background: '#fff',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '10px',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14.5px', fontWeight: 700, marginBottom: '8px' }}>
              {y.look}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)', marginBottom: '10px', lineHeight: 1.45 }}>
              {fr ? 'Sur l\u2019étiquette : ' : 'On the label: '}{y.label}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12.5px', color: 'var(--ash)', lineHeight: 1.5 }}>
              <div style={{ marginBottom: '4px' }}>
                <span style={{ color: '#6B7A5A', fontWeight: 700 }}>+ </span>{y.pro}
              </div>
              <div>
                <span style={{ color: '#9C8248', fontWeight: 700 }}>− </span>{y.con}
              </div>
            </div>
            <button
              onClick={() => { onPick(y.id); onClose(); }}
              style={{
                marginTop: '12px', width: '100%', minHeight: '44px',
                border: '1px solid #6B4423', background: 'transparent', borderRadius: '12px',
                color: '#6B4423', fontFamily: 'var(--font-ui)', fontSize: '13.5px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >{fr ? 'C\u2019est celle-là' : 'That\u2019s the one'}</button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function YeastHelper({ onSelect, onClose, selected, calcData, disabledIds, disabledNote, styleKey }: YeastHelperProps) {
  const t = useTranslations('yeast');
  const locale = useLocale();
  const [showCalc, setShowCalc] = useState(false);
  const [identify, setIdentify] = useState(false);

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
          />
          {disabledNote && disabledIds && disabledIds.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', margin: '8px 0 0' }}>
              {disabledNote}
            </p>
          )}

          {/* One tap, under the list, phrased as the question the baker is
              actually asking. A bare "i" would have to be noticed and
              interpreted; this says what it answers. */}
          <button
            onClick={() => setIdentify(true)}
            style={{
              marginTop: '12px', width: '100%', minHeight: '44px',
              background: 'none', border: 'none', padding: '10px 0',
              fontFamily: 'var(--font-ui)', fontSize: '13px', color: '#6B4423',
              textDecoration: 'underline', textUnderlineOffset: '3px',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {locale === 'fr' ? 'Vous ne savez pas laquelle vous avez ? →' : 'Not sure which one you have? →'}
          </button>

          {identify && (
            <IdentifySheet
              fr={locale === 'fr'}
              onClose={() => setIdentify(false)}
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
