'use client';

// Last-resort boundary: catches errors in the root layout itself (where the
// locale error.tsx can't reach). Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{
          minHeight: '100vh', background: '#F5F0E8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍞</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1A1612', margin: '0 0 0.5rem' }}>
              Something didn&rsquo;t rise as planned
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#8A7F78', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              An unexpected error interrupted the app. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.8rem 1.5rem', border: 'none', borderRadius: '12px',
                background: '#C4522A', color: '#fff', fontSize: '0.95rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
