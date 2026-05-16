'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from 'next-intl';
import {
  ALL_STYLES, computeBlendProfile,
  type MixerType, type StyleKey, type AnyOvenType,
  type FlourBlend, type PrefermentType, type YeastType,
} from '@/app/data';
import { buildSchedule, calculateRecipe } from '@/app/utils';
import {
  fetchPizzaPartySlots, fetchPhotosForEvents, fetchBakedQtys,
  bakeEventTitle, bakeEventDoughSpec,
  type BakeEvent, type PizzaPartySlot, type BakePhoto,
} from '@/app/lib/supabase/fetchBakeEvents';
import { saveComment, uploadBakePhoto, deleteBakePhoto, updateSessionName } from '@/app/lib/supabase/saveBakeEvent';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';
import ShareCard from '@/app/components/ShareCard';

interface SessionViewerProps {
  event: BakeEvent | null;
  onClose: () => void;
  onResume: (event: BakeEvent) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
  slots?: PizzaPartySlot[];
  defaultShowShare?: boolean;
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

const OVEN_LABEL: Record<string, string> = {
  pizza_oven: 'Pizza oven', home_oven: 'Home oven',
  ooni_karu: 'Ooni Karu', ooni_koda: 'Ooni Koda',
  roccbox: 'Roccbox', gozney_dome: 'Gozney Dome',
  cast_iron: 'Cast iron', bbq: 'BBQ',
  ooni_volt: 'Ooni Volt', steel: 'Baking steel',
};
const MIXER_LABEL: Record<string, string> = {
  hand: 'Hand kneaded', stand: 'Stand mixer',
  no_knead: 'No-knead', spiral: 'Spiral mixer',
};
const YEAST_LABEL: Record<string, string> = {
  instant: 'Instant dry yeast',
  active_dry: 'Active dry yeast',
  fresh: 'Fresh yeast',
  sourdough: 'Sourdough',
};
const YEAST_SHORT: Record<string, string> = {
  instant: 'IDY',
  active_dry: 'ADY',
  fresh: 'Fresh yeast',
  sourdough: 'Levain',
};

export default function SessionViewer({
  event, onClose, onResume, onDelete, onRename, slots, defaultShowShare,
}: SessionViewerProps) {
  const locale = useLocale();
  const l = locale === 'fr' ? 'fr' : 'en';

  const [localSlots, setLocalSlots] = useState<PizzaPartySlot[]>([]);
  const [photos, setPhotos] = useState<BakePhoto[]>([]);
  const [comment, setComment] = useState('');
  const [editingComment, setEditingComment] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [bakedQtys, setBakedQtys] = useState<Record<string, number> | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!event?.id) { setLocalSlots([]); return; }
    if (slots && slots.length > 0) { setLocalSlots(slots); return; }
    fetchPizzaPartySlots([event.id]).then(map => {
      setLocalSlots(map[event.id] ?? []);
    });
  }, [event?.id, slots, event?.pizza_party_id, event?.status]);

  useEffect(() => {
    if (!event?.id) return;
    fetchPhotosForEvents([event.id]).then(map => {
      const all = map[event.id] ?? [];
      setPhotos(all.filter(p => p.slot_index === null));
    });
  }, [event?.id]);

  useEffect(() => {
    setComment(event?.comment ?? '');
  }, [event?.id]);

  useEffect(() => {
    if (!event) return;
    setSessionTitle(event.notes ?? bakeEventTitle(event));
  }, [event?.id]);

  useEffect(() => {
    if (defaultShowShare && event) setShowShareModal(true);
  }, [defaultShowShare, event?.id]);

  useEffect(() => {
    if (!event?.id) { setBakedQtys(null); return; }
    fetchBakedQtys(event.id).then(setBakedQtys);
  }, [event?.id]);

  const snap = event?.dough_snapshot ?? null;
  const cr = snap?.computedRecipe ?? null;

  const schedule = useMemo(() => {
    if (cr) return null;
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
  }, [snap, cr]);

  const recipe = useMemo(() => {
    if (cr) return null;
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
  }, [snap, schedule, cr]);

  const displayFlour = cr?.flour ?? recipe?.flour ?? null;
  const displayWater = cr?.water ?? recipe?.water ?? null;
  const displaySalt = cr?.salt ?? recipe?.salt ?? null;
  const displayHydration = cr?.hydration
    ?? (snap?.manualHydration != null ? snap.manualHydration : null)
    ?? (recipe ? Math.round((recipe.water / recipe.flour) * 100) : null);
  const yeastGrams = snap?.computedRecipe?.totalIngredients?.yeast ?? snap?.computedRecipe?.yeastGrams ?? recipe?.yeast?.convertedGrams ?? null;
  const yeastRounded = yeastGrams != null
    ? Math.round(yeastGrams * 10) / 10
    : null;

  if (!event || !snap) return null;
  if (typeof document === 'undefined') return null;

  const hasPref = snap.prefermentType && snap.prefermentType !== 'none';
  const coldH = cr?.coldH ?? schedule?.totalColdHours ?? 0;
  const rtH = cr?.rtH ?? schedule?.totalRTHours ?? 0;
  const styleName = (ALL_STYLES as Record<string, { name: string }>)[snap.styleKey ?? '']?.name ?? snap.styleKey ?? '';
  const title = bakeEventTitle(event);
  const prefLabel = hasPref
    ? snap.prefermentType!.charAt(0).toUpperCase() + snap.prefermentType!.slice(1)
    : null;
  const doughBallSpec = snap.numItems && snap.itemWeight
    ? `${snap.numItems} × ${snap.itemWeight}g`
    : null;
  const flourBlendName = snap.tab === 'custom' && snap.flourBlend
    ? (() => {
        try {
          const blend = snap.flourBlend as FlourBlend;
          const raw = blend as unknown as Record<string, unknown>;
          const brandProduct = raw.brandProduct as string | undefined;
          const ratio1 = typeof raw.ratio1 === 'number' ? raw.ratio1 : 100;
          const profile = computeBlendProfile(blend);
          const isBlend = blend.flour2 && ratio1 < 100;
          if (isBlend) {
            const raw2 = profile.displayName?.split(' + ')[1]?.trim() ?? '';
            const flour2Name = raw2.replace(/^\d+%\s*/, '');
            const flour2Part = `${100 - ratio1}% ${flour2Name}`.trim();
            return brandProduct
              ? `${ratio1}% ${brandProduct} + ${flour2Part}`
              : profile.displayName ?? null;
          } else {
            return brandProduct ?? profile.displayName ?? null;
          }
        } catch { return null; }
      })()
    : null;

  const protocolLines: string[] | null = (() => {
    const lines: string[] = [];

    // Style · spec · hydration · pref
    const specParts = [
      styleName,
      snap.numItems && snap.itemWeight ? `${snap.numItems} × ${snap.itemWeight}g` : null,
      displayHydration != null ? `${displayHydration}%` : null,
      prefLabel,
    ].filter((x): x is string => x != null && x !== '');
    lines.push(specParts.join(' · '));

    if (flourBlendName) lines.push(`  ${flourBlendName}`);

    if (displayFlour && displayWater && displaySalt) {
      const yeastPart = snap.yeastType !== 'sourdough' && yeastRounded != null
        ? ` · ${yeastRounded}g ${YEAST_SHORT[snap.yeastType ?? ''] ?? 'yeast'}`
        : '';
      lines.push(`${displayFlour}g flour · ${displayWater}g water${yeastPart} · ${displaySalt}g salt`);
    }

    lines.push('');

    if (schedule) {
      const fmt = (d: Date) => {
        const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${day} ${hh}:${mm}`;
      };
      const mixStart = new Date(schedule.bulkFermStart.getTime() - schedule.mixingDurationH * 3600000);
      lines.push(`${fmt(mixStart)}  Mix`);
      lines.push(`${fmt(schedule.bulkFermStart)}  Bulk ferment`);
      if (schedule.totalColdHours > 0 && schedule.coldRetardStart) {
        lines.push(`${fmt(schedule.coldRetardStart)}  Cold retard (${formatHours(schedule.totalColdHours)})`);
      }
      lines.push(`${fmt(schedule.divideBallTime)}  Divide & ball`);
      lines.push(`${fmt(schedule.finalProofStart)}  Final proof`);
      lines.push(`${fmt(schedule.preheatStart)}  Preheat`);
      lines.push(`${fmt(schedule.bakeStart)}  Bake`);
    } else {
      if (coldH > 0) lines.push(`  Cold ${formatHours(coldH)}`);
      if (rtH > 0) lines.push(`  RT ${formatHours(rtH)}`);
    }

    const gearParts = [
      snap.ovenType ? (OVEN_LABEL[snap.ovenType] ?? snap.ovenType.replace(/_/g, ' ')) : null,
      snap.mixerType ? (MIXER_LABEL[snap.mixerType] ?? snap.mixerType) : null,
    ].filter((x): x is string => x != null && x !== '');
    if (gearParts.length > 0) {
      lines.push('');
      lines.push(`  ${gearParts.join(' · ')}`);
    }

    return lines;
  })();

  const monoSm: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '12px', color: 'var(--smoke)',
  };
  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-dm-mono)', fontSize: '10px', color: 'var(--smoke)',
    textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px',
  };
  const divider = { height: '1px', background: 'var(--border)', margin: '16px 20px 0' };

  const handlePhotoUpload = async (file: File) => {
    if (!event?.id || photos.length >= 6) return;
    setUploading(true);
    const supabase = (await import('@/app/lib/supabase/client')).createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const result = await uploadBakePhoto(event.id, user.id, file);
    if (result) {
      setPhotos(prev => [...prev, {
        id: result.id,
        slot_index: null,
        photo_url: result.url,
        taken_at: new Date().toISOString(),
      }]);
    }
    setUploading(false);
  };

  return createPortal(
    <>
      {/* Scrim */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299,
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxHeight: '92vh', overflowY: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: 'var(--warm)', borderRadius: '20px 20px 0 0',
        zIndex: 300, animation: 'slideUpSheet 0.3s ease',
        maxWidth: '680px', margin: '0 auto',
      }}>

        {/* X close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--smoke)', fontSize: '18px', lineHeight: 1,
          padding: '4px', zIndex: 2,
        }}>✕</button>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Drag handle */}
          <div style={{
            width: '36px', height: '4px', background: 'rgba(0,0,0,0.15)',
            borderRadius: '2px', margin: '14px auto 10px',
          }} />

          {/* Title + pills */}
          <div style={{ padding: '0 20px 16px' }}>
            {editingTitle ? (
              <input
                autoFocus
                value={sessionTitle}
                onChange={e => setSessionTitle(e.target.value)}
                onBlur={async () => {
                  setEditingTitle(false);
                  if (event?.id && sessionTitle !== (event.notes ?? bakeEventTitle(event))) {
                    await updateSessionName(event.id, sessionTitle);
                    onRename?.(event.id, sessionTitle);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') {
                    setSessionTitle(event?.notes ?? bakeEventTitle(event!));
                    setEditingTitle(false);
                  }
                }}
                style={{
                  fontFamily: 'var(--font-playfair)', fontSize: '20px',
                  fontWeight: 700, color: 'var(--char)',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  background: 'transparent', outline: 'none',
                  width: '100%', paddingRight: '32px', paddingBottom: '2px',
                  margin: '0 0 8px',
                }}
              />
            ) : (
              <div
                onClick={() => setEditingTitle(true)}
                style={{
                  cursor: 'text', display: 'flex', alignItems: 'flex-start',
                  gap: '6px', marginBottom: '8px', paddingRight: '32px',
                }}
              >
                <p style={{
                  fontFamily: 'var(--font-playfair)', fontSize: '20px',
                  fontWeight: 700, color: 'var(--char)', margin: 0,
                  borderBottom: '1px dashed rgba(0,0,0,0.15)',
                  paddingBottom: '1px',
                }}>
                  {sessionTitle || title}
                </p>
                <span style={{
                  fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
                  color: 'var(--smoke)', opacity: 0.4, marginTop: '4px',
                  flexShrink: 0,
                }}>✎</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

          <div style={divider} />

          {/* ── DOUGH SECTION ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={sectionLabel}>{l === 'fr' ? 'Pâte' : 'Dough'}</div>

            <div style={{ ...monoSm, marginBottom: '4px' }}>
              {[
                styleName,
                doughBallSpec,
                displayHydration != null ? `${displayHydration}%` : null,
                prefLabel,
              ].filter(Boolean).join(' · ')}
            </div>

            {flourBlendName && (
              <div style={{ ...monoSm, marginBottom: '4px', opacity: 0.8 }}>
                {flourBlendName}
              </div>
            )}

            <div style={{ ...monoSm, marginBottom: '4px' }}>
              {displayFlour && displayWater && displaySalt
                ? [
                    `${displayFlour}g flour`,
                    `${displayWater}g water`,
                    snap.yeastType === 'sourdough'
                      ? 'Levain'
                      : snap.yeastType && yeastRounded
                        ? `${yeastRounded}g ${YEAST_SHORT[snap.yeastType] ?? snap.yeastType}`
                        : null,
                    `${displaySalt}g salt`,
                  ].filter(Boolean).join(' · ')
                : `${snap.numItems} × ${snap.itemWeight}g`}
            </div>

            <div style={{ ...monoSm, marginBottom: '4px' }}>
              {[
                OVEN_LABEL[snap.ovenType ?? ''] ?? (snap.ovenType ?? '').replace(/_/g, ' '),
                MIXER_LABEL[snap.mixerType ?? ''] ?? snap.mixerType,
              ].filter(Boolean).join(' · ')}
            </div>

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

          {/* ── PIZZA PLAN SECTION ── */}
          {(localSlots.length > 0 || event.pizza_party_id || event.status === 'pizza_planned') && (<>
            <div style={divider} />
            <div style={{ padding: '16px 20px 0' }}>
              <div style={sectionLabel}>{l === 'fr' ? 'Plan Pizza' : 'Pizza Plan'}</div>
              {localSlots.length === 0 ? (
                <div style={{ ...monoSm, fontStyle: 'italic' }}>
                  {l === 'fr' ? 'Sélections non disponibles' : 'Selections not available'}
                </div>
              ) : localSlots.map((slot, i) => {
                const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
                const pizza = allPizzas.find(p => p.id === slot.preset_id);
                const name = pizza
                  ? ((pizza.name as Record<string, string>)[l] ?? (pizza.name as Record<string, string>).en ?? slot.preset_id)
                  : slot.preset_id;
                return (
                  <div key={slot.id ?? i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '3px 0',
                  }}>
                    <span style={{ ...monoSm }}>{name}</span>
                    {slot.qty && slot.qty > 1 && (
                      <span style={{ ...monoSm }}>×{slot.qty}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>)}

          {/* ── PIZZAS BAKED SECTION ── */}
          {bakedQtys && Object.values(bakedQtys).some(v => v > 0) && (<>
            <div style={divider} />
            <div style={{ padding: '16px 20px 0' }}>
              <div style={sectionLabel}>{l === 'fr' ? 'Pizzas cuites' : 'Pizzas Baked'}</div>
              {Object.entries(bakedQtys)
                .filter(([, qty]) => qty > 0)
                .map(([presetId, qty], i) => {
                  const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
                  const pizza = allPizzas.find(p => p.id === presetId);
                  const name = pizza
                    ? ((pizza.name as Record<string, string>)[l] ?? (pizza.name as Record<string, string>).en ?? presetId)
                    : presetId;
                  return (
                    <div key={presetId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '3px 0',
                    }}>
                      <span style={{ ...monoSm }}>{name}</span>
                      <span style={{ ...monoSm, color: 'var(--sage)' }}>×{qty}</span>
                    </div>
                  );
                })}
            </div>
          </>)}

          {/* ── PHOTOS SECTION ── */}
          <div style={divider} />
          <div style={{ padding: '16px 20px 0' }}>
            <div style={sectionLabel}>{l === 'fr' ? 'Photos' : 'Photos'}</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

              {photos.map(photo => (
                <div key={photo.id} style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0 }}>
                  <img
                    src={photo.photo_url}
                    alt="bake photo"
                    style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px', display: 'block' }}
                  />
                  <button
                    onClick={async () => {
                      await deleteBakePhoto(photo.id, photo.photo_url);
                      setPhotos(prev => prev.filter(p => p.id !== photo.id));
                    }}
                    style={{
                      position: 'absolute', top: '-6px', right: '-6px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'var(--terra)', border: 'none', cursor: 'pointer',
                      color: 'white', fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                </div>
              ))}

              {photos.length < 6 && (
                <label style={{
                  width: '80px', height: '80px', borderRadius: '10px',
                  border: '1.5px dashed var(--border)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', gap: '4px', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '22px', opacity: 0.35, lineHeight: 1 }}>+</span>
                  <span style={{
                    fontFamily: 'var(--font-dm-mono)', fontSize: '9px',
                    color: 'var(--smoke)', textAlign: 'center', lineHeight: 1.3,
                  }}>
                    {uploading ? '...' : (l === 'fr' ? 'Ajouter' : 'Add photo')}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handlePhotoUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            <p style={{
              fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
              color: 'var(--smoke)', opacity: 0.6, marginTop: '8px',
            }}>
              {photos.length}/6 photos
            </p>
          </div>

          {/* ── COMMENT SECTION ── */}
          <div style={divider} />
          <div style={{ padding: '16px 20px 24px' }}>
            <div style={sectionLabel}>{l === 'fr' ? 'Note' : 'Note'}</div>
            {editingComment ? (
              <div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  autoFocus
                  rows={3}
                  placeholder={l === 'fr' ? 'Ajouter une note...' : 'Add a note...'}
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-dm-sans)', fontSize: '13px',
                    color: 'var(--char)', background: 'var(--cream)',
                    resize: 'none', boxSizing: 'border-box', outline: 'none',
                  }}
                />
                <button
                  onClick={async () => {
                    if (event?.id) await saveComment(event.id, comment);
                    setEditingComment(false);
                  }}
                  style={{
                    marginTop: '6px', padding: '6px 16px', borderRadius: '8px',
                    background: 'var(--terra)', color: 'white', border: 'none',
                    fontFamily: 'var(--font-dm-mono)', fontSize: '12px', cursor: 'pointer',
                  }}
                >
                  {l === 'fr' ? 'Sauvegarder' : 'Save'}
                </button>
              </div>
            ) : (
              <div
                onClick={() => setEditingComment(true)}
                style={{
                  fontFamily: 'var(--font-dm-sans)', fontSize: '13px',
                  color: comment ? 'var(--char)' : 'var(--smoke)',
                  fontStyle: comment ? 'normal' : 'italic',
                  cursor: 'pointer', minHeight: '36px', lineHeight: 1.5,
                }}
              >
                {comment || (l === 'fr' ? 'Ajouter une note...' : 'Tap to add a note...')}
              </div>
            )}
          </div>

        </div>{/* end scrollable content */}

        {/* Action bar */}
        <div style={{
          background: 'var(--warm)',
          borderTop: '1px solid var(--border)',
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>

          {/* PRIMARY: Resume */}
          <button
            onClick={() => { onResume(event); onClose(); }}
            style={{
              width: '100%', padding: '15px',
              background: 'var(--terra)', color: 'white',
              fontFamily: 'var(--font-playfair)', fontSize: '17px', fontWeight: 700,
              borderRadius: '12px', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(196,82,42,0.25)',
              letterSpacing: '.01em',
            }}
          >
            {l === 'fr' ? 'Reprendre la session' : 'Resume session'}
          </button>

          {/* SECONDARY: Share */}
          <button
            onClick={() => setShowShareModal(true)}
            style={{
              width: '100%', padding: '12px',
              background: 'transparent',
              border: '1px solid rgba(212,168,83,0.5)',
              color: 'var(--gold)',
              fontFamily: 'var(--font-dm-mono)', fontSize: '13px',
              borderRadius: '10px', cursor: 'pointer',
              letterSpacing: '.06em',
            }}
          >
            {l === 'fr' ? '✦ Partager' : '✦ Share this bake'}
          </button>

          {/* DESTRUCTIVE: Delete — low prominence */}
          <button
            onClick={async () => {
              if (!window.confirm(
                l === 'fr'
                  ? 'Supprimer cette session ? Cette action est irréversible.'
                  : 'Delete this session? This cannot be undone.'
              )) return;
              const { deleteBakeEvent } = await import('@/app/lib/supabase/fetchBakeEvents');
              await deleteBakeEvent(event.id);
              onDelete?.(event.id);
              onClose();
            }}
            style={{
              width: '100%', padding: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-dm-mono)', fontSize: '11px',
              color: 'var(--smoke)', opacity: 0.5,
              textDecoration: 'underline', textUnderlineOffset: '2px',
            }}
          >
            {l === 'fr' ? 'Supprimer la session' : 'Delete session'}
          </button>

        </div>

        {showShareModal && (
          <ShareCard
            styleName={styleName}
            sessionName={sessionTitle || event?.notes || null}
            numItems={snap.numItems}
            itemWeight={snap.itemWeight}
            hydration={displayHydration}
            prefLabel={prefLabel}
            flourLine={flourBlendName}
            recipeFlour={displayFlour}
            recipeWater={displayWater}
            recipeSalt={displaySalt}
            coldH={coldH}
            rtH={rtH}
            bakedQtys={bakedQtys}
            localSlots={localSlots}
            sessionPhotos={photos}
            locale={l}
            status={event.status}
            bakeType={snap?.bakeType ?? 'pizza'}
            ovenType={snap?.ovenType ?? null}
            mixerType={snap?.mixerType ?? null}
            manualOil={snap?.manualOil ?? null}
            manualSugar={snap?.manualSugar ?? null}
            yeastType={snap?.yeastType ?? null}
            yeastGrams={yeastRounded}
            bakeDate={snap?.eatTime
              ? new Date(snap.eatTime).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                })
              : null}
            protocolLines={protocolLines}
            onClose={() => setShowShareModal(false)}
          />
        )}

      </div>
    </>,
    document.body,
  );
}
