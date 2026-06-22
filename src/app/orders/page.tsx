"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShoppingCart,
  User,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Printer,
  Phone,
  MapPin,
  CreditCard,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  variants?: Record<string, string>;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  total?: number;
  price?: number;
  products?: OrderItem[];
  items?: OrderItem[];
  address?: string;
  address_text?: string;
  phone?: string;
  note?: string;
  notes?: string;
  payment_method?: string;
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

const paymentLabels: Record<string, string> = {
  cash_on_delivery: "الدفع عند الاستلام",
  wallet: "محفظة ترند", stripe: "بطاقة",
  edfali: "ادفع لي", mobicash: "موبي كاش",
  moamalat: "معاملات", yousrpay: "يسر باي",
};

function PrintReceipt({ order, onClose }: { order: Order; onClose: () => void }) {
  const items = order.products || order.items || [];
  const total = order.total ?? order.price;
  const cfg = statusConfig[order.status] || statusConfig.pending;

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] bg-white text-black flex items-center justify-center" id="print-receipt">
      <button
        onClick={onClose}
        className="print:hidden fixed top-4 left-4 px-4 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-300 transition-colors"
      >
        إغلاق
      </button>

      <div className="w-[320px] p-6 font-sans" dir="rtl">
        {/* Store header */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-black tracking-widest">TREND</h1>
          <p className="text-[var(--muted-2)] text-xs">ترند للإلكترونيات</p>
          <p className="text-[var(--muted)] text-[10px] mt-1">trendstore-ly.com</p>
        </div>

        {/* Order info */}
        <div className="space-y-1 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-[var(--muted-2)]">رقم الطلب</span>
            <span className="font-mono font-bold">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-2)]">التاريخ</span>
            <span>{new Date(order.created_at).toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-2)]">الحالة</span>
            <span className="font-medium">{cfg.label}</span>
          </div>
          {(order.address || order.address_text) && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-2)]">التسليم</span>
              <span className="text-right max-w-[180px]">{order.address || order.address_text}</span>
            </div>
          )}
          {order.payment_method && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-2)]">الدفع</span>
              <span>{paymentLabels[order.payment_method] || order.payment_method}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-t border-b py-3 my-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex justify-between items-start text-xs gap-2">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                {item.variants && Object.entries(item.variants).length > 0 && (
                  <p className="text-[var(--muted)] text-[10px]">
                    {Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </p>
                )}
                <p className="text-[var(--muted-2)]">× {item.quantity}</p>
              </div>
              <p className="font-bold shrink-0">{(item.price * item.quantity).toLocaleString()} د</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between font-black text-base">
          <span>المجموع</span>
          <span>{total?.toLocaleString() || "—"} د.ل</span>
        </div>

        {(order.note || order.notes) && (
          <div className="mt-3 text-xs text-[var(--muted-2)]">
            <p className="font-medium text-gray-700 mb-0.5">ملاحظات:</p>
            <p>{order.note || order.notes}</p>
          </div>
        )}

        <div className="text-center mt-5 text-[10px] text-[var(--muted)]">
          <p>شكراً لثقتكم بترند للإلكترونيات</p>
          <p>للاستفسار: trendstore-ly.com</p>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-receipt) { display: none !important; }
          #print-receipt { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: white; }
        }
      `}</style>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const [printing, setPrinting] = useState(false);
  const cfg = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  const currentStep = cfg.step;
  const isCancelled = order.status === "cancelled";
  const total = order.total ?? order.price;
  const items = order.products || order.items || [];

  return (
    <>
      {printing && <PrintReceipt order={order} onClose={() => setPrinting(false)} />}

      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden">
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
              <p className="text-sm font-bold text-[var(--text)]">طلب #{order.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-[var(--muted-2)] text-xs mt-0.5">
                {new Date(order.created_at).toLocaleDateString("ar-LY", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {total != null && (
              <span className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {total.toLocaleString()} د
              </span>
            )}
            <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium ${cfg.color}`}>
              <StatusIcon size={12} />
              {cfg.label}
            </span>
            {expanded ? <ChevronUp size={16} className="text-[var(--muted-2)]" /> : <ChevronDown size={16} className="text-[var(--muted-2)]" />}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="border-t border-[var(--border)] p-5 space-y-5">

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
                        : "border-[var(--border)] bg-white/5"
                      }`}>
                        <Icon size={14} className={active || done ? "text-[var(--text)]" : "text-[var(--muted-2)]"} />
                      </div>
                      <span className={`text-xs text-center ${active ? "text-purple-400 font-medium" : done ? "text-[var(--muted)]" : "text-[var(--muted-2)]"}`}>
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
            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-[var(--muted-2)] text-xs mb-2">المنتجات ({items.length})</p>
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-black/20 rounded-xl p-3">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-12 h-12 rounded-lg object-cover border border-[var(--border)] shrink-0" alt={item.name} />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Package size={16} className="text-purple-400/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text)] font-medium leading-tight">{item.name}</p>
                      {item.variants && Object.entries(item.variants).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(item.variants).map(([k, v]) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300">
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-[var(--muted-2)] mt-0.5">الكمية: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-bold text-purple-400 shrink-0">{(item.price * item.quantity).toLocaleString()} د</span>
                  </div>
                ))}

                {/* Subtotals */}
                <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] text-sm">
                  <span className="text-[var(--muted-2)]">المجموع</span>
                  <span className="font-black text-base bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    {total?.toLocaleString() || "—"} د.ل
                  </span>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {(order.address || order.address_text) && (
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-[var(--muted-2)] mb-1 flex items-center gap-1"><MapPin size={10} /> عنوان التسليم</p>
                  <p className="text-[var(--muted)]">{order.address || order.address_text}</p>
                </div>
              )}
              {order.phone && (
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-[var(--muted-2)] mb-1 flex items-center gap-1"><Phone size={10} /> رقم التواصل</p>
                  <p className="text-[var(--muted)]">{order.phone}</p>
                </div>
              )}
              {order.payment_method && (
                <div className="bg-black/20 rounded-xl p-3">
                  <p className="text-[var(--muted-2)] mb-1 flex items-center gap-1"><CreditCard size={10} /> طريقة الدفع</p>
                  <p className="text-[var(--muted)]">{paymentLabels[order.payment_method] || order.payment_method}</p>
                </div>
              )}
              {(order.note || order.notes) && (
                <div className="bg-black/20 rounded-xl p-3 col-span-2">
                  <p className="text-[var(--muted-2)] mb-1">ملاحظة</p>
                  <p className="text-[var(--muted)]">{order.note || order.notes}</p>
                </div>
              )}
            </div>

            {/* Print button */}
            <button
              onClick={(e) => { e.stopPropagation(); setPrinting(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/10 transition-all text-sm"
            >
              <Printer size={14} />
              طباعة الوصل
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { count } = useCart();
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
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col bg-[var(--bg)] text-[var(--text)] min-h-screen">

      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 px-6 py-3.5 border-b border-purple-500/20 sticky top-0 bg-[var(--glass)] backdrop-blur-md z-40">
        <button onClick={() => router.back()} className="text-[var(--muted)] hover:text-purple-400 transition-colors shrink-0">
          <ArrowRight size={22} />
        </button>
        <a href="/" className="text-xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent shrink-0">
          TREND
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[var(--muted)] shrink-0">
          <a href="/cart" className="relative hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-[var(--text)] flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          {user ? (
            <a href="/account" className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-black">
              {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "؟").toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-[var(--muted)] text-sm">
              <User size={16} /> دخول
            </a>
          )}
        </div>
      </header>

      <div className="p-6 max-w-2xl mx-auto w-full space-y-5">

        {/* Title + New order button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">طلباتي</h1>
            <p className="text-[var(--muted-2)] text-sm mt-0.5">
              {loading ? "جاري التحميل..." : `${orders.length} طلب`}
            </p>
          </div>
          <a
            href="/products"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_18px_rgba(168,85,247,0.4)] transition-all"
          >
            <Plus size={15} /> طلب جديد
          </a>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                activeFilter === f
                  ? "bg-purple-600 text-[var(--text)] shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                  : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
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
              <div key={i} className="bg-[var(--surface)] border border-purple-500/10 rounded-2xl p-5 animate-pulse">
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
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-[var(--muted-2)]">
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
