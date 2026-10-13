import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import { getBalance } from "@/lib/wallet";

export const maxDuration = 30;

/** Digits only, so 0912-345-678 and +218912345678 find the same person. */
function phoneKey(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  return d.replace(/^00?218/, "").replace(/^218/, "").replace(/^0/, "");
}

type Recipient = { id: string; name: string; email: string | null; phone: string | null };

/**
 * Find exactly one recipient by email or Libyan phone number.
 *
 * Returns null rather than guessing when several profiles match: this is money,
 * and the store has duplicate phone numbers in `profiles`. Sending to "whichever
 * row came back first" is unrecoverable once the balance has moved.
 */
async function findRecipient(q: string): Promise<{ user: Recipient | null; ambiguous: boolean }> {
  const term = (q || "").trim();
  if (!term) return { user: null, ambiguous: false };

  const { data: byEmail } = await supabaseAdmin
    .from("profiles").select("id, full_name, email, phone")
    .ilike("email", term).limit(2);
  if (byEmail?.length === 1) {
    const p = byEmail[0];
    return { user: { id: p.id, name: p.full_name || p.email || "مستخدم", email: p.email, phone: p.phone }, ambiguous: false };
  }
  if ((byEmail?.length ?? 0) > 1) return { user: null, ambiguous: true };

  const key = phoneKey(term);
  if (key.length < 6) return { user: null, ambiguous: false };
  // `phone` is free text here (some rows carry +218, some a leading 0), so the
  // normalisation has to happen in JS over a narrowed candidate set.
  const { data: byPhone } = await supabaseAdmin
    .from("profiles").select("id, full_name, email, phone")
    .ilike("phone", `%${key}%`).limit(20);
  const exact = (byPhone || []).filter((p) => phoneKey(p.phone || "") === key);
  if (exact.length === 1) {
    const p = exact[0];
    return { user: { id: p.id, name: p.full_name || p.email || "مستخدم", email: p.email, phone: p.phone }, ambiguous: false };
  }
  return { user: null, ambiguous: exact.length > 1 };
}

/** Hide most of an identifier — enough to recognise your own contact, not enough to harvest. */
function maskEmail(e: string | null): string | null {
  if (!e) return null;
  const [u, d] = e.split("@");
  if (!d) return null;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}
function maskPhone(p: string | null): string | null {
  const k = phoneKey(p || "");
  return k ? `${"•".repeat(Math.max(0, k.length - 3))}${k.slice(-3)}` : null;
}

/**
 * GET ?q= — who would receive this transfer.
 *
 * Deliberately a separate step from sending. A wallet transfer cannot be
 * reversed, so the sender confirms a NAME before an amount ever moves, instead
 * of typing a number and hoping.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { user: found, ambiguous } = await findRecipient(req.nextUrl.searchParams.get("q") || "");
  if (ambiguous) {
    return NextResponse.json({
      found: false,
      error: "ambiguous",
      message: "أكثر من حساب يطابق هذا الرقم — استخدم البريد الإلكتروني بدلاً منه.",
    });
  }
  if (!found) {
    return NextResponse.json({
      found: false,
      error: "not_found",
      message: "لا يوجد حساب بهذا البريد أو الرقم.",
    });
  }
  if (found.id === user.id) {
    return NextResponse.json({
      found: false,
      error: "self",
      message: "هذا حسابك أنت.",
    });
  }
  // Only the name is returned in full: it is what the sender must recognise.
  return NextResponse.json({
    found: true,
    recipient: { id: found.id, name: found.name, email: maskEmail(found.email), phone: maskPhone(found.phone) },
  });
}

/**
 * POST { to, amount, note } — move money between two store wallets.
 *
 * The payer is ALWAYS the signed-in user; it is never taken from the request.
 * The money itself moves inside `wallet_transfer()`, one locked statement in the
 * database, because the app's read-then-write helpers can lose an update when
 * two spends land together — and on a transfer that race mints money.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { to, amount, note } = await req.json();

  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });
  }
  if (amt < 1) {
    return NextResponse.json({ error: "أقل مبلغ للتحويل 1 د.ل" }, { status: 400 });
  }

  const { user: recipient, ambiguous } = await findRecipient(String(to || ""));
  if (ambiguous) {
    return NextResponse.json({ error: "أكثر من حساب يطابق هذا الرقم — استخدم البريد الإلكتروني." }, { status: 400 });
  }
  if (!recipient) {
    return NextResponse.json({ error: "لا يوجد حساب بهذا البريد أو الرقم." }, { status: 404 });
  }
  if (recipient.id === user.id) {
    return NextResponse.json({ error: "لا يمكنك التحويل إلى نفسك." }, { status: 400 });
  }

  // Checked here too so the sender gets their real balance in the message; the
  // database enforces it again under the lock, which is the check that counts.
  const balance = await getBalance(user.id);
  if (balance < amt) {
    return NextResponse.json({
      error: "insufficient_funds",
      message: `رصيدك ${balance.toFixed(2)} د.ل — لا يكفي لتحويل ${amt.toFixed(2)} د.ل.`,
    }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("wallet_transfer", {
    p_from: user.id,
    p_to: recipient.id,
    p_amount: amt,
    p_note: (note || "").toString().trim().slice(0, 140) || null,
  });

  if (error) {
    const known: Record<string, string> = {
      insufficient_funds: "الرصيد لا يكفي.",
      same_user: "لا يمكنك التحويل إلى نفسك.",
      bad_amount: "المبلغ غير صحيح.",
    };
    const hit = Object.keys(known).find((k) => error.message.includes(k));
    return NextResponse.json({ error: hit ? known[hit] : error.message }, { status: 400 });
  }

  const result = data as { transfer_id: string; from_balance: number };
  return NextResponse.json({
    ok: true,
    transferId: result.transfer_id,
    newBalance: Number(result.from_balance),
    recipient: { name: recipient.name },
    amount: amt,
  });
}
