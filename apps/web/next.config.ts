import type { NextConfig } from 'next';

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
};

export default nextConfig;
