'use client';

import { useState, type CSSProperties, type InputHTMLAttributes } from 'react';

import { displayWeight, gToOz, ozToG, type UnitSystem } from '../utils/units';

/** Keep incomplete keystrokes local; normalize only when the baker commits. */
function DraftNumberInput({ value, onCommit, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onKeyDown'> & { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <input {...props} value={draft ?? String(value)}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onCommit(Number(draft));
      setDraft(null);
    }}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); setDraft(null); }
    }} />;
}

export type QuantityCrust = 'thin' | 'classic' | 'generous';

export interface QuantityWeightBounds {
  min: number;
  max: number;
  step: number;
}

export interface PrototypeQuantityPickerProps {
  bakeType: 'pizza' | 'bread';
  units?: UnitSystem;
  /** Style keys with diameter/edge presets, such as neapolitan or newyork. */
  roundPizza?: boolean;
  locale?: 'en' | 'fr' | string;
  count: number;
  itemWeight: number;
  diameter?: number;
  diameterBounds?: { min: number; max: number };
  crust?: QuantityCrust;
  weightIsManual?: boolean;
  calculatedWeight?: number;
  weightBounds?: QuantityWeightBounds;
  countBounds?: { min?: number; max?: number; step?: number };
  itemLabel?: string;
  calculateWeight?: (diameter: number, crust: QuantityCrust) => number;
  onCountChange: (value: number) => void;
  onItemWeightChange: (value: number) => void;
  onDiameterChange?: (value: number) => void;
  onCrustChange?: (value: QuantityCrust) => void;
  onWeightModeChange?: (manual: boolean) => void;
  onUseCalculatedWeight?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  limitNote?: string;
  onLimitMore?: () => void;
  limitMoreLabel?: string;
}

const DEFAULT_WEIGHT_BOUNDS: QuantityWeightBounds = { min: 150, max: 500, step: 5 };
const CRUSTS: Array<{ id: QuantityCrust; en: string; fr: string }> = [
  { id: 'thin', en: 'Thin', fr: 'Fine' },
  { id: 'classic', en: 'Classic', fr: 'Classique' },
  { id: 'generous', en: 'Generous', fr: 'Généreuse' },
];

function grams(value: number): string {
  return `${Math.round(value).toLocaleString('en-US')} g`;
}

function clamp(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const stepped = Math.round(value / step) * step;
  return Math.max(min, Math.min(max, stepped));
}

/**
 * Shared quantity surface for Simple and Custom setup.
 *
 * The component keeps the choice in one readable sequence: number of pieces,
 * then size (for round pizzas), then the resulting dough mass. Pizza diameter
 * and crust edge drive the suggested mass; bakers can explicitly switch to a
 * custom mass without losing the calculated value or the total dough preview.
 */
