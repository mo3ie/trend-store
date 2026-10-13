"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Record the sign-in for the admin login log. Fire-and-forget: a failure
      // here must never block someone from getting into the store. The server
      // collapses repeats, because Supabase also fires SIGNED_IN on session
      // restore — every reopened tab would otherwise count as a fresh login.
      if (event === "SIGNED_IN" && session?.user) {
        fetch("/api/auth/log-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app: "store" }),
        }).catch(() => {});
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    document.cookie = "admin_role=; path=/; max-age=0";
    window.location.href = "/";
  };

  return { user, loading, signOut };
}
