"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingBag, Users, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  created_at: string;
  status: string;
  total?: number;
  profiles?: { full_name?: string };
};

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400",
  processing: "bg-blue-500/20 text-blue-400",
  shipped:    "bg-purple-500/20 text-purple-400",
  delivered:  "bg-green-500/20 text-green-400",
  cancelled:  "bg-red-500/20 text-red-400",
};

const statusLabels: Record<string, string> = {
  pending:    "انتظار",
  processing: "تجهيز",
  shipped:    "شحن",
  delivered:  "تسليم",
  cancelled:  "ملغي",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0, revenue: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: products },
        { count: orders },
        { count: users },
        { data: ordersData },
        { data: revenueData },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("store_orders").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("store_orders").select("id,status,total,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(8),
        supabase.from("store_orders").select("total").eq("status", "delivered"),
      ]);

      const revenue = revenueData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      setStats({ products: products || 0, orders: orders || 0, users: users || 0, revenue });
      // Supabase types an embedded one-to-one join (profiles) as an array;
      // normalize to a single object to match the Order type.
      setRecentOrders(
        (ordersData || []).map((o) => ({
          ...o,
          profiles: Array.isArray(o.profiles) ? o.profiles[0] : o.profiles,
        })) as Order[]
      );
      setLoading(false);
    }
    load();
  }, []);

  const statCards = [
    { label: "المنتجات",      value: stats.products,              icon: Package,     color: "from-purple-600 to-purple-400" },
    { label: "الطلبات",       value: stats.orders,                icon: ShoppingBag, color: "from-blue-600 to-blue-400"    },
    { label: "المستخدمون",    value: stats.users,                 icon: Users,       color: "from-green-600 to-green-400"  },
    { label: "إجمالي المبيعات", value: `${stats.revenue.toFixed(0)} $`, icon: TrendingUp, color: "from-orange-600 to-orange-400" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-[var(--muted-2)] text-sm mt-0.5">مرحباً بك في لوحة إدارة ترند</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-lg`}>
              <Icon size={20} className="text-[var(--text)]" />
            </div>
            <p className="text-[var(--muted)] text-xs mb-1">{label}</p>
            <p className="text-2xl font-black text-[var(--text)]">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-purple-500/15">
          <Clock size={16} className="text-purple-400" />
          <h2 className="font-bold text-sm">آخر الطلبات</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--muted-2)]">جاري التحميل...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted-2)]">لا توجد طلبات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                  <th className="text-right px-6 py-3 font-medium">رقم الطلب</th>
                  <th className="text-right px-6 py-3 font-medium">الزبون</th>
                  <th className="text-right px-6 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-6 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-6 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[var(--border)] hover:bg-white/2 transition-colors">
                    <td className="px-6 py-3.5 text-[var(--muted)] font-mono text-xs">#{order.id.toString().slice(0, 8)}</td>
                    <td className="px-6 py-3.5 text-[var(--text)]">{order.profiles?.full_name || "—"}</td>
                    <td className="px-6 py-3.5 text-purple-400 font-semibold">{order.total ? `${order.total} د.ل` : "—"}</td>
                    <td className="px-6 py-3.5 text-[var(--muted)] text-xs">
                      {order.created_at ? (
                        <>
                          <div>{new Date(order.created_at).toLocaleDateString("ar-LY", { day:"2-digit", month:"2-digit", year:"numeric" })}</div>
                          <div className="text-[var(--muted-2)]">{new Date(order.created_at).toLocaleTimeString("ar-LY", { hour:"2-digit", minute:"2-digit" })}</div>
                        </>
                      ) : <div className="text-[var(--muted-2)]">—</div>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-gray-500/20 text-[var(--muted)]"}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
