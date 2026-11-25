import type { Metadata, Viewport } from "next";
import { Cairo, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import PWARegister from "@/components/PWARegister";
import PushPrompt from "@/components/PushPrompt";
import UiFx from "@/components/UiFx";
import GlassNav from "@/components/GlassNav";
import HoloBot from "@/components/holo/HoloBot";
import { preloadScript } from "@/lib/uiGlass";

export const viewport: Viewport = {
  themeColor: "#5d6770",
  // Explicit so mobile never falls back to a ~980px desktop viewport (which made
  // some pages render zoomed-out "desktop-style").
  width: "device-width",
  initialScale: 1,
};

// Applied before paint to avoid a flash: theme (default dark), the TREND Glass
// storefront layer, and the motion preference.
const noFlashScript = preloadScript;

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "700", "900"],
});

// TREND Glass typeface — used only under html[data-ui="glass"] (globals.css).
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://trendstore-ly.com"),
  title: {
    default: "محل ترند للإلكترونيات",
    template: "%s | ترند للإلكترونيات",
  },
  description: "كل ما تحتاجه من عالم التقنية في مكان واحد — هواتف، إكسسوارات وأجهزة بأفضل الأسعار وتوصيل لكل ليبيا.",
  keywords: ["ترند", "إلكترونيات", "ليبيا", "هواتف", "إكسسوارات", "متجر"],
  openGraph: {
    title: "محل ترند للإلكترونيات",
    description: "كل ما تحتاجه من عالم التقنية في مكان واحد — توصيل لكل ليبيا.",
    url: "https://trendstore-ly.com",
    siteName: "ترند للإلكترونيات",
    locale: "ar_LY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "محل ترند للإلكترونيات",
    description: "كل ما تحتاجه من عالم التقنية في مكان واحد.",
  },
  appleWebApp: {
    capable: true,
    title: "ترند",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className={`${cairo.className} ${plex.variable} min-h-full flex flex-col`}>
        {children}
        <ThemeToggle />
        <UiFx />
        <GlassNav />
        <HoloBot />
        <PWARegister />
        <PushPrompt />
      </body>
    </html>
  );
}
