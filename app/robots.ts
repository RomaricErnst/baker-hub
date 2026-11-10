import type { MetadataRoute } from 'next';
import { SITE_URL } from './lib/siteMeta';

// Sign-in callbacks, server routes and private shared lists are not content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/', '/list/', '/fr/list/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
