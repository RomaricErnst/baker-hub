import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NOT_FOUND_COPY, asSiteLocale } from '../../lib/siteMeta';

// An unknown address must not carry the home page's canonical URL or share
// card: give it its own localized title and nothing to index.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = NOT_FOUND_COPY[asSiteLocale(locale)].metaTitle;
  return {
    title,
    alternates: {},
    robots: { index: false, follow: false },
    openGraph: { type: 'website', siteName: 'Baker Hub', title },
    twitter: { card: 'summary', title },
  };
}

// Catch-all for unknown paths under a valid locale (/en/xyz, /fr/xyz).
// Without this, unmatched routes bypass app/[locale]/not-found.tsx and fall
// through to Next's default 404. This triggers the branded page instead.
export default function CatchAllNotFound() {
  notFound();
}
