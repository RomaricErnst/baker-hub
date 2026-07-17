import Link from 'next/link';

// Root-level branded 404. Reached when the [locale] layout rejects an invalid
// locale segment (e.g. /does-not-exist) via notFound(). The root layout renders
// no <html>/<body>, so this page must provide its own document shell.
// Colors are hardcoded fallbacks because globals.css is imported by the locale
// layout, which never renders for these paths.
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{
          minHeight: '100vh', background: '#F5F0E8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center',
        }}>
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.5rem', fontWeight: 700, color: '#1A1612',
              margin: '0 0 0.5rem',
            }}>
              This page is out of the oven
            </h1>
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '0.95rem', color: '#8A7F78', lineHeight: 1.6,
              margin: '0 0 1.5rem',
            }}>
              We couldn&rsquo;t find what you were looking for.
            </p>
            <Link
              href="/"
              style={{
                display: 'inline-block',
                padding: '0.8rem 1.5rem', borderRadius: '12px',
                background: '#C4522A', color: '#fff',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '0.95rem', fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(196,82,42,0.25)',
              }}
            >
              Back to Baker Hub
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
