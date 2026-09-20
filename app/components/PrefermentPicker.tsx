'use client';
import { PREFERMENT_TYPES, type PrefermentType } from '../data';
import { useTranslations, useLocale } from 'next-intl';
import DecisionList from './DecisionList';

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
                    {fr ? 'Part de toute la farine' : 'Share of all flour'}
                    <span><input type="number" min={10} max={60} step={1} value={flourPct ?? suggestedFlourPct} onChange={e => { const value = Number(e.target.value); if (e.target.value !== '' && value >= 10 && value <= 60) onFlourPctChange(value); }} style={{ width: 72, minHeight: 44, border: '1px solid var(--border)', borderRadius: 8, padding: 8 }} /> %</span>
                  </label>
                  <input type="range" aria-label={fr ? 'Part de farine en préferment' : 'Prefermented flour share'} min={10} max={60} step={5} value={flourPct ?? suggestedFlourPct} onChange={e => onFlourPctChange(Number(e.target.value))} style={{ width: '100%', minHeight: 44, accentColor: 'var(--terra)' }} />
                  <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--smoke)' }}>{fr ? 'Point de départ suggéré' : 'Suggested starting point'} : {suggestedFlourPct}%</p>
                  <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--smoke)' }}>{fr ? 'Point de départ avant de définir le planning.' : 'Starting point until the schedule is set.'}</p>
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
                    {selected === 'poolish' ? <ul>
                      <li>{fr ? 'Premier essai ? Gardez 20 %.' : 'First try? Keep 20%.'}</li>
                      <li>{fr ? '10 % : un changement plus discret par rapport à votre pâte directe habituelle.' : '10%: a smaller change from your usual direct dough.'}</li>
                      <li>{fr ? '30 % : davantage de farine mûrit à l’avance ; essayez après avoir appris à reconnaître un poolish prêt.' : '30%: more of the flour matures ahead; try it once you know when your poolish is ready.'}</li>
                      <li>{fr ? 'Plus n’est pas forcément mieux. Pour une forte proportion, suivez une recette éprouvée.' : 'Higher is not automatically better. Follow a tested recipe for large proportions.'}</li>
                    </ul> : <p>{fr ? 'Cette biga utilise 45 % d’eau par rapport à sa farine. Pour choisir une proportion, suivez une recette éprouvée.' : 'This recipe’s biga uses 45% water relative to its flour. Follow a tested recipe to choose its proportion.'}</p>}
                    <p>{fr ? 'Le pourcentage de préferment est sa part de toute la farine de la recette. Ce n’est pas son hydratation.' : 'Preferment percentage means its share of all recipe flour. It is different from hydration.'}</p>
                  </details>
                  {flourPct !== undefined && flourPct !== suggestedFlourPct && <button type="button" onClick={() => onFlourPctChange(undefined)} style={{ minHeight: 44, background: 'transparent', border: 0, color: 'var(--terra)', textDecoration: 'underline', cursor: 'pointer' }}>{fr ? 'Revenir à la suggestion' : 'Reset to suggestion'}</button>}
                </div>
              )}
            </div>)}
          </div>
      </div>

      {/* Hydration / cold-ferment pills when a preferment is active */}
      {selected !== null && selected !== 'none' && (() => {
        const pData = PREFERMENT_TYPES[selected] as { hydration?: number; cold?: boolean };
        if (!pData.hydration && !pData.cold) return null;
        return (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {pData.hydration && (
              <span style={{
                fontSize: '11px', fontFamily: 'var(--font-ui)',
                background: 'var(--cream)', color: 'var(--ash)',
                borderRadius: '20px', padding: '.1rem 8px',
                border: '1px solid var(--border)',
              }}>
                {pData.hydration}% {t('hydration')}
              </span>
            )}
            {pData.cold && (
              <span style={{
                fontSize: '11px', fontFamily: 'var(--font-ui)',
                background: 'rgba(107,122,90,0.1)', color: 'var(--sage)',
                borderRadius: '20px', padding: '.1rem 8px',
                border: '1px solid rgba(107,122,90,0.25)',
              }}>
                {t('coldFerment')}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
