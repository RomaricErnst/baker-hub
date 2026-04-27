'use client';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import {
  ALL_STYLES,
  type MixerType, type StyleKey, type AnyOvenType, type FlourBlend, type PrefermentType, type YeastType,
} from '@/app/data';
import { buildSchedule, calculateRecipe } from '@/app/utils';
import { bakeEventTitle, bakeEventDoughSpec, type BakeEvent } from '@/app/lib/supabase/fetchBakeEvents';

interface SessionViewerProps {
  event: BakeEvent | null;
  onClose: () => void;
  onResume: (event: BakeEvent) => void;
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

export default function SessionViewer({ event, onClose, onResume }: SessionViewerProps) {
  const locale = useLocale();
  const l = locale === 'fr' ? 'fr' : 'en';

  const snap = event?.dough_snapshot ?? null;

  const schedule = useMemo(() => {
    if (!snap?.eatTime) return null;
    try {
      const eat = new Date(snap.eatTime);
      const start = new Date(snap.eatTime - 24 * 3600000);
      return buildSchedule(
        start, eat, [],
        snap.kitchenTemp ?? 22, 30,
        (snap.mixerType ?? 'hand') as MixerType,
        (snap.styleKey ?? 'neapolitan') as StyleKey,
      );
    } catch { return null; }
  }, [snap]);

  const recipe = useMemo(() => {
    if (!snap?.styleKey || !snap.ovenType || !snap.yeastType || !schedule) return null;
    try {
      return calculateRecipe(
        snap.styleKey as StyleKey,
        snap.ovenType as AnyOvenType,
        snap.numItems,
        snap.itemWeight,
        snap.kitchenTemp ?? 22,
        snap.humidity ?? 'normal',
        schedule,
        snap.fridgeTemp ?? 4,
        snap.yeastType as YeastType,
        snap.tab === 'custom' ? 'custom' : 'simple',
        (snap.mixerType ?? 'hand') as MixerType,
        snap.manualHydration,
        snap.manualOil,
        snap.manualSugar,
        snap.flourBlend as FlourBlend | undefined,
        snap.prefermentType as PrefermentType,
        snap.priorityOverride ?? undefined,
        snap.prefermentFlourPct,
        snap.manualSalt,
        snap.targetDoughTemp,
        snap.flourInFridge,
        snap.wastePct,
      );
    } catch { return null; }
  }, [snap, schedule]);

  if (!event || !snap) return null;

  const hasPref = snap.prefermentType && snap.prefermentType !== 'none';
  const coldH = schedule?.totalColdHours ?? 0;
  const rtH = schedule?.totalRTHours ?? 0;

  const styleName = (ALL_STYLES as Record<string, { name: string }>)[snap.styleKey ?? '']?.name ?? snap.styleKey ?? '';
  const title = bakeEventTitle(event);
  const spec = bakeEventDoughSpec(event);

  const statusLabel = event.status === 'baked'
    ? (l === 'fr' ? 'Cuite' : 'Baked')
    : event.status === 'pizza_planned'
    ? (l === 'fr' ? 'Pizzas planifiees' : 'Pizza planned')
    : (l === 'fr' ? 'Planifiee' : 'Planned');
  const statusBg = event.status === 'baked'
    ? 'rgba(107,122,90,0.15)'
    : event.status === 'pizza_planned'
    ? 'rgba(212,168,83,0.15)'
    : 'rgba(138,127,120,0.15)';
  const statusColor = event.status === 'baked'
    ? 'var(--sage)'
    : event.status === 'pizza_planned'
    ? 'var(--gold)'
    : 'var(--smoke)';

  const prefLabel = hasPref
    ? snap.prefermentType!.charAt(0).toUpperCase() + snap.prefermentType!.slice(1)
    : '';

  const monoSm: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--smoke)',
  };
  const monoXs: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '11px', color: 'rgba(138,127,120,0.7)',
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--warm)', borderRadius: '20px 20px 0 0',
        zIndex: 300, animation: 'slideUpSheet 0.3s ease',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        maxWidth: '680px', margin: '0 auto',
      }}>

        {/* Drag handle */}
        <div style={{
          width: '36px', height: '4px', background: 'rgba(0,0,0,0.15)',
          borderRadius: '2px', margin: '14px auto 10px',
        }} />

        {/* Title block */}
        <div style={{ padding: '0 20px 16px' }}>
          <p style={{
            fontFamily: 'var(--font-playfair)', fontSize: '20px', fontWeight: 700,
            color: 'var(--char)', margin: '0 0 4px',
          }}>{title}</p>
          {spec && (
            <p style={{ fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--smoke)', margin: 0 }}>
              {spec}
            </p>
          )}
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            marginTop: '8px', padding: '3px 10px',
            borderRadius: '20px', background: statusBg,
            fontSize: '10px', fontFamily: 'var(--font-dm-mono)', color: statusColor,
          }}>{statusLabel}</div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '0 20px' }} />

        {/* Dough section */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--smoke)',
            textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px',
          }}>
            {l === 'fr' ? 'Pate' : 'Dough'}
          </div>

          {/* Poolish / preferment block */}
          {hasPref && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-block', width: '3px', height: '16px',
                  background: 'var(--terra)', borderRadius: '2px',
                  marginRight: '8px', flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-dm-sans)', fontSize: '14px',
                  fontWeight: 600, color: 'var(--char)',
                }}>
                  {l === 'fr' ? `Préparer ${prefLabel}` : `Make ${prefLabel}`}
                </span>
              </div>
              <div style={{ marginTop: '4px', marginLeft: '11px', ...monoSm }}>
                {recipe?.preferment
                  ? `${recipe.preferment.prefFlour}g flour · ${recipe.preferment.prefWater}g water${recipe.preferment.prefYeastGrams ? ` · ${recipe.preferment.prefYeastGrams}g yeast` : ''}`
                  : `${snap.prefermentFlourPct ?? '—'}% of flour`}
              </div>
              <div style={{ marginTop: '2px', marginLeft: '11px', ...monoXs }}>
                {snap.prefOffsetH}h {l === 'fr' ? 'avant la pate' : 'before dough'}
              </div>
            </div>
          )}

          {/* Main dough block */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{
                display: 'inline-block', width: '3px', height: '16px',
                background: 'var(--sage)', borderRadius: '2px',
                marginRight: '8px', flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-dm-sans)', fontSize: '14px',
                fontWeight: 600, color: 'var(--char)',
              }}>
                {l === 'fr' ? 'Démarrer la pate' : 'Start Dough'}
              </span>
            </div>
            <div style={{ marginTop: '4px', marginLeft: '11px', ...monoSm }}>
              {recipe
                ? hasPref && recipe.preferment
                  ? `${recipe.preferment.finalFlour}g flour · ${recipe.preferment.finalWater}g water · ${recipe.salt}g salt`
                  : `${recipe.flour}g flour · ${recipe.water}g water · ${recipe.salt}g salt`
                : `${snap.numItems} × ${snap.itemWeight}g`}
            </div>
            {snap.yeastType && (
              <div style={{ marginTop: '2px', marginLeft: '11px', ...monoXs }}>
                {snap.yeastType}
              </div>
            )}
          </div>

          {/* Fermentation summary */}
          {(coldH > 0 || rtH > 0) && (
            <div style={{ marginTop: '12px', ...monoSm }}>
              {coldH > 0 && rtH > 0
                ? `Cold ${formatHours(coldH)} · RT ${formatHours(rtH)}`
                : coldH > 0
                ? `Cold ${formatHours(coldH)}`
                : `RT ${formatHours(rtH)}`}
            </div>
          )}
        </div>

        {/* Spacer before action bar */}
        <div style={{ height: '24px' }} />

        {/* Action bar */}
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px',
        }}>
          <button
            onClick={onClose}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              marginBottom: '10px', fontFamily: 'var(--font-dm-mono)',
              fontSize: '12px', color: 'var(--smoke)',
              background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {l === 'fr' ? 'Fermer' : 'Close'}
          </button>
          <button
            onClick={() => { onResume(event); onClose(); }}
            style={{
              width: '100%', padding: '14px',
              background: 'var(--terra)', color: 'white',
              fontFamily: 'var(--font-playfair)', fontSize: '16px', fontWeight: 700,
              borderRadius: '12px', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(196,82,42,0.22)',
            }}
          >
            {l === 'fr' ? 'Reprendre la session' : 'Resume session'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
