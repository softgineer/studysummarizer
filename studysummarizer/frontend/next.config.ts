// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  images: {
    domains: ['studysummarizer-uploads.s3.amazonaws.com'],
  },
};

export default nextConfig;
