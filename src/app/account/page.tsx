"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, MapPin, Mail, Package, Heart, LogOut, Edit3, Check, X, ShoppingBag, ArrowLeft, ShoppingCart, Settings, Camera, Wallet, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";
import MapPicker from "@/components/MapPicker";
import WalletModal from "@/components/WalletModal";

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
const statusLabelsEn: Record<string, string> = {
  pending: "Pending", processing: "Processing",
  shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

const ADDRESS_LABELS = ["المنزل", "العمل", "العائلة", "أخرى"];
const ADDR_LABEL_EN: Record<string, string> = {
  "المنزل": "Home", "العمل": "Work", "العائلة": "Family", "أخرى": "Other",
};

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { count } = useCart();
  const { t, rtl } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const statusText = (s: string) => (rtl ? statusLabels[s] : statusLabelsEn[s]) || s;
  const labelText = (l: string) => t(l, ADDR_LABEL_EN[l] || l);

  const [profile,    setProfile]    = useState<Profile>({ full_name: "", phone: "", email: "", address: "", avatar_url: "" });
  const [editMode,   setEditMode]   = useState(false);
  const [editData,   setEditData]   = useState<Profile>(profile);
  const [saving,     setSaving]     = useState(false);
  const [storeOrders, setStoreOrders] = useState<Order[]>([]);
  const [sheinOrders, setSheinOrders] = useState<Order[]>([]);
  const [activeTab,  setActiveTab]  = useState<"profile" | "store" | "shein" | "favorites" | "addresses" | "settings" | "wallet">("profile");
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

  // Favorites
  type FavoriteItem = { product_id: string; products: { id: string; name: string; price: number; image_url?: string; category: string } };
  const [favorites,    setFavorites]    = useState<FavoriteItem[]>([]);
  const [favLoading,   setFavLoading]   = useState(false);

  // Wallet
  const [walletOpen,   setWalletOpen]   = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Map in address modal
  const [showMap,      setShowMap]      = useState(false);

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
    if (activeTab === "favorites" && user) fetchFavorites();
    if (activeTab === "wallet" && user) fetchWalletBalance();
  }, [activeTab, user]);

  async function fetchFavorites() {
    setFavLoading(true);
    const res = await fetch("/api/favorites");
    const data = await res.json();
    setFavorites(Array.isArray(data) ? data : []);
    setFavLoading(false);
  }

  async function removeFavorite(product_id: string) {
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id }),
    });
    setFavorites(prev => prev.filter(f => f.product_id !== product_id));
  }

  async function fetchWalletBalance() {
    const res = await fetch("/api/wallet");
    const data = await res.json();
    setWalletBalance(data.balance || 0);
  }

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
    if (pwData.next.length < 6)        { setPwError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters")); return; }
    if (pwData.next !== pwData.confirm) { setPwError(t("كلمة المرور وتأكيدها غير متطابقتين", "Passwords do not match")); return; }
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
    if (!confirm(t("حذف هذا العنوان؟", "Delete this address?"))) return;
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
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const tabs = [
    { key: "profile",   label: "بياناتي",      labelEn: "Profile",  icon: User        },
    { key: "store",     label: "طلبات المتجر", labelEn: "Store orders", icon: ShoppingBag },
    { key: "shein",     label: "طلبات شي إن",  labelEn: "Shein orders", icon: Package     },
    { key: "favorites", label: "المفضلة",      labelEn: "Favorites", icon: Heart       },
    { key: "wallet",    label: "محفظتي",       labelEn: "Wallet",   icon: Wallet      },
    { key: "addresses", label: "مواقعي",       labelEn: "Addresses", icon: MapPin      },
    { key: "settings",  label: "الإعدادات",    labelEn: "Settings", icon: Settings    },
  ] as const;

  return (
    <>
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      <div className="fixed top-[-150px] right-[-150px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-purple-500/20 px-4 md:px-6 py-4 flex items-center justify-between bg-[var(--glass)] backdrop-blur-md sticky top-0 z-40">
        <a href="/" className="text-2xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          TREND
        </a>
        <div className="flex items-center gap-3">
          <a href="/cart" className="relative text-[var(--muted)] hover:text-purple-400 transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-[var(--text)] flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </a>
          <LangToggle className="!w-9 !h-9" />
          <button onClick={signOut} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm">
            <LogOut size={16} />
            <span className="hidden md:inline">{t("تسجيل الخروج", "Sign out")}</span>
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
              {uploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={18} className="text-[var(--text)]" />}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div>
            <h1 className="text-xl font-bold">{profile.full_name || t("مستخدم", "User")}</h1>
            <p className="text-[var(--muted-2)] text-sm">{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(({ key, label, labelEn, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === key
                  ? "bg-purple-600 text-[var(--text)] shadow-[0_0_14px_rgba(168,85,247,0.4)]"
                  : "bg-white/5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/10 border border-[var(--border)]"
              }`}>
              <Icon size={14} />
              {rtl ? label : labelEn}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">{t("البيانات الشخصية", "Personal details")}</h2>
              {!editMode ? (
                <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-sm transition-all">
                  <Edit3 size={14} /> {t("تعديل", "Edit")}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-sm transition-all">
                    {saving ? <span className="w-3.5 h-3.5 border border-green-400/30 border-t-green-400 rounded-full animate-spin" /> : <Check size={14} />}
                    {t("حفظ", "Save")}
                  </button>
                  <button onClick={() => { setEditMode(false); setEditData(profile); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-all">
                    <X size={14} /> {t("إلغاء", "Cancel")}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {[
                { label: t("الاسم الكامل", "Full name"),     key: "full_name", icon: User,   type: "text"  },
                { label: t("البريد الإلكتروني", "Email"),     key: "email",     icon: Mail,   type: "email" },
                { label: t("رقم الهاتف", "Phone number"),     key: "phone",     icon: Phone,  type: "tel"   },
                { label: t("العنوان", "Address"),             key: "address",   icon: MapPin, type: "text"  },
              ].map(({ label, key, icon: Icon, type }) => (
                <div key={key}>
                  <label className="text-[var(--muted-2)] text-xs mb-1.5 flex items-center gap-1.5"><Icon size={12} /> {label}</label>
                  {editMode ? (
                    <input type={type} value={editData[key as keyof Profile] as string}
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                  ) : (
                    <p className="px-4 py-2.5 rounded-xl bg-black/20 border border-[var(--border)] text-sm text-[var(--muted)]">
                      {editData[key as keyof Profile] || <span className="text-[var(--muted-2)]">{t("غير محدد", "Not set")}</span>}
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
              <p className="text-[var(--muted-2)] text-sm">{storeOrders.length} {t("طلب", "orders")}</p>
              <a href="/orders" className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">{t("عرض الكل", "View all")} <ArrowLeft size={14} /></a>
            </div>
            {storeOrders.length === 0 ? (
              <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-10 text-center text-[var(--muted-2)]">
                <ShoppingBag size={40} className="mx-auto mb-3 text-purple-500/40" />
                {t("لا توجد طلبات من المتجر بعد", "No store orders yet")}
              </div>
            ) : storeOrders.map((order) => (
              <a key={order.id} href="/orders" className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between hover:border-purple-500/50 transition-all block">
                <div>
                  <p className="text-sm font-semibold">{t("طلب", "Order")} #{order.id.slice(0, 8)}</p>
                  <p className="text-[var(--muted-2)] text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColors[order.status] || "bg-gray-500/20 text-[var(--muted)] border-gray-500/30"}`}>
                  {statusText(order.status)}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* ── SHEIN ORDERS ── */}
        {activeTab === "shein" && (
          <div className="space-y-3">
            {sheinOrders.length === 0 ? (
              <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-10 text-center text-[var(--muted-2)]">
                <Package size={40} className="mx-auto mb-3 text-purple-500/40" />
                {t("لا توجد طلبات شي إن بعد", "No Shein orders yet")}
              </div>
            ) : sheinOrders.map((order) => (
              <div key={order.id} className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{t("طلب", "Order")} #{order.id.toString().slice(0, 8)}</p>
                  <p className="text-[var(--muted-2)] text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString(rtl ? "ar-LY" : "en-GB")}</p>
                  {order.price && <p className="text-purple-400 text-xs mt-0.5">{order.price} $</p>}
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${statusColors[order.status] || "bg-gray-500/20 text-[var(--muted)] border-gray-500/30"}`}>
                  {statusText(order.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── FAVORITES ── */}
        {activeTab === "favorites" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[var(--muted-2)] text-sm">{favorites.length} {t("منتج محفوظ", "saved")}</p>
              <a href="/products" className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                {t("تصفح المنتجات", "Browse products")} <ArrowLeft size={14} />
              </a>
            </div>
            {favLoading ? (
              <div className="flex justify-center py-10">
                <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-10 text-center text-[var(--muted-2)]">
                <Heart size={40} className="mx-auto mb-3 text-purple-500/40" />
                <p>{t("المفضلة فارغة", "No favorites yet")}</p>
                <p className="text-xs mt-1 text-[var(--muted-2)]">{t("أضف منتجات تعجبك من صفحة المنتج", "Add products you like from the product page")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {favorites.map(fav => {
                  const p = fav.products;
                  if (!p) return null;
                  return (
                    <div key={fav.product_id} className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all relative group">
                      <button
                        onClick={() => removeFavorite(fav.product_id)}
                        className="absolute top-2 left-2 z-10 w-7 h-7 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/40 transition-all shadow-sm"
                      >
                        <Trash2 size={12} />
                      </button>
                      <a href={`/products/${p.id}`}>
                        <div className="aspect-square bg-[var(--input)] overflow-hidden">
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            : <div className="w-full h-full flex items-center justify-center text-purple-400/20"><Package size={28} /></div>
                          }
                        </div>
                        <div className="p-2.5 space-y-1">
                          <p className="text-xs font-semibold text-[var(--text)] leading-tight line-clamp-2">{p.name}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-sm bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{p.price} د</span>
                            <span className="text-[10px] text-purple-400/60">{p.category}</span>
                          </div>
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── WALLET ── */}
        {activeTab === "wallet" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-purple-900/60 to-blue-900/40 border border-purple-500/30 rounded-2xl p-6">
              <p className="text-[var(--muted)] text-xs mb-1">{t("الرصيد الحالي", "Current balance")}</p>
              <p className="text-3xl font-black bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                {walletBalance !== null ? walletBalance.toFixed(2) : "—"} <span className="text-lg">{t("د", "LYD")}</span>
              </p>
              <p className="text-[var(--muted-2)] text-xs mt-1">{t("دينار ليبي", "Libyan Dinar")}</p>
            </div>
            <button
              onClick={() => setWalletOpen(true)}
              className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Wallet size={18} />
              {t("شحن الرصيد", "Top up")}
            </button>
            <p className="text-[var(--muted-2)] text-xs text-center">{t("يمكنك شحن رصيد المحفظة واستخدامه لتسديد طلباتك", "Top up your wallet balance and use it to pay for your orders")}</p>
          </div>
        )}

        {/* ── ADDRESSES TAB ── */}
        {activeTab === "addresses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{t("مواقع التسليم", "Delivery locations")}</h2>
              <button onClick={openAddAddr} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-[var(--text)] text-sm font-medium transition-all">
                + {t("إضافة موقع", "Add location")}
              </button>
            </div>

            {addrLoading ? (
              <div className="flex justify-center py-10">
                <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-10 text-center text-[var(--muted-2)]">
                <MapPin size={40} className="mx-auto mb-3 text-purple-500/40" />
                {t("لا توجد مواقع محفوظة — أضف موقعك الأول!", "No saved locations — add your first one!")}
              </div>
            ) : addresses.map((addr) => (
              <div key={addr.id} className={`bg-[var(--surface)] border rounded-2xl p-5 transition-all ${addr.is_default ? "border-purple-500/60 shadow-[0_0_16px_rgba(168,85,247,0.15)]" : "border-purple-500/20"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-[var(--text)]">{labelText(addr.label)}</span>
                        {addr.is_default && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium">
                            {t("افتراضي", "Default")}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--muted)] text-sm leading-relaxed">{addr.address_text}</p>
                      {addr.lat && addr.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 mt-1 inline-flex items-center gap-1"
                        >
                          📍 {t("عرض على الخريطة", "View on map")}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!addr.is_default && (
                      <button onClick={() => handleSetDefault(addr.id)} className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all">
                        {t("تعيين افتراضي", "Set default")}
                      </button>
                    )}
                    <button onClick={() => openEditAddr(addr)} className="text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/10 transition-all">
                      {t("تعديل", "Edit")}
                    </button>
                    <button onClick={() => handleDeleteAddr(addr.id)} className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                      {t("حذف", "Delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Address Modal */}
            {showAddrModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAddrModal(false); }}>
                <div className="bg-[var(--surface)] border border-purple-500/30 rounded-3xl p-6 w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                  <h3 className="font-bold text-lg mb-5">{editingAddr ? t("تعديل الموقع", "Edit location") : t("إضافة موقع جديد", "Add new location")}</h3>

                  <div className="space-y-4">
                    {/* Label */}
                    <div>
                      <label className="text-[var(--muted)] text-xs mb-2 block">{t("تسمية الموقع", "Location label")}</label>
                      <div className="flex gap-2 flex-wrap">
                        {ADDRESS_LABELS.map((lbl) => (
                          <button key={lbl} type="button" onClick={() => setAddrForm(f => ({ ...f, label: lbl }))}
                            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${addrForm.label === lbl ? "bg-purple-600 text-[var(--text)]" : "bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`}>
                            {labelText(lbl)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Address text */}
                    <div>
                      <label className="text-[var(--muted)] text-xs mb-2 block">{t("العنوان التفصيلي", "Detailed address")}</label>
                      <textarea
                        value={addrForm.address_text}
                        onChange={(e) => setAddrForm(f => ({ ...f, address_text: e.target.value }))}
                        placeholder={t("مثال: شارع الجمهورية، بنغازي، بجانب مسجد النور", "e.g. Al-Jumhuriya St, Benghazi, next to Al-Nour Mosque")}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all resize-none placeholder:text-[var(--muted-2)]"
                      />
                    </div>

                    {/* GPS / Map */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[var(--muted)] text-xs">{t("الموقع الجغرافي (اختياري)", "GPS location (optional)")}</label>
                        <button type="button" onClick={() => setShowMap(!showMap)}
                          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                          <MapPin size={12} />
                          {showMap ? t("إخفاء الخريطة", "Hide map") : t("اختيار من الخريطة", "Pick on map")}
                        </button>
                      </div>

                      {showMap && (
                        <div className="mb-3">
                          <MapPicker
                            lat={addrForm.lat ? parseFloat(addrForm.lat) : undefined}
                            lng={addrForm.lng ? parseFloat(addrForm.lng) : undefined}
                            onSelect={({ lat, lng, address }) => {
                              setAddrForm(f => ({
                                ...f,
                                lat: lat.toFixed(6),
                                lng: lng.toFixed(6),
                                address_text: address && !f.address_text ? address.split(",")[0] : f.address_text,
                              }));
                            }}
                          />
                        </div>
                      )}

                      {addrForm.lat && addrForm.lng && (
                        <div className="flex gap-2 items-center text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-2">
                          ✅ {t("موقع محدد:", "Location set:")} {parseFloat(addrForm.lat).toFixed(4)}، {parseFloat(addrForm.lng).toFixed(4)}
                        </div>
                      )}
                    </div>

                    {/* Default */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={addrForm.is_default} onChange={(e) => setAddrForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4 rounded accent-purple-500" />
                      <span className="text-sm text-[var(--muted)]">{t("تعيين كعنوان افتراضي", "Set as default address")}</span>
                    </label>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button onClick={handleSaveAddr} disabled={addrSaving || !addrForm.address_text.trim()}
                      className="flex-1 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 text-sm">
                      {addrSaving ? t("⏳ جاري الحفظ...", "⏳ Saving...") : t("حفظ الموقع", "Save location")}
                    </button>
                    <button onClick={() => setShowAddrModal(false)}
                      className="px-5 py-3 rounded-2xl font-medium text-[var(--muted)] bg-white/5 border border-[var(--border)] hover:bg-white/10 transition-all text-sm">
                      {t("إلغاء", "Cancel")}
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
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">🔒 {t("تغيير كلمة المرور", "Change password")}</h2>
              <p className="text-[var(--muted-2)] text-sm mb-5">{t("يجب أن تكون 6 أحرف على الأقل", "Must be at least 6 characters")}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[var(--muted-2)] text-xs mb-1.5 block">{t("كلمة المرور الجديدة", "New password")}</label>
                  <input type="password" value={pwData.next} onChange={e => setPwData(d => ({ ...d, next: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                </div>
                <div>
                  <label className="text-[var(--muted-2)] text-xs mb-1.5 block">{t("تأكيد كلمة المرور", "Confirm password")}</label>
                  <input type="password" value={pwData.confirm} onChange={e => setPwData(d => ({ ...d, confirm: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                </div>
              </div>
              {pwError && <p className="text-red-400 text-sm mt-3">⚠️ {pwError}</p>}
              <button onClick={handlePwChange} disabled={pwSaving}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {pwSaving ? t("⏳ جاري التغيير...", "⏳ Changing...") : pwDone ? t("✅ تم تغيير كلمة المرور", "✅ Password changed") : t("تغيير كلمة المرور", "Change password")}
              </button>
            </div>

            {/* تعديل بيانات الحساب */}
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">✏️ {t("بيانات الحساب", "Account details")}</h2>
              <p className="text-[var(--muted-2)] text-sm mb-5">{t("تعديل الاسم ورقم الهاتف والعنوان", "Edit your name, phone and address")}</p>
              <div className="space-y-3">
                {[
                  { label: t("الاسم الكامل", "Full name"), key: "full_name", type: "text" },
                  { label: t("رقم الهاتف", "Phone number"), key: "phone",   type: "tel"  },
                  { label: t("العنوان", "Address"),         key: "address",  type: "text" },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-[var(--muted-2)] text-xs mb-1.5 block">{label}</label>
                    <input type={type} value={editData[key as keyof Profile] as string}
                      onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
                  </div>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? t("⏳ جاري الحفظ...", "⏳ Saving...") : t("حفظ التغييرات", "Save changes")}
              </button>
            </div>

            {/* الصورة الشخصية */}
            <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 md:p-6">
              <h2 className="font-bold text-lg mb-1">📸 {t("الصورة الشخصية", "Profile picture")}</h2>
              <p className="text-[var(--muted-2)] text-sm mb-5">{t("اضغط على الصورة أو زر التغيير لرفع صورة جديدة", "Click the photo or the change button to upload a new picture")}</p>
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
                    {uploading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera size={20} className="text-[var(--text)]" />}
                  </div>
                </div>
                <button onClick={() => !uploading && fileRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 text-sm font-medium transition-all">
                  {uploading ? t("⏳ جاري الرفع...", "⏳ Uploading...") : t("تغيير الصورة", "Change picture")}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </>
  );
}
