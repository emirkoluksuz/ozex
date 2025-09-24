/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker deploy için standalone çıktıyı hazırla
  output: 'standalone',

  // React Strict Mode: potansiyel sorunları erken yakalar
  reactStrictMode: true,

  // Görsel optimizasyonu
  images: {
    domains: ['api.fonborsa.com'], // API’den gelen görselleri whitelist et
    formats: ['image/avif', 'image/webp'], // modern formatları destekle
  },

  // Build sırasında lint ve TS hatalarını *göstermesi* için (prod’da hataları gizleme!)
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  // Güvenlik için header’ları (ör: CSP) eklemek istersen buradan ekleyebilirsin
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
