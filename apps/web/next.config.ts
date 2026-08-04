import type { NextConfig } from 'next';

const configuredDevOrigins = (process.env.ORBITA_WEB_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  transpilePackages: ['@orbita/design-tokens'],
  // Keep the local server reachable from a phone while allowing only the
  // explicitly configured development origins to load Next's client assets.
  allowedDevOrigins: ['127.0.0.1', ...configuredDevOrigins],
};

export default nextConfig;
