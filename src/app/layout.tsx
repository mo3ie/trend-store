import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

// Applied before paint to avoid a theme flash. Default is dark.
const noFlashScript = `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.add('light');}}catch(e){}})();`;

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "700", "900"],
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
      <body className={`${cairo.className} min-h-full flex flex-col`}>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
