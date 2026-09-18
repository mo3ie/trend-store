import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "معاينة تصريح TikTok — محل ترند",
  description:
    "معاينة توضيحية لخطوة التصريح في تكامل TikTok Accounts API — بيانات تجريبية، وليست شاشة TikTok الرسمية.",
  // A prototype surface should never be indexed or mistaken for the real authorization page.
  robots: { index: false, follow: false },
};

export default function TikTokDemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
