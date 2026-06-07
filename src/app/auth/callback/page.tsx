"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === "admin" || profile?.role === "employee") {
        document.cookie = `admin_role=${profile.role}; path=/; max-age=86400; SameSite=Lax`;
        router.replace("/admin");
      } else {
        await supabase.auth.signOut();
        router.replace("/login?error=not_authorized");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          border: "3px solid #7c3aed",
          borderTopColor: "transparent",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 20px",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#9ca3af", fontSize: "15px" }}>⏳ جاري تسجيل الدخول...</p>
      </div>
    </div>
  );
}
