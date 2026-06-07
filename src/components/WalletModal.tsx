"use client";

import { useState, useEffect } from "react";
import { Wallet, X, ArrowDownCircle, ArrowUpCircle, Phone, Hash } from "lucide-react";

type Transaction = {
  id: string;
  amount: number;
  type: "credit" | "debit";
  method: string;
  status: string;
  note?: string;
  created_at: string;
};

const DPAY_METHODS = [
  { id: "edfali",     label: "ادفع لي",   icon: "🏧", needsPhone: true,  desc: "محفظة ادفع لي" },
  { id: "mobicash",   label: "موبي كاش",   icon: "📱", needsPhone: false, desc: "محفظة موبي كاش" },
  { id: "moamalat",   label: "معاملات",    icon: "💳", needsPhone: false, desc: "بوابة معاملات" },
  { id: "yousrpay",   label: "يسر باي",   icon: "💰", needsPhone: false, desc: "بوابة يسر باي" },
];

const OTHER_METHODS = [
  { id: "prepaid_card", label: "كرت شحن",  icon: "🎫", desc: "كرت شحن مسبق الدفع" },
];

const ALL_METHODS = [...DPAY_METHODS, ...OTHER_METHODS];

const METHOD_LABELS: Record<string, string> = {
  mobicash: "موبي كاش", masrefypay: "مصرفي", edfali: "ادفع لي",
  prepaid_card: "كرت شحن", cash: "نقداً", moamalat: "معاملات",
  yousrpay: "يسر باي", credit: "إيداع", debit: "سحب",
};

