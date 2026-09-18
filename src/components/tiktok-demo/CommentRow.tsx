"use client";

import { useState } from "react";
import { Heart, Reply, EyeOff, Eye, Trash2, Loader2, CornerDownLeft } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTikTokDemo } from "@/hooks/useTikTokDemo";
import { demoAccount, formatDateTime, type DemoComment } from "@/data/tiktokDemo";
import { Avatar, Button, Modal, StatusChip } from "@/components/tiktok-demo/DemoKit";

/**
 * One comment with its replies and the four demo management actions:
 * reply, like, hide/unhide and delete.
 *
 * ⚠️ Every action updates local demo state only. Nothing is sent to TikTok.
 */
export function CommentRow({
  comment, videoTitle, onToast, compact = false,
}: {
  comment: DemoComment;
  videoTitle?: string;
  onToast: (msg: string) => void;
  compact?: boolean;
}) {
  const { t, lang, rtl } = useLang();
  const { toggleLike, setCommentStatus, deleteComment, addReply } = useTikTokDemo();

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<null | "hide" | "delete">(null);
  const [working, setWorking] = useState(false);

  const hidden = comment.status === "hidden";

  function sendReply() {
    if (!replyText.trim()) return;
    setSending(true);
    setTimeout(() => {
      addReply(comment.id, replyText.trim(), demoAccount.username);
      setSending(false);
      setReplyOpen(false);
      setReplyText("");
      onToast(t("تمت إضافة الرد بنجاح", "Reply added successfully"));
    }, 900);
  }

  function runConfirm() {
    setWorking(true);
    setTimeout(() => {
      if (confirm === "hide") {
        setCommentStatus(comment.id, hidden ? "visible" : "hidden");
        onToast(hidden
          ? t("تم إظهار التعليق بنجاح", "Comment unhidden successfully")
          : t("تم إخفاء التعليق بنجاح", "Comment hidden successfully"));
      } else if (confirm === "delete") {
        deleteComment(comment.id);
        onToast(t("تم حذف التعليق بنجاح", "Comment deleted successfully"));
      }
      setWorking(false);
      setConfirm(null);
    }, 700);
  }

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        hidden ? "border-[var(--border)] bg-white/[0.02] opacity-70" : "border-[var(--border)] bg-[var(--glass)]"
      }`}
    >
      <div className="flex gap-3">
        <Avatar name={comment.author} colors={["#475569", "#1e293b"]} size={38} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[var(--text)]" dir="ltr">{comment.author}</span>
            <span className="text-[11px] text-[var(--muted-2)]">{formatDateTime(comment.createdAt, lang)}</span>
            {hidden && <StatusChip tone="amber">{t("مخفي", "Hidden")}</StatusChip>}
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{comment.text}</p>

          {videoTitle && (
            <p className="mt-1 truncate text-[11px] text-[var(--muted-2)]">
              {t("على الفيديو:", "On video:")} {videoTitle}
            </p>
          )}

          {/* Replies */}
          {comment.replies.length > 0 && (
            <ul className="mt-3 space-y-2 border-s-2 border-purple-500/25 ps-3">
              {comment.replies.map((r) => (
                <li key={r.id} className="rounded-xl bg-white/5 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-purple-300" dir="ltr">{r.author}</span>
                    {r.byOwner && <StatusChip tone="purple">{t("صاحب الحساب", "Account owner")}</StatusChip>}
                    <span className="text-[10px] text-[var(--muted-2)]">{formatDateTime(r.createdAt, lang)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{r.text}</p>
                </li>
              ))}
            </ul>
          )}

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <ActionButton
              onClick={() => setReplyOpen(true)}
              icon={<Reply size={14} aria-hidden="true" />}
              label={t("رد", "Reply")}
            />
            <ActionButton
              onClick={() => { toggleLike(comment.id); }}
              icon={<Heart size={14} aria-hidden="true" className={comment.likedByOwner ? "fill-current" : ""} />}
              label={`${t("إعجاب", "Like")} · ${comment.likes}`}
              active={comment.likedByOwner}
            />
            {!compact && (
              <>
                <ActionButton
                  onClick={() => setConfirm("hide")}
                  icon={hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                  label={hidden ? t("إظهار", "Unhide") : t("إخفاء", "Hide")}
                />
                <ActionButton
                  onClick={() => setConfirm("delete")}
                  icon={<Trash2 size={14} aria-hidden="true" />}
                  label={t("حذف", "Delete")}
                  danger
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reply modal */}
      <Modal
        open={replyOpen}
        onClose={() => setReplyOpen(false)}
        title={t("الرد على التعليق", "Reply to comment")}
        labelledBy={`reply-title-${comment.id}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReplyOpen(false)} disabled={sending}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button onClick={sendReply} disabled={sending || !replyText.trim()}>
              {sending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CornerDownLeft size={15} aria-hidden="true" />}
              {sending ? t("جارٍ إرسال الرد…", "Sending reply…") : t("إرسال الرد", "Send Reply")}
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
          <div className="text-xs font-bold text-[var(--text)]" dir="ltr">{comment.author}</div>
          <p className="mt-1 text-xs leading-relaxed">{comment.text}</p>
        </div>

        <label htmlFor={`reply-${comment.id}`} className="mt-4 mb-1.5 block text-xs font-bold text-[var(--text)]">
          {t("ردّك", "Your reply")}
        </label>
        <textarea
          id={`reply-${comment.id}`}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={3}
          dir={rtl ? "rtl" : "ltr"}
          placeholder={t("اكتب ردّك…", "Write your reply…")}
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-white/5 p-3 text-sm text-[var(--text)] placeholder:text-[var(--muted-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
        />
      </Modal>

      {/* Hide / delete confirmation */}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "delete"
            ? t("حذف التعليق؟", "Delete comment?")
            : hidden ? t("إظهار التعليق؟", "Unhide comment?") : t("إخفاء التعليق؟", "Hide comment?")
        }
        labelledBy={`confirm-title-${comment.id}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={working}>
              {t("إلغاء", "Cancel")}
            </Button>
            <Button variant={confirm === "delete" ? "danger" : "primary"} onClick={runConfirm} disabled={working}>
              {working && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {confirm === "delete" ? t("حذف", "Delete") : hidden ? t("إظهار", "Unhide") : t("إخفاء", "Hide")}
            </Button>
          </>
        }
      >
        <p className="leading-relaxed">
          {confirm === "delete"
            ? t("سيتم حذف هذا التعليق من العرض التجريبي.", "This comment will be removed from the demo.")
            : hidden
              ? t("سيعود التعليق مرئياً في العرض التجريبي.", "The comment becomes visible again in the demo.")
              : t("سيصبح التعليق مخفياً في العرض التجريبي.", "The comment becomes hidden in the demo.")}
        </p>
      </Modal>
    </article>
  );
}

function ActionButton({ onClick, icon, label, danger, active }: {
  onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400 ${
        danger
          ? "border-red-500/25 text-red-300 hover:bg-red-500/10"
          : active
            ? "border-pink-400/40 bg-pink-500/10 text-pink-300"
            : "border-[var(--border)] text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
