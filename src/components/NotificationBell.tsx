"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCheck, ShoppingBag, Info, AlertCircle, Gift } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  body?: string;
  type: string;
  read: boolean;
  link?: string;
  created_at: string;
};

function typeIcon(type: string) {
  switch (type) {
    case "order":   return <ShoppingBag size={14} className="text-purple-400" />;
    case "promo":   return <Gift size={14} className="text-yellow-400" />;
    case "warning": return <AlertCircle size={14} className="text-red-400" />;
    default:        return <Info size={14} className="text-blue-400" />;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "الآن";
  if (mins < 60)  return `${mins}د`;
  if (hours < 24) return `${hours}س`;
  return `${days}ي`;
}

export default function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const [notifs, setNotifs]     = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter(n => !n.read).length;

  useEffect(() => {
    fetchNotifs();
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function fetchNotifs() {
    setLoading(true);
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) setNotifs(await r.json());
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_all: true }),
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifs(); }}
        className="relative text-[var(--muted)] hover:text-purple-400 transition-colors"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-[9px] font-black text-[var(--text)] flex items-center justify-center animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-80 max-h-[420px] bg-[var(--surface)] border border-purple-500/30 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] z-50 flex flex-col overflow-hidden"
          style={{ right: "auto", left: "-260px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/15">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-purple-400" />
              <span className="font-bold text-sm">الإشعارات</span>
              {unread > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                  {unread} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors">
                  <CheckCheck size={12} /> قراءة الكل
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-[var(--muted-2)] hover:text-[var(--muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="py-8 text-center text-[var(--muted-2)] text-sm">جاري التحميل...</div>
            ) : notifs.length === 0 ? (
              <div className="py-12 text-center text-[var(--muted-2)]">
                <Bell size={32} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[var(--border)] cursor-pointer hover:bg-white/5 transition-colors ${!n.read ? "bg-purple-500/5" : ""}`}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      {typeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{n.title}</p>
                        <span className="text-[10px] text-[var(--muted-2)] shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      {n.body && <p className="text-xs text-[var(--muted-2)] mt-0.5 line-clamp-2">{n.body}</p>}
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
