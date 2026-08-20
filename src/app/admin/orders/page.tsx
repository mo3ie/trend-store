"use client";

import { useEffect, useState } from "react";
import { Search, X, Package, Phone, Mail, MapPin, Calendar, CreditCard, Eye, ChevronDown, ShoppingCart, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  variants?: Record<string, string>;
};

type StoreOrder = {
  id: string;
  created_at: string;
  status: string;
  total?: number;
  address_text?: string;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  products?: Product[];
  user_id?: string;
  profiles?: { full_name?: string; phone?: string; email?: string };
};

type SheinOrder = {
  id: string | number;
  created_at?: string;
  name?: string;
  phone?: string;
  cart_link?: string;
  price?: number;
  price_lyd?: number;
  final_total?: number;
  status?: string;
};

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  delivered:  "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled:  "bg-red-500/20 text-red-400 border-red-500/30",
  paid:       "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusLabels: Record<string, string> = {
  pending: "انتظار", processing: "تجهيز", shipped: "شحن",
  delivered: "تسليم", cancelled: "ملغي",
};

const paymentLabels: Record<string, string> = {
  cash_on_delivery: "دفع عند الاستلام",
  wallet: "محفظة", stripe: "بطاقة",
  edfali: "ادفع لي", mobicash: "موبي كاش",
  moamalat: "معاملات", yousrpay: "يسر باي", yusor: "يسر باي",
  masarafi: "مصرفي باي",
};

const sheinStatuses = ["الكل", "pending", "processing", "shipped", "delivered", "cancelled", "paid"];

const storeStatuses = ["الكل", "pending", "processing", "shipped", "delivered", "cancelled"];

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getFullYear() < 2020) return "—";
  return d.toLocaleDateString("ar-LY", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " +
    d.toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" });
}

