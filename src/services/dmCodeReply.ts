import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * «من التعليق إلى الرسالة» — answering a code sent in a private message.
 *
 * The flow this completes:
 *
 *   1. customer comments                      ← live since October
 *   2. bot replies publicly with a CODE       ← live (private_delivery = 'link')
 *   3. customer DMs the code                  ← the customer's own move
 *   4. the platform tells us                  ← THIS FILE's caller
 *   5. look the code up, get the price        ← private_links, live since sql/22
 *   6. answer privately                       ← THIS FILE
 *
 * Steps 4 and 6 are the only ones that need TikTok's Business Messaging scope,
 * frozen on 2026-11-07. Everything here is therefore written to run, be tested and
 * be logged WITHOUT it, and to start answering the day the scope is granted with no
 * further build. The sender is injected, so the same core serves TikTok, Facebook
 * and Instagram — and on Meta the permission has been approved since September.
 *
 * ## Why the code is a bearer token, and why that is acceptable
 *
 * We cannot prove the sender is the commenter — no platform exposes that link. So
 * whoever holds the code can redeem it, exactly as whoever holds the link can open
 * it. That is not a weakness introduced here: it is the same property `private_links`
 * has always had, bounded the same way (one open, 24 hours). A passed-around code
 * buys one person one price, and the second person has to comment. Which is the
 * behaviour the whole mechanic exists to produce.
 *
 * SERVER ONLY.
 */

/**
 * The token alphabet, mirrored from lib/privateLinks.
 *
 * Duplicated rather than imported as a regex source because the two have different
 * jobs: there it shapes generation, here it shapes RECOGNITION inside free-form
 * human text. If the alphabet ever changes, old codes must still be readable for
 * their 24 hours, so this side has to be able to lag deliberately.
 */
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LEN = 5;

/**
 * Pulls candidate codes out of whatever the customer actually typed.
 *
 * Real messages are not bare codes. They are "كودي AB3K9", "ab3k9 شنو السعر",
 * "The code is AB3K9." — so the match is anchored on non-alphanumeric boundaries
 * rather than on the whole string, and lowercase is accepted because phone keyboards
 * autocorrect and nobody holds shift for five characters.
 *
 * Returns ALL candidates, not the first. An ordinary English word made only of
 * allowed letters ("HENRY", "MERCY") is a false positive, and the caller resolves
 * candidates in order until one is real — which costs a cheap indexed lookup and
 * saves answering "unknown code" to a customer whose code was sitting in the same
 * sentence.
 */
export function extractCodes(text: string | null | undefined): string[] {
  const s = (text || "").toUpperCase();
  if (!s) return [];
  const re = new RegExp(`(?<![A-Z0-9])[${CODE_CHARS}]{${CODE_LEN}}(?![A-Z0-9])`, "g");
  const out: string[] = [];
  for (const m of s.matchAll(re)) {
    if (!out.includes(m[0])) out.push(m[0]);
    if (out.length >= 5) break; // a message with six candidates is not a redemption
  }
  return out;
}

export type CodeState = "ok" | "expired" | "exhausted" | "missing";

export interface ResolvedCode {
  code: string;
  state: CodeState;
  body: string | null;
  brand: string | null;
  name: string | null;
}

/**
 * Redeems a code, spending one open.
 *
 * `open_private_link` is the same SECURITY DEFINER guard the web page uses: a
 * conditional UPDATE ... RETURNING, so two simultaneous redemptions cannot both
 * take the last open. Nothing about redeeming by message is special — which is
 * precisely why this path needed no new concurrency thinking.
 */
export async function resolveCode(code: string, count = true): Promise<ResolvedCode> {
  const { data, error } = await supabaseAdmin.rpc("open_private_link", {
    p_token: code, p_count: count,
  });
  if (error) {
    console.error("dm_code_resolve_failed", error.code ?? "");
    return { code, state: "missing", body: null, brand: null, name: null };
  }
  const r = (data ?? {}) as Record<string, unknown>;
  const state = (String(r.state ?? "missing") as CodeState);
  return {
    code,
    state,
    body: typeof r.body === "string" ? r.body : null,
    brand: typeof r.brand === "string" ? r.brand : null,
    name: typeof r.name === "string" ? r.name : null,
  };
}

