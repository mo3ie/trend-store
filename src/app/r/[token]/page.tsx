import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappUrl } from "@/lib/privateLinks";
import { loadShopFacts } from "@/services/shopFacts";
import { OrderActions, CopyPrice } from "./OrderActions";

/**
 * The page behind a private reply link.
 *
 * This is the only screen in the product a CUSTOMER sees — someone who has never
 * heard of us, arriving from a TikTok comment on a phone, wanting one number. So
 * it answers in the first line and asks for nothing: no login, no form, no app.
 *
 * It is rendered on the server and never cached. A cached price page would show
 * one customer another customer's quote, which is the one failure that must be
 * impossible here.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ token: string }>;

interface OpenResult {
  state: "ok" | "missing" | "expired" | "exhausted";
  body?: string;
  name?: string | null;
  brand?: string | null;
  whatsapp?: string | null;
  whatsapp_text?: string | null;
  opens?: number;
  max_opens?: number;
}

/**
 * Colours as CSS variables, not hex literals.
 *
 * The app's dark/light toggle lives in the root layout, so its button floated
 * over this page and did nothing: every colour here was a hard-coded hex inside
 * an inline style, which no class on <html> can reach. The customer pressed the
 * sun and the page stayed black.
 *
 * Every value is read through `var()` now and redefined under `html.light`,
 * which is the class the toggle flips (see components/ThemeToggle). That also
 * keeps this page a SERVER component — a `useTheme` hook would have forced it
 * client-side, and this page must render its price on the server, uncached.
 *
 * `:root` carries the dark values rather than a wrapper class, so the variables
 * exist before this page's own markup does and nothing flashes.
 */
const THEME_CSS = `
:root{
  --pl-bg:#0b0f1a; --pl-card:#141a2b; --pl-inset:#0f1424; --pl-border:#242c42;
  --pl-text:#f2f4f8; --pl-muted:#98a0b8; --pl-accent:#fe2c55; --pl-wa:#25d366;
  --pl-warn-bg:#2a1420; --pl-warn-text:#ffb3c6; --pl-shadow:0 18px 40px rgba(0,0,0,.35);
}
html.light{
  --pl-bg:#eef1f8; --pl-card:#ffffff; --pl-inset:#f6f8fc; --pl-border:#dfe4f0;
  --pl-text:#121829; --pl-muted:#5d6680; --pl-accent:#e0133f; --pl-wa:#1ebe5b;
  --pl-warn-bg:#fff1f4; --pl-warn-text:#a3123a; --pl-shadow:0 14px 34px rgba(20,30,60,.10);
}
`;

const C = {
  bg: "var(--pl-bg)", card: "var(--pl-card)", inset: "var(--pl-inset)",
  border: "var(--pl-border)", text: "var(--pl-text)", muted: "var(--pl-muted)",
  accent: "var(--pl-accent)", wa: "var(--pl-wa)",
};

export async function generateMetadata() {
  // Deliberately bare. A link pasted into a group chat must not unfurl the price
  // in the preview — that would leak exactly what the link exists to protect.
  return { title: "ردّك الخاص", robots: { index: false, follow: false } };
}

