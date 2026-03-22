'use client';
import { useLocale } from 'next-intl';
import AuthButton from './AuthButton';

export default function Header() {
  const locale = useLocale();

  function switchLocale(l: string) {
    document.cookie = `NEXT_LOCALE=${l};path=/;max-age=31536000`;
    window.location.reload();
  }

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
              onClick={() => switchLocale(l)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono)',
                fontSize: '.78rem',
                fontWeight: locale === l ? 700 : 400,
                color: locale === l ? 'var(--terra)' : 'var(--smoke)',
                padding: '.2rem .4rem',
                borderRadius: '4px',
                transition: 'color .15s',
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