/**
 * Tries each candidate and returns the first that is REAL — matched, expired or
 * exhausted — rather than the first that succeeds.
 *
 * The distinction matters for what the customer is told. "Your code was already
 * used" is a true, actionable answer; silently falling through to "unknown code"
 * because a later candidate was nonsense would tell them to comment again when
 * their real problem is that someone else already opened their price.
 *
 * Resolution is NON-COUNTING first: probing candidates with `count = true` would
 * spend the single open of an unrelated live code that happened to appear in the
 * text. Only the chosen one is then spent.
 */
export async function resolveFirst(codes: string[]): Promise<ResolvedCode | null> {
  let fallback: ResolvedCode | null = null;
  for (const c of codes) {
    const probe = await resolveCode(c, false);
    if (probe.state === "ok") return resolveCode(c, true);
    if (probe.state !== "missing" && !fallback) fallback = probe;
  }
  return fallback;
}

// ── What we say back ──────────────────────────────────────────────────────────

const MISS_DEFAULT =
  "لم أتعرّف على هذا الكود 🤔\nتأكّد من كتابته كما وصلك في الردّ على تعليقك، أو علّق من جديد ليصلك كود جديد.";

const USED_DEFAULT =
  "هذا الكود استُخدم من قبل ✅\nالسعر يُرسل مرّة واحدة لكل تعليق — علّق من جديد على الفيديو ليصلك كود جديد.";

const EXPIRED_DEFAULT =
  "انتهت صلاحية هذا الكود ⏳\nصلاحيته ٢٤ ساعة — علّق من جديد على الفيديو ليصلك كود جديد.";

/**
 * The message to send back.
 *
 * On success this returns the merchant's OWN private text verbatim, with no
 * decoration: it is a price they wrote, and wrapping it in our phrasing would put
 * words in a shop's mouth. The failure answers are ours, because they describe our
 * mechanic — and each one ends by naming the single action that fixes it, which is
 * always "comment again". That is not a consolation; it is the mechanic working.
 */
export function composeDmReply(
  resolved: ResolvedCode | null,
  missText?: string | null,
): string {
  if (!resolved) return (missText || "").trim() || MISS_DEFAULT;
  switch (resolved.state) {
    case "ok": {
      const body = (resolved.body || "").trim();
      if (!body) return (missText || "").trim() || MISS_DEFAULT;
      const who = (resolved.name || "").trim();
      return who ? `${who} 👋\n${body}` : body;
    }
    case "exhausted": return USED_DEFAULT;
    case "expired":   return EXPIRED_DEFAULT;
    default:          return (missText || "").trim() || MISS_DEFAULT;
  }
}

// ── The switches ──────────────────────────────────────────────────────────────

/**
 * The global kill switch.
 *
 * Default OFF, and deliberately opt-in by exact value. An env var that enabled the
 * feature on any truthy string would turn it on for a deployment that set it to
 * "false" — and the cost of a wrong answer here is a merchant's price sent to the
 * wrong person, so the failure has to be in the safe direction.
 */
