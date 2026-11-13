import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SITE_URL, pageMetadata } from '../lib/siteMeta';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';

// Figtree for interface text is declared in globals.css from /fonts/figtree-latin.woff2 and
// preloaded in the head below: next/font announced it only in the streamed page data, so the
// first paint used the fallback and swapped a second later (13 Nov 2026). Page titles use the
// explicit --font-display serif stack in globals.css.

// Kept for one job only: the yeast formula panel, where monospacing carries
// meaning. Everywhere else, tabular figures on the UI face do the aligning.
const dmMono = localFont({ src: [{path: "../fonts/dm-mono-400-latin.woff2", weight: "400"}, {path: "../fonts/dm-mono-500-latin.woff2", weight: "500"}], display: "swap", preload: false, variable: "--font-dm-mono" });

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Titles, descriptions, canonical URLs and the share card are localized in
// app/lib/siteMeta.ts. This is the home page's metadata; About, Privacy and
// Terms override it with their own.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(SITE_URL),
    ...pageMetadata(locale, ''),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Baker Hub',
    },
    icons: {
      icon: [{ url: '/logos/bakerhub-b-incised.svg', type: 'image/svg+xml' }, { url: '/logos/bakerhub-b-32.png', sizes: '32x32', type: 'image/png' }],
      apple: [{ url: '/logos/bakerhub-b-180.png', sizes: '180x180', type: 'image/png' }],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const messages = await getMessages();
  return (
    <html lang={locale} data-preview={process.env.VERCEL_ENV === 'preview' ? 'true' : undefined}>
      <head>
        <link rel="preload" href="/fonts/figtree-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className={`${dmMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
