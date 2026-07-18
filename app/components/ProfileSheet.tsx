'use client';
// ☰ Mon profil — baker preferences persisted locally (bh_profile_v1).
// Every change saves instantly; new sessions prefill from here.
import { useState } from 'react';
import { OVEN_TYPES, BREAD_OVEN_TYPES, MIXER_TYPES, YEAST_TYPES, PIZZA_STYLES, BREAD_STYLES } from '../data';
import { loadProfile, updateProfile, deleteCustomPizza, DEFAULT_BLOCKERS, type BakerProfile } from '../lib/profile';
import { createClient } from '../lib/supabase/client';
import { useEffect } from 'react';
import type { StyleKey } from '../lib/toppingTypes';

const S = {
  label: {
    fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--terra)',
    textTransform: 'uppercase' as const, letterSpacing: '1.5px', fontWeight: 700,
    margin: '18px 16px 8px', display: 'block',
  },
  pill: (active: boolean) => ({
    border: active ? '1.5px solid var(--terra)' : '1px solid var(--border)',
    background: active ? 'rgba(196,82,42,0.07)' : 'var(--warm)',
    color: 'var(--char)', borderRadius: '20px', padding: '7px 13px',
    fontFamily: 'var(--font-dm-sans)', fontSize: '12.5px', cursor: 'pointer',
    lineHeight: 1.2,
  }),
};

export default function ProfileSheet({ locale, onClose }: { locale: string; onClose: () => void }) {
  const fr = locale === 'fr';
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px' }}>
      {entries.map(e => (
        <button key={e.key} onClick={() => onPick(current === e.key ? null : e.key)} style={S.pill(current === e.key)}>
          {e.label}
        </button>
      ))}
    </div>
  );

  const timeInput = (value: string, onChange: (v: string) => void) => (
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 8px',
        fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--char)',
        background: 'var(--warm)', width: '86px',
      }}
    />
  );

  const blockerRow = (key: 'sleep' | 'work', label: string) => {
    const b = blockers[key];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', flexWrap: 'wrap' }}>
        <button
          onClick={() => patch({ blockers: { ...blockers, [key]: { ...b, enabled: !b.enabled } } })}
          style={{ ...S.pill(b.enabled), minWidth: '104px', textAlign: 'left' as const }}
        >
          {b.enabled ? '✓ ' : ''}{label}
        </button>
        {b.enabled && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {timeInput(b.from, v => patch({ blockers: { ...blockers, [key]: { ...b, from: v } } }))}
            <span style={{ color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)', fontSize: '11px' }}>→</span>
            {timeInput(b.to, v => patch({ blockers: { ...blockers, [key]: { ...b, to: v } } }))}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 290 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--cream)', borderRadius: '16px 16px 0 0',
        zIndex: 300, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ width: 36, height: 4, background: 'rgba(0,0,0,0.15)', borderRadius: 2, margin: '14px auto 10px' }} />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 16px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', fontWeight: 700, color: 'var(--char)' }}>
              {fr ? 'Mes préférences' : 'My preferences'}
            </span>
            <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11px', color: 'var(--smoke)', marginTop: '2px' }}>
              {fr ? 'Enregistré automatiquement à chaque changement — prérempli dans chaque nouvelle session.' : 'Saved automatically on every change — prefilled into each new session.'}
              {signedIn !== null && (
                <span style={{ display: 'block', marginTop: '2px', color: signedIn ? 'var(--sage, #6B7A5A)' : 'var(--smoke)' }}>
                  {signedIn
                    ? (fr ? 'Synchronisé avec votre compte ✓' : 'Synced with your account ✓')
                    : (fr ? 'Local sur cet appareil — connectez-vous pour synchroniser' : 'Local to this device — sign in to sync')}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)',
            background: 'var(--warm)', cursor: 'pointer', fontSize: 16, color: 'var(--smoke)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        <span style={S.label}>{fr ? 'Mode par défaut' : 'Default mode'}</span>
        <div style={{ display: 'flex', gap: '6px', padding: '0 16px' }}>
          {([['simple', 'Simple'], ['custom', fr ? 'Avancé' : 'Custom']] as const).map(([key, label]) => (
            <button key={key} onClick={() => patch({ preferredMode: profile.preferredMode === key ? null : key })} style={S.pill(profile.preferredMode === key)}>
              {label}
            </button>
          ))}
        </div>

        <span style={S.label}>{fr ? 'Mes pizzas' : 'My pizzas'}</span>
        {customs.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '12px', color: 'var(--smoke)', fontStyle: 'italic', padding: '0 16px' }}>
            {fr ? 'Créez vos pizzas depuis Ma Soirée Pizza — elles vivront ici.' : 'Create pizzas from My Pizza Party — they will live here.'}
          </div>
        ) : customs.map(cp => (
          <div key={cp.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 16px 6px', padding: '9px 12px',
            background: 'var(--warm)', border: '1px solid var(--border)', borderRadius: '10px',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '14px', fontWeight: 600, color: 'var(--char)' }}>{cp.name}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '10.5px', color: 'var(--smoke)' }}>
                {cp.ingredients.length} {fr ? 'ingrédients' : 'ingredients'}
              </div>
            </div>
            <button
              onClick={() => { deleteCustomPizza(cp.id); setProfile({ version: 1, ...(loadProfile() ?? {}) }); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'var(--smoke)',
                textDecoration: 'underline', textUnderlineOffset: '2px',
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

        <span style={S.label}>{fr ? 'Frigo' : 'Fridge'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
          {[4, 5, 6, 7, 8].map(t => (
            <button key={t} onClick={() => patch({ fridgeTemp: profile.fridgeTemp === t ? undefined : t })}
              style={S.pill(profile.fridgeTemp === t)}>
              <span style={{ fontFamily: 'var(--font-dm-mono)' }}>{t}°C</span>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px' }}>
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
        <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '11.5px', color: 'var(--smoke)', padding: '0 16px 6px' }}>
          {fr ? 'Le planning évitera ces créneaux dans chaque nouvelle session.' : 'New sessions plan around these windows.'}
        </div>
        {blockerRow('sleep', fr ? 'Nuit' : 'Night')}
        {blockerRow('work', fr ? 'Travail' : 'Work')}

      </div>
    </>
  );
}
