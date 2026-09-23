'use client';

import { type UnitSystem, cToDisplay, inputTempToC, tempC, tempUnit } from '../utils/units';
import { useState, type InputHTMLAttributes } from 'react';
import { useLocale } from 'next-intl';

function TemperatureInput({ value, onCommit, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value'|'onChange'|'onBlur'|'onKeyDown'> & { value:number; onCommit:(value:number)=>void }) {
  const [draft,setDraft]=useState<string|null>(null);
  return <input {...props} value={draft ?? String(value)} onChange={e=>setDraft(e.target.value)} onBlur={()=>{
    if(draft!==null&&draft.trim()!==''&&Number.isFinite(Number(draft)))onCommit(Number(draft));
    setDraft(null);
  }} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}else if(e.key==='Escape'){e.preventDefault();setDraft(null);}}}/>;
}

interface ClimatePickerProps {
  kitchenTemp: number;
  humidity: string;
  fridgeTemp: number;
  mode: 'simple' | 'custom';
  units?: UnitSystem;
  /** Optional because the parent owns this planning choice. */
  flourInFridge?: boolean;
  onFlourInFridgeChange?: (value: boolean) => void;
  onChange: (kitchenTemp: number, humidity: string, fridgeTemp: number) => void;
}

const HUMIDITY_OPTIONS = [
  { value: 'dry', en: 'Dry', fr: 'Sec', range: '< 40%' },
  { value: 'normal', en: 'Normal / unknown', fr: 'Normale / inconnue', range: '40–65%' },
  { value: 'humid', en: 'Humid', fr: 'Humide', range: '65–80%' },
  { value: 'very-humid', en: 'Very humid', fr: 'Très humide', range: '> 80%' },
] as const;

function controlStyle(): React.CSSProperties {
  return {
    width: '100%', minHeight: 44, padding: '9px 10px', border: '1px solid var(--border)',
    borderRadius: 9, background: 'var(--paper)', color: 'var(--char)',
    fontFamily: 'var(--font-ui)', fontSize: 16,
  };
}

/**
 * The climate step deliberately stays small: two measured temperatures, and
 * humidity only in Custom mode. The latest prototype treats outdoor weather
 * lookup as an optional idea, not a setup dependency, so it does not compete
 * with the values that actually drive the schedule.
 */
