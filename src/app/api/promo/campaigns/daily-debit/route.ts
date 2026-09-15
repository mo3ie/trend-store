import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setCampaignStatus } from "@/services/meta";

// Daily wallet debit for open-ended (continuous) campaigns. Run once a day from an
// external scheduler with `Authorization: Bearer <CRON_SECRET>`.
// For each due campaign: debit the day's price from the owner's wallet; if the
// balance is too low, pause the Meta campaign and mark it paused so the user can
// top up and resume. Idempotent via next_charge_at gating.
export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = req.headers.get("authorization") || "";
  if (secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("id, user_id, external_campaign_id, daily_price_lyd, next_charge_at, status")
    .eq("continuous", true)
    .in("status", ["active", "in_review"])
    .lte("next_charge_at", nowIso)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let charged = 0, paused = 0;
  for (const c of due || []) {
    const price = Number(c.daily_price_lyd) || 0;
    if (price <= 0) continue;

    const { data: wallet } = await supabaseAdmin
      .from("wallets").select("balance").eq("user_id", c.user_id).maybeSingle();
    const balance = Number(wallet?.balance ?? 0);

    if (balance >= price) {
      await supabaseAdmin.from("wallets")
        .update({ balance: balance - price, updated_at: nowIso })
        .eq("user_id", c.user_id);
      await supabaseAdmin.from("ad_payments").insert({
        user_id: c.user_id, campaign_id: c.id, amount: price, provider: "wallet", status: "success",
      });
      await supabaseAdmin.from("ad_campaigns")
        .update({ next_charge_at: new Date(Date.now() + 86400000).toISOString(), updated_at: nowIso })
        .eq("id", c.id);
      charged++;
    } else {
      // Not enough balance — pause on Meta and locally so it can be resumed.
      if (c.external_campaign_id) {
        try { await setCampaignStatus(c.external_campaign_id, "PAUSED"); } catch { /* best-effort */ }
      }
      await supabaseAdmin.from("ad_campaigns")
        .update({ status: "paused", error_message: "توقفت مؤقتاً لنفاد رصيد المحفظة — اشحن محفظتك واستأنف الحملة.", updated_at: nowIso })
        .eq("id", c.id);
      paused++;
    }
  }

  return NextResponse.json({ ok: true, due: (due || []).length, charged, paused });
}
