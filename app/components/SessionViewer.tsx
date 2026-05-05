'use client';
import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import {
  ALL_STYLES,
  type MixerType, type StyleKey, type AnyOvenType, type FlourBlend, type PrefermentType, type YeastType,
} from '@/app/data';
import { buildSchedule, calculateRecipe } from '@/app/utils';
import { fetchPizzaPartySlots, bakeEventTitle, bakeEventDoughSpec, type BakeEvent, type PizzaPartySlot } from '@/app/lib/supabase/fetchBakeEvents';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';

interface SessionViewerProps {
  event: BakeEvent | null;
  onClose: () => void;
  onResume: (event: BakeEvent) => void;
  onDelete?: (id: string) => void;
  slots?: PizzaPartySlot[];
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

export default function SessionViewer({ event, onClose, onResume, onDelete, slots }: SessionViewerProps) {
  const locale = useLocale();
  const l = locale === 'fr' ? 'fr' : 'en';

  const [localSlots, setLocalSlots] = useState<PizzaPartySlot[]>([]);
  useEffect(() => {
    if (!event?.pizza_party_id && event?.status !== 'pizza_planned') { setLocalSlots([]); return; }
    if (slots && slots.length > 0) { setLocalSlots(slots); return; }
    fetchPizzaPartySlots([event.id]).then(map => setLocalSlots(map[event.id] ?? []));
  }, [event?.id, slots]);

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
        maxHeight: '88vh', overflowY: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: 'var(--warm)', borderRadius: '20px 20px 0 0',
        zIndex: 300, animation: 'slideUpSheet 0.3s ease',
        maxWidth: '680px', margin: '0 auto',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--smoke)', fontSize: '18px', lineHeight: 1,
            padding: '4px', zIndex: 1,
          }}
        >✕</button>
      <div style={{ overflowY: 'auto', flex: 1 }}>

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
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
              padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(107,122,90,0.15)', color: 'var(--sage)',
            }}>Dough</span>
            {(event.pizza_party_id || event.status === 'pizza_planned') && (
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(212,168,83,0.15)', color: 'var(--gold)',
              }}>Pizza</span>
            )}
            {event.status === 'baked' && (
              <span style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(196,82,42,0.15)', color: 'var(--terra)',
              }}>Baked</span>
            )}
          </div>
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

          {/* Settings row */}
          <div style={{ ...monoSm, marginBottom: '4px' }}>
            {[
              styleName,
              `${snap.numItems} ${snap.bakeType === 'bread' ? (snap.numItems === 1 ? 'loaf' : 'loaves') : (snap.numItems === 1 ? 'pizza' : 'pizzas')}`,
              snap.ovenType ?? '',
              snap.yeastType ?? '',
            ].filter(Boolean).join(' · ')}
          </div>

          {/* Recipe row */}
          <div style={{ ...monoSm, marginBottom: '4px' }}>
            {recipe
              ? hasPref && recipe.preferment
                ? `${recipe.preferment.finalFlour}g flour · ${recipe.preferment.finalWater}g water · ${recipe.salt}g salt`
                : `${recipe.flour}g flour · ${recipe.water}g water · ${recipe.salt}g salt`
              : `${snap.numItems} × ${snap.itemWeight}g`}
          </div>

          {/* Fermentation summary */}
          {(coldH > 0 || rtH > 0) && (
            <div style={{ ...monoSm }}>
              {coldH > 0 && rtH > 0
                ? `Cold ${formatHours(coldH)} · RT ${formatHours(rtH)}`
                : coldH > 0
                ? `Cold ${formatHours(coldH)}`
                : `RT ${formatHours(rtH)}`}
            </div>
          )}
        </div>

        {/* Pizza selections */}
        {localSlots.length > 0 && (
          <>
            <div style={{ height: '1px', background: 'var(--border)', margin: '16px 20px 0' }} />
            <div style={{ padding: '16px 20px 0' }}>
              <div style={{
                fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--smoke)',
                textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px',
              }}>
                {l === 'fr' ? 'Pizzas' : 'Pizzas'}
              </div>
              {localSlots.map((slot, i) => {
                const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
                const pizza = allPizzas.find(p => p.id === slot.preset_id);
                const displayName = pizza
                  ? ((pizza.name as Record<string, string>)[l] ?? pizza.name.en)
                  : slot.preset_id;
                return (
                  <div key={slot.id ?? i} style={{
                    fontSize: '13px', color: 'var(--char)',
                    fontFamily: 'var(--font-dm-sans)',
                    padding: '6px 0',
                    borderBottom: i < localSlots.length - 1 ? '1px solid var(--border)' : undefined,
                  }}>
                    {slot.qty && slot.qty > 1 ? `${displayName} ×${slot.qty}` : displayName}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Spacer before action bar */}
        <div style={{ height: '24px' }} />

      </div>{/* end scrollable content */}

        {/* Action bar */}
        <div style={{
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px',
          paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        }}>
          <button
            onClick={async () => {
              if (!window.confirm('Delete this session? This cannot be undone.')) return;
              const { deleteBakeEvent } = await import('@/app/lib/supabase/fetchBakeEvents');
              await deleteBakeEvent(event.id);
              onDelete?.(event.id);
              onClose();
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              marginBottom: '8px', fontFamily: 'var(--font-dm-mono)',
              fontSize: '12px', color: 'var(--terra)',
              background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline', opacity: 0.7,
            }}
          >
            {l === 'fr' ? 'Supprimer' : 'Delete session'}
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
