import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import {
  extractCodes, resolveCode, composeDmReply, dmAutoReplyArmed,
} from "@/services/dmCodeReply";

export const maxDuration = 30;

/**
 * POST { pageId?, text } — what the bot WOULD answer to this private message.
 *
 * The point of this route is to make an unreachable feature testable. TikTok froze
 * Business Messaging on 2026-11-07, so no real message can arrive; without this,
 * «من التعليق إلى الرسالة» would sit unverified until the day it is switched on,
 * which is the worst possible day to discover a bug in it.
 *
 * ## Deliberately side-effect free, and that is not laziness
 *
 * It does not write `dm_code_events` and it does NOT spend the code's single open.
 * A simulator that consumed real opens would be a weapon: an owner testing their
 * wording three times would burn three live customers' prices, and each of those
 * customers would be told to comment again for a reason they could never discover.
 * So the lookup runs with `count = false` — the same non-counting read the web page
 * uses for a refresh.
 *
 * What it therefore proves: extraction, lookup, state and the exact reply text.
 * What it cannot prove: delivery, which needs the scope that does not exist yet.
 * The response says which is which rather than implying a green light.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId, text } = await req.json();
  const message = String(text ?? "").trim();
  if (!message) return NextResponse.json({ error: "اكتب نص الرسالة" }, { status: 400 });

  let q = supabaseAdmin.from("bot_configs")
    .select("id, page_id, dm_code_autoreply, dm_code_miss_text")
    .eq("user_id", user.id).eq("platform", "tiktok");
  if (pageId) q = q.eq("page_id", String(pageId));
  const { data: config } = await q.limit(1).maybeSingle();

  const codes = extractCodes(message);

  if (codes.length === 0) {
    return NextResponse.json({
      codes: [], state: "no_code", reply: null,
      note: "لا يوجد كود في هذه الرسالة — البوت لن يردّ عليها إطلاقاً.",
      armed: armedState(config?.dm_code_autoreply === true),
    });
  }

  // Ownership matters here in a way it does not in the live handler. The live path
  // is driven by TikTok telling us who received the message; this one is driven by
  // whatever the owner typed, so without this filter any merchant could read any
  // other merchant's quoted price by guessing a code into the box.
  const { data: rows } = await supabaseAdmin
    .from("private_links")
    .select("token")
    .eq("user_id", user.id)
    .in("token", codes);
  const mine = new Set((rows || []).map((r) => r.token as string));

  for (const code of codes) {
    if (!mine.has(code)) continue;
    const resolved = await resolveCode(code, false);
    if (resolved.state === "missing") continue;
    return NextResponse.json({
      codes, matched: code, state: resolved.state,
      reply: composeDmReply(resolved, config?.dm_code_miss_text ?? null),
      armed: armedState(config?.dm_code_autoreply === true),
      note: "معاينة فقط — لم يُستهلك الكود ولم تُرسل رسالة.",
    });
  }

  return NextResponse.json({
    codes, matched: null, state: "missing",
    reply: composeDmReply(null, config?.dm_code_miss_text ?? null),
    armed: armedState(config?.dm_code_autoreply === true),
    note: "لا يوجد كود مطابق يخصّ حسابك.",
  });
}

/**
 * Both switches, reported separately.
 *
 * Collapsing them into one boolean would hide the only question the owner actually
 * has when nothing is sent: is it me, or is it TikTok?
 */
function armedState(perMerchant: boolean) {
  return {
    global: dmAutoReplyArmed(),
    merchant: perMerchant,
    sending: dmAutoReplyArmed() && perMerchant,
    reason: !dmAutoReplyArmed()
      ? "الإرسال موقوف على مستوى النظام — صلاحية الرسائل من تيك توك لم تُمنح بعد."
      : !perMerchant
        ? "الإرسال موقوف لهذا الحساب."
        : null,
  };
}
