/** @type {import('next').NextConfig} */
const config = {
  // output: 'standalone', // Removed for Vercel deployment
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
  // Cấu hình webpack để bỏ qua các cảnh báo về SWC
  webpack: (config, { isServer }) => {
    // Bỏ qua các cảnh báo từ quá trình xử lý webpack
    config.infrastructureLogging = {
      level: 'error',
    };
    
    return config;
  },
};

export default config;
