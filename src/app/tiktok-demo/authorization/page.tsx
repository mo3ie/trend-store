"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Info, ArrowLeft, ArrowRight } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoPermissions } from "@/data/tiktokDemo";
import { Button, Card, DemoBadge } from "@/components/tiktok-demo/DemoKit";

/**
 * Authorization PREVIEW.
 *
 * ⚠️ This is deliberately NOT a copy of TikTok's login or consent screen: it carries Trend
 * Store's own branding and an explicit "Authorization Preview" label, so it can never be
 * mistaken for TikTok. It illustrates which permissions the business owner will be asked to
 * grant once the developer application is approved, at which point the real, official TikTok
 * OAuth flow replaces this screen.
 */
export default function AuthorizationPreviewPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { connect } = useTikTokDemo();
  const [authorizing, setAuthorizing] = useState(false);
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  function authorize() {
    setAuthorizing(true);
    // Local state only — nothing is sent anywhere.
    setTimeout(() => {
      connect();
      router.push("/tiktok-demo/success");
    }, 1400);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Trend Store identity — never TikTok's */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-sm font-black text-white">
              T
            </span>
            <div>
              <div className="text-sm font-black">{t("محل ترند", "Trend Store")}</div>
              <div className="text-[11px] text-[var(--muted-2)]">trendstore-ly.com</div>
            </div>
          </div>
          <DemoBadge
            label={t("معاينة التصريح", "Authorization Preview")}
            hint={t(
              "هذه الواجهة تعرض خطوة التصريح المخطط لها، وليست شاشة تيك توك الرسمية.",
              "This screen previews the planned authorization step; it is not TikTok's official screen.",
            )}
          />
        </div>

        <Card>
          <h1 className="text-xl font-black">{t("ربط حساب TikTok الخاص بك", "Connect your TikTok account")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {t(
              "امنح «محل ترند» صلاحية الوصول إلى إمكانيات حساب TikTok التي تختارها بنفسك.",
              "Authorize Trend Store to access the TikTok account permissions you select.",
            )}
          </p>

          <div
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-blue-400/25 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-200"
            role="note"
          >
            <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {t(
                "هذه معاينة توضيحية للخطوة التي ستتم عبر تدفق OAuth الرسمي من TikTok بعد اعتماد طلب المطوّر.",
                "This prototype represents the authorization step that will use TikTok's official OAuth flow after the developer application is approved.",
              )}
            </span>
          </div>

          {/* Requested permissions */}
          <ul className="mt-5 space-y-2.5" aria-label={t("الصلاحيات المطلوبة", "Requested permissions")}>
            {demoPermissions.map((p) => (
              <li
                key={p.key}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white/5 p-3.5"
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-blue-500"
                  aria-hidden="true"
                >
                  <ShieldCheck size={12} className="text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--text)]">{t(p.titleAr, p.titleEn)}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{t(p.descAr, p.descEn)}</div>
                  <div className="mt-1 text-[10px] font-medium text-[var(--muted-2)]">{p.titleEn}</div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 rounded-xl border border-[var(--border)] bg-white/5 p-3 text-xs leading-relaxed text-[var(--muted)]">
            {t(
              "يستخدم «محل ترند» الصلاحيات التي تمنحها أنت فقط، ولا يطلب الوصول إلى أي بيانات TikTok غير ذات صلة.",
              "Trend Store only uses the permissions granted by you and does not request access to unrelated TikTok data.",
            )}
          </p>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push("/tiktok")} disabled={authorizing}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button onClick={authorize} disabled={authorizing}>
              {authorizing ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {t("جارٍ التصريح…", "Authorizing…")}
                </>
              ) : (
                <>
                  {t("تصريح لمحل ترند", "Authorize Trend Store")}
                  <Fwd size={15} aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
