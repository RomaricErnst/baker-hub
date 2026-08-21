import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Playfair_Display, Fraunces } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmMono = DM_Mono({ weight: ["300","400","500"], subsets: ["latin"], variable: "--font-dm-mono" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });
// Wordmark only. Fraunces carries SOFT and WONK axes: SOFT rounds the
// terminals, WONK lets the shapes lean slightly off-square. Playfair's thin
// strokes were dissolving at 15px on the dark header, which is where the
// wordmark is seen most often.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
});

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
      <body className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} ${fraunces.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
