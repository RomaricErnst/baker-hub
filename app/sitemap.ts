import type { MetadataRoute } from 'next';
import { SITE_LOCALES, SITE_PAGES, absoluteUrl, languageAlternates, localizedPath } from './lib/siteMeta';

// Home, About, Privacy and Terms in both languages, each pointing at its twin.
export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_PAGES.flatMap((page) =>
    SITE_LOCALES.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, page)),
      changeFrequency: page === '' ? ('weekly' as const) : ('monthly' as const),
      priority: page === '' ? 1 : 0.5,
      alternates: { languages: languageAlternates(page) },
    })),
  );
}
