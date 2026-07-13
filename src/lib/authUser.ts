import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Resolves the signed-in Supabase user from request cookies (read-only). Mirrors the
// inline pattern used across the promo/ads routes, shared by the bot routes.
export async function getAuthUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// True when the given user id is a store admin (profiles.role = 'admin').
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}
