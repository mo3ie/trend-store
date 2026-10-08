import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { matchRule, type BotRule } from "@/services/botEngine";
import { decide, type ReplyGroup, type ReplyPolicy } from "@/services/replyDecision";
import { loadCatalog, matchProduct, productReply } from "@/services/catalogMatcher";

export const maxDuration = 30;

/**
 * POST { pageId, text, postId? } — what the bot WOULD reply to this comment.
 *
 * The TikTok side got this first and it turned out to be the most useful thing on
 * that screen: an owner can see their rules answer a real question before linking,
 * before subscribing, and before a customer is the one who finds out the rules are
 * wrong. There is no reason Facebook should be the one without it.
 *
 * It runs the real decision core, the real keyword matcher and the real catalog, in
 * the real order — an approximation would be worse than nothing, because owners tune
 * their rules against what this shows them.
 *
 * Two deliberate differences from the live path, both reported in the response:
 *   * The AI tier is NOT invoked. It bills per call, and a preview that re-runs on
 *     every keystroke would quietly charge for typing.
 *   * Nothing is sent, logged, or counted against the reply throttle.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { pageId, text, postId } = await req.json();
  const message = String(text ?? "").trim();
  if (!message) return NextResponse.json({ reply: null, source: null });

  let q = supabaseAdmin.from("bot_configs")
    .select("id, page_id, reply_groups, banned_words, banned_action, mention_author, like_comments, public_replies, default_public_reply, default_private_reply, reply_private, post_overrides, catalog_match, catalog_ambiguous_reply")
    .eq("user_id", user.id).eq("platform", "meta");
  if (pageId) q = q.eq("page_id", String(pageId));
  const { data: config } = await q.limit(1).maybeSingle();

  if (!config) {
    return NextResponse.json({
      reply: null, source: null,
      message: "لا توجد إعدادات لهذه الصفحة بعد — أضف قاعدة أو ردّاً افتراضياً لترى النتيجة.",
    });
  }

  const { data: ruleRows } = await supabaseAdmin
    .from("bot_rules")
    .select("id, keywords, match_type, public_reply, public_replies, private_reply, attachments, enabled, priority")
    .eq("config_id", config.id);
  const rules = (ruleRows || []) as BotRule[];
  const rule = matchRule(message, rules);

  const overrides = (config.post_overrides || {}) as Record<string, {
    public_replies?: string[]; private_reply?: string;
    mode?: "all" | "groups"; groups?: ReplyGroup[]; inherit_groups?: boolean;
    banned_words?: string[]; banned_action?: "delete" | "hide" | "ignore";
    mention?: boolean; like?: boolean;
  }>;
  const override = postId ? overrides[String(postId)] : undefined;

  // The free, deterministic answer — tried before the AI on the live path too.
  let catalogText: string | null = null;
  if (config.catalog_match && config.catalog_match !== "off") {
    try {
      const catalog = await loadCatalog(user.id, config.page_id);
      const hit = await matchProduct({
        message, postId: String(postId ?? ""), catalog, mode: config.catalog_match,
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
    flatPrivate: override?.private_reply ?? null,
    defaultPublic: (config.public_replies as string[] | null) ?? null,
    defaultPublicOne: config.default_public_reply,
    defaultPrivate: config.default_private_reply,
  };

  const decision = decide({
    message,
    fromName: "محمد",   // a stand-in so the commenter-name token renders in the preview
    policy,
    rulePublicOne: rule?.public_reply ?? null,
    rulePrivate: rule?.private_reply ?? null,
    ruleMatched: !!rule,
    catalogText,
    aiText: null,       // never billed from a preview — see the note above
  });

  if (decision.kind === "moderate") {
    return NextResponse.json({
      reply: null, source: "banned", moderation: decision.action,
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

  // Facebook sends both halves: a public reply under the comment and, when the owner
  // configured one, a private message carrying the detail. The preview shows both,
  // because which one the price lands in is exactly what an owner is checking.
  return NextResponse.json({
    reply: decision.publicText || null,
    privateReply: config.reply_private === false ? null : (decision.privateText || null),
    source: decision.source,
    label: decision.label ?? null,
    like: decision.like ?? false,
    aiWouldAnswer: decision.source === "ai" || (!decision.publicText && !decision.privateText && !rule),
  });
}
