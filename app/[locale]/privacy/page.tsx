import type { Metadata } from 'next';
import PrivacyClient from './PrivacyClient';
import { pageMetadata } from '../../lib/siteMeta';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/privacy');
}

export default function PrivacyPage() {
  return <PrivacyClient />;
}
