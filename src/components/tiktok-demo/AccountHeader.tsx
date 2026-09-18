"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Unplug, Loader2 } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoAccount } from "@/data/tiktokDemo";
import { Avatar, Button, Card, Modal, StatusChip } from "@/components/tiktok-demo/DemoKit";

/**
 * Identity card for the connected demo account, shared by every prototype screen, plus the
 * disconnect confirmation. Disconnecting only clears local demo state.
 */
export function AccountHeader({ onToast }: { onToast?: (msg: string) => void }) {
  const { t, rtl } = useLang();
  const router = useRouter();
  const { disconnect } = useTikTokDemo();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  function confirmDisconnect() {
    setWorking(true);
    setTimeout(() => {
      disconnect();
      setWorking(false);
      setConfirming(false);
      onToast?.(t("تم فصل حساب TikTok", "TikTok account disconnected"));
      router.push("/tiktok-bot");
    }, 700);
  }

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={demoAccount.displayName} colors={demoAccount.avatarColor} size={56} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-black text-[var(--text)]">{demoAccount.displayName}</h1>
              <BadgeCheck size={16} className="text-blue-400" aria-hidden="true" />
            </div>
            <div className="text-xs text-[var(--muted)]" dir="ltr">{demoAccount.username}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusChip tone="purple">{t("حساب أعمال", "Business Account")}</StatusChip>
              <StatusChip tone="green">{t("متصل", "Connected")}</StatusChip>
              <StatusChip tone="green">{t("مصرّح به", "Authorized")}</StatusChip>
            </div>
          </div>

          <Button variant="danger" onClick={() => setConfirming(true)}>
            <Unplug size={15} aria-hidden="true" />
            {t("فصل الحساب", "Disconnect")}
          </Button>
        </div>
      </Card>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("فصل حساب TikTok؟", "Disconnect TikTok account?")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={working}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant="danger" onClick={confirmDisconnect} disabled={working}>
              {working ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Unplug size={15} aria-hidden="true" />}
              {t("فصل الحساب", "Disconnect")}
            </Button>
          </>
        }
      >
        <p className="leading-relaxed" dir={rtl ? "rtl" : "ltr"}>
          {t(
            "سيؤدي الفصل إلى إزالة هذا الحساب من «محل ترند». يمكنك ربطه مرة أخرى لاحقاً.",
            "Disconnecting will remove this account from Trend Store. You can reconnect it later.",
          )}
        </p>
      </Modal>
    </>
  );
}

/** Tab strip for the account area. Each tab is a real route, so deep links work. */
export function AccountTabs() {
  const { t } = useLang();
  const pathname = usePathname();
  const base = "/tiktok-bot/demo-account";

  const tabs = [
    { href: base, ar: "نظرة عامة", en: "Overview" },
    { href: `${base}/videos`, ar: "الفيديوهات", en: "Videos" },
    { href: `${base}/comments`, ar: "التعليقات", en: "Comments" },
    { href: `${base}/publish`, ar: "نشر المحتوى", en: "Publish" },
  ];

  return (
    <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t("أقسام الحساب", "Account sections")}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.en}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
              active
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                : "border border-[var(--border)] bg-white/5 text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t(tab.ar, tab.en)}
          </Link>
        );
      })}
    </div>
  );
}

/** Shown on prototype screens when the demo account has not been connected yet. */
export function NotConnected() {
  const { t } = useLang();
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <h2 className="text-base font-black text-[var(--text)]">
        {t("لا يوجد حساب مرتبط", "No account connected")}
      </h2>
      <p className="max-w-sm text-xs leading-relaxed text-[var(--muted)]">
        {t(
          "ابدأ تدفق التصريح التجريبي لعرض بيانات الحساب والفيديوهات والتعليقات.",
          "Start the demo authorization flow to view account information, videos and comments.",
        )}
      </p>
      <Link
        href="/tiktok-demo/authorization"
        className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
      >
        {t("ربط حساب TikTok", "Connect TikTok Account")}
      </Link>
    </Card>
  );
}
