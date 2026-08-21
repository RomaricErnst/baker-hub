import type { Metadata } from "next";
import { DM_Mono, Figtree } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

// One family for everything readable — logo, titles, body, labels. Figtree is
// built for interface text: generous x-height and well-differentiated letters
// at 11px, which is where most of this app lives.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-ui" });

// Kept for one job only: the yeast formula panel, where monospacing carries
// meaning. Everywhere else, tabular figures on the UI face do the aligning.
const dmMono = DM_Mono({ weight: ["400","500"], subsets: ["latin"], variable: "--font-dm-mono" });

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
    icon: '/logos/logo_icon_1024.png',
    apple: '/logos/logo_icon_1024.png',
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
    <html lang={locale}>
      <body className={`${figtree.variable} ${dmMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