export function dmAutoReplyArmed(): boolean {
  const v = (process.env.DM_CODE_AUTOREPLY || "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true";
}

// ── Orchestration ─────────────────────────────────────────────────────────────

export interface InboundDm {
  platform: string;
  messageId: string;
  conversationId: string | null;
  senderId: string | null;
  /** The receiving account: TikTok open_id, or a Facebook/Instagram page id. */
  pageId: string | null;
  text: string;
}

/** Sends the reply. Injected so one core serves TikTok, Facebook and Instagram. */
export type DmSender = (reply: {
  conversationId: string | null;
  senderId: string | null;
  text: string;
}) => Promise<void>;

export interface HandleResult {
  outcome: "matched" | "expired" | "exhausted" | "missing" | "no_code" | "duplicate";
  delivery: "sent" | "disabled" | "unavailable" | "failed" | "skipped";
  reply: string | null;
  code: string | null;
}

/**
 * The whole step 4→6, start to finish.
 *
 * Order is the correctness property, and it is not the obvious one:
 *
 *   1. CLAIM the message id first, before any lookup. The insert is the dedupe —
 *      a redelivery loses the unique index here and stops, having spent nothing.
 *      Claiming after resolving would let two deliveries both redeem.
 *   2. Resolve the code (non-counting probes, then one counting redemption).
 *   3. Compose.
 *   4. Send — only if BOTH switches are on.
 *   5. Record what happened on the row claimed in step 1.
 *
 * Step 4 being last is what makes this safe to run today with the scope frozen: with
 * the switches off, steps 1–3 and 5 still execute in full, so the log shows exactly
 * what WOULD have been sent to whom. The path is proven before it is ever live.
 */
export async function handleInboundDm(
  dm: InboundDm,
  send: DmSender | null,
  opts: { configId?: string | null; userId?: string | null; missText?: string | null; enabled?: boolean } = {},
): Promise<HandleResult> {
  const platform = dm.platform || "tiktok";

  // 1 — claim. A message with no id cannot be deduplicated, so it is refused by
  // the NOT NULL column rather than answered twice.
  const { data: claim, error: claimErr } = await supabaseAdmin
    .from("dm_code_events")
    .insert({
      platform,
      message_id: dm.messageId,
      conversation_id: dm.conversationId,
      sender_id: dm.senderId,
      page_id: dm.pageId,
      config_id: opts.configId ?? null,
      user_id: opts.userId ?? null,
      outcome: "pending",
      delivery: "skipped",
    })
    .select("id")
    .maybeSingle();

  if (claimErr) {
    if (claimErr.code === "23505") {
      return { outcome: "duplicate", delivery: "skipped", reply: null, code: null };
    }
    console.error("dm_code_claim_failed", claimErr.code ?? "");
    throw new Error("dm_code_claim_failed");
  }

  const rowId = claim?.id as string | undefined;
  const finish = async (r: HandleResult, errorCode?: string | null) => {
    if (rowId) {
      await supabaseAdmin.from("dm_code_events").update({
        outcome: r.outcome, delivery: r.delivery, code: r.code, error_code: errorCode ?? null,
      }).eq("id", rowId);
    }
    return r;
  };

  // 2 — resolve.
  const codes = extractCodes(dm.text);
  if (codes.length === 0) {
    // Someone wrote to the shop without a code. That is an ordinary customer
    // message, not a failure, and the bot stays out of it: answering it would put
    // us in the middle of a human conversation we were never asked to join.
    return finish({ outcome: "no_code", delivery: "skipped", reply: null, code: null });
  }

  const resolved = await resolveFirst(codes);
  const outcome: HandleResult["outcome"] =
    resolved?.state === "ok" ? "matched"
      : resolved?.state === "expired" ? "expired"
        : resolved?.state === "exhausted" ? "exhausted"
          : "missing";

  // 3 — compose.
  const reply = composeDmReply(resolved, opts.missText);

  // 4 — send, behind both switches.
  if (!dmAutoReplyArmed() || opts.enabled === false) {
    return finish({ outcome, delivery: "disabled", reply, code: resolved?.code ?? codes[0] });
  }
  if (!send) {
    return finish({ outcome, delivery: "unavailable", reply, code: resolved?.code ?? codes[0] });
  }

  try {
    await send({ conversationId: dm.conversationId, senderId: dm.senderId, text: reply });
  } catch (e) {
    const code = e && typeof e === "object" && "ttCode" in e ? String((e as { ttCode: unknown }).ttCode) : null;
    console.error("dm_code_send_failed", code ?? "");
    return finish({ outcome, delivery: "failed", reply, code: resolved?.code ?? codes[0] }, code);
  }

  return finish({ outcome, delivery: "sent", reply, code: resolved?.code ?? codes[0] });
}
