'use client';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import AuthButton from './AuthButton';

export default function Header() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header style={{
      background: 'var(--char)',
      color: 'var(--cream)',
      padding: '0 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: '2px solid var(--terra)'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: '1.4rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          lineHeight: 1.2,
        }}>
          🍞 Baker Hub
        </div>
        <div style={{
          fontFamily: 'var(--font-dm-sans)',
          fontStyle: 'italic',
          fontSize: '.68rem',
          color: 'var(--gold)',
          lineHeight: 1.2,
        }}>
          artisan dough planner
        </div>
      </div>

      {/* Right side: language toggle + auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <div style={{ display: 'flex', gap: '.25rem', alignItems: 'center' }}>
          {(['en', 'fr'] as const).map(l => (
            <button
              key={l}
              onClick={() => router.replace(pathname, { locale: l })}
              style={{
                background: locale === l ? 'var(--terra)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '.78rem',
                fontWeight: 600,
                color: locale === l ? '#fff' : 'var(--smoke)',
                padding: '.2rem .45rem',
                borderRadius: '4px',
                transition: 'background .15s, color .15s',
                textTransform: 'uppercase',
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <AuthButton />
      </div>
    </header>
  );
}
