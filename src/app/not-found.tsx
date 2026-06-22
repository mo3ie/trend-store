import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center px-4 relative overflow-hidden" dir="rtl">
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center relative">
        <h1 className="text-[110px] leading-none font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          404
        </h1>
        <p className="text-white text-xl font-bold mb-2">الصفحة غير موجودة</p>
        <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
          ربما حُذف هذا الرابط أو تغيّر عنوانه. لنعدك إلى المسار الصحيح.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all"
          >
            <Home size={18} />
            الرئيسية
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-purple-300 border border-purple-500/30 hover:bg-purple-500/10 transition-all"
          >
            <Search size={18} />
            تصفّح المنتجات
          </Link>
        </div>
      </div>
    </div>
  );
}
