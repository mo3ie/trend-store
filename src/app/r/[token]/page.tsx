import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappUrl } from "@/lib/privateLinks";

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

const C = {
  bg: "#0b0f1a", card: "#141a2b", border: "#242c42", text: "#f2f4f8",
  muted: "#98a0b8", accent: "#fe2c55", wa: "#25d366",
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
   * A reload must not cost the customer an open.
   *
   * The open limit exists to stop a link being passed around, not to punish the
   * person it was written for — and that person WILL refresh, or come back from
   * WhatsApp with the back button. So the first view sets a cookie for this token
   * and every later view from the same browser is read-only.
   */
  const jar = await cookies();
  const seen = jar.get(`pl_${token}`)?.value === "1";

  const { data } = await supabaseAdmin.rpc("open_private_link", {
    p_token: token,
    p_count: !seen,
  });
  const r = (data ?? { state: "missing" }) as OpenResult;

  if (r.state !== "ok") return <Closed state={r.state} />;
  if (!seen) {
    // Scoped to this one link and short-lived: it is a view marker, not a session.
    jar.set(`pl_${token}`, "1", {
      httpOnly: true, sameSite: "lax", secure: true,
      path: `/r/${token}`, maxAge: 60 * 60 * 24 * 7,
    });
  }

  const wa = r.whatsapp ? whatsappUrl(r.whatsapp, r.whatsapp_text ?? null, token) : null;

  return (
    <Shell>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 18,
        padding: "22px 20px", boxShadow: "0 18px 40px rgba(0,0,0,.35)",
      }}>
        {r.brand && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent, letterSpacing: ".3px", marginBottom: 12 }}>
            {r.brand}
          </div>
        )}

        <div style={{ fontSize: 19, fontWeight: 800, color: C.text, marginBottom: 14 }}>
          {r.name ? `أهلاً ${r.name} 👋` : "أهلاً بك 👋"}
        </div>

        {/*
          The merchant's own words, shown as written. `white-space: pre-wrap` keeps
          their line breaks: they format prices as lists and a flattened list is
          unreadable on a phone.
        */}
        <div style={{
          fontSize: 16, lineHeight: 1.85, color: C.text, whiteSpace: "pre-wrap",
          wordBreak: "break-word", background: "#0f1424", border: `1px solid ${C.border}`,
          borderRadius: 13, padding: "15px 16px",
        }}>
          {r.body}
        </div>

        {wa && (
          <a
            href={`/api/r/${token}/wa`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
              marginTop: 16, background: C.wa, color: "#06281a", textDecoration: "none",
              borderRadius: 12, padding: "14px 18px", fontSize: 16, fontWeight: 800,
            }}
          >
            <WhatsAppIcon /> اطلب الآن على واتساب
          </a>
        )}

        <div style={{ marginTop: 14, fontSize: 11.5, color: C.muted, lineHeight: 1.7 }}>
          هذا الرابط خاص بك ومحدود المدة. إن احتجت الرد مرة أخرى، علّق على المنشور من جديد.
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
function Closed({ state }: { state: OpenResult["state"] }) {
  const copy =
    state === "expired"
      ? { icon: "⏳", title: "انتهت صلاحية هذا الرابط", body: "الروابط صالحة لفترة محدودة. علّق على المنشور من جديد وسيصلك رد جديد خلال ثوانٍ." }
      : state === "exhausted"
        ? { icon: "🔒", title: "تم فتح هذا الرابط من قبل", body: "كل رابط يُفتح عدداً محدوداً من المرات. علّق على المنشور من جديد للحصول على رابط جديد." }
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
    <div dir="rtl" style={{
      minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px 16px",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 016.993 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
