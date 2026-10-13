import { supabaseAdmin } from "@/lib/supabaseAdmin";

const VERSION = (process.env.META_API_VERSION || "v19.0").trim();

/**
 * `promotable` is deliberately three-valued:
 *   true   — Facebook says this post can be advertised
 *   false  — Facebook says it cannot, and `reason` explains it in Arabic
 *   null   — we could not find out (no token, network error, missing field)
 *
 * The third case matters. Treating "unknown" as "not allowed" would block
 * paying customers whenever Facebook has a bad minute, and treating it as
 * "allowed" is exactly what we already do today — so unknown must be visibly
 * distinct from a real refusal rather than collapsed into either.
 */
export type Promotable = { promotable: boolean | null; reason: string; raw?: unknown };

/** "…/posts/123", "…?story_fbid=123&id=456", "…/videos/123", or a bare id. */
export function extractPostIdFromUrl(url: string): string | null {
  const s = (url || "").trim();
  if (/^\d+$/.test(s)) return s;
  const story = s.match(/story_fbid=(\d+)/);
  if (story) return story[1];
  const path = s.match(/\/(?:posts|videos|photos|reel)\/(?:pcb\.)?(\d+)/);
  if (path) return path[1];
  const tail = s.match(/\/(\d{6,})\/?(?:\?|$)/);
  return tail ? tail[1] : null;
}

/**
 * Can this page post be turned into an ad?
 *
 * Facebook exposes `is_eligible_for_promotion` on a post and it is free to read,
 * yet nothing asked it: a campaign went straight to payment and discovered the
 * answer only when the ad creative was rejected with a generic "Invalid
 * parameter", after the money had moved.
 */
export async function checkPostPromotable(pageId: string, postUrl: string): Promise<Promotable> {
  const postId = extractPostIdFromUrl(postUrl);
  if (!postId) {
    return { promotable: false, reason: "تعذّر قراءة رقم المنشور من الرابط — تأكّد من نسخ رابط المنشور كاملاً." };
  }

  const { data: page } = await supabaseAdmin
    .from("connected_pages")
    .select("page_access_token")
    .eq("page_id", String(pageId))
    .limit(1).maybeSingle();
  const token = page?.page_access_token;
  if (!token) return { promotable: null, reason: "لا يوجد رمز للصفحة" };

  const full = postId.includes("_") ? postId : `${pageId}_${postId}`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${VERSION}/${full}` +
      `?fields=id,is_published,is_eligible_for_promotion&access_token=${token}`,
      { cache: "no-store" },
    );
    const d = await res.json();

    if (d?.error) {
      // A dead or re-authorised page token is our problem, not a verdict on the
      // post, so it must not block the sale.
      if (d.error.code === 190) return { promotable: null, reason: "رمز الصفحة منتهي", raw: d.error };
      return {
        promotable: false,
        reason: "لم يُعثر على هذا المنشور في الصفحة المختارة — تأكّد أن الرابط يخصّ نفس الصفحة.",
        raw: d.error,
      };
    }

    if (d?.is_published === false) {
      return { promotable: false, reason: "هذا المنشور غير منشور على الصفحة، فلا يمكن الإعلان عنه." };
    }

    if (d?.is_eligible_for_promotion === false) {
      return {
        promotable: false,
        reason:
          "فيسبوك لا يسمح بالإعلان عن هذا المنشور. " +
          "افتح «جودة الحساب» في إعدادات الصفحة لمعرفة السبب — " +
          "غالباً قيد على الصفحة نفسها أو مخالفة في محتوى المنشور. " +
          "جرّب منشوراً آخر، فإن رُفض كذلك فالقيد على الصفحة.",
        raw: d,
      };
    }

    if (d?.is_eligible_for_promotion === true) return { promotable: true, reason: "" };

    // The field was not returned at all — say so rather than inventing a verdict.
    return { promotable: null, reason: "تعذّر التحقق من أهلية المنشور", raw: d };
  } catch (e) {
    return { promotable: null, reason: "تعذّر الاتصال بفيسبوك", raw: String(e) };
  }
}
