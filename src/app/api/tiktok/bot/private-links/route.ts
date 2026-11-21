import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

export const dynamic = "force-dynamic";

/** How many recent deliveries the screen lists. A log, not an archive. */
const RECENT = 40;

/**
 * The report behind the private reply.
 *
 * Facebook's private reply is a closed box: the bot sends a DM and the merchant
 * learns nothing afterwards — not whether it was read, not whether it led
 * anywhere. The link makes the whole path observable, and that visibility is the
 * actual product here, not a nice extra:
 *
 *     sent → opened → asked on WhatsApp
 *
 * A merchant who can see that 90 people commented, 71 opened their price and 4
 * went on to ask knows the price is the problem, not the reach. No comment count
 * can tell them that.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const configId = req.nextUrl.searchParams.get("configId");

  // Scoped to the caller in the query itself. Passing someone else's configId must
  // return nothing rather than someone else's customers.
  let q = supabaseAdmin
    .from("private_links")
    .select("token, commenter_name, body, opens, max_opens, expires_at, created_at, first_opened_at, whatsapp_clicked_at")
    .eq("user_id", user.id)
    .eq("platform", "tiktok")
    .order("created_at", { ascending: false })
    .limit(RECENT);
  if (configId) q = q.eq("config_id", configId);

  const { data: rows } = await q;

  // Counted over the same scope with head queries, so the totals are the real
  // totals and not "however many the list happened to show".
  const base = () => {
    let c = supabaseAdmin
      .from("private_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("platform", "tiktok");
    if (configId) c = c.eq("config_id", configId);
    return c;
  };

  const [{ count: sent }, { count: opened }, { count: clicked }] = await Promise.all([
    base(),
    base().not("first_opened_at", "is", null),
    base().not("whatsapp_clicked_at", "is", null),
  ]);

  return NextResponse.json({
    stats: { sent: sent ?? 0, opened: opened ?? 0, whatsapp: clicked ?? 0 },
    links: (rows || []).map((r) => ({
      token: r.token,
      name: r.commenter_name,
      // A one-line excerpt. The full body is the customer's quote and does not
      // need to be re-rendered in a list the merchant scans.
      excerpt: (r.body || "").replace(/\s+/g, " ").slice(0, 90),
      opens: r.opens,
      maxOpens: r.max_opens,
      createdAt: r.created_at,
      openedAt: r.first_opened_at,
      whatsappAt: r.whatsapp_clicked_at,
      expired: new Date(r.expires_at).getTime() <= Date.now(),
    })),
  });
}
