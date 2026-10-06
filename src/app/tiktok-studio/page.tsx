"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, Sparkles, Play, Clock, Copy, Check,
  Package, Film, AlertCircle, Calendar, Music2, Type, Megaphone, Save,
} from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { useTheme } from "@/hooks/useTheme";
import LangToggle from "@/components/LangToggle";
import {
  tt, ttCard, ttPrimary, ttSecondary, ttInput, ttStage, ttOverlayText,
  TT_SCRIM, TT_PINK, TT_CYAN,
} from "@/lib/tiktokTheme";
import {
  AccountStrip, ScreenTitle, TabStrip, SubscribeBar, Chip,
} from "@/components/tiktok/TikTokKit";

/**
 * The AI Employee, for TikTok.
 *
 * Its own screen rather than a platform flag on the Facebook one, for a reason that
 * is not cosmetic: that screen asks you to connect a Facebook Page, and its plan view
 * shows square image cards. Both are wrong here. A TikTok deliverable is a VIDEO you
 * have to film, so the plan is shown as a storyboard of 9:16 frames whose most
 * prominent element is the hook — the first two seconds, which decide whether anyone
 * watches at all. Showing a still image as "the post" implies a deliverable that does
 * not exist on this platform.
 *
 * The backend is shared and needs no duplicate: the studio tables are keyed by
 * (user_id, page_id), a TikTok account id is just another page_id, and the generator
 * derives the platform from the account, writing a script instead of a caption.
 */

interface Status {
  linking: { organic: boolean };
  account: { openId: string; handle: string; avatarUrl: string | null } | null;
  studio: { hasPlan: boolean; planDays: number | null; planStatus: string | null; priceLyd: number | null };
}

interface Scene { t?: string; do?: string; text?: string }

interface Post {
  id: string;
  scheduled_for: string;
  hook: string | null;
  scenes: Scene[] | null;
  screen_text: string | null;
  sound: string | null;
  duration_sec: number | null;
  caption: string;
  hashtags: string | null;
  cta: string | null;
  post_type: string | null;
  image_url: string;
  status: string;
  error: string | null;
  product_id: string | null;
  video_url: string | null;
}

interface Plan { id: string; status: string; duration_days: number; posts_per_day: number; summary: string | null }

interface Product { id: string; name: string; price_text: string | null }

