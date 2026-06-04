"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShoppingCart,
  Bell,
  User,
  Package,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, total, count } = useCart();
  const [ordering, setOrdering] = useState(false);

  async function handleOrder() {
    if (!user) { router.push("/login"); return; }
    setOrdering(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, image_url: i.image_url })),
        total,
      }),
    });

    if (res.ok) {
      clearCart();
      router.push("/orders");
    } else {
      setOrdering(false);
    }
  }

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
          <a href="/cart" className="relative text-purple-400">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">سلة التسوق</h1>
            <p className="text-gray-500 text-sm mt-0.5">{count} منتج</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={13} /> تفريغ السلة
            </button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <ShoppingBag size={64} className="text-purple-500/20" />
            <p className="text-lg font-medium">السلة فارغة</p>
            <p className="text-sm text-gray-600">أضف منتجات تعجبك من المتجر</p>
            <a
              href="/products"
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all mt-2"
            >
              <ShoppingCart size={16} /> تصفح المنتجات
            </a>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-4 flex items-center gap-4">
                  {/* Image */}
                  <a href={`/products/${item.id}`}>
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Package size={22} className="text-purple-400/40" />
                      </div>
                    )}
                  </a>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <a href={`/products/${item.id}`} className="text-sm font-semibold text-white hover:text-purple-300 transition-colors line-clamp-2">
                      {item.name}
                    </a>
                    <p className="text-purple-400 font-black mt-1">{item.price} د</p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors disabled:opacity-30"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 transition-colors mr-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 space-y-3">
              <h2 className="font-bold text-sm text-gray-400">ملخص الطلب</h2>
              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-gray-400">
                    <span className="truncate max-w-[200px]">{item.name} × {item.quantity}</span>
                    <span>{item.price * item.quantity} د</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                <span className="font-bold text-white">الإجمالي</span>
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  {total} د
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {ordering
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><ShoppingBag size={18} /> تأكيد الطلب</>
                }
              </button>
              <a
                href="/products"
                className="w-full py-3 rounded-2xl font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition-all text-sm"
              >
                <ShoppingCart size={16} /> مواصلة التسوق
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
