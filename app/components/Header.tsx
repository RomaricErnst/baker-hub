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
  onBack,
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
  onBack?: () => void;
  onOpenProfile?: () => void;
  onLoadBakeEvent?: (event: BakeEvent) => void;
  onResumeBakeEvent?: (event: BakeEvent) => void;
  onRebakeBakeEvent?: (event: BakeEvent) => void;
  openSessionId?: string | null;
  onShareSessionClose?: () => void;
}) {
  const t = useTranslations('header');
  const tS = useTranslations('session');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Keep keyboard navigation inside the open menu and restore the trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
      if (e.key !== 'Tab') return;
      const items = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === drawerRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === drawerRef.current)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [menuOpen]);
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
  const [codeInput, setCodeInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authNote, setAuthNote] = useState<'sendFailed' | 'codeRejected' | null>(null);
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

  // A one-time code, not a link. The PKCE verifier behind a magic link lives
  // only in the browser that asked for it, so opening the mail in a webview or
  // on another device left the baker back on the site, silently signed out.
  async function signInWithEmail() {
    const email = emailInput.trim();
    if (!email || authBusy) return;
    setAuthBusy(true);
    setAuthNote(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setAuthBusy(false);
    if (error) { setAuthNote('sendFailed'); return; }
    setEmailSent(true);
  }

  async function verifyEmailCode() {
    const token = codeInput.replace(/\D/g, '');
    if (token.length !== 6 || authBusy) return;
    setAuthBusy(true);
    setAuthNote(null);
    // 'email' covers both signup and sign-in — never branch on which.
    const { error } = await supabase.auth.verifyOtp({
      email: emailInput.trim(),
      token,
      type: 'email',
    });
    setAuthBusy(false);
    if (error) { setAuthNote('codeRejected'); setCodeInput(''); return; }
    // onAuthStateChange sets the user.
    setEmailSent(false);
    setCodeInput('');
    setShowEmailForm(false);
    setEmailInput('');
  }

  function useAnotherEmail() {
    setEmailSent(false);
    setCodeInput('');
    setAuthNote(null);
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
      background: 'var(--warm)', color: 'var(--char)',
      padding: '0 12px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '64px', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
      
    }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={locale === 'fr' ? 'Retour' : 'Back'}
          style={{ border: 'none', background: 'transparent', color: 'var(--char)', width: '44px', minHeight: '44px', padding: 0, fontSize: '24px', lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}
        >‹</button>
      )}
      <div ref={menuRef} style={{ minWidth: 0, flex: '1 1 auto' }}>
        <div className="bh-wordmark" style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>bakerhub.</div>
      </div>
      <button onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen} aria-controls="bakerhub-menu" aria-haspopup="dialog"
        style={{ order: 3, border: 'none', background: 'transparent', color: 'var(--char)', minHeight: '44px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
        Menu
      </button>

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
            color: 'var(--char)',
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

      {!backHref && !hideActionBar && (
        <div style={{ order: 2, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {onSaveSession && (onNewSession || recipeGenerated || sessionRestored) && (
            <button onClick={() => { if (!sessionSaved) onSaveSession(); }}
              aria-label={sessionSaved ? (user ? (locale === 'fr' ? 'Enregistré dans votre compte' : 'Saved to your account') : (locale === 'fr' ? 'Enregistré sur cet appareil' : 'Saved on this device')) : (locale === 'fr' ? 'Enregistrer' : 'Save')}
              title={sessionSaved ? (user ? (locale === 'fr' ? 'Enregistré dans votre compte' : 'Saved to your account') : (locale === 'fr' ? 'Enregistré sur cet appareil' : 'Saved on this device')) : undefined}
              aria-disabled={sessionSaved}
              style={{ border: 'none', borderRadius: '10px', background: 'transparent', color: 'var(--char)', minHeight: '44px', padding: '8px 10px', fontSize: '13px', whiteSpace: 'nowrap', cursor: sessionSaved ? 'default' : 'pointer' }}>
              {sessionSaved ? (locale === 'fr' ? 'Enregistré' : 'Saved') : (locale === 'fr' ? 'Enregistrer' : 'Save')}
            </button>
          )}
        </div>
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
        <div id="bakerhub-menu" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} style={{
          position: 'fixed', top: 0, left: 0, height: '100dvh', width: 'min(360px, 100vw)',
          background: 'var(--warm)', borderRight: '1px solid var(--border)',
          boxShadow: '4px 0 32px rgba(43,36,32,0.18)', zIndex: 200,
          display: 'flex', flexDirection: 'column', overflowY: 'auto', color: 'var(--char)',
          animation: 'slideInLeft 0.25s ease',
        }}>
          {/* Drawer header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 12px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--warm)', zIndex: 2,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo-mark.webp" alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }}/>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--char)' }}>
                Baker Hub
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label={locale === 'fr' ? 'Fermer' : 'Close'}
              style={{
                background: 'transparent', border: 'none', color: 'var(--smoke)',
                fontSize: '17px', lineHeight: 1, cursor: 'pointer',
                width: '44px', height: '44px', margin: '-11px -11px -11px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          {/* ── Current session — always visible ── */}
          {(recipeGenerated || sessionRestored || onNewSession) && (
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <div style={{ ...monoLabel, marginBottom: '8px' }}>
                {locale === 'fr' ? 'Ce plan' : 'This plan'}
              </div>

              {/* Summary card */}
              {(sessionSummary || sessionDoughSpec) && <div style={{
                background: 'var(--cream)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '12px 12px',
              }}>
                {sessionSummary && (
                  <div style={{
                    fontSize: '12px', fontFamily: 'var(--font-ui)',
                    fontWeight: 600, color: 'var(--char)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{sessionSummary}</div>
                )}
                {sessionDoughSpec && (
                  <div style={{
                    fontSize: '11px', fontFamily: 'var(--font-ui)',
                    color: 'var(--smoke)', marginTop: '2px',
                  }}>{sessionDoughSpec}</div>
                )}
              </div>}

              {/* Action row */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                {sessionSaved ? (
                  <span style={{
                    fontSize: '11px', fontFamily: 'var(--font-ui)',
                    color: user ? 'var(--sage)' : 'var(--smoke)',
                    cursor: 'default', lineHeight: 1.4,
                  }}>
                    {user ? tS('saved') : tS('savedLocalNote')}
                  </span>
                ) : onSaveSession ? (
                  <button
                    onClick={() => { onSaveSession?.(); setMenuOpen(false); }}
                    style={{
                      fontSize: '11px', fontFamily: 'var(--font-ui)',
                      color: 'var(--terra)',
                      border: '1px solid rgba(200, 138, 82,0.4)',
                      borderRadius: '12px',
                      background: 'rgba(200, 138, 82,0.1)',
                      padding: '12px 16px', minHeight: '44px',
                      cursor: 'pointer',
                    }}
                  >
                    {locale === 'fr' ? 'Enregistrer' : 'Save'}
                  </button>
                ) : null}
                {onNewSession && <button
                  // The parent owns the save/discard/cancel guard for both entry points.
                  onClick={() => {
                    setMenuOpen(false);
                    onNewSession();
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
                  {locale === 'fr' ? 'Nouvelle fournée' : 'Start a new bake'}
                </button>}
              </div>
            </div>
          )}

          <div style={{ ...monoLabel, padding: '16px 16px 4px' }}>Bakerhub</div>
          {/* ── Mon profil ── */}
          {onOpenProfile && (
            <button
              onClick={() => { setMenuOpen(false); onOpenProfile(); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: 'transparent', border: 'none',
                borderTop: '1px solid var(--border)',
                cursor: 'pointer', width: '100%', textAlign: 'left', flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--char)' }}>
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
              label: locale === 'fr' ? 'Unités' : 'Units',
              options: [
                { key: 'metric',   display: 'g/°C',   active: units === 'metric',   onSelect: () => onUnitsChange?.('metric') },
                { key: 'imperial', display: 'oz/°F',  active: units === 'imperial', onSelect: () => onUnitsChange?.('imperial') },
              ],
            },
          ] as const).map((row, idx) => (
            <div key={row.label} style={{
              padding: '12px 16px',
              borderTop: idx === 0 ? '1px solid var(--border)' : undefined,
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={monoLabel}>{row.label}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {row.options.map(opt => (
                  <button key={opt.key} aria-pressed={opt.active} onClick={opt.onSelect} style={{
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
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ ...monoLabel }}>
              {locale === 'fr' ? 'Mes fournées enregistrées' : 'My saved bakes'}
            </div>
          </div>

          {/* ── My Sessions cards — scrollable ── */}
          <div style={{ flex: '0 0 auto', minHeight: 0, padding: '4px 16px 12px' }}>
            {!user ? (
              <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                {locale === 'fr' ? 'Connectez-vous pour sauvegarder vos sessions' : 'Sign in to save your sessions'}
              </div>
            ) : loadingRecipes ? (
              <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>
                {locale === 'fr' ? 'Chargement...' : 'Loading...'}
              </div>
            ) : bakeEvents.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)', fontStyle: 'italic' }}>
                {locale === 'fr' ? 'Aucune fournée enregistrée' : 'No saved sessions yet'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bakeEvents.map(event => {
                  const title = bakeEventTitle(event);
                  const spec = bakeEventDoughSpec(event);
                  return (
                    <div key={event.id} style={{
                      borderRadius: '16px',
                      background: 'var(--cream)',
                      border: '1px solid var(--border)',
                      position: 'relative',
                      minHeight: '96px',
                    }}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(locale === 'fr' ? 'Supprimer cette fournée ?' : 'Delete this bake?')) return;
                          await deleteBakeEvent(event.id);
                          setBakeEvents(prev => prev.filter(ev => ev.id !== event.id));
                        }}
                        style={{
                          position: 'absolute', bottom: '8px', right: '10px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--smoke)',
                          width: '44px', height: '44px', padding: '12px', lineHeight: 1, zIndex: 1,
                        }}
                        title={locale === 'fr' ? 'Supprimer cette fournée' : 'Delete this bake'} aria-label={locale === 'fr' ? 'Supprimer cette fournée' : 'Delete this bake'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                      <div role="button" tabIndex={0} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setViewingEvent(event); setMenuOpen(false); } }}
                        onClick={() => { setViewingEvent(event); setMenuOpen(false); }}
                        style={{ padding: '12px 48px 12px 12px', cursor: 'pointer' }}
                      >
                        <div style={{
                          fontSize: '12px', fontFamily: 'var(--font-ui)',
                          fontWeight: 600, color: 'var(--char)',
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
                            color: 'var(--smoke)', marginTop: '2px',
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
                          }}>{locale === 'fr' ? 'Pâte' : 'Dough'}</span>
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
                              background: 'rgba(200, 138, 82,0.10)', color: 'var(--terra)',
                            }}>{locale === 'fr' ? 'Cuit' : 'Baked'}</span>
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
                                padding: '8px', minHeight: '44px', borderRadius: '12px',
                                background: 'var(--cream)',
                                border: '1px solid var(--border)',
                                color: 'var(--char)', cursor: 'pointer',
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
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <Link
              href={locale === 'fr' ? '/fr/about' : '/about'}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px',
                color: 'var(--smoke)', textDecoration: 'none',
                padding: '12px 0', minHeight: '44px', boxSizing: 'border-box', display: 'block',
                letterSpacing: '.04em', marginTop: '4px',
              }}
            >
              {locale === 'fr' ? 'À propos' : 'About'}
            </Link>
          </div>

          {/* ── Auth — pinned footer ── */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            ...(authSpotlight && !user ? {
              boxShadow: 'inset 0 0 0 1.5px var(--gold)',
              borderRadius: '16px',
              background: 'rgba(156, 130, 72,0.08)',
              transition: 'box-shadow .3s, background .3s',
            } : { transition: 'box-shadow .3s, background .3s' }),
          }}>
            <div style={{ ...monoLabel, marginBottom: '8px' }}>{locale === 'fr' ? 'Compte' : 'Account'}</div>
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
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--smoke)', fontSize: '11px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}>{tAuth('signOut')}</button>
              </div>
            ) : emailSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{
                  fontSize: '12px', color: 'var(--smoke)',
                  fontFamily: 'var(--font-ui)', fontStyle: 'italic',
                  textAlign: 'center', padding: '2px 0', lineHeight: 1.45,
                }}>
                  {tAuth('codeSent', { email: emailInput.trim() })}
                </div>
                <input
                  aria-label={tAuth('codePlaceholder')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  placeholder={tAuth('codePlaceholder')}
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && verifyEmailCode()}
                  style={{
                    width: '100%', padding: '8px', minHeight: '44px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--cream)', color: 'var(--char)',
                    fontSize: '16px', fontFamily: 'var(--font-ui)', outline: 'none',
                    textAlign: 'center', letterSpacing: '0.3em',
                    fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={verifyEmailCode}
                  disabled={authBusy || codeInput.length !== 6}
                  style={{
                    width: '100%', padding: '8px', minHeight: '44px', borderRadius: '8px',
                    background: 'var(--terra)', border: 'none',
                    color: '#fff', fontSize: '13px',
                    cursor: authBusy || codeInput.length !== 6 ? 'default' : 'pointer',
                    opacity: authBusy || codeInput.length !== 6 ? 0.45 : 1,
                    fontFamily: 'var(--font-ui)', fontWeight: 500,
                    transition: 'opacity .2s',
                  }}
                >{tAuth('verify')}</button>
                {authNote && (
                  <div style={{
                    fontSize: '11px', color: 'var(--smoke)',
                    fontFamily: 'var(--font-ui)', fontStyle: 'italic',
                    textAlign: 'center', lineHeight: 1.45,
                  }}>{tAuth(authNote)}</div>
                )}
                <button onClick={useAnotherEmail} style={{
                  width: '100%', padding: '4px', minHeight: '44px', borderRadius: '12px',
                  border: 'none', background: 'transparent',
                  color: 'var(--smoke)', fontSize: '12px',
                  cursor: 'pointer', fontFamily: 'var(--font-ui)', textAlign: 'center',
                }}>{tAuth('useAnotherEmail')}</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={signInWithGoogle} style={{
                  width: '100%', padding: '8px', minHeight: '44px', borderRadius: '12px',
                  border: '1.5px solid var(--border)',
                  background: 'var(--cream)', color: 'var(--char)',
                  fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  fontWeight: 500, textAlign: 'center',
                }}>{tAuth('google')}</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--cream)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--smoke)', fontFamily: 'var(--font-ui)' }}>{tAuth('or')}</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--cream)' }} />
                </div>
                {showEmailForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="email" aria-label={tAuth('emailPlaceholder')} placeholder={tAuth('emailPlaceholder')}
                        value={emailInput} onChange={e => setEmailInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                        style={{
                          flex: 1, padding: '8px 8px', minHeight: '44px', borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--cream)', color: 'var(--char)',
                          fontSize: '16px', fontFamily: 'var(--font-ui)', outline: 'none',
                          boxSizing: 'border-box', minWidth: 0,
                        }}
                      />
                      <button onClick={signInWithEmail} disabled={authBusy} style={{
                        padding: '8px 12px', minHeight: '44px', borderRadius: '8px', flexShrink: 0,
                        background: 'var(--terra)', border: 'none',
                        color: '#fff', fontSize: '12px',
                        cursor: authBusy ? 'default' : 'pointer',
                        opacity: authBusy ? 0.45 : 1,
                        fontFamily: 'var(--font-ui)', fontWeight: 500,
                        transition: 'opacity .2s',
                      }}>{tAuth('sendCode')}</button>
                      </div>
                    {authNote && (
                      <div style={{
                        fontSize: '11px', color: 'var(--smoke)',
                        fontFamily: 'var(--font-ui)', fontStyle: 'italic',
                        textAlign: 'center', lineHeight: 1.45,
                      }}>{tAuth(authNote)}</div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowEmailForm(true)} style={{
                    width: '100%', padding: '8px', minHeight: '44px', borderRadius: '12px',
                    border: '1.5px solid var(--border)',
                    background: 'transparent', color: 'var(--smoke)',
                    fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                    textAlign: 'center',
                  }}>{tAuth('emailEntry')}</button>
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