const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function TikTokStudioPage() {
  const router = useRouter();
  const { t, rtl } = useLang();
  const { light } = useTheme();
  const c = tt(light);
  const Back = rtl ? ArrowLeft : ArrowRight;

  const [st, setSt] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"plan" | "brand" | "products">("plan");
  const [error, setError] = useState("");

  const [plan, setPlan] = useState<Plan | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState<Post | null>(null);

  // Generation controls
  const [days, setDays] = useState(7);
  const [perDay, setPerDay] = useState(1);
  const [guidance, setGuidance] = useState("");
  const [busy, setBusy] = useState(false);

  // Brand
  const [brand, setBrand] = useState<{ name: string; about: string; phone: string; links: string }>(
    { name: "", about: "", phone: "", links: "" });
  const [brandSaved, setBrandSaved] = useState(false);

  // `pageId` on the studio tables is the TikTok account's open id when the owner has
  // linked one. Before linking there is nothing to key a plan to, so generation waits.
  const pageId = st?.account?.openId || "";
  // A price only exists once a plan for this product is active. With none, there is
  // nothing to subscribe to yet, so the bar stays hidden rather than inviting a
  // purchase that cannot be completed.
  const sellable = st?.studio.priceLyd !== null && st?.studio.priceLyd !== undefined;

  const loadPlan = useCallback(async (pid: string) => {
    const d = await fetch(`/api/studio/plan?pageId=${encodeURIComponent(pid)}`).then((r) => r.json()).catch(() => ({}));
    setPlan(d.plan ?? null);
    setPosts(d.posts ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/tiktok/status")
      .then((r) => (r.status === 401 ? null : r.json()))
      .then(async (d) => {
        if (!d) { router.push("/login?next=/tiktok-studio"); return; }
        if (d.error) return;
        setSt(d);
        if (d.account?.openId) {
          await loadPlan(d.account.openId);
          const b = await fetch(`/api/studio/brand?pageId=${encodeURIComponent(d.account.openId)}`)
            .then((r) => r.json()).catch(() => ({}));
          if (b.brand) {
            setBrand({
              name: b.brand.name || "", about: b.brand.about || "",
              phone: b.brand.phone || "", links: (b.brand.links || []).join("\n"),
            });
          }
          const p = await fetch(`/api/studio/products?pageId=${encodeURIComponent(d.account.openId)}`)
            .then((r) => r.json()).catch(() => ({}));
          setProducts(p.products || []);
        }
      })
      .catch(() => setError(t("تعذّر التحميل", "Could not load")))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (!pageId) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/studio/plan/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, durationDays: days, postsPerDay: perDay, guidance }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.message || d.error || t("تعذّر توليد الخطة", "Could not generate the plan"));
      } else {
        setPlan(d.plan ?? null);
        setPosts(d.posts ?? []);
      }
    } catch {
      setError(t("تعذّر الاتصال", "Connection failed"));
    }
    setBusy(false);
  }

  async function saveBrand() {
    if (!pageId) return;
    await fetch("/api/studio/brand", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId, name: brand.name, about: brand.about, phone: brand.phone,
        links: brand.links.split("\n").map((x) => x.trim()).filter(Boolean),
      }),
    }).catch(() => {});
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 1800);
  }

  // Posts grouped into days, each day a horizontal rail of storyboard frames.
  const byDay = posts.reduce<Record<string, Post[]>>((acc, p) => {
    const key = p.scheduled_for.slice(0, 10);
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});
  const dayKeys = Object.keys(byDay).sort();

  const linkingPending = !!st && !st.linking.organic;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} className="spin" color={c.pinkInk} />
      </div>
    );
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: c.bg, color: c.text, paddingBottom: sellable ? 84 : 32 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 32px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.push("/tiktok")}
            style={{ background: "none", border: "none", color: c.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 14 }}>
            <Back size={18} /> {t("أدوات تيك توك", "TikTok tools")}
          </button>
          <LangToggle />
        </div>

        <div style={{ marginTop: 14 }}>
          <ScreenTitle c={c} rtl={rtl}>{t("الموظف الذكي", "AI Employee")}</ScreenTitle>
        </div>

        <AccountStrip
          account={st?.account ? { handle: st.account.handle, avatarUrl: st.account.avatarUrl } : null}
          c={c} t={t} rtl={rtl} pending={linkingPending}
        />

        <TabStrip
          c={c} value={tab} onChange={setTab}
          tabs={[
            { key: "plan" as const,     label: t("الخطة", "Plan") },
            { key: "products" as const, label: t("المنتجات", "Products") },
            { key: "brand" as const,    label: t("بيانات النشاط", "Business info") },
          ]}
        />

        {error && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: `${c.danger}18`, border: `1px solid ${c.danger}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
            <AlertCircle size={17} color={c.danger} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>{error}</div>
          </div>
        )}

        {/* ── PLAN ─────────────────────────────────────────────────────────── */}
        {tab === "plan" && (
          <>
            <div style={{ ...ttCard(c), padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Film size={17} color={c.pinkInk} /> {t("خطة فيديوهات", "Video plan")}
              </div>
              <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "9px 0 0" }}>
                {t("يكتب لك سكربتاً لكل فيديو: الخطّاف، المشاهد، النص على الشاشة، والوصف — تصوّره بهاتفك.",
                   "It writes a script for each video: the hook, the shots, the on-screen text and the caption — you film it on your phone.")}
              </p>

              <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
                <label style={{ flex: "1 1 110px", fontSize: 12, color: c.muted }}>
                  {t("المدة (أيام)", "Days")}
                  <input type="number" min={1} max={30} value={days}
                    onChange={(e) => setDays(Number(e.target.value))} style={{ ...ttInput(c), marginTop: 5 }} />
                </label>
                <label style={{ flex: "1 1 110px", fontSize: 12, color: c.muted }}>
                  {t("فيديو/يوم", "Videos/day")}
                  <input type="number" min={1} max={4} value={perDay}
                    onChange={(e) => setPerDay(Number(e.target.value))} style={{ ...ttInput(c), marginTop: 5 }} />
                </label>
              </div>

              <textarea value={guidance} onChange={(e) => setGuidance(e.target.value)} rows={2}
                placeholder={t("توجيهات (اختياري): مثلاً ركّز على العروض، وتجنّب الأسعار المرتفعة",
                               "Guidance (optional): e.g. focus on offers, avoid the pricier items")}
                style={{ ...ttInput(c), marginTop: 10, resize: "vertical" }} />

              <button onClick={generate} disabled={busy || !pageId}
                style={{ ...ttPrimary(rtl, busy || !pageId), width: "100%", marginTop: 12 }}>
                {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {plan ? t("ولّد خطة جديدة", "Generate a new plan") : t("ولّد الخطة", "Generate the plan")}
              </button>

              {!pageId && (
                <div style={{ fontSize: 12, color: c.muted, marginTop: 9, lineHeight: 1.7 }}>
                  {t("تحتاج حساب تيك توك مرتبطاً لتُولَّد الخطة باسمه.",
                     "A linked TikTok account is needed so the plan belongs to it.")}
                </div>
              )}
            </div>

            {plan?.summary && (
              <div style={{ fontSize: 13, color: c.muted, lineHeight: 1.8, marginTop: 14, background: c.surface2, borderRadius: 11, padding: "12px 14px" }}>
                {plan.summary}
              </div>
            )}

            {/* The storyboard: one rail per day, 9:16 frames, hook foremost. */}
            {dayKeys.map((key) => {
              const d = new Date(key);
              return (
                <div key={key} style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, marginBottom: 9 }}>
                    <Calendar size={14} color={c.muted} />
                    {DAY_NAMES_AR[d.getDay()]} · {key.slice(5)}
                  </div>
                  <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                    {byDay[key].map((p) => (
                      <StoryFrame key={p.id} post={p} c={c} t={t} rtl={rtl} onOpen={() => setOpen(p)} />
                    ))}
                  </div>
                </div>
              );
            })}

            {!dayKeys.length && plan === null && (
              <div style={{ ...ttCard(c), padding: 26, marginTop: 14, textAlign: "center" }}>
                <Film size={24} color={c.muted} />
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{t("لا خطة بعد", "No plan yet")}</div>
                <div style={{ fontSize: 12.5, color: c.muted, marginTop: 6, lineHeight: 1.7 }}>
                  {t("أضف بيانات نشاطك ومنتجاتك، ثم ولّد الخطة.",
                     "Add your business info and products, then generate the plan.")}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PRODUCTS ─────────────────────────────────────────────────────── */}
        {tab === "products" && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Package size={17} color={c.pinkInk} /> {t("المنتجات", "Products")}
            </div>
            <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "9px 0 14px" }}>
              {t("منها يختار الموظف الذكي منتج كل فيديو، ومنها يأخذ البوت السعر في ردوده.",
                 "The AI Employee picks each video's product from here, and the bot takes its prices from here too.")}
            </p>
            {products.length === 0 ? (
              <div style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.7 }}>
                {t("لا منتجات بعد — أضفها من الموظف الذكي لتظهر في الخطة والردود.",
                   "No products yet — add them so they appear in the plan and the replies.")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 7 }}>
                {products.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, background: c.surface2, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
                    <span>{p.name}</span>
                    <span style={{ color: c.pinkInk, fontWeight: 700 }}>{p.price_text || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BUSINESS INFO ────────────────────────────────────────────────── */}
        {tab === "brand" && (
          <div style={{ ...ttCard(c), padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t("بيانات النشاط", "Business info")}</div>
            <p style={{ fontSize: 12.5, color: c.muted, lineHeight: 1.75, margin: "9px 0 14px" }}>
              {t("كلما كانت أدقّ، كانت السكربتات أقرب لنشاطك.",
                 "The more accurate this is, the closer the scripts are to your business.")}
            </p>
            {([
              ["name",  t("الاسم", "Name"),            false],
              ["about", t("عن النشاط", "About"),       true],
              ["phone", t("الهاتف", "Phone"),          false],
              ["links", t("روابط (رابط لكل سطر)", "Links (one per line)"), true],
            ] as const).map(([k, label, multi]) => (
              <label key={k} style={{ display: "block", fontSize: 12, color: c.muted, marginBottom: 11 }}>
                {label}
                {multi ? (
                  <textarea rows={3} value={brand[k]} onChange={(e) => setBrand({ ...brand, [k]: e.target.value })}
                    style={{ ...ttInput(c), marginTop: 5, resize: "vertical" }} />
                ) : (
                  <input value={brand[k]} onChange={(e) => setBrand({ ...brand, [k]: e.target.value })}
                    style={{ ...ttInput(c), marginTop: 5 }} />
                )}
              </label>
            ))}
            <button onClick={saveBrand} disabled={!pageId}
              style={{ ...ttSecondary(c), width: "100%" }}>
              {brandSaved ? <Check size={16} color={c.ok} /> : <Save size={16} />}
              {brandSaved ? t("حُفظ", "Saved") : t("حفظ", "Save")}
            </button>
          </div>
        )}
      </div>

      {open && <ScriptSheet post={open} c={c} t={t} rtl={rtl} onClose={() => setOpen(null)} />}

      {sellable && (
        <SubscribeBar
          priceLyd={st?.studio.priceLyd ?? null} c={c} t={t} rtl={rtl}
          onSubscribe={() => router.push("/subscriptions?product=tiktok_studio")}
          note={t("الخطة والسكربتات مجاناً — الجدولة والنشر بالاشتراك",
                  "Plans and scripts are free — scheduling and publishing need a subscription")}
        />
      )}
    </div>
  );
}

/**
 * One storyboard frame. The hook occupies the top third at the largest weight on the
 * card, because it is the line that decides whether the video is watched — and the
 * thumbnail behind it is labelled as a COVER FRAME, never presented as the post.
 */
function StoryFrame({
  post, c, t, rtl, onOpen,
}: {
  post: Post; c: ReturnType<typeof tt>; t: (a: string, e: string) => string;
  rtl: boolean; onOpen: () => void;
}) {
  const time = new Date(post.scheduled_for).toLocaleTimeString(rtl ? "ar-LY" : "en-GB",
    { hour: "2-digit", minute: "2-digit" });
  return (
    <button onClick={onOpen}
      style={{ ...ttStage(), width: 132, flexShrink: 0, border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: rtl ? "right" : "left" }}>
      {post.image_url && (
        <img src={post.image_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: TT_SCRIM }} />

      {/* The hook, top third. */}
      <div style={{ position: "absolute", top: 9, insetInlineStart: 9, insetInlineEnd: 9 }}>
        <div style={{ ...ttOverlayText, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {post.hook || post.caption.slice(0, 50)}
        </div>
      </div>

      {/* Cover-frame label: it is a cover, not the deliverable. */}
      {post.image_url && (
        <div style={{ position: "absolute", top: "42%", insetInlineStart: 9, fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.72)", background: "rgba(0,0,0,.45)", borderRadius: 4, padding: "2px 5px" }}>
          {t("صورة الغلاف", "Cover frame")}
        </div>
      )}

      <div style={{ position: "absolute", bottom: 8, insetInlineStart: 8, insetInlineEnd: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", display: "inline-flex", alignItems: "center", gap: 3 }}>
          <Clock size={9} /> {time}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: TT_CYAN }}>
          0:{String(post.duration_sec ?? 18).padStart(2, "0")}
        </span>
      </div>

      {post.status === "published" && (
        <span style={{ position: "absolute", top: 8, insetInlineEnd: 8, width: 8, height: 8, borderRadius: 999, background: c.ok }} />
      )}
    </button>
  );
}

/**
 * The script sheet — laid out as a shot list to film from, not as a caption form.
 *
 * The "copy" button is the point of it while linking is unavailable: the owner can
 * take the script and film today, which is the whole value of the tool, with or
 * without scheduling.
 */
function ScriptSheet({
  post, c, t, rtl, onClose,
}: {
  post: Post; c: ReturnType<typeof tt>; t: (a: string, e: string) => string;
  rtl: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const scriptText = [
    post.hook ? `${t("الخطّاف", "Hook")}: ${post.hook}` : "",
    ...(post.scenes || []).map((s, i) => `${i + 1}. [${s.t || ""}] ${s.do || ""}${s.text ? ` — ${t("نص", "text")}: ${s.text}` : ""}`),
    post.screen_text ? `${t("نص على الشاشة", "On-screen text")}: ${post.screen_text}` : "",
    post.sound ? `${t("الصوت", "Sound")}: ${post.sound}` : "",
    post.cta ? `${t("الدعوة للفعل", "CTA")}: ${post.cta}` : "",
    "",
    post.caption,
    post.hashtags || "",
  ].filter(Boolean).join("\n");

  function copy() {
    navigator.clipboard?.writeText(scriptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  const Section = ({ icon: Icon, label, children }: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    label: string; children: React.ReactNode;
  }) => (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: c.muted, marginBottom: 7 }}>
        <Icon size={13} color={c.pinkInk} /> {label}
      </div>
      {children}
    </div>
  );

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: c.surface, borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 680, margin: "0 auto", maxHeight: "90vh", overflowY: "auto", padding: 18 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{post.post_type || t("فيديو", "Video")}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: c.muted, fontSize: 22, lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        {/* The hook gets its own black stage: it is the deliverable's headline. */}
        <div style={{ background: "#000", borderRadius: 12, padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: TT_CYAN, letterSpacing: 0.4 }}>
            {t("أول ثانيتين", "FIRST 2 SECONDS")}
          </div>
          <div style={{ ...ttOverlayText, fontSize: 19, marginTop: 7 }}>
            {post.hook || t("(لا خطّاف — ولّد الخطة مجدداً)", "(no hook — regenerate the plan)")}
          </div>
        </div>

        {(post.scenes || []).length > 0 && (
          <Section icon={Film} label={t("المشاهد", "Shots")}>
            <div style={{ display: "grid", gap: 8 }}>
              {(post.scenes || []).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, background: c.surface2, borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: c.pinkInk, minWidth: 34, fontVariantNumeric: "tabular-nums" }}>
                    {s.t || `#${i + 1}`}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.65, flex: 1 }}>
                    {s.do}
                    {s.text && (
                      <span style={{ display: "block", fontSize: 11.5, color: c.muted, marginTop: 4 }}>
                        {t("نص على الشاشة", "On-screen")}: {s.text}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {post.screen_text && (
          <Section icon={Type} label={t("النص على الشاشة", "On-screen text")}>
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{post.screen_text}</div>
          </Section>
        )}

        {post.sound && (
          <Section icon={Music2} label={t("الصوت المقترح", "Suggested sound")}>
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{post.sound}</div>
          </Section>
        )}

        {post.cta && (
          <Section icon={Megaphone} label={t("الدعوة للفعل", "Call to action")}>
            <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{post.cta}</div>
          </Section>
        )}

        <Section icon={Type} label={t("الوصف والهاشتاقات", "Caption & hashtags")}>
          <div style={{ fontSize: 13.5, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{post.caption}</div>
          {post.hashtags && (
            <div style={{ fontSize: 12.5, color: c.cyanInk, marginTop: 8, lineHeight: 1.7 }}>{post.hashtags}</div>
          )}
        </Section>

        <div style={{ display: "flex", gap: 9, marginTop: 20, flexWrap: "wrap" }}>
          <button onClick={copy} style={{ ...ttPrimary(rtl), flex: "1 1 160px" }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("نُسخ", "Copied") : t("انسخ السكربت", "Copy the script")}
          </button>
          <a href="/tiktok-bot" style={{ ...ttSecondary(c), flex: "1 1 140px", textDecoration: "none" }}>
            <Play size={15} /> {t("ردّ التعليقات لهذا الفيديو", "Comment reply for this")}
          </a>
        </div>

        {post.error && (
          <div style={{ fontSize: 12.5, color: c.warn, marginTop: 12, lineHeight: 1.7 }}>{post.error}</div>
        )}
      </div>
    </div>
  );
}
