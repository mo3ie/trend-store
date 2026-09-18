"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Heart, MessageSquare, RefreshCw, Settings2, Loader2, Database } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoVideos, formatCount, formatDate } from "@/data/tiktokDemo";
import {
  Button, Card, DemoDataTag, Modal, SectionTitle, Skeleton, Thumb, Toasts, useToasts,
} from "@/components/tiktok-demo/DemoKit";
import { AccountHeader, AccountTabs, NotConnected } from "@/components/tiktok-demo/AccountHeader";

/**
 * Videos belonging to the authorized account.
 *
 * ⚠️ Demo data. The "Accounts API — Demo" label makes clear that nothing was actually
 * retrieved from TikTok during the prototype.
 */
export default function DemoVideosPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { connected, hydrated } = useTikTokDemo();
  const { toasts, push, dismiss } = useToasts();
  const [refreshing, setRefreshing] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  if (!connected) return <NotConnected />;

  function refresh() {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      push(t("تم تحديث قائمة الفيديوهات", "Videos refreshed"));
    }, 1100);
  }

  const managed = demoVideos.find((v) => v.id === manageId) ?? null;

  return (
    <>
      <AccountHeader onToast={push} />
      <AccountTabs />

      <SectionTitle
        title={t("فيديوهات TikTok", "TikTok Videos")}
        subtitle={t(
          "الفيديوهات الخاصة بحساب TikTok المرتبط",
          "Videos retrieved from the connected TikTok account",
        )}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted-2)]">
              <Database size={12} aria-hidden="true" />
              Accounts API — {t("تجريبي", "Demo")}
            </span>
            <Button variant="ghost" onClick={refresh} disabled={refreshing}>
              {refreshing
                ? <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                : <RefreshCw size={15} aria-hidden="true" />}
              {refreshing ? t("جارٍ تحديث الفيديوهات…", "Refreshing videos…") : t("تحديث", "Refresh")}
            </Button>
          </div>
        }
      />

      {refreshing ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoVideos.map((v) => (
            <Card key={v.id} className="!p-3">
              <Thumb colors={v.thumb} label={`${v.durationSec}s`} ratio="aspect-video" />

              <h3 className="mt-3 line-clamp-2 text-sm font-bold text-[var(--text)]">{v.title}</h3>
              <p className="mt-1 text-[11px] text-[var(--muted-2)]">{formatDate(v.createdAt, lang)}</p>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden="true" /> {formatCount(v.views)}</span>
                <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" /> {formatCount(v.likes)}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden="true" /> {v.comments}</span>
              </div>
              <div className="mt-1.5"><DemoDataTag text={t("بيانات تجريبية", "Demo data")} /></div>

              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1 !px-3 !py-2 !text-xs"
                  onClick={() => router.push(`/tiktok-bot/demo-account/comments?video=${v.id}`)}
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  {t("عرض التعليقات", "View Comments")}
                </Button>
                <Button variant="ghost" className="!px-3 !py-2 !text-xs" onClick={() => setManageId(v.id)}>
                  <Settings2 size={13} aria-hidden="true" />
                  {t("إدارة", "Manage")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={managed !== null}
        onClose={() => setManageId(null)}
        title={t("إدارة الفيديو", "Manage video")}
        footer={<Button variant="ghost" onClick={() => setManageId(null)}>{t("إغلاق", "Close")}</Button>}
      >
        {managed && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-28 shrink-0"><Thumb colors={managed.thumb} ratio="aspect-video" /></div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[var(--text)]">{managed.title}</div>
                <div className="mt-1 text-[11px] text-[var(--muted-2)]">{formatDate(managed.createdAt, lang)}</div>
              </div>
            </div>
            <p className="rounded-xl border border-[var(--border)] bg-white/5 p-3 text-xs leading-relaxed">
              {t(
                "في النسخة المعتمدة، ستتيح هذه النافذة إدارة تعليقات الفيديو عبر TikTok Accounts API وفق الصلاحيات الممنوحة.",
                "In the approved version this panel manages the video's comments through the TikTok Accounts API, within the granted permissions.",
              )}
            </p>
          </div>
        )}
      </Modal>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
