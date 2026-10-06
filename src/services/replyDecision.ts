import type { BotAttachment } from "@/services/meta";

/**
 * The comment-reply decision, shared by the Facebook and TikTok bots.
 *
 * Both platforms answer comments from the same `bot_configs` row and the same
 * `bot_rules`, so the thinking belongs in one place and only the delivery differs.
 * Keeping it here is what stops the two engines drifting: a feature added for
 * Facebook is a feature TikTok has, with no second implementation to forget.
 *
 * Nothing in this file performs I/O. It takes what the caller already loaded and
 * returns what to do, so each engine keeps its own rate limits, token rotation and
 * API shapes.
 */

export interface ReplyGroup {
  id?:             string;
  label?:          string;
  keywords:        string[];
  public_replies?: string[];
  private_reply?:  string;
  attachments?:    BotAttachment[];
  like?:           boolean;
}

/** The merged view of a Page/account config and a per-post override. */
export interface ReplyPolicy {
  mode?:          "all" | "groups";
  groups?:        ReplyGroup[] | null;      // the post's own groups
  pageGroups?:    ReplyGroup[] | null;      // the account's defaults
  inheritGroups?: boolean;
  bannedWords?:   string[] | null;
  bannedAction?:  "delete" | "hide" | "ignore";
  mention?:       boolean;
  like?:          boolean;
  /** Flat, one-reply-for-everything content (the legacy per-post override). */
  flatPublic?:    string[] | null;
  flatPrivate?:   string | null;
  flatAttachments?: BotAttachment[] | null;
  /** Account-wide fallbacks. */
  defaultPublic?:  string[] | null;
  defaultPublicOne?: string | null;
  defaultPrivate?: string | null;
}

export type ReplySource = "group" | "flat" | "rule" | "catalog" | "ai" | "default";

export type Decision =
  | { kind: "moderate"; action: "delete" | "hide" | "ignore" }
  | { kind: "silent"; reason: string }
  | {
      kind: "reply";
      source: ReplySource;
      label?: string;
      publicText: string | null;
      privateText: string | null;
      attachments: BotAttachment[];
      like: boolean;
    };

/**
 * Normalises Arabic/English for matching: lowercase, strip tashkeel, unify
 * alef/ya/taa-marbuta, drop punctuation and emoji. "بكم" and "بِكَمْ؟" match.
 */
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first group whose keywords appear in the comment. */
export function matchGroup(message: string, groups: ReplyGroup[] | null | undefined): ReplyGroup | null {
  const text = normalize(message);
  if (!text) return null;
  for (const g of groups || []) {
    const kws = (g.keywords || []).map(normalize).filter(Boolean);
    if (kws.length && kws.some((k) => text.includes(k))) return g;
  }
  return null;
}

/** True when the comment contains any banned word. */
export function hitsBanned(message: string, words: string[] | null | undefined): boolean {
  const text = normalize(message);
  if (!text) return false;
  return (words || []).map(normalize).filter(Boolean).some((w) => text.includes(w));
}

/** One of the variants at random, so a Page does not repeat itself all day. */
export function pickVariant(pool: string[] | null | undefined, fallback: string | null): string | null {
  const list = (pool || []).map((s) => (s || "").trim()).filter(Boolean);
  if (list.length) return list[Math.floor(Math.random() * list.length)];
  const f = (fallback || "").trim();
  return f || null;
}

/**
 * Open the reply with the commenter's first name, so it reads as addressed to
 * them. A plain name rather than an @mention tag: platforms drop those when a
 * business replies to someone who is not connected to it, which would leave a
 * reply starting with a dangling symbol.
 */
export function withMention(text: string | null, fromName: string | undefined | null): string | null {
  if (!text || !fromName) return text;
  const first = String(fromName).trim().split(/\s+/)[0];
  if (!first || text.includes(first)) return text;
  return `${first}، ${text}`;
}

/**
 * Decide what to send for one comment.
 *
 * Order is deliberate and is the whole point of the function: moderation first,
 * then the owner's own words (groups, then a flat override, then a keyword rule),
 * then the catalog's exact price, and only then AI. A model that ran earlier would
 * cheerfully invent a price the owner had already written down.
 */
export function decide(params: {
  message: string;
  fromName?: string | null;
  policy: ReplyPolicy;
  /** A keyword rule the caller already matched, if any. */
  rulePublic?: string[] | null;
  rulePublicOne?: string | null;
  rulePrivate?: string | null;
  ruleAttachments?: BotAttachment[] | null;
  ruleMatched?: boolean;
  /** Text the catalog matcher produced for the product this comment is about. */
  catalogText?: string | null;
  /** Text the AI produced, when the caller chose to ask it. */
  aiText?: string | null;
}): Decision {
  const { message, fromName, policy } = params;

  // 1) Moderation wins over everything — a banned comment is never answered.
  if (hitsBanned(message, policy.bannedWords)) {
    return { kind: "moderate", action: policy.bannedAction || "hide" };
  }

  const mention = policy.mention !== false;
  const finish = (
    source: ReplySource,
    pub: string | null,
    priv: string | null,
    atts: BotAttachment[],
    like: boolean,
    label?: string,
  ): Decision => ({
    kind: "reply",
    source,
    label,
    publicText: mention ? withMention(pub, fromName) : pub,
    privateText: priv,
    attachments: atts,
    like,
  });

  const defPublic = () => pickVariant(policy.defaultPublic, policy.defaultPublicOne ?? null);
  const baseLike = policy.like === true;

  // 2) Keyword groups — the post's own first, then the account's defaults.
  if ((policy.mode ?? "groups") === "groups") {
    const group =
      matchGroup(message, policy.groups) ??
      ((policy.inheritGroups ?? true) ? matchGroup(message, policy.pageGroups) : null);
    if (group) {
      return finish(
        "group",
        pickVariant(group.public_replies, null) ?? defPublic(),
        group.private_reply || policy.defaultPrivate || null,
        group.attachments || [],
        group.like ?? baseLike,
        group.label || group.keywords?.[0],
      );
    }
  }

  // 3) A flat per-post override: one reply for every comment on that post.
  const hasFlat =
    (policy.flatPublic?.some((s) => (s || "").trim()) ?? false) ||
    !!(policy.flatPrivate || "").trim() ||
    (policy.flatAttachments?.length ?? 0) > 0;
  if (hasFlat) {
    return finish(
      "flat",
      pickVariant(policy.flatPublic, null) ?? defPublic(),
      policy.flatPrivate || policy.defaultPrivate || null,
      policy.flatAttachments || [],
      baseLike,
    );
  }

  // 4) A keyword rule the caller matched.
  if (params.ruleMatched) {
    return finish(
      "rule",
      pickVariant(params.rulePublic, params.rulePublicOne ?? null) ?? defPublic(),
      params.rulePrivate || policy.defaultPrivate || null,
      params.ruleAttachments || [],
      baseLike,
    );
  }

  // 5) The catalog's exact answer for the product this comment is about.
  if (params.catalogText) {
    return finish("catalog", defPublic(), params.catalogText, [], baseLike);
  }

  // 6) AI, last.
  if (params.aiText) {
    return finish("ai", defPublic(), params.aiText, [], baseLike);
  }

  // Nothing matched and nothing was generated: stay quiet rather than guess.
  const fallback = defPublic();
  if (fallback || policy.defaultPrivate) {
    return finish("default", fallback, policy.defaultPrivate || null, [], baseLike);
  }
  return { kind: "silent", reason: "no_match" };
}
