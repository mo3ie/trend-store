"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Plus, Trash2, Save, Loader2, Check, Tag } from "lucide-react";
import type { SaleSettings } from "@/lib/sale";

// <input type="datetime-local"> works in the admin's local clock (Libya); store an ISO moment.
const toLocalInput = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(+d)) return ""; const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

type Branch = { name: string; phone: string; addrAr: string; addrEn: string };
type Settings = {
  support_phone?: string;
  branches?: Branch[];
  socials?: { whatsapp?: string; facebook?: string; instagram?: string };
  images?: { hero?: string; offer?: string; shein?: string };
  sale?: SaleSettings;
};

const input = "w-full px-3 py-2.5 rounded-xl bg-[var(--input)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60";
const label = "text-[var(--muted)] text-xs mb-1 block";

export default function AppearancePage() {
  const [s, setS] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/site-settings").then((r) => r.json()).then((d) => { setS(d || {}); setLoading(false); });
  }, []);

  const setImg = (k: "hero" | "offer" | "shein", url: string) => setS((p) => ({ ...p, images: { ...p.images, [k]: url } }));
  const setSale = (patch: Partial<SaleSettings>) => setS((p) => ({ ...p, sale: { ...p.sale, ...patch } }));
  const setSocial = (k: "whatsapp" | "facebook" | "instagram", v: string) => setS((p) => ({ ...p, socials: { ...p.socials, [k]: v } }));

  async function upload(slot: "hero" | "offer" | "shein", file: File) {
    setUploading(slot);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    setUploading(null);
    if (d.url) setImg(slot, d.url); else alert(d.error || "فشل الرفع");
  }

  async function save() {
    setSaving(true); setSaved(false);
    const res = await fetch("/api/site-settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); } else alert("فشل الحفظ");
  }

  const branches = s.branches ?? [];
  const updateBranch = (i: number, patch: Partial<Branch>) => setS((p) => ({ ...p, branches: (p.branches ?? []).map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const addBranch = () => setS((p) => ({ ...p, branches: [...(p.branches ?? []), { name: "", phone: "", addrAr: "", addrEn: "" }] }));
  const removeBranch = (i: number) => setS((p) => ({ ...p, branches: (p.branches ?? []).filter((_, j) => j !== i) }));

  if (loading) return <div className="p-8 text-[var(--muted-2)]">جاري التحميل…</div>;

  const slots: { k: "hero" | "offer" | "shein"; label: string }[] = [
    { k: "hero", label: "صورة البانر الرئيسي (Hero)" },
    { k: "offer", label: "صورة بطاقة العروض" },
    { k: "shein", label: "صورة بطاقة شي إن" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">مظهر الموقع وبيانات التواصل</h1>
        <p className="text-[var(--muted-2)] text-sm mt-0.5">غيّر صور الواجهة وأرقام التواصل والروابط — تظهر مباشرة في الموقع.</p>
      </div>

      {/* White Friday / store offer */}
      <div className="bg-[var(--surface)] border border-red-500/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-bold text-sm flex items-center gap-2"><Tag size={16} className="text-red-400" /> عرض الجمعة البيضاء (بانر كبير + موعد بدء الشراء)</h2>
          <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
            <input type="checkbox" checked={!!s.sale?.enabled} onChange={(e) => setSale({ enabled: e.target.checked })} className="w-4 h-4 accent-red-500" />
            {s.sale?.enabled ? "العرض مفعّل" : "العرض متوقف"}
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><span className={label}>العنوان</span><input className={input} value={s.sale?.title ?? ""} onChange={(e) => setSale({ title: e.target.value })} placeholder="الجمعة البيضاء" /></div>
          <div><span className={label}>السطر الثاني (اختياري)</span><input className={input} value={s.sale?.subtitle ?? ""} onChange={(e) => setSale({ subtitle: e.target.value })} placeholder="تخفيضات على الهواتف واللابتوبات والإكسسوارات" /></div>
          <div><span className={label}>تخفيضات تصل إلى (%)</span><input className={input} type="number" min={0} max={99} value={s.sale?.upTo ?? ""} onChange={(e) => setSale({ upTo: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="50" /></div>
          <div><span className={label}>يبدأ الشراء (قبله يُمنع إتمام الطلب، والسلة متاحة)</span><input className={input} type="datetime-local" value={toLocalInput(s.sale?.opensAt)} onChange={(e) => setSale({ opensAt: fromLocalInput(e.target.value) })} /></div>
          <div><span className={label}>ينتهي العرض (اختياري — يختفي البانر بعده)</span><input className={input} type="datetime-local" value={toLocalInput(s.sale?.endsAt)} onChange={(e) => setSale({ endsAt: fromLocalInput(e.target.value) })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input type="checkbox" checked={s.sale?.limitOne !== false} onChange={(e) => setSale({ limitOne: e.target.checked })} className="w-4 h-4 accent-red-500" />
          قطعة واحدة فقط لكل زبون من كل منتج مخفّض (طوال مدة العرض)
        </label>
        <p className="text-[var(--muted-2)] text-xs leading-6">الأسعار يدوية: من «المنتجات» اكتب «السعر قبل التخفيض» و«السعر الآن» لكل منتج — يظهر القديم مشطوباً مع نسبة الخصم. لإنهاء العرض على منتج امسح «قبل التخفيض». لا تنسَ «حفظ التغييرات» أسفل الصفحة.</p>
      </div>

      {/* images */}
      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-sm flex items-center gap-2"><ImageIcon size={16} className="text-purple-400" /> صور الواجهة</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {slots.map(({ k, label: lb }) => (
            <div key={k} className="space-y-2">
              <span className={label}>{lb}</span>
              <div className="aspect-video rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--input)] grid place-items-center">
                {s.images?.[k] ? <img src={s.images[k]} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-[var(--muted-2)]" />}
              </div>
              <label className="block">
                <span className="text-xs text-purple-400 cursor-pointer hover:underline">{uploading === k ? "جارٍ الرفع…" : "تغيير الصورة"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(k, f); }} />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* support + socials */}
      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 space-y-4">
        <h2 className="font-bold text-sm">رقم الدعم وروابط التواصل</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><span className={label}>رقم الدعم</span><input className={input} value={s.support_phone ?? ""} onChange={(e) => setS((p) => ({ ...p, support_phone: e.target.value }))} placeholder="0918621511" /></div>
          <div><span className={label}>واتساب (رابط أو رقم)</span><input className={input} value={s.socials?.whatsapp ?? ""} onChange={(e) => setSocial("whatsapp", e.target.value)} placeholder="https://wa.me/218..." /></div>
          <div><span className={label}>فيسبوك</span><input className={input} value={s.socials?.facebook ?? ""} onChange={(e) => setSocial("facebook", e.target.value)} placeholder="https://facebook.com/..." /></div>
          <div><span className={label}>إنستغرام</span><input className={input} value={s.socials?.instagram ?? ""} onChange={(e) => setSocial("instagram", e.target.value)} placeholder="https://instagram.com/..." /></div>
        </div>
      </div>

      {/* branches */}
      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm">الفروع والعناوين</h2>
          <button onClick={addBranch} className="text-xs text-purple-400 flex items-center gap-1 hover:underline"><Plus size={14} /> إضافة فرع</button>
        </div>
        {branches.length === 0 && <p className="text-[var(--muted-2)] text-sm">لا توجد فروع — اضغط «إضافة فرع».</p>}
        <div className="space-y-4">
          {branches.map((b, i) => (
            <div key={i} className="border border-[var(--border)] rounded-xl p-4 space-y-3 relative">
              <button onClick={() => removeBranch(i)} className="absolute top-3 left-3 text-red-400 hover:text-red-300"><Trash2 size={15} /></button>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><span className={label}>اسم الفرع</span><input className={input} value={b.name} onChange={(e) => updateBranch(i, { name: e.target.value })} placeholder="قاريونس" /></div>
                <div><span className={label}>الهاتف</span><input className={input} value={b.phone} onChange={(e) => updateBranch(i, { phone: e.target.value })} placeholder="0945798033" /></div>
              </div>
              <div><span className={label}>العنوان (عربي)</span><input className={input} value={b.addrAr} onChange={(e) => updateBranch(i, { addrAr: e.target.value })} /></div>
              <div><span className={label}>العنوان (إنجليزي)</span><input className={input} value={b.addrEn} onChange={(e) => updateBranch(i, { addrEn: e.target.value })} dir="ltr" /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button onClick={save} disabled={saving} className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <Check size={18} /> : <Save size={18} />}
          {saved ? "تم الحفظ" : "حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}
