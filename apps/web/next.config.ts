import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// ---------------------------------------------------------------------------
// Content Security Policy
// Privy official CSP: https://docs.privy.io/security/implementation-guide/content-security-policy
// ---------------------------------------------------------------------------
const cspDirectives = [
  // Default: only same-origin
  "default-src 'self'",

  // Scripts: self + Privy Cloudflare challenge + Sentry
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.sentry.io",

  // Styles: self + inline (Tailwind CSS-in-JS)
  "style-src 'self' 'unsafe-inline'",

  // Images: self + Polymarket S3 + data URIs (SVG patterns, Next.js optimized)
  "img-src 'self' data: blob: https://polymarket-upload.s3.us-east-2.amazonaws.com https://*.polymarket.com",

  // Fonts: self + data URIs (Next.js local font cache)
  "font-src 'self' data:",

  // API calls, WebSockets, Sentry beacons
  [
    "connect-src 'self'",
    // Privy + WalletConnect
    'https://auth.privy.io',
    'wss://relay.walletconnect.com',
    'wss://relay.walletconnect.org',
    'wss://www.walletlink.org',
    'https://*.rpc.privy.systems',
    'https://explorer-api.walletconnect.com',
    // Polymarket APIs
    'https://gamma-api.polymarket.com',
    'https://clob.polymarket.com',
    'https://data-api.polymarket.com',
    'wss://ws-subscriptions-clob.polymarket.com',
    // On-chain RPC
    'https://polygon-rpc.com',
    'https://polygon.drpc.org',
    // Sentry
    'https://*.ingest.sentry.io',
  ].join(' '),

  // Iframes: Privy auth + WalletConnect verify + Cloudflare challenge
  "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com",
  "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",

  // Workers
  "worker-src 'self' blob:",

  // Hardening
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const contentSecurityPolicy = cspDirectives.join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@app/ui', '@app/api', '@app/trading', '@app/config'],
  // Disable typed routes for now - causing issues with dynamic routes
  // typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'polymarket-upload.s3.us-east-2.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.polymarket.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
