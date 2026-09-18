/**
 * TikTok Accounts API — PROTOTYPE demo data.
 *
 * ⚠️ MOCK DATA ONLY. Nothing here comes from TikTok and nothing here is sent to TikTok.
 * This file exists so the demonstration UI (screen recording for the TikTok Accounts API
 * access application) can show the intended workflow without calling the real API.
 *
 * Kept deliberately OUTSIDE src/services/tiktok*.ts so production code can never import it
 * and so a reviewer can see at a glance which data is illustrative.
 */

export interface DemoAccount {
  id: string;
  displayName: string;
  username: string;
  accountType: string;
  avatarColor: [string, string];
  /** Illustrative only — never presented as real TikTok statistics. */
  stats: { videos: number; comments: number; followers: number };
}

export interface DemoVideo {
  id: string;
  title: string;
  /** ISO date. */
  createdAt: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  /** Gradient stops used to render a branded placeholder thumbnail (no external assets). */
  thumb: [string, string];
}

export type CommentStatus = "visible" | "hidden";

export interface DemoReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  /** True when Trend Store (the account owner) wrote it. */
  byOwner: boolean;
}

export interface DemoComment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  createdAt: string;
  likes: number;
  likedByOwner: boolean;
  status: CommentStatus;
  replies: DemoReply[];
}

export type PublishStatus = "published" | "processing" | "draft";

export interface DemoPublishItem {
  id: string;
  type: "video" | "photo";
  caption: string;
  status: PublishStatus;
  createdAt: string;
  thumb: [string, string];
}

/** The single demo account used across the prototype. */
export const demoAccount: DemoAccount = {
  id: "demo-account",
  displayName: "Trend Store Demo",
  username: "@trendstore_demo",
  accountType: "Business Account",
  avatarColor: ["#7c5cff", "#3b82f6"],
  stats: { videos: 6, comments: 18, followers: 12400 },
};

export const demoVideos: DemoVideo[] = [
  {
    id: "v-1001", title: "جولة داخل متجر ترند للإلكترونيات",
    createdAt: "2026-09-12T10:20:00Z", durationSec: 34,
    views: 18420, likes: 1240, comments: 86, thumb: ["#7c5cff", "#2563eb"],
  },
  {
    id: "v-1002", title: "مراجعة سماعات لاسلكية — هل تستحق؟",
    createdAt: "2026-09-09T16:05:00Z", durationSec: 51,
    views: 12750, likes: 903, comments: 54, thumb: ["#2563eb", "#06b6d4"],
  },
  {
    id: "v-1003", title: "٣ نصائح لإطالة عمر بطارية هاتفك",
    createdAt: "2026-09-05T08:45:00Z", durationSec: 28,
    views: 24100, likes: 2115, comments: 132, thumb: ["#8b5cf6", "#ec4899"],
  },
  {
    id: "v-1004", title: "أفضل لابتوب للطلاب بميزانية محدودة",
    createdAt: "2026-08-30T12:00:00Z", durationSec: 62,
    views: 9310, likes: 611, comments: 39, thumb: ["#0ea5e9", "#6366f1"],
  },
  {
    id: "v-1005", title: "فتح صندوق: بلايستيشن ٥ الإصدار الجديد",
    createdAt: "2026-08-24T19:30:00Z", durationSec: 47,
    views: 31200, likes: 2870, comments: 168, thumb: ["#f59e0b", "#ef4444"],
  },
  {
    id: "v-1006", title: "كيف تحمي حسابك من الاختراق",
    createdAt: "2026-08-18T09:10:00Z", durationSec: 39,
    views: 7640, likes: 498, comments: 27, thumb: ["#10b981", "#0ea5e9"],
  },
];

