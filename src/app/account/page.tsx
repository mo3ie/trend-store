"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, MapPin, Mail, Package, Heart, LogOut, Edit3, Check, X, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  price?: number;
  name?: string;
};

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  delivered:  "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled:  "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  pending:    "قيد الانتظار",
  processing: "جاري التجهيز",
  shipped:    "تم الشحن",
  delivered:  "تم التسليم",
  cancelled:  "ملغي",
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", email: "", address: "" });
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Profile>(profile);
  const [saving, setSaving] = useState(false);

  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [sheinOrders, setSheinOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "store" | "shein" | "favorites">("profile");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    // جلب بيانات الملف الشخصي
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        const p = { full_name: data.full_name || "", phone: data.phone || "", email: data.email || user.email || "", address: data.address || "" };
        setProfile(p);
        setEditData(p);
      } else {
        setProfile((prev) => ({ ...prev, email: user.email || "" }));
        setEditData((prev) => ({ ...prev, email: user.email || "" }));
      }
    });

    // جلب طلبات المتجر
    supabase.from("store_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setStoreOrders(data || []);
    });

    // جلب طلبات شي إن
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => {
      setSheinOrders(data || []);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").upsert({ id: user.id, ...editData });
    setProfile(editData);
    setEditMode(false);
    setSaving(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const tabs = [
    { key: "profile",   label: "بياناتي",     icon: User    },
    { key: "store",     label: "طلبات المتجر", icon: ShoppingBag },
    { key: "shein",     label: "طلبات شي إن",  icon: Package },
    { key: "favorites", label: "المفضلة",      icon: Heart   },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="fixed top-[-150px] right-[-150px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-purple-500/20 px-6 py-4 flex items-center justify-between bg-[#0b0f1a]/90 backdrop-blur-md sticky top-0 z-40">
        <a href="/" className="text-2xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          TREND
        </a>
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            {profile.full_name?.[0]?.toUpperCase() || "؟"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile.full_name || "مستخدم"}</h1>
            <p className="text-gray-500 text-sm">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key
                  ? "bg-purple-600 text-white shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">البيانات الشخصية</h2>
              {!editMode ? (
                <button
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-sm transition-all"
                >
                  <Edit3 size={14} /> تعديل
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-sm transition-all"
                  >
                    {saving ? <span className="w-3.5 h-3.5 border border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <Check size={14} />}
                    حفظ
                  </button>
                  <button
                    onClick={() => { setEditMode(false); setEditData(profile); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all"
                  >
                    <X size={14} /> إلغاء
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {[
                { label: "الاسم الكامل", key: "full_name", icon: User,    type: "text"  },
                { label: "البريد الإلكتروني", key: "email", icon: Mail,   type: "email" },
                { label: "رقم الهاتف",    key: "phone",    icon: Phone,   type: "tel"   },
                { label: "العنوان",        key: "address",  icon: MapPin,  type: "text"  },
              ].map(({ label, key, icon: Icon, type }) => (
                <div key={key}>
                  <label className="text-gray-500 text-xs mb-1.5 flex items-center gap-1.5">
                    <Icon size={12} /> {label}
                  </label>
                  {editMode ? (
                    <input
                      type={type}
                      value={editData[key as keyof Profile]}
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                    />
                  ) : (
                    <p className="px-4 py-2.5 rounded-xl bg-black/20 border border-white/5 text-sm text-gray-300">
                      {editData[key as keyof Profile] || <span className="text-gray-600">غير محدد</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STORE ORDERS TAB ── */}
        {activeTab === "store" && (
          <div className="space-y-3">
            {storeOrders.length === 0 ? (
              <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
                <ShoppingBag size={40} className="mx-auto mb-3 text-purple-500/40" />
                لا توجد طلبات من المتجر بعد
              </div>
            ) : storeOrders.map((order) => (
              <div key={order.id} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">طلب #{order.id.slice(0, 8)}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString("ar-LY")}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColors[order.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── SHEIN ORDERS TAB ── */}
        {activeTab === "shein" && (
          <div className="space-y-3">
            {sheinOrders.length === 0 ? (
              <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
                <Package size={40} className="mx-auto mb-3 text-purple-500/40" />
                لا توجد طلبات شي إن بعد
              </div>
            ) : sheinOrders.map((order) => (
              <div key={order.id} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">طلب #{order.id.toString().slice(0, 8)}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString("ar-LY")}</p>
                  {order.price && <p className="text-purple-400 text-xs mt-0.5">{order.price} $</p>}
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColors[order.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── FAVORITES TAB ── */}
        {activeTab === "favorites" && (
          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
            <Heart size={40} className="mx-auto mb-3 text-purple-500/40" />
            المفضلة فارغة — أضف منتجات تعجبك!
          </div>
        )}
      </div>
    </div>
  );
}
