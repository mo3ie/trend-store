import type { CapacitorConfig } from "@capacitor/cli";

/**
 * trend-store is a full SSR Next.js app (API routes, middleware, Supabase
 * SSR) so it can't be statically exported. The native app is a thin shell
 * that loads the live production site over HTTPS. Native value (push,
 * splash, store distribution) is layered on top.
 *
 * The visible app label is set in the native projects (Android
 * res/values[-ar]/strings.xml app_name, iOS CFBundleDisplayName) — keep it
 * "ترند".
 */
const config: CapacitorConfig = {
  appId: "com.trendstorely.app",
  appName: "Trend",
  webDir: "www",
  server: {
    url: "https://trendstore-ly.com",
    cleartext: false,
  },
  backgroundColor: "#0b0f1a",
  android: {
    backgroundColor: "#0b0f1a",
  },
  ios: {
    backgroundColor: "#0b0f1a",
    contentInset: "always",
  },
};

export default config;
