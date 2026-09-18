"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FlaskConical, X, Check, AlertTriangle } from "lucide-react";

/**
 * Shared UI pieces for the TikTok Accounts API prototype.
 *
 * Styled with the storefront's existing tokens (--bg/--text/--muted/--border/--glass) so the
 * prototype looks like the rest of Trend Store in both light and dark themes.
 */

// ── Demo indicator ────────────────────────────────────────────────────────────

/**
 * Always-visible marker so nobody watching the screen recording can mistake mock data for a
 * real API response.
 */
export function DemoBadge({ label, hint }: { label: string; hint: string }) {
  return (
    <span
      title={hint}
      aria-label={`${label} — ${hint}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300"
    >
      <FlaskConical size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Small inline "demo data" tag for statistics blocks. */
export function DemoDataTag({ text }: { text: string }) {
  return (
    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-2)]">
      {text}
    </span>
  );
}

// ── Toasts ────────────────────────────────────────────────────────────────────

export interface ToastState { id: number; text: string; tone: "success" | "error" }

/** Minimal toast host — one message at a time is enough for the demo flow. */
export function Toasts({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur ${
            t.tone === "success"
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
              : "border-red-400/30 bg-red-500/15 text-red-200"
          }`}
        >
          {t.tone === "success" ? <Check size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="إغلاق"
            className="rounded p-0.5 text-current/70 transition hover:text-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Tiny toast queue hook. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));
  const push = (text: string, tone: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, tone }]);
    setTimeout(() => dismiss(id), 3200);
  };
  return { toasts, push, dismiss };
}

// ── Dialog ────────────────────────────────────────────────────────────────────

/**
 * Accessible modal: focus moves in on open, Escape closes, the backdrop closes, and the
 * dialog is labelled for screen readers.
 */
export function Modal({
  open, onClose, title, children, footer, labelledBy = "demo-modal-title",
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; footer?: ReactNode; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={labelledBy} className="text-base font-black text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="text-sm text-[var(--muted)]">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  ariaLabel?: string;
};

export function Button({
  children, onClick, variant = "primary", disabled, type = "button", className = "", ariaLabel,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:cursor-not-allowed disabled:opacity-60";
  const styles: Record<string, string> = {
    primary: "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500",
    ghost: "border border-[var(--border)] bg-white/5 text-[var(--text)] hover:bg-white/10",
    subtle: "text-[var(--muted)] hover:text-[var(--text)]",
    danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-5 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-[var(--text)]">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-[var(--muted-2)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Branded gradient avatar — no external image, so the demo never loads a third-party asset. */
export function Avatar({ name, colors, size = 48 }: { name: string; colors: [string, string]; size?: number }) {
  // Initials from the word parts, so "@user_one" and "@user_two" don't both render "US".
  const parts = name.replace("@", "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const initials = (parts.length > 1
    ? parts[0][0] + parts[1][0]
    : (parts[0] ?? name).slice(0, 2)
  ).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{
        width: size, height: size, fontSize: size * 0.34,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {initials}
    </div>
  );
}

/**
 * Placeholder media tile drawn from a gradient — no stock imagery and no TikTok content.
 * A play affordance is drawn for video tiles so the grid reads as a media surface rather
 * than as empty colour blocks, while staying obviously illustrative.
 */
export function Thumb({ colors, label, ratio = "aspect-[9/16]", kind = "video" }: {
  colors: [string, string]; label?: string; ratio?: string; kind?: "video" | "photo" | "plain";
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${ratio}`}
      style={{ background: `linear-gradient(140deg, ${colors[0]}, ${colors[1]})` }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.28),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

      {kind !== "plain" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/30 ring-1 ring-white/40 backdrop-blur-[2px]">
            {kind === "video" ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-[1px] fill-white/95">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/95">
                <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1.6 12h12.8l-4.2-5.3-3.1 3.8-2.1-2.4L5.6 17Z" />
              </svg>
            )}
          </span>
        </span>
      )}

      {label && (
        <span className="absolute bottom-2 start-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
          {label}
        </span>
      )}
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2 text-center">
      <div className="text-base font-black text-[var(--text)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--muted-2)]">{label}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

export function EmptyState({ icon, title, body, action }: {
  icon: ReactNode; title: string; body: string; action?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="text-[var(--muted-2)]" aria-hidden="true">{icon}</div>
      <h3 className="text-sm font-black text-[var(--text)]">{title}</h3>
      <p className="max-w-sm text-xs leading-relaxed text-[var(--muted)]">{body}</p>
      {action}
    </Card>
  );
}

export function StatusChip({ tone, children }: { tone: "green" | "amber" | "slate" | "purple"; children: ReactNode }) {
  const map: Record<string, string> = {
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    slate: "border-[var(--border)] bg-white/5 text-[var(--muted)]",
    purple: "border-purple-400/30 bg-purple-500/10 text-purple-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${map[tone]}`}>
      {children}
    </span>
  );
}
