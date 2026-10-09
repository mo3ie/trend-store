import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";
import {
  getSystemPageToken, editPostMessage, reschedulePost,
  publishScheduledNow, deletePagePost,
} from "@/services/meta";

export const maxDuration = 30;

/**
 * POST { postId, action, ... } — control a post that is already ON Facebook.
 *
 * Up to now a post left the Studio and became unreachable: a scheduled post could not
 * be cancelled or moved, and a live one could not be corrected or taken down, even
 * though Facebook allows all of it. The owner's only recourse was the Facebook app
 * itself — and then our record and the real post would disagree.
 *
 * So every action here does BOTH: it changes the post on Facebook and brings our row
 * back in line, in that order. Facebook first because that is the side that is
 * visible to customers; a database that disagrees with reality is recoverable, a
 * post that silently stayed up is not.
 *
 *   edit        — rewrite the text (scheduled or live)
 *   reschedule  — move a scheduled post to another time
 *   publish_now — send a scheduled post immediately
 *   cancel      — remove a SCHEDULED post before anyone sees it
 *   delete      — remove a LIVE post; destructive, and named differently for that reason
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { postId, action, message, scheduledFor } = await req.json();
  if (!postId || !action) {
    return NextResponse.json({ error: "postId و action مطلوبان" }, { status: 400 });
  }

  const { data: post } = await supabaseAdmin
    .from("studio_posts")
    .select("id, page_id, external_post_id, status, caption, scheduled_for")
    .eq("id", postId).eq("user_id", user.id).maybeSingle();
  if (!post) return NextResponse.json({ error: "المنشور غير موجود" }, { status: 404 });

  if (!post.external_post_id) {
    // Nothing on Facebook to act on. Editing a draft is the ordinary PATCH route's job.
    return NextResponse.json({
      error: "not_published",
      message: "هذا المنشور لم يصل فيسبوك بعد — عدّله من الخطة مباشرة.",
    }, { status: 400 });
  }

  const token = await getSystemPageToken(post.page_id);
  if (!token) {
    return NextResponse.json({
      error: "no_token",
      message: "تعذّر الوصول لرمز الصفحة — أعد ربط الصفحة.",
    }, { status: 400 });
  }

  const external = String(post.external_post_id);

  try {
    switch (action) {
      case "edit": {
        const text = String(message ?? "").trim();
        if (!text) return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
        await editPostMessage(external, token, text);
        await supabaseAdmin.from("studio_posts")
          .update({ caption: text, error: null }).eq("id", post.id);
        return NextResponse.json({ ok: true, action, caption: text });
      }

      case "reschedule": {
        if (post.status === "published") {
          return NextResponse.json({
            error: "already_published",
            message: "المنشور نُشر بالفعل — لا يمكن تغيير موعده.",
          }, { status: 400 });
        }
        const when = new Date(String(scheduledFor));
        const unix = Math.floor(when.getTime() / 1000);
        // Facebook refuses a time under 10 minutes out, and silently drifting past
        // that is how a reschedule looks like it worked and did nothing.
        if (!Number.isFinite(unix) || unix < Math.floor(Date.now() / 1000) + 600) {
          return NextResponse.json({
            error: "too_soon",
            message: "اختر موعداً بعد عشر دقائق على الأقل من الآن.",
          }, { status: 400 });
        }
        await reschedulePost(external, token, unix);
        await supabaseAdmin.from("studio_posts")
          .update({ scheduled_for: when.toISOString(), error: null }).eq("id", post.id);
        return NextResponse.json({ ok: true, action, scheduledFor: when.toISOString() });
      }

      case "publish_now": {
        await publishScheduledNow(external, token);
        await supabaseAdmin.from("studio_posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          error: null,
        }).eq("id", post.id);
        return NextResponse.json({ ok: true, action });
      }

      case "cancel":
      case "delete": {
        await deletePagePost(external, token);
        /*
         * The row is kept, not deleted, and it keeps its text.
         *
         * Deleting it too would erase the owner's own work — the caption they wrote,
         * the reply they configured — for what is usually a scheduling decision, and
         * they often want to re-use it. The external id is cleared because the post no
         * longer exists; the reply binding is dropped with it below.
         */
        await supabaseAdmin.from("studio_posts").update({
          status: "draft",
          external_post_id: null,
          published_at: null,
          error: action === "cancel"
            ? "أُلغي النشر المجدول — المنشور محفوظ هنا ويمكن إعادة جدولته."
            : "حُذف من فيسبوك — النص محفوظ هنا ويمكن إعادة نشره.",
        }).eq("id", post.id);

        // A reply bound to a post that no longer exists would sit in the bot's
        // config forever, matching nothing.
        const { data: cfg } = await supabaseAdmin
          .from("bot_configs").select("id, post_overrides")
          .eq("user_id", user.id).eq("page_id", post.page_id).eq("platform", "meta").maybeSingle();
        if (cfg?.post_overrides) {
          const overrides = { ...(cfg.post_overrides as Record<string, unknown>) };
          const numeric = external.includes("_") ? external.split("_")[1] : external;
          let touched = false;
          for (const k of [external, numeric]) {
            if (k in overrides) { delete overrides[k]; touched = true; }
          }
          if (touched) {
            await supabaseAdmin.from("bot_configs")
              .update({ post_overrides: overrides }).eq("id", cfg.id);
          }
        }

        return NextResponse.json({ ok: true, action });
      }

      default:
        return NextResponse.json({ error: "action غير معروف" }, { status: 400 });
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Facebook error";
    const msg = /#200|permission/i.test(raw)
      ? "صلاحية إدارة المنشورات غير متوفرة لهذه الصفحة — أعد ربط الصفحة."
      : raw;
    return NextResponse.json({ error: "action_failed", message: msg.slice(0, 300) }, { status: 502 });
  }
}
