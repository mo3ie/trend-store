"use client";

import { LayoutDashboard, Package, ShoppingBag, Users, Settings, LogOut, ChevronRight, Menu, X, Megaphone, Building2, Image as ImageIcon, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const allNavItems = [
  { label: "الرئيسية",    icon: LayoutDashboard, href: "/admin",           adminOnly: false },
  { label: "المنتجات",    icon: Package,          href: "/admin/products",  adminOnly: false },
  { label: "الطلبات",     icon: ShoppingBag,      href: "/admin/orders",    adminOnly: false },
  { label: "الصيانة",     icon: Wrench,            href: "/admin/maintenance", adminOnly: false },
  { label: "الإعلانات",   icon: Megaphone,        href: "/admin/ads",       adminOnly: false },
  { label: "المظهر والتواصل", icon: ImageIcon,    href: "/admin/appearance", adminOnly: false },
  { label: "الموظفون",    icon: Users,             href: "/admin/employees", adminOnly: true  },
  { label: "الإعدادات",   icon: Settings,          href: "/admin/settings",  adminOnly: true  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("profiles").select("role").eq("id", data.user.id).single()
        .then(({ data: profile }) => setRole(profile?.role ?? null));
    });
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const navItems = allNavItems.filter(item => !item.adminOnly || role === "admin");

  const SidebarContent = () => (
    <>
      <div className="mb-8 px-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            محل ترند
          </h1>
          <p className="text-xs text-[var(--muted-2)] mt-0.5">للإلكترونيات — لوحة الإدارة</p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-[var(--muted-2)] hover:text-[var(--text)] p-1"
        >
          <X size={20} />
        </button>
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
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              {label}
              {active && <ChevronRight size={14} className="mr-auto text-purple-400" />}
            </a>
          );
        })}
      </nav>

      {/* External services */}
      <div className="mb-3 border-t border-purple-500/10 pt-3">
        <p className="text-xs text-[var(--muted-2)] px-3 mb-2">مواقع وخدمات</p>
        <a href="https://trendy.trendstore-ly.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 transition-all">
          <Building2 size={17} className="shrink-0" />
          Trendy — الحجوزات
        </a>
      </div>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <LogOut size={17} />
        تسجيل الخروج
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-purple-500/20 flex-col py-6 px-4">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-[var(--bg)] border-l border-purple-500/20 flex flex-col py-6 px-4 z-50 transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur z-30">
          <h1 className="flex-1 text-sm font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            محل ترند — لوحة الإدارة
          </h1>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[var(--muted)] hover:text-[var(--text)] p-1"
          >
            <Menu size={22} />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
