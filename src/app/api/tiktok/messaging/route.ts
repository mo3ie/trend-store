import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getValidAccessToken } from "@/lib/tiktokTokens";
import { businessIdFromOpenId, TikTokError } from "@/services/tiktok";
import { canMessage, getCommentToMessage, setCommentToMessage } from "@/services/tiktokMessaging";

export const maxDuration = 30;

/**
 * Business Messaging status and the Comment-to-Message switch.
 *
 * Comment-to-Message is what makes a private reply possible at all: TikTok can only
 * message a conversation that exists, and this is the setting that moves a commenter
 * into one. So it is not an extra — without it, the private reply has nowhere to go,
 * and the screen says exactly that rather than offering a field that silently does
 * nothing.
 */

async function account(userId: string) {
  const { data } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("id, tiktok_account_id, granted_scopes")
    .eq("user_id", userId).is("revoked_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** GET — can this account message, and is Comment-to-Message on? */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const acc = await account(user.id);
  if (!acc) return NextResponse.json({ linked: false, allowed: false, enabled: false });

  const allowed = canMessage(acc.granted_scopes as string[] | null);
  if (!allowed) {
    return NextResponse.json({
      linked: true, allowed: false, enabled: false,
      message: "الرسائل الخاصة غير مُصرّح بها لهذا التطبيق بعد. تُضاف من بوابة المطوّرين بعد اجتياز مراجعة أمان البيانات، ثم يُعاد ربط الحساب.",
    });
  }

  const token = await getValidAccessToken(acc.id);
  if (!token) return NextResponse.json({ linked: true, allowed: true, enabled: false, message: "انتهت صلاحية الربط — أعد الربط." });

  try {
    const state = await getCommentToMessage(token, businessIdFromOpenId(acc.tiktok_account_id));
    return NextResponse.json({ linked: true, allowed: true, enabled: state.enabled });
  } catch (e) {
    // TikTok's own code is what distinguishes "scope missing" from "not available in
    // this market" from "account not eligible" — all of which read the same otherwise.
    const code = e instanceof TikTokError ? e.ttCode ?? null : null;
    if (e instanceof TikTokError) console.error(e.toLogLine(user.id));
    return NextResponse.json({
      linked: true, allowed: true, enabled: false,
      message: `تعذّرت قراءة إعداد الرسائل من تيك توك${code ? ` (رمز ${code})` : ""}.`,
      code,
    });
  }
}

/** POST { enabled } — turn Comment-to-Message on or off. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { enabled } = await req.json();
  const acc = await account(user.id);
  if (!acc) return NextResponse.json({ error: "الحساب غير مرتبط" }, { status: 400 });
  if (!canMessage(acc.granted_scopes as string[] | null)) {
    return NextResponse.json({
      error: "scope_missing",
      message: "صلاحية الرسائل غير ممنوحة لهذا الحساب.",
    }, { status: 402 });
  }

  const token = await getValidAccessToken(acc.id);
  if (!token) return NextResponse.json({ error: "انتهت صلاحية الربط" }, { status: 400 });

  try {
    await setCommentToMessage(token, businessIdFromOpenId(acc.tiktok_account_id), enabled === true);
    return NextResponse.json({ ok: true, enabled: enabled === true });
  } catch (e) {
    const code = e instanceof TikTokError ? e.ttCode ?? null : null;
    if (e instanceof TikTokError) console.error(e.toLogLine(user.id));
    return NextResponse.json({
      error: "update_failed",
      message: `تعذّر تغيير الإعداد على تيك توك${code ? ` (رمز ${code})` : ""}.`,
    }, { status: 502 });
  }
}
