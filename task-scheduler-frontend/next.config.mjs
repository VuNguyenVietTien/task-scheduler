/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  eslint: {
    // Don't run ESLint during production builds
    ignoreDuringBuilds: true
  },
  // Disable static page generation for authenticated routes
  experimental: {
    // This setting helps with dynamic route handling
    workerThreads: false,
    cpus: 1
  },
  // Configure which pages should be static vs dynamic
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
};

export default config;
