"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  old_price?: number | null;
  stock: number;
  category: string;
  image_url?: string;
  description?: string;
};

const categories = ["الكل", "هواتف", "لابتوبات", "بلايستيشن", "إكسسوارات"];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("الكل");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let result = products;
    if (activeCategory !== "الكل") result = result.filter((p) => p.category === activeCategory);
    if (search) result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    setFiltered(result);
  }, [products, activeCategory, search]);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    // quantity is canonical; legacy stock column lingers at 0, so prefer quantity.
    setProducts((data || []).map((p: any) => ({ ...p, stock: p.quantity ?? p.stock })));
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    setDeleting(id);
    // Through the admin API (service role). The browser client is blocked by RLS,
    // which made the delete fail silently and the product reappear on refresh.
    const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (r.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
    else alert((await r.json().catch(() => ({}))).error || "تعذّر حذف المنتج");
    setDeleting(null);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-[var(--muted-2)] text-sm mt-0.5">{products.length} منتج</p>
        </div>
        <a
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-bold hover:shadow-[0_0_18px_rgba(168,85,247,0.5)] transition-all"
        >
          <Plus size={16} />
          إضافة منتج
        </a>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن منتج..."
            className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-[var(--surface)] border border-purple-500/20 text-sm text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-purple-600 text-[var(--text)]"
                  : "bg-[var(--surface)] border border-purple-500/20 text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] border border-purple-500/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--muted-2)]">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[var(--muted-2)]">لا توجد منتجات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--muted-2)] text-xs border-b border-[var(--border)]">
                  <th className="text-right px-5 py-3 font-medium">المنتج</th>
                  <th className="text-right px-5 py-3 font-medium">التصنيف</th>
                  <th className="text-right px-5 py-3 font-medium">السعر <span className="font-normal">(قبل التخفيض ← الآن)</span></th>
                  <th className="text-right px-5 py-3 font-medium">الكمية</th>
                  <th className="text-right px-5 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-[var(--border)] hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs">صورة</div>
                        )}
                        <div>
                          <p className="font-medium text-[var(--text)]">{product.name}</p>
                          {product.description && <p className="text-[var(--muted-2)] text-xs truncate max-w-[180px]">{product.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 text-xs">{product.category}</span>
                    </td>
                    <td className="px-5 py-3.5"><PriceCell product={product} onSaved={(np, op) => setProducts((ps) => ps.map((x) => x.id === product.id ? { ...x, price: np, old_price: op } : x))} /></td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${product.stock === 0 ? "text-red-400" : product.stock < 5 ? "text-yellow-400" : "text-green-400"}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/admin/products/${product.id}/3d`}
                          title="استوديو 3D / 360°"
                          className="px-2 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-colors"
                        >
                          3D
                        </a>
                        <a
                          href={`/admin/products/${product.id}/edit`}
                          className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                        >
                          <Pencil size={14} />
                        </a>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={deleting === product.id}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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

/** Quick offer-day pricing: "before" (struck through for customers) and the price paid. */
function PriceCell({ product, onSaved }: { product: Product; onSaved: (price: number, old: number | null) => void }) {
  const [price, setPrice] = useState(String(product.price ?? ""));
  const [old, setOld] = useState(product.old_price != null ? String(product.old_price) : "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const dirty = price !== String(product.price ?? "") || old !== (product.old_price != null ? String(product.old_price) : "");
  const pct = Number(old) > Number(price) && Number(price) > 0 ? Math.round((1 - Number(price) / Number(old)) * 100) : 0;

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/products/${product.id}/price`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: Number(price), old_price: old.trim() ? Number(old) : null }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { alert(d.error || "تعذّر حفظ السعر"); return; }
    onSaved(Number(d.product.price), d.product.old_price != null ? Number(d.product.old_price) : null);
    setOk(true); setTimeout(() => setOk(false), 1500);
  }

  const box = "w-20 px-2 py-1.5 rounded-lg bg-[var(--input)] border border-[var(--border)] text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60";
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input type="number" min="0" step="0.01" value={old} onChange={(e) => setOld(e.target.value)} placeholder="قبل" title="السعر قبل التخفيض (فارغ = لا يوجد عرض)" className={`${box} line-through decoration-red-400`} />
      <span className="text-[var(--muted-2)]">←</span>
      <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && dirty) save(); }} title="السعر الحالي (يدفعه الزبون)" className={`${box} font-bold`} />
      {pct > 0 && <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[11px] font-bold" dir="ltr">-{pct}%</span>}
      {dirty && <button onClick={save} disabled={busy || !(Number(price) >= 0) || price === ""} className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold disabled:opacity-50">{busy ? "…" : "حفظ"}</button>}
      {ok && <span className="text-green-500 text-xs font-bold">✓</span>}
    </div>
  );
}
