import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authUser";
import { featuresFor } from "@/lib/entitlements";
import { UNIT_COST_USD, falErrorMessage, hasFal, submitVideo, videoStatus } from "@/services/studioImages";

/**
 * Video generation for the top plan (`ai_video`).
 *
 * A clip takes minutes, so this never blocks a request: POST submits the job and
 * returns a request id, GET reports on it. The UI polls until the clip is ready.
 *
 *   POST { prompt, imageUrl? }  → { requestId, cost_usd }
 *   GET  ?requestId=            → { state: pending | done | failed, url? }
 */

async function gate(userId: string, pageId?: string) {
  const features = await featuresFor(userId, "studio", pageId).catch(() => new Set<string>());
  if (!features.has("ai_video")) {
    return NextResponse.json({
      error: "upgrade_required", code: "ai_video",
      message: "توليد الفيديو متاح في باقة «الموظف الذكي VIP».",
    }, { status: 402 });
  }
  if (!hasFal()) {
    return NextResponse.json({ error: "not_configured", message: "مولّد الفيديو غير مُفعّل" }, { status: 503 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const prompt = String(b.prompt || "").trim();
  const imageUrl = b.imageUrl ? String(b.imageUrl) : undefined;
  const pageId = b.pageId ? String(b.pageId) : undefined;
  if (!prompt) return NextResponse.json({ error: "prompt مطلوب" }, { status: 400 });

  const denied = await gate(user.id, pageId);
  if (denied) return denied;

  try {
    const requestId = await submitVideo(prompt, imageUrl);
    return NextResponse.json({ requestId, cost_usd: UNIT_COST_USD.video });
  } catch (e) {
    return NextResponse.json({ error: "submit_failed", message: falErrorMessage(e) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const requestId = (req.nextUrl.searchParams.get("requestId") || "").trim();
  if (!requestId) return NextResponse.json({ error: "requestId مطلوب" }, { status: 400 });

  const denied = await gate(user.id, req.nextUrl.searchParams.get("pageId") || undefined);
  if (denied) return denied;

  return NextResponse.json(await videoStatus(requestId));
}
