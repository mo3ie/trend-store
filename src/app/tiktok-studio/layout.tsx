import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "الموظف الذكي — تيك توك | ترند ستور",
  description: "خطة فيديوهات تيك توك بالذكاء الاصطناعي: الخطّاف، المشاهد، النص على الشاشة، والوصف",
};

export default function TikTokStudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
