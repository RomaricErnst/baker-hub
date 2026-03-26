'use client';
import { useState } from 'react';

interface ClimatePickerProps {
  kitchenTemp: number;
  humidity: string;
  fridgeTemp: number;
  mode: 'simple' | 'custom';
  onChange: (kitchenTemp: number, humidity: string, fridgeTemp: number) => void;
}

// ── WMO weather codes ────────────────────────
const WMO: Record<number, [emoji: string, desc: string]> = {
   0: ['☀️',  'Clear sky'],
   1: ['🌤️', 'Mainly clear'],
   2: ['⛅',  'Partly cloudy'],
   3: ['☁️',  'Overcast'],
  45: ['🌫️', 'Fog'],
  48: ['🌫️', 'Icy fog'],
  51: ['🌦️', 'Light drizzle'],
  53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'],
  61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'],
  73: ['❄️',  'Snow'],
  75: ['❄️',  'Heavy snow'],
  77: ['❄️',  'Snow grains'],
  80: ['🌦️', 'Showers'],
  81: ['🌧️', 'Heavy showers'],
  82: ['⛈️', 'Violent showers'],
  85: ['🌨️', 'Snow showers'],
  86: ['❄️',  'Heavy snow showers'],
  95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Thunderstorm + hail'],
  99: ['⛈️', 'Severe thunderstorm'],
};

function getWMO(code: number): [string, string] {
  // Try exact match, then nearest lower code
  if (WMO[code]) return WMO[code];
  const lower = Object.keys(WMO).map(Number).filter(k => k <= code).pop();
  return lower !== undefined ? WMO[lower] : ['🌡️', 'Unknown conditions'];
}

// ── Humidity ─────────────────────────────────
const HUMIDITY_OPTIONS = [
  { value: 'dry',        label: 'Dry',        desc: '< 40%'  },
  { value: 'normal',     label: 'Normal',      desc: '40–65%' },
  { value: 'humid',      label: 'Humid',       desc: '65–80%' },
  { value: 'very-humid', label: 'Very Humid',  desc: '> 80%'  },
] as const;

function humidityCategory(pct: number): string {
  if (pct < 40) return 'dry';
  if (pct < 65) return 'normal';
  if (pct < 80) return 'humid';
  return 'very-humid';
}

// ── Temp badge colour ────────────────────────
function tempColor(t: number): string {
  if (t >= 30) return 'var(--terra)';
  if (t >= 25) return 'var(--gold)';
  if (t <= 18) return '#6A7FA8';
  return 'var(--sage)';
}

// ── Shared sub-styles ────────────────────────
const SECTION_LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '.72rem',
  color: 'var(--smoke)',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: '.5rem',
  fontFamily: 'var(--font-dm-mono)',
};

interface WeatherData {
  city: string;
  country: string;
  temp: number;
  humidityPct: number;
  weatherCode: number;
}

