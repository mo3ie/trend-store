const nextConfig = {
  skipTrailingSlashRedirect: true,
  /*
   * `sharp` is a native binding, so it must not be traced into the server bundle
   * — it has to be required at runtime from node_modules with the platform build
   * Vercel installed. Bundling it produces a module that loads locally and throws
   * on deploy, and the only caller (services/codeCard.ts, the TikTok code card)
   * swallows its own errors by design, so the failure would surface as cards that
   * silently never appear rather than as a build or runtime error.
   */
  serverExternalPackages: ["sharp"],
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
