"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin, Star, Edit3, Trash2, Plus } from "lucide-react";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

interface Address {
  id: string;
  label: string;
  address_text: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

interface Form {
  label: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}

export default function AddressManager() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<Address | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState<Form>({ label: "المنزل", address_text: "", lat: null, lng: null, is_default: false });

  useEffect(() => { loadAddresses(); }, []);

  const loadAddresses = async () => {
    const res  = await fetch("/api/addresses");
    const data = await res.json();
    if (Array.isArray(data)) setAddresses(data);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ label: "المنزل", address_text: "", lat: null, lng: null, is_default: addresses.length === 0 });
    setShowModal(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    setForm({ label: addr.label, address_text: addr.address_text, lat: addr.lat ?? null, lng: addr.lng ?? null, is_default: addr.is_default });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.address_text.trim()) { alert("أدخل العنوان"); return; }
    setSaving(true);
    const method = editing ? "PUT" : "POST";
    const body   = editing ? { id: editing.id, ...form } : form;
    await fetch("/api/addresses", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await loadAddresses();
    setShowModal(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا العنوان؟")) return;
    await fetch("/api/addresses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    await loadAddresses();
  };

  const handleSetDefault = async (addr: Address) => {
    await fetch("/api/addresses", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...addr, is_default: true }) });
    await loadAddresses();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">عناويني</h3>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:opacity-90 transition-opacity">
          <Plus size={15} /> إضافة عنوان
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-10 bg-black/20 rounded-2xl border border-purple-500/10">
          <MapPin size={36} className="mx-auto mb-3 text-purple-500/30" />
          <p className="text-[var(--muted-2)] text-sm">لا توجد عناوين محفوظة بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(addr => (
            <div key={addr.id} className={`bg-[var(--surface)] rounded-2xl p-4 border transition-all ${addr.is_default ? "border-purple-500/60" : "border-purple-500/20"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{addr.label}</span>
                    {addr.is_default && <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">افتراضي</span>}
                  </div>
                  <p className="text-[var(--muted)] text-sm">{addr.address_text}</p>
                  {addr.lat && <p className="text-[var(--muted-2)] text-xs mt-1">📍 {addr.lat.toFixed(4)}, {addr.lng?.toFixed(4)}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr)} title="تعيين افتراضي" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-yellow-500/10 border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-yellow-400 transition-colors">
                      <Star size={13} />
                    </button>
                  )}
                  <button onClick={() => openEdit(addr)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-purple-500/10 border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-purple-400 transition-colors">
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => handleDelete(addr.id)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-5">{editing ? "تعديل العنوان" : "إضافة عنوان جديد"}</h3>

            <div className="space-y-4">
              {/* Label Chips */}
              <div>
                <label className="text-[var(--muted-2)] text-xs mb-2 block">تسمية العنوان</label>
                <div className="flex gap-2">
                  {["المنزل", "العمل", "آخر"].map(lbl => (
                    <button key={lbl} onClick={() => setForm(f => ({ ...f, label: lbl }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all border ${form.label === lbl ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-[var(--border)] bg-white/5 text-[var(--muted)]"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Address Text */}
              <div>
                <label className="text-[var(--muted-2)] text-xs mb-2 block">العنوان كنص</label>
                <input value={form.address_text} onChange={e => setForm(f => ({ ...f, address_text: e.target.value }))}
                  placeholder="مثال: طريق المطار، برج الفاتح، الدور 3"
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all" />
              </div>

              {/* Map */}
              <div>
                <label className="text-[var(--muted-2)] text-xs mb-2 block">الموقع على الخريطة (اختياري)</label>
                <MapPicker lat={form.lat ?? undefined} lng={form.lng ?? undefined} onSelect={({ lat, lng }) => setForm(f => ({ ...f, lat, lng }))} />
              </div>

              {/* Default */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} className="w-4 h-4" />
                <span className="text-[var(--muted)] text-sm">تعيين كعنوان افتراضي</span>
              </label>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
                {saving ? "⏳ جاري الحفظ..." : editing ? "حفظ التعديلات" : "إضافة العنوان"}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors text-sm">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
