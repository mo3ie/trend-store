"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PERMISSION_LABELS: Record<string, string> = {
  shein_view_orders: "عرض طلبات شي إن",
  shein_change_status: "تغيير حالة الطلب",
  shein_delete_orders: "حذف طلبات شي إن",
  shein_set_shipping: "تحديد سعر الشحن",
  shein_edit_exchange_rate: "تعديل سعر الدولار",
  store_view_orders: "عرض طلبات المتجر",
  store_manage_products: "إدارة المنتجات",
  store_view_customers: "عرض العملاء",
};

type Employee = {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  permissions: Record<string, boolean> | null;
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", data.session.user.id).single();

      if (profile?.role !== "admin") { router.push("/admin"); return; }

      setToken(data.session.access_token);
      fetchEmployees(data.session.access_token);
    };
    init();
  }, []);

  async function fetchEmployees(t: string) {
    setLoading(true);
    // Use the shein-order-site API is on a different domain, so we use supabaseAdmin directly via our own API
    const res = await fetch("/api/admin/employees", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const result = await res.json();
    setEmployees(result.data || []);
    setLoading(false);
  }

  async function createEmployee() {
    setFormError("");
    if (!form.email || !form.full_name || !form.password) {
      setFormError("جميع الحقول مطلوبة");
      return;
    }
    setFormLoading(true);
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setFormLoading(false);
    if (!res.ok) { setFormError(result.error || "حدث خطأ"); return; }
    setShowModal(false);
    setForm({ email: "", full_name: "", password: "" });
    fetchEmployees(token!);
  }

  async function updatePermission(employeeId: string, key: string, value: boolean) {
    setSaving(s => ({ ...s, [employeeId]: true }));
    const current = employees.find(e => e.id === employeeId)?.permissions || {};
    await fetch(`/api/admin/employees/${employeeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...current, [key]: value }),
    });
    setEmployees(prev => prev.map(e =>
      e.id === employeeId
        ? { ...e, permissions: { ...(e.permissions || {}), [key]: value } }
        : e
    ));
    setSaving(s => ({ ...s, [employeeId]: false }));
  }

  async function removeEmployee(id: string) {
    if (!confirm("هل تريد إزالة هذا الموظف؟")) return;
    await fetch(`/api/admin/employees/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setEmployees(prev => prev.filter(e => e.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0b0f1a]">
      <p className="text-gray-500">⏳ جاري التحميل...</p>
    </div>
  );

  return (
    <div className="p-8 min-h-screen bg-[#0b0f1a] text-white" dir="rtl">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-purple-500/20">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            إدارة الموظفين
          </h1>
          <p className="text-gray-600 text-sm mt-1">{employees.length} موظف</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors text-sm"
        >
          + إضافة موظف
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-lg">لا يوجد موظفون بعد</p>
          <p className="text-sm mt-1">اضغط "+ إضافة موظف" للبدء</p>
        </div>
      ) : (
        <div className="grid gap-5">
          {employees.map(emp => (
            <div key={emp.id} className="bg-[#0f1320] border border-purple-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-bold text-lg">{emp.full_name}</p>
                  <p className="text-gray-500 text-sm">موظف</p>
                </div>
                <div className="flex items-center gap-3">
                  {saving[emp.id] && <span className="text-purple-400 text-xs">⏳ جاري الحفظ...</span>}
                  <button
                    onClick={() => removeEmployee(emp.id)}
                    className="px-4 py-1.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
                  >
                    إزالة
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                  const val = emp.permissions?.[key] ?? false;
                  return (
                    <button
                      key={key}
                      onClick={() => updatePermission(emp.id, key, !val)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm text-right transition-all ${
                        val
                          ? "border-purple-500/40 bg-purple-600/15 text-white"
                          : "border-white/5 bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${val ? "border-purple-400 bg-purple-500" : "border-gray-600"}`}>
                        {val && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0f1320] border border-purple-500/30 rounded-2xl p-8 w-[380px]">
            <h2 className="text-xl font-bold mb-5">إضافة موظف جديد</h2>
            {formError && (
              <p className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-2.5 text-sm mb-4">⚠️ {formError}</p>
            )}
            <input
              placeholder="الاسم الكامل"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/20 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 text-sm mb-3"
            />
            <input
              placeholder="البريد الإلكتروني"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/20 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 text-sm mb-3"
            />
            <input
              placeholder="كلمة المرور"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/20 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 text-sm mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={createEmployee}
                disabled={formLoading}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {formLoading ? "⏳ جاري الإنشاء..." : "إنشاء حساب"}
              </button>
              <button
                onClick={() => { setShowModal(false); setFormError(""); }}
                className="px-5 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/10 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
