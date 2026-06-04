"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingBag, Users, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  created_at: string;
  status: string;
  name?: string;
  price?: number;
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
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("id,name,status,price,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("orders").select("price").eq("status", "delivered"),
      ]);

      const revenue = revenueData?.reduce((sum, o) => sum + (o.price || 0), 0) || 0;
      setStats({ products: products || 0, orders: orders || 0, users: users || 0, revenue });
      setRecentOrders(ordersData || []);
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
        <p className="text-gray-500 text-sm mt-0.5">مرحباً بك في لوحة إدارة ترند</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-lg`}>
              <Icon size={20} className="text-white" />
            </div>
            <p className="text-gray-400 text-xs mb-1">{label}</p>
            <p className="text-2xl font-black text-white">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-purple-500/15">
          <Clock size={16} className="text-purple-400" />
          <h2 className="font-bold text-sm">آخر الطلبات</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-600">جاري التحميل...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-600">لا توجد طلبات بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-right px-6 py-3 font-medium">رقم الطلب</th>
                  <th className="text-right px-6 py-3 font-medium">الزبون</th>
                  <th className="text-right px-6 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-6 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-6 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-3.5 text-gray-400 font-mono text-xs">#{order.id.toString().slice(0, 8)}</td>
                    <td className="px-6 py-3.5 text-white">{order.name || "—"}</td>
                    <td className="px-6 py-3.5 text-purple-400 font-semibold">{order.price ? `${order.price} $` : "—"}</td>
                    <td className="px-6 py-3.5 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString("ar-LY")}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || "bg-gray-500/20 text-gray-400"}`}>
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
