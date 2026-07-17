'use client';
import { useEffect } from 'react';

// Branded route-level error boundary. Catches render/runtime errors in the
// locale segment so bakers see a calm recovery screen, not a blank page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the console for Vercel logs; no PII.
    console.error('Baker Hub route error:', error?.message);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream, #F5F0E8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍞</div>
        <h1 style={{
          fontFamily: 'var(--font-playfair, Georgia), serif',
          fontSize: '1.5rem', fontWeight: 700, color: 'var(--char, #1A1612)',
          margin: '0 0 0.5rem',
        }}>
          Something didn&rsquo;t rise as planned
        </h1>
        <p style={{
          fontFamily: 'var(--font-dm-sans, system-ui), sans-serif',
          fontSize: '0.95rem', color: 'var(--smoke, #8A7F78)', lineHeight: 1.6,
          margin: '0 0 1.5rem',
        }}>
          An unexpected error interrupted the app. Your saved plan is safe — try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.8rem 1.5rem', border: 'none', borderRadius: '12px',
            background: 'var(--terra, #C4522A)', color: '#fff',
            fontFamily: 'var(--font-dm-sans, system-ui), sans-serif',
            fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(196,82,42,0.25)',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
