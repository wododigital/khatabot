/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['supabase.co', 'khatabot.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        '@whiskeysockets/baileys',
        'sharp',
        'pino',
        'pino-pretty'
      );
    }
    config.module.unknownContextCritical = false;
    return config;
  },
};

module.exports = nextConfig;
