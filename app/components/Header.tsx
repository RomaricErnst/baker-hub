'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import { createClient } from '@/app/lib/supabase/client';
import { fetchRecipes, recipeSubtitle, type SavedRecipe } from '@/app/lib/supabase/fetchRecipes';
import { updateRecipe } from '@/app/lib/supabase/saveRecipe';
import type { User } from '@supabase/supabase-js';
import { type UnitSystem } from '../utils/units';

function RecipeCard({ r, onUpdate, onLoad }: {
  r: SavedRecipe;
  onUpdate: (id: string, field: 'recipe_name' | 'notes', value: string) => void;
  onLoad?: (r: SavedRecipe) => void;
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Subtitle + Load button */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '8px', gap: '8px',
      }}>
        <div style={{
          fontSize: '.68rem', color: 'rgba(255,255,255,0.45)',
          fontFamily: 'var(--font-dm-mono)', flex: 1,
        }}>{recipeSubtitle(r)}</div>
        <button
          onClick={() => onLoad?.(r)}
          style={{
            flexShrink: 0, padding: '.2rem .55rem',
            borderRadius: '6px', border: '1px solid rgba(196,82,42,0.5)',
            background: 'rgba(196,82,42,0.15)', color: '#E8785A',
            fontSize: '.65rem', fontFamily: 'var(--font-dm-mono)',
            fontWeight: 600, cursor: 'pointer', letterSpacing: '.04em',
          }}>
          Load
        </button>
      </div>

      {/* Name field */}
      <input
        type="text"
        defaultValue={r.recipe_name ?? ''}
        placeholder="Add a name…"
        onBlur={e => onUpdate(r.id, 'recipe_name', e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '6px', padding: '5px 8px',
          color: 'var(--cream)', fontSize: '.78rem',
          fontFamily: 'var(--font-dm-sans)', fontWeight: 500,
          outline: 'none', marginBottom: '6px',
        }}
      />

      {/* Notes field */}
      <textarea
        defaultValue={r.notes ?? ''}
        placeholder="Add notes…"
        rows={2}
        onBlur={e => onUpdate(r.id, 'notes', e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '6px', padding: '5px 8px',
          color: 'var(--cream)', fontSize: '.75rem',
          fontFamily: 'var(--font-dm-sans)',
          outline: 'none', resize: 'vertical',
          lineHeight: 1.5,
        }}
      />
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

            {/* Language */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: '.68rem', color: 'var(--smoke)',
                fontFamily: 'var(--font-dm-mono)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>Language</span>
              <div style={{ display: 'flex', gap: '.25rem' }}>
                {(['en', 'fr'] as const).map(l => (
                  <button key={l}
                    onClick={() => { router.replace(pathname, { locale: l }); setMenuOpen(false); }}
                    style={{
                      background: locale === l ? 'var(--terra)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem', fontWeight: 600,
                      color: locale === l ? '#fff' : 'var(--smoke)',
                      padding: '.2rem .45rem', borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Units */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{
                fontSize: '.68rem', color: 'var(--smoke)',
                fontFamily: 'var(--font-dm-mono)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>Units</span>
              <div style={{ display: 'flex', gap: '.25rem' }}>
                {(['metric', 'imperial'] as const).map(u => (
                  <button key={u}
                    onClick={() => onUnitsChange?.(u)}
                    style={{
                      background: units === u ? 'var(--terra)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-dm-mono)', fontSize: '.75rem',
                      fontWeight: 600,
                      color: units === u ? '#fff' : 'var(--smoke)',
                      padding: '.2rem .55rem', borderRadius: '4px',
                    }}>
                    {u === 'metric' ? 'g · °C' : 'oz · °F'}
                  </button>
                ))}
              </div>
            </div>

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