function StoreDetailModal({ order, onClose, onStatusChange }: { order: StoreOrder; onClose: () => void; onStatusChange: (id: string, s: string) => void }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ table: "store", id: order.id, status }),
    });
    onStatusChange(order.id, status);
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--surface)] border border-purple-500/30 rounded-3xl w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/15 shrink-0">
          <div>
            <h2 className="font-bold text-lg">تفاصيل الطلب</h2>
            <p className="text-[var(--muted-2)] text-xs mt-0.5 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] text-sm transition-all"
            >
              <Printer size={14} /> طباعة
            </button>
            <button onClick={onClose} className="text-[var(--muted-2)] hover:text-[var(--text)] transition-colors p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--input)] rounded-2xl p-4 space-y-1">
              <p className="text-[var(--muted-2)] text-xs mb-2">بيانات الزبون</p>
              <p className="font-bold text-[var(--text)]">{order.profiles?.full_name || "—"}</p>
              {order.profiles?.phone && (
                <p className="text-[var(--muted)] text-sm flex items-center gap-1.5"><Phone size={12} />{order.profiles.phone}</p>
              )}
              {order.profiles?.email && (
                <p className="text-[var(--muted)] text-sm flex items-center gap-1.5"><Mail size={12} />{order.profiles.email}</p>
              )}
            </div>
            <div className="bg-[var(--input)] rounded-2xl p-4 space-y-1">
              <p className="text-[var(--muted-2)] text-xs mb-2">تفاصيل الطلب</p>
              <p className="text-[var(--muted)] text-sm flex items-center gap-1.5">
                <Calendar size={12} />{fmtDate(order.created_at)}
              </p>
              {order.address_text && (
                <p className="text-[var(--muted)] text-sm flex items-center gap-1.5">
                  <MapPin size={12} /><span className="line-clamp-2">{order.address_text}</span>
                </p>
              )}
              <p className="text-[var(--muted)] text-sm flex items-center gap-1.5">
                <CreditCard size={12} />{paymentLabels[order.payment_method || ""] || order.payment_method || "—"}
              </p>
            </div>
          </div>

          {/* Products */}
          {order.products?.length ? (
            <div>
              <p className="text-[var(--muted-2)] text-xs mb-3">المنتجات ({order.products.length})</p>
              <div className="space-y-2">
                {order.products.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-black/20 border border-[var(--border)] rounded-2xl p-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-xl object-cover border border-[var(--border)] shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Package size={20} className="text-purple-400/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text)] text-sm leading-tight">{p.name}</p>
                      {p.variants && Object.entries(p.variants).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(p.variants).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300">
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[var(--muted-2)] text-xs mt-1">الكمية: {p.quantity}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        {(p.price * p.quantity).toLocaleString()} د
                      </p>
                      <p className="text-[var(--muted-2)] text-xs">{p.price.toLocaleString()} × {p.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Total */}
          <div className="flex items-center justify-between bg-purple-900/20 border border-purple-500/25 rounded-2xl px-5 py-4">
            <span className="text-[var(--muted)] font-medium">المجموع الكلي</span>
            <span className="text-2xl font-black bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              {order.total?.toLocaleString() || "—"} <span className="text-base">د.ل</span>
            </span>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-black/20 border border-[var(--border)] rounded-2xl p-4">
              <p className="text-[var(--muted-2)] text-xs mb-1">ملاحظات</p>
              <p className="text-[var(--muted)] text-sm">{order.notes}</p>
            </div>
          )}

          {/* Status update */}
          <div className="bg-[var(--input)] rounded-2xl p-4">
            <p className="text-[var(--muted-2)] text-xs mb-3">تغيير حالة الطلب</p>
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                style={{ background: "var(--bg)" }}
              >
                {Object.entries(statusLabels).map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
              <button
                onClick={save}
                disabled={saving || status === order.status}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? "⏳" : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [tab, setTab] = useState<"store" | "shein">("store");

  // Store orders
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [storeFiltered, setStoreFiltered] = useState<StoreOrder[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStatus, setStoreStatus] = useState("الكل");
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  // Shein orders
  const [sheinOrders, setSheinOrders] = useState<SheinOrder[]>([]);
  const [sheinFiltered, setSheinFiltered] = useState<SheinOrder[]>([]);
  const [sheinLoading, setSheinLoading] = useState(true);
  const [sheinSearch, setSheinSearch] = useState("");
  const [sheinStatus, setSheinStatus] = useState("الكل");
  const [sheinUpdating, setSheinUpdating] = useState<string | null>(null);

  useEffect(() => { fetchStore(); fetchShein(); }, []);

  useEffect(() => {
    let r = storeOrders;
    if (storeStatus !== "الكل") r = r.filter(o => o.status === storeStatus);
    if (storeSearch) r = r.filter(o =>
      o.profiles?.full_name?.toLowerCase().includes(storeSearch.toLowerCase()) ||
      o.profiles?.phone?.includes(storeSearch) ||
      o.id.toLowerCase().includes(storeSearch.toLowerCase())
    );
    setStoreFiltered(r);
  }, [storeOrders, storeStatus, storeSearch]);

  useEffect(() => {
    let r = sheinOrders;
    if (sheinStatus !== "الكل") r = r.filter(o => o.status === sheinStatus);
    if (sheinSearch) r = r.filter(o =>
      o.name?.toLowerCase().includes(sheinSearch.toLowerCase()) ||
      o.phone?.includes(sheinSearch) ||
      String(o.id).toLowerCase().includes(sheinSearch.toLowerCase())
    );
    setSheinFiltered(r);
  }, [sheinOrders, sheinStatus, sheinSearch]);

  async function fetchStore() {
    setStoreLoading(true);
    const { data } = await supabase
      .from("store_orders")
      .select("*, profiles(full_name, phone, email)")
      .order("created_at", { ascending: false });
    setStoreOrders(data || []);
    setStoreLoading(false);
  }

  async function fetchShein() {
    setSheinLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false, nullsFirst: false });
    setSheinOrders(data || []);
    setSheinLoading(false);
  }

  async function handleSheinStatus(id: string | number, newStatus: string) {
    setSheinUpdating(String(id));
    const { data: { session } } = await supabase.auth.getSession();
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ table: "shein", id, status: newStatus }),
    });
    setSheinOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    setSheinUpdating(null);
  }

  function handleStoreStatusChange(id: string, newStatus: string) {
    setStoreOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
  }

  const tabBtn = (key: "store" | "shein", label: string, count: number) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${
        tab === key
          ? "bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.4)]"
          : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {label}
      <span className={`text-xs px-2 py-0.5 rounded-full ${tab === key ? "bg-white/20" : "bg-white/10"}`}>{count}</span>
    </button>
  );

  return (
    <div className="p-6 space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">الطلبات</h1>
        <p className="text-[var(--muted-2)] text-sm mt-0.5">إدارة جميع الطلبات</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-3">
        {tabBtn("store", "المتجر الإلكتروني", storeOrders.length)}
        {tabBtn("shein", "طلبات شي إن", sheinOrders.length)}
      </div>

      {/* ═══ STORE ORDERS ═══ */}
      {tab === "store" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
              <input
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="بحث باسم الزبون أو الهاتف أو رقم الطلب..."
                className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-[var(--surface)] border border-purple-500/20 text-sm text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {storeStatuses.map((s) => (
                <button key={s} onClick={() => setStoreStatus(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    storeStatus === s
                      ? "bg-purple-600 text-[var(--text)]"
                      : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {s === "الكل" ? s : statusLabels[s] || s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden">
            {storeLoading ? (
              <div className="p-10 text-center text-[var(--muted-2)]">جاري التحميل...</div>
            ) : storeFiltered.length === 0 ? (
              <div className="p-10 text-center text-[var(--muted-2)]">لا توجد طلبات</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                      <th className="text-right px-5 py-3 font-medium">رقم الطلب</th>
                      <th className="text-right px-5 py-3 font-medium">الزبون</th>
                      <th className="text-right px-5 py-3 font-medium">الهاتف</th>
                      <th className="text-right px-5 py-3 font-medium">المبلغ</th>
                      <th className="text-right px-5 py-3 font-medium">التاريخ</th>
                      <th className="text-right px-5 py-3 font-medium">الحالة</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {storeFiltered.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-[var(--border)] hover:bg-purple-500/5 transition-colors cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="px-5 py-3.5 text-[var(--muted)] font-mono text-xs">#{order.id.slice(0, 8).toUpperCase()}</td>
                        <td className="px-5 py-3.5 text-[var(--text)] font-medium">{order.profiles?.full_name || "—"}</td>
                        <td className="px-5 py-3.5 text-[var(--muted)] text-xs">{order.profiles?.phone || "—"}</td>
                        <td className="px-5 py-3.5 text-purple-400 font-semibold">{order.total ? `${order.total.toLocaleString()} د.ل` : "—"}</td>
                        <td className="px-5 py-3.5 text-[var(--muted)] text-xs">{fmtDate(order.created_at)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[order.status] || "bg-gray-500/20 text-[var(--muted)] border-gray-500/30"}`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all text-xs"
                          >
                            <Eye size={12} /> عرض
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SHEIN ORDERS ═══ */}
      {tab === "shein" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
              <input
                value={sheinSearch}
                onChange={(e) => setSheinSearch(e.target.value)}
                placeholder="بحث باسم الزبون أو الهاتف..."
                className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-[var(--surface)] border border-purple-500/20 text-sm text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/50 transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {sheinStatuses.map((s) => (
                <button key={s} onClick={() => setSheinStatus(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    sheinStatus === s
                      ? "bg-purple-600 text-[var(--text)]"
                      : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {s === "الكل" ? s : statusLabels[s] || s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden">
            {sheinLoading ? (
              <div className="p-10 text-center text-[var(--muted-2)]">جاري التحميل...</div>
            ) : sheinFiltered.length === 0 ? (
              <div className="p-10 text-center text-[var(--muted-2)]">لا توجد طلبات شي إن</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                      <th className="text-right px-5 py-3 font-medium">رقم الطلب</th>
                      <th className="text-right px-5 py-3 font-medium">الاسم</th>
                      <th className="text-right px-5 py-3 font-medium">الهاتف</th>
                      <th className="text-right px-5 py-3 font-medium">السعر ($)</th>
                      <th className="text-right px-5 py-3 font-medium">السعر (د.ل)</th>
                      <th className="text-right px-5 py-3 font-medium">التاريخ</th>
                      <th className="text-right px-5 py-3 font-medium">الحالة</th>
                      <th className="text-right px-5 py-3 font-medium">الرابط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheinFiltered.map((order) => (
                      <tr key={String(order.id)} className="border-b border-[var(--border)] hover:bg-white/2 transition-colors">
                        <td className="px-5 py-3.5 text-[var(--muted)] font-mono text-xs">#{String(order.id).slice(0, 8).toUpperCase()}</td>
                        <td className="px-5 py-3.5 text-[var(--text)] font-medium">{order.name || "—"}</td>
                        <td className="px-5 py-3.5 text-[var(--muted)] text-xs">{order.phone || "—"}</td>
                        <td className="px-5 py-3.5 text-blue-400 font-semibold">{order.price ? `$${order.price}` : "—"}</td>
                        <td className="px-5 py-3.5 text-purple-400 font-semibold">{order.final_total ? `${order.final_total} د.ل` : (order.price_lyd ? `${order.price_lyd} د.ل` : "—")}</td>
                        <td className="px-5 py-3.5 text-[var(--muted)] text-xs">{fmtDate(order.created_at)}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={order.status || "pending"}
                            disabled={sheinUpdating === String(order.id)}
                            onChange={(e) => handleSheinStatus(order.id, e.target.value)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border cursor-pointer outline-none transition-all disabled:opacity-50 ${
                              statusColors[order.status || "pending"] || "bg-gray-500/20 text-[var(--muted)] border-gray-500/30"
                            }`}
                            style={{ background: "var(--bg)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {Object.entries(statusLabels).map(([val, label]) => (
                              <option key={val} value={val} style={{ background: "var(--surface)", color: "var(--text)" }}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          {order.cart_link && (
                            <a
                              href={order.cart_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-xs"
                            >
                              <ExternalLink size={11} /> رابط
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <StoreDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStoreStatusChange}
        />
      )}
    </div>
  );
}
