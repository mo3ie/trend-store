import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappUrl } from "@/lib/privateLinks";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

/**
 * The WhatsApp button, as a redirect rather than a direct `wa.me` href.
 *
 * One hop buys the only number in the funnel that means money: how many people
 * who SAW the price went on to ask for the product. Without it the merchant can
 * count comments and opens and still not know whether any of it sells — which is
 * the exact blindness that makes Facebook's private reply impossible to judge.
 *
 * The hop is recorded, never gated: a tracking failure must not cost a sale, so
 * the redirect happens whether or not the write succeeded.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { token } = await params;
  if (!token || token.length > 32) return NextResponse.redirect(new URL("/", _req.url));

  // Read-only: this is a button press on a page already opened, so it must not
  // consume one of the customer's opens.
  const { data } = await supabaseAdmin.rpc("open_private_link", {
    p_token: token, p_count: false,
  });
  const r = (data ?? {}) as { state?: string; whatsapp?: string | null; whatsapp_text?: string | null };

  if (r.state !== "ok" || !r.whatsapp) {
    return NextResponse.redirect(new URL(`/r/${token}`, _req.url));
  }

  await supabaseAdmin.rpc("mark_private_link_whatsapp", { p_token: token })
    .then(() => undefined, () => undefined);

  return NextResponse.redirect(whatsappUrl(r.whatsapp, r.whatsapp_text ?? null, token));
}
