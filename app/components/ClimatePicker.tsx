'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { type UnitSystem, cToDisplay, inputTempToC, tempUnit, tempC, displayTemp } from '../utils/units';
import DecisionList from './DecisionList';
import DecisionSummary from './DecisionSummary';

interface ClimatePickerProps {
  kitchenTemp: number;
  humidity: string;
  fridgeTemp: number;
  mode: 'simple' | 'custom';
  units?: UnitSystem;
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

const WMO_FR: Record<number, string> = {
   0: 'Ciel dégagé',      1: 'Plutôt dégagé',    2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard',       48: 'Brouillard givrant',
  51: 'Bruine légère',    53: 'Bruine',          55: 'Forte bruine',
  61: 'Pluie légère',     63: 'Pluie',           65: 'Forte pluie',
  71: 'Neige légère',     73: 'Neige',           75: 'Forte neige',   77: 'Grésil',
  80: 'Averses',          81: 'Fortes averses',  82: 'Averses violentes',
  85: 'Averses de neige', 86: 'Fortes averses de neige',
  95: 'Orage',            96: 'Orage avec grêle', 99: 'Orage violent',
};

function getWMODescFr(code: number): string {
  if (WMO_FR[code]) return WMO_FR[code];
  const lower = Object.keys(WMO_FR).map(Number).filter(k => k <= code).pop();
  return lower !== undefined ? WMO_FR[lower] : 'Conditions inconnues';
}

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
// Outdoor → kitchen estimate. Simple, climate-agnostic heuristic (validated
// against: heated homes in cold climates sit ≈18-21°C regardless of outdoor;
// mild climates track outdoor; hot climates run ~2°C cooler indoors from
// shade/thermal mass — Singapore outdoor 31 → kitchen ≈29). Always a
// PREFILL: the baker can override below, and AC kitchens will.
function outdoorToKitchen(outdoorC: number): number {
  if (outdoorC < 18) return 18;
  if (outdoorC > 28) return Math.min(38, outdoorC - 2);
  return outdoorC;
}

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
  kitchenTemp, humidity, fridgeTemp, mode, units, onChange,
}: ClimatePickerProps) {
  const u = units ?? 'metric';
  const tc = useTranslations('climate');
  const isFr = useLocale() === 'fr';
  const [simpleExpanded, setSimpleExpanded] = useState(true);
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function fetchWeatherAt(latitude: number, longitude: number, name: string, country: string) {
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

    // Prefill the manual controls — kitchen ESTIMATED from outdoor (see
    // outdoorToKitchen), baker can always override below.
    onChange(outdoorToKitchen(temp), humidityCategory(humidityPct), fridgeTemp);
  }

  async function fetchClimate() {
    const q = city.trim();
    if (!q) return;
    setLoading(true);
    setFetchError(null);
    setWeather(null);

    try {
      // 1 — Geocoding
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${isFr ? 'fr' : 'en'}&format=json`
      );
      if (!geoRes.ok) throw new Error('Geocoding request failed');
      const geoData = await geoRes.json();

      if (!geoData.results?.length) {
        setFetchError(isFr ? `Ville « ${q} » introuvable. Essayez une autre orthographe ou une ville proche.` : `City "${q}" not found. Try a different spelling or nearby city.`);
        setLoading(false);
        return;
      }

      const { latitude, longitude, name, country } = geoData.results[0];
      await fetchWeatherAt(latitude, longitude, name, country);

    } catch (e) {
      setFetchError(isFr ? 'Impossible de récupérer la météo.' : (e instanceof Error ? e.message : 'Failed to fetch weather data.'));
    } finally {
      setLoading(false);
    }
  }

  function fetchByLocation() {
    if (!('geolocation' in navigator)) {
      setFetchError(isFr ? 'Localisation indisponible — entrez votre ville.' : 'Location unavailable — type your city instead.');
      return;
    }
    setLoading(true);
    setFetchError(null);
    setWeather(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetchWeatherAt(
            pos.coords.latitude, pos.coords.longitude,
            isFr ? 'Votre position' : 'Your location', '',
          );
        } catch {
          setFetchError(isFr ? 'Impossible de récupérer la météo.' : 'Failed to fetch weather data.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setFetchError(isFr ? 'Localisation refusée — entrez votre ville.' : 'Location declined — type your city instead.');
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') fetchClimate();
  }

  if (mode === 'simple') {
    const SIMPLE_OPTIONS = [
      { id: 'cool',     temp: 18, hum: 'normal', thumbnailBg: '#6A7FA8',     title: tc('cool.title'),     tagline: tc('cool.tagline'),     badge: tc('cool.badge') },
      { id: 'normal',   temp: 23, hum: 'normal', thumbnailBg: 'var(--sage)', title: tc('normal.title'),   tagline: tc('normal.tagline'),   badge: tc('normal.badge') },
      { id: 'warm',     temp: 28, hum: 'humid',  thumbnailBg: 'var(--gold)', title: tc('warm.title'),     tagline: tc('warm.tagline'),     badge: tc('warm.badge') },
      { id: 'tropical', temp: 32, hum: 'humid',  thumbnailBg: 'var(--terra)',title: tc('tropical.title'), tagline: tc('tropical.tagline'), badge: tc('tropical.badge') },
    ];

    const selectedId = kitchenTemp <= 20 ? 'cool' : kitchenTemp <= 26 ? 'normal' : kitchenTemp <= 30 ? 'warm' : 'tropical';
    const selectedOpt = SIMPLE_OPTIONS.find(o => o.id === selectedId)!;
    const listOptions = SIMPLE_OPTIONS.map(o => ({ ...o, image: '' }));

    if (!simpleExpanded) {
      return (
        <DecisionSummary
          thumbnailBg={selectedOpt.thumbnailBg}
          title={selectedOpt.title}
          tagline={selectedOpt.tagline}
          onExpand={() => setSimpleExpanded(true)}
        />
      );
    }

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: 22, fontWeight: 700, color: 'var(--char)', margin: 0 }}>
            {tc('heading')}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--smoke)', margin: '4px 0 0', fontFamily: 'DM Sans' }}>
            {tc('subtitle')}
          </p>
        </div>
        <DecisionList
          options={listOptions}
          selectedId={selectedId}
          onSelect={(id) => {
            const opt = SIMPLE_OPTIONS.find(o => o.id === id)!;
            onChange(opt.temp, opt.hum, fridgeTemp);
            setSimpleExpanded(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

      {/* ── City search ─────────────────────────── */}
      <div>
        <label style={SECTION_LABEL}>{isFr ? 'Conditions extérieures' : 'Get outdoor conditions'}</label>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <input
            type="text"
            placeholder={isFr ? 'Ville — ex. Naples, Tokyo, Paris' : 'City — e.g. Naples, Tokyo, Chicago'}
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
            {loading ? (isFr ? 'Recherche…' : 'Fetching…') : (isFr ? 'Météo' : 'Get Climate')}
          </button>
        </div>

        {/* Location chip — lives on its own line so it can never overflow the
            card, and says what it does instead of being a mystery pin */}
        <button
          onClick={fetchByLocation}
          disabled={loading}
          style={{
            marginTop: '.6rem',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '.45rem .8rem',
            border: '1.5px solid var(--border)',
            borderRadius: '20px',
            background: 'var(--cream)',
            color: 'var(--ash)',
            fontSize: '.8rem',
            fontFamily: 'var(--font-dm-sans)',
            cursor: loading ? 'default' : 'pointer',
            transition: 'all .15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--terra)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.5" fill="var(--terra)" stroke="none" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
          </svg>
          {loading
            ? (isFr ? 'Recherche…' : 'Locating…')
            : (isFr ? 'Utiliser ma position' : 'Use my location')}
        </button>

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
                  {weather.country ? `${weather.city}, ${weather.country}` : weather.city}
                </div>
                <div style={{
                  fontSize: '.75rem', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)', marginTop: '.1rem',
                }}>
                  {isFr ? getWMODescFr(weather.weatherCode) : wxDesc}
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
        {weather && !loading && (
          <div style={{
            marginTop: '.45rem',
            fontSize: '.72rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {isFr
              ? 'Cuisine estimée depuis l’extérieur — ajustez ci-dessous si besoin.'
              : 'Kitchen estimated from outdoor — adjust below if it feels off.'}
          </div>
        )}
      </div>

      {/* ── Kitchen temperature ──────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
          <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>{isFr ? 'Température de la cuisine' : 'Kitchen temperature'}</label>
          <span style={{
            fontFamily: 'var(--font-dm-mono)',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: tempColor(kitchenTemp),
          }}>
            {cToDisplay(kitchenTemp, u)}{tempUnit(u)}
          </span>
        </div>

        <input
          type="range"
          min={u === 'imperial' ? 59 : 15}
          max={u === 'imperial' ? 100 : 38}
          step={1}
          value={cToDisplay(kitchenTemp, u)}
          onChange={e => onChange(inputTempToC(Number(e.target.value), u), humidity, fridgeTemp)}
          style={{ width: '100%', accentColor: 'var(--terra)', cursor: 'pointer', height: '4px' }}
        />

        {/* Axis labels */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: '.65rem', color: 'var(--smoke)',
          fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem',
        }}>
          <span>{tempC(15, u)} {isFr ? 'froid' : 'cool'}</span>
          <span>{tempC(22, u)} {isFr ? 'idéal' : 'ideal'}</span>
          <span>{tempC(30, u)} {isFr ? 'chaud' : 'hot'}</span>
          <span>{tempC(38, u)}</span>
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
            🌡️ {isFr ? <>Sous un climat chaud, les après-midis peuvent dépasser {tempC(28, u)}. Si votre cuisine chauffe en journée, indiquez plutôt la température maximale attendue.</> : <>In a warm climate, afternoon temps can push above {tempC(28, u)}. If your kitchen heats up during the day, consider entering your expected peak temperature instead.</>}
          </div>
        )}
      </div>

      {/* ── Humidity ────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '.5rem', marginBottom: '.5rem' }}>
          <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>{isFr ? 'Humidité de la cuisine' : 'Kitchen humidity'}</label>
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
                {isFr ? ({ dry: 'Sec', normal: 'Normale', humid: 'Humide', 'very-humid': 'Très humide' } as Record<string, string>)[opt.value] : opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fridge temperature (advanced only) ────── */}
      {mode === 'custom' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '.5rem' }}>
            <label style={{ ...SECTION_LABEL, marginBottom: 0 }}>{isFr ? 'Température du frigo' : 'Fridge temperature'}</label>
            <span style={{
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#6A7FA8',
            }}>
              {cToDisplay(fridgeTemp, u)}{tempUnit(u)}
            </span>
          </div>

          <input
            type="range"
            min={u === 'imperial' ? 34 : 1}
            max={u === 'imperial' ? 59 : 15}
            step={1}
            value={cToDisplay(fridgeTemp, u)}
            onChange={e => onChange(kitchenTemp, humidity, inputTempToC(Number(e.target.value), u))}
            style={{ width: '100%', accentColor: '#6A7FA8', cursor: 'pointer', height: '4px' }}
          />

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '.65rem', color: 'var(--smoke)',
            fontFamily: 'var(--font-dm-mono)', marginTop: '.25rem',
          }}>
            <span>{tempC(1, u)}</span>
            <span>{tempC(6, u)} standard</span>
            <span>{tempC(8, u)} {isFr ? 'chaud' : 'warm'}</span>
            <span>{tempC(15, u)}</span>
          </div>

          {fridgeTemp > 8 && (
            <div style={{
              marginTop: '.6rem',
              fontSize: '.76rem', color: '#5A7090',
              background: '#EEF2FA', border: '1px solid #C4CDE0',
              borderRadius: '8px', padding: '.45rem .8rem',
            }}>
              {isFr ? <>Un frigo à <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>{displayTemp(fridgeTemp, u)}</span> est plus chaud que le standard {tempC(6, u)} — la levure restera plus active pendant le froid.</> : <>Fridge at <span style={{ fontFamily: 'var(--font-dm-mono)', fontWeight: 600 }}>{displayTemp(fridgeTemp, u)}</span> is warmer than the standard {tempC(6, u)} — yeast will be more active during cold retard.</>}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
