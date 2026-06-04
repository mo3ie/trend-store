"use client";

import { useEffect, useState } from "react";
import { Search, Filter } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Order = {
  id: string;
  created_at: string;
  status: string;
  name?: string;
  phone?: string;
  price?: number;
  cart_link?: string;
};

const statuses = ["الكل", "pending", "processing", "shipped", "delivered", "cancelled"];

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  delivered:  "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled:  "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pending:    "انتظار",
  processing: "تجهيز",
  shipped:    "شحن",
  delivered:  "تسليم",
  cancelled:  "ملغي",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filtered, setFiltered] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("الكل");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let result = orders;
    if (activeStatus !== "الكل") result = result.filter((o) => o.status === activeStatus);
    if (search) result = result.filter((o) => o.name?.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search));
    setFiltered(result);
  }, [orders, activeStatus, search]);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdating(id);
    await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: newStatus } : o));
    setUpdating(null);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} طلب</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الزبون أو رقم الطلب..."
            className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-[#0f1320] border border-purple-500/20 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeStatus === s
                  ? "bg-purple-600 text-white"
                  : "bg-[#0f1320] border border-purple-500/20 text-gray-400 hover:text-white"
              }`}
            >
              {s === "الكل" ? s : statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-600">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-600">لا توجد طلبات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-right px-5 py-3 font-medium">رقم الطلب</th>
                  <th className="text-right px-5 py-3 font-medium">الزبون</th>
                  <th className="text-right px-5 py-3 font-medium">الهاتف</th>
                  <th className="text-right px-5 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-5 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-5 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">#{order.id.toString().slice(0, 8)}</td>
                    <td className="px-5 py-3.5 text-white font-medium">{order.name || "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{order.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-purple-400 font-semibold">{order.price ? `${order.price} $` : "—"}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(order.created_at).toLocaleDateString("ar-LY")}</td>
                    <td className="px-5 py-3.5">
                      <select
                        value={order.status}
                        disabled={updating === order.id}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border cursor-pointer outline-none transition-all disabled:opacity-50 ${
                          statusColors[order.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        }`}
                        style={{ background: "transparent" }}
                      >
                        {Object.entries(statusLabels).map(([val, label]) => (
                          <option key={val} value={val} style={{ background: "#0f1320", color: "white" }}>{label}</option>
                        ))}
                      </select>
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
