"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

async function redirect(session: any, router: ReturnType<typeof useRouter>) {
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
    const hash   = window.location.hash.substring(1);
    const search = window.location.search.substring(1);
    const hashParams  = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(search);

    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code         = queryParams.get("code");

    if (accessToken && refreshToken) {
      // Implicit flow (magic link / old OAuth)
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session }, error }) => {
          if (session) redirect(session, router);
          else { console.error(error); router.replace("/login"); }
        });

    } else if (code) {
      // PKCE flow (Google OAuth via createBrowserClient)
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data: { session }, error }) => {
          if (session) redirect(session, router);
          else { console.error(error); router.replace("/login"); }
        });

    } else {
      // Already signed in via cookie
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) redirect(session, router);
        else router.replace("/login");
      });
    }
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
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
