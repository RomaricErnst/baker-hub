'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '../navigation';
import AuthButton from './AuthButton';

export default function Header() {
  const t = useTranslations('header');
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
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Top row: image + name side by side, tightly spaced */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.35rem',
          lineHeight: 1,
        }}>
          <img
            src="/logo-mark.png"
            alt="Baker Hub"
            style={{
              width: '32px',
              height: '32px',
              objectFit: 'contain',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          />
          <span style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: '1.35rem',
            fontWeight: 700,
            color: 'var(--cream)',
            letterSpacing: '-.01em',
            lineHeight: 1,
          }}>
            Baker Hub
          </span>
        </div>

        {/* Tagline: centered under the full logo+name block */}
        <div style={{
          fontFamily: 'var(--font-dm-sans)',
          fontStyle: 'italic',
          fontSize: '.62rem',
          color: 'var(--gold)',
          letterSpacing: '.04em',
          marginTop: '.2rem',
          lineHeight: 1,
          textAlign: 'center',
          width: '100%',
        }}>
          {t('tagline')}
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
