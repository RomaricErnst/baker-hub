import type { Metadata } from 'next';
import { asSiteLocale, metadataFor } from '../../lib/siteMeta';

// This journey has its own address, so it must not inherit the home page's
// canonical URL and share-card text from the locale layout.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return metadataFor(locale, '/with-my-base', asSiteLocale(locale) === 'fr'
    ? {
        title: 'Avec ma pâte ou mon pain — Baker Hub',
        description: 'Vous avez déjà une pâte ou du pain : Baker Hub vous aide à préparer la suite.',
      }
    : {
        title: 'With my own dough or bread — Baker Hub',
        description: 'You already have dough or bread: Baker Hub helps you plan what comes next.',
      });
}

export default function WithMyBaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