export const demoComments: DemoComment[] = [
  {
    id: "c-2001", videoId: "v-1001", author: "@user_one",
    text: "فيديو رائع 🔥", createdAt: "2026-09-12T12:02:00Z",
    likes: 12, likedByOwner: false, status: "visible", replies: [],
  },
  {
    id: "c-2002", videoId: "v-1001", author: "@user_two",
    text: "من أين يمكنني شراء هذا؟", createdAt: "2026-09-12T13:41:00Z",
    likes: 5, likedByOwner: false, status: "visible",
    replies: [
      {
        id: "r-3001", author: demoAccount.username,
        text: "متوفر في فرع قاريونس وفرع بلعون — أهلاً بك!",
        createdAt: "2026-09-12T14:05:00Z", byOwner: true,
      },
    ],
  },
  {
    id: "c-2003", videoId: "v-1003", author: "@user_three",
    text: "شرح ممتاز وواضح، شكراً لكم", createdAt: "2026-09-06T09:15:00Z",
    likes: 23, likedByOwner: true, status: "visible", replies: [],
  },
  {
    id: "c-2004", videoId: "v-1003", author: "@tech_fan",
    text: "هل النصيحة الثانية تنطبق على الأندرويد أيضاً؟",
    createdAt: "2026-09-06T11:48:00Z",
    likes: 8, likedByOwner: false, status: "visible", replies: [],
  },
  {
    id: "c-2005", videoId: "v-1005", author: "@gamer_ly",
    text: "كم السعر مع الضمان؟", createdAt: "2026-08-25T08:20:00Z",
    likes: 17, likedByOwner: false, status: "visible", replies: [],
  },
  {
    id: "c-2006", videoId: "v-1005", author: "@spam_account",
    text: "رابط مشبوه — عروض وهمية", createdAt: "2026-08-25T10:02:00Z",
    likes: 0, likedByOwner: false, status: "hidden", replies: [],
  },
  {
    id: "c-2007", videoId: "v-1002", author: "@sara_m",
    text: "اشتريتها بناءً على المراجعة وممتازة 👌",
    createdAt: "2026-09-10T18:26:00Z",
    likes: 31, likedByOwner: true, status: "visible", replies: [],
  },
  {
    id: "c-2008", videoId: "v-1004", author: "@student_2026",
    text: "هل يوجد تقسيط للطلاب؟", createdAt: "2026-08-31T07:55:00Z",
    likes: 4, likedByOwner: false, status: "visible", replies: [],
  },
];

export const demoPublishingHistory: DemoPublishItem[] = [
  {
    id: "p-4001", type: "video", caption: "عرض نهاية الأسبوع على السماعات",
    status: "published", createdAt: "2026-09-14T09:00:00Z", thumb: ["#7c5cff", "#2563eb"],
  },
  {
    id: "p-4002", type: "photo", caption: "وصلت أجهزة جديدة إلى الفرع",
    status: "processing", createdAt: "2026-09-13T15:30:00Z", thumb: ["#06b6d4", "#3b82f6"],
  },
  {
    id: "p-4003", type: "video", caption: "مسودة: مقارنة بين هاتفين",
    status: "draft", createdAt: "2026-09-11T11:10:00Z", thumb: ["#f472b6", "#8b5cf6"],
  },
];

/** The permissions the authorization preview lists, mirroring the Accounts API scopes. */
export interface DemoPermission {
  key: string;
  titleAr: string; titleEn: string;
  descAr: string; descEn: string;
}

export const demoPermissions: DemoPermission[] = [
  {
    key: "account_info",
    titleAr: "معلومات الحساب", titleEn: "Account information",
    descAr: "الوصول إلى المعلومات الأساسية لحساب تيك توك المصرّح به.",
    descEn: "Access basic information about your authorized TikTok account.",
  },
  {
    key: "account_media",
    titleAr: "محتوى الحساب", titleEn: "Account media",
    descAr: "عرض الفيديوهات المنشورة من حساب تيك توك الخاص بك.",
    descEn: "View videos published by your TikTok account.",
  },
  {
    key: "account_comments",
    titleAr: "تعليقات الحساب", titleEn: "Account comments",
    descAr: "قراءة التعليقات والردود على الفيديوهات المملوكة لحسابك.",
    descEn: "Read comments and replies on videos owned by your account.",
  },
  {
    key: "manage_comments",
    titleAr: "إدارة تعليقات الحساب", titleEn: "Manage account comments",
    descAr: "إدارة التعليقات والردود على فيديوهاتك المملوكة.",
    descEn: "Manage comments and replies on your owned TikTok videos.",
  },
  {
    key: "video_publish",
    titleAr: "نشر الفيديو", titleEn: "Video publishing",
    descAr: "نشر الفيديوهات إلى حساب تيك توك الخاص بك.",
    descEn: "Publish videos to your TikTok account.",
  },
  {
    key: "photo_publish",
    titleAr: "نشر الصور", titleEn: "Photo publishing",
    descAr: "نشر الصور إلى حساب تيك توك الخاص بك.",
    descEn: "Publish photos to your TikTok account.",
  },
];

/** Formats an illustrative count (12400 → "12.4K"). */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDate(iso: string, lang: "ar" | "en"): string {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-LY" : "en-GB", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function formatDateTime(iso: string, lang: "ar" | "en"): string {
  return new Date(iso).toLocaleString(lang === "ar" ? "ar-LY" : "en-GB", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
