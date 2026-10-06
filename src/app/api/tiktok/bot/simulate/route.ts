import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { matchRule, type BotRule } from "@/services/botEngine";
import { decide, type ReplyGroup, type ReplyPolicy } from "@/services/replyDecision";
import { loadCatalog, matchProduct, productReply } from "@/services/catalogMatcher";

export const maxDuration = 30;

/**
 * POST { pageId, text, videoId? } — what the bot WOULD reply to this comment.
 *
 * It runs the real decision core (`services/replyDecision`), the real keyword
 * matcher and the real catalog, in the real order. That is the whole point: a
 * simulator that approximates the engine is worse than none, because the owner tunes
 * their rules against it and then watches the live bot disagree.
 *
 * Two deliberate differences from the live path, both stated in the response:
 *   * The AI tier is NOT invoked. It costs money per call, and a preview the owner
 *     retypes on every keystroke would quietly bill them. When the decision reaches
 *     the AI step, the simulator says so rather than inventing an answer.
 *   * Nothing is sent, logged or counted against the reply throttle.
 *
 * It needs no subscription and no linked account, so it works in prep mode — which
 * is exactly when an owner most needs to see that the tool does something.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId, text, videoId } = await req.json();
  const message = String(text ?? "").trim();
  if (!message) return NextResponse.json({ reply: null, source: null });

  // The config is looked up by account when one is linked, and otherwise by the
  // owner's single TikTok config — in prep mode there is no account id to pass.
  let q = supabaseAdmin.from("bot_configs")
    .select("id, page_id, reply_groups, banned_words, banned_action, mention_author, like_comments, public_replies, default_public_reply, default_private_reply, post_overrides, catalog_match, catalog_ambiguous_reply")
    .eq("user_id", user.id).eq("platform", "tiktok");
  if (pageId) q = q.eq("page_id", String(pageId));
  const { data: config } = await q.limit(1).maybeSingle();

  if (!config) {
    return NextResponse.json({
      reply: null, source: null,
      message: "لا توجد إعدادات بعد — أضف قاعدة أو ردّاً افتراضياً لترى النتيجة.",
    });
  }

  const { data: ruleRows } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, private_reply, attachments, enabled, priority")
    .eq("config_id", config.id);
  const rules = (ruleRows || []) as BotRule[];
  const rule = matchRule(message, rules);

  // The per-video override, when the owner is previewing one specific video.
  const overrides = (config.post_overrides || {}) as Record<string, {
    public_replies?: string[]; mode?: "all" | "groups"; groups?: ReplyGroup[];
    inherit_groups?: boolean; banned_words?: string[]; banned_action?: "delete" | "hide" | "ignore";
    mention?: boolean; like?: boolean;
  }>;
  const override = videoId ? overrides[String(videoId)] : undefined;

  // The catalog answer, which is free and deterministic — and therefore tried before
  // the AI on the live path too.
  let catalogText: string | null = null;
  if (config.catalog_match && config.catalog_match !== "off") {
    try {
      const catalog = await loadCatalog(user.id, config.page_id);
      const hit = await matchProduct({
        message, postId: String(videoId ?? ""), catalog, mode: config.catalog_match,
      });
      if (hit.product) catalogText = productReply(hit.product);
    } catch { /* the catalog is an optimisation, never a hard dependency */ }
  }

  const policy: ReplyPolicy = {
    mode: override?.mode ?? "all",
    groups: override?.groups ?? null,
    pageGroups: (config.reply_groups as ReplyGroup[] | null) ?? null,
    inheritGroups: override?.inherit_groups ?? true,
    bannedWords: (override?.banned_words ?? (config.banned_words as string[] | null)) ?? null,
    bannedAction: override?.banned_action ?? ((config.banned_action as "delete" | "hide" | "ignore") || "hide"),
    mention: override?.mention ?? config.mention_author !== false,
    like: override?.like ?? !!config.like_comments,
    flatPublic: override?.public_replies ?? null,
    defaultPublic: (config.public_replies as string[] | null) ?? null,
    defaultPublicOne: config.default_public_reply,
    defaultPrivate: config.default_private_reply,
  };

  const decision = decide({
    message,
    fromName: "محمد",   // a stand-in so the {commenter name} token renders in the preview
    policy,
    rulePublicOne: rule?.public_reply ?? null,
    rulePrivate: rule?.private_reply ?? null,
    ruleMatched: !!rule,
    catalogText,
    aiText: null,       // never billed from a preview — see the note above
  });

  if (decision.kind === "moderate") {
    return NextResponse.json({
      reply: null, source: "banned",
      moderation: decision.action,
      message: decision.action === "delete"
        ? "يحتوي كلمة محظورة — سيُحذف التعليق."
        : decision.action === "hide"
          ? "يحتوي كلمة محظورة — سيُخفى التعليق."
          : "يحتوي كلمة محظورة — سيُترك بلا ردّ.",
    });
  }

  if (decision.kind === "silent") {
    return NextResponse.json({ reply: null, source: null, reason: decision.reason });
  }

  // TikTok has no private reply, so the richer text is what actually gets posted —
  // the preview must show the same choice the engine makes, not the public field.
  const reply = decision.privateText || decision.publicText;

  return NextResponse.json({
    reply: reply || null,
    source: decision.source,
    label: decision.label ?? null,
    like: decision.like ?? false,
    // The AI step is the one thing a preview cannot answer for.
    aiWouldAnswer: decision.source === "ai" || (!reply && !rule),
  });
}
