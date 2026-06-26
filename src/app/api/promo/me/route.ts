import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdsPricing, getUserTier } from "@/lib/adsPricing";

async function getUser() {
  const store = await cookies();
  const anon = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => store.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await anon.auth.getUser();
  return user;
}

// GET — the current user's ad tier + the active pricing settings.
// Used by /ads/create to render the right pricing window and compute live LYD.
export async function GET() {
  const user = await getUser();
  const pricing = await getAdsPricing();
  if (!user) return NextResponse.json({ tier: "regular", pricing });
  const tier = await getUserTier(user.id);
  return NextResponse.json({ tier, pricing });
}
