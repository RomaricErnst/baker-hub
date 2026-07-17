import { notFound } from 'next/navigation';

// Catch-all for unknown paths under a valid locale (/en/xyz, /fr/xyz).
// Without this, unmatched routes bypass app/[locale]/not-found.tsx and fall
// through to Next's default 404. This triggers the branded page instead.
export default function CatchAllNotFound() {
  notFound();
}
