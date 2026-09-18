const nextConfig = {
  skipTrailingSlashRedirect: true,
  // TikTok requires the registered redirect/callback URL to END WITH "/" (no query, no port).
  // These rewrites serve the trailing-slash form directly instead of 308-redirecting to the
  // bare path, so the OAuth callback and the webhook are handled on the exact registered URL.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/tiktok/callback/", destination: "/api/tiktok/callback" },
        { source: "/api/tiktok/webhook/", destination: "/api/tiktok/webhook" },
        { source: "/api/tiktok/ads/callback/", destination: "/api/tiktok/ads/callback" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.imgur.com",
      },
      {
        protocol: "https",
        hostname: "grazynglhjuuxesgusgd.supabase.co",
      },
    ],
  },
};

export default nextConfig;
