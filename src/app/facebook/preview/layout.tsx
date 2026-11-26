import type { Metadata } from "next";

// Trial version of the new Facebook Tools hub — not for search engines until approved.
export const metadata: Metadata = {
  title: "أدوات فيسبوك — نسخة تجريبية",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
