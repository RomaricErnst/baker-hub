'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) return null;

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <span style={{ fontSize: '.75rem', color: 'var(--smoke)', fontFamily: 'var(--font-dm-mono)' }}>
          {user.email}
        </span>
        <button onClick={signOut} style={{
          padding: '.3rem .7rem', borderRadius: '8px',
          border: '1.5px solid var(--border)', background: 'transparent',
          color: 'var(--smoke)', fontSize: '.72rem', cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button onClick={signInWithGoogle} style={{
      display: 'flex', alignItems: 'center', gap: '.5rem',
      padding: '.4rem .9rem', borderRadius: '10px',
      border: '1.5px solid var(--border)', background: 'var(--warm)',
      color: 'var(--char)', fontSize: '.78rem', cursor: 'pointer',
      fontFamily: 'var(--font-dm-sans)', fontWeight: 500,
    }}>
      <span>🔑</span> Sign in
    </button>
  );
}
