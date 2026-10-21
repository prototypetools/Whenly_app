/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Prisma & bcryptjs harus dijalankan di Node runtime, bukan di bundel client.
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
};

export default nextConfig;
