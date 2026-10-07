import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@unity/ui', '@unity/types'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