export default async function PrivateReplyPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!token || token.length > 32) notFound();

  /*
   * A reload must not cost the customer their single open: the limit exists to
   * stop a link being passed around, not to punish the person it was written for,
   * and that person WILL refresh or come back from WhatsApp with the back button.
   *
   * Read, never written, here. Next forbids cookie writes during a render -- "you
   * must use .set in a Server Function or Route Handler" -- and doing it in this
   * component threw before a single line rendered, so EVERY customer who tapped a
   * price link got an error screen. Middleware owns the cookie now and hands down
   * only the verdict, in a header it overwrites on every request.
   */
  const seen = (await headers()).get("x-pl-seen") === "1";

  const { data } = await supabaseAdmin.rpc("open_private_link", {
    p_token: token,
    p_count: !seen,
  });
  const r = (data ?? { state: "missing" }) as OpenResult;

  if (r.state !== "ok") return <Closed state={r.state} />;

  const wa = r.whatsapp ? whatsappUrl(r.whatsapp, r.whatsapp_text ?? null, token) : null;
  const shop = await loadShopIdentity(token);

  return (
    <Shell>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: "22px 20px", boxShadow: "var(--pl-shadow)",
      }}>
        {/*
          The shop, with its face.

          This page was a floating dark card with a red line of text on it, and a
          stranger arriving from a comment had no way to tell whose shop it was or
          whether it was real. The avatar and the name are the cheapest trust this
          page can buy, and the merchant has already given us both — the avatar
          from the TikTok account they linked, the rest from the profile they fill
          in for the bot. Nothing new to type.
        */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {shop.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.avatar} alt="" width={46} height={46}
              style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}` }} />
          ) : (
            <div style={{
              width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
              background: C.accent, color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 19, fontWeight: 800,
            }}>
              {(shop.name || r.brand || "T").trim().charAt(0)}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.4 }}>
              {shop.name || r.brand || "متجرنا"}
            </div>
            {shop.handle && (
              <div style={{ fontSize: 12.5, color: C.muted, direction: "ltr", textAlign: "right" }}>@{shop.handle}</div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 12 }}>
          {r.name ? `أهلاً ${r.name} 👋` : "أهلاً بك 👋"}
        </div>

        {/*
          The merchant's own words, shown as written. `white-space: pre-wrap` keeps
          their line breaks: they format prices as lists and a flattened list is
          unreadable on a phone.
        */}
        <div style={{
          fontSize: 17, lineHeight: 1.85, color: C.text, whiteSpace: "pre-wrap",
          wordBreak: "break-word", background: C.inset, border: `1px solid ${C.border}`,
          borderRadius: 13, padding: "16px 16px 10px",
        }}>
          {r.body}
          <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
            <CopyPrice body={r.body || ""} c={C} />
          </div>
        </div>

        {wa && r.whatsapp && (
          <OrderActions token={token} waUrl={wa} phone={r.whatsapp} c={C} />
        )}

        {/*
          Everything else the shop already told us. A customer who has just learned
          a price is one question away from "where are you" and "when do you open",
          and sending them back to a comment thread to ask it is how a sale
          evaporates. None of this is a price, so none of it is a leak.
        */}
        {(shop.addresses.length > 0 || shop.phones.length > 0 || shop.hours || shop.extra) && (
          <div style={{
            marginTop: 16, background: C.inset, border: `1px solid ${C.border}`,
            borderRadius: 13, padding: "14px 16px",
          }}>
            {shop.addresses.map((a) => <Fact key={a} icon="📍" value={a} />)}
            {shop.phones.map((n) => <Fact key={n} icon="📞" value={n} ltr />)}
            {shop.hours && <Fact icon="🕐" value={shop.hours} />}
            {shop.extra && <Fact icon="🚚" value={shop.extra} />}
          </div>
        )}

        {/*
          Stated loudly, and before the customer leaves rather than after.

          The link opens once. Someone who closes it assuming they can come back
          finds it gone, and blames the shop -- so the one sentence that prevents
          that complaint gets real weight on the page, not footnote grey. It also
          does the merchant's work for them: the way back is another comment.
        */}
        <div style={{
          marginTop: 16, background: "var(--pl-warn-bg)", border: "1px solid color-mix(in srgb, var(--pl-accent) 40%, transparent)",
          borderRadius: 12, padding: "13px 14px",
        }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ fontSize: 17, lineHeight: 1.2 }} aria-hidden>⚠️</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--pl-warn-text)", lineHeight: 1.6 }}>
                هذا الرابط صالح لمرة واحدة فقط
              </div>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.85, marginTop: 5 }}>
                يمكنك فتحه لمعرفة السعر. ولمعرفته مرة أخرى <strong>علّق من جديد</strong> ليُرسل إليك من جديد.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/**
 * Every ending states WHICH ending it is.
 *
 * "Not found" for a link that was used three times tells the customer nothing and
 * reads as a broken shop. Each case below names the cause and gives the one action
 * that works — commenting again, which is also what the merchant wants.
 */
/** One line of shop detail. */
function Fact({ icon, value, ltr }: { icon: string; value: string; ltr?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
      <span style={{ fontSize: 15, lineHeight: 1.6, flexShrink: 0 }} aria-hidden>{icon}</span>
      <span style={{
        fontSize: 14, color: C.text, lineHeight: 1.8, wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        ...(ltr ? { direction: "ltr" as const, textAlign: "right" as const } : {}),
      }}>{value}</span>
    </div>
  );
}

interface ShopIdentity {
  name: string | null;
  handle: string | null;
  avatar: string | null;
  addresses: string[];
  phones: string[];
  hours: string | null;
  extra: string | null;
}

/**
 * Who this shop is, assembled from what the merchant has already filled in.
 *
 * Read with its OWN query, never through `open_private_link`: that RPC spends one
 * of the customer's opens, and loading a logo must not cost someone their price.
 *
 * Every failure returns empties rather than throwing. The price is what the
 * customer came for; a missing avatar or an unreachable profile must never be
 * the reason they see an error instead.
 */
async function loadShopIdentity(token: string): Promise<ShopIdentity> {
  const empty: ShopIdentity = {
    name: null, handle: null, avatar: null, addresses: [], phones: [], hours: null, extra: null,
  };
  try {
    const { data: link } = await supabaseAdmin
      .from("private_links").select("user_id, page_id, platform, brand_name")
      .eq("token", token).maybeSingle();
    if (!link?.user_id) return empty;

    const [facts, account] = await Promise.all([
      loadShopFacts(link.user_id as string, link.page_id as string | null).catch(() => null),
      link.platform === "tiktok" && link.page_id
        ? supabaseAdmin.from("tiktok_accounts")
            .select("display_name, username, avatar_url")
            .eq("tiktok_account_id", link.page_id).eq("user_id", link.user_id)
            .maybeSingle().then((x) => x.data, () => null)
        : Promise.resolve(null),
    ]);

    return {
      // The merchant's own brand name wins over the TikTok display name: it is
      // the one they chose for customers, not the one the platform shows.
      name: facts?.brandName || account?.display_name || (link.brand_name as string | null) || null,
      handle: account?.username || null,
      avatar: account?.avatar_url || null,
      addresses: facts?.addresses ?? [],
      phones: facts?.phones ?? [],
      hours: facts?.hours ?? null,
      extra: facts?.extra ?? null,
    };
  } catch {
    return empty;
  }
}

function Closed({ state }: { state: OpenResult["state"] }) {
  const copy =
    state === "expired"
      ? { icon: "⏳", title: "انتهت صلاحية هذا الرابط", body: "الروابط صالحة لفترة محدودة. علّق على المنشور من جديد وسيصلك رد جديد خلال ثوانٍ." }
      : state === "exhausted"
        ? { icon: "🔒", title: "تم فتح هذا الرابط من قبل", body: "الرابط صالح لمرة واحدة فقط. علّق على المنشور من جديد وسيصلك رابط جديد خلال ثوانٍ." }
        : { icon: "🔍", title: "هذا الرابط غير موجود", body: "تأكد من نسخ الرابط كاملاً، أو علّق على المنشور من جديد." };

  return (
    <Shell>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: "30px 22px", textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{copy.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 9 }}>{copy.title}</div>
        <div style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.85 }}>{copy.body}</div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        The variables, and a background painted on <html> as well as here.

        The toggle only changes a class; something has to translate that class
        into colour, and on this page nothing did. Setting it on the root element
        too means the area behind a short card — and the overscroll rubber-band
        on iOS — follows the theme instead of staying black under a white card.
      */}
      <style>{`${THEME_CSS}
html, body { background: var(--pl-bg); }
`}</style>
      <div dir="rtl" style={{
        minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "24px 16px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
        // The toggle is a fixed button in the corner; without this the card can
        // sit under it on a short screen.
        paddingBottom: 92,
      }}>
        <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
      </div>
    </>
  );
}
