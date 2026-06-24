import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "محل ترند للإلكترونيات",
    short_name: "ترند",
    description: "كل ما تحتاجه من عالم التقنية — هواتف، إكسسوارات وأجهزة بأفضل الأسعار وتوصيل لكل ليبيا.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0f1a",
    theme_color: "#0b0f1a",
    dir: "rtl",
    lang: "ar",
    categories: ["shopping"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
