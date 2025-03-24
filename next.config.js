/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tắt SSG và SSR cho các trang sử dụng Apollo và Redux
  experimental: {
    // Tắt build-time serialization
    disableSerializer: true,
    // Sử dụng app directory
    appDir: true,
    // Tránh lỗi hydration mismatch
    strictNextHead: true,
  },
  // Xử lý transpilation thư viện như @apollo/client để tránh lỗi
  transpilePackages: [
    '@apollo/client',
    '@apollo/react-hooks',
    'apollo-link-token-refresh',
    'jwt-decode',
    'sonner',
  ],
  // Vô hiệu hóa kiểm tra thời gian build cho ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Cấu hình webpack
  webpack: (config, { isServer }) => {
    // Cấu hình đặc biệt cho client-side bundle
    if (!isServer) {
      // Đảm bảo các thư viện client-side không bị bundle vào server-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    // Thêm noresolve cho thư viện sonner trong server build
    if (isServer) {
      config.module.rules.push({
        test: /node_modules\/sonner/,
        use: 'null-loader',
      });
    }

    return config;
  },
};

module.exports = nextConfig; 