export default function ClimatePicker({
  kitchenTemp, humidity, fridgeTemp, mode, units = 'metric',
  flourInFridge = false, onFlourInFridgeChange, onChange,
}: ClimatePickerProps) {
  const fr = useLocale() === 'fr';
  const kitchenMax = 38;
  const Advanced = mode === 'simple' ? 'details' : 'div';

  function temperatureField(kind: 'kitchen' | 'fridge') {
    const value = kind === 'kitchen' ? kitchenTemp : fridgeTemp;
    const min = kind === 'kitchen' ? 15 : 1;
    const max = kind === 'kitchen' ? kitchenMax : 15;
    const label = kind === 'kitchen'
      ? (fr ? 'Température de la cuisine' : 'Kitchen temperature')
      : (fr ? 'Température du frigo' : 'Fridge temperature');
    const update = (next: number) => onChange(kind === 'kitchen' ? next : kitchenTemp, humidity, kind === 'fridge' ? next : fridgeTemp);
    return (
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
          <label htmlFor={`climate-${kind}`} style={{ fontSize: 16, fontWeight: 650, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
            {label}
          </label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--char)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
            <TemperatureInput
              id={`climate-${kind}`}
              type="number"
              min={cToDisplay(min, units)} max={cToDisplay(max, units)} step={1}
              value={cToDisplay(value, units)}
              aria-label={label}
              onCommit={value => {
                const next = inputTempToC(value, units);
                update(Math.min(max, Math.max(min, next)));
              }}
              style={{ ...controlStyle(), width: 88, minHeight: 44, padding: '6px 8px', textAlign: 'right' }}
            />
            {tempUnit(units)}
          </span>
        </div>
        <input
          type="range"
          min={cToDisplay(min, units)} max={cToDisplay(max, units)} step={1}
          value={cToDisplay(value, units)}
          aria-label={label}
          onChange={event => update(inputTempToC(Number(event.target.value), units))}
          style={{ width: '100%', accentColor: kind === 'fridge' ? '#6A7FA8' : 'var(--terra)', cursor: 'pointer', height: 44, margin: 0 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 5, fontSize: 13, color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
          <span>{tempC(min, units)}</span><span>{tempC(max, units)}</span>
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--smoke)', lineHeight: 1.45 }}>
          {kind === 'kitchen'
            ? (fr ? 'Mesurez près de l’endroit où la pâte reposera.' : 'Measure near where the dough will rest.')
            : (fr ? 'Mesurez dans le réfrigérateur, près de la pâte.' : 'Measure inside the fridge, near the dough.')}
        </p>
        {kind === 'fridge' && fridgeTemp > 8 && (
          <p style={{ margin: '8px 0 0', padding: '8px 10px', background: '#EEF2FA', border: '1px solid #C4CDE0', borderRadius: 9, fontSize: 14, color: '#5A7090', lineHeight: 1.45 }}>
            {fr ? <>Frigo à {Math.round(fridgeTemp)} °C : la fermentation restera plus active qu’à 6 °C.</> : <>At {Math.round(fridgeTemp)} °C, fermentation stays more active than at 6 °C.</>}
          </p>
        )}
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 16, lineHeight: 1.5, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
      {mode === 'simple' && <p style={{margin:0,fontSize:16}}>{fr?'Vérifiez cette température là où la pâte reposera, dans une pièce climatisée ou chaude. La valeur affichée est à confirmer avec votre cuisine.':'Check this temperature where the dough will rest, whether the room is air-conditioned or warm. Confirm that the displayed value matches your kitchen.'}</p>}
      {temperatureField('kitchen')}
      {mode === 'simple' && <details><summary style={{minHeight:44,cursor:'pointer',fontSize:16}}>{fr?'Pourquoi cette température ?':'Why this temperature?'}</summary><p>{fr?'La pâte lève plus vite au chaud. Le planning utilise cette valeur : corrigez-la si la pièce change.':'Dough rises faster in warmth. The schedule uses this value: correct it if the room changes.'}</p></details>}
      <Advanced style={mode === 'custom' ? {display:'flex',flexDirection:'column',gap:24} : undefined}>
      {mode === 'simple' && <summary style={{minHeight:44,cursor:'pointer',fontSize:16}}>{fr?'Réglages avancés · frigo et farine':'Advanced settings · fridge and flour'}</summary>}
      {temperatureField('fridge')}

      {(
        <details className="bh-disclosure">
          <summary style={{ cursor: 'pointer', fontWeight: 650, minHeight: 44, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px' }}>
            {fr ? 'Humidité habituelle du stockage' : 'Usual flour-storage humidity'}
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 14, color: 'var(--smoke)' }}>
              {HUMIDITY_OPTIONS.find(option => option.value === humidity)?.[fr ? 'fr' : 'en'] ?? (fr ? 'Normale / inconnue' : 'Normal / unknown')}
            </span>
          </summary>
          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
            {HUMIDITY_OPTIONS.map(option => {
              const active = humidity === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(kitchenTemp, option.value, fridgeTemp)}
                  style={{ ...controlStyle(), minHeight: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`, background: active ? '#FEF4EF' : 'var(--paper)', fontSize: 16, textAlign: 'left' }}
                >
                  <span>{fr ? option.fr : option.en}</span><span style={{ color: 'var(--smoke)' }}>{option.range}</span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--smoke)', lineHeight: 1.45 }}>
            {fr ? 'Farine conservée hermétiquement : gardez « Normale ». Très humide : réduction estimée de l’hydratation jusqu’à 2 points, ajustable ensuite.' : 'Airtight flour storage: keep “Normal / unknown”. Very humid: an estimated hydration reduction of up to 2 percentage points, adjustable later.'}
          </p>
        </details>
      )}

      {onFlourInFridgeChange && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: 16, lineHeight: 1.4 }}>
          <input type="checkbox" checked={flourInFridge} onChange={event => onFlourInFridgeChange(event.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--terra)' }} />
          <span><strong>{fr ? 'Farine conservée au réfrigérateur' : 'Flour kept in the fridge'}</strong><br /><span style={{ fontSize: 14, color: 'var(--smoke)' }}>{fr ? 'Cochez si la farine sera réellement froide au mélange.' : 'Check this only if the flour will be cold when you mix.'}</span></span>
        </label>
      )}
      </Advanced>
    </div>
  );
}
