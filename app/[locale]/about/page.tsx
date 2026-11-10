import type { Metadata } from 'next';
import AboutClient from './AboutClient';
import { pageMetadata } from '../../lib/siteMeta';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, '/about');
}

export default function AboutPage() {
  return <AboutClient />;
}
