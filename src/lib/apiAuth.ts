import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Shared server-side auth helpers for API routes.
 *
 * IMPORTANT: API routes use the SERVICE_ROLE key, which bypasses RLS.
 * That means every write/admin route MUST authenticate the caller here —
 * the middleware only guards /admin/* *pages*, never /api/* routes.
 */

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Returns the authenticated Supabase user (from cookies) or null. */
export async function getUser() {
  const cookieStore = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

export type AdminCheck =
  | { ok: true; userId: string; role: "admin" | "employee" }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Verifies the caller is signed in AND has an admin/employee role.
 * Mirrors the allow-list logic in src/middleware.ts so API + pages agree.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const user = await getUser();
  if (!user) return { ok: false, status: 401, error: "غير مسجّل الدخول" };

  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "employee")) {
    return { ok: false, status: 403, error: "غير مصرّح" };
  }
  return { ok: true, userId: user.id, role: profile.role };
}
