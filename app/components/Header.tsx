'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import { createClient } from '@/app/lib/supabase/client';
import { fetchRecipes, recipeSubtitle, type SavedRecipe } from '@/app/lib/supabase/fetchRecipes';
import { updateRecipe, deleteRecipe } from '@/app/lib/supabase/saveRecipe';
import type { User } from '@supabase/supabase-js';
import { type UnitSystem } from '../utils/units';

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

  // Confirm-delete state
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

  // Edit mode — both fields open
  if (editing) {
    return (
      <div style={{
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.2)',
        overflow: 'hidden',
      }}>
        {/* Subtitle visible at top */}
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
            placeholder="Recipe name…"
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
            placeholder="Notes…"
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

  // Read-only — two-zone layout
  return (
    <div style={{
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
    }}>
      {/* Identity zone — tap to edit */}
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

      {/* Action bar */}
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
          }}>✏ Edit</button>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            flex: 1, padding: '.32rem 0', background: 'none', border: 'none',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', fontSize: '.68rem',
            fontFamily: 'var(--font-dm-sans)', cursor: 'pointer',
          }}>🗑 Delete</button>
        <button
          onClick={() => onLoad?.(r)}
          style={{
            flex: 1, padding: '.32rem 0', background: 'none', border: 'none',
            color: '#E8785A', fontSize: '.68rem',
            fontFamily: 'var(--font-dm-sans)', fontWeight: 600, cursor: 'pointer',
          }}>Load</button>
      </div>
    </div>
  );
}

export default function Header({
  units = 'metric',
  onUnitsChange,
  onLoadRecipe,
}: {
  units?: UnitSystem;
  onUnitsChange?: (u: UnitSystem) => void;
  onLoadRecipe?: (r: SavedRecipe) => void;
}) {
  const t = useTranslations('header');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Load saved recipes when menu opens and user is logged in
  useEffect(() => {
    if (menuOpen && user) {
      setLoadingRecipes(true);
      fetchRecipes().then(data => {
        setRecipes(data);
        setLoadingRecipes(false);
      });
    }
  }, [menuOpen, user]);

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

  return (
    <header style={{
      background: 'var(--char)', color: 'var(--cream)',
      padding: '0 1.5rem', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: '60px',
      position: 'sticky', top: 0, zIndex: 100,
      borderBottom: '2px solid var(--terra)',
    }}>
      {/* Left: logo + tagline */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem', lineHeight: 1 }}>
          <img src="/logo-mark.png" alt="Baker Hub" className="header-logo"
            style={{ objectFit: 'contain', borderRadius: '6px', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-playfair)', fontSize: '1.35rem', fontWeight: 700,
            color: 'var(--cream)', letterSpacing: '-.01em', lineHeight: 1,
          }}>Baker Hub</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic', fontSize: '.62rem',
          color: 'var(--gold)', letterSpacing: '.04em', marginTop: '.2rem',
          lineHeight: 1, textAlign: 'center', width: '100%',
        }}>{t('tagline')}</div>
      </div>

      {/* Right: ☰ menu button */}
      <div ref={menuRef} style={{ position: 'relative' }}>
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

        {/* Dropdown panel */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: '300px', background: '#1A1612',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            overflow: 'hidden', zIndex: 200,
          }}>

            {/* Language + Units — unified toggle style */}
            {([
              {
                label: 'Language',
                options: [
                  { key: 'en', display: 'EN', active: locale === 'en', onSelect: () => { router.replace(pathname, { locale: 'en' }); setMenuOpen(false); } },
                  { key: 'fr', display: 'FR', active: locale === 'fr', onSelect: () => { router.replace(pathname, { locale: 'fr' }); setMenuOpen(false); } },
                ],
              },
              {
                label: 'Units',
                options: [
                  { key: 'metric',   display: 'g/°C',   active: units === 'metric',   onSelect: () => onUnitsChange?.('metric') },
                  { key: 'imperial', display: 'oz/°F',  active: units === 'imperial', onSelect: () => onUnitsChange?.('imperial') },
                ],
              },
            ] as const).map(row => (
              <div key={row.label} style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '.68rem', color: 'var(--smoke)',
                  fontFamily: 'var(--font-dm-mono)',
                  textTransform: 'uppercase', letterSpacing: '.06em',
                }}>{row.label}</span>
                <div style={{ display: 'flex', gap: '.25rem' }}>
                  {row.options.map(opt => (
                    <button key={opt.key}
                      onClick={opt.onSelect}
                      style={{
                        minWidth: '48px', padding: '.22rem .4rem',
                        borderRadius: '5px', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', fontWeight: 600,
                        textAlign: 'center',
                        background: opt.active ? 'var(--terra)' : 'transparent',
                        color: opt.active ? '#fff' : 'var(--smoke)',
                      }}>{opt.display}</button>
                  ))}
                </div>
              </div>
            ))}

            {/* Auth */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
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
                  Check your inbox — link sent ✓
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Google */}
                  <button onClick={signInWithGoogle} style={{
                    width: '100%', padding: '.5rem', borderRadius: '8px',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: 'var(--cream)',
                    fontSize: '.8rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)',
                    fontWeight: 500, textAlign: 'center',
                  }}>Sign in with Google</button>
                  {/* Email divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize: '.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-dm-mono)' }}>or</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                  {/* Email magic link */}
                  {showEmailForm ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                        style={{
                          flex: 1, padding: '.45rem .6rem', borderRadius: '7px',
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(255,255,255,0.08)', color: 'var(--cream)',
                          fontSize: '.78rem', fontFamily: 'var(--font-dm-sans)',
                          outline: 'none',
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

            {/* Saved recipes */}
            <div style={{ padding: '12px 16px' }}>
              <div style={{
                fontSize: '.68rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px',
              }}>Saved recipes</div>

              {!user ? (
                <div style={{
                  fontSize: '.78rem', color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic',
                }}>Sign in to see your saved recipes</div>
              ) : loadingRecipes ? (
                <div style={{
                  fontSize: '.78rem', color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'var(--font-dm-sans)',
                }}>Loading…</div>
              ) : recipes.length === 0 ? (
                <div style={{
                  fontSize: '.78rem', color: 'rgba(255,255,255,0.3)',
                  fontFamily: 'var(--font-dm-sans)', fontStyle: 'italic',
                }}>No saved recipes yet</div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  maxHeight: '320px', overflowY: 'auto',
                }}>
                  {recipes.map(r => (
                    <RecipeCard
                      key={r.id}
                      r={r}
                      onUpdate={handleFieldBlur}
                      onLoad={r2 => { onLoadRecipe?.(r2); setMenuOpen(false); }}
                      onDelete={handleDeleteRecipe}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
