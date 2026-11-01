import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    authInterrupts: true,
  },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
