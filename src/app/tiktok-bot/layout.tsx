import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بوت تيك توك — ترند ستور",
  description: "رد آلي على تعليقات تيك توك — اشتراك شهري",
};

export default function TikTokBotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
