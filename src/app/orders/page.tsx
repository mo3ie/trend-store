"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShoppingCart,
  Bell,
  User,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  total?: number;
  price?: number;
  items?: OrderItem[];
  address?: string;
  phone?: string;
  note?: string;
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; step: number }> = {
  pending:    { label: "قيد الانتظار",  color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", icon: Clock,        step: 1 },
  processing: { label: "جاري التجهيز", color: "text-blue-400 border-blue-500/30 bg-blue-500/10",       icon: Package,      step: 2 },
  shipped:    { label: "تم الشحن",      color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Truck,        step: 3 },
  delivered:  { label: "تم التسليم",    color: "text-green-400 border-green-500/30 bg-green-500/10",   icon: CheckCircle,  step: 4 },
  cancelled:  { label: "ملغي",          color: "text-red-400 border-red-500/30 bg-red-500/10",          icon: XCircle,      step: 0 },
};

const steps = [
  { key: "pending",    label: "تأكيد الطلب",  icon: Clock       },
  { key: "processing", label: "جاري التجهيز", icon: Package     },
  { key: "shipped",    label: "تم الشحن",     icon: Truck       },
  { key: "delivered",  label: "تم التسليم",   icon: CheckCircle },
];

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const currentStep = cfg.step;
  const isCancelled = order.status === "cancelled";
  const total = order.total ?? order.price;

  return (
    <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden">
      {/* Header Row */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <ShoppingBag size={18} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">طلب #{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {new Date(order.created_at).toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {total != null && (
            <span className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {total} د
            </span>
          )}
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.color}`}>
            <StatusIcon size={12} />
            {cfg.label}
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-white/5 p-5 space-y-5">

          {/* Status Timeline */}
          {!isCancelled && (
            <div className="flex items-center justify-between">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const done = currentStep > i + 1;
                const active = currentStep === i + 1;
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5 relative">
                    {i < steps.length - 1 && (
                      <div className={`absolute top-4 right-1/2 w-full h-0.5 ${done ? "bg-purple-500" : "bg-white/10"}`} />
                    )}
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      active ? "border-purple-500 bg-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                      : done ? "border-purple-500 bg-purple-500"
                      : "border-white/10 bg-white/5"
                    }`}>
                      <Icon size={14} className={active || done ? "text-white" : "text-gray-600"} />
                    </div>
                    <span className={`text-xs text-center ${active ? "text-purple-400 font-medium" : done ? "text-gray-400" : "text-gray-600"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <XCircle size={16} />
              تم إلغاء هذا الطلب
            </div>
          )}

          {/* Items */}
          {order.items?.length ? (
            <div className="space-y-2">
              <p className="text-gray-500 text-xs mb-2">المنتجات</p>
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-black/20 rounded-xl p-3">
                  {item.image_url ? (
                    <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Package size={16} className="text-purple-400/50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">الكمية: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-bold text-purple-400">{item.price * item.quantity} د</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {order.address && (
              <div className="bg-black/20 rounded-xl p-3">
                <p className="text-gray-500 mb-1">عنوان التسليم</p>
                <p className="text-gray-300">{order.address}</p>
              </div>
            )}
            {order.phone && (
              <div className="bg-black/20 rounded-xl p-3">
                <p className="text-gray-500 mb-1">رقم التواصل</p>
                <p className="text-gray-300">{order.phone}</p>
              </div>
            )}
            {order.note && (
              <div className="bg-black/20 rounded-xl p-3 col-span-2">
                <p className="text-gray-500 mb-1">ملاحظة</p>
                <p className="text-gray-300">{order.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("الكل");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => { setOrders(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const filters = ["الكل", ...Object.values(statusConfig).map((s) => s.label)];
  const filtered = activeFilter === "الكل"
    ? orders
    : orders.filter((o) => statusConfig[o.status]?.label === activeFilter);

  if (authLoading) return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col bg-[#0b0f1a] text-white min-h-screen">

      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[#0b0f1a]/90 backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">
          TREND
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-gray-400 shrink-0">
          <button className="relative hover:text-purple-400 transition-colors">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
          </button>
          <button onClick={() => router.push("/products")} className="hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
          </button>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-gray-300 text-sm">
              <User size={16} /> دخول
            </a>
          )}
        </div>
      </header>

      <div className="p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black">طلباتي</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {loading ? "جاري التحميل..." : `${orders.length} طلب`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeFilter === f
                  ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                  : "bg-[#0f1320] border border-purple-500/20 text-gray-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0f1320] border border-purple-500/10 rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-white/5 rounded w-1/3" />
                    <div className="h-3 bg-white/5 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
            <ShoppingBag size={56} className="text-purple-500/20" />
            <p className="text-lg font-medium">لا توجد طلبات</p>
            <a href="/products" className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
              <ShoppingCart size={16} /> تصفح المنتجات
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
