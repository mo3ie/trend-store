import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "محل ترند للإلكترونيات",
  description: "كل ما تحتاجه من عالم التقنية في مكان واحد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className={`${cairo.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
