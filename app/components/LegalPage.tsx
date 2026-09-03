'use client';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Header from './Header';

// Tokens mirror AboutClient — the legal pages are the same reading surface.
const CHAR = '#2B2420';
const ASH = '#3D3530';
const SMOKE = '#8A7F78';
const TERRA = '#6B4423';
const BORDER = '#E8E0D5';

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalContent = {
  pageTitle: string;
  pageSubtitle: string;
  sections: LegalSection[];
  footer: string;
};

export default function LegalPage({
  content,
}: {
  content: Record<string, LegalContent>;
}) {
  const locale = useLocale();
  const c = content[locale] ?? content.en;
  const home = locale === 'fr' ? '/fr' : '/';

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: '48px' }}>
      <Header hideActionBar backHref={home} />
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px' }}>

        <h1 style={{
          fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 700,
          color: CHAR, marginBottom: '4px', marginTop: 0,
        }}>{c.pageTitle}</h1>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', color: SMOKE,
          letterSpacing: '.04em', marginBottom: '24px',
        }}>{c.pageSubtitle}</p>

        {/* Every section is visible. Nothing here collapses: a policy behind a
            disclosure is a policy nobody read, and reviewers see an empty page. */}
        {c.sections.map((s, i) => (
          <section key={i} style={{ marginBottom: '28px' }}>
            <h2 style={{
              fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
              color: CHAR, margin: '0 0 8px',
            }}>{s.title}</h2>
            {s.paragraphs?.map((p, j) => (
              <p key={j} style={{
                fontFamily: 'var(--font-ui)', fontSize: '14px', color: ASH,
                lineHeight: 1.65, margin: '0 0 10px',
              }}>{p}</p>
            ))}
            {s.bullets && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {s.bullets.map((b, j) => (
                  <li key={j} style={{
                    borderLeft: `2px solid ${BORDER}`, paddingLeft: '12px',
                    marginBottom: '8px', fontFamily: 'var(--font-ui)',
                    fontSize: '13px', color: ASH, lineHeight: 1.55,
                  }}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <Link
          href={home}
          style={{
            marginTop: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '12px 0', minHeight: '44px', borderRadius: '16px',
            background: TERRA, color: '#fff',
            fontSize: '13px', fontWeight: 500,
            fontFamily: 'var(--font-ui)', textDecoration: 'none',
          }}
        >
          ← {locale === 'fr' ? 'Retour à Baker Hub' : 'Back to Baker Hub'}
        </Link>

        <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '24px' }} />
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', color: SMOKE,
          letterSpacing: '.04em', textAlign: 'center', marginTop: '24px', marginBottom: 0,
        }}>{c.footer}</p>

      </div>
    </div>
  );
}
