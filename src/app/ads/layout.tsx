import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الإعلانات الرقمية — ترند ستور",
  description: "وصّل إعلانك للعملاء بسهولة عبر ترند ستور",
};

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
