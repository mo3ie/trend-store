"use client";

import { useEffect, useState } from "react";
import { Loader2, Copy, Check, ExternalLink, Inbox, SkipForward } from "lucide-react";
import { ttCard, type TikTokPalette } from "@/lib/tiktokTheme";

/**
 * «طابور الرسائل» — the one screen a staff member lives in.
 *
 * TikTok has no API that can send a direct message, but the Message button on a
 * commenter's profile works. So the division of labour is: the bot answers every
 * comment publicly and automatically, and a human sends the price privately with
 * one tap. Nothing here automates TikTok -- that is the point, and the reason
 * this is a list of tasks rather than a robot.
 *
 * It is built around a single motion repeated: copy, open, send, done. One card
 * at a time, biggest tap target first, because this is used standing in a shop
 * on a phone, 70 times in a row.
 */

type TF = (ar: string, en: string) => string;

interface Task {
  id: string;
  commenter: string | null;
  question: string;
  body: string;
  createdAt: string;
  profileUrl: string | null;
}

export function DmQueue({
  c, t, configId,
}: { c: TikTokPalette; t: TF; configId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState({ pending: 0, sent: 0, skipped: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch(`/api/tiktok/bot/dm-queue?configId=${configId}`)
      .then((r) => r.json()).catch(() => ({}));
    setTasks(d.tasks ?? []);
    setCounts(d.counts ?? { pending: 0, sent: 0, skipped: 0 });
    setLoading(false);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await fetch(`/api/tiktok/bot/dm-queue?configId=${configId}`)
        .then((r) => r.json()).catch(() => ({}));
      if (!alive) return;
      setTasks(d.tasks ?? []);
      setCounts(d.counts ?? { pending: 0, sent: 0, skipped: 0 });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [configId]);

  /**
   * Copy and open, in one press.
   *
   * Two separate buttons would mean the staff member lands in TikTok with an
   * empty clipboard and has to come back -- which is the whole saving, lost. The
   * copy happens first and synchronously inside the click, because a clipboard
   * write after an await is refused by Safari as "not a user gesture".
   */
  async function copyAndOpen(task: Task) {
    try {
      await navigator.clipboard.writeText(task.body);
      setCopied(task.id);
      setTimeout(() => setCopied((x) => (x === task.id ? null : x)), 2500);
    } catch {
      // Clipboard refused (old browser, insecure context). The text is on screen
      // and selectable, so the task is still doable by hand.
      setCopied(null);
    }
    if (task.profileUrl) window.open(task.profileUrl, "_blank", "noopener");
  }

  async function mark(ids: string[], status: "sent" | "skipped") {
    if (!ids.length) return;
    setBusy(true);
    // Removed from the list immediately: the staff member has already sent it in
    // another app, and watching a spinner on work that is finished is friction.
    setTasks((prev) => prev.filter((x) => !ids.includes(x.id)));
    setCounts((p) => ({
      ...p,
      pending: Math.max(0, p.pending - ids.length),
      [status]: p[status] + ids.length,
    }));
    await fetch("/api/tiktok/bot/dm-queue", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    }).catch(() => null);
    setBusy(false);
    await load();
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} className="spin" color={c.muted} /></div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── Why this screen exists, stated once ──────────────────────────── */}
      <div style={{ ...ttCard(c), padding: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Inbox size={17} color={c.pinkInk} />
          <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
            {t("طابور الرسائل الخاصة", "Private message queue")}
          </div>
          <span style={{
            background: counts.pending ? `${c.pinkInk}1f` : c.surface2,
            color: counts.pending ? c.pinkInk : c.muted,
            border: `1px solid ${counts.pending ? `${c.pinkInk}55` : c.border}`,
            borderRadius: 999, padding: "3px 11px", fontSize: 12.5, fontWeight: 800,
          }}>
            {counts.pending}
          </span>
        </div>
        <p style={{ fontSize: 12, color: c.muted, lineHeight: 1.8, margin: "9px 0 0" }}>
          {t("تيك توك لا يتيح إرسال الرسائل الخاصة آلياً، لكن زرّ «رسالة» في حساب المعلّق يعمل. فالبوت يردّ على كل تعليق علنياً وحده، وهنا تُرسل الأسعار بضغطة: انسخ ← افتح ← الصق ← أرسل.",
             "TikTok allows no automatic private messages, but the Message button on a commenter’s profile works. The bot answers every comment publicly on its own; here the prices go out with one tap: copy, open, paste, send.")}
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 11, fontSize: 11.5, color: c.muted }}>
          <span>✅ {t("أُرسلت", "Sent")}: <strong style={{ color: c.ok }}>{counts.sent}</strong></span>
          <span>⏭️ {t("متخطّاة", "Skipped")}: <strong>{counts.skipped}</strong></span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div style={{ ...ttCard(c), padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>
            {t("لا رسائل معلّقة", "Nothing waiting")}
          </div>
          <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.8, margin: "8px 0 0" }}>
            {counts.sent
              ? t("أنهيت الطابور بالكامل.", "You have cleared the whole queue.")
              : t("حين يسأل أحد عن السعر في التعليقات، ستجد رسالته هنا جاهزة للإرسال.",
                  "When someone asks about a price in the comments, their message will be waiting here, ready to send.")}
          </p>
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} style={{ ...ttCard(c), padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: c.text, direction: "ltr" }}>
                @{task.commenter || "—"}
              </span>
              <span style={{ marginInlineStart: "auto", fontSize: 11, color: c.muted }}>
                {ago(task.createdAt, t)}
              </span>
            </div>

            <div style={{ fontSize: 12.5, color: c.muted, marginTop: 5, lineHeight: 1.7 }}>
              « {task.question} »
            </div>

            {/* The message, shown in full and selectable: if the clipboard is
                refused, reading it off the screen is the fallback. */}
            <div style={{
              marginTop: 10, background: c.surface2, borderRadius: 11,
              padding: "12px 13px", fontSize: 14, color: c.text,
              lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word",
              userSelect: "text",
            }}>
              {task.body}
            </div>

            <button
              onClick={() => copyAndOpen(task)}
              style={{
                width: "100%", marginTop: 11, padding: "13px 0", borderRadius: 11,
                border: "none", background: c.pinkInk, color: "#fff",
                fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {copied === task.id ? <Check size={16} /> : <Copy size={16} />}
              {copied === task.id
                ? t("نُسخ — الصقه في تيك توك", "Copied — paste it in TikTok")
                : t("انسخ وافتح الحساب", "Copy and open the account")}
              <ExternalLink size={14} style={{ opacity: .75 }} />
            </button>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => mark([task.id], "sent")}
                disabled={busy}
                style={{
                  flex: 2, padding: "11px 0", borderRadius: 10,
                  border: `1.5px solid ${c.ok}66`, background: `${c.ok}14`, color: c.ok,
                  fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}
              >
                <Check size={15} /> {t("أرسلتُها", "I sent it")}
              </button>
              <button
                onClick={() => mark([task.id], "skipped")}
                disabled={busy}
                title={t("تخطَّ هذه", "Skip this one")}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  border: `1.5px solid ${c.border}`, background: "transparent", color: c.muted,
                  fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <SkipForward size={14} /> {t("تخطَّ", "Skip")}
              </button>
            </div>
          </div>
        ))
      )}

      {/*
        No "mark all as sent" button, deliberately.
        TikTok has no bulk send, so a button that marks 50 messages sent in one
        press would only ever record messages that were never sent -- and the
        report would then lie to the person relying on it.
      */}
      {tasks.length > 3 && (
        <p style={{ fontSize: 11, color: c.muted, textAlign: "center", lineHeight: 1.8, padding: "0 8px" }}>
          {t("لا يوجد «إرسال للكل» لأن تيك توك لا يسمح بالإرسال الجماعي — وزرٌّ كهذا سيسجّل رسائل لم تُرسل.",
             "There is no “send to all”: TikTok has no bulk send, and such a button would only record messages nobody sent.")}
        </p>
      )}
    </div>
  );
}

function ago(iso: string, t: TF): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t("الآن", "now");
  if (m < 60) return t(`قبل ${m} د`, `${m}m`);
  const h = Math.floor(m / 60);
  if (h < 24) return t(`قبل ${h} س`, `${h}h`);
  return t(`قبل ${Math.floor(h / 24)} يوم`, `${Math.floor(h / 24)}d`);
}
