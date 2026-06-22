"use client";

import { useState } from "react";
import { Eye, EyeOff, UserPlus, Zap, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        setError("هذا البريد الإلكتروني مسجّل مسبقاً");
      } else {
        setError("حدث خطأ أثناء إنشاء الحساب، حاول مرة أخرى");
      }
      setLoading(false);
      return;
    }

    // إدخال البيانات في جدول profiles
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: fullName,
        phone,
        email,
      });
    }

    setSuccess(true);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    setGoogleLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4">
        <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md relative">
          <div className="bg-[var(--surface)] border border-green-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(34,197,94,0.1)] text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={56} className="text-green-400" />
            </div>
            <h2 className="text-[var(--text)] font-bold text-xl mb-2">تم إنشاء حسابك بنجاح!</h2>
            <p className="text-[var(--muted)] text-sm leading-relaxed mb-6">
              أرسلنا رسالة تأكيد إلى <span className="text-purple-400 font-semibold">{email}</span>
              <br />يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول
            </p>
            <a
              href="/login"
              className="inline-block w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all"
            >
              الذهاب لتسجيل الدخول
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-4 py-10">
      <div className="fixed top-[-100px] right-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="bg-[var(--surface)] border border-purple-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(168,85,247,0.1)]">

          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              TREND
            </h1>
            <p className="text-[var(--muted-2)] text-sm mt-1">ترند للإلكترونيات</p>
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 mb-6">
            <Zap size={18} className="text-purple-400" />
            <h2 className="text-[var(--text)] font-bold text-lg">إنشاء حساب جديد</h2>
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[var(--border)] bg-white/5 hover:bg-white/10 text-[var(--text)] font-medium text-sm transition-all hover:border-white/20 mb-4 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            التسجيل بحساب جوجل
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-purple-500/20" />
            <span className="text-[var(--muted-2)] text-xs">أو</span>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="محمد علي"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxx"
                required
                className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">كلمة المرور</label>
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

            {/* Confirm Password */}
            <div>
              <label className="text-[var(--muted)] text-sm mb-1.5 block">تأكيد كلمة المرور</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[var(--input)] border border-purple-500/20 text-[var(--text)] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)] hover:text-purple-400 transition-colors"
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                ⚠️ {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 hover:shadow-[0_0_24px_rgba(168,85,247,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  إنشاء الحساب
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[var(--muted-2)] text-sm mt-6">
            لديك حساب بالفعل؟{" "}
            <a href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              سجّل الدخول
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
