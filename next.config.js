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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
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
