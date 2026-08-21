import Link from 'next/link';

// Branded 404. Kept server-rendered and copy-simple so it works in any locale
// without pulling the full i18n message tree.
export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--cream, #F0EBE0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '40px', marginBottom: '0.75rem' }}>🔍</div>
        <h1 style={{
          fontFamily: 'var(--font-playfair, Georgia), serif',
          fontSize: '24px', fontWeight: 700, color: 'var(--char, #2B2420)',
          margin: '0 0 0.5rem',
        }}>
          This page is out of the oven
        </h1>
        <p style={{
          fontFamily: 'var(--font-dm-sans, system-ui), sans-serif',
          fontSize: '15px', color: 'var(--smoke, #8A7F78)', lineHeight: 1.6,
          margin: '0 0 1.5rem',
        }}>
          We couldn&rsquo;t find what you were looking for.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.8rem 1.5rem', borderRadius: '12px',
            background: 'var(--terra, #6B4423)', color: '#fff',
            fontFamily: 'var(--font-dm-sans, system-ui), sans-serif',
            fontSize: '15px', fontWeight: 600, textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(107, 68, 35,0.25)',
          }}
        >
          Back to Baker Hub
        </Link>
      </div>
    </div>
  );
}
