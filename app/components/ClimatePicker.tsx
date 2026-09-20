'use client';

import { type UnitSystem, cToDisplay, inputTempToC, tempC, tempUnit } from '../utils/units';
import { useLocale } from 'next-intl';

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
  const kitchenMax = mode === 'simple' ? 35 : 38;

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
          <label htmlFor={`climate-${kind}`} style={{ fontSize: 14, fontWeight: 650, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
            {label}
          </label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--char)', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>
            <input
              id={`climate-${kind}`}
              type="number"
              min={cToDisplay(min, units)} max={cToDisplay(max, units)} step={1}
              value={cToDisplay(value, units)}
              aria-label={label}
              onChange={event => {
                if (event.target.value === '') return;
                const next = inputTempToC(Number(event.target.value), units);
                if (Number.isFinite(next) && next >= min && next <= max) update(next);
              }}
              style={{ ...controlStyle(), width: 76, minHeight: 40, padding: '6px 8px', textAlign: 'right' }}
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
          style={{ width: '100%', accentColor: kind === 'fridge' ? '#6A7FA8' : 'var(--terra)', cursor: 'pointer', height: 4 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 5, fontSize: 11, color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
          {kind === 'kitchen' ? (
            <><span>{tempC(min, units)} {fr ? 'frais' : 'cool'}</span><span>{tempC(22, units)} {fr ? 'idéal' : 'ideal'}</span><span>{tempC(30, units)} {fr ? 'chaud' : 'hot'}</span><span>{tempC(max, units)}</span></>
          ) : (
            <><span>{tempC(min, units)}</span><span>{tempC(6, units)} {fr ? 'standard' : 'standard'}</span><span>{tempC(8, units)} {fr ? 'chaud' : 'warm'}</span><span>{tempC(max, units)}</span></>
          )}
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 12, color: 'var(--smoke)', lineHeight: 1.45 }}>
          {kind === 'kitchen'
            ? (fr ? 'Pendant la fermentation à température ambiante. Utilisez un thermomètre si possible.' : 'During room-temperature fermentation. Use a thermometer if available.')
            : (fr ? 'Pendant la fermentation au froid.' : 'During cold fermentation.')}
        </p>
        {kind === 'fridge' && fridgeTemp > 8 && (
          <p style={{ margin: '8px 0 0', padding: '8px 10px', background: '#EEF2FA', border: '1px solid #C4CDE0', borderRadius: 9, fontSize: 12, color: '#5A7090', lineHeight: 1.45 }}>
            {fr ? <>Frigo à {Math.round(fridgeTemp)} °C : la fermentation restera plus active qu’à 6 °C.</> : <>At {Math.round(fridgeTemp)} °C, fermentation stays more active than at the 6 °C standard.</>}
          </p>
        )}
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, color: 'var(--char)', fontFamily: 'var(--font-ui)' }}>
      {temperatureField('kitchen')}
      {temperatureField('fridge')}

      {mode === 'custom' && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 650, minHeight: 44, display: 'flex', alignItems: 'center' }}>
            {fr ? 'Humidité habituelle du stockage' : 'Usual flour-storage humidity'}
            <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: 'var(--smoke)' }}>
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
                  style={{ ...controlStyle(), minHeight: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`, background: active ? '#FEF4EF' : 'var(--paper)', fontSize: 13, textAlign: 'left' }}
                >
                  <span>{fr ? option.fr : option.en}</span><span style={{ color: 'var(--smoke)' }}>{option.range}</span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--smoke)', lineHeight: 1.45 }}>
            {fr ? 'Farine conservée hermétiquement : gardez « Normale ». Très humide : jusqu’à −2 points estimés, ajustables ensuite.' : 'Airtight flour storage: keep “Normal / unknown”. Very humid: an estimated reduction of up to 2 points, adjustable later.'}
          </p>
        </details>
      )}

      {onFlourInFridgeChange && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: 14, lineHeight: 1.4 }}>
          <input type="checkbox" checked={flourInFridge} onChange={event => onFlourInFridgeChange(event.target.checked)} style={{ width: 20, height: 20, marginTop: 1, accentColor: 'var(--terra)' }} />
          <span><strong>{fr ? 'Farine conservée au réfrigérateur' : 'Flour kept in the fridge'}</strong><br /><span style={{ fontSize: 12, color: 'var(--smoke)' }}>{fr ? 'Cochez si la farine sera réellement froide au mélange.' : 'Check this only if the flour will be cold when you mix.'}</span></span>
        </label>
      )}
    </div>
  );
}
