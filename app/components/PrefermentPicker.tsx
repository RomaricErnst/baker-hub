'use client';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useTranslations, useLocale } from 'next-intl';
import DecisionList from './DecisionList';
import { useEffect, useState } from 'react';

interface PrefermentPickerProps {
  // null means the step has not been settled yet — nothing is highlighted and
  // the follow-on pills stay hidden, because a code default that looks chosen
  // is exactly what the preset rule exists to stop.
  selected: PrefermentType | null;
  directOnly?: boolean;
  onSelect: (type: PrefermentType) => void;
  flourPct?: number;
  onFlourPctChange?: (pct: number | undefined) => void;
  suggestedFlourPct?: number;
  totalFlourGrams?: number;
  styleKey?: string;
  hideTypes?: PrefermentType[];
  kitchenTemp?: number;
  yeastType?: string;
}

export default function PrefermentPicker({
  selected, onSelect, flourPct, onFlourPctChange, suggestedFlourPct = 20, directOnly = false,
  styleKey, hideTypes = [], kitchenTemp, yeastType, totalFlourGrams,
}: PrefermentPickerProps) {
  const t = useTranslations('preferment');
  const fr = useLocale() === 'fr';
  const committedPct = flourPct ?? suggestedFlourPct;
  const [pctDraft, setPctDraft] = useState(String(committedPct));
  useEffect(() => { setPctDraft(String(committedPct)); }, [committedPct, selected]);
  function commitPct() {
    const value = Number(pctDraft);
    if (pctDraft.trim() !== '' && Number.isFinite(value)) {
      const bounded = Math.max(10, Math.min(60, Math.round(value)));
      setPctDraft(String(bounded));
      if (bounded !== committedPct) onFlourPctChange?.(bounded);
    } else setPctDraft(String(committedPct));
  }

  const ALL_OPTIONS = [
    { id: 'none',    image: '/images/approved/preferment/direct.webp',  title: t('none.title'),    tagline: t('none.tagline') },
    { id: 'poolish', image: '/images/approved/preferment/poolish.webp', title: t('poolish.title'), tagline: t('poolish.tagline') },
    { id: 'biga',    image: '/images/approved/preferment/biga.webp',    title: t('biga.title'),    tagline: t('biga.tagline') },
    { id: 'levain',  image: '/images/approved/leavening-v2/starter.webp',    title: t('levain.title'),  tagline: t('levain.tagline') },
  ];

  const options = ALL_OPTIONS
    .filter(o => !hideTypes.includes(o.id as PrefermentType))
    .filter(o => o.id !== 'levain' || yeastType === 'sourdough')
    .map(o => {
      const pData = PREFERMENT_TYPES[o.id as PrefermentType] as { bestFor?: string[] };
      const isRecommended = o.id !== 'none' && styleKey && pData?.bestFor?.includes(styleKey);
      return { ...o, badge: isRecommended ? t('recommended') : undefined };
    });

  // Collapsing to a summary made sense when this picker shared a card with
  // others. On its own page it hides the alternatives behind a CHANGE link and
  // turns a one-tap decision into three — and the page already has a title, so
  // the summary was the second thing repeating what the header said.
  return (
    <div>
      <div>
          {/* No heading here: the step page above already says "Preferment
              method". Two titles, one question. */}
          {directOnly && <p style={{ fontSize: 13, color: 'var(--smoke)' }}>{fr ? 'Cette recette enrichie est actuellement prévue sans préferment.' : 'This enriched recipe currently supports the direct method only.'}</p>}
          <div style={{ display: 'grid', gap: 12 }}>
            {options.map(option => <div key={option.id}>
              <DecisionList layout="lateral" options={[option]} disabledIds={directOnly && option.id !== 'none' ? [option.id] : []} selectedId={selected ?? ''} onSelect={id => onSelect(id as PrefermentType)} />
              {!directOnly && selected === option.id && selected !== 'none' && selected !== 'levain' && onFlourPctChange && (
                <div style={{ padding: '12px 14px', border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 12px 12px', background: 'var(--warm)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                    {fr ? 'Farine réservée au préferment' : 'Flour allocated to preferment'}
                    <span><input type="number" min={10} max={60} step={1} value={pctDraft} onChange={e => setPctDraft(e.target.value)} onBlur={commitPct} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} style={{ width: 72, minHeight: 44, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }} /> %</span>
                  </label>
                  <input type="range" aria-label={fr ? 'Part de farine en préferment' : 'Prefermented flour share'} min={10} max={60} step={1} value={flourPct ?? suggestedFlourPct} onChange={e => { setPctDraft(e.target.value); onFlourPctChange(Number(e.target.value)); }} style={{ width: '100%', minHeight: 44, accentColor: 'var(--terra)' }} />
                  <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--smoke)' }}>{fr ? 'Proportion suggérée' : 'Suggested proportion'} : {suggestedFlourPct}%</p>
                  {totalFlourGrams !== undefined && Number.isFinite(totalFlourGrams) && totalFlourGrams > 0 && (() => {
                    const pct = flourPct ?? suggestedFlourPct;
                    const prefFlour = Math.round(totalFlourGrams * pct / 100);
                    const prefWater = Math.round(prefFlour * PREFERMENT_TYPES[selected].hydration / 100);
                    const format = (grams: number) => `${grams.toLocaleString(fr ? 'fr-FR' : 'en-US')} g`;
                    return <p aria-live="polite" style={{ fontSize: 13 }}>{fr
                      ? `${pct} % de toute la farine · ${format(prefFlour)} de farine + ${format(prefWater)} d’eau (estimation)`
                      : `${pct}% of all flour · ${format(prefFlour)} flour + ${format(prefWater)} water (estimate)`}</p>;
                  })()}
                  <details style={{ marginTop: 8, fontSize: 13 }}>
                    <summary style={{ minHeight: 44, cursor: 'pointer' }}>{fr ? 'M’aider à choisir' : 'Help me choose'}</summary>
                    <ul>
                      <li>{fr ? `${suggestedFlourPct} % : commencez ici pour un premier essai.` : `${suggestedFlourPct}%: start here for your first attempt.`}</li>
                      <li>{selected === 'biga'
                        ? (fr ? '10 % : moins de biga ferme à incorporer, pour vous familiariser avec cette méthode.' : '10%: less stiff biga to incorporate while you get familiar with the method.')
                        : (fr ? '10 % : moins de poolish à préparer, pour apprendre à reconnaître sa maturité.' : '10%: less poolish to prepare while you learn to recognise its maturity.')}</li>
                      <li>{selected === 'biga'
                        ? (fr ? '30 % : essayez lorsque vous maîtrisez la maturité de la biga et son incorporation homogène.' : '30%: try once you can recognise ripe biga and incorporate it evenly.')
                        : (fr ? '30 % : davantage de farine mûrit à l’avance ; essayez lorsque vous reconnaissez un poolish prêt.' : '30%: more flour matures ahead; try once you can recognise a ripe poolish.')}</li>
                    </ul>
                    <p>{fr ? 'Augmentez progressivement ; plus n’est pas forcément mieux.' : 'Increase gradually; more is not always better.'}</p>
                  </details>
                  {flourPct !== undefined && flourPct !== suggestedFlourPct && <button type="button" onClick={() => onFlourPctChange(undefined)} style={{ minHeight: 44, background: 'transparent', border: 0, color: 'var(--terra)', textDecoration: 'underline', cursor: 'pointer' }}>{fr ? 'Revenir à la suggestion' : 'Reset to suggestion'}</button>}
                </div>
              )}
            </div>)}
          </div>
      </div>

    </div>
  );
}
