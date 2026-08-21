'use client';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import { createClient } from '@/app/lib/supabase/client';
import { fetchRecipes, recipeSubtitle, type SavedRecipe } from '@/app/lib/supabase/fetchRecipes';
import { updateRecipe, deleteRecipe } from '@/app/lib/supabase/saveRecipe';
import { fetchBakeEvents, deleteBakeEvent, bakeEventTitle, bakeEventDoughSpec, fetchPhotosForEvents, fetchPizzaPartySlots, type BakeEvent, type BakePhoto, type PizzaPartySlot } from '@/app/lib/supabase/fetchBakeEvents';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { type UnitSystem } from '../utils/units';
import SessionViewer from './SessionViewer';
import { PIZZAS, DESSERT_PIZZAS } from '@/app/lib/toppingDatabase';

function RecipeCard({ r, onUpdate, onLoad, onDelete }: {
  r: SavedRecipe;
  onUpdate: (id: string, field: 'recipe_name' | 'notes', value: string) => void;
  onLoad?: (r: SavedRecipe) => void;
  onDelete?: (id: string) => void;
}) {
  const [editing, setEditing]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName]   = useState(r.recipe_name ?? '');
  const [notes, setNotes] = useState(r.notes ?? '');

  useEffect(() => { setName(r.recipe_name ?? ''); },  [r.recipe_name]);
  useEffect(() => { setNotes(r.notes ?? ''); }, [r.notes]);

  const sub = recipeSubtitle(r);

  function saveAll() {
    setEditing(false);
    onUpdate(r.id, 'recipe_name', name);
    onUpdate(r.id, 'notes', notes);
  }

  if (confirmDelete) {
    return (
      <div style={{
        padding: '8px 12px', borderRadius: '8px',
        background: 'rgba(107, 68, 35,0.15)',
        border: '1px solid rgba(107, 68, 35,0.4)',
      }}>
        <div style={{
          fontSize: '12px', color: '#E8785A',
          fontFamily: 'var(--font-ui)', marginBottom: '8px',
        }}>
          Delete <strong>{name || 'this recipe'}</strong>?
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { onDelete?.(r.id); setConfirmDelete(false); }}
            style={{
              flex: 1, padding: '4px', borderRadius: '8px',
              background: 'var(--terra)', border: 'none',
              color: '#fff', fontSize: '12px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontWeight: 600,
            }}>Yes, delete</button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              flex: 1, padding: '4px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--smoke)', fontSize: '12px', cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.2)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 12px 8px' }}>
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.38)',
            fontFamily: 'var(--font-ui)',
          }}>{sub.line1}</div>
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.25)',
            fontFamily: 'var(--font-ui)', marginTop: '1px',
          }}>{sub.line2}</div>
        </div>
        <div style={{ padding: '0 12px 12px' }}>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Recipe name..."
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', padding: '4px 8px',
              color: 'var(--cream)', fontSize: '12px',
              fontFamily: 'var(--font-ui)', fontWeight: 600,
              outline: 'none', marginBottom: '8px',
            }}
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes..."
            rows={2}
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px', padding: '4px 8px',
              color: 'rgba(255,255,255,0.7)', fontSize: '12px',
              fontFamily: 'var(--font-ui)',
              outline: 'none', resize: 'none', lineHeight: 1.5,
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={saveAll}
              style={{
                flex: 1, padding: '4px', minHeight: '44px', borderRadius: '8px',
                background: 'var(--terra)', border: 'none',
                color: '#fff', fontSize: '12px', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontWeight: 600,
              }}>Save</button>
            <button
              onClick={() => { setEditing(false); setName(r.recipe_name ?? ''); setNotes(r.notes ?? ''); }}
              style={{
                flex: 1, padding: '4px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: '12px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setEditing(true)}
        style={{ padding: '8px 12px 8px', cursor: 'pointer' }}
      >
        <div style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.38)',
          fontFamily: 'var(--font-ui)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub.line1}</div>
        <div style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.25)',
          fontFamily: 'var(--font-ui)', marginTop: '1px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub.line2}</div>
        <div style={{
          marginTop: '4px',
          fontSize: '12px', fontFamily: 'var(--font-ui)',
          fontWeight: name ? 600 : 400,
          color: name ? 'var(--cream)' : 'rgba(255,255,255,0.22)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name || 'Untitled recipe'}</div>
        {notes && (
          <div style={{
            marginTop: '3px',
            fontSize: '12px', color: 'rgba(255,255,255,0.42)',
            fontFamily: 'var(--font-ui)', lineHeight: 1.45,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}>{notes}</div>
        )}
      </div>

      <div style={{
        display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            flex: 1, padding: '4px 0', background: 'none', border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: '11px',
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}>Edit</button>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            flex: 1, padding: '4px 0', background: 'none', border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: '11px',
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}>Delete</button>
        <button
          onClick={() => onLoad?.(r)}
          style={{
            flex: 1, padding: '4px 0', background: 'none', border: 'none',
            color: '#E8785A', fontSize: '11px',
            fontFamily: 'var(--font-ui)', fontWeight: 600, cursor: 'pointer',
          }}>Resume</button>
      </div>
    </div>
  );
}

export default function Header({
  units = 'metric',
  onUnitsChange,
  onLoadRecipe,
  recipeGenerated,
  sessionSaved,
  sessionRestored,
  hideActionBar,
  backHref,
  sessionSummary,
  sessionDoughSpec,
  onSaveSession,
  onNewSession,
  onOpenProfile,
  onLoadBakeEvent,
  onResumeBakeEvent,
  onRebakeBakeEvent,
  openSessionId,
  onShareSessionClose,
}: {
  units?: UnitSystem;
  onUnitsChange?: (u: UnitSystem) => void;
  onLoadRecipe?: (r: SavedRecipe) => void;
  recipeGenerated?: boolean;
  sessionSaved?: boolean;
  sessionRestored?: boolean;
  hideActionBar?: boolean;
  // Renders a persistent back chip instead of the action pill (About page)
  backHref?: string;
  sessionSummary?: string;
  sessionDoughSpec?: string;
  onSaveSession?: () => void;
  onNewSession?: () => void;
  onOpenProfile?: () => void;
  onLoadBakeEvent?: (event: BakeEvent) => void;
  onResumeBakeEvent?: (event: BakeEvent) => void;
  onRebakeBakeEvent?: (event: BakeEvent) => void;
  openSessionId?: string | null;
  onShareSessionClose?: () => void;
}) {
  const t = useTranslations('header');
  const tS = useTranslations('session');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Share (and future actions) can request the sign-in home: anonymous
  // bakers tapping "Save & Share" get the drawer with the auth block
  // spotlighted and a contextual line — no hunting for where to sign in.
  const [authSpotlight, setAuthSpotlight] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const open = () => {
      setMenuOpen(true);
      setAuthSpotlight(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setAuthSpotlight(false), 4000);
    };
    window.addEventListener('bh-open-auth', open);
    return () => { window.removeEventListener('bh-open-auth', open); if (timer) clearTimeout(timer); };
  }, []);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [bakeEvents, setBakeEvents] = useState<BakeEvent[]>([]);
  const [eventPhotos, setEventPhotos] = useState<Record<string, BakePhoto[]>>({});
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewingEvent, setViewingEvent] = useState<BakeEvent | null>(null);
  const [viewingEventShowShare, setViewingEventShowShare] = useState(false);
  const [eventSlots, setEventSlots] = useState<Record<string, PizzaPartySlot[]>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (menuOpen && user) {
      setLoadingRecipes(true);
      Promise.all([fetchRecipes(), fetchBakeEvents()]).then(([recipeData, eventData]) => {
        setRecipes(recipeData);
        const filtered = eventData.filter(e => e.notes !== '__autosave__');
        setBakeEvents(filtered);
        setLoadingRecipes(false);
        const ids = filtered.map(e => e.id);
        if (ids.length > 0) {
          fetchPhotosForEvents(ids).then(photos => setEventPhotos(photos));
          fetchPizzaPartySlots(ids).then(slots => setEventSlots(slots));
        }
      });
    }
  }, [menuOpen, user]);

  useEffect(() => {
    if (!sessionSaved || !user) return;
    fetchBakeEvents().then(events => {
      const filtered = events.filter(e => e.notes !== '__autosave__');
      setBakeEvents(filtered);
      const withPizza = filtered.filter(e => e.pizza_party_id);
      if (withPizza.length > 0) {
        fetchPizzaPartySlots(withPizza.map(e => e.id))
          .then(map => setEventSlots(prev => ({ ...prev, ...map })));
      }
    });
  }, [sessionSaved, user]);

  useEffect(() => {
    if (!openSessionId) return;
    fetchBakeEvents().then(events => {
      const ev = events.find(e => e.id === openSessionId);
      if (ev) {
        setViewingEvent(ev);
        setViewingEventShowShare(true);
      }
    });
  }, [openSessionId]);

  async function signInWithGoogle() {
    const redirectTo = typeof window !== 'undefined'
      ? window.location.hostname === 'localhost'
        ? 'http://localhost:3000/auth/callback'
        : 'https://www.bakerhub.app/auth/callback'
      : 'https://www.bakerhub.app/auth/callback';
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setMenuOpen(false);
  }

  async function signInWithEmail() {
    if (!emailInput.trim()) return;
    const redirectTo = typeof window !== 'undefined'
      ? window.location.hostname === 'localhost'
        ? 'http://localhost:3000/auth/callback'
        : 'https://www.bakerhub.app/auth/callback'
      : 'https://www.bakerhub.app/auth/callback';
    await supabase.auth.signInWithOtp({
      email: emailInput.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setEmailSent(true);
  }

  function handleFieldBlur(id: string, field: 'recipe_name' | 'notes', value: string) {
    const trimmed = value.trim();
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, [field]: trimmed || null } : r));
    updateRecipe(id, { [field]: trimmed || null });
  }

  function handleDeleteRecipe(id: string) {
    setRecipes(prev => prev.filter(r => r.id !== id));
    deleteRecipe(id);
  }

  const monoLabel: React.CSSProperties = {
    fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
    textTransform: 'uppercase', letterSpacing: '.06em',
  };

  return (
    <>
    <header style={{
      background: 'var(--char)', color: 'var(--cream)',
      padding: '0 12px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '68px',
      position: 'sticky', top: 0, zIndex: 100,
      
    }}>
      {/* Left: menu button + logo + tagline */}
      <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 auto' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menu"
          style={{
            background: menuOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: 'none',
            borderRadius: '12px', cursor: 'pointer',
            padding: '12px 8px', display: 'flex', flexDirection: 'column',
            gap: '4px', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{
              display: 'block', width: '24px', height: '2.5px',
              background: 'var(--cream)', borderRadius: '1.5px',
            }} />
          ))}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo-mark.webp" width={36} height={36}
            style={{ objectFit: 'contain' }} alt="Baker Hub" />
          <div className="bh-wordmark" style={{
            fontFamily: 'var(--font-ui)',
            // The wordmark carries the brand on a sans now, so it leans on
            // weight and tightening rather than on a serif's contrast.
            fontSize: '17px', fontWeight: 800, letterSpacing: '-0.025em',
            color: 'var(--cream)', lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>Baker Hub</div>
        </div>
      </div>

      {/* Back chip — pages outside the session flow (About) get a
          persistent way home in the sticky header instead of session
          actions that can't work there. */}
      {backHref && (
        <a
          href={backHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px',
            border: '1px solid rgba(240, 235, 224,0.25)',
            borderRadius: '20px',
            color: 'var(--cream)',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="20" y1="12" x2="4" y2="12" /><polyline points="11 5 4 12 11 19" />
          </svg>
          Baker Hub
        </a>
      )}

      {/* Right: three round 44px targets. They used to be two labels sharing
          one pill, which meant the destructive action sat a thumb-width from
          the one bakers tap most, both at 11px.

          Order and spacing are the mis-tap guard: Start over is set apart from
          Save by 16px and rendered quietly (no fill, dim stroke), while the two
          benign actions — Save and Profile — sit together at 8px. Nothing
          destructive is ever adjacent to something frequent. */}
      {!backHref && (() => {
        const hasWork = (recipeGenerated || sessionSaved || sessionRestored) && !hideActionBar;
        const showAny = recipeGenerated || sessionSaved || sessionRestored;
        if (!showAny) return null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>

            {/* Start over — quiet, and the furthest of the three from Save */}
            {onNewSession && (
              <button
                onClick={() => {
                  if (!hasWork || window.confirm(tS('newSessionConfirm'))) onNewSession?.();
                }}
                aria-label={locale === 'fr' ? 'Recommencer' : 'Start over'}
                title={locale === 'fr' ? 'Recommencer' : 'Start over'}
                style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginRight: '16px',
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9A918A"
                  strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" />
                </svg>
              </button>
            )}

            {/* Save — the icon carries the state, since there is no label to
                carry it: a floppy while unsaved, a tick once stored. */}
            {hasWork && (
              <button
                onClick={() => { if (!sessionSaved) onSaveSession?.(); }}
                aria-label={sessionSaved ? tS('saved') : tS('saveSession')}
                title={sessionSaved ? tS('saved') : tS('saveSession')}
                style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  border: sessionSaved
                    ? '1px solid rgba(107,122,90,0.5)'
                    : '1px solid rgba(200,138,82,0.45)',
                  background: sessionSaved
                    ? 'rgba(107,122,90,0.14)'
                    : 'rgba(200,138,82,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: sessionSaved ? 'default' : 'pointer',
                }}
              >
                {sessionSaved ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93A683"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12.5l5 5 11-11" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--terra-on-dark)"
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h12l4 4v12H4z" /><path d="M8 4v6h8V4" />
                    <rect x="8" y="14" width="8" height="6" />
                  </svg>
                )}
              </button>
            )}
          </div>
        );
      })()}
      {/* Profile picto — far right, 44px tap target (Flo). */}
      {!backHref && (
        <button
          onClick={() => window.dispatchEvent(new Event('bh-open-auth'))}
          aria-label={user ? 'Profile' : 'Sign in'}
          style={{
            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative', marginLeft: '8px',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#C4BBAE" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.6" />
            <path d="M4.5 20c1.6-3.4 4.3-5 7.5-5s5.9 1.6 7.5 5" />
          </svg>
          {user && (
            <span style={{
              position: 'absolute', top: '2px', right: '2px',
              width: '10px', height: '10px', borderRadius: '50%',
              background: 'var(--sage)', border: '1.5px solid #2B2420',
            }} />
          )}
        </button>
      )}

    </header>

    {/* Drawer rendered via portal — outside header stacking context */}
    {menuOpen && typeof document !== 'undefined' && createPortal(
      <>
        {/* Scrim */}
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199 }}
        />
        {/* Drawer panel */}
        <div style={{
          position: 'fixed', top: 0, left: 0, height: '100dvh', width: '300px',
          background: '#2B2420', borderRight: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.5)', zIndex: 200,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideInLeft 0.25s ease',
        }}>
          {/* Drawer header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo-mark.webp" alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }}/>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--cream)' }}>
                Baker Hub
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--smoke)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            >x</button>
          </div>

          {/* ── Current session — always visible ── */}
          {recipeGenerated && (
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}>
              <div style={{ ...monoLabel, marginBottom: '8px' }}>
                {locale === 'fr' ? 'Session en cours' : 'Current session'}
              </div>

              {/* Summary card */}
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '12px 12px',
              }}>
                {sessionSummary && (
                  <div style={{
                    fontSize: '12px', fontFamily: 'var(--font-ui)',
                    fontWeight: 600, color: 'var(--cream)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{sessionSummary}</div>
                )}
                {sessionDoughSpec && (
                  <div style={{
                    fontSize: '11px', fontFamily: 'var(--font-ui)',
                    color: 'var(--smoke)', marginTop: '2px',
                  }}>{sessionDoughSpec}</div>
                )}
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                {sessionSaved ? (
                  <span style={{
                    fontSize: '11px', fontFamily: 'var(--font-ui)',
                    color: 'var(--sage)', cursor: 'default',
                  }}>
                    {locale === 'fr' ? 'Session enregistree' : 'Session saved'}
                  </span>
                ) : (
                  <button
                    onClick={() => { onSaveSession?.(); setMenuOpen(false); }}
                    style={{
                      fontSize: '11px', fontFamily: 'var(--font-ui)',
                      color: 'var(--terra-on-dark)',
                      border: '1px solid rgba(200, 138, 82,0.4)',
                      borderRadius: '12px',
                      background: 'rgba(200, 138, 82,0.1)',
                      padding: '12px 16px', minHeight: '44px',
                      cursor: 'pointer',
                    }}
                  >
                    {locale === 'fr' ? 'Enregistrer' : 'Save session'}
                  </button>
                )}
                {onNewSession && <button
                  // Same guard as the header icon. This copy called
                  // onNewSession() straight through: the destructive action
                  // was confirmed in one place and not the other.
                  onClick={() => {
                    if (window.confirm(tS('newSessionConfirm'))) {
                      onNewSession();
                      setMenuOpen(false);
                    }
                  }}
                  style={{
                    fontSize: '13px', fontFamily: 'var(--font-ui)',
                    color: 'var(--smoke)',
                    background: 'none', border: 'none',
                    padding: '12px 8px', minHeight: '44px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {locale === 'fr' ? 'Nouvelle session' : 'New session'}
                </button>}
              </div>
            </div>
          )}

          {/* ── Mon profil ── */}
          {onOpenProfile && (
            <button
              onClick={() => { setMenuOpen(false); onOpenProfile(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'transparent', border: 'none',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', width: '100%', textAlign: 'left', flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--cream)' }}>
                {locale === 'fr' ? 'Mes préférences' : 'My preferences'}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--smoke)' }}>→</span>
            </button>
          )}

          {/* ── Language · Units — always visible ── */}
          {([
            {
              label: locale === 'fr' ? 'Langue' : 'Language',
              options: [
                { key: 'en', display: 'EN', active: locale === 'en', onSelect: () => { router.replace(pathname, { locale: 'en' }); setMenuOpen(false); } },
                { key: 'fr', display: 'FR', active: locale === 'fr', onSelect: () => { router.replace(pathname, { locale: 'fr' }); setMenuOpen(false); } },
              ],
            },
            {
              label: locale === 'fr' ? 'Unites' : 'Units',
              options: [
                { key: 'metric',   display: 'g/°C',   active: units === 'metric',   onSelect: () => onUnitsChange?.('metric') },
                { key: 'imperial', display: 'oz/°F',  active: units === 'imperial', onSelect: () => onUnitsChange?.('imperial') },
              ],
            },
          ] as const).map((row, idx) => (
            <div key={row.label} style={{
              padding: '12px 16px',
              borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={monoLabel}>{row.label}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {row.options.map(opt => (
                  <button key={opt.key} onClick={opt.onSelect} style={{
                    minWidth: '48px', padding: '.22rem 8px', minHeight: '44px', borderRadius: '12px',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    fontSize: '12px', fontWeight: 600, textAlign: 'center',
                    background: opt.active ? 'var(--terra)' : 'transparent',
                    color: opt.active ? '#fff' : 'var(--smoke)',
                  }}>{opt.display}</button>
                ))}
              </div>
            </div>
          ))}

          {/* ── My Sessions label — always visible ── */}
          <div style={{
            padding: '12px 16px 8px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <div style={{ ...monoLabel }}>
              {locale === 'fr' ? 'Mes sessions' : 'My sessions'}
            </div>
          </div>

          {/* ── My Sessions cards — scrollable ── */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '4px 16px 12px' }}>
            {!user ? (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                {locale === 'fr' ? 'Connectez-vous pour sauvegarder vos sessions' : 'Sign in to save your sessions'}
              </div>
            ) : loadingRecipes ? (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)' }}>
                {locale === 'fr' ? 'Chargement...' : 'Loading...'}
              </div>
            ) : bakeEvents.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                {locale === 'fr' ? 'Aucune session sauvegardee' : 'No saved sessions yet'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bakeEvents.map(event => {
                  const title = bakeEventTitle(event);
                  const spec = bakeEventDoughSpec(event);
                  return (
                    <div key={event.id} style={{
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      position: 'relative',
                      minHeight: '96px',
                    }}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm('Delete this session?')) return;
                          await deleteBakeEvent(event.id);
                          setBakeEvents(prev => prev.filter(ev => ev.id !== event.id));
                        }}
                        style={{
                          position: 'absolute', bottom: '8px', right: '10px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.25)',
                          padding: '2px', lineHeight: 1, zIndex: 1,
                        }}
                        title="Delete session"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                      <div
                        onClick={() => { setViewingEvent(event); setMenuOpen(false); }}
                        style={{ padding: '12px 12px 12px', cursor: 'pointer' }}
                      >
                        <div style={{
                          fontSize: '12px', fontFamily: 'var(--font-ui)',
                          fontWeight: 600, color: 'var(--cream)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{title}</div>
                        {spec && (
                          <div style={{
                            fontSize: '11px', fontFamily: 'var(--font-ui)',
                            color: 'var(--smoke)', marginTop: '2px',
                          }}>{spec}</div>
                        )}
                        {(eventSlots[event.id] ?? []).length > 0 && (
                          <div style={{
                            fontSize: '11px', fontFamily: 'var(--font-ui)',
                            color: 'rgba(255,255,255,0.4)', marginTop: '2px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {(eventSlots[event.id] ?? []).map(s => {
                const allPizzas = [...PIZZAS, ...DESSERT_PIZZAS];
                const pizza = allPizzas.find(p => p.id === s.preset_id);
                return pizza
                  ? ((pizza.name as Record<string,string>)[locale] ?? (pizza.name as Record<string,string>).en ?? s.preset_id)
                  : s.preset_id;
              }).join(' · ')}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: 'var(--font-ui)', fontSize: '11px',
                            padding: '2px 8px', borderRadius: '20px',
                            background: 'rgba(107,122,90,0.15)', color: 'var(--sage)',
                          }}>Dough</span>
                          {event.pizza_party_id && (
                            <span style={{
                              fontFamily: 'var(--font-ui)', fontSize: '11px',
                              padding: '2px 8px', borderRadius: '20px',
                              background: 'rgba(156, 130, 72,0.15)', color: 'var(--gold)',
                            }}>Pizza</span>
                          )}
                          {event.status === 'baked' && (
                            <span style={{
                              fontFamily: 'var(--font-ui)', fontSize: '11px',
                              padding: '2px 8px', borderRadius: '20px',
                              background: 'rgba(200, 138, 82,0.10)', color: 'var(--terra-on-dark)',
                            }}>Baked</span>
                          )}
                          {/* Nav #5 — clone this session onto the next matching weekday/time */}
                          {onRebakeBakeEvent && event.dough_snapshot?.eatTime && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRebakeBakeEvent(event);
                                setMenuOpen(false);
                              }}
                              style={{
                                fontFamily: 'var(--font-ui)', fontSize: '11px',
                                padding: '2px 8px', borderRadius: '20px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: 'var(--cream)', cursor: 'pointer',
                                lineHeight: '1.6',
                              }}
                            >
                              ↻ {locale === 'fr' ? 'Refaire' : 'Rebake'}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Photo thumbnails */}
                      {(() => {
                        const photos = eventPhotos[event.id] ?? [];
                        if (photos.length === 0) return null;
                        const bySlot = photos.reduce((acc, p) => {
                          const key = p.slot_index ?? 'main';
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(p);
                          return acc;
                        }, {} as Record<string | number, BakePhoto[]>);
                        const slots = Object.values(bySlot);
                        return (
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: '4px',
                            padding: '0 12px 8px',
                          }}>
                            {slots.map((slot, si) => (
                              <div key={si} style={{
                                width: '40px', height: '40px',
                                borderRadius: '16px', overflow: 'hidden',
                                position: 'relative', flexShrink: 0,
                              }}>
                                <img
                                  src={slot[0].photo_url}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  alt=""
                                />
                                {slot.length > 1 && (
                                  <div style={{
                                    position: 'absolute', bottom: '2px', right: '2px',
                                    background: 'rgba(0,0,0,0.6)', borderRadius: '4px',
                                    padding: '1px 4px',
                                    fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'white',
                                  }}>{`×${slot.length}`}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── About link — pinned footer ── */}
          <div style={{
            padding: '4px 16px 8px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <Link
              href={locale === 'fr' ? '/fr/about' : '/about'}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--smoke)', textDecoration: 'none',
                padding: '4px 0', display: 'block',
                letterSpacing: '.04em', marginTop: '4px',
              }}
            >
              {locale === 'fr' ? 'À propos' : 'About'}
            </Link>
          </div>

          {/* ── Auth — pinned footer ── */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
            ...(authSpotlight && !user ? {
              boxShadow: 'inset 0 0 0 1.5px var(--gold)',
              borderRadius: '16px',
              background: 'rgba(156, 130, 72,0.08)',
              transition: 'box-shadow .3s, background .3s',
            } : { transition: 'box-shadow .3s, background .3s' }),
          }}>
            {authSpotlight && !user && (
              <div style={{
                fontSize: '12px', color: 'var(--gold)',
                fontFamily: 'var(--font-ui)', marginBottom: '8px',
                lineHeight: 1.45,
              }}>
                {locale === 'fr'
                  ? 'Connectez-vous pour sauvegarder et partager vos fournées'
                  : 'Sign in to save and share your bakes'}
              </div>
            )}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{
                  fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{user.email}</span>
                <button onClick={signOut} style={{
                  padding: '4px 12px', minHeight: '44px', borderRadius: '8px', flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent',
                  color: 'var(--smoke)', fontSize: '11px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}>Sign out</button>
              </div>
            ) : emailSent ? (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-ui)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                Check your inbox — link sent
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={signInWithGoogle} style={{
                  width: '100%', padding: '8px', minHeight: '44px', borderRadius: '12px',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--cream)',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  fontWeight: 500, textAlign: 'center',
                }}>Sign in with Google</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-ui)' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                </div>
                {showEmailForm ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="email" placeholder="your@email.com"
                      value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                      style={{
                        flex: 1, padding: '8px 8px', borderRadius: '8px',
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: 'rgba(255,255,255,0.08)', color: 'var(--cream)',
                        fontSize: '12px', fontFamily: 'var(--font-ui)', outline: 'none',
                      }}
                    />
                    <button onClick={signInWithEmail} style={{
                      padding: '8px 12px', minHeight: '44px', borderRadius: '8px', flexShrink: 0,
                      background: 'var(--terra)', border: 'none',
                      color: '#fff', fontSize: '12px', cursor: 'pointer',
                      fontFamily: 'var(--font-ui)', fontWeight: 500,
                    }}>Send</button>
                  </div>
                ) : (
                  <button onClick={() => setShowEmailForm(true)} style={{
                    width: '100%', padding: '8px', borderRadius: '12px',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: 'rgba(255,255,255,0.55)',
                    fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    textAlign: 'center',
                  }}>Sign in with email</button>
                )}
              </div>
            )}
          </div>

        </div>
      </>,
      document.body
    )}

    <SessionViewer
      event={viewingEvent}
      onClose={() => { setViewingEvent(null); setViewingEventShowShare(false); onShareSessionClose?.(); }}
      onResume={(ev) => { onResumeBakeEvent?.(ev); setViewingEvent(null); setViewingEventShowShare(false); }}
      onDelete={(id) => { setBakeEvents(prev => prev.filter(e => e.id !== id)); setViewingEvent(null); setViewingEventShowShare(false); }}
      onRename={(id, name) => {
        setBakeEvents(prev => prev.map(e => e.id === id ? { ...e, notes: name } : e));
      }}
      slots={eventSlots[viewingEvent?.id ?? ''] ?? []}
      defaultShowShare={viewingEventShowShare}
    />
    </>
  );
}
