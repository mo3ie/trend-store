"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  quantity: number;
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
    setProducts(data || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    setDeleting(id);
    await supabase.from("products").delete().eq("id", id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المنتجات</h1>
          <p className="text-gray-500 text-sm mt-0.5">{products.length} منتج</p>
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
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن منتج..."
            className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-[#0f1320] border border-purple-500/20 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-purple-600 text-white"
                  : "bg-[#0f1320] border border-purple-500/20 text-gray-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f1320] border border-purple-500/20 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-600">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-600">لا توجد منتجات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-right px-5 py-3 font-medium">المنتج</th>
                  <th className="text-right px-5 py-3 font-medium">التصنيف</th>
                  <th className="text-right px-5 py-3 font-medium">السعر</th>
                  <th className="text-right px-5 py-3 font-medium">الكمية</th>
                  <th className="text-right px-5 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs">صورة</div>
                        )}
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          {product.description && <p className="text-gray-500 text-xs truncate max-w-[180px]">{product.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 text-xs">{product.category}</span>
                    </td>
                    <td className="px-5 py-3.5 text-white font-semibold">{product.price} $</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${product.quantity === 0 ? "text-red-400" : product.quantity < 5 ? "text-yellow-400" : "text-green-400"}`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
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
