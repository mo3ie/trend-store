import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "أدوات تيك توك — ترند ستور",
  description: "أدوات أصحاب حسابات تيك توك — الرد الآلي على التعليقات وإعلانات تيك توك",
};

export default function TikTokToolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
