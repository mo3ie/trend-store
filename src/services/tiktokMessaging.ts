import { TikTokError } from "@/services/tiktok";

/**
 * TikTok Business Messaging — the private reply, at last.
 *
 * The product was built on the belief that TikTok offers no automated DM in this
 * market. That was wrong, and the owner caught it: the access page says developers in
 * "Rest of World" — which includes Libya — may call the Business Messaging API once
 * they have passed the Data security & privacy review, and the API carries an explicit
 * **Comment-to-Message** capability.
 *
 * Two gates stand in front of it, and neither is code:
 *   1. The Data security & privacy review, for Rest-of-World access.
 *   2. Automatic messages additionally need Advanced Access and a Verified Business
 *      Account.
 *
 * ## Why the scope is detected rather than named
 *
 * TikTok's scope list is rendered client-side and could not be read programmatically,
 * so hard-coding a guessed string would fail in the one way that is hardest to
 * diagnose: a silent refusal that looks like "the feature is off". Instead
 * `canMessage` matches any granted scope that mentions messaging, and every call
 * surfaces TikTok's own error code when it is refused. The first real call tells the
 * truth, and the override exists for when the exact string is known.
 *
 * SERVER ONLY.
 */

const DEFAULT_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function apiBase(): string {
  return (process.env.TIKTOK_API_BASE || "").replace(/^﻿/, "").trim() || DEFAULT_BASE;
}

/**
 * True when this account's grant includes a messaging permission.
 *
 * Deliberately a pattern, not an equality test — see the note above. An explicit
 * `TIKTOK_MESSAGING_SCOPE` wins when set, so the moment the exact name is known it can
 * be pinned without a deploy.
 */
export function canMessage(grantedScopes: string[] | null | undefined): boolean {
  const scopes = grantedScopes || [];
  const pinned = (process.env.TIKTOK_MESSAGING_SCOPE || "").trim();
  if (pinned) return scopes.includes(pinned);
  return scopes.some((s) => /message|messaging|\bdm\b|conversation/i.test(s));
}

interface Envelope<T> { code: number; message?: string; request_id?: string; data?: T }

async function call<T>(
  path: string,
  method: "GET" | "POST",
  token: string,
  payload: Record<string, unknown>,
): Promise<T> {
  let url = `${apiBase()}/${path}`;
  const init: RequestInit = {
    method,
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    cache: "no-store",
  };

  if (method === "GET") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    const q = qs.toString();
    if (q) url += `?${q}`;
  } else {
    init.body = JSON.stringify(payload);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new TikTokError("network_error", "TikTok request failed", path);
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new TikTokError("bad_response", "TikTok returned a non-JSON response", path, res.status);
  }

  if (json.code !== 0) {
    throw new TikTokError(
      "api_error",
      json.message || `TikTok API error (code ${json.code})`,
      path, res.status, json.code, json.request_id,
    );
  }
  return (json.data ?? ({} as T));
}

// ── Comment-to-Message ────────────────────────────────────────────────────────

/**
 * Whether this Business Account turns a comment into a private conversation.
 *
 * It is a per-account setting on TikTok's side, not ours, so it is read rather than
 * assumed — an owner may well have set it in the TikTok app already.
 */
export async function getCommentToMessage(
  token: string, businessId: string,
): Promise<{ enabled: boolean }> {
  const data = await call<{ status?: string; enabled?: boolean }>(
    "business/comment/message/get/", "GET", token, { business_id: businessId },
  );
  return { enabled: data.enabled === true || String(data.status ?? "").toUpperCase() === "ENABLE" };
}

/** Turns Comment-to-Message on or off for the account. */
export async function setCommentToMessage(
  token: string, businessId: string, enabled: boolean,
): Promise<void> {
  await call("business/comment/message/update/", "POST", token, {
    business_id: businessId,
    status: enabled ? "ENABLE" : "DISABLE",
  });
}

// ── Direct messages ───────────────────────────────────────────────────────────

export interface SendResult { messageId: string | null; conversationId: string | null }

/**
 * Sends a private message into a conversation.
 *
 * TikTok's messaging is conversation-scoped: there is no "message this commenter by
 * id". A conversation has to exist, which is what Comment-to-Message creates — the
 * commenter is moved into a thread, and that thread is what we can answer. So a
 * private reply here is never "DM whoever commented"; it is "answer the conversation
 * their comment opened".
 */
export async function sendMessage(
  token: string,
  businessId: string,
  conversationId: string,
  text: string,
): Promise<SendResult> {
  const data = await call<{ message_id?: string | number; conversation_id?: string | number }>(
    "business/message/send/", "POST", token,
    {
      business_id: businessId,
      conversation_id: conversationId,
      message: { type: "TEXT", text },
    },
  );
  return {
    messageId: data.message_id != null ? String(data.message_id) : null,
    conversationId: data.conversation_id != null ? String(data.conversation_id) : null,
  };
}

export interface Conversation {
  conversationId: string;
  participantId: string | null;
  updatedAt: number | null;
}

/** Recent conversations, newest first — used to find the thread a comment opened. */
export async function listConversations(
  token: string, businessId: string, opts: { cursor?: number; maxCount?: number } = {},
): Promise<{ items: Conversation[]; cursor: number | null; hasMore: boolean }> {
  const data = await call<{
    conversations?: Array<Record<string, unknown>>;
    cursor?: number; has_more?: boolean;
  }>("business/message/conversation/list/", "GET", token, {
    business_id: businessId,
    cursor: opts.cursor,
    max_count: Math.min(opts.maxCount ?? 20, 20),
  });

  return {
    items: (data.conversations || []).map((c) => ({
      conversationId: String(c.conversation_id ?? ""),
      participantId: c.participant_id != null ? String(c.participant_id) : null,
      updatedAt: c.update_time != null ? Number(c.update_time) : null,
    })).filter((c) => c.conversationId),
    cursor: data.cursor ?? null,
    hasMore: !!data.has_more,
  };
}

/**
 * The conversation a specific commenter is in, when one exists.
 *
 * Returns null rather than throwing when there is none: a commenter who has not been
 * moved into a conversation simply cannot be messaged yet, which is a normal state and
 * not an error. The caller falls back to answering publicly.
 */
export async function findConversationFor(
  token: string, businessId: string, participantId: string,
): Promise<string | null> {
  try {
    const page = await listConversations(token, businessId, { maxCount: 20 });
    const hit = page.items.find((c) => c.participantId && c.participantId === participantId);
    return hit?.conversationId ?? null;
  } catch {
    return null;
  }
}
