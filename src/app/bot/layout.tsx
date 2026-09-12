import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بوت الرد الآلي — ترند ستور",
  description: "رد آلي على تعليقات ورسائل صفحات فيسبوك — اشتراك شهري",
};

export default function BotLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
