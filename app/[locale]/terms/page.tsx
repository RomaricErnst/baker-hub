import type { Metadata } from 'next';
import TermsClient from './TermsClient';
import { pageMetadata } from '../../lib/siteMeta';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/terms');
}

export default function TermsPage() {
  return <TermsClient />;
}
