import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildOAuthUrl } from "@/services/meta";

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

// GET — return Meta OAuth URL
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://trendstore-ly.com";
  const redirectUri = `${base}/api/promo/pages/callback`;

  // state = base64(userId) for verification
  const state = Buffer.from(user.id).toString("base64");
  const oauthUrl = buildOAuthUrl(redirectUri, state);

  return NextResponse.json({ url: oauthUrl });
}