export default function PrototypeQuantityPicker({
  bakeType,
  units = 'metric',
  roundPizza = false,
  locale = 'en',
  count,
  itemWeight,
  diameter = 30,
  diameterBounds = { min: 22, max: 35 },
  crust = 'classic',
  weightIsManual = false,
  calculatedWeight,
  weightBounds = DEFAULT_WEIGHT_BOUNDS,
  countBounds = {},
  itemLabel,
  calculateWeight,
  onCountChange,
  onItemWeightChange,
  onDiameterChange,
  onCrustChange,
  onWeightModeChange,
  onUseCalculatedWeight,
  onContinue,
  continueLabel,
  limitNote,
  onLimitMore,
  limitMoreLabel,
}: PrototypeQuantityPickerProps) {
  const fr = locale === 'fr';
  const grams = (g: number) => displayWeight(g, units);
  const shownWeight = (g: number) => units === 'imperial' ? gToOz(g) : g;
  const storedWeight = (w: number) => units === 'imperial' ? ozToG(w) : w;
  const weightUnit = units === 'imperial' ? 'oz' : 'g';
  const [manualEditing, setManualEditing] = useState(false);
  const countMin = countBounds.min ?? 1;
  const countMax = countBounds.max ?? 24;
  const countStep = countBounds.step ?? 1;
  const piece = itemLabel ?? (bakeType === 'bread'
    ? (fr ? 'pain' : 'loaf')
    : (fr ? 'pizza' : 'pizza'));
  const pieces = count === 1 ? piece : (bakeType === 'bread'
    ? (fr ? 'pains' : 'loaves')
    : (fr ? 'pizzas' : 'pizzas'));
  const hasCalculatedWeight = roundPizza && calculatedWeight !== undefined;
  const matchesCalculated = hasCalculatedWeight && Math.round(itemWeight) === Math.round(calculatedWeight!);
  const usesManualWeight = manualEditing || weightIsManual || (hasCalculatedWeight && !matchesCalculated);

  function setDiameter(next: number) {
    const value = Math.max(diameterBounds.min, Math.min(diameterBounds.max, Math.round(next)));
    setManualEditing(false);
    onDiameterChange?.(value);
    if (roundPizza && calculateWeight) onItemWeightChange(calculateWeight(value, crust));
  }

  function setCrust(next: QuantityCrust) {
    setManualEditing(false);
    onCrustChange?.(next);
    if (roundPizza && calculateWeight) onItemWeightChange(calculateWeight(diameter, next));
    onWeightModeChange?.(false);
  }

  const cardStyle: CSSProperties = {
    background: 'var(--warm)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '14px',
    marginTop: '14px',
  };
  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '16px',
    fontWeight: 650,
    color: 'var(--char)',
    fontFamily: 'var(--font-ui)',
    marginBottom: '6px',
  };
  const inputStyle: CSSProperties = {
    width: '100%',
    minHeight: '46px',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: '9px',
    background: 'var(--paper)',
    color: 'var(--char)',
    fontFamily: 'var(--font-ui)',
    fontSize: '16px',
  };

  return (
    <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--char)' }}>
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="quantity-count" style={labelStyle}>
          {bakeType === 'bread' ? (fr ? 'Nombre de pains' : 'Number of loaves') : (fr ? 'Nombre de pizzas' : 'Number of pizzas')}
        </label>
        <DraftNumberInput
          id="quantity-count"
          type="number"
          inputMode="numeric"
          min={countMin}
          max={countMax}
          step={countStep}
          value={count}
          onCommit={value => onCountChange(clamp(value, countMin, countMax, countStep))}
          style={{ ...inputStyle, fontSize: '24px', fontWeight: 700 }}
        />
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--smoke)' }}>
          {count} {pieces}
        </p>
      </div>

      {roundPizza ? (
        <section style={cardStyle} aria-labelledby="quantity-each-pizza">
          <h2 id="quantity-each-pizza" style={{ fontSize: '18px', margin: '0 0 14px', fontWeight: 700 }}>
            {fr ? 'Chaque pizza' : 'Each pizza'}
          </h2>

          <label htmlFor="quantity-diameter" style={labelStyle}>
            {fr ? 'Diamètre' : 'Pizza diameter'} <span style={{ fontWeight: 400, color: 'var(--smoke)' }}>({units === 'imperial' ? 'in' : 'cm'})</span>
          </label>
          <DraftNumberInput
            id="quantity-diameter"
            type="number"
            inputMode="decimal"
            min={units === 'imperial' ? Math.round(diameterBounds.min / 2.54 * 10) / 10 : diameterBounds.min}
            max={units === 'imperial' ? Math.round(diameterBounds.max / 2.54 * 10) / 10 : diameterBounds.max}
            step={units === 'imperial' ? 0.1 : 1}
            value={units === 'imperial' ? Math.round(diameter / 2.54 * 10) / 10 : diameter}
            onCommit={value => setDiameter(value * (units === 'imperial' ? 2.54 : 1))}
            style={{ ...inputStyle, maxWidth: '140px' }}
          />

          <fieldset style={{ border: 0, padding: 0, margin: '16px 0 8px' }}>
            <legend style={labelStyle}>{fr ? 'Bord de la pizza' : 'Crust edge'}</legend>
            <p style={{ margin: '-2px 0 8px', fontSize: '14px', color: 'var(--smoke)' }}>
              {fr ? 'L’épaisseur de la bordure.' : 'The outer rim of the pizza.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {CRUSTS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={crust === option.id && !usesManualWeight}
                  onClick={() => setCrust(option.id)}
                  style={{
                    minHeight: '44px', padding: '8px 4px', borderRadius: '9px',
                    border: crust === option.id && !usesManualWeight ? '2px solid var(--terra)' : '1px solid var(--border)',
                    background: crust === option.id && !usesManualWeight ? 'var(--paper)' : 'transparent',
                    color: 'var(--char)', fontFamily: 'var(--font-ui)', fontSize: '14px',
                    fontWeight: crust === option.id && !usesManualWeight ? 650 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {fr ? option.fr : option.en}
                </button>
              ))}
            </div>
          </fieldset>

          <p style={{ margin: '12px 0', fontSize: '14px', color: 'var(--smoke)', lineHeight: 1.5 }}>
            {fr
              ? 'Le diamètre et la bordure déterminent ensemble le poids conseillé.'
              : 'Diameter and edge set the dough weight together.'}
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <strong style={{ display: 'block', fontSize: '24px', lineHeight: 1.1 }}>{grams(itemWeight)}</strong>
            <span style={{ display: 'block', marginTop: '4px', fontSize: '14px', color: 'var(--smoke)' }}>
              {fr ? `de pâte par pizza · ${usesManualWeight ? 'personnalisé' : 'calculé'}` : `dough per pizza · ${usesManualWeight ? 'custom' : 'calculated'}`}
            </span>
          </div>

          {usesManualWeight ? (
            <div style={{ marginTop: '14px' }}>
              <label htmlFor="quantity-custom-weight" style={labelStyle}>
                {fr ? 'Votre poids de pâte' : 'Your dough weight'} ({weightUnit})
              </label>
              <DraftNumberInput
                id="quantity-custom-weight"
                type="number"
                min={shownWeight(weightBounds.min)}
                max={shownWeight(weightBounds.max)}
                step={units === 'imperial' ? 0.1 : weightBounds.step}
                value={shownWeight(itemWeight)}
                onCommit={value => onItemWeightChange(clamp(storedWeight(value), weightBounds.min, weightBounds.max, weightBounds.step))}
                style={inputStyle}
              />
              <p style={{ margin: '6px 0', fontSize: '14px', color: 'var(--smoke)' }}>
                {fr ? 'Le diamètre reste inchangé.' : 'The diameter stays fixed.'}
              </p>
              <button type="button" onClick={() => { setManualEditing(false); onUseCalculatedWeight?.(); }} style={{ minHeight: '44px', padding: '8px 0', border: 0, background: 'transparent', color: 'var(--terra)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                {fr ? 'Utiliser le poids calculé' : 'Use calculated weight'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setManualEditing(true); onWeightModeChange?.(true); }} style={{ minHeight: '44px', marginTop: '10px', padding: '8px 0', border: 0, background: 'transparent', color: 'var(--terra)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
              {fr ? 'Définir le poids moi-même' : 'Set weight myself'}
            </button>
          )}
        </section>
      ) : (
        <section style={cardStyle} aria-labelledby="quantity-each-item">
          <h2 id="quantity-each-item" style={{ fontSize: '18px', margin: '0 0 12px', fontWeight: 700 }}>
            {fr ? `Chaque ${piece}` : `Each ${piece}`}
          </h2>
          <label htmlFor="quantity-item-weight" style={labelStyle}>
            {bakeType === 'bread' ? (fr ? 'Poids de pâte par pain' : 'Dough per loaf') : (fr ? 'Poids par pizza en plaque' : 'Dough per tray pizza')} ({weightUnit})
          </label>
          <DraftNumberInput
            id="quantity-item-weight"
            type="number"
            min={shownWeight(weightBounds.min)}
            max={shownWeight(weightBounds.max)}
            step={units === 'imperial' ? 0.1 : weightBounds.step}
            value={shownWeight(itemWeight)}
            onCommit={value => onItemWeightChange(clamp(storedWeight(value), weightBounds.min, weightBounds.max, weightBounds.step))}
            style={inputStyle}
          />
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--smoke)' }}>
            {bakeType === 'bread' ? (fr ? 'Définissez la taille de chaque pain.' : 'Set the size of each loaf.') : (fr ? 'Définissez la quantité de pâte par plaque.' : 'Set the dough weight for each tray.')}
          </p>
        </section>
      )}

      <div aria-live="polite" style={{ marginTop: '14px', padding: '12px 14px', background: 'var(--cream)', borderRadius: '9px', fontSize: '14px', lineHeight: 1.5 }}>
        <strong>{count} × {grams(itemWeight)} = {grams(count * itemWeight)}</strong>
        <br />
        <span style={{ color: 'var(--smoke)' }}>{fr ? 'Pâte totale avant la marge éventuelle' : 'Total dough before any waste allowance'}</span>
      </div>

      {limitNote && (
        <div style={{ marginTop: '12px', padding: '10px 12px', background: '#FEF9F0', borderRadius: '9px', border: '1px solid #F0D9A0', display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', lineHeight: 1.45 }}>
          <span style={{ flex: 1 }}>{limitNote}</span>
          {onLimitMore && <button type="button" onClick={onLimitMore} style={{ minHeight: '44px', padding: '6px 10px', borderRadius: '18px', border: '1px solid var(--border)', background: 'var(--paper)', color: 'var(--smoke)', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{limitMoreLabel ?? (fr ? 'En savoir plus' : 'Learn more')}</button>}
        </div>
      )}

      {onContinue && (
        <button type="button" onClick={onContinue} style={{ width: '100%', minHeight: '48px', marginTop: '18px', border: 0, borderRadius: '10px', background: 'var(--terra)', color: '#fff', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 650, cursor: 'pointer' }}>
          {continueLabel ?? (fr ? 'Continuer' : 'Continue')}
        </button>
      )}
    </div>
  );
}