function timeStr(iso: string) {
  return new Date(iso).toLocaleDateString("ar-LY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props { onClose: () => void; }

export default function WalletModal({ onClose }: Props) {
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<"overview" | "recharge">("overview");

  const [method,      setMethod]      = useState("");
  const [amount,      setAmount]      = useState("");
  const [phone,       setPhone]       = useState("");
  const [reference,   setReference]   = useState("");
  const [recharging,  setRecharging]  = useState(false);
  const [rechMsg,     setRechMsg]     = useState("");

  useEffect(() => {
    fetch("/api/wallet")
      .then(r => r.json())
      .then(d => { setBalance(d.balance || 0); setTransactions(d.transactions || []); })
      .finally(() => setLoading(false));
  }, []);

  const selectedMethod = ALL_METHODS.find(m => m.id === method);
  const isDpay = DPAY_METHODS.some(m => m.id === method);

  async function handleRecharge() {
    setRechMsg("");
    if (!method) { setRechMsg("يرجى اختيار طريقة الشحن"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt < 5) { setRechMsg("الحد الأدنى للشحن 5 د"); return; }
    if (method === "edfali" && !phone.trim()) { setRechMsg("يرجى إدخال رقم هاتف ادفع لي"); return; }
    if (method === "prepaid_card" && !reference.trim()) { setRechMsg("يرجى إدخال رقم الكرت"); return; }

    setRecharging(true);

    if (isDpay) {
      try {
        const r = await fetch("/api/wallet/topup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amt, method, phone: phone.trim() || undefined }),
        });
        const d = await r.json();
        if (!r.ok || !d.payment_link) {
          setRechMsg(d.error || "فشل إنشاء جلسة الدفع");
          setRecharging(false);
          return;
        }
        window.location.href = d.payment_link;
      } catch {
        setRechMsg("خطأ في الاتصال بالخادم");
        setRecharging(false);
      }
      return;
    }

    // Prepaid card
    try {
      const r = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method, reference: reference.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) { setRechMsg(d.error || "فشل الطلب"); return; }
      setRechMsg("✅ تم شحن المحفظة بنجاح!");
      setAmount(""); setReference(""); setMethod("");
      const fresh = await fetch("/api/wallet").then(r => r.json());
      setBalance(fresh.balance || 0);
      setTransactions(fresh.transactions || []);
    } finally {
      setRecharging(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0f1320] border border-purple-500/30 rounded-3xl w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.7)] flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-500/15 shrink-0">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-purple-400" />
            <span className="font-bold">محفظتي</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Balance card */}
        <div className="mx-5 mt-4 p-5 rounded-2xl bg-gradient-to-br from-purple-900/60 to-blue-900/40 border border-purple-500/30 shrink-0">
          <p className="text-gray-400 text-xs mb-1">الرصيد الحالي</p>
          {loading ? (
            <div className="h-9 w-24 bg-white/10 rounded-xl animate-pulse" />
          ) : (
            <p className="text-3xl font-black bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              {balance.toFixed(2)} <span className="text-lg">د</span>
            </p>
          )}
          <p className="text-gray-500 text-xs mt-2">دينار ليبي</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 mt-4 shrink-0">
          {(["overview", "recharge"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              {t === "overview" ? "المعاملات" : "شحن الرصيد"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">

          {tab === "overview" && (
            <>
              {loading ? (
                <div className="py-8 text-center text-gray-600 text-sm">جاري التحميل...</div>
              ) : transactions.length === 0 ? (
                <div className="py-10 text-center text-gray-600">
                  <Wallet size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">لا توجد معاملات بعد</p>
                  <button onClick={() => setTab("recharge")}
                    className="mt-3 px-4 py-2 rounded-xl bg-purple-600/20 text-purple-400 text-sm hover:bg-purple-600/30 transition-colors">
                    شحن الرصيد الآن
                  </button>
                </div>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === "credit" ? "bg-green-500/15" : "bg-red-500/15"
                    }`}>
                      {tx.type === "credit"
                        ? <ArrowDownCircle size={18} className="text-green-400" />
                        : <ArrowUpCircle size={18} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{tx.note || METHOD_LABELS[tx.method] || tx.method}</p>
                      <p className="text-xs text-gray-500">{timeStr(tx.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-sm ${tx.type === "credit" ? "text-green-400" : "text-red-400"}`}>
                        {tx.type === "credit" ? "+" : "-"}{tx.amount} د
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        tx.status === "completed" ? "bg-green-500/15 text-green-400"
                        : tx.status === "failed"   ? "bg-red-500/15 text-red-400"
                        : "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {tx.status === "completed" ? "مكتمل" : tx.status === "failed" ? "فشل" : "معلق"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "recharge" && (
            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">المبلغ (د.ل)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="أدخل المبلغ"
                  min="5"
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                />
                <div className="flex gap-2 mt-2">
                  {[20, 50, 100, 200].map(v => (
                    <button key={v} type="button" onClick={() => setAmount(v.toString())}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        amount === v.toString() ? "bg-purple-600 text-white" : "bg-white/5 text-gray-400 border border-white/10 hover:text-white"
                      }`}>
                      {v} د
                    </button>
                  ))}
                </div>
              </div>

              {/* Method */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">طريقة الشحن</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_METHODS.map(m => (
                    <button key={m.id} type="button" onClick={() => { setMethod(m.id); setRechMsg(""); setPhone(""); }}
                      className={`p-3 rounded-xl text-right transition-all border ${
                        method === m.id
                          ? "bg-purple-600/20 border-purple-500/60 text-white"
                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                      }`}>
                      <span className="text-lg">{m.icon}</span>
                      <p className="text-xs font-semibold mt-1">{m.label}</p>
                      <p className="text-[10px] text-gray-500">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone for edfali */}
              {method === "edfali" && (
                <div>
                  <label className="text-gray-400 text-xs mb-2 flex items-center gap-1 block">
                    <Phone size={12} /> رقم هاتف ادفع لي
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>
              )}

              {/* Reference for prepaid card */}
              {method === "prepaid_card" && (
                <div>
                  <label className="text-gray-400 text-xs mb-2 flex items-center gap-1 block">
                    <Hash size={12} /> رقم الكرت
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="أدخل رقم كرت الشحن"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/30 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all font-mono"
                  />
                </div>
              )}

              {/* DPay info banner */}
              {isDpay && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2">
                  <span className="text-base shrink-0">⚡</span>
                  <p>ستنتقل إلى صفحة الدفع الآمنة لإتمام عملية شحن المحفظة عبر {selectedMethod?.label}. سيتم إضافة الرصيد تلقائياً بعد التأكيد.</p>
                </div>
              )}

              {rechMsg && (
                <p className={`text-sm p-3 rounded-xl border ${
                  rechMsg.startsWith("✅")
                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                  {rechMsg}
                </p>
              )}

              <button
                onClick={handleRecharge}
                disabled={recharging}
                className="w-full py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {recharging ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري...</>
                ) : isDpay ? (
                  <>⚡ انتقل للدفع {amount ? `— ${amount} د` : ""}</>
                ) : (
                  <>شحن {amount ? `${amount} د` : ""}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
