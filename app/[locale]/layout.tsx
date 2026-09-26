import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

// One family for everything readable — logo, titles, body, labels. Figtree is
// built for interface text: generous x-height and well-differentiated letters
// at 11px, which is where most of this app lives.
const figtree = localFont({ src: "../fonts/figtree-latin.woff2", weight: "300 900", display: "swap", variable: "--font-ui" });

// Kept for one job only: the yeast formula panel, where monospacing carries
// meaning. Everywhere else, tabular figures on the UI face do the aligning.
const dmMono = localFont({ src: [{path: "../fonts/dm-mono-400-latin.woff2", weight: "400"}, {path: "../fonts/dm-mono-500-latin.woff2", weight: "500"}], display: "swap", variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "Baker Hub",
  description: "Smart dough planner for pizza and bread",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Baker Hub',
  },
  icons: {
    icon: [{ url: '/logos/bakerhub-b-incised.svg', type: 'image/svg+xml' }, { url: '/logos/bakerhub-b-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/logos/bakerhub-b-180.png', sizes: '180x180', type: 'image/png' }],
  },
};

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
      <body className={`${figtree.variable} ${dmMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
