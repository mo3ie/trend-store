"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, Zap, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/hooks/useCart";

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

export default function LoginPage() {
  const router = useRouter();
  const { count } = useCart();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (error.message.includes("Email not confirmed")) {
        setError("يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من صندوق الوارد");
      } else if (error.message.includes("Too many requests")) {
        setError("محاولات كثيرة جداً، حاول مرة أخرى لاحقاً");
      } else {
        setError("حدث خطأ غير متوقع، حاول مرة أخرى");
      }
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin" || profile?.role === "employee") {
        document.cookie = `admin_role=${profile.role}; path=/; max-age=86400; SameSite=Lax`;
        router.push("/admin");
      } else {
        router.push("/");
      }
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setGoogleLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center px-4 relative">
      <a href="/cart" className="absolute top-5 left-5 text-gray-400 hover:text-purple-400 transition-colors">
        <div className="relative">
          <ShoppingCart size={22} />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-black text-white flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </div>
      </a>
      <div className="fixed top-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative">
        <div className="bg-[#0f1320] border border-purple-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(168,85,247,0.1)]">

          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-widest bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              TREND
            </h1>
            <p className="text-gray-500 text-sm mt-1">ترند للإلكترونيات</p>
          </div>

          {/* Title */}
          <div className="flex items-center gap-2 mb-6">
            <Zap size={18} className="text-purple-400" />
            <h2 className="text-white font-bold text-lg">تسجيل الدخول</h2>
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all hover:border-white/20 mb-4 disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            المتابعة بحساب جوجل
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-purple-500/20" />
            <span className="text-gray-600 text-xs">أو</span>
            <div className="flex-1 h-px bg-purple-500/20" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/20 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-purple-500/20 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/60 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                  <LogIn size={18} />
                  تسجيل الدخول
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            ليس لديك حساب؟{" "}
            <a href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              سجّل الآن
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
