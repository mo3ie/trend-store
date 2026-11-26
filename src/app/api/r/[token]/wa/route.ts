import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappUrl } from "@/lib/privateLinks";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

/**
 * Records that a customer pressed "order on WhatsApp".
 *
 * That count is the only number in the funnel which means money: how many people
 * who SAW the price went on to ask for the product. Without it a merchant can
 * count comments and opens and still not know whether any of it sells.
 *
 * ## It is no longer the navigation path
 *
 * It used to be: the button linked here and this redirected to wa.me. The
 * customer arrives inside TikTok's in-app browser, which REFUSES to follow a
 * redirect off our origin — the live result was a grey shield reading "TikTok
 * can't open this page directly". The customer had the price, wanted to order,
 * and hit a wall at the last step.
 *
 * The button now points straight at wa.me and calls this as a beacon alongside.
 * Measurement must never stand between a customer and a purchase. The redirect
 * is kept for anything still linking here directly, so no old link breaks.
 */
/** The beacon. `navigator.sendBeacon` issues a POST, so this is the hot path now. */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { token } = await params;
  if (token && token.length <= 32) {
    await supabaseAdmin.rpc("mark_private_link_whatsapp", { p_token: token })
      .then(() => undefined, () => undefined);
  }
  // 204: a beacon's response is discarded, and the page is already navigating away.
  return new NextResponse(null, { status: 204 });
}

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
