"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { demoAccount } from "@/data/tiktokDemo";
import { Avatar, Button, Card, DemoBadge, StatusChip } from "@/components/tiktok-demo/DemoKit";

/** Result screen after the authorization preview. Demo state only — no account was contacted. */
export default function AuthorizationSuccessPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const Fwd = rtl ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]" dir={rtl ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
        <div className="mb-4">
          <DemoBadge
            label={t("نموذج أولي", "Prototype / Demo")}
            hint={t(
              "هذه الواجهة توضّح سير عمل TikTok Accounts API المخطط له.",
              "This interface demonstrates the planned TikTok Accounts API workflow.",
            )}
          />
        </div>

        <span
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30"
          aria-hidden="true"
        >
          <CheckCircle2 size={44} className="text-emerald-400" />
        </span>

        <h1 className="text-2xl font-black">{t("تم ربط حساب TikTok", "TikTok account connected")}</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
          {t(
            "تم التصريح لحساب TikTok الخاص بك للعمل مع «محل ترند».",
            "Your TikTok account has been successfully authorized for Trend Store.",
          )}
        </p>

        <Card className="mt-7 w-full text-start">
          <div className="flex items-center gap-3.5">
            <Avatar name={demoAccount.displayName} colors={demoAccount.avatarColor} size={52} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-[var(--text)]">{demoAccount.displayName}</div>
              <div className="truncate text-xs text-[var(--muted)]">{demoAccount.username}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusChip tone="purple">{t("حساب أعمال", "Business Account")}</StatusChip>
                <StatusChip tone="green">{t("مصرّح به", "Authorized")}</StatusChip>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-7 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push("/tiktok-bot/demo-account")}>
            {t("فتح لوحة TikTok", "Open TikTok Dashboard")}
            <Fwd size={15} aria-hidden="true" />
          </Button>
          <Button variant="ghost" onClick={() => router.push("/tiktok-bot")}>
            {t("العودة إلى حسابات TikTok", "Back to TikTok Accounts")}
          </Button>
        </div>
      </div>
    </div>
  );
}