// ── Component ────────────────────────────────
export default function ClimatePicker({
  kitchenTemp, humidity, fridgeTemp, mode, onChange,
}: ClimatePickerProps) {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function fetchClimate() {
    const q = city.trim();
    if (!q) return;
    setLoading(true);
    setFetchError(null);
    setWeather(null);

    try {
      // 1 — Geocoding
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`
      );
      if (!geoRes.ok) throw new Error('Geocoding request failed');
      const geoData = await geoRes.json();

      if (!geoData.results?.length) {
        setFetchError(`City "${q}" not found. Try a different spelling or nearby city.`);
        setLoading(false);
        return;
      }

      const { latitude, longitude, name, country } = geoData.results[0];

      // 2 — Current weather
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`
      );
      if (!wxRes.ok) throw new Error('Weather request failed');
      const wxData = await wxRes.json();

      const temp        = Math.round(wxData.current.temperature_2m);
      const humidityPct = Math.round(wxData.current.relative_humidity_2m);
      const weatherCode = wxData.current.weather_code;

      setWeather({ city: name, country, temp, humidityPct, weatherCode });

      // Auto-populate the manual controls
      const clampedTemp = Math.max(15, Math.min(38, temp));
      onChange(clampedTemp, humidityCategory(humidityPct), fridgeTemp);

    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to fetch weather data.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') fetchClimate();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

      {/* ── City search ─────────────────────────── */}
      <div>
        <label style={SECTION_LABEL}>Get outdoor conditions</label>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            type="text"
            placeholder="City — e.g. Naples, Tokyo, Chicago"
            value={city}
            onChange={e => setCity(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: '.65rem .9rem',
              border: '2px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--warm)',
              color: 'var(--char)',
              fontSize: '.88rem',
              fontFamily: 'var(--font-dm-sans)',
              outline: 'none',
            }}
          />
          <button
            onClick={fetchClimate}
            disabled={loading || !city.trim()}
            style={{
              padding: '.65rem 1.15rem',
              border: 'none',
              borderRadius: '12px',
              background: loading || !city.trim() ? 'var(--border)' : 'var(--terra)',
              color: loading || !city.trim() ? 'var(--smoke)' : '#fff',
              fontSize: '.85rem',
              fontWeight: 500,
              cursor: loading || !city.trim() ? 'default' : 'pointer',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Fetching…' : 'Get Climate'}
          </button>
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{
            marginTop: '.6rem',
            fontSize: '.78rem', color: 'var(--terra)',
            background: '#FEF4EF', border: '1px solid #F5C4B0',
            borderRadius: '8px', padding: '.5rem .85rem',
          }}>
            {fetchError}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{
            marginTop: '.75rem',
            border: '1.5px solid var(--border)',
            borderRadius: '13px',
            padding: '1.1rem 1.3rem',
            background: 'var(--warm)',
            display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ fontSize: '2rem', opacity: .3 }}>🌡️</div>
            <div style={{ flex: 1 }}>
              <div style={{ height: '12px', background: 'var(--border)', borderRadius: '6px', width: '55%', marginBottom: '.5rem' }} />
              <div style={{ height: '10px', background: 'var(--border)', borderRadius: '6px', width: '35%' }} />
            </div>
          </div>
        )}

        {/* Weather card */}
        {weather && !loading && (() => {
          const [wxEmoji, wxDesc] = getWMO(weather.weatherCode);
          return (
            <div style={{
              marginTop: '.75rem',
              border: '1.5px solid var(--border)',
              borderRadius: '13px',
              padding: '1rem 1.3rem',
              background: 'var(--warm)',
              display: 'flex', alignItems: 'center', gap: '1rem',
            }}>
              <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{wxEmoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--char)' }}>
                  {weather.city}, {weather.country}
                </div>
                <div style={{
                  fontSize: '.75rem', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)', marginTop: '.1rem',
                }}>
                  {wxDesc}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 700,
                  color: tempColor(weather.temp),
                  fontFamily: 'var(--font-dm-mono)',
                  lineHeight: 1,
                }}>
                  {weather.temp}°C
                </div>
                <div style={{
                  fontSize: '.72rem', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)', marginTop: '.15rem',
                }}>
                  {weather.humidityPct}% RH
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Kitchen temperature ──────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
          <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>Kitchen temperature</label>
          <span style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: tempColor(kitchenTemp),
          }}>
            {kitchenTemp}°C
          </span>
        </div>

        <input
          type="range"
          min={15} max={38} step={1}
          value={kitchenTemp}
          onChange={e => onChange(Number(e.target.value), humidity, fridgeTemp)}
          style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer', height: '4px' }}
        />

        {/* Axis labels */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '.65rem', color: 'var(--smoke)',
          fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem',
        }}>
          <span>15°C cool</span>
          <span>22°C ideal</span>
          <span>30°C hot</span>
          <span>38°C</span>
        </div>

        {/* Warm climate nudge */}
        {kitchenTemp >= 25 && kitchenTemp <= 27 && (
          <div style={{
            background: '#FFF8E8',
            border: '1.5px solid #E8D080',
            borderRadius: '10px',
            padding: '.6rem .9rem',
            fontSize: '.76rem',
            color: '#7A5A10',
            marginTop: '.75rem',
            lineHeight: 1.5,
          }}>
            🌡️ In a warm climate, afternoon temps can push above 28°C. If your kitchen heats up during the day, consider entering your expected peak temperature instead.
          </div>
        )}
      </div>

      {/* ── Humidity ────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.5rem' }}>
          <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>Kitchen humidity</label>
          {(() => {
            const active = HUMIDITY_OPTIONS.find(o => o.value === humidity);
            return active ? (
              <span style={{ fontSize: '.72rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
                {active.desc}
              </span>
            ) : null;
          })()}
        </div>
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'nowrap' }}>
          {HUMIDITY_OPTIONS.map(opt => {
            const active = humidity === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange(kitchenTemp, opt.value, fridgeTemp)}
                style={{
                  padding: '.35rem .65rem',
                  borderRadius: '20px',
                  border: `1.5px solid ${active ? 'var(--terra)' : 'var(--border)'}`,
                  background: active ? '#FEF4EF' : 'var(--warm)',
                  color: active ? 'var(--terra)' : 'var(--smoke)',
                  fontSize: '.8rem',
                  fontWeight: active ? 500 : 400,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fridge temperature (advanced only) ────── */}
      {mode === 'custom' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
            <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>Fridge temperature</label>
            <span style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#6A7FA8',
            }}>
              {fridgeTemp}°C
            </span>
          </div>

          <input
            type="range"
            min={1} max={15} step={1}
            value={fridgeTemp}
            onChange={e => onChange(kitchenTemp, humidity, Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6A7FA8', cursor: 'pointer', height: '4px' }}
          />

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '.65rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem',
          }}>
            <span>1°C</span>
            <span>4°C standard</span>
            <span>8°C warm</span>
            <span>15°C</span>
          </div>

          {fridgeTemp > 8 && (
            <div style={{
              marginTop: '.6rem',
              fontSize: '.76rem', color: '#5A7090',
              background: '#EEF2FA', border: '1px solid #C4CDE0',
              borderRadius: '8px', padding: '.45rem .8rem',
            }}>
              Fridge at <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>{fridgeTemp}°C</span> is warmer than the standard 4°C — yeast will be more active during cold retard.
            </div>
          )}

        </div>
      )}

    </div>
  );
}
