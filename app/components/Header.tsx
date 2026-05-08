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
import { type UnitSystem } from '../utils/units';
import SessionViewer from './SessionViewer';

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
        padding: '9px 12px', borderRadius: '10px',
        background: 'rgba(196,82,42,0.15)',
        border: '1px solid rgba(196,82,42,0.4)',
      }}>
        <div style={{
          fontSize: '.72rem', color: '#E8785A',
          fontFamily: 'var(--font-dm-sans)', marginBottom: '8px',
        }}>
          Delete <strong>{name || 'this recipe'}</strong>?
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => { onDelete?.(r.id); setConfirmDelete(false); }}
            style={{
              flex: 1, padding: '.3rem', borderRadius: '6px',
              background: 'var(--terra)', border: 'none',
              color: '#fff', fontSize: '.72rem', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
            }}>Yes, delete</button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              flex: 1, padding: '.3rem', borderRadius: '6px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
            }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.2)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 12px 6px' }}>
          <div style={{
            fontSize: '.65rem', color: 'rgba(255,255,255,0.38)',
            fontFamily: 'var(--font-dm-mono)',
          }}>{sub.line1}</div>
          <div style={{
            fontSize: '.62rem', color: 'rgba(255,255,255,0.25)',
            fontFamily: 'var(--font-dm-mono)', marginTop: '1px',
          }}>{sub.line2}</div>
        </div>
        <div style={{ padding: '0 12px 10px' }}>
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
              borderRadius: '5px', padding: '5px 8px',
              color: 'var(--cream)', fontSize: '.78rem',
              fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
              outline: 'none', marginBottom: '6px',
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
              borderRadius: '5px', padding: '5px 8px',
              color: 'rgba(255,255,255,0.7)', fontSize: '.72rem',
              fontFamily: 'var(--font-dm-sans)',
              outline: 'none', resize: 'none', lineHeight: 1.5,
              marginBottom: '8px',
            }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={saveAll}
              style={{
                flex: 1, padding: '.35rem', borderRadius: '6px',
                background: 'var(--terra)', border: 'none',
                color: '#fff', fontSize: '.72rem', cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)', fontWeight: 600,
              }}>Save</button>
            <button
              onClick={() => { setEditing(false); setName(r.recipe_name ?? ''); setNotes(r.notes ?? ''); }}
              style={{
                flex: 1, padding: '.35rem', borderRadius: '6px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', fontSize: '.72rem', cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
              }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setEditing(true)}
        style={{ padding: '9px 12px 8px', cursor: 'pointer' }}
      >
        <div style={{
          fontSize: '.65rem', color: 'rgba(255,255,255,0.38)',
          fontFamily: 'var(--font-dm-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub.line1}</div>
        <div style={{
          fontSize: '.62rem', color: 'rgba(255,255,255,0.25)',
          fontFamily: 'var(--font-dm-mono)', marginTop: '1px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub.line2}</div>
        <div style={{
          marginTop: '5px',
          fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)',
          fontWeight: name ? 600 : 400,
          color: name ? 'var(--cream)' : 'rgba(255,255,255,0.22)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name || 'Untitled recipe'}</div>
        {notes && (
          <div style={{
            marginTop: '3px',
            fontSize: '.72rem', color: 'rgba(255,255,255,0.42)',
            fontFamily: 'var(--font-dm-sans)', lineHeight: 1.45,
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
            flex: 1, padding: '.32rem 0', background: 'none', border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: '.68rem',
            fontFamily: 'var(--font-dm-sans)', cursor: 'pointer',
          }}>Edit</button>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            flex: 1, padding: '.32rem 0', background: 'none', border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: '.68rem',
            fontFamily: 'var(--font-dm-sans)', cursor: 'pointer',
          }}>Delete</button>
        <button
          onClick={() => onLoad?.(r)}
          style={{
            flex: 1, padding: '.32rem 0', background: 'none', border: 'none',
            color: '#E8785A', fontSize: '.68rem',
            fontFamily: 'var(--font-dm-sans)', fontWeight: 600, cursor: 'pointer',
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
  sessionSummary,
  sessionDoughSpec,
  onSaveSession,
  onNewSession,
  onLoadBakeEvent,
  onResumeBakeEvent,
}: {
  units?: UnitSystem;
  onUnitsChange?: (u: UnitSystem) => void;
  onLoadRecipe?: (r: SavedRecipe) => void;
  recipeGenerated?: boolean;
  sessionSaved?: boolean;
  sessionRestored?: boolean;
  hideActionBar?: boolean;
  sessionSummary?: string;
  sessionDoughSpec?: string;
  onSaveSession?: () => void;
  onNewSession?: () => void;
  onLoadBakeEvent?: (event: BakeEvent) => void;
  onResumeBakeEvent?: (event: BakeEvent) => void;
}) {
  const t = useTranslations('header');
  const tS = useTranslations('session');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [bakeEvents, setBakeEvents] = useState<BakeEvent[]>([]);
  const [eventPhotos, setEventPhotos] = useState<Record<string, BakePhoto[]>>({});
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewingEvent, setViewingEvent] = useState<BakeEvent | null>(null);
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
    fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
    textTransform: 'uppercase', letterSpacing: '.06em',
  };

  return (
    <>
    <header style={{
      background: 'var(--char)', color: 'var(--cream)',
      padding: '0 1.5rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '60px',
      position: 'sticky', top: 0, zIndex: 100,
      borderBottom: '2px solid var(--terra)',
    }}>
      {/* Left: menu button + logo + tagline */}
      <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Menu"
          style={{
            background: menuOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
            border: '1.5px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', cursor: 'pointer',
            padding: '7px 10px', display: 'flex', flexDirection: 'column',
            gap: '4px', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {[0,1,2].map(i => (
            <span key={i} style={{
              display: 'block', width: '18px', height: '2px',
              background: 'var(--cream)', borderRadius: '1px',
            }} />
          ))}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo-mark.webp" width={36} height={36}
            style={{ objectFit: 'contain' }} alt="Baker Hub" />
          <div style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: '16px', fontWeight: 700,
            color: 'var(--cream)', lineHeight: 1,
          }}>Baker Hub</div>
        </div>
      </div>

      {/* Right: two-part Save / New bake button */}
      {(recipeGenerated || sessionSaved || sessionRestored) && !hideActionBar ? (
        <div style={{
          display: 'flex',
          border: sessionSaved
            ? '1px solid rgba(107,122,90,0.4)'
            : '1px solid rgba(196,82,42,0.4)',
          borderRadius: '20px',
          overflow: 'hidden',
          background: sessionSaved
            ? 'rgba(107,122,90,0.08)'
            : 'rgba(196,82,42,0.08)',
          flexShrink: 0,
        }}>
          {/* Save side */}
          <button
            onClick={() => onSaveSession?.()}
            style={{
              background: 'none', border: 'none',
              padding: '4px 10px',
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '11px',
              color: sessionSaved ? 'var(--sage)' : 'var(--terra)',
              cursor: sessionSaved ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {sessionSaved ? tS('saved') : tS('saveSession')}
          </button>

          {/* Divider */}
          <div style={{
            width: '1px',
            background: sessionSaved
              ? 'rgba(107,122,90,0.3)'
              : 'rgba(196,82,42,0.3)',
            margin: '6px 0',
          }} />

          {/* New bake side */}
          <button
            onClick={() => {
              if (window.confirm(tS('newSessionConfirm'))) onNewSession?.();
            }}
            style={{
              background: 'none', border: 'none',
              padding: '4px 10px',
              fontFamily: 'var(--font-dm-mono)',
              fontSize: '11px',
              color: 'var(--smoke)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {locale === 'fr' ? 'Nouveau' : 'New bake'}
          </button>
        </div>
      ) : (
        <div style={{ width: '42px', flexShrink: 0 }} />
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
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '300px',
          background: '#1A1612', borderRight: '1px solid rgba(255,255,255,0.12)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <img src="/logo-mark.webp" alt="" style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }}/>
              <span style={{ fontFamily: 'var(--font-playfair)', fontSize: '1rem', fontWeight: 700, color: 'var(--cream)' }}>
                Baker Hub
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--smoke)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            >x</button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 80px)' }}>

            {/* ── Section 1: Current session ── */}
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
                  borderRadius: '10px',
                  padding: '10px 12px',
                }}>
                  {sessionSummary && (
                    <div style={{
                      fontSize: '.75rem', fontFamily: 'var(--font-dm-sans)',
                      fontWeight: 600, color: 'var(--cream)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{sessionSummary}</div>
                  )}
                  {sessionDoughSpec && (
                    <div style={{
                      fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
                      color: 'var(--smoke)', marginTop: '2px',
                    }}>{sessionDoughSpec}</div>
                  )}
                </div>

                {/* Action row */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                  {sessionSaved ? (
                    <span style={{
                      fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)',
                      color: 'var(--sage)', cursor: 'default',
                    }}>
                      {locale === 'fr' ? 'Session enregistree' : 'Session saved'}
                    </span>
                  ) : (
                    <button
                      onClick={() => { onSaveSession?.(); setMenuOpen(false); }}
                      style={{
                        fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)',
                        color: 'var(--terra)',
                        border: '1px solid rgba(196,82,42,0.4)',
                        borderRadius: '6px',
                        background: 'rgba(196,82,42,0.1)',
                        padding: '3px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      {locale === 'fr' ? 'Enregistrer' : 'Save session'}
                    </button>
                  )}
                  <button
                    onClick={() => { onNewSession?.(); setMenuOpen(false); }}
                    style={{
                      fontSize: '.68rem', fontFamily: 'var(--font-dm-mono)',
                      color: 'var(--smoke)',
                      background: 'none', border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {locale === 'fr' ? 'Nouvelle session' : 'New session'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Section 2: My sessions ── */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ ...monoLabel, marginBottom: '10px' }}>
                {locale === 'fr' ? 'Mes sessions' : 'My sessions'}
              </div>
              {!user ? (
                <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic' }}>
                  {locale === 'fr' ? 'Connectez-vous pour sauvegarder vos sessions' : 'Sign in to save your sessions'}
                </div>
              ) : loadingRecipes ? (
                <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-sans)' }}>
                  {locale === 'fr' ? 'Chargement...' : 'Loading...'}
                </div>
              ) : bakeEvents.length === 0 ? (
                <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic' }}>
                  {locale === 'fr' ? 'Aucune session sauvegardee' : 'No saved sessions yet'}
                </div>
              ) : (
                <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bakeEvents.map(event => {
                    const title = bakeEventTitle(event);
                    const spec = bakeEventDoughSpec(event);
                    return (
                      <div key={event.id} style={{
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: '72px',
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
                          style={{ padding: '12px 12px 10px', cursor: 'pointer' }}
                        >
                          <div style={{
                            fontSize: '.75rem', fontFamily: 'var(--font-dm-sans)',
                            fontWeight: 600, color: 'var(--cream)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{title}</div>
                          {spec && (
                            <div style={{
                              fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
                              color: 'var(--smoke)', marginTop: '2px',
                            }}>{spec}</div>
                          )}
                          {(eventSlots[event.id] ?? []).length > 0 && (
                            <div style={{
                              fontSize: '.62rem', fontFamily: 'var(--font-dm-mono)',
                              color: 'rgba(255,255,255,0.4)', marginTop: '2px',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {(eventSlots[event.id] ?? []).map(s => s.preset_id).join(' · ')}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                              padding: '2px 8px', borderRadius: '20px',
                              background: 'rgba(107,122,90,0.15)', color: 'var(--sage)',
                            }}>Dough</span>
                            {event.pizza_party_id && (
                              <span style={{
                                fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                                padding: '2px 8px', borderRadius: '20px',
                                background: 'rgba(212,168,83,0.15)', color: 'var(--gold)',
                              }}>Pizza</span>
                            )}
                            {event.status === 'baked' && (
                              <span style={{
                                fontFamily: 'var(--font-dm-mono)', fontSize: '10px',
                                padding: '2px 8px', borderRadius: '20px',
                                background: 'rgba(196,82,42,0.15)', color: 'var(--terra)',
                              }}>Baked</span>
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
                                  borderRadius: '6px', overflow: 'hidden',
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
                                      fontFamily: 'var(--font-dm-mono)', fontSize: '9px', color: 'white',
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

          </div>{/* end scrollable body */}

          {/* ── Pinned bottom: Language · Units + Auth ── */}
          <div style={{ flexShrink: 0 }}>

            {/* ── Section 3: Language · Units ── */}
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
                padding: '10px 16px',
                borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={monoLabel}>{row.label}</span>
                <div style={{ display: 'flex', gap: '.25rem' }}>
                  {row.options.map(opt => (
                    <button key={opt.key} onClick={opt.onSelect} style={{
                      minWidth: '48px', padding: '.22rem .4rem', borderRadius: '5px',
                      border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-mono)',
                      fontSize: '.75rem', fontWeight: 600, textAlign: 'center',
                      background: opt.active ? 'var(--terra)' : 'transparent',
                      color: opt.active ? '#fff' : 'var(--smoke)',
                    }}>{opt.display}</button>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Section 4: Auth ── */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                <span style={{
                  fontSize: '.7rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>{user.email}</span>
                <button onClick={signOut} style={{
                  padding: '.3rem .65rem', borderRadius: '7px', flexShrink: 0,
                  border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent',
                  color: 'var(--smoke)', fontSize: '.7rem', cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                }}>Sign out</button>
              </div>
            ) : emailSent ? (
              <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', textAlign: 'center', padding: '.25rem 0' }}>
                Check your inbox — link sent
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={signInWithGoogle} style={{
                  width: '100%', padding: '.5rem', borderRadius: '8px',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--cream)',
                  fontSize: '.8rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                  fontWeight: 500, textAlign: 'center',
                }}>Sign in with Google</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: '.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-mono)' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                </div>
                {showEmailForm ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="email" placeholder="your@email.com"
                      value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                      style={{
                        flex: 1, padding: '.45rem .6rem', borderRadius: '7px',
                        border: '1px solid rgba(255,255,255,0.18)',
                        background: 'rgba(255,255,255,0.08)', color: 'var(--cream)',
                        fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)', outline: 'none',
                      }}
                    />
                    <button onClick={signInWithEmail} style={{
                      padding: '.45rem .7rem', borderRadius: '7px', flexShrink: 0,
                      background: 'var(--terra)', border: 'none',
                      color: '#fff', fontSize: '.78rem', cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans)', fontWeight: 500,
                    }}>Send</button>
                  </div>
                ) : (
                  <button onClick={() => setShowEmailForm(true)} style={{
                    width: '100%', padding: '.5rem', borderRadius: '8px',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    background: 'transparent', color: 'rgba(255,255,255,0.55)',
                    fontSize: '.8rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                    textAlign: 'center',
                  }}>Sign in with email</button>
                )}
              </div>
            )}
          </div>

          </div>{/* end pinned bottom */}

        </div>
      </>,
      document.body
    )}

    <SessionViewer
      event={viewingEvent}
      onClose={() => setViewingEvent(null)}
      onResume={(ev) => { onResumeBakeEvent?.(ev); setViewingEvent(null); }}
      onDelete={(id) => { setBakeEvents(prev => prev.filter(e => e.id !== id)); setViewingEvent(null); }}
      onRename={(id, name) => {
        setBakeEvents(prev => prev.map(e => e.id === id ? { ...e, notes: name } : e));
      }}
      slots={eventSlots[viewingEvent?.id ?? ''] ?? []}
    />
    </>
  );
}
