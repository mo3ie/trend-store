"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Video, MessageSquare, Upload, Unplug, Loader2,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoAccount, formatCount } from "@/data/tiktokDemo";
import {
  Avatar, Button, DemoBadge, DemoDataTag, Modal, StatPill, StatusChip, Toasts, useToasts,
} from "@/components/tiktok-demo/DemoKit";

/**
 * The connected DEMO account, shown on the accounts dashboard.
 *
 * ⚠️ Prototype only: it appears alongside the real connected accounts and never replaces
 * them, and every action here changes local demo state only.
 */
export function TikTokDemoAccountCard() {
  const { t } = useLang();
  const router = useRouter();
  const { comments, publishing, disconnect } = useTikTokDemo();
  const { toasts, push, dismiss } = useToasts();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  const base = "/tiktok-bot/demo-account";
  const actions = [
    { icon: LayoutDashboard, ar: "فتح اللوحة", en: "Open Dashboard", href: base, primary: true },
    { icon: Video, ar: "الفيديوهات", en: "View Videos", href: `${base}/videos` },
    { icon: MessageSquare, ar: "التعليقات", en: "View Comments", href: `${base}/comments` },
    { icon: Upload, ar: "نشر المحتوى", en: "Publish Content", href: `${base}/publish` },
  ];

  function confirmDisconnect() {
    setWorking(true);
    setTimeout(() => {
      disconnect();
      setWorking(false);
      setConfirming(false);
      push(t("تم فصل حساب TikTok", "TikTok account disconnected"));
    }, 700);
  }

  return (
    <div
      dir="rtl"
      className="mb-6 rounded-2xl border border-purple-400/25 bg-gradient-to-br from-purple-600/12 to-blue-600/10 p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-white">
          {t("حسابات TikTok", "TikTok Accounts")}
        </h2>
        <DemoBadge
          label={t("نموذج أولي", "Prototype / Demo")}
          hint={t(
            "هذه الواجهة توضّح سير عمل TikTok Accounts API المخطط له باستخدام بيانات تجريبية.",
            "This interface demonstrates the planned TikTok Accounts API workflow using demo data.",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={demoAccount.displayName} colors={demoAccount.avatarColor} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-white">{demoAccount.displayName}</div>
          <div className="truncate text-xs text-slate-300" dir="ltr">{demoAccount.username}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusChip tone="purple">{t("حساب أعمال", "Business Account")}</StatusChip>
            <StatusChip tone="green">{t("متصل", "Connected")}</StatusChip>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatPill label={t("الفيديوهات", "Videos")} value={String(demoAccount.stats.videos)} />
        <StatPill label={t("التعليقات", "Comments")} value={String(comments.length)} />
        <StatPill label={t("المتابعون", "Followers")} value={formatCount(demoAccount.stats.followers)} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <DemoDataTag text={t("بيانات تجريبية", "Demo data")} />
        <span className="text-[11px] text-slate-400">
          {t("آخر نشاط نشر:", "Latest publishing activity:")} {publishing.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.en}
              variant={a.primary ? "primary" : "ghost"}
              className="!px-3 !py-2 !text-xs"
              onClick={() => router.push(a.href)}
            >
              <Icon size={13} aria-hidden="true" />
              {t(a.ar, a.en)}
            </Button>
          );
        })}
        <Button variant="danger" className="!px-3 !py-2 !text-xs" onClick={() => setConfirming(true)}>
          <Unplug size={13} aria-hidden="true" />
          {t("فصل الحساب", "Disconnect")}
        </Button>
      </div>

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
              {working && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {t("فصل الحساب", "Disconnect")}
            </Button>
          </>
        }
      >
        <p className="leading-relaxed">
          {t(
            "سيؤدي الفصل إلى إزالة هذا الحساب من «محل ترند». يمكنك ربطه مرة أخرى لاحقاً.",
            "Disconnecting will remove this account from Trend Store. You can reconnect it later.",
          )}
        </p>
      </Modal>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
