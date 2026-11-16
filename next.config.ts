import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./app/i18n/request.ts');

// Optimised photos were served with max-age=0, so the browser re-checked every one before
// showing it and the style page drew empty frames even after the home page had loaded them
// (16 Nov 2026). Photo files are versioned by name (-v2, -v3), so a month is safe.
const nextConfig: NextConfig = {
  images: { minimumCacheTTL: 2678400 },
};

export default withNextIntl(nextConfig);

