import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Supabase Storage (public content bucket + signed URLs)
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
      // Local Supabase (supabase start)
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/**" },
      // CDN d'images IGDB. Les visuels sont servis par IGDB, pas recopiés :
      // c'est ce que permettent leurs conditions, et cela évite de constituer
      // une réplique autonome de leur base.
      { protocol: "https", hostname: "images.igdb.com", pathname: "/igdb/image/upload/**" },
      // Vignettes officielles des bandes-annonces YouTube.
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
