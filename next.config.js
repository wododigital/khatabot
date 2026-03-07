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
  serverComponentsExternalPackages: [
    '@whiskeysockets/baileys',
    'sharp',
    'pino',
    'pino-pretty',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        '@whiskeysockets/baileys',
        'sharp',
        'pino',
        'pino-pretty'
      );
    }
    return config;
  },
};

module.exports = nextConfig;
