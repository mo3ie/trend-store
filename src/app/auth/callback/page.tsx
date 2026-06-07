"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

async function handleSession(session: any, router: ReturnType<typeof useRouter>) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role === "admin" || profile?.role === "employee") {
    document.cookie = `admin_role=${profile.role}; path=/; max-age=86400; SameSite=Lax`;
    router.replace("/admin");
  } else {
    router.replace("/");
  }
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // First: check if session already exists (hash tokens already parsed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        handleSession(session, router);
        return;
      }

      // Fallback: wait for onAuthStateChange (SIGNED_IN or INITIAL_SESSION)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
          subscription.unsubscribe();
          handleSession(session, router);
        }
      });

      // Safety timeout — if nothing fires after 8s, redirect to login
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        router.replace("/login");
      }, 8000);

      return () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
      };
    });
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
