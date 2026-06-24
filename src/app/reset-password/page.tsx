"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // The reset email link opens this page with a recovery session in the URL,
  // which @supabase/ssr/supabase-js picks up automatically. Confirm it exists.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Password must be at least 6 characters")); return; }
    if (password !== confirm) { setError(t("كلمتا المرور غير متطابقتين", "Passwords do not match")); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message.includes("session") ? t("انتهت صلاحية الرابط — اطلب رابطاً جديداً", "The link has expired — request a new one") : t("حدث خطأ، حاول مرة أخرى", "Something went wrong, please try again"));
    } else {
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 relative" dir={rtl ? "rtl" : "ltr"}>
      <div className="absolute top-5 end-5"><LangToggle /></div>
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="bg-[var(--surface)] border border-purple-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(168,85,247,0.1)]">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              TREND
            </h1>
            <p className="text-[var(--muted-2)] text-sm mt-1">{t("ترند للإلكترونيات", "Trend Electronics")}</p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <KeyRound size={18} className="text-purple-400" />
            <h2 className="text-[var(--text)] font-bold text-lg">{t("تعيين كلمة مرور جديدة", "Set a new password")}</h2>
          </div>

          {done ? (
            <div className="text-center py-6">
              <ShieldCheck size={48} className="text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-bold">{t("تم تحديث كلمة المرور بنجاح", "Password updated successfully")}</p>
              <p className="text-[var(--muted-2)] text-sm mt-1">{t("يتم تحويلك لتسجيل الدخول…", "Redirecting you to sign in…")}</p>
            </div>
          ) : !ready ? (
            <p className="text-[var(--muted)] text-sm bg-[var(--input)] border border-purple-500/20 rounded-xl px-4 py-3 text-center">
              {t("افتح هذه الصفحة من رابط الاستعادة المُرسل إلى بريدك. إن لم يصل، اطلب رابطاً جديداً من صفحة الدخول.", "Open this page from the reset link sent to your email. If it didn't arrive, request a new one from the sign-in page.")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[var(--muted)] text-sm mb-1.5 block">{t("كلمة المرور الجديدة", "New password")}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)] hover:text-purple-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[var(--muted)] text-sm mb-1.5 block">{t("تأكيد كلمة المرور", "Confirm password")}</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                  ⚠️ {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound size={18} />
                    {t("حفظ كلمة المرور", "Save password")}
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-center text-[var(--muted-2)] text-sm mt-6">
            <a href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              {t("العودة لتسجيل الدخول", "Back to sign in")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
