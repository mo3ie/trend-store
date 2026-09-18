"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Search, Database } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoVideos } from "@/data/tiktokDemo";
import {
  Card, EmptyState, SectionTitle, Skeleton, Toasts, useToasts,
} from "@/components/tiktok-demo/DemoKit";
import { AccountHeader, AccountTabs, NotConnected } from "@/components/tiktok-demo/AccountHeader";
import { CommentRow } from "@/components/tiktok-demo/CommentRow";

/**
 * Comment management for videos owned by the authorized account.
 * ⚠️ All actions (reply, like, hide, delete) mutate local demo state only.
 */
function CommentsInner() {
  const { t, rtl } = useLang();
  const params = useSearchParams();
  const { connected, hydrated, comments } = useTikTokDemo();
  const { toasts, push, dismiss } = useToasts();

  const [videoFilter, setVideoFilter] = useState<string>(params.get("video") ?? "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return comments.filter((c) => {
      if (videoFilter !== "all" && c.videoId !== videoFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !c.text.toLowerCase().includes(q) && !c.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [comments, videoFilter, statusFilter, query]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  if (!connected) return <NotConnected />;

  const videoTitle = (id: string) => demoVideos.find((v) => v.id === id)?.title;
  const selectClass =
    "rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400";

  return (
    <>
      <AccountHeader onToast={push} />
      <AccountTabs />

      <SectionTitle
        title={t("تعليقات TikTok", "TikTok Comments")}
        subtitle={t(
          "إدارة التعليقات على الفيديوهات المملوكة للحساب المرتبط",
          "Manage comments on videos owned by the connected account",
        )}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted-2)]">
            <Database size={12} aria-hidden="true" />
            Accounts API — {t("تجريبي", "Demo")}
          </span>
        }
      />

      {/* Filters */}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="video-filter" className="mb-1.5 block text-[11px] font-bold text-[var(--muted-2)]">
              {t("الفيديو", "Video")}
            </label>
            <select
              id="video-filter"
              value={videoFilter}
              onChange={(e) => setVideoFilter(e.target.value)}
              className={`${selectClass} w-full`}
            >
              <option value="all">{t("كل الفيديوهات", "All videos")}</option>
              {demoVideos.map((v) => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status-filter" className="mb-1.5 block text-[11px] font-bold text-[var(--muted-2)]">
              {t("الحالة", "Status")}
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "visible" | "hidden")}
              className={`${selectClass} w-full`}
            >
              <option value="all">{t("الكل", "All")}</option>
              <option value="visible">{t("ظاهر", "Visible")}</option>
              <option value="hidden">{t("مخفي", "Hidden")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="comment-search" className="mb-1.5 block text-[11px] font-bold text-[var(--muted-2)]">
              {t("بحث", "Search comments")}
            </label>
            <div className="relative">
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--muted-2)]"
                style={{ [rtl ? "right" : "left"]: 12 } as React.CSSProperties}
              />
              <input
                id="comment-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("ابحث في التعليقات…", "Search comments…")}
                className={`${selectClass} w-full ps-9`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={30} />}
          title={t("لا توجد تعليقات مطابقة", "No matching comments")}
          body={t(
            "جرّب تغيير الفلاتر أو مسح مربع البحث لعرض تعليقات العرض التجريبي.",
            "Try changing the filters or clearing the search to see the demo comments.",
          )}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CommentRow key={c.id} comment={c} videoTitle={videoTitle(c.videoId)} onToast={push} />
          ))}
        </div>
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export default function DemoCommentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CommentsInner />
    </Suspense>
  );
}
