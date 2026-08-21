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
      minHeight: '100vh', background: 'var(--cream, #F0EBE0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}></div>
        <h1 style={{
          fontFamily: 'var(--font-ui), sans-serif',
          fontSize: '24px', fontWeight: 700, color: 'var(--char, #2B2420)',
          margin: '0 0 0.5rem',
        }}>
          Something didn&rsquo;t rise as planned
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui), sans-serif',
          fontSize: '15px', color: 'var(--smoke, #8A7F78)', lineHeight: 1.6,
          margin: '0 0 1.5rem',
        }}>
          An unexpected error interrupted the app. Your saved plan is safe — try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 24px', border: 'none', borderRadius: '12px',
            background: 'var(--terra, #6B4423)', color: '#fff',
            fontFamily: 'var(--font-ui), sans-serif',
            fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(107, 68, 35,0.25)',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
