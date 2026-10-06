import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "إعلانات تيك توك — ترند ستور",
  description: "روّج فيديوهاتك على تيك توك: استهداف بالمدينة والعمر والاهتمام، ودفع محلي بالدينار",
};

export default function TikTokAdsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
