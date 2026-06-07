"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, MapPin, Mail, Package, Heart, LogOut, Edit3, Check, X, ShoppingBag, ArrowLeft, ShoppingCart, Settings, Camera } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

type Profile = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  avatar_url?: string;
};

type Order = {
  id: string;
  created_at: string;
  status: string;
  price?: number;
  name?: string;
};

type UserAddress = {
  id: string;
  label: string;
  address_text: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  shipped:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  delivered:  "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled:  "bg-red-500/20 text-red-400 border-red-500/30",
};
const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار", processing: "جاري التجهيز",
  shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي",
};

const ADDRESS_LABELS = ["المنزل", "العمل", "العائلة", "أخرى"];

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { count } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile,    setProfile]    = useState<Profile>({ full_name: "", phone: "", email: "", address: "", avatar_url: "" });
  const [editMode,   setEditMode]   = useState(false);
  const [editData,   setEditData]   = useState<Profile>(profile);
  const [saving,     setSaving]     = useState(false);
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [sheinOrders, setSheinOrders] = useState<Order[]>([]);
  const [activeTab,  setActiveTab]  = useState<"profile" | "store" | "shein" | "favorites" | "addresses" | "settings">("profile");
  const [avatarUrl,  setAvatarUrl]  = useState<string>("");
  const [uploading,  setUploading]  = useState(false);

  // Addresses
  const [addresses,     setAddresses]     = useState<UserAddress[]>([]);
  const [addrLoading,   setAddrLoading]   = useState(false);
  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editingAddr,   setEditingAddr]   = useState<UserAddress | null>(null);
  const [addrForm,      setAddrForm]      = useState({ label: "المنزل", address_text: "", lat: "", lng: "", is_default: false });
  const [addrSaving,    setAddrSaving]    = useState(false);
  const [geoLoading,    setGeoLoading]    = useState(false);

  // Settings
  const [pwData,   setPwData]   = useState({ next: "", confirm: "" });
  const [pwError,  setPwError]  = useState("");
  const [pwDone,   setPwDone]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // read ?tab= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["profile","store","shein","favorites","addresses","settings"].includes(tab))
      setActiveTab(tab as any);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        const p: Profile = {
          full_name:  data.full_name  || "",
          phone:      data.phone      || "",
          email:      data.email      || user.email || "",
          address:    data.address    || "",
          avatar_url: data.avatar_url || user.user_metadata?.avatar_url || "",
        };
        setProfile(p); setEditData(p); setAvatarUrl(p.avatar_url || "");
      }
    });
    supabase.from("store_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setStoreOrders(data || []));
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setSheinOrders(data || []));
  }, [user]);

  useEffect(() => {
    if (activeTab === "addresses" && user) fetchAddresses();
  }, [activeTab, user]);

  async function fetchAddresses() {
    setAddrLoading(true);
    const res = await fetch("/api/addresses");
    const data = await res.json();
    setAddresses(Array.isArray(data) ? data : []);
    setAddrLoading(false);
  }

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").upsert({ id: user.id, ...editData });
    setProfile(editData); setEditMode(false); setSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res  = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) setAvatarUrl(data.url);
    setUploading(false);
  };

  const handlePwChange = async () => {
    setPwError("");
    if (pwData.next.length < 6)        { setPwError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    if (pwData.next !== pwData.confirm) { setPwError("كلمة المرور وتأكيدها غير متطابقتين"); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwData.next });
    if (error) { setPwError(error.message); setPwSaving(false); return; }
    setPwDone(true); setPwData({ next: "", confirm: "" }); setPwSaving(false);
    setTimeout(() => setPwDone(false), 2500);
  };

  function openAddAddr() {
    setEditingAddr(null);
    setAddrForm({ label: "المنزل", address_text: "", lat: "", lng: "", is_default: false });
    setShowAddrModal(true);
  }
  function openEditAddr(addr: UserAddress) {
    setEditingAddr(addr);
    setAddrForm({ label: addr.label, address_text: addr.address_text, lat: addr.lat?.toString() || "", lng: addr.lng?.toString() || "", is_default: addr.is_default });
    setShowAddrModal(true);
  }

  async function handleSaveAddr() {
    setAddrSaving(true);
    const body = {
      ...addrForm,
      lat: addrForm.lat ? parseFloat(addrForm.lat) : undefined,
      lng: addrForm.lng ? parseFloat(addrForm.lng) : undefined,
    };
    if (editingAddr) {
      await fetch("/api/addresses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, id: editingAddr.id }) });
    } else {
      await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setShowAddrModal(false); setAddrSaving(false); fetchAddresses();
  }

  async function handleDeleteAddr(id: string) {
    if (!confirm("حذف هذا العنوان؟")) return;
    await fetch("/api/addresses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    fetchAddresses();
  }

  async function handleSetDefault(id: string) {
    await fetch("/api/addresses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_default: true, label: addresses.find(a=>a.id===id)?.label || "المنزل", address_text: addresses.find(a=>a.id===id)?.address_text || "" }) });
    fetchAddresses();
  }

  function handleGetGeo() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddrForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false)
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const tabs = [
    { key: "profile",   label: "بياناتي",     icon: User        },
    { key: "store",     label: "طلبات المتجر", icon: ShoppingBag },
    { key: "shein",     label: "طلبات شي إن",  icon: Package     },
    { key: "favorites", label: "المفضلة",      icon: Heart       },
    { key: "addresses", label: "مواقعي",       icon: MapPin      },
    { key: "settings",  label: "الإعدادات",    icon: Settings    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="fixed top-[-150px] right-[-150px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-purple-500/20 px-4 md:px-6 py-4 flex items-center justify-between bg-[#0b0f1a]/90 backdrop-blur-md sticky top-0 z-40">
        <a href="/" className="text-2xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          TREND
        </a>
        <div className="flex items-center gap-3">
          <a href="/cart" className="relative text-gray-400 hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          <button onClick={signOut} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm">
            <LogOut size={16} />
            <span className="hidden md:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-6 md:mb-8">
          <div className="relative group cursor-pointer" onClick={() => !uploading && fileRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-500/40"
                onError={() => setAvatarUrl("")} />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                {profile.full_name?.[0]?.toUpperCase() || "؟"}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={18} className="text-white" />}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div>
            <h1 className="text-xl font-bold">{profile.full_name || "مستخدم"}</h1>
            <p className="text-gray-500 text-sm">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key
                  ? "bg-purple-600 text-white shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10"
              }`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">البيانات الشخصية</h2>
              {!editMode ? (
                <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-sm transition-all">
                  <Edit3 size={14} /> تعديل
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-sm transition-all">
                    {saving ? <span className="w-3.5 h-3.5 border border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <Check size={14} />}
                    حفظ
                  </button>
                  <button onClick={() => { setEditMode(false); setEditData(profile); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all">
                    <X size={14} /> إلغاء
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {[
                { label: "الاسم الكامل",       key: "full_name", icon: User,   type: "text"  },
                { label: "البريد الإلكتروني",   key: "email",     icon: Mail,   type: "email" },
                { label: "رقم الهاتف",          key: "phone",     icon: Phone,  type: "tel"   },
                { label: "العنوان",              key: "address",   icon: MapPin, type: "text"  },
              ].map(({ label, key, icon: Icon, type }) => (
                <div key={key}>
                  <label className="text-gray-500 text-xs mb-1.5 flex items-center gap-1.5"><Icon size={12} /> {label}</label>
                  {editMode ? (
                    <input type={type} value={editData[key as keyof Profile] as string}
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
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

        {/* ── STORE ORDERS ── */}
        {activeTab === "store" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-sm">{storeOrders.length} طلب</p>
              <a href="/orders" className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">عرض الكل <ArrowLeft size={14} /></a>
            </div>
            {storeOrders.length === 0 ? (
              <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
                <ShoppingBag size={40} className="mx-auto mb-3 text-purple-500/40" />
                لا توجد طلبات من المتجر بعد
              </div>
            ) : storeOrders.map((order) => (
              <a key={order.id} href="/orders" className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between hover:border-purple-500/50 transition-all block">
                <div>
                  <p className="text-sm font-semibold">طلب #{order.id.slice(0, 8)}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString("ar-LY")}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColors[order.status] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* ── SHEIN ORDERS ── */}
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

        {/* ── FAVORITES ── */}
        {activeTab === "favorites" && (
          <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
            <Heart size={40} className="mx-auto mb-3 text-purple-500/40" />
            المفضلة فارغة — أضف منتجات تعجبك!
          </div>
        )}

        {/* ── ADDRESSES TAB ── */}
        {activeTab === "addresses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">مواقع التسليم</h2>
              <button onClick={openAddAddr} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-all">
                + إضافة موقع
              </button>
            </div>

            {addrLoading ? (
              <div className="flex justify-center py-10">
                <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-10 text-center text-gray-500">
                <MapPin size={40} className="mx-auto mb-3 text-purple-500/40" />
                لا توجد مواقع محفوظة — أضف موقعك الأول!
              </div>
            ) : addresses.map((addr) => (
              <div key={addr.id} className={`bg-[#0f1320] border rounded-2xl p-5 transition-all ${addr.is_default ? "border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.15)]" : "border-purple-500/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white">{addr.label}</span>
                        {addr.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                            افتراضي
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed">{addr.address_text}</p>
                      {addr.lat && addr.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-flex items-center gap-1"
                        >
                          📍 عرض على الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!addr.is_default && (
                      <button onClick={() => handleSetDefault(addr.id)} className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all">
                        تعيين افتراضي
                      </button>
                    )}
                    <button onClick={() => openEditAddr(addr)} className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                      تعديل
                    </button>
                    <button onClick={() => handleDeleteAddr(addr.id)} className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Address Modal */}
            {showAddrModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddrModal(false); }}>
                <div className="bg-[#0f1320] border border-purple-500/30 rounded-3xl p-6 w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <h3 className="font-bold text-lg mb-5">{editingAddr ? "تعديل الموقع" : "إضافة موقع جديد"}</h3>

                  <div className="space-y-4">
                    {/* Label */}
                    <div>
                      <label className="text-gray-400 text-xs mb-2 block">تسمية الموقع</label>
                      <div className="flex gap-2 flex-wrap">
                        {ADDRESS_LABELS.map((lbl) => (
                          <button key={lbl} type="button" onClick={() => setAddrForm(f => ({ ...f, label: lbl }))}
                            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${addrForm.label === lbl ? "bg-purple-600 text-white" : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address text */}
                    <div>
                      <label className="text-gray-400 text-xs mb-2 block">العنوان التفصيلي</label>
                      <textarea
                        value={addrForm.address_text}
                        onChange={(e) => setAddrForm(f => ({ ...f, address_text: e.target.value }))}
                        placeholder="مثال: شارع الجمهورية، بنغازي، بجانب مسجد النور"
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all resize-none placeholder:text-gray-600"
                      />
                    </div>

                    {/* GPS */}
                    <div>
                      <label className="text-gray-400 text-xs mb-2 block">الموقع الجغرافي (اختياري)</label>
                      <button type="button" onClick={handleGetGeo} disabled={geoLoading}
                        className="w-full py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-sm font-medium transition-all flex items-center justify-center gap-2 mb-3">
                        {geoLoading
                          ? <><span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> جاري تحديد الموقع...</>
                          : <><MapPin size={15} /> استخدام موقعي الحالي</>}
                      </button>

                      {addrForm.lat && addrForm.lng && (
                        <div className="space-y-2 mb-2">
                          <div className="flex gap-2 items-center text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
                            ✅ تم تحديد الموقع — خط العرض: {addrForm.lat}، خط الطول: {addrForm.lng}
                          </div>
                          <iframe
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(addrForm.lng)-0.01},${parseFloat(addrForm.lat)-0.01},${parseFloat(addrForm.lng)+0.01},${parseFloat(addrForm.lat)+0.01}&layer=mapnik&marker=${addrForm.lat},${addrForm.lng}`}
                            className="w-full rounded-xl border border-purple-500/20"
                            height="160"
                            style={{ border: "none" }}
                            title="map"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-600 text-xs mb-1 block">خط العرض (Lat)</label>
                          <input type="number" step="any" value={addrForm.lat} onChange={(e) => setAddrForm(f => ({ ...f, lat: e.target.value }))}
                            placeholder="32.8872" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500/50" />
                        </div>
                        <div>
                          <label className="text-gray-600 text-xs mb-1 block">خط الطول (Lng)</label>
                          <input type="number" step="any" value={addrForm.lng} onChange={(e) => setAddrForm(f => ({ ...f, lng: e.target.value }))}
                            placeholder="13.1913" className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500/50" />
                        </div>
                      </div>
                    </div>

                    {/* Default */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={addrForm.is_default} onChange={(e) => setAddrForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded accent-purple-500" />
                      <span className="text-sm text-gray-300">تعيين كعنوان افتراضي</span>
                    </label>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button onClick={handleSaveAddr} disabled={addrSaving || !addrForm.address_text.trim()}
                      className="flex-1 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm">
                      {addrSaving ? "⏳ جاري الحفظ..." : "حفظ الموقع"}
                    </button>
                    <button onClick={() => setShowAddrModal(false)}
                      className="px-5 py-3 rounded-2xl font-medium text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm">
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* تغيير كلمة المرور */}
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">🔒 تغيير كلمة المرور</h2>
              <p className="text-gray-500 text-sm mb-5">يجب أن تكون 6 أحرف على الأقل</p>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">كلمة المرور الجديدة</label>
                  <input type="password" value={pwData.next} onChange={e => setPwData(d => ({ ...d, next: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                </div>
                <div>
                  <label className="text-gray-500 text-xs mb-1.5 block">تأكيد كلمة المرور</label>
                  <input type="password" value={pwData.confirm} onChange={e => setPwData(d => ({ ...d, confirm: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                </div>
              </div>
              {pwError && <p className="text-red-400 text-sm mt-3">⚠️ {pwError}</p>}
              <button onClick={handlePwChange} disabled={pwSaving}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {pwSaving ? "⏳ جاري التغيير..." : pwDone ? "✅ تم تغيير كلمة المرور" : "تغيير كلمة المرور"}
              </button>
            </div>

            {/* تعديل بيانات الحساب */}
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">✏️ بيانات الحساب</h2>
              <p className="text-gray-500 text-sm mb-5">تعديل الاسم ورقم الهاتف والعنوان</p>
              <div className="space-y-3">
                {[
                  { label: "الاسم الكامل", key: "full_name", type: "text" },
                  { label: "رقم الهاتف",   key: "phone",     type: "tel"  },
                  { label: "العنوان",       key: "address",   type: "text" },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-gray-500 text-xs mb-1.5 block">{label}</label>
                    <input type={type} value={editData[key as keyof Profile] as string}
                      onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "⏳ جاري الحفظ..." : "حفظ التغييرات"}
              </button>
            </div>

            {/* الصورة الشخصية */}
            <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">📸 الصورة الشخصية</h2>
              <p className="text-gray-500 text-sm mb-5">اضغط على الصورة أو زر التغيير لرفع صورة جديدة</p>
              <div className="flex items-center gap-5">
                <div className="relative group cursor-pointer" onClick={() => !uploading && fileRef.current?.click()}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/40" onError={() => setAvatarUrl("")} />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-3xl font-black shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                      {profile.full_name?.[0]?.toUpperCase() || "؟"}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={20} className="text-white" />}
                  </div>
                </div>
                <button onClick={() => !uploading && fileRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 text-sm font-medium transition-all">
                  {uploading ? "⏳ جاري الرفع..." : "تغيير الصورة"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
