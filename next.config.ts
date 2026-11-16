import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./app/i18n/request.ts');

// Optimised photos were served with max-age=0, so the browser re-checked every one before
// showing it and the style page drew empty frames even after the home page had loaded them
// (16 Nov 2026). Photo files are versioned by name (-v2, -v3), so a month is safe.
// On Vercel the optimised image takes its browser cache header from the source file, and
// public/ files are served with max-age=0: the source photos need the long cache themselves.
const nextConfig: NextConfig = {
  images: { minimumCacheTTL: 2678400 },
  async headers() {
    return [
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2678400, stale-while-revalidate=86400' }] },
      { source: '/pizzas/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2678400, stale-while-revalidate=86400' }] },
    ];
  },
};

export default withNextIntl(nextConfig);

