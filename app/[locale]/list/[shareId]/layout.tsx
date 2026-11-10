import type { Metadata } from 'next';

// A shared shopping list is a private link between two people: keep it out of
// search results, and do not let it inherit the home page's canonical URL or
// share-card text from the locale layout.
const title = 'Shopping List — Baker Hub';
const description = 'A shared Pizza Party shopping checklist.';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
  openGraph: { type: 'website', siteName: 'Baker Hub', title, description },
  twitter: { card: 'summary', title, description },
};

export default function SharedListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
