"use client";

import { useRef, useState } from "react";
import {
  Upload, Video as VideoIcon, Image as ImageIcon, CheckCircle2, Loader2,
  Save, Globe, Users, Lock, Database,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { formatDate, type PublishStatus } from "@/data/tiktokDemo";
import {
  Button, Card, DemoDataTag, SectionTitle, Skeleton, StatusChip, Thumb, Toasts, useToasts,
} from "@/components/tiktok-demo/DemoKit";
import { AccountHeader, AccountTabs, NotConnected } from "@/components/tiktok-demo/AccountHeader";

type Mode = "video" | "photo";
type Visibility = "public" | "friends" | "private";

const STEP_KEYS = ["prepare", "upload", "publish", "done"] as const;
type Step = (typeof STEP_KEYS)[number] | null;

/**
 * Publishing workflow for the authorized account.
 *
 * ⚠️ DEMO MODE: the progress sequence is simulated locally and no file is uploaded anywhere.
 * No request is made to TikTok or to any Trend Store API route.
 */
export default function DemoPublishPage() {
  const { t, lang, rtl } = useLang();
  const { connected, hydrated, publishing, addPublishItem } = useTikTokDemo();
  const { toasts, push, dismiss } = useToasts();

  const [mode, setMode] = useState<Mode>("video");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowDuet, setAllowDuet] = useState(true);
  const [allowStitch, setAllowStitch] = useState(true);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!connected) return <NotConnected />;

  const thumbFor = (m: Mode): [string, string] =>
    m === "video" ? ["#7c5cff", "#2563eb"] : ["#06b6d4", "#3b82f6"];

  function pickFiles(list: FileList | null) {
    if (!list) return;
    // Names only — the file itself is never read, uploaded or stored.
    setFileNames(Array.from(list).slice(0, mode === "photo" ? 10 : 1).map((f) => f.name));
  }

  function runPublish() {
    setStep("prepare");
    const timings: Array<[Step, number]> = [["upload", 900], ["publish", 1800], ["done", 2700]];
    timings.forEach(([s, ms]) => setTimeout(() => setStep(s), ms));
    setTimeout(() => {
      addPublishItem({
        type: mode,
        caption: caption.trim() || t("منشور تجريبي بدون وصف", "Demo post without a caption"),
        status: "published",
        thumb: thumbFor(mode),
      });
      push(mode === "video"
        ? t("تم نشر الفيديو بنجاح", "Video published successfully")
        : t("تم نشر الصور بنجاح", "Photos published successfully"));
    }, 2750);
  }

  function saveDraft() {
    addPublishItem({
      type: mode,
      caption: caption.trim() || t("مسودة بدون وصف", "Draft without a caption"),
      status: "draft",
      thumb: thumbFor(mode),
    });
    push(t("تم حفظ المسودة", "Draft saved"));
  }

  function resetForm() {
    setStep(null); setCaption(""); setHashtags(""); setFileNames([]);
  }

  const stepLabel: Record<string, string> = {
    prepare: mode === "video" ? t("جارٍ تجهيز الفيديو…", "Preparing video…") : t("جارٍ تجهيز الصور…", "Preparing photos…"),
    upload: t("جارٍ الرفع…", "Uploading…"),
    publish: t("جارٍ النشر…", "Publishing…"),
    done: t("تم النشر بنجاح", "Published successfully"),
  };

  const visibilityOptions: Array<{ key: Visibility; icon: typeof Globe; ar: string; en: string }> = [
    { key: "public", icon: Globe, ar: "عام", en: "Public" },
    { key: "friends", icon: Users, ar: "الأصدقاء", en: "Friends" },
    { key: "private", icon: Lock, ar: "خاص", en: "Private" },
  ];

  const statusChip = (s: PublishStatus) =>
    s === "published" ? <StatusChip tone="green">{t("منشور", "Published")}</StatusChip>
      : s === "processing" ? <StatusChip tone="amber">{t("قيد المعالجة", "Processing")}</StatusChip>
        : <StatusChip tone="slate">{t("مسودة", "Draft")}</StatusChip>;

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-white/5 p-3 text-sm text-[var(--text)] placeholder:text-[var(--muted-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400";

  return (
    <>
      <AccountHeader onToast={push} />
      <AccountTabs />

      <SectionTitle
        title={t("النشر إلى TikTok", "Publish to TikTok")}
        subtitle={t("أنشئ وانشر المحتوى من «محل ترند»", "Create and publish content from Trend Store")}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted-2)]">
            <Database size={12} aria-hidden="true" />
            {t("وضع تجريبي — لا يتم رفع أي ملف", "Demo mode — no file is uploaded")}
          </span>
        }
      />

      {/* Mode picker */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2" role="tablist" aria-label={t("نوع المحتوى", "Content type")}>
        {([["video", VideoIcon, "نشر فيديو", "Publish Video"], ["photo", ImageIcon, "نشر صور", "Publish Photo"]] as const).map(
          ([key, Icon, ar, en]) => {
            const active = mode === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => { setMode(key); resetForm(); }}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
                  active
                    ? "border-purple-400/40 bg-gradient-to-br from-purple-600/20 to-blue-600/15"
                    : "border-[var(--border)] bg-[var(--glass)] hover:bg-white/5"
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
                  <Icon size={20} className="text-white" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-black text-[var(--text)]">{t(ar, en)}</span>
                  <span className="block text-[11px] text-[var(--muted-2)]">{en}</span>
                </span>
              </button>
            );
          },
        )}
      </div>

      {step === "done" ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 size={48} className="text-emerald-400" aria-hidden="true" />
          <h2 className="text-lg font-black text-[var(--text)]">
            {mode === "video" ? t("تم نشر الفيديو", "Video published") : t("تم نشر الصور", "Photos published")}
          </h2>
          <p className="max-w-sm text-xs leading-relaxed text-[var(--muted)]">
            {t(
              "المحتوى جاهز على حساب TikTok المرتبط (عرض تجريبي).",
              "Your content is ready on the connected TikTok account (demo).",
            )}
          </p>
          <div className="flex gap-2">
            <Button onClick={resetForm}>{t("نشر محتوى آخر", "Publish something else")}</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          {/* Form */}
          <Card>
            <h2 className="mb-4 text-sm font-black text-[var(--text)]">
              {mode === "video" ? t("تفاصيل الفيديو", "Video details") : t("تفاصيل الصور", "Photo details")}
            </h2>

            {/* Upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFiles(e.dataTransfer.files); }}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragOver ? "border-purple-400 bg-purple-500/10" : "border-[var(--border)] bg-white/5"
              }`}
            >
              <Upload size={26} className="mx-auto text-[var(--muted-2)]" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-[var(--text)]">
                {mode === "video"
                  ? t("اسحب الفيديو هنا أو اختره", "Drag your video here or choose a file")
                  : t("اسحب الصور هنا أو اخترها", "Drag your photos here or choose files")}
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                {t("لا يتم رفع الملف في الوضع التجريبي", "No file is uploaded in demo mode")}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={mode === "video" ? "video/*" : "image/*"}
                multiple={mode === "photo"}
                onChange={(e) => pickFiles(e.target.files)}
                className="sr-only"
                id="publish-file"
              />
              <Button variant="ghost" className="mt-3" onClick={() => inputRef.current?.click()}>
                {t("اختيار ملف", "Choose file")}
              </Button>
              {fileNames.length > 0 && (
                <ul className="mt-3 space-y-1 text-[11px] text-[var(--muted)]">
                  {fileNames.map((n) => <li key={n} className="truncate" dir="ltr">{n}</li>)}
                </ul>
              )}
            </div>

            {/* Caption */}
            <label htmlFor="caption" className="mb-1.5 mt-4 block text-xs font-bold text-[var(--text)]">
              {t("الوصف", "Caption")}
            </label>
            <textarea
              id="caption"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              dir={rtl ? "rtl" : "ltr"}
              placeholder={t("اكتب وصف المنشور…", "Write a caption…")}
              className={`${inputClass} resize-y`}
            />

            {/* Hashtags */}
            <label htmlFor="hashtags" className="mb-1.5 mt-4 block text-xs font-bold text-[var(--text)]">
              {t("الوسوم", "Hashtags")}
            </label>
            <input
              id="hashtags"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#trendstore #libya"
              dir="ltr"
              className={inputClass}
            />

            {/* Visibility */}
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-xs font-bold text-[var(--text)]">{t("الظهور", "Visibility")}</legend>
              <div className="flex flex-wrap gap-2">
                {visibilityOptions.map((o) => {
                  const Icon = o.icon;
                  const active = visibility === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => setVisibility(o.key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
                        active
                          ? "border-purple-400/40 bg-purple-500/15 text-[var(--text)]"
                          : "border-[var(--border)] bg-white/5 text-[var(--muted)]"
                      }`}
                    >
                      <Icon size={13} aria-hidden="true" />
                      {t(o.ar, o.en)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Toggles */}
            <div className="mt-4 space-y-2">
              <Toggle label={t("السماح بالتعليقات", "Allow comments")} value={allowComments} onChange={setAllowComments} />
              {mode === "video" && (
                <>
                  <Toggle label={t("السماح بالديو", "Allow duet")} value={allowDuet} onChange={setAllowDuet} />
                  <Toggle label={t("السماح بالدمج", "Allow stitch")} value={allowStitch} onChange={setAllowStitch} />
                </>
              )}
            </div>

            {/* Progress / actions */}
            {step ? (
              <div className="mt-5 rounded-xl border border-purple-400/30 bg-purple-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-200">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {stepLabel[step]}
                </div>
                <ol className="mt-3 space-y-1.5 text-[11px] text-[var(--muted)]">
                  {STEP_KEYS.slice(0, 3).map((s, i) => {
                    const reached = STEP_KEYS.indexOf(step) >= i;
                    return (
                      <li key={s} className={reached ? "text-emerald-300" : ""}>
                        {reached ? "✓" : "•"} {stepLabel[s]}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={saveDraft}>
                  <Save size={15} aria-hidden="true" />
                  {t("حفظ كمسودة", "Save Draft")}
                </Button>
                <Button onClick={runPublish}>
                  <Upload size={15} aria-hidden="true" />
                  {mode === "video" ? t("نشر إلى TikTok", "Publish to TikTok") : t("نشر الصور", "Publish Photo")}
                </Button>
              </div>
            )}
          </Card>

          {/* Preview */}
          <Card>
            <h2 className="mb-3 text-sm font-black text-[var(--text)]">{t("معاينة", "Preview")}</h2>
            <div className="mx-auto max-w-[240px]">
              <Thumb colors={thumbFor(mode)} kind={mode} label={mode === "video" ? t("فيديو", "Video") : t("صورة", "Photo")} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text)]">
              {caption || t("سيظهر الوصف هنا…", "Your caption appears here…")}
            </p>
            {hashtags && <p className="mt-1 text-xs text-blue-300" dir="ltr">{hashtags}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusChip tone="slate">{t(
                visibilityOptions.find((o) => o.key === visibility)!.ar,
                visibilityOptions.find((o) => o.key === visibility)!.en,
              )}</StatusChip>
              {allowComments && <StatusChip tone="slate">{t("التعليقات مفعّلة", "Comments on")}</StatusChip>}
            </div>
          </Card>
        </div>
      )}

      {/* Publishing history */}
      <section id="history" className="mt-7 scroll-mt-24">
        <SectionTitle
          title={t("نشاط النشر الأخير", "Recent Publishing Activity")}
          subtitle={t("سجل تجريبي للمحتوى المنشور من «محل ترند»", "Demo record of content published from Trend Store")}
        />
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-start text-sm">
              <caption className="sr-only">{t("سجل النشر", "Publishing history")}</caption>
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] text-[var(--muted-2)]">
                  <th scope="col" className="p-3 text-start font-bold">{t("المحتوى", "Content")}</th>
                  <th scope="col" className="p-3 text-start font-bold">{t("النوع", "Type")}</th>
                  <th scope="col" className="p-3 text-start font-bold">{t("الحالة", "Status")}</th>
                  <th scope="col" className="p-3 text-start font-bold">{t("التاريخ", "Date")}</th>
                </tr>
              </thead>
              <tbody>
                {publishing.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 shrink-0"><Thumb colors={item.thumb} kind={item.type} ratio="aspect-video" /></div>
                        <span className="line-clamp-2 text-xs font-semibold text-[var(--text)]">{item.caption}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-[var(--muted)]">
                      {item.type === "video" ? t("فيديو", "Video") : t("صورة", "Photo")}
                    </td>
                    <td className="p-3">{statusChip(item.status)}</td>
                    <td className="p-3 text-xs text-[var(--muted-2)]">{formatDate(item.createdAt, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3"><DemoDataTag text={t("بيانات تجريبية", "Demo data")} /></div>
        </Card>
      </section>

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5">
      <span className="text-xs font-semibold text-[var(--text)]">{label}</span>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${
          value ? "bg-emerald-500" : "bg-slate-600"
        }`}
      >
        <span
          className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all"
          style={{ insetInlineStart: value ? 26 : 4 }}
        />
      </button>
    </div>
  );
}
