'use client';
// Mon profil — baker preferences persisted locally (bh_profile_v1).
// Every change saves instantly; new sessions prefill from here.
import { useState, useRef } from 'react';
import { OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PIZZA_STYLES, BREAD_STYLES } from '../data';
import { loadProfile, updateProfile, deleteCustomPizza, DEFAULT_BLOCKERS, type BakerProfile } from '../lib/profile';
import { createClient } from '../lib/supabase/client';
import { useEffect } from 'react';
import type { StyleKey } from '../lib/toppingTypes';

const S = {
  label: {
    fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--terra)',
    textTransform: 'uppercase' as const, letterSpacing: '1.5px', fontWeight: 700,
    margin: '18px 16px 8px', display: 'block',
  },
  pill: (active: boolean) => ({
    border: active ? '1.5px solid var(--terra)' : '1px solid var(--border)',
    background: active ? 'rgba(107, 68, 35,0.07)' : 'var(--warm)',
    color: 'var(--char)', borderRadius: '20px', padding: '8px 12px',
    fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer',
    lineHeight: 1.2, minHeight: '44px',
  }),
};

export default function ProfileSheet({ locale, onClose }: { locale: string; onClose: () => void }) {
  const fr = locale === 'fr';
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary') ?? []).filter(x => x.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === sheetRef.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [onClose]);
  const [profile, setProfile] = useState<BakerProfile>(() => ({ version: 1, ...(loadProfile() ?? {}) }));
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    // getSession() reads local storage — instant and offline-safe, so the
    // « Synchronisé ✓ » line can't flicker absent on a slow network the way
    // the getUser() server round-trip sometimes did. The listener keeps it
    // honest if auth changes while the sheet is open.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  function patch(p: Partial<BakerProfile>) {
    setProfile(updateProfile(p));
  }

  const starter = profile.starter ?? { mature: true, hasRye: false, tang: 'balanced' as const };
  const blockers = profile.blockers ?? DEFAULT_BLOCKERS;
  const customs = (profile.customPizzas ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);

  const pillRow = (
    entries: Array<{ key: string; label: string }>,
    current: string | null | undefined,
    onPick: (key: string | null) => void,
  ) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px' }}>
      {entries.map(e => (
        <button key={e.key} aria-pressed={current === e.key} onClick={() => onPick(current === e.key ? null : e.key)} style={S.pill(current === e.key)}>
          {e.label}
        </button>
      ))}
    </div>
  );

  const timeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <input
      aria-label={label}
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px',
        fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--char)',
        background: 'var(--warm)', width: '110px', minHeight: '44px',
      }}
    />
  );

  const blockerRow = (key: 'sleep' | 'work', label: string) => {
    const b = blockers[key];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', flexWrap: 'wrap' }}>
        <button
          aria-pressed={b.enabled}
          onClick={() => patch({ blockers: { ...blockers, [key]: { ...b, enabled: !b.enabled } } })}
          style={{ ...S.pill(b.enabled), minWidth: '104px', textAlign: 'left' as const }}
        >
          {b.enabled ? '✓ ' : ''}{label}
        </button>
        {b.enabled && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {timeInput(b.from, v => patch({ blockers: { ...blockers, [key]: { ...b, from: v } } }), `${label} — ${fr ? 'début' : 'start'}`)}
            <span style={{ color: 'var(--smoke)', fontFamily: 'var(--font-ui)', fontSize: '11px' }}>→</span>
            {timeInput(b.to, v => patch({ blockers: { ...blockers, [key]: { ...b, to: v } } }), `${label} — ${fr ? 'fin' : 'end'}`)}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 290 }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={fr ? 'Mes préférences' : 'My preferences'} tabIndex={-1} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        width: 'min(640px, 100%)', margin: '0 auto', background: 'var(--cream)', borderRadius: '20px 20px 0 0',
        zIndex: 300, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 2, margin: '14px auto 10px' }} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 1, gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--char)' }}>
              {fr ? 'Mes préférences' : 'My preferences'}
            </span>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', marginTop: '2px' }}>
              {fr ? 'Enregistré automatiquement pour vos prochaines fournées.' : 'Saved automatically for your next bakes.'}
              {signedIn !== null && (
                <span style={{ display: 'block', marginTop: '2px', color: signedIn ? 'var(--sage, #6B7A5A)' : 'var(--smoke)' }}>
                  {signedIn
                    ? (fr ? 'Compte connecté · préférences enregistrées sur cet appareil' : 'Account connected · preferences saved on this device')
                    : (fr ? 'Enregistré sur cet appareil' : 'Saved on this device')}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'} style={{
            width: 44, height: 44, padding: 8, margin: -8, borderRadius: '50%',
            border: 'none', backgroundClip: 'content-box',
            background: 'var(--warm)', cursor: 'pointer', fontSize: 16, color: 'var(--smoke)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        <span style={S.label}>{fr ? 'Mode par défaut' : 'Default mode'}</span>
        <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
          {([['simple', 'Simple'], ['custom', fr ? 'Personnalisé' : 'Custom']] as const).map(([key, label]) => (
            <button key={key} onClick={() => patch({ preferredMode: profile.preferredMode === key ? null : key })} style={S.pill(profile.preferredMode === key)}>
              {label}
            </button>
          ))}
        </div>

        <span style={S.label}>{fr ? 'Mes pizzas' : 'My pizzas'}</span>
        {customs.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic', padding: '0 16px' }}>
            {fr ? 'Vos pizzas personnelles apparaîtront ici.' : 'Your custom pizzas will appear here.'}
          </div>
        ) : customs.map(cp => (
          <div key={cp.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 16px 6px', padding: '8px 12px',
            background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '16px',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--char)' }}>{cp.name}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)' }}>
                {cp.ingredients.length} {fr ? 'ingrédients' : 'ingredients'}
              </div>
            </div>
            <button
              onClick={() => { if (!window.confirm(fr ? `Supprimer ${cp.name} ?` : `Delete ${cp.name}?`)) return; deleteCustomPizza(cp.id); setProfile({ version: 1, ...(loadProfile() ?? {}) }); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)',
                textDecoration: 'underline', textUnderlineOffset: '2px', minHeight: '44px', padding: '8px',
              }}
            >
              {fr ? 'Supprimer' : 'Delete'}
            </button>
          </div>
        ))}
        <span style={S.label}>{fr ? 'Four — pizza' : 'Oven — pizza'}</span>
        {pillRow(
          Object.entries(OVEN_TYPES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.ovenTypePizza ?? profile.ovenType, key => patch({ ovenTypePizza: key }),
        )}
        <span style={S.label}>{fr ? 'Four — pain' : 'Oven — bread'}</span>
        {pillRow(
          Object.entries(BREAD_OVEN_TYPES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.ovenTypeBread ?? profile.ovenType, key => patch({ ovenTypeBread: key }),
        )}

        <span style={S.label}>{fr ? 'Pétrissage' : 'Mixing'}</span>
        {pillRow(
          Object.entries(MIXER_TYPES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.mixerType, key => patch({ mixerType: key }),
        )}

        <span style={S.label}>{fr ? 'Levure' : 'Yeast'}</span>
        {pillRow(
          Object.entries(YEAST_TYPES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.yeastType, key => patch({ yeastType: key }),
        )}

        <span style={S.label}>{fr ? 'Préferment — mode personnalisé' : 'Preferment — Custom mode'}</span>
        {pillRow(
          [
            { key: 'none', label: fr ? 'Sans préferment' : 'No preferment' },
            { key: 'poolish', label: 'Poolish' },
            { key: 'biga', label: 'Biga' },
          ],
          profile.prefermentType,
          key => patch({ prefermentType: key as 'none' | 'poolish' | 'biga' | null }),
        )}

        <span style={S.label}>{fr ? 'Frigo' : 'Fridge'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
          {[4, 5, 6, 7, 8].map(t => (
            <button key={t} onClick={() => patch({ fridgeTemp: profile.fridgeTemp === t ? undefined : t })}
              style={S.pill(profile.fridgeTemp === t)}>
              <span style={{ fontFamily: 'var(--font-ui)' }}>{t}°C</span>
            </button>
          ))}
        </div>

        <span style={S.label}>{fr ? 'Style favori — pizza' : 'Favourite style — pizza'}</span>
        {pillRow(
          Object.entries(PIZZA_STYLES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.styleKeyPizza ?? profile.styleKey, key => patch({ styleKeyPizza: key as StyleKey | null }),
        )}
        <span style={S.label}>{fr ? 'Style favori — pain' : 'Favourite style — bread'}</span>
        {pillRow(
          Object.entries(BREAD_STYLES).map(([key, v]) => ({ key, label: fr ? v.nameFr : v.name })),
          profile.styleKeyBread ?? profile.styleKey, key => patch({ styleKeyBread: key as StyleKey | null }),
        )}

        <span style={S.label}>{fr ? 'Mon levain' : 'My starter'}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px' }}>
          <button onClick={() => patch({ starter: { ...starter, mature: !starter.mature } })} style={S.pill(starter.mature)}>
            {fr ? 'Mature (> 3 mois)' : 'Mature (> 3 months)'}
          </button>
          <button onClick={() => patch({ starter: { ...starter, hasRye: !starter.hasRye } })} style={S.pill(starter.hasRye)}>
            {fr ? 'Avec seigle' : 'With rye'}
          </button>
          {([['mild', fr ? 'Doux' : 'Mild'], ['balanced', fr ? 'Équilibré' : 'Balanced'], ['tangy', fr ? 'Prononcé' : 'Tangy']] as const).map(([key, label]) => (
            <button key={key} onClick={() => patch({ starter: { ...starter, tang: key } })} style={S.pill(starter.tang === key)}>
              {label}
            </button>
          ))}
        </div>

        <span style={S.label}>{fr ? 'Indisponibilités habituelles' : 'Usual busy hours'}</span>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--smoke)', padding: '0 16px 8px' }}>
          {fr ? 'Le planning évitera ces créneaux dans chaque nouvelle session.' : 'New sessions plan around these windows.'}
        </div>
        {blockerRow('sleep', fr ? 'Nuit' : 'Night')}
        {blockerRow('work', fr ? 'Travail' : 'Work')}

      </div>
    </>
  );
}
