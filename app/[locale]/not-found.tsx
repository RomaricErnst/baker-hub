'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { NOT_FOUND_COPY } from '../lib/siteMeta';

// Branded 404, in the visitor's language. The language is read from the
// address first (/fr/…), because that is what the visitor typed or followed,
// and from the active locale otherwise. The way back goes to that language's
// home page.
export default function NotFound() {
  const pathname = usePathname() ?? '';
  const activeLocale = useLocale();
  const fr = pathname === '/fr' || pathname.startsWith('/fr/') || activeLocale === 'fr';
  const copy = NOT_FOUND_COPY[fr ? 'fr' : 'en'];
  return (
    <main lang={fr ? 'fr' : 'en'} style={{
      minHeight: '100vh', background: 'var(--cream, #F0EBE0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{
          fontFamily: 'var(--font-ui), sans-serif',
          fontSize: '24px', fontWeight: 700, color: 'var(--char, #2B2420)',
          margin: '0 0 0.5rem',
        }}>
          {copy.title}
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui), sans-serif',
          fontSize: '15px', color: 'var(--ash, #3D3530)', lineHeight: 1.6,
          margin: '0 0 1.5rem',
        }}>
          {copy.body}
        </p>
        <Link
          href={fr ? '/fr' : '/'}
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 44, boxSizing: 'border-box',
            padding: '12px 24px', borderRadius: '16px',
            background: 'var(--terra, #6B4423)', color: '#fff',
            fontFamily: 'var(--font-ui), sans-serif',
            fontSize: '15px', fontWeight: 600, textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(107, 68, 35,0.25)',
          }}
        >
          {copy.back}
        </Link>
      </div>
    </main>
  );
}
