"use client";

import Link from "next/link";
import { Eye, Heart, MessageSquare, Video as VideoIcon } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import {
  demoAccount, demoVideos, formatCount, formatDate,
} from "@/data/tiktokDemo";
import {
  Card, DemoDataTag, SectionTitle, Skeleton, StatPill, Thumb, Toasts, useToasts,
} from "@/components/tiktok-demo/DemoKit";
import { AccountHeader, AccountTabs, NotConnected } from "@/components/tiktok-demo/AccountHeader";
import { CommentRow } from "@/components/tiktok-demo/CommentRow";

/** Overview tab: account information, recent videos and recent comments (all demo data). */
export default function DemoAccountOverview() {
  const { t, lang } = useLang();
  const { connected, hydrated, comments } = useTikTokDemo();
  const { toasts, push, dismiss } = useToasts();

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!connected) return <NotConnected />;

  const recentVideos = demoVideos.slice(0, 3);
  const recentComments = comments.slice(0, 3);
  const videoTitle = (id: string) => demoVideos.find((v) => v.id === id)?.title;

  const info: Array<[string, string]> = [
    [t("الاسم الظاهر", "Display Name"), demoAccount.displayName],
    [t("اسم المستخدم", "Username"), demoAccount.username],
    [t("نوع الحساب", "Account Type"), t("حساب أعمال", "Business Account")],
    [t("حالة الاتصال", "Connection Status"), t("متصل", "Connected")],
    [t("حالة التصريح", "Authorization"), t("مصرّح به", "Authorized")],
  ];

  return (
    <>
      <AccountHeader onToast={push} />
      <AccountTabs />

      {/* Account information */}
      <Card className="mb-5">
        <SectionTitle
          title={t("معلومات الحساب", "Account Information")}
          subtitle={t("تُعرض بعد تصريح صاحب الحساب", "Shown after the account owner authorizes access")}
        />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
              <dt className="text-[11px] text-[var(--muted-2)]">{label}</dt>
              <dd className="mt-1 text-sm font-bold text-[var(--text)]" dir={value.startsWith("@") ? "ltr" : undefined}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatPill label={t("الفيديوهات", "Videos")} value={String(demoAccount.stats.videos)} />
          <StatPill label={t("التعليقات", "Comments")} value={String(comments.length)} />
          <StatPill label={t("المتابعون", "Followers")} value={formatCount(demoAccount.stats.followers)} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--muted-2)]">
          <DemoDataTag text={t("بيانات تجريبية", "Demo data")} />
          {t("الأرقام أعلاه توضيحية وليست إحصاءات TikTok حقيقية.", "These figures are illustrative, not real TikTok statistics.")}
        </p>
      </Card>

      {/* Recent videos */}
      <section className="mb-5">
        <SectionTitle
          title={t("أحدث الفيديوهات", "Recent Videos")}
          action={
            <Link href="/tiktok-bot/demo-account/videos" className="text-xs font-bold text-purple-300 hover:text-purple-200">
              {t("عرض الكل", "View all")}
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentVideos.map((v) => (
            <Card key={v.id} className="!p-3">
              <Thumb colors={v.thumb} label={`${v.durationSec}s`} ratio="aspect-video" />
              <h3 className="mt-3 line-clamp-2 text-sm font-bold text-[var(--text)]">{v.title}</h3>
              <p className="mt-1 text-[11px] text-[var(--muted-2)]">{formatDate(v.createdAt, lang)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--muted)]">
                <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden="true" /> {formatCount(v.views)}</span>
                <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden="true" /> {formatCount(v.likes)}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare size={12} aria-hidden="true" /> {v.comments}</span>
                <DemoDataTag text={t("بيانات تجريبية", "Demo data")} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent comments */}
      <section>
        <SectionTitle
          title={t("أحدث التعليقات", "Recent Comments")}
          action={
            <Link href="/tiktok-bot/demo-account/comments" className="text-xs font-bold text-purple-300 hover:text-purple-200">
              {t("إدارة التعليقات", "Manage comments")}
            </Link>
          }
        />
        {recentComments.length === 0 ? (
          <Card className="py-10 text-center text-xs text-[var(--muted)]">
            <VideoIcon size={22} className="mx-auto mb-2 text-[var(--muted-2)]" aria-hidden="true" />
            {t("لا توجد تعليقات في العرض التجريبي.", "No comments in the demo.")}
          </Card>
        ) : (
          <div className="space-y-3">
            {recentComments.map((c) => (
              <CommentRow key={c.id} comment={c} videoTitle={videoTitle(c.videoId)} onToast={push} compact />
            ))}
          </div>
        )}
      </section>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
