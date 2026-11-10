import type { Metadata } from 'next';

// One place for everything a crawler or a link preview reads: host, localized
// titles and descriptions, canonical URLs and hreflang pairs. The locale
// layout, the About / Privacy / Terms pages, robots.ts and sitemap.ts all read
// from here so the four cannot drift apart.

export const SITE_URL = 'https://www.bakerhub.app';
export const SITE_LOCALES = ['en', 'fr'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

// Indexable pages, as paths without the locale prefix ('' is the home page).
export const SITE_PAGES = ['', '/about', '/privacy', '/terms'] as const;
export type SitePage = (typeof SITE_PAGES)[number];

type PageCopy = { title: string; description: string };

export const SITE_META: Record<SiteLocale, Record<SitePage, PageCopy>> = {
  en: {
    '': {
      title: 'Baker Hub — pizza and bread dough planned around your day',
      description:
        'Tell Baker Hub when you want to eat and when you are busy. It tells you when to start ' +
        'your pizza or bread dough, with the recipe and every step at its time.',
    },
    '/about': {
      title: 'About Baker Hub — how the dough planner works',
      description:
        'How Baker Hub plans a dough around your day: the yeast and fermentation estimates, ' +
        'kitchen temperature, flour, preferments, sourdough starter and the schedule.',
    },
    '/privacy': {
      title: 'Privacy Policy — Baker Hub',
      description:
        'What Baker Hub collects, who processes it, and how to have it deleted. ' +
        'No analytics, no advertising, no tracking.',
    },
    '/terms': {
      title: 'Terms of Service — Baker Hub',
      description:
        'The terms for using Baker Hub: your content stays yours, schedules are ' +
        'estimates, and baking judgement remains with the baker.',
    },
  },
  fr: {
    '': {
      title: 'Baker Hub — vos pâtes à pizza et à pain, planifiées autour de votre journée',
      description:
        'Dites à Baker Hub quand vous voulez manger et quand vous n’êtes pas disponible. ' +
        'Il vous dit quand commencer votre pâte à pizza ou à pain, avec la recette et chaque étape à son heure.',
    },
    '/about': {
      title: 'À propos de Baker Hub — comment fonctionne le planificateur de pâte',
      description:
        'Comment Baker Hub planifie une pâte autour de votre journée : estimations de levure et de fermentation, ' +
        'température de la cuisine, farine, préferments, levain et planning.',
    },
    '/privacy': {
      title: 'Politique de confidentialité — Baker Hub',
      description:
        'Ce que Baker Hub collecte, qui le traite et comment le faire supprimer. ' +
        'Ni mesure d’audience, ni publicité, ni suivi.',
    },
    '/terms': {
      title: 'Conditions d’utilisation — Baker Hub',
      description:
        'Les conditions d’utilisation de Baker Hub : vos contenus restent les vôtres, les plannings sont ' +
        'des estimations, et le jugement du boulanger reste le sien.',
    },
  },
};

export function asSiteLocale(locale: string): SiteLocale {
  return locale === 'fr' ? 'fr' : 'en';
}

// English lives at the root, French under /fr (next-intl `as-needed`).
export function localizedPath(locale: SiteLocale, page: string): string {
  if (locale === 'en') return page === '' ? '/' : page;
  return `/fr${page}`;
}

export function absoluteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

export function languageAlternates(page: string): Record<string, string> {
  return {
    en: absoluteUrl(localizedPath('en', page)),
    fr: absoluteUrl(localizedPath('fr', page)),
    'x-default': absoluteUrl(localizedPath('en', page)),
  };
}

const OG_IMAGE: Record<SiteLocale, { url: string; alt: string }> = {
  en: { url: '/og-en.png', alt: 'Baker Hub — pizza and bread dough planned around your day' },
  fr: { url: '/og-fr.png', alt: 'Baker Hub — vos pâtes à pizza et à pain, planifiées autour de votre journée' },
};

// Complete metadata for one address. Next merges metadata shallowly, so a page
// that sets only a title would keep the home page's canonical URL and share
// card text; building every field here avoids that.
export function metadataFor(localeInput: string, page: string, copy: PageCopy): Metadata {
  const locale = asSiteLocale(localeInput);
  const url = absoluteUrl(localizedPath(locale, page));
  const image = { ...OG_IMAGE[locale], width: 1200, height: 630 };
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: url, languages: languageAlternates(page) },
    openGraph: {
      type: 'website',
      siteName: 'Baker Hub',
      title: copy.title,
      description: copy.description,
      url,
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      alternateLocale: locale === 'fr' ? ['en_US'] : ['fr_FR'],
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: [image.url],
    },
  };
}

export function pageMetadata(localeInput: string, page: SitePage): Metadata {
  return metadataFor(localeInput, page, SITE_META[asSiteLocale(localeInput)][page]);
}

// The 404 page, in both languages.
export const NOT_FOUND_COPY: Record<SiteLocale, { title: string; body: string; back: string; metaTitle: string }> = {
  en: {
    title: 'This page is out of the oven',
    body: 'We couldn’t find what you were looking for.',
    back: 'Back to Baker Hub',
    metaTitle: 'Page not found — Baker Hub',
  },
  fr: {
    title: 'Cette page est déjà sortie du four',
    body: 'Nous n’avons pas trouvé ce que vous cherchiez.',
    back: 'Retour à Baker Hub',
    metaTitle: 'Page introuvable — Baker Hub',
  },
};
