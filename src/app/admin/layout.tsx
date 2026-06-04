"use client";

import { LayoutDashboard, Package, ShoppingBag, Users, Settings, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "الرئيسية",    icon: LayoutDashboard, href: "/admin"           },
  { label: "المنتجات",    icon: Package,          href: "/admin/products"  },
  { label: "الطلبات",     icon: ShoppingBag,      href: "/admin/orders"    },
  { label: "المستخدمون",  icon: Users,             href: "/admin/users"     },
  { label: "الإعدادات",   icon: Settings,          href: "/admin/settings"  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#0b0f1a] text-white">

      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-purple-500/20 flex flex-col py-6 px-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            TREND
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">لوحة الإدارة</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => {
            const active = pathname === href;
            return (
              <a
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                {label}
                {active && <ChevronRight size={14} className="mr-auto text-purple-400" />}
              </a>
            );
          })}
        </nav>

        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={17} />
          تسجيل الخروج
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